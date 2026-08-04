import React, { useState, useEffect } from 'react';
import { 
  Users, 
  Search, 
  UserPlus, 
  Phone, 
  IdCard,
  Mail,
  Truck,
  Edit2,
  X,
  Save,
  CheckCircle,
  AlertTriangle
} from 'lucide-react';
import { cn } from '../../lib/utils';
import { subscribeToCollection, updateDocument, getActiveStoreId } from '../../lib/dbUtils';
import { motion, AnimatePresence } from 'motion/react';
import { useToast } from '../../contexts/ToastProvider';
import { useNavigate } from 'react-router-dom';

const DriversScreen: React.FC = () => {
  const navigate = useNavigate();
  const { addToast } = useToast();
  const [drivers, setDrivers] = useState<any[]>([]);
  const [allUsers, setAllUsers] = useState<any[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingDriver, setEditingDriver] = useState<any | null>(null);

  useEffect(() => {
    const unsub = subscribeToCollection('users', (data) => {
      setAllUsers(data);
      const filtered = data.filter((u: any) => u.role === 'repartidor' && u.storeId === getActiveStoreId());
      setDrivers(filtered);
      setLoading(false);
    });
    return () => unsub();
  }, []);

  const handleUpdateDriver = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingDriver) return;

    try {
      await updateDocument('users', editingDriver.id, {
        username: editingDriver.username,
        telefono: editingDriver.telefono,
        cedula: editingDriver.cedula
      });
      setEditingDriver(null);
      addToast('success', 'Datos del repartidor actualizados correctamente');
    } catch (err) {
      console.error("Error al actualizar:", err);
      addToast('error', 'Error al actualizar el repartidor');
    }
  };

  const handlePromoteToDriver = async (userId: string) => {
    if (window.confirm('¿Convertir este usuario en Repartidor?')) {
      try {
        await updateDocument('users', userId, { role: 'repartidor' });
        addToast('success', 'Usuario promovido a Repartidor');
        setShowAddModal(false);
      } catch (err) {
        console.error("Error:", err);
        addToast('error', 'Error al cambiar rol del usuario');
      }
    }
  };

  const handleDemoteToClient = async (userId: string) => {
    if (window.confirm('¿Estás seguro de quitar a este usuario de la lista de repartidores? Volverá a ser cliente.')) {
      try {
        await updateDocument('users', userId, { role: 'cliente' });
        addToast('success', 'Usuario convertido a cliente normal');
      } catch (err) {
        console.error("Error:", err);
        addToast('error', 'Error al cambiar rol del usuario');
      }
    }
  };

  const filteredDrivers = drivers.filter(d => 
    d.username?.toLowerCase().includes(search.toLowerCase()) ||
    d.email?.toLowerCase().includes(search.toLowerCase()) ||
    d.telefono?.includes(search)
  );

  const potentialDrivers = allUsers.filter(u => 
    u.role !== 'repartidor' && 
    (u.username?.toLowerCase().includes(search.toLowerCase()) || u.email?.toLowerCase().includes(search.toLowerCase()))
  );

  return (
    // Contenedor principal pegado arriba
    <div className="min-h-screen text-white p-4 md:p-6 pt-1 md:pt-1 transition-all duration-300 w-full flex flex-col">
      
      {/* 1. CABECERA ALINEADA Y PEGADA ARRIBA */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-3">
        <div className="flex items-center gap-3">
          
          {/* BOTÓN VOLVER (Al lado del camioncito) */}
          <button 
            onClick={() => navigate(-1)}
            title="Volver atrás"
            className="w-9 h-9 flex items-center justify-center bg-cyan-500/20 hover:bg-cyan-500/40 text-cyan-400 rounded-full transition-all border border-cyan-500/30 shrink-0"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M15 19l-7-7 7-7" />
            </svg>
          </button>

          {/* TÍTULO CON CAMIONCITO */}
          <div>
            <div className="flex items-center gap-2">
              <span className="bg-cyan-500/20 text-cyan-400 p-1 rounded-lg text-lg">🚚</span>
              <h1 className="text-2xl md:text-3xl font-black tracking-wide uppercase leading-none">
                GESTIÓN DE REPARTIDORES
              </h1>
            </div>
            <p className="text-xs text-slate-400 mt-1">
              Administra los datos de contacto para notificaciones automáticas (n8n)
            </p>
          </div>
        </div>

        <button 
          onClick={() => setShowAddModal(true)}
          className="bg-[#3498db] hover:bg-[#2980b9] text-white px-5 py-2.5 rounded-xl font-bold flex items-center gap-2 transition-all shadow-lg shadow-[#3498db]/20 active:scale-95 whitespace-nowrap self-start md:self-auto text-sm"
        >
          <UserPlus size={18} />
          Agregar Repartidor
        </button>
      </div>

      {/* BLOQUE DE BÚSQUEDA COMPACTO */}
      <div className="bg-[#112d59]/80 backdrop-blur-md p-3 rounded-2xl border border-slate-700/50 shadow-md mb-4 flex items-center gap-2">
        <svg className="w-5 h-5 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
        </svg>
        <input 
          type="text" 
          placeholder="Buscar por nombre, email o teléfono..." 
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="bg-transparent w-full focus:outline-none text-sm text-white placeholder-slate-400"
        />
      </div>

      <div className="flex-1 overflow-auto custom-scrollbar">
        {loading ? (
          <div className="flex justify-center items-center h-64">
            <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-[#3498db]"></div>
          </div>
        ) : filteredDrivers.length === 0 ? (
          <div className="bg-[#112d59]/80 border border-slate-700/50 rounded-2xl p-12 text-center flex flex-col items-center shadow-md">
            <div className="bg-slate-900/50 p-4 rounded-full mb-4">
              <Truck size={48} className="text-slate-500" />
            </div>
            <h3 className="text-xl font-bold text-white mb-2">No hay repartidores registrados</h3>
            <p className="text-slate-400 max-w-md">
              Aún no has agregado a ningún repartidor o la búsqueda no coincide con ninguno.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
            {/* 2. GRID DE TARJETAS DE REPARTIDORES (4 POR FILA / PICADAS A LA MITAD) */}
            {filteredDrivers.map((driver) => {
              const isActive = driver.status !== 'inactive'; // Verifica estado

              return (
                <div 
                  key={driver.id}
                  className="bg-[#112d59]/80 p-3 rounded-2xl border border-slate-700/50 hover:border-cyan-500/40 transition-all duration-300 shadow-md flex flex-col justify-between"
                >
                  {/* CABECERA DE LA TARJETA: AVATAR + NOMBRE + BADGE ESTADO */}
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <div className="flex items-center gap-2.5 truncate">
                      {/* Foto/Avatar Redondeado Pequeño */}
                      <div className="w-9 h-9 rounded-full bg-cyan-500/20 text-cyan-400 font-black flex items-center justify-center shrink-0 border border-cyan-500/30 text-sm uppercase">
                        {driver.username?.charAt(0) || 'R'}
                      </div>

                      <div className="truncate">
                        <h3 className="font-extrabold text-sm text-white truncate leading-tight">
                          {driver.username}
                        </h3>
                        <p className="text-[10px] text-slate-400 truncate">
                          🪪 {driver.cedula || 'No registrada'}
                        </p>
                      </div>
                    </div>

                    {/* BADGE DE ESTADO: VERDE / ROJO */}
                    <span className={`text-[9px] font-black px-2 py-0.5 rounded-full uppercase border shrink-0 ${
                      isActive 
                        ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30' 
                        : 'bg-red-500/20 text-red-400 border-red-500/30'
                    }`}>
                      {isActive ? 'ACTIVO' : 'INACTIVO'}
                    </span>
                  </div>

                  {/* CONTACTO COMPACTO */}
                  <div className="bg-slate-900/40 p-2 rounded-xl border border-slate-800 mb-2 space-y-1">
                    <p className={cn("text-[11px] flex items-center gap-1.5 truncate", driver.telefono ? "text-slate-300" : "text-red-400 font-bold")}>
                      <span>📞</span> {driver.telefono || 'Faltante (n8n fallará)'}
                    </p>
                    {driver.email && (
                      <p className="text-[10px] text-slate-400 flex items-center gap-1.5 truncate">
                        <span>✉️</span> {driver.email}
                      </p>
                    )}
                  </div>

                  {/* BOTONES DE ACCIÓN PEQUEÑOS */}
                  <div className="grid grid-cols-2 gap-2 pt-1 border-t border-slate-700/30">
                    <button 
                      onClick={() => setEditingDriver(driver)}
                      className="py-1 px-2 bg-slate-800 hover:bg-slate-700 text-slate-300 text-[10px] font-semibold rounded-lg border border-slate-700 transition-all flex items-center justify-center gap-1"
                    >
                      ✏️ Editar
                    </button>
                    <button 
                      onClick={() => handleDemoteToClient(driver.id)}
                      className="py-1 px-2 bg-red-500/10 hover:bg-red-500/20 text-red-400 text-[10px] font-semibold rounded-lg border border-red-500/30 transition-all flex items-center justify-center gap-1"
                    >
                      ❌ Quitar
                    </button>
                  </div>

                </div>
              );
            })}
          </div>
        )}
      </div>

      <AnimatePresence>
        {editingDriver && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex justify-center items-center p-4"
          >
            <motion.div 
              initial={{ scale: 0.9, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.9, opacity: 0, y: 20 }}
              className="bg-[#1a1f2e] border border-gray-800 w-full max-w-md rounded-2xl shadow-2xl overflow-hidden"
            >
              <div className="p-6 border-b border-gray-800 flex justify-between items-center bg-gradient-to-r from-[#242b3d] to-[#1a1f2e]">
                <h2 className="text-xl font-bold text-white flex items-center gap-2">
                  <Edit2 className="text-[#3498db]" size={20} />
                  Editar Repartidor
                </h2>
                <button 
                  onClick={() => setEditingDriver(null)}
                  className="text-gray-400 hover:text-white bg-gray-800 p-2 rounded-full transition-colors"
                >
                  <X size={20} />
                </button>
              </div>

              <form onSubmit={handleUpdateDriver} className="p-6 space-y-5">
                <div className="bg-yellow-500/10 border border-yellow-500/30 p-3 rounded-xl mb-4 flex items-start gap-3">
                  <AlertTriangle className="text-yellow-500 mt-0.5 shrink-0" size={18} />
                  <p className="text-xs text-yellow-200">
                    Asegúrate de incluir el código de país en el teléfono (ej. +584120000000) para que n8n pueda enviarle WhatsApp al repartidor.
                  </p>
                </div>

                <div className="space-y-2">
                  <label className="text-xs font-black uppercase text-gray-500 tracking-widest px-1">Nombre</label>
                  <input 
                    type="text" 
                    value={editingDriver.username || ''}
                    onChange={(e) => setEditingDriver({...editingDriver, username: e.target.value})}
                    className="w-full bg-[#242b3d] text-white p-3.5 rounded-xl border border-gray-700 focus:border-[#3498db] focus:ring-1 focus:ring-[#3498db] outline-none transition-all"
                    required
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-xs font-black uppercase text-gray-500 tracking-widest px-1">Cédula</label>
                  <input 
                    type="text" 
                    value={editingDriver.cedula || ''}
                    onChange={(e) => setEditingDriver({...editingDriver, cedula: e.target.value})}
                    className="w-full bg-[#242b3d] text-white p-3.5 rounded-xl border border-gray-700 focus:border-[#3498db] focus:ring-1 focus:ring-[#3498db] outline-none transition-all"
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-xs font-black uppercase text-gray-500 tracking-widest px-1 flex items-center gap-2">
                    Teléfono (WhatsApp) <span className="text-red-400">*</span>
                  </label>
                  <div className="relative">
                    <Phone className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500" size={18} />
                    <input 
                      type="text" 
                      value={editingDriver.telefono || ''}
                      onChange={(e) => setEditingDriver({...editingDriver, telefono: e.target.value})}
                      placeholder="+584120000000"
                      className="w-full bg-[#242b3d] text-white pl-12 pr-4 py-3.5 rounded-xl border border-gray-700 focus:border-[#3498db] focus:ring-1 focus:ring-[#3498db] outline-none transition-all font-mono"
                      required
                    />
                  </div>
                </div>

                <div className="pt-4 flex gap-3">
                  <button 
                    type="button"
                    onClick={() => setEditingDriver(null)}
                    className="flex-1 px-4 py-3.5 rounded-xl font-bold text-gray-400 bg-[#242b3d] hover:text-white hover:bg-gray-800 transition-all border border-gray-700"
                  >
                    Cancelar
                  </button>
                  <button 
                    type="submit"
                    className="flex-1 bg-gradient-to-r from-[#3498db] to-[#2ecc71] hover:from-[#2980b9] hover:to-[#27ae60] text-white px-4 py-3.5 rounded-xl font-bold shadow-lg shadow-[#3498db]/30 flex justify-center items-center gap-2 transition-all active:scale-95 border border-[#3498db]/50"
                  >
                    <Save size={18} />
                    Guardar
                  </button>
                </div>
              </form>
            </motion.div>
          </motion.div>
        )}

        {showAddModal && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex justify-center items-center p-4"
          >
            <motion.div 
              initial={{ scale: 0.9, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.9, opacity: 0, y: 20 }}
              className="bg-[#1a1f2e] border border-gray-800 w-full max-w-2xl rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[85vh]"
            >
              <div className="p-6 border-b border-gray-800 flex justify-between items-center bg-gradient-to-r from-[#242b3d] to-[#1a1f2e] shrink-0">
                <div>
                  <h2 className="text-xl font-bold text-white flex items-center gap-2">
                    <UserPlus className="text-[#3498db]" size={20} />
                    Promover a Repartidor
                  </h2>
                  <p className="text-sm text-gray-400 mt-1">
                    Selecciona a un usuario existente para convertirlo en repartidor. (El repartidor debe registrarse primero en la app).
                  </p>
                </div>
                <button 
                  onClick={() => setShowAddModal(false)}
                  className="text-gray-400 hover:text-white bg-gray-800 p-2 rounded-full transition-colors ml-4"
                >
                  <X size={20} />
                </button>
              </div>

              <div className="p-4 border-b border-gray-800 bg-[#151923] shrink-0">
                <div className="relative">
                  <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500" size={18} />
                  <input 
                    type="text" 
                    placeholder="Buscar usuario por nombre o correo..." 
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className="w-full bg-[#242b3d] text-white pl-12 pr-4 py-3 rounded-xl border border-gray-700 focus:border-[#3498db] focus:ring-1 focus:ring-[#3498db] outline-none transition-all text-sm"
                  />
                </div>
              </div>

              <div className="flex-1 overflow-auto p-4 space-y-2">
                {potentialDrivers.length === 0 ? (
                  <div className="text-center py-12 text-gray-500">
                    No se encontraron usuarios que coincidan con la búsqueda.
                  </div>
                ) : (
                  potentialDrivers.slice(0, 50).map(user => (
                    <div key={user.id} className="flex justify-between items-center bg-[#242b3d] p-4 rounded-xl border border-gray-800 hover:border-gray-700 transition-colors">
                      <div>
                        <p className="font-bold text-white">{user.username}</p>
                        <p className="text-xs text-gray-400">{user.email}</p>
                        <span className="text-[10px] uppercase tracking-wider bg-gray-800 text-gray-400 px-2 py-0.5 rounded-full mt-1 inline-block">Rol actual: {user.role || 'cliente'}</span>
                      </div>
                      <button
                        onClick={() => handlePromoteToDriver(user.id)}
                        className="bg-[#3498db]/20 text-[#3498db] hover:bg-[#3498db] hover:text-white border border-[#3498db]/50 px-4 py-2 rounded-lg text-sm font-bold transition-colors"
                      >
                        Hacer Repartidor
                      </button>
                    </div>
                  ))
                )}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default DriversScreen;
