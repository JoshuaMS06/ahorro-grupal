import {adminDatabase,usuarioVerificado,permisoAdministrador} from '../lib/adminServidor.js';
import {resumirFondos,generacionDeAula} from '../lib/fondos.js';
import {corteActivo,resumirAhorroReiniciado} from '../lib/reinicioContable.js';
import {informeVisibleSegunRol} from '../lib/informeRoles.js';
import {isClassCode,isPeriodId} from '../lib/aulas.js';
import {sesionCodigoValida} from '../lib/codigosSalon.js';

export default async function handler(req,res){
  res.setHeader('Cache-Control','no-store');
  if(req.method!=='GET')return res.status(405).json({error:'Método no permitido.'});
  const periodo=typeof req.query?.periodo==='string'?req.query.periodo:'';
  const salon=typeof req.query?.salon==='string'?req.query.salon:'';
  if(!isPeriodId(periodo)||!isClassCode(salon))return res.status(400).json({error:'Selección inválida.'});
  if(!/^Bearer \S+$/.test(req.headers.authorization||''))return res.status(401).json({error:'Inicia sesión.'});
  try {
    const usuario=await usuarioVerificado(req);
    if(!usuario)return res.status(401).json({error:'Sesión no válida.'});
    const db=adminDatabase();
    const permiso=await permisoAdministrador(db,usuario.uid,periodo,salon);
    const lector=(await db.ref(`roles/lectores/${usuario.uid}`).get()).val();
    // El token firmado autoriza exclusivamente al salón y a la versión
    // del código vigente; un cambio de código revoca también este endpoint.
    const verCodigo=usuario.rolSalon==='consulta' && usuario.periodoCodigo===periodo && usuario.salonCodigo===salon;
    const version=verCodigo?(await db.ref(`codigosSalon/${periodo}/${salon}/version`).get()).val():null;
    const accesoCodigo=sesionCodigoValida(usuario,periodo,salon,version)?{tipo:'lector'}:null;
    const acceso=permiso||(lector?.periodo===periodo && lector?.salon===salon ? {tipo:'lector'} : null)||accesoCodigo;
    if(!acceso)return res.status(403).json({error:'Sin permiso para ese salón.'});
    const [todas,periodosSnap]=await Promise.all([
      db.ref('aulas').get(),db.ref('periodos').get(),
    ]);
    const aulas=todas.val()||{};
    const objetivo=aulas?.[periodo]?.[salon];
    if(!objetivo)return res.status(404).json({error:'Salón no encontrado.'});
    const periodos=periodosSnap.val()||{};
    if(periodo==='2026-2027-A'&&!corteActivo(periodos))
      return res.status(409).json({error:'El saldo nuevo aún no está activado. No se mostrará el saldo histórico como actual.'});
    const resumen=corteActivo(periodos)
      ?resumirAhorroReiniciado(aulas,periodos)
      :resumirFondos(aulas,(await db.ref('ahorro/integrantes').get()).val()||{});
    const generacionId=generacionDeAula(periodo,salon,objetivo.meta);
    // Solo se entrega el saldo de la carrera; los registros históricos sin conciliar quedan fuera de la respuesta.
    return res.status(200).json(informeVisibleSegunRol(resumen,acceso,generacionId));
  }catch(error){
    console.error('No se pudo calcular el informe de carrera:',error?.code||error?.message||'error');
    return res.status(500).json({error:'No se pudo consultar el informe de fondos.'});
  }
}
