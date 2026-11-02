import {adminDatabase} from '../lib/adminServidor.js';

// Únicamente nombres de salones activos; nunca estudiantes, pagos ni saldos.
export default async function handler(req,res){
  res.setHeader('Cache-Control','no-store');
  if(req.method!=='GET')return res.status(405).json({error:'Método no permitido.'});
  try{
    const periodos=(await adminDatabase().ref('periodos').get()).val()||{};
    const disponibles=Object.entries(periodos)
      .filter(([,p])=>p?.meta && !p.meta.cerradoEn)
      .flatMap(([periodo,p])=>Object.entries(p.salones||{}).map(([salon,v])=>({
        periodo,salon,nombre:typeof v?.nombre==='string'?v.nombre:`Salón ${salon}`
      })))
      .sort((a,b)=>a.periodo.localeCompare(b.periodo)||a.salon.localeCompare(b.salon,'es',{numeric:true}));
    return res.status(200).json({salones:disponibles});
  }catch(error){
    console.error('Catálogo de salones:',error?.code||error?.message||'error');
    return res.status(500).json({error:'No fue posible consultar los salones activos.'});
  }
}
