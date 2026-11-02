import {useEffect,useState} from 'react';
import {KeyRound,LockKeyhole,ShieldCheck,UsersRound} from 'lucide-react';
import './AccesoSalon.css';

// El backend devuelve únicamente identificadores de salón, nunca pagos ni datos personales.
const SALONES_DEMO=['107','307','507','707','907'].map(salon=>({
  periodo:'2026-2027-A',salon,nombre:`Salón ${salon}`
}));

export default function AccesoSalon({abrirLogin,ingresarConCodigo,ocupado,error,modoDemo}){
  const [salones,setSalones]=useState(modoDemo?SALONES_DEMO:[]);
  const [cargando,setCargando]=useState(!modoDemo);
  const [errorCatalogo,setErrorCatalogo]=useState('');
  const [seleccion,setSeleccion]=useState('');
  const [codigo,setCodigo]=useState('');

  useEffect(()=>{
    if(modoDemo)return;
    let vivo=true;
    fetch('/api/salones-disponibles',{cache:'no-store'})
      .then(async r=>{const d=await r.json();if(!r.ok)throw Error(d.error||'No se pudo consultar los salones.');return d;})
      .then(d=>{if(vivo){setSalones(d.salones||[]);setCargando(false);}})
      .catch(e=>{if(vivo){setCargando(false);setErrorCatalogo(e.message);}});
    return ()=>{vivo=false;};
  },[modoDemo]);

  const seleccionado=salones.find(s=>`${s.periodo}/${s.salon}`===seleccion);
  const normalizado=codigo.replace(/[\s-]/g,'').toUpperCase();

  const enviar=e=>{
    e.preventDefault();
    if(seleccionado&&normalizado.length===16&&!ocupado){
      void ingresarConCodigo({...seleccionado,codigo:normalizado});
    }
  };
  return <main className="ag-main">
    <section className="ag-panel ag-access-shell">
      <div className="ag-access-intro">
        <span className="ag-access-icon"><ShieldCheck size={28}/></span>
        <h1>Tu salón, tu espacio</h1>
        <p>Consulta las aportaciones de tu grupo con un código de acceso. No necesitas correo ni contraseña.</p>
      </div>
      <h2 className="ag-access-subtitle">1. Selecciona tu salón</h2>
      <p className="ag-muted">Elige el grupo al que perteneces.</p>
      {errorCatalogo&&<div className="ag-error">{errorCatalogo}</div>}
      {cargando?<p className="ag-muted">Consultando salones disponibles…</p>:
        <div className="ag-access-rooms">
          {salones.map(s=><button type="button" key={`${s.periodo}/${s.salon}`}
            className={seleccion===`${s.periodo}/${s.salon}`?'active':''}
            onClick={()=>{setSeleccion(`${s.periodo}/${s.salon}`);setCodigo('');}}
            aria-pressed={seleccion===`${s.periodo}/${s.salon}`}>
            <UsersRound size={19}/><strong>{s.salon}</strong><small>{s.periodo}</small>
          </button>)}
        </div>}
      <form className="ag-access-code-form" onSubmit={enviar}>
        <h2 className="ag-access-subtitle">2. Introduce el código de tu salón</h2>
        <p className="ag-muted">Pídelo al responsable o al administrador general. El código es diferente en cada salón.</p>
        <label className="ag-access-code-label">
          <span><KeyRound size={18}/> Código de acceso {seleccionado?`· salón ${seleccionado.salon}`:''}</span>
          <input type="text" autoComplete="one-time-code" autoCapitalize="characters"
            spellCheck={false} placeholder="XXXX-XXXX-XXXX-XXXX"
            value={codigo} onChange={e=>setCodigo(e.target.value.toUpperCase().slice(0,28))}
            maxLength={28} disabled={!seleccionado||ocupado} required/>
        </label>
        <button type="submit" className="ag-btn ag-btn-primary ag-access-code-submit"
          disabled={!seleccionado||normalizado.length!==16||ocupado}>
          <LockKeyhole size={19}/> {ocupado?'Comprobando código…':`Entrar al salón ${seleccionado?.salon||''}`}
        </button>
      </form>
      {error&&<div className="ag-error" role="alert">{error}</div>}
      <div className="ag-access-privacy">
        <LockKeyhole size={17}/>
        <span>Este código permite consultar únicamente el salón elegido y su aportación al fondo común. No permite registrar, modificar ni eliminar pagos. No compartas el código con otros grupos.</span>
      </div>
      <button type="button" className="ag-link ag-access-admin-link" onClick={abrirLogin}>
        ¿Eres administrador o responsable? Iniciar sesión
      </button>
    </section>
  </main>;
}
