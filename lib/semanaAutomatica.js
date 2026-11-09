/**
 * Calendario civil de aportaciones, zona America/Mexico_City.
 * El lunes determina a qué mes pertenece la semana; la cuenta se reinicia
 * en el primer lunes de cada mes. No modifica los IDs ni el corte contable.
 */
export const ZONA_HORARIA_AHORRO='America/Mexico_City';
export const SEMANA_BASE=1;
export const LUNES_BASE='2026-11-02'; // Primer lunes de noviembre de 2026.

const DIA=86_400_000;
const formatter=new Intl.DateTimeFormat('en-GB',{
  timeZone:ZONA_HORARIA_AHORRO,year:'numeric',month:'2-digit',day:'2-digit'
});
function lunesActualMexico(instante){
  const partes=Object.fromEntries(formatter.formatToParts(new Date(instante))
    .filter(({type})=>['year','month','day'].includes(type))
    .map(({type,value})=>[type,Number(value)]));
  const diaUtc=Date.UTC(partes.year,partes.month-1,partes.day);
  const dow=new Date(diaUtc).getUTCDay(); // domingo=0; lunes=1
  return new Date(diaUtc-((dow+6)%7)*DIA);
}
export function semanaActualMexico(instante=Date.now()){
  const lunes=lunesActualMexico(instante);
  const primero=new Date(Date.UTC(lunes.getUTCFullYear(),lunes.getUTCMonth(),1)).getUTCDay();
  const primerLunes=1+(8-primero)%7;
  return 1+Math.floor((lunes.getUTCDate()-primerLunes)/7);
}
export function proximoLunesMexico(instante=Date.now()){
  const lunes=lunesActualMexico(instante);
  const proximo=new Date(lunes.getTime()+7*DIA);
  return new Intl.DateTimeFormat('es-MX',{
    timeZone:'UTC',weekday:'long',day:'numeric',month:'long',year:'numeric',
  }).format(proximo);
}
