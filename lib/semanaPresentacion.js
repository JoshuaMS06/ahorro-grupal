// Semanas de lunes a domingo. La primera que COMIENZA en cada mes
// se llama Semana 1 de ese mes; el primer lunes siguiente inicia la 2.
// La numeración es SOLO visual: no modifica IDs de pago, corte ni auditorías.
const DIA=86_400_000;
const SEMANA=7*DIA;
const MES=new Intl.DateTimeFormat('es-MX',{month:'long',timeZone:'UTC'});
const MES_CORTO=new Intl.DateTimeFormat('es-MX',{month:'short',timeZone:'UTC'});
const BASE_ORIGEN={lunesBase:'2026-10-19',semanaBase:4};
const ANCLA_ORIGEN='2026-2027-A';

function anclaValida(meta){
  if(!meta || !/^\d{4}-\d{2}-\d{2}$/.test(meta.lunesBase||'')
    ||!Number.isSafeInteger(Number(meta.semanaBase))||Number(meta.semanaBase)<1)return null;
  const fecha=Date.parse(`${meta.lunesBase}T00:00:00Z`);
  if(!Number.isFinite(fecha)||new Date(fecha).getUTCDay()!==1
    ||new Date(fecha).toISOString().slice(0,10)!==meta.lunesBase)return null;
  return {inicio:fecha,semanaBase:Number(meta.semanaBase)};
}

export function fechasSemana(periodo,semanaInterna,meta){
  if(!Number.isSafeInteger(semanaInterna)||semanaInterna<1)throw Error('Semana interna inválida.');
  const ancla=anclaValida(meta) || (periodo===ANCLA_ORIGEN?anclaValida(BASE_ORIGEN):null);
  if(!ancla)return null; // Sin calendario configurado: mostrar número sin inventar fechas.
  const inicioMs=ancla.inicio+(semanaInterna-ancla.semanaBase)*SEMANA;
  const inicio=new Date(inicioMs),fin=new Date(inicioMs+6*DIA);
  if(!Number.isFinite(inicioMs)||Number.isNaN(inicio.getTime())||Number.isNaN(fin.getTime()))return null;
  return {inicio,fin};
}
function numeroDesdeLunes(lunes){
  const year=lunes.getUTCFullYear(),month=lunes.getUTCMonth();
  const primero=new Date(Date.UTC(year,month,1)).getUTCDay();
  const primerLunes=1+(8-primero)%7;
  return 1+Math.floor((lunes.getUTCDate()-primerLunes)/7);
}
function fechaCorta(d){
  return `${String(d.getUTCDate()).padStart(2,'0')}/${String(d.getUTCMonth()+1).padStart(2,'0')}/${d.getUTCFullYear()}`;
}
export function numeroSemanaVisible(periodo,semanaInterna,meta){
  const fechas=fechasSemana(periodo,semanaInterna,meta);
  return fechas?numeroDesdeLunes(fechas.inicio):semanaInterna;
}
export function etiquetaSemana(periodo,semanaInterna,meta){
  const fechas=fechasSemana(periodo,semanaInterna,meta);
  if(!fechas)return `Semana ${semanaInterna}`;
  return `Semana ${numeroDesdeLunes(fechas.inicio)} de ${MES.format(fechas.inicio)}`;
}
// Este rango siempre contiene dos fechas completas; preserva la información
// incluso al atravesar meses o años, ej. 26/10/2026–01/11/2026.
export function rangoFechasSemana(periodo,semanaInterna,meta){
  const fechas=fechasSemana(periodo,semanaInterna,meta);
  if(!fechas)return '';
  return `${fechaCorta(fechas.inicio)} – ${fechaCorta(fechas.fin)}`;
}
export function opcionSemana(periodo,semanaInterna,meta){
  const fechas=fechasSemana(periodo,semanaInterna,meta);
  if(!fechas)return `Semana ${semanaInterna}`;
  return `Sem. ${numeroDesdeLunes(fechas.inicio)} ${MES_CORTO.format(fechas.inicio)} · ${String(fechas.inicio.getUTCDate()).padStart(2,'0')}-${String(fechas.fin.getUTCDate()).padStart(2,'0')} ${MES_CORTO.format(fechas.fin)}`;
}

// Mensajes operativos usan la semana real visible, nunca el ID de Firebase.
export function textoConfirmacionRestaurarPago(periodo,semanaInterna,nombre,meta){
  return `¿Volver a registrar el pago de ${nombre} (${etiquetaSemana(periodo,semanaInterna,meta)})?\n\nEl movimiento quedará en el historial y actualizará los fondos correspondientes.`;
}
