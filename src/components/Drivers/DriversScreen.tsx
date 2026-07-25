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
import { subscribeToCollection, updateDocument } from '../../lib/dbUtils';
import { motion, AnimatePresence } from 'motion/react';
import { useToast } from '../../contexts/ToastProvider';

const DriversScreen: React.FC = () => {
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
      const filtered = data.filter((u: any) => u.role === 'repartidor');
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
    <div className="h-full flex flex-col p-6 max-w-7xl mx-auto w-full">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4">
        <div>
          <h1 className="text-3xl font-black tracking-tight flex items-center gap-3 text-white">
            <Truck className="text-[#3498db]" size={32} />
            Gestión de Repartidores
          </h1>
          <p className="text-gray-400 mt-1 flex items-center gap-2">
            Administra los datos de contacto para notificaciones automáticas (n8n).
          </p>
        </div>

        <button 
          onClick={() => setShowAddModal(true)}
          className="bg-[#3498db] hover:bg-[#2980b9] text-white px-5 py-3 rounded-xl font-bold flex items-center gap-2 transition-all shadow-lg shadow-[#3498db]/20 active:scale-95 whitespace-nowrap"
        >
          <UserPlus size={20} />
          Agregar Repartidor
        </button>
      </div>

      <div className="bg-[#1a1f2e] border border-gray-800 rounded-2xl p-4 mb-6 shadow-xl">
        <div className="relative">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500" size={20} />
          <input 
            type="text" 
            placeholder="Buscar por nombre, email o teléfono..." 
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full bg-[#242b3d] text-white pl-12 pr-4 py-4 rounded-xl border border-gray-700 focus:border-[#3498db] focus:ring-1 focus:ring-[#3498db] outline-none transition-all"
          />
        </div>
      </div>

      <div className="flex-1 overflow-auto custom-scrollbar">
        {loading ? (
          <div className="flex justify-center items-center h-64">
            <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-[#3498db]"></div>
          </div>
        ) : filteredDrivers.length === 0 ? (
          <div className="bg-[#1a1f2e] border border-gray-800 rounded-2xl p-12 text-center flex flex-col items-center shadow-xl">
            <div className="bg-[#242b3d] p-4 rounded-full mb-4">
              <Truck size={48} className="text-gray-500" />
            </div>
            <h3 className="text-xl font-bold text-white mb-2">No hay repartidores registrados</h3>
            <p className="text-gray-400 max-w-md">
              Aún no has agregado a ningún repartidor o la búsqueda no coincide con ninguno.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredDrivers.map(driver => (
              <motion.div 
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                key={driver.id} 
                className="bg-[#1a1f2e] border border-gray-800 rounded-2xl overflow-hidden shadow-xl hover:border-gray-700 transition-colors group flex flex-col"
              >
                <div className="p-6 flex-1">
                  <div className="flex justify-between items-start mb-4">
                    <div className="w-12 h-12 bg-gradient-to-br from-[#3498db] to-[#2ecc71] rounded-full flex items-center justify-center text-white font-bold text-xl shadow-lg">
                      {driver.username?.charAt(0).toUpperCase() || 'R'}
                    </div>
                    <span className="bg-[#3498db]/20 text-[#3498db] px-3 py-1 rounded-full text-xs font-bold border border-[#3498db]/30 flex items-center gap-1">
                      <CheckCircle size={12} /> Activo
                    </span>
                  </div>
                  
                  <h3 className="text-xl font-bold text-white mb-1 group-hover:text-[#3498db] transition-colors">{driver.username}</h3>
                  <div className="flex items-center gap-2 text-gray-400 text-sm mb-4">
                    <IdCard size={14} /> C.I: {driver.cedula || 'No registrada'}
                  </div>
                  
                  <div className="space-y-3 bg-[#242b3d] p-4 rounded-xl border border-gray-800">
                    <div className="flex items-center gap-3 text-sm">
                      <div className="bg-[#3498db]/10 p-2 rounded-lg">
                        <Phone size={16} className="text-[#3498db]" />
                      </div>
                      <span className={cn("font-medium", driver.telefono ? "text-gray-200" : "text-red-400 flex items-center gap-1")}>
                        {driver.telefono || <><AlertTriangle size={14} /> Faltante (n8n fallará)</>}
                      </span>
                    </div>
                    <div className="flex items-center gap-3 text-sm">
                      <div className="bg-purple-500/10 p-2 rounded-lg">
                        <Mail size={16} className="text-purple-400" />
                      </div>
                      <span className="text-gray-400 truncate font-medium">{driver.email}</span>
                    </div>
                  </div>
                </div>
                
                <div className="grid grid-cols-2 border-t border-gray-800 bg-[#151923]">
                  <button 
                    onClick={() => setEditingDriver(driver)}
                    className="p-4 text-gray-400 hover:text-white hover:bg-gray-800/50 flex items-center justify-center gap-2 font-medium transition-colors border-r border-gray-800"
                  >
                    <Edit2 size={16} /> Editar
                  </button>
                  <button 
                    onClick={() => handleDemoteToClient(driver.id)}
                    className="p-4 text-red-400 hover:text-red-300 hover:bg-red-500/10 flex items-center justify-center gap-2 font-medium transition-colors"
                  >
                    <X size={16} /> Quitar
                  </button>
                </div>
              </motion.div>
            ))}
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
