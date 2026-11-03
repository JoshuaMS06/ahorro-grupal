// Funciones puras: únicamente modifica roles; jamás el árbol de aulas,
// saldos, pagos, profesores o semestres.
export function verificarDatosResponsable({periodo,salon,plaza,nombre,correo}) {
  if(typeof periodo!=='string'||!/^\d{4}-\d{4}-[AB]$/.test(periodo))throw Error('Semestre inválido.');
  if(typeof salon!=='string'||!/^[A-Za-z0-9_-]{1,24}$/.test(salon))throw Error('Salón inválido.');
  if(!['1','2'].includes(String(plaza)))throw Error('Selecciona una de las dos plazas.');
  if(nombre!==undefined && (typeof nombre!=='string'||nombre.trim().length<3||nombre.trim().length>100))throw Error('Escribe el nombre completo.');
  if(correo!==undefined && (typeof correo!=='string'||correo.length>254||!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(correo)))throw Error('Escribe un correo válido.');
}

export function salonDisponibleResponsable(meta, salonRegistrado) {
  if(!salonRegistrado)throw Error('Este salón no aparece en el ciclo seleccionado. Revisa el ciclo en la pantalla y actualiza.');
  if(!meta)throw Error('El ciclo escolar no tiene configuración.');
  if(meta.cerradoEn)throw Error('El ciclo escolar está cerrado y no admite nuevos responsables.');
  return true;
}

export function modificarPlazaRoles(actualRoles,{accion,periodo,salon,plaza,uid,adminUid}){
  if(!actualRoles || actualRoles.adminGeneralUid!==adminUid)
    throw Error('Ya no tienes acceso como administrador general.');
  verificarDatosResponsable({periodo,salon,plaza});
  const roles=structuredClone(actualRoles);
  roles.responsables ||= {};
  roles.responsables[periodo] ||= {};
  roles.responsables[periodo][salon] ||= {};
  roles.porUsuario ||= {};
  const plazas=roles.responsables[periodo][salon];
  const anterior=plazas[plaza];
  if(accion==='asignar'){
    if(!uid)throw Error('No se pudo identificar la cuenta del responsable.');
    if(uid===adminUid)throw Error('No es posible asignar esta cuenta: ya es el administrador general y puede gestionar todos los salones. Para una plaza de responsable utiliza otra cuenta.');
    if(anterior&&anterior!==uid)throw Error('La plaza ya tiene responsable. Revoca el acceso anterior primero.');
    const previo=roles.porUsuario[uid];
    if(previo&&(previo.periodo!==periodo||previo.salon!==salon||String(previo.plaza)!==String(plaza)))
      throw Error('Esa cuenta ya administra otra plaza. Revoca primero su acceso anterior.');
    for(const [s,grupo] of Object.entries(roles.responsables[periodo]||{}))
      for(const [p,asignado] of Object.entries(grupo||{}))
        if(asignado===uid&&(s!==salon||p!==String(plaza)))throw Error('Una cuenta no puede ocupar dos plazas.');
    plazas[plaza]=uid;
    roles.porUsuario[uid]={periodo,salon,plaza:String(plaza)};
  }else if(accion==='revocar'){
    if(!anterior)throw Error('La plaza ya está vacía.');
    delete plazas[plaza];
    const previo=roles.porUsuario[anterior];
    if(previo?.periodo===periodo&&previo?.salon===salon&&String(previo?.plaza)===String(plaza))
      delete roles.porUsuario[anterior];
  }else throw Error('Operación inválida.');
  return roles;
}

// La primera invocación especulativa de Firebase Admin puede recibir null.
// No debemos abortar una asignación válida porque todavía no recibió el estado
// del servidor. En reintentos, el estado real prevalece sobre la copia inicial.
export function proponerTransaccionRoles(actual,rolesInicial,args) {
  return modificarPlazaRoles(actual==null?rolesInicial:actual,args);
}

// Compatibilidad con pruebas y operaciones de cambio de semestre antiguas.
// La API de responsables utiliza modificarPlazaRoles, no una transacción raíz.
export function modificarPlazaRaiz(actual,args){
  if(!actual?.periodos?.[args.periodo]?.salones?.[args.salon]||actual.periodos[args.periodo].meta?.cerradoEn)
    throw Error('El salón no existe o el semestre ya está cerrado.');
  const raiz=structuredClone(actual);
  raiz.roles=modificarPlazaRoles(actual.roles,args);
  return raiz;
}
