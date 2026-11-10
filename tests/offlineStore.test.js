import test from 'node:test';
import assert from 'node:assert/strict';
import {
  claveVista,guardarVistaOffline,leerVistaOffline,borrarVistaOffline,
  claveMovimiento,guardarPendienteOffline,leerPendientesOffline,eliminarPendienteOffline
} from '../lib/offlineStore.js';

// Implementación mínima del contrato asíncrono de IndexedDB para pruebas
// aisladas de persistencia, sin necesidad de red ni almacenamiento del navegador.
function memoriaIndexedDB(){
 const bases=new Map();
 return {open(nombre){
   const peticion={};
   queueMicrotask(()=>{
     let db=bases.get(nombre);
     const nueva=!db;
     if(nueva){
       const tablas=new Map();
       db={
         objectStoreNames:{contains:x=>tablas.has(x)},
         createObjectStore(x){tablas.set(x,new Map());},
         transaction(nombreTabla){
           const tabla=tablas.get(nombreTabla);
           if(!tabla)throw Error('No hay tabla '+nombreTabla);
           const transaccion={oncomplete:null,onerror:null,onabort:null};
           const operacion=fn=>{
             const solicitud={};
             queueMicrotask(()=>{
               try{
                 solicitud.result=fn();
                 solicitud.onsuccess?.();
                 queueMicrotask(()=>transaccion.oncomplete?.());
               }catch(err){
                 solicitud.error=err;
                 solicitud.onerror?.();
                 transaccion.onerror?.();
               }
             });
             return solicitud;
           };
           transaccion.objectStore=()=>({
             put:v=>operacion(()=>{tabla.set(v.clave,structuredClone(v));return v.clave;}),
             getAll:()=>operacion(()=>[...tabla.values()].map(v=>structuredClone(v))),
             delete:k=>operacion(()=>{tabla.delete(k);return undefined;})
           });
           return transaccion;
         },
         close(){}
       };
       bases.set(nombre,db);
     }
     peticion.result=db;
     if(nueva)peticion.onupgradeneeded?.();
     peticion.onsuccess?.();
   });
   return peticion;
 }};
}

test('recuperar un salón por UID y ciclo sin Wi-Fi, sin mezclar otras cuentas',async()=>{
 const anterior=globalThis.indexedDB;
 globalThis.indexedDB=memoriaIndexedDB();
 try{
   const vista=(uid,salon)=>({
     uid,periodo:'2026-2027-A',salon,rol:'alumno',
     metaPeriodo:{nombre:'2026-2027-A',lunesBase:'2026-10-19',semanaBase:4},
     datos:{meta:{cuotaSemanal:10},integrantes:{e1:{nombre:'Alumno'}}}
   });
   await guardarVistaOffline(vista('alumno_A','507'));
   await guardarVistaOffline(vista('alumno_B','107'));
   const a=await leerVistaOffline('alumno_A','2026-2027-A','507');
   assert.equal(a.rol,'alumno');
   assert.equal(a.datos.integrantes.e1.nombre,'Alumno');
   assert.equal(a.clave,claveVista('alumno_A','2026-2027-A','507'));
   assert.equal((await leerVistaOffline('alumno_B','2026-2027-A','107')).salon,'107');
   assert.equal(await leerVistaOffline('alumno_C','2026-2027-A','507'),null);

   const mov={
     uid:'alumno_A',periodo:'2026-2027-A',salon:'507',estudianteId:'e1',
     semana:5,nombre:'Alumno',deseado:'pagado',id:'offline-12345678',
     estado:'pendiente',creadoEn:1,
     clave:claveMovimiento('alumno_A','2026-2027-A','507','e1',5)
   };
   await guardarPendienteOffline(mov);
   assert.deepEqual(await leerPendientesOffline('alumno_A'),[mov]);
   assert.deepEqual(await leerPendientesOffline('alumno_B'),[]);

   // Cerrar sesión borra la copia visible, pero NO descarta pagos pendientes.
   await borrarVistaOffline('alumno_A');
   assert.equal(await leerVistaOffline('alumno_A','2026-2027-A','507'),null);
   assert.equal((await leerVistaOffline('alumno_B','2026-2027-A','107')).salon,'107');
   assert.equal((await leerPendientesOffline('alumno_A')).length,1);

   await eliminarPendienteOffline(mov.clave);
   assert.deepEqual(await leerPendientesOffline('alumno_A'),[]);
 }finally{
   if(anterior===undefined)delete globalThis.indexedDB;
   else globalThis.indexedDB=anterior;
 }
});
