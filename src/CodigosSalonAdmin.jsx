import {useCallback,useEffect,useState} from 'react';
import {Check,Copy,KeyRound,RefreshCcw,RotateCcw,ShieldCheck} from 'lucide-react';
import './AccesoSalon.css';

export default function CodigosSalonAdmin({usuario}){
  const [salones,setSalones]=useState([]);
  const [cargando,setCargando]=useState(true);
  const [ocupado,setOcupado]=useState('');
  const [error,setError]=useState('');
  const [mensaje,setMensaje]=useState('');
  const [revelado,setRevelado]=useState(null);
  const [copiado,setCopiado]=useState(false);

  const cargar=useCallback(async()=>{
    if(!usuario)return;
    setCargando(true);setError('');
    try{
      const token=await usuario.getIdToken();
      const r=await fetch('/api/codigos-salon',{headers:{Authorization:`Bearer ${token}`},cache:'no-store'});
      const d=await r.json().catch(()=>({}));
      if(!r.ok)throw Error(d.error||`HTTP ${r.status}`);
      setSalones(d.salones||[]);
    }catch(e){setError(e.message);}
    finally{setCargando(false);}
  },[usuario]);
  useEffect(()=>{const id=setTimeout(()=>{void cargar();},0);return ()=>clearTimeout(id);},[cargar]);

  const generar=async(s)=>{
    if(ocupado)return;
    const accion=s.configurado?'rotar':'crear';
    if(accion==='rotar'&&!window.confirm(`¿Cambiar el código del salón ${s.salon}? El anterior dejará de autorizar nuevas consultas. Debes compartir el nuevo código con el grupo.`))return;
    setOcupado(`${s.periodo}/${s.salon}`);setError('');setMensaje('');setRevelado(null);setCopiado(false);
    try{
      const token=await usuario.getIdToken();
      const r=await fetch('/api/codigos-salon',{
        method:'POST',headers:{'Content-Type':'application/json',Authorization:`Bearer ${token}`},
        body:JSON.stringify({periodo:s.periodo,salon:s.salon,accion})
      });
      const d=await r.json().catch(()=>({}));
      if(!r.ok)throw Error(d.error||`HTTP ${r.status}`);
      setRevelado({periodo:s.periodo,salon:s.salon,codigo:d.codigo});
      setMensaje('PIN generado. Puedes consultarlo nuevamente con Ver PIN.');
      await cargar();
    }catch(e){setError(e.message);}
    finally{setOcupado('');}
  };
  const verCodigo=async(s)=>{
    if(ocupado)return;
    setOcupado(`${s.periodo}/${s.salon}`);setError('');setMensaje('');setRevelado(null);setCopiado(false);
    try{
      const token=await usuario.getIdToken();
      const qs=new URLSearchParams({accion:'ver',periodo:s.periodo,salon:s.salon});
      const r=await fetch(`/api/codigos-salon?${qs}`,{
        headers:{Authorization:`Bearer ${token}`},cache:'no-store'
      });
      const d=await r.json().catch(()=>({}));
      if(!r.ok)throw Error(d.error||`HTTP ${r.status}`);
      setRevelado({periodo:s.periodo,salon:s.salon,codigo:d.codigo});
      setMensaje('PIN consultado. Puedes volver a verlo cuando lo necesites.');
    }catch(e){setError(e.message);}
    finally{setOcupado('');}
  };
  const copiar=async()=>{
    if(!revelado)return;
    try{await navigator.clipboard.writeText(revelado.codigo);setCopiado(true);}
    catch{setError('No se pudo copiar automáticamente. Selecciona el código y cópialo manualmente.');}
  };
  return <div className="ag-codes-admin">
    <p className="ag-muted">Genera un PIN aleatorio de 4 dígitos por salón. Los estudiantes lo usan sin registrarse y solo pueden consultar su grupo. Los códigos largos que ya compartiste seguirán funcionando hasta que los cambies. Si un PIN se difunde fuera del salón, renuévalo. Los responsables conservan sus cuentas.</p>
    <button type="button" className="ag-btn" onClick={cargar} disabled={cargando||!!ocupado}>
      <RefreshCcw size={17}/> Actualizar salones
    </button>
    {error&&<div className="ag-error" role="alert">{error}</div>}
    {mensaje&&<div className="ag-note">{mensaje}</div>}
    {revelado&&<div className="ag-code-reveal" role="status">
      <div><KeyRound size={23}/><strong>PIN del salón {revelado.salon}</strong></div>
      <p>Compártelo solamente con integrantes del salón {revelado.salon}. Podrás volver a verlo desde este panel.</p>
      <code>{revelado.codigo}</code>
      <div className="ag-access-actions">
        <button type="button" className="ag-btn ag-btn-primary" onClick={copiar}>
          {copiado?<Check size={17}/>:<Copy size={17}/>} {copiado?'Copiado':'Copiar código'}
        </button>
        <button type="button" className="ag-btn" onClick={()=>{setRevelado(null);setCopiado(false);}}>Ocultar código</button>
      </div>
    </div>}
    {cargando?<p className="ag-muted">Cargando salones…</p>:
      <div className="ag-codes-list">
        {salones.map(s=><article key={`${s.periodo}/${s.salon}`} className="ag-code-card">
          <div className="ag-code-info">
            <strong>Salón {s.salon}</strong>
            <small>{s.periodo}</small>
            <span>{s.configurado?'Código activo · solo lectura':'Sin código: los estudiantes todavía no pueden entrar'}</span>
          </div>
          <div className="ag-access-actions">
          {s.configurado&&<button type="button" className="ag-btn" disabled={!!ocupado}
            onClick={()=>verCodigo(s)}><KeyRound size={17}/> Ver PIN</button>}
          <button type="button" className="ag-btn ag-btn-primary" disabled={!!ocupado}
            onClick={()=>generar(s)}>
            {s.configurado?<RotateCcw size={17}/>:<KeyRound size={17}/>}
            {s.configurado?'Cambiar código':'Generar código'}
          </button>
          </div>
        </article>)}
        {salones.length===0&&<p className="ag-muted">No hay salones activos en este momento.</p>}
      </div>}
    <div className="ag-access-privacy"><ShieldCheck size={18}/>
      <span>Un código compartido puede reenviarse a otras personas. Cambiarlo revoca el acceso asociado a la versión anterior, pero no puede impedir que alguien haya guardado información previamente consultada.</span>
    </div>
  </div>;
}
