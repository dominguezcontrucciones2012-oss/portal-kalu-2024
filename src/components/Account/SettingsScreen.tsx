import React, { useState, useEffect } from 'react';
import { 
  Settings, 
  Save, 
  Building2, 
  Receipt, 
  Phone, 
  MapPin, 
  Globe, 
  FileText,
  ShieldCheck,
  Image as ImageIcon,
  Users,
  Trash2,
  UserPlus,
  X,
  ArrowLeft
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { cn } from '../../lib/utils';
import { getAppConfig, updateAppConfig } from '../../lib/dbUtils';
import { type Configuration } from '../../types';
import BiometricSetupButton from '../common/BiometricSetupButton';
import { useAuth } from '../../contexts/AuthProvider';

const SettingsScreen: React.FC = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [config, setConfig] = useState<Configuration>({
    id: '',
    empresa_nombre: 'Mi Tienda',
    empresa_rif: 'J-00000000-0',
    empresa_telefono: '',
    empresa_direccion: '',
    mensaje_recibo: '¡Gracias por su compra!',
    moneda_principal: 'USD',
    estado_portal: 'automatico'
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [storeId, setStoreId] = useState('');

  const [cashiers, setCashiers] = useState<any[]>([]);
  const [newCashier, setNewCashier] = useState({
    nombre: '',
    cedula: '',
    pin: '',
    role: 'cajero'
  });
  const [isSavingCashier, setIsSavingCashier] = useState(false);
  const [isAddCashierModalOpen, setIsAddCashierModalOpen] = useState(false);

  useEffect(() => {
    let unsubscribeCashiers: any = null;

    const fetchConfigAndCashiers = async () => {
      const { getActiveStoreId } = await import('../../lib/dbUtils');
      const currentStoreId = getActiveStoreId();
      setStoreId(currentStoreId);
      
      const { getDoc, doc, collection, query, where, onSnapshot } = await import('firebase/firestore');
      const { db } = await import('../../lib/firebase');
      
      const configRef = doc(db, 'configuracion', currentStoreId);
      const snap = await getDoc(configRef);
      
      if (snap.exists()) {
        setConfig({ id: snap.id, ...snap.data() } as Configuration);
      } else {
        const globalRef = doc(db, 'configuracion', 'global');
        const globalSnap = await getDoc(globalRef);
        if (globalSnap.exists()) {
          setConfig({ ...globalSnap.data(), id: currentStoreId } as Configuration);
        }
      }
      setLoading(false);

      const q = query(collection(db, 'administradores'), where('storeId', '==', currentStoreId));
      unsubscribeCashiers = onSnapshot(q, (snapshot) => {
        const list = snapshot.docs.map(d => ({
          id: d.id,
          ...d.data()
        }));
        setCashiers(list);
      });
    };
    
    fetchConfigAndCashiers();

    return () => {
      if (unsubscribeCashiers) unsubscribeCashiers();
    };
  }, []);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const { setDoc, doc, serverTimestamp } = await import('firebase/firestore');
      const { db } = await import('../../lib/firebase');
      const { id, ...configData } = config;
      
      await setDoc(doc(db, 'configuracion', storeId), {
        ...configData,
        updatedAt: serverTimestamp()
      });
      alert(`Configuración guardada exitosamente para la tienda: ${storeId}`);
    } catch (err: any) {
      console.error(err);
      alert("Error al guardar: " + err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleSaveCashier = async () => {
    if (!newCashier.nombre || !newCashier.cedula || !newCashier.pin) {
      alert("Por favor completa nombre, cédula y PIN.");
      return;
    }
    setIsSavingCashier(true);
    try {
      const { setDoc, doc } = await import('firebase/firestore');
      const { db } = await import('../../lib/firebase');
      
      const pseudoEmail = `${newCashier.cedula}@kalu.app`;
      const adminRef = doc(db, 'administradores', pseudoEmail);
      
      await setDoc(adminRef, {
        nombre: newCashier.nombre,
        cedula: newCashier.cedula,
        email: pseudoEmail,
        pin: newCashier.pin,
        role: newCashier.role,
        storeId: storeId,
        fechaCreacion: new Date().toISOString()
      }, { merge: true });

      alert("Personal registrado exitosamente.");
      setNewCashier({ nombre: '', cedula: '', pin: '', role: 'cajero' });
      setIsAddCashierModalOpen(false);
    } catch (err: any) {
      console.error(err);
      alert("Error al registrar: " + err.message);
    } finally {
      setIsSavingCashier(false);
    }
  };

  const handleDeleteCashier = async (cashier: any) => {
    if (!window.confirm(`¿Estás seguro de que deseas ELIMINAR/DESPEDIR a ${cashier.nombre}?`)) return;
    try {
      const { deleteDoc, doc } = await import('firebase/firestore');
      const { db } = await import('../../lib/firebase');
      await deleteDoc(doc(db, 'administradores', cashier.id));
      alert("Personal eliminado.");
    } catch (err: any) {
      console.error(err);
      alert("Error al eliminar: " + err.message);
    }
  };

  if (loading) return null;

  return (
    <div className="w-full space-y-4 animate-in fade-in slide-in-from-bottom-4 duration-700 pb-20 -mt-2">
      <div className="flex items-center gap-4">
        <button 
          onClick={() => navigate(-1)}
          className="p-3 bg-white/5 hover:bg-white/10 rounded-2xl transition-all text-gray-400 hover:text-white"
        >
          <ArrowLeft size={24} />
        </button>
        <div>
          <h1 className="text-3xl font-black text-white flex items-center gap-3">
            <Settings className="text-[#3498db]" /> CONFIGURACIÓN GLOBAL
          </h1>
          <p className="text-gray-400 text-sm mt-1">Gestiona la información legal y visual de tu empresa según el modelo oficial</p>
        </div>
      </div>

      <form onSubmit={handleSave} className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Información General */}
          <div className="bg-white/5 border border-white/10 p-8 rounded-[2.5rem] space-y-6">
            <h3 className="text-lg font-bold flex items-center gap-2 mb-2">
              <Building2 className="text-blue-400" size={20} /> Datos de la Empresa
            </h3>
            
            <BiometricSetupButton email={user?.email || ''} userData={user} />
            
            <div className="space-y-4">
              <div className="space-y-1">
                <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest px-2">Nombre Comercial</label>
                <input 
                  type="text" 
                  value={config.empresa_nombre}
                  onChange={(e) => setConfig({...config, empresa_nombre: e.target.value})}
                  className="w-full bg-black/30 border border-white/10 rounded-2xl py-4 px-6 text-sm font-bold focus:border-[#3498db] outline-none transition-all"
                />
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest px-2">RIF / Identificación Fiscal</label>
                <input 
                  type="text" 
                  value={config.empresa_rif}
                  onChange={(e) => setConfig({...config, empresa_rif: e.target.value})}
                  className="w-full bg-black/30 border border-white/10 rounded-2xl py-4 px-6 text-sm font-bold focus:border-[#3498db] outline-none transition-all"
                />
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest px-2">Teléfono de Contacto</label>
                <div className="relative">
                   <Phone className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500" size={16} />
                   <input 
                    type="text" 
                    value={config.empresa_telefono}
                    onChange={(e) => setConfig({...config, empresa_telefono: e.target.value})}
                    className="w-full bg-black/30 border border-white/10 rounded-2xl py-4 pl-12 pr-6 text-sm font-bold focus:border-[#3498db] outline-none transition-all"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Localización y Recibos */}
          <div className="bg-white/5 border border-white/10 p-8 rounded-[2.5rem] space-y-6">
            <h3 className="text-lg font-bold flex items-center gap-2 mb-2">
              <Receipt className="text-green-400" size={20} /> Formato de Venta
            </h3>
            
            <div className="space-y-4">
              <div className="space-y-1">
                <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest px-2">Dirección Fiscal</label>
                <div className="relative">
                  <MapPin className="absolute left-4 top-4 text-gray-500" size={16} />
                  <textarea 
                    rows={2}
                    value={config.empresa_direccion}
                    onChange={(e) => setConfig({...config, empresa_direccion: e.target.value})}
                    className="w-full bg-black/30 border border-white/10 rounded-2xl py-4 pl-12 pr-6 text-sm font-bold focus:border-[#3498db] outline-none transition-all"
                  />
                </div>
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest px-2">Mensaje al Pie del Recibo</label>
                <textarea 
                  rows={2}
                  value={config.mensaje_recibo}
                  onChange={(e) => setConfig({...config, mensaje_recibo: e.target.value})}
                  className="w-full bg-black/30 border border-white/10 rounded-2xl py-4 px-6 text-sm font-bold focus:border-[#3498db] outline-none transition-all"
                  placeholder="Ej: No se aceptan devoluciones..."
                />
              </div>
            </div>
          </div>
        </div>

        {/* Logo y Moneda */}
        <div className="bg-white/5 border border-white/10 p-8 rounded-[2.5rem] flex flex-col md:flex-row items-center gap-8">
           <div className="w-32 h-32 rounded-3xl bg-black/40 border-2 border-dashed border-white/10 flex flex-col items-center justify-center gap-2 text-gray-500 hover:border-[#3498db] hover:text-[#3498db] transition-all cursor-pointer group">
              <ImageIcon size={32} className="group-hover:scale-110 transition-transform" />
              <span className="text-[8px] font-black uppercase tracking-widest">Logo PNG</span>
           </div>
           <div className="flex-1 space-y-4">
              <h3 className="text-lg font-bold">Imagen y Moneda</h3>
              <p className="text-sm text-gray-500 font-medium">Define el logo que aparecerá en tus reportes y la moneda base del sistema.</p>
              <div className="flex gap-4">
                 <button 
                  type="button"
                  onClick={() => setConfig({...config, moneda_principal: 'USD'})}
                  className={cn(
                    "px-6 py-2 rounded-xl text-xs font-black tracking-widest transition-all",
                    config.moneda_principal === 'USD' ? "bg-green-500 text-white shadow-lg shadow-green-500/20" : "bg-white/5 text-gray-500"
                  )}
                 >
                   USD ($)
                 </button>
                 <button 
                  type="button"
                  onClick={() => setConfig({...config, moneda_principal: 'BS'})}
                  className={cn(
                    "px-6 py-2 rounded-xl text-xs font-black tracking-widest transition-all",
                    config.moneda_principal === 'BS' ? "bg-blue-500 text-white shadow-lg shadow-blue-500/20" : "bg-white/5 text-gray-500"
                  )}
                 >
                   BS (Bs.)
                 </button>
              </div>
           </div>
        </div>

         {/* Estado del Portal */}
         <div className="bg-white/5 border border-white/10 p-8 rounded-[2.5rem] space-y-4">
            <h3 className="text-lg font-bold flex items-center gap-2">
              <Globe className="text-purple-400" size={20} /> Estado del Portal Público
            </h3>
            <p className="text-sm text-gray-500 font-medium">Controla si los clientes pueden acceder al portal de compras o si se encuentra en mantenimiento.</p>
            
            <div className="flex flex-wrap items-center gap-4 mt-4">
              <button
               type="button"
               onClick={() => setConfig({...config, estado_portal: 'abierto'})}
               className={cn(
                 "px-6 py-3 rounded-xl text-xs font-black tracking-widest transition-all",
                 config.estado_portal === 'abierto' ? "bg-green-500 text-white shadow-lg shadow-green-500/20" : "bg-white/5 text-gray-500 hover:bg-white/10"
               )}
              >
                ABIERTO (24H Pruebas)
              </button>
              <button
               type="button"
               onClick={() => setConfig({...config, estado_portal: 'automatico'})}
               className={cn(
                 "px-6 py-3 rounded-xl text-xs font-black tracking-widest transition-all",
                 (!config.estado_portal || config.estado_portal === 'automatico') ? "bg-[#3498db] text-white shadow-lg shadow-[#3498db]/20" : "bg-white/5 text-gray-500 hover:bg-white/10"
               )}
              >
                AUTOMÁTICO (6am a 6pm)
              </button>
              <button
               type="button"
               onClick={() => setConfig({...config, estado_portal: 'cerrado'})}
               className={cn(
                 "px-6 py-3 rounded-xl text-xs font-black tracking-widest transition-all",
                 config.estado_portal === 'cerrado' ? "bg-red-500 text-white shadow-lg shadow-red-500/20" : "bg-white/5 text-gray-500 hover:bg-white/10"
               )}
              >
                MANTENIMIENTO (Forzar Cierre)
              </button>
            </div>
         </div>

         {/* Gestión de Cajeros */}
         <div className="bg-white/5 border border-white/10 p-8 rounded-[2.5rem] space-y-6">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div>
                <h3 className="text-lg font-bold flex items-center gap-2">
                  <Users className="text-[#3498db]" size={20} /> Gestión de Personal y Cajeros
                </h3>
                <p className="text-sm text-gray-500 font-medium mt-1">Administra el personal que tiene acceso al POS en esta sucursal.</p>
              </div>
              <button
                type="button"
                onClick={() => setIsAddCashierModalOpen(true)}
                className="bg-[#3498db] hover:bg-[#2980b9] text-white font-black py-3 px-6 rounded-xl shadow-lg shadow-[#3498db]/20 transition-all text-xs uppercase tracking-[2px] flex items-center gap-2 whitespace-nowrap"
              >
                <UserPlus size={16} /> AGREGAR NUEVO CAJERO
              </button>
            </div>
            
            {/* Formulario Nuevo Cajero (Modal) */}
            {isAddCashierModalOpen && (
              <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
                <div className="bg-[#1e293b] border border-white/10 rounded-3xl p-8 max-w-2xl w-full shadow-2xl relative">
                  <button
                    type="button"
                    onClick={() => setIsAddCashierModalOpen(false)}
                    className="absolute top-6 right-6 text-gray-500 hover:text-white transition-colors"
                  >
                    <X size={24} />
                  </button>
                  
                  <h4 className="text-lg font-black text-white uppercase tracking-widest mb-6 flex items-center gap-2">
                    <UserPlus className="text-[#3498db]" size={20} /> Registrar Nuevo Personal
                  </h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-1">
                      <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest px-2">Nombre Completo</label>
                      <input 
                        type="text" 
                        value={newCashier.nombre}
                        onChange={(e) => setNewCashier({...newCashier, nombre: e.target.value})}
                        placeholder="Ej. Ana Pérez"
                        className="w-full bg-black/30 border border-white/10 rounded-xl py-3 px-4 text-sm font-bold focus:border-[#3498db] outline-none transition-all"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest px-2">Cédula / DNI</label>
                      <input 
                        type="text" 
                        value={newCashier.cedula}
                        onChange={(e) => setNewCashier({...newCashier, cedula: e.target.value})}
                        placeholder="Ej. 12345678"
                        className="w-full bg-black/30 border border-white/10 rounded-xl py-3 px-4 text-sm font-bold focus:border-[#3498db] outline-none transition-all"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest px-2">PIN de Acceso</label>
                      <input 
                        type="password" 
                        value={newCashier.pin}
                        onChange={(e) => setNewCashier({...newCashier, pin: e.target.value})}
                        placeholder="****"
                        maxLength={6}
                        className="w-full bg-black/30 border border-white/10 rounded-xl py-3 px-4 text-sm font-bold focus:border-[#3498db] outline-none transition-all tracking-[0.5em]"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest px-2">Rol Asignado</label>
                      <select
                        value={newCashier.role}
                        onChange={(e) => setNewCashier({...newCashier, role: e.target.value})}
                        className="w-full bg-black/30 border border-white/10 rounded-xl py-3 px-4 text-sm font-bold focus:border-[#3498db] outline-none transition-all text-white appearance-none"
                      >
                        <option value="cajero">Cajero</option>
                        <option value="supervisor">Supervisor</option>
                      </select>
                    </div>
                    <div className="space-y-1 md:col-span-2">
                      <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest px-2">Sucursal Asignada</label>
                      <input 
                        type="text" 
                        value={storeId || 'Sucursal Principal'}
                        disabled
                        className="w-full bg-white/5 border border-white/5 rounded-xl py-3 px-4 text-sm font-bold text-gray-500 cursor-not-allowed"
                      />
                    </div>
                  </div>
                  <div className="flex justify-end pt-6 gap-3">
                    <button
                      type="button"
                      onClick={() => setIsAddCashierModalOpen(false)}
                      className="bg-transparent hover:bg-white/5 text-gray-400 font-bold py-3 px-6 rounded-xl transition-all text-xs uppercase tracking-[2px]"
                    >
                      Cancelar
                    </button>
                    <button
                      type="button"
                      onClick={handleSaveCashier}
                      disabled={isSavingCashier}
                      className="bg-[#3498db] hover:bg-[#2980b9] text-white font-black py-3 px-6 rounded-xl shadow-lg shadow-[#3498db]/20 transition-all text-xs uppercase tracking-[2px] disabled:opacity-50"
                    >
                      {isSavingCashier ? 'GUARDANDO...' : 'GUARDAR CAJERO'}
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* Tabla de Personal */}
            <div className="mt-8 bg-black/20 rounded-2xl overflow-hidden border border-white/5">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-white/5 border-b border-white/10">
                    <th className="p-4 text-xs font-black text-gray-500 uppercase tracking-widest w-1/3">Nombre</th>
                    <th className="p-4 text-xs font-black text-gray-500 uppercase tracking-widest w-1/4">Cédula</th>
                    <th className="p-4 text-xs font-black text-gray-500 uppercase tracking-widest w-1/4">Rol</th>
                    <th className="p-4 text-xs font-black text-gray-500 uppercase tracking-widest text-right">Acciones</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {cashiers.length === 0 ? (
                    <tr>
                      <td colSpan={4} className="p-8 text-center text-gray-500 text-sm">
                        No hay personal registrado en esta sucursal.
                      </td>
                    </tr>
                  ) : (
                    cashiers.map(c => (
                      <tr key={c.id} className="hover:bg-white/5 transition-colors">
                        <td className="p-4 text-sm font-bold text-white flex items-center gap-3">
                          <div className="w-8 h-8 rounded-full bg-[#3498db]/20 flex items-center justify-center text-[#3498db]">
                            {c.nombre?.charAt(0).toUpperCase()}
                          </div>
                          {c.nombre}
                        </td>
                        <td className="p-4 text-sm text-gray-300 font-mono">{c.cedula || 'N/A'}</td>
                        <td className="p-4 text-sm">
                          <span className={cn(
                            "px-3 py-1 rounded-full text-[10px] font-black tracking-widest uppercase",
                            c.role === 'supervisor' ? "bg-purple-500/20 text-purple-400" : "bg-blue-500/20 text-blue-400"
                          )}>
                            {c.role}
                          </span>
                        </td>
                        <td className="p-4 text-right">
                          <button
                            type="button"
                            onClick={() => handleDeleteCashier(c)}
                            className="p-2 bg-red-500/10 text-red-500 hover:bg-red-500 hover:text-white rounded-lg transition-all"
                            title="Despedir / Eliminar"
                          >
                            <Trash2 size={16} />
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
         </div>

        <div className="flex flex-col md:flex-row items-center justify-between p-8 bg-[#3498db]/10 border border-[#3498db]/20 rounded-[2.5rem] gap-4">
           <div className="flex items-center gap-4">
              <ShieldCheck className="text-[#3498db]" size={32} />
              <div className="text-sm text-[#3498db] font-bold">Estos datos se reflejarán en todos los reportes y facturas emitidas.</div>
           </div>
           <button 
            type="submit"
            disabled={saving}
            className="bg-[#3498db] hover:bg-[#2980b9] text-white font-black py-4 px-10 rounded-2xl shadow-xl shadow-[#3498db]/20 transition-all flex items-center gap-3 text-sm uppercase tracking-[4px] active:scale-95 disabled:opacity-50"
          >
            <Save size={20} /> {saving ? 'GUARDANDO...' : 'GUARDAR CAMBIOS'}
          </button>
        </div>
      </form>
    </div>
  );
};

export default SettingsScreen;
