import {adminDatabase,usuarioVerificado,permisoAdministrador} from '../lib/adminServidor.js';
import {resumirAhorroReiniciado,corteActivo} from '../lib/reinicioContable.js';
import {resumirFondos} from '../lib/fondos.js';
import {informeCompartidoDeSalones} from '../lib/consultaSalones.js';
import {isPeriodId} from '../lib/aulas.js';

// Vista común de CONSULTA para responsables autorizados y administrador
// general. Jamás devuelve saldos privados del 507 ni detalles de alumnos.
export default async function handler(req,res){
  res.setHeader('Cache-Control','no-store');
  if(req.method!=='GET')return res.status(405).json({error:'Método no permitido.'});
  const periodo=typeof req.query?.periodo==='string'?req.query.periodo:'';
  if(!isPeriodId(periodo))return res.status(400).json({error:'Ciclo escolar inválido.'});
  if(!/^Bearer \S+$/.test(req.headers.authorization||''))
    return res.status(401).json({error:'Inicia sesión con una cuenta administrativa.'});
  try{
    const usuario=await usuarioVerificado(req);
    if(!usuario)return res.status(401).json({error:'Sesión no válida.'});
    const db=adminDatabase();
    const asignacion=(await db.ref(`roles/porUsuario/${usuario.uid}`).get()).val();
    // Valida la plaza REAL en roles/responsables. Un lector o estudiante con
    // PIN no puede obtener esta vista incluso aunque conozca otro salón.
    const permiso=await permisoAdministrador(db,usuario.uid,periodo,asignacion?.salon||'');
    if(!permiso||!['general','responsable'].includes(permiso.tipo))
      return res.status(403).json({error:'Solo responsables autorizados y el administrador general pueden consultar otros grupos.'});
    const [aulasSnap,periodosSnap]=await Promise.all([
      db.ref('aulas').get(),db.ref('periodos').get()
    ]);
    const aulas=aulasSnap.val()||{},periodos=periodosSnap.val()||{};
    if(!periodos[periodo]?.salones)return res.status(404).json({error:'Ciclo no encontrado.'});
    if(periodo==='2026-2027-A'&&!corteActivo(periodos))
      return res.status(409).json({error:'El ahorro nuevo aún no está activado; no se mostrarán saldos históricos como actuales.'});
    const resumen=corteActivo(periodos)
      ?resumirAhorroReiniciado(aulas,periodos,(await db.ref('ahorro/ingresosExtras').get()).val()||{})
      :resumirFondos(aulas,(await db.ref('ahorro/integrantes').get()).val()||{});
    return res.status(200).json(informeCompartidoDeSalones({aulas,periodos,periodo,resumen}));
  }catch(error){
    console.error('Consulta entre salones:',error?.code||error?.message||'error');
    return res.status(500).json({error:'No fue posible consultar los aportes entre salones.'});
  }
}
