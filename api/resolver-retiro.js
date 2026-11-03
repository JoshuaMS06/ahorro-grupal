import {adminDatabase,usuarioVerificado} from '../lib/adminServidor.js';
import {resumirFondos} from '../lib/fondos.js';
import {corteActivo,rutaRetiros,resumirAhorroReiniciado} from '../lib/reinicioContable.js';
import {atenderCorreccionPago} from '../lib/apiCorreccionPago.js';

export default async function handler(req,res){
  res.setHeader('Cache-Control','no-store');
  if(req.method!=='POST')return res.status(405).json({error:'Método no permitido.'});
  if(!/^Bearer \S+$/.test(req.headers.authorization||''))return res.status(401).json({error:'Inicia sesión para gestionar movimientos de tu salón.'});
  // Reutiliza el endpoint financiero existente: Vercel Hobby ya alcanza el
  // máximo de funciones. Los retiros mantienen sus permisos generales.
  if(req.body?.operacion==='correccionPago')return atenderCorreccionPago(req,res);
  const {periodo,salon,retiroId,estado}=req.body||{};
  if(typeof periodo!=='string'||!/^\d{4}-\d{4}-[A-Z0-9]{1,5}$/.test(periodo)||
     typeof salon!=='string'||!/^[A-Za-z0-9_-]{1,24}$/.test(salon)||
     typeof retiroId!=='string'||!/^[A-Za-z0-9_-]{1,128}$/.test(retiroId)||
     !['aprobado','rechazado'].includes(estado))return res.status(400).json({error:'Solicitud inválida.'});
  try{
    const user=await usuarioVerificado(req);
    const db=adminDatabase();
    if((await db.ref('roles/adminGeneralUid').get()).val()!==user.uid)return res.status(403).json({error:'Solo el administrador general puede resolver retiros.'});
    const metaPeriodo=(await db.ref(`periodos/${periodo}/meta`).get()).val();
    if(!metaPeriodo||metaPeriodo.cerradoEn)return res.status(409).json({error:'El ciclo está archivado o no existe.'});
    const periodos=(await db.ref('periodos').get()).val()||{};
    if(periodo==='2026-2027-A'&&!corteActivo(periodos))return res.status(409).json({error:'Reinicio contable pendiente de activar.'});
    const legacy=corteActivo(periodos)?{}:(await db.ref('ahorro/integrantes').get()).val()||{};
    // La transacción sobre TODAS las aulas evita aprobar dos retiros simultáneos
    // contra el saldo de carrera, incluso desde salones distintos.
    let motivoBloqueo='La solicitud ya cambió o no existe saldo suficiente.';
    const tx=await db.ref('aulas').transaction(aulas=>{
      const actual=aulas?.[periodo]?.[salon];
      const nodo=rutaRetiros(periodos,periodo);
      const solicitud=actual?.[nodo]?.[retiroId];
      if(!actual?.meta||solicitud?.estado!=='solicitado')return;
      if(!Number.isSafeInteger(solicitud.monto)||solicitud.monto<=0||solicitud.monto>1000000)return;
      if(solicitud.fondo!=='carrera'){
        motivoBloqueo='Este retiro anterior requiere conciliación manual; no se cambiará su origen automáticamente.';return;
      }
      if(estado==='aprobado'){
        const resumen=corteActivo(periodos)?resumirAhorroReiniciado(aulas,periodos):resumirFondos(aulas,legacy);
        if(!resumen.cifrasConfiables){motivoBloqueo='Existen retiros previos sin fondo clasificado. Revísalos antes de aprobar.';return;}
        const disponible=resumen.totalCarrera;
        if(disponible<solicitud.monto||disponible<0)return;
      }
      actual[nodo][retiroId]={...solicitud,estado,respondidoPor:user.uid,respondidoEn:Date.now()};
      return aulas;
    },undefined,false);
    if(!tx.committed)return res.status(409).json({error:motivoBloqueo});
    return res.status(200).json({ok:true,estado});
  }catch(error){
    console.error('No se pudo resolver el retiro:',error?.code||error?.message||'error');
    return res.status(500).json({error:'No se pudo completar la operación. Consulta los registros en Vercel.'});
  }
}
