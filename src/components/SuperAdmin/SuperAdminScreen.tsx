import React, { useState, useEffect } from 'react';
import { 
  Store, Plus, Power, Settings, ShieldCheck, Search, ExternalLink, 
  Copy, Eye, Trash2, LayoutDashboard, Users, Zap, Bot, 
  MessageSquare, ShoppingBag, CreditCard, ChevronRight, Activity, Download, LogOut
} from 'lucide-react';
import { db } from '../../lib/firebase';
import { collection, query, getDocs, doc, setDoc, deleteDoc, getDoc, where, updateDoc } from 'firebase/firestore';
import { initializeApp, deleteApp } from 'firebase/app';
import { getAuth, createUserWithEmailAndPassword } from 'firebase/auth';
import firebaseConfig from '../../../firebase-applet-config.json';
import { Store as StoreModel } from '../../types';
import { useNavigate } from 'react-router-dom';
import JSZip from 'jszip';
import { useAuth } from '../../contexts/AuthProvider';

type TabType = 'dashboard' | 'stores' | 'admins' | 'settings';

export default function SuperAdminScreen() {
  const navigate = useNavigate();
  const { logout } = useAuth();
  const [activeTab, setActiveTab] = useState<TabType>('dashboard');
  const [stores, setStores] = useState<StoreModel[]>([]);
  const [admins, setAdmins] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  
  // Modals state
  const [isStoreModalOpen, setIsStoreModalOpen] = useState(false);
  const [editingStore, setEditingStore] = useState<StoreModel | null>(null);
  const [editingAdmin, setEditingAdmin] = useState<any>(null);
  
  // Local states para edición
  const [adminEmailEdit, setAdminEmailEdit] = useState('');
  const [adminPinEdit, setAdminPinEdit] = useState('');
  const [localPlan, setLocalPlan] = useState<string>('free');
  const [isApplyingPlan, setIsApplyingPlan] = useState(false);
  
  const [adminEmailDirect, setAdminEmailDirect] = useState('');
  const [adminPinDirect, setAdminPinDirect] = useState('');
  
  // New Store Form
  const [newStore, setNewStore] = useState<Partial<StoreModel> & { adminEmail?: string; adminPassword?: string }>({
    id: '', name: '', status: 'active', ownerUid: '', plan: 'free', adminEmail: '', adminPassword: ''
  });

  // Master Kill Switch
  const [globalSystemActive, setGlobalSystemActive] = useState(true);

  useEffect(() => {
    fetchStores();
    fetchAdmins();
  }, []);

  const fetchAdmins = async () => {
    try {
      const q = query(collection(db, 'administradores'));
      const snapshot = await getDocs(q);
      setAdmins(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    } catch (error) {
      console.error('Error fetching admins:', error);
    }
  };

  const fetchStores = async () => {
    try {
      setLoading(true);
      const q = query(collection(db, 'stores'));
      const snapshot = await getDocs(q);
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as StoreModel[];
      setStores(data);
    } catch (error) {
      console.error('Error fetching stores:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateStore = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newStore.id || !newStore.name || !newStore.adminEmail || !newStore.adminPassword) return;

    if (newStore.adminPassword.length !== 6 || !/^\d+$/.test(newStore.adminPassword)) {
      alert('El PIN del administrador debe tener exactamente 6 números.');
      return;
    }

    try {
      let newUserId = '';
      try {
        const secondaryApp = initializeApp(firebaseConfig, 'SecondaryApp' + Date.now());
        const secondaryAuth = getAuth(secondaryApp);
        const userCredential = await createUserWithEmailAndPassword(secondaryAuth, newStore.adminEmail, newStore.adminPassword);
        newUserId = userCredential.user.uid;
        await deleteApp(secondaryApp);
      } catch (authError: any) {
        if (authError.code === 'auth/email-already-in-use') {
          const q = query(collection(db, 'users'), where('email', '==', newStore.adminEmail.toLowerCase()));
          const snap = await getDocs(q);
          if (!snap.empty) {
            newUserId = snap.docs[0].id;
          } else {
            newUserId = 'reused_' + Date.now();
          }
        } else {
          throw authError;
        }
      }

      await setDoc(doc(db, 'users', newUserId), {
        username: `Admin ${newStore.name}`,
        nombre: `Admin ${newStore.name}`,
        role: 'admin',
        email: newStore.adminEmail.toLowerCase(),
        pin: String(newStore.adminPassword).trim(),
        storeId: newStore.id,
        updatedAt: new Date().toISOString()
      }, { merge: true });

      await setDoc(doc(db, 'administradores', newUserId), {
        email: newStore.adminEmail.toLowerCase(),
        pin: String(newStore.adminPassword).trim(),
        storeId: newStore.id,
        role: 'admin',
        updatedAt: new Date().toISOString()
      }, { merge: true });
      fetchAdmins();

      const storeData: StoreModel = {
        id: newStore.id,
        name: newStore.name,
        status: newStore.status as 'active' | 'suspended' | 'pending',
        ownerUid: newUserId,
        plan: newStore.plan as 'free' | 'premium',
        createdAt: new Date().toISOString(),
        features: {
          hasOnlineStore: true,
          hasAISales: true,
          hasAIPurchases: true,
          hasWhatsApp: true,
          hasVIPCredit: true,
          hasPOS: true,
          hasOpenTabs: true
        }
      };

      await setDoc(doc(db, 'stores', storeData.id), storeData);
      setStores([...stores, storeData]);
      setIsStoreModalOpen(false);
      setNewStore({ id: '', name: '', status: 'active', ownerUid: '', plan: 'free', adminEmail: '', adminPassword: '' });
      alert('Tienda creada exitosamente.');
    } catch (error: any) {
      alert('Error creando la tienda: ' + error.message);
    }
  };

  const handleUpdateFeatures = async (storeId: string, features: any, featureKey: string, newValue: boolean) => {
    try {
      const updatedFeatures = { ...features, [featureKey]: newValue };
      await setDoc(doc(db, 'stores', storeId), { features: updatedFeatures }, { merge: true });
      setStores(stores.map(s => s.id === storeId ? { ...s, features: updatedFeatures } : s));
      
      if (editingStore && editingStore.id === storeId) {
        setEditingStore({ ...editingStore, features: updatedFeatures });
      }
    } catch (error) {
      console.error('Error updating features:', error);
      alert('Error al actualizar configuración.');
    }
  };

  const handleSwitchContext = (storeId: string) => {
    localStorage.setItem('activeStoreId', storeId);
    localStorage.setItem('kalu_pin_verified', 'true');
    window.location.href = `/?store=${storeId}`;
  };

  const handleDeleteStore = async (storeId: string) => {
    if (window.confirm('¿ELIMINAR DEFINITIVAMENTE la tienda y sus usuarios asociados?')) {
      try {
        setLoading(true);
        await deleteDoc(doc(db, 'stores', storeId));
        
        const q = query(collection(db, 'users'), where('storeId', '==', storeId));
        const usersSnap = await getDocs(q);
        await Promise.all(usersSnap.docs.map(d => deleteDoc(doc(db, 'users', d.id))));
        
        const adminQ = query(collection(db, 'administradores'), where('storeId', '==', storeId));
        const adminSnap = await getDocs(adminQ);
        await Promise.all(adminSnap.docs.map(d => deleteDoc(doc(db, 'administradores', d.id))));
        
        fetchAdmins();
        setStores(stores.filter(s => s.id !== storeId));
      } catch (error: any) {
        alert('Error: ' + error.message);
      } finally {
        setLoading(false);
      }
    }
  };

  const handleEditClick = async (store: StoreModel) => {
    setEditingStore(store);
    setLocalPlan(store.plan === 'premium' ? 'premium' : 'free');
    try {
      const userDoc = await getDoc(doc(db, 'users', store.ownerUid));
      if (userDoc.exists()) {
        const userData = userDoc.data();
        setAdminEmailEdit(userData.email || '');
        setAdminPinEdit(userData.pin || '');
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handleUpdateCredentials = async () => {
    if (!editingStore) return;
    try {
      const userRef = doc(db, 'users', editingStore.ownerUid);
      const adminRef = doc(db, 'administradores', editingStore.ownerUid);
      
      const payload = { 
        email: adminEmailEdit.toLowerCase(), 
        pin: adminPinEdit,
        storeId: editingStore.id,
        role: 'admin',
        username: `Admin ${editingStore.name}`,
        nombre: `Admin ${editingStore.name}`
      };

      await setDoc(userRef, payload, { merge: true });
      await setDoc(adminRef, payload, { merge: true });
      
      alert('Credenciales guardadas correctamente y vinculadas a ' + editingStore.name);
      fetchAdmins();
    } catch (error: any) {
      alert('Error: ' + error.message);
    }
  };

  const handleUpdateDirectAdmin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingAdmin) return;
    try {
      setLoading(true);
      const userRef = doc(db, 'users', editingAdmin.id);
      const adminRef = doc(db, 'administradores', editingAdmin.id);
      
      const payload = { 
        email: adminEmailDirect.toLowerCase(), 
        pin: adminPinDirect
      };

      await setDoc(userRef, payload, { merge: true });
      await setDoc(adminRef, payload, { merge: true });
      
      alert('Credencial actualizada exitosamente.');
      setEditingAdmin(null);
      fetchAdmins();
    } catch (error: any) {
      alert('Error: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleUpdatePlan = async () => {
    if (!editingStore) return;
    setIsApplyingPlan(true);
    try {
      await updateDoc(doc(db, 'stores', editingStore.id), { plan: localPlan });
      setEditingStore(prev => prev ? { ...prev, plan: localPlan } : null);
      setStores(prev => prev.map(s => s.id === editingStore.id ? { ...s, plan: localPlan } : s));
      
      let basePrice = localPlan === 'premium' ? 30 : 15;
      let extraCost = 0;
      if (editingStore.features?.hasWhatsApp) extraCost += 20;
      if (editingStore.features?.hasAISales) extraCost += 5;
      if (editingStore.features?.hasAIPurchases) extraCost += 5;
      if (editingStore.features?.hasOpenTabs) extraCost += 20;
      if (editingStore.features?.hasOnlineStore) extraCost += 40;
      const total = basePrice + extraCost;

      alert(`✅ Aplicado y Confirmado.\nEl ticket mensual de esta tienda quedó en $${total.toFixed(2)}.`);
    } catch (error: any) {
      console.error(error);
      alert('Error al confirmar ticket: ' + error.message);
    } finally {
      setIsApplyingPlan(false);
    }
  };

  const filteredStores = stores.filter(store => 
    store.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
    store.id.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="flex h-screen bg-[#090b14] text-white overflow-hidden font-sans">
      
      {/* Sidebar / Menú Jerárquico */}
      <div className="w-72 bg-[#0f1222] border-r border-white/5 flex flex-col z-10 relative">
        <div className="p-6">
          <div className="flex items-center gap-3 text-2xl font-black mb-1">
            <ShieldCheck className="text-[#3498db]" size={28} />
            <span className="bg-clip-text text-transparent bg-gradient-to-r from-blue-400 to-indigo-400">
              BREQUERA
            </span>
          </div>
          <p className="text-xs text-blue-400/60 font-bold tracking-widest uppercase ml-10">Central Command</p>
        </div>

        <nav className="flex-1 px-4 space-y-2 mt-4">
          {[
            { id: 'dashboard', icon: LayoutDashboard, label: 'Dashboard Global' },
            { id: 'stores', icon: Store, label: 'Red de Tiendas' },
            { id: 'admins', icon: Users, label: 'Credenciales' },
            { id: 'settings', icon: Settings, label: 'Configuración Maestra' }
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as TabType)}
              className={`w-full flex items-center gap-3 px-4 py-3.5 rounded-xl font-bold transition-all ${
                activeTab === tab.id 
                  ? 'bg-blue-500/10 text-blue-400 border border-blue-500/20 shadow-[0_0_15px_rgba(59,130,246,0.1)]' 
                  : 'text-gray-400 hover:bg-white/5 hover:text-white'
              }`}
            >
              <tab.icon size={20} className={activeTab === tab.id ? 'text-blue-400' : ''} />
              {tab.label}
              {activeTab === tab.id && <ChevronRight size={16} className="ml-auto opacity-50" />}
            </button>
          ))}
        </nav>

        <div className="p-4 mt-auto">
          <div className="bg-red-500/10 border border-red-500/20 rounded-2xl p-4 flex flex-col items-center text-center">
            <Power size={24} className="text-red-500 mb-2" />
            <span className="text-xs font-black text-red-500 uppercase tracking-widest mb-3">Master Kill Switch</span>
            <button 
              onClick={() => {
                if (window.confirm("¿ESTÁS SEGURO? Esto apagará la IA y el Bot en TODAS las tiendas de la plataforma.")) {
                  setGlobalSystemActive(!globalSystemActive);
                }
              }}
              className={`w-full py-2.5 rounded-xl font-black text-sm uppercase transition-all flex justify-center items-center gap-2 ${
                globalSystemActive 
                  ? 'bg-red-500 hover:bg-red-600 text-white shadow-[0_0_15px_rgba(239,68,68,0.4)]' 
                  : 'bg-green-500 hover:bg-green-600 text-white shadow-[0_0_15px_rgba(34,197,94,0.4)]'
              }`}
            >
              {globalSystemActive ? 'Apagar Sistema' : 'Encender Sistema'}
            </button>
            <button
              onClick={logout}
              className="w-full mt-4 py-2.5 rounded-xl font-black text-sm uppercase transition-all flex justify-center items-center gap-2 bg-white/5 hover:bg-white/10 text-gray-400 hover:text-white"
            >
              <LogOut size={16} /> Cerrar Sesión Maestra
            </button>
          </div>
        </div>
      </div>

      {/* Área Principal */}
      <div className="flex-1 flex flex-col overflow-y-auto relative">
        {/* Glow effect background */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[300px] bg-blue-500/10 blur-[120px] rounded-full pointer-events-none" />

        <div className="p-8 max-w-[1600px] mx-auto w-full z-10 relative">
          
          {/* TAB: DASHBOARD GLOBAL */}
          {activeTab === 'dashboard' && (
            <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
              <div>
                <h1 className="text-3xl font-black text-white">Estado Global de la Red</h1>
                <p className="text-gray-400 mt-2">Visión general de infraestructura y salud del sistema Multi-Tenant.</p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                {[
                  { title: 'Tiendas Activas', value: stores.filter(s => s.status === 'active').length, total: stores.length, icon: Store, color: 'text-emerald-400', bg: 'bg-emerald-500/10', border: 'border-emerald-500/20' },
                  { title: 'Admin Registrados', value: admins.length, total: 'Usuarios', icon: Users, color: 'text-blue-400', bg: 'bg-blue-500/10', border: 'border-blue-500/20' },
                  { title: 'Tráfico IA', value: '45.2k', total: 'Req/mes', icon: Zap, color: 'text-purple-400', bg: 'bg-purple-500/10', border: 'border-purple-500/20' },
                  { title: 'Estado Firebase', value: 'ÓPTIMO', total: '0 alertas', icon: Activity, color: 'text-green-400', bg: 'bg-green-500/10', border: 'border-green-500/20' }
                ].map((stat, i) => (
                  <div key={i} className="bg-[#15192b] border border-white/5 p-6 rounded-3xl relative overflow-hidden group">
                    <div className="flex justify-between items-start mb-4">
                      <div className={`p-3 rounded-2xl ${stat.bg} ${stat.color} border ${stat.border}`}>
                        <stat.icon size={24} />
                      </div>
                      <span className="text-xs font-bold text-gray-500">{stat.total}</span>
                    </div>
                    <div>
                      <p className="text-4xl font-black text-white">{stat.value}</p>
                      <p className="text-sm font-bold text-gray-400 uppercase tracking-wider mt-2">{stat.title}</p>
                    </div>
                    {/* Hover Glow */}
                    <div className={`absolute -bottom-10 -right-10 w-32 h-32 ${stat.bg} blur-[50px] opacity-0 group-hover:opacity-100 transition-opacity duration-500`} />
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* TAB: STORES */}
          {activeTab === 'stores' && (
            <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
              <div className="flex items-center justify-between">
                <div>
                  <h1 className="text-3xl font-black text-white">Red de Tiendas</h1>
                  <p className="text-gray-400 mt-2">Control granular y Kill Switches por sucursal.</p>
                </div>
                <button 
                  onClick={() => setIsStoreModalOpen(true)}
                  className="bg-blue-500 hover:bg-blue-600 text-white px-6 py-3 rounded-xl font-bold transition-all shadow-[0_0_20px_rgba(59,130,246,0.3)] flex items-center gap-2 active:scale-95"
                >
                  <Plus size={20} />
                  Nueva Tienda
                </button>
              </div>

              <div className="bg-[#15192b] border border-white/5 rounded-3xl overflow-hidden shadow-2xl flex flex-col min-h-[500px]">
                <div className="p-4 border-b border-white/5">
                  <div className="relative max-w-md">
                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500" size={20} />
                    <input 
                      type="text" 
                      placeholder="Buscar tienda por ID o nombre..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="w-full bg-black/40 border border-white/10 rounded-xl py-3 pl-12 pr-4 text-white focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all placeholder:text-gray-600"
                    />
                  </div>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse whitespace-nowrap">
                    <thead>
                      <tr className="bg-black/20">
                        <th className="p-5 text-xs font-black text-gray-500 uppercase tracking-widest border-b border-white/5">Tienda</th>
                        <th className="p-5 text-xs font-black text-gray-500 uppercase tracking-widest border-b border-white/5 text-center">Estado</th>
                        <th className="p-5 text-xs font-black text-gray-500 uppercase tracking-widest border-b border-white/5 text-right">Acciones</th>
                      </tr>
                    </thead>
                    <tbody>
                      {loading ? (
                        <tr><td colSpan={5} className="p-12 text-center text-gray-500">Cargando red...</td></tr>
                      ) : filteredStores.length === 0 ? (
                        <tr><td colSpan={5} className="p-12 text-center text-gray-500">No se encontraron resultados</td></tr>
                      ) : (
                        filteredStores.map(store => (
                          <tr key={store.id} className="border-b border-white/5 hover:bg-white/[0.02] transition-colors group">
                            <td className="p-5">
                              <div className="flex items-center gap-4">
                                <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-blue-500/20 to-purple-500/20 border border-white/10 flex items-center justify-center">
                                  <Store size={20} className="text-blue-400" />
                                </div>
                                <div>
                                  <div className="font-bold text-white text-base">{store.name}</div>
                                  <div className="text-xs text-gray-500 font-mono mt-1">{store.id}</div>
                                </div>
                              </div>
                            </td>
                            <td className="p-5 text-center">
                              <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-wider border ${
                                store.status === 'active' ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' : 'bg-red-500/10 text-red-400 border-red-500/20'
                              }`}>
                                <div className={`w-1.5 h-1.5 rounded-full ${store.status === 'active' ? 'bg-emerald-400' : 'bg-red-400'}`} />
                                {store.status}
                              </span>
                            </td>

                            <td className="p-5">
                              <div className="flex justify-end gap-2">
                                <button 
                                  onClick={() => {
                                    const url = `${window.location.origin}/?store=${store.id}`;
                                    navigator.clipboard.writeText(url);
                                    alert('URL copiada al portapapeles:\n' + url);
                                  }}
                                  title="Copiar URL de la Tienda"
                                  className="p-2.5 rounded-xl bg-white/5 text-gray-300 hover:bg-white/10 transition-colors"
                                >
                                  <Eye size={18} />
                                </button>
                                <button 
                                  onClick={() => {
                                    localStorage.setItem('kalu_impersonate_store', store.id);
                                    handleSwitchContext(store.id);
                                  }}
                                  title="Entrar al Panel Operativo"
                                  className="p-2.5 rounded-xl bg-blue-500/10 text-blue-400 hover:bg-blue-500 hover:text-white transition-colors"
                                >
                                  <ExternalLink size={18} />
                                </button>
                                <button 
                                  onClick={() => handleEditClick(store)}
                                  title="Configuración Avanzada"
                                  className="p-2.5 rounded-xl bg-white/5 text-gray-300 hover:bg-white/10 transition-colors"
                                >
                                  <Settings size={18} />
                                </button>
                              </div>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* TAB: ADMINS */}
          {activeTab === 'admins' && (
            <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
              <div>
                <h1 className="text-3xl font-black text-white">Credenciales y Accesos</h1>
                <p className="text-gray-400 mt-2">Aislamiento de roles locales (Administradores de sucursal).</p>
              </div>

              <div className="bg-[#15192b] border border-white/5 rounded-3xl overflow-hidden shadow-2xl">
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="bg-black/20">
                        <th className="p-5 text-xs font-black text-gray-500 uppercase tracking-widest border-b border-white/5">Email Admin</th>
                        <th className="p-5 text-xs font-black text-gray-500 uppercase tracking-widest border-b border-white/5">PIN</th>
                        <th className="p-5 text-xs font-black text-gray-500 uppercase tracking-widest border-b border-white/5">Tienda (ID)</th>
                        <th className="p-5 text-xs font-black text-gray-500 uppercase tracking-widest border-b border-white/5 text-right">Acciones</th>
                      </tr>
                    </thead>
                    <tbody>
                      {admins.map(admin => (
                        <tr key={admin.id} className="border-b border-white/5 hover:bg-white/[0.02]">
                          <td className="p-5 font-bold text-white">{admin.email}</td>
                          <td className="p-5 font-mono text-blue-400 tracking-widest">{admin.pin}</td>
                          <td className="p-5 text-gray-400">
                            {admin.role === 'superadmin' ? (
                              <span className="text-emerald-400 font-bold flex items-center gap-1"><ShieldCheck size={14}/> {admin.storeId}</span>
                            ) : (
                              admin.storeId
                            )}
                          </td>
                          <td className="p-5">
                            <div className="flex justify-end gap-2">
                              <button
                                onClick={() => {
                                  setEditingAdmin(admin);
                                  setAdminEmailDirect(admin.email);
                                  setAdminPinDirect(admin.pin);
                                }}
                                title="Editar PIN"
                                className="p-2.5 rounded-xl bg-blue-500/10 text-blue-400 hover:bg-blue-500 hover:text-white transition-colors"
                              >
                                <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z"></path></svg>
                              </button>
                              <button
                                onClick={async () => {
                                  if (window.confirm(`¿Seguro que deseas eliminar la credencial de ${admin.email}? Esto borrará su registro de administradores y usuarios.`)) {
                                    try {
                                      setLoading(true);
                                      await deleteDoc(doc(db, 'administradores', admin.id));
                                      await deleteDoc(doc(db, 'users', admin.id));
                                      setAdmins(admins.filter(a => a.id !== admin.id));
                                      alert('Credencial eliminada correctamente de Firestore.');
                                    } catch (error: any) {
                                      alert('Error al eliminar credencial: ' + error.message);
                                    } finally {
                                      setLoading(false);
                                    }
                                  }
                                }}
                                title="Eliminar Credencial"
                                className="p-2.5 rounded-xl bg-red-500/10 text-red-500 hover:bg-red-500 hover:text-white transition-colors"
                              >
                                <Trash2 size={18} />
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

        </div>
      </div>

      {/* MODAL: Nueva Tienda */}
      {isStoreModalOpen && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-md flex items-center justify-center z-50 p-4">
          <div className="bg-[#15192b] rounded-[2rem] w-full max-w-xl overflow-hidden border border-white/10 shadow-[0_0_50px_rgba(0,0,0,0.5)]">
            <div className="p-8 border-b border-white/5 bg-gradient-to-b from-white/5 to-transparent">
              <h2 className="text-2xl font-black text-white">Alta de Sucursal</h2>
              <p className="text-gray-400 mt-1">Registrar nueva tienda en la red SaaS</p>
            </div>
            
            <form onSubmit={handleCreateStore} className="p-8 space-y-6">
              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-black text-blue-400 uppercase tracking-widest mb-2">ID de Tienda (Slug Único)</label>
                  <input type="text" required value={newStore.id} onChange={e => setNewStore({ ...newStore, id: e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '') })} className="w-full bg-black/40 border border-white/10 rounded-2xl py-3 px-5 text-white focus:outline-none focus:border-blue-500 font-mono" placeholder="ej. kalu-centro" />
                </div>
                <div>
                  <label className="block text-xs font-black text-gray-400 uppercase tracking-widest mb-2">Nombre Comercial</label>
                  <input type="text" required value={newStore.name} onChange={e => setNewStore({ ...newStore, name: e.target.value })} className="w-full bg-black/40 border border-white/10 rounded-2xl py-3 px-5 text-white focus:outline-none focus:border-blue-500" placeholder="Kalu Centro" />
                </div>
                
                <div className="grid grid-cols-2 gap-4 pt-2">
                  <div>
                    <label className="block text-xs font-black text-emerald-400 uppercase tracking-widest mb-2">Admin Email</label>
                    <input type="email" required value={newStore.adminEmail || ''} onChange={e => setNewStore({ ...newStore, adminEmail: e.target.value })} className="w-full bg-black/40 border border-emerald-500/30 rounded-2xl py-3 px-5 text-white focus:outline-none focus:border-emerald-500" placeholder="admin@local.com" />
                  </div>
                  <div>
                    <label className="block text-xs font-black text-emerald-400 uppercase tracking-widest mb-2">PIN (6 dígitos)</label>
                    <input type="password" required maxLength={6} value={newStore.adminPassword || ''} onChange={e => setNewStore({ ...newStore, adminPassword: e.target.value })} className="w-full bg-black/40 border border-emerald-500/30 rounded-2xl py-3 px-5 text-white focus:outline-none focus:border-emerald-500 font-mono tracking-widest" placeholder="123456" />
                  </div>
                </div>
              </div>

              <div className="flex gap-4 pt-6 mt-6 border-t border-white/5">
                <button type="button" onClick={() => setIsStoreModalOpen(false)} className="flex-1 py-4 rounded-2xl border border-white/10 text-white font-bold hover:bg-white/5 transition-colors">
                  Cancelar
                </button>
                <button type="submit" className="flex-1 py-4 rounded-2xl bg-blue-500 text-white font-black hover:bg-blue-600 transition-all shadow-[0_0_20px_rgba(59,130,246,0.3)]">
                  Registrar Sucursal
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: Configuración Maestra de Tienda (Full-Screen) */}
      {editingStore && (
        <div className="fixed inset-0 bg-[#090b14] z-50 flex flex-col overflow-y-auto animate-in slide-in-from-bottom-8 duration-500">
          {/* Top Bar */}
          <div className="sticky top-0 z-10 bg-[#0f1222]/90 backdrop-blur-xl border-b border-white/10 p-6 flex justify-between items-center">
            <div>
              <h2 className="text-3xl font-black text-white">{editingStore.name}</h2>
              <p className="text-blue-400 font-mono text-sm mt-1">ID: {editingStore.id}</p>
            </div>
            <button 
              onClick={() => setEditingStore(null)} 
              className="bg-white/10 hover:bg-white/20 text-white px-6 py-3 rounded-2xl font-bold transition-all border border-white/10 flex items-center gap-2"
            >
              Cerrar Panel
            </button>
          </div>

          <div className="max-w-[1200px] mx-auto w-full p-8 flex-1">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              
              {/* Columna Izquierda: Kill Switches y Módulos */}
              <div className="space-y-8">
                <div className="bg-[#15192b] rounded-3xl p-8 border border-white/5 shadow-2xl">
                  <h3 className="text-sm font-black text-blue-400 uppercase tracking-widest mb-6 flex items-center gap-2">
                    <Zap size={18} />
                    Módulos y Kill Switches
                  </h3>
                  
                  <div className="space-y-6">
                    {/* Bot de WhatsApp */}
                    <div className="flex items-center justify-between p-4 bg-black/20 rounded-2xl border border-white/5">
                      <div className="flex items-center gap-4">
                        <div className={`p-3 rounded-xl ${editingStore.features?.hasWhatsApp ? 'bg-emerald-500/20 text-emerald-400' : 'bg-gray-800 text-gray-500'}`}>
                          <MessageSquare size={24} />
                        </div>
                        <div>
                          <p className="font-bold text-white">Bot de WhatsApp</p>
                          <p className="text-xs text-gray-400">Automatización de pedidos vía Meta API</p>
                        </div>
                      </div>
                      <button 
                        onClick={() => handleUpdateFeatures(editingStore.id, editingStore.features || {}, 'hasWhatsApp', !(editingStore.features?.hasWhatsApp ?? true))}
                        className={`relative inline-flex h-8 w-14 items-center rounded-full transition-colors border ${
                          (editingStore.features?.hasWhatsApp ?? true) ? 'bg-emerald-500/20 border-emerald-500/40' : 'bg-red-500/20 border-red-500/40'
                        }`}
                      >
                        <span className={`inline-block h-6 w-6 transform rounded-full bg-white transition-transform ${
                          (editingStore.features?.hasWhatsApp ?? true) ? 'translate-x-7' : 'translate-x-1'
                        }`} />
                      </button>
                    </div>

                    {/* Inteligencia Artificial (Ventas) */}
                    <div className="flex items-center justify-between p-4 bg-black/20 rounded-2xl border border-white/5">
                      <div className="flex items-center gap-4">
                        <div className={`p-3 rounded-xl ${editingStore.features?.hasAISales ? 'bg-purple-500/20 text-purple-400' : 'bg-gray-800 text-gray-500'}`}>
                          <Zap size={24} />
                        </div>
                        <div>
                          <p className="font-bold text-white">IA Ventas (Asistente Day)</p>
                          <p className="text-xs text-gray-400">Motor de Gemini y Chatbot activo</p>
                        </div>
                      </div>
                      <button 
                        onClick={() => handleUpdateFeatures(editingStore.id, editingStore.features || {}, 'hasAISales', !(editingStore.features?.hasAISales ?? true))}
                        className={`relative inline-flex h-8 w-14 items-center rounded-full transition-colors border ${
                          (editingStore.features?.hasAISales ?? true) ? 'bg-emerald-500/20 border-emerald-500/40' : 'bg-red-500/20 border-red-500/40'
                        }`}
                      >
                        <span className={`inline-block h-6 w-6 transform rounded-full bg-white transition-transform ${
                          (editingStore.features?.hasAISales ?? true) ? 'translate-x-7' : 'translate-x-1'
                        }`} />
                      </button>
                    </div>

                    {/* Inteligencia Artificial (Compras) */}
                    <div className="flex items-center justify-between p-4 bg-black/20 rounded-2xl border border-white/5">
                      <div className="flex items-center gap-4">
                        <div className={`p-3 rounded-xl ${editingStore.features?.hasAIPurchases ? 'bg-purple-500/20 text-purple-400' : 'bg-gray-800 text-gray-500'}`}>
                          <Zap size={24} />
                        </div>
                        <div>
                          <p className="font-bold text-white">IA Compras (Facturas)</p>
                          <p className="text-xs text-gray-400">Escáner e ingreso inteligente</p>
                        </div>
                      </div>
                      <button 
                        onClick={() => handleUpdateFeatures(editingStore.id, editingStore.features || {}, 'hasAIPurchases', !(editingStore.features?.hasAIPurchases ?? true))}
                        className={`relative inline-flex h-8 w-14 items-center rounded-full transition-colors border ${
                          (editingStore.features?.hasAIPurchases ?? true) ? 'bg-emerald-500/20 border-emerald-500/40' : 'bg-red-500/20 border-red-500/40'
                        }`}
                      >
                        <span className={`inline-block h-6 w-6 transform rounded-full bg-white transition-transform ${
                          (editingStore.features?.hasAIPurchases ?? true) ? 'translate-x-7' : 'translate-x-1'
                        }`} />
                      </button>
                    </div>

                    {/* Cuentas Abiertas */}
                    <div className="flex items-center justify-between p-4 bg-black/20 rounded-2xl border border-white/5">
                      <div className="flex items-center gap-4">
                        <div className={`p-3 rounded-xl ${editingStore.features?.hasOpenTabs ? 'bg-amber-500/20 text-amber-400' : 'bg-gray-800 text-gray-500'}`}>
                          <CreditCard size={24} />
                        </div>
                        <div>
                          <p className="font-bold text-white">Cuentas Abiertas (Fiado)</p>
                          <p className="text-xs text-gray-400">Permitir créditos y deudas de clientes</p>
                        </div>
                      </div>
                      <button 
                        onClick={() => handleUpdateFeatures(editingStore.id, editingStore.features || {}, 'hasOpenTabs', !(editingStore.features?.hasOpenTabs ?? true))}
                        className={`relative inline-flex h-8 w-14 items-center rounded-full transition-colors border ${
                          (editingStore.features?.hasOpenTabs ?? true) ? 'bg-emerald-500/20 border-emerald-500/40' : 'bg-red-500/20 border-red-500/40'
                        }`}
                      >
                        <span className={`inline-block h-6 w-6 transform rounded-full bg-white transition-transform ${
                          (editingStore.features?.hasOpenTabs ?? true) ? 'translate-x-7' : 'translate-x-1'
                        }`} />
                      </button>
                    </div>

                    {/* Pedidos Web */}
                    <div className="flex items-center justify-between p-4 bg-black/20 rounded-2xl border border-white/5">
                      <div className="flex items-center gap-4">
                        <div className={`p-3 rounded-xl ${editingStore.features?.hasOnlineStore ? 'bg-blue-500/20 text-blue-400' : 'bg-gray-800 text-gray-500'}`}>
                          <ShoppingBag size={24} />
                        </div>
                        <div>
                          <p className="font-bold text-white">Pedidos Web (Catálogo)</p>
                          <p className="text-xs text-gray-400">E-commerce y tienda online pública</p>
                        </div>
                      </div>
                      <button 
                        onClick={() => handleUpdateFeatures(editingStore.id, editingStore.features || {}, 'hasOnlineStore', !(editingStore.features?.hasOnlineStore ?? true))}
                        className={`relative inline-flex h-8 w-14 items-center rounded-full transition-colors border ${
                          (editingStore.features?.hasOnlineStore ?? true) ? 'bg-emerald-500/20 border-emerald-500/40' : 'bg-red-500/20 border-red-500/40'
                        }`}
                      >
                        <span className={`inline-block h-6 w-6 transform rounded-full bg-white transition-transform ${
                          (editingStore.features?.hasOnlineStore ?? true) ? 'translate-x-7' : 'translate-x-1'
                        }`} />
                      </button>
                    </div>

                  </div>
                </div>
              </div>

              {/* Columna Derecha: Plan Dinámico y Credenciales */}
              <div className="space-y-8">
                
                {/* Plan Dinámico Card */}
                <div className="bg-gradient-to-br from-indigo-900/40 to-blue-900/20 border border-blue-500/20 rounded-3xl p-8 relative overflow-hidden">
                  <div className="absolute -top-10 -right-10 w-40 h-40 bg-blue-500/30 blur-[60px] rounded-full" />
                  
                  <h3 className="text-sm font-black text-blue-300 uppercase tracking-widest mb-4">1. Plan Base</h3>
                  
                  <div className="flex flex-col gap-3 mb-6 relative z-10">

                    <button 
                      type="button"
                      onClick={() => setLocalPlan('premium')}
                      className={`p-4 rounded-2xl border text-left transition-all flex items-start gap-3 ${
                        (localPlan === 'premium') 
                          ? 'bg-blue-500/20 border-blue-500 text-blue-300 shadow-[0_0_15px_rgba(59,130,246,0.2)]' 
                          : 'bg-black/20 border-white/10 text-gray-400 hover:bg-white/5'
                      }`}
                    >
                      <div className={`mt-0.5 flex-shrink-0 w-5 h-5 rounded-full border-2 flex items-center justify-center transition-colors border-blue-400`}>
                        <div className="w-2.5 h-2.5 bg-blue-400 rounded-full animate-in zoom-in" />
                      </div>
                      <div>
                        <div className={`font-bold ${(localPlan === 'premium') ? 'text-white' : 'text-gray-400'}`}>CRM Base Multi-Dispositivo ($30.00/mes)</div>
                        <div className="text-xs mt-1 text-blue-200/60">Acceso para 2 PCs + 1 Teléfono, facturación manual</div>
                      </div>
                    </button>

                    <button 
                      onClick={handleUpdatePlan}
                      disabled={isApplyingPlan}
                      className="mt-2 w-full py-3 rounded-xl bg-blue-500 text-white font-black hover:bg-blue-600 transition-all shadow-[0_0_15px_rgba(59,130,246,0.3)] disabled:opacity-50"
                    >
                      {isApplyingPlan ? 'Confirmando...' : 'Confirmar Ticket Mensual'}
                    </button>
                  </div>

                  <h3 className="text-sm font-black text-blue-300 uppercase tracking-widest mb-2 mt-8">2. Ticket Final Mensual</h3>
                  
                  {(() => {
                    let basePrice = localPlan === 'premium' ? 30 : 15;
                    let extraCost = 0;
                    
                    if (editingStore.features?.hasWhatsApp) extraCost += 20;
                    if (editingStore.features?.hasAISales) extraCost += 5;
                    if (editingStore.features?.hasAIPurchases) extraCost += 5;
                    if (editingStore.features?.hasOpenTabs) extraCost += 20;
                    if (editingStore.features?.hasOnlineStore) extraCost += 40;

                    const total = basePrice + extraCost;
                    const glow = "shadow-[0_0_30px_rgba(59,130,246,0.2)]";

                    return (
                      <div className="mt-4 relative z-10">
                        <div className={`bg-black/40 border border-white/10 rounded-2xl p-6 ${glow} transition-all duration-500`}>
                          <h4 className="text-4xl font-black text-emerald-400 mb-1">${total.toFixed(2)}</h4>
                          <div className="mt-3 pt-3 border-t border-white/10">
                            <p className="text-gray-400 text-xs uppercase tracking-widest">Plan Base: <span className="font-bold text-white">${basePrice.toFixed(2)}</span></p>
                            <p className="text-gray-400 text-xs uppercase tracking-widest mt-1">Extras Activos: <span className="font-bold text-white">+ ${extraCost.toFixed(2)}</span></p>
                          </div>
                        </div>
                      </div>
                    );
                  })()}
                </div>


                <div className="bg-[#15192b] rounded-3xl p-8 border border-white/5 shadow-2xl">
                  <h3 className="text-sm font-black text-gray-500 uppercase tracking-widest mb-6">Restablecer Accesos Locales</h3>
                  <div className="space-y-4">
                    <input type="email" value={adminEmailEdit} onChange={e => setAdminEmailEdit(e.target.value)} className="w-full bg-black/40 border border-white/10 rounded-xl py-3 px-4 text-white focus:outline-none focus:border-blue-500" placeholder="Email" />
                    <input type="password" value={adminPinEdit} onChange={e => setAdminPinEdit(e.target.value)} className="w-full bg-black/40 border border-white/10 rounded-xl py-3 px-4 text-white focus:outline-none focus:border-blue-500" placeholder="PIN" />
                    <button onClick={handleUpdateCredentials} className="w-full py-4 rounded-xl bg-blue-500/10 text-blue-400 font-black hover:bg-blue-500 hover:text-white transition-all border border-blue-500/20">
                      Actualizar Accesos
                    </button>
                  </div>

                  <div className="pt-8 mt-8 border-t border-white/5">
                    <button onClick={() => handleDeleteStore(editingStore.id)} className="w-full py-4 rounded-2xl bg-red-500/10 text-red-500 font-black hover:bg-red-500 hover:text-white transition-all border border-red-500/20 flex justify-center items-center gap-2">
                      <Trash2 size={20} /> Destruir Tienda Permanentemente
                    </button>
                  </div>
                </div>

              </div>

            </div>
          </div>
        </div>
      )}

      {/* MODAL: Editar Admin Directo */}
      {editingAdmin && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-md flex items-center justify-center z-50 p-4">
          <div className="bg-[#15192b] rounded-[2rem] w-full max-w-md overflow-hidden border border-white/10 shadow-[0_0_50px_rgba(0,0,0,0.5)]">
            <div className="p-8 border-b border-white/5 bg-gradient-to-b from-blue-500/10 to-transparent">
              <h2 className="text-2xl font-black text-white">Editar Acceso</h2>
              <p className="text-gray-400 font-mono text-sm mt-1">{editingAdmin.id}</p>
            </div>
            
            <form onSubmit={handleUpdateDirectAdmin} className="p-8 space-y-6">
              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-black text-gray-500 uppercase tracking-widest mb-2">Email</label>
                  <input type="email" required value={adminEmailDirect} onChange={e => setAdminEmailDirect(e.target.value)} className="w-full bg-black/40 border border-white/10 rounded-xl py-3 px-4 text-white focus:outline-none focus:border-blue-500" placeholder="Email" />
                </div>
                <div>
                  <label className="block text-xs font-black text-gray-500 uppercase tracking-widest mb-2">PIN de Acceso</label>
                  <input type="password" required value={adminPinDirect} onChange={e => setAdminPinDirect(e.target.value)} className="w-full bg-black/40 border border-white/10 rounded-xl py-3 px-4 text-white focus:outline-none focus:border-blue-500" placeholder="PIN" />
                </div>
              </div>

              <div className="flex gap-4 pt-6 border-t border-white/5">
                <button type="button" onClick={() => setEditingAdmin(null)} className="flex-1 py-3 rounded-xl bg-white/5 text-white font-bold hover:bg-white/10 transition-colors">
                  Cancelar
                </button>
                <button type="submit" disabled={loading} className="flex-1 py-3 rounded-xl bg-blue-500 text-white font-black hover:bg-blue-600 transition-colors shadow-[0_0_20px_rgba(59,130,246,0.3)]">
                  {loading ? 'Guardando...' : 'Guardar'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}
