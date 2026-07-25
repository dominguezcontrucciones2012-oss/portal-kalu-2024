import React, { useState, useEffect } from 'react';
import { 
  ShieldCheck, 
  Check, 
  X, 
  AlertTriangle,
  Bot,
  Search,
  Image as ImageIcon
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { subscribeToCollection, updateDocument } from '../../lib/dbUtils';
import { type Product } from '../../types';
import { formatCurrency, cn } from '../../lib/utils';
import { useToast } from '../../contexts/ToastProvider';
import { askKaluAI } from '../../services/geminiService';

const ApprovalScreen: React.FC = () => {
  const { addToast } = useToast();
  const [pendingProducts, setPendingProducts] = useState<Product[]>([]);
  const [allProducts, setAllProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [analyzingId, setAnalyzingId] = useState<string | null>(null);
  const [aiComments, setAiComments] = useState<Record<string, string>>({});

  useEffect(() => {
    return subscribeToCollection('products', (data) => {
      const all = data as Product[];
      setAllProducts(all);
      setPendingProducts(all.filter(p => p.estatus === 'pendiente'));
      setLoading(false);
    });
  }, []);

  const handleAnalyze = async (product: Product) => {
    setAnalyzingId(product.id);
    try {
      const categoryProducts = allProducts.filter(p => p.categoria === product.categoria && p.estatus === 'disponible');
      const context = {
        producto_a_evaluar: {
          nombre: product.nombre,
          precio_propuesto: product.precio_normal_usd,
          categoria: product.categoria
        },
        precios_mercado: categoryProducts.map(p => ({ nombre: p.nombre, precio: p.precio_normal_usd }))
      };

      const prompt = `Actúa como inspector de calidad. Evalúa si el precio de $${product.precio_normal_usd} para el producto "${product.nombre}" es razonable basado en el mercado. Sé breve (máximo 2 líneas). Dime si apruebas o si el productor debe bajarle.`;
      
      const response = await askKaluAI(prompt, context);
      setAiComments(prev => ({ ...prev, [product.id]: response }));
      addToast('info', 'Análisis de IA completado');
    } catch (e) {
      addToast('error', 'Error analizando con IA');
    } finally {
      setAnalyzingId(null);
    }
  };

  const handleApprove = async (id: string) => {
    try {
      await updateDocument('products', id, { estatus: 'disponible' });
      addToast('success', 'Producto Aprobado y publicado en la vitrina');
    } catch (e) {
      addToast('error', 'Error al aprobar');
    }
  };

  const handleReject = async (id: string) => {
    try {
      await updateDocument('products', id, { estatus: 'rechazado' });
      addToast('success', 'Producto Rechazado');
    } catch (e) {
      addToast('error', 'Error al rechazar');
    }
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-700 pb-20">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div>
          <h1 className="text-3xl font-black text-white flex items-center gap-3">
            <div className="p-3 bg-red-500/10 rounded-2xl">
              <ShieldCheck className="text-red-500" size={28} />
            </div>
            CONSOLA DE APROBACIÓN
          </h1>
          <p className="text-gray-400 text-sm font-medium">Inspecciona y aprueba las publicaciones de los vendedores (Sello Kalu)</p>
        </div>
        <div className="flex items-center gap-4 bg-white/5 px-6 py-3 rounded-2xl border border-white/10">
          <AlertTriangle size={20} className="text-yellow-500" />
          <div className="flex flex-col">
            <span className="text-[10px] font-black text-gray-500 uppercase tracking-widest">Pendientes</span>
            <span className="text-sm font-bold text-white">{pendingProducts.length} productos</span>
          </div>
        </div>
      </div>

      {loading ? (
        <div className="text-center py-20">
          <div className="w-12 h-12 border-4 border-white/10 border-t-red-500 rounded-full animate-spin mx-auto" />
        </div>
      ) : pendingProducts.length === 0 ? (
        <div className="py-20 text-center space-y-4 bg-white/5 border border-white/10 rounded-[3rem]">
          <ShieldCheck size={80} className="mx-auto text-gray-800 opacity-20" />
          <p className="text-gray-500 font-black text-xl uppercase tracking-[10px]">Todo al día</p>
          <p className="text-sm text-gray-600">No hay publicaciones pendientes de revisión.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-8">
          <AnimatePresence>
            {pendingProducts.map(product => (
              <motion.div 
                key={product.id}
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className="bg-white/5 border border-white/10 rounded-[2.5rem] p-6 flex flex-col gap-6"
              >
                <div className="flex gap-6">
                  <div className="w-32 h-32 rounded-2xl bg-black/40 border border-white/5 flex-shrink-0 overflow-hidden relative">
                    {product.imagen_url ? (
                      <img src={product.imagen_url} alt={product.nombre} className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center opacity-20">
                        <ImageIcon size={32} />
                      </div>
                    )}
                    <div className="absolute top-2 left-2 px-2 py-1 bg-yellow-500 text-white text-[8px] font-black uppercase rounded-lg">
                      REVISIÓN
                    </div>
                  </div>
                  
                  <div className="flex-1 space-y-2">
                    <div className="flex justify-between items-start">
                      <div>
                        <h3 className="text-xl font-black text-white uppercase">{product.nombre}</h3>
                        <p className="text-[10px] text-gray-500 font-bold uppercase tracking-widest">Cat: {product.categoria} • Vendedor: {product.vendedor_id?.substring(0,8) || 'Desconocido'}</p>
                      </div>
                      <div className="text-2xl font-black text-[#2ecc71]">
                        {formatCurrency(product.precio_normal_usd)}
                      </div>
                    </div>
                    <p className="text-xs text-gray-400 line-clamp-2">{product.descripcion}</p>
                    <div className="text-[10px] font-black text-gray-500 uppercase tracking-widest pt-2">
                      Stock Reportado: {product.stock} {product.unidad_medida}
                    </div>
                  </div>
                </div>

                <div className="bg-black/20 p-5 rounded-3xl border border-white/5">
                  {aiComments[product.id] ? (
                    <div className="flex gap-4">
                      <Bot size={24} className="text-purple-400 shrink-0" />
                      <div>
                        <span className="text-[10px] font-black text-purple-400 uppercase tracking-widest block mb-1">Inspección de Kalu-IA</span>
                        <p className="text-sm text-gray-300 font-medium">{aiComments[product.id]}</p>
                      </div>
                    </div>
                  ) : (
                    <button 
                      onClick={() => handleAnalyze(product)}
                      disabled={analyzingId === product.id}
                      className="w-full py-4 border border-purple-500/30 bg-purple-500/10 hover:bg-purple-500/20 text-purple-400 rounded-2xl flex items-center justify-center gap-3 text-sm font-black uppercase tracking-widest transition-all disabled:opacity-50"
                    >
                      {analyzingId === product.id ? (
                        <span className="w-5 h-5 border-2 border-purple-400/20 border-t-purple-400 rounded-full animate-spin" />
                      ) : (
                        <><Bot size={18} /> Analizar Precio con IA</>
                      )}
                    </button>
                  )}
                </div>

                <div className="flex gap-4 pt-2">
                  <button 
                    onClick={() => handleReject(product.id)}
                    className="flex-1 py-4 bg-red-500/10 hover:bg-red-500/20 text-red-500 border border-red-500/20 rounded-2xl font-black uppercase tracking-widest text-sm flex items-center justify-center gap-2 transition-all"
                  >
                    <X size={18} /> Rechazar
                  </button>
                  <button 
                    onClick={() => handleApprove(product.id)}
                    className="flex-1 py-4 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border border-emerald-500/20 rounded-2xl font-black uppercase tracking-widest text-sm flex items-center justify-center gap-2 transition-all"
                  >
                    <Check size={18} /> Aprobar
                  </button>
                </div>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      )}
    </div>
  );
};

export default ApprovalScreen;
