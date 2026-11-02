import { useEffect, useMemo, useRef, useState } from 'react';
import { initializeApp, getApps, getApp } from 'firebase/app';
import { getAuth, connectAuthEmulator, onAuthStateChanged, signInWithEmailAndPassword, signOut, sendPasswordResetEmail } from 'firebase/auth';
import { getDatabase, connectDatabaseEmulator, ref, get, onValue, runTransaction, push, set } from 'firebase/database';
import {
  BookOpen, Bell, BellRing, CalendarClock, Check, CheckCircle2,
  CircleDollarSign, Download, History, LockKeyhole, UserRound,
  LogOut, Menu, Minus, Plus, Search, ShieldCheck, UsersRound, Wallet, X,
  AlertTriangle, GraduationCap, ArrowDownRight, Eye, EyeOff, LayoutDashboard, UserCog, FileSpreadsheet, PauseCircle, PlayCircle,
} from 'lucide-react';
import { cuotaDeSalon, esLunes, estadoSemana, fechaMexico, isClassCode, isPeriodId, pagoClave, semanaPeriodo } from '../lib/aulas.js';
import {corteActivo, esPeriodoReinicio, rutaPagos, rutaRetiros, inicioAportaciones, resumirAhorroReiniciado} from '../lib/reinicioContable.js';
import {esSemanaAnterior, rutaPagoSeleccionado, primeraSemanaVisible, esPagoLegado, resumenPagosAnteriores} from '../lib/pagosAnteriores.js';
import { nombreParaMostrar, normalizarBusquedaNombre } from '../lib/nombres.js';
import { esResponsableDeSalon } from '../lib/roles.js';
import { distribucionNueva, generacionDeAula, resumirFondos } from '../lib/fondos.js';
import { informeVisibleSegunRol } from '../lib/informeRoles.js';
import { periodoSiguiente, salonSiguiente } from '../lib/semestres.js';
import { prepararExcel, revisarCoincidencias } from '../lib/importarExcel.js';
import { aplicarVacaciones, esConfirmacionValida } from '../lib/vacaciones.js';
import './index.css';
import './App.css';

const usarEmuladores = import.meta.env.DEV && import.meta.env.VITE_USE_FIREBASE_EMULATORS !== 'false';
const firebaseConfig = {
  apiKey: usarEmuladores ? 'demo-ahorro-key' : 'AIzaSyA3AN8yCezlw3ORkPUCZp0Af97JgAoMbOE',
  authDomain: usarEmuladores ? 'demo-ahorro-grupal.firebaseapp.com' : 'ahorro-grupal-industrial.firebaseapp.com',
  projectId: usarEmuladores ? 'demo-ahorro-grupal' : 'ahorro-grupal-industrial',
  storageBucket: 'ahorro-grupal-industrial.firebasestorage.app',
  messagingSenderId: '493506921547',
  appId: '1:493506921547:web:97ece4e262f02b6a9eb9ce',
  databaseURL: usarEmuladores ? 'https://demo-ahorro-grupal-default-rtdb.firebaseio.com' : 'https://ahorro-grupal-industrial-default-rtdb.firebaseio.com',
};
const app = getApps().length ? getApp() : initializeApp(firebaseConfig);
const database = getDatabase(app);
const auth = getAuth(app);
if (usarEmuladores) {
  connectAuthEmulator(auth, 'http://127.0.0.1:9099', {disableWarnings: true});
  connectDatabaseEmulator(database, '127.0.0.1', 9000);
}
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

function PlazaResponsable({periodo,salon,plaza,persona,ocupada,busy,guardar,reenviar}) {
  const [nombre,setNombre]=useState('');
  const [correo,setCorreo]=useState('');
  return <div className="ag-role-slot ag-role-card">
    <strong>Responsable {plaza}</strong>
    {ocupada ? <>
      <div className="ag-role-persona"><b>{persona?.nombre||'Responsable asignado'}</b><small>{persona?.correo||'Consultando la cuenta…'}</small>{persona?.activo===false&&<small>Cuenta deshabilitada o no encontrada</small>}</div>
      <SmallButton disabled={busy||!persona?.correo} onClick={()=>reenviar(persona.correo)}>Enviar acceso de nuevo</SmallButton>
      <SmallButton disabled={busy} onClick={()=>guardar({accion:'revocar',periodo,salon,plaza})}>Revocar acceso</SmallButton>
    </> : <form className="ag-role-invite" onSubmit={e=>{e.preventDefault();guardar({accion:'asignar',periodo,salon,plaza,nombre,correo});}}>
      <label>Nombre completo<input value={nombre} onChange={e=>setNombre(e.target.value)} autoComplete="name" placeholder="Nombre y apellidos" required minLength={3} maxLength={100}/></label>
      <label>Correo electrónico<input type="email" value={correo} onChange={e=>setCorreo(e.target.value)} autoComplete="off" placeholder="persona@correo.com" required/></label>
      <SmallButton type="submit" variant="primary" disabled={busy}>Crear acceso / invitar</SmallButton>
    </form>}
  </div>;
}

export default function App() {
  const [periodos,setPeriodos]=useState({});
  const [periodoId,setPeriodoId]=useState(()=>localStorage.getItem('ag:periodo')||defaultPeriod);
  const [salonId,setSalonId]=useState(()=>localStorage.getItem('ag:salon')||'507');
  const [dataSnapshot,setDataSnapshot]=useState(null);
  const [cargando,setCargando]=useState(true);
  const [dbError,setDbError]=useState('');
  const [usuario,setUsuario]=useState(null);
  const [uidAdminGeneral,setUidAdminGeneral]=useState('');
  const [asignacion,setAsignacion]=useState(null);
  const [responsables,setResponsables]=useState({});
  const [perfilesResponsables,setPerfilesResponsables]=useState({});
  const [errorResponsables,setErrorResponsables]=useState('');
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
  const [vista,setVista]=useState('panel');
  const [fecha,setFecha]=useState(()=>Date.now());
  const [semanaElegida,setSemanaElegida]=useState(0);
  const [mostrarMenu,setMostrarMenu]=useState(false);
  const [nuevoPeriodo,setNuevoPeriodo]=useState({id:'',lunesBase:'',semanaBase:1});
  const [nuevoSalon,setNuevoSalon]=useState('');
  const [nuevoEstudiante,setNuevoEstudiante]=useState({nombre:'',control:''});
  const [importInfo,setImportInfo]=useState(null);
  const [importFile,setImportFile]=useState(null);
  const [retiro,setRetiro]=useState({monto:'',motivo:''});
  const [estadoReporteFondos,setReporteFondos]=useState(null);
  const [estadoReporteError,setReporteError]=useState(null);
  const [notificaciones,setNotificaciones]=useState(typeof Notification!=='undefined' && Notification.permission==='granted');
  const [instalarEvento,setInstalarEvento]=useState(null);
  const [modalInstalar,setModalInstalar]=useState(false);
  const [instalada,setInstalada]=useState(()=>window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone===true);
  const primerEvento=useRef(null);
  const esAdminGeneral=Boolean(usuario && uidAdminGeneral && uidAdminGeneral===usuario.uid);
  const esResponsable=Boolean(usuario && !esAdminGeneral && esResponsableDeSalon(asignacion,periodoId,salonId));
  const esAdmin=esAdminGeneral || esResponsable;
  const vistaActiva=esAdminGeneral?vista:(vista==='panel'?'pagos':vista);
  const datos=dataSnapshot?.periodo===periodoId && dataSnapshot?.salon===salonId ? dataSnapshot.value : null;
  const reporteClave=`${periodoId}/${salonId}`;
  const reporteFondos=esAdmin && estadoReporteFondos?.clave===reporteClave && estadoReporteFondos?.uid===usuario?.uid ? estadoReporteFondos.informe : null;
  const reporteError=esAdmin && estadoReporteError?.clave===reporteClave && estadoReporteError?.uid===usuario?.uid ? estadoReporteError.texto : '';


  // Nuevos roles: un solo administrador general y dos plazas por salón.
  // Antes de publicar se deben configurar roles/adminGeneralUid y probar las reglas en el emulador.
  useEffect(()=>{
    const unsub=onAuthStateChanged(auth,u=>{
      setUsuario(u);setUidAdminGeneral('');setAsignacion(null);setLoginError('');
      setPeriodos({});setDbError('');setDataSnapshot(null);
      setResponsables({});setPerfilesResponsables({});setReporteFondos(null);setReporteError(null);
      setSemanaElegida(0);setSearch('');
    });
    return ()=>unsub();
  },[]);
  useEffect(()=>{
    if(!usuario)return;
    const stop1=onValue(ref(database,'roles/adminGeneralUid'),snap=>{
      const uid=snap.val()||'';
      setUidAdminGeneral(uid);
      if(uid===usuario.uid)setLoginOpen(false);
    },err=>setLoginError(`No se pudo leer el administrador general: ${avisoError(err)}`));
    const stop2=onValue(ref(database,`roles/porUsuario/${usuario.uid}`),snap=>{
      const rol=snap.val()||null;
      setAsignacion(rol);
      if(rol?.periodo && rol?.salon){
        setPeriodoId(rol.periodo);setSalonId(rol.salon);
        setDataSnapshot(null);setSemanaElegida(0);setSearch('');setCargando(true);
        localStorage.setItem('ag:periodo',rol.periodo);localStorage.setItem('ag:salon',rol.salon);
        setLoginOpen(false);
      }
    },err=>setLoginError(`No se pudo leer tu grupo: ${avisoError(err)}`));
    return ()=>{stop1();stop2();};
  },[usuario]);
  useEffect(()=>{
    if(!esAdmin)return;
    const stop=onValue(ref(database,'periodos'),snap=>{
      setPeriodos(snap.val()||{});setDbError('');
    },err=>setDbError(avisoError(err)));
    return ()=>stop();
  },[esAdmin,periodoId]);
  useEffect(()=>{
    if(!esAdmin)return;
    const stop=onValue(ref(database,`aulas/${periodoId}/${salonId}`),snap=>{setDataSnapshot({periodo:periodoId,salon:salonId,value:snap.val()});setCargando(false);setDbError('');},err=>{setCargando(false);setDbError(avisoError(err));});
    return ()=>stop();
  },[esAdmin,periodoId,salonId]);
  useEffect(()=>{
    if(!esAdminGeneral)return;
    const stop1=onValue(ref(database,'roles/responsables'),snap=>setResponsables(snap.val()||{}),err=>setDbError(avisoError(err)));
    return ()=>stop1();
  },[esAdminGeneral]);
  useEffect(()=>{
    if(!esAdminGeneral||!usuario||vista!=='roles')return;
    let cancelado=false;
    const cargar=async()=>{
      try{
        const token=await usuario.getIdToken();
        const respuesta=await fetch(`/api/responsables?periodo=${encodeURIComponent(periodoId)}`,{headers:{Authorization:`Bearer ${token}`}});
        const cuerpo=await respuesta.json().catch(()=>({}));
        if(!respuesta.ok)throw Error(cuerpo.error||`Error HTTP ${respuesta.status}`);
        if(!cancelado){setPerfilesResponsables(cuerpo.perfiles||{});setErrorResponsables('');}
      }catch(error){if(!cancelado)setErrorResponsables(`No se pudieron consultar los responsables: ${error.message}`);}
    };
    void cargar();
    return ()=>{cancelado=true;};
  },[esAdminGeneral,usuario,vista,periodoId,responsables]);
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

  const periodKeys=Object.keys(periodos).filter(id=>esAdminGeneral || (asignacion?.periodo===id)).sort().reverse();
  const periodo=periodos[periodoId]||null;
  const destinoSiguiente=(()=>{try{return periodoSiguiente(periodoId);}catch{return '';}})();
  const salones=Object.keys(periodo?.salones||{}).filter(id=>esAdminGeneral || (asignacion?.periodo===periodoId && asignacion?.salon===id)).sort((a,b)=>a.localeCompare(b,'es',{numeric:true}));
  const vacacionesActivas=periodo?.meta?.vacaciones?.activas===true;
  const semanaActual=semanaPeriodo(periodo?.meta,fecha);
  const semanaMinima=primeraSemanaVisible(periodos,periodoId,periodo?.meta,datos?.meta);
  const semana=Math.max(semanaMinima,Math.min(semanaElegida||semanaActual,semanaActual));
  const cuotaSemanal=cuotaDeSalon(salonId,datos?.meta);
  const generacionId=generacionDeAula(periodoId,salonId,datos?.meta);
  const integrantes=useMemo(()=>datos?.integrantes||{},[datos]);
  const lista=useMemo(()=>Object.entries(integrantes).map(([id,v])=>({id,...v,nombreVisible:nombreParaMostrar(v.nombre,id,v.formatoNombre)})).sort((a,b)=> a.nombreVisible.localeCompare(b.nombreVisible,'es',{sensitivity:'base'}) || a.nombre.localeCompare(b.nombre,'es') || a.id.localeCompare(b.id)),[integrantes]);
  const ahorroNuevoActivo=corteActivo(periodos);
  const esCorteEnSalon=esPeriodoReinicio(periodos,periodoId);
  const nodoPagos=rutaPagos(periodos,periodoId);
  const nodoRetiros=rutaRetiros(periodos,periodoId);
  const pagos=datos?.[nodoPagos]||{};
  const esAnterior=esSemanaAnterior(periodos,periodoId,semana);
  const nodoPagoSemana=rutaPagoSeleccionado(periodos,periodoId,semana);
  const pagosSemana=datos?.[nodoPagoSemana]||{};
  const pagosLegado=datos?.pagos||{};
  const pagosAnteriores=datos?.pagosAnteriores||{};
  const resumenAnterior=resumenPagosAnteriores(pagosAnteriores);
  const retiros=useMemo(()=>datos?.[nodoRetiros]||{},[datos,nodoRetiros]);
  const mensajesRetiro=useMemo(()=>Object.entries(retiros).map(([id,r])=>({id,...r})).sort((a,b)=>(b.creadoEn||0)-(a.creadoEn||0)),[retiros]);
  const avisosVisibles=useMemo(()=>mensajesRetiro.filter(r=>r.fondo==='carrera'||!r.fondo),[mensajesRetiro]);
  useEffect(()=>{
    if(!esAdmin||!usuario)return;
    let ignorar=false;
    const actualizar=async()=>{
      try{
        let informe;
        if(usarEmuladores){
          // Sólo en demo: Vite no ejecuta las funciones API de Vercel.
          const salonesPrueba={};
          for(const [p, info] of Object.entries(periodos)){
            for(const salon of Object.keys(info.salones||{})){
              if(!esAdminGeneral && (p!==periodoId || salon!==salonId))continue;
              const snap=await get(ref(database,`aulas/${p}/${salon}`));
              if(snap.exists())(salonesPrueba[p] ||= {})[salon]=snap.val();
            }
          }
          if(periodoId==='2026-2027-A'&&!ahorroNuevoActivo)throw Error('El nuevo ahorro no está activado; el saldo anterior no se muestra.');
          const resumenPrueba=ahorroNuevoActivo?resumirAhorroReiniciado(salonesPrueba,periodos):resumirFondos(salonesPrueba,{});
          informe=informeVisibleSegunRol(resumenPrueba,{tipo:esAdminGeneral?'general':'responsable'},generacionId);
        }else{
          const token=await usuario.getIdToken();
          const url=`/api/resumen-carrera?periodo=${encodeURIComponent(periodoId)}&salon=${encodeURIComponent(salonId)}`;
          const response=await fetch(url,{headers:{Authorization:`Bearer ${token}`},cache:'no-store'});
          informe=await response.json().catch(()=>({}));
          if(!response.ok)throw Error(informe.error||`HTTP ${response.status}`);
        }
        if(!ignorar){setReporteFondos({clave:reporteClave,uid:usuario.uid,informe});setReporteError({clave:reporteClave,uid:usuario.uid,texto:''});}
      }catch(error){if(!ignorar){setReporteFondos(null);setReporteError({clave:reporteClave,uid:usuario.uid,texto:`No se pudo calcular el ahorro de carrera: ${error.message}`});}}
    };
    actualizar();
    return ()=>{ignorar=true;};
  },[esAdmin,esAdminGeneral,usuario,periodoId,salonId,datos,reporteClave,periodos,generacionId,ahorroNuevoActivo]);
  const semanaInicio=inicioAportaciones(periodos,periodoId,datos?.meta);
  const vigenteParaRegistrar=semana<=semanaActual && (esAnterior || semana>=semanaInicio)
    && (periodoId!=='2026-2027-A'||ahorroNuevoActivo);
  const estadoAlumno=e=>{
    if(!vigenteParaRegistrar)return 'sin-dato';
    if(esAnterior && esPagoLegado(pagosLegado,e.id,semana))return 'pagado';
    return estadoSemana(pagosSemana,e.id,semana);
  };
  const detalleSemana=lista.map(e=>({...e,estado:estadoAlumno(e)}));
  const pagaron=detalleSemana.filter(e=>estadoAlumno(e)==='pagado').length;
  const pendientes=detalleSemana.filter(e=>estadoAlumno(e)==='pendiente').length;
  const consulta=normalizarBusquedaNombre(search.trim());
  const visible=detalleSemana.filter(e=> !consulta || normalizarBusquedaNombre([e.nombreVisible,e.nombre,e.aliasLegado,e.control].join(' ')).includes(consulta)).filter(e=>filtro==='todos'||estadoAlumno(e)===filtro);
  const pagosHist=Object.entries(pagos).flatMap(([id,p])=>{
    if(!p?.estudianteId)return [];
    const eventos=Object.entries(p.historial||{});
    return eventos.length ? eventos.map(([key,ev])=>({id:`${id}-${key}`,nombre:p.nombre,estudianteId:p.estudianteId,semana:p.semana,monto:p.monto,estado:ev.tipo==='registro'?'pagado':'anulado',creadoEn:ev.fecha,registradoPor:ev.uid,motivo:ev.motivo||''})) : [{id,...p}];
  }).sort((a,b)=>(b.creadoEn||0)-(a.creadoEn||0));
  const pagosHistAnteriores=Object.entries(pagosAnteriores).flatMap(([id,p])=>{
    if(!p?.estudianteId)return [];
    const eventos=Object.entries(p.historial||{});
    return eventos.length ? eventos.map(([key,ev])=>({id:`${id}-${key}`,nombre:p.nombre,estudianteId:p.estudianteId,semana:p.semana,monto:p.monto,estado:ev.tipo==='registro'?'pagado':'anulado',creadoEn:ev.fecha,motivo:ev.motivo||''})) : [{id,...p}];
  }).sort((a,b)=>(b.creadoEn||0)-(a.creadoEn||0));

  useEffect(()=>{
    const events=avisosVisibles.map(r=>`${r.id}:${r.estado}`).sort();
    const current=events.join('|');
    if(primerEvento.current===null){primerEvento.current=current;return;}
    if(primerEvento.current!==current && notificaciones && typeof Notification!=='undefined' && Notification.permission==='granted'){
      const ultimo=avisosVisibles[0];
      if(ultimo){try {new Notification('Ahorro Grupal · Movimiento de caja',{body:`Retiro ${ultimo.estado}: ${pesos(ultimo.monto)} · ${ultimo.motivo}` ,icon:'/icons/cerdito-192.png'});}catch{/* navegador no admite aviso */}}
    }
    primerEvento.current=current;
  },[avisosVisibles,notificaciones]);
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
  const cambiarPeriodo=id=>{if(!esAdminGeneral)return;
    setPeriodoId(id);
    setDataSnapshot(null);setCargando(true);setSemanaElegida(0);setSearch('');
    localStorage.setItem('ag:periodo',id);
    const listaGrupos=Object.keys(periodos[id]?.salones||{}).sort((a,b)=>a.localeCompare(b,'es',{numeric:true}));
    const next=listaGrupos.includes(salonId)?salonId:(listaGrupos[0]||'507');
    setSalonId(next);localStorage.setItem('ag:salon',next);
  };
  const cambiarSalon=id=>{if(!esAdminGeneral)return;setSalonId(id);setDataSnapshot(null);setCargando(true);setSemanaElegida(0);setSearch('');localStorage.setItem('ag:salon',id);};
  // Importación local de Excel: nunca subimos CURP u otros campos del archivo.
  // Los integrantes nuevos se crean con transacciones individuales; los existentes no se editan.
  const importar=async()=>{
    if(!esAdminGeneral || !importInfo || importInfo.periodoId!==periodoId)return;
    await withOperation('importar-excel',async()=>{
      const metaReal=(await get(ref(database,`periodos/${periodoId}/meta`))).val();
      if(!metaReal||metaReal.cerradoEn)throw Error('Primero selecciona un ciclo activo. Un Excel no puede crear o reabrir ciclos escolares.');
      const planes=[];
      for(const [codigo,estudiantes] of Object.entries(importInfo.salones)){
        const actuales=(await get(ref(database,`aulas/${periodoId}/${codigo}/integrantes`))).val()||{};
        const revision=revisarCoincidencias(estudiantes,actuales);
        if(revision.conflictos.length){
          throw Error(`El salón ${codigo} tiene ${revision.conflictos.length} conflicto(s) entre nombre, número de control o identificador. Revisa el Excel antes de continuar.`);
        }
        planes.push({codigo,...revision});
      }
      const nuevos=planes.reduce((n,p)=>n+p.nuevos.length,0);
      const repetidos=planes.reduce((n,p)=>n+p.repetidos.length,0);
      if(nuevos===0){setImportInfo(null);setImportFile(null);return `No hubo altas nuevas: ${repetidos} estudiantes ya estaban registrados. No se modificaron pagos ni expedientes.`;}
      if(!window.confirm(`Se agregarán ${nuevos} estudiantes nuevos a ${planes.length} salón(es) del ciclo ${periodoId}. ${repetidos} registros existentes se omitirán. NO se reemplazarán alumnos ni pagos. ¿Confirmas la importación?`))return;
      let creados=0,omitidos=0;
      try{
        for(const plan of planes){
          if(!plan.nuevos.length)continue;
          const {codigo}=plan;
          await runTransaction(ref(database,`periodos/${periodoId}/salones/${codigo}`),actual=>actual===null?{nombre:`Salón ${codigo}`}:undefined,{applyLocally:false});
          const distribucion=distribucionNueva(periodoId,codigo);
          await runTransaction(ref(database,`aulas/${periodoId}/${codigo}/meta`),actual=>actual===null?{
            nombre:`Salón ${codigo}`,inicioDetalle:semanaActual,cuotaSemanal:distribucion.cuota,
            tipoAhorro:'carrera',generacionId:generacionDeAula(periodoId,codigo),creadoEn:Date.now()
          }:undefined,{applyLocally:false});
          for(const alumno of plan.nuevos){
            const r=await runTransaction(ref(database,`aulas/${periodoId}/${codigo}/integrantes/${alumno.id}`),actual=>actual===null?{
              nombre:alumno.nombre,control:alumno.control
            }:undefined,{applyLocally:false});
            if(r.committed)creados++;else omitidos++;
          }
        }
      }catch(err){throw Error(`La importación se interrumpió después de ${creados} altas. Puedes volver a seleccionar el mismo archivo: los registros existentes no se reemplazarán. Detalle: ${avisoError(err)}`,{cause:err});}
      setImportInfo(null);setImportFile(null);
      return `Importación terminada: ${creados} nuevos estudiantes, ${repetidos+omitidos} existentes omitidos. Pagos y saldos sin cambios.`;
    });
  };
  const onArchivo=async(e)=>{
    const archivo=e.target.files?.[0];
    if(e.target)e.target.value='';
    if(!archivo||!esAdminGeneral)return;
    setImportInfo(null);setImportFile(null);
    try{
      if(!periodo?.meta||periodo.meta.cerradoEn)throw Error('Selecciona un ciclo escolar activo antes de importar.');
      if(!/\.xlsx$/i.test(archivo.name))throw Error('Selecciona un archivo de Excel .xlsx (no .xls ni .json).');
      if(archivo.size>2_000_000)throw Error('El archivo supera 2 MB.');
      // Esta dependencia solo se carga al seleccionar Excel, para no aumentar el inicio de la app.
      const {default:leerLibro}=await import('read-excel-file/browser');
      const hojas=await leerLibro(archivo);
      const resultado=prepararExcel(hojas,salonId);
      setImportInfo({...resultado,periodoId});
      setImportFile({name:archivo.name,total:resultado.total,salones:resultado.salonesCount});
    }catch(err){setToast(`No se pudo preparar el Excel: ${avisoError(err)}`);}
  };
  const crearPeriodo=async()=>{
    if(!esAdminGeneral)return;
    const {id,lunesBase,semanaBase}=nuevoPeriodo;
    if(!isPeriodId(id)||!esLunes(lunesBase)||!Number.isInteger(Number(semanaBase))||Number(semanaBase)<1){setToast('Indica un periodo como 2027-2028-A y una fecha de lunes válida.');return;}
    await withOperation('periodo',async()=>{
      const result=await runTransaction(ref(database,`periodos/${id}/meta`),a=>a===null?{nombre:id,lunesBase,semanaBase:Number(semanaBase),creadoEn:Date.now()}:undefined,{applyLocally:false});
      if(result.committed){cambiarPeriodo(id);setNuevoPeriodo({id:'',lunesBase:'',semanaBase:1});}
      return result.committed?'Nuevo ciclo creado. Agrega un salón o importa una lista.':'Ese ciclo ya existe; no se reemplazó.';
    });
  };
  const crearSalon=async()=>{
    const id=nuevoSalon.trim();if(!esAdminGeneral||!periodo||!isClassCode(id)){setToast('Indica un código de salón válido.');return;}
    await withOperation('salon',async()=>{
      const result=await runTransaction(ref(database,`aulas/${periodoId}/${id}/meta`),a=>a===null?{nombre:`Salón ${id}`,inicioDetalle:semanaActual,cuotaSemanal:distribucionNueva(periodoId,id).cuota,tipoAhorro:distribucionNueva(periodoId,id).grupo>0?'mixto':'carrera',generacionId:generacionDeAula(periodoId,id),creadoEn:Date.now()}:undefined,{applyLocally:false});
      if(!result.committed)return 'Ese salón ya existe.';
      await set(ref(database,`periodos/${periodoId}/salones/${id}`),{nombre:`Salón ${id}`});
      cambiarSalon(id);setNuevoSalon('');return 'Salón creado sin registros anteriores.';
    });
  };
  const agregarAlumno=async()=>{
    if(!esAdminGeneral||!datos?.meta)return;
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
    if(!esAdmin||!vigenteParaRegistrar||vacacionesActivas||periodo?.meta?.cerradoEn)return;
    const key=pagoClave(e.id,semana);
    if(pagosSemana[key]?.estado==='pagado' || (esAnterior && esPagoLegado(pagosLegado,e.id,semana)))return;
    await withOperation(`pago:${e.id}`,async()=>{
      const eventoId=push(ref(database,`aulas/${periodoId}/${salonId}/${nodoPagoSemana}`)).key;
      const r=await runTransaction(ref(database,`aulas/${periodoId}/${salonId}/${nodoPagoSemana}/${key}`),v=>{
        if(v?.estado==='pagado')return;
        const cuando=Date.now();
        const d=distribucionNueva(periodoId,salonId,datos.meta);
        if(cuotaSemanal!==d.cuota)throw Error('La cuota del salón y el tipo de ahorro no coinciden.');
        return {...(v||{}),estudianteId:e.id,nombre:e.nombre,semana,monto:cuotaSemanal,fondoGrupo:esAnterior?0:d.grupo,fondoCarrera:esAnterior?0:d.carrera,...(esAnterior?{tipoRegistro:'anterior'}:{}),estado:'pagado',creadoEn:cuando,registradoPor:usuario.uid,correcciones:v?.correcciones||0,historial:{...(v?.historial||{}),[eventoId]:{tipo:'registro',fecha:cuando,uid:usuario.uid}}};
      },{applyLocally:false});
      return r.committed?`Pago de ${pesos(cuotaSemanal)} registrado para ${e.nombreVisible}, semana ${semana}${esAnterior?' en PAGOS ANTERIORES (fuera del fondo actual)':''}.`:'Esta semana ya estaba pagada.';
    });
  };
  const anularPago=async e=>{
    if(!esAdminGeneral||!vigenteParaRegistrar||vacacionesActivas||periodo?.meta?.cerradoEn)return;
    const motivo=window.prompt(`Motivo de anular el pago de ${e.nombreVisible} (semana ${semana}):`);
    if(motivo===null)return;
    if(motivo.trim().length<5){setToast('Escribe un motivo de al menos 5 caracteres para la corrección.');return;}
    const key=pagoClave(e.id,semana);
    await withOperation(`anular:${e.id}`,async()=>{
      const eventoId=push(ref(database,`aulas/${periodoId}/${salonId}/${nodoPagoSemana}`)).key;
      const r=await runTransaction(ref(database,`aulas/${periodoId}/${salonId}/${nodoPagoSemana}/${key}`),v=>{
        if(!v||v.estado!=='pagado')return;
        const cuando=Date.now();
        return {...v,estado:'anulado',anuladoEn:cuando,anuladoPor:usuario.uid,correcciones:(v.correcciones||0)+1,historial:{...(v.historial||{}),[eventoId]:{tipo:'anulacion',fecha:cuando,uid:usuario.uid,motivo:motivo.trim()}}};
      },{applyLocally:false});
      return r.committed?'Pago anulado; queda registrado en el historial.':'El pago ya no estaba activo.';
    });
  };
  const solicitarRetiro=async e=>{
    e.preventDefault();if(!esAdmin||periodo?.meta?.cerradoEn||(periodoId==='2026-2027-A'&&!ahorroNuevoActivo))return;
    const valor=Number(retiro.monto);
    if(!Number.isSafeInteger(valor)||valor<=0||valor>1000000||retiro.motivo.trim().length<6){setToast('Indica un importe entero positivo y un motivo de al menos 6 caracteres.');return;}
    await withOperation('retiro',async()=>{
      const destino=push(ref(database,`aulas/${periodoId}/${salonId}/${nodoRetiros}`));
      await set(destino,{monto:valor,motivo:retiro.motivo.trim(),fondo:'carrera',estado:'solicitado',solicitadoPor:usuario.uid,creadoEn:Date.now()});
      setRetiro({monto:'',motivo:''});return 'Solicitud de retiro publicada; el saldo aún no cambió.';
    });
  };
  const resolverRetiro=async(r,estado)=>{
    if(!esAdminGeneral||periodo?.meta?.cerradoEn||r.estado!=='solicitado'||r.fondo!=='carrera')return;
    // El saldo del fondo correcto se valida atómicamente en el servidor.
    if(!window.confirm(`¿${estado==='aprobado'?'Aprobar y descontar':'Rechazar'} la solicitud de ${pesos(r.monto)}?`))return;
    await withOperation(`retiro:${r.id}`,async()=>{
      // La aprobación se realiza exclusivamente en servidor: verifica el ID token,
      // el UID general y el saldo usando una transacción atómica de todo el salón.
      // El cliente no obtiene permiso de escritura sobre el salón completo.
      const idToken=await usuario.getIdToken();
      const response=await fetch('/api/resolver-retiro',{
        method:'POST',
        headers:{'Authorization':`Bearer ${idToken}`,'Content-Type':'application/json'},
        body:JSON.stringify({periodo:periodoId,salon:salonId,retiroId:r.id,estado}),
      });
      const body=await response.json().catch(()=>({}));
      if(!response.ok)throw Error(body.error || `No se pudo resolver el retiro (HTTP ${response.status}).`);
      return `Retiro ${estado}. ${estado==='aprobado'?'El saldo se actualizó automáticamente.':'No se descontó dinero.'}`;
    });
  };
  const controlarVacaciones=async accion=>{
    if(!esAdminGeneral||!usuario||!periodo?.meta||periodo.meta.cerradoEn)return;
    const accionTexto=accion==='iniciar'?'INICIAR VACACIONES':'REANUDAR CLASES';
    const confirmacion=window.prompt(
      `${accionTexto} en el ciclo ${periodoId}.\n\n`+
      (accion==='iniciar'
        ? `La semana ${semanaActual} quedará congelada. No se registrarán nuevas aportaciones hasta reanudar.\n\n`
        : `Se retomará la semana ${semanaActual}; la siguiente empezará el próximo lunes. No se cobrarán semanas de vacaciones.\n\n`)+
      'Escribe exactamente CONFIRMAR para continuar:'
    );
    if(confirmacion===null)return;
    if(!esConfirmacionValida(confirmacion)){setToast('Operación cancelada: debes escribir exactamente CONFIRMAR.');return;}
    await withOperation(`vacaciones:${accion}`,async()=>{
      if(usarEmuladores){
        const ahora=Date.now();
        const r=await runTransaction(ref(database,`periodos/${periodoId}/meta`),meta=>{
          try{return aplicarVacaciones(meta,accion,ahora);}catch{return;}
        },{applyLocally:false});
        if(!r.committed)throw Error('El estado del calendario cambió o la operación no está permitida.');
        return accion==='iniciar'?`Vacaciones iniciadas. Semana ${r.snapshot.val().vacaciones.semanaPausada} congelada.`:'Clases reanudadas. La siguiente semana comenzará el próximo lunes.';
      }
      const token=await usuario.getIdToken();
      const respuesta=await fetch('/api/control-vacaciones',{
        method:'POST',headers:{Authorization:`Bearer ${token}`,'Content-Type':'application/json'},
        body:JSON.stringify({periodo:periodoId,accion,confirmacion}),
      });
      const body=await respuesta.json().catch(()=>({}));
      if(!respuesta.ok)throw Error(body.error||`No se pudo modificar el calendario (HTTP ${respuesta.status}).`);
      return accion==='iniciar'?`Vacaciones iniciadas. Semana ${body.semana} congelada.`:'Clases reanudadas. La siguiente semana comenzará el próximo lunes.';
    });
  };
  const activarReinicioSeguro=async()=>{
    if(!esAdminGeneral||!usuario||periodoId!=='2026-2027-A'||ahorroNuevoActivo)return;
    await withOperation('activar-reinicio',async()=>{
      const token=await usuario.getIdToken();
      const headers={Authorization:`Bearer ${token}`};
      const previa=await fetch('/api/activar-reinicio',{headers,cache:'no-store'});
      const informe=await previa.json().catch(()=>({}));
      if(!previa.ok)throw Error(informe.error||`No pasó la revisión del reinicio (HTTP ${previa.status}).`);
      const d=informe.diagnostico;
      const detalles=d.salones.map(s=>`${s.salon}: ${s.integrantes} estudiantes, ${pesos(s.cuotaSemanal)} por semana`).join('\n');
      if(!window.confirm(`REINICIO CONTABLE DE INGENIERÍA INDUSTRIAL\n\n${detalles}\n\n${d.totalIntegrantes} estudiantes en total.\nLos pagos y retiros históricos permanecerán guardados, pero dejarán de contar en el saldo nuevo.\n\nSaldo nuevo: $0; semana inicial: 5.\n\n¿Ya descargaste y conservas el respaldo actualizado de Firebase?\n\nAceptar sólo si ya verificaste estos datos.`))return 'Activación cancelada. No se modificó Firebase.';
      const confirmacion=window.prompt('Esta operación cambia el libro contable activo. NO borra el anterior, pero el saldo nuevo empezará en $0.\n\nEscribe exactamente CONFIRMAR para activar:');
      if(confirmacion!=='CONFIRMAR')return 'Activación cancelada. No se modificó Firebase.';
      const respuesta=await fetch('/api/activar-reinicio',{method:'POST',headers:{...headers,'Content-Type':'application/json'},body:JSON.stringify({confirmacion,respaldoConfirmado:true})});
      const cuerpo=await respuesta.json().catch(()=>({}));
      if(!respuesta.ok)throw Error(cuerpo.error||`No se pudo activar el nuevo ahorro (HTTP ${respuesta.status}).`);
      return 'Nuevo ahorro activado desde la semana 5. Saldo inicial $0; historiales anteriores conservados.';
    });
  };
  const cambiarSemestreAhora=async()=>{
    if(!esAdminGeneral||!usuario||!periodo?.meta||periodo.meta.cerradoEn||vacacionesActivas||!destinoSiguiente)return;
    try{for(const salon of Object.keys(periodo.salones||{}))salonSiguiente(salon);}
    catch(error){setToast(error.message);return;}
    const confirmacion=window.prompt(
      `Cambiar AHORA el semestre ${periodoId} a ${destinoSiguiente}. Se registrará la fecha y hora actual de México. Los grupos avanzarán sin copiar sus pagos, y el 1007 dejará de aparecer como activo. Esta acción no se puede deshacer desde la aplicación. Comprueba retiros y listas antes de continuar.\n\nEscribe CONFIRMAR para ejecutar el cambio:`
    );
    if(confirmacion===null)return;
    if(confirmacion!=='CONFIRMAR'){setToast('Cambio cancelado. Debes escribir exactamente CONFIRMAR.');return;}
    await withOperation('cambio-semestre',async()=>{
      const token=await usuario.getIdToken();
      const respuesta=await fetch('/api/avanzar-semestre',{
        method:'POST',headers:{Authorization:`Bearer ${token}`,'Content-Type':'application/json'},
        body:JSON.stringify({periodo:periodoId,confirmacion}),
      });
      const body=await respuesta.json().catch(()=>({}));
      if(!respuesta.ok)throw Error(body.error||`No se pudo avanzar el semestre (HTTP ${respuesta.status}).`);
      const salonNuevo=body.movimientos?.find(m=>m.origen===salonId)?.destino || body.movimientos?.[0]?.destino || '';
      setPeriodoId(body.destino);
      localStorage.setItem('ag:periodo',body.destino);
      if(salonNuevo){setSalonId(salonNuevo);localStorage.setItem('ag:salon',salonNuevo);}
      setVista('panel');
      return `Semestre cambiado el ${body.fechaCambio} (hora de México). ${body.salonesAvanzados} grupos avanzaron; ${body.salonesArchivados} finalizaron décimo.`;
    });
  };
  const cerrarCiclo=async()=>{
    if(!esAdminGeneral||!periodo?.meta||periodo?.meta?.cerradoEn||vacacionesActivas)return;
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
  const guardarResponsable=async(datosRol)=>{
    if(!esAdminGeneral||!usuario)return;
    const {accion,periodo:p,salon:s,plaza,correo}=datosRol;
    if(!window.confirm(accion==='revocar'?`¿Revocar el acceso del responsable ${plaza} del salón ${s}? Sus pagos permanecerán intactos.`:`¿Crear o asignar la cuenta ${correo} como responsable ${plaza} del salón ${s}?`))return;
    await withOperation(`responsable:${p}:${s}:${plaza}`,async()=>{
      const token=await usuario.getIdToken();
      const respuesta=await fetch('/api/responsables',{
        method:'POST',headers:{Authorization:`Bearer ${token}`,'Content-Type':'application/json'},body:JSON.stringify(datosRol)
      });
      const body=await respuesta.json().catch(()=>({}));
      if(!respuesta.ok)throw Error(body.error||`Error HTTP ${respuesta.status}`);
      if(accion==='revocar')return 'Acceso revocado. Los estudiantes y pagos permanecen intactos.';
      if(!body.nueva)return `Responsable asignado: ${body.correo}. La cuenta existente utiliza su contraseña actual.`;
      try{
        await sendPasswordResetEmail(auth,body.correo);
        return usarEmuladores ? `Cuenta ficticia creada: ${body.correo}. El enlace para establecer contraseña aparece en la terminal del emulador Auth; no se envió correo real.` : `Responsable creado: ${body.correo}. Firebase envió un correo para establecer su contraseña.`;
      }catch(error){
        return `Cuenta ${body.correo} creada y autorizada, PERO no pudo enviarse el correo de acceso (${avisoError(error)}). Usa «Enviar acceso de nuevo».`;
      }
    });
  };
  const reenviarAcceso=async(correo)=>{
    if(!esAdminGeneral||!correo||!window.confirm(`¿Enviar un correo para establecer o recuperar contraseña a ${correo}?`))return;
    await withOperation('reenvio-acceso',async()=>{
      await sendPasswordResetEmail(auth,correo);
      return usarEmuladores ? 'Entorno de prueba: revisa la terminal del emulador Auth; no se envió correo real.' : 'Firebase envió las instrucciones de acceso al correo del responsable.';
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
          {esAdmin ? <span className="ag-admin-pill"><ShieldCheck size={16}/> {esAdminGeneral?'Admin. general':`Responsable ${salonId}`}</span> : <button className="ag-icon" type="button" title="Acceso administrativo" onClick={()=>setLoginOpen(true)}><LockKeyhole size={21}/></button>}
          {usuario&&<button className="ag-icon" type="button" title="Cerrar sesión" onClick={()=>signOut(auth)}><LogOut size={19}/></button>}
          <button className="ag-icon" type="button" title="Menú" onClick={()=>setMostrarMenu(!mostrarMenu)}><Menu size={22}/></button>
        </div>
      </header>
      {mostrarMenu&&<nav className="ag-menu">{esAdminGeneral&&<button onClick={()=>{setVista('panel');setMostrarMenu(false);}}>Panel general</button>}<button onClick={()=>{setVista('pagos');setMostrarMenu(false);}}>Aportaciones</button><button onClick={()=>{setVista('pagos');setMostrarMenu(false);}}>Aportaciones y retiros</button><button onClick={()=>{setVista('profesores');setMostrarMenu(false);}}>Profesores</button><button onClick={()=>{setVista('gestion');setMostrarMenu(false);}}>Ciclos y grupos</button>{esAdminGeneral&&<button onClick={()=>{setVista('roles');setMostrarMenu(false);}}>Responsables de salón</button>}<button onClick={instalar}>Instalar app</button></nav>}
      {!esAdmin ? <main className="ag-main">
        <section className="ag-panel">
          <div className="ag-panel-heading"><h2><LockKeyhole size={19}/> Acceso protegido</h2></div>
          <p className="ag-muted">La consulta de estudiantes y pagos requiere iniciar sesión. Cada responsable tiene acceso exclusivamente a su salón y ciclo escolar; el administrador general supervisa todos.</p>
          <SmallButton variant="primary" onClick={()=>setLoginOpen(true)}><LockKeyhole size={17}/> {usuario ? 'Comprobar o cambiar cuenta' : 'Iniciar sesión'}</SmallButton>
          {usuario && <p className="ag-muted">Si tu cuenta no obtiene acceso, solicita al administrador general que te asigne una de las dos plazas del salón. Si eres el administrador general, verifica roles/adminGeneralUid.</p>}
        </section>
      </main> : <main className="ag-main">
        {dbError&&<div className="ag-error"><AlertTriangle size={18}/> {dbError}</div>}
        <div className="ag-intro"><div><span className="ag-kicker">{esAdminGeneral?'ADMINISTRACIÓN GENERAL · INGENIERÍA INDUSTRIAL':`SALÓN · ${salonId} · ${periodo?.meta?.nombre||periodoId}`} {periodo?.meta?.cerradoEn?' · CICLO ARCHIVADO':''}</span><h1>{esAdminGeneral?'Panel de administración':'Control de aportaciones'}</h1><p>{esAdminGeneral?'Gestión del fondo de la carrera':`Registro de tu salón · ${pesos(cuotaSemanal)} por semana.`}</p></div><div className="ag-week-pill"><CalendarClock size={19}/> Semana {semanaActual}</div></div>
        {vacacionesActivas&&<div className="ag-note"><PauseCircle size={17}/> Vacaciones activas: semana {semanaActual} congelada. No se registran aportaciones ni nuevas semanas pendientes.</div>}
        <div className="ag-selectors">
          <label>Ciclo escolar<select disabled={!esAdminGeneral} value={periodoId} onChange={e=>cambiarPeriodo(e.target.value)}>{periodKeys.length ? periodKeys.map(k=><option key={k} value={k}>{periodos[k]?.meta?.nombre||k}</option>):<option value={defaultPeriod}>Sin listas importadas</option>}</select></label>
          <label>Salón<select disabled={!esAdminGeneral} value={salonId} onChange={e=>cambiarSalon(e.target.value)}>{salones.length ? salones.map(k=><option key={k} value={k}>{periodo?.salones?.[k]?.nombre||`Salón ${k}`}</option>):<option value="507">Sin salones</option>}</select></label>
        </div>
        <div className="ag-tabs" role="tablist" aria-label="Apartados">{esAdminGeneral&&<button className={vistaActiva==='panel'?'active':''} onClick={()=>setVista('panel')}><LayoutDashboard size={17}/> Inicio</button>}<button className={vistaActiva==='pagos'?'active':''} onClick={()=>setVista('pagos')}><Wallet size={17}/> Aportaciones</button><button className={vistaActiva==='profesores'?'active':''} onClick={()=>setVista('profesores')}><GraduationCap size={17}/> Profesores</button><button className={vistaActiva==='gestion'?'active':''} onClick={()=>setVista('gestion')}><BookOpen size={17}/> Ciclos y salones</button>{esAdminGeneral&&<button className={vistaActiva==='roles'?'active':''} onClick={()=>setVista('roles')}><ShieldCheck size={17}/> Responsables</button>}</div>
        {vistaActiva==='panel'&&esAdminGeneral&&<>
          <section className="ag-general-hero" aria-label="Resumen general del ahorro de carrera">
            <div className="ag-general-label"><CircleDollarSign size={22}/> FONDO DE INGENIERÍA INDUSTRIAL</div>
            <strong className="ag-general-amount">{reporteFondos?.cifrasConfiables?pesos(reporteFondos.totalCarrera):'—'}</strong>
            <p>Saldo de la carrera.</p>
            {reporteError&&<div className="ag-error"><AlertTriangle size={17}/>{reporteError}</div>}
            {reporteFondos&&!reporteFondos.cifrasConfiables&&<div className="ag-note"><AlertTriangle size={17}/> Hay retiros antiguos por clasificar. El saldo disponible se oculta hasta conciliarlos.</div>}
          </section>
          <section className="ag-general-metrics" aria-label="Resumen del ciclo">
            <div><UsersRound size={22}/><strong>{Object.keys(periodo?.salones||{}).length}</strong><span>Salones del ciclo</span></div>
            <div><UserCog size={22}/><strong>{Object.values(responsables?.[periodoId]||{}).reduce((n,p)=>n+Object.values(p||{}).filter(Boolean).length,0)}</strong><span>Responsables asignados</span></div>
            <div><CalendarClock size={22}/><strong>{semanaActual}</strong><span>Semana actual</span></div>
          </section>
          <Panel title="¿Qué necesitas hacer?" icon={LayoutDashboard}>
            <div className="ag-general-actions">
              <button onClick={()=>setVista('pagos')}><Wallet size={25}/><strong>Registrar aportaciones</strong><span>Elegir salón y revisar pagos semanales</span></button>
              <button onClick={()=>setVista('roles')}><UserCog size={25}/><strong>Administrar responsables</strong><span>Consultar y administrar las dos plazas por salón</span></button>
              <button onClick={()=>setVista('gestion')}><FileSpreadsheet size={25}/><strong>Estudiantes y semestres</strong><span>Importar listas y gestionar ciclos</span></button>

            </div>
          </Panel>
        </>}
        {vistaActiva==='pagos'&&<>
          <section className="ag-summary">
            <div className="ag-balance"><div className="ag-balance-head"><Wallet size={19}/> <span>{esAdminGeneral?'FONDO DE LA CARRERA':`APORTACIONES DEL SALÓN ${salonId}`} </span></div>
              <strong>{!reporteFondos||!reporteFondos.cifrasConfiables?'—':pesos(esAdminGeneral?reporteFondos.totalCarrera:reporteFondos.aportacionCarrera)}</strong>
              <p>{esAdminGeneral?'Saldo de la carrera.':'Aportaciones del salón a la carrera.'}</p>
              <div className="ag-balance-bottom"><span>Contribución a carrera: <b>{reporteFondos?pesos(reporteFondos.aportacionCarrera):'—'}</b></span><span>Semana seleccionada: <b>{semana}</b></span></div>
            </div>
            <div className="ag-stats"><div><CircleDollarSign size={21}/><strong>{pesos(cuotaSemanal)}</strong><span>Por semana</span></div><div><UsersRound size={21}/><strong>{cargando?'—':lista.length}</strong><span>Integrantes</span></div><div><CheckCircle2 size={21}/><strong>{vigenteParaRegistrar?pagaron:'—'}</strong><span>Pagaron esta semana</span></div></div>
          </section>
          {esCorteEnSalon&&<div className="ag-note"><History size={17}/> El fondo nuevo comienza en la semana 5. Las semanas 1 a 4 pueden capturarse como «Pagos anteriores», sin generar adeudos automáticos ni sumar al saldo actual.</div>}
          {periodoId==='2026-2027-A'&&!ahorroNuevoActivo&&<div className="ag-error"><AlertTriangle size={17}/> El reinicio contable de la semana 5 aún no está activado. No registres movimientos hasta completar la migración segura.{esAdminGeneral&&<div style={{marginTop:12}}><SmallButton disabled={!!operacion} onClick={activarReinicioSeguro}><ShieldCheck size={16}/> Revisar y activar ahorro nuevo</SmallButton></div>}</div>}
          <Panel title="Ahorro de la carrera" icon={Wallet}>
            {reporteError&&<div className="ag-error"><AlertTriangle size={17}/>{reporteError}</div>}
            {!reporteFondos&&!reporteError&&<p className="ag-muted">Calculando aportaciones…</p>}
            {reporteFondos&&<>
              {!reporteFondos.cifrasConfiables&&<div className="ag-error"><AlertTriangle size={17}/> Hay {reporteFondos.retirosSinClasificar} retiros anteriores sin fondo identificado. No utilices estas cifras como saldos disponibles para nuevas devoluciones hasta clasificarlos.</div>}
              <div className="ag-stats">
                <div><UsersRound size={21}/><strong>{pesos(reporteFondos.aportacionCarrera)}</strong><span>Aportación acumulada de este salón a la carrera</span></div>
                <div><CircleDollarSign size={21}/><strong>{pesos(reporteFondos.totalCarrera)}</strong><span>Fondo total de la carrera</span></div>
              </div>
              <p className="ag-muted">El ahorro se registra únicamente en el fondo de la carrera.</p>
            </>}
          </Panel>

          {!datos?.meta && !cargando&&<div className="ag-empty"><BookOpen size={31}/><h3>Este salón todavía no está configurado</h3><p>Un administrador debe importar la lista del Excel o crear un salón en «Ciclos y salones».</p><SmallButton onClick={()=>setVista('gestion')}>Ver configuración</SmallButton></div>}
          {datos?.meta&&<Panel title={esAnterior?'Pagos anteriores · registro semanal':'Registro semanal'} icon={CalendarClock} action={<div className="ag-week-select"><button type="button" onClick={()=>setSemanaElegida(Math.max(semanaMinima,semana-1))} disabled={semana<=semanaMinima}>‹</button><select value={semana} onChange={e=>setSemanaElegida(Number(e.target.value))}>{Array.from({length:Math.max(semanaActual-semanaMinima+1,1)},(_,i)=>i+semanaMinima).reverse().map(n=><option key={n} value={n}>Semana {n}{esCorteEnSalon&&n<5?' · Anterior':''}</option>)}</select><button type="button" onClick={()=>setSemanaElegida(Math.min(semanaActual,semana+1))} disabled={semana>=semanaActual}>›</button>{semana!==semanaActual&&<button type="button" title="Volver a la semana actual" onClick={()=>setSemanaElegida(0)}>Hoy</button>}</div>}>
            {esAnterior&&<div className="ag-note"><History size={16}/> Semana {semana}: registra aquí los pagos atrasados del periodo anterior al reinicio. Se guardan como historial independiente, no generan adeudos automáticos y NO aumentan el saldo de la carrera. Si ya había un pago anterior registrado, se respeta y no se duplica.</div>}
            <div className="ag-toolbar"><label className="ag-search"><Search size={17}/><input placeholder="Buscar por nombre o control..." value={search} onChange={e=>setSearch(e.target.value)}/></label><div className="ag-filters"><button className={filtro==='todos'?'active':''} onClick={()=>setFiltro('todos')}>Todos</button><button className={filtro==='pagado'?'active':''} onClick={()=>setFiltro('pagado')}>Pagaron</button><button className={filtro==='pendiente'?'active':''} onClick={()=>setFiltro('pendiente')}>{esAnterior?'Sin registrar':'Pendientes'}</button></div></div>
            {!vigenteParaRegistrar&&<div className="ag-note"><History size={16}/> Esta semana corresponde al historial anterior o a un periodo sin registros detallados. No se muestran supuestos adeudos.</div>}
            <div className="ag-student-list">{visible.map(e=>{const estado=estadoAlumno(e);return <article className="ag-student" key={e.id}><span className="ag-avatar" aria-hidden="true"><UserRound size={22} strokeWidth={2.2}/></span><div className="ag-student-info"><strong title={e.nombre}>{e.nombreVisible}</strong><small>{e.control?`Control ${e.control} · `:''}Semana {semana}</small></div><span className={`ag-status ag-status-${estado}`}>{estado==='pagado'?<><Check size={14}/> Pagó</>:estado==='pendiente'?(esAnterior?'Sin registrar':'Pendiente'):'Sin desglose'}</span>{esAdmin&&vigenteParaRegistrar&&!vacacionesActivas&&!periodo?.meta?.cerradoEn&&<div className="ag-pay-actions">{estado==='pagado' ? (esAnterior&&esPagoLegado(pagosLegado,e.id,semana) ? <span title="Pago legado conservado; no se puede modificar aquí"><LockKeyhole size={18}/></span> : esAdminGeneral ? <button title="Anular este pago (con registro de corrección)" disabled={!!operacion} onClick={()=>anularPago(e)}><Minus size={17}/></button> : <span title="Solo el administrador general puede anular pagos"><Check size={18}/></span>) : <button title={`Registrar ${pesos(cuotaSemanal)} esta semana`} disabled={!!operacion} onClick={()=>registrarPago(e)}><Plus size={18}/></button>}</div>}</article>;})}{!visible.length&&<div className="ag-empty-small">No hay integrantes para este filtro.</div>}</div>
            <div className="ag-list-foot">{vigenteParaRegistrar?`${pagaron} pagos registrados · ${pendientes} ${esAnterior?'sin registrar (no son adeudos automáticos)':'pendientes de esta semana'}`:'Sin desglose semanal para esta selección'}</div>
          </Panel>}
          {esCorteEnSalon&&datos?.meta&&<Panel title="Pagos anteriores (semanas 1 a 4)" icon={History}>
            <p className="ag-muted">Registro histórico independiente. Estas aportaciones no se suman al fondo nuevo de Ingeniería Industrial. Ninguna semana anterior genera deuda automática.</p>
            <p className="ag-note">{resumenAnterior.registros} pagos históricos activos · {pesos(resumenAnterior.importeHistorico)} de importe registrado en esta sección (NO es saldo disponible).</p>
            <div className="ag-timeline">{pagosHistAnteriores.slice(0,100).map(p=><div className="ag-timeline-row" key={p.id}><span className={`ag-timeline-mark ${p.estado==='pagado'?'ok':'cancel'}`}>{p.estado==='pagado'?<Check size={16}/>:<X size={16}/>}</span><div><strong>{nombreParaMostrar(integrantes[p.estudianteId]?.nombre||p.nombre||'Integrante',p.estudianteId,integrantes[p.estudianteId]?.formatoNombre)}</strong><small>Semana {p.semana} · {fechaLarga(p.creadoEn)} {p.estado==='anulado'?'· Anulación':''}{p.motivo?` · ${p.motivo}`:''}</small></div><b>{p.estado==='pagado'?'+':'−'}{pesos(p.monto)}</b></div>)}{!pagosHistAnteriores.length&&<p className="ag-muted">No hay capturas históricas nuevas. Los registros originales anteriores al reinicio permanecen intactos.</p>}</div>
          </Panel>}
          {datos?.meta&&<Panel title="Historial de aportaciones" icon={History}><p className="ag-muted">Movimientos del nuevo ahorro. Los registros anteriores permanecen respaldados y no se suman.</p><div className="ag-timeline">{pagosHist.slice(0,100).map(p=><div className="ag-timeline-row" key={p.id}><span className={`ag-timeline-mark ${p.estado==='pagado'?'ok':'cancel'}`}>{p.estado==='pagado'?<Check size={16}/>:<X size={16}/>}</span><div><strong title={p.nombre||integrantes[p.estudianteId]?.nombre||''}>{nombreParaMostrar(integrantes[p.estudianteId]?.nombre||p.nombre||'Integrante',p.estudianteId,integrantes[p.estudianteId]?.formatoNombre)}</strong><small>Semana {p.semana} · {fechaLarga(p.creadoEn)} {p.estado==='anulado'?'· Anulación':''}{p.motivo?` · ${p.motivo}`:''}</small></div><b>{p.estado==='pagado'?'+':'−'}{pesos(p.monto)}</b></div>)}{!pagosHist.length&&<p className="ag-muted">Todavía no hay pagos semanales detallados para este salón.</p>}</div></Panel>}
        {esAdmin&&!periodo?.meta?.cerradoEn&&datos?.meta&&(periodoId!=='2026-2027-A'||ahorroNuevoActivo)&&<Panel title="Solicitar retiro de la caja" icon={ArrowDownRight}><form className="ag-simple-form" onSubmit={solicitarRetiro}><label>Importe en pesos<input type="number" min="1" step="1" value={retiro.monto} onChange={e=>setRetiro({...retiro,monto:e.target.value})} placeholder="Ej. 200" required/></label><label>Motivo<input value={retiro.motivo} onChange={e=>setRetiro({...retiro,motivo:e.target.value})} placeholder="¿Para qué se solicita?" minLength={6} required/></label><SmallButton type="submit" variant="primary" disabled={!!operacion}><Plus size={17}/> Publicar solicitud</SmallButton></form><p className="ag-muted">Solicitar no descuenta dinero. El saldo se actualiza cuando se aprueba la solicitud.</p></Panel>}
        <Panel title="Avisos de movimientos y retiros" icon={BellRing} action={<SmallButton onClick={permitirAvisos}><Bell size={16}/> Permitir avisos</SmallButton>}><p className="ag-muted">Solicitudes y retiros correspondientes a la carrera. Los avisos del dispositivo funcionan mientras la aplicación está abierta.</p>{!datos?.meta?<div className="ag-empty-small">Selecciona un salón configurado.</div>:<div className="ag-timeline">{avisosVisibles.map(r=><div key={r.id} className="ag-withdrawal"><div className="ag-withdrawal-head"><span className={`ag-status ag-status-${r.estado}`}>{r.estado==='solicitado'?'Solicitud de retiro':r.estado==='aprobado'?'Retiro aprobado':'Solicitud rechazada'}</span><strong>{pesos(r.monto)}</strong></div><p>{r.motivo}</p><small>{fechaLarga(r.creadoEn)} {r.respondidoEn?`· Resuelto ${fechaLarga(r.respondidoEn)}`:''}</small>{esAdminGeneral&&r.fondo==='carrera'&&!periodo?.meta?.cerradoEn&&r.estado==='solicitado'&&<div className="ag-withdrawal-buttons"><SmallButton disabled={!!operacion} onClick={()=>resolverRetiro(r,'aprobado')} variant="primary"><Check size={16}/> Aprobar y descontar</SmallButton><SmallButton disabled={!!operacion} onClick={()=>resolverRetiro(r,'rechazado')}>Rechazar</SmallButton></div>}</div>)}{!avisosVisibles.length&&<p className="ag-muted">No existen avisos de retiro para este salón.</p>}</div>}</Panel></>}
        {vistaActiva==='roles' && esAdminGeneral && <Panel title="Responsables de los salones" icon={ShieldCheck}>
          <p className="ag-muted">Crea responsables con su nombre y correo. Firebase les envía un mensaje para que establezcan su contraseña. No necesitas copiar identificadores ni entrar a Firebase. Los accesos avanzan automáticamente con su generación al cambiar de semestre.</p>
          <p className="ag-note">Máximo dos responsables por salón. Solo pueden registrar aportaciones y solicitar retiros de su salón. Las bajas de permisos no borran pagos ni alumnos.</p>
          {errorResponsables&&<div className="ag-error">{errorResponsables}</div>}
          <div className="ag-role-period"><h3>Semestre activo: {periodos[periodoId]?.meta?.nombre||periodoId}</h3>
            {Object.keys(periodos[periodoId]?.salones||{}).sort((a,b)=>a.localeCompare(b,'es',{numeric:true})).map(s=><div className="ag-role-room" key={`${periodoId}-${s}`}><h4>Salón {s}</h4>
              {['1','2'].map(plaza=>{const uid=responsables?.[periodoId]?.[s]?.[plaza];return <PlazaResponsable key={`${periodoId}:${s}:${plaza}:${uid||''}`} periodo={periodoId} salon={s} plaza={plaza} ocupada={Boolean(uid)} persona={uid?perfilesResponsables[uid]:null} busy={!!operacion} guardar={guardarResponsable} reenviar={reenviarAcceso}/>;})}
            </div>)}
          </div>
          {!Object.keys(periodos[periodoId]?.salones||{}).length&&<p className="ag-muted">Selecciona un semestre con salones activos.</p>}
        </Panel>}
        {vistaActiva==='profesores'&&<Panel title="Directorio de profesores" icon={GraduationCap}><p className="ag-muted">Profesores proporcionados para Ingeniería Industrial. No se incluyen en los cálculos de aportaciones.</p><div className="ag-prof-grid">{PROFESORES.map(n=><div key={n} className="ag-prof"><span className="ag-avatar"><GraduationCap size={20}/></span><strong>{n}</strong></div>)}</div></Panel>}
        {vistaActiva==='gestion'&&<><Panel title="Ciclos escolares y salones" icon={BookOpen}><p className="ag-muted">Los ciclos se conservan por separado. Un ciclo nuevo empieza sin pagos ni retiros; no borra el anterior.</p>{esAdminGeneral&&periodo?.meta&&!periodo?.meta?.cerradoEn&&<div className="ag-archive-action"><SmallButton disabled={!!operacion||vacacionesActivas} onClick={cerrarCiclo}>Archivar ciclo al terminar la semana actual</SmallButton></div>}<div className="ag-period-grid">{periodKeys.map(id=><button disabled={!esAdminGeneral} className={periodoId===id?'active':''} key={id} onClick={()=>cambiarPeriodo(id)}><strong>{periodos[id]?.meta?.nombre||id}</strong><span>{Object.keys(periodos[id]?.salones||{}).length} salones</span></button>)}</div></Panel>{esAdminGeneral?<><Panel title="Importar estudiantes desde Excel" icon={FileSpreadsheet}>
          <p className="ag-muted">Sube un Excel (.xlsx) con columnas <strong>NOMBRE</strong> y, opcionalmente, <strong>N.º CONTROL</strong>. Una hoja por salón (107, 307, etc.). La hoja «Todos» se ignora para evitar duplicados. Si el archivo tiene una sola hoja sin número de salón, se usará el salón seleccionado arriba.</p>
          <p className="ag-note">Ciclo destino: <strong>{periodoId}</strong>. Solo se agregarán estudiantes nuevos; nunca se borrarán ni modificarán personas, aportaciones o saldos existentes. CURP y fechas de nacimiento no se importan.</p>
          <input className="ag-file" type="file" accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" onChange={onArchivo} disabled={!!operacion}/>
          {importInfo&&<div className="ag-confirm">
            <strong>Vista previa: {importFile?.name}</strong>
            <p>{importFile?.salones} salón(es) · {importFile?.total} estudiante(s) detectados · ciclo {importInfo.periodoId}</p>
            <div className="ag-period-grid">{Object.entries(importInfo.salones).map(([codigo, estudiantes])=><div key={codigo} className="ag-note"><b>Salón {codigo}: {estudiantes.length} estudiantes</b><small>{estudiantes.slice(0,3).map(e=>e.nombre).join(' · ')}{estudiantes.length>3?' · …':''}</small></div>)}</div>
            <SmallButton variant="primary" disabled={!!operacion || importInfo.periodoId!==periodoId} onClick={importar}><FileSpreadsheet size={17}/> Revisar coincidencias y confirmar altas</SmallButton>
            <SmallButton disabled={!!operacion} onClick={()=>{setImportInfo(null);setImportFile(null);}}>Cancelar</SmallButton>
          </div>}
        </Panel><Panel title="Vacaciones y reanudación" icon={PauseCircle}>
          <p className="ag-muted">Detén las aportaciones sin cambiar el semestre. La semana queda congelada y al reanudar no se cobrarán las semanas transcurridas durante las vacaciones.</p>
          <div className="ag-note"><CalendarClock size={16}/> Semana actual: <strong>{semanaActual}</strong> · Estado: <strong>{vacacionesActivas?'Vacaciones':'Clases activas'}</strong></div>
          {vacacionesActivas
            ? <SmallButton variant="primary" disabled={!!operacion} onClick={()=>controlarVacaciones('reanudar')}><PlayCircle size={17}/> Reanudar clases</SmallButton>
            : <SmallButton disabled={!!operacion||!!periodo?.meta?.cerradoEn} onClick={()=>controlarVacaciones('iniciar')}><PauseCircle size={17}/> Iniciar vacaciones</SmallButton>}
          <p className="ag-muted">Las dos acciones requieren escribir exactamente <strong>CONFIRMAR</strong>. La hora queda registrada en el servidor.</p>
        </Panel><Panel title="Cambio de semestre" icon={CalendarClock}><p className="ag-muted">Al confirmar, el cambio se aplica inmediatamente y se registra la fecha y hora de México. Ejemplos: 107 → 207, 307 → 407 y 507 → 607. Los grupos que terminaron décimo ya no aparecerán como activos. No se copian ni duplican pagos.</p>{periodo?.meta?.cerradoEn?<p className="ag-note">Este ciclo ya fue archivado. {periodo.meta.migradoA?`Ahora corresponde al ciclo ${periodo.meta.migradoA}.`:''}</p>:<div className="ag-simple-form"><label>Semestre actual<input value={periodoId} readOnly /></label><label>Nuevo semestre<input value={destinoSiguiente} readOnly /></label><SmallButton variant="primary" disabled={!!operacion || !destinoSiguiente || vacacionesActivas} onClick={cambiarSemestreAhora}><CalendarClock size={17}/> Cambiar semestre ahora</SmallButton></div>}<p className="ag-muted">Antes de ejecutar el cambio, revisa las listas y resuelve los retiros pendientes. Para evitar cambios accidentales, se pedirá escribir CONFIRMAR. Las nuevas aportaciones comenzarán desde el lunes del cambio o el próximo lunes.</p></Panel><Panel title="Crear ciclo para próximos años" icon={CalendarClock}><div className="ag-simple-form"><label>Identificador (ej. 2027-2028-A)<input value={nuevoPeriodo.id} onChange={e=>setNuevoPeriodo({...nuevoPeriodo,id:e.target.value.toUpperCase()})} placeholder="2027-2028-A"/></label><label>Lunes de inicio<input type="date" value={nuevoPeriodo.lunesBase} onChange={e=>setNuevoPeriodo({...nuevoPeriodo,lunesBase:e.target.value})}/></label><label>Primera semana<input type="number" min="1" step="1" value={nuevoPeriodo.semanaBase} onChange={e=>setNuevoPeriodo({...nuevoPeriodo,semanaBase:e.target.value})}/></label><SmallButton variant="primary" disabled={!!operacion} onClick={crearPeriodo}><Plus size={17}/> Crear ciclo vacío</SmallButton></div></Panel>{periodo&&<Panel title="Gestionar salón e integrantes" icon={UsersRound}><div className="ag-simple-form"><label>Nuevo salón<input value={nuevoSalon} onChange={e=>setNuevoSalon(e.target.value)} placeholder="Ej. 107"/></label><SmallButton disabled={!!operacion} onClick={crearSalon}><Plus size={17}/> Crear salón</SmallButton></div>{datos?.meta&&<div className="ag-simple-form"><label>Nombre del nuevo estudiante<input value={nuevoEstudiante.nombre} onChange={e=>setNuevoEstudiante({...nuevoEstudiante,nombre:e.target.value})} placeholder="Nombre completo"/></label><label>Número de control (opcional)<input value={nuevoEstudiante.control} onChange={e=>setNuevoEstudiante({...nuevoEstudiante,control:e.target.value})} placeholder="N.º de control"/></label><SmallButton disabled={!!operacion} onClick={agregarAlumno}><Plus size={17}/> Agregar estudiante</SmallButton></div>}</Panel>}</>:<div className="ag-note"><LockKeyhole size={17}/> Solo el administrador general puede importar listas, dar de alta estudiantes y crear ciclos escolares.</div>}</>}
        <footer className="ag-footer"><div><img src="/icons/cerdito-192.png" alt="" width="32" height="32"/> AhorroGrupal · Ingeniería Industrial</div><button onClick={instalar}><Download size={17}/> {instalada?'App instalada':'Instalar app'}</button></footer>
      </main>}
    </div>
    {toast&&<div role="status" className="ag-toast">{toast}<button onClick={()=>setToast('')} aria-label="Cerrar"><X size={15}/></button></div>}
    {loginOpen&&<div className="ag-backdrop" onMouseDown={e=>{if(e.target===e.currentTarget)setLoginOpen(false);}}><div className="ag-modal" role="dialog" aria-modal="true" aria-label="Administración"><button className="ag-modal-close" onClick={()=>setLoginOpen(false)}><X size={20}/></button><div className="ag-modal-mark"><LockKeyhole size={26}/></div><h2>Acceso administrativo</h2>{usuario&&!esAdmin?<p>Sesión iniciada, pero este UID no tiene un rol activo en <code>roles</code>. Consulta al administrador general.</p>:<p>Solo las cuentas autorizadas pueden registrar movimientos.</p>}<form onSubmit={signIn}><label>Correo electrónico<input type="email" autoComplete="username" required value={email} onChange={e=>setEmail(e.target.value)}/></label><label>Contraseña<div className="ag-password"><input type={seePassword?'text':'password'} autoComplete="current-password" required value={password} onChange={e=>setPassword(e.target.value)}/><button type="button" onClick={()=>setSeePassword(!seePassword)}>{seePassword?<EyeOff size={18}/>:<Eye size={18}/>}</button></div></label>{loginError&&<div className="ag-error">{loginError}</div>}<SmallButton type="submit" variant="primary" disabled={loginBusy}><ShieldCheck size={18}/> {loginBusy?'Verificando…':'Iniciar sesión'}</SmallButton></form><button className="ag-link" type="button" onClick={resetPassword}>¿Olvidaste tu contraseña?</button>{usuario&&!esAdmin&&<button className="ag-link" type="button" onClick={()=>signOut(auth)}>Cerrar sesión actual</button>}</div></div>}
    {modalInstalar&&<div className="ag-backdrop" onMouseDown={e=>{if(e.target===e.currentTarget)setModalInstalar(false);}}><div className="ag-modal" role="dialog" aria-modal="true" aria-label="Instalar aplicación"><button className="ag-modal-close" onClick={()=>setModalInstalar(false)}><X size={20}/></button><img src="/icons/cerdito-192.png" alt="Cerdito" width="80" height="80"/><h2>Instalar AhorroGrupal</h2><p>Android: menú de Chrome → Instalar app. iPhone: Safari → Compartir → Añadir a inicio. Computadora: opción Instalar en Chrome o Edge.</p></div></div>}
  </div>;
}
