import {adminDatabase,usuarioVerificado} from './adminServidor.js';
import {isPeriodId} from './aulas.js';
import {corteActivo} from './reinicioContable.js';
import {crearIngresoExtra} from './ingresosExtras.js';

export async function atenderIngresoExtra(req,res) {
  const {periodo,monto,ingresoId}=req.body||{};
  if(!isPeriodId(periodo)||!Number.isSafeInteger(monto)||monto<1||monto>1_000_000
    ||typeof ingresoId!=='string'||!/^[A-Za-z0-9_-]{10,128}$/.test(ingresoId))
    return res.status(400).json({error:'Escribe un importe válido para el fondo general.'});
  try{
    const usuario=await usuarioVerificado(req);
    if(!usuario)return res.status(401).json({error:'Sesión no válida.'});
    const db=adminDatabase();
    if((await db.ref('roles/adminGeneralUid').get()).val()!==usuario.uid)
      return res.status(403).json({error:'Solo el administrador general puede añadir ingresos extraordinarios.'});
    const meta=(await db.ref('periodos').get()).val()||{};
    if(!meta[periodo]?.meta || meta[periodo].meta.cerradoEn)
      return res.status(409).json({error:'El ciclo seleccionado no está activo.'});
    if(!corteActivo(meta))
      return res.status(409).json({error:'El libro de ahorro vigente todavía no está activado.'});
    const ahora=Date.now();
    const extra=crearIngresoExtra({uid:usuario.uid,monto,periodo,ahora});
    const refExtra=db.ref(`ahorro/ingresosExtras/${periodo}/${ingresoId}`);
    const tx=await refExtra.transaction(actual=>actual ? undefined : extra,undefined,false);
    if(!tx.committed){
      const previo=(await refExtra.get()).val();
      if(previo?.tipo==='ingresoExtra'&&previo.registradoPor===usuario.uid
        &&previo.monto===monto&&previo.estado==='confirmado'){
        // Reintento de una solicitud que pudo guardarse antes de perder la
        // conexión: NO volver a sumar, pero sí reintentar propagar el saldo.
        let actualizadoEnVivo=true;
        try{await db.ref(`periodos/${periodo}/meta/ultimaActualizacionFondo`).set(Date.now());}
        catch(error){
          console.error('No se pudo reenviar actualización de saldo:',error?.code||'error');
          actualizadoEnVivo=false;
        }
        return res.status(200).json({ok:true,ingresoId,monto,idempotente:true,actualizadoEnVivo});
      }
      return res.status(409).json({error:'Este ingreso ya estaba registrado o cambió desde otra sesión.'});
    }
    // El marcador no contiene monto ni UID y refresca el saldo en los móviles
    // conectados al metadato del ciclo. La transacción del ingreso ya es definitiva.
    let actualizadoEnVivo=true;
    try{
      await db.ref(`periodos/${periodo}/meta/ultimaActualizacionFondo`).set(ahora);
    }catch(error){
      console.error('Ingreso extra registrado, pero no se propagó el refresco:',error?.code||'error');
      actualizadoEnVivo=false;
    }
    return res.status(200).json({ok:true,ingresoId,monto,actualizadoEnVivo});
  }catch(error){
    console.error('Error en ingreso extraordinario:',error?.code||error?.message||'error');
    return res.status(500).json({error:'No se pudo registrar el ingreso extraordinario. Comprueba el saldo antes de repetir.'});
  }
}
