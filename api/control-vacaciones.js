import {adminDatabase, usuarioVerificado} from '../lib/adminServidor.js';
import {aplicarVacaciones,esConfirmacionValida} from '../lib/vacaciones.js';

// Solo el administrador general puede detener y reanudar el calendario.
// La confirmación se valida también en el servidor (no solo en la pantalla).
export default async function handler(req,res) {
  res.setHeader('Cache-Control','no-store');
  if(req.method!=='POST')return res.status(405).json({error:'Método no permitido.'});
  const {periodo,accion,confirmacion}=req.body||{};
  if(typeof periodo!=='string'||!/^\d{4}-\d{4}-[AB]$/.test(periodo)||!['iniciar','reanudar'].includes(accion))
    return res.status(400).json({error:'Solicitud inválida.'});
  if(!esConfirmacionValida(confirmacion))return res.status(400).json({error:'Debes escribir exactamente CONFIRMAR.'});
  if(!/^Bearer \S+$/.test(req.headers.authorization||''))return res.status(401).json({error:'Inicia sesión como administrador general.'});
  try {
    const usuario=await usuarioVerificado(req);
    if(!usuario)return res.status(401).json({error:'Sesión inválida.'});
    const db=adminDatabase();
    const general=await db.ref('roles/adminGeneralUid').get();
    if(general.val()!==usuario.uid)return res.status(403).json({error:'Solo el administrador general puede controlar las vacaciones.'});
    const cuando=Date.now();
    let motivo='El estado cambió. Actualiza la pantalla e inténtalo de nuevo.';
    const resultado=await db.ref(`periodos/${periodo}/meta`).transaction(meta=>{
      try{return aplicarVacaciones(meta,accion,cuando);}
      catch(error){motivo=error.message;return;}
    },undefined,false);
    if(!resultado.committed)return res.status(409).json({error:motivo});
    const meta=resultado.snapshot.val();
    return res.status(200).json({ok:true,accion,semana:meta.vacaciones?.semanaPausada,fecha:cuando,vacacionesActivas:meta.vacaciones?.activas===true});
  } catch(error){
    console.error('Control de vacaciones:',error?.code||error?.message||'error');
    return res.status(500).json({error:'No se pudo actualizar el calendario; revisa los registros del servidor.'});
  }
}
