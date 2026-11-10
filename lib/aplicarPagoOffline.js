// Única transformación financiera de la cola local; se ejecuta EXCLUSIVAMENTE
// en el servidor durante transacción. Nunca usa importes enviados por la PWA.
import {versionPago} from './offlinePayments.js';
import {corregirRegistroPago} from './correccionesPago.js';

export function aplicarMovimientoOffline(previo,{
  estudianteId,semana,deseado,baseVersion,id,uid,ahora,
  anterior,cuota,distribucion,nombre
}){
  if(typeof uid!=='string'||!uid || !Number.isSafeInteger(semana)||semana<1
    ||!Number.isSafeInteger(ahora)||ahora<=0||typeof id!=='string'||!id
    ||!Number.isSafeInteger(cuota)||cuota<1
    ||!Number.isSafeInteger(distribucion.grupo)||distribucion.grupo<0
    ||!Number.isSafeInteger(distribucion.carrera)||distribucion.carrera<0
    ||distribucion.grupo+distribucion.carrera!==cuota)
    throw Error('El movimiento contable no es válido.');
  if(previo?.historial?.[id])return null; // Ya aplicado, no repetir.
  if(versionPago(previo)!==baseVersion)
    throw Error('El pago cambió desde otra sesión. No se duplicó ni modificó dinero.');
  if(deseado==='pagado'){
    if(previo?.estado==='anulado')return corregirRegistroPago(previo,{
      accion:'restaurar',estudianteId,semana,uid,
      motivo:'Pago offline sincronizado',folio:id,ahora
    });
    if(previo)throw Error('Este pago ya existe o cambió desde otra sesión.');
    return {estudianteId,nombre,semana,monto:cuota,
      fondoGrupo:anterior?0:distribucion.grupo,
      fondoCarrera:anterior?0:distribucion.carrera,
      ...(anterior?{tipoRegistro:'anterior'}:{}),
      estado:'pagado',creadoEn:ahora,registradoPor:uid,
      correcciones:0,historial:{[id]:{tipo:'registro',fecha:ahora,uid}}};
  }
  if(deseado==='anulado')return corregirRegistroPago(previo,{
    accion:'anular',estudianteId,semana,uid,
    motivo:'Pago offline sincronizado',folio:id,ahora
  });
  throw Error('Acción offline inválida.');
}
