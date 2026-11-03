import {adminAuth,adminDatabase,usuarioVerificado} from '../lib/adminServidor.js';
import {responsableAutorizadoParaEnlace} from '../lib/invitacionResponsable.js';

// El enlace de un solo uso es una credencial: solo sale como respuesta privada
// al administrador general y no se almacena ni envía automáticamente.
export default async function handler(req,res){
  res.setHeader('Cache-Control','no-store, private');
  res.setHeader('Pragma','no-cache');
  if(req.method!=='POST')return res.status(405).json({error:'Método no permitido.'});
  if(!/^Bearer \S+$/.test(req.headers.authorization||''))
    return res.status(401).json({error:'Inicia sesión como administrador general.'});
  try{
    const usuario=await usuarioVerificado(req);
    if(!usuario)return res.status(401).json({error:'Sesión no válida.'});
    const {periodo,salon,plaza}=req.body||{};
    const db=adminDatabase(),auth=adminAuth();
    const roles=(await db.ref('roles').get()).val();
    let uid;
    try{uid=responsableAutorizadoParaEnlace(roles,{adminUid:usuario.uid,periodo,salon,plaza});}
    catch(error){return res.status(403).json({error:error.message});}
    const cuenta=await auth.getUser(uid);
    if(!cuenta?.email||cuenta.disabled)
      return res.status(409).json({error:'La cuenta no está activa o no tiene correo. Revisa el registro de responsables.'});
    if(cuenta.emailVerified!==true){
      // Establecer contraseña mediante enlace no implica marcar email verificado
      // por servidor, porque la propiedad solo debe actualizarse con evidencia.
    }
    const enlace=await auth.generatePasswordResetLink(cuenta.email);
    return res.status(200).json({correo:cuenta.email,nombre:cuenta.displayName||'',enlace});
  }catch(error){
    console.error('No se pudo preparar una invitación: ',error?.code||'error');
    const codigo=String(error?.code||'');
    if(codigo==='auth/operation-not-allowed')
      return res.status(409).json({error:'Activa el inicio de sesión Correo/Contraseña en Firebase Authentication para crear contraseñas de responsables.'});
    return res.status(500).json({error:'No se pudo generar el enlace de contraseña. Revisa que Correo/Contraseña esté activo en Firebase Authentication.'});
  }
}
