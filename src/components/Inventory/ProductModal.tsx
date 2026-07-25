import React, { useState } from 'react';
import { X, Save, Box, Image as ImageIcon, Upload } from 'lucide-react';
import { cn } from '../../lib/utils';
import { addDocument, updateDocument } from '../../lib/dbUtils';
import { storage } from '../../lib/firebase';
import { ref, uploadBytesResumable, getDownloadURL } from 'firebase/storage';
import { type Product, type PiezaProducto } from '../../types';

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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
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

      const newProduct = {
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
      
      <div className="relative bg-[#0f172a] border border-white/10 rounded-3xl w-full max-w-3xl overflow-hidden shadow-2xl animate-in fade-in zoom-in-95 duration-200 flex flex-col max-h-[90vh]">
        <div className="p-6 border-b border-white/5 flex items-center justify-between bg-white/5 flex-shrink-0">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-[#3498db] rounded-xl shadow-lg shadow-[#3498db]/20">
              <Box size={20} className="text-white" />
            </div>
            <h2 className="text-xl font-black text-white">{initialData ? 'EDITAR PRODUCTO' : 'NUEVO PRODUCTO'}</h2>
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
                <div className="flex justify-between items-center">
                  <h4 className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Lotes de Piezas</h4>
                  <button 
                    type="button" 
                    onClick={() => {
                      if (piezas.length >= 200) return;
                      const lastNum = piezas.length > 0 ? Math.max(...piezas.map(p => Number(p.numero) || 0)) : 0;
                      const itemsToAdd = Math.min(10, 200 - piezas.length);
                      const newPiezas = Array.from({length: itemsToAdd}, (_, i) => ({
                        id: crypto.randomUUID(),
                        numero: String(lastNum + i + 1),
                        peso: 0,
                        vendida: false
                      }));
                      setPiezas([...piezas, ...newPiezas]);
                    }}
                    disabled={piezas.length >= 200}
                    className="bg-[#3498db] text-white px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-widest hover:bg-[#2980b9] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    + Agregar 10 Piezas
                  </button>
                </div>
                
                {piezas.length > 0 && (
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 mt-4 max-h-60 overflow-y-auto custom-scrollbar pr-2">
                    {piezas.map((p, i) => (
                      <div key={p.id} className={`flex items-center gap-2 p-2 rounded-xl border ${p.vendida ? 'bg-red-500/10 border-red-500/20 opacity-50' : p.peso > 0 ? 'bg-[#3498db]/10 border-[#3498db]/30' : 'bg-black/40 border-white/10'}`}>
                        <div className="flex-1 flex items-center gap-2 relative">
                          <span className="text-[10px] font-black text-gray-500 w-6">#{p.numero}</span>
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
                            className="w-full bg-transparent border-b border-white/10 focus:border-[#3498db] outline-none text-white font-bold text-sm px-1 py-0.5 pr-6"
                          />
                          <span className="absolute right-1 text-[10px] text-gray-500 pointer-events-none font-bold uppercase">
                            {formData.unidad_medida}
                          </span>
                        </div>
                        {!p.vendida && (
                          <button
                            type="button"
                            onClick={() => setPiezas(piezas.filter((_, index) => index !== i))}
                            className="text-red-400 hover:text-red-300 p-1 bg-red-500/10 rounded-lg shrink-0"
                          >
                            <X size={14} />
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                )}
                
                <div className="flex justify-between items-center pt-3 border-t border-white/5">
                  <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">
                    Stock a Granel (Sin Pieza): <span className="text-white">{(Number(formData.stock) - piezas.filter(p => !p.vendida).reduce((acc, p) => acc + p.peso, 0)).toFixed(3)} {formData.unidad_medida}</span>
                  </span>
                  <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">
                    Stock en Piezas: <span className="text-[#3498db]">{piezas.filter(p => !p.vendida).reduce((acc, p) => acc + p.peso, 0).toFixed(3)} {formData.unidad_medida}</span>
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
    </div>
  );
};

export default ProductModal;
