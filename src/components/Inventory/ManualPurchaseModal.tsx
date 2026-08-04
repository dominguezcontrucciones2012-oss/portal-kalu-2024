import React, { useState, useEffect } from 'react';
import { 
  X, 
  Search, 
  Plus, 
  Save, 
  Trash2, 
  Loader2, 
  ShoppingBag,
  FileText
} from 'lucide-react';
import { db } from '../../lib/firebase';
import { collection, query, where, getDocs, updateDoc, doc, serverTimestamp, increment } from 'firebase/firestore';
import { useAuth } from '../../contexts/AuthProvider';
import { useToast } from '../../contexts/ToastProvider';
import { cn, formatCurrency } from '../../lib/utils';

interface ManualPurchaseModalProps {
  isOpen: boolean;
  onClose: () => void;
  providers: any[];
}

const ManualPurchaseModal: React.FC<ManualPurchaseModalProps> = ({ isOpen, onClose, providers }) => {
  const { user } = useAuth();
  const { addToast } = useToast();
  
  const [products, setProducts] = useState<any[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<any[]>([]);
  
  const [items, setItems] = useState<any[]>([]);
  const [selectedProvider, setSelectedProvider] = useState('');
  const [isCredit, setIsCredit] = useState(false);
  const [saving, setSaving] = useState(false);

  // Cargar productos al abrir el modal
  useEffect(() => {
    if (isOpen) {
      const fetchProducts = async () => {
        try {
          const { getActiveStoreId } = await import('../../lib/dbUtils');
          const q = query(collection(db, 'products'), where('storeId', '==', getActiveStoreId()));
          const snap = await getDocs(q);
          const prods = snap.docs.map(d => ({ id: d.id, ...d.data() }));
          setProducts(prods);
        } catch (e) {
          console.error("Error al cargar productos:", e);
        }
      };
      fetchProducts();
    }
  }, [isOpen]);

  // Búsqueda en vivo
  useEffect(() => {
    if (searchQuery.trim().length > 1) {
      const lowerQ = searchQuery.toLowerCase();
      const results = products.filter(p => 
        p.nombre?.toLowerCase().includes(lowerQ) || 
        p.codigo?.toLowerCase().includes(lowerQ)
      ).slice(0, 8); // Mostrar max 8 resultados
      setSearchResults(results);
    } else {
      setSearchResults([]);
    }
  }, [searchQuery, products]);

  const addProductToItems = (prod: any) => {
    const costNum = Number(prod.costo_usd) || 0;
    const marginNum = Number(prod.margen_ganancia) || 0;
    const pv = costNum + (costNum * marginNum / 100);

    setItems([...items, { 
      id: Date.now().toString(),
      nombre: prod.nombre, 
      cantidad: 1, 
      costo: costNum,
      margen: marginNum,
      precio_venta: pv
    }]);
    setSearchQuery('');
  };

  const handleCreateNewProduct = () => {
    if (!searchQuery.trim()) return;
    const costNum = 0;
    const marginNum = 0;
    const pv = 0;

    setItems([...items, { 
      id: Date.now().toString(),
      nombre: searchQuery.trim().toUpperCase(), 
      cantidad: 1, 
      costo: costNum,
      margen: marginNum,
      precio_venta: pv
    }]);
    setSearchQuery('');
  };

  const updateItem = (idx: number, field: string, value: number) => {
    const newItems = [...items];
    newItems[idx][field] = value;
    
    // Recalcular
    if (field === 'costo' || field === 'margen') {
      const c = newItems[idx].costo || 0;
      const m = newItems[idx].margen || 0;
      newItems[idx].precio_venta = c + (c * m / 100);
    } else if (field === 'precio_venta') {
      const c = newItems[idx].costo || 0;
      const pv = newItems[idx].precio_venta || 0;
      if (c > 0) {
        newItems[idx].margen = ((pv - c) / c) * 100;
      }
    }
    setItems(newItems);
  };

  const removeItem = (idx: number) => {
    setItems(items.filter((_, i) => i !== idx));
  };

  const handleSavePurchase = async () => {
    if (items.length === 0) return addToast('error', 'Agrega al menos un producto a la lista');
    if (!selectedProvider) return addToast('error', 'Selecciona un proveedor');
    
    setSaving(true);
    try {
      const batchItems = [...items];
      
      for (const item of batchItems) {
        const { getActiveStoreId, addDocument } = await import('../../lib/dbUtils');
        const storeId = getActiveStoreId();
        const q = query(collection(db, 'products'), where('storeId', '==', storeId), where('nombre', '==', item.nombre));
        const snap = await getDocs(q);
        
        if (snap.empty) {
          await addDocument('products', {
            codigo: 'PROD-' + Math.random().toString(36).substring(2, 9).toUpperCase(),
            nombre: item.nombre,
            categoria: 'Mercancía General',
            costo_usd: item.costo,
            precio_normal_usd: item.precio_venta,
            margen_ganancia: item.margen,
            stock: item.cantidad,
            stock_minimo: 5,
            unidad_medida: 'UNIDAD',
            storeId: storeId
          });
        } else {
          const pDoc = snap.docs[0];
          await updateDoc(doc(db, 'products', pDoc.id), {
            stock: increment(item.cantidad),
            costo_usd: item.costo,
            precio_normal_usd: item.precio_venta,
            margen_ganancia: item.margen,
            updatedAt: serverTimestamp()
          });
        }
      }

      const totalPurchase = items.reduce((acc, curr) => acc + (curr.cantidad * curr.costo), 0);

      const compraData = {
        proveedor_id: selectedProvider,
        proveedor_nombre: providers.find(p => p.id === selectedProvider)?.nombre || 'Desconocido',
        items: batchItems,
        total_usd: totalPurchase,
        es_credito: isCredit,
        fecha: new Date().toISOString(),
        usuario_id: user?.uid || 'unknown'
      };
      
      const { addDocument } = await import('../../lib/dbUtils');
      await addDocument('compras_mercancia', compraData);

      if (isCredit) {
        await updateDoc(doc(db, 'providers', selectedProvider), {
          saldo_usd: increment(totalPurchase)
        });
      }

      await addDocument('inventory_audit', {
        producto_id: 'MULTIPLE',
        producto_nombre: 'Compra de Mercancía Manual',
        tipo: 'ENTRADA',
        cantidad_anterior: 0,
        cantidad_nueva: 0,
        diferencia: 0,
        motivo: `Compra Manual a ${compraData.proveedor_nombre}`,
        usuario_id: user?.uid || 'unknown',
        usuario_nombre: user?.username || 'Desconocido',
        fecha: new Date().toISOString()
      });

      addToast('success', '¡Factura Manual registrada exitosamente!');
      setItems([]);
      setSelectedProvider('');
      setIsCredit(false);
      onClose();
    } catch (e: any) {
      console.error(e);
      addToast('error', 'Error guardando compra: ' + e.message);
    } finally {
      setSaving(false);
    }
  };

  if (!isOpen) return null;

  const total = items.reduce((acc, curr) => acc + (curr.cantidad * (curr.costo || 0)), 0);

  return (
    <div className="flex flex-col min-h-[calc(100vh-6rem)] bg-[#0b2246] border border-slate-700/50 rounded-[2.5rem] p-4 md:p-6 overflow-hidden animate-in fade-in zoom-in-95 duration-300 shadow-2xl">
      
      {/* HEADER */}
      <div className="flex items-center justify-between bg-[#112d59]/90 border border-slate-700/50 p-4 rounded-2xl mb-4 shrink-0 shadow-lg">
        <div className="flex items-center gap-3">
          <div className="bg-cyan-500/20 p-2 rounded-xl text-cyan-400">
            <ShoppingBag size={24} />
          </div>
          <div>
            <h1 className="text-xl md:text-2xl font-black text-white uppercase tracking-wide">
              CARGA MANUAL DE MERCANCÍA
            </h1>
            <p className="text-xs text-slate-400">
              Registra facturas de proveedor de forma rápida e interactiva
            </p>
          </div>
        </div>
        <button 
          onClick={onClose}
          className="w-10 h-10 flex items-center justify-center bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white rounded-full transition-all border border-slate-700"
        >
          <X size={20} />
        </button>
      </div>

      {/* BUSCADOR Y TABLA */}
      <div className="flex-1 flex flex-col min-h-0 bg-[#112d59]/50 border border-slate-700/50 rounded-2xl p-4 gap-4 overflow-hidden relative">
        
        {/* BARRA DE BÚSQUEDA FLOTANTE */}
        <div className="relative shrink-0 z-10">
          <div className="relative flex items-center bg-slate-900/80 rounded-xl border border-slate-700 px-4 py-3 focus-within:border-cyan-500 transition-all shadow-md">
            <Search className="w-5 h-5 text-slate-400 shrink-0 mr-3" />
            <input 
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Buscar producto existente o tipear nuevo nombre para añadir..." 
              className="bg-transparent w-full focus:outline-none text-sm font-bold text-white placeholder-slate-500"
              autoFocus
            />
            {searchQuery && (
              <button 
                onClick={() => setSearchQuery('')}
                className="text-slate-400 hover:text-white px-2"
              >
                ✕
              </button>
            )}
          </div>
          
          {/* RESULTADOS DE BÚSQUEDA */}
          {searchQuery.trim() !== '' && (
            <div className="absolute top-full left-0 right-0 mt-2 bg-[#112d59] border border-slate-700 rounded-xl shadow-2xl max-h-64 overflow-y-auto custom-scrollbar z-50">
              {searchResults.length > 0 ? (
                searchResults.map(prod => (
                  <button
                    key={prod.id}
                    onClick={() => addProductToItems(prod)}
                    className="w-full flex items-center justify-between p-3 border-b border-slate-700/50 hover:bg-slate-800 transition-all text-left"
                  >
                    <div className="flex flex-col">
                      <span className="font-bold text-sm text-white">{prod.nombre}</span>
                      <span className="text-[10px] text-slate-400">Último Costo: {formatCurrency(prod.costo_usd)} • Stock actual: {prod.stock}</span>
                    </div>
                    <Plus size={16} className="text-cyan-400" />
                  </button>
                ))
              ) : (
                <button
                  onClick={handleCreateNewProduct}
                  className="w-full flex items-center gap-3 p-4 hover:bg-slate-800 transition-all text-left group"
                >
                  <div className="bg-emerald-500/20 p-2 rounded-lg text-emerald-400 group-hover:scale-110 transition-all">
                    <Plus size={16} />
                  </div>
                  <div>
                    <span className="font-bold text-sm text-white block">Crear "{searchQuery.toUpperCase()}"</span>
                    <span className="text-[10px] text-slate-400">Añadir como nuevo producto a la factura</span>
                  </div>
                </button>
              )}
            </div>
          )}
        </div>

        {/* TABLA DE PRODUCTOS AÑADIDOS */}
        <div className="flex-1 overflow-auto custom-scrollbar bg-slate-900/30 rounded-xl border border-slate-700/50">
          <table className="w-full text-left border-collapse">
            <thead className="bg-slate-900/80 sticky top-0 z-0">
              <tr className="text-[10px] font-black uppercase text-slate-400 tracking-widest border-b border-slate-700/50">
                <th className="px-4 py-4 w-1/3">Producto</th>
                <th className="px-2 py-4 text-center">Cant.</th>
                <th className="px-2 py-4 text-center">Costo ($)</th>
                <th className="px-2 py-4 text-center">% Ganancia</th>
                <th className="px-2 py-4 text-center">Prec. Venta</th>
                <th className="px-4 py-4 text-right">Subtotal</th>
                <th className="px-4 py-4 text-center w-10"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/50">
              {items.length > 0 ? items.map((item, idx) => (
                <tr key={item.id} className="hover:bg-slate-800/30 transition-colors">
                  <td className="px-4 py-3 font-bold text-sm text-white uppercase">{item.nombre}</td>
                  <td className="px-2 py-3 text-center">
                    <input 
                      type="number" 
                      value={item.cantidad || ''} 
                      className="w-16 bg-slate-900 border border-slate-700 rounded-lg text-center font-bold py-1.5 focus:border-cyan-500 focus:outline-none text-white text-sm"
                      onChange={(e) => updateItem(idx, 'cantidad', Number(e.target.value))}
                      min="1"
                    />
                  </td>
                  <td className="px-2 py-3 text-center">
                    <input 
                      type="number" 
                      value={item.costo || ''} 
                      className="w-20 bg-slate-900 border border-slate-700 rounded-lg text-center font-bold py-1.5 focus:border-cyan-500 focus:outline-none text-white text-sm"
                      onChange={(e) => updateItem(idx, 'costo', Number(e.target.value))}
                      step="0.01"
                    />
                  </td>
                  <td className="px-2 py-3 text-center">
                    <input 
                      type="number" 
                      value={item.margen || ''} 
                      className="w-16 bg-slate-900 border border-slate-700 rounded-lg text-center font-bold py-1.5 focus:border-cyan-500 focus:outline-none text-white text-sm"
                      onChange={(e) => updateItem(idx, 'margen', Number(e.target.value))}
                      step="0.1"
                    />
                  </td>
                  <td className="px-2 py-3 text-center">
                    <input 
                      type="number" 
                      value={item.precio_venta || ''} 
                      className="w-20 bg-slate-900 border border-emerald-500/30 rounded-lg text-center font-black py-1.5 focus:border-emerald-500 focus:outline-none text-emerald-400 text-sm"
                      onChange={(e) => updateItem(idx, 'precio_venta', Number(e.target.value))}
                      step="0.01"
                    />
                  </td>
                  <td className="px-4 py-3 text-right font-black text-cyan-400 text-sm">
                    {formatCurrency((item.cantidad || 0) * (item.costo || 0))}
                  </td>
                  <td className="px-4 py-3 text-center">
                    <button 
                      onClick={() => removeItem(idx)} 
                      className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-red-500/20 text-slate-500 hover:text-red-400 transition-colors"
                    >
                      <Trash2 size={16} />
                    </button>
                  </td>
                </tr>
              )) : (
                <tr>
                  <td colSpan={7} className="px-4 py-20 text-center">
                    <div className="flex flex-col items-center justify-center gap-3 text-slate-500">
                      <FileText size={48} className="opacity-20" />
                      <p className="font-bold uppercase tracking-widest text-xs">Busca un producto para empezar a cargar la factura</p>
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* FOOTER: CIERRE DE FACTURA */}
      <div className="mt-4 bg-[#112d59]/90 border border-slate-700/50 p-4 rounded-2xl shrink-0 shadow-xl flex flex-col lg:flex-row gap-4 items-center justify-between">
        
        {/* Controles de Compra */}
        <div className="flex flex-col md:flex-row gap-4 w-full lg:w-auto flex-1">
          <div className="space-y-1 flex-1">
            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">Proveedor de Mercancía</label>
            <select 
              value={selectedProvider} 
              onChange={e => setSelectedProvider(e.target.value)} 
              className="w-full bg-slate-900/80 border border-slate-700 rounded-xl py-3 px-4 text-sm font-bold focus:border-cyan-500 outline-none text-white appearance-none"
            >
              <option value="">-- Seleccionar Proveedor --</option>
              {providers.map(p => (
                <option key={p.id} value={p.id}>{p.nombre}</option>
              ))}
            </select>
          </div>

          <div className="bg-slate-900/50 rounded-xl border border-slate-700 p-3 flex items-center justify-between gap-4 md:min-w-[200px]">
            <div className="flex flex-col">
              <span className="text-xs font-black text-white uppercase tracking-widest">A Crédito</span>
              <span className="text-[9px] text-slate-400 font-bold uppercase">Deuda PxP</span>
            </div>
            <label className="relative inline-flex items-center cursor-pointer shrink-0">
              <input type="checkbox" checked={isCredit} onChange={e => setIsCredit(e.target.checked)} className="sr-only peer" />
              <div className="w-11 h-6 bg-slate-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-amber-500"></div>
            </label>
          </div>
        </div>

        {/* Resumen y Botón Save */}
        <div className="flex items-center gap-6 w-full lg:w-auto">
          <div className="text-right shrink-0">
            <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-0.5">Total Inversión</div>
            <div className="text-3xl font-black text-emerald-400 leading-none">{formatCurrency(total)}</div>
          </div>
          
          <button 
            onClick={handleSavePurchase} 
            disabled={saving || items.length === 0} 
            className="flex-1 lg:flex-none bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black py-4 px-8 rounded-xl shadow-lg transition-all flex items-center justify-center gap-2 text-sm uppercase disabled:opacity-50 disabled:bg-slate-700 disabled:text-slate-400 tracking-widest"
          >
            {saving ? <Loader2 className="animate-spin" size={20} /> : <Save size={20} />} 
            {saving ? 'PROCESANDO...' : 'REGISTRAR FACTURA'}
          </button>
        </div>

      </div>

    </div>
  );
};

export default ManualPurchaseModal;
