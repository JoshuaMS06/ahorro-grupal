import {useEffect,useState} from 'react';
import {KeyRound,LockKeyhole,ShieldCheck,UsersRound} from 'lucide-react';
import './AccesoSalon.css';

// El backend devuelve únicamente identificadores de salón, nunca pagos ni datos personales.
const SALONES_DEMO=['107','307','507','707','907'].map(salon=>({
  periodo:'2026-2027-A',salon,nombre:`Salón ${salon}`
}));

export default function AccesoSalon({abrirLogin,ingresarConCodigo,ocupado,error,modoDemo,sinConexion=false}){
  const [salones,setSalones]=useState(modoDemo?SALONES_DEMO:[]);
  const [cargando,setCargando]=useState(!modoDemo&&!sinConexion);
  const [errorCatalogo,setErrorCatalogo]=useState('');
  const [seleccion,setSeleccion]=useState('');
  const [codigo,setCodigo]=useState('');

  useEffect(()=>{
    if(modoDemo||sinConexion){if(sinConexion)setCargando(false);return;}
    let vivo=true;
    fetch('/api/salones-disponibles',{cache:'no-store'})
      .then(async r=>{const d=await r.json();if(!r.ok)throw Error(d.error||'No se pudo consultar los salones.');return d;})
      .then(d=>{if(vivo){setSalones(d.salones||[]);setCargando(false);}})
      .catch(e=>{if(vivo){setCargando(false);setErrorCatalogo(e.message);}});
    return ()=>{vivo=false;};
  },[modoDemo,sinConexion]);

  const seleccionado=salones.find(s=>`${s.periodo}/${s.salon}`===seleccion);
  const normalizado=codigo.replace(/[\s-]/g,'').toUpperCase();
  // Los códigos largos existentes se aceptan hasta que el administrador los cambie.
  const codigoValido=/^\d{4}$|^\d{8}$|^[A-HJ-NP-Z2-9]{16}$/.test(normalizado);

  const enviar=e=>{
    e.preventDefault();
    if(seleccionado&&codigoValido&&!ocupado){
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
      {sinConexion&&<div className="ag-offline-banner" role="status">
        <strong>Sin conexión a internet</strong>
        <p>Para preparar este celular, abre Ahorro Grupal con internet una vez, entra con el PIN y deja que guarde tu salón. Después podrás abrir la app sin Wi-Fi ni datos, mientras mantengas la sesión en el dispositivo. Si cerraste sesión o nunca ingresaste, necesitas conectarte una vez.</p>
      </div>}
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
        <h2 className="ag-access-subtitle">2. Introduce los 4 dígitos de tu salón</h2>
        <p className="ag-muted">Pide el PIN de 4 dígitos al responsable o al administrador general. Cada salón tiene el suyo.</p>
        <label className="ag-access-code-label">
          <span><KeyRound size={18}/> Código de acceso {seleccionado?`· salón ${seleccionado.salon}`:''}</span>
          <input type="text" inputMode="numeric" enterKeyHint="go" autoComplete="off" autoCapitalize="characters"
            spellCheck={false} placeholder="••••"
            value={codigo} onChange={e=>setCodigo(e.target.value.toUpperCase().slice(0,19))}
            maxLength={19} disabled={!seleccionado||ocupado} required/>
        </label>
        <button type="submit" className="ag-btn ag-btn-primary ag-access-code-submit"
          disabled={sinConexion||!seleccionado||!codigoValido||ocupado}>
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
