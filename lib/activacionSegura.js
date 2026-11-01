// Activación UNICA del nuevo libro contable. No borra ni reescribe historiales.
// Esta lógica es pura para poder probarla sin tocar Firebase de producción.
import {PERIODO_REINICIO, SEMANA_INICIO_REINICIO} from './reinicioContable.js';

const SALONES_ESPERADOS = ['107','307','507','707','907'];

export function diagnosticarActivacion(raiz) {
  if (!raiz || typeof raiz !== 'object') throw Error('No hay datos de Firebase.');
  const periodo=raiz.periodos?.[PERIODO_REINICIO];
  const meta=periodo?.meta;
  if (!meta) throw Error('No existe el periodo 2026-2027-A.');
  if (meta.reinicioContable !== undefined && meta.reinicioContable !== null)
    throw Error('Ya existe un marcador reinicioContable. No se modificará ni sustituirá.');
  if (meta.cerradoEn || meta.migradoA || meta.migracionEnCurso)
    throw Error('El semestre ya fue cerrado o está en migración.');
  if (meta.vacaciones?.activas === true)
    throw Error('Primero reanuda las clases antes de activar el nuevo ahorro.');
  if (meta.lunesBase !== '2026-10-19' || meta.semanaBase !== 4)
    throw Error('La base del calendario no coincide con la validada (19 de octubre, semana 4).');
  if (!raiz.roles?.adminGeneralUid) throw Error('No está configurado el administrador general.');
  const configurados=Object.keys(periodo.salones||{}).sort();
  const existentes=Object.keys(raiz.aulas?.[PERIODO_REINICIO]||{}).sort();
  const esperados=[...SALONES_ESPERADOS].sort();
  if (JSON.stringify(configurados)!==JSON.stringify(esperados) || JSON.stringify(existentes)!==JSON.stringify(esperados))
    throw Error('Deben coincidir exactamente los cinco salones entre periodos y aulas.');
  const salones=[];
  let totalIntegrantes=0;
  let pagosAnteriores=0;
  let retirosAnteriores=0;
  for (const id of SALONES_ESPERADOS) {
    const aula=raiz.aulas[PERIODO_REINICIO][id];
    const cuota=aula?.meta?.cuotaSemanal;
    if (cuota!==10 && cuota!==20) throw Error(`Cuota no válida en el salón ${id}.`);
    const integrantes=Object.keys(aula?.integrantes||{}).length;
    if (!integrantes) throw Error(`El salón ${id} no tiene integrantes registrados.`);
    if (Object.keys(aula?.pagosReinicio||{}).length || Object.keys(aula?.retirosReinicio||{}).length)
      throw Error(`Ya existen movimientos del nuevo ahorro en el salón ${id}; se requiere revisión manual.`);
    const retiros=aula?.retiros||{};
    if (Object.values(retiros).some(r=>r?.estado==='solicitado'))
      throw Error(`Existen retiros pendientes anteriores en el salón ${id}; deben resolverse antes del corte.`);
    const pagosViejos=Object.keys(aula?.pagos||{}).length;
    const retirosViejos=Object.keys(retiros).length;
    totalIntegrantes+=integrantes;
    pagosAnteriores+=pagosViejos;
    retirosAnteriores+=retirosViejos;
    salones.push({salon:id,integrantes,cuotaSemanal:cuota,inicioDetalleAnterior:aula.meta.inicioDetalle??null,
      pagosAnteriores:pagosViejos,retirosAnteriores:retirosViejos});
  }
  return {periodo:PERIODO_REINICIO,semanaInicial:SEMANA_INICIO_REINICIO,
    saldoInicial:0,totalIntegrantes,pagosAnteriores,retirosAnteriores,salones};
}

export function prepararActivacionSegura(raiz, administradorUid, instante) {
  if (!administradorUid || raiz?.roles?.adminGeneralUid!==administradorUid)
    throw Error('La autorización del administrador general cambió.');
  if (!Number.isSafeInteger(instante)||instante<=0) throw Error('Marca de tiempo no válida.');
  const diagnostico=diagnosticarActivacion(raiz);
  // Copias sólo de la cadena de objetos hasta meta: el resto permanece intacto.
  const ciclo=raiz.periodos[PERIODO_REINICIO];
  return {raiz:{...raiz,periodos:{...raiz.periodos,[PERIODO_REINICIO]:{
    ...ciclo,meta:{...ciclo.meta,reinicioContable:{version:1,semanaInicio:5,activadoEn:instante}}
  }}},diagnostico};
}
