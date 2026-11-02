import {adminDatabase,usuarioVerificado} from '../lib/adminServidor.js';
import {generarCodigoSalon,digestCodigoSalon} from '../lib/codigosSalon.js';
import {isClassCode,isPeriodId} from '../lib/aulas.js';

// Solo el administrador general genera o rota códigos. Nunca se consultan en claro.
export default async function handler(req,res){
  res.setHeader('Cache-Control','no-store');
  if(!['GET','POST'].includes(req.method))return res.status(405).json({error:'Método no permitido.'});
  if(!/^Bearer \S+$/.test(req.headers.authorization||''))return res.status(401).json({error:'Inicia sesión como administrador general.'});
  try{
    const usuario=await usuarioVerificado(req);
    if(!usuario)return res.status(401).json({error:'Sesión no válida.'});
    const db=adminDatabase();
    const admin=(await db.ref('roles/adminGeneralUid').get()).val();
    if(admin!==usuario.uid)return res.status(403).json({error:'Solo el administrador general puede administrar códigos.'});

    if(req.method==='GET'){
      const [periodosSnap,codigosSnap]=await Promise.all([
        db.ref('periodos').get(),db.ref('codigosSalon').get()
      ]);
      const periodos=periodosSnap.val()||{},codigos=codigosSnap.val()||{};
      const salones=Object.entries(periodos).filter(([,p])=>p?.meta&&!p.meta.cerradoEn)
        .flatMap(([periodo,p])=>Object.keys(p.salones||{}).map(salon=>{
          const c=codigos?.[periodo]?.[salon];
          return {periodo,salon,configurado:!!c?.digest,version:c?.version||0,actualizadoEn:c?.actualizadoEn||null};
        })).sort((a,b)=>a.periodo.localeCompare(b.periodo)||a.salon.localeCompare(b.salon,'es',{numeric:true}));
      return res.status(200).json({salones});
    }

    const {periodo,salon,accion}=req.body||{};
    if(!isPeriodId(periodo)||!isClassCode(salon)||!['crear','rotar'].includes(accion))
      return res.status(400).json({error:'Datos de salón inválidos.'});
    const periodoSnap=await db.ref(`periodos/${periodo}`).get();
    const p=periodoSnap.val();
    if(!p?.salones?.[salon] || p?.meta?.cerradoEn)
      return res.status(409).json({error:'El salón no existe o el ciclo está cerrado.'});
    const codigo=generarCodigoSalon(),digest=digestCodigoSalon(codigo),ahora=Date.now();
    const configRef=db.ref(`codigosSalon/${periodo}/${salon}`);
    const resultado=await configRef.transaction(actual=>{
      if(accion==='crear' && actual)return;
      if(accion==='rotar' && !actual)return;
      const version=Number.isSafeInteger(actual?.version)&&actual.version>0?actual.version+1:1;
      return {digest,version,actualizadoEn:ahora,actualizadoPor:usuario.uid};
    },undefined,false);
    if(!resultado.committed)
      return res.status(409).json({error:'La configuración cambió. Actualiza antes de generar otro código.'});
    // El código solo se revela en esta respuesta; no puede recuperarse después.
    return res.status(200).json({ok:true,periodo,salon,codigo,version:resultado.snapshot.val().version});
  }catch(error){
    console.error('Códigos de salón:',error?.code||error?.message||'error');
    return res.status(500).json({error:'No se pudieron administrar los códigos de salón.'});
  }
}
