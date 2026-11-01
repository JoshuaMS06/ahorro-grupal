// Solo datos que corresponde mostrar a cada tipo de usuario.
// No confundir esto con las reglas de lectura de Firebase (revisión pendiente).
export function informeVisibleSegunRol(resumen, permiso, generacionId) {
  if(!permiso || !['general','responsable'].includes(permiso.tipo))throw Error('Acceso no autorizado al informe.');
  const g=resumen.generaciones[generacionId]||{aportacionCarrera:0};
  return {
    generacionId,
    aportacionCarrera:g.aportacionCarrera,
    totalCarrera:resumen.totalCarrera,
    cifrasConfiables:resumen.cifrasConfiables,
    retirosSinClasificar:resumen.retirosNoClasificados.length,
  };
}
