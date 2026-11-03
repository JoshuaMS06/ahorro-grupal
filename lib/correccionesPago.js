// Corrección reversible de un pago específico, sin borrar su registro,
// su desglose monetario ni las personas que hicieron capturas anteriores.
export function corregirRegistroPago(pago,{accion,estudianteId,semana,uid,motivo,folio,ahora}) {
  if(!['anular','restaurar'].includes(accion))throw Error('Acción de corrección inválida.');
  if(!pago || pago.estudianteId!==estudianteId || pago.semana!==semana)
    throw Error('El pago no existe o no coincide con la semana seleccionada.');
  if(typeof uid!=='string'||!uid||typeof folio!=='string'||!folio)
    throw Error('No se pudo identificar al responsable o al movimiento.');
  const texto=typeof motivo==='string'?motivo.trim():'';
  if(texto.length<5||texto.length>200)
    throw Error('Escribe un motivo de entre 5 y 200 caracteres.');
  if(!Number.isSafeInteger(ahora)||ahora<=0)throw Error('Fecha de corrección inválida.');
  if(!Number.isSafeInteger(pago.monto)||pago.monto<=0)
    throw Error('El importe original es inválido.');
  if(!pago.historial || typeof pago.historial!=='object' || Array.isArray(pago.historial)
    || pago.historial[folio])
    throw Error('El historial del pago está incompleto o existe una corrección duplicada.');
  const esperado=accion==='anular'?'pagado':'anulado';
  if(pago.estado!==esperado)throw Error(accion==='anular'
    ? 'El pago ya no está activo.'
    : 'El pago no está anulado.');
  if(pago.tipoRegistro==='anterior' && (pago.fondoGrupo!==0||pago.fondoCarrera!==0))
    throw Error('Los pagos históricos deben permanecer fuera del fondo actual.');
  if(pago.tipoRegistro!=='anterior'
    && (!Number.isSafeInteger(pago.fondoGrupo)||!Number.isSafeInteger(pago.fondoCarrera)
      ||pago.fondoGrupo<0||pago.fondoCarrera<0||pago.fondoGrupo+pago.fondoCarrera!==pago.monto))
    throw Error('La división original del dinero no es válida.');
  const evento={tipo:accion==='anular'?'anulacion':'registro',fecha:ahora,uid,motivo:texto};
  return {
    ...pago,
    estado:accion==='anular'?'anulado':'pagado',
    ...(accion==='anular'?{anuladoEn:ahora,anuladoPor:uid}:{}),
    correcciones:(Number.isSafeInteger(pago.correcciones)&&pago.correcciones>=0?pago.correcciones:0)+1,
    historial:{...pago.historial,[folio]:evento}
  };
}
