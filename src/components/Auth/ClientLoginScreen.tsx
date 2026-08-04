import React, { useState, useEffect, useRef } from 'react';
import { auth } from '../../lib/firebase';
import { GoogleAuthProvider, signInWithEmailAndPassword, createUserWithEmailAndPassword, signInWithPopup } from 'firebase/auth';
import { useAuth } from '../../contexts/AuthProvider';
import { createClient } from '../../lib/dbUtils';
import { doc, collection, query, where, getDocs, serverTimestamp, setDoc } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import { useNavigate } from 'react-router-dom';
import { LogIn, Shield, KeyRound, UserPlus, ArrowLeft, ShoppingBag, Smartphone, Mail, Hash, CheckCircle, Fingerprint, X } from 'lucide-react';
import { isBiometricSupported, verifyBiometrics, isBiometricsEnabledForUser, getBiometricLastUserEmail, removeBiometrics } from '../../lib/biometrics';
import { useActiveStore } from '../../hooks/useActiveStore';

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
      window.location.reload();
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
      window.location.replace('/client-portal');
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

          try {
            await signInWithEmailAndPassword(auth, cleanEmail, pin);
          } catch (e) {
            if (!auth.currentUser) {
              const { signInAnonymously } = await import('firebase/auth');
              await signInAnonymously(auth);
            }
          }
          window.location.replace('/client-portal');
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
    if (!regNombre || !regEmail || !regCedula || !regPin || !regConfirmPin) {
      setError('Complete los campos obligatorios');
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
        username: regNombre,
        nombre: regNombre,
        role: 'cliente',
        pin: regPin,
        email: cleanEmail,
        cedula: regCedula,
        telefono: regTelefono,
        clientId: authUid,
        createdAt: serverTimestamp()
      });

      await createClient({
        nombre: regNombre,
        cedula: regCedula,
        email: cleanEmail,
        telefono: regTelefono,
        direccion: regDireccion,
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
              <img src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg" className="w-6 h-6 group-hover:scale-110 transition-transform" alt="Google" />
              Continuar con Google
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
                  {loading ? 'Verificando...' : 'Siguiente'}
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
                  disabled={loading || pin.length !== 6 || lockoutTimer > 0}
                  className="w-full bg-amber-400 text-black py-4 rounded-xl font-black hover:bg-amber-300 hover:shadow-[0_0_15px_rgba(251,191,36,0.4)] transition-all active:scale-95 disabled:opacity-50"
                >
                  {loading ? 'Entrando...' : 'Ingresar'}
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
            <button type="submit" disabled={loading} className="w-full bg-amber-400 text-black py-4 rounded-xl font-black hover:bg-amber-300 hover:shadow-[0_0_15px_rgba(251,191,36,0.4)] transition-all active:scale-95 mt-4">
              {loading ? 'Registrando...' : 'Completar Registro'}
            </button>
            <button type="button" onClick={() => setViewState('selection')} className="w-full py-4 text-gray-400 font-bold hover:text-amber-400 transition-colors">Cancelar</button>
          </form>
        )}
      </div>
    </div>
  );
};

export default ClientLoginScreen;
