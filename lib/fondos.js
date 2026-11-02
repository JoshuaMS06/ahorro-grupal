// Contabilidad sin acceso a Firebase: todas las cifras se derivan de registros.
// Los identificadores históricos se mantienen únicamente para no romper trazabilidad.
export const PERIODO_ORIGEN = '2026-2027-A';
export const SALON_ESPECIAL_ORIGEN = '507';
export const GENERACION_ESPECIAL = 'gen-2026-2027-A-507';

export function generacionDeAula(periodo, salon, meta = {}) {
  return meta?.generacionId || (periodo === PERIODO_ORIGEN && String(salon) === SALON_ESPECIAL_ORIGEN
    ? GENERACION_ESPECIAL : `gen-${periodo}-${salon}`);
}

export function tipoDeAhorro(periodo,salon,meta={}) {
  return generacionDeAula(periodo,salon,meta)===GENERACION_ESPECIAL?'mixto':'carrera';
}

// El importe de un registro viejo siempre conserva su valor original.
// Una distribucion explicita es inmutable tras registrar el pago.
export function distribucionDePago(pago, periodo, salon, meta = {}) {
  if (!pago || pago.estado !== 'pagado') return {grupo:0, carrera:0};
  const importe = pago.monto;
  if (!Number.isSafeInteger(importe) || importe <= 0) throw Error('Pago con importe inválido.');
  const grupo = pago.fondoGrupo;
  const carrera = pago.fondoCarrera;
  if (grupo !== undefined || carrera !== undefined) {
    if (!Number.isSafeInteger(grupo) || grupo < 0 || !Number.isSafeInteger(carrera) || carrera < 0 || grupo + carrera !== importe) {
      throw Error('La distribución del pago no coincide con su importe.');
    }
    return {grupo, carrera};
  }
  if (meta?.tipoAhorro === 'mixto' || (periodo === PERIODO_ORIGEN && String(salon) === SALON_ESPECIAL_ORIGEN && !meta?.tipoAhorro && importe===20)) {
    if (importe !== 20) throw Error('Pago especial sin distribución válida de $20.');
    return {grupo:10, carrera:10};
  }
  return {grupo:0, carrera:importe};
}

export function distribucionNueva(periodo, salon, meta = {}) {
  // La generación original 507 aporta $10 a carrera y $10 a su ahorro
  // independiente. La cuota completa del estudiante sigue siendo $20.
  const cuota = Number(meta?.cuotaSemanal) === 20 ? 20 : 10;
  const esGeneracion507 = (periodo === PERIODO_ORIGEN && String(salon) === SALON_ESPECIAL_ORIGEN)
    || meta?.generacionId === GENERACION_ESPECIAL;
  return esGeneracion507 && cuota===20
    ? {grupo:10,carrera:10,cuota}
    : {grupo:0,carrera:cuota,cuota};
}

export function totalLegadoGrupo(legado = {}) {
  // El sistema anterior solamente registraba un numero de cuotas $20.
  return Object.values(legado).reduce((n,p) => {
    const cuotas = Number(p?.pagos || 0);
    if (!Number.isSafeInteger(cuotas) || cuotas < 0) throw Error('Historial previo inválido.');
    return n + cuotas * 20;
  },0);
}

export function resumirFondos(aulas = {}, legado = {}) {
  const generaciones = {};
  let carrera = 0;
  let ahorroPropio = totalLegadoGrupo(legado);
  const retirosNoClasificados = [];
  const retiros = {grupo:0,carrera:0};
  for (const [periodo, salones] of Object.entries(aulas || {})) {
    for (const [salon, aula] of Object.entries(salones || {})) {
      const id = generacionDeAula(periodo, salon, aula?.meta);
      const g = generaciones[id] ||= {generacionId:id,aportacionCarrera:0,ahorroGrupo:0};
      for (const pago of Object.values(aula?.pagos || {})) {
        const d = distribucionDePago(pago,periodo,salon,aula?.meta);
        carrera += d.carrera;
        ahorroPropio += d.grupo;
        g.aportacionCarrera += d.carrera;
        g.ahorroGrupo += d.grupo;
      }
      for (const [retiroId,retiro] of Object.entries(aula?.retiros||{})) {
        if (retiro?.estado !== 'aprobado') continue;
        if (retiro?.fondo !== 'grupo' && retiro?.fondo !== 'carrera') {
          retirosNoClasificados.push(`${periodo}/${salon}/${retiroId}`);
          continue;
        }
        if (!Number.isSafeInteger(retiro.monto) || retiro.monto <= 0) throw Error('Retiro con importe inválido.');
        retiros[retiro.fondo] += retiro.monto;
        if (retiro.fondo === 'grupo') g.ahorroGrupo -= retiro.monto;
        // La aportación histórica de la generación NO baja por un retiro común.
        // Sólo el saldo global de carrera descuenta los retiros aprobados.
      }
    }
  }
  const genEspecial = generaciones[GENERACION_ESPECIAL] ||= {generacionId:GENERACION_ESPECIAL,aportacionCarrera:0,ahorroGrupo:0};
  genEspecial.ahorroGrupo += totalLegadoGrupo(legado);
  // Saldo global sólo es confiable si TODOS los retiros aprobados están clasificados.
  return {
    totalCarrera: carrera - retiros.carrera,
    totalAhorroGrupoEspecial: ahorroPropio - retiros.grupo,
    legadoGrupo: totalLegadoGrupo(legado),
    generaciones,
    retirosNoClasificados,
    cifrasConfiables: retirosNoClasificados.length === 0,
  };
}
