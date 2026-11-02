// Solo datos que corresponde mostrar a cada tipo de usuario.
// No confundir esto con las reglas de lectura de Firebase (revisión pendiente).
export function informeVisibleSegunRol(resumen, permiso, generacionId) {
  if(!permiso || !['general','responsable'].includes(permiso.tipo))throw Error('Acceso no autorizado al informe.');
  const g=resumen.generaciones[generacionId]||{aportacionCarrera:0,ahorroGrupo:0};
  return {
    generacionId,
    aportacionCarrera:g.aportacionCarrera,
    // Solo el ahorro nuevo de la generación consultada (nunca el legado).
    ahorroPropioSalon:resumen.totalAhorro507===undefined?0:(g.ahorroGrupo||0),
    totalCarrera:resumen.totalCarrera,
    cifrasConfiables:resumen.cifrasConfiables,
    retirosSinClasificar:resumen.retirosNoClasificados.length,
  };
}
