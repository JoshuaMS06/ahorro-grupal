// Ahorro personal de profesores. No participa en el saldo de la carrera.
// Los registros de semanas 1–4 del periodo de reinicio son históricos.
export const CUOTA_PROFESOR = 10;
export const PROFESORES = Object.freeze([
  {id:'p01',nombre:'Ubaldo Jerónimo Carrera'},
  {id:'p02',nombre:'Nicolas Hernández Ruiz'},
  {id:'p03',nombre:'Rafael Rios Esperanza'},
  {id:'p04',nombre:'Francisco Javier Sol Sampedro'},
  {id:'p05',nombre:'Eduardo Martínez Mendoza'},
  {id:'p06',nombre:'Néstor Hernández Silva'},
  {id:'p07',nombre:'Adán Acosta Banda'},
  {id:'p08',nombre:'Tania Castillo Villegas'},
]);
export const claveSemanaProfesor = semana => {
  if(!Number.isSafeInteger(semana)||semana<1||semana>9999)throw Error('Semana inválida.');
  return `s${String(semana).padStart(4,'0')}`;
};
export const esPagoProfesorAnterior = (periodo,semana)=>periodo==='2026-2027-A' && semana<5;
export function resumenAhorroProfesor(registros={},periodo='2026-2027-A') {
  let saldo=0,historico=0,actuales=0,anteriores=0;
  for(const p of Object.values(registros||{})) {
    if(!p || p.estado!=='pagado')continue;
    if(!Number.isSafeInteger(p.semana)||p.semana<1||p.monto!==CUOTA_PROFESOR)throw Error('Registro de profesor incongruente.');
    if(esPagoProfesorAnterior(periodo,p.semana)){historico+=CUOTA_PROFESOR;anteriores++;}
    else {saldo+=CUOTA_PROFESOR;actuales++;}
  }
  return {saldo,historico,actuales,anteriores};
}
export function crearPagoProfesor(profesorId,semana,uid,eventoId,instante=Date.now(),periodo='2026-2027-A') {
  if(!PROFESORES.some(p=>p.id===profesorId))throw Error('Profesor no registrado.');
  if(!Number.isSafeInteger(semana)||semana<1||semana>9999)throw Error('Semana inválida.');
  if(!uid || !eventoId)throw Error('Se requiere usuario y folio.');
  return {profesorId,semana,monto:CUOTA_PROFESOR,
    tipoRegistro:esPagoProfesorAnterior(periodo,semana)?'anterior':'actual',
    estado:'pagado',creadoEn:instante,registradoPor:uid,
    historial:{[eventoId]:{tipo:'registro',fecha:instante,uid}}};
}

// Los profesores conservan su ahorro al cambiar de semestre; no se copian pagos.
export function resumenAcumuladoProfesor(pagosPorPeriodo={},profesorId) {
  if(!PROFESORES.some(p=>p.id===profesorId))throw Error('Profesor desconocido.');
  return Object.entries(pagosPorPeriodo||{}).reduce((a,[periodo,profesores])=>{
    const parte=resumenAhorroProfesor(profesores?.[profesorId]||{},periodo);
    return {saldo:a.saldo+parte.saldo,historico:a.historico+parte.historico,actuales:a.actuales+parte.actuales,anteriores:a.anteriores+parte.anteriores};
  },{saldo:0,historico:0,actuales:0,anteriores:0});
}
