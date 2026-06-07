import React, { useState } from 'react';
import { X, Truck } from 'lucide-react';
import { addDocument } from '../../lib/dbUtils';
import { useToast } from '../../contexts/ToastProvider';

interface Props {
  onClose: () => void;
}

const ProviderModal: React.FC<Props> = ({ onClose }) => {
  const { addToast } = useToast();
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    nombre: '',
    contacto: '',
    telefono: '',
    email: '',
    categoria: 'Víveres'
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      await addDocument('providers', {
        ...formData,
        createdAt: new Date().toISOString()
      });
      addToast('success', 'Proveedor registrado correctamente');
      onClose();
    } catch (error) {
      console.error(error);
      addToast('error', 'Error al guardar el proveedor');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-lg bg-[#1e293b] border border-white/10 rounded-[2.5rem] p-8 shadow-2xl">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-2xl font-black text-white flex items-center gap-2">
            <Truck className="text-[#3498db]" /> NUEVO PROVEEDOR
          </h2>
          <button onClick={onClose} className="p-2 hover:bg-white/5 rounded-full text-gray-400">
            <X size={24} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="text-xs font-black text-gray-500 uppercase px-2 tracking-widest">Nombre de Empresa / Distribuidor</label>
            <input required type="text" className="w-full bg-black/20 border border-white/10 rounded-2xl py-3 px-4 focus:outline-none focus:border-[#3498db] text-white" value={formData.nombre} onChange={e => setFormData({...formData, nombre: e.target.value})} />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-xs font-black text-gray-500 uppercase px-2 tracking-widest">Contacto</label>
              <input required type="text" className="w-full bg-black/20 border border-white/10 rounded-2xl py-3 px-4 focus:outline-none focus:border-[#3498db] text-white" value={formData.contacto} onChange={e => setFormData({...formData, contacto: e.target.value})} />
            </div>
            <div>
              <label className="text-xs font-black text-gray-500 uppercase px-2 tracking-widest">Categoría</label>
              <select className="w-full bg-[#151f32] border border-white/10 rounded-2xl py-3 px-4 focus:outline-none focus:border-[#3498db] text-white" value={formData.categoria} onChange={e => setFormData({...formData, categoria: e.target.value})}>
                <option>Víveres</option>
                <option>Charcutería</option>
                <option>Ferretería</option>
                <option>Masivos</option>
                <option>Queso</option>
                <option>Otros</option>
              </select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-xs font-black text-gray-500 uppercase px-2 tracking-widest">Teléfono</label>
              <input required type="text" className="w-full bg-black/20 border border-white/10 rounded-2xl py-3 px-4 focus:outline-none focus:border-[#3498db] text-white" value={formData.telefono} onChange={e => setFormData({...formData, telefono: e.target.value})} />
            </div>
            <div>
              <label className="text-xs font-black text-gray-500 uppercase px-2 tracking-widest">Correo (Opcional)</label>
              <input type="email" className="w-full bg-black/20 border border-white/10 rounded-2xl py-3 px-4 focus:outline-none focus:border-[#3498db] text-white" value={formData.email} onChange={e => setFormData({...formData, email: e.target.value})} />
            </div>
          </div>

          <button type="submit" disabled={loading} className="w-full mt-6 bg-[#3498db] hover:bg-[#2980b9] text-white py-4 rounded-2xl font-black uppercase text-sm shadow-xl transition-all">
            {loading ? "Guardando..." : "Guardar Proveedor"}
          </button>
        </form>
      </div>
    </div>
  );
};

export default ProviderModal;
