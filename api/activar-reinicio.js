import {adminDatabase, usuarioVerificado} from '../lib/adminServidor.js';
import {diagnosticarActivacion, prepararActivacionSegura} from '../lib/activacionSegura.js';
import {esConfirmacionValida} from '../lib/vacaciones.js';

// GET: revisión sin cambios. POST: escritura atómica y UNICA, con doble confirmación.
// La transacción conserva los demás nodos y añade únicamente el marcador contable.
export default async function handler(req,res) {
  res.setHeader('Cache-Control','no-store');
  if(!['GET','POST'].includes(req.method))return res.status(405).json({error:'Método no permitido.'});
  if(!/^Bearer \S+$/.test(req.headers.authorization||''))
    return res.status(401).json({error:'Inicia sesión como administrador general.'});
  if(req.method==='POST' && (!esConfirmacionValida(req.body?.confirmacion)||req.body?.respaldoConfirmado!==true))
    return res.status(400).json({error:'Se exige respaldo guardado y escribir exactamente CONFIRMAR.'});
  try {
    const user=await usuarioVerificado(req);
    if(!user)return res.status(401).json({error:'Sesión no válida.'});
    const db=adminDatabase();
    if((await db.ref('roles/adminGeneralUid').get()).val()!==user.uid)
      return res.status(403).json({error:'Solo el administrador general puede activar el ahorro.'});
    if(req.method==='GET'){
      const raiz=(await db.ref('/').get()).val();
      try {return res.status(200).json({listo:true,diagnostico:diagnosticarActivacion(raiz)});}
      catch(error){return res.status(409).json({listo:false,error:error.message});}
    }
    const instante=Date.now();
    let motivo='El estado cambió; consulta de nuevo la revisión antes de activar.';
    let resumen=null;
    const tx=await db.ref('/').transaction(raiz=>{
      resumen=null;
      try {
        const preparado=prepararActivacionSegura(raiz,user.uid,instante);
        resumen=preparado.diagnostico;
        return preparado.raiz;
      } catch(error) {motivo=error.message;return;}
    },undefined,false);
    if(!tx.committed)return res.status(409).json({error:motivo});
    return res.status(200).json({ok:true,activadoEn:instante,...resumen});
  }catch(error){
    console.error('Activación contable:',error?.code||error?.message||'error');
    return res.status(500).json({error:'No fue posible activar el nuevo ahorro. Consulta los registros del servidor.'});
  }
}
