import React, { useState } from 'react';
import { X, Save, Box, Image as ImageIcon, Upload, Loader2, Mic, Zap } from 'lucide-react';
import { cn } from '../../lib/utils';
import { addDocument, updateDocument, getActiveStoreId } from '../../lib/dbUtils';
import { storage } from '../../lib/firebase';
import { ref, uploadBytesResumable, getDownloadURL } from 'firebase/storage';
import { type Product, type PiezaProducto } from '../../types';
import { interactWithInvoiceIA } from '../../services/geminiService'; // Reusing or creating a new service
import { useToast } from '../../contexts/ToastProvider';

interface ProductModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  initialData?: Product | null;
}

const ProductModal: React.FC<ProductModalProps> = ({ isOpen, onClose, onSuccess, initialData }) => {
  const [loading, setLoading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [formData, setFormData] = useState({
    codigo: initialData?.codigo || '',
    nombre: initialData?.nombre || '',
    categoria: initialData?.categoria || '',
    costo_usd: initialData?.costo_usd?.toString() || '',
    precio_normal_usd: initialData?.precio_normal_usd?.toString() || '',
    margen_ganancia: initialData?.margen_ganancia?.toString() || '',
    stock: initialData?.stock?.toString() || '',
    stock_minimo: initialData?.stock_minimo?.toString() || '',
    unidad_medida: initialData?.unidad_medida || 'UNIDAD',
  });
  const [usaPiezas, setUsaPiezas] = useState(initialData?.usa_piezas || false);
  const [piezas, setPiezas] = useState<PiezaProducto[]>(initialData?.piezas || []);
  const [newPiezaNum, setNewPiezaNum] = useState('');
  const [newPiezaPeso, setNewPiezaPeso] = useState('');
  const [isListening, setIsListening] = useState(false);
  const [aiAdjusting, setAiAdjusting] = useState(false);
  const [aiDictation, setAiDictation] = useState('');
  const [showPieceEditor, setShowPieceEditor] = useState(false);
  const { addToast } = useToast();

  React.useEffect(() => {
    if (isOpen) {
      setFormData({
        codigo: initialData?.codigo || '',
        nombre: initialData?.nombre || '',
        categoria: initialData?.categoria || '',
        costo_usd: initialData?.costo_usd?.toString() || '',
        precio_normal_usd: initialData?.precio_normal_usd?.toString() || '',
        margen_ganancia: initialData?.margen_ganancia?.toString() || '',
        stock: initialData?.stock?.toString() || '',
        stock_minimo: initialData?.stock_minimo?.toString() || '',
        unidad_medida: initialData?.unidad_medida || 'UNIDAD',
      });
      setUsaPiezas(initialData?.usa_piezas || false);
      setPiezas(initialData?.piezas || []);
      setNewPiezaNum('');
      setNewPiezaPeso('');
      setImage1(null);
      setImage2(null);
      setUploadProgress(0);
    }
  }, [isOpen, initialData]);

  const [image1, setImage1] = useState<File | null>(null);
  const [image2, setImage2] = useState<File | null>(null);

  if (!isOpen) return null;

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    
    setFormData(prev => {
      const nextState = { ...prev, [name]: value };
      
      // Auto-calcular el precio de venta si se cambia el costo o el margen
      if (name === 'costo_usd' || name === 'margen_ganancia') {
        const cost = Number(name === 'costo_usd' ? value : prev.costo_usd) || 0;
        const margin = Number(name === 'margen_ganancia' ? value : prev.margen_ganancia) || 0;
        if (cost > 0 && margin >= 0) {
          nextState.precio_normal_usd = (cost + (cost * margin / 100)).toFixed(2);
        }
      }
      
      return nextState;
    });
  };

  const uploadImage = async (file: File, path: string): Promise<string> => {
    if (!storage) throw new Error("Firebase Storage no está configurado");
    return new Promise((resolve, reject) => {
      const storageRef = ref(storage, path);
      const uploadTask = uploadBytesResumable(storageRef, file);

      const timeout = setTimeout(() => {
        uploadTask.cancel();
        reject(new Error("Tiempo de espera agotado. Verifica tu conexión y las reglas de Storage."));
      }, 20000); // 20 segundos máximo

      uploadTask.on(
        'state_changed',
        (snapshot) => {
          const progress = (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
          setUploadProgress(progress);
        },
        (error) => {
          clearTimeout(timeout);
          console.error("Error subiendo imagen:", error);
          reject(error);
        },
        async () => {
          clearTimeout(timeout);
          try {
            const downloadURL = await getDownloadURL(uploadTask.snapshot.ref);
            resolve(downloadURL);
          } catch (err) {
            reject(err);
          }
        }
      );
    });
  };

  const handleSubmit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setLoading(true);
    setUploadProgress(0);
    try {
      let imagen_url = '';
      let imagen_secundaria_url = '';

      if (image1) {
        imagen_url = await uploadImage(image1, `products/${Date.now()}_1_${image1.name}`);
      }
      if (image2) {
        imagen_secundaria_url = await uploadImage(image2, `products/${Date.now()}_2_${image2.name}`);
      }

      const rawProduct = {
        storeId: initialData?.storeId || getActiveStoreId(),
        codigo: formData.codigo,
        nombre: formData.nombre,
        categoria: formData.categoria || 'GENERAL',
        costo_usd: Number(formData.costo_usd),
        precio_normal_usd: Number(formData.precio_normal_usd),
        margen_ganancia: Number(formData.margen_ganancia) || 0,
        stock_minimo: Number(formData.stock_minimo),
        unidad_medida: formData.unidad_medida,
        usa_piezas: usaPiezas,
        piezas: usaPiezas ? piezas : [],
        stock: Number(formData.stock),
        imagen_url: imagen_url || initialData?.imagen_url || '',
        imagen_secundaria_url: imagen_secundaria_url || initialData?.imagen_secundaria_url || '',
      };

      // Sanitize to remove any undefined values that could crash Firebase
      const newProduct = JSON.parse(JSON.stringify(rawProduct));

      if (initialData?.id) {
        await updateDocument('products', initialData.id, newProduct);
      } else {
        await addDocument('products', newProduct);
      }
      
      // Limpiar y cerrar
      setFormData({
        codigo: '', nombre: '', categoria: '', costo_usd: '', precio_normal_usd: '', margen_ganancia: '', stock: '', stock_minimo: '', unidad_medida: 'UNIDAD'
      });
      setImage1(null);
      setImage2(null);
      setUploadProgress(0);
      
      onSuccess();
      onClose();
    } catch (error: any) {
      console.error("Error creating product:", error);
      alert("Error al guardar: " + (error.message || "Verifica tu conexión y Firebase Storage."));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div 
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
      />
      
      <div className={cn(
        "relative bg-[#0f172a] border border-white/10 rounded-3xl w-full overflow-hidden shadow-2xl animate-in fade-in zoom-in-95 duration-200 flex flex-col h-[90vh]",
        usaPiezas ? "max-w-5xl" : "max-w-3xl"
      )}>
        <div className="p-4 border-b border-white/5 flex items-center justify-between bg-white/5 flex-shrink-0">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-[#3498db] rounded-xl shadow-lg shadow-[#3498db]/20">
              <Box size={20} className="text-white" />
            </div>
            <h2 className="text-xl font-black text-white">{initialData ? 'EDITAR PRODUCTO' : 'NUEVO PRODUCTO'}</h2>
            
            {usaPiezas && (
              <button
                type="button"
                onClick={() => setShowPieceEditor(true)}
                className="ml-4 bg-[#3498db] text-white px-4 py-2 rounded-xl text-xs font-black uppercase tracking-widest hover:bg-[#2980b9] transition-colors shadow-lg shadow-[#3498db]/20"
              >
                PIEZAS EXACTAS
              </button>
            )}
          </div>
          <button 
            onClick={onClose}
            className="p-2 text-gray-400 hover:text-white hover:bg-white/10 rounded-xl transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 overflow-y-auto custom-scrollbar flex-1 space-y-8">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Campos de texto */}
            <div className="space-y-2">
              <label className="text-xs font-bold text-gray-400 uppercase tracking-wider">Código</label>
              <input
                required
                name="codigo"
                value={formData.codigo}
                onChange={handleChange}
                className="w-full bg-black/20 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-[#3498db] transition-colors"
                placeholder="Ej: PROD-001"
              />
            </div>
            <div className="space-y-2">
              <label className="text-xs font-bold text-gray-400 uppercase tracking-wider">Nombre del Producto</label>
              <input
                required
                name="nombre"
                value={formData.nombre}
                onChange={handleChange}
                className="w-full bg-black/20 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-[#3498db] transition-colors"
                placeholder="Ej: Harina PAN"
              />
            </div>
            <div className="space-y-2">
              <label className="text-xs font-bold text-gray-400 uppercase tracking-wider">Categoría</label>
              <input
                required
                name="categoria"
                value={formData.categoria}
                onChange={handleChange}
                className="w-full bg-black/20 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-[#3498db] transition-colors"
                placeholder="Ej: VÍVERES"
              />
            </div>
            <div className="space-y-2">
              <label className="text-xs font-bold text-gray-400 uppercase tracking-wider">Unidad de Medida</label>
              <select
                name="unidad_medida"
                value={formData.unidad_medida}
                onChange={handleChange}
                className="w-full bg-black/20 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-[#3498db] transition-colors appearance-none"
              >
                <option value="UNIDAD">UNIDAD</option>
                <option value="KG">KILOGRAMOS (KG)</option>
                <option value="LITRO">LITROS (L)</option>
                <option value="GR">GRAMOS (GR)</option>
              </select>
            </div>
            <div className="space-y-2">
              <label className="text-xs font-bold text-gray-400 uppercase tracking-wider">Costo (USD)</label>
              <input
                required
                type="number"
                step="0.01"
                min="0"
                name="costo_usd"
                value={formData.costo_usd}
                onChange={handleChange}
                className="w-full bg-black/20 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-[#3498db] transition-colors"
                placeholder="0.00"
              />
            </div>
            <div className="space-y-2">
              <label className="text-xs font-bold text-gray-400 uppercase tracking-wider">Margen Ganancia (%)</label>
              <input
                type="number"
                step="0.01"
                min="0"
                name="margen_ganancia"
                value={formData.margen_ganancia}
                onChange={handleChange}
                className="w-full bg-black/20 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-[#3498db] transition-colors"
                placeholder="0"
              />
            </div>
            <div className="space-y-2">
              <label className="text-xs font-bold text-gray-400 uppercase tracking-wider">Precio Venta (USD)</label>
              <input
                required
                type="number"
                step="0.01"
                min="0"
                name="precio_normal_usd"
                value={formData.precio_normal_usd}
                onChange={handleChange}
                className="w-full bg-black/20 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-[#3498db] transition-colors"
                placeholder="0.00"
              />
            </div>
            <div className="space-y-2">
                <label className="text-xs font-bold text-gray-400 uppercase tracking-wider">Stock Inicial ({formData.unidad_medida})</label>
                <input
                  required
                  type="number"
                  min="0"
                  step="0.001"
                  name="stock"
                  value={formData.stock}
                  onChange={handleChange}
                  className="w-full bg-black/20 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-[#3498db] transition-colors"
                  placeholder="0"
                />
              </div>
            <div className="space-y-2">
              <label className="text-xs font-bold text-gray-400 uppercase tracking-wider">Stock Mínimo</label>
              <input
                required
                type="number"
                min="0"
                name="stock_minimo"
                value={formData.stock_minimo}
                onChange={handleChange}
                className="w-full bg-black/20 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-[#3498db] transition-colors"
                placeholder="0"
              />
            </div>
          </div>

          {/* Control por Piezas */}
          <div className="border-t border-white/5 pt-6 space-y-4">
            <label className="flex items-center gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={usaPiezas}
                onChange={(e) => setUsaPiezas(e.target.checked)}
                className="w-5 h-5 rounded border-white/10 bg-black/20 text-[#3498db] focus:ring-[#3498db]"
              />
              <span className="text-sm font-bold text-white uppercase tracking-wider">Controlar por piezas exactas (Ej: Queso)</span>
            </label>

            {usaPiezas && (
              <div className="bg-black/20 rounded-2xl p-4 border border-white/10 space-y-4">
                <div className="flex justify-between items-center pt-2">
                  <span className="text-xs font-bold text-gray-400 uppercase tracking-widest">
                    Stock a Granel (Sin Pieza): <span className="text-white">{(Number(formData.stock) - piezas.filter(p => !p.vendida).reduce((acc, p) => acc + p.peso, 0)).toFixed(3)} {formData.unidad_medida}</span>
                  </span>
                  <span className="text-xs font-bold text-gray-400 uppercase tracking-widest">
                    Stock en Piezas: <span className="text-[#3498db]">{piezas.filter(p => !p.vendida).reduce((acc, p) => acc + p.peso, 0).toFixed(3)} {formData.unidad_medida}</span> ({piezas.filter(p => !p.vendida).length} piezas)
                  </span>
                </div>
                <div className="text-center mt-2">
                  <span className="text-[10px] text-gray-500 font-bold uppercase tracking-widest">
                    Usa el botón "PIEZAS EXACTAS" en la parte superior para administrar los pesos con Inteligencia Artificial.
                  </span>
                </div>
              </div>
            )}
          </div>

          {/* Subida de Imágenes */}
          <div className="border-t border-white/5 pt-6">
            <h3 className="text-sm font-black text-white flex items-center gap-2 mb-4 uppercase tracking-wider">
              <ImageIcon size={16} className="text-[#3498db]" /> Fotografías del Producto
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              
              {/* Imagen Principal */}
              <div className="space-y-3">
                <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest block text-center">Imagen Principal</label>
                <div className="relative group cursor-pointer h-40 border-2 border-dashed border-white/10 rounded-2xl hover:border-[#3498db]/50 transition-colors bg-black/20 flex flex-col items-center justify-center overflow-hidden">
                  <input 
                    type="file" 
                    accept="image/*" 
                    onChange={(e) => setImage1(e.target.files?.[0] || null)}
                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
                  />
                  {image1 ? (
                    <img src={URL.createObjectURL(image1)} alt="Preview 1" className="w-full h-full object-cover" />
                  ) : (
                    <div className="text-center p-4">
                      <Upload size={24} className="mx-auto text-gray-500 mb-2 group-hover:text-[#3498db] transition-colors" />
                      <span className="text-xs text-gray-500 font-bold">Haz clic o arrastra foto aquí</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Imagen Secundaria */}
              <div className="space-y-3">
                <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest block text-center">Imagen Secundaria (Opcional)</label>
                <div className="relative group cursor-pointer h-40 border-2 border-dashed border-white/10 rounded-2xl hover:border-[#3498db]/50 transition-colors bg-black/20 flex flex-col items-center justify-center overflow-hidden">
                  <input 
                    type="file" 
                    accept="image/*" 
                    onChange={(e) => setImage2(e.target.files?.[0] || null)}
                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
                  />
                  {image2 ? (
                    <img src={URL.createObjectURL(image2)} alt="Preview 2" className="w-full h-full object-cover" />
                  ) : (
                    <div className="text-center p-4">
                      <Upload size={24} className="mx-auto text-gray-500 mb-2 group-hover:text-[#3498db] transition-colors" />
                      <span className="text-xs text-gray-500 font-bold">Haz clic o arrastra foto aquí</span>
                    </div>
                  )}
                </div>
              </div>

            </div>

            {loading && uploadProgress > 0 && uploadProgress < 100 && (
              <div className="mt-6 space-y-2">
                <div className="flex justify-between text-xs font-bold text-gray-400">
                  <span>Subiendo imágenes...</span>
                  <span>{Math.round(uploadProgress)}%</span>
                </div>
                <div className="w-full bg-white/5 rounded-full h-2">
                  <div className="bg-[#3498db] h-2 rounded-full transition-all duration-300" style={{ width: `${uploadProgress}%` }}></div>
                </div>
              </div>
            )}
          </div>

          <div className="flex items-center justify-end gap-3 pt-6 border-t border-white/5 mt-4">
            <button
              type="button"
              onClick={onClose}
              className="px-6 py-3 rounded-xl font-bold text-gray-400 hover:text-white hover:bg-white/5 transition-colors"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={loading}
              className={cn(
                "px-8 py-3 rounded-xl font-bold text-white shadow-lg transition-all flex items-center gap-2",
                loading ? "bg-gray-600 cursor-not-allowed" : "bg-[#3498db] hover:bg-[#2980b9] shadow-[#3498db]/20 hover:scale-105 active:scale-95"
              )}
            >
              <Save size={18} />
              {loading ? 'Guardando...' : 'Guardar Producto'}
            </button>
          </div>
        </form>
      </div>

      {showPieceEditor && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/90 backdrop-blur-md" onClick={() => setShowPieceEditor(false)} />
          <div className="relative bg-[#0f172a] border border-white/10 rounded-3xl w-full max-w-5xl h-[95vh] flex flex-col shadow-2xl animate-in fade-in zoom-in-95 duration-200">
            {/* Header del Sub-Modal */}
            <div className="p-6 border-b border-white/5 flex items-center justify-between bg-white/5 flex-shrink-0">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-[#3498db] rounded-xl shadow-lg shadow-[#3498db]/20">
                  <Box size={20} className="text-white" />
                </div>
                <h2 className="text-xl font-black text-white">CONTROL DE PIEZAS EXACTAS</h2>
              </div>
              <button 
                onClick={() => setShowPieceEditor(false)}
                className="p-2 text-gray-400 hover:text-white hover:bg-white/10 rounded-xl transition-colors"
              >
                <X size={20} />
              </button>
            </div>

            {/* Cuerpo del Sub-Modal */}
            <div className="p-6 overflow-hidden flex-1 flex flex-col">
              <div className="flex flex-col md:flex-row justify-between items-center gap-4 mb-4">
                <h4 className="text-sm font-bold text-gray-400 uppercase tracking-widest">Lotes de Piezas ({piezas.length}/200)</h4>
                
                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      // @ts-ignore
                      const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
                      if (!SpeechRecognition) {
                        addToast('error', 'Tu navegador no soporta reconocimiento de voz');
                        return;
                      }

                      const recognition = new SpeechRecognition();
                      recognition.lang = 'es-VE';
                      recognition.continuous = false;
                      recognition.interimResults = false;

                      recognition.onstart = () => setIsListening(true);
                      
                      recognition.onresult = (event: any) => {
                        const transcript = event.results[0][0].transcript;
                        setAiDictation(transcript);
                        setIsListening(false);
                      };

                      recognition.onerror = () => setIsListening(false);
                      recognition.onend = () => setIsListening(false);
                      recognition.start();
                    }}
                    disabled={aiAdjusting || isListening}
                    className={cn(
                      "p-3 rounded-xl transition-colors shadow-md flex items-center justify-center",
                      isListening ? "bg-red-500 text-white animate-pulse" : "bg-black/40 border border-white/10 text-gray-300 hover:text-white hover:border-white/30"
                    )}
                    title="Dictar pesos"
                  >
                    <Mic size={20} />
                  </button>

                  <input 
                    type="text"
                    value={aiDictation}
                    onChange={(e) => setAiDictation(e.target.value)}
                    placeholder="Ej. la 1 es 400g..."
                    className="bg-black/30 border border-white/10 rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:border-[#9b59b6] w-48 sm:w-64"
                  />

                  <button
                    type="button"
                    onClick={async () => {
                       if (!aiDictation.trim()) return;
                       setAiAdjusting(true);
                        try {
                          const { fillPiecesWithIA } = await import('../../services/geminiService');
                          const result = await fillPiecesWithIA(piezas, aiDictation);
                          if (Array.isArray(result)) {
                            setPiezas(result);
                            setAiDictation('');
                            addToast('success', 'Pesos rellenados por la IA');
                          } else if (result.error) {
                            addToast('error', result.error);
                          }
                        } catch (error) {
                          addToast('error', 'Error comunicándose con la IA');
                        } finally {
                          setAiAdjusting(false);
                        }
                    }}
                    disabled={aiAdjusting || !aiDictation.trim() || isListening}
                    className="flex items-center gap-2 px-5 py-3 bg-[#9b59b6] text-white rounded-xl text-xs font-black uppercase tracking-widest hover:bg-[#8e44ad] transition-colors disabled:opacity-50"
                  >
                    {aiAdjusting ? <Loader2 size={16} className="animate-spin" /> : <Zap size={16} />}
                    APLICAR IA
                  </button>

                  <button 
                    type="button" 
                    onClick={() => {
                    if (piezas.length >= 200) return;
                    const itemsToAdd = Math.min(10, 200 - piezas.length);
                    const occupiedNumbers = new Set(piezas.map(p => Number(p.numero)).filter(n => !isNaN(n)));
                    
                    const newPiezas = [];
                    let currentNum = 1;
                    
                    for (let i = 0; i < itemsToAdd; i++) {
                      while (occupiedNumbers.has(currentNum)) {
                        currentNum++;
                      }
                      newPiezas.push({
                        id: crypto.randomUUID ? crypto.randomUUID() : Date.now().toString() + Math.random().toString(),
                        numero: String(currentNum),
                        peso: 0,
                        vendida: false
                      });
                      occupiedNumbers.add(currentNum);
                    }
                    
                    setPiezas([...piezas, ...newPiezas].sort((a, b) => Number(a.numero) - Number(b.numero)));
                  }}
                  disabled={piezas.length >= 200}
                  className="bg-[#3498db] text-white px-5 py-3 rounded-xl text-xs font-black uppercase tracking-widest hover:bg-[#2980b9] transition-colors disabled:opacity-50 disabled:cursor-not-allowed ml-auto"
                >
                  + AGREGAR 10 PIEZAS
                </button>
                </div>
              </div>

              {piezas.length > 0 ? (
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3 mt-4 overflow-y-auto custom-scrollbar pr-2 flex-1 pb-10 content-start">
                  {piezas.map((p, i) => (
                    <div key={p.id} className={`flex items-center gap-2 p-3 rounded-xl border ${p.vendida ? 'bg-red-500/10 border-red-500/20 opacity-50' : p.peso > 0 ? 'bg-[#3498db]/10 border-[#3498db]/30' : 'bg-black/40 border-white/10'}`}>
                      <div className="flex-1 flex items-center gap-2 relative">
                        <span className="text-sm font-black text-gray-500 w-8">#{p.numero}</span>
                        <input
                          type="number"
                          step="0.001"
                          min="0"
                          value={p.peso || ''}
                          onChange={(e) => {
                            const newPiezas = [...piezas];
                            newPiezas[i].peso = Number(e.target.value);
                            setPiezas(newPiezas);
                          }}
                          onBlur={() => {
                            const newPiezas = [...piezas];
                            let val = newPiezas[i].peso;
                            // Auto-corrección: Si ponen un peso absurdo (>50) en un producto de Kg, asumimos que pusieron gramos.
                            if (val > 50 && (formData.unidad_medida?.toLowerCase() === 'kg' || formData.unidad_medida?.toLowerCase() === 'kilos')) {
                              newPiezas[i].peso = val / 1000;
                              setPiezas(newPiezas);
                            }
                          }}
                          disabled={p.vendida}
                          placeholder="Ej: 0.560"
                          className="w-full bg-transparent border-b border-white/10 focus:border-[#3498db] outline-none text-white font-bold text-lg px-1 py-1 pr-8"
                        />
                        <span className="absolute right-1 text-xs text-gray-500 pointer-events-none font-bold uppercase">
                          {formData.unidad_medida}
                        </span>
                      </div>
                      {!p.vendida && (
                        <button
                          type="button"
                          onClick={() => setPiezas(piezas.filter((_, index) => index !== i))}
                          className="text-red-400 hover:text-red-300 p-2 bg-red-500/10 rounded-xl shrink-0"
                        >
                          <X size={16} />
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <div className="flex-1 flex flex-col items-center justify-center text-gray-500 opacity-50">
                  <Box size={64} className="mb-4" />
                  <p className="font-bold uppercase tracking-widest">No hay piezas agregadas</p>
                </div>
              )}
            </div>

            {/* Footer del Sub-Modal */}
            <div className="p-4 border-t border-white/5 bg-white/5 flex items-center justify-between flex-shrink-0">
               <span className="text-xs font-bold text-gray-400 uppercase tracking-widest">
                Stock Total de estas {piezas.filter(p => !p.vendida).length} piezas: <span className="text-white text-sm">{piezas.filter(p => !p.vendida).reduce((acc, p) => acc + p.peso, 0).toFixed(3)} {formData.unidad_medida}</span>
              </span>
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => setShowPieceEditor(false)}
                  className="text-gray-400 px-4 py-2.5 rounded-xl font-bold uppercase tracking-widest hover:bg-white/5 transition-colors"
                >
                  VOLVER
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setShowPieceEditor(false);
                    handleSubmit();
                  }}
                  disabled={loading}
                  className={cn(
                    "bg-[#3498db] text-white px-6 py-2.5 rounded-xl font-black uppercase tracking-widest transition-all shadow-lg flex items-center gap-2",
                    loading ? "opacity-50 cursor-not-allowed" : "hover:bg-[#2980b9] shadow-[#3498db]/20 hover:scale-105 active:scale-95"
                  )}
                >
                  <Save size={18} />
                  CARGAR AL INVENTARIO
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ProductModal;
