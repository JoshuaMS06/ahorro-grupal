import {verificarDatosResponsable} from './gestionarResponsables.js';

// Solo se pueden emitir enlaces para cuentas que ya ocupan formalmente una plaza.
// En particular, NO se emiten para usuarios arbitrarios ni para PIN de estudiantes.
export function responsableAutorizadoParaEnlace(roles,{adminUid,periodo,salon,plaza}){
  verificarDatosResponsable({periodo,salon,plaza});
  if(!roles||roles.adminGeneralUid!==adminUid)
    throw Error('Solamente el administrador general puede preparar invitaciones.');
  const uid=roles.responsables?.[periodo]?.[salon]?.[plaza];
  if(!uid)throw Error('Esta plaza todavía no tiene responsable asignado.');
  const asignacion=roles.porUsuario?.[uid];
  if(!asignacion||asignacion.periodo!==periodo||asignacion.salon!==salon
    ||String(asignacion.plaza)!==String(plaza))
    throw Error('La cuenta ya no coincide con la plaza asignada. Actualiza el panel.');
  if(uid===adminUid)throw Error('La cuenta administradora general no necesita una invitación.');
  return uid;
}
