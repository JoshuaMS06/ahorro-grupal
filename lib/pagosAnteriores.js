// Registro de semanas 1–4 por separado, sin trasladar importes al fondo nuevo.
import {corteActivo, PERIODO_REINICIO, SEMANA_INICIO_REINICIO, rutaPagos} from './reinicioContable.js';
import {pagoClave} from './aulas.js';

export function esSemanaAnterior(periodos,periodo,semana) {
  return periodo===PERIODO_REINICIO && corteActivo(periodos) && Number.isSafeInteger(semana)
    && semana>=1 && semana<SEMANA_INICIO_REINICIO;
}
export function rutaPagoSeleccionado(periodos,periodo,semana) {
  return esSemanaAnterior(periodos,periodo,semana)?'pagosAnteriores':rutaPagos(periodos,periodo);
}
export function primeraSemanaVisible(periodos,periodo,metaPeriodo={},metaSalon={}) {
  return periodo===PERIODO_REINICIO && corteActivo(periodos)
    ? 1 : Math.max(1,Number(metaSalon?.inicioDetalle)||Number(metaPeriodo?.semanaBase)||1);
}
export function esPagoLegado(pagosLegado,estudianteId,semana) {
  return pagosLegado?.[pagoClave(estudianteId,semana)]?.estado==='pagado';
}
export function resumenPagosAnteriores(pagos={}) {
  const activos=Object.values(pagos||{}).filter(p=>p?.estado==='pagado' && p.tipoRegistro==='anterior' && p.semana>=1 && p.semana<5);
  return {registros:activos.length,importeHistorico:activos.reduce((total,p)=>total+Number(p.monto||0),0)};
}
