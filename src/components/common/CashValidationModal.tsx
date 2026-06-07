import React, { useState } from 'react';
import { Lock, X } from 'lucide-react';

interface CashValidationModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  expectedPin: string;
}

const CashValidationModal: React.FC<CashValidationModalProps> = ({ isOpen, onClose, onSuccess, expectedPin }) => {
  const [pin, setPin] = useState('');
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (pin === expectedPin) {
      onSuccess();
      onClose();
    } else {
      setError('Clave Incorrecta');
      setPin('');
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-[#0f172a]/80 backdrop-blur-sm">
      <div className="bg-[#1e293b] border border-white/10 w-full max-w-sm rounded-[2rem] p-8 shadow-2xl relative overflow-hidden">
        <button onClick={onClose} className="absolute top-4 right-4 text-gray-500 hover:text-white">
          <X size={20} />
        </button>

        <div className="text-center mb-6">
          <div className="inline-flex p-3 bg-blue-500/10 text-blue-500 rounded-2xl mb-4">
            <Lock size={32} />
          </div>
          <h2 className="text-xl font-black text-white uppercase tracking-tight">Validar Pago</h2>
          <p className="text-xs text-gray-500 font-bold uppercase tracking-widest mt-1">Ingrese su clave para confirmar</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="space-y-2">
            <input 
              type="password"
              maxLength={4}
              autoFocus
              value={pin}
              onChange={(e) => setPin(e.target.value.replace(/\D/g, ''))}
              className="w-full bg-black/40 border border-white/10 rounded-2xl py-4 text-center text-3xl font-black tracking-[0.5em] text-[#3498db] outline-none focus:border-[#3498db] transition-all"
              placeholder="****"
            />
            {error && <p className="text-[10px] text-red-500 font-black text-center uppercase">{error}</p>}
          </div>

          <button 
            type="submit"
            disabled={pin.length < 4}
            className="w-full py-4 bg-blue-500 text-white font-black uppercase tracking-widest rounded-xl hover:bg-blue-600 transition-all disabled:opacity-50"
          >
            CONFIRMAR
          </button>
        </form>
      </div>
    </div>
  );
};

export default CashValidationModal;
