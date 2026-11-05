import {GENERACION_ESPECIAL} from './fondos.js';
// Solo datos que corresponde mostrar a cada tipo de usuario.
// No confundir esto con las reglas de lectura de Firebase (revisión pendiente).
export function informeVisibleSegunRol(resumen, permiso, generacionId) {
  if(!permiso || !['general','responsable','lector'].includes(permiso.tipo))throw Error('Acceso no autorizado al informe.');
  const g=resumen.generaciones[generacionId]||{aportacionCarrera:0,ahorroGrupo:0};
  const reembolsoPrivado=generacionId===GENERACION_ESPECIAL ? (resumen.conciliacion507?.retirosPrivados||0) : 0;
  return {
    generacionId,
    aportacionCarrera:g.aportacionCarrera,
    saldoCarreraSalon:Math.max(0,Math.min((g.aportacionCarrera||0)-(g.retiradoCarrera||0),resumen.totalCarrera||0)),
    // Solo el ahorro nuevo de la generación consultada (nunca el legado).
    ahorroPropioSalon:resumen.totalAhorro507===undefined?0:(g.ahorroGrupo||0),
    // Suma real de ambas partes, NO un nuevo fondo. Se muestra para
    // que los integrantes no confundan dos partidas de $10 con $40.
    // Total RECAUDADO, distinto del saldo disponible después de retiros.
    totalAportadoSalon:(g.aportacionCarrera||0)+(resumen.totalAhorro507===undefined?0:(g.ahorroGrupo||0)+reembolsoPrivado),
    conciliacion507:resumen.conciliacion507 && generacionId==='gen-2026-2027-A-507'
      ? resumen.conciliacion507 : null,
    totalCarrera:resumen.totalCarrera,
    ...(permiso.tipo==='general'?{extraIngresado:resumen.extraIngresado||0}:{}),
    cifrasConfiables:resumen.cifrasConfiables,
    retirosSinClasificar:resumen.retirosNoClasificados.length,
  };
}
