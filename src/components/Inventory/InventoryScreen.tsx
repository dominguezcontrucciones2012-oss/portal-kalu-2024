import React, { useEffect, useState } from 'react';
import { 
  Boxes, 
  Printer, 
  Plus, 
  Search, 
  AlertCircle, 
  Edit, 
  Trash2 
} from 'lucide-react';
import { cn, formatCurrency } from '../../lib/utils';
import { subscribeToCollection } from '../../lib/dbUtils';
import { type Product } from '../../types';
import SupervisorCodeModal from '../common/SupervisorCodeModal';
import ProductModal from './ProductModal';

const InventoryScreen: React.FC = () => {
  const [products, setProducts] = useState<Product[]>([]);
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('TODAS');
  const [loading, setLoading] = useState(true);
  
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const [isProductModalOpen, setIsProductModalOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);

  const handleDeleteClick = (id: string) => {
    setPendingDeleteId(id);
    setIsAuthModalOpen(true);
  };

  const confirmDelete = () => {
    if (pendingDeleteId) {
      // In a real app: await deleteDocument('products', pendingDeleteId);
      console.log('Producto borrado con éxito:', pendingDeleteId);
      setProducts(products.filter(p => p.id !== pendingDeleteId));
      setPendingDeleteId(null);
    }
  };

  useEffect(() => {
    const unsubscribe = subscribeToCollection('products', (data) => {
      setProducts(data);
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  const categories = ['TODAS', ...Array.from(new Set(products.map(p => p.categoria)))];

  const filtered = products.filter(p => 
    (categoryFilter === 'TODAS' || p.categoria === categoryFilter) &&
    (p.nombre.toLowerCase().includes(search.toLowerCase()) || p.codigo.includes(search))
  );

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div>
          <h1 className="text-3xl font-black text-white flex items-center gap-3">
            <Boxes className="text-[#3498db]" /> CONTROL DE INVENTARIO
          </h1>
          <p className="text-gray-400 text-sm">Gestión profesional de existencias y precios</p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <button className="bg-white/5 hover:bg-white/10 text-gray-300 font-bold py-3 px-6 rounded-2xl border border-white/10 transition-all flex items-center gap-2 text-sm">
            <Printer size={18} /> IMPRIMIR
          </button>
          <button 
            onClick={() => {
              setEditingProduct(null);
              setIsProductModalOpen(true);
            }}
            className="bg-[#3498db] hover:bg-[#2980b9] text-white font-bold py-3 px-6 rounded-2xl shadow-lg shadow-[#3498db]/20 transition-all flex items-center gap-2 text-sm group"
          >
            <Plus size={18} className="group-hover:rotate-90 transition-transform" /> NUEVO PRODUCTO
          </button>
        </div>
      </div>

      {/* Stats Summary */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
        <div className="bg-white/5 border border-white/10 p-6 rounded-3xl backdrop-blur-xl">
          <div className="text-[10px] font-black text-blue-400 uppercase tracking-widest mb-1">Inversión Total</div>
          <div className="text-2xl font-black text-white">{formatCurrency(products.reduce((acc, curr) => acc + (curr.costo_usd * curr.stock), 0))}</div>
          <div className="text-[10px] text-gray-500 font-bold mt-1">COSTO DE ADQUISICIÓN EN STOCK</div>
        </div>
        <div className="bg-white/5 border border-white/10 p-6 rounded-3xl backdrop-blur-xl">
          <div className="text-[10px] font-black text-green-400 uppercase tracking-widest mb-1">Valor de Venta</div>
          <div className="text-2xl font-black text-white">{formatCurrency(products.reduce((acc, curr) => acc + (curr.precio_normal_usd * curr.stock), 0))}</div>
          <div className="text-[10px] text-gray-500 font-bold mt-1">PROYECCIÓN DE INGRESOS BRUTOS</div>
        </div>
        <div className="bg-white/5 border border-white/10 p-6 rounded-3xl backdrop-blur-xl">
          <div className="text-[10px] font-black text-red-400 uppercase tracking-widest mb-1">Riesgo Stock</div>
          <div className="text-2xl font-black text-white">{products.filter(p => p.stock < p.stock_minimo).length} ítems</div>
          <div className="text-[10px] text-gray-500 font-bold mt-1">PRODUCTOS POR DEBAJO DEL MÍNIMO</div>
        </div>
      </div>

      {/* Filters Bar */}
      <div className="bg-white/5 border border-white/10 p-4 rounded-3xl flex flex-col md:flex-row gap-4 items-center">
        <div className="relative flex-1 w-full">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500" size={18} />
          <input 
            type="text" 
            placeholder="Buscar por nombre, código o categoría..."
            className="w-full bg-black/20 border border-white/10 rounded-2xl py-3 pl-12 pr-4 focus:outline-none focus:border-[#3498db] transition-all text-sm font-medium"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <div className="flex items-center gap-2 overflow-x-auto w-full md:w-auto custom-scrollbar pb-2 md:pb-0">
          {categories.map(cat => (
            <button
              key={cat}
              onClick={() => setCategoryFilter(cat)}
              className={cn(
                "whitespace-nowrap px-4 py-2 rounded-xl text-xs font-black tracking-tight transition-all border",
                categoryFilter === cat 
                  ? "bg-[#3498db] text-white border-[#3498db] shadow-lg shadow-[#3498db]/20" 
                  : "bg-white/5 text-gray-500 border-white/5 hover:text-white"
              )}
            >
              {cat}
            </button>
          ))}
        </div>
      </div>

      {/* Products Table */}
      <div className="bg-white/5 border border-white/10 rounded-[2.5rem] overflow-hidden">
        <div className="overflow-x-auto custom-scrollbar">
          <table className="w-full text-left">
            <thead className="bg-black/20 text-[10px] uppercase font-black text-gray-500 tracking-wider">
              <tr>
                <th className="px-8 py-5">Código</th>
                <th className="px-6 py-5">Producto</th>
                <th className="px-6 py-5">Categoría</th>
                <th className="px-6 py-5 text-right">Costo</th>
                <th className="px-6 py-5 text-right font-black text-white">P. Full</th>
                <th className="px-6 py-5 text-center">Stock</th>
                <th className="px-6 py-5 text-center">Estado</th>
                <th className="px-8 py-5"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {filtered.map(p => (
                <tr key={p.id} className="hover:bg-white/5 transition-colors group">
                  <td className="px-8 py-5">
                    <code className="text-[10px] bg-white/5 px-2 py-1 rounded text-blue-400 font-mono">{p.codigo}</code>
                  </td>
                  <td className="px-6 py-5">
                    <div className="font-bold text-white capitalize">{p.nombre.toLowerCase()}</div>
                    <div className="text-[10px] text-gray-500 uppercase font-bold">{p.unidad_medida}</div>
                  </td>
                  <td className="px-6 py-5">
                    <span className="text-[10px] font-black bg-white/5 px-2 py-1 rounded-lg text-gray-400 border border-white/5">
                      {p.categoria}
                    </span>
                  </td>
                  <td className="px-6 py-5 text-right font-medium text-gray-400">
                    {formatCurrency(p.costo_usd)}
                  </td>
                  <td className="px-6 py-5 text-right">
                    <div className="font-black text-[#2ecc71]">{formatCurrency(p.precio_normal_usd)}</div>
                    {p.precio_oferta_usd && <div className="text-[9px] text-[#f1c40f] font-bold">OFERTA: {formatCurrency(p.precio_oferta_usd)}</div>}
                  </td>
                  <td className="px-6 py-5 text-center">
                    <div className={cn(
                      "inline-flex items-center justify-center w-12 h-12 rounded-2xl font-black text-lg",
                      p.stock < p.stock_minimo ? "bg-red-500/20 text-red-500 border border-red-500/20" : "bg-white/5 text-white"
                    )}>
                      {p.stock}
                    </div>
                  </td>
                  <td className="px-6 py-5 text-center">
                    {p.stock === 0 ? (
                      <span className="text-[8px] font-black text-red-500 border border-red-500/20 px-2 py-1 rounded-full uppercase tracking-tighter">Sin Existencia</span>
                    ) : p.stock < p.stock_minimo ? (
                      <span className="text-[8px] font-black text-orange-500 border border-orange-500/20 px-2 py-1 rounded-full uppercase tracking-tighter flex items-center justify-center gap-1">
                        <AlertCircle size={10} /> Crítico
                      </span>
                    ) : (
                      <span className="text-[8px] font-black text-green-500 border border-green-500/20 px-2 py-1 rounded-full uppercase tracking-tighter">Disponible</span>
                    )}
                  </td>
                  <td className="px-8 py-5 text-right">
                    <div className="flex items-center justify-end gap-2 opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-opacity">
                      <button 
                        onClick={() => {
                          setEditingProduct(p);
                          setIsProductModalOpen(true);
                        }}
                        className="p-2 text-gray-400 hover:text-white transition-colors"
                      >
                        <Edit size={16} />
                      </button>
                      <button 
                        onClick={() => handleDeleteClick(p.id)}
                        className="p-2 text-red-400 hover:text-red-300 transition-colors"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <SupervisorCodeModal 
        isOpen={isAuthModalOpen}
        onClose={() => setIsAuthModalOpen(false)}
        onSuccess={confirmDelete}
        title="Autorizar Borrado de Producto"
      />

      <ProductModal 
        isOpen={isProductModalOpen}
        onClose={() => {
          setIsProductModalOpen(false);
          setEditingProduct(null);
        }}
        onSuccess={() => {
          setIsProductModalOpen(false);
          setEditingProduct(null);
        }}
        initialData={editingProduct}
      />
    </div>
  );
};

export default InventoryScreen;
