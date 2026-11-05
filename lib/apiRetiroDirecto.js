import {adminDatabase,permisoAdministrador,usuarioVerificado} from './adminServidor.js';
import {isClassCode,isPeriodId} from './aulas.js';
import {corteActivo,rutaRetiros} from './reinicioContable.js';
import {saldoRetirableSalon,crearRetiroDirecto} from './retiroDirecto.js';
import {publicarAvisoRetiro} from './avisosCarrera.js';

export async function atenderRetiroDirecto(req,res) {
  const {periodo,salon,monto,fondo,retiroId}=req.body||{};
  if(!isPeriodId(periodo)||!isClassCode(salon)
    ||!Number.isSafeInteger(monto)||monto<1||monto>1_000_000
    ||!['grupo','carrera'].includes(fondo)
    ||typeof retiroId!=='string'||!/^[A-Za-z0-9_-]{10,128}$/.test(retiroId))
    return res.status(400).json({error:'Selecciona un fondo y escribe un importe entero positivo.'});
  try{
    const usuario=await usuarioVerificado(req);
    if(!usuario)return res.status(401).json({error:'Sesión no válida.'});
    const db=adminDatabase();
    const permiso=await permisoAdministrador(db,usuario.uid,periodo,salon);
    if(!permiso)return res.status(403).json({error:'Solo un responsable autorizado puede retirar dinero de su salón.'});
    const periodos=(await db.ref('periodos').get()).val()||{};
    if(!periodos[periodo]?.meta || periodos[periodo].meta.cerradoEn)
      return res.status(409).json({error:'Este ciclo está cerrado o no existe.'});
    if(!corteActivo(periodos))
      return res.status(409).json({error:'Antes de retirar dinero es necesario activar el saldo del ahorro vigente.'});
    const nodo=rutaRetiros(periodos,periodo);
    const referencia=db.ref('aulas');
    const [inicialSnap,extrasSnap]=await Promise.all([referencia.get(),db.ref('ahorro/ingresosExtras').get()]);
    const inicial=inicialSnap.val()||{},ingresosExtras=extrasSnap.val()||{};
    let causa='Saldo insuficiente o movimiento modificado desde otra sesión.';
    const tx=await referencia.transaction(actual=>{
      try{
        const aulas=structuredClone(actual==null?inicial:actual);
        const aula=aulas?.[periodo]?.[salon];
        if(!aula?.meta){causa='No existe este salón.';return;}
        const retiros=aula[nodo]||={};
        if(retiros[retiroId]){causa='Este movimiento ya está registrado.';return;}
        const saldo=saldoRetirableSalon(aulas,periodos,periodo,salon,fondo,ingresosExtras);
        if(monto>saldo.disponible){
          causa=`No hay saldo suficiente en el fondo seleccionado. Disponible: $${saldo.disponible}.`;
          return;
        }
        retiros[retiroId]=crearRetiroDirecto({uid:usuario.uid,monto,fondo,ahora:Date.now()});
        return aulas;
      }catch(error){causa=error.message;return;}
    },undefined,false);
    const publicar=async(retiro)=>{
      if(fondo!=='carrera')return {avisoPublicado:false};
      try{
        await publicarAvisoRetiro(db,{periodo,salon,retiroId,monto,fecha:retiro?.respondidoEn||Date.now()});
        return {avisoPublicado:true};
      }catch(error){
        console.error('Retiro aprobado, pero falló la publicación del aviso:',error?.code||'error');
        return {avisoPublicado:false};
      }
    };
    if(!tx.committed){
      const actual=(await db.ref(`aulas/${periodo}/${salon}/${nodo}/${retiroId}`).get()).val();
      if(actual?.tipo==='directo'&&actual.estado==='aprobado'&&actual.solicitadoPor===usuario.uid
        &&actual.monto===monto&&actual.fondo===fondo)
        return res.status(200).json({ok:true,idempotente:true,retiroId,monto,fondo,...await publicar(actual)});
      return res.status(409).json({error:causa});
    }
    const guardado=tx.snapshot.val()?.[periodo]?.[salon]?.[nodo]?.[retiroId];
    return res.status(200).json({ok:true,retiroId,monto,fondo,...await publicar(guardado)});
  }catch(error){
    console.error('Retiro inmediato por salón:',error?.code||error?.message||'error');
    return res.status(500).json({error:'No se pudo completar el retiro. No repitas la operación sin comprobar el historial.'});
  }
}
