// Los avisos públicos nunca incluyen UID, motivo, estudiante ni fondo privado.
// Se guardan en la metadata del ciclo, que ya es visible para los participantes
// autorizados con PIN o con cuenta. No requiere abrir nuevas reglas Firebase.
export function avisoPublicoRetiro({monto,fecha}) {
  if(!Number.isSafeInteger(monto)||monto<1||monto>1_000_000
    ||!Number.isSafeInteger(fecha)||fecha<=0)throw Error('Aviso de retiro inválido.');
  return {tipo:'retiroCarrera',monto,fecha,estado:'realizado'};
}
export function listarAvisosCarrera(avisos={},maximo=20) {
  return Object.entries(avisos||{})
    .filter(([,r])=>r?.tipo==='retiroCarrera'&&r.estado==='realizado'
      &&Number.isSafeInteger(r.monto)&&r.monto>0&&Number.isSafeInteger(r.fecha)&&r.fecha>0)
    .map(([id,r])=>({id,tipo:r.tipo,monto:r.monto,fecha:r.fecha,estado:r.estado}))
    .sort((a,b)=>b.fecha-a.fecha||b.id.localeCompare(a.id))
    .slice(0,maximo);
}
export async function publicarAvisoRetiro(db,{periodo,salon,retiroId,monto,fecha}) {
  if(typeof periodo!=='string'||!/^\d{4}-\d{4}-[AB]$/.test(periodo)
    ||typeof salon!=='string'||!/^[A-Za-z0-9_-]{1,24}$/.test(salon)
    ||typeof retiroId!=='string'||!/^[A-Za-z0-9_-]{1,128}$/.test(retiroId))
    throw Error('Identificador de aviso inválido.');
  const aviso=avisoPublicoRetiro({monto,fecha});
  // Un ID fijo permite reintentar sin publicar el retiro dos veces.
  const id=`${salon}_${retiroId}`;
  await db.ref(`periodos/${periodo}/meta/avisosCarrera/${id}`).set(aviso);
  return id;
}
