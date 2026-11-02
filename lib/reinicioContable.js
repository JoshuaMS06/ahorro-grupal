// Reinicio CONTABLE, no borrado. Desde la semana 5 del periodo de origen.
// Los movimientos previos permanecen intactos en /pagos y /retiros.
import {generacionDeAula,GENERACION_ESPECIAL} from './fondos.js';
export const PERIODO_REINICIO='2026-2027-A';
export const SEMANA_INICIO_REINICIO=5;
export function corteActivo(periodos={}) {
  const corte=periodos?.[PERIODO_REINICIO]?.meta?.reinicioContable;
  return Boolean(corte?.version===1 && corte?.semanaInicio===SEMANA_INICIO_REINICIO && Number.isSafeInteger(corte?.activadoEn) && corte.activadoEn>0);
}
export function esPeriodoReinicio(periodos, periodo) {
  return periodo===PERIODO_REINICIO && corteActivo(periodos);
}
export function rutaPagos(periodos,periodo) {
  return esPeriodoReinicio(periodos,periodo)?'pagosReinicio':'pagos';
}
export function rutaRetiros(periodos,periodo) {
  return esPeriodoReinicio(periodos,periodo)?'retirosReinicio':'retiros';
}
export function inicioAportaciones(periodos,periodo,meta={}) {
  return esPeriodoReinicio(periodos,periodo)?SEMANA_INICIO_REINICIO:Math.max(1,Number(meta.inicioDetalle)||1);
}
// Importes de la nueva contabilidad: sin legado y sin ingresos / egresos anteriores.
// El nuevo ciclo después del cambio semestral registra normalmente en /pagos y /retiros.
export function resumirAhorroReiniciado(aulas={},periodos={}) {
  if(!corteActivo(periodos))throw Error('El nuevo ahorro no ha sido activado para este ciclo.');
  const momentoCorte=periodos[PERIODO_REINICIO].meta.reinicioContable.activadoEn;
  if(!Number.isSafeInteger(momentoCorte)||momentoCorte<=0)throw Error('La fecha de activación del nuevo ahorro es inválida.');
  let carrera=0, retirado=0, ahorro507=0;
  const generaciones={};
  const retirosNoClasificados=[];
  for(const [periodo,salones] of Object.entries(aulas||{})) {
    if(periodo<PERIODO_REINICIO)continue;
    for(const [salon,aula] of Object.entries(salones||{})) {
      const gen=generacionDeAula(periodo,salon,aula?.meta);
      const g=generaciones[gen]||={generacionId:gen,aportacionCarrera:0,ahorroGrupo:0};
      const pagos=aula?.[rutaPagos(periodos,periodo)]||{};
      for(const pago of Object.values(pagos)){
        if(pago?.estado!=='pagado' || !Number.isSafeInteger(pago.creadoEn) || pago.creadoEn<momentoCorte)continue;
        if(!Number.isSafeInteger(pago.monto)||pago.monto<=0)throw Error('Importe de pago inválido.');
        if(periodo===PERIODO_REINICIO && pago.semana<SEMANA_INICIO_REINICIO)continue;
        // Respetar el desglose INMUTABLE de cada pago. Nunca reclasificar
        // silenciosamente importes ya registrados antes de esta actualización.
        if(!Number.isSafeInteger(pago.fondoGrupo)||pago.fondoGrupo<0 ||
           !Number.isSafeInteger(pago.fondoCarrera)||pago.fondoCarrera<0 ||
           pago.fondoGrupo+pago.fondoCarrera!==pago.monto)throw Error('El desglose de un pago es inválido.');
        if(pago.fondoGrupo>0 && gen!==GENERACION_ESPECIAL)throw Error('El ahorro del grupo solo corresponde a la generación 507.');
        carrera+=pago.fondoCarrera;
        g.aportacionCarrera+=pago.fondoCarrera;
        g.ahorroGrupo+=pago.fondoGrupo;
        ahorro507+=pago.fondoGrupo;
      }
      const retiros=aula?.[rutaRetiros(periodos,periodo)]||{};
      for(const [id,retiro] of Object.entries(retiros)){
        if(retiro?.estado!=='aprobado' || !Number.isSafeInteger(retiro.creadoEn) || retiro.creadoEn<momentoCorte)continue;
        if(retiro.fondo!=='carrera') {retirosNoClasificados.push(`${periodo}/${salon}/${id}`);continue;}
        if(!Number.isSafeInteger(retiro.monto)||retiro.monto<=0)throw Error('Importe de retiro inválido.');
        retirado+=retiro.monto;
      }
    }
  }
  return {totalCarrera:carrera-retirado,aportado:carrera,retirado,totalAhorro507:ahorro507,
    generaciones, retirosNoClasificados,cifrasConfiables:retirosNoClasificados.length===0};
}
