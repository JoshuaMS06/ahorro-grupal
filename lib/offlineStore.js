// Cache LOCAL del último salón autorizado y movimientos pendientes.
// Nunca guarda PIN, contraseña, token, datos de otros salones ni credenciales.
const NOMBRE='ahorro-grupal-offline-v1';
const VERSION=1;
const VISTA='vistas';
const PENDIENTES='movimientos';
function abrir(){
  return new Promise((resolve,reject)=>{
    if(typeof indexedDB==='undefined'){reject(Error('Almacenamiento local no disponible.'));return;}
    const solicitud=indexedDB.open(NOMBRE,VERSION);
    solicitud.onupgradeneeded=()=>{
      const db=solicitud.result;
      if(!db.objectStoreNames.contains(VISTA))db.createObjectStore(VISTA,{keyPath:'clave'});
      if(!db.objectStoreNames.contains(PENDIENTES))db.createObjectStore(PENDIENTES,{keyPath:'clave'});
    };
    solicitud.onsuccess=()=>resolve(solicitud.result);
    solicitud.onerror=()=>reject(solicitud.error||Error('No se pudo abrir el almacenamiento.'));
    solicitud.onblocked=()=>reject(Error('Cierra otras pestañas y vuelve a abrir la aplicación.'));
  });
}
async function operar(nombre,modo,fn){
  const db=await abrir();
  try{
    return await new Promise((resolve,reject)=>{
      const tx=db.transaction(nombre,modo),store=tx.objectStore(nombre);
      let valor;
      try{const req=fn(store);req.onsuccess=()=>{valor=req.result;};req.onerror=()=>reject(req.error||Error('Fallo de almacenamiento.')); }
      catch(err){reject(err);return;}
      tx.oncomplete=()=>resolve(valor);
      tx.onerror=()=>reject(tx.error||Error('No se guardaron los datos locales.'));
      tx.onabort=()=>reject(tx.error||Error('Se canceló el almacenamiento local.'));
    });
  }finally{db.close();}
}
export const claveVista=(uid,periodo,salon)=>`${uid}|${periodo}|${salon}`;
export async function guardarVistaOffline(vista){
  if(!vista||!vista.uid||!vista.periodo||!vista.salon||!['alumno','responsable','general'].includes(vista.rol))
    throw Error('Vista local no autorizada.');
  const {uid,periodo,salon,rol,metaPeriodo,metaSalon,datos,reporte}=vista;
  const snapshot={clave:claveVista(uid,periodo,salon),uid,periodo,salon,rol,
    metaPeriodo:metaPeriodo||{},metaSalon:metaSalon||{nombre:`Salón ${salon}`},datos:datos||{},
    reporte:rol==='alumno'?null:reporte||null,
    actualizadoEn:Date.now()};
  await operar(VISTA,'readwrite',store=>store.put(snapshot));
  return snapshot;
}
export async function leerVistaOffline(uid,periodo,salon){
  if(!uid)return null;
  const todas=await operar(VISTA,'readonly',store=>store.getAll());
  const autorizadas=todas.filter(v=>v.uid===uid&&['alumno','responsable','general'].includes(v.rol));
  if(!autorizadas.length)return null;
  const exacta=autorizadas.find(v=>v.periodo===periodo&&v.salon===salon);
  return exacta||autorizadas.sort((a,b)=>b.actualizadoEn-a.actualizadoEn)[0];
}
export async function borrarVistaOffline(uid){
  if(!uid)return;
  const todas=await operar(VISTA,'readonly',store=>store.getAll());
  for(const item of todas.filter(v=>v.uid===uid))
    await operar(VISTA,'readwrite',store=>store.delete(item.clave));
}
export function claveMovimiento(uid,periodo,salon,estudianteId,semana){
  return `${uid}|${periodo}|${salon}|${estudianteId}|${semana}`;
}
export async function leerPendientesOffline(uid){
  if(!uid)return [];
  const todas=await operar(PENDIENTES,'readonly',store=>store.getAll());
  return todas.filter(v=>v.uid===uid).sort((a,b)=>a.creadoEn-b.creadoEn);
}
export async function guardarPendienteOffline(mov){
  if(!mov?.uid||!mov?.clave||!mov?.id||!['pagado','anulado'].includes(mov.deseado))
    throw Error('Movimiento local inválido.');
  await operar(PENDIENTES,'readwrite',store=>store.put(mov));
}
export async function eliminarPendienteOffline(clave){
  await operar(PENDIENTES,'readwrite',store=>store.delete(clave));
}
