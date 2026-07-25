import React, { useState, useEffect } from 'react';
import { Fingerprint } from 'lucide-react';
import { isBiometricSupported, isBiometricsEnabledForUser, registerBiometrics, removeBiometrics } from '../../lib/biometrics';

interface Props {
  email: string;
  userData?: any;
}

const BiometricSetupButton: React.FC<Props> = ({ email, userData }) => {
  const [supported, setSupported] = useState(false);
  const [enabled, setEnabled] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    isBiometricSupported().then(setSupported);
    if (email) {
      setEnabled(isBiometricsEnabledForUser(email));
    }
  }, [email]);

  if (!supported || !email) return null;

  const handleToggle = async () => {
    setLoading(true);
    try {
      if (enabled) {
        removeBiometrics(email);
        setEnabled(false);
        alert('Datos biométricos desactivados para este dispositivo.');
      } else {
        const success = await registerBiometrics(email, userData);
        if (success) {
          setEnabled(true);
          alert('¡Huella/Face ID registrado con éxito en este dispositivo!');
        } else {
          alert('No se pudo registrar la huella. Asegúrate de dar los permisos necesarios.');
        }
      }
    } catch (err) {
      console.error(err);
      alert('Error al configurar datos biométricos.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-white/5 border border-white/10 p-4 rounded-2xl flex items-center justify-between">
      <div className="flex items-center gap-3">
        <div className={`p-2 rounded-xl ${enabled ? 'bg-[#2ecc71]/20 text-[#2ecc71]' : 'bg-white/10 text-gray-400'}`}>
          <Fingerprint size={24} />
        </div>
        <div>
          <h4 className="font-bold text-white text-sm">Inicio Biométrico</h4>
          <p className="text-xs text-gray-400">Inicia sesión con tu huella o rostro</p>
        </div>
      </div>
      <button
        onClick={handleToggle}
        disabled={loading}
        className={`px-4 py-2 rounded-xl font-bold text-xs transition-all ${
          enabled 
            ? 'bg-red-500/20 text-red-400 hover:bg-red-500/30' 
            : 'bg-[#3498db] text-white hover:bg-[#2980b9]'
        }`}
      >
        {loading ? '...' : enabled ? 'Desactivar' : 'Configurar'}
      </button>
    </div>
  );
};

export default BiometricSetupButton;
