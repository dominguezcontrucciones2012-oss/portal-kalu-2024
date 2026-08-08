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
import { subscribeToCollection, deleteDocument } from '../../lib/dbUtils';
import { type Product, type PiezaProducto } from '../../types';
import firebaseConfig from '../../../firebase-applet-config.json';
import SupervisorCodeModal from '../common/SupervisorCodeModal';
import ProductModal from './ProductModal';
import { useActiveStore } from '../../hooks/useActiveStore';
import { useNavigate } from 'react-router-dom';

const InventoryScreen: React.FC = () => {
  const navigate = useNavigate();
  const { activeStore } = useActiveStore();
  const [products, setProducts] = useState<Product[]>(() => {
    try {
      const cached = localStorage.getItem('kalu_products_data');
      return cached ? JSON.parse(cached) : [];
    } catch {
      return [];
    }
  });
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

  const confirmDelete = async () => {
    if (pendingDeleteId) {
      try {
        await deleteDocument('products', pendingDeleteId);
        // La UI se actualiza automáticamente vía subscribeToCollection
      } catch (e) {
        console.error('Error al eliminar producto de Firestore:', e);
      } finally {
        setPendingDeleteId(null);
        setIsAuthModalOpen(false);
      }
    }
  };

  useEffect(() => {
    setLoading(true);
    const unsub = subscribeToCollection('products', (data) => {
      setProducts(data);
      setLoading(false);
      localStorage.setItem('kalu_products_data', JSON.stringify(data));
    });

    return () => unsub();
  }, [activeStore?.id]);

  const categories = ['TODAS', ...Array.from(new Set(products.map(p => p.categoria || 'Sin Categoría')))];

  const filtered = products.filter(p => 
    (categoryFilter === 'TODAS' || (p.categoria || 'Sin Categoría') === categoryFilter) &&
    ((p.nombre || '').toLowerCase().includes(search.toLowerCase()) || String(p.codigo || '').toLowerCase().includes(search.toLowerCase()))
  );

  return (
    <div className="min-h-screen text-white p-4 md:p-6 pt-1 md:pt-1 transition-all duration-300">
      
      {/* 1. CABECERA PEGADA ARRIBA CON BOTÓN REGRESAR */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-3">
        <div className="flex items-center gap-3">
          <button 
            onClick={() => navigate(-1)}
            title="Volver atrás"
            className="w-9 h-9 flex items-center justify-center bg-cyan-500/20 hover:bg-cyan-500/40 text-cyan-400 rounded-full transition-all border border-cyan-500/30 shrink-0"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M15 19l-7-7 7-7" />
            </svg>
          </button>

          <div>
            <div className="flex items-center gap-2">
              <span className="bg-cyan-500/20 text-cyan-400 p-1 rounded-lg text-lg">📦</span>
              <h1 className="text-2xl md:text-3xl font-black tracking-wide uppercase leading-none">
                CONTROL DE INVENTARIO
              </h1>
            </div>
            <p className="text-xs text-slate-400 mt-1">
              Gestión profesional de existencias y precios
            </p>
          </div>
        </div>

        {/* Botón de Agregar Producto (si aplica) */}
        <button 
          onClick={() => {
            setEditingProduct(null);
            setIsProductModalOpen(true);
          }}
          className="bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-black px-4 py-2 rounded-xl text-xs transition-all shadow-lg flex items-center gap-2 self-start md:self-auto"
        >
          <span>+</span> AGREGAR PRODUCTO
        </button>
      </div>

      {/* 2. TARJETAS DE MÉTRICAS COMPACTAS */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-4">
        <div className="bg-[#112d59]/80 backdrop-blur-md p-3 rounded-2xl border border-slate-700/50 shadow-md">
          <p className="text-[10px] font-bold text-slate-400 uppercase">Inversión Total</p>
          <p className="text-xl font-black text-cyan-400 mt-0.5">
            {formatCurrency(products.reduce((acc, curr) => {
              const stock = curr.usa_piezas && Array.isArray(curr.piezas) ? curr.piezas.filter(pz => !pz.vendida).reduce((a, p) => a + (p.peso || 0), 0) : (Number(curr.stock) || 0);
              return acc + ((Number(curr.costo_usd) || 0) * stock);
            }, 0))}
          </p>
          <p className="text-[9px] text-slate-400">COSTO DE ADQUISICIÓN EN STOCK</p>
        </div>

        <div className="bg-[#112d59]/80 backdrop-blur-md p-3 rounded-2xl border border-slate-700/50 shadow-md">
          <p className="text-[10px] font-bold text-slate-400 uppercase">Valor Venta Estimado</p>
          <p className="text-xl font-black text-emerald-400 mt-0.5">
            {formatCurrency(products.reduce((acc, curr) => {
              const stock = curr.usa_piezas && Array.isArray(curr.piezas) ? curr.piezas.filter(pz => !pz.vendida).reduce((a, p) => a + (p.peso || 0), 0) : (Number(curr.stock) || 0);
              return acc + ((Number(curr.precio_normal_usd) || 0) * stock);
            }, 0))}
          </p>
          <p className="text-[9px] text-slate-400">RETORNO ESTIMADO</p>
        </div>

        <div className="bg-[#112d59]/80 backdrop-blur-md p-3 rounded-2xl border border-slate-700/50 shadow-md">
          <p className="text-[10px] font-bold text-slate-400 uppercase">Riesgo / Stock Bajo</p>
          <p className="text-xl font-black text-amber-400 mt-0.5">
            {products.filter(p => {
              const stock = p.usa_piezas && Array.isArray(p.piezas) ? p.piezas.filter(pz => !pz.vendida).reduce((a, pz) => a + (pz.peso || 0), 0) : (Number(p.stock) || 0);
              return stock < (Number(p.stock_minimo) || 0);
            }).length} Ítems
          </p>
          <p className="text-[9px] text-slate-400">PRODUCTOS POR AGOTARSE</p>
        </div>
      </div>

      {/* 3. BARRA DE BÚSQUEDA Y FILTROS POR CATEGORÍA */}
      <div className="flex flex-col gap-2 mb-3">
        {/* INPUT DE BÚSQUEDA VISIBLE Y CLARO */}
        <div className="bg-[#112d59]/80 backdrop-blur-md p-2 rounded-xl border border-slate-700/50 shadow-md">
          <div className="relative w-full flex items-center bg-slate-900/60 rounded-lg border border-slate-700/60 px-3 py-1.5 focus-within:border-cyan-500/60 transition-all">
            <svg className="w-4 h-4 text-slate-400 shrink-0 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <input 
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar por nombre, código de barra o marca..." 
              className="bg-transparent w-full focus:outline-none text-xs text-white placeholder-slate-400"
            />
            {search && (
              <button 
                onClick={() => setSearch("")}
                className="text-slate-400 hover:text-white text-xs px-1 font-bold"
              >
                ✕
              </button>
            )}
          </div>
        </div>

        {/* FILTRO DE CATEGORÍAS (DROPDOWN) */}
        <div className="bg-[#112d59]/80 backdrop-blur-md p-2 rounded-xl border border-slate-700/50 shadow-md">
          <div className="relative w-full flex items-center bg-slate-900/60 rounded-lg border border-slate-700/60 px-3 py-1.5 focus-within:border-cyan-500/60 transition-all">
            <svg className="w-4 h-4 text-slate-400 shrink-0 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" />
            </svg>
            <select
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
              className="bg-transparent w-full focus:outline-none text-xs text-white uppercase font-bold tracking-wider cursor-pointer appearance-none"
            >
              {categories.map(cat => (
                <option key={cat} value={cat} className="bg-slate-900 text-white">
                  {cat}
                </option>
              ))}
            </select>
            <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
              </svg>
            </div>
          </div>
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
              {loading && products.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-8 py-20 text-center">
                    <div className="flex flex-col items-center justify-center gap-3">
                      <div className="w-8 h-8 border-4 border-cyan-500 border-t-transparent rounded-full animate-spin"></div>
                      <p className="text-gray-400 font-bold animate-pulse">Sincronizando inventario...</p>
                    </div>
                  </td>
                </tr>
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-8 py-20 text-center">
                    <p className="text-gray-400 font-bold">No se encontraron productos en esta categoría.</p>
                  </td>
                </tr>
              ) : (
                filtered.map(p => (
                  <tr key={p.id} className="hover:bg-white/5 transition-colors group">
                    <td className="px-8 py-5">
                      <code className="text-[10px] bg-white/5 px-2 py-1 rounded text-blue-400 font-mono">{p.codigo}</code>
                    </td>
                    <td className="px-6 py-5">
                      <div className="font-bold text-white capitalize">{(p.nombre || 'SIN NOMBRE').toLowerCase()}</div>
                      <div className="text-[10px] text-gray-500 uppercase font-bold">{p.unidad_medida || 'UNIDAD'}</div>
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
                ))
              )}
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
