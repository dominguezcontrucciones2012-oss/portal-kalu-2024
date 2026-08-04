import React, { useState, useEffect } from 'react';
import { 
  Store, 
  Plus, 
  Power,
  Settings,
  ShieldCheck,
  Search,
  ExternalLink,
  MoreVertical,
  Copy,
  Eye,
  Trash2
} from 'lucide-react';
import { db } from '../../lib/firebase';
import { collection, query, getDocs, doc, setDoc, deleteDoc, getDoc, where } from 'firebase/firestore';
import { initializeApp, deleteApp } from 'firebase/app';
import { getAuth, createUserWithEmailAndPassword } from 'firebase/auth';
import firebaseConfig from '../../../firebase-applet-config.json';
import { Store as StoreModel } from '../../types';
import { useNavigate } from 'react-router-dom';

export default function SuperAdminScreen() {
  const navigate = useNavigate();
  const [stores, setStores] = useState<StoreModel[]>([]);
  const [admins, setAdmins] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingStore, setEditingStore] = useState<StoreModel | null>(null);
  const [adminEmailEdit, setAdminEmailEdit] = useState('');
  const [adminPinEdit, setAdminPinEdit] = useState('');
  const [newStore, setNewStore] = useState<Partial<StoreModel> & { adminEmail?: string; adminPassword?: string }>({
    id: '',
    name: '',
    status: 'active',
    ownerUid: '',
    plan: 'free',
    adminEmail: '',
    adminPassword: ''
  });

  useEffect(() => {
    fetchStores();
    fetchAdmins();
  }, []);

  const fetchAdmins = async () => {
    try {
      const q = query(collection(db, 'administradores'));
      const snapshot = await getDocs(q);
      const data = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      setAdmins(data);
    } catch (error) {
      console.error('Error fetching admins:', error);
    }
  };

  const fetchStores = async () => {
    try {
      setLoading(true);
      const q = query(collection(db, 'stores'));
      const snapshot = await getDocs(q);
      const data = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as StoreModel[];
      
      // Fallback si no hay tiendas creadas (para demostración inicial)
      if (data.length === 0) {
        setStores([
          {
            id: 'kalu-queso-sanjuan',
            name: 'Kalu Queso San Juan',
            status: 'active',
            ownerUid: 'admin-123',
            plan: 'premium',
            createdAt: new Date().toISOString()
          }
        ]);
      } else {
        setStores(data);
      }
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
          // El usuario ya existe en Auth. Vamos a reutilizar el correo creando/sobrescribiendo su perfil en Firestore.
          const q = query(collection(db, 'users'), where('email', '==', newStore.adminEmail.toLowerCase()));
          const snap = await getDocs(q);
          if (!snap.empty) {
            newUserId = snap.docs[0].id; // Reutilizamos su ID existente en Firestore
          } else {
            newUserId = 'reused_' + Date.now(); // Generamos un ID local para forzar el flujo biométrico/local
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

      // Guardar también en la colección explícita de administradores
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
        createdAt: new Date().toISOString()
      };

      await setDoc(doc(db, 'stores', storeData.id), storeData);
      setStores([...stores, storeData]);
      setIsModalOpen(false);
      setNewStore({ id: '', name: '', status: 'active', ownerUid: '', plan: 'free', adminEmail: '', adminPassword: '' });
      alert('Tienda y administrador creados con éxito. (Si el correo ya existía, sus accesos fueron reasignados).');
    } catch (error: any) {
      console.error('Error creating store:', error);
      let errorMsg = 'Error desconocido al crear la tienda.';
      if (error.code === 'auth/weak-password') {
        errorMsg = 'La contraseña debe tener al menos 6 caracteres.';
      } else if (error.code === 'auth/invalid-email') {
        errorMsg = 'El formato del correo es inválido.';
      } else {
        errorMsg = error.message;
      }
      alert('Error creando la tienda: ' + errorMsg);
    }
  };

  const handleSwitchContext = async (storeId: string) => {
    localStorage.setItem('activeStoreId', storeId);
    localStorage.setItem('kalu_pin_verified', 'true');
    alert(`Contexto cambiado a la tienda: ${storeId}.`);
    window.location.href = `/?store=${storeId}`;
  };

  const handleEditClick = async (store: StoreModel) => {
    setEditingStore(store);
    try {
      const userDoc = await getDoc(doc(db, 'users', store.ownerUid));
      if (userDoc.exists()) {
        const userData = userDoc.data();
        setAdminEmailEdit(userData.email || '');
        setAdminPinEdit(userData.pin || '');
      } else {
        setAdminEmailEdit('');
        setAdminPinEdit('');
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
      const userDoc = await getDoc(userRef);
      if (userDoc.exists()) {
        await setDoc(userRef, { email: adminEmailEdit.toLowerCase(), pin: adminPinEdit, storeId: editingStore.id }, { merge: true });
        await setDoc(adminRef, { email: adminEmailEdit.toLowerCase(), pin: adminPinEdit, storeId: editingStore.id, role: 'admin' }, { merge: true });
        alert('Credenciales actualizadas en la base de datos (Firestore).');
        fetchAdmins();
      } else {
        const secondaryApp = initializeApp(firebaseConfig, 'SecondaryApp' + Date.now());
        const secondaryAuth = getAuth(secondaryApp);
        
        await createUserWithEmailAndPassword(secondaryAuth, adminEmailEdit, adminPinEdit);
        await deleteApp(secondaryApp);

        await setDoc(userRef, {
          username: `Admin ${editingStore.name}`,
          nombre: `Admin ${editingStore.name}`,
          role: 'admin',
          email: adminEmailEdit.toLowerCase(),
          pin: adminPinEdit,
          storeId: editingStore.id,
          createdAt: new Date().toISOString()
        });
        await setDoc(adminRef, {
          email: adminEmailEdit.toLowerCase(),
          pin: adminPinEdit,
          storeId: editingStore.id,
          role: 'admin',
          createdAt: new Date().toISOString()
        });
        fetchAdmins();
        alert('Usuario administrador creado con éxito.');
      }
    } catch (error: any) {
      alert('Error actualizando credenciales: ' + error.message);
    }
  };

  const handleDeleteStore = async (storeId: string) => {
    if (window.confirm('¿ESTÁS SEGURO? Esta acción ELIMINARÁ DEFINITIVAMENTE la tienda y todos los usuarios asociados a ella. No se puede deshacer.')) {
      try {
        setLoading(true);
        await deleteDoc(doc(db, 'stores', storeId));
        
        const q = query(collection(db, 'users'), where('storeId', '==', storeId));
        const usersSnap = await getDocs(q);
        
        const deletePromises = usersSnap.docs.map(userDoc => deleteDoc(doc(db, 'users', userDoc.id)));
        await Promise.all(deletePromises);
        
        // También limpiar administradores
        const adminQ = query(collection(db, 'administradores'), where('storeId', '==', storeId));
        const adminSnap = await getDocs(adminQ);
        const adminDeletePromises = adminSnap.docs.map(adminDoc => deleteDoc(doc(db, 'administradores', adminDoc.id)));
        await Promise.all(adminDeletePromises);
        fetchAdmins();
        
        setStores(stores.filter(s => s.id !== storeId));
        alert('Tienda eliminada definitivamente.');
      } catch (error: any) {
        console.error('Error deleting store:', error);
        alert('Error al eliminar la tienda: ' + error.message);
      } finally {
        setLoading(false);
      }
    }
  };

  const handleCopyUrl = (storeId: string) => {
    const url = `https://kalu-queso-sanjuam.web.app/?store=${storeId}`;
    navigator.clipboard.writeText(url);
    alert('URL copiada al portapapeles:\n' + url);
  };

  const handleUpdateFeatures = async (key: string, value: boolean) => {
    if (!editingStore) return;
    try {
      const updatedFeatures = {
        ...(editingStore.features || {
          hasOnlineStore: true,
          hasAI: true,
          hasWhatsApp: true,
          hasVIPCredit: true,
          hasPOS: true,
          hasOpenTabs: true
        }),
        [key]: value
      };
      
      const storeRef = doc(db, 'stores', editingStore.id);
      await setDoc(storeRef, { features: updatedFeatures }, { merge: true });
      
      const updatedStore = { ...editingStore, features: updatedFeatures };
      setEditingStore(updatedStore);
      setStores(stores.map(s => s.id === updatedStore.id ? updatedStore : s));
    } catch (error) {
      console.error('Error updating features:', error);
      alert('Error al guardar configuración');
    }
  };

  const filteredStores = stores.filter(store => 
    store.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
    store.id.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-black text-white flex items-center gap-3">
            <ShieldCheck className="text-[#3498db]" size={32} />
            Consola SuperAdmin
          </h1>
          <p className="text-gray-400 font-medium mt-1 text-sm">
            Gestión global de tiendas (Multi-Tenant)
          </p>
        </div>
        <button 
          onClick={() => setIsModalOpen(true)}
          className="bg-[#3498db] hover:bg-[#2980b9] text-white px-6 py-3 rounded-xl font-bold transition-all shadow-lg shadow-[#3498db]/20 flex items-center gap-2 active:scale-95"
        >
          <Plus size={20} />
          Crear Tienda
        </button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {[
          { title: 'Tiendas Activas', value: stores.length, icon: Store, color: 'text-green-400', bg: 'bg-green-500/10' },
          { title: 'Costo Infraestructura', value: '$0.00', icon: Power, color: 'text-blue-400', bg: 'bg-blue-500/10' },
          { title: 'Total Usuarios', value: '---', icon: Settings, color: 'text-purple-400', bg: 'bg-purple-500/10' }
        ].map((stat, i) => (
          <div key={i} className="bg-[#1e293b] border border-white/5 p-5 rounded-2xl flex items-center gap-4 relative overflow-hidden group">
            <div className={`p-4 rounded-2xl ${stat.bg} ${stat.color} transition-transform group-hover:scale-110`}>
              <stat.icon size={24} />
            </div>
            <div>
              <p className="text-gray-400 text-xs font-bold uppercase tracking-wider">{stat.title}</p>
              <p className="text-2xl font-black text-white mt-1">{stat.value}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Main Content Area */}
      <div className="bg-[#1e293b] border border-white/5 rounded-3xl overflow-hidden flex flex-col min-h-[500px]">
        {/* Toolbar */}
        <div className="p-4 border-b border-white/5 flex gap-4">
          <div className="relative flex-1">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={20} />
            <input 
              type="text" 
              placeholder="Buscar por ID o nombre de tienda..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full bg-black/20 border border-white/10 rounded-xl py-3 pl-12 pr-4 text-white focus:outline-none focus:border-[#3498db] transition-colors"
            />
          </div>
        </div>

        {/* Table */}
        <div className="overflow-x-auto flex-1">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-white/5 bg-black/20">
                <th className="p-4 text-xs font-black text-gray-500 uppercase tracking-widest w-1/3">Tienda</th>
                <th className="p-4 text-xs font-black text-gray-500 uppercase tracking-widest w-1/6">ID</th>
                <th className="p-4 text-xs font-black text-gray-500 uppercase tracking-widest w-1/6">Estado</th>
                <th className="p-4 text-xs font-black text-gray-500 uppercase tracking-widest w-1/6">Plan</th>
                <th className="p-4 text-xs font-black text-gray-500 uppercase tracking-widest w-1/6 text-right">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={5} className="p-8 text-center text-gray-400">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#3498db] mx-auto"></div>
                  </td>
                </tr>
              ) : filteredStores.length === 0 ? (
                <tr>
                  <td colSpan={5} className="p-8 text-center text-gray-500 font-medium">
                    No se encontraron tiendas
                  </td>
                </tr>
              ) : (
                filteredStores.map(store => (
                  <tr key={store.id} className="border-b border-white/5 hover:bg-white/[0.02] transition-colors group">
                    <td className="p-4">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#3498db]/20 to-[#2ecc71]/20 border border-white/10 flex items-center justify-center text-white">
                          <Store size={18} />
                        </div>
                        <div>
                          <div className="font-bold text-white text-sm">{store.name}</div>
                          <div className="text-xs text-gray-500 font-mono mt-0.5">Owner: {store.ownerUid}</div>
                        </div>
                      </div>
                    </td>
                    <td className="p-4 text-sm font-mono text-gray-400">{store.id}</td>
                    <td className="p-4">
                      <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-wider border ${
                        store.status === 'active' 
                          ? 'bg-green-500/10 text-green-400 border-green-500/20'
                          : 'bg-red-500/10 text-red-400 border-red-500/20'
                      }`}>
                        <div className={`w-1.5 h-1.5 rounded-full ${store.status === 'active' ? 'bg-green-400' : 'bg-red-400'}`} />
                        {store.status}
                      </span>
                    </td>
                    <td className="p-4">
                      <span className="text-xs font-bold text-[#3498db] bg-[#3498db]/10 px-2.5 py-1 rounded-lg uppercase tracking-wider">
                        {store.plan}
                      </span>
                    </td>
                    <td className="p-4 text-right">
                      <div className="flex justify-end gap-2">
                        <button 
                          onClick={() => handleCopyUrl(store.slug || store.id)}
                          title="Copiar URL Pública"
                          className="p-2 rounded-lg text-gray-400 hover:text-white hover:bg-white/10 transition-colors opacity-0 group-hover:opacity-100"
                        >
                          <Copy size={18} />
                        </button>
                        <button 
                          onClick={() => window.open(`/?store=${store.id}`, '_blank')}
                          title="Abrir Vista Previa"
                          className="p-2 rounded-lg text-gray-400 hover:text-white hover:bg-white/10 transition-colors opacity-0 group-hover:opacity-100"
                        >
                          <Eye size={18} />
                        </button>
                        <button 
                          onClick={() => handleSwitchContext(store.id)}
                          title="Entrar a esta tienda"
                          className="p-2 rounded-lg bg-[#3498db]/10 text-[#3498db] hover:bg-[#3498db] hover:text-white transition-all opacity-0 group-hover:opacity-100"
                        >
                          <ExternalLink size={18} />
                        </button>
                        <button 
                          onClick={() => handleEditClick(store)}
                          title="Configuración de Funciones"
                          className="p-2 rounded-lg text-gray-400 hover:text-white hover:bg-white/10 transition-colors opacity-0 group-hover:opacity-100"
                        >
                          <Settings size={18} />
                        </button>
                        <button 
                          onClick={() => handleDeleteStore(store.id)}
                          title="Eliminar Tienda Definitivamente"
                          className="p-2 rounded-lg text-gray-400 hover:text-red-500 hover:bg-red-500/10 transition-colors opacity-0 group-hover:opacity-100"
                        >
                          <Trash2 size={18} />
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

      {/* Tabla de Registro de Administradores */}
      <div className="bg-[#1e293b] border border-white/5 rounded-3xl overflow-hidden flex flex-col mt-8">
        <div className="p-6 border-b border-white/5 flex gap-4">
          <h2 className="text-xl font-black text-white flex items-center gap-2">
            <ShieldCheck className="text-[#2ecc71]" size={24} />
            Tabla de Registro de Administradores de Tienda
          </h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-white/5 bg-black/20">
                <th className="p-4 text-xs font-black text-gray-500 uppercase tracking-widest w-1/4">Correo / Email</th>
                <th className="p-4 text-xs font-black text-gray-500 uppercase tracking-widest w-1/4">PIN</th>
                <th className="p-4 text-xs font-black text-gray-500 uppercase tracking-widest w-1/4">Tienda (Store ID)</th>
                <th className="p-4 text-xs font-black text-gray-500 uppercase tracking-widest w-1/4">Rol</th>
              </tr>
            </thead>
            <tbody>
              {admins.length === 0 ? (
                <tr>
                  <td colSpan={4} className="p-8 text-center text-gray-500 font-medium">
                    No hay administradores registrados
                  </td>
                </tr>
              ) : (
                admins.map(admin => (
                  <tr key={admin.id} className="border-b border-white/5 hover:bg-white/[0.02] transition-colors">
                    <td className="p-4 text-sm font-bold text-white">{admin.email}</td>
                    <td className="p-4 text-sm font-mono text-[#3498db] tracking-widest">{admin.pin}</td>
                    <td className="p-4 text-sm text-gray-400">{admin.storeId}</td>
                    <td className="p-4">
                      <span className="text-xs font-bold text-[#2ecc71] bg-[#2ecc71]/10 px-2.5 py-1 rounded-lg uppercase tracking-wider">
                        {admin.role}
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal Crear Tienda */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-[#1e293b] rounded-3xl w-full max-w-md overflow-hidden border border-white/10 shadow-2xl">
            <div className="p-6 border-b border-white/10 bg-white/5">
              <h2 className="text-xl font-black text-white">Registrar Nueva Tienda</h2>
              <p className="text-gray-400 text-sm mt-1">Ingresa los datos del nuevo negocio</p>
            </div>
            
            <form onSubmit={handleCreateStore} className="p-6 space-y-5">
              <div>
                <label className="block text-xs font-black text-gray-400 uppercase tracking-widest mb-2">
                  ID de la Tienda (Único)
                </label>
                <input 
                  type="text" 
                  required
                  value={newStore.id}
                  onChange={e => setNewStore({ ...newStore, id: e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '') })}
                  className="w-full bg-black/20 border border-white/10 rounded-xl py-3 px-4 text-white focus:outline-none focus:border-[#3498db] font-mono text-sm"
                  placeholder="ej. kalu-queso-sanjuan"
                />
              </div>

              <div>
                <label className="block text-xs font-black text-gray-400 uppercase tracking-widest mb-2">
                  Nombre Comercial
                </label>
                <input 
                  type="text" 
                  required
                  value={newStore.name}
                  onChange={e => setNewStore({ ...newStore, name: e.target.value })}
                  className="w-full bg-black/20 border border-white/10 rounded-xl py-3 px-4 text-white focus:outline-none focus:border-[#3498db]"
                  placeholder="Ej. Kalu Queso San Juan"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-black text-gray-400 uppercase tracking-widest mb-2">
                    Correo del Administrador
                  </label>
                  <input 
                    type="email" 
                    required
                    value={newStore.adminEmail || ''}
                    onChange={e => setNewStore({ ...newStore, adminEmail: e.target.value })}
                    className="w-full bg-black/20 border border-white/10 rounded-xl py-3 px-4 text-white focus:outline-none focus:border-[#3498db]"
                    placeholder="admin@tienda.com"
                  />
                </div>
                <div>
                  <label className="block text-xs font-black text-gray-400 uppercase tracking-widest mb-2">
                    Contraseña Inicial
                  </label>
                  <input 
                    type="password" 
                    required
                    value={newStore.adminPassword || ''}
                    onChange={e => setNewStore({ ...newStore, adminPassword: e.target.value })}
                    className="w-full bg-black/20 border border-white/10 rounded-xl py-3 px-4 text-white focus:outline-none focus:border-[#3498db]"
                    placeholder="Contraseña / PIN"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-black text-gray-400 uppercase tracking-widest mb-2">
                    Plan
                  </label>
                  <select 
                    value={newStore.plan}
                    onChange={e => setNewStore({ ...newStore, plan: e.target.value as 'free'|'premium' })}
                    className="w-full bg-black/20 border border-white/10 rounded-xl py-3 px-4 text-white focus:outline-none focus:border-[#3498db]"
                  >
                    <option value="free">Gratis (Spark)</option>
                    <option value="premium">Premium</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-black text-gray-400 uppercase tracking-widest mb-2">
                    Estado
                  </label>
                  <select 
                    value={newStore.status}
                    onChange={e => setNewStore({ ...newStore, status: e.target.value as 'active'|'suspended'|'pending' })}
                    className="w-full bg-black/20 border border-white/10 rounded-xl py-3 px-4 text-white focus:outline-none focus:border-[#3498db]"
                  >
                    <option value="active">Activo</option>
                    <option value="pending">Pendiente</option>
                    <option value="suspended">Suspendido</option>
                  </select>
                </div>
              </div>

              <div className="pt-4 flex gap-3">
                <button 
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="flex-1 px-4 py-3 rounded-xl border border-white/10 text-white font-bold hover:bg-white/5 transition-colors"
                >
                  Cancelar
                </button>
                <button 
                  type="submit"
                  className="flex-1 px-4 py-3 rounded-xl bg-[#3498db] text-white font-bold hover:bg-[#2980b9] transition-colors"
                >
                  Crear Tienda
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      {/* Modal Editar Tienda (Features) */}
      {editingStore && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-[#1e293b] rounded-3xl w-full max-w-md overflow-hidden border border-white/10 shadow-2xl max-h-[90vh] overflow-y-auto custom-scrollbar">
            <div className="p-6 border-b border-white/10 bg-white/5 flex justify-between items-center">
              <div>
                <h2 className="text-xl font-black text-white">Configuración</h2>
                <p className="text-[#3498db] font-bold text-sm mt-1">{editingStore.name}</p>
              </div>
            </div>
            
            <div className="p-6 space-y-4">
              <h3 className="text-sm font-black text-white uppercase tracking-widest mb-3 border-b border-white/10 pb-2">Credenciales de Acceso</h3>
              <div className="space-y-3 mb-6">
                <div>
                  <label className="block text-xs font-black text-gray-400 uppercase tracking-widest mb-1">Correo del Administrador</label>
                  <input 
                    type="email" 
                    value={adminEmailEdit}
                    onChange={e => setAdminEmailEdit(e.target.value)}
                    className="w-full bg-black/20 border border-white/10 rounded-xl py-2 px-3 text-white focus:outline-none focus:border-[#3498db]"
                  />
                </div>
                <div>
                  <label className="block text-xs font-black text-gray-400 uppercase tracking-widest mb-1">Contraseña / PIN</label>
                  <input 
                    type="password" 
                    value={adminPinEdit}
                    onChange={e => setAdminPinEdit(e.target.value)}
                    className="w-full bg-black/20 border border-white/10 rounded-xl py-2 px-3 text-white focus:outline-none focus:border-[#3498db]"
                  />
                </div>
                <button 
                  onClick={handleUpdateCredentials}
                  className="w-full px-4 py-2 mt-2 rounded-xl bg-[#2ecc71]/20 text-[#2ecc71] font-bold hover:bg-[#2ecc71] hover:text-white transition-colors"
                >
                  Actualizar Credenciales
                </button>
              </div>

              <h3 className="text-sm font-black text-white uppercase tracking-widest mb-3 border-b border-white/10 pb-2">Módulos Activos</h3>
              {[
                { id: 'hasOnlineStore', label: 'Catálogo Público (Web)' },
                { id: 'hasAI', label: 'Asistente IA (Day)' },
                { id: 'hasWhatsApp', label: 'Notificaciones WhatsApp' },
                { id: 'hasVIPCredit', label: 'Módulo de Fiado/Crédito VIP' },
                { id: 'hasPOS', label: 'Punto de Venta (POS)' },
                { id: 'hasOpenTabs', label: 'Cuentas Abiertas por Cliente' }
              ].map(feat => {
                const isEnabled = editingStore.features ? editingStore.features[feat.id as keyof typeof editingStore.features] : true;
                return (
                  <div key={feat.id} className="flex items-center justify-between bg-black/20 p-4 rounded-xl border border-white/5">
                    <span className="text-white font-bold text-sm">{feat.label}</span>
                    <button 
                      onClick={() => handleUpdateFeatures(feat.id, !isEnabled)}
                      className={`w-12 h-6 rounded-full transition-colors relative ${isEnabled ? 'bg-[#2ecc71]' : 'bg-gray-600'}`}
                    >
                      <div className={`w-4 h-4 bg-white rounded-full absolute top-1 transition-all ${isEnabled ? 'left-7' : 'left-1'}`} />
                    </button>
                  </div>
                );
              })}

              <div className="pt-4">
                <button 
                  onClick={() => setEditingStore(null)}
                  className="w-full px-4 py-3 rounded-xl bg-[#3498db] text-white font-bold hover:bg-[#2980b9] transition-colors"
                >
                  Cerrar
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
