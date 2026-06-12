import React, { useState, useEffect } from 'react';
import { 
  ShoppingBag, 
  Search, 
  Filter, 
  Star, 
  MapPin, 
  Truck, 
  ChevronRight,
  ArrowRight,
  Zap,
  Tag,
  Bot,
  Send,
  X
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { subscribeToCollection } from '../../lib/dbUtils';
import { type Product } from '../../types';
import { formatCurrency, cn } from '../../lib/utils';
import { useToast } from '../../contexts/ToastProvider';
import { askKaluAI } from '../../services/geminiService';

interface CartItem extends Product {
  cantidad_compra: number;
}

const PublicMarketScreen: React.FC = () => {
  const { addToast } = useToast();
  const [products, setProducts] = useState<Product[]>([]);
  const [search, setSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('Todas');
  const [loading, setLoading] = useState(true);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [isCartOpen, setIsCartOpen] = useState(false);
  
  // Chat State
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [chatInput, setChatInput] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [chatMessages, setChatMessages] = useState<{role: 'user'|'ai', content: string}[]>([
    { role: 'ai', content: '¡Hola! Soy Kalu-IA. ¿Qué tienes ganas de cocinar hoy? Cuéntame y te recomiendo los mejores ingredientes del mercado.' }
  ]);

  const handleSendChat = async () => {
    if (!chatInput.trim() || isTyping) return;
    const msg = chatInput.trim();
    setChatInput('');
    setChatMessages(prev => [...prev, { role: 'user', content: msg }]);
    setIsTyping(true);

    try {
      const response = await askKaluAI(msg, { productos_disponibles: products.map(p => ({ nombre: p.nombre, precio: p.precio_normal_usd, oferta: p.precio_oferta_usd, categoria: p.categoria })) });
      setChatMessages(prev => [...prev, { role: 'ai', content: response }]);
    } catch (e) {
      setChatMessages(prev => [...prev, { role: 'ai', content: 'Tuve un problemita técnico, intenta de nuevo.' }]);
    } finally {
      setIsTyping(false);
    }
  };

  useEffect(() => {
    return subscribeToCollection('products', (data) => {
      // Solo mostrar productos disponibles o destacados
      const publicProducts = (data as Product[]).filter(p => p.estatus === 'disponible' || p.estatus === 'destacado');
      setProducts(publicProducts);
      setLoading(false);
    });
  }, []);

  const categories = ['Todas', ...new Set(products.map(p => p.categoria || 'General'))];

  const filteredProducts = products.filter(p => {
    const matchesSearch = (p.nombre || '').toLowerCase().includes(search.toLowerCase()) || 
                         (p.categoria || '').toLowerCase().includes(search.toLowerCase());
    const matchesCategory = selectedCategory === 'Todas' || (p.categoria || 'General') === selectedCategory;
    return matchesSearch && matchesCategory;
  });

  return (
    <div className="space-y-8 animate-in fade-in duration-700 pb-20">
      {/* Header Premium */}
      <div className="relative rounded-[3rem] overflow-hidden bg-[#0f172a] border border-white/10 p-8 md:p-12 shadow-2xl">
        <div className="absolute top-0 right-0 w-1/2 h-full opacity-20 pointer-events-none">
          <div className="absolute inset-0 bg-gradient-to-l from-blue-600/50 to-transparent" />
          <Zap className="absolute top-10 right-10 text-blue-400 opacity-20" size={300} />
        </div>
        
        <div className="relative z-10 max-w-2xl space-y-6">
          <div className="inline-flex items-center gap-2 px-4 py-2 bg-blue-500/10 border border-blue-500/20 rounded-full text-blue-400 text-[10px] font-black uppercase tracking-[3px]">
             <Star size={12} fill="currentColor" /> Mercado Premium de Productores
          </div>
          <h1 className="text-4xl md:text-6xl font-black text-white leading-tight tracking-tighter">
            ENCUENTRA LO MEJOR <br/>
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-emerald-400">DE NUESTRO ESTADO</span>
          </h1>
          <p className="text-gray-400 text-lg font-medium leading-relaxed">
            Conecta directamente con productores locales. Calidad de exportación, 
            precios de origen y entrega garantizada en todo el país.
          </p>
          
          <div className="flex flex-wrap gap-4 pt-4">
            <button 
              onClick={() => document.getElementById('search-bar')?.scrollIntoView({ behavior: 'smooth' })}
              className="px-8 py-4 bg-blue-600 hover:bg-blue-500 text-white font-black rounded-2xl flex items-center gap-3 transition-all active:scale-95 shadow-xl shadow-blue-500/20"
            >
              EXPLORAR TODO <ArrowRight size={20} />
            </button>
            <div className="flex items-center gap-4 px-6 py-4 bg-white/5 border border-white/10 rounded-2xl text-gray-400">
               <div className="flex -space-x-2">
                 {[1,2,3,4].map(i => (
                   <div key={i} className="w-8 h-8 rounded-full border-2 border-[#0f172a] bg-gray-800" />
                 ))}
               </div>
               <span className="text-[10px] font-black uppercase tracking-widest">+500 PRODUCTORES</span>
            </div>
          </div>
        </div>
      </div>

      {/* Search & Filters */}
      <div id="search-bar" className="flex flex-col md:flex-row gap-6 items-center sticky top-0 z-40 py-4 bg-[#0f172a]/80 backdrop-blur-md">
        <div className="flex-1 w-full relative">
          <Search className="absolute left-6 top-1/2 -translate-y-1/2 text-gray-500" size={20} />
          <input 
            type="text"
            placeholder="¿Qué estás buscando hoy?"
            className="w-full bg-white/5 border border-white/10 rounded-[2rem] py-5 pl-16 pr-6 text-white font-bold focus:outline-none focus:border-blue-500/50 transition-all shadow-lg"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <div className="flex gap-2 overflow-x-auto no-scrollbar w-full md:w-auto">
          {categories.map(cat => (
            <button 
              key={cat}
              onClick={() => setSelectedCategory(cat)}
              className={cn(
                "px-6 py-4 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all whitespace-nowrap border",
                selectedCategory === cat 
                  ? "bg-blue-600 border-blue-500 text-white shadow-lg shadow-blue-500/20" 
                  : "bg-white/5 border-white/10 text-gray-500 hover:text-white hover:bg-white/10"
              )}
            >
              {cat}
            </button>
          ))}
        </div>
      </div>

      {/* Product Grid */}
      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-8">
          {[1,2,3,4,5,6,7,8].map(i => (
            <div key={i} className="h-96 bg-white/5 rounded-[2.5rem] animate-pulse" />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-8">
          {filteredProducts.map((product) => (
            <motion.div 
              layout
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              key={product.id}
              className="group bg-white/5 border border-white/10 rounded-[2.5rem] overflow-hidden hover:bg-white/10 transition-all hover:-translate-y-2 hover:shadow-2xl hover:shadow-blue-500/5 flex flex-col"
            >
              {/* Product Image Area */}
              <div className="aspect-square relative bg-black/40 overflow-hidden">
                {product.imagen_url ? (
                  <img src={product.imagen_url} alt={product.nombre} className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500" />
                ) : (
                  <div className="w-full h-full flex flex-col items-center justify-center text-gray-700 opacity-20">
                    <ShoppingBag size={80} strokeWidth={1} />
                  </div>
                )}
                
                <div className="absolute top-4 left-4 flex flex-col gap-2">
                  <span className="bg-blue-600 text-white text-[8px] font-black uppercase px-3 py-1 rounded-full shadow-lg">
                    {product.categoria}
                  </span>
                  {product.precio_oferta_usd && (
                    <span className="bg-emerald-500 text-white text-[8px] font-black uppercase px-3 py-1 rounded-full shadow-lg">
                      OFERTA
                    </span>
                  )}
                  {product.estatus === 'destacado' && (
                    <span className="bg-purple-500 text-white text-[8px] font-black uppercase px-3 py-1 rounded-full shadow-lg flex items-center gap-1">
                      <Star size={8} fill="currentColor" /> PREMIUM
                    </span>
                  )}
                </div>

                <div className="absolute bottom-4 left-4 right-4 flex justify-between items-center opacity-0 group-hover:opacity-100 transition-all translate-y-4 group-hover:translate-y-0">
                  <div className="bg-black/60 backdrop-blur-md p-3 rounded-2xl border border-white/10 flex items-center gap-2">
                    <MapPin size={12} className="text-blue-400" />
                    <span className="text-[8px] font-black text-white uppercase tracking-widest">GUA, VZLA</span>
                  </div>
                </div>
              </div>

              {/* Product Info */}
              <div className="p-6 flex flex-col flex-1">
                <div className="flex-1">
                  <h3 className="text-lg font-black text-white uppercase tracking-tight line-clamp-1 group-hover:text-blue-400 transition-colors">
                    {product.nombre}
                  </h3>
                  <p className="text-[10px] text-gray-500 font-bold uppercase tracking-widest mt-1 flex items-center gap-2">
                    <Truck size={12} /> Envío Nacional
                  </p>
                </div>

                <div className="flex items-end justify-between gap-4 mt-4">
                  <div className="space-y-1">
                    {product.precio_oferta_usd ? (
                      <>
                        <span className="text-xs text-gray-600 line-through font-bold">{formatCurrency(product.precio_normal_usd)}</span>
                        <div className="text-3xl font-black text-[#2ecc71] leading-none">
                          {formatCurrency(product.precio_oferta_usd)}
                        </div>
                      </>
                    ) : (
                      <div className="text-3xl font-black text-white leading-none">
                        {formatCurrency(product.precio_normal_usd)}
                      </div>
                    )}
                  </div>
                  
                  <button 
                    onClick={() => {
                      setCart(prev => {
                        const existing = prev.find(item => item.id === product.id);
                        if (existing) {
                          return prev.map(item => item.id === product.id ? { ...item, cantidad_compra: item.cantidad_compra + 1 } : item);
                        }
                        return [...prev, { ...product, cantidad_compra: 1 }];
                      });
                      addToast('success', 'Agregado al carrito');
                    }}
                    className="w-12 h-12 bg-blue-600 hover:bg-blue-500 text-white rounded-2xl flex items-center justify-center shadow-lg shadow-blue-500/20 active:scale-95 transition-all"
                  >
                    <ShoppingBag size={20} />
                  </button>
                </div>

                <div className="pt-4 mt-4 border-t border-white/5 flex items-center justify-between">
                   <div className="flex items-center gap-2">
                     <div className="w-5 h-5 rounded-full bg-gray-700 flex items-center justify-center text-[8px] font-black text-white">
                       {(product.vendedor_id || 'K').substring(0,1).toUpperCase()}
                     </div>
                     <span className="text-[9px] font-black text-gray-500 uppercase tracking-widest max-w-[100px] truncate">
                       Ref: {product.vendedor_id || 'KALU'}
                     </span>
                   </div>
                   <div className="flex items-center gap-1 text-yellow-500">
                     <Star size={10} fill="currentColor" />
                     <span className="text-[10px] font-black text-white">4.9</span>
                   </div>
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      )}

      {filteredProducts.length === 0 && !loading && (
        <div className="py-20 text-center space-y-4">
          <ShoppingBag size={80} className="mx-auto text-gray-800 opacity-20" />
          <p className="text-gray-500 font-black text-xl uppercase tracking-[10px]">No hay resultados</p>
        </div>
      )}

      {/* Floating Cart Button */}
      {cart.length > 0 && (
        <div className="fixed bottom-8 right-8 z-40">
          <button 
            onClick={() => setIsCartOpen(true)}
            className="relative w-16 h-16 bg-blue-600 hover:bg-blue-500 text-white rounded-full flex items-center justify-center shadow-2xl shadow-blue-500/50 hover:-translate-y-1 transition-all"
          >
            <ShoppingBag size={24} />
            <div className="absolute -top-2 -right-2 w-6 h-6 bg-emerald-500 rounded-full flex items-center justify-center text-[10px] font-black border-2 border-[#0f172a]">
              {cart.reduce((acc, item) => acc + item.cantidad_compra, 0)}
            </div>
          </button>
        </div>
      )}

      {/* Kalu AI Shopper Button */}
      <div className="fixed bottom-8 left-8 z-40">
        <button 
          onClick={() => setIsChatOpen(!isChatOpen)}
          className="relative w-16 h-16 bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-500 hover:to-blue-500 text-white rounded-full flex items-center justify-center shadow-2xl shadow-purple-500/50 hover:-translate-y-1 transition-all"
        >
          {isChatOpen ? <X size={24} /> : <Bot size={24} />}
          {!isChatOpen && (
            <span className="absolute -top-2 -right-2 w-4 h-4 bg-red-500 rounded-full animate-ping" />
          )}
        </button>
      </div>

      {/* AI Chat Window */}
      <AnimatePresence>
        {isChatOpen && (
          <motion.div 
            initial={{ opacity: 0, y: 50, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 50, scale: 0.9 }}
            className="fixed bottom-28 left-8 w-[350px] h-[500px] bg-[#1e293b] border border-white/10 rounded-[2rem] shadow-2xl z-50 flex flex-col overflow-hidden"
          >
            <div className="p-4 bg-gradient-to-r from-purple-600/20 to-blue-600/20 border-b border-white/5 flex items-center gap-3">
              <div className="w-10 h-10 bg-purple-500 rounded-xl flex items-center justify-center shadow-lg">
                <Bot size={20} className="text-white" />
              </div>
              <div>
                <h3 className="font-black text-white text-sm">Kalu-Shopper</h3>
                <span className="text-[10px] text-purple-400 font-bold uppercase tracking-widest flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" /> En línea
                </span>
              </div>
            </div>

            <div className="flex-1 p-4 overflow-y-auto space-y-4 custom-scrollbar">
              {chatMessages.map((msg, idx) => (
                <div key={idx} className={cn("flex max-w-[85%]", msg.role === 'user' ? "ml-auto" : "mr-auto")}>
                  <div className={cn("p-3 rounded-2xl text-sm", msg.role === 'user' ? "bg-blue-600 text-white rounded-br-none" : "bg-white/10 text-gray-200 rounded-bl-none border border-white/5")}>
                    {msg.content}
                  </div>
                </div>
              ))}
              {isTyping && (
                <div className="flex max-w-[85%] mr-auto">
                  <div className="p-3 bg-white/10 text-gray-200 rounded-2xl rounded-bl-none border border-white/5 flex gap-1 items-center">
                    <span className="w-1.5 h-1.5 bg-purple-400 rounded-full animate-bounce" />
                    <span className="w-1.5 h-1.5 bg-purple-400 rounded-full animate-bounce" style={{ animationDelay: '0.1s' }} />
                    <span className="w-1.5 h-1.5 bg-purple-400 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }} />
                  </div>
                </div>
              )}
            </div>

            <div className="p-3 bg-black/20 border-t border-white/5">
              <div className="relative flex items-center">
                <input 
                  type="text"
                  value={chatInput}
                  onChange={(e) => setChatInput(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleSendChat()}
                  placeholder="Ej: Quiero hacer una parrilla..."
                  className="w-full bg-white/5 border border-white/10 rounded-full py-3 pl-4 pr-12 text-sm text-white focus:outline-none focus:border-purple-500 transition-colors placeholder:text-gray-600"
                />
                <button 
                  onClick={handleSendChat}
                  disabled={isTyping || !chatInput.trim()}
                  className="absolute right-2 w-8 h-8 bg-purple-600 rounded-full flex items-center justify-center text-white hover:bg-purple-500 disabled:opacity-50 transition-all"
                >
                  <Send size={14} />
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default PublicMarketScreen;
