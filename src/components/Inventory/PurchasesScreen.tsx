import React, { useState, useRef, useEffect } from 'react';
import { 
  ShoppingBag, 
  Search, 
  Camera, 
  Plus, 
  Trash2, 
  Zap, 
  FileText,
  Save,
  Loader2,
  Snowflake,
  Flame,
  Mic
} from 'lucide-react';
import { db } from '../../lib/firebase';
import { collection, query, where, getDocs, addDoc, updateDoc, doc, serverTimestamp, increment } from 'firebase/firestore';
import { subscribeToCollection } from '../../lib/dbUtils';
import { useAuth } from '../../contexts/AuthProvider';
import { useToast } from '../../contexts/ToastProvider';
import { cn, formatCurrency, compressImage } from '../../lib/utils';
import { scanInvoiceIA, interactWithInvoiceIA } from '../../services/geminiService';

const PurchasesScreen: React.FC = () => {
  const { user } = useAuth();
  const { addToast } = useToast();
  const [providers, setProviders] = useState<any[]>([]);
  const [selectedProvider, setSelectedProvider] = useState('');
  const [isCredit, setIsCredit] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    return subscribeToCollection('providers', (data) => setProviders(data));
  }, []);
  const [items, setItems] = useState<any[]>([]);
  const [scanning, setScanning] = useState(false);
  const [hasFrozen, setHasFrozen] = useState(false);
  const [aiCommand, setAiCommand] = useState('');
  const [aiAdjusting, setAiAdjusting] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (localStorage.getItem('kalu_frozen_purchase')) {
      setHasFrozen(true);
    }
  }, []);

  const handleFreeze = () => {
    if (items.length === 0) return addToast('error', 'No hay items para congelar');
    localStorage.setItem('kalu_frozen_purchase', JSON.stringify({ items, selectedProvider, isCredit }));
    setItems([]);
    setSelectedProvider('');
    setIsCredit(false);
    setHasFrozen(true);
    addToast('success', 'Factura congelada localmente. ¡No se perderá al refrescar!');
  };

  const handleUnfreeze = () => {
    const frozen = localStorage.getItem('kalu_frozen_purchase');
    if (frozen) {
      try {
        const data = JSON.parse(frozen);
        setItems(data.items || []);
        setSelectedProvider(data.selectedProvider || '');
        setIsCredit(data.isCredit || false);
        localStorage.removeItem('kalu_frozen_purchase');
        setHasFrozen(false);
        addToast('success', 'Factura descongelada exitosamente');
      } catch (e) {
        addToast('error', 'Error recuperando factura congelada');
      }
    }
  };

  const handleAiAdjustment = async () => {
    if (!aiCommand.trim() || items.length === 0) return;
    setAiAdjusting(true);
    try {
      const result = await interactWithInvoiceIA(items, aiCommand);
      if (Array.isArray(result)) {
        setItems(result);
        setAiCommand('');
        addToast('success', 'Factura ajustada por la IA exitosamente');
      } else if (result.error) {
        addToast('error', result.error);
      }
    } catch (e: any) {
      addToast('error', 'Error al comunicarse con la IA');
    } finally {
      setAiAdjusting(false);
    }
  };

  const startVoiceRecognition = () => {
    // @ts-ignore
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      addToast('error', 'Tu navegador no soporta reconocimiento de voz');
      return;
    }

    const recognition = new SpeechRecognition();
    recognition.lang = 'es-VE'; // Spanish Venezuela
    recognition.continuous = false;
    recognition.interimResults = false;

    recognition.onstart = () => setIsListening(true);
    
    recognition.onresult = (event: any) => {
      const transcript = event.results[0][0].transcript;
      setAiCommand(prev => (prev ? prev + ' ' : '') + transcript);
    };

    recognition.onerror = (event: any) => {
      console.error('Error de voz:', event.error);
      addToast('error', 'No se pudo escuchar la voz');
      setIsListening(false);
    };

    recognition.onend = () => setIsListening(false);

    recognition.start();
  };

  const handleScanInvoice = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setScanning(true);
    try {
      // 1. Obtener la tasa actual
      const { getLatestTasa } = await import('../../lib/dbUtils');
      const tasa = await getLatestTasa();

      // 2. Obtener nombres de productos para el contexto de la IA
      const prodsSnap = await getDocs(collection(db, 'products'));
      const productNames = prodsSnap.docs.map(d => d.data().nombre).join(', ');

      const compressedBase64 = await compressImage(file, 800);
      const result = await scanInvoiceIA(compressedBase64, tasa, productNames);
      
      if (Array.isArray(result) && result.length > 0) {
        const normalizedResult = result.map((item: any) => ({
          ...item,
          margen: item.margen || 0,
          precio_venta: item.precio_venta || item.costo || 0
        }));
        setItems(prev => [...prev, ...normalizedResult]);
      } else if (result && result.error) {
        alert("ERROR DETALLADO DE LA IA: " + result.error);
      } else {
        alert("La IA no pudo encontrar productos en esta imagen. Intenta con una foto más clara.");
      }
    } catch (err) {
      console.error("Error escaneando", err);
      alert("Error de conexión con la IA.");
    } finally {
      setScanning(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const triggerFileInput = () => {
    if (fileInputRef.current) {
      fileInputRef.current.click();
    }
  };

  const removeItem = (idx: number) => {
    setItems(items.filter((_, i) => i !== idx));
  };

  const handleAddManual = () => {
    const nombre = prompt("Nombre del producto:");
    if (!nombre) return;
    const cant = prompt("Cantidad comprada:");
    const costo = prompt("Costo unitario (USD):");
    const margen = prompt("Margen Ganancia (%):") || "0";
    
    const costNum = Number(costo) || 0;
    const marginNum = Number(margen) || 0;
    const pv = costNum + (costNum * marginNum / 100);

    setItems([...items, { 
      nombre: nombre.toUpperCase(), 
      cantidad: Number(cant) || 1, 
      costo: costNum,
      margen: marginNum,
      precio_venta: pv
    }]);
  };

  const handleSavePurchase = async () => {
    if (items.length === 0) return addToast('error', 'Agrega al menos un producto');
    if (!selectedProvider) return addToast('error', 'Selecciona un proveedor');
    
    setSaving(true);
    try {
      const batchItems = [...items];
      
      // 1. Process each item (Update stock or create product)
      for (const item of batchItems) {
        const q = query(collection(db, 'products'), where('nombre', '==', item.nombre));
        const snap = await getDocs(q);
        if (snap.empty) {
          // Create product
          await addDoc(collection(db, 'products'), {
            codigo: 'PROD-' + Math.random().toString(36).substring(2, 9).toUpperCase(),
            nombre: item.nombre,
            categoria: 'Mercancía General',
            costo_usd: item.costo,
            precio_normal_usd: item.precio_venta,
            margen_ganancia: item.margen,
            stock: item.cantidad,
            stock_minimo: 5,
            unidad_medida: 'UNIDAD',
            createdAt: serverTimestamp()
          });
        } else {
          // Update product
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

      // 2. Record the Purchase (compras_mercancia)
      const compraData = {
        proveedor_id: selectedProvider,
        proveedor_nombre: providers.find(p => p.id === selectedProvider)?.nombre || 'Desconocido',
        items: batchItems,
        total_usd: totalPurchase,
        es_credito: isCredit,
        fecha: new Date().toISOString(),
        usuario_id: user?.uid || 'unknown'
      };
      await addDoc(collection(db, 'compras_mercancia'), compraData);

      // 3. Update Provider Debt if Credit
      if (isCredit) {
        await updateDoc(doc(db, 'providers', selectedProvider), {
          saldo_usd: increment(totalPurchase)
        });
      }

      // 4. Audit Log
      await addDoc(collection(db, 'inventory_audit'), {
        producto_id: 'MULTIPLE',
        producto_nombre: 'Compra de Mercancía',
        tipo: 'ENTRADA',
        cantidad_anterior: 0,
        cantidad_nueva: 0,
        diferencia: 0,
        motivo: `Compra a ${compraData.proveedor_nombre}`,
        usuario_id: user?.uid || 'unknown',
        usuario_nombre: user?.username || 'Desconocido',
        fecha: new Date().toISOString()
      });

      addToast('success', '¡Compra procesada exitosamente y stock actualizado!');
      setItems([]);
      setSelectedProvider('');
      setIsCredit(false);
    } catch (e: any) {
      console.error(e);
      addToast('error', 'Error guardando compra: ' + e.message);
    } finally {
      setSaving(false);
    }
  };

  const total = items.reduce((acc, curr) => acc + (curr.cantidad * curr.costo), 0);

  return (
    <div className="space-y-8 animate-in fade-in duration-700">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div>
          <h1 className="text-3xl font-black text-white flex items-center gap-3">
            <ShoppingBag className="text-[#3498db]" /> CARGA DE MERCANCÍA
          </h1>
          <p className="text-gray-400 text-sm">Incremento de stock y actualización de costos</p>
        </div>
        <div className="flex gap-3">
          <input 
            type="file" 
            accept="image/*" 
            ref={fileInputRef} 
            className="hidden" 
            onChange={handleScanInvoice} 
          />
          
          {hasFrozen && (
            <button onClick={handleUnfreeze} className="bg-orange-500 hover:bg-orange-600 text-white font-black py-4 px-6 rounded-2xl shadow-xl transition-all flex items-center gap-2 text-sm uppercase">
              <Flame size={18} /> DESCONGELAR
            </button>
          )}

          <button onClick={handleFreeze} disabled={items.length === 0} className="bg-slate-700 hover:bg-slate-600 text-white font-black py-4 px-6 rounded-2xl shadow-xl transition-all flex items-center gap-2 text-sm uppercase disabled:opacity-50">
            <Snowflake size={18} /> CONGELAR
          </button>

          <button 
            onClick={triggerFileInput}
            disabled={scanning}
            className="bg-[#9b59b6] hover:bg-[#8e44ad] text-white font-black py-4 px-8 rounded-2xl shadow-xl shadow-purple-500/10 transition-all flex items-center gap-3 text-sm uppercase tracking-widest disabled:opacity-50"
          >
            {scanning ? <Loader2 className="animate-spin" /> : <Zap size={18} fill="currentColor" />} 
            {scanning ? "PROCESANDO IA..." : "ESCANEAR FACTURA IA"}
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 space-y-6">
          <div className="bg-[#9b59b6]/10 border border-[#9b59b6]/30 rounded-[2.5rem] p-6 flex flex-col md:flex-row gap-4 items-center">
            <div className="bg-[#9b59b6]/20 p-3 rounded-full flex-shrink-0">
              <Zap size={24} className="text-[#9b59b6] animate-pulse" fill="currentColor" />
            </div>
            
            <button
              onClick={startVoiceRecognition}
              title="Dictar instrucción por voz"
              className={cn(
                "p-4 rounded-full flex-shrink-0 transition-all shadow-md",
                isListening ? "bg-red-500 text-white animate-pulse shadow-red-500/50" : "bg-black/30 text-gray-400 hover:text-white hover:bg-black/50"
              )}
            >
              <Mic size={20} />
            </button>

            <input
              type="text"
              value={aiCommand}
              onChange={(e) => setAiCommand(e.target.value)}
              placeholder="Ej. 'La harina son 40 pacas de 12, el costo de la pasta es 14000, margen al 20%...'"
              className="flex-1 bg-black/30 border border-white/10 rounded-2xl py-4 px-6 text-sm font-medium focus:border-[#9b59b6] outline-none text-white w-full"
              onKeyDown={(e) => e.key === 'Enter' && handleAiAdjustment()}
            />
            <button
              onClick={handleAiAdjustment}
              disabled={aiAdjusting || items.length === 0 || !aiCommand.trim()}
              className="bg-[#9b59b6] hover:bg-[#8e44ad] text-white font-black py-4 px-8 rounded-2xl shadow-xl transition-all flex items-center justify-center gap-2 text-xs uppercase disabled:opacity-50 whitespace-nowrap w-full md:w-auto"
            >
              {aiAdjusting ? <Loader2 className="animate-spin" size={18} /> : <Zap size={18} fill="currentColor" />}
              {aiAdjusting ? "PENSANDO..." : "AJUSTAR CON IA"}
            </button>
          </div>

          <div className="bg-white/5 border border-white/10 rounded-[2.5rem] overflow-hidden">
             <table className="w-full text-left">
                <thead>
                  <tr className="bg-white/5 text-[10px] font-black uppercase text-gray-500 tracking-widest">
                    <th className="px-6 py-6">Producto</th>
                    <th className="px-4 py-6 text-center">Cant.</th>
                    <th className="px-4 py-6 text-center">Costo</th>
                    <th className="px-4 py-6 text-center">% Ganancia</th>
                    <th className="px-4 py-6 text-center">Precio Venta</th>
                    <th className="px-6 py-6 text-right">Subtotal</th>
                    <th className="px-6 py-6"></th>
                  </tr>
                </thead>
               <tbody className="divide-y divide-white/5">
                 {items.length > 0 ? items.map((item, idx) => (
                    <tr key={idx} className="hover:bg-white/5 transition-colors">
                      <td className="px-6 py-6 font-bold text-white uppercase">{item.nombre}</td>
                      <td className="px-4 py-6 text-center">
                        <input 
                          type="number" 
                          value={item.cantidad} 
                          className="w-16 bg-black/20 border border-white/10 rounded-lg text-center font-bold py-1"
                          onChange={(e) => {
                            const newItems = [...items];
                            newItems[idx].cantidad = Number(e.target.value);
                            setItems(newItems);
                          }}
                        />
                      </td>
                      <td className="px-4 py-6 text-center">
                        <input 
                          type="number" 
                          value={item.costo} 
                          className="w-20 bg-black/20 border border-white/10 rounded-lg text-center font-bold py-1"
                          onChange={(e) => {
                            const newItems = [...items];
                            const c = Number(e.target.value);
                            newItems[idx].costo = c;
                            const m = newItems[idx].margen || 0;
                            newItems[idx].precio_venta = c + (c * m / 100);
                            setItems(newItems);
                          }}
                        />
                      </td>
                      <td className="px-4 py-6 text-center">
                        <input 
                          type="number" 
                          value={item.margen || 0} 
                          className="w-16 bg-black/20 border border-white/10 rounded-lg text-center font-bold py-1"
                          onChange={(e) => {
                            const newItems = [...items];
                            const m = Number(e.target.value);
                            newItems[idx].margen = m;
                            const c = newItems[idx].costo || 0;
                            newItems[idx].precio_venta = c + (c * m / 100);
                            setItems(newItems);
                          }}
                        />
                      </td>
                      <td className="px-4 py-6 text-center">
                        <input 
                          type="number" 
                          value={item.precio_venta || 0} 
                          className="w-20 bg-black/20 border border-white/10 rounded-lg text-center font-bold py-1 text-[#3498db]"
                          onChange={(e) => {
                            const newItems = [...items];
                            newItems[idx].precio_venta = Number(e.target.value);
                            // Opcional: auto-calcular margen si se cambia el precio
                            const c = newItems[idx].costo;
                            if (c > 0) {
                              newItems[idx].margen = ((newItems[idx].precio_venta - c) / c) * 100;
                            }
                            setItems(newItems);
                          }}
                        />
                      </td>
                      <td className="px-6 py-6 text-right font-black text-[#2ecc71]">
                        ${(item.cantidad * item.costo).toFixed(2)}
                      </td>
                      <td className="px-6 py-6 text-right">
                        <button onClick={() => removeItem(idx)} className="text-gray-700 hover:text-red-400 transition-colors">
                         <Trash2 size={18} />
                       </button>
                     </td>
                   </tr>
                  )) : (
                    <tr>
                      <td colSpan={7} className="px-8 py-20 text-center">
                       <div className="flex flex-col items-center gap-4 text-gray-600">
                         <FileText size={48} className="opacity-20" />
                         <span className="font-black uppercase tracking-widest">No hay items cargados</span>
                       </div>
                     </td>
                   </tr>
                 )}
               </tbody>
             </table>
          </div>
          
          <button onClick={handleAddManual} className="w-full h-16 border-2 border-dashed border-white/10 rounded-[2.5rem] flex items-center justify-center gap-2 text-gray-500 font-black uppercase tracking-widest hover:border-[#3498db] hover:text-[#3498db] transition-all">
            <Plus size={20} /> AÑADIR PRODUCTO MANUALMENTE
          </button>
        </div>

        <div className="space-y-6">
          <div className="bg-white/5 border border-white/10 rounded-[2.5rem] p-8 space-y-6">
            <h3 className="text-xl font-bold">Resumen de Compra</h3>
            <div className="space-y-4">
              <div className="space-y-2">
                <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest px-2">Proveedor</label>
                <select value={selectedProvider} onChange={e => setSelectedProvider(e.target.value)} className="w-full bg-black/30 border border-white/10 rounded-2xl py-3 px-4 text-xs font-bold focus:border-[#3498db] outline-none">
                   <option value="">Seleccionar Proveedor...</option>
                   {providers.map(p => (
                     <option key={p.id} value={p.id}>{p.nombre}</option>
                   ))}
                </select>
              </div>

              <div className="flex items-center justify-between p-4 bg-white/5 rounded-2xl border border-white/5">
                <div className="flex flex-col">
                  <span className="text-[10px] font-black text-white uppercase tracking-widest">¿Compra a Crédito?</span>
                  <span className="text-[8px] text-gray-500 font-bold uppercase">GENERAR CUENTA POR PAGAR</span>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input type="checkbox" checked={isCredit} onChange={e => setIsCredit(e.target.checked)} className="sr-only peer" />
                  <div className="w-11 h-6 bg-gray-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-purple-500"></div>
                </label>
              </div>

              <div className="flex justify-between items-center text-gray-400 font-bold uppercase text-[10px] tracking-widest pt-2">
                <span>Items Totales</span>
                <span className="text-white">{items.length}</span>
              </div>
              
              <div className="pt-6 border-t border-white/5">
                <div className="text-[10px] font-black text-gray-500 uppercase tracking-widest mb-1">Monto Total a Invertir</div>
                <div className="text-4xl font-black text-[#2ecc71]">{formatCurrency(total)}</div>
              </div>
            </div>

            <button onClick={handleSavePurchase} disabled={saving} className="w-full bg-[#3498db] hover:bg-[#2980b9] text-white font-black py-5 rounded-3xl shadow-xl shadow-blue-500/10 transition-all flex items-center justify-center gap-3 mt-4 disabled:opacity-50">
              {saving ? <Loader2 className="animate-spin" /> : <Save size={20} />} 
              {saving ? 'PROCESANDO...' : 'GUARDAR E INCREMENTAR STOCK'}
            </button>
          </div>

          <div className="bg-[#f1c40f]/10 border border-[#f1c40f]/20 p-6 rounded-[2.5rem]">
            <h4 className="text-yellow-500 font-black uppercase text-[10px] tracking-widest flex items-center gap-2 mb-2">
              <Zap size={14} fill="currentColor" /> Consejo de Costos
            </h4>
            <p className="text-xs text-white leading-relaxed font-medium">
              Asegúrate de que los costos cargados hoy no excedan el 5% de la carga anterior para mantener tus margenes de utilidad estables.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PurchasesScreen;
