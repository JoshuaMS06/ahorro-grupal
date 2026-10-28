import { useState, useEffect } from 'react';
import { initializeApp } from 'firebase/app';
import { getDatabase, ref, onValue, update } from 'firebase/database';
import { Pin, Lock, Unlock, Plus, Minus, FastForward } from 'lucide-react';

const firebaseConfig = {
  apiKey: "AIzaSyA3AN8yCezlw3ORkPUCZp0Af97JgAoMbOE",
  authDomain: "ahorro-grupal-industrial.firebaseapp.com",
  projectId: "ahorro-grupal-industrial",
  storageBucket: "ahorro-grupal-industrial.firebasestorage.app",
  messagingSenderId: "493506921547",
  appId: "1:493506921547:web:97ece4e262f02b6a9eb9ce",
  measurementId: "G-KQRYGD903K",
  databaseURL: "https://ahorro-grupal-industrial-default-rtdb.firebaseio.com"
};

const app = initializeApp(firebaseConfig);
const db = getDatabase(app);

const INTEGRANTES_INICIALES = [
  "Alan Patiño", "Sergio Emilio", "Eduardo Benitez", "Joshua Moreno", "Lilia Belén", 
  "Ana María", "Jose Alberto", "Camila Aimee", "Jesús Eduardo", "Brisa Yavhe", 
  "Liz Vianey", "Delia Nahomy", "Esther Terán", "Axel Said", "Ameyalli Arista", 
  "Marely Gutenberg", "Hanna Citlali", "Samuel Rafael", "Sodel Eduardo"
];
const ADMIN_EMAILS = ["jouumores@gmail.com", "samuelrafaelcrispinrojas13@gmail.com"];

export default function App() {
  const [usuarios, setUsuarios] = useState({});
  const [semanaActual, setSemanaActual] = useState(1);
  const [pinnedUser, setPinnedUser] = useState(localStorage.getItem('pinnedUser') || null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [emailInput, setEmailInput] = useState("");
  const [showAdminLogin, setShowAdminLogin] = useState(false);

  useEffect(() => {
    const dbRef = ref(db, 'ahorro');
    onValue(dbRef, (snapshot) => {
      const data = snapshot.val();
      if (!data) {
        const initialState = { semana: 1, integrantes: {} };
        INTEGRANTES_INICIALES.forEach(nombre => {
          initialState.integrantes[nombre] = { pagos: 0 };
        });
        update(dbRef, initialState);
      } else {
        setUsuarios(data.integrantes || {});
        setSemanaActual(data.semana || 1);
      }
    });
  }, []);

  const totalAcumulado = Object.values(usuarios).reduce((acc, user) => acc + (user.pagos * 20), 0);

  const togglePin = (nombre) => {
    if (pinnedUser === nombre) {
      setPinnedUser(null);
      localStorage.removeItem('pinnedUser');
    } else {
      setPinnedUser(nombre);
      localStorage.setItem('pinnedUser', nombre);
    }
  };

  const handleAdminLogin = () => {
    if (ADMIN_EMAILS.includes(emailInput.trim().toLowerCase())) {
      setIsAdmin(true);
      setShowAdminLogin(false);
    } else {
      alert("Correo no autorizado");
    }
  };

  const actualizarPago = (nombre, cantidad) => {
    const nuevoPago = Math.max(0, (usuarios[nombre]?.pagos || 0) + cantidad);
    update(ref(db, `ahorro/integrantes/${nombre}`), { pagos: nuevoPago });
  };

  const avanzarSemana = () => {
    if(window.confirm("¿Seguro que quieres avanzar a la siguiente semana? Esto aumentará la deuda de quienes no hayan pagado.")) {
      update(ref(db, 'ahorro'), { semana: semanaActual + 1 });
    }
  };

  const usuariosOrdenados = Object.entries(usuarios).sort(([nombreA], [nombreB]) => {
    if (nombreA === pinnedUser) return -1;
    if (nombreB === pinnedUser) return 1;
    return nombreA.localeCompare(nombreB);
  });

  return (
    <div className="min-h-screen bg-neutral-950 text-white p-4 font-sans selection:bg-emerald-500/30">
      <div className="max-w-md mx-auto space-y-6 pb-20">
        
        <div className="text-center space-y-2 mt-6">
          <h1 className="text-3xl font-bold bg-gradient-to-r from-emerald-400 to-cyan-400 bg-clip-text text-transparent">
            Ahorro Grupal
          </h1>
          <p className="text-neutral-400">Ingeniería Industrial • Semana {semanaActual}</p>
        </div>

        <div className="bg-neutral-900 border border-neutral-800 rounded-2xl p-6 text-center shadow-2xl relative overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-br from-emerald-500/10 to-transparent opacity-50"></div>
          <p className="text-neutral-400 text-sm font-medium relative z-10">Total Acumulado Histórico</p>
          <p className="text-5xl font-black text-white mt-2 relative z-10">${totalAcumulado}</p>
        </div>

        <div className="space-y-3">
          {usuariosOrdenados.map(([nombre, datos]) => {
            const isPinned = nombre === pinnedUser;
            const alCorriente = datos.pagos >= semanaActual;
            const deuda = alCorriente ? 0 : (semanaActual - datos.pagos) * 20;

            return (
              <div key={nombre} className={`p-4 rounded-xl border flex items-center justify-between transition-all ${
                isPinned ? 'bg-neutral-800 border-cyan-500/50 shadow-[0_0_15px_rgba(6,182,212,0.15)]' : 'bg-neutral-900/50 border-neutral-800'
              }`}>
                <div className="flex items-center gap-3">
                  <button onClick={() => togglePin(nombre)} className={`${isPinned ? 'text-cyan-400' : 'text-neutral-600'}`}>
                    <Pin size={20} className={isPinned ? 'fill-cyan-400' : ''} />
                  </button>
                  <div>
                    <p className="font-medium">{nombre}</p>
                    <p className="text-xs text-neutral-400">Pagos realizados: {datos.pagos}</p>
                  </div>
                </div>

                <div className="flex items-center gap-4">
                  <div className="text-right">
                    {alCorriente ? (
                      <span className="text-emerald-400 text-sm font-bold bg-emerald-400/10 px-2 py-1 rounded-md">Al corriente</span>
                    ) : (
                      <span className="text-red-400 text-sm font-bold bg-red-400/10 px-2 py-1 rounded-md">Debe ${deuda}</span>
                    )}
                  </div>

                  {isAdmin && (
                    <div className="flex items-center gap-1 bg-neutral-950 rounded-lg p-1">
                      <button onClick={() => actualizarPago(nombre, -1)} className="p-2 hover:bg-neutral-800 rounded-md text-red-400"><Minus size={16} /></button>
                      <button onClick={() => actualizarPago(nombre, 1)} className="p-2 hover:bg-neutral-800 rounded-md text-emerald-400"><Plus size={16} /></button>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        <div className="pt-8 flex flex-col items-center gap-4">
          {!isAdmin ? (
            <div className="w-full flex flex-col items-center gap-3">
              <button onClick={() => setShowAdminLogin(!showAdminLogin)} className="text-neutral-600 flex items-center gap-2 text-sm hover:text-neutral-400 transition-colors">
                <Lock size={16} /> Administración
              </button>
              {showAdminLogin && (
                <div className="flex gap-2 w-full max-w-xs">
                  <input 
                    type="email" 
                    placeholder="Correo admin..." 
                    className="flex-1 bg-neutral-900 border border-neutral-800 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-cyan-500"
                    value={emailInput}
                    onChange={(e) => setEmailInput(e.target.value)}
                  />
                  <button onClick={handleAdminLogin} className="bg-cyan-500 text-neutral-950 px-4 rounded-lg text-sm font-bold">Entrar</button>
                </div>
              )}
            </div>
          ) : (
            <div className="w-full space-y-4 border border-cyan-500/30 bg-cyan-500/5 rounded-xl p-4">
              <div className="flex justify-between items-center text-cyan-400 mb-2">
                <span className="flex items-center gap-2 text-sm font-bold"><Unlock size={16} /> Modo Admin Activo</span>
                <button onClick={() => setIsAdmin(false)} className="text-xs underline">Cerrar sesión</button>
              </div>
              <button onClick={avanzarSemana} className="w-full flex items-center justify-center gap-2 bg-neutral-900 border border-neutral-700 hover:bg-neutral-800 text-white py-3 rounded-lg font-medium transition-colors">
                <FastForward size={18} /> Avanzar a Semana {semanaActual + 1}
              </button>
            </div>
          )}
        </div>

      </div>
    </div>
  );
}