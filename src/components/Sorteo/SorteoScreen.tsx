import React, { useState, useEffect } from 'react';
import { collection, query, orderBy, onSnapshot, doc, deleteDoc, getDocs, where } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import { useAuth } from '../../contexts/AuthProvider';
import { Trophy, Trash2, Ticket, Sparkles, RefreshCw } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useToast } from '../../contexts/ToastProvider';

interface TicketData {
  id: string;
  codigo_pedido: string;
  cliente_nombre_censurado: string;
  fecha: string;
}

const SorteoScreen = () => {
  const [tickets, setTickets] = useState<TicketData[]>([]);
  const [loading, setLoading] = useState(true);
  const { user } = useAuth();
  const { addToast } = useToast();
  const isAdmin = user?.role === 'admin' || user?.role === 'dueno';

  const [isSpinning, setIsSpinning] = useState(false);
  const [spinningTicket, setSpinningTicket] = useState<TicketData | null>(null);
  const [winner, setWinner] = useState<TicketData | null>(null);
  const [showConfirmClear, setShowConfirmClear] = useState(false);

  useEffect(() => {
    let unsubscribe: any;
    import('../../lib/dbUtils').then(({ getActiveStoreId }) => {
      const q = query(collection(db, 'sorteos_activos'), where('storeId', '==', getActiveStoreId()), orderBy('fecha', 'desc'));
      unsubscribe = onSnapshot(q, (snapshot) => {
        const docs = snapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        })) as TicketData[];
        setTickets(docs);
        setLoading(false);
      });
    });

    return () => {
      if (typeof unsubscribe === 'function') unsubscribe();
    };
  }, []);

  const clearSorteo = async () => {
    if (!isAdmin) return;
    try {
      const { getActiveStoreId } = await import('../../lib/dbUtils');
      const snap = await getDocs(query(collection(db, 'sorteos_activos'), where('storeId', '==', getActiveStoreId())));
      const batchPromises = snap.docs.map(d => deleteDoc(doc(db, 'sorteos_activos', d.id)));
      await Promise.all(batchPromises);
      addToast('success', 'Sorteo semanal reiniciado correctamente.');
      setShowConfirmClear(false);
      setWinner(null);
    } catch (e) {
      console.error(e);
      addToast('error', 'Hubo un error al limpiar el sorteo.');
    }
  };

  const drawWinner = () => {
    if (tickets.length === 0) {
      addToast('error', 'No hay tickets participantes para el sorteo.');
      return;
    }
    
    setIsSpinning(true);
    setWinner(null);
    setSpinningTicket(tickets[Math.floor(Math.random() * tickets.length)]);

    let count = 0;
    const interval = setInterval(() => {
      count++;
      setSpinningTicket(tickets[Math.floor(Math.random() * tickets.length)]);
      
      if (count > 40) {
        clearInterval(interval);
        const randomIndex = Math.floor(Math.random() * tickets.length);
        setWinner(tickets[randomIndex]);
        setSpinningTicket(null);
        setIsSpinning(false);
      }
    }, 70);
  };

  // Agrupar por día
  const groupedTickets = tickets.reduce<Record<string, TicketData[]>>((acc, ticket) => {
    const date = new Date(ticket.fecha);
    const dayName = date.toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'short' });
    const capitalizedDay = dayName.charAt(0).toUpperCase() + dayName.slice(1);
    
    if (!acc[capitalizedDay]) acc[capitalizedDay] = [];
    acc[capitalizedDay].push(ticket);
    return acc;
  }, {});

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0f172a] flex items-center justify-center">
        <RefreshCw className="text-yellow-400 animate-spin w-10 h-10" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0f172a] text-white p-4 md:p-8 relative overflow-hidden">
      {/* Background decoration */}
      <div className="absolute top-[-20%] left-[-10%] w-[50%] h-[50%] bg-yellow-500/20 rounded-full blur-[120px] pointer-events-none" />
      <div className="absolute bottom-[-20%] right-[-10%] w-[50%] h-[50%] bg-orange-500/20 rounded-full blur-[120px] pointer-events-none" />

      <div className="max-w-6xl mx-auto relative z-10">
        <header className="flex flex-col md:flex-row justify-between items-center mb-10 gap-6">
          <div className="text-center md:text-left">
            <h1 className="text-4xl font-black uppercase tracking-tighter text-transparent bg-clip-text bg-gradient-to-r from-yellow-300 to-orange-500 flex items-center justify-center md:justify-start gap-3">
              <Trophy className="w-10 h-10 text-yellow-400" />
              Sorteo Semanal KALU
            </h1>
            <p className="text-gray-400 font-bold tracking-widest text-sm mt-2">15 KG DE QUESO - TICKETS PARTICIPANTES</p>
          </div>

          {isAdmin && (
            <div className="flex gap-4">
              <button 
                onClick={drawWinner}
                disabled={isSpinning || tickets.length === 0}
                className="bg-gradient-to-r from-yellow-500 to-orange-500 hover:from-yellow-400 hover:to-orange-400 text-black font-black uppercase tracking-widest px-6 py-3 rounded-xl transition-all disabled:opacity-50 flex items-center gap-2 shadow-lg shadow-yellow-500/20"
              >
                <Sparkles className="w-5 h-5" />
                {isSpinning ? 'Girando...' : 'Sacar Ganador'}
              </button>
              
              <button 
                onClick={() => setShowConfirmClear(true)}
                className="bg-red-500/10 text-red-400 hover:bg-red-500 hover:text-white border border-red-500/30 px-4 py-3 rounded-xl font-bold transition-all flex items-center gap-2"
              >
                <Trash2 className="w-5 h-5" />
                Limpiar
              </button>
            </div>
          )}
        </header>

        {/* Winner Display */}
        <AnimatePresence mode="wait">
          {isSpinning && spinningTicket && (
            <motion.div 
              key="spinning"
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              transition={{ duration: 0.1 }}
              className="bg-white/5 border border-white/20 p-8 rounded-3xl mb-12 text-center backdrop-blur-md shadow-2xl shadow-white/5"
            >
              <h2 className="text-2xl font-black text-gray-400 uppercase tracking-widest mb-2 animate-pulse">Sorteando...</h2>
              <div className="text-6xl md:text-8xl font-black text-white tracking-tighter my-4 opacity-80">
                #{spinningTicket.codigo_pedido}
              </div>
              <p className="text-xl text-gray-400 font-bold uppercase tracking-widest opacity-80">
                Cliente: {spinningTicket.cliente_nombre_censurado}
              </p>
            </motion.div>
          )}

          {!isSpinning && winner && (
            <motion.div 
              key="winner"
              initial={{ scale: 0.2, opacity: 0, rotate: -10 }}
              animate={{ scale: [1.2, 0.9, 1], opacity: 1, rotate: 0 }}
              transition={{ type: "spring", stiffness: 200, damping: 15 }}
              className="bg-gradient-to-br from-yellow-500 to-orange-500 border-4 border-yellow-300 p-8 md:p-12 rounded-[3rem] mb-12 text-center shadow-[0_0_100px_rgba(234,179,8,0.5)] relative overflow-hidden"
            >
              <motion.div 
                animate={{ rotate: 360 }}
                transition={{ duration: 20, repeat: Infinity, ease: "linear" }}
                className="absolute -inset-10 bg-[url('https://www.transparenttextures.com/patterns/stardust.png')] opacity-30 mix-blend-overlay pointer-events-none"
              />
              <div className="relative z-10">
                <motion.h2 
                  animate={{ scale: [1, 1.1, 1] }}
                  transition={{ duration: 1, repeat: Infinity }}
                  className="text-3xl md:text-4xl font-black text-white uppercase tracking-widest mb-2 drop-shadow-md"
                >
                  ¡TENEMOS UN GANADOR!
                </motion.h2>
                <div className="text-7xl md:text-9xl font-black text-white tracking-tighter my-6 drop-shadow-2xl">
                  #{winner.codigo_pedido}
                </div>
                <div className="inline-block bg-black/30 backdrop-blur-md px-8 py-4 rounded-2xl border border-white/20">
                  <p className="text-2xl md:text-3xl text-yellow-100 font-black uppercase tracking-widest">
                    {winner.cliente_nombre_censurado}
                  </p>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Ticket List Grouped by Day */}
        {tickets.length === 0 ? (
          <div className="text-center py-20 bg-white/5 rounded-3xl border border-white/10">
            <Ticket className="w-16 h-16 text-gray-600 mx-auto mb-4" />
            <h3 className="text-2xl font-black text-gray-500 uppercase tracking-widest">No hay tickets activos</h3>
            <p className="text-gray-600 mt-2">Los tickets de compra aparecerán aquí automáticamente.</p>
          </div>
        ) : (
          <div className="space-y-8">
            {Object.entries(groupedTickets).map(([day, dayTickets]) => (
              <div key={day} className="bg-black/40 border border-white/10 rounded-3xl p-6">
                <h3 className="text-lg font-black text-white/50 uppercase tracking-widest mb-6 border-b border-white/10 pb-4">
                  {day} <span className="text-yellow-500/50">({(dayTickets as TicketData[]).length} tickets)</span>
                </h3>
                
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
                  {(dayTickets as TicketData[]).map(ticket => (
                    <div 
                      key={ticket.id} 
                      className={`p-4 rounded-2xl border transition-all ${
                        winner?.id === ticket.id 
                          ? 'bg-yellow-500 border-yellow-400 text-black scale-105 shadow-xl shadow-yellow-500/20' 
                          : 'bg-white/5 border-white/10 hover:border-yellow-500/30 hover:bg-white/10'
                      }`}
                    >
                      <div className="flex items-center gap-2 mb-2">
                        <Ticket className={`w-4 h-4 ${winner?.id === ticket.id ? 'text-black' : 'text-yellow-500'}`} />
                        <span className={`text-[10px] font-black uppercase tracking-widest ${winner?.id === ticket.id ? 'text-black/70' : 'text-gray-500'}`}>
                          Ticket
                        </span>
                      </div>
                      <div className={`text-xl font-black tracking-tight ${winner?.id === ticket.id ? 'text-black' : 'text-white'}`}>
                        #{ticket.codigo_pedido}
                      </div>
                      <div className={`text-xs mt-1 truncate font-bold ${winner?.id === ticket.id ? 'text-black/80' : 'text-gray-400'}`}>
                        {ticket.cliente_nombre_censurado}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Confirmation Modal */}
      {showConfirmClear && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <div className="bg-[#1e293b] border border-red-500/30 rounded-3xl p-6 md:p-8 max-w-md w-full">
            <h3 className="text-xl font-black text-white uppercase tracking-widest mb-4 flex items-center gap-3">
              <Trash2 className="text-red-500 w-6 h-6" />
              ¿Limpiar Sorteo?
            </h3>
            <p className="text-gray-400 mb-8">
              Estás a punto de borrar TODOS los tickets participantes de la base de datos. Esta acción marca el final de la semana actual y no se puede deshacer. ¿Deseas continuar?
            </p>
            <div className="flex gap-4">
              <button 
                onClick={() => setShowConfirmClear(false)}
                className="flex-1 bg-white/5 hover:bg-white/10 text-white py-3 rounded-xl font-bold transition-all"
              >
                CANCELAR
              </button>
              <button 
                onClick={clearSorteo}
                className="flex-1 bg-red-500 hover:bg-red-600 text-white py-3 rounded-xl font-black tracking-widest uppercase transition-all"
              >
                SÍ, LIMPIAR
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default SorteoScreen;
