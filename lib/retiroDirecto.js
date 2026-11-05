import {GENERACION_ESPECIAL,generacionDeAula} from './fondos.js';
import {corteActivo,rutaRetiros,resumirAhorroReiniciado,PERIODO_REINICIO} from './reinicioContable.js';

// Los importes se calculan de movimientos existentes, nunca de contadores
// editables ni de saldos escritos por el cliente.
export function saldoRetirableSalon(aulas,periodos,periodo,salon,fondo,ingresosExtras={}) {
  if(!corteActivo(periodos))throw Error('No está activada la contabilidad vigente.');
  const aula=aulas?.[periodo]?.[salon];
  if(!aula?.meta)throw Error('El salón no está registrado.');
  if(!['carrera','grupo'].includes(fondo))throw Error('Selecciona un fondo válido.');
  const generacion=generacionDeAula(periodo,salon,aula.meta);
  if(fondo==='grupo'&&generacion!==GENERACION_ESPECIAL)
    throw Error('El ahorro privado solo pertenece a la generación 507.');
  const resumen=resumirAhorroReiniciado(aulas,periodos,ingresosExtras);
  if(!resumen.cifrasConfiables)throw Error('Hay retiros históricos sin clasificar. Se necesita conciliación antes de retirar.');
  const cuenta=resumen.generaciones[generacion]||{aportacionCarrera:0,ahorroGrupo:0};
  if(fondo==='grupo'){
    if(cuenta.ahorroGrupo<0)throw Error('El fondo privado tiene saldo negativo. Requiere revisión.');
    return {disponible:cuenta.ahorroGrupo,generacion,fondo,totalCarrera:resumen.totalCarrera};
  }
  let retiradoGeneracion=0;
  const corte=periodos[PERIODO_REINICIO].meta.reinicioContable.activadoEn;
  for(const [p,salones] of Object.entries(aulas||{})){
    if(p<PERIODO_REINICIO)continue;
    for(const [s,datos] of Object.entries(salones||{})){
      if(generacionDeAula(p,s,datos?.meta)!==generacion)continue;
      for(const retiro of Object.values(datos?.[rutaRetiros(periodos,p)]||{})){
        if(retiro?.estado!=='aprobado'||retiro?.fondo!=='carrera'||!Number.isSafeInteger(retiro.creadoEn)||retiro.creadoEn<corte)continue;
        if(!Number.isSafeInteger(retiro.monto)||retiro.monto<=0)throw Error('El historial de retiros es inválido.');
        retiradoGeneracion+=retiro.monto;
      }
    }
  }
  const disponible=cuenta.aportacionCarrera-retiradoGeneracion;
  if(disponible<0||resumen.totalCarrera<0)throw Error('El fondo tiene saldo negativo. Requiere revisión.');
  // Ni el saldo global ni el aporte de otro salón financian este retiro.
  return {disponible:Math.min(disponible,resumen.totalCarrera),generacion,fondo,totalCarrera:resumen.totalCarrera};
}

export function crearRetiroDirecto({uid,monto,fondo,ahora}) {
  if(typeof uid!=='string'||!uid||!Number.isSafeInteger(monto)||monto<=0||monto>1_000_000)
    throw Error('El retiro necesita un administrador e importe válidos.');
  if(!['carrera','grupo'].includes(fondo)||!Number.isSafeInteger(ahora)||ahora<=0)
    throw Error('El fondo o la fecha no es válido.');
  return {monto,fondo,estado:'aprobado',motivo:'Retiro directo',tipo:'directo',
    solicitadoPor:uid,respondidoPor:uid,creadoEn:ahora,respondidoEn:ahora};
}
