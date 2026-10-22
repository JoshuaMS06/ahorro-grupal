import React, { useState, useEffect, useMemo } from 'react';
import { initializeApp } from 'firebase/app';
import { getAuth, signInAnonymously, signInWithCustomToken, onAuthStateChanged } from 'firebase/auth';
import { getFirestore, collection, onSnapshot, doc, updateDoc, setDoc, query } from 'firebase/firestore';
import { Wallet, CheckCircle2, AlertCircle, Lock, Unlock, Users, CalendarDays, Plus, Minus, X, ChevronRight, Pin } from 'lucide-react';

// --- CONFIGURACIÓN DE FIREBASE ---
const firebaseConfig = typeof __firebase_config !== 'undefined' ? JSON.parse(__firebase_config) : {};
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const appId = typeof __app_id !== 'undefined' ? __app_id : 'ahorro-grupal-app';

// Lista inicial de integrantes (ordenada alfabéticamente)
const INITIAL_MEMBERS = [
  "Alan Patiño", "Ameyalli Arista", "Ana María", "Axel Said", 
  "Brisa Yavhe", "Camila Aimee", "Delia Nahomy", "Eduardo Benitez", 
  "Esther Terán", "Hanna Citlali", "Jesús Eduardo", "Jose Alberto", 
  "Joshua Moreno", "Lilia Belén", "Liz Vianey", "Marely Gutenberg", 
  "Samuel Rafael", "Sergio Emilio", "Sodel Eduardo"
].sort();

const ADMIN_EMAILS = ['jouumores@gmail.com', 'samuelrafaelcrispinrojas13@gmail.com'];
const QUOTA = 20;

// Función para generar un ID único y seguro basado en el nombre (evita duplicados)
const generateSafeId = (name) => {
  return name.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]/g, '_');
};

export default function AhorroGrupal() {
  const [user, setUser] = useState(null);
  const [members, setMembers] = useState([]);
  const [currentWeek, setCurrentWeek] = useState(1);
  const [loading, setLoading] = useState(true);
  
  // Estados de Administrador
  const [isAdmin, setIsAdmin] = useState(false);
  const [showAdminModal, setShowAdminModal] = useState(false);
  const [adminEmail, setAdminEmail] = useState('');
  const [adminError, setAdminError] = useState('');
  const [showAdvanceModal, setShowAdvanceModal] = useState(false);

  // Estado para el integrante fijado localmente
  const [pinnedMemberId, setPinnedMemberId] = useState(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('ahorro_pinned_member');
    }
    return null;
  });

  // 1. Autenticación
  useEffect(() => {
    const initAuth = async () => {
      try {
        if (typeof __initial_auth_token !== 'undefined' && __initial_auth_token) {
          await signInWithCustomToken(auth, __initial_auth_token);
        } else {
          await signInAnonymously(auth);
        }
      } catch (error) {
        console.error("Error de autenticación:", error);
      }
    };
    initAuth();

    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
    });
    return () => unsubscribe();
  }, []);

  // 2. Escuchar Datos (Miembros y Configuración Global)
  useEffect(() => {
    if (!user) return;

    const membersRef = collection(db, 'artifacts', appId, 'public', 'data', 'members');
    const configRef = doc(db, 'artifacts', appId, 'public', 'data', 'config', 'appState');

    // Listener para Estado Global (Semana actual)
    const unsubConfig = onSnapshot(configRef, async (docSnap) => {
      if (!docSnap.exists()) {
        await setDoc(configRef, { currentWeek: 1 });
      } else {
        setCurrentWeek(docSnap.data().currentWeek || 1);
      }
    }, (err) => console.error("Error en config:", err));

    // Listener para Miembros
    const q = query(membersRef);
    const unsubMembers = onSnapshot(q, async (snapshot) => {
      const membersData = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));

      // Sincronizar automáticamente la lista (Crea a los que faltan de forma segura)
      const existingNames = membersData.map(m => m.name);
      const missingNames = INITIAL_MEMBERS.filter(n => !existingNames.includes(n));
      
      if (missingNames.length > 0) {
        missingNames.forEach(name => {
          // Usamos un ID fijo basado en el nombre. Así NUNCA se duplicará en la base de datos.
          const docId = generateSafeId(name);
          const newDocRef = doc(db, 'artifacts', appId, 'public', 'data', 'members', docId);
          setDoc(newDocRef, { name: name, paymentsMade: 0 }, { merge: true });
        });
      }

      // Limpiamos duplicados en caso de que ya se hayan creado por el error anterior
      const uniqueMembersMap = new Map();
      membersData.forEach(member => {
        if (!uniqueMembersMap.has(member.name)) {
          uniqueMembersMap.set(member.name, member);
        }
      });
      const uniqueMembers = Array.from(uniqueMembersMap.values());

      // Ordenar alfabéticamente siempre
      uniqueMembers.sort((a, b) => a.name.localeCompare(b.name));
      setMembers(uniqueMembers);
      setLoading(false);
    }, (error) => {
      console.error("Error obteniendo miembros:", error);
      setLoading(false);
    });

    return () => {
      unsubConfig();
      unsubMembers();
    };
  }, [user]);

  // --- FUNCIONES DE ADMINISTRADOR ---
  const handleAdminLogin = (e) => {
    e.preventDefault();
    if (ADMIN_EMAILS.includes(adminEmail.toLowerCase().trim())) {
      setIsAdmin(true);
      setShowAdminModal(false);
      setAdminEmail('');
      setAdminError('');
    } else {
      setAdminError('Correo no autorizado.');
    }
  };

  const addPayment = async (member) => {
    if (!isAdmin) return;
    try {
      const docRef = doc(db, 'artifacts', appId, 'public', 'data', 'members', member.id);
      await updateDoc(docRef, { paymentsMade: (member.paymentsMade || 0) + 1 });
    } catch (error) {
      console.error("Error añadiendo pago:", error);
    }
  };

  const removePayment = async (member) => {
    if (!isAdmin) return;
    if ((member.paymentsMade || 0) <= 0) return; // No permitir pagos negativos
    try {
      const docRef = doc(db, 'artifacts', appId, 'public', 'data', 'members', member.id);
      await updateDoc(docRef, { paymentsMade: member.paymentsMade - 1 });
    } catch (error) {
      console.error("Error quitando pago:", error);
    }
  };

  const advanceWeek = async () => {
    if (!isAdmin) return;
    try {
      const configRef = doc(db, 'artifacts', appId, 'public', 'data', 'config', 'appState');
      await updateDoc(configRef, { currentWeek: currentWeek + 1 });
      setShowAdvanceModal(false);
    } catch (error) {
      console.error("Error avanzando semana:", error);
    }
  };

  // --- CÁLCULOS GLOBALES ---
  const stats = useMemo(() => {
    const totalSaved = members.reduce((sum, m) => sum + ((m.paymentsMade || 0) * QUOTA), 0);
    // Dinero que debería haber idealmente (Semanas * Integrantes * Cuota)
    const expectedTotal = currentWeek * members.length * QUOTA;
    const missingTotal = expectedTotal - totalSaved;
    return { totalSaved, missingTotal, expectedTotal };
  }, [members, currentWeek]);

  // Lógica para fijar/desfijar
  const togglePin = (memberId) => {
    if (pinnedMemberId === memberId) {
      setPinnedMemberId(null);
      localStorage.removeItem('ahorro_pinned_member');
    } else {
      setPinnedMemberId(memberId);
      localStorage.setItem('ahorro_pinned_member', memberId);
    }
  };

  // Reordenar miembros para mostrar el fijado primero
  const sortedMembers = useMemo(() => {
    if (!pinnedMemberId) return members;
    const pinned = members.find(m => m.id === pinnedMemberId);
    const others = members.filter(m => m.id !== pinnedMemberId);
    return pinned ? [pinned, ...others] : members;
  }, [members, pinnedMemberId]);

  const getInitials = (name) => {
    return name.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase();
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center text-white">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-500"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-200 font-sans selection:bg-indigo-500/30">
      <div className="max-w-md mx-auto min-h-screen relative shadow-2xl bg-slate-950 overflow-hidden flex flex-col border-x border-slate-900/50">
        
        {/* Efectos de fondo tipo FinTech */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[500px] h-[300px] bg-indigo-600/20 rounded-full blur-[120px] pointer-events-none"></div>
        
        {/* HEADER */}
        <header className="px-6 pt-12 pb-6 relative z-10 flex justify-between items-center">
          <div>
            <h1 className="text-2xl font-black text-white tracking-tight flex items-center gap-2 bg-gradient-to-r from-indigo-400 to-cyan-400 bg-clip-text text-transparent">
              Ahorro Grupal
            </h1>
            <p className="text-sm text-slate-400 font-medium mt-1">Gestión de Ingeniería Ind.</p>
          </div>
          {isAdmin && (
            <div className="bg-indigo-500/10 text-indigo-400 text-xs px-3 py-1.5 rounded-full font-bold border border-indigo-500/20 flex items-center gap-1.5 shadow-[0_0_15px_rgba(99,102,241,0.2)]">
              <Unlock size={14} />
              Admin
            </div>
          )}
        </header>

        {/* CONTENIDO PRINCIPAL */}
        <main className="flex-1 px-5 pb-24 overflow-y-auto relative z-10 space-y-6">
          
          {/* DASHBOARD PRINCIPAL */}
          <div className="bg-slate-900/60 backdrop-blur-xl border border-slate-800 rounded-3xl p-6 shadow-xl relative overflow-hidden">
            <div className="flex justify-between items-start mb-6">
              <div className="flex items-center gap-2 text-slate-400">
                <Wallet size={20} className="text-indigo-400" />
                <h2 className="text-sm font-semibold uppercase tracking-widest">Total Ahorrado</h2>
              </div>
              <div className="flex items-center gap-1.5 bg-slate-950 border border-slate-800 px-3 py-1 rounded-full">
                <CalendarDays size={14} className="text-cyan-400"/>
                <span className="text-xs font-bold text-slate-300">Semana {currentWeek}</span>
              </div>
            </div>
            
            <div className="text-5xl font-black text-white mb-2 tracking-tighter">
              ${stats.totalSaved}<span className="text-2xl text-slate-500 font-medium">.00</span>
            </div>
            
            <div className="flex gap-4 mt-6 pt-6 border-t border-slate-800/50">
               <div>
                  <p className="text-xs text-slate-500 font-medium mb-1">En deuda global</p>
                  <p className="text-sm font-bold text-rose-400">${Math.max(0, stats.missingTotal)}</p>
               </div>
               <div className="w-px bg-slate-800/50"></div>
               <div>
                  <p className="text-xs text-slate-500 font-medium mb-1">Miembros</p>
                  <p className="text-sm font-bold text-slate-300">{members.length}</p>
               </div>
            </div>
          </div>

          {/* CONTROLES ADMIN (NUEVA SEMANA) */}
          {isAdmin && (
            <button 
              onClick={() => setShowAdvanceModal(true)}
              className="w-full bg-indigo-600/10 hover:bg-indigo-600/20 border border-indigo-500/30 text-indigo-300 rounded-2xl p-4 flex items-center justify-center gap-2 text-sm font-bold transition-all shadow-[0_0_20px_rgba(99,102,241,0.1)]"
            >
              <CalendarDays size={18} />
              Avanzar a Nueva Semana (Semana {currentWeek + 1})
            </button>
          )}

          {/* LISTA DE INTEGRANTES */}
          <div>
            <h3 className="text-sm font-bold text-slate-400 uppercase tracking-widest mb-4 flex items-center gap-2 px-1">
              <Users size={16}/>
              Estado de Integrantes
            </h3>
            
            <div className="space-y-3">
              {sortedMembers.map((member) => {
                const payments = member.paymentsMade || 0;
                const debt = (currentWeek - payments) * QUOTA;
                const isAlCorriente = debt <= 0;
                const isPinned = pinnedMemberId === member.id;

                return (
                  <div 
                    key={member.id} 
                    className={`group backdrop-blur-md border rounded-2xl p-4 flex items-center justify-between transition-all duration-300 ${
                      isPinned 
                      ? 'bg-slate-800/60 border-indigo-500/50 shadow-[0_0_15px_rgba(99,102,241,0.15)]' 
                      : 'bg-slate-900/40 border-slate-800/80 hover:border-slate-700'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      {/* Botón de Pin */}
                      <button 
                        onClick={() => togglePin(member.id)}
                        className={`transition-all duration-300 active:scale-75 ${
                          isPinned ? 'text-indigo-400' : 'text-slate-600 hover:text-slate-400'
                        }`}
                      >
                        <Pin size={16} className={isPinned ? 'fill-indigo-400/20' : ''} />
                      </button>

                      {/* Avatar */}
                      <div className={`w-11 h-11 rounded-full flex items-center justify-center text-sm font-bold border ${
                        isAlCorriente 
                        ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' 
                        : 'bg-rose-500/10 text-rose-400 border-rose-500/20'
                      }`}>
                        {getInitials(member.name)}
                      </div>
                      
                      {/* Info Usuario */}
                      <div>
                        <p className="font-bold text-slate-200 text-[15px]">{member.name}</p>
                        <p className="text-[11px] text-slate-500 font-medium mt-0.5">
                          Pagos realizados: <span className="text-slate-300">{payments}</span>
                        </p>
                      </div>
                    </div>

                    {/* Estado o Controles */}
                    <div className="flex flex-col items-end gap-2">
                      {!isAdmin ? (
                        <div className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold border ${
                          isAlCorriente 
                          ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' 
                          : 'bg-rose-500/10 text-rose-400 border-rose-500/20'
                        }`}>
                          {isAlCorriente ? (
                            <>
                              <CheckCircle2 size={12} />
                              Al corriente
                            </>
                          ) : (
                            <>
                              <AlertCircle size={12} />
                              Debe ${debt}
                            </>
                          )}
                        </div>
                      ) : (
                        <div className="flex items-center gap-2">
                          <button 
                            onClick={() => removePayment(member)}
                            disabled={payments === 0}
                            className="w-8 h-8 rounded-full bg-slate-800 flex items-center justify-center text-slate-400 hover:bg-slate-700 hover:text-white transition-colors disabled:opacity-50"
                          >
                            <Minus size={14} />
                          </button>
                          
                          <div className={`min-w-[60px] text-center text-xs font-bold ${isAlCorriente ? 'text-emerald-400' : 'text-rose-400'}`}>
                            {isAlCorriente ? 'Al día' : `-${debt}`}
                          </div>

                          <button 
                            onClick={() => addPayment(member)}
                            className="w-8 h-8 rounded-full bg-indigo-500 flex items-center justify-center text-white hover:bg-indigo-400 transition-colors shadow-lg shadow-indigo-500/30"
                          >
                            <Plus size={14} />
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </main>

        {/* FOOTER - ADMIN LOGIN */}
        <div className="absolute bottom-0 w-full p-4 bg-gradient-to-t from-slate-950 via-slate-950 to-transparent z-20 flex justify-center">
          {!isAdmin ? (
            <button 
              onClick={() => setShowAdminModal(true)}
              className="text-slate-600 hover:text-slate-400 text-[11px] font-bold tracking-wider uppercase flex items-center gap-1.5 transition-colors"
            >
              <Lock size={12} />
              Acceso Admin
            </button>
          ) : (
            <button 
              onClick={() => setIsAdmin(false)}
              className="text-indigo-400 hover:text-indigo-300 text-[11px] font-bold tracking-wider uppercase flex items-center gap-1.5 transition-colors"
            >
              <Lock size={12} />
              Cerrar Admin
            </button>
          )}
        </div>

        {/* --- MODALES --- */}

        {/* Modal Login Admin */}
        {showAdminModal && (
          <div className="absolute inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
            <div className="bg-slate-900 border border-slate-800 rounded-3xl w-full max-w-sm p-6 shadow-2xl relative animate-in fade-in zoom-in duration-200">
              <button onClick={() => setShowAdminModal(false)} className="absolute top-4 right-4 text-slate-500 hover:text-white">
                <X size={20} />
              </button>
              
              <div className="w-12 h-12 bg-indigo-500/20 rounded-full flex items-center justify-center text-indigo-400 mb-4 mx-auto border border-indigo-500/30">
                <Lock size={20} />
              </div>
              <h2 className="text-xl font-bold text-white text-center mb-2">Administrador</h2>
              <p className="text-slate-400 text-sm text-center mb-6">Ingresa un correo autorizado para gestionar pagos.</p>
              
              <form onSubmit={handleAdminLogin}>
                <input 
                  type="email" 
                  value={adminEmail}
                  onChange={(e) => setAdminEmail(e.target.value)}
                  placeholder="Correo electrónico"
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-white placeholder:text-slate-600 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 mb-4 transition-all"
                  required
                />
                {adminError && <p className="text-rose-400 text-xs mb-4 text-center font-medium">{adminError}</p>}
                
                <button type="submit" className="w-full bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl py-3 font-bold transition-all active:scale-95 shadow-lg shadow-indigo-600/20">
                  Acceder
                </button>
              </form>
            </div>
          </div>
        )}

        {/* Modal Avanzar Semana */}
        {showAdvanceModal && (
          <div className="absolute inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
            <div className="bg-slate-900 border border-indigo-500/20 rounded-3xl w-full max-w-sm p-6 shadow-2xl relative animate-in fade-in zoom-in duration-200">
              <div className="w-12 h-12 bg-cyan-500/20 rounded-full flex items-center justify-center text-cyan-400 mb-4 mx-auto border border-cyan-500/30">
                <CalendarDays size={20} />
              </div>
              <h2 className="text-xl font-bold text-white text-center mb-2">¿Avanzar a la Semana {currentWeek + 1}?</h2>
              <p className="text-slate-400 text-sm text-center mb-6">
                Esto generará automáticamente una deuda de $20 para todos los miembros que no tengan pagos adelantados.
              </p>
              
              <div className="flex gap-3">
                <button onClick={() => setShowAdvanceModal(false)} className="flex-1 bg-slate-800 hover:bg-slate-700 text-white rounded-xl py-3 font-bold transition-all">
                  Cancelar
                </button>
                <button onClick={advanceWeek} className="flex-1 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl py-3 font-bold transition-all active:scale-95">
                  Confirmar
                </button>
              </div>
            </div>
          </div>
        )}

      </div>
    </div>
  );
}