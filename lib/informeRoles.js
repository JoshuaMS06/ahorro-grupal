// Solo datos que corresponde mostrar a cada tipo de usuario.
// No confundir esto con las reglas de lectura de Firebase (revisión pendiente).
export function informeVisibleSegunRol(resumen, permiso, generacionId) {
  if(!permiso || !['general','responsable','lector'].includes(permiso.tipo))throw Error('Acceso no autorizado al informe.');
  const g=resumen.generaciones[generacionId]||{aportacionCarrera:0,ahorroGrupo:0};
  return {
    generacionId,
    aportacionCarrera:g.aportacionCarrera,
    saldoCarreraSalon:Math.max(0,(g.aportacionCarrera||0)-(g.retiradoCarrera||0)),
    // Solo el ahorro nuevo de la generación consultada (nunca el legado).
    ahorroPropioSalon:resumen.totalAhorro507===undefined?0:(g.ahorroGrupo||0),
    // Suma real de ambas partes, NO un nuevo fondo. Se muestra para
    // que los integrantes no confundan dos partidas de $10 con $40.
    totalAportadoSalon:(g.aportacionCarrera||0)+(resumen.totalAhorro507===undefined?0:(g.ahorroGrupo||0)),
    conciliacion507:resumen.conciliacion507 && generacionId==='gen-2026-2027-A-507'
      ? resumen.conciliacion507 : null,
    totalCarrera:resumen.totalCarrera,
    cifrasConfiables:resumen.cifrasConfiables,
    retirosSinClasificar:resumen.retirosNoClasificados.length,
  };
}
