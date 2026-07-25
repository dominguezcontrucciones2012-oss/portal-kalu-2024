import React, { useState, useEffect } from 'react';
import { 
  BookOpen, 
  Search, 
  Plus, 
  Trophy, 
  History, 
  ChevronRight,
  TrendingUp,
  User,
  DollarSign,
  Package,
  X,
  CheckCircle2,
  Calendar
} from 'lucide-react';
import { cn, formatCurrency } from '../../lib/utils';
import { subscribeToCollection, addProductorMovement, getLatestTasa } from '../../lib/dbUtils';
import { type Productor, type MovementProductor, Role } from '../../types';
import { motion, AnimatePresence } from 'motion/react';

const LedgerScreen: React.FC = () => {
  const [productores, setProductores] = useState<Productor[]>([]);
  const [search, setSearch] = useState('');
  const [selectedProductor, setSelectedProductor] = useState<Productor | null>(null);
  const [showAddModal, setShowAddModal] = useState(false);
  const [tasa, setTasa] = useState(40.50);
  
  const [formData, setFormData] = useState({
    tipo: 'ENTREGA_QUESO',
    kilos: 0,
    monto_usd: 0,
    descripcion: ''
  });

  useEffect(() => {
    const unsub = subscribeToCollection('clients', (data) => {
      // Filtrar por los que tienen rol PRODUCTOR
      setProductores(data.filter(c => c.role === Role.PRODUCTOR));
    });
    
    const fetchTasa = async () => {
      const rate = await getLatestTasa();
      setTasa(rate);
    };
    fetchTasa();

    return () => unsub();
  }, []);

  const filtered = productores.filter(p => 
    p.nombre.toLowerCase().includes(search.toLowerCase()) || 
    p.rif.includes(search)
  );

  const handleAddMovement = async () => {
    if (!selectedProductor) return;
    
    const now = new Date();
    const newMov: Omit<MovementProductor, 'id'> = {
      fecha: now.toISOString(),
      proveedor_id: selectedProductor.id,
      tipo: formData.tipo as any,
      descripcion: formData.descripcion,
      kilos: formData.kilos,
      monto_usd: formData.monto_usd,
      debe: formData.tipo === 'PAGO' || formData.tipo === 'ANTICIPO' ? formData.monto_usd : 0,
      haber: formData.tipo === 'ENTREGA_QUESO' ? formData.monto_usd : 0,
      saldo_momento: selectedProductor.saldo_pendiente_usd + (formData.tipo === 'ENTREGA_QUESO' ? formData.monto_usd : -formData.monto_usd),
      anio: now.getFullYear(),
      semana_del_anio: Math.ceil((now.getDate() + 6 - now.getDay()) / 7) // Simple approximation
    };

    await addProductorMovement(newMov);
    // En un app real, actualizaríamos también el saldo del productor en 'clients'
    setShowAddModal(false);
    setFormData({ tipo: 'ENTREGA_QUESO', kilos: 0, monto_usd: 0, descripcion: '' });
    alert("Movimiento registrado con éxito.");
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-700 pb-20">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div>
          <h1 className="text-3xl font-black text-white flex items-center gap-3">
            <BookOpen className="text-[#3498db]" /> LIBRETA DE PRODUCTORES
          </h1>
          <p className="text-gray-400 text-sm">Control de recepciones de queso y pagos según modelo oficial</p>
        </div>
        <button className="bg-[#f1c40f] hover:bg-[#d4ac0d] text-black font-black py-3 px-8 rounded-2xl shadow-xl shadow-yellow-500/10 transition-all flex items-center gap-2 text-sm uppercase tracking-widest active:scale-95">
          <Trophy size={18} /> RANKING ANUAL
        </button>
      </div>

      {/* Global Stats Summary (Simulado) */}
      <div className="bg-white/5 border border-white/10 rounded-[2.5rem] p-8 backdrop-blur-sm">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-8 text-center divide-x divide-white/5">
          <div className="space-y-1">
            <div className="text-[10px] font-black text-gray-500 uppercase tracking-widest leading-none">Queso Semana</div>
            <div className="text-3xl font-black text-blue-400">
              {productores.reduce((acc, p) => acc + (p.kilos_semana || 0), 0).toFixed(1)} 
              <small className="text-sm font-bold text-gray-500 ml-1">KG</small>
            </div>
          </div>
          <div className="space-y-1">
            <div className="text-[10px] font-black text-gray-500 uppercase tracking-widest leading-none px-4">Por Pagar</div>
            <div className="text-3xl font-black text-red-400 px-4">
              {formatCurrency(productores.reduce((acc, p) => acc + (p.saldo_pendiente_usd || 0), 0))}
            </div>
          </div>
          <div className="space-y-1">
            <div className="text-[10px] font-black text-gray-500 uppercase tracking-widest leading-none px-4">Tasa Aplicada</div>
            <div className="text-3xl font-black text-[#f1c40f] px-4">{tasa.toFixed(2)}</div>
          </div>
          <div className="space-y-1">
            <div className="text-[10px] font-black text-gray-500 uppercase tracking-widest leading-none">Productores</div>
            <div className="text-3xl font-black text-white leading-none">{productores.length}</div>
          </div>
        </div>
      </div>

      {/* Filter Bar */}
      <div className="bg-white/5 border border-white/10 p-2 rounded-3xl">
        <div className="relative">
          <Search className="absolute left-6 top-1/2 -translate-y-1/2 text-gray-500" size={20} />
          <input 
            type="text" 
            placeholder="Buscar por productor, RIF o cédula..."
            className="w-full bg-transparent py-5 pl-16 pr-6 focus:outline-none text-lg font-bold"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
      </div>

      {/* Producer List */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {filtered.map(p => (
          <div 
            key={p.id} 
            onClick={() => setSelectedProductor(p)}
            className={cn(
              "group bg-white/5 border border-white/10 rounded-3xl p-5 hover:bg-white/10 transition-all cursor-pointer border-l-4",
              selectedProductor?.id === p.id ? "border-l-[#f1c40f] bg-white/10" : "border-l-[#3498db]"
            )}
          >
            <div className="flex items-center gap-4">
              <div className="w-16 h-16 rounded-2xl bg-white/5 flex items-center justify-center relative overflow-hidden group-hover:bg-[#3498db]/10 transition-colors">
                 <User className="text-gray-500 group-hover:text-blue-400 transition-colors" size={24} />
                 {p.es_obrero && (
                   <div className="absolute top-0 right-0 p-1 bg-red-500 rounded-bl-lg">
                     <span className="text-[6px] font-black text-white">STAFF</span>
                   </div>
                 )}
              </div>
              
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between">
                  <h3 className="text-lg font-black text-white truncate">{p.nombre}</h3>
                  <div className="flex items-center gap-1 text-[#f1c40f] bg-yellow-500/10 px-2 py-0.5 rounded-full">
                    <Trophy size={10} fill="currentColor" />
                    <span className="text-[10px] font-black">{p.puntos_ranking || 0}</span>
                  </div>
                </div>
                <div className="flex items-center gap-2 mt-0.5">
                  <span className="text-[10px] font-bold text-gray-500 uppercase tracking-tighter">RIF: {p.rif}</span>
                   {p.kilos_semana > 0 && (
                     <span className="text-[10px] font-black text-blue-400 uppercase bg-blue-500/10 px-2 rounded-full">
                       <Package size={10} className="inline mr-1" /> {p.kilos_semana} KG
                     </span>
                   )}
                </div>
              </div>

              <div className="text-right px-4">
                <div className="text-[10px] font-black text-gray-500 uppercase tracking-widest leading-none mb-1">Saldo USD</div>
                <div className={cn(
                  "text-xl font-black leading-none",
                  p.saldo_pendiente_usd > 0 ? "text-red-400" : "text-green-400"
                )}>
                  {formatCurrency(p.saldo_pendiente_usd)}
                </div>
              </div>

              <div className="flex items-center gap-1">
                <button 
                  onClick={(e) => { e.stopPropagation(); setSelectedProductor(p); setShowAddModal(true); }}
                  className="p-3 bg-white/5 hover:bg-[#3498db] hover:text-white rounded-2xl transition-all"
                >
                  <Plus size={18} />
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Add Movement Modal */}
      <AnimatePresence>
        {showAddModal && selectedProductor && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
            <motion.div 
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="bg-[#1e293b] border border-white/10 w-full max-w-md rounded-[2.5rem] p-8 shadow-2xl"
            >
              <div className="flex justify-between items-center mb-8">
                <div>
                  <h3 className="text-xl font-black text-white uppercase tracking-tighter">Nuevo Registro</h3>
                  <p className="text-xs text-blue-400 font-bold uppercase">{selectedProductor.nombre}</p>
                </div>
                <button onClick={() => setShowAddModal(false)} className="p-2 hover:bg-white/5 rounded-full text-gray-500">
                  <X size={24} />
                </button>
              </div>

              <div className="space-y-6">
                <div className="space-y-2">
                  <label className="text-[10px] font-black uppercase text-gray-500 tracking-widest px-2">Tipo de Movimiento</label>
                  <select 
                    className="w-full bg-black/30 border border-white/10 rounded-2xl py-4 px-6 text-sm font-bold focus:border-[#3498db] outline-none transition-all appearance-none"
                    value={formData.tipo}
                    onChange={(e) => setFormData({...formData, tipo: e.target.value})}
                  >
                    <option value="ENTREGA_QUESO">RECEPCIÓN DE QUESO</option>
                    <option value="PAGO">PAGO / LIQUIDACIÓN</option>
                    <option value="ANTICIPO">ADELANTO / EFECTIVO</option>
                  </select>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-[10px] font-black uppercase text-gray-500 tracking-widest px-2">Kilos</label>
                    <input 
                      type="number" 
                      placeholder="0.00" 
                      className="w-full bg-black/30 border border-white/10 rounded-2xl py-4 px-6 text-lg font-black focus:border-blue-400 outline-none transition-all"
                      value={formData.kilos || ''}
                      onChange={(e) => setFormData({...formData, kilos: parseFloat(e.target.value) || 0})}
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-black uppercase text-gray-500 tracking-widest px-2">Monto USD</label>
                    <div className="relative">
                      <DollarSign className="absolute left-4 top-1/2 -translate-y-1/2 text-green-500" size={16} />
                      <input 
                        type="number" 
                        placeholder="0.00" 
                        className="w-full bg-black/30 border border-white/10 rounded-2xl py-4 pl-10 pr-6 text-lg font-black focus:border-green-400 outline-none transition-all text-green-400"
                        value={formData.monto_usd || ''}
                        onChange={(e) => setFormData({...formData, monto_usd: parseFloat(e.target.value) || 0})}
                      />
                    </div>
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-[10px] font-black uppercase text-gray-500 tracking-widest px-2">Observaciones</label>
                  <textarea 
                    placeholder="Ej: Semana 15, Queso duro..." 
                    className="w-full bg-black/30 border border-white/10 rounded-2xl py-4 px-6 text-sm font-bold focus:border-[#3498db] outline-none transition-all"
                    rows={2}
                    value={formData.descripcion}
                    onChange={(e) => setFormData({...formData, descripcion: e.target.value})}
                  />
                </div>

                <button 
                  onClick={handleAddMovement}
                  className="w-full py-5 bg-[#3498db] hover:bg-[#2980b9] text-white font-black uppercase tracking-[4px] rounded-2xl shadow-xl shadow-blue-500/10 transition-all active:scale-95 flex items-center justify-center gap-3"
                >
                  <CheckCircle2 size={24} /> Registrar en Libreta
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default LedgerScreen;
