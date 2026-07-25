import React, { useState } from 'react';
import { 
  Store, 
  Plus, 
  Package, 
  Image as ImageIcon, 
  DollarSign, 
  ChevronRight,
  Send,
  AlertCircle,
  Bot
} from 'lucide-react';
import { motion } from 'motion/react';
import { addDocument } from '../../lib/dbUtils';
import { useToast } from '../../contexts/ToastProvider';
import { useAuth } from '../../contexts/AuthProvider';
import { analyzeProductImage } from '../../services/geminiService';

const VendorPortalScreen: React.FC = () => {
  const { addToast } = useToast();
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  
  const [formData, setFormData] = useState({
    nombre: '',
    categoria: 'General',
    precio_normal_usd: 0,
    stock: 1,
    unidad_medida: 'Unid',
    imagen_url: '',
    descripcion: ''
  });
  const [isAnalyzing, setIsAnalyzing] = useState(false);

  const handleAnalyzeImage = async () => {
    if (!formData.imagen_url) {
      addToast('error', 'Pega una URL de imagen primero');
      return;
    }
    setIsAnalyzing(true);
    addToast('info', 'Analizando imagen con IA...');
    try {
      const result = await analyzeProductImage(formData.imagen_url);
      if (result) {
        setFormData(prev => ({
          ...prev,
          nombre: result.nombre || prev.nombre,
          categoria: result.categoria || prev.categoria,
          precio_normal_usd: result.precioSugerido || prev.precio_normal_usd,
          descripcion: result.descripcion || prev.descripcion
        }));
        addToast('success', '¡Datos autocompletados por Kalu-IA!');
      } else {
        addToast('error', 'No se pudo analizar la imagen');
      }
    } catch (e) {
      addToast('error', 'Error en el servicio de IA');
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.nombre || !formData.precio_normal_usd) {
      addToast('error', 'Nombre y precio son obligatorios');
      return;
    }

    setLoading(true);
    try {
      const productData = {
        ...formData,
        codigo: `P${Date.now().toString().slice(-6)}`,
        costo_usd: formData.precio_normal_usd * 0.8, // Margen del 20% para KALU por defecto
        vendedor_id: user?.id || 'anon',
        estatus: 'pendiente', // Fase 3: Requiere aprobación
        createdAt: new Date().toISOString()
      };

      await addDocument('products', productData);
      addToast('success', '¡Producto enviado para aprobación!');
      setFormData({
        nombre: '',
        categoria: 'General',
        precio_normal_usd: 0,
        stock: 1,
        unidad_medida: 'Unid',
        imagen_url: '',
        descripcion: ''
      });
    } catch (err) {
      addToast('error', 'Error al enviar publicación');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-8 animate-in fade-in duration-700 pb-20">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div>
          <h1 className="text-3xl font-black text-white flex items-center gap-3 text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-purple-400">
            <Store className="text-blue-400" /> PORTAL DEL VENDEDOR
          </h1>
          <p className="text-gray-400 text-sm font-medium">Publica tus productos y llega a miles de compradores en el Mercado Kalu</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Form Column */}
        <div className="lg:col-span-2">
          <form onSubmit={handleSubmit} className="bg-white/5 border border-white/10 rounded-[2.5rem] p-8 space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <label className="text-[10px] font-black uppercase text-gray-500 tracking-widest px-2">Nombre del Producto</label>
                <input 
                  type="text" 
                  className="w-full bg-black/30 border border-white/10 rounded-2xl p-4 text-white font-bold focus:border-blue-500 outline-none transition-colors"
                  placeholder="Ej: Queso Llanero Premium"
                  value={formData.nombre}
                  onChange={e => setFormData({...formData, nombre: e.target.value})}
                />
              </div>
              <div className="space-y-2">
                <label className="text-[10px] font-black uppercase text-gray-500 tracking-widest px-2">Categoría</label>
                <select 
                  className="w-full bg-black/30 border border-white/10 rounded-2xl p-4 text-white font-bold focus:border-blue-500 outline-none appearance-none transition-colors"
                  value={formData.categoria}
                  onChange={e => setFormData({...formData, categoria: e.target.value})}
                >
                  <option value="Lácteos">Lácteos</option>
                  <option value="Víveres">Víveres</option>
                  <option value="Carnicería">Carnicería</option>
                  <option value="Hortalizas">Hortalizas</option>
                  <option value="General">General</option>
                </select>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="space-y-2">
                <label className="text-[10px] font-black uppercase text-gray-500 tracking-widest px-2">Precio de Venta ($)</label>
                <input 
                  type="number" 
                  step="0.01"
                  className="w-full bg-black/30 border border-white/10 rounded-2xl p-4 text-white font-bold focus:border-blue-500 outline-none transition-colors"
                  placeholder="0.00"
                  value={formData.precio_normal_usd || ''}
                  onChange={e => setFormData({...formData, precio_normal_usd: parseFloat(e.target.value) || 0})}
                />
              </div>
              <div className="space-y-2">
                <label className="text-[10px] font-black uppercase text-gray-500 tracking-widest px-2">Stock Disponible</label>
                <input 
                  type="number" 
                  className="w-full bg-black/30 border border-white/10 rounded-2xl p-4 text-white font-bold focus:border-blue-500 outline-none transition-colors"
                  placeholder="0"
                  value={formData.stock || ''}
                  onChange={e => setFormData({...formData, stock: parseInt(e.target.value) || 0})}
                />
              </div>
              <div className="space-y-2">
                <label className="text-[10px] font-black uppercase text-gray-500 tracking-widest px-2">Unidad</label>
                <input 
                  type="text" 
                  className="w-full bg-black/30 border border-white/10 rounded-2xl p-4 text-white font-bold focus:border-blue-500 outline-none transition-colors"
                  placeholder="Kg, Unid, etc"
                  value={formData.unidad_medida}
                  onChange={e => setFormData({...formData, unidad_medida: e.target.value})}
                />
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-[10px] font-black uppercase text-gray-500 tracking-widest px-2 flex justify-between">
                Sube la Foto del Producto
              </label>
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <input 
                    type="file" 
                    accept="image/*"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) {
                        const reader = new FileReader();
                        reader.onloadend = () => {
                          setFormData({...formData, imagen_url: reader.result as string});
                        };
                        reader.readAsDataURL(file);
                      }
                    }}
                    className="hidden"
                    id="image-upload"
                  />
                  <label 
                    htmlFor="image-upload"
                    className="w-full bg-black/30 border border-white/10 rounded-2xl p-4 flex items-center justify-center gap-2 text-white font-bold cursor-pointer hover:bg-black/50 transition-colors"
                  >
                    <ImageIcon size={20} className="text-gray-400" />
                    {formData.imagen_url ? 'Cambiar Foto' : 'Tocar para abrir Galería'}
                  </label>
                </div>
                <button 
                  type="button"
                  onClick={handleAnalyzeImage}
                  disabled={!formData.imagen_url || isAnalyzing}
                  className="px-6 bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-500 hover:to-blue-500 text-white rounded-2xl flex items-center justify-center shadow-lg shadow-purple-500/20 active:scale-95 transition-all disabled:opacity-50"
                  title="Autocompletar datos con Kalu-IA"
                >
                  {isAnalyzing ? <span className="w-5 h-5 border-2 border-white/20 border-t-white rounded-full animate-spin" /> : <Bot size={20} />}
                </button>
              </div>
              <p className="text-[10px] text-gray-500 px-2">Selecciona una foto de tu teléfono y presiona el robot para autocompletar.</p>
            </div>

            <div className="space-y-2">
              <label className="text-[10px] font-black uppercase text-gray-500 tracking-widest px-2">Descripción del Producto</label>
              <textarea 
                className="w-full bg-black/30 border border-white/10 rounded-2xl p-4 text-white font-bold focus:border-blue-500 outline-none min-h-[120px] transition-colors custom-scrollbar"
                placeholder="Cuéntanos más sobre tu producto..."
                value={formData.descripcion}
                onChange={e => setFormData({...formData, descripcion: e.target.value})}
              />
            </div>

            <button 
              type="submit"
              disabled={loading}
              className="w-full py-5 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-500 hover:to-purple-500 text-white font-black uppercase tracking-[4px] rounded-2xl shadow-xl shadow-blue-500/10 transition-all active:scale-95 disabled:opacity-50 flex justify-center items-center gap-3"
            >
              {loading ? 'ENVIANDO A REVISIÓN...' : 'ENVIAR A REVISIÓN'} <Send size={20} />
            </button>
          </form>
        </div>

        {/* Preview Column */}
        <div className="space-y-6">
          <div className="sticky top-8">
            <h3 className="text-[10px] font-black text-gray-500 uppercase tracking-widest px-2 mb-4">Vista Previa</h3>
            <div className="bg-white/5 border border-white/10 rounded-[2.5rem] overflow-hidden shadow-2xl">
               <div className="aspect-square bg-black/40 flex items-center justify-center relative">
                 {formData.imagen_url ? (
                   <img src={formData.imagen_url} className="w-full h-full object-cover" alt="Preview" />
                 ) : (
                   <ImageIcon size={48} className="text-gray-800 opacity-20" />
                 )}
                 <div className="absolute top-4 left-4">
                   <span className="bg-blue-600 text-white text-[8px] font-black uppercase px-3 py-1 rounded-full shadow-lg">
                     {formData.categoria}
                   </span>
                 </div>
               </div>
               <div className="p-6 space-y-3">
                 <h4 className="text-lg font-black text-white uppercase truncate">{formData.nombre || 'Nombre del Producto'}</h4>
                 <div className="text-3xl font-black text-[#2ecc71]">
                   ${formData.precio_normal_usd.toFixed(2)}
                 </div>
                 <div className="flex items-center justify-between pt-4 border-t border-white/5">
                   <span className="text-[9px] font-black text-gray-500 uppercase tracking-widest">Stock: {formData.stock} {formData.unidad_medida}</span>
                   <div className="px-3 py-1 bg-yellow-500/10 text-yellow-500 rounded-full text-[8px] font-black border border-yellow-500/20">REVISIÓN</div>
                 </div>
               </div>
            </div>

            <div className="mt-8 p-6 bg-yellow-500/10 border border-yellow-500/20 rounded-[2rem] flex items-start gap-4">
              <AlertCircle className="text-yellow-500 shrink-0" size={24} />
              <p className="text-[10px] text-yellow-500/80 font-bold leading-relaxed uppercase tracking-wider">
                Al hacer clic en "Enviar", tu producto será revisado por un administrador de <strong>KALU</strong>. 
                Una vez aprobado, estará disponible para todos los compradores del Mercado.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default VendorPortalScreen;
