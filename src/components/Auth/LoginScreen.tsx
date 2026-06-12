import React, { useState } from 'react';
import { auth, signInWithPopupCustom, signInWithPinCustom, isMock } from '../../lib/firebase';
import { GoogleAuthProvider } from 'firebase/auth';
import { useAuth } from '../../contexts/AuthProvider';
import { createClient } from '../../lib/dbUtils';
import { useNavigate, useLocation } from 'react-router-dom';

import { LogIn, Rocket, Shield, Info, KeyRound, UserPlus, ArrowLeft, ShoppingBag } from 'lucide-react';

const LoginScreen: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [loading, setLoading] = useState(false);
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [pin, setPin] = useState('');
  const [cedula, setCedula] = useState('');
  const [stepLogin, setStepLogin] = useState(1);
  const [showPinLogin, setShowPinLogin] = useState(false);
  const [showRegister, setShowRegister] = useState(() => {
    const fromState = (location.state as any)?.register;
    const fromStorage = localStorage.getItem('kalu_pending_checkout') === 'true';
    return !!(fromState || fromStorage);
  });
  const { setUser } = useAuth();
  const [error, setError] = useState<string | null>(null);
  
  const [showDownloadPrompt, setShowDownloadPrompt] = useState(false);
  const [pendingUser, setPendingUser] = useState<any>(null);

  // Form states for self-registration
  const [regNombre, setRegNombre] = useState('');
  const [regCedula, setRegCedula] = useState('');
  const [regTelefono, setRegTelefono] = useState('');
  const [regDireccion, setRegDireccion] = useState('');
  const [regPin, setRegPin] = useState('');
  const [regConfirmPin, setRegConfirmPin] = useState('');

  React.useEffect(() => {
    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e);
    };
    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    return () => window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
  }, []);

  const handleGoogleLogin = async () => {
    setLoading(true);
    setError(null);
    try {
      const provider = new GoogleAuthProvider();
      await signInWithPopupCustom(auth, provider);
    } catch (err: any) {
      setError('Error al iniciar sesión: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  const handlePinLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (stepLogin === 1) {
      if (cedula.length < 4) {
        setError('Por favor ingrese una cédula válida');
        return;
      }
      setError(null);
      setStepLogin(2);
      return;
    }

    if (pin.length !== 4) return;
    setLoading(true);
    setError(null);
    try {
      const user = await signInWithPinCustom(cedula, pin);
      setUser(user);
    } catch (err: any) {
      setError(err.message || 'Cédula o PIN Incorrecto');
      setPin('');
    } finally {
      setLoading(false);
    }
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!regNombre || !regCedula || !regPin || !regConfirmPin) {
      setError('Por favor complete todos los campos obligatorios (*)');
      return;
    }
    if (regPin.length !== 4 || !/^\d+$/.test(regPin)) {
      setError('El PIN de seguridad debe tener exactamente 4 números');
      return;
    }
    if (regPin !== regConfirmPin) {
      setError('Los códigos PIN no coinciden');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      // El sistema ahora permite repetir PIN porque la llave primaria de acceso es (Cédula + PIN)

      const clientData = {
        nombre: regNombre,
        cedula: regCedula,
        telefono: regTelefono,
        direccion: regDireccion,
        pin: regPin,
        saldo_usd: 0,
        puntos: 0
      };

      const clientId = await createClient(clientData);

      // Auto login after successful creation
      const registeredUser = {
        id: clientId,
        username: regNombre,
        role: 'cliente' as any,
        pin: regPin,
        cedula: regCedula,
        clientId: clientId
      };
      
      setPendingUser(registeredUser);
      setShowDownloadPrompt(true);
    } catch (err: any) {
      setError('Error en registro: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  const resetViews = () => {
    setShowPinLogin(false);
    setShowRegister(false);
    setError(null);
    setPin('');
    setCedula('');
    setStepLogin(1);
    setRegNombre('');
    setRegCedula('');
    setRegTelefono('');
    setRegDireccion('');
    setRegPin('');
    setRegConfirmPin('');
    localStorage.removeItem('kalu_pending_checkout');
  };

  return (
    <div 
      className="min-h-screen w-full flex items-center justify-center p-4 relative overflow-hidden font-sans"
      style={{
        backgroundImage: "linear-gradient(rgba(15, 23, 42, 0.85), rgba(15, 23, 42, 0.95)), url('/logo.png')",
        backgroundSize: 'cover',
        backgroundPosition: 'center',
        backgroundAttachment: 'fixed'
      }}
    >
      {/* Dynamic Background Glows */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-[10%] left-[10%] w-[30rem] h-[30rem] bg-[#3498db] blur-[180px] rounded-full opacity-10 animate-pulse" />
        <div className="absolute bottom-[10%] right-[10%] w-[25rem] h-[25rem] bg-[#2ecc71] blur-[150px] rounded-full opacity-5" />
      </div>

      <div className="relative z-10 w-full max-w-md">

        <div className="bg-white/5 border border-white/10 backdrop-blur-2xl rounded-[3rem] p-8 md:p-12 shadow-2xl relative overflow-hidden">
          {/* Logo Section */}
          <div className="text-center mb-10">
            <div className="inline-flex p-1.5 rounded-3xl bg-white border border-white/10 mb-6 group transition-all hover:scale-110 shadow-lg">
              <img src="/logo.png" className="w-16 h-16 rounded-2xl object-cover" alt="Kalu Logo" />
            </div>
            <h1 className="text-2xl font-black tracking-tight text-white mb-2 uppercase">SISTEMA ADMINISTRADOR</h1>
            <p className="text-[#5dade2] font-black uppercase tracking-[0.3em] text-2xl">KALU2024</p>
          </div>

          <div className="space-y-6">
            {!showDownloadPrompt && (
              <div className="text-center">
                <h2 className="text-xl font-bold text-gray-200">
                  {showRegister ? 'Registro de Cliente' : 'Bienvenido de nuevo'}
                </h2>
                <p className="text-sm text-gray-500 mt-1">
                  {showRegister ? 'Crea tu cuenta para acceder a tu portal' : 'Acceso seguro para personal y clientes'}
                </p>
              </div>
            )}

            {error && (
              <div className="bg-red-500/10 border border-red-500/20 p-4 rounded-2xl text-red-400 text-xs font-bold flex items-start gap-3">
                <Shield size={16} className="shrink-0" />
                <span>{error}</span>
              </div>
            )}

            {showDownloadPrompt ? (
              <div className="space-y-6 text-center animate-in zoom-in duration-500">
                <div className="w-24 h-24 bg-gradient-to-br from-[#3498db] to-[#2ecc71] rounded-3xl mx-auto flex items-center justify-center shadow-2xl">
                   <Rocket size={48} className="text-white" />
                </div>
                <div>
                  <h2 className="text-2xl font-black text-white uppercase tracking-tight">¡Registro Exitoso!</h2>
                  <p className="text-[#3498db] font-bold mt-1">¿Quieres descargar la Mini App?</p>
                </div>
                <div className="bg-white/5 p-4 rounded-2xl border border-white/10 text-left space-y-3">
                  <p className="text-sm text-gray-300 font-medium">Lleva Kalu siempre contigo. Para instalar rápido y fácil:</p>
                  {deferredPrompt ? (
                    <ul className="text-xs text-gray-400 space-y-2 font-bold">
                      <li className="flex items-center gap-2"><div className="w-1.5 h-1.5 rounded-full bg-[#2ecc71]"></div> 1. Toca el botón verde de abajo "Instalar Mini App"</li>
                      <li className="flex items-center gap-2"><div className="w-1.5 h-1.5 rounded-full bg-[#2ecc71]"></div> 2. Confirma la instalación cuando el sistema te pregunte</li>
                    </ul>
                  ) : (
                    <ul className="text-xs text-gray-400 space-y-2 font-bold">
                      <li className="flex items-center gap-2"><div className="w-1.5 h-1.5 rounded-full bg-[#3498db]"></div> 1. Toca el Menú (⋮) o el ícono de Compartir de tu navegador</li>
                      <li className="flex items-center gap-2"><div className="w-1.5 h-1.5 rounded-full bg-[#3498db]"></div> 2. Selecciona "Agregar a la pantalla principal" o "Instalar app"</li>
                    </ul>
                  )}
                </div>
                <div className="flex flex-col gap-3 pt-4">
                  {deferredPrompt && (
                    <button 
                      onClick={async () => {
                        if (deferredPrompt) {
                          deferredPrompt.prompt();
                          const { outcome } = await deferredPrompt.userChoice;
                          if (outcome === 'accepted') {
                            setDeferredPrompt(null);
                          }
                        }
                      }}
                      className="w-full bg-[#2ecc71] text-white py-4 rounded-2xl font-black hover:bg-[#27ae60] transition-all shadow-[0_10px_20px_rgba(46,204,113,0.2)]"
                    >
                      INSTALAR MINI APP
                    </button>
                  )}
                  <button 
                    onClick={() => {
                      if (pendingUser) setUser(pendingUser);
                    }}
                    className="w-full bg-[#3498db] text-white py-4 rounded-2xl font-black hover:bg-[#2980b9] transition-all shadow-[0_10px_20px_rgba(52,152,219,0.2)]"
                  >
                    {localStorage.getItem('kalu_pending_checkout') === 'true' ? '¡ENTENDIDO, COMPLETAR MI PEDIDO!' : '¡ENTENDIDO, ENTRAR AL PORTAL!'}
                  </button>
                </div>
              </div>
            ) : !showPinLogin && !showRegister ? (
              <div className="space-y-4">
                <button 
                  id="LOGIN_BTN"
                  onClick={handleGoogleLogin}
                  disabled={loading}
                  className="w-full bg-white text-black hover:bg-gray-200 py-4 px-6 rounded-2xl font-black flex items-center justify-center gap-3 transition-all active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed group shadow-[0_10px_20px_rgba(255,255,255,0.1)]"
                >
                  {loading ? 'CARGANDO...' : 'ENTRAR CON GOOGLE'}
                </button>
                <button 
                  onClick={() => setShowPinLogin(true)}
                  className="w-full bg-white/5 text-white hover:bg-white/10 py-4 px-6 rounded-2xl font-bold flex items-center justify-center gap-3 transition-all active:scale-95 border border-white/10"
                >
                  <KeyRound size={20} /> ENTRAR CON CÓDIGO
                </button>
                <button 
                  onClick={() => { setShowRegister(true); setError(null); }}
                  className="w-full bg-gradient-to-r from-[#3498db]/20 to-[#2ecc71]/20 hover:from-[#3498db]/30 hover:to-[#2ecc71]/30 text-white py-4 px-6 rounded-2xl font-bold flex items-center justify-center gap-3 transition-all active:scale-95 border border-[#3498db]/30"
                >
                  <UserPlus size={20} /> ¿NUEVO CLIENTE? REGÍSTRATE
                </button>
                <button 
                  onClick={() => navigate('/catalogo')}
                  className="w-full bg-[#128C7E]/20 text-[#2ecc71] hover:bg-[#128C7E]/30 py-4 px-6 rounded-2xl font-bold flex items-center justify-center gap-3 transition-all active:scale-95 border border-[#128C7E]/30"
                >
                  <ShoppingBag size={20} /> VER CATÁLOGO DE PRODUCTOS
                </button>
              </div>
            ) : showPinLogin ? (
              <form onSubmit={handlePinLogin} className="space-y-6">
                {stepLogin === 1 ? (
                  <div className="space-y-4 animate-in fade-in slide-in-from-right-4 duration-300">
                    <div className="space-y-2">
                      <label className="text-[10px] font-black uppercase text-gray-500 tracking-widest px-2">Cédula o Usuario</label>
                      <input 
                        type="text"
                        maxLength={20}
                        value={cedula}
                        autoFocus
                        onChange={(e) => setCedula(e.target.value.replace(/\s/g, ''))}
                        className="w-full bg-black/40 border border-white/10 rounded-2xl py-5 px-4 text-center text-2xl font-black tracking-widest text-white outline-none focus:border-[#3498db] transition-all"
                        placeholder="Ej: V-12345678"
                      />
                    </div>
                    <div className="flex gap-4">
                      <button 
                        type="button"
                        onClick={resetViews}
                        className="flex-1 bg-white/5 text-gray-400 py-4 rounded-2xl font-bold hover:bg-white/10 transition-all"
                      >
                        VOLVER
                      </button>
                      <button 
                        type="button"
                        onClick={() => {
                          if (cedula.length >= 4) {
                            setError(null);
                            setStepLogin(2);
                          } else {
                            setError("Ingrese cédula válida");
                          }
                        }}
                        className="flex-[2] bg-[#3498db] text-white py-4 rounded-2xl font-black hover:bg-[#2980b9] transition-all shadow-[0_10px_20px_rgba(52,152,219,0.2)]"
                      >
                        CONTINUAR
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-8 animate-in fade-in slide-in-from-right-4 duration-300">
                    <div className="text-center">
                      <p className="text-xs text-gray-400 font-bold mb-4">Ingresa tu PIN de seguridad</p>
                      <div className="flex justify-center gap-4 mb-8">
                        {[0, 1, 2, 3].map((index) => (
                          <div 
                            key={index}
                            className={`w-5 h-5 rounded-full transition-all duration-300 ${pin.length > index ? 'bg-[#3498db] scale-110 shadow-[0_0_15px_rgba(52,152,219,0.6)]' : 'bg-white/10 border-2 border-white/20'}`}
                          />
                        ))}
                      </div>
                    </div>
                    
                    <div className="grid grid-cols-3 gap-3 max-w-[280px] mx-auto">
                      {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((num) => (
                        <button
                          key={num}
                          type="button"
                          onClick={() => {
                            if (window.navigator && window.navigator.vibrate) window.navigator.vibrate(10);
                            if (pin.length < 4) setPin(prev => prev + num);
                          }}
                          className="aspect-square bg-white/5 hover:bg-white/10 active:bg-white/20 rounded-2xl flex items-center justify-center text-2xl font-black text-white transition-all"
                        >
                          {num}
                        </button>
                      ))}
                      <button 
                        type="button"
                        onClick={() => {
                          setPin('');
                          setStepLogin(1);
                        }}
                        className="aspect-square flex items-center justify-center text-sm font-black text-gray-500 hover:text-white transition-colors"
                      >
                        CÉDULA
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          if (window.navigator && window.navigator.vibrate) window.navigator.vibrate(10);
                          if (pin.length < 4) setPin(prev => prev + '0');
                        }}
                        className="aspect-square bg-white/5 hover:bg-white/10 active:bg-white/20 rounded-2xl flex items-center justify-center text-2xl font-black text-white transition-all"
                      >
                        0
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          if (window.navigator && window.navigator.vibrate) window.navigator.vibrate(15);
                          setPin(prev => prev.slice(0, -1));
                        }}
                        className="aspect-square flex items-center justify-center text-gray-500 hover:text-red-400 transition-colors"
                      >
                        <ArrowLeft size={24} />
                      </button>
                    </div>

                    <button 
                      type="submit"
                      disabled={pin.length < 4 || loading}
                      className="w-full bg-gradient-to-r from-[#3498db] to-[#2ecc71] text-white py-4 rounded-2xl font-black hover:opacity-90 transition-all disabled:opacity-30 disabled:cursor-not-allowed mt-4 shadow-xl"
                    >
                      {loading ? 'VERIFICANDO...' : 'ENTRAR'}
                    </button>
                    
                    <button
                      type="button"
                      onClick={() => window.open(`https://api.whatsapp.com/send?text=Hola,%20olvidé%20mi%20clave%20de%20cliente.%20Mi%20cédula%20es%20${cedula}`, '_blank')}
                      className="w-full text-center text-[#3498db] text-sm font-bold pt-4 hover:text-white transition-colors"
                    >
                      ¿Olvidaste tu clave?
                    </button>
                  </div>
                )}
              </form>
            ) : (
              <form onSubmit={handleRegister} className="space-y-4">
                <div className="space-y-1">
                  <label className="text-[9px] font-black uppercase text-gray-500 tracking-widest px-2">Nombre Completo *</label>
                  <input 
                    type="text"
                    required
                    value={regNombre}
                    onChange={(e) => setRegNombre(e.target.value)}
                    className="w-full bg-black/40 border border-white/10 rounded-2xl py-3 px-4 text-sm font-bold text-white outline-none focus:border-[#3498db] transition-all"
                    placeholder="Ej. Juan Pérez"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[9px] font-black uppercase text-gray-500 tracking-widest px-2">Cédula / RIF *</label>
                  <input 
                    type="text"
                    required
                    value={regCedula}
                    onChange={(e) => setRegCedula(e.target.value)}
                    className="w-full bg-black/40 border border-white/10 rounded-2xl py-3 px-4 text-sm font-bold text-white outline-none focus:border-[#3498db] transition-all"
                    placeholder="Ej. V-12345678"
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="text-[9px] font-black uppercase text-gray-500 tracking-widest px-2">Teléfono</label>
                    <input 
                      type="text"
                      value={regTelefono}
                      onChange={(e) => setRegTelefono(e.target.value)}
                      className="w-full bg-black/40 border border-white/10 rounded-2xl py-3 px-4 text-sm font-bold text-white outline-none focus:border-[#3498db] transition-all"
                      placeholder="0424-5556677"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[9px] font-black uppercase text-gray-500 tracking-widest px-2">Dirección</label>
                    <input 
                      type="text"
                      value={regDireccion}
                      onChange={(e) => setRegDireccion(e.target.value)}
                      className="w-full bg-black/40 border border-white/10 rounded-2xl py-3 px-4 text-sm font-bold text-white outline-none focus:border-[#3498db] transition-all"
                      placeholder="Calle Principal"
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="text-[9px] font-black uppercase text-gray-500 tracking-widest px-2">PIN Acceso (4 nº) *</label>
                    <input 
                      type="password"
                      required
                      maxLength={4}
                      value={regPin}
                      onChange={(e) => setRegPin(e.target.value.replace(/\D/g, ''))}
                      className="w-full bg-black/40 border border-white/10 rounded-2xl py-3 px-4 text-center text-lg font-black tracking-widest text-[#3498db] outline-none focus:border-[#3498db] transition-all"
                      placeholder="****"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[9px] font-black uppercase text-gray-500 tracking-widest px-2">Confirmar PIN *</label>
                    <input 
                      type="password"
                      required
                      maxLength={4}
                      value={regConfirmPin}
                      onChange={(e) => setRegConfirmPin(e.target.value.replace(/\D/g, ''))}
                      className="w-full bg-black/40 border border-white/10 rounded-2xl py-3 px-4 text-center text-lg font-black tracking-widest text-[#3498db] outline-none focus:border-[#3498db] transition-all"
                      placeholder="****"
                    />
                  </div>
                </div>

                <div className="flex gap-4 pt-2">
                  <button 
                    type="button"
                    onClick={resetViews}
                    className="flex-1 bg-white/5 text-gray-400 py-3.5 rounded-2xl font-bold hover:bg-white/10 transition-all text-sm"
                  >
                    CANCELAR
                  </button>
                  <button 
                    type="submit"
                    disabled={loading}
                    className="flex-[2] bg-gradient-to-r from-[#3498db] to-[#2ecc71] text-white py-3.5 rounded-2xl font-black hover:opacity-90 transition-all text-sm disabled:opacity-50"
                  >
                    {loading ? 'REGISTRANDO...' : 'REGISTRARME'}
                  </button>
                </div>
              </form>
            )}


            <div className="pt-6 border-t border-white/5 grid grid-cols-2 gap-4">
              <div className="text-center">
                <span className="text-[10px] text-gray-600 block uppercase font-bold tracking-tight mb-2">Versión</span>
                <span className="text-xs font-bold text-gray-400">v2.0.4 - STABLE</span>
              </div>
              <div className="text-center">
                <span className="text-[10px] text-gray-600 block uppercase font-bold tracking-tight mb-2">Seguridad</span>
                <span className="text-xs font-bold text-[#2ecc71]">SSL ACTIVE</span>
              </div>
            </div>
          </div>
        </div>

        <p className="text-center text-gray-500 text-[10px] mt-8 font-black uppercase tracking-[0.2em] opacity-50">
          Powered by Antigravity AI — Built for Scale
        </p>
      </div>
    </div>
  );
};

export default LoginScreen;
