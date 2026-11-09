// Preferencia local de interfaz: NO autentica ni acredita la identidad.
// Los saldos y permisos siempre provienen del servidor y de las reglas Firebase.
const CLAVE='ag:mi-registro:v1';
export function claveRegistroPersonal(periodo,salon){
  return `${periodo}/${salon}`;
}
export function leerRegistrosFijados(almacenamiento){
  try {
    const valor=JSON.parse(almacenamiento?.getItem(CLAVE)||'{}');
    if(!valor || Array.isArray(valor) || typeof valor!=='object')return {};
    return Object.fromEntries(Object.entries(valor).filter(([clave,id])=>
      /^\d{4}-\d{4}-[A-Z0-9]{1,5}\/[A-Za-z0-9_-]{1,24}$/.test(clave)&&
      typeof id==='string'&&/^[A-Za-z0-9_-]{2,32}$/.test(id)
    ).slice(-40));
  }catch{return {};}
}
export function fijarRegistroPersonal(previo,periodo,salon,id,almacenamiento){
  const clave=claveRegistroPersonal(periodo,salon);
  if(!/^\d{4}-\d{4}-[A-Z0-9]{1,5}\/[A-Za-z0-9_-]{1,24}$/.test(clave))
    throw Error('El salón no es válido.');
  if(id!==null && (typeof id!=='string'||!/^[A-Za-z0-9_-]{2,32}$/.test(id)))
    throw Error('El estudiante seleccionado no es válido.');
  const siguiente={...previo};
  if(id===null)delete siguiente[clave];else siguiente[clave]=id;
  // Se intenta persistir; si el almacenamiento está bloqueado, el selector
  // sigue funcionando durante esta sesión y no da permisos adicionales.
  try {almacenamiento?.setItem(CLAVE,JSON.stringify(siguiente));}catch{/* sin almacenamiento */}
  return siguiente;
}
export function resumenRegistroPersonal(registros={},estudianteId){
  if(!estudianteId)return {semanasPagadas:0,totalAportado:0};
  const semanas=new Map();
  for(const p of Object.values(registros||{})){
    if(p?.estudianteId!==estudianteId||p.estado!=='pagado'
      ||!Number.isSafeInteger(p.semana)||p.semana<1
      ||!Number.isSafeInteger(p.monto)||p.monto<1)continue;
    // Una semana es un único pago: registros de auditoría no son pagos nuevos.
    semanas.set(p.semana,p.monto);
  }
  return {semanasPagadas:semanas.size,totalAportado:[...semanas.values()].reduce((a,b)=>a+b,0)};
}
