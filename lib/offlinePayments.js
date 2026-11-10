// Operaciones financieras en espera: estado local, nunca saldo confirmado.
// Cada operación identifica la versión que el responsable vio antes de perder
// la conexión. El servidor valida esa versión en una transacción atómica.
export function versionPago(pago){
  if(!pago)return 'sin-pago';
  const historiales=pago.historial&&typeof pago.historial==='object'&&!Array.isArray(pago.historial)
    ?Object.keys(pago.historial).length:0;
  return `${pago.estado||''}|${pago.creadoEn||0}|${pago.correcciones||0}|${historiales}`;
}
export function crearCambioPendiente({uid,periodo,salon,estudianteId,semana,nombre,base,deseado,id,creadoEn}){
  if(!uid||!/^[0-9]{4}-[0-9]{4}-[A-Z0-9]{1,5}$/.test(periodo)
    ||!/^[A-Za-z0-9_-]{1,24}$/.test(salon)
    ||!/^[A-Za-z0-9_-]{2,32}$/.test(estudianteId)
    ||!Number.isSafeInteger(semana)||semana<1||semana>500
    ||!['pagado','anulado'].includes(deseado)
    ||!['pagado','anulado','pendiente'].includes(base?.estado)
    ||typeof id!=='string'||!/^[a-zA-Z0-9_-]{8,80}$/.test(id))
    throw Error('Movimiento fuera de línea inválido.');
  return {clave:`${uid}|${periodo}|${salon}|${estudianteId}|${semana}`,
    uid,periodo,salon,estudianteId,semana,nombre:String(nombre||'').slice(0,120),
    baseEstado:base.estado,baseVersion:base.version,
    deseado,id,creadoEn,estado:'pendiente'};
}
export function estadoLocalPago(pago,pendiente){
  if(!pendiente)return pago?.estado==='pagado'?'pagado':pago?.estado==='anulado'?'pendiente':'pendiente';
  return pendiente.deseado==='pagado'?'pagado':'pendiente';
}
export function cambiarDeseado(pendiente,estadoSiguiente,estadoOriginal){
  // Si el estado regresa al original, la cola se puede vaciar sin enviar nada.
  const equivalente=estadoOriginal==='pagado'?'pagado':'pendiente';
  if((estadoSiguiente==='pagado'?'pagado':'pendiente')===equivalente)return null;
  return {...pendiente,deseado:estadoSiguiente,estado:'pendiente'};
}

export function crearMovimientoConIdentidad(datos){
  // Sólo se ejecuta cuando el responsable pulsa + o −, nunca al renderizar.
  return crearCambioPendiente({...datos,id:crypto.randomUUID(),creadoEn:Date.now()});
}
