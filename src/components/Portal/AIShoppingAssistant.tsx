import React, { useState, useRef, useEffect } from 'react';
import { X, Mic, MicOff, Send, ShoppingCart, Bot, Loader2, Sparkles, Volume2, Store, Keyboard, AlertTriangle, ChevronRight } from 'lucide-react';
import { GoogleGenAI } from '@google/genai';
import { motion, AnimatePresence } from 'motion/react';

import { Product } from '../../types';

interface CartItem {
  product: Product;
  cantidad: number;
}

interface Message {
  role: 'user' | 'assistant';
  text: string;
  isVoice?: boolean;
  cartSuggestion?: { product: Product; cantidad: number; pieza?: any }[];
  isError?: boolean;
  isCheckout?: boolean;
}

type InputMode = 'text' | 'voice';

interface AIShoppingAssistantProps {
  products: Product[];
  clientName: string;
  clientDebt?: number;
  cart: CartItem[];
  tasaBcv: number;
  onAddToCart: (product: Product, quantity?: number, piezaId?: string) => void;
  onGoToStore?: () => void; // callback to switch to the store tab
  onShowCart?: () => void; // callback to show the cart drawer
}

const apiKey = (import.meta as any).env.VITE_GEMINI_API_KEY;
const AI_AVAILABLE = !!(apiKey && apiKey !== 'COPIA_TU_API_KEY_AQUI');

async function parseOrderWithGemini(
  userMessage: string,
  audioBase64: string | null,
  products: Product[],
  clientName: string,
  clientDebt: number,
  tasaBcv: number,
  currentCart: CartItem[]
): Promise<{ reply: string; cartSuggestion?: { product: Product; cantidad: number; pieza?: any }[]; isCheckout?: boolean }> {
  if (!AI_AVAILABLE) {
    throw new Error('NO_API_KEY');
  }

  const ai = new GoogleGenAI({ apiKey });

  const productList = products
    .filter(p => p.stock > 0)
    .map(p => {
      let piezasInfo = '';
      if (p.usa_piezas && p.piezas && p.piezas.filter(pz => !pz.vendida).length > 0) {
        piezasInfo = `(USA PIEZAS EXACTAS. Piezas disp: ${p.piezas.filter(pz => !pz.vendida).map(pz => `ID_PIEZA:"${pz.id}" Peso:${pz.peso}kg`).join(', ')})`;
      }
      return `- ${p.nombre} (ID: ${p.id}): $${(p.precio_oferta_usd || p.precio_normal_usd).toFixed(2)}/kg, Stock: ${p.stock}kg ${piezasInfo}`;
    })
    .join('\n');

  const currentCartStr = currentCart.length > 0
    ? currentCart.map(i => `${i.cantidad}kg de ${i.product.nombre}`).join(', ')
    : 'vacío';

  const systemInstruction = `Eres "Kalu IA", el asistente de compras inteligente de Kalu Queso San Juan, una tienda de quesos y lácteos venezolana.

Tu misión es ayudar al cliente a comprar de forma rápida y fácil. Hablas en español venezolano, eres amigable, cálido y eficiente.

CLIENTE: ${clientName}
DEUDA ACTUAL: $${clientDebt.toFixed(2)}
TASA BCV: ${tasaBcv} Bs/USD
CARRITO ACTUAL: ${currentCartStr}

PRODUCTOS DISPONIBLES HOY:
${productList}

INSTRUCCIONES:
1. Si el cliente pide productos, OBLIGATORIAMENTE debes incluir este bloque de código exacto al FINAL de tu mensaje para que el sistema informático pueda leerlo:
   [KALU_CART_START] {"items": [{"product_id": "ID", "cantidad": NUMERO, "pieza_id": "ID_PIEZA_OPCIONAL"}]} [KALU_CART_END]
   - Reemplaza ID con el ID real del producto.
   - ¡IMPORTANTE!: Si el producto dice (USA PIEZAS EXACTAS), debes elegir la pieza que más se acerque al peso que pidió el cliente, y enviar su ID exacto en "pieza_id", y en "cantidad" enviar el peso exacto de esa pieza. 
   - Y en tu texto respóndele (ejemplo): "Ya agregué la pieza más cercana de [peso]kg a tu carrito."
2. Si el cliente dice "factúramelo", "listo", "ya", o pide enviar el pedido a despacho/tienda, debes enviar la señal [KALU_CHECKOUT] al final de tu mensaje y dile: "¡Claro! Procesando tu pedido... El total es $[Monto total del carrito] o su equivalente en Bs. Aquí tienes los datos para tu pago móvil: Banco Caribe (0114), Teléfono: 0424-3068286, Cédula: V-15082352. Por favor, toca el botón de abajo para revisar y confirmar tu pago."
3. Si el cliente pide solo los datos de pago móvil, entrégale estos datos exactos:
   - Banco Caribe (0114)
   - Teléfono: 0424-3068286
   - Cédula: V-15082352
4. Interpreta cantidades naturales: "medio"=0.5, "un cuarto"=0.25, "kilo"=1, "dos kilos"=2
5. Si el producto no tiene stock, díselo y sugiere alternativas disponibles.
6. Sé muy conciso: máximo 2-3 líneas. Ve al grano.`;

  const contents = audioBase64
    ? { parts: [{ inlineData: { mimeType: 'audio/webm', data: audioBase64 } }, { text: 'El cliente envió esta nota de voz. Interpreta su pedido y responde.' }] }
    : userMessage;

  const response = await ai.models.generateContent({
    model: 'gemini-2.5-flash',
    contents,
    config: { systemInstruction, temperature: 0.4 }
  });

  const fullText = response.text || '';
  const cartMatch = fullText.match(/\[KALU_CART_START\]\s*([\s\S]*?)\s*\[KALU_CART_END\]/);
  const isCheckout = fullText.includes('[KALU_CHECKOUT]');
  let cartSuggestion: { product: Product; cantidad: number }[] | undefined;
  const replyText = fullText.replace(/\[KALU_CART_START\][\s\S]*?\[KALU_CART_END\]/, '').replace(/\[KALU_CHECKOUT\]/g, '').trim();

  if (cartMatch) {
    try {
      // Limpiar comas finales que suelen romper el JSON generado por IA
      const cleanJson = cartMatch[1].replace(/,\s*([\]}])/g, '$1');
      const cartData = JSON.parse(cleanJson);
      cartSuggestion = (cartData.items as { product_id: string | number; cantidad: number; pieza_id?: string }[])
        .map(item => {
          const product = products.find(p => String(p.id) === String(item.product_id));
          if (!product) return null;
          let pieza = null;
          if (item.pieza_id && Array.isArray(product.piezas)) {
            pieza = product.piezas.find((p: any) => p.id === item.pieza_id);
          }
          return { product, cantidad: Number(item.cantidad), pieza };
        })
        .filter((x): x is { product: Product; cantidad: number; pieza: any } => x !== null);
    } catch (e) {
      console.error('Error parseando carrito de Gemini:', e, cartMatch[1]);
    }
  }

  return { reply: replyText, cartSuggestion, isCheckout };
}

// ─── Quick suggestions ──────────────────────────────────────────────────────
const QUICK_SUGGESTIONS = [
  '¿Qué hay hoy?',
  '1kg de queso llanero',
  'Medio kilo de nata',
  '2 kilos de guayanés',
];

// ─── Main Component ──────────────────────────────────────────────────────────
const AIShoppingAssistant: React.FC<AIShoppingAssistantProps> = ({
  products,
  clientName,
  clientDebt = 0,
  cart,
  tasaBcv,
  onAddToCart,
  onGoToStore,
  onShowCart,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [inputMode, setInputMode] = useState<InputMode>('text');

  // ── Rate limiting: máx 20 consultas de IA por día por dispositivo ──────────
  const AI_DAILY_LIMIT = 20;
  const getRateLimit = () => {
    try {
      const today = new Date().toISOString().split('T')[0];
      const saved = JSON.parse(localStorage.getItem('kalu_ai_usage') || '{}');
      if (saved.date !== today) return { count: 0, date: today };
      return saved;
    } catch { return { count: 0, date: new Date().toISOString().split('T')[0] }; }
  };
  const incrementRateLimit = () => {
    const current = getRateLimit();
    localStorage.setItem('kalu_ai_usage', JSON.stringify({ ...current, count: current.count + 1 }));
  };
  const aiLimitReached = getRateLimit().count >= AI_DAILY_LIMIT;
  const aiUsageToday = getRateLimit().count;
  // ─────────────────────────────────────────────────────────────────────────

  const [messages, setMessages] = useState<Message[]>([
    {
      role: 'assistant',
      text: AI_AVAILABLE
        ? `¡Hola ${clientName}! 👋 Soy **Kalu IA**. Dime qué quieres pedir por voz o texto y lo agrego al carrito automáticamente. 🧀`
        : `¡Hola ${clientName}! 👋 Puedes **escribir** tu pedido aquí y lo reviso, o ve directamente a la **tienda** para seleccionar tus productos.`
    }
  ]);
  const [inputText, setInputText] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [aiError, setAiError] = useState(false);

  // Voice recording state
  const [isRecording, setIsRecording] = useState(false);
  const [recordingSeconds, setRecordingSeconds] = useState(0);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const recordingTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleOpen = () => setIsOpen(true);
    window.addEventListener('open-ai-chat', handleOpen);
    return () => window.removeEventListener('open-ai-chat', handleOpen);
  }, []);

  useEffect(() => {
    if (isOpen) {
      setTimeout(() => messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 80);
    }
  }, [messages, isOpen]);

  const addMessage = (msg: Message) => setMessages(prev => [...prev, msg]);

  const handleSend = async (text: string, audioBase64?: string) => {
    if (!text.trim() && !audioBase64) return;
    if (isLoading) return;

    // Verificar límite diario de IA
    if (AI_AVAILABLE && getRateLimit().count >= AI_DAILY_LIMIT) {
      addMessage({ role: 'user', text: text || '🎙️ Nota de voz', isVoice: !!audioBase64 });
      setInputText('');
      addMessage({
        role: 'assistant',
        text: `⚠️ Has alcanzado el límite de **${AI_DAILY_LIMIT} consultas de IA por hoy**. Tu límite se reinicia mañana a las 12:00 AM. Puedes hacer tu pedido directamente en la tienda 👇`,
        isError: true
      });
      return;
    }

    addMessage({ role: 'user', text: text || '🎙️ Nota de voz', isVoice: !!audioBase64 });
    setInputText('');
    setIsLoading(true);
    setAiError(false);

    try {
      const { reply, cartSuggestion, isCheckout } = await parseOrderWithGemini(
        text, audioBase64 || null, products, clientName, clientDebt, tasaBcv, cart
      );
      
      // Auto-add to cart immediately if AI suggested it
      if (cartSuggestion && cartSuggestion.length > 0) {
        cartSuggestion.forEach(({ product, cantidad, pieza }) => {
          onAddToCart(product, cantidad, pieza?.id);
        });
      }

      addMessage({ role: 'assistant', text: reply, cartSuggestion: undefined, isCheckout });
      incrementRateLimit();
    } catch (err: any) {
      console.error('Gemini Request Error:', err);
      setAiError(true);
      addMessage({
        role: 'assistant',
        text: err?.message === 'NO_API_KEY'
          ? 'La IA no está configurada aún. Puedes hacer tu pedido en la tienda manualmente. 👇'
          : err?.status === 429
          ? 'Estoy muy ocupado ahora mismo. Intenta en un momento o ve a la tienda. 🙏'
          : 'Tuve un problema. Puedes intentarlo de nuevo o ir a la tienda directamente. 👇',
        isError: true
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleAddSuggestionToCart = (suggestion: { product: Product; cantidad: number; pieza?: any }[]) => {
    suggestion.forEach(({ product, cantidad, pieza }) => {
      onAddToCart(product, cantidad, pieza?.id);
    });
    addMessage({
      role: 'assistant',
      text: `✅ Agregué ${suggestion.map(s => `${s.cantidad}kg de ${s.product.nombre}`).join(', ')} a tu carrito. ¿Algo más?`
    });
  };

  // ── Voice recording ────────────────────────────────────────────────────────
  const startRecording = async () => {
    if (!AI_AVAILABLE) {
      addMessage({ role: 'assistant', text: 'La IA de voz no está disponible. Escribe tu pedido o ve a la tienda. 👇', isError: true });
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mr = new MediaRecorder(stream, { mimeType: 'audio/webm' });
      mediaRecorderRef.current = mr;
      audioChunksRef.current = [];

      mr.ondataavailable = e => { if (e.data.size > 0) audioChunksRef.current.push(e.data); };
      mr.onstop = () => {
        stream.getTracks().forEach(t => t.stop());
        const blob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        const reader = new FileReader();
        reader.onloadend = () => {
          const base64 = (reader.result as string).split(',')[1];
          handleSend('', base64);
        };
        reader.readAsDataURL(blob);
      };

      mr.start();
      setIsRecording(true);
      setRecordingSeconds(0);
      recordingTimerRef.current = setInterval(() => setRecordingSeconds(s => s + 1), 1000);
    } catch {
      alert('No se pudo acceder al micrófono. Por favor permite el acceso en tu navegador.');
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      if (recordingTimerRef.current) clearInterval(recordingTimerRef.current);
    }
  };

  const fmt = (text: string) =>
    text.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>').replace(/\n/g, '<br/>');

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <>
      {/* Floating Bubble */}
      <AnimatePresence>
        {!isOpen && (
          <motion.button
            initial={{ scale: 0, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0, opacity: 0 }}
            onClick={() => setIsOpen(true)}
            className="fixed bottom-28 right-4 z-40 w-16 h-16 rounded-full flex items-center justify-center shadow-2xl border-2 border-emerald-300 overflow-hidden"
            title="Habla con Day, tu asistente IA"
          >
            <div className="relative w-full h-full">
              <img src="/day_avatar.jpg" className="w-full h-full object-cover" alt="Day AI" />
              <span className="absolute -top-1 -right-1 w-4 h-4 bg-[#25D366] rounded-full border-2 border-[#075E54] animate-pulse" />
            </div>
          </motion.button>
        )}
      </AnimatePresence>

      {/* Chat Window */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: 60, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 60, scale: 0.9 }}
            transition={{ type: 'spring', damping: 25, stiffness: 300 }}
            className="fixed bottom-4 right-2 left-2 md:left-auto md:right-4 md:w-[400px] z-50 flex flex-col rounded-3xl overflow-hidden shadow-2xl"
            style={{ maxHeight: 'calc(100dvh - 100px)', background: '#111B21', border: '1px solid rgba(255,255,255,0.08)' }}
          >

            {/* ── Header ── */}
            <div className="flex items-center gap-3 px-4 py-3 shrink-0" style={{ background: '#1F2C34' }}>
              <div className="w-10 h-10 rounded-full flex items-center justify-center shrink-0 overflow-hidden border border-emerald-300">
                <img src="/day_avatar.jpg" className="w-full h-full object-cover" alt="Day AI" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-bold text-white text-sm">Kalu IA</p>
                <p className="text-[#25D366] text-xs flex items-center gap-1">
                  <span className="w-1.5 h-1.5 bg-[#25D366] rounded-full animate-pulse" />
                  {AI_AVAILABLE ? 'Asistente activo' : 'Modo manual disponible'}
                </p>
              </div>
              <button onClick={() => setIsOpen(false)}
                className="text-gray-400 hover:text-white p-1.5 rounded-full hover:bg-white/10 transition-colors">
                <X size={20} />
              </button>
            </div>

            {/* ── Mode Selector ── */}
            <div className="flex gap-1 px-3 pt-3 pb-1 shrink-0" style={{ background: '#0B141A' }}>
              <p className="text-gray-500 text-xs mr-1 self-center">¿Cómo quieres pedir?</p>
              <button
                onClick={() => setInputMode('text')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold transition-all ${inputMode === 'text' ? 'bg-[#25D366] text-black' : 'bg-white/5 text-gray-400 hover:bg-white/10'}`}
              >
                <Keyboard size={12} /> Texto
              </button>
              <button
                onClick={() => setInputMode('voice')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold transition-all ${inputMode === 'voice' ? 'bg-[#25D366] text-black' : 'bg-white/5 text-gray-400 hover:bg-white/10'}`}
              >
                <Mic size={12} /> Voz
              </button>
              <button
                onClick={() => { setIsOpen(false); onGoToStore?.(); }}
                className="ml-auto flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold bg-blue-600/20 text-blue-400 hover:bg-blue-600/30 transition-all border border-blue-500/20"
              >
                <Store size={12} /> Tienda
              </button>
            </div>

            {/* ── Messages ── */}
            <div className="flex-1 overflow-y-auto px-3 py-3 space-y-3" style={{ background: '#0B141A' }}>
              {messages.map((msg, i) => (
                <div key={i} className={`flex gap-2 ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                  {msg.role === 'assistant' && (
                    <div className="w-7 h-7 rounded-full shrink-0 flex items-center justify-center mt-1"
                      style={{ background: msg.isError ? '#7F1D1D' : 'linear-gradient(135deg, #075E54, #25D366)' }}>
                      {msg.isError ? <AlertTriangle size={14} className="text-red-400" /> : <Bot size={14} className="text-white" />}
                    </div>
                  )}
                  <div className="max-w-[82%] space-y-2">
                    <div
                      className="px-3 py-2.5 rounded-2xl text-sm leading-relaxed"
                      style={{
                        background: msg.role === 'user' ? '#005C4B' : msg.isError ? '#2D1515' : '#1F2C34',
                        borderRadius: msg.role === 'user' ? '18px 18px 4px 18px' : '18px 18px 18px 4px',
                        color: msg.isError ? '#FCA5A5' : '#E9EEF0'
                      }}
                    >
                      {msg.isVoice && (
                        <span className="flex items-center gap-1 text-[#25D366] text-xs mb-1">
                          <Volume2 size={12} /> Nota de voz
                        </span>
                      )}
                      <span dangerouslySetInnerHTML={{ __html: fmt(msg.text) }} />
                    </div>

                    {/* Cart suggestion card */}
                    {msg.cartSuggestion && msg.cartSuggestion.length > 0 && (
                      <div className="rounded-2xl overflow-hidden border border-[#25D366]/30" style={{ background: '#1F2C34' }}>
                        <div className="px-3 pt-3 pb-1">
                          <p className="text-xs text-[#25D366] font-bold uppercase tracking-wider mb-2 flex items-center gap-1">
                            <ShoppingCart size={12} /> Pedido detectado
                          </p>
                          {msg.cartSuggestion.map((item, idx) => (
                            <div key={idx} className="flex justify-between items-center py-1.5 border-b border-white/5 last:border-0">
                              <span className="text-white text-xs font-medium">{item.product.nombre}</span>
                              <span className="text-gray-400 text-xs">{item.cantidad}kg · <span className="text-[#25D366]">${((item.product.precio_oferta_usd || item.product.precio_normal_usd) * item.cantidad).toFixed(2)}</span></span>
                            </div>
                          ))}
                        </div>
                        <button
                          onClick={() => handleAddSuggestionToCart(msg.cartSuggestion!)}
                          className="w-full py-2.5 text-sm font-bold text-white flex items-center justify-center gap-2 hover:opacity-90 transition-opacity active:scale-95"
                          style={{ background: 'linear-gradient(90deg, #075E54, #128C7E)' }}
                        >
                          <ShoppingCart size={16} /> Agregar al Carrito
                        </button>
                      </div>
                    )}

                    {/* Checkout Button */}
                    {msg.isCheckout && onShowCart && (
                      <button
                        onClick={() => { setIsOpen(false); onShowCart(); }}
                        className="w-full mt-2 py-2.5 text-sm font-bold text-white flex items-center justify-center gap-2 hover:opacity-90 transition-opacity active:scale-95 rounded-2xl shadow-lg shadow-orange-500/20 border border-orange-500/30"
                        style={{ background: 'linear-gradient(90deg, #ea580c, #c2410c)' }}
                      >
                        <ShoppingCart size={16} /> Ver Carrito y Facturar
                      </button>
                    )}

                    {/* Go to store fallback button */}
                    {msg.isError && onGoToStore && (
                      <button
                        onClick={() => { setIsOpen(false); onGoToStore(); }}
                        className="w-full flex items-center justify-between gap-2 px-4 py-3 rounded-2xl text-sm font-bold text-blue-300 hover:opacity-90 transition-all active:scale-95 border border-blue-500/30"
                        style={{ background: '#1A2744' }}
                      >
                        <span className="flex items-center gap-2"><Store size={16} /> Ir a la tienda manual</span>
                        <ChevronRight size={16} />
                      </button>
                    )}
                  </div>
                </div>
              ))}

              {isLoading && (
                <div className="flex gap-2 justify-start">
                  <div className="w-7 h-7 rounded-full shrink-0 flex items-center justify-center"
                    style={{ background: 'linear-gradient(135deg, #075E54, #25D366)' }}>
                    <Bot size={14} className="text-white" />
                  </div>
                  <div className="px-4 py-3 rounded-2xl" style={{ background: '#1F2C34', borderRadius: '18px 18px 18px 4px' }}>
                    <div className="flex gap-1 items-center">
                      {[0, 150, 300].map(d => (
                        <div key={d} className="w-2 h-2 rounded-full bg-[#25D366] animate-bounce" style={{ animationDelay: `${d}ms` }} />
                      ))}
                    </div>
                  </div>
                </div>
              )}
              <div ref={messagesEndRef} />
            </div>

            {/* ── Quick suggestions ── */}
            {inputMode === 'text' && (
              <div className="flex gap-2 overflow-x-auto px-3 py-2 shrink-0 scrollbar-hide"
                style={{ background: '#0B141A', borderTop: '1px solid rgba(255,255,255,0.04)' }}>
                {QUICK_SUGGESTIONS.map(s => (
                  <button key={s} onClick={() => handleSend(s)} disabled={isLoading}
                    className="shrink-0 text-xs px-3 py-1.5 rounded-full border border-[#25D366]/30 text-[#25D366] hover:bg-[#25D366]/10 transition-colors whitespace-nowrap disabled:opacity-40">
                    {s}
                  </button>
                ))}
              </div>
            )}

            {/* ── Input Area ── */}
            <div className="px-3 py-3 shrink-0" style={{ background: '#1F2C34' }}>
              {inputMode === 'text' ? (
                /* TEXT MODE */
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    value={inputText}
                    onChange={e => setInputText(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && !isLoading && handleSend(inputText)}
                    placeholder="Escribe tu pedido aquí..."
                    disabled={isLoading}
                    className="flex-1 bg-[#0B141A] text-white text-sm rounded-full px-4 py-3 outline-none border border-transparent focus:border-[#25D366]/40 placeholder-gray-600 disabled:opacity-50"
                    autoFocus
                  />
                  <button
                    onClick={() => handleSend(inputText)}
                    disabled={isLoading || !inputText.trim()}
                    className="w-11 h-11 rounded-full flex items-center justify-center shrink-0 transition-all active:scale-95 disabled:opacity-40"
                    style={{ background: 'linear-gradient(135deg, #075E54, #25D366)' }}
                  >
                    {isLoading ? <Loader2 size={18} className="text-white animate-spin" /> : <Send size={18} className="text-white" />}
                  </button>
                </div>
              ) : (
                /* VOICE MODE */
                <div className="flex flex-col items-center gap-3">
                  {isRecording ? (
                    <div className="flex flex-col items-center gap-2 w-full">
                      <div className="flex items-center gap-2 bg-[#0B141A] rounded-full px-6 py-2.5 w-full justify-center">
                        <div className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
                        <span className="text-red-400 text-sm font-bold">Grabando... {recordingSeconds}s</span>
                      </div>
                      <button
                        onPointerUp={stopRecording}
                        className="w-20 h-20 rounded-full bg-red-600 hover:bg-red-500 flex items-center justify-center shadow-xl shadow-red-600/40 active:scale-95 transition-all"
                      >
                        <MicOff size={30} className="text-white" />
                      </button>
                      <p className="text-gray-500 text-xs">Suelta para enviar</p>
                    </div>
                  ) : (
                    <div className="flex flex-col items-center gap-2 w-full">
                      <p className="text-gray-400 text-xs text-center">Mantén presionado el micrófono y habla tu pedido</p>
                      <button
                        onPointerDown={startRecording}
                        disabled={isLoading}
                        className="w-20 h-20 rounded-full flex items-center justify-center shadow-xl active:scale-95 transition-all disabled:opacity-50"
                        style={{ background: 'linear-gradient(135deg, #075E54, #25D366)', boxShadow: '0 8px 24px rgba(37,211,102,0.35)' }}
                      >
                        {isLoading ? <Loader2 size={30} className="text-white animate-spin" /> : <Mic size={30} className="text-white" />}
                      </button>
                      <p className="text-gray-600 text-[10px]">Ejemplo: "Quiero un kilo de llanero y medio de nata"</p>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* ── Footer ── */}
            <div className="text-center py-1.5 shrink-0" style={{ background: '#1F2C34', borderTop: '1px solid rgba(255,255,255,0.04)' }}>
              <p className="text-[10px] text-gray-600 flex items-center justify-center gap-1">
                <Sparkles size={10} /> Potenciado por Gemini AI · Kalu Queso San Juan
              </p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
};

export default AIShoppingAssistant;
