// Calendario de vacaciones. Las semanas no avanzan mientras el semestre esté pausado.
// Todas las fechas civiles se calculan en America/Mexico_City, no en UTC del navegador.
import {fechaMexico, semanaPeriodo} from './aulas.js';

const MS_DIA = 86400000;

export function lunesDeSemanaMexico(instante=Date.now()) {
  const fecha = fechaMexico(instante);
  const fechaUTC = new Date(`${fecha}T00:00:00Z`);
  const diferencia = (fechaUTC.getUTCDay() + 6) % 7;
  return new Date(fechaUTC.getTime() - diferencia*MS_DIA).toISOString().slice(0,10);
}

export function iniciarVacaciones(meta, instante=Date.now()) {
  if(!meta || meta.cerradoEn) throw Error('El ciclo está archivado o no existe.');
  if(meta.vacaciones?.activas === true) throw Error('Las vacaciones ya están activas.');
  const semanaPausada = semanaPeriodo(meta, instante);
  if(!Number.isSafeInteger(semanaPausada) || semanaPausada < 1) throw Error('Semana inválida.');
  return {
    ...meta,
    vacaciones:{activas:true,semanaPausada,iniciadasEn:instante},
  };
}

export function reanudarVacaciones(meta, instante=Date.now()) {
  if(!meta || meta.cerradoEn) throw Error('El ciclo está archivado o no existe.');
  const estado=meta.vacaciones;
  if(estado?.activas !== true) throw Error('No hay vacaciones activas.');
  if(!Number.isSafeInteger(estado.semanaPausada) || estado.semanaPausada < 1) throw Error('No hay una semana válida para reanudar.');
  if(!Number.isFinite(estado.iniciadasEn) || instante < estado.iniciadasEn) throw Error('La fecha de reanudación no es válida.');
  // La semana pausada dura hasta el siguiente domingo. La siguiente
  // aportación semanal comienza el próximo lunes, sin semanas de vacaciones.
  return {
    ...meta,
    lunesBase:lunesDeSemanaMexico(instante),
    semanaBase:estado.semanaPausada,
    vacaciones:{activas:false,semanaPausada:estado.semanaPausada,iniciadasEn:estado.iniciadasEn,reanudadasEn:instante},
  };
}

export function aplicarVacaciones(meta, accion, instante=Date.now()) {
  if(accion==='iniciar') return iniciarVacaciones(meta,instante);
  if(accion==='reanudar') return reanudarVacaciones(meta,instante);
  throw Error('Acción de vacaciones no válida.');
}

// Cuando solo hay un ciclo activo, lo usamos para sincronizar la semana del cron.
// Si hay dos ciclos activos no debemos adivinar cuál corresponde.
export function seleccionarCicloActivo(periodos) {
  const activos=Object.entries(periodos||{}).filter(([,periodo])=>periodo?.meta && !periodo.meta.cerradoEn);
  if(activos.length !== 1) throw Error('Debe existir exactamente un ciclo activo para actualizar la semana.');
  return {id:activos[0][0],meta:activos[0][1].meta};
}

export function esConfirmacionValida(valor) {
  return valor==='CONFIRMAR';
}
