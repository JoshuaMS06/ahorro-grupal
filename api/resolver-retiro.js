import {initializeApp,getApps,cert} from 'firebase-admin/app';
import {getAuth} from 'firebase-admin/auth';
import {getDatabase} from 'firebase-admin/database';
import {resumenCaja,CUOTA_SEMANAL} from '../lib/aulas.js';

const PROJECT_ID='ahorro-grupal-industrial';
const DATABASE_URL='https://ahorro-grupal-industrial-default-rtdb.firebaseio.com';
const DEFAULT_PERIOD='2026-2027-A';

function appAdmin() {
  const previous=getApps().find(app=>app.name==='ahorro-admin');
  if(previous)return previous;
  const raw=process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
  if(!raw)throw Error('Faltan credenciales privadas en Vercel.');
  const data=JSON.parse(raw);
  if(data.project_id!==PROJECT_ID || !data.private_key || !data.client_email)throw Error('Cuenta de servicio no válida para este proyecto.');
  return initializeApp({credential:cert(data),databaseURL:DATABASE_URL},'ahorro-admin');
}

function totalLegado(integrantes,legacy) {
  return Object.values(integrantes||{}).reduce((sum,estudiante)=>{
    const alias=estudiante?.aliasLegado||estudiante?.nombre;
    const pagados=Number(legacy?.[alias]?.pagos)||0;
    return sum+(Number.isSafeInteger(pagados)&&pagados>=0?pagados*CUOTA_SEMANAL:0);
  },0);
}

export default async function handler(req,res) {
  res.setHeader('Cache-Control','no-store');
  if(req.method!=='POST')return res.status(405).json({error:'Método no permitido.'});
  const match=(req.headers.authorization||'').match(/^Bearer (.+)$/);
  if(!match)return res.status(401).json({error:'Inicia sesión como administrador general.'});
  const {periodo,salon,retiroId,estado}=req.body||{};
  if(typeof periodo!=='string'||!/^\d{4}-\d{4}-[A-Z0-9]{1,5}$/.test(periodo)||
     typeof salon!=='string'||!/^[A-Za-z0-9_-]{1,24}$/.test(salon)||
     typeof retiroId!=='string'||!/^[A-Za-z0-9_-]{1,128}$/.test(retiroId)||
     !['aprobado','rechazado'].includes(estado)){
    return res.status(400).json({error:'Solicitud inválida.'});
  }
  try{
    const admin=appAdmin();
    const auth=getAuth(admin);
    const user=await auth.verifyIdToken(match[1],true);
    const db=getDatabase(admin);
    const general=await db.ref('roles/adminGeneralUid').get();
    if(general.val()!==user.uid)return res.status(403).json({error:'Solo el administrador general puede resolver retiros.'});
    const ciclo=await db.ref(`periodos/${periodo}/meta`).get();
    if(!ciclo.exists()||ciclo.val()?.cerradoEn)return res.status(409).json({error:'El ciclo está archivado o no existe.'});
    const antiguos=(periodo===DEFAULT_PERIOD&&salon==='507')
      ?(await db.ref('ahorro/integrantes').get()).val()||{}
      :{};
    const ruta=db.ref(`aulas/${periodo}/${salon}`);
    const tx=await ruta.transaction(actual=>{
      if(!actual?.meta||!actual.retiros?.[retiroId]||actual.retiros[retiroId].estado!=='solicitado')return;
      const solicitud=actual.retiros[retiroId];
      if(!Number.isSafeInteger(solicitud.monto)||solicitud.monto<=0||solicitud.monto>1000000)return;
      const legado=(periodo===DEFAULT_PERIOD&&salon==='507')?totalLegado(actual.integrantes,antiguos):0;
      const balance=resumenCaja(actual.pagos||{},actual.retiros||{},legado);
      if(estado==='aprobado' && (balance.saldo<solicitud.monto||balance.saldo<0))return;
      const cuando=Date.now();
      return {...actual,retiros:{...actual.retiros,[retiroId]:{...solicitud,estado,respondidoPor:user.uid,respondidoEn:cuando}}};
    },undefined,false);
    if(!tx.committed)return res.status(409).json({error:'La solicitud ya cambió o no existe saldo suficiente.'});
    return res.status(200).json({ok:true,estado});
  }catch(error){
    console.error('No se pudo procesar el retiro:',error?.code||error?.message||'error');
    return res.status(500).json({error:'No se pudo completar la operación. Revisa la función en Vercel.'});
  }
}
