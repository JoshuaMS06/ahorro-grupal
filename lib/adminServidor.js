import {initializeApp,getApps,cert} from 'firebase-admin/app';
import {getAuth} from 'firebase-admin/auth';
import {getDatabase} from 'firebase-admin/database';

export function firebaseServidor() {
  const anterior=getApps().find(app=>app.name==='ahorro-admin');
  if(anterior)return anterior;
  if(!process.env.VERCEL && process.env.AHORRO_DEMO_EMULADOR==='true' && process.env.FIREBASE_DATABASE_EMULATOR_HOST==='127.0.0.1:9000' && process.env.FIREBASE_AUTH_EMULATOR_HOST==='127.0.0.1:9099'){
    return initializeApp({projectId:'demo-ahorro-grupal',databaseURL:'https://demo-ahorro-grupal-default-rtdb.firebaseio.com'},'ahorro-admin');
  }
  const raw=process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
  if(!raw)throw Error('Faltan credenciales privadas en Vercel.');
  const cuenta=JSON.parse(raw);
  if(cuenta.project_id!=='ahorro-grupal-industrial'||!cuenta.private_key||!cuenta.client_email) throw Error('Cuenta de servicio inválida.');
  return initializeApp({credential:cert(cuenta),databaseURL:'https://ahorro-grupal-industrial-default-rtdb.firebaseio.com'},'ahorro-admin');
}

export function adminAuth(){return getAuth(firebaseServidor());}
export function adminDatabase(){return getDatabase(firebaseServidor());}

export async function usuarioVerificado(req){
  const match=(req.headers.authorization||'').match(/^Bearer (\S+)$/);
  if(!match)return null;
  return adminAuth().verifyIdToken(match[1],true);
}

export async function permisoAdministrador(db,uid,periodo,salon){
  const adminGeneral=(await db.ref('roles/adminGeneralUid').get()).val()===uid;
  if(adminGeneral)return {tipo:'general'};
  const asignacion=(await db.ref(`roles/porUsuario/${uid}`).get()).val();
  if(asignacion?.periodo!==periodo||asignacion?.salon!==salon)return null;
  const plazas=(await db.ref(`roles/responsables/${periodo}/${salon}`).get()).val()||{};
  return (plazas['1']===uid||plazas['2']===uid)?{tipo:'responsable'}:null;
}
