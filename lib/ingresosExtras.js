// Dinero extraordinario ingresado por el administrador general.
// Se registra en /ahorro/ingresosExtras y no se atribuye a estudiantes,
// salones ni a la generación 507. El UID queda únicamente en la base privada.
export function crearIngresoExtra({uid,monto,periodo,ahora}) {
  if(typeof uid!=='string'||!uid||!/^\d{4}-\d{4}-[AB]$/.test(periodo)
    ||!Number.isSafeInteger(monto)||monto<1||monto>1_000_000
    ||!Number.isSafeInteger(ahora)||ahora<=0)
    throw Error('Importe o datos del ingreso extraordinario inválidos.');
  return {tipo:'ingresoExtra',estado:'confirmado',fondo:'carrera',monto,periodo,
    creadoEn:ahora,registradoPor:uid};
}

export function sumarIngresosExtras(ingresos={},momentoCorte=0) {
  if(!Number.isSafeInteger(momentoCorte)||momentoCorte<0)throw Error('Corte contable inválido.');
  let total=0,cantidad=0;
  for(const porPeriodo of Object.values(ingresos||{})){
    for(const mov of Object.values(porPeriodo||{})){
      if(mov?.tipo!=='ingresoExtra'||mov.estado!=='confirmado')continue;
      if(!Number.isSafeInteger(mov.creadoEn)||mov.creadoEn<momentoCorte)continue;
      if(!Number.isSafeInteger(mov.monto)||mov.monto<1||mov.monto>1_000_000)
        throw Error('Ingreso extraordinario con importe inválido.');
      total+=mov.monto;
      if(!Number.isSafeInteger(total))throw Error('Suma extraordinaria fuera del rango.');
      cantidad++;
    }
  }
  return {total,cantidad};
}
