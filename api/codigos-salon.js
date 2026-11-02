import {adminDatabase,usuarioVerificado} from '../lib/adminServidor.js';
import {generarCodigoSalon,digestCodigoSalon} from '../lib/codigosSalon.js';
import {cifrarPin,descifrarPin,recuperarPin4,clavePinServidor} from '../lib/pinProtegido.js';
import {isClassCode,isPeriodId} from '../lib/aulas.js';

// Solo el administrador general puede consultar, crear y cambiar PIN.
// No se devuelven contraseñas en el listado: el PIN se pide individualmente.
export default async function handler(req,res){
  res.setHeader('Cache-Control','no-store');
  if(!['GET','POST'].includes(req.method))return res.status(405).json({error:'Método no permitido.'});
  if(!/^Bearer \S+$/.test(req.headers.authorization||''))
    return res.status(401).json({error:'Inicia sesión como administrador general.'});
  try{
    const usuario=await usuarioVerificado(req);
    if(!usuario)return res.status(401).json({error:'Sesión no válida.'});
    const db=adminDatabase();
    if((await db.ref('roles/adminGeneralUid').get()).val()!==usuario.uid)
      return res.status(403).json({error:'Solo el administrador general puede administrar códigos.'});

    if(req.method==='GET'){
      if(req.query?.accion==='ver'){
        const {periodo,salon}=req.query||{};
        if(!isPeriodId(periodo)||!isClassCode(salon))
          return res.status(400).json({error:'Selecciona un salón válido.'});
        const actual=(await db.ref(`codigosSalon/${periodo}/${salon}`).get()).val();
        if(!actual?.digest)return res.status(404).json({error:'Este salón todavía no tiene PIN.'});
        let codigo=null;
        if(actual.pinCifrado){
          try{codigo=descifrarPin(actual.pinCifrado,periodo,salon,clavePinServidor());}
          catch{/* recuperación de versiones anteriores */}
        }
        if(!codigo || digestCodigoSalon(codigo)!==actual.digest)codigo=recuperarPin4(actual.digest);
        if(!codigo)return res.status(409).json({
          error:'El código anterior es demasiado largo para recuperarlo. Utiliza Cambiar código para establecer un PIN de 4 dígitos.'
        });
        return res.status(200).json({periodo,salon,codigo,version:actual.version});
      }
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
    const [periodoSnap,codigosSnap]=await Promise.all([
      db.ref(`periodos/${periodo}`).get(),db.ref('codigosSalon').get()
    ]);
    const p=periodoSnap.val(),existentes=codigosSnap.val()||{};
    if(!p?.salones?.[salon]||p?.meta?.cerradoEn)
      return res.status(409).json({error:'El salón no existe o el ciclo está cerrado.'});
    const configRef=db.ref(`codigosSalon/${periodo}/${salon}`);
    const anterior=(await configRef.get()).val();
    if(accion==='rotar'&&!anterior?.digest)
      return res.status(409).json({error:'No hay código para cambiar. Actualiza y pulsa Generar código.'});
    if(accion==='crear'&&anterior?.digest)
      return res.status(409).json({error:'El salón ya tiene un código. Actualiza el panel para consultarlo.'});

    const usados=new Set(Object.values(existentes).flatMap(ciclo=>
      Object.values(ciclo||{}).map(item=>item?.digest).filter(Boolean)));
    let codigo='',digest='';
    for(let intento=0;intento<80;intento++){
      const candidato=generarCodigoSalon(),hash=digestCodigoSalon(candidato);
      if(!usados.has(hash)){codigo=candidato;digest=hash;break;}
    }
    if(!codigo)return res.status(503).json({error:'No fue posible generar un PIN distinto. Inténtalo nuevamente.'});
    const ahora=Date.now(),version=(Number.isSafeInteger(anterior?.version)?anterior.version:0)+1;
    const pinCifrado=cifrarPin(codigo,periodo,salon,clavePinServidor());
    const esperado=anterior?.digest||null;
    const resultado=await configRef.transaction(actual=>{
      // Firebase Admin puede invocar primero la transacción con null mientras
      // obtiene el estado remoto. Nunca abortar por ese null especulativo.
      // Cuando llega el valor real, comparar el digest anterior para evitar
      // sobrescribir un cambio concurrente.
      if(actual?.digest && (actual.digest!==esperado || actual.version!==anterior?.version))return;
      if(actual?.digest && accion==='crear')return;
      if(!actual && accion==='rotar'&&!esperado)return;
      return {digest,pinCifrado,version,actualizadoEn:ahora,actualizadoPor:usuario.uid};
    },undefined,false);
    if(!resultado.committed)
      return res.status(409).json({error:'El código cambió en otra sesión. Pulsa Actualizar salones.'});
    return res.status(200).json({ok:true,periodo,salon,codigo,version});
  }catch(error){
    console.error('Códigos de salón:',error?.code||error?.message||'error');
    return res.status(500).json({error:'No se pudieron administrar los códigos de salón.'});
  }
}
