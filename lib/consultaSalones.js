import {generacionDeAula} from './fondos.js';

// Vista intencionadamente agregada: NO incluir registros individuales, montos
// privados de la generación 507 ni datos de profesores.
export function informeCompartidoDeSalones({aulas={},periodos={},periodo,resumen}){
  const registro=periodos[periodo];
  if(!registro?.salones)throw Error('No existe el ciclo escolar solicitado.');
  if(!resumen||!resumen.generaciones)throw Error('No hay un informe de fondos válido.');
  const salones=Object.entries(registro.salones).map(([salon,info])=>{
    const meta=aulas?.[periodo]?.[salon]?.meta||{};
    const generacionId=generacionDeAula(periodo,salon,meta);
    const aporte=resumen.generaciones[generacionId]?.aportacionCarrera||0;
    if(!Number.isFinite(aporte)||aporte<0)throw Error('Aportación incongruente.');
    return {
      salon,
      nombre:typeof info?.nombre==='string'?info.nombre:`Salón ${salon}`,
      aportacionCarrera:aporte
    };
  }).sort((a,b)=>a.salon.localeCompare(b.salon,'es',{numeric:true}));
  return {
    periodo,
    totalCarrera:resumen.totalCarrera,
    cifrasConfiables:resumen.cifrasConfiables===true,
    salones
  };
}
