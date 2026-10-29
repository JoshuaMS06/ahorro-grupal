// Solo funciones puras: las reglas de Firebase son la autoridad final.
export function rolDeUsuario(uid, adminGeneralUid, asignacion) {
  if (!uid) return null;
  if (adminGeneralUid && uid === adminGeneralUid) return {tipo:'general'};
  if (asignacion && asignacion.periodo && asignacion.salon && ['1','2'].includes(String(asignacion.plaza))) {
    return {tipo:'responsable',periodo:asignacion.periodo,salon:asignacion.salon,plaza:String(asignacion.plaza)};
  }
  return null;
}
export function esResponsableDeSalon(asignacion, periodo, salon) {
  return Boolean(asignacion && asignacion.periodo===periodo && asignacion.salon===salon && ['1','2'].includes(String(asignacion.plaza)));
}
export function validarAsignacion({periodo,salon,plaza,uid,adminUid,responsables={},indices={}}){
  if(!/^\d{4}-\d{4}-[A-Z0-9]{1,5}$/.test(periodo)) throw Error('Ciclo escolar inválido.');
  if(!/^[a-zA-Z0-9_-]{1,24}$/.test(salon)) throw Error('Salón inválido.');
  if(!['1','2'].includes(String(plaza))) throw Error('Solo hay dos responsables por salón.');
  if(!uid) return true; // revocación
  if(!/^[A-Za-z0-9_-]{6,128}$/.test(uid)) throw Error('El UID debe ser el identificador de Firebase Authentication, sin espacios.');
  if(uid===adminUid) throw Error('El administrador general no puede ocupar una plaza de responsable.');
  const otro=String(plaza)==='1'?'2':'1';
  if(responsables?.[periodo]?.[salon]?.[otro]===uid) throw Error('Una misma cuenta no puede ocupar las dos plazas.');
  const asignado=indices?.[uid];
  if(asignado && !(asignado.periodo===periodo&&asignado.salon===salon&&String(asignado.plaza)===String(plaza))) throw Error('Ese UID ya está asignado a otra plaza. Revoca primero el permiso anterior.');
  return true;
}
export function prepararCambiosResponsable({periodo,salon,plaza,uid,anterior}) {
  const cambios={};
  cambios[`roles/responsables/${periodo}/${salon}/${plaza}`]=uid||null;
  if(anterior && anterior!==uid) cambios[`roles/porUsuario/${anterior}`]=null;
  if(uid) cambios[`roles/porUsuario/${uid}`]={periodo,salon,plaza:String(plaza)};
  return cambios;
}
