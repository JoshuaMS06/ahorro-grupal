import {adminAuth,adminDatabase,usuarioVerificado} from '../lib/adminServidor.js';
import {isClassCode,isPeriodId} from '../lib/aulas.js';

// Las solicitudes se crean una sola vez desde Firebase Auth. Un usuario no se
// autoriza a sí mismo: únicamente este endpoint de servidor asigna lectores.
export default async function handler(req,res) {
  res.setHeader('Cache-Control','no-store');
  if(!['GET','POST'].includes(req.method))return res.status(405).json({error:'Método no permitido.'});
  if(!/^Bearer \S+$/.test(req.headers.authorization||''))
    return res.status(401).json({error:'Inicia sesión como administrador general.'});
  try {
    const usuario=await usuarioVerificado(req);
    if(!usuario)return res.status(401).json({error:'Sesión no válida.'});
    const db=adminDatabase(),auth=adminAuth();
    if((await db.ref('roles/adminGeneralUid').get()).val()!==usuario.uid)
      return res.status(403).json({error:'Acción reservada al administrador general.'});

    if(req.method==='GET'){
      const solicitudes=(await db.ref('solicitudesSalon').get()).val()||{};
      const lista=Object.entries(solicitudes);
      if(lista.length>300)return res.status(409).json({error:'Hay demasiadas solicitudes para cargar de una sola vez.'});
      const lectores=(await db.ref('roles/lectores').get()).val()||{};
      const resultado=await Promise.all(lista.map(async ([uid,s])=>{
        let correo='',nombre,verificado=false;
        try {
          const cuenta=await auth.getUser(uid);
          correo=cuenta.email||'';
          nombre=cuenta.displayName||'';
          verificado=cuenta.emailVerified===true;
        }catch(error){
          if(error.code!=='auth/user-not-found')throw error;
          nombre='Cuenta ya inexistente';
        }
        return {uid,correo,nombre,verificado,periodo:s.periodo,salon:s.salon,estado:s.estado||'pendiente',
          creadoEn:s.creadoEn||0,lector:lectores[uid]||null};
      }));
      return res.status(200).json({solicitudes:resultado.sort((a,b)=>b.creadoEn-a.creadoEn)});
    }

    const {accion,uid,periodo,salon}=req.body||{};
    if(!['aprobar','rechazar','revocar','corregir'].includes(accion) ||
       typeof uid!=='string'||!/^[A-Za-z0-9_-]{6,128}$/.test(uid))
      return res.status(400).json({error:'Solicitud inválida.'});
    if(uid===usuario.uid)return res.status(409).json({error:'No puedes asignar tu propia cuenta.'});
    const solicitudRef=db.ref(`solicitudesSalon/${uid}`);
    const solicitud=(await solicitudRef.get()).val();
    if(!solicitud)return res.status(404).json({error:'Solicitud no encontrada.'});
    const lectorRef=db.ref(`roles/lectores/${uid}`);
    const lector=(await lectorRef.get()).val();
    if(accion==='revocar'){
      if(!lector)return res.status(409).json({error:'Esta cuenta no tiene acceso activo.'});
      await lectorRef.remove();
      await solicitudRef.update({estado:'revocado',resueltoEn:Date.now(),resueltoPor:usuario.uid});
      return res.status(200).json({ok:true});
    }
    if(accion==='corregir'){
      if(lector)return res.status(409).json({error:'Revoca el acceso antes de cambiar el salón.'});
      if(!isPeriodId(periodo)||!isClassCode(salon))return res.status(400).json({error:'Ciclo o salón incorrecto.'});
      const actual=(await db.ref(`periodos/${periodo}`).get()).val();
      if(!actual?.salones?.[salon]||actual.meta?.cerradoEn)
        return res.status(409).json({error:'El salón no existe o el ciclo está cerrado.'});
      await solicitudRef.update({periodo,salon,estado:'pendiente',corregidoEn:Date.now(),corregidoPor:usuario.uid});
      return res.status(200).json({ok:true});
    }
    if(accion==='rechazar'){
      if(lector)return res.status(409).json({error:'Primero revoca el acceso activo.'});
      await solicitudRef.update({estado:'rechazado',resueltoEn:Date.now(),resueltoPor:usuario.uid});
      return res.status(200).json({ok:true});
    }
    if(lector)return res.status(409).json({error:'Esta cuenta ya tiene un salón asignado.'});
    if(solicitud.estado!=='pendiente')return res.status(409).json({error:'Primero devuelve la solicitud al estado pendiente mediante Corregir.'});
    if(!isPeriodId(solicitud.periodo)||!isClassCode(solicitud.salon))
      return res.status(400).json({error:'Solicitud con salón inválido.'});
    const [destino,rol,cuenta]=await Promise.all([
      db.ref(`periodos/${solicitud.periodo}`).get(),
      db.ref(`roles/porUsuario/${uid}`).get(),
      auth.getUser(uid)
    ]);
    if(!destino.val()?.salones?.[solicitud.salon]||destino.val()?.meta?.cerradoEn)
      return res.status(409).json({error:'El salón no existe o el ciclo terminó.'});
    if(rol.exists()||!cuenta.emailVerified||cuenta.disabled)
      return res.status(409).json({error:'La cuenta no es elegible o aún no verifica su correo.'});
    const acceso={periodo:solicitud.periodo,salon:solicitud.salon,aprobadoEn:Date.now(),aprobadoPor:usuario.uid};
    const asignacion=await lectorRef.transaction(actual=>actual===null?acceso:undefined,undefined,false);
    if(!asignacion.committed)return res.status(409).json({error:'La cuenta ya fue asignada. Actualiza la lista.'});
    await solicitudRef.update({estado:'aprobado',resueltoEn:Date.now(),resueltoPor:usuario.uid});
    return res.status(200).json({ok:true});
  }catch(error){
    console.error('Accesos por salón:',error?.code||error?.message||'error');
    return res.status(500).json({error:'No se pudo gestionar el acceso. Revisa los registros del servidor.'});
  }
}
