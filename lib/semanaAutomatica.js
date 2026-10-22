/**
 * Calendario de Ahorro Grupal.
 * La semana 4 comenzó el lunes 19 de octubre de 2026, 00:00
 * en America/Mexico_City. El número depende SOLO de la fecha civil
 * mexicana y no de la zona horaria del dispositivo ni del servidor.
 *
 * Así funciona incluso cuando la PWA estaba cerrada en la medianoche.
 */
export const ZONA_HORARIA_AHORRO = 'America/Mexico_City';
export const SEMANA_BASE = 4;
export const LUNES_BASE = '2026-10-19';

const MILISEGUNDOS_DIA = 86_400_000;
const DIA_BASE_UTC = Date.UTC(2026, 9, 19) / MILISEGUNDOS_DIA;
const formatter = new Intl.DateTimeFormat('en-GB', {
  timeZone: ZONA_HORARIA_AHORRO,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
});

export function semanaActualMexico(instante = Date.now()) {
  const partes = Object.fromEntries(
    formatter.formatToParts(new Date(instante))
      .filter(({ type }) => ['year', 'month', 'day'].includes(type))
      .map(({ type, value }) => [type, Number(value)]),
  );
  const diaMexico = Date.UTC(partes.year, partes.month - 1, partes.day) / MILISEGUNDOS_DIA;
  const semanasTranscurridas = Math.floor((diaMexico - DIA_BASE_UTC) / 7);
  return Math.max(SEMANA_BASE, SEMANA_BASE + semanasTranscurridas);
}

export function proximoLunesMexico(instante = Date.now()) {
  const semana = semanaActualMexico(instante);
  const lunesProximo = new Date((DIA_BASE_UTC + (semana - SEMANA_BASE + 1) * 7) * MILISEGUNDOS_DIA);
  return new Intl.DateTimeFormat('es-MX', {
    timeZone: 'UTC', weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
  }).format(lunesProximo);
}
