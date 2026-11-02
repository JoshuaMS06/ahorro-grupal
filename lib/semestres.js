import {cuotaDeSalon, esLunes, isPeriodId, semanaPeriodo} from './aulas.js';
import {generacionDeAula,GENERACION_ESPECIAL} from './fondos.js';

// La letra es el semestre, no un dato que permita inferir fechas de calendario.
export function periodoSiguiente(actual) {
  if (!isPeriodId(actual)) throw Error('Periodo origen inválido.');
  const [inicio,fin,letra] = actual.split('-');
  if (letra==='A') return `${inicio}-${fin}-B`;
  if (letra==='B') return `${Number(inicio)+1}-${Number(fin)+1}-A`;
  throw Error('El periodo debe terminar en A o B.');
}

export function salonSiguiente(salon) {
  const match=/^(\d{1,2})07$/.exec(String(salon));
  if (!match) throw Error(`Salón fuera de la progresión 107 a 1007: ${salon}`);
  const semestre=Number(match[1]);
  if (!Number.isInteger(semestre)||semestre<1||semestre>10) throw Error('Semestre inválido.');
  return semestre===10?null:`${semestre+1}07`;
}

export function validarProgramacionCambio(meta, origen) {
  const fecha=meta?.fechaCambio;
  if (typeof fecha!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(fecha)||!esLunes(fecha)) {
    throw Error('La fecha de cambio debe ser un lunes válido.');
  }
  if (meta.periodoDestino!==periodoSiguiente(origen)) throw Error('El periodo destino no es el siguiente semestre.');
  return fecha;
}

export function prepararAvanceSemestral({periodoOrigen,periodoDestino,salones,instante}) {
  if (periodoDestino!==periodoSiguiente(periodoOrigen)) throw Error('Periodo destino incorrecto.');
  const nuevos={};const egresados=[];const movimientos=[];
  for (const [salon, aula] of Object.entries(salones||{})) {
    const destino=salonSiguiente(salon);
    if (!aula?.meta) throw Error(`Falta metadata del salón ${salon}.`);
    if (Object.values(aula.retiros||{}).some(r=>r?.estado==='solicitado')) throw Error(`El salón ${salon} tiene retiros pendientes.`);
    if (!destino) {egresados.push(salon);continue;}
    const generacionId=generacionDeAula(periodoOrigen,salon,aula.meta);
    const tipoAhorro=generacionId===GENERACION_ESPECIAL?'mixto':'carrera';
    const cuotaSemanal=cuotaDeSalon(salon,aula.meta);
    if (![10,20].includes(cuotaSemanal))throw Error(`Cuota incongruente del salón ${salon}.`);
    if (nuevos[destino]) throw Error('Dos grupos pretenden utilizar el mismo salón.');
    nuevos[destino]={
      meta:{nombre:`Salón ${destino}`,inicioDetalle:1,cuotaSemanal,tipoAhorro,generacionId,creadoEn:instante,procedencia:`${periodoOrigen}/${salon}`},
      integrantes:structuredClone(aula.integrantes||{}),
      // Nunca se copian pagos ni retiros: permanecen en el periodo origen.
    };
    movimientos.push({origen:salon,destino,generacionId,cuotaSemanal,integrantes:Object.keys(aula.integrantes||{}).length});
  }
  return {nuevos,egresados,movimientos};
}

export function metaCierreSemestre(meta, instante) {
  return {...meta,cerradoEn:instante,semanaCierre:semanaPeriodo(meta,instante)};
}

// Un cambio puede confirmarse cualquier día. La primera semana cobrada del
// nuevo semestre inicia el mismo lunes o el próximo lunes, nunca antes.
export function primerLunesDesdeFecha(fecha) {
  if(typeof fecha!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(fecha)) throw Error('Fecha de cambio inválida.');
  const dia=new Date(`${fecha}T00:00:00Z`);
  if(Number.isNaN(dia.getTime())||dia.toISOString().slice(0,10)!==fecha)throw Error('Fecha de cambio inválida.');
  dia.setUTCDate(dia.getUTCDate()+(8-dia.getUTCDay())%7);
  return dia.toISOString().slice(0,10);
}
