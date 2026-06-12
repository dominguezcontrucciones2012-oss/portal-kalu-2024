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
  Save
} from 'lucide-react';
import { cn, formatCurrency } from '../../lib/utils';
import { subscribeToCollection, createClient, getLatestTasa, updateDocument, resetClientPin } from '../../lib/dbUtils';
import { type Client } from '../../types';
import { motion, AnimatePresence } from 'motion/react';
import { useNavigate } from 'react-router-dom';

const ClientsScreen: React.FC = () => {
  const navigate = useNavigate();
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

  const [tasaBcv, setTasaBcv] = useState(40.50);

  useEffect(() => {
    const unsubscribeClients = subscribeToCollection('clients', (data) => {
      setClients(data as Client[]);
      setLoading(false);
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

  const filtered = clients.filter(c => 
    c.nombre.toLowerCase().includes(search.toLowerCase()) || 
    c.cedula.includes(search)
  );

  const totalDebt = clients.reduce((acc, curr) => acc + (curr.saldo_usd || 0), 0);

  const handleAddClient = async (e: React.FormEvent) => {
    e.preventDefault();
    if (clients.some(c => c.cedula === newClient.cedula)) {
      addToast('error', `Ya existe un cliente con la cédula ${newClient.cedula}`);
      return;
    }
    setIsSaving(true);
    try {
      const lastFour = newClient.cedula.slice(-4).replace(/\D/g, '');
      let pinToUse = lastFour;
      
      if (pinToUse.length < 4) {
        pinToUse = pinToUse.padEnd(4, '0');
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
      // Also update the users document to ensure login works if cedula changes
      await updateDocument('users', editingClient.id, {
        cedula: editingClient.cedula,
        username: editingClient.cedula,
        email: editingClient.email || ''
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
    const newPin = window.prompt("Ingrese el nuevo PIN de 4 números para este cliente:");
    if (!newPin) return;
    if (newPin.length !== 4 || !/^\d+$/.test(newPin)) {
      alert("El PIN debe tener exactamente 4 números.");
      return;
    }
    setIsSaving(true);
    try {
      await resetClientPin(clientId, newPin);
      alert("El PIN del cliente ha sido actualizado exitosamente.");
    } catch (err) {
      console.error("Error resetting PIN:", err);
      alert("Hubo un error al actualizar el PIN.");
    } finally {
      setIsSaving(false);
    }
  };

  const handleToggleRepartidor = async (clientId: string, currentRole: string) => {
    try {
      const newRole = currentRole === 'repartidor' ? 'cliente' : 'repartidor';
      await updateDocument('users', clientId, { role: newRole });
    } catch (e) {
      console.error("Error al cambiar rol:", e);
      alert("Error al actualizar rol del usuario.");
    }
  };

  return (
    <>
      <div className="space-y-8 animate-in fade-in duration-700">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div>
          <h1 className="text-3xl font-black text-white flex items-center gap-3">
            <Users className="text-[#3498db]" /> CONTROL DE CLIENTES
          </h1>
          <p className="text-gray-400 text-sm">Base de datos centralizada de San Lorenzo Tiznados</p>
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
          <div className="text-3xl font-black text-blue-400">{clients.length} Clientes</div>
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

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filtered.map(client => {
          const userDoc = usersMap[client.id];
          const isRepartidor = userDoc && userDoc.role === 'repartidor';
          
          return (
            <div key={client.id} className="group bg-white/5 border border-white/10 rounded-[2.5rem] p-6 hover:bg-white/10 transition-all cursor-pointer relative overflow-hidden">
              <div className="absolute -right-4 -top-4 opacity-5 pointer-events-none group-hover:scale-110 transition-transform">
                <Users size={120} />
              </div>

              <div className="flex justify-between items-start mb-6">
                <div className="w-14 h-14 rounded-3xl bg-blue-500/20 flex items-center justify-center text-blue-400">
                  <Users size={28} />
                </div>
                <div className="flex flex-col items-end">
                  {isRepartidor ? (
                    <span className="px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest bg-purple-500/20 text-purple-400 border border-purple-500/30 mb-2">
                      Repartidor
                    </span>
                  ) : null}
                  <span className={cn(
                    "px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest",
                    client.saldo_usd > 0 ? "bg-red-500 text-white" : "bg-green-500/20 text-green-400"
                  )}>
                    {client.saldo_usd > 0 ? "Moroso" : "Al Día"}
                  </span>
                  <div className="flex items-center gap-1 mt-2 text-yellow-500">
                    <Star size={12} fill="currentColor" />
                    <span className="text-xs font-black">{client.puntos} pts</span>
                  </div>
                </div>
              </div>

              <div className="space-y-4">
                <div>
                  <h3 className="text-xl font-black text-white group-hover:text-[#3498db] transition-colors">{client.nombre}</h3>
                  <div className="flex items-center gap-3 mt-1 text-gray-500 font-bold text-xs uppercase">
                    <span className="flex items-center gap-1"><IdCard size={12} /> {client.cedula}</span>
                    <span className="flex items-center gap-1"><Phone size={12} /> {client.telefono}</span>
                  </div>
                </div>

                <div className="p-4 bg-black/20 rounded-2xl border border-white/5">
                  <div className="text-[10px] text-gray-500 font-black uppercase mb-1">Saldo Pendiente</div>
                  <div className={cn(
                    "text-2xl font-black",
                    client.saldo_usd > 0 ? "text-red-400" : "text-gray-400"
                  )}>
                    {formatCurrency(client.saldo_usd)}
                  </div>
                </div>
                
                {userDoc && (
                  <button 
                    onClick={(e) => { e.stopPropagation(); handleToggleRepartidor(client.id, userDoc.role); }}
                    className={cn(
                      "w-full py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest border transition-all mt-2",
                      isRepartidor 
                        ? "bg-red-500/10 text-red-400 border-red-500/20 hover:bg-red-500/20" 
                        : "bg-purple-500/10 text-purple-400 border-purple-500/20 hover:bg-purple-500/20"
                    )}
                  >
                    {isRepartidor ? "Quitar rol de Repartidor" : "Asignar como Repartidor"}
                  </button>
                )}
              </div>

              <div className="mt-6 pt-6 border-t border-white/5 flex items-center justify-between">
                <button onClick={() => navigate('/history', { state: { searchQuery: client.nombre } })} className="text-gray-500 hover:text-white transition-colors text-xs font-black uppercase tracking-widest underline decoration-2 underline-offset-4">
                  Ver Historial
                </button>
                <button onClick={() => setEditingClient(client)} className="p-3 bg-white/5 hover:bg-[#3498db] hover:text-white rounded-2xl transition-all">
                  <ChevronRight size={18} />
                </button>
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
