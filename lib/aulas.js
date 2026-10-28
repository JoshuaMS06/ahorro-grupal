import { ZONA_HORARIA_AHORRO } from './semanaAutomatica.js';

// Solo para conservar el valor de los registros heredados del salón 507.
export const CUOTA_SEMANAL = 20;
// La cuota queda fijada en el momento de registrar el pago, no se recalcula al cambiar de salón.
export function cuotaDeSalon(salon, meta = null) {
  const establecida = Number(meta?.cuotaSemanal);
  if (meta && meta.cuotaSemanal !== undefined && (establecida === 10 || establecida === 20)) return establecida;
  return String(salon).trim() === '507' ? 20 : 10;
}
const DAY = 86400000;
const format = new Intl.DateTimeFormat('en-CA', { timeZone: ZONA_HORARIA_AHORRO, year: 'numeric', month: '2-digit', day: '2-digit' });
export const fechaMexico = (now=Date.now()) => {
  const a = Object.fromEntries(format.formatToParts(new Date(now)).filter(p=>['year','month','day'].includes(p.type)).map(p=>[p.type,p.value]));
  return `${a.year}-${a.month}-${a.day}`;
};
export const esLunes = (iso) => /^\d{4}-\d{2}-\d{2}$/.test(iso) && new Date(`${iso}T00:00:00Z`).getUTCDay() === 1;
export const semanaPeriodo = (p, now=Date.now()) => {
  if (!p?.lunesBase || !esLunes(p.lunesBase)) return 1;
  const t = Date.parse(`${fechaMexico(now)}T00:00:00Z`);
  const base = Date.parse(`${p.lunesBase}T00:00:00Z`);
  const calculada=Math.max(1, Number(p.semanaBase || 1) + Math.floor((t-base)/(7*DAY)));
  return p.cerradoEn && Number.isInteger(Number(p.semanaCierre)) && Number(p.semanaCierre)>0 ? Math.min(calculada,Number(p.semanaCierre)) : calculada;
};
export const monto = (v) => Number.isFinite(Number(v)) ? Math.max(0, Math.round(Number(v))) : 0;
export const pagoClave = (estudianteId,semana) => `${estudianteId}_s${String(semana).padStart(4,'0')}`;
export const pagosActivos = (pagos = {}) => Object.values(pagos || {}).filter(p => p && p.estado==='pagado');
export const resumenCaja = (pagos={}, retiros={}, legadoTotal=0) => {
  const recaudado = monto(legadoTotal) + pagosActivos(pagos).reduce((n,p)=>n+monto(p.monto),0);
  const retirado = Object.values(retiros||{}).filter(r=>r?.estado==='aprobado').reduce((n,r)=>n+monto(r.monto),0);
  return { recaudado, retirado, saldo:recaudado-retirado };
};
export const estadoSemana = (pagos = {}, id, semana) => {
  const p = pagos[pagoClave(id,semana)];
  return p?.estado==='pagado' ? 'pagado' : 'pendiente';
};
export const isPeriodId = id => /^\d{4}-\d{4}-[A-Z0-9]{1,5}$/.test(id);
export const isClassCode = id => /^[A-Za-z0-9_-]{1,24}$/.test(id);
export function validarImportacion(data) {
  if (!data || data.version!==1 || !data.periodo || !isPeriodId(data.periodo.id) || !esLunes(data.periodo.lunesBase)) throw new Error('Archivo de listas o periodo inválido.');
  if (!data.salones || typeof data.salones!=='object' || Object.keys(data.salones).length===0) throw new Error('El archivo no tiene salones.');
  const codes=Object.keys(data.salones);
  if (codes.length>30 || codes.some(k=>!isClassCode(k))) throw new Error('Código o cantidad de salones inválida.');
  let total=0;
  for (const code of codes) {
    const estudiantes=data.salones[code];
    if (!Array.isArray(estudiantes) || estudiantes.length>250) throw new Error(`Lista ${code} inválida.`);
    const ids=new Set();
    for (const e of estudiantes) {
      if (!e || typeof e.nombre!=='string' || !e.nombre.trim() || e.nombre.length>140 || typeof e.id!=='string' || !/^[A-Za-z0-9_-]{2,32}$/.test(e.id) || ids.has(e.id)) throw new Error(`Estudiante/ID duplicado o inválido en ${code}.`);
      ids.add(e.id); total++;
    }
  }
  return { total, salones:codes.length };
}
