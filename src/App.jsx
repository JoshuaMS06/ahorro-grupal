import { useEffect, useMemo, useRef, useState } from 'react';
import { initializeApp, getApps, getApp } from 'firebase/app';
import { getAuth, onAuthStateChanged, signInWithEmailAndPassword, signOut, sendPasswordResetEmail } from 'firebase/auth';
import { getDatabase, ref, onValue, runTransaction, push, set } from 'firebase/database';
import {
  BookOpen, Bell, BellRing, CalendarClock, Check, CheckCircle2,
  CircleDollarSign, Download, FileUp, History, LockKeyhole, UserRound,
  LogOut, Menu, Minus, Plus, Search, ShieldCheck, UsersRound, Wallet, X,
  AlertTriangle, GraduationCap, ArrowDownRight, Eye, EyeOff,
} from 'lucide-react';
import { CUOTA_SEMANAL, cuotaDeSalon, esLunes, estadoSemana, fechaMexico, isClassCode, isPeriodId, monto, pagoClave, pagosActivos, resumenCaja, semanaPeriodo, validarImportacion } from '../lib/aulas.js';
import './index.css';
import './App.css';

const firebaseConfig = {
  apiKey: 'AIzaSyA3AN8yCezlw3ORkPUCZp0Af97JgAoMbOE',
  authDomain: 'ahorro-grupal-industrial.firebaseapp.com',
  projectId: 'ahorro-grupal-industrial',
  storageBucket: 'ahorro-grupal-industrial.firebasestorage.app',
  messagingSenderId: '493506921547',
  appId: '1:493506921547:web:97ece4e262f02b6a9eb9ce',
  databaseURL: 'https://ahorro-grupal-industrial-default-rtdb.firebaseio.com',
};
const app = getApps().length ? getApp() : initializeApp(firebaseConfig);
const database = getDatabase(app);
const auth = getAuth(app);
const PROFESORES = [
  'Ubaldo Jerónimo Carrera', 'Nicolas Hernández Ruiz', 'Rafael Rios Esperanza',
  'Francisco Javier Sol Sampedro', 'Eduardo Martínez Mendoza',
  'Néstor Hernández Silva', 'Adán Acosta Banda', 'Tania Castillo Villegas',
];
const pesos = v => new Intl.NumberFormat('es-MX',{ style:'currency',currency:'MXN',maximumFractionDigits:0 }).format(Number(v)||0);
const fechaLarga = t => t ? new Intl.DateTimeFormat('es-MX',{dateStyle:'medium',timeStyle:'short',timeZone:'America/Mexico_City'}).format(new Date(t)) : 'Sin fecha';
const avisoError = err => {
  if (err?.code==='PERMISSION_DENIED' || err?.code==='database/permission-denied') return 'Firebase denegó el acceso. Publica primero las reglas incluidas en el ZIP.';
  if (String(err?.code||'').startsWith('auth/')) return 'No se pudo iniciar sesión. Revisa correo, contraseña o conexión.';
  return err?.message || 'No se pudo completar la operación.';
};
const normalizarId = s => (s||'').normalize('NFKD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-zA-Z0-9_-]/g,'').toLowerCase();
const defaultPeriod = '2026-2027-A';

function Panel({title,icon:Icon,children,action}) {
  return <section className="ag-panel"><div className="ag-panel-heading"><h2>{Icon && <Icon size={19}/>} {title}</h2>{action}</div>{children}</section>;
}
function SmallButton({children,onClick,disabled=false,variant='soft',type='button'}) {
  return <button type={type} className={`ag-btn ag-btn-${variant}`} disabled={disabled} onClick={onClick}>{children}</button>;
}

export default function App() {
  const [periodos,setPeriodos]=useState({});
  const [periodoId,setPeriodoId]=useState(()=>localStorage.getItem('ag:periodo')||defaultPeriod);
  const [salonId,setSalonId]=useState(()=>localStorage.getItem('ag:salon')||'507');
  const [datos,setDatos]=useState(null);
  const [legacy,setLegacy]=useState({});
  const [cargando,setCargando]=useState(true);
  const [dbError,setDbError]=useState('');
  const [usuario,setUsuario]=useState(null);
  const [esAdmin,setEsAdmin]=useState(false);
  const [loginOpen,setLoginOpen]=useState(false);
  const [email,setEmail]=useState('');
  const [password,setPassword]=useState('');
  const [seePassword,setSeePassword]=useState(false);
  const [loginError,setLoginError]=useState('');
  const [loginBusy,setLoginBusy]=useState(false);
  const [operacion,setOperacion]=useState('');
  const [toast,setToast]=useState('');
  const [search,setSearch]=useState('');
  const [filtro,setFiltro]=useState('todos');
  const [vista,setVista]=useState('pagos');
  const [fecha,setFecha]=useState(Date.now());
  const [semanaElegida,setSemanaElegida]=useState(0);
  const [mostrarMenu,setMostrarMenu]=useState(false);
  const [nuevoPeriodo,setNuevoPeriodo]=useState({id:'',lunesBase:'',semanaBase:1});
  const [nuevoSalon,setNuevoSalon]=useState('');
  const [nuevoEstudiante,setNuevoEstudiante]=useState({nombre:'',control:''});
  const [importInfo,setImportInfo]=useState(null);
  const [importFile,setImportFile]=useState(null);
  const [retiro,setRetiro]=useState({monto:'',motivo:''});
  const [notificaciones,setNotificaciones]=useState(typeof Notification!=='undefined' && Notification.permission==='granted');
  const [instalarEvento,setInstalarEvento]=useState(null);
  const [modalInstalar,setModalInstalar]=useState(false);
  const [instalada,setInstalada]=useState(()=>window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone===true);
  const primerEvento=useRef(null);

  // Las reglas de Firebase restringen periodos y aulas a administradores.
  // No iniciamos listeners antes de comprobar adminUids: una lectura denegada
  // cancela la suscripción y esta no se recupera por sí sola al iniciar sesión.
  useEffect(()=>{
    if(!esAdmin){setPeriodos({});setDbError('');return;}
    const stop=onValue(ref(database,'periodos'),snap=>{setPeriodos(snap.val()||{});setDbError('');},err=>setDbError(avisoError(err)));
    return ()=>stop();
  },[esAdmin]);
  useEffect(()=>{
    setDatos(null);setSemanaElegida(0);setSearch('');
    if(!esAdmin){setCargando(false);return;}
    setCargando(true);
    const stop=onValue(ref(database,`aulas/${periodoId}/${salonId}`),snap=>{setDatos(snap.val());setCargando(false);setDbError('');},err=>{setCargando(false);setDbError(avisoError(err));});
    return ()=>stop();
  },[esAdmin,periodoId,salonId]);
  useEffect(()=>{
    // El historial del 507 solo se consulta tras autenticar al administrador.
    if(!esAdmin || periodoId!==defaultPeriod || salonId!=='507') {setLegacy({});return;}
    const stop=onValue(ref(database,'ahorro/integrantes'),snap=>setLegacy(snap.val()||{}),()=>setLegacy({}));
    return ()=>stop();
  },[esAdmin,periodoId,salonId]);
  useEffect(()=>{
    const unsub=onAuthStateChanged(auth,u=>{setUsuario(u);setEsAdmin(false);setLoginError('');});
    return ()=>unsub();
  },[]);
  useEffect(()=>{
    if(!usuario){setEsAdmin(false);return;}
    const stop=onValue(ref(database,`adminUids/${usuario.uid}`),s=>{
      setEsAdmin(s.val()===true);if(s.val()===true)setLoginOpen(false);
    },e=>{setEsAdmin(false);setLoginError(avisoError(e));});
    return ()=>stop();
  },[usuario]);
  useEffect(()=>{
    const tick=()=>{ const now=Date.now(); setFecha(prev=>fechaMexico(prev)===fechaMexico(now)?prev:now); };
    const timer=setInterval(tick,1000);
    document.addEventListener('visibilitychange',tick);
    return ()=>{clearInterval(timer);document.removeEventListener('visibilitychange',tick);};
  },[]);
  useEffect(()=>{
    const handler=e=>{e.preventDefault();setInstalarEvento(e);};
    const installed=()=>{setInstalada(true);setModalInstalar(false);};
    window.addEventListener('beforeinstallprompt',handler);
    window.addEventListener('appinstalled',installed);
    return ()=>{window.removeEventListener('beforeinstallprompt',handler);window.removeEventListener('appinstalled',installed);};
  },[]);
  useEffect(()=>{
    if(!toast)return;
    const timer=setTimeout(()=>setToast(''),6500);
    return ()=>clearTimeout(timer);
  },[toast]);

  const periodKeys=Object.keys(periodos).sort().reverse();
  const periodo=periodos[periodoId]||null;
  const salones=Object.keys(periodo?.salones||{}).sort((a,b)=>a.localeCompare(b,'es',{numeric:true}));
  const semanaActual=semanaPeriodo(periodo,fecha);
  const semana=semanaElegida||semanaActual;
  const cuotaSemanal=cuotaDeSalon(salonId,datos?.meta);
  const integrantes=datos?.integrantes || ((periodoId===defaultPeriod && salonId==='507') ? Object.fromEntries(Object.keys(legacy).map((nombre,i)=>[`hist${String(i+1).padStart(3,'0')}`,{nombre,aliasLegado:nombre}])) : {});
  const lista=useMemo(()=>Object.entries(integrantes).map(([id,v])=>({id,...v})).sort((a,b)=>a.nombre.localeCompare(b.nombre,'es')),[integrantes]);
  const pagos=datos?.pagos||{};
  const retiros=datos?.retiros||{};
  const mensajesRetiro=useMemo(()=>Object.entries(retiros).map(([id,r])=>({id,...r})).sort((a,b)=>(b.creadoEn||0)-(a.creadoEn||0)),[retiros]);
  const legadoTotal=useMemo(()=>lista.reduce((s,e)=>s + (periodoId===defaultPeriod && salonId==='507' ? Math.max(0,Number(legacy?.[e.aliasLegado]?.pagos)||0)*CUOTA_SEMANAL:0),0),[lista,legacy,periodoId,salonId]);
  const resumen=resumenCaja(pagos,retiros,legadoTotal);
  const detalleSemana=lista.map(e=>({...e,estado:estadoSemana(pagos,e.id,semana)}));
  const vigenteParaRegistrar=semana>=Number(datos?.meta?.inicioDetalle||1);
  const estadoAlumno=e=>{
    if(!vigenteParaRegistrar)return 'sin-dato';
    return estadoSemana(pagos,e.id,semana);
  };
  const pagaron=detalleSemana.filter(e=>estadoAlumno(e)==='pagado').length;
  const pendientes=detalleSemana.filter(e=>estadoAlumno(e)==='pendiente').length;
  const visible=detalleSemana.filter(e=>(e.nombre||'').toLocaleLowerCase('es').includes(search.toLocaleLowerCase('es')) || (e.control||'').includes(search)).filter(e=>filtro==='todos'||estadoAlumno(e)===filtro);
  const pagosHist=Object.entries(pagos).flatMap(([id,p])=>{
    if(!p?.estudianteId)return [];
    const eventos=Object.entries(p.historial||{});
    return eventos.length ? eventos.map(([key,ev])=>({id:`${id}-${key}`,nombre:p.nombre,estudianteId:p.estudianteId,semana:p.semana,monto:p.monto,estado:ev.tipo==='registro'?'pagado':'anulado',creadoEn:ev.fecha,registradoPor:ev.uid,motivo:ev.motivo||''})) : [{id,...p}];
  }).sort((a,b)=>(b.creadoEn||0)-(a.creadoEn||0));

  useEffect(()=>{
    const events=Object.entries(retiros).map(([id,r])=>`${id}:${r.estado}`).sort();
    const current=events.join('|');
    if(primerEvento.current===null){primerEvento.current=current;return;}
    if(primerEvento.current!==current && notificaciones && typeof Notification!=='undefined' && Notification.permission==='granted'){
      const ultimo=mensajesRetiro[0];
      if(ultimo){try {new Notification('Ahorro Grupal · Movimiento de caja',{body:`Retiro ${ultimo.estado}: ${pesos(ultimo.monto)} · ${ultimo.motivo}` ,icon:'/icons/cerdito-192.png'});}catch{/* navegador no admite aviso */}}
    }
    primerEvento.current=current;
  },[retiros,mensajesRetiro,notificaciones]);
  useEffect(()=>{primerEvento.current=null;},[periodoId,salonId]);

  const withOperation=async(label,fn)=>{
    if(operacion)return;
    setOperacion(label);
    try {const result=await fn();if(typeof result==='string')setToast(result);}
    catch(e){setToast(`No se completó la operación: ${avisoError(e)}`);}
    finally{setOperacion('');}
  };
  const signIn=async e=>{
    e.preventDefault();setLoginBusy(true);setLoginError('');
    try {await signInWithEmailAndPassword(auth,email.trim(),password);setPassword('');}
    catch(e){setLoginError(avisoError(e));}
    finally{setLoginBusy(false);}
  };
  const resetPassword=async()=>{
    if(!email.trim()){setLoginError('Primero introduce el correo.');return;}
    try {await sendPasswordResetEmail(auth,email.trim());setToast('Se ha enviado el correo de recuperación si la cuenta existe.');}
    catch(e){setLoginError(avisoError(e));}
  };
  const cambiarPeriodo=id=>{
    setPeriodoId(id);localStorage.setItem('ag:periodo',id);
    const listaGrupos=Object.keys(periodos[id]?.salones||{}).sort((a,b)=>a.localeCompare(b,'es',{numeric:true}));
    const next=listaGrupos.includes(salonId)?salonId:(listaGrupos[0]||'507');
    setSalonId(next);localStorage.setItem('ag:salon',next);
  };
  const cambiarSalon=id=>{setSalonId(id);localStorage.setItem('ag:salon',id);};
  const importar=async()=>{
    if(!esAdmin || !importInfo)return;
    await withOperation('importar',async()=>{
      const info=importInfo;
      const p=info.periodo;
      const meta={nombre:p.nombre||p.id,lunesBase:p.lunesBase,semanaBase:Number(p.semanaBase||1),creadoEn:Date.now()};
      await runTransaction(ref(database,`periodos/${p.id}/meta`),current=>current===null?meta:undefined,{applyLocally:false});
      for(const [codigo,estudiantes] of Object.entries(info.salones)){
        await runTransaction(ref(database,`periodos/${p.id}/salones/${codigo}`),current=>current===null?{nombre:`Salón ${codigo}`}:undefined,{applyLocally:false});
        const start=(p.id===defaultPeriod && codigo==='507') ? semanaPeriodo(meta)+1 : semanaPeriodo(meta);
        await runTransaction(ref(database,`aulas/${p.id}/${codigo}/meta`),current=>current===null?{nombre:`Salón ${codigo}`,inicioDetalle:start,cuotaSemanal:cuotaDeSalon(codigo),creadoEn:Date.now()}:undefined,{applyLocally:false});
        const mapping=Object.fromEntries(estudiantes.map(e=>[e.id,{nombre:e.nombre.trim(),control:String(e.control||'').trim(),...(e.aliasLegado?{aliasLegado:e.aliasLegado}:{} )}]));
        await runTransaction(ref(database,`aulas/${p.id}/${codigo}/integrantes`),current=>current===null?mapping:undefined,{applyLocally:false});
      }
      setImportInfo(null);setImportFile(null);cambiarPeriodo(p.id);
      setSalonId(Object.keys(info.salones)[0]);
      localStorage.setItem('ag:salon',Object.keys(info.salones)[0]);
      return `Importación terminada: ${Object.keys(info.salones).length} salones. No se sustituyeron registros existentes.`;
    });
  };
  const onArchivo=async(e)=>{
    const file=e.target.files?.[0];if(!file)return;
    try{
      if(file.size>2_000_000)throw new Error('El archivo supera 2 MB.');
      const parsed=JSON.parse(await file.text());
      const res=validarImportacion(parsed);
      if(periodos[parsed.periodo.id] && !window.confirm('Este periodo ya existe. La importación solo creará grupos que falten, sin sustituir datos. ¿Continuar?'))return;
      setImportInfo(parsed);setImportFile({name:file.name,...res});
    }catch(err){setToast(`No se pudo leer la lista: ${err.message}`);}
  };
  const crearPeriodo=async()=>{
    if(!esAdmin)return;
    const {id,lunesBase,semanaBase}=nuevoPeriodo;
    if(!isPeriodId(id)||!esLunes(lunesBase)||!Number.isInteger(Number(semanaBase))||Number(semanaBase)<1){setToast('Indica un periodo como 2027-2028-A y una fecha de lunes válida.');return;}
    await withOperation('periodo',async()=>{
      const result=await runTransaction(ref(database,`periodos/${id}/meta`),a=>a===null?{nombre:id,lunesBase,semanaBase:Number(semanaBase),creadoEn:Date.now()}:undefined,{applyLocally:false});
      if(result.committed){cambiarPeriodo(id);setNuevoPeriodo({id:'',lunesBase:'',semanaBase:1});}
      return result.committed?'Nuevo ciclo creado. Agrega un salón o importa una lista.':'Ese ciclo ya existe; no se reemplazó.';
    });
  };
  const crearSalon=async()=>{
    const id=nuevoSalon.trim();if(!esAdmin||!periodo||!isClassCode(id)){setToast('Indica un código de salón válido.');return;}
    await withOperation('salon',async()=>{
      const result=await runTransaction(ref(database,`aulas/${periodoId}/${id}/meta`),a=>a===null?{nombre:`Salón ${id}`,inicioDetalle:semanaActual,cuotaSemanal:cuotaDeSalon(id),creadoEn:Date.now()}:undefined,{applyLocally:false});
      if(!result.committed)return 'Ese salón ya existe.';
      await set(ref(database,`periodos/${periodoId}/salones/${id}`),{nombre:`Salón ${id}`});
      cambiarSalon(id);setNuevoSalon('');return 'Salón creado sin registros anteriores.';
    });
  };
  const agregarAlumno=async()=>{
    if(!esAdmin||!datos?.meta)return;
    const nombre=nuevoEstudiante.nombre.trim();const control=nuevoEstudiante.control.trim();
    if(nombre.length<3||nombre.length>120){setToast('Escribe el nombre del estudiante.');return;}
    const id=control ? `n${normalizarId(control)}` : `e${Date.now().toString(36)}`;
    if(!/^[a-z0-9_-]{2,32}$/.test(id)){setToast('El número de control contiene caracteres no permitidos.');return;}
    await withOperation('alumno',async()=>{
      const result=await runTransaction(ref(database,`aulas/${periodoId}/${salonId}/integrantes/${id}`),v=>v===null?{nombre,control}:undefined,{applyLocally:false});
      if(result.committed)setNuevoEstudiante({nombre:'',control:''});
      return result.committed?'Estudiante agregado.':'El estudiante ya existe.';
    });
  };
  const registrarPago=async e=>{
    if(!esAdmin||!vigenteParaRegistrar||periodo?.meta?.cerradoEn)return;
    const key=pagoClave(e.id,semana);
    if(pagos[key]?.estado==='pagado')return;
    await withOperation(`pago:${e.id}`,async()=>{
      const eventoId=push(ref(database,`aulas/${periodoId}/${salonId}/pagos`)).key;
      const r=await runTransaction(ref(database,`aulas/${periodoId}/${salonId}/pagos/${key}`),v=>{
        if(v?.estado==='pagado')return;
        const cuando=Date.now();
        return {...(v||{}),estudianteId:e.id,nombre:e.nombre,semana,monto:cuotaSemanal,estado:'pagado',creadoEn:cuando,registradoPor:usuario.uid,correcciones:v?.correcciones||0,historial:{...(v?.historial||{}),[eventoId]:{tipo:'registro',fecha:cuando,uid:usuario.uid}}};
      },{applyLocally:false});
      return r.committed?`Pago de ${pesos(cuotaSemanal)} registrado para ${e.nombre}, semana ${semana}.`:'Esta semana ya estaba pagada.';
    });
  };
  const anularPago=async e=>{
    if(!esAdmin||periodo?.meta?.cerradoEn)return;
    const motivo=window.prompt(`Motivo de anular el pago de ${e.nombre} (semana ${semana}):`);
    if(motivo===null)return;
    if(motivo.trim().length<5){setToast('Escribe un motivo de al menos 5 caracteres para la corrección.');return;}
    const key=pagoClave(e.id,semana);
    await withOperation(`anular:${e.id}`,async()=>{
      const eventoId=push(ref(database,`aulas/${periodoId}/${salonId}/pagos`)).key;
      const r=await runTransaction(ref(database,`aulas/${periodoId}/${salonId}/pagos/${key}`),v=>{
        if(!v||v.estado!=='pagado')return;
        const cuando=Date.now();
        return {...v,estado:'anulado',anuladoEn:cuando,anuladoPor:usuario.uid,correcciones:(v.correcciones||0)+1,historial:{...(v.historial||{}),[eventoId]:{tipo:'anulacion',fecha:cuando,uid:usuario.uid,motivo:motivo.trim()}}};
      },{applyLocally:false});
      return r.committed?'Pago anulado; queda registrado en el historial.':'El pago ya no estaba activo.';
    });
  };
  const solicitarRetiro=async e=>{
    e.preventDefault();if(!esAdmin||periodo?.meta?.cerradoEn)return;
    const valor=Number(retiro.monto);
    if(!Number.isSafeInteger(valor)||valor<=0||valor>1000000||retiro.motivo.trim().length<6){setToast('Indica un importe entero positivo y un motivo de al menos 6 caracteres.');return;}
    await withOperation('retiro',async()=>{
      const destino=push(ref(database,`aulas/${periodoId}/${salonId}/retiros`));
      await set(destino,{monto:valor,motivo:retiro.motivo.trim(),estado:'solicitado',solicitadoPor:usuario.uid,creadoEn:Date.now()});
      setRetiro({monto:'',motivo:''});return 'Solicitud de retiro publicada; el saldo aún no cambió.';
    });
  };
  const resolverRetiro=async(r,estado)=>{
    if(!esAdmin||periodo?.meta?.cerradoEn||r.estado!=='solicitado')return;
    if(estado==='aprobado' && monto(r.monto)>resumen.saldo){setToast('Saldo insuficiente. No se puede aprobar este retiro.');return;}
    if(!window.confirm(`¿${estado==='aprobado'?'Aprobar y descontar':'Rechazar'} la solicitud de ${pesos(r.monto)}?`))return;
    await withOperation(`retiro:${r.id}`,async()=>{
      // Transacción de toda la colección: evita aprobaciones simultáneas que dejen saldo negativo.
      const ruta=`aulas/${periodoId}/${salonId}`;
      const result=await runTransaction(ref(database,ruta),current=>{
        if(!current||current.retiros?.[r.id]?.estado!=='solicitado')return;
        const actual=resumenCaja(current.pagos||{},current.retiros||{},legadoTotal);
        if(estado==='aprobado'&&monto(r.monto)>actual.saldo)return;
        current.retiros[r.id]={...current.retiros[r.id],estado,respondidoPor:usuario.uid,respondidoEn:Date.now()};
        return current;
      },{applyLocally:false});
      return result.committed?`Retiro ${estado}. ${estado==='aprobado'?'El saldo se actualizó automáticamente.':'No se descontó dinero.'}`:'La solicitud ya cambió o no hay saldo suficiente.';
    });
  };
  const cerrarCiclo=async()=>{
    if(!esAdmin||!periodo?.meta||periodo?.meta?.cerradoEn)return;
    const actual=semanaPeriodo(periodo.meta);
    if(!window.confirm(`¿Cerrar el ciclo ${periodoId} al terminar la semana ${actual}? Se conservarán sus pagos, pero se bloquearán nuevos registros en la aplicación. Comprueba antes que no existan solicitudes de retiro pendientes en ningún salón.`))return;
    await withOperation('cierre',async()=>{
      const r=await runTransaction(ref(database,`periodos/${periodoId}/meta`),meta=>{
        if(!meta||meta.cerradoEn)return;
        return {...meta,cerradoEn:Date.now(),semanaCierre:semanaPeriodo(meta)};
      },{applyLocally:false});
      return r.committed?'Ciclo archivado. Los historiales y saldos permanecen disponibles.':'El ciclo ya estaba cerrado.';
    });
  };
  const permitirAvisos=async()=>{
    if(typeof Notification==='undefined'){setToast('Este navegador no permite notificaciones locales. Los avisos siguen disponibles dentro de la app.');return;}
    const permiso=await Notification.requestPermission();
    setNotificaciones(permiso==='granted');
    setToast(permiso==='granted'?'Avisos activados mientras la aplicación esté abierta.':'Puedes consultar las solicitudes y retiros en la sección Avisos.');
  };
  const instalar=async()=>{
    if(instalarEvento){try{await instalarEvento.prompt();await instalarEvento.userChoice;}catch{/* instrucciones manuales */}}
    else setModalInstalar(true);
  };

  return <div className="ag-root">
    <div className="ag-wrap">
      <header className="ag-header">
        <div className="ag-brand"><img src="/icons/cerdito-192.png" alt="Cerdito de Ahorro Grupal"/><div><strong>Ahorro<span>Grupal</span></strong><small>Ingeniería Industrial</small></div></div>
        <div className="ag-header-actions">
          {esAdmin ? <span className="ag-admin-pill"><ShieldCheck size={16}/> Administrador</span> : <button className="ag-icon" type="button" title="Acceso administrativo" onClick={()=>setLoginOpen(true)}><LockKeyhole size={21}/></button>}
          {usuario&&<button className="ag-icon" type="button" title="Cerrar sesión" onClick={()=>signOut(auth)}><LogOut size={19}/></button>}
          <button className="ag-icon" type="button" title="Menú" onClick={()=>setMostrarMenu(!mostrarMenu)}><Menu size={22}/></button>
        </div>
      </header>
      {mostrarMenu&&<nav className="ag-menu"><button onClick={()=>{setVista('pagos');setMostrarMenu(false);}}>Aportaciones</button><button onClick={()=>{setVista('avisos');setMostrarMenu(false);}}>Avisos y retiros</button><button onClick={()=>{setVista('profesores');setMostrarMenu(false);}}>Profesores</button><button onClick={()=>{setVista('gestion');setMostrarMenu(false);}}>Ciclos y grupos</button><button onClick={instalar}>Instalar app</button></nav>}
      {!esAdmin ? <main className="ag-main">
        <section className="ag-panel">
          <div className="ag-panel-heading"><h2><LockKeyhole size={19}/> Acceso protegido</h2></div>
          <p className="ag-muted">La consulta de salones, listas y pagos requiere iniciar sesión como administrador autorizado. La gestión de responsables por salón se habilitará en el siguiente bloque.</p>
          <SmallButton variant="primary" onClick={()=>setLoginOpen(true)}><LockKeyhole size={17}/> {usuario ? 'Comprobar o cambiar cuenta' : 'Iniciar sesión'}</SmallButton>
          {usuario && <p className="ag-muted">Si tu cuenta no obtiene acceso, verifica su autorización en Firebase. Puedes cerrar sesión desde el icono superior.</p>}
        </section>
      </main> : <main className="ag-main">
        {dbError&&<div className="ag-error"><AlertTriangle size={18}/> {dbError}</div>}
        <div className="ag-intro"><div><span className="ag-kicker">CAJA DEL SALÓN · {periodo?.meta?.nombre||periodoId} {periodo?.meta?.cerradoEn?' · CICLO ARCHIVADO':''}</span><h1>Control de aportaciones</h1><p>Una caja independiente por salón · <strong>{pesos(cuotaSemanal)} por semana</strong>.</p></div><div className="ag-week-pill"><CalendarClock size={19}/> Semana {semanaActual}</div></div>
        <div className="ag-selectors">
          <label>Ciclo escolar<select value={periodoId} onChange={e=>cambiarPeriodo(e.target.value)}>{periodKeys.length ? periodKeys.map(k=><option key={k} value={k}>{periodos[k]?.meta?.nombre||k}</option>):<option value={defaultPeriod}>Sin listas importadas</option>}</select></label>
          <label>Salón<select value={salonId} onChange={e=>cambiarSalon(e.target.value)}>{salones.length ? salones.map(k=><option key={k} value={k}>{periodo?.salones?.[k]?.nombre||`Salón ${k}`}</option>):<option value="507">Sin salones</option>}</select></label>
        </div>
        <div className="ag-tabs" role="tablist" aria-label="Apartados"><button className={vista==='pagos'?'active':''} onClick={()=>setVista('pagos')}><Wallet size={17}/> Aportaciones</button><button className={vista==='avisos'?'active':''} onClick={()=>setVista('avisos')}><Bell size={17}/> Avisos {mensajesRetiro.some(r=>r.estado==='solicitado')&&<b className="ag-dot"/>}</button><button className={vista==='profesores'?'active':''} onClick={()=>setVista('profesores')}><GraduationCap size={17}/> Profesores</button><button className={vista==='gestion'?'active':''} onClick={()=>setVista('gestion')}><BookOpen size={17}/> Ciclos y salones</button></div>
        {vista==='pagos'&&<>
          <section className="ag-summary">
            <div className="ag-balance"><div className="ag-balance-head"><Wallet size={19}/> <span>FONDO DEL SALÓN {salonId}</span></div><strong>{cargando?'—':pesos(resumen.saldo)}</strong><p>Saldo disponible de la caja</p><div className="ag-balance-bottom"><span>Ingresos registrados: <b>{pesos(resumen.recaudado)}</b></span><span>Retiros aprobados: <b>{pesos(resumen.retirado)}</b></span></div></div>
            <div className="ag-stats"><div><CircleDollarSign size={21}/><strong>{pesos(cuotaSemanal)}</strong><span>Por semana</span></div><div><UsersRound size={21}/><strong>{cargando?'—':lista.length}</strong><span>Integrantes</span></div><div><CheckCircle2 size={21}/><strong>{vigenteParaRegistrar?pagaron:'—'}</strong><span>Pagaron esta selección</span></div></div>
          </section>
          {periodoId===defaultPeriod&&salonId==='507'&&<div className="ag-note"><History size={18}/> Las aportaciones del sistema anterior se incluyen en los ingresos, sin inventar la fecha individual de esos pagos. El registro semanal detallado comienza en la semana {datos?.meta?.inicioDetalle||'indicada al importar'}.</div>}
          {!datos?.meta && !cargando&&<div className="ag-empty"><BookOpen size={31}/><h3>Este salón todavía no está configurado</h3><p>Un administrador debe importar la lista del Excel o crear un salón en «Ciclos y salones».</p><SmallButton onClick={()=>setVista('gestion')}>Ver configuración</SmallButton></div>}
          {!datos?.meta && periodoId===defaultPeriod && salonId==='507' && lista.length>0 && <Panel title="Historial anterior (sin fechas individuales)" icon={History}><p className="ag-muted">Estos importes siguen leyéndose de la base anterior, sin modificar ni asignar semanas inventadas.</p><div className="ag-timeline">{lista.map(e=><div className="ag-timeline-row" key={e.id}><span className="ag-avatar" aria-hidden="true"><UserRound size={22} strokeWidth={2.2}/></span><div><strong>{e.nombre}</strong><small>{Math.max(0,Number(legacy[e.aliasLegado]?.pagos)||0)} aportaciones anteriores</small></div><b>{pesos(Math.max(0,Number(legacy[e.aliasLegado]?.pagos)||0)*20)}</b></div>)}</div></Panel>}
          {datos?.meta&&<Panel title="Registro semanal" icon={CalendarClock} action={<div className="ag-week-select"><button type="button" onClick={()=>setSemanaElegida(Math.max(1,semana-1))} disabled={semana<=1}>‹</button><select value={semana} onChange={e=>setSemanaElegida(Number(e.target.value))}>{Array.from({length:Math.max(semanaActual,1)},(_,i)=>i+1).reverse().map(n=><option key={n} value={n}>Semana {n}</option>)}</select><button type="button" onClick={()=>setSemanaElegida(Math.min(semanaActual,semana+1))} disabled={semana>=semanaActual}>›</button></div>}>
            <div className="ag-toolbar"><label className="ag-search"><Search size={17}/><input placeholder="Buscar por nombre o control..." value={search} onChange={e=>setSearch(e.target.value)}/></label><div className="ag-filters"><button className={filtro==='todos'?'active':''} onClick={()=>setFiltro('todos')}>Todos</button><button className={filtro==='pagado'?'active':''} onClick={()=>setFiltro('pagado')}>Pagaron</button><button className={filtro==='pendiente'?'active':''} onClick={()=>setFiltro('pendiente')}>Pendientes</button></div></div>
            {!vigenteParaRegistrar&&<div className="ag-note"><History size={16}/> Esta semana corresponde al historial anterior o a un periodo sin registros detallados. No se muestran supuestos adeudos.</div>}
            <div className="ag-student-list">{visible.map(e=>{const estado=estadoAlumno(e);return <article className="ag-student" key={e.id}><span className="ag-avatar" aria-hidden="true"><UserRound size={22} strokeWidth={2.2}/></span><div className="ag-student-info"><strong>{e.nombre}</strong><small>{e.control?`Control ${e.control} · `:''}Semana {semana}</small></div><span className={`ag-status ag-status-${estado}`}>{estado==='pagado'?<><Check size={14}/> Pagó</>:estado==='pendiente'?'Pendiente':'Sin desglose'}</span>{esAdmin&&vigenteParaRegistrar&&!periodo?.meta?.cerradoEn&&<div className="ag-pay-actions">{estado==='pagado'?<button title="Anular este pago (con registro de corrección)" disabled={!!operacion} onClick={()=>anularPago(e)}><Minus size={17}/></button>:<button title={`Registrar ${pesos(cuotaSemanal)} esta semana`} disabled={!!operacion} onClick={()=>registrarPago(e)}><Plus size={18}/></button>}</div>}</article>;})}{!visible.length&&<div className="ag-empty-small">No hay integrantes para este filtro.</div>}</div>
            <div className="ag-list-foot">{vigenteParaRegistrar?`${pagaron} pagos registrados · ${pendientes} pendientes de esta semana`:'Sin desglose semanal para esta selección'}</div>
          </Panel>}
          {datos?.meta&&<Panel title="Historial de aportaciones" icon={History}><p className="ag-muted">Movimientos registrados por semana. Los importes del sistema anterior no tienen fecha individual.</p><div className="ag-timeline">{pagosHist.slice(0,100).map(p=><div className="ag-timeline-row" key={p.id}><span className={`ag-timeline-mark ${p.estado==='pagado'?'ok':'cancel'}`}>{p.estado==='pagado'?<Check size={16}/>:<X size={16}/>}</span><div><strong>{p.nombre||integrantes[p.estudianteId]?.nombre||'Integrante'}</strong><small>Semana {p.semana} · {fechaLarga(p.creadoEn)} {p.estado==='anulado'?'· Anulación':''}{p.motivo?` · ${p.motivo}`:''}</small></div><b>{p.estado==='pagado'?'+':'−'}{pesos(p.monto)}</b></div>)}{!pagosHist.length&&<p className="ag-muted">Todavía no hay pagos semanales detallados para este salón.</p>}</div></Panel>}
        </>}
        {vista==='avisos'&&<><Panel title="Avisos de movimientos y retiros" icon={BellRing} action={<SmallButton onClick={permitirAvisos}><Bell size={16}/> Permitir avisos</SmallButton>}><p className="ag-muted">Las solicitudes y los retiros aprobados se publican aquí para todos. Los avisos del dispositivo funcionan mientras la app está abierta; no son notificaciones push con la app cerrada.</p>{!datos?.meta?<div className="ag-empty-small">Selecciona un salón configurado.</div>:<div className="ag-timeline">{mensajesRetiro.map(r=><div key={r.id} className="ag-withdrawal"><div className="ag-withdrawal-head"><span className={`ag-status ag-status-${r.estado}`}>{r.estado==='solicitado'?'Solicitud de retiro':r.estado==='aprobado'?'Retiro aprobado':'Solicitud rechazada'}</span><strong>{pesos(r.monto)}</strong></div><p>{r.motivo}</p><small>{fechaLarga(r.creadoEn)} {r.respondidoEn?`· Resuelto ${fechaLarga(r.respondidoEn)}`:''}</small>{esAdmin&&!periodo?.meta?.cerradoEn&&r.estado==='solicitado'&&<div className="ag-withdrawal-buttons"><SmallButton disabled={!!operacion} onClick={()=>resolverRetiro(r,'aprobado')} variant="primary"><Check size={16}/> Aprobar y descontar</SmallButton><SmallButton disabled={!!operacion} onClick={()=>resolverRetiro(r,'rechazado')}>Rechazar</SmallButton></div>}</div>)}{!mensajesRetiro.length&&<p className="ag-muted">No existen avisos de retiro para este salón.</p>}</div>}</Panel>{esAdmin&&!periodo?.meta?.cerradoEn&&datos?.meta&&<Panel title="Solicitar retiro de la caja" icon={ArrowDownRight}><form className="ag-simple-form" onSubmit={solicitarRetiro}><label>Importe en pesos<input type="number" min="1" step="1" value={retiro.monto} onChange={e=>setRetiro({...retiro,monto:e.target.value})} placeholder="Ej. 200" required/></label><label>Motivo<input value={retiro.motivo} onChange={e=>setRetiro({...retiro,motivo:e.target.value})} placeholder="¿Para qué se solicita?" minLength={6} required/></label><SmallButton type="submit" variant="primary" disabled={!!operacion}><Plus size={17}/> Publicar solicitud</SmallButton></form><p className="ag-muted">Solicitar no descuenta dinero. El saldo se actualiza cuando se aprueba la solicitud.</p></Panel>}</>}
        {vista==='profesores'&&<Panel title="Directorio de profesores" icon={GraduationCap}><p className="ag-muted">Profesores proporcionados para Ingeniería Industrial. No se incluyen en los cálculos de aportaciones.</p><div className="ag-prof-grid">{PROFESORES.map(n=><div key={n} className="ag-prof"><span className="ag-avatar"><GraduationCap size={20}/></span><strong>{n}</strong></div>)}</div></Panel>}
        {vista==='gestion'&&<><Panel title="Ciclos escolares y salones" icon={BookOpen}><p className="ag-muted">Los ciclos se conservan por separado. Un ciclo nuevo empieza sin pagos ni retiros; no borra el anterior.</p>{esAdmin&&periodo?.meta&&!periodo?.meta?.cerradoEn&&<div className="ag-archive-action"><SmallButton disabled={!!operacion} onClick={cerrarCiclo}>Archivar ciclo al terminar la semana actual</SmallButton></div>}<div className="ag-period-grid">{periodKeys.map(id=><button className={periodoId===id?'active':''} key={id} onClick={()=>cambiarPeriodo(id)}><strong>{periodos[id]?.meta?.nombre||id}</strong><span>{Object.keys(periodos[id]?.salones||{}).length} salones</span></button>)}</div></Panel>{esAdmin?<><Panel title="Importar listas de salones (JSON)" icon={FileUp}><p className="ag-muted">Selecciona el archivo preparado en <code>datos_importacion/</code>. Se importan solo nombres y números de control, nunca CURP ni fechas de nacimiento. La importación NO reemplaza un salón ya existente.</p><input className="ag-file" type="file" accept=".json,application/json" onChange={onArchivo}/>{importInfo&&<div className="ag-confirm"><strong>{importFile?.name}</strong><p>{importFile?.salones} salones · {importFile?.total} estudiantes · ciclo {importInfo.periodo.id}</p><SmallButton variant="primary" disabled={!!operacion} onClick={importar}><FileUp size={17}/> Confirmar importación segura</SmallButton></div>}</Panel><Panel title="Crear ciclo para próximos años" icon={CalendarClock}><div className="ag-simple-form"><label>Identificador (ej. 2027-2028-A)<input value={nuevoPeriodo.id} onChange={e=>setNuevoPeriodo({...nuevoPeriodo,id:e.target.value.toUpperCase()})} placeholder="2027-2028-A"/></label><label>Lunes de inicio<input type="date" value={nuevoPeriodo.lunesBase} onChange={e=>setNuevoPeriodo({...nuevoPeriodo,lunesBase:e.target.value})}/></label><label>Primera semana<input type="number" min="1" step="1" value={nuevoPeriodo.semanaBase} onChange={e=>setNuevoPeriodo({...nuevoPeriodo,semanaBase:e.target.value})}/></label><SmallButton variant="primary" disabled={!!operacion} onClick={crearPeriodo}><Plus size={17}/> Crear ciclo vacío</SmallButton></div></Panel>{periodo&&<Panel title="Gestionar salón e integrantes" icon={UsersRound}><div className="ag-simple-form"><label>Nuevo salón<input value={nuevoSalon} onChange={e=>setNuevoSalon(e.target.value)} placeholder="Ej. 107"/></label><SmallButton disabled={!!operacion} onClick={crearSalon}><Plus size={17}/> Crear salón</SmallButton></div>{datos?.meta&&<div className="ag-simple-form"><label>Nombre del nuevo estudiante<input value={nuevoEstudiante.nombre} onChange={e=>setNuevoEstudiante({...nuevoEstudiante,nombre:e.target.value})} placeholder="Nombre completo"/></label><label>Número de control (opcional)<input value={nuevoEstudiante.control} onChange={e=>setNuevoEstudiante({...nuevoEstudiante,control:e.target.value})} placeholder="N.º de control"/></label><SmallButton disabled={!!operacion} onClick={agregarAlumno}><Plus size={17}/> Agregar estudiante</SmallButton></div>}</Panel>}</>:<div className="ag-note"><LockKeyhole size={17}/> Un administrador debe iniciar sesión para importar listas o crear nuevos ciclos escolares.</div>}</>}
        <footer className="ag-footer"><div><img src="/icons/cerdito-192.png" alt="" width="32" height="32"/> AhorroGrupal · Ingeniería Industrial</div><button onClick={instalar}><Download size={17}/> {instalada?'App instalada':'Instalar app'}</button></footer>
      </main>}
    </div>
    {toast&&<div role="status" className="ag-toast">{toast}<button onClick={()=>setToast('')} aria-label="Cerrar"><X size={15}/></button></div>}
    {loginOpen&&<div className="ag-backdrop" onMouseDown={e=>{if(e.target===e.currentTarget)setLoginOpen(false);}}><div className="ag-modal" role="dialog" aria-modal="true" aria-label="Administración"><button className="ag-modal-close" onClick={()=>setLoginOpen(false)}><X size={20}/></button><div className="ag-modal-mark"><LockKeyhole size={26}/></div><h2>Acceso administrativo</h2>{usuario&&!esAdmin?<p>Sesión iniciada, pero el UID no está autorizado en <code>adminUids</code>. Revisa el permiso de la cuenta de Firebase.</p>:<p>Solo las cuentas autorizadas pueden registrar movimientos.</p>}<form onSubmit={signIn}><label>Correo electrónico<input type="email" autoComplete="username" required value={email} onChange={e=>setEmail(e.target.value)}/></label><label>Contraseña<div className="ag-password"><input type={seePassword?'text':'password'} autoComplete="current-password" required value={password} onChange={e=>setPassword(e.target.value)}/><button type="button" onClick={()=>setSeePassword(!seePassword)}>{seePassword?<EyeOff size={18}/>:<Eye size={18}/>}</button></div></label>{loginError&&<div className="ag-error">{loginError}</div>}<SmallButton type="submit" variant="primary" disabled={loginBusy}><ShieldCheck size={18}/> {loginBusy?'Verificando…':'Iniciar sesión'}</SmallButton></form><button className="ag-link" type="button" onClick={resetPassword}>¿Olvidaste tu contraseña?</button>{usuario&&!esAdmin&&<button className="ag-link" type="button" onClick={()=>signOut(auth)}>Cerrar sesión actual</button>}</div></div>}
    {modalInstalar&&<div className="ag-backdrop" onMouseDown={e=>{if(e.target===e.currentTarget)setModalInstalar(false);}}><div className="ag-modal" role="dialog" aria-modal="true" aria-label="Instalar aplicación"><button className="ag-modal-close" onClick={()=>setModalInstalar(false)}><X size={20}/></button><img src="/icons/cerdito-192.png" alt="Cerdito" width="80" height="80"/><h2>Instalar AhorroGrupal</h2><p>Android: menú de Chrome → Instalar app. iPhone: Safari → Compartir → Añadir a inicio. Computadora: opción Instalar en Chrome o Edge.</p></div></div>}
  </div>;
}
