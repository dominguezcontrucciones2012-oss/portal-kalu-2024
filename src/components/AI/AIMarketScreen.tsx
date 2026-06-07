import React, { useState, useRef, useEffect } from 'react';
import { 
  Zap, 
  Send, 
  Bot, 
  User, 
  Sparkles, 
  TrendingUp, 
  AlertCircle,
  BrainCircuit,
  MessageSquare
} from 'lucide-react';
import { cn } from '../../lib/utils';
import { askKaluAI } from '../../services/geminiService';
import { subscribeToCollection } from '../../lib/dbUtils';
import { type Product, type Client, type Sale } from '../../types';
import { motion, AnimatePresence } from 'motion/react';

interface Message {
  role: 'user' | 'assistant';
  content: string;
}

const AIMarketScreen: React.FC = () => {
  const [messages, setMessages] = useState<Message[]>([
    { role: 'assistant', content: '¡Hola! Soy Kalu-IA, tu consultora de mercado premium. ¿En qué puedo ayudarte hoy pariente? Puedo analizar tus ventas, deudas o darte consejos de stock.' }
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [products, setProducts] = useState<Product[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [sales, setSales] = useState<Sale[]>([]);
  
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const unsubProducts = subscribeToCollection('products', (data) => setProducts(data as Product[]));
    const unsubClients = subscribeToCollection('clients', (data) => setClients(data as Client[]));
    const unsubSales = subscribeToCollection('sales', (data) => setSales(data as Sale[]));
    return () => {
      unsubProducts();
      unsubClients();
      unsubSales();
    };
  }, []);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const handleSend = async () => {
    if (!input.trim() || loading) return;

    const userMsg = input.trim();
    setInput('');
    setMessages(prev => [...prev, { role: 'user', content: userMsg }]);
    setLoading(true);

    try {
      const context = {
        productos_criticos: products.filter(p => p.stock < p.stock_minimo),
        clientes_morosos: clients.filter(c => c.saldo_usd > 0),
        ventas_recientes: sales.slice(-10)
      };

      const response = await askKaluAI(userMsg, context);
      setMessages(prev => [...prev, { role: 'assistant', content: response }]);
    } catch (err) {
      setMessages(prev => [...prev, { role: 'assistant', content: 'Pariente, tuve un pequeño error de conexión. Intenta de nuevo.' }]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="h-[calc(100vh-14rem)] flex flex-col gap-6 animate-in fade-in duration-700">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-black text-white flex items-center gap-3">
            <BrainCircuit className="text-[#9b59b6]" /> KALU-IA MERCADO
          </h1>
          <p className="text-gray-400 text-sm">Escucha las sugerencias de tu asistente de inteligencia de negocios</p>
        </div>
        <div className="flex gap-2">
          <div className="px-4 py-2 bg-purple-500/10 border border-purple-500/20 rounded-xl flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-purple-500 animate-pulse" />
            <span className="text-[10px] font-black text-purple-400 uppercase tracking-widest">Model: Gemini 1.5 Flash</span>
          </div>
        </div>
      </div>

      <div className="flex-1 bg-white/5 border border-white/10 rounded-[3rem] backdrop-blur-sm relative overflow-hidden flex flex-col">
        {/* Messages area */}
        <div 
          ref={scrollRef}
          className="flex-1 overflow-y-auto p-8 space-y-6 scroll-smooth"
        >
          <AnimatePresence>
            {messages.map((m, idx) => (
              <motion.div 
                key={idx}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className={cn(
                  "flex gap-4 max-w-[85%]",
                  m.role === 'user' ? "ml-auto flex-row-reverse" : "mr-auto"
                )}
              >
                <div className={cn(
                  "w-10 h-10 rounded-2xl flex items-center justify-center shrink-0 border border-white/10 shadow-lg",
                  m.role === 'assistant' ? "bg-[#9b59b6] text-white" : "bg-white/5 text-gray-400"
                )}>
                  {m.role === 'assistant' ? <Bot size={20} /> : <User size={20} />}
                </div>
                
                <div className={cn(
                  "p-5 rounded-[2rem] text-sm font-medium leading-relaxed shadow-xl",
                  m.role === 'assistant' ? "bg-white/10 text-white rounded-tl-none border border-white/10" : "bg-[#3498db] text-white rounded-tr-none"
                )}>
                  {m.content}
                </div>
              </motion.div>
            ))}
          </AnimatePresence>
          {loading && (
            <div className="flex gap-4 max-w-[85%] mr-auto items-center">
              <div className="w-10 h-10 rounded-2xl bg-[#9b59b6] text-white flex items-center justify-center animate-pulse">
                <Bot size={20} />
              </div>
              <div className="flex gap-1">
                <div className="w-2 h-2 bg-purple-500 rounded-full animate-bounce" />
                <div className="w-2 h-2 bg-purple-500 rounded-full animate-bounce [animation-delay:-0.15s]" />
                <div className="w-2 h-2 bg-purple-500 rounded-full animate-bounce [animation-delay:-0.3s]" />
              </div>
            </div>
          )}
        </div>

        {/* Suggested Actions */}
        <div className="px-8 py-4 flex gap-3 overflow-x-auto no-scrollbar">
          {[
            "¿Qué mercancía debo comprar?",
            "Resumen de deudas de hoy",
            "¿Cómo van las ventas de queso?",
            "Recomienda precios de oferta"
          ].map((suggestion, idx) => (
            <button 
              key={idx}
              onClick={() => setInput(suggestion)}
              className="whitespace-nowrap px-4 py-2 bg-white/5 border border-white/10 rounded-full text-[10px] font-black uppercase text-gray-400 hover:text-white hover:bg-white/10 transition-all"
            >
              {suggestion}
            </button>
          ))}
        </div>

        {/* Input Area */}
        <div className="p-4 bg-white/5 border-t border-white/10">
          <div className="relative max-w-4xl mx-auto flex items-center gap-4">
             <input 
              type="text" 
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSend()}
              placeholder="Pregunta a Kalu-IA sobre tu negocio..."
              className="flex-1 bg-black/20 border border-white/10 rounded-3xl py-4 px-8 text-sm font-bold focus:outline-none focus:border-purple-500 transition-all placeholder:text-gray-700"
             />
             <button 
              onClick={handleSend}
              disabled={loading || !input.trim()}
              className="w-14 h-14 rounded-2xl bg-purple-600 hover:bg-purple-500 text-white flex items-center justify-center transition-all active:scale-95 disabled:opacity-50 shadow-lg shadow-purple-500/20"
             >
               <Send size={20} />
             </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AIMarketScreen;
