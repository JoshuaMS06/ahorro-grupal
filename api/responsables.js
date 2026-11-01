import {adminAuth,adminDatabase,usuarioVerificado} from '../lib/adminServidor.js';
import {verificarDatosResponsable,modificarPlazaRaiz} from '../lib/gestionarResponsables.js';

// Solo el administrador general. Nunca se entregan UIDs para introducir a mano.
export default async function handler(req,res){
  res.setHeader('Cache-Control','no-store');
  if(!['GET','POST'].includes(req.method))return res.status(405).json({error:'Método no permitido.'});
  if(!/^Bearer \S+$/.test(req.headers.authorization||''))return res.status(401).json({error:'Inicia sesión como administrador general.'});
  try{
    const usuario=await usuarioVerificado(req);
    if(!usuario)return res.status(401).json({error:'Sesión no válida.'});
    const db=adminDatabase();
    const auth=adminAuth();
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
    if(!['asignar','revocar'].includes(accion))return res.status(400).json({error:'Acción inválida.'});
    try{verificarDatosResponsable({periodo,salon,plaza,...(accion==='asignar'?{nombre,correo}:{})});}
    catch(error){return res.status(400).json({error:error.message});}
    const actual=(await db.ref('/').get()).val();
    if(!actual?.periodos?.[periodo]?.salones?.[salon]||actual.periodos[periodo].meta?.cerradoEn)
      return res.status(409).json({error:'Salón inexistente o semestre cerrado.'});
    if(accion==='asignar'){
      const normalizado=correo.trim().toLowerCase();
      // No creamos cuentas si la plaza ya está ocupada.
      const ocupado=actual.roles?.responsables?.[periodo]?.[salon]?.[plaza];
      if(ocupado)return res.status(409).json({error:'Esta plaza ya tiene responsable. Revoca primero el acceso anterior.'});
      let persona,nueva=false;
      try{persona=await auth.getUserByEmail(normalizado);}
      catch(error){
        if(error?.code!=='auth/user-not-found')throw error;
        persona=await auth.createUser({email:normalizado,displayName:nombre.trim(),emailVerified:false});
        nueva=true;
      }
      if(persona.disabled)return res.status(409).json({error:'Esta cuenta está deshabilitada.'});
      if(persona.uid===usuario.uid)return res.status(409).json({error:'El administrador general no puede ser responsable.'});
      let motivo='La plaza ha cambiado. Actualiza la pantalla.';
      const r=await db.ref('/').transaction(raiz=>{
        try{return modificarPlazaRaiz(raiz,{accion,periodo,salon,plaza,uid:persona.uid,adminUid:usuario.uid});}
        catch(error){motivo=error.message;return;}
      },undefined,false);
      if(!r.committed)return res.status(409).json({error:motivo});
      return res.status(200).json({ok:true,nueva,nombre:persona.displayName||nombre.trim(),correo:persona.email||normalizado});
    }
    let motivo='La plaza ha cambiado. Actualiza la pantalla.';
    const r=await db.ref('/').transaction(raiz=>{
      try{return modificarPlazaRaiz(raiz,{accion,periodo,salon,plaza,adminUid:usuario.uid});}
      catch(error){motivo=error.message;return;}
    },undefined,false);
    if(!r.committed)return res.status(409).json({error:motivo});
    return res.status(200).json({ok:true,revocado:true});
  }catch(error){
    console.error('Responsables:',error?.code||error?.message||'error');
    return res.status(500).json({error:'No se pudo gestionar el responsable. Consulta los registros del servidor.'});
  }
}
