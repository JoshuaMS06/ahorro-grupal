import {adminDatabase,permisoAdministrador,usuarioVerificado} from './adminServidor.js';
import {semanaPeriodo,isClassCode,isPeriodId,pagoClave} from './aulas.js';
import {corteActivo} from './reinicioContable.js';
import {rutaPagoSeleccionado,esSemanaAnterior} from './pagosAnteriores.js';
import {corregirRegistroPago} from './correccionesPago.js';

export async function atenderCorreccionPago(req,res){
  const {periodo,salon,estudianteId,semana,accion,motivo}=req.body||{};
  if(!isPeriodId(periodo)||!isClassCode(salon)
    ||typeof estudianteId!=='string'||!/^[A-Za-z0-9_-]{2,32}$/.test(estudianteId)
    ||!Number.isSafeInteger(semana)||semana<1||semana>500
    ||!['anular','restaurar'].includes(accion)
    ||typeof motivo!=='string'||motivo.trim().length<5||motivo.trim().length>200)
    return res.status(400).json({error:'Elige el pago y proporciona un motivo de 5 a 200 caracteres.'});
  try{
    const usuario=await usuarioVerificado(req);
    if(!usuario)return res.status(401).json({error:'Sesión no válida.'});
    const db=adminDatabase();
    const permiso=await permisoAdministrador(db,usuario.uid,periodo,salon);
    if(!permiso)return res.status(403).json({error:'Solo el responsable de este salón o el administrador general puede corregir sus pagos.'});
    const periodoSnap=await db.ref(`periodos/${periodo}/meta`).get();
    const meta=periodoSnap.val();
    if(!meta||meta.cerradoEn)return res.status(409).json({error:'El ciclo no existe o está cerrado.'});
    if(meta.vacaciones?.activas)return res.status(409).json({error:'La captura está suspendida por vacaciones.'});
    if(semana>semanaPeriodo(meta))return res.status(409).json({error:'No se puede corregir una semana futura.'});
    const periodos=periodo==='2026-2027-A'
      ? {'2026-2027-A':{meta}}:{[periodo]:{meta}};
    if(periodo==='2026-2027-A'&&!corteActivo(periodos))
      return res.status(409).json({error:'Aún no está activo el reinicio contable.'});
    const historica=esSemanaAnterior(periodos,periodo,semana);
    if(!historica && semana<Math.max(1,Number(meta.semanaBase)||1)){
      // En el corte 2026-2027-A se aceptan únicamente semanas >=5;
      // otros ciclos deben respetar su comienzo configurado.
      if(!(periodo==='2026-2027-A'&&semana>=5))
        return res.status(409).json({error:'La semana seleccionada es anterior al inicio permitido.'});
    }
    const nodo=rutaPagoSeleccionado(periodos,periodo,semana),key=pagoClave(estudianteId,semana);
    if(historica){
      const legado=(await db.ref(`aulas/${periodo}/${salon}/pagos/${key}`).get()).val();
      if(legado?.estado==='pagado')
        return res.status(409).json({error:'El pago anterior pertenece al registro legado y no se modifica aquí.'});
    }
    const path=`aulas/${periodo}/${salon}/${nodo}/${key}`,refPago=db.ref(path);
    const inicial=(await refPago.get()).val();
    if(!inicial)return res.status(404).json({error:'No existe un pago para esa persona y semana.'});
    const folio=refPago.child('historial').push().key;
    if(!folio)return res.status(500).json({error:'No fue posible preparar el movimiento de auditoría.'});
    const args={accion,estudianteId,semana,uid:usuario.uid,motivo:motivo.trim(),folio,ahora:Date.now()};
    let mensaje='El pago fue modificado desde otra sesión. Actualiza la pantalla.';
    const resultado=await refPago.transaction(actual=>{
      try{
        // Firebase Admin puede iniciar una transacción con un null local
        // provisional. Usar el registro leído hasta recibir el valor real.
        return corregirRegistroPago(actual==null?inicial:actual,args);
      }catch(error){mensaje=error.message;return;}
    },undefined,false);
    if(!resultado.committed)return res.status(409).json({error:mensaje});
    return res.status(200).json({ok:true,estado:resultado.snapshot.val().estado,
      monto:resultado.snapshot.val().monto,nodo,semana});
  }catch(error){
    console.error('Corrección de pago:',error?.code||error?.message||'error');
    return res.status(500).json({error:'No se pudo corregir el pago. Consulta los registros del servidor.'});
  }
}
