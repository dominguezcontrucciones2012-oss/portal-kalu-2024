import React, { useState, useEffect } from 'react';
import { 
  Users, 
  Search, 
  UserPlus, 
  Star, 
  Phone, 
  IdCard,
  ChevronRight,
  X,
  ExternalLink,
  Save,
  Truck,
  Lock
} from 'lucide-react';
import { cn, formatCurrency } from '../../lib/utils';
import { subscribeToCollection, createClient, getLatestTasa, updateDocument, resetClientPin, getActiveStoreId } from '../../lib/dbUtils';
import { type Client, type Sale, type Product, Role } from '../../types';
import { motion, AnimatePresence } from 'motion/react';
import { useNavigate } from 'react-router-dom';
import { useToast } from '../../contexts/ToastProvider';
import firebaseConfig from '../../../firebase-applet-config.json';
import { db, auth } from '../../lib/firebase';
import { setDoc, doc, serverTimestamp } from 'firebase/firestore';


const ClientsScreen: React.FC = () => {
  const navigate = useNavigate();
  const { addToast } = useToast();
  const [clients, setClients] = useState<Client[]>([]);
  const [usersMap, setUsersMap] = useState<Record<string, any>>({});
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingClient, setEditingClient] = useState<any | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [newClient, setNewClient] = useState({
    nombre: '',
    cedula: '',
    telefono: '',
    email: '',
    puntos: 0,
    saldo_usd: 0
  });

  const [tasaBcv, setTasaBcv] = useState(737.23);

  useEffect(() => {
    const projectId = 'kalu-queso-sanjuam';

    // Suscripción WebSocket secundaria (se activa si CANTV no bloquea)
    const unsubscribeClients = subscribeToCollection('clients', (data) => {
      setClients(data as Client[]);
      setLoading(false);
      localStorage.setItem('kalu_clients_data', JSON.stringify(data));
    });

    const unsubscribeUsers = subscribeToCollection('users', (data) => {
      const map: Record<string, any> = {};
      data.forEach((u: any) => {
        map[u.id] = u;
      });
      setUsersMap(map);
    });

    getLatestTasa().then(rate => setTasaBcv(rate)).catch(() => {});
    return () => {
      unsubscribeClients();
      unsubscribeUsers();
    };
  }, []);

  // Fusionar clientes de ambas fuentes (clients y users) para garantizar 100% precisión en el contador
  const allClientsMap = new Map<string, Client>();
  clients.forEach(c => allClientsMap.set(c.id, c));
  
  Object.values(usersMap).forEach((u: any) => {
    if (u.role === 'cliente' && !allClientsMap.has(u.id) && (!u.clientId || !allClientsMap.has(u.clientId))) {
      const clientId = u.clientId || u.id;
      allClientsMap.set(clientId, {
        id: clientId,
        nombre: u.nombre || u.username || 'Cliente Registrado',
        cedula: u.cedula || '',
        telefono: u.telefono || '',
        direccion: u.direccion || '',
        saldo_usd: u.saldo_usd || 0,
        puntos: u.puntos || 0,
        role: Role.CLIENTE
      });
    }
  });

  const totalClientsList = Array.from(allClientsMap.values());

  const filtered = totalClientsList.filter(c => 
    (c.nombre || '').toLowerCase().includes(search.toLowerCase()) || 
    String(c.cedula || '').includes(search) ||
    String(c.telefono || '').includes(search)
  );

  const totalDebt = totalClientsList.reduce((acc, curr) => acc + (curr.saldo_usd || 0), 0);

  const handleAddClient = async (e: React.FormEvent) => {
    e.preventDefault();
    if (clients.some(c => c.cedula === newClient.cedula)) {
      addToast('error', `Ya existe un cliente con la cédula ${newClient.cedula}`);
      return;
    }
    setIsSaving(true);
    try {
      const lastSix = newClient.cedula.slice(-6).replace(/\D/g, '');
      let pinToUse = lastSix;
      
      if (pinToUse.length < 6) {
        pinToUse = pinToUse.padEnd(6, '0');
      }
      
      // El PIN ya no requiere ser único porque la llave de acceso es (Cédula + PIN)

      await createClient({ ...newClient, pin: pinToUse });
      setShowAddModal(false);
      setNewClient({ nombre: '', cedula: '', telefono: '', email: '', puntos: 0, saldo_usd: 0 });
      alert(`¡Cliente Registrado!\n\nACCESO AL PORTAL:\nUsuario: ${newClient.cedula}\nClave (PIN): ${pinToUse}`);
    } catch (err) {
      console.error("Error al registrar cliente:", err);
      alert("Error al registrar cliente.");
    } finally {
      setIsSaving(false);
    }
  };

  const handleUpdateClient = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingClient) return;
    if (clients.some(c => c.cedula === editingClient.cedula && c.id !== editingClient.id)) {
      alert(`Ya existe otro cliente con la cédula ${editingClient.cedula}`);
      return;
    }
    
    setIsSaving(true);
    try {
      await updateDocument('clients', editingClient.id, {
        nombre: editingClient.nombre,
        cedula: editingClient.cedula,
        telefono: editingClient.telefono || '',
        email: editingClient.email || '',
        direccion: editingClient.direccion || ''
      });
      // Also update the users document to ensure login works if cedula changes, and phone stays synced
      // NOTA: NO actualizamos el 'email' aquí para no sobreescribir el correo original de Auth (ej. cedula@kalu.app)
      const userDoc = usersMap[editingClient.id] || Object.values(usersMap).find((u: any) => u.clientId === editingClient.id || u.cedula === editingClient.cedula);
      const targetUserId = userDoc?.id || editingClient.id;

      await updateDocument('users', targetUserId, {
        cedula: editingClient.cedula,
        username: editingClient.nombre,
        nombre: editingClient.nombre,
        telefono: editingClient.telefono || '',
        direccion: editingClient.direccion || ''
      }).catch(err => {
        console.warn("User document not updated (might not exist yet):", err);
      });
      setEditingClient(null);
      alert("¡Datos del cliente actualizados con éxito!");
    } catch (err) {
      console.error("Error al actualizar cliente:", err);
      alert("Error al actualizar los datos del cliente.");
    } finally {
      setIsSaving(false);
    }
  };

  const handleResetPin = async (clientId: string) => {
    const userDoc = usersMap[clientId] || Object.values(usersMap).find((u: any) => u.clientId === clientId || u.cedula === clients.find(c => c.id === clientId)?.cedula);
    const targetUserId = userDoc?.id || clientId;

    const newPin = window.prompt("Ingrese el nuevo PIN de 6 números para este cliente:");
    if (!newPin) return;
    if (newPin.length !== 6 || !/^\d+$/.test(newPin)) {
      alert("El PIN debe tener exactamente 6 números.");
      return;
    }
    setIsSaving(true);
    try {
      await resetClientPin(targetUserId, newPin);
      alert("El PIN del cliente ha sido actualizado exitosamente.");
    } catch (err) {
      console.error("Error resetting PIN:", err);
      alert("Hubo un error al actualizar el PIN.");
    } finally {
      setIsSaving(false);
    }
  };

  const handleToggleRepartidor = async (client: Client, currentRole?: string, userIdToUpdate?: string) => {
    try {
      const isRep = currentRole === 'repartidor';
      const newRole = isRep ? 'cliente' : 'repartidor';
      const targetUserId = userIdToUpdate || client.id;

      await setDoc(doc(db, 'users', targetUserId), { 
        role: newRole,
        storeId: isRep ? '' : getActiveStoreId(),
        username: client.nombre,
        nombre: client.nombre,
        cedula: client.cedula,
        telefono: client.telefono || '',
        clientId: client.id,
        updatedAt: serverTimestamp()
      }, { merge: true });

      alert(isRep 
        ? `¡Rol de repartidor removido de ${client.nombre}! Volvió a su usuario normal.`
        : `¡${client.nombre} fue asignado como Repartidor! La próxima vez que inicie sesión entrará directamente al Portal de Repartidor.`
      );
    } catch (e) {
      console.error("Error al cambiar rol:", e);
      alert("Error al actualizar rol del usuario.");
    }
  };

  return (
    <>
      <div className="min-h-screen text-white p-4 md:p-6 pt-1 md:pt-1 transition-all duration-300 space-y-8 animate-in fade-in">
      {/* CABECERA: Botón de regresar en el lugar de las personitas + Título */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-3">
        <div className="flex items-center gap-3">
          
          {/* BOTÓN REGRESAR (Remplaza el ícono de las personitas) */}
          <button 
            onClick={() => navigate(-1)}
            title="Volver atrás"
            className="w-9 h-9 flex items-center justify-center bg-cyan-500/20 hover:bg-cyan-500/40 text-cyan-400 rounded-full transition-all border border-cyan-500/30 shrink-0"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M15 19l-7-7 7-7" />
            </svg>
          </button>

          {/* TÍTULO Y SUBTÍTULO */}
          <div>
            <h1 className="text-2xl md:text-3xl font-black tracking-wide uppercase leading-none">
              CONTROL DE CLIENTES
            </h1>
            <p className="text-xs text-slate-400 mt-1">
              Base de datos centralizada de San Lorenzo Tiznados
            </p>
          </div>
        </div>
        <button 
          onClick={() => setShowAddModal(true)}
          className="bg-[#3498db] hover:bg-[#2980b9] text-white font-bold py-4 px-8 rounded-2xl shadow-lg shadow-[#3498db]/20 transition-all flex items-center gap-2 text-sm group"
        >
          <UserPlus size={18} className="group-hover:scale-110 transition-transform" /> REGISTRAR CLIENTE
        </button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
        <div className="bg-white/5 border border-white/10 p-6 rounded-3xl backdrop-blur-sm border-l-4 border-l-red-500">
          <div className="text-[10px] font-black text-gray-500 uppercase tracking-widest mb-1">Deuda Total Clientes</div>
          <div className="text-3xl font-black text-red-400">{formatCurrency(totalDebt)}</div>
          <div className="text-[10px] text-gray-500 font-bold mt-1 uppercase tracking-tighter">Equivalente: Bs. {(totalDebt * tasaBcv).toLocaleString()}</div>
        </div>
        <div className="bg-white/5 border border-white/10 p-8 rounded-3xl backdrop-blur-xl">
          <div className="text-[10px] font-black text-yellow-500 uppercase tracking-widest mb-1">Fidelización</div>
          <div className="text-3xl font-black text-yellow-500">{clients.filter(c => (c.puntos || 0) > 200).length} Premios</div>
          <div className="text-[10px] text-gray-500 font-bold mt-1">CLIENTES CON PUNTOS PARA CANJEAR</div>
        </div>
        <div className="bg-white/5 border border-white/10 p-8 rounded-3xl backdrop-blur-xl">
          <div className="text-[10px] font-black text-blue-400 uppercase tracking-widest mb-1">Base de Datos</div>
          <div className="text-3xl font-black text-blue-400">{totalClientsList.length} Clientes</div>
          <div className="text-[10px] text-gray-500 font-bold mt-1">TOTAL REGISTRADOS EN EL SISTEMA</div>
        </div>
      </div>

      <div className="bg-white/5 border border-white/10 p-2 rounded-3xl">
        <div className="relative">
          <Search className="absolute left-6 top-1/2 -translate-y-1/2 text-gray-500" size={20} />
          <input 
            type="text" 
            placeholder="Buscar por nombre, cédula o teléfono..."
            className="w-full bg-transparent py-5 pl-16 pr-6 focus:outline-none text-lg font-bold"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
      </div>

      {/* GRID DE CLIENTES: Ahora ajustado a 4 columnas */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-3">
        {filtered.map((client) => {
          const hasDebt = (client.saldo_usd || 0) > 0;
          const userDoc = usersMap[client.id] || Object.values(usersMap).find((u: any) => u.clientId === client.id || u.cedula === client.cedula);
          const isRepartidor = userDoc && userDoc.role === 'repartidor';
          const isAssignedToOtherStore = isRepartidor && userDoc.storeId && userDoc.storeId !== getActiveStoreId();

          return (
            <div 
              key={client.id}
              className={`p-3 rounded-2xl border transition-all duration-300 shadow-md flex flex-col justify-between group ${
                hasDebt 
                  ? 'bg-[#112d59]/90 border-red-500/50 hover:border-red-400' 
                  : 'bg-[#112d59]/80 border-slate-700/50 hover:border-cyan-500/40'
              }`}
            >
              {/* 1. CABECERA COMPACTA: NOMBRE A LA IZQ / AL DÍA + PTS A LA DERECHA */}
              <div className="flex items-start justify-between gap-2 mb-2">
                <div className="truncate flex-1">
                  <h3 className="font-extrabold text-sm text-white truncate leading-tight group-hover:text-cyan-400 transition-colors">
                    {client.nombre}
                  </h3>
                  <div className="flex flex-col gap-0.5 mt-1">
                    <p className="text-[10px] text-slate-400 truncate flex items-center gap-1">
                      <IdCard size={10} /> {client.cedula}
                    </p>
                    <p className="text-[10px] text-slate-400 truncate flex items-center gap-1">
                      <Phone size={10} /> {client.telefono || 'N/A'}
                    </p>
                  </div>
                </div>

                {/* BADGES PEGADOS AL NOMBRE */}
                <div className="flex flex-col items-end shrink-0 gap-1">
                  {isRepartidor && (
                    <span className="text-[8px] font-black uppercase tracking-widest bg-purple-500/20 text-purple-400 px-2 py-0.5 rounded-full border border-purple-500/30">
                      {isAssignedToOtherStore ? 'En otra tienda' : 'Repartidor'}
                    </span>
                  )}
                  <span className={`text-[9px] font-black px-2 py-0.5 rounded-full uppercase border ${
                    hasDebt 
                      ? 'bg-red-500/20 text-red-400 border-red-500/40 animate-pulse' 
                      : 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30'
                  }`}>
                    {hasDebt ? 'DEUDA' : 'AL DÍA'}
                  </span>
                  <span className="text-[9px] text-amber-400 font-bold flex items-center gap-0.5">
                    ⭐ {client.puntos || 0} pts
                  </span>
                </div>
              </div>

              {/* 2. CAJA DE SALDO PENDIENTES (MÁS PEQUEÑA) */}
              <div className={`p-2 rounded-xl mb-2.5 border flex items-center justify-between ${
                hasDebt ? 'bg-red-950/30 border-red-500/30' : 'bg-slate-900/40 border-slate-800'
              }`}>
                <span className="text-[10px] font-bold text-slate-400 uppercase">
                  Saldo Pendiente
                </span>
                <span className={`text-base font-black ${hasDebt ? 'text-red-400' : 'text-white'}`}>
                  {formatCurrency(client.saldo_usd || 0)}
                </span>
              </div>

              {/* ACCIONES COMPACTAS: BOTÓN ASIGNAR ROL */}
              <div className="flex flex-col gap-2 mt-4 pt-4 border-t border-slate-700/30">
                <button 
                  onClick={(e) => { e.stopPropagation(); handleToggleRepartidor(client, userDoc?.role, userDoc?.id); }}
                  disabled={isAssignedToOtherStore}
                  className={cn(
                    "w-full py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest border transition-all flex items-center justify-center gap-1.5",
                    isAssignedToOtherStore 
                      ? "bg-gray-500/10 text-gray-500 border-gray-500/30 cursor-not-allowed"
                      : isRepartidor 
                        ? "bg-red-500/10 text-red-400 border-red-500/30 hover:bg-red-500/20" 
                        : "bg-purple-500/10 text-purple-400 border-purple-500/30 hover:bg-purple-500/20"
                  )}
                >
                  {isAssignedToOtherStore ? (
                    <>
                      <Lock size={14} /> Otra Tienda
                    </>
                  ) : (
                    <>
                      <Truck size={14} />
                      {isRepartidor ? "Quitar Rol" : "Asignar como Repartidor"}
                    </>
                  )}
                </button>

                {/* BOTONES RESTAURADOS: HISTORIAL Y EDITAR (>) */}
                <div className="mt-2 pt-4 border-t border-white/5 flex items-center justify-between">
                  <button onClick={() => navigate('/history', { state: { searchQuery: client.nombre } })} className="text-gray-500 hover:text-white transition-colors text-xs font-black uppercase tracking-widest underline decoration-2 underline-offset-4">
                    Ver Historial
                  </button>
                  <button onClick={() => setEditingClient(client)} className="p-3 bg-white/5 hover:bg-[#3498db] hover:text-white rounded-2xl transition-all">
                    <ChevronRight size={18} />
                  </button>
                </div>
              </div>

            </div>
          );
        })}
      </div>
      </div>

      <AnimatePresence>
        {showAddModal && (
          <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowAddModal(false)}
              className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="relative w-full max-w-lg bg-[#1e293b] border border-white/10 rounded-[2.5rem] shadow-2xl overflow-hidden"
            >
              <div className="p-8 border-b border-white/5 flex items-center justify-between">
                <h2 className="text-2xl font-black text-white flex items-center gap-3">
                  <UserPlus className="text-[#3498db]" /> NUEVO CLIENTE
                </h2>
                <button onClick={() => setShowAddModal(false)} className="p-2 hover:bg-white/5 rounded-xl transition-colors">
                  <X size={24} />
                </button>
              </div>

              <form onSubmit={handleAddClient} className="p-8 space-y-6">
                <div className="grid grid-cols-2 gap-6">
                  <div className="col-span-2 space-y-2">
                    <label className="text-xs font-black text-gray-500 uppercase tracking-widest px-2">Nombre Completo</label>
                    <input 
                      required
                      type="text" 
                      className="w-full bg-black/20 border border-white/10 rounded-2xl p-4 focus:outline-none focus:border-[#3498db] transition-all font-bold" 
                      placeholder="Ej. Juan Perez"
                      value={newClient.nombre}
                      onChange={e => setNewClient({...newClient, nombre: e.target.value})}
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs font-black text-gray-500 uppercase tracking-widest px-2">Cédula / RIF</label>
                    <input 
                      required
                      type="text" 
                      className="w-full bg-black/20 border border-white/10 rounded-2xl p-4 focus:outline-none focus:border-[#3498db] transition-all font-bold" 
                      placeholder="V-12345678"
                      value={newClient.cedula}
                      onChange={e => setNewClient({...newClient, cedula: e.target.value})}
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs font-black text-gray-500 uppercase tracking-widest px-2">Teléfono</label>
                    <input 
                      type="text" 
                      className="w-full bg-black/20 border border-white/10 rounded-2xl p-4 focus:outline-none focus:border-[#3498db] transition-all font-bold" 
                      placeholder="0424-0000000"
                      value={newClient.telefono}
                      onChange={e => setNewClient({...newClient, telefono: e.target.value})}
                    />
                  </div>
                  <div className="col-span-2 space-y-2">
                    <label className="text-xs font-black text-gray-500 uppercase tracking-widest px-2">Correo (Opcional para Portal)</label>
                    <input 
                      type="email" 
                      className="w-full bg-black/20 border border-white/10 rounded-2xl p-4 focus:outline-none focus:border-[#3498db] transition-all font-bold" 
                      placeholder="cliente@ejemplo.com"
                      value={newClient.email}
                      onChange={e => setNewClient({...newClient, email: e.target.value})}
                    />
                  </div>
                </div>

                <div className="pt-6 border-t border-white/5">
                  <div className="flex items-center gap-3 p-4 bg-blue-500/10 rounded-2xl border border-blue-500/20 mb-6">
                    <ExternalLink size={20} className="text-[#3498db]" />
                    <p className="text-[10px] font-bold text-blue-400 uppercase leading-relaxed">
                      Al registrar, se creará automáticamente un usuario en el **Portal del Cliente** vinculado a su cédula.
                    </p>
                  </div>

                  <button 
                    type="submit"
                    disabled={isSaving}
                    className="w-full bg-[#3498db] hover:bg-[#2980b9] py-5 rounded-2xl font-black uppercase tracking-[4px] text-lg shadow-2xl transition-all active:scale-95 disabled:opacity-50"
                  >
                    {isSaving ? "Guardando..." : "Registrar y Activar Portal"}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}

        {editingClient && (
          <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setEditingClient(null)}
              className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="relative bg-[#111] border border-white/10 rounded-[2rem] p-6 w-full max-w-sm shadow-2xl overflow-y-auto max-h-[90vh]"
            >
              <div className="flex justify-between items-center mb-6">
                <div>
                  <h2 className="text-xl font-black text-white uppercase tracking-wider">Detalles del Cliente</h2>
                  <p className="text-gray-500 text-xs font-medium mt-1">Modificar información del cliente</p>
                </div>
                <button 
                  onClick={() => setEditingClient(null)}
                  className="p-2 hover:bg-white/10 rounded-xl transition-colors text-gray-500 hover:text-white"
                >
                  <X size={20} />
                </button>
              </div>

              <form onSubmit={handleUpdateClient} className="space-y-4">
                <div className="grid grid-cols-1 gap-4">
                  <div className="space-y-1">
                    <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest px-2">Nombre Completo</label>
                    <input 
                      required
                      type="text" 
                      className="w-full bg-black/20 border border-white/10 rounded-xl p-3 focus:outline-none focus:border-[#3498db] transition-all font-bold text-white text-sm" 
                      value={editingClient.nombre}
                      onChange={e => setEditingClient({...editingClient, nombre: e.target.value})}
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest px-2">Cédula / RIF</label>
                    <input 
                      required
                      type="text" 
                      className="w-full bg-black/20 border border-white/10 rounded-xl p-3 focus:outline-none focus:border-[#3498db] transition-all font-bold text-white text-sm" 
                      value={editingClient.cedula}
                      onChange={e => setEditingClient({...editingClient, cedula: e.target.value})}
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest px-2">Teléfono</label>
                    <input 
                      type="text" 
                      className="w-full bg-black/20 border border-white/10 rounded-xl p-3 focus:outline-none focus:border-[#3498db] transition-all font-bold text-white text-sm" 
                      value={editingClient.telefono || ''}
                      onChange={e => setEditingClient({...editingClient, telefono: e.target.value})}
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest px-2">Email</label>
                    <input 
                      type="email" 
                      className="w-full bg-black/20 border border-white/10 rounded-xl p-3 focus:outline-none focus:border-[#3498db] transition-all font-bold text-white text-sm" 
                      value={editingClient.email || ''}
                      onChange={e => setEditingClient({...editingClient, email: e.target.value})}
                    />
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest px-2">Dirección Exacta</label>
                  <textarea 
                    className="w-full bg-black/20 border border-white/10 rounded-xl p-3 focus:outline-none focus:border-[#3498db] transition-all font-bold text-white text-sm resize-none" 
                    rows={2}
                    placeholder="Ej. Calle 5 con Av. Principal, Casa Nro 24..."
                    value={editingClient.direccion || ''}
                    onChange={e => setEditingClient({...editingClient, direccion: e.target.value})}
                  />
                </div>

                <div className="pt-2 border-t border-white/10 mt-4">
                  <button
                    type="button"
                    onClick={() => handleResetPin(editingClient.id)}
                    className="w-full bg-orange-500/10 text-orange-400 border border-orange-500/20 hover:bg-orange-500/20 p-3 rounded-xl font-bold text-xs uppercase tracking-widest transition-colors flex items-center justify-center gap-2"
                  >
                    <IdCard size={16} /> RESTABLECER PIN DE ACCESO
                  </button>
                </div>

                <button 
                  type="submit" 
                  disabled={isSaving}
                  className="w-full bg-[#3498db] hover:bg-[#2980b9] text-white p-3 rounded-xl font-black text-xs uppercase tracking-[2px] transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 mt-6 shadow-lg shadow-[#3498db]/20"
                >
                  {isSaving ? (
                    <div className="w-6 h-6 border-2 border-white/20 border-t-white rounded-full animate-spin" />
                  ) : (
                    <>
                      <Save size={20} /> Guardar Cambios
                    </>
                  )}
                </button>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </>
  );
};

export default ClientsScreen;
