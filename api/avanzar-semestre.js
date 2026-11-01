import {adminDatabase, usuarioVerificado} from '../lib/adminServidor.js';
import {prepararCambioInmediato} from '../lib/avanceInmediato.js';
import {esConfirmacionValida} from '../lib/vacaciones.js';

// Sólo el administrador general puede efectuar el cambio. No hay cron, fecha
// futura ni escritura directa desde el navegador. La fecha la fija el servidor.
export default async function handler(req,res) {
  res.setHeader('Cache-Control','no-store');
  if(req.method!=='POST')return res.status(405).json({error:'Método no permitido.'});
  const {periodo,confirmacion}=req.body||{};
  if(!esConfirmacionValida(confirmacion))
    return res.status(400).json({error:'Debes escribir exactamente CONFIRMAR.'});
  if(typeof periodo!=='string'||!/^\d{4}-\d{4}-[AB]$/.test(periodo))
    return res.status(400).json({error:'Semestre inválido.'});
  if(!/^Bearer \S+$/.test(req.headers.authorization||''))
    return res.status(401).json({error:'Debes iniciar sesión como administrador general.'});
  try {
    const usuario=await usuarioVerificado(req);
    if(!usuario)return res.status(401).json({error:'Sesión no válida.'});
    const db=adminDatabase();
    const general=await db.ref('roles/adminGeneralUid').get();
    if(general.val()!==usuario.uid)return res.status(403).json({error:'Solo el administrador general puede cambiar el semestre.'});
    const cuando=Date.now();
    let detalles=null;
    let motivo='El semestre ya fue cambiado o se produjo un conflicto.';
    // Una sola transacción mantiene estudiantes, roles y periodos sincronizados
    // si coinciden otros movimientos o se reciben dos solicitudes simultáneas.
    const resultado=await db.ref('/').transaction(actual=>{
      detalles=null;
      if(actual?.roles?.adminGeneralUid!==usuario.uid){motivo='Tu cuenta ya no es administradora general.';return;}
      try {
        const transformacion=prepararCambioInmediato(actual,periodo,cuando);
        detalles=transformacion.detalles;
        return transformacion.raiz;
      } catch(error) {motivo=error.message;return;}
    },undefined,false);
    if(!resultado.committed)return res.status(409).json({error:motivo});
    return res.status(200).json({ok:true,...detalles});
  } catch(error) {
    console.error('Cambio semestral:',error?.code||error?.message||'error');
    return res.status(500).json({error:'No se pudo completar el cambio. No lo repitas sin consultar los registros del servidor.'});
  }
}
