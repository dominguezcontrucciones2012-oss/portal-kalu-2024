import React, { useState, useEffect } from 'react';
import { Store, ArrowRight, Star, MapPin, Search } from 'lucide-react';
import { db } from '../../lib/firebase';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { Store as StoreModel } from '../../types';
import { useNavigate } from 'react-router-dom';

export default function DirectoryScreen() {
  const [stores, setStores] = useState<StoreModel[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const navigate = useNavigate();

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const directStore = params.get('store');
    if (directStore) {
      localStorage.setItem('activeStoreId', directStore);
      if (localStorage.getItem('kalu_pin_verified') === 'true') {
        // El usuario está en proceso de restaurar su sesión (o Firebase está lento)
        // Redirigir a /login permite que el App.tsx o AuthProvider capture la sesión correctamente
        // y lo enrute a su Dashboard o Portal de Cliente, evitando que "caiga en el catálogo"
        navigate('/login');
        return;
      }
      navigate(`/catalogo?store=${directStore}`);
      return;
    } else {
      localStorage.removeItem('activeStoreId');
    }

    const fetchStores = async () => {
      try {
        const q = query(collection(db, 'stores'), where('status', '==', 'active'));
        const snap = await getDocs(q);
        const data = snap.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        })) as StoreModel[];
        setStores(data);
      } catch (err) {
        console.error("Error fetching directory", err);
      } finally {
        setLoading(false);
      }
    };
    fetchStores();
  }, [navigate]);

  const handleEnterStore = (storeId: string) => {
    localStorage.setItem('activeStoreId', storeId);
    navigate(`/catalogo?store=${storeId}`);
  };

  const filteredStores = stores.filter(store =>
    store.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="min-h-screen bg-[#0f172a] text-white font-sans relative overflow-hidden flex flex-col">
      {/* Background Effects */}
      <div className="absolute top-[-20%] left-[-10%] w-[50%] h-[50%] rounded-full bg-[#3498db]/20 blur-[120px] pointer-events-none" />
      <div className="absolute bottom-[-20%] right-[-10%] w-[50%] h-[50%] rounded-full bg-[#2ecc71]/10 blur-[120px] pointer-events-none" />

      {/* Header Centrado */}
      <header className="relative z-10 pt-4 pb-2 px-6 flex flex-col items-center text-center">
        <div className="font-sans font-black tracking-tight leading-tight w-full max-w-[100vw] overflow-hidden">
          <h1 className="text-3xl md:text-5xl text-[#00f2fe]">
            Mercado San Juan &
          </h1>
          <div className="flex items-baseline justify-center gap-1.5 md:gap-3 mt-0.5 md:mt-1 flex-nowrap whitespace-nowrap">
            <span className="text-[26px] sm:text-3xl md:text-5xl text-[#00f2fe]">
              Nacional.
            </span>
            <span className="text-[9px] sm:text-[10px] md:text-xs text-[#fef08a] uppercase tracking-[0.1em] md:tracking-[0.2em]">
              RED DE TIENDAS & COMERCIOS
            </span>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="relative z-10 flex-1 px-4 md:px-12 max-w-7xl mx-auto w-full flex flex-col gap-6">

        {/* Barra de Búsqueda */}
        <div className="relative max-w-md mx-auto w-full z-20">
          <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
            <Search className="h-5 w-5 text-gray-400" />
          </div>
          <input
            type="text"
            className="block w-full pl-12 pr-4 py-3 sm:py-4 bg-white/5 border border-white/10 rounded-2xl text-white placeholder-gray-500 focus:ring-2 focus:ring-[#3498db] focus:border-transparent transition-all backdrop-blur-md outline-none text-sm font-medium shadow-xl"
            placeholder="🔍 Buscar bodega o comercio..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>

        {loading ? (
          <div className="flex flex-col items-center justify-center flex-1 space-y-4">
            <div className="w-12 h-12 border-4 border-white/10 border-t-[#3498db] rounded-full animate-spin" />
            <p className="text-gray-400 font-bold tracking-widest text-sm animate-pulse">CARGANDO TIENDAS...</p>
          </div>
        ) : filteredStores.length === 0 ? (
          <div className="flex flex-col items-center justify-center flex-1 bg-white/5 rounded-3xl border border-white/10 p-8 text-center backdrop-blur-sm">
            <Store size={48} className="text-gray-600 mb-4" />
            <h2 className="text-xl font-black text-white mb-2">No se encontraron tiendas</h2>
            <p className="text-gray-400 text-xs">Intenta con otro término de búsqueda.</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-6 pb-8">
            {[...filteredStores].sort((a, b) => {
              const aIsKalu = a.name.toLowerCase().includes('kalu');
              const bIsKalu = b.name.toLowerCase().includes('kalu');
              if (aIsKalu && !bIsKalu) return -1;
              if (!aIsKalu && bIsKalu) return 1;
              return 0;
            }).map(store => {
              const isKalu = store.name.toLowerCase().includes('kalu');
              return (
              <div
                key={store.id}
                onClick={() => handleEnterStore(store.id)}
                className={`group relative rounded-3xl p-4 sm:p-6 transition-all duration-300 cursor-pointer overflow-hidden flex flex-col justify-between min-h-[160px] sm:min-h-[220px] backdrop-blur-md shadow-lg border-2 border-amber-400/80 shadow-amber-500/20 hover:shadow-amber-400/40 bg-gradient-to-br from-[#1e1b04] to-black ${
                  isKalu ? "col-span-2" : "col-span-1"
                }`}
              >
                {/* Glow effect on hover */}
                <div className="absolute inset-0 bg-gradient-to-br from-amber-500/0 via-transparent to-amber-500/0 group-hover:from-amber-500/10 group-hover:to-transparent transition-all duration-500" />
                
                {isKalu ? (
                  <>
                    <div className="absolute top-4 right-4 bg-gradient-to-r from-amber-500 to-amber-300 text-black text-[10px] font-black px-3 py-1 rounded-full shadow-lg z-20 animate-pulse">
                      ★ OFICIAL
                    </div>

                    <div className="relative z-10 flex flex-col items-center text-center">
                      <div className="w-12 h-12 sm:w-16 sm:h-16 rounded-full flex items-center justify-center mb-3 border border-white/10 group-hover:scale-110 group-hover:rotate-3 transition-transform duration-300 overflow-hidden shrink-0 bg-white p-0.5 shadow-md">
                        <img src="/tienda.kalu.jpg?v=4" alt="Kalu Queso" className="max-w-full max-h-full rounded-full object-contain" />
                      </div>
                      <h3 className="text-base sm:text-xl font-black mb-1 tracking-tight line-clamp-2 leading-tight text-amber-400">
                        {store.name}
                      </h3>
                      <div className="flex items-center justify-center gap-1 text-gray-400 text-[10px] sm:text-xs font-bold">
                        <MapPin size={12} className="text-amber-400" />
                        <span>Disponible Online</span>
                      </div>
                    </div>
                  </>
                ) : (
                  <>
                    <div className="absolute top-4 right-3 sm:right-4 bg-gradient-to-r from-amber-500 to-amber-300 text-black text-[8px] sm:text-[9px] font-black px-2 py-0.5 rounded-full shadow-lg z-20">
                      ★ OFICIAL
                    </div>
                    
                    <div className="absolute top-3 sm:top-4 left-3 sm:left-4 w-9 h-9 sm:w-10 sm:h-10 rounded-full flex items-center justify-center border border-white/10 group-hover:scale-110 transition-transform duration-300 overflow-hidden shrink-0 bg-white shadow-md">
                      <Store className="text-amber-700" size={18} />
                    </div>

                    <div className="relative z-10 flex flex-col items-start text-left pt-12 sm:pt-14">
                      <h3 className="text-sm sm:text-base font-black mb-1 tracking-tight line-clamp-2 leading-tight text-amber-400">
                        {store.name}
                      </h3>
                      <div className="flex items-center justify-start gap-1 text-gray-400 text-[9px] sm:text-[10px] font-bold">
                        <MapPin size={10} className="text-amber-400" />
                        <span>Online</span>
                      </div>
                    </div>
                  </>
                )}

                <div className="relative z-10 flex flex-col sm:flex-row items-center justify-between mt-3 sm:mt-5 pt-3 sm:pt-4 border-t border-white/10 gap-2">
                  <div className="flex items-center justify-center gap-0.5 text-[#2ecc71]">
                    <Star size={12} fill="currentColor" />
                    <Star size={12} fill="currentColor" />
                    <Star size={12} fill="currentColor" />
                    <Star size={12} fill="currentColor" />
                    <Star size={12} fill="currentColor" />
                  </div>
                  <div className="w-8 h-8 rounded-full flex items-center justify-center transition-colors duration-300 mx-auto sm:mx-0 bg-amber-500/20 group-hover:bg-amber-500">
                    <ArrowRight size={14} className="text-white transform group-hover:translate-x-0.5 transition-transform" />
                  </div>
                </div>
              </div>
            )})}
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="relative z-10 text-center py-6 text-gray-500 text-[10px] font-bold tracking-widest border-t border-white/5 bg-black/20">
        POWERED BY KALU PRO © {new Date().getFullYear()}
      </footer>
    </div>
  );
}
