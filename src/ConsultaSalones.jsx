import {useCallback,useEffect,useState} from 'react';
import {Landmark,RefreshCcw,ShieldCheck,UsersRound} from 'lucide-react';
import './ConsultaSalones.css';

const pesos=m=>new Intl.NumberFormat('es-MX',{style:'currency',currency:'MXN',maximumFractionDigits:0}).format(Number(m)||0);

export default function ConsultaSalones({usuario,periodoId,salonActual}){
  const [datos,setDatos]=useState(null);
  const [cargando,setCargando]=useState(true);
  const [error,setError]=useState('');
  const cargar=useCallback(async()=>{
    if(!usuario||!periodoId)return;
    setCargando(true);setError('');
    try{
      const token=await usuario.getIdToken();
      const url=`/api/consulta-salones?periodo=${encodeURIComponent(periodoId)}`;
      const respuesta=await fetch(url,{headers:{Authorization:`Bearer ${token}`},cache:'no-store'});
      const info=await respuesta.json().catch(()=>({}));
      if(!respuesta.ok)throw Error(info.error||`HTTP ${respuesta.status}`);
      setDatos(info);
    }catch(e){setError(e.message);setDatos(null);}
    finally{setCargando(false);}
  },[usuario,periodoId]);
  useEffect(()=>{const id=setTimeout(()=>{void cargar();},0);return ()=>clearTimeout(id);},[cargar]);
  return <section className="ag-consulta">
    <p className="ag-muted">Aquí los responsables pueden consultar cuánto ha aportado cada salón al <strong>fondo común de Ingeniería Industrial</strong>. No es posible editar pagos ni cambiar de salón desde esta vista.</p>
    <button type="button" className="ag-btn" onClick={cargar} disabled={cargando}><RefreshCcw size={17}/> Actualizar importes</button>
    {error&&<div className="ag-error" role="alert">{error}</div>}
    {cargando?<p className="ag-muted">Consultando aportaciones…</p>:datos&&<>
      {datos.cifrasConfiables?
      <div className="ag-consulta-general">
        <Landmark size={25}/>
        <div><small>Saldo disponible del fondo común de la carrera</small><strong>{pesos(datos.totalCarrera)}</strong></div>
      </div>:
      <div className="ag-note">El fondo común contiene retiros pendientes de clasificación. Su saldo no se mostrará hasta conciliarse.</div>}
      <div className="ag-consulta-grid">
        {datos.salones.map(s=><article className="ag-consulta-room" key={s.salon}>
          <div className="ag-consulta-room-title"><UsersRound size={21}/>
            <strong>{s.nombre}</strong>{s.salon===salonActual&&<small>Tu salón</small>}
          </div>
          <small>Aportación acumulada al fondo común</small>
          <strong className="ag-consulta-number">{pesos(s.aportacionCarrera)}</strong>
          {s.salon==='507'&&<small>Solo se incluye el dinero destinado a la carrera, no su ahorro privado.</small>}
        </article>)}
      </div>
      <div className="ag-access-privacy"><ShieldCheck size={17}/>
        <span>Esta consulta muestra totales agregados del fondo común. No entrega datos individuales, pagos históricos, ahorro privado del 507 ni cuentas de profesores.</span>
      </div>
    </>}
  </section>;
}
