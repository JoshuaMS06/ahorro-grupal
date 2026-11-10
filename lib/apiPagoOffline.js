// Conciliación de pagos guardados SIN conexión. El cliente nunca determina
// el importe ni concede permisos. Las semanas/fondos se recalculan en servidor.
import {adminDatabase,permisoAdministrador,usuarioVerificado} from './adminServidor.js';
import {semanaPeriodo,pagoClave,cuotaDeSalon,isClassCode,isPeriodId} from './aulas.js';
import {corteActivo,rutaPagos} from './reinicioContable.js';
import {esSemanaAnterior,esPagoLegado,rutaPagoSeleccionado} from './pagosAnteriores.js';
import {distribucionNueva} from './fondos.js';
import {aplicarMovimientoOffline} from './aplicarPagoOffline.js';
import {versionPago} from './offlinePayments.js';

export async function atenderPagoOffline(req,res){
  const {periodo,salon,estudianteId,semana,deseado,baseVersion,id}=req.body||{};
  if(!isPeriodId(periodo)||!isClassCode(salon)
    ||typeof estudianteId!=='string'||!/^[A-Za-z0-9_-]{2,32}$/.test(estudianteId)
    ||!Number.isSafeInteger(semana)||semana<1||semana>500
    ||!['pagado','anulado'].includes(deseado)
    ||typeof baseVersion!=='string'||baseVersion.length>180
    ||typeof id!=='string'||!/^[A-Za-z0-9_-]{8,80}$/.test(id))
    return res.status(400).json({error:'Movimiento pendiente inválido.'});
  try{
    const usuario=await usuarioVerificado(req);
    if(!usuario)return res.status(401).json({error:'Sesión caducada. Conéctate y vuelve a iniciar sesión.'});
    const db=adminDatabase();
    const permiso=await permisoAdministrador(db,usuario.uid,periodo,salon);
    if(!permiso)return res.status(403).json({error:'Ya no tienes permiso para registrar pagos en este salón.'});
    const [metaSnap,salonSnap,alumnoSnap]=await Promise.all([
      db.ref(`periodos/${periodo}/meta`).get(),
      db.ref(`aulas/${periodo}/${salon}/meta`).get(),
      db.ref(`aulas/${periodo}/${salon}/integrantes/${estudianteId}`).get()
    ]);
    const meta=metaSnap.val(),configSalon=salonSnap.val(),alumno=alumnoSnap.val();
    if(!meta||meta.cerradoEn||!configSalon||!alumno)
      return res.status(409).json({conflicto:true,error:'El ciclo, salón o alumno ya no está activo.'});
    if(meta.vacaciones?.activas)
      return res.status(409).json({conflicto:true,error:'Las aportaciones están suspendidas por vacaciones.'});
    if(semana>semanaPeriodo(meta))
      return res.status(409).json({conflicto:true,error:'La semana todavía no está activa.'});
    const periodos={[periodo]:{meta}};
    if(periodo==='2026-2027-A'&&!corteActivo(periodos))
      return res.status(409).json({conflicto:true,error:'El ahorro vigente todavía no está activo.'});
    const anterior=esSemanaAnterior(periodos,periodo,semana);
    if(!anterior&&semana<Math.max(1,Number(meta.semanaBase)||1)
      &&!(periodo==='2026-2027-A'&&semana>=5))
      return res.status(409).json({conflicto:true,error:'La semana es anterior al inicio de este ciclo.'});
    const nodo=rutaPagoSeleccionado(periodos,periodo,semana);
    if(nodo!==rutaPagos(periodos,periodo)&&!anterior)
      return res.status(409).json({conflicto:true,error:'La semana no corresponde al libro actual.'});
    if(anterior){
      const original=(await db.ref(`aulas/${periodo}/${salon}/pagos/${pagoClave(estudianteId,semana)}`).get()).val();
      if(esPagoLegado({[pagoClave(estudianteId,semana)]:original},estudianteId,semana))
        return res.status(409).json({conflicto:true,error:'Ese pago original anterior no se puede modificar.'});
    }
    const referencia=db.ref(`aulas/${periodo}/${salon}/${nodo}/${pagoClave(estudianteId,semana)}`);
    const inicial=(await referencia.get()).val();
    if(inicial?.historial?.[id])return res.status(200).json({ok:true,idempotente:true,estado:inicial.estado});
    if(versionPago(inicial)!==baseVersion)
      return res.status(409).json({conflicto:true,error:'Este pago cambió en otro dispositivo. No se aplicó el movimiento offline.'});
    if(deseado==='anulado'&&inicial?.estado!=='pagado')
      return res.status(409).json({conflicto:true,error:'El pago ya no estaba registrado.'});
    if(deseado==='pagado'&&inicial?.estado==='pagado')
      return res.status(409).json({conflicto:true,error:'El pago ya estaba registrado por otra persona.'});
    const ahora=Date.now();
    const cuota=cuotaDeSalon(salon,configSalon);
    const distribucion=distribucionNueva(periodo,salon,configSalon);
    if(cuota!==distribucion.cuota)
      return res.status(409).json({conflicto:true,error:'Cambió la cuota del salón. Revisa el pago.'});
    let conflicto='El pago cambió desde otra sesión. No se duplicó ni modificó dinero.';
    const tx=await referencia.transaction(actual=>{
      // Firebase Admin inicialmente puede entregar null al ejecutar transacción.
      const previo=actual==null&&inicial!=null?inicial:actual;
      try{
        return aplicarMovimientoOffline(previo,{
          estudianteId,semana,deseado,baseVersion,id,uid:usuario.uid,ahora,
          anterior,cuota,distribucion,nombre:alumno.nombre
        });
      }catch(error){conflicto=error.message;return;}
    },undefined,false);
    if(!tx.committed){
      const ultimo=(await referencia.get()).val();
      if(ultimo?.historial?.[id])return res.status(200).json({ok:true,idempotente:true,estado:ultimo.estado});
      return res.status(409).json({conflicto:true,error:conflicto});
    }
    return res.status(200).json({ok:true,estado:tx.snapshot.val()?.estado,semana,monto:cuota});
  }catch(error){
    console.error('Pago offline:',error?.code||error?.message||'error');
    return res.status(503).json({error:'No se pudo sincronizar este pago. Se conservará pendiente para reintentar.'});
  }
}
