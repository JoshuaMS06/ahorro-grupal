import {useEffect,useState} from 'react';
import {CheckCircle2,LockKeyhole,MailCheck,ShieldCheck,UserRound,UsersRound} from 'lucide-react';
import './AccesoSalon.css';

const SALONES_DEMO=['107','307','507','707','907'].map(salon=>({
  periodo:'2026-2027-A',salon,nombre:`Salón ${salon}`
}));

export default function AccesoSalon({usuario,solicitud,correoVerificado,abrirLogin,registrar,solicitar,
  verificarCorreo,reenviarCorreo,ocupado,error,modoDemo}) {
  const [salones,setSalones]=useState(modoDemo?SALONES_DEMO:[]);
  const [cargando,setCargando]=useState(!modoDemo);
  const [errorCatalogo,setErrorCatalogo]=useState('');
  const [seleccion,setSeleccion]=useState('');
  const [correo,setCorreo]=useState('');
  const [clave,setClave]=useState('');
  const [nombre,setNombre]=useState('');
  useEffect(()=>{
    if(modoDemo)return;
    let vivo=true;
    fetch('/api/salones-disponibles',{cache:'no-store'})
      .then(async r=>{const d=await r.json();if(!r.ok)throw Error(d.error||'No se pudo obtener la lista.');return d;})
      .then(d=>{if(vivo){setSalones(d.salones||[]);setCargando(false);}})
      .catch(e=>{if(vivo){setCargando(false);setErrorCatalogo(e.message);}});
    return ()=>{vivo=false;};
  },[modoDemo]);
  const sel=salones.find(s=>`${s.periodo}/${s.salon}`===seleccion);
  const pendiente=solicitud?.estado==='pendiente';
  return <main className="ag-main">
    <section className="ag-panel ag-access-shell">
      <div className="ag-access-intro"><span className="ag-access-icon"><ShieldCheck size={28}/></span>
        <h1>Tu salón, tu espacio</h1>
        <p>Consulta las aportaciones de tu grupo y el fondo común sin acceder a los datos de otros salones.</p>
      </div>
      {solicitud ? <div className="ag-access-status">
        <LockKeyhole size={28}/>
        <h2>{pendiente?'Solicitud enviada':solicitud.estado==='rechazado'?'Solicitud no autorizada':
          solicitud.estado==='revocado'?'Acceso revocado':'Acceso autorizado'}</h2>
        <p>Salón <strong>{solicitud.salon}</strong> · {solicitud.periodo}</p>
        <p>{pendiente?'El administrador general revisará tu cuenta y confirmará que perteneces al salón.':
          solicitud.estado==='aprobado'?'Estamos comprobando tus permisos. Si no se abre tu salón, cierra sesión y vuelve a ingresar.':
          'Comunícate con el administrador general para aclarar o corregir la asignación.'}</p>
        <small>No es posible cambiar de salón desde esta cuenta.</small>
      </div> : <>
        <h2 className="ag-access-subtitle">¿A qué salón perteneces?</h2>
        <p className="ag-muted">Selecciona tu grupo. Esta selección necesita aprobación para proteger los datos de los estudiantes.</p>
        {errorCatalogo&&<div className="ag-error">{errorCatalogo}</div>}
        {cargando?<p className="ag-muted">Consultando salones disponibles…</p>:
          <div className="ag-access-rooms">
            {salones.map(s=><button type="button" key={`${s.periodo}/${s.salon}`}
              className={seleccion===`${s.periodo}/${s.salon}`?'active':''}
              onClick={()=>setSeleccion(`${s.periodo}/${s.salon}`)} aria-pressed={seleccion===`${s.periodo}/${s.salon}`}>
              <UsersRound size={19}/><strong>{s.salon}</strong><small>{s.periodo}</small></button>)}
          </div>}
        {!usuario ? <>
          <div className="ag-access-divider">Crea tu cuenta para solicitar el acceso</div>
          <form className="ag-access-form" onSubmit={e=>{e.preventDefault();registrar({correo,clave,nombre});}}>
            <label>Nombre completo<input value={nombre} onChange={e=>setNombre(e.target.value)} required minLength={3} maxLength={100} autoComplete="name" placeholder="Nombre y apellido"/></label>
            <label>Correo electrónico<input value={correo} onChange={e=>setCorreo(e.target.value)} type="email" required autoComplete="email" placeholder="tu@correo.com"/></label>
            <label>Contraseña<input value={clave} onChange={e=>setClave(e.target.value)} type="password" required minLength={6} autoComplete="new-password"/></label>
            <button className="ag-btn ag-btn-primary" disabled={ocupado||!sel} type="submit"><UserRound size={18}/> Crear mi cuenta</button>
          </form>
          <button type="button" className="ag-link" onClick={abrirLogin}>¿Ya tienes cuenta? Iniciar sesión</button>
        </> : !correoVerificado ? <div className="ag-access-status">
          <MailCheck size={27}/><h2>Verifica tu correo</h2>
          <p>Enviamos un enlace a <strong>{usuario.email}</strong>. Abre el enlace desde tu correo y vuelve aquí.</p>
          <div className="ag-access-actions">
            <button type="button" className="ag-btn ag-btn-primary" disabled={ocupado} onClick={verificarCorreo}><CheckCircle2 size={17}/> Ya verifiqué mi correo</button>
            <button type="button" className="ag-btn" disabled={ocupado} onClick={reenviarCorreo}>Reenviar enlace</button>
          </div>
        </div> : <div className="ag-access-status">
          <CheckCircle2 size={27}/><h2>Correo verificado</h2>
          <p>Cuenta: <strong>{usuario.email}</strong></p>
          <p>Tu grupo quedará vinculado a esta cuenta tras la aprobación del administrador general.</p>
          <button type="button" className="ag-btn ag-btn-primary" onClick={()=>sel&&solicitar(sel)}
            disabled={ocupado||!sel}><LockKeyhole size={17}/> Solicitar acceso al salón {sel?.salon||'seleccionado'}</button>
        </div>}
      </>}
      {error&&<div className="ag-error">{error}</div>}
      <div className="ag-access-privacy"><LockKeyhole size={16}/> Nadie obtiene acceso por elegir un salón: el administrador debe validar la solicitud. Los pagos existentes no se modifican.</div>
    </section>
  </main>;
}
