// Utilidad de demostración: SOLO escribe en Realtime Database Emulator local.
// Se niega a ejecutar si falta la configuración explícita del emulador o el proyecto es real.
import {initializeApp,deleteApp} from 'firebase-admin/app';
import {getDatabase} from 'firebase-admin/database';

const proyecto='demo-ahorro-grupal';
const host=process.env.FIREBASE_DATABASE_EMULATOR_HOST;
if (host!=='127.0.0.1:9000' && host!=='localhost:9000') {
  throw Error('SEGURIDAD: establece FIREBASE_DATABASE_EMULATOR_HOST=127.0.0.1:9000. No se permiten bases reales.');
}
if (process.env.GCLOUD_PROJECT && process.env.GCLOUD_PROJECT!==proyecto) {
  throw Error('SEGURIDAD: solo se permite el proyecto demo-ahorro-grupal.');
}
const app=initializeApp({projectId:proyecto,databaseURL:`https://${proyecto}-default-rtdb.firebaseio.com`},`historial-demo-${process.pid}`);
try {
  const metaRef=getDatabase(app).ref('/periodos/2026-2027-A/meta');
  const snap=await metaRef.get();
  const meta=snap.val();
  if (!meta?.lunesBase || !Number.isSafeInteger(meta?.semanaBase)) {
    throw Error('Primero prepara la demostración local con node scripts/crear-demostracion-local.mjs');
  }
  const actual=meta.reinicioContable;
  if(actual){
    if(actual.version!==1 || actual.semanaInicio!==5 || !Number.isSafeInteger(actual.activadoEn)) {
      throw Error('El marcador existente está incompleto. No se modificará.');
    }
    console.log('Marcador de semana 5 ya existente en el emulador.');
  } else {
    await metaRef.child('reinicioContable').set({version:1,semanaInicio:5,activadoEn:Date.now()});
    console.log('Activado el histórico SOLO EN EL EMULADOR. Ninguna base real fue tocada.');
  }
} finally { await deleteApp(app); }
