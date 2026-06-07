import React, { useState } from 'react';
import { 
  Truck, 
  Search, 
  Plus, 
  Phone, 
  Mail, 
  MapPin, 
  ExternalLink,
  ChevronRight,
  Package
} from 'lucide-react';
import { cn } from '../../lib/utils';

import { subscribeToCollection } from '../../lib/dbUtils';
import { type Provider } from '../../types';
import ProviderModal from './ProviderModal';
import { AnimatePresence } from 'motion/react';

const ProvidersScreen: React.FC = () => {
  const [search, setSearch] = useState('');
  const [providers, setProviders] = useState<Provider[]>([]);
  const [showModal, setShowModal] = useState(false);

  React.useEffect(() => {
    return subscribeToCollection('providers', (data) => {
      setProviders(data as Provider[]);
    });
  }, []);
  
  const filtered = providers.filter(p => 
    p.nombre.toLowerCase().includes(search.toLowerCase()) || 
    (p.categoria || '').toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-8 animate-in fade-in duration-700">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div>
          <h1 className="text-3xl font-black text-white flex items-center gap-3">
            <Truck className="text-[#3498db]" /> DIRECTORIO DE PROVEEDORES
          </h1>
          <p className="text-gray-400 text-sm">Gestiona tus aliados y contactos de suministro</p>
        </div>
        <button onClick={() => setShowModal(true)} className="bg-[#3498db] hover:bg-[#2980b9] text-white font-black py-3 px-8 rounded-2xl shadow-xl shadow-blue-500/10 transition-all flex items-center gap-2 text-sm uppercase tracking-widest active:scale-95">
          <Plus size={18} /> NUEVO PROVEEDOR
        </button>
      </div>

      <div className="bg-white/5 border border-white/10 p-2 rounded-3xl">
        <div className="relative">
          <Search className="absolute left-6 top-1/2 -translate-y-1/2 text-gray-500" size={20} />
          <input 
            type="text" 
            placeholder="Buscar por nombre o categoría..."
            className="w-full bg-transparent py-5 pl-16 pr-6 focus:outline-none text-lg font-bold"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filtered.map(p => (
          <div key={p.id} className="group bg-white/5 border border-white/10 rounded-[2.5rem] p-8 hover:bg-white/10 transition-all cursor-pointer relative overflow-hidden">
            <div className="flex justify-between items-start mb-6">
              <div className="w-16 h-16 rounded-3xl bg-blue-500/10 flex items-center justify-center text-blue-400 group-hover:bg-blue-500 group-hover:text-white transition-all">
                <Truck size={32} />
              </div>
              <span className="bg-white/5 border border-white/10 px-4 py-1 rounded-full text-[10px] font-black uppercase tracking-widest text-gray-400">
                {p.categoria}
              </span>
            </div>

            <div className="space-y-4">
              <div>
                <h3 className="text-xl font-black text-white group-hover:text-[#3498db] transition-colors">{p.nombre}</h3>
                <p className="text-sm font-bold text-gray-500 flex items-center gap-2 mt-1">
                  <span className="w-2 h-2 rounded-full bg-green-500"></span> Contacto: {p.contacto}
                </p>
              </div>

              <div className="space-y-2 pt-2">
                <div className="flex items-center gap-3 text-gray-300 font-bold text-xs">
                  <Phone size={14} className="text-gray-600" /> {p.telefono}
                </div>
                <div className="flex items-center gap-3 text-gray-300 font-bold text-xs">
                  <Mail size={14} className="text-gray-600" /> {p.email}
                </div>
              </div>

              <div className="pt-6 border-t border-white/5 flex gap-2">
                <button onClick={(e) => { e.stopPropagation(); alert("Sistema de pedidos a proveedores en desarrollo."); }} className="flex-1 bg-white/5 hover:bg-white/10 py-3 rounded-xl border border-white/5 text-[10px] font-black uppercase tracking-widest transition-all">
                  Ver Pedidos
                </button>
                <button onClick={(e) => { e.stopPropagation(); window.open(`tel:${p.telefono}`); }} className="flex-1 bg-white/5 hover:bg-white/10 py-3 rounded-xl border border-white/5 text-[10px] font-black uppercase tracking-widest transition-all">
                  Contactar
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>

      <AnimatePresence>
        {showModal && <ProviderModal onClose={() => setShowModal(false)} />}
      </AnimatePresence>
    </div>
  );
};

export default ProvidersScreen;
