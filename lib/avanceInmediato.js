import {fechaMexico} from './aulas.js';
import {corteActivo,rutaRetiros} from './reinicioContable.js';
import {periodoSiguiente,prepararAvanceSemestral,metaCierreSemestre,primerLunesDesdeFecha} from './semestres.js';

// Transformación pura, llamada dentro de UNA transacción atómica sobre la raíz
// de Realtime Database. Nunca borra los pagos/retiradas del periodo anterior.
export function prepararCambioInmediato(raiz,origen,instante) {
  if(!raiz || typeof raiz!=='object')throw Error('No existen datos del proyecto.');
  const periodo=raiz.periodos?.[origen];
  if(!periodo?.meta)throw Error('No existe el semestre seleccionado.');
  const meta=periodo.meta;
  if(origen==='2026-2027-A' && !corteActivo(raiz.periodos))throw Error('Activa el ahorro nuevo antes de cambiar de semestre.');
  if(meta.vacaciones?.activas === true)throw Error('Reanuda clases antes de cambiar de semestre.');
  if(meta.cerradoEn||meta.migradoA||meta.migracionEnCurso)throw Error('El semestre ya está cerrado o fue cambiado.');
  const destino=periodoSiguiente(origen);
  if(raiz.periodos?.[destino]||raiz.aulas?.[destino])throw Error('El semestre siguiente ya existe. No se duplicó nada.');
  const aulas=raiz.aulas?.[origen]||{};
  // No ocultar solicitudes antiguas pendientes al cerrar la generación.
  if(origen==='2026-2027-A' && Object.values(aulas).some(aula=>Object.values(aula?.retiros||{}).some(r=>r?.estado==='solicitado')))
    throw Error('El semestre tiene retiros pendientes del historial anterior.');
  const gruposRegistrados=Object.keys(periodo.salones||{});
  if(!gruposRegistrados.length || !Object.keys(aulas).length)throw Error('No hay salones activos para avanzar.');
  for(const s of gruposRegistrados)if(!aulas[s]?.meta)throw Error(`Faltan datos del salón ${s}.`);
  const actuales=Object.fromEntries(Object.entries(aulas).map(([id,aula])=>[id,{
    ...aula,retiros:aula?.[rutaRetiros(raiz.periodos,origen)]||{}
  }]));
  const plan=prepararAvanceSemestral({periodoOrigen:origen,periodoDestino:destino,salones:actuales,instante});
  const fechaCambio=fechaMexico(instante);
  const lunesBase=primerLunesDesdeFecha(fechaCambio);
  const salonesDestino=Object.fromEntries(Object.keys(plan.nuevos).map(s=>[s,{nombre:`Salón ${s}`}]));
  const origenCerrado={...metaCierreSemestre(meta,instante),fechaCambio,cambiadoEn:instante,periodoDestino:destino,migradoA:destino};
  // Una nueva generación no hereda registros de otra generación con el mismo
  // número de salón: cada etapa ocupa un periodo distinto.
  const nuevaRaiz={
    ...raiz,
    periodos:{...raiz.periodos,
      [origen]:{...periodo,meta:origenCerrado},
      [destino]:{meta:{nombre:destino,lunesBase,semanaBase:1,creadoEn:instante,procedeDe:origen,fechaCambio,cambiadoEn:instante},salones:salonesDestino}},
    aulas:{...(raiz.aulas||{}),[destino]:plan.nuevos}
  };
  const roles=structuredClone(raiz.roles||{});
  const anteriores=roles.responsables?.[origen]||{};
  roles.responsables=roles.responsables||{};
  roles.responsables[destino]={};
  roles.porUsuario=roles.porUsuario||{};
  for(const m of plan.movimientos){
    const plazas=anteriores[m.origen]||{};
    for(const [plaza,uid] of Object.entries(plazas)) {
      if(!['1','2'].includes(plaza)||!uid)continue;
      roles.responsables[destino][m.destino]||={};
      roles.responsables[destino][m.destino][plaza]=uid;
      roles.porUsuario[uid]={periodo:destino,salon:m.destino,plaza};
    }
  }
  for(const salon of plan.egresados){
    for(const uid of Object.values(anteriores[salon]||{}))if(uid)delete roles.porUsuario[uid];
  }
  // Mantener el acceso de lectura a la MISMA generación al cambiar de salón
  // (ej. 507 -> 607). Los egresados pierden acceso a datos nuevos.
  roles.lectores=roles.lectores||{};
  for(const [uid,lector] of Object.entries(roles.lectores)){
    if(lector?.periodo!==origen)continue;
    const cambio=plan.movimientos.find(m=>m.origen===lector.salon);
    if(cambio)roles.lectores[uid]={...lector,periodo:destino,salon:cambio.destino};
    else delete roles.lectores[uid];
  }
  nuevaRaiz.roles=roles;
  return {raiz:nuevaRaiz,detalles:{origen,destino,fechaCambio,cambiadoEn:instante,lunesBase,
    salonesAvanzados:plan.movimientos.length,salonesArchivados:plan.egresados.length,movimientos:plan.movimientos}};
}
