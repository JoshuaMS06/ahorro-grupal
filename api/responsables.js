import {adminAuth,adminDatabase,usuarioVerificado} from '../lib/adminServidor.js';
import {verificarDatosResponsable,salonDisponibleResponsable,proponerTransaccionRoles} from '../lib/gestionarResponsables.js';
import {responsableAutorizadoParaEnlace} from '../lib/invitacionResponsable.js';

// La asignación de responsables no reemplaza ni modifica datos financieros.
// Solamente modifica /roles, de forma atómica.
export default async function handler(req,res){
  res.setHeader('Cache-Control','no-store, private');
  res.setHeader('Pragma','no-cache');
  if(!['GET','POST'].includes(req.method))return res.status(405).json({error:'Método no permitido.'});
  if(!/^Bearer \S+$/.test(req.headers.authorization||''))return res.status(401).json({error:'Inicia sesión como administrador general.'});
  try{
    const usuario=await usuarioVerificado(req);
    if(!usuario)return res.status(401).json({error:'Sesión no válida.'});
    const db=adminDatabase(),auth=adminAuth();
    if((await db.ref('roles/adminGeneralUid').get()).val()!==usuario.uid)
      return res.status(403).json({error:'Solo el administrador general puede administrar responsables.'});
    if(req.method==='GET'){
      const periodo=req.query?.periodo;
      if(typeof periodo!=='string'||!/^\d{4}-\d{4}-[AB]$/.test(periodo))
        return res.status(400).json({error:'Semestre inválido.'});
      const asignados=(await db.ref(`roles/responsables/${periodo}`).get()).val()||{};
      const uids=[...new Set(Object.values(asignados).flatMap(grupo=>Object.values(grupo||{})).filter(Boolean))];
      if(uids.length>80)return res.status(409).json({error:'Demasiadas asignaciones para consultar.'});
      const perfiles=Object.fromEntries(await Promise.all(uids.map(async uid=>{
        try{
          const persona=await auth.getUser(uid);
          return [uid,{nombre:persona.displayName||'',correo:persona.email||'',activo:!persona.disabled}];
        }catch(error){
          if(error?.code==='auth/user-not-found')return [uid,{nombre:'Cuenta no encontrada',correo:'',activo:false}];
          throw error;
        }
      })));
      return res.status(200).json({perfiles});
    }
    const {accion,periodo,salon,plaza,nombre,correo}=req.body||{};
    if(accion==='enlace'){
      try{
        // Se acepta únicamente para un UID ya asignado a una plaza real.
        const roles=(await db.ref('roles').get()).val();
        const uid=responsableAutorizadoParaEnlace(roles,{adminUid:usuario.uid,periodo,salon,plaza});
        const cuenta=await auth.getUser(uid);
        if(!cuenta?.email||cuenta.disabled)
          return res.status(409).json({error:'La cuenta no está activa o no tiene correo. Revisa el registro de responsables.'});
        const enlace=await auth.generatePasswordResetLink(cuenta.email);
        return res.status(200).json({correo:cuenta.email,nombre:cuenta.displayName||'',enlace});
      }catch(error){
        if(error?.code==='auth/operation-not-allowed')
          return res.status(409).json({error:'Activa Correo/Contraseña en Firebase Authentication para configurar las contraseñas.'});
        if(error?.code?.startsWith('auth/')){
          console.error('Enlace de responsable:',error.code);
          return res.status(409).json({error:'Firebase no pudo crear el enlace. Revisa el método de acceso Correo/Contraseña.'});
        }
        return res.status(403).json({error:error?.message||'No es posible generar el enlace de esta plaza.'});
      }
    }
    if(!['asignar','revocar'].includes(accion))return res.status(400).json({error:'Acción inválida.'});
    try{verificarDatosResponsable({periodo,salon,plaza,...(accion==='asignar'?{nombre,correo}:{})});}
    catch(error){return res.status(400).json({error:error.message});}

    // Una clase puede existir visualmente y aun así estar cerrada: diferenciar
    // claramente ambos estados antes de crear una cuenta en Firebase Auth.
    const [periodoSnap,salonSnap,rolesSnap]=await Promise.all([
      db.ref(`periodos/${periodo}/meta`).get(),
      db.ref(`periodos/${periodo}/salones/${salon}`).get(),
      db.ref('roles').get()
    ]);
    try{salonDisponibleResponsable(periodoSnap.val(),salonSnap.val());}
    catch(error){return res.status(409).json({error:error.message});}
    const rolesInicial=rolesSnap.val();
    if(rolesInicial?.adminGeneralUid!==usuario.uid)
      return res.status(403).json({error:'La cuenta ya no tiene permisos administrativos.'});
    if(accion==='asignar' && rolesInicial?.responsables?.[periodo]?.[salon]?.[plaza])
      return res.status(409).json({error:'Esta plaza ya tiene responsable. Revoca primero el acceso anterior.'});

    let persona,nueva=false;
    if(accion==='asignar'){
      const normalizado=correo.trim().toLowerCase();
      try{persona=await auth.getUserByEmail(normalizado);}
      catch(error){
        if(error?.code!=='auth/user-not-found')throw error;
        persona=await auth.createUser({email:normalizado,displayName:nombre.trim(),emailVerified:false});
        nueva=true;
      }
      if(persona.disabled)return res.status(409).json({error:'Esta cuenta está deshabilitada.'});
      if(persona.uid===usuario.uid)return res.status(409).json({
        error:'Ya utilizas esa cuenta como administrador general. Puedes administrar el 507 y los demás salones sin ocupar una plaza. Para invitar un responsable del 507, utiliza el correo de otra persona.'
      });
    }

    let motivo='La plaza fue modificada desde otra sesión. Actualiza y vuelve a intentarlo.';
    const args={accion,periodo,salon,plaza,uid:persona?.uid,adminUid:usuario.uid};
    const rolesRef=db.ref('roles');
    const resultado=await rolesRef.transaction(actual=>{
      try{
        // El SDK de Admin puede invocar primero el callback con null como
        // estado provisional. Usar la copia de roles obtenida del servidor
        // para la propuesta inicial, después recomprobar cada actualización.
        return proponerTransaccionRoles(actual,rolesInicial,args);
      }catch(error){motivo=error.message;return;}
    },undefined,false);
    if(!resultado.committed)return res.status(409).json({error:motivo});
    if(accion==='revocar')return res.status(200).json({ok:true,revocado:true});
    return res.status(200).json({ok:true,nueva,nombre:persona.displayName||nombre.trim(),correo:persona.email||correo.trim().toLowerCase()});
  }catch(error){
    console.error('Responsables:',error?.code||error?.message||'error');
    return res.status(500).json({error:'No se pudo gestionar el responsable. Consulta los registros del servidor.'});
  }
}
