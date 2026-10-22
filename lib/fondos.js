/**
 * Separación contable de Ahorro Grupal.
 * Cada unidad `pagos` existente representa UNA aportación semanal de $20:
 * $10 de Grupal y $10 de Carrera. No se modifica la base de datos.
 * La aplicación no registra pagos parciales o independientes entre fondos.
 */
export const CUOTA_GRUPAL = 10;
export const CUOTA_CARRERA = 10;

const enteroNoNegativo = (valor) => {
  const numero = Number(valor);
  return Number.isFinite(numero) ? Math.max(0, Math.trunc(numero)) : 0;
};

export function montosIntegrante(pagos, semana) {
  const pagados = enteroNoNegativo(pagos);
  const pendiente = Math.max(0, enteroNoNegativo(semana) - pagados);
  return {
    pagados, pendiente,
    grupal: pagados * CUOTA_GRUPAL,
    carrera: pagados * CUOTA_CARRERA,
    grupalPendiente: pendiente * CUOTA_GRUPAL,
    carreraPendiente: pendiente * CUOTA_CARRERA,
  };
}

export function calcularResumenFondos(miembros, semana) {
  const semanaValida = enteroNoNegativo(semana);
  const resumen = {
    grupal: { total: 0, esperado: miembros.length * semanaValida * CUOTA_GRUPAL, pendiente: 0 },
    carrera: { total: 0, esperado: miembros.length * semanaValida * CUOTA_CARRERA, pendiente: 0 },
    alDia: 0,
    faltantes: 0,
    porcentaje: 0,
  };
  for (const integrante of miembros) {
    const montos = montosIntegrante(integrante.pagos, semanaValida);
    resumen.grupal.total += montos.grupal;
    resumen.carrera.total += montos.carrera;
    resumen.grupal.pendiente += montos.grupalPendiente;
    resumen.carrera.pendiente += montos.carreraPendiente;
    if (montos.pendiente === 0) resumen.alDia += 1;
  }
  resumen.faltantes = miembros.length - resumen.alDia;
  const esperado = resumen.grupal.esperado;
  resumen.porcentaje = esperado > 0 ? Math.min(100, Math.round(resumen.grupal.total / esperado * 100)) : 0;
  return resumen;
}
