import React, { useState } from 'react';
import { Shield, X } from 'lucide-react';
import { signInWithPinCustom } from '../../lib/firebase';
import { Role } from '../../types';

interface SupervisorCodeModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  title?: string;
}

const SupervisorCodeModal: React.FC<SupervisorCodeModalProps> = ({ isOpen, onClose, onSuccess, title = 'Autorización Requerida' }) => {
  const [pin, setPin] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const user = await signInWithPinCustom(pin);
      const userRole = String(user.role || '').toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
      
      if (
        userRole === 'admin' || 
        userRole === 'administrador' || 
        userRole === 'supervisor' || 
        userRole === 'dueno'
      ) {
        onSuccess();
        onClose();
      } else {
        setError('Acceso Denegado: Se requiere Supervisor');
        setPin('');
      }
    } catch (err) {
      setError('Código Incorrecto');
      setPin('');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-[#0f172a]/80 backdrop-blur-sm">
      <div className="bg-[#1e293b] border border-white/10 w-full max-w-sm rounded-[2rem] p-8 shadow-2xl relative overflow-hidden">
        <button onClick={onClose} className="absolute top-4 right-4 text-gray-500 hover:text-white">
          <X size={20} />
        </button>

        <div className="text-center mb-6">
          <div className="inline-flex p-3 bg-red-500/10 text-red-500 rounded-2xl mb-4">
            <Shield size={32} />
          </div>
          <h2 className="text-xl font-black text-white uppercase tracking-tight">{title}</h2>
          <p className="text-xs text-gray-500 font-bold uppercase tracking-widest mt-1">Ingrese código de Supervisor</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="space-y-2">
            <input 
              type="password"
              maxLength={4}
              autoFocus
              value={pin}
              onChange={(e) => setPin(e.target.value.replace(/\D/g, ''))}
              className="w-full bg-black/40 border border-white/10 rounded-2xl py-4 text-center text-3xl font-black tracking-[0.5em] text-[#e74c3c] outline-none focus:border-[#e74c3c] transition-all"
              placeholder="****"
            />
            {error && <p className="text-[10px] text-red-500 font-black text-center uppercase">{error}</p>}
          </div>

          <button 
            type="submit"
            disabled={pin.length < 4 || loading}
            className="w-full py-4 bg-red-500 text-white font-black uppercase tracking-widest rounded-xl hover:bg-red-600 transition-all disabled:opacity-50"
          >
            {loading ? 'VERIFICANDO...' : 'AUTORIZAR'}
          </button>
        </form>
      </div>
    </div>
  );
};

export default SupervisorCodeModal;
