import {createHash,randomBytes} from 'node:crypto';
import {adminAuth,adminDatabase} from '../lib/adminServidor.js';
import {codigoSalonCoincide,normalizarCodigoSalon} from '../lib/codigosSalon.js';
import {isClassCode,isPeriodId} from '../lib/aulas.js';

const VENTANA=15*60*1000;
const MAX_INTENTOS=8;

export default async function handler(req,res){
  res.setHeader('Cache-Control','no-store');
  if(req.method!=='POST')return res.status(405).json({error:'Método no permitido.'});
  try{
    const {periodo,salon,codigo}=req.body||{};
    if(!isPeriodId(periodo)||!isClassCode(salon)||typeof codigo!=='string'||codigo.length>45
       ||normalizarCodigoSalon(codigo).length!==16)
      return res.status(400).json({error:'Selecciona un salón e introduce un código válido.'});
    const db=adminDatabase();
    // No se almacena ni devuelve la dirección IP. El contador registra solo su digest.
    const ip=String(req.headers['x-forwarded-for']||req.socket?.remoteAddress||'desconocida').split(',')[0].trim();
    const ipHash=createHash('sha256').update(ip).digest('hex').slice(0,32);
    const intentosRef=db.ref(`intentosCodigoSalon/${ipHash}/${periodo}_${salon}`);
    const actual=(await intentosRef.get()).val();
    const ahora=Date.now();
    if(actual?.desde>ahora-VENTANA && actual?.cantidad>=MAX_INTENTOS)
      return res.status(429).json({error:'Demasiados intentos. Inténtalo nuevamente en unos minutos.'});
    const [codigoSnap,periodoSnap]=await Promise.all([
      db.ref(`codigosSalon/${periodo}/${salon}`).get(),db.ref(`periodos/${periodo}`).get()
    ]);
    const config=codigoSnap.val(),p=periodoSnap.val();
    if(!p?.salones?.[salon] || p?.meta?.cerradoEn || !codigoSalonCoincide(codigo,config?.digest)){
      await intentosRef.transaction(v=>{
        const desde=Number.isSafeInteger(v?.desde)&&v.desde>ahora-VENTANA?v.desde:ahora;
        const cantidad=desde===v?.desde?(Number(v?.cantidad)||0)+1:1;
        return {desde,cantidad};
      },undefined,false);
      return res.status(401).json({error:'Código incorrecto o inactivo. Verifícalo con el responsable de tu salón.'});
    }
    const version=config.version;
    if(!Number.isSafeInteger(version)||version<=0)
      return res.status(401).json({error:'Código incorrecto o inactivo.'});
    // Identidad técnica temporal y aleatoria de Firebase Auth: el estudiante
    // no proporciona correo, contraseña ni crea cuenta de manera manual.
    const uid=`visitante_${randomBytes(18).toString('hex')}`;
    const token=await adminAuth().createCustomToken(uid,{
      rolSalon:'consulta',periodoCodigo:periodo,salonCodigo:salon,versionCodigo:version
    });
    return res.status(200).json({token,periodo,salon});
  }catch(error){
    console.error('Ingreso por código:',error?.code||error?.message||'error');
    return res.status(500).json({error:'No se pudo verificar el código. Intenta nuevamente.'});
  }
}
