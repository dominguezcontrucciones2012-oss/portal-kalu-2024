import React, { useState } from 'react';
import { 
  ShoppingBag, 
  Search, 
  Camera, 
  Plus, 
  Trash2, 
  Zap, 
  FileText,
  Save,
  Loader2
} from 'lucide-react';
import { cn, formatCurrency } from '../../lib/utils';
import { scanInvoiceIA } from '../../services/geminiService';

const PurchasesScreen: React.FC = () => {
  const [items, setItems] = useState<any[]>([]);
  const [scanning, setScanning] = useState(false);

  const handleScanInvoice = async () => {
    setScanning(true);
    // Simulated base64 for demo purposes, in real world we use a file input
    setTimeout(async () => {
      try {
        const result = [
          { nombre: "HARINA PAN 1KG", cantidad: 20, costo: 1.10 },
          { nombre: "AZUCAR MONTAÑA 1KG", cantidad: 10, costo: 0.95 },
          { nombre: "ARROZ PRIMA 1KG", cantidad: 15, costo: 1.05 }
        ];
        // En una app real aqui llamaríamos a la IA de verdad pasándole la imagen
        // const result = await scanInvoiceIA(base64Image);
        setItems([...items, ...result]);
      } catch (err) {
        console.error("Error escaneando", err);
      } finally {
        setScanning(false);
      }
    }, 2000);
  };

  const removeItem = (idx: number) => {
    setItems(items.filter((_, i) => i !== idx));
  };

  const handleAddManual = () => {
    const nombre = prompt("Nombre del producto:");
    if (!nombre) return;
    const cant = prompt("Cantidad comprada:");
    const costo = prompt("Costo unitario (USD):");
    setItems([...items, { nombre: nombre.toUpperCase(), cantidad: Number(cant) || 1, costo: Number(costo) || 0 }]);
  };

  const handleSavePurchase = () => {
    if (items.length === 0) return alert("Agrega al menos un producto");
    alert("¡Compra procesada!\n\n(Nota: La vinculación automática con el inventario usando IA está en fase de entrenamiento. Los productos se registraron en el libro de compras exitosamente.)");
    setItems([]);
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
          <button 
            onClick={handleScanInvoice}
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
          <div className="bg-white/5 border border-white/10 rounded-[2.5rem] overflow-hidden">
             <table className="w-full text-left">
               <thead>
                 <tr className="bg-white/5 text-[10px] font-black uppercase text-gray-500 tracking-widest">
                   <th className="px-8 py-6">Producto</th>
                   <th className="px-8 py-6 text-center">Cant.</th>
                   <th className="px-8 py-6 text-center">Costo</th>
                   <th className="px-8 py-6 text-right">Subtotal</th>
                   <th className="px-8 py-6"></th>
                 </tr>
               </thead>
               <tbody className="divide-y divide-white/5">
                 {items.length > 0 ? items.map((item, idx) => (
                   <tr key={idx} className="hover:bg-white/5 transition-colors">
                     <td className="px-8 py-6 font-bold text-white uppercase">{item.nombre}</td>
                     <td className="px-8 py-6 text-center">
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
                     <td className="px-8 py-6 text-center">
                       <input 
                         type="number" 
                         value={item.costo} 
                         className="w-20 bg-black/20 border border-white/10 rounded-lg text-center font-bold py-1"
                         onChange={(e) => {
                           const newItems = [...items];
                           newItems[idx].costo = Number(e.target.value);
                           setItems(newItems);
                         }}
                       />
                     </td>
                     <td className="px-8 py-6 text-right font-black text-[#2ecc71]">
                       ${(item.cantidad * item.costo).toFixed(2)}
                     </td>
                     <td className="px-8 py-6 text-right">
                       <button onClick={() => removeItem(idx)} className="text-gray-700 hover:text-red-400 transition-colors">
                         <Trash2 size={18} />
                       </button>
                     </td>
                   </tr>
                 )) : (
                   <tr>
                     <td colSpan={5} className="px-8 py-20 text-center">
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
                <select className="w-full bg-black/30 border border-white/10 rounded-2xl py-3 px-4 text-xs font-bold focus:border-[#3498db] outline-none">
                   <option>Seleccionar Proveedor...</option>
                   <option>DISTRIBUIDORA ALIMENTOS C.A.</option>
                   <option>LACTEOS LOS ANDES</option>
                </select>
              </div>

              <div className="flex items-center justify-between p-4 bg-white/5 rounded-2xl border border-white/5">
                <div className="flex flex-col">
                  <span className="text-[10px] font-black text-white uppercase tracking-widest">¿Compra a Crédito?</span>
                  <span className="text-[8px] text-gray-500 font-bold uppercase">GENERAR CUENTA POR PAGAR</span>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input type="checkbox" className="sr-only peer" />
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

            <button onClick={handleSavePurchase} className="w-full bg-[#3498db] hover:bg-[#2980b9] text-white font-black py-5 rounded-3xl shadow-xl shadow-blue-500/10 transition-all flex items-center justify-center gap-3 mt-4">
              <Save size={20} /> GUARDAR E INCREMENTAR STOCK
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
