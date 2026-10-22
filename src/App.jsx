import { useEffect, useMemo, useState } from 'react';
import { initializeApp, getApps, getApp } from 'firebase/app';
import { getAuth, onAuthStateChanged, signInWithEmailAndPassword, signOut, sendPasswordResetEmail } from 'firebase/auth';
import { getDatabase, ref, onValue, runTransaction } from 'firebase/database';
import {
  ArrowDownRight, ArrowUpRight, CalendarDays, CheckCheck, CheckCircle2,
  CloudOff, Copy, Download, Eye, EyeOff, Filter,
  Info, LockKeyhole, LogOut, Menu, Minus, Pin, Plus, Search, ShieldCheck,
  UsersRound, Wallet, X, AlertTriangle, RotateCw,
} from 'lucide-react';
import './App.css';
import { semanaActualMexico, proximoLunesMexico } from '../lib/semanaAutomatica.js';

// Mantenemos el mismo proyecto y las mismas rutas de Firebase: ¡no migrar ni borrar datos!
const firebaseConfig = {
  apiKey: 'AIzaSyA3AN8yCezlw3ORkPUCZp0Af97JgAoMbOE',
  authDomain: 'ahorro-grupal-industrial.firebaseapp.com',
  projectId: 'ahorro-grupal-industrial',
  storageBucket: 'ahorro-grupal-industrial.firebasestorage.app',
  messagingSenderId: '493506921547',
  appId: '1:493506921547:web:97ece4e262f02b6a9eb9ce',
  measurementId: 'G-KQRYGD903K',
  databaseURL: 'https://ahorro-grupal-industrial-default-rtdb.firebaseio.com',
};

const firebaseApp = getApps().length ? getApp() : initializeApp(firebaseConfig);
const database = getDatabase(firebaseApp);
const auth = getAuth(firebaseApp);
const CUOTA = 20;
const INTEGRANTES_INICIALES = [
  'Alan Patiño', 'Sergio Emilio', 'Eduardo Benitez', 'Joshua Moreno', 'Lilia Belén',
  'Ana María', 'Jose Alberto', 'Camila Aimee', 'Jesús Eduardo', 'Brisa Yavhe',
  'Liz Vianey', 'Delia Nahomy', 'Esther Terán', 'Axel Said', 'Ameyalli Arista',
  'Marely Gutenberg', 'Hanna Citlali', 'Samuel Rafael', 'Sodel Eduardo',
];

const currency = (amount) => new Intl.NumberFormat('es-MX', {
  style: 'currency', currency: 'MXN', minimumFractionDigits: 0, maximumFractionDigits: 0,
}).format(amount || 0);

function initials(name) {
  return name.trim().split(/\s+/).slice(0, 2).map((part) => part[0]).join('').toLocaleUpperCase('es-MX');
}

function friendlyAuthError(error) {
  switch (error?.code) {
    case 'auth/invalid-email': return 'Revisa el formato del correo electrónico.';
    case 'auth/invalid-credential':
    case 'auth/wrong-password':
    case 'auth/user-not-found': return 'Correo o contraseña incorrectos.';
    case 'auth/too-many-requests': return 'Demasiados intentos. Inténtalo más tarde.';
    case 'auth/operation-not-allowed': return 'Activa el acceso con correo y contraseña en Firebase Authentication.';
    case 'auth/network-request-failed': return 'No hay conexión con Firebase. Comprueba tu internet.';
    default: return 'No se pudo iniciar sesión. Inténtalo de nuevo.';
  }
}

function Metric({ icon: Icon, label, value, sub, tone = 'purple' }) {
  return (
    <div className={`metric metric-${tone}`}>
      <div className="metric-top"><span className="metric-icon"><Icon size={19}/></span><span className="metric-spark"><ArrowUpRight size={16}/></span></div>
      <p className="metric-value">{value}</p>
      <p className="metric-label">{label}</p>
      <p className="metric-sub">{sub}</p>
    </div>
  );
}

function MemberCard({ name, pagos, semana, pinned, onPin, isAdmin, onPayment, busy }) {
  const pagados = Math.max(0, Number(pagos) || 0);
  const pendiente = Math.max(0, semana - pagados);
  const alDia = pendiente === 0;
  const porcentaje = semana > 0 ? Math.min(100, Math.round((pagados / semana) * 100)) : 100;
  return (
    <article className={`member ${pinned ? 'member-pinned' : ''}`}>
      <div className="member-avatar" aria-hidden="true">{initials(name)}</div>
      <div className="member-info">
        <div className="member-name-row"><h3 title={name}>{name}</h3>{pinned && <span className="favorite-label">Mi perfil</span>}</div>
        <div className="member-meta"><span>{pagados} {pagados === 1 ? 'aportación' : 'aportaciones'}</span><span className="dot"/><span>{currency(pagados * CUOTA)} ahorrados</span></div>
        <div className="member-progress" aria-label={`${porcentaje}% de semanas cubiertas`}><span style={{ width: `${porcentaje}%` }}/></div>
      </div>
      <div className="member-state">
        <span className={`status ${alDia ? 'status-ok' : 'status-debt'}`}>
          {alDia ? <><CheckCircle2 size={15}/> Al corriente</> : <>Pendiente {currency(pendiente * CUOTA)}</>}
        </span>
        <span className="status-detail">{alDia ? 'Sin adeudos' : `${pendiente} ${pendiente === 1 ? 'semana' : 'semanas'} pendiente${pendiente === 1 ? '' : 's'}`}</span>
      </div>
      <div className="member-actions">
        <button type="button" className={`icon-button pin-button ${pinned ? 'is-pinned' : ''}`} onClick={() => onPin(name)}
          title={pinned ? 'Quitar de favoritos' : 'Fijar como mi perfil'} aria-label={pinned ? `Quitar a ${name} de favoritos` : `Fijar a ${name} como mi perfil`}>
          <Pin size={18} fill={pinned ? 'currentColor' : 'none'}/>
        </button>
        {isAdmin && <div className="payment-actions" aria-label={`Administrar aportaciones de ${name}`}>
          <button type="button" className="payment-minus" disabled={busy || pagados <= 0} onClick={() => onPayment(name, -1)} title="Quitar una aportación" aria-label={`Quitar una aportación a ${name}`}><Minus size={17}/></button>
          <button type="button" className="payment-plus" disabled={busy} onClick={() => onPayment(name, 1)} title="Registrar una aportación" aria-label={`Registrar una aportación de ${name}`}><Plus size={18}/></button>
        </div>}
      </div>
    </article>
  );
}

// Verificación independiente frente al servidor oficial de Realtime Database.
// El token se envía ÚNICAMENTE a la URL del proyecto Firebase configurado.
// No se almacena, no se muestra en pantalla ni se registra en consola.
async function permisoDesdeServidor(cuenta) {
  const token = await cuenta.getIdToken(true);
  const url = new URL(`${firebaseConfig.databaseURL}/adminUids/${encodeURIComponent(cuenta.uid)}.json`);
  url.searchParams.set('auth', token);
  const response = await fetch(url.toString(), { method: 'GET', cache: 'no-store' });
  let value;
  try {
    value = await response.json();
  } catch {
    throw new Error(`Firebase respondió HTTP ${response.status} sin JSON válido.`);
  }
  if (!response.ok) {
    const reason = typeof value?.error === 'string' ? value.error : `HTTP ${response.status}`;
    throw new Error(`El servidor rechazó la lectura (${reason}).`);
  }
  return value;
}

export default function App() {
  const [integrantes, setIntegrantes] = useState({});
  // El calendario mexicano, no un incremento manual, determina la semana.
  const [semana, setSemana] = useState(() => semanaActualMexico());
  const [semanaGuardada, setSemanaGuardada] = useState(null);
  const [cargando, setCargando] = useState(true);
  const [datosInicializados, setDatosInicializados] = useState(false);
  const [dbError, setDbError] = useState('');
  const [pinned, setPinned] = useState(() => localStorage.getItem('ahorro:perfil') || localStorage.getItem('pinnedUser') || '');
  const [filtro, setFiltro] = useState('todos');
  const [busqueda, setBusqueda] = useState('');
  const [usuario, setUsuario] = useState(null);
  const [admin, setAdmin] = useState(false);
  const [validandoAdmin, setValidandoAdmin] = useState(true);
  const [adminOpen, setAdminOpen] = useState(false);
  const [correo, setCorreo] = useState('');
  const [contrasena, setContrasena] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [authError, setAuthError] = useState('');
  const [uidParaAutorizar, setUidParaAutorizar] = useState('');
  const [detallePermiso, setDetallePermiso] = useState('');
  const [authBusy, setAuthBusy] = useState(false);
  const [revisionPermiso, setRevisionPermiso] = useState(0);
  const [revisandoPermiso, setRevisandoPermiso] = useState(false);
  const [operacion, setOperacion] = useState('');
  const [mensaje, setMensaje] = useState('');
  const [installEvent, setInstallEvent] = useState(null);
  const [installOpen, setInstallOpen] = useState(false);
  const [instalada, setInstalada] = useState(() => window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone === true);
  const [online, setOnline] = useState(navigator.onLine);
  const [mobileMenu, setMobileMenu] = useState(false);

  useEffect(() => {
    const cancel = onValue(ref(database, 'ahorro'), (snapshot) => {
      const data = snapshot.val();
      setDatosInicializados(Boolean(data?.integrantes));
      setIntegrantes(data?.integrantes || {});
      setSemanaGuardada(Number.isInteger(Number(data?.semana)) ? Number(data?.semana) : null);
      setDbError('');
      setCargando(false);
    }, (error) => {
      console.error('No se pudieron leer los datos:', error);
      setDbError('No se pueden leer los datos de Firebase. Revisa la conexión y las reglas de lectura.');
      setCargando(false);
    });
    return () => cancel();
  }, []);

  // Siempre calculamos desde la FECHA de Ciudad de México, no desde el reloj
  // local del dispositivo. Al abrir la app tras días cerrada, se pone al día.
  // Mientras permanezca abierta, se actualiza en el cambio de lunes.
  useEffect(() => {
    const actualizar = () => setSemana(semanaActualMexico());
    const reloj = window.setInterval(actualizar, 1000);
    document.addEventListener('visibilitychange', actualizar);
    window.addEventListener('focus', actualizar);
    actualizar();
    return () => {
      window.clearInterval(reloj);
      document.removeEventListener('visibilitychange', actualizar);
      window.removeEventListener('focus', actualizar);
    };
  }, []);

  // Si entra un administrador y el cron aún no actualizó el dato persistido,
  // se sincroniza SOLAMENTE ahorro/semana. Nunca se modifican aportaciones.
  // Es idempotente: múltiples pestañas no incrementan la semana dos veces.
  useEffect(() => {
    if (!admin || !datosInicializados || semanaGuardada === semana) return;
    let activo = true;
    const sincronizar = async () => {
      try {
        await runTransaction(ref(database, 'ahorro/semana'), (actual) => {
          if (Number(actual) === semana) return;
          return semana;
        }, { applyLocally: false });
      } catch (error) {
        if (activo) console.error('No se pudo sincronizar la semana calendario:', error);
      }
    };
    sincronizar();
    return () => { activo = false; };
  }, [admin, datosInicializados, semanaGuardada, semana]);

  // Un resultado nulo del listener no equivale a una denegación de permisos.
  // Confirmamos los datos directamente contra Firebase antes de concluir que faltan.
  // La comprobación REST oficial está autenticada con el token real de este usuario.
  // Las reglas de RTDB siguen siendo la autoridad para autorizar escrituras.
  useEffect(() => {
    let activo = true;
    let cancelarLectura = () => {};
    let uidEnEscucha = '';
    let intento = 0;

    const permitirAcceso = () => {
      setAdmin(true);
      setValidandoAdmin(false);
      setAuthError('');
      setUidParaAutorizar('');
      setDetallePermiso('');
      setAdminOpen(false);
      setContrasena('');
    };

    const cancelarAuth = onAuthStateChanged(auth, (cuenta) => {
      cancelarLectura();
      cancelarLectura = () => {};
      const version = ++intento;
      uidEnEscucha = cuenta?.uid || '';
      setUsuario(cuenta);
      setAdmin(false);
      setUidParaAutorizar(cuenta?.uid || '');
      setDetallePermiso('');
      setValidandoAdmin(Boolean(cuenta));
      if (!cuenta) {
        setAuthError('');
        return;
      }

      const uid = cuenta.uid;
      const rutaPermiso = `adminUids/${uid}`;
      const procesarLectura = (snapshot) => {
        if (!activo || uidEnEscucha !== uid) return;
        const lectura = ++intento;
        const valor = snapshot.val();
        if (valor === true) {
          permitirAcceso();
          return;
        }
        setAdmin(false);
        setUidParaAutorizar(uid);
        if (valor !== null) {
          setValidandoAdmin(false);
          setAuthError('El permiso existe, pero no tiene el valor Boolean true.');
          setDetallePermiso(`La lectura de /${rutaPermiso} devolvió ${JSON.stringify(valor)} (${typeof valor}). Debe ser true, sin comillas.`);
          return;
        }

        setValidandoAdmin(true);
        setAuthError('Comprobando autorización directamente con Firebase…');
        setDetallePermiso('El listener devolvió null. Verificando el dato directamente en el servidor de Firebase…');
        permisoDesdeServidor(cuenta).then((respuesta) => {
          if (!activo || uidEnEscucha !== uid || lectura !== intento) return;
          if (respuesta === true) {
            permitirAcceso();
            return;
          }
          setAdmin(false);
          setValidandoAdmin(false);
          setAuthError('Tu cuenta inició sesión, pero el servidor no confirmó el permiso administrativo.');
          if (respuesta === null) {
            setDetallePermiso(`El listener y una consulta HTTPS autenticada devolvieron null para /${rutaPermiso} en ${firebaseConfig.databaseURL}. El archivo exportado contiene true, así que hay que comprobar el nombre exacto de la clave y el proyecto de origen del exportado; no borres registros.`);
          } else {
            setDetallePermiso(`La consulta HTTPS autenticada devolvió ${JSON.stringify(respuesta)} (${typeof respuesta}) en /${rutaPermiso}. Para administrar debe ser Boolean true.`);
          }
        }).catch((error) => {
          if (!activo || uidEnEscucha !== uid || lectura !== intento) return;
          setAdmin(false);
          setValidandoAdmin(false);
          setAuthError('No se pudo comprobar la autorización en el servidor.');
          setDetallePermiso(`El listener devolvió null y la consulta HTTPS no pudo confirmarlo: ${error?.message || 'error desconocido'}. No se han cambiado permisos ni datos.`);
        });
      };
      const procesarError = (error) => {
        if (!activo || uidEnEscucha !== uid || version > intento) return;
        ++intento;
        setValidandoAdmin(false);
        setAdmin(false);
        setUidParaAutorizar(uid);
        setAuthError('Firebase no permitió consultar el permiso administrativo.');
        setDetallePermiso(`La lectura de /${rutaPermiso} falló: ${error?.code || error?.message || 'error desconocido'}. Comprueba que las reglas estén publicadas.`);
      };
      cancelarLectura = onValue(ref(database, rutaPermiso), procesarLectura, procesarError);
    });

    return () => {
      activo = false;
      uidEnEscucha = '';
      ++intento;
      cancelarLectura();
      cancelarAuth();
    };
  }, [revisionPermiso]);

  useEffect(() => {
    const onOnline = () => setOnline(navigator.onLine);
    const onInstall = (event) => { event.preventDefault(); setInstallEvent(event); };
    const onInstalled = () => { setInstalada(true); setInstallOpen(false); setInstallEvent(null); };
    window.addEventListener('online', onOnline);
    window.addEventListener('offline', onOnline);
    window.addEventListener('beforeinstallprompt', onInstall);
    window.addEventListener('appinstalled', onInstalled);
    return () => {
      window.removeEventListener('online', onOnline);
      window.removeEventListener('offline', onOnline);
      window.removeEventListener('beforeinstallprompt', onInstall);
      window.removeEventListener('appinstalled', onInstalled);
    };
  }, []);

  useEffect(() => {
    if (!mensaje) return;
    const timer = setTimeout(() => setMensaje(''), 4500);
    return () => clearTimeout(timer);
  }, [mensaje]);

  const miembros = useMemo(() => Object.entries(integrantes).map(([name, data]) => ({
    name, pagos: Math.max(0, Number(data?.pagos) || 0),
  })).sort((a, b) => a.name.localeCompare(b.name, 'es')), [integrantes]);
  const stats = useMemo(() => {
    const total = miembros.reduce((sum, item) => sum + item.pagos * CUOTA, 0);
    const esperado = miembros.length * semana * CUOTA;
    const pendiente = miembros.reduce((sum, item) => sum + Math.max(0, semana - item.pagos) * CUOTA, 0);
    const alDia = miembros.filter((m) => m.pagos >= semana).length;
    return { total, esperado, pendiente, alDia, faltantes: miembros.length - alDia, porcentaje: esperado > 0 ? Math.min(100, Math.round(total / esperado * 100)) : 0 };
  }, [miembros, semana]);
  const miembrosVisibles = useMemo(() => miembros
    .filter((m) => m.name.toLocaleLowerCase('es-MX').includes(busqueda.trim().toLocaleLowerCase('es-MX')))
    .filter((m) => filtro === 'todos' || (filtro === 'al-dia' ? m.pagos >= semana : m.pagos < semana))
    .sort((a, b) => (a.name === pinned ? -1 : 0) - (b.name === pinned ? -1 : 0) || a.name.localeCompare(b.name, 'es')),
  [miembros, busqueda, filtro, pinned, semana]);

  const togglePin = (name) => {
    const next = pinned === name ? '' : name;
    setPinned(next);
    if (next) localStorage.setItem('ahorro:perfil', next);
    else localStorage.removeItem('ahorro:perfil');
    localStorage.removeItem('pinnedUser');
  };

  const submitAdmin = async (e) => {
    e.preventDefault();
    setAuthError('');
    setDetallePermiso('');
    setAuthBusy(true);
    try {
      const credencial = await signInWithEmailAndPassword(auth, correo.trim(), contrasena);
      // Aseguramos un token actualizado antes de repetir la suscripción.
      await credencial.user.getIdToken(true);
      setUidParaAutorizar(credencial.user.uid);
      setContrasena('');
      // El listener de onAuthStateChanged/onValue valida el permiso sin
      // cerrar automáticamente la sesión ni confiar en el estado visual.
    } catch (error) {
      console.error('No se pudo iniciar sesión:', error?.code || error);
      setAuthError(friendlyAuthError(error));
    } finally {
      setAuthBusy(false);
    }
  };

  const reintentarPermiso = async () => {
    if (!auth.currentUser || revisandoPermiso) return;
    setRevisandoPermiso(true);
    setValidandoAdmin(true);
    setAuthError('');
    try {
      await auth.currentUser.getIdToken(true);
      // Reactiva el listener para obtener una comprobación nueva del servidor.
      setRevisionPermiso((actual) => actual + 1);
    } catch (error) {
      console.error('No se pudo actualizar la sesión:', error);
      setAuthError('No se pudo renovar la sesión. Comprueba tu conexión.');
      setValidandoAdmin(false);
    } finally {
      setRevisandoPermiso(false);
    }
  };

  const copiarUid = async () => {
    if (!uidParaAutorizar) return;
    try {
      await navigator.clipboard.writeText(uidParaAutorizar);
      setMensaje('UID copiado. Pégalo en Firebase → Realtime Database → adminUids.');
    } catch {
      setMensaje('Selecciona el UID mostrado en pantalla y cópialo manualmente.');
    }
  };

  const resetPassword = async () => {
    if (!correo.trim()) { setAuthError('Primero escribe tu correo electrónico.'); return; }
    setAuthBusy(true);
    try {
      await sendPasswordResetEmail(auth, correo.trim());
      setAuthError('');
      setMensaje('Si la cuenta existe, recibirás un correo para restablecer tu contraseña.');
    } catch (error) {
      setAuthError(friendlyAuthError(error));
    } finally { setAuthBusy(false); }
  };

  const cerrarSesion = async () => {
    try { await signOut(auth); setAdmin(false); setMensaje('Sesión cerrada.'); }
    catch { setMensaje('No se pudo cerrar la sesión.'); }
  };

  const changePayment = async (name, amount) => {
    if (!admin || operacion) return;
    setOperacion(name);
    try {
      const paymentRef = ref(database, `ahorro/integrantes/${name}/pagos`);
      const result = await runTransaction(paymentRef, (current) => {
        const actual = Math.max(0, Number(current) || 0);
        return Math.max(0, actual + amount);
      }, { applyLocally: false });
      if (!result.committed) throw new Error('Operación no confirmada');
      setMensaje(`Aportación ${amount > 0 ? 'registrada' : 'retirada'} para ${name}.`);
    } catch (error) {
      console.error('Error al actualizar el pago:', error);
      setMensaje('No se pudo guardar el pago. Verifica tus permisos de Firebase.');
    } finally { setOperacion(''); }
  };

  const seedMembers = async () => {
    if (!admin || datosInicializados || operacion) return;
    setOperacion('inicializar');
    try {
      const result = await runTransaction(ref(database, 'ahorro'), (current) => {
        if (current !== null) return;
        const list = {};
        INTEGRANTES_INICIALES.forEach((name) => { list[name] = { pagos: 0 }; });
        return { semana: semanaActualMexico(), integrantes: list };
      }, { applyLocally: false });
      setMensaje(result.committed ? 'Lista de integrantes creada correctamente.' : 'La lista ya existe; no se modificaron los datos.');
    } catch (error) {
      console.error('Error al inicializar:', error);
      setMensaje('No se pudo preparar la lista. Comprueba las reglas de Firebase.');
    } finally { setOperacion(''); }
  };

  const installApp = async () => {
    if (!installEvent) { setInstallOpen(true); return; }
    try {
      await installEvent.prompt();
      await installEvent.userChoice;
      setInstallEvent(null);
    } catch { setInstallOpen(true); }
  };

  return (
    <div className="app-shell">
      <div className="background-orb background-orb-one"/><div className="background-orb background-orb-two"/>
      <header className="site-header">
        <div className="header-inner">
          <a className="brand" href="#inicio" aria-label="Ir al inicio de Ahorro Grupal">
            <img src="/icons/icon-192.png" alt="" width="43" height="43"/>
            <span className="brand-text"><strong>Ahorro<span>Grupal</span></strong><small>INGENIERÍA INDUSTRIAL</small></span>
          </a>
          <nav className={`top-nav ${mobileMenu ? 'nav-open' : ''}`} aria-label="Navegación principal">
            <a className="nav-active" href="#inicio" onClick={() => setMobileMenu(false)}>Resumen</a>
            <a href="#integrantes" onClick={() => setMobileMenu(false)}>Integrantes</a>
            <button type="button" onClick={() => { setInstallOpen(true); setMobileMenu(false); }}><Download size={16}/> Instalar app</button>
          </nav>
          <div className="header-actions">
            <span className={`connection-pill ${online ? '' : 'is-offline'}`}><span/>{online ? 'En línea' : 'Sin conexión'}</span>
            <button type="button" className={`header-admin ${admin ? 'header-admin-on' : ''}`} onClick={() => admin ? cerrarSesion() : setAdminOpen(true)}>
              {admin ? <LogOut size={17}/> : <LockKeyhole size={17}/>}<span>{admin ? 'Salir de admin' : 'Administración'}</span>
            </button>
            <button type="button" className="mobile-menu icon-button" onClick={() => setMobileMenu(!mobileMenu)} aria-label={mobileMenu ? 'Cerrar menú' : 'Abrir menú'}>{mobileMenu ? <X size={21}/> : <Menu size={21}/>}</button>
          </div>
        </div>
      </header>

      <main className="main-content" id="inicio">
        <section className="welcome-row">
          <div className="week-pill" title={`Cambio automático los lunes a las 00:00, hora de Ciudad de México. Próximo: ${proximoLunesMexico()}`}><CalendarDays size={19}/><span>Semana actual</span><strong>{semana.toString().padStart(2, '0')}</strong></div>
        </section>

        {!online && <div className="alert-info"><CloudOff size={18}/> Estás sin conexión. Puedes abrir la app instalada, pero los datos y pagos requieren internet.</div>}
        {dbError && <div className="alert-error"><AlertTriangle size={18}/> {dbError}</div>}
        {!cargando && !datosInicializados && !dbError && <div className="alert-info"><Info size={18}/> Todavía no existe la lista de aportaciones en Firebase. {admin ? 'Puedes crearla con el botón que aparece abajo.' : 'Un administrador debe prepararla.'}</div>}

        <section className="dashboard-grid" aria-label="Resumen de ahorro">
          <div className="main-balance">
            <div className="balance-decor one"/><div className="balance-decor two"/>
            <div className="balance-inner">
              <div className="balance-top"><span className="balance-tag"><Wallet size={17}/> Fondo grupal</span></div>
              <div className="balance-body"><p>AHORRO TOTAL ACUMULADO</p><h2>{cargando ? '—' : currency(stats.total)}</h2><span>$20 por semana</span></div>
              <div className="balance-bottom"><div className="balance-progress-heading"><span>Progreso de aportaciones</span><strong>{stats.porcentaje}%</strong></div><div className="balance-track"><span style={{ width: `${stats.porcentaje}%` }}/></div><div className="balance-foot"><span>Meta semanal acumulada: {currency(stats.esperado)}</span><span>Semana {semana}</span></div></div>
              <div className="hero-coin" aria-hidden="true"><img src="/icons/icon-512.png" alt=""/></div>
            </div>
          </div>
          <div className="metrics-row">
            <Metric icon={UsersRound} label="Integrantes" value={cargando ? '—' : miembros.length} sub="Personas que forman el ahorro" tone="blue"/>
            <Metric icon={CheckCheck} label="Al corriente" value={cargando ? '—' : stats.alDia} sub="Integrantes sin pagos pendientes" tone="purple"/>
            <Metric icon={ArrowDownRight} label="Por recaudar" value={cargando ? '—' : currency(stats.pendiente)} sub="Aportaciones pendientes hasta hoy" tone="orange"/>
          </div>
        </section>

        <section className="members-section" id="integrantes">
          <div className="section-heading"><div><p className="eyebrow">NUESTRO EQUIPO</p><h2>Estado de aportaciones <span className="count-circle">{miembros.length}</span></h2><p>Consulta tu progreso o encuentra a cualquier integrante.</p></div>{admin && <div className="admin-badge"><ShieldCheck size={16}/> Modo administrador</div>}</div>
          <div className="list-toolbar"><label className="search-field"><Search size={19}/><input type="search" placeholder="Buscar integrante por nombre..." value={busqueda} onChange={(e) => setBusqueda(e.target.value)} aria-label="Buscar integrante"/>{busqueda && <button type="button" onClick={() => setBusqueda('')} aria-label="Limpiar búsqueda"><X size={17}/></button>}</label><div className="filter-tabs" role="group" aria-label="Filtrar integrantes"><button type="button" className={filtro === 'todos' ? 'selected' : ''} onClick={() => setFiltro('todos')}>Todos</button><button type="button" className={filtro === 'al-dia' ? 'selected' : ''} onClick={() => setFiltro('al-dia')}>Al corriente</button><button type="button" className={filtro === 'pendientes' ? 'selected' : ''} onClick={() => setFiltro('pendientes')}>Pendientes</button></div></div>
          <div className="list-topline"><span><Filter size={15}/> {miembrosVisibles.length} {miembrosVisibles.length === 1 ? 'integrante' : 'integrantes'}</span><span><Pin size={14}/> Fija tu perfil para verlo primero</span></div>
          {cargando ? <div className="loading-members"><RotateCw className="spinner" size={23}/> Consultando aportaciones...</div> : miembrosVisibles.length ? (
            <div className="members-list">{miembrosVisibles.map((m) => <MemberCard key={m.name} name={m.name} pagos={m.pagos} semana={semana} pinned={pinned === m.name} onPin={togglePin} isAdmin={admin} onPayment={changePayment} busy={Boolean(operacion)}/>)}</div>
          ) : <div className="empty-list"><Search size={30}/><strong>No encontramos integrantes</strong><p>{miembros.length ? 'Prueba con otro nombre o cambia el filtro.' : 'La lista aún no tiene registros.'}</p><button type="button" onClick={() => { setBusqueda(''); setFiltro('todos'); }}>Limpiar filtros</button></div>}
        </section>

        {admin && <section className="admin-panel"><div className="admin-panel-copy"><span><ShieldCheck size={18}/> HERRAMIENTAS ADMINISTRATIVAS</span><h3>Gestiona el progreso del grupo</h3><p>Registra aportaciones con los botones + y − de cada integrante. Los cambios se guardan en Firebase.</p><p><CalendarDays size={16} style={{ verticalAlign: 'middle', marginRight: 6 }}/>Semana automática: lunes 00:00 (Ciudad de México). Próximo cambio: {proximoLunesMexico()}.</p></div><div className="admin-panel-actions">{!datosInicializados && <button type="button" className="secondary-action" disabled={Boolean(operacion)} onClick={seedMembers}><Plus size={17}/> Crear lista inicial</button>}<span className="primary-action" style={{ cursor: 'default', display: 'flex', alignItems: 'center', gap: 9 }}><CheckCircle2 size={18}/> Avance semanal automático activo</span></div></section>}

        <footer className="site-footer"><div className="footer-brand"><img src="/icons/icon-192.png" width="31" height="31" alt=""/><div><b>AhorroGrupal</b><small>Ingeniería Industrial</small></div></div><span>Hecho para ahorrar juntos. • {new Date().getFullYear()}</span><button type="button" onClick={installApp}><Download size={16}/> {instalada ? 'App instalada' : 'Instalar aplicación'}</button></footer>
      </main>

      {mensaje && <div role="status" className="toast"><CheckCircle2 size={19}/>{mensaje}<button type="button" onClick={() => setMensaje('')} aria-label="Cerrar mensaje"><X size={15}/></button></div>}

      {adminOpen && <div className="modal-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) setAdminOpen(false); }}>
        <div className="modal" role="dialog" aria-modal="true" aria-labelledby="admin-modal-title">
          <button type="button" className="modal-close" onClick={() => { setAdminOpen(false); setAuthError(''); }} aria-label="Cerrar"><X size={21}/></button>
          {usuario && !admin && !validandoAdmin ? <><div className="modal-icon"><ShieldCheck size={27}/></div><h2 id="admin-modal-title">Verificación de permisos</h2><p>Tu cuenta inició sesión correctamente, pero Firebase todavía no confirmó el permiso administrativo.</p><div className="modal-warning">No vuelvas a crear tu usuario. Comprueba el resultado de lectura que aparece abajo.</div>{uidParaAutorizar && <div className="uid-debug"><span>UID exacto de tu cuenta:</span><code>{uidParaAutorizar}</code><button type="button" onClick={copiarUid}><Copy size={15}/> Copiar UID</button>{detallePermiso && <p>{detallePermiso}</p>}</div>}<button className="modal-submit" type="button" disabled={revisandoPermiso} onClick={reintentarPermiso}><RotateCw size={17}/> {revisandoPermiso ? 'Comprobando...' : 'Volver a comprobar el permiso'}</button><button className="forgot-password" type="button" onClick={cerrarSesion}>Cerrar sesión</button></> : <>
            <div className="modal-icon"><LockKeyhole size={26}/></div><h2 id="admin-modal-title">Acceso administrativo</h2><p>Solo las personas autorizadas pueden registrar aportaciones.</p>
            <form onSubmit={submitAdmin}><label htmlFor="admin-email">Correo electrónico</label><input id="admin-email" autoComplete="username" type="email" placeholder="tu-correo@ejemplo.com" required value={correo} onChange={(e) => setCorreo(e.target.value)}/><label htmlFor="admin-password">Contraseña</label><div className="password-field"><input id="admin-password" autoComplete="current-password" type={showPassword ? 'text' : 'password'} placeholder="Introduce tu contraseña" required value={contrasena} onChange={(e) => setContrasena(e.target.value)}/><button type="button" onClick={() => setShowPassword(!showPassword)} title={showPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'} aria-label={showPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'}>{showPassword ? <EyeOff size={19}/> : <Eye size={19}/>}</button></div>{authError && <div role="alert" className="form-error">{authError}</div>}<button disabled={authBusy || validandoAdmin} className="modal-submit" type="submit">{authBusy ? 'Verificando...' : <><ShieldCheck size={18}/> Entrar al panel</>}</button></form>{uidParaAutorizar && <div className="uid-debug"><span>UID exacto de tu cuenta:</span><code>{uidParaAutorizar}</code><button type="button" onClick={copiarUid}><Copy size={15}/> Copiar UID</button>{detallePermiso && <p>{detallePermiso}</p>}</div>}<button type="button" className="forgot-password" onClick={resetPassword} disabled={authBusy}>¿Olvidaste tu contraseña?</button>
          </>}
        </div>
      </div>}

      {installOpen && <div className="modal-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) setInstallOpen(false); }}><div className="modal install-modal" role="dialog" aria-modal="true" aria-labelledby="install-title"><button type="button" className="modal-close" onClick={() => setInstallOpen(false)} aria-label="Cerrar"><X size={21}/></button><img className="install-logo" src="/icons/icon-192.png" alt="Logotipo Ahorro Grupal"/><h2 id="install-title">Tu ahorro, siempre a la mano</h2><p>Instala Ahorro Grupal para abrirlo como una aplicación, sin buscar la dirección cada vez.</p>{instalada ? <div className="modal-warning">La aplicación ya está instalada en este dispositivo.</div> : <div className="install-instructions"><div><b>Android y computadora</b><span>En Chrome o Edge, usa el ícono de instalación en la barra de direcciones o el menú ⋮ → Instalar aplicación.</span></div><div><b>iPhone o iPad</b><span>Abre en Safari, toca Compartir y elige «Añadir a pantalla de inicio».</span></div></div>}{installEvent && !instalada && <button className="modal-submit" type="button" onClick={async () => { setInstallOpen(false); await installApp(); }}><Download size={18}/> Instalar ahora</button>}<small className="install-disclaimer">Requiere conexión para sincronizar aportaciones con Firebase.</small></div></div>}
    </div>
  );
}
