import React, { useState, useEffect, useRef } from 'react';
import { auth } from '../../lib/firebase';
import { GoogleAuthProvider, signInWithEmailAndPassword, createUserWithEmailAndPassword, signInWithPopup } from 'firebase/auth';
import { useAuth } from '../../contexts/AuthProvider';
import { createClient } from '../../lib/dbUtils';
import { doc, collection, query, where, getDocs, serverTimestamp, setDoc } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import { useNavigate } from 'react-router-dom';
import { LogIn, Shield, KeyRound, UserPlus, ArrowLeft, ShoppingBag, Smartphone, Mail, Hash, CheckCircle, Fingerprint, X } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { isBiometricSupported, verifyBiometrics, isBiometricsEnabledForUser, getBiometricLastUserEmail, removeBiometrics } from '../../lib/biometrics';
import { useActiveStore } from '../../hooks/useActiveStore';

const LoaderDots = ({ color = 'bg-black' }) => (
  <div className="flex items-center justify-center gap-1.5 h-5">
    <div className={`w-2 h-2 ${color} rounded-full animate-bounce`} style={{ animationDelay: '0ms' }} />
    <div className={`w-2 h-2 ${color} rounded-full animate-bounce`} style={{ animationDelay: '150ms' }} />
    <div className={`w-2 h-2 ${color} rounded-full animate-bounce`} style={{ animationDelay: '300ms' }} />
    <div className={`w-2 h-2 ${color} rounded-full animate-bounce`} style={{ animationDelay: '450ms' }} />
  </div>
);

const ClientLoginScreen: React.FC = () => {
  const { setUser } = useAuth();
  const navigate = useNavigate();
  const { activeStore } = useActiveStore();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [stepLogin, setStepLogin] = useState(1);
  
  const [viewState, setViewState] = useState<'selection' | 'email_login' | 'register'>('selection');
  const [emailOrCedula, setEmailOrCedula] = useState('');
  const [pin, setPin] = useState('');
  const [googleUserPendingPin, setGoogleUserPendingPin] = useState<any>(null);

  // Registration states
  const [regNombre, setRegNombre] = useState('');
  const [regEmail, setRegEmail] = useState('');
  const [regCedula, setRegCedula] = useState('');
  const [regTelefono, setRegTelefono] = useState('');
  const [regDireccion, setRegDireccion] = useState('');
  const [addressData, setAddressData] = useState({ tipoVia: '', nombreVia: '', detalle: '' });
  const [showAddressModal, setShowAddressModal] = useState(false);
  const [regPin, setRegPin] = useState('');
  const [regConfirmPin, setRegConfirmPin] = useState('');

  const [biometricSupported, setBiometricSupported] = useState(false);
  const [bioUserEmail, setBioUserEmail] = useState<string | null>(null);
  const isGoogleLoginActiveRef = useRef(false);

  // ── Rate limiting (brute-force protection) ──────────────────────────────
  const [failedAttempts, setFailedAttempts] = useState(0);
  const [lockoutTimer, setLockoutTimer] = useState(0);

  useEffect(() => {
    let interval: ReturnType<typeof setInterval>;
    if (lockoutTimer > 0) {
      interval = setInterval(() => {
        setLockoutTimer(prev => {
          if (prev <= 1) { setFailedAttempts(0); return 0; }
          return prev - 1;
        });
      }, 1000);
    }
    return () => clearInterval(interval!);
  }, [lockoutTimer]);

  // ── Biometric check (runs once on mount) ────────────────────────────────
  useEffect(() => {
    let cancelled = false;
    isBiometricSupported().then(supported => {
      if (cancelled) return;
      setBiometricSupported(supported);
      if (supported) setBioUserEmail(getBiometricLastUserEmail());
    });
    return () => { cancelled = true; };
  }, []);

  // ── URL-param view routing (runs once on mount) ─────────────────────────
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.get('view') === 'register') setViewState('register');
    if (urlParams.get('view') === 'login') setViewState('email_login');
  }, []);

  // ── Firebase Auth observer — fully unsubscribed on unmount ──────────────
  useEffect(() => {
    const unsub = auth.onAuthStateChanged(async (user) => {
      if (!user) {
        setGoogleUserPendingPin(null);
      }
    });
    return () => unsub();
  }, []);

  const handleBiometricUnlock = async (auto = false, targetEmail?: string) => {
    setLoading(true);
    setError(null);
    const emailToVerify = targetEmail || bioUserEmail || emailOrCedula || undefined;
    const result = await verifyBiometrics(emailToVerify);
    
    if (result.success && result.email) {
      localStorage.setItem('kalu_pin_verified', 'true');
      const bioData = result.userData;
      let userId = bioData?.id || bioData?.clientId;
      let freshRole = bioData?.role || 'cliente';
      
      try {
        const usersRef = collection(db, 'users');
        const q = query(usersRef, where('email', '==', result.email));
        const qSnap = await getDocs(q);
        if (!qSnap.empty) {
          userId = qSnap.docs[0].id;
          freshRole = qSnap.docs[0].data().role || 'cliente';
        } else {
          removeBiometrics(result.email);
          setBioUserEmail(null);
          setError("Perfil no encontrado en la base de datos.");
          setLoading(false);
          return;
        }
      } catch (e) { console.warn(e); }

      const fullUser = {
        id: userId || 'bio_' + Date.now(),
        username: bioData?.username || bioData?.nombre || 'Usuario',
        role: freshRole,
        email: result.email,
        cedula: bioData?.cedula || '',
        clientId: userId || '',
        method: 'biometric'
      };

      if (!auth.currentUser) {
        try {
          const { signInAnonymously } = await import('firebase/auth');
          await signInAnonymously(auth);
        } catch (e) {}
      }

      localStorage.setItem('kalu_current_user', JSON.stringify(fullUser));
      setUser(fullUser as any);
    } else {
      if (!auto) setError("Huella no reconocida. Usa tu PIN.");
      setLoading(false);
    }
  };

  const handleGoogleLogin = async () => {
    setLoading(true);
    setError(null);
    isGoogleLoginActiveRef.current = true;
    
    try {
      const provider = new GoogleAuthProvider();
      provider.setCustomParameters({ prompt: 'select_account' });
      const result = await signInWithPopup(auth, provider);
      const userEmail = result.user.email ? result.user.email.trim().toLowerCase() : '';

      const qUsers = query(collection(db, 'users'), where('email', '==', userEmail));
      const snapUsers = await getDocs(qUsers);

      if (snapUsers.empty) {
        setGoogleUserPendingPin(result.user);
        setRegEmail(userEmail);
        setRegNombre(result.user.displayName || '');
        setViewState('register');
        setError("Cuenta nueva. Por favor completa tus datos.");
        setLoading(false);
        return;
      }

      // ── FLUJO GOOGLE DIRECTO ──
      const userData = snapUsers.docs[0].data();
      const userId = snapUsers.docs[0].id;

      if (userData.role !== 'cliente' && userData.role !== 'repartidor') {
        setError('El personal administrativo debe usar el portal de Admin.');
        setLoading(false);
        return;
      }

      // Sellar la sesión INMEDIATAMENTE como válida sin pedir PIN extra
      localStorage.setItem('kalu_pin_verified', 'true');
      
      const fullUser = {
        id: userId,
        username: userData.username || userData.nombre || 'Cliente',
        role: userData.role || 'cliente',
        email: userEmail,
        cedula: userData.cedula || '',
        clientId: userId,
        method: 'google'
      };
      
      localStorage.setItem('kalu_current_user', JSON.stringify(fullUser));
      setUser(fullUser as any);
      
      localStorage.setItem('kalu_pin_verified', 'true');
    } catch (err: any) {
      setError('Error con Google: ' + err.message);
      setLoading(false);
    }
  };

  const handlePinLogin = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (stepLogin === 1) {
      if (emailOrCedula.length < 4) {
        setError('Ingrese cédula o correo válido');
        return;
      }
      setLoading(true);
      try {
        const cleanVal = emailOrCedula.trim().toLowerCase();
        const isEmail = cleanVal.includes('@');
        const searchType = isEmail ? 'email' : 'cedula';
        
        const qUsers = query(collection(db, 'users'), where(searchType, '==', cleanVal));
        const snap = await getDocs(qUsers);
        
        if (snap.empty) {
          setError('❌ Usuario no encontrado. Regístrate.');
          if (isEmail) setRegEmail(cleanVal);
          else setRegCedula(cleanVal);
          setViewState('register');
        } else {
          const userData = snap.docs[0].data();
          if (userData.role !== 'cliente' && userData.role !== 'repartidor') {
            setError('El personal administrativo debe usar el portal de Admin.');
          } else {
            setEmailOrCedula(userData.email || cleanVal);
            setStepLogin(2);
          }
        }
      } catch (err: any) {
        setError('Error de conexión.');
      } finally {
        setLoading(false);
      }
      return;
    }

    if (pin.length !== 6) return;
    if (lockoutTimer > 0) return; // hard guard while locked
    setLoading(true);
    
    try {
      const cleanEmail = emailOrCedula.trim().toLowerCase();
      const qUsers = query(collection(db, 'users'), where('email', '==', cleanEmail));
      const snapUsers = await getDocs(qUsers);
      
      if (!snapUsers.empty) {
        const userData = snapUsers.docs[0].data();
        const userId = snapUsers.docs[0].id;

        if (String(userData.pin).trim() === String(pin).trim()) {
          // ✅ PIN correcto — limpiar intentos y sellar sesión
          setFailedAttempts(0);
          localStorage.setItem('kalu_pin_verified', 'true');

          // Sellar perfil ANTES de recargar para evitar amnesia
          const fullUser = {
            id: userId,
            username: userData.username || userData.nombre || 'Cliente',
            role: userData.role || 'cliente',
            email: cleanEmail,
            cedula: userData.cedula || '',
            clientId: userId,
            method: 'pin'
          };
          localStorage.setItem('kalu_current_user', JSON.stringify(fullUser));
          setUser(fullUser as any);

          try {
            await signInWithEmailAndPassword(auth, cleanEmail, pin);
          } catch (e) {
            if (!auth.currentUser) {
              const { signInAnonymously } = await import('firebase/auth');
              await signInAnonymously(auth);
            }
          }
          return;
        }
      }

      // ❌ PIN incorrecto — rate limiting
      const next = failedAttempts + 1;
      setFailedAttempts(next);
      if (next >= 3) {
        setLockoutTimer(30);
        setError('Demasiados intentos fallidos. Sistema bloqueado temporalmente. Reintente en 30 segundos...');
      } else {
        setError(`PIN de 6 dígitos incorrecto. Intento ${next}/3`);
      }
    } catch (err) {
      setError('Error verificando credenciales.');
    } finally {
      setPin('');
      setLoading(false);
    }
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    const nombreLimpio = regNombre.trim();
    const cedulaLimpia = regCedula.trim();

    if (!nombreLimpio || !regEmail || !cedulaLimpia || !regPin || !regConfirmPin) {
      setError('Complete los campos obligatorios');
      return;
    }
    if (!regDireccion || !addressData.tipoVia || !addressData.nombreVia.trim() || !addressData.detalle.trim()) {
      setError('Por favor agregue y complete su Dirección de Entrega detallada.');
      return;
    }
    if (regPin.length !== 6) {
      setError('El PIN debe ser de 6 números');
      return;
    }
    if (regPin !== regConfirmPin) {
      setError('Los pines no coinciden');
      return;
    }
    
    setLoading(true);
    try {
      const cleanEmail = regEmail.trim().toLowerCase();
      sessionStorage.setItem('kalu_is_registering', 'true');
      
      let authUid = googleUserPendingPin?.uid;
      if (!authUid) {
        const cred = await createUserWithEmailAndPassword(auth, cleanEmail, regPin);
        authUid = cred.user.uid;
      }

      await setDoc(doc(db, 'users', authUid), {
        username: nombreLimpio,
        nombre: nombreLimpio,
        role: 'cliente',
        pin: regPin,
        email: cleanEmail,
        cedula: cedulaLimpia,
        telefono: regTelefono,
        clientId: authUid,
        createdAt: serverTimestamp()
      });

      await createClient({
        nombre: nombreLimpio,
        cedula: cedulaLimpia,
        email: cleanEmail,
        telefono: regTelefono,
        direccion: regDireccion,
        direccion_estructurada: {
          tipoVia: addressData.tipoVia,
          nombreVia: addressData.nombreVia.trim(),
          detalle: addressData.detalle.trim()
        },
        pin: regPin,
        tipo_precio: 'Detal',
        estatus: 'Activo'
      }, authUid);

      localStorage.setItem('kalu_pin_verified', 'true');
      window.location.replace('/client-portal');
    } catch (err: any) {
      setError(err.message);
    } finally {
      sessionStorage.removeItem('kalu_is_registering');
      setLoading(false);
    }
  };

  const storeName = activeStore?.name || 'Mercado San Juan';
  const isKaluStore = (activeStore?.name || '').toLowerCase().includes('kalu');
  const storeLogoFromDB = (activeStore as any)?.logo || (activeStore as any)?.image_url || (activeStore as any)?.imagen_url || (activeStore as any)?.imagen;
  const displayLogo = storeLogoFromDB ? storeLogoFromDB : (isKaluStore ? "/tienda.kalu.jpg?v=4" : "/logo.jpg?v=2027");

  return (
    <div className="min-h-screen bg-[#0f172a] text-slate-100 flex items-center justify-center p-4">
      <div className="max-w-md w-full bg-[#050505] border-2 border-amber-400/80 shadow-[0_0_20px_rgba(251,191,36,0.15)] p-8 rounded-[2rem]">
        <div className="text-center mb-8">
            <div className="w-20 h-20 rounded-full flex items-center justify-center bg-white p-1 shadow-[0_0_15px_rgba(251,191,36,0.3)] mx-auto mb-5 border border-amber-400/50">
              <img 
                src={displayLogo} 
                alt="Logo Tienda" 
                className="max-w-full max-h-full rounded-full object-contain"
              />
            </div>
          <h1 className="text-2xl sm:text-3xl font-black text-amber-400 uppercase tracking-tight">Bienvenido a {storeName}</h1>
          <p className="text-gray-400 mt-2 text-sm font-bold tracking-wide">Accede a tu cuenta para comprar</p>
        </div>

        {error && lockoutTimer === 0 && (
          <div className="bg-red-500/20 text-red-400 p-4 rounded-xl mb-6 text-sm font-bold text-center">
            {error}
          </div>
        )}

        {lockoutTimer > 0 && (
          <div className="bg-red-500/20 text-red-500 p-4 rounded-xl mb-6 text-sm font-black text-center animate-pulse border border-red-500/50">
            🔒 Demasiados intentos fallidos. Reintente en {lockoutTimer} segundos...
          </div>
        )}

        {viewState === 'selection' && (
          <div className="space-y-4">
            <button type="button" onClick={handleGoogleLogin} disabled={loading} className="w-full bg-white text-gray-900 py-4 rounded-xl font-black flex items-center justify-center gap-3 shadow-md hover:bg-gray-100 hover:text-amber-500 hover:shadow-[0_0_15px_rgba(251,191,36,0.3)] transition-all active:scale-95 group">
              {loading && isGoogleLoginActiveRef.current ? <LoaderDots color="bg-amber-500" /> : (
                <>
                  <svg className="w-5 h-5 text-gray-900 group-hover:text-amber-500 transition-colors" viewBox="0 0 24 24">
                    <path fill="currentColor" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                    <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                    <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
                    <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
                  </svg>
                  CONTINUAR CON GOOGLE
                </>
              )}
            </button>
            <button type="button" onClick={() => setViewState('email_login')} disabled={loading} className="w-full bg-black/40 border border-amber-500/40 text-amber-100 py-4 rounded-xl font-black flex items-center justify-center gap-3 hover:bg-black/60 hover:border-amber-400 hover:text-amber-400 hover:shadow-[0_0_15px_rgba(251,191,36,0.15)] transition-all active:scale-95 group">
              <Mail size={20} className="group-hover:text-amber-400 transition-colors" />
              Correo o Cédula
            </button>
            {biometricSupported && bioUserEmail && (
              <button type="button" onClick={() => handleBiometricUnlock(false)} disabled={loading} className="w-full bg-amber-500/10 text-amber-400 py-4 rounded-xl font-black flex items-center justify-center gap-3 border border-amber-500/30 hover:bg-amber-500/20 hover:border-amber-400 hover:shadow-[0_0_15px_rgba(251,191,36,0.15)] transition-all active:scale-95 group">
                <Fingerprint size={20} className="group-hover:scale-110 transition-transform" />
                Usar Huella
              </button>
            )}
            <button type="button" onClick={() => setViewState('register')} className="w-full py-4 text-gray-400 font-bold hover:text-amber-400 transition-colors">
              ¿No tienes cuenta? Regístrate
            </button>
          </div>
        )}

        {viewState === 'email_login' && (
          <form onSubmit={handlePinLogin} className="space-y-6">
            {stepLogin === 1 ? (
              <>
                <input type="text" placeholder="Correo o Cédula" value={emailOrCedula} onChange={e => setEmailOrCedula(e.target.value)} className="w-full bg-[#0a0a0a] border border-amber-500/30 rounded-xl p-4 text-white focus:border-amber-400 focus:shadow-[0_0_10px_rgba(251,191,36,0.2)] outline-none transition-all" required />
                <button type="submit" disabled={loading} className="w-full bg-amber-400 text-black py-4 rounded-xl font-black hover:bg-amber-300 hover:shadow-[0_0_15px_rgba(251,191,36,0.4)] transition-all active:scale-95">
                  {loading && !isGoogleLoginActiveRef.current ? <LoaderDots color="bg-black" /> : 'SIGUIENTE'}
                </button>
              </>
            ) : (
              <>
                <div className="text-center mb-4">
                  <p className="text-gray-400">Ingresa tu PIN para</p>
                  <p className="font-bold text-amber-400">{emailOrCedula}</p>
                </div>
                <input
                  type="password"
                  placeholder="PIN de 6 dígitos"
                  maxLength={6}
                  value={pin}
                  onChange={e => setPin(e.target.value)}
                  disabled={lockoutTimer > 0}
                  className="w-full bg-[#0a0a0a] border border-amber-500/30 rounded-xl p-4 text-white text-center text-2xl tracking-[1em] focus:border-amber-400 focus:shadow-[0_0_10px_rgba(251,191,36,0.2)] outline-none transition-all disabled:opacity-50"
                  required
                />
                <button
                  type="submit"
                  disabled={pin.length < 6 || loading}
                  className="w-full bg-amber-400 text-black py-4 rounded-xl font-black hover:bg-amber-300 hover:shadow-[0_0_15px_rgba(251,191,36,0.4)] transition-all active:scale-95 mt-2"
                >
                  {loading && !isGoogleLoginActiveRef.current ? <LoaderDots color="bg-black" /> : 'ENTRAR A TU PORTAL'}
                </button>
                {biometricSupported && isBiometricsEnabledForUser(emailOrCedula) && (
                  <button type="button" onClick={() => handleBiometricUnlock(false)} className="w-full bg-amber-500/10 text-amber-400 py-4 rounded-xl font-black flex justify-center gap-2 mt-4 hover:bg-amber-500/20 border border-amber-500/30 hover:border-amber-400 transition-all active:scale-95">
                    <Fingerprint size={20} /> Usar Huella
                  </button>
                )}
              </>
            )}
            <button type="button" onClick={() => { setViewState('selection'); setStepLogin(1); setPin(''); setError(null); setFailedAttempts(0); setLockoutTimer(0); }} className="w-full py-4 text-gray-400 font-bold hover:text-amber-400 transition-colors">Volver</button>
          </form>
        )}

        {viewState === 'register' && (
          <form onSubmit={handleRegister} className="space-y-4">
            <input type="text" placeholder="Nombre Completo *" value={regNombre} onChange={e => setRegNombre(e.target.value)} className="w-full bg-[#0a0a0a] border border-amber-500/30 rounded-xl p-4 text-white focus:border-amber-400 focus:shadow-[0_0_10px_rgba(251,191,36,0.2)] outline-none transition-all" required />
            <input type="email" placeholder="Correo *" value={regEmail} onChange={e => setRegEmail(e.target.value)} className="w-full bg-[#0a0a0a] border border-amber-500/30 rounded-xl p-4 text-white focus:border-amber-400 focus:shadow-[0_0_10px_rgba(251,191,36,0.2)] outline-none transition-all" required />
            <input type="text" placeholder="Cédula (Ej: V12345678) *" value={regCedula} onChange={e => setRegCedula(e.target.value)} className="w-full bg-[#0a0a0a] border border-amber-500/30 rounded-xl p-4 text-white focus:border-amber-400 focus:shadow-[0_0_10px_rgba(251,191,36,0.2)] outline-none transition-all" required />
            <input type="text" placeholder="Teléfono" value={regTelefono} onChange={e => setRegTelefono(e.target.value)} className="w-full bg-[#0a0a0a] border border-amber-500/30 rounded-xl p-4 text-white focus:border-amber-400 focus:shadow-[0_0_10px_rgba(251,191,36,0.2)] outline-none transition-all" />
            <input type="password" placeholder="PIN de 6 dígitos *" maxLength={6} value={regPin} onChange={e => setRegPin(e.target.value)} className="w-full bg-[#0a0a0a] border border-amber-500/30 rounded-xl p-4 text-white text-center focus:border-amber-400 focus:shadow-[0_0_10px_rgba(251,191,36,0.2)] outline-none transition-all" required />
            <input type="password" placeholder="Confirmar PIN *" maxLength={6} value={regConfirmPin} onChange={e => setRegConfirmPin(e.target.value)} className="w-full bg-[#0a0a0a] border border-amber-500/30 rounded-xl p-4 text-white text-center focus:border-amber-400 focus:shadow-[0_0_10px_rgba(251,191,36,0.2)] outline-none transition-all" required />
            
            <div className="pt-2 pb-1">
              <div 
                onClick={() => setShowAddressModal(true)}
                className={`w-full border rounded-xl py-3.5 px-4 text-xs font-black uppercase tracking-widest text-center cursor-pointer transition-all shadow-[0_0_15px_rgba(251,191,36,0.1)] ${addressData.tipoVia ? 'bg-amber-500/20 border-amber-500 text-amber-400' : 'bg-black/60 border-white/20 text-gray-400 hover:border-amber-400'}`}
              >
                {addressData.tipoVia ? "¡Dirección lista! ✓" : "Toca para agregar Dirección de Entrega *"}
              </div>
            </div>

            <button type="submit" disabled={loading || !regNombre.trim() || !regEmail.trim() || !regCedula.trim() || regPin.length !== 6 || regPin !== regConfirmPin || !regDireccion} className={`w-full text-black py-4 rounded-xl font-black transition-all mt-4 ${loading || !regNombre.trim() || !regEmail.trim() || !regCedula.trim() || regPin.length !== 6 || regPin !== regConfirmPin || !regDireccion ? 'bg-gray-600 text-gray-400 cursor-not-allowed' : 'bg-amber-400 hover:bg-amber-300 hover:shadow-[0_0_15px_rgba(251,191,36,0.4)] active:scale-95'}`}>
              {loading && !isGoogleLoginActiveRef.current ? <LoaderDots color="bg-black" /> : 'REGISTRARME'}
            </button>
            <button type="button" onClick={() => setViewState('selection')} className="w-full py-4 text-gray-400 font-bold hover:text-amber-400 transition-colors">Cancelar</button>
          </form>
        )}
      </div>

      <AnimatePresence>
        {showAddressModal && (
          <div className="fixed inset-0 z-[99999] flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowAddressModal(false)}
              className="absolute inset-0 bg-black/80 backdrop-blur-md"
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="relative w-full max-w-sm bg-gradient-to-b from-[#1a1a1a] to-black border-2 border-amber-500/50 rounded-[2rem] shadow-[0_0_50px_-12px_rgba(251,191,36,0.3)] overflow-hidden"
            >
              <div className="p-6 border-b border-white/5 flex items-center justify-between bg-amber-500/10">
                <h2 className="text-xl font-black text-amber-500 uppercase tracking-widest">
                  DIRECCIÓN
                </h2>
                <button onClick={() => setShowAddressModal(false)} className="p-2 hover:bg-white/5 rounded-xl transition-colors text-white">
                  <X size={20} />
                </button>
              </div>

              <div className="p-6 space-y-5">
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-amber-500/70 uppercase tracking-widest px-2">Tipo de Vía</label>
                  <select 
                    className="w-full bg-black/40 border border-amber-500/30 rounded-xl p-3 focus:outline-none focus:border-amber-500 transition-all font-bold text-amber-400 appearance-none"
                    value={addressData.tipoVia}
                    onChange={e => setAddressData({...addressData, tipoVia: e.target.value})}
                  >
                    <option value="" className="bg-black text-white">Selecciona...</option>
                    <option value="Avenida" className="bg-black text-white">Avenida</option>
                    <option value="Calle" className="bg-black text-white">Calle</option>
                    <option value="Vereda" className="bg-black text-white">Vereda</option>
                    <option value="Calle Nacional" className="bg-black text-white">Calle Nacional</option>
                    <option value="Carrera" className="bg-black text-white">Carrera</option>
                    <option value="Carretera" className="bg-black text-white">Carretera</option>
                  </select>
                </div>

                <div className="space-y-2">
                  <label className="text-[10px] font-black text-amber-500/70 uppercase tracking-widest px-2">Nombre / Número de Vía</label>
                  <input 
                    type="text" 
                    className="w-full bg-black/40 border border-amber-500/30 rounded-xl p-3 focus:outline-none focus:border-amber-500 transition-all font-bold text-amber-400 focus:text-amber-300 placeholder-amber-500/30" 
                    placeholder="Ej. Principal"
                    value={addressData.nombreVia}
                    onChange={e => setAddressData({...addressData, nombreVia: e.target.value})}
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-[10px] font-black text-amber-500/70 uppercase tracking-widest px-2">Detalles (Urb, Bloque, Casa...)</label>
                  <textarea 
                    rows={2}
                    className="w-full bg-black/40 border border-amber-500/30 rounded-xl p-3 focus:outline-none focus:border-amber-500 transition-all font-bold text-amber-400 focus:text-amber-300 placeholder-amber-500/30 resize-none" 
                    placeholder="Ej. Urb. Los Mangos, Bloque 5, Apto 23"
                    value={addressData.detalle}
                    onChange={e => setAddressData({...addressData, detalle: e.target.value})}
                  />
                </div>

                <button 
                  type="button"
                  onClick={() => {
                    if (!addressData.tipoVia || !addressData.nombreVia.trim() || !addressData.detalle.trim()) {
                      alert('Por favor completa todos los campos de la dirección (Tipo de Vía, Nombre y Detalles).');
                      return;
                    }
                    const parts = [];
                    if (addressData.tipoVia) parts.push(addressData.tipoVia);
                    if (addressData.nombreVia) parts.push(addressData.nombreVia.trim());
                    let combined = parts.join(' ');
                    if (addressData.detalle) combined += combined ? `, ${addressData.detalle.trim()}` : addressData.detalle.trim();
                    setRegDireccion(combined.trim());
                    setShowAddressModal(false);
                  }}
                  className="w-full mt-4 bg-gradient-to-r from-amber-600 to-amber-500 hover:from-amber-500 hover:to-amber-400 text-black py-4 rounded-xl font-black uppercase tracking-[2px] shadow-[0_0_20px_rgba(251,191,36,0.3)] transition-all active:scale-95"
                >
                  Confirmar Dirección
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default ClientLoginScreen;
