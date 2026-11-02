import {useCallback,useEffect,useState} from 'react';
import {Check,LockKeyhole,RefreshCcw,ShieldCheck,X} from 'lucide-react';

const fecha=t=>t?new Intl.DateTimeFormat('es-MX',{dateStyle:'medium',timeStyle:'short',timeZone:'America/Mexico_City'}).format(new Date(t)):'';
export default function AccesosAdministracion({usuario}) {
  const [solicitudes,setSolicitudes]=useState([]);
  const [salones,setSalones]=useState([]);
  const [correcciones,setCorrecciones]=useState({});
  const [cargando,setCargando]=useState(true);
  const [ocupado,setOcupado]=useState('');
  const [error,setError]=useState('');
  const [mensaje,setMensaje]=useState('');
  const cargar=useCallback(async()=>{
    if(!usuario)return;
    setCargando(true);setError('');
    try{
      const token=await usuario.getIdToken();
      const [r,c]=await Promise.all([
        fetch('/api/accesos-salon',{headers:{Authorization:`Bearer ${token}`},cache:'no-store'}),
        fetch('/api/salones-disponibles',{cache:'no-store'})
      ]);
      const [a,b]=await Promise.all([r.json(),c.json()]);
      if(!r.ok)throw Error(a.error||'No se pudieron consultar las solicitudes.');
      if(!c.ok)throw Error(b.error||'No se pudieron consultar los salones.');
      setSolicitudes(a.solicitudes||[]);setSalones(b.salones||[]);
    }catch(e){setError(e.message);}
    finally{setCargando(false);}
  },[usuario]);
  useEffect(()=>{const t=setTimeout(()=>{void cargar();},0);return ()=>clearTimeout(t);},[cargar]);
  const actuar=async(s,accion)=>{
    if(ocupado)return;
    if(accion==='aprobar'&&!window.confirm(`¿Permitir a ${s.correo} consultar solamente el salón ${s.salon}?`))return;
    if(accion==='revocar'&&!window.confirm(`¿Revocar el acceso de ${s.correo}? Los pagos quedarán intactos.`))return;
    if(accion==='corregir'&&!window.confirm(`¿Corregir la solicitud de ${s.correo}? Solo el administrador puede hacerlo.`))return;
    setOcupado(s.uid);setError('');setMensaje('');
    try{
      const token=await usuario.getIdToken();
      const [periodo,salon]=(correcciones[s.uid]||`${s.periodo}/${s.salon}`).split('/');
      const r=await fetch('/api/accesos-salon',{method:'POST',
        headers:{'Content-Type':'application/json',Authorization:`Bearer ${token}`},
        body:JSON.stringify({accion,uid:s.uid,...(accion==='corregir'?{periodo,salon}:{})})});
      const b=await r.json().catch(()=>({}));
      if(!r.ok)throw Error(b.error||`HTTP ${r.status}`);
      setMensaje('Cambio guardado. Los movimientos y saldos permanecen intactos.');
      await cargar();
    }catch(e){setError(e.message);}
    finally{setOcupado('');}
  };
  const pendientes=solicitudes.filter(s=>s.estado==='pendiente');
  return <div className="ag-requests">
    <p className="ag-muted">Valida que cada cuenta pertenezca al grupo indicado antes de aprobarla. Una cuenta autorizada no puede elegir otro salón por sí sola.</p>
    <button type="button" className="ag-btn" disabled={cargando||!!ocupado} onClick={cargar}><RefreshCcw size={17}/> Actualizar solicitudes</button>
    {error&&<div className="ag-error">{error}</div>}
    {mensaje&&<div className="ag-note">{mensaje}</div>}
    <div className="ag-note"><ShieldCheck size={16}/> {pendientes.length} solicitud(es) pendientes · {solicitudes.filter(s=>s.lector).length} cuentas con acceso</div>
    {cargando?<p className="ag-muted">Cargando solicitudes…</p>:solicitudes.length===0?
      <p className="ag-muted">Todavía nadie ha solicitado acceso.</p>:
      <div className="ag-request-list">{solicitudes.map(s=>{
        const permitir=salones;
        const elegido=correcciones[s.uid]||`${s.periodo}/${s.salon}`;
        return <article className="ag-request" key={s.uid}>
          <div className="ag-request-head"><div><strong>{s.nombre||s.correo||'Cuenta sin nombre'}</strong>
            <small>{s.correo||'Sin correo'} {s.verificado?'· correo verificado':'· sin verificar'}</small></div>
            <span className="ag-status">{s.lector?'Autorizado':s.estado==='pendiente'?'Pendiente':s.estado==='rechazado'?'Rechazado':'Revocado'}</span>
          </div>
          <p>Solicitó <strong>salón {s.salon}</strong> · {s.periodo} · {fecha(s.creadoEn)}</p>
          {s.lector&&<p className="ag-muted"><LockKeyhole size={14}/> Acceso vigente: {s.lector.salon} · {s.lector.periodo}</p>}
          <div className="ag-access-actions">
            {!s.lector&&s.estado==='pendiente'&&<>
              <button type="button" className="ag-btn ag-btn-primary" disabled={!!ocupado||!s.verificado} onClick={()=>actuar(s,'aprobar')}><Check size={16}/> Aprobar</button>
              <button type="button" className="ag-btn" disabled={!!ocupado} onClick={()=>actuar(s,'rechazar')}><X size={16}/> Rechazar</button>
            </>}
            {s.lector&&<button type="button" className="ag-btn" disabled={!!ocupado} onClick={()=>actuar(s,'revocar')}><LockKeyhole size={16}/> Revocar acceso</button>}
          </div>
          {!s.lector&&<div className="ag-request-correction">
            <label>Corregir salón (solo administrador)
              <select value={elegido} onChange={e=>setCorrecciones({...correcciones,[s.uid]:e.target.value})}>
                {permitir.map(g=><option key={`${g.periodo}/${g.salon}`} value={`${g.periodo}/${g.salon}`}>{g.nombre||g.salon} · {g.periodo}</option>)}
              </select>
            </label>
            <button type="button" className="ag-btn" disabled={!!ocupado||!permitir.length} onClick={()=>actuar(s,'corregir')}>Guardar corrección</button>
          </div>}
        </article>;
      })}</div>}
  </div>;
}
