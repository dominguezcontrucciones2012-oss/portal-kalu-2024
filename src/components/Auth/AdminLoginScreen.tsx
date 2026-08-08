import React, { useState, useEffect, useRef } from 'react';
import { auth } from '../../lib/firebase';
import { GoogleAuthProvider, signInWithEmailAndPassword, signInWithPopup } from 'firebase/auth';
import { useAuth } from '../../contexts/AuthProvider';
import { doc, collection, query, where, getDocs, setDoc } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import { useNavigate } from 'react-router-dom';
import { ShieldCheck, Mail, Fingerprint } from 'lucide-react';
import { isBiometricSupported, verifyBiometrics, isBiometricsEnabledForUser, getBiometricLastUserEmail, removeBiometrics } from '../../lib/biometrics';

const AdminLoader = () => (
  <div className="relative w-6 h-6 flex items-center justify-center mx-auto">
    <div className="absolute inset-0 animate-[spin_2s_linear_infinite] flex items-center justify-center">
      <div className="relative w-6 h-6 animate-[explode_1.5s_ease-in-out_infinite]">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-2 h-2 bg-emerald-400 rounded-full shadow-[0_0_8px_#34d399]"></div>
        <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-2 h-2 bg-emerald-400 rounded-full shadow-[0_0_8px_#34d399]"></div>
        <div className="absolute left-0 top-1/2 -translate-y-1/2 w-2 h-2 bg-emerald-400 rounded-full shadow-[0_0_8px_#34d399]"></div>
        <div className="absolute right-0 top-1/2 -translate-y-1/2 w-2 h-2 bg-emerald-400 rounded-full shadow-[0_0_8px_#34d399]"></div>
      </div>
    </div>
    <style>{`
      @keyframes explode {
        0%, 100% { transform: scale(1); }
        50% { transform: scale(0.1); filter: brightness(2) drop-shadow(0 0 10px #34d399); }
      }
    `}</style>
  </div>
);

const AdminLoginScreen: React.FC = () => {
  const { setUser } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [stepLogin, setStepLogin] = useState(1);
  
  const [emailOrCedula, setEmailOrCedula] = useState('');
  const [pin, setPin] = useState('');
  const [googleUserPendingPin, setGoogleUserPendingPin] = useState<any>(null);

  const [biometricSupported, setBiometricSupported] = useState(false);
  const [bioUserEmail, setBioUserEmail] = useState<string | null>(null);
  const isGoogleLoginActiveRef = useRef(false);

  const [failedAttempts, setFailedAttempts] = useState(0);
  const [lockoutTimer, setLockoutTimer] = useState(0);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const directStore = params.get('store');
    if (directStore) {
      localStorage.setItem('activeStoreId', directStore);
      window.history.replaceState({}, document.title, window.location.pathname);
    }
  }, []);

  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (lockoutTimer > 0) {
      interval = setInterval(() => {
        setLockoutTimer((prev) => {
          if (prev <= 1) {
            setFailedAttempts(0);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [lockoutTimer]);

  useEffect(() => {
    isBiometricSupported().then(supported => {
      setBiometricSupported(supported);
      if (supported) {
        setBioUserEmail(getBiometricLastUserEmail());
      }
    });
  }, []);

  useEffect(() => {
    const unsub = auth.onAuthStateChanged(async (user) => {
      if (user && !localStorage.getItem('kalu_pin_verified')) {
        setGoogleUserPendingPin(user);
        setEmailOrCedula(user.email || '');
        if (isGoogleLoginActiveRef.current) {
          setStepLogin(2);
          isGoogleLoginActiveRef.current = false;
        }
      } else if (!user) {
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
      let freshRole = bioData?.role || 'admin';
      
      try {
        const adminRef = collection(db, 'administradores');
        const q = query(adminRef, where('email', '==', result.email));
        const qSnap = await getDocs(q);
        if (!qSnap.empty) {
          userId = qSnap.docs[0].id;
          freshRole = qSnap.docs[0].data().role || 'admin';
        } else {
          // Check users collection for staff
          const uq = query(collection(db, 'users'), where('email', '==', result.email));
          const uSnap = await getDocs(uq);
          if (!uSnap.empty) {
            userId = uSnap.docs[0].id;
            freshRole = uSnap.docs[0].data().role || 'cajero';
          } else {
            removeBiometrics(result.email);
            setBioUserEmail(null);
            setError("Perfil de administrador no encontrado.");
            setLoading(false);
            return;
          }
        }
      } catch (e) { console.warn(e); }

      const fullUser = {
        id: userId || 'bio_' + Date.now(),
        username: bioData?.username || bioData?.nombre || 'Admin',
        role: freshRole,
        email: result.email,
        method: 'biometric',
        storeId: bioData?.storeId
      };

      if (bioData?.storeId) {
        localStorage.setItem('activeStoreId', bioData.storeId);
      }

      if (!auth.currentUser) {
        try {
          const { signInAnonymously } = await import('firebase/auth');
          await signInAnonymously(auth);
        } catch (e) {}
      }

      localStorage.setItem('kalu_current_user', JSON.stringify(fullUser));
      setUser(fullUser as any);
      if (fullUser.role === 'superadmin') {
        navigate('/superadmin', { replace: true });
      } else {
        navigate('/dashboard', { replace: true });
      }
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

      const superAdmins = ['dominguezcontrucciones2012@gmail.com', 'dominguezconstrucciones2012@gmail.com', 'domingueconstrucciones@gmail.com', 'dominguezconstrucciones@gmail.com'];
      if (superAdmins.includes(userEmail)) {
        localStorage.setItem('kalu_pin_verified', 'true');
        return;
      }

      const qAdmin = query(collection(db, 'administradores'), where('email', '==', userEmail));
      const snapAdmin = await getDocs(qAdmin);
      
      let isAdmin = !snapAdmin.empty;
      if (!isAdmin) {
        const qUser = query(collection(db, 'users'), where('email', '==', userEmail));
        const snapUser = await getDocs(qUser);
        if (!snapUser.empty) {
          const role = snapUser.docs[0].data().role;
          if (['admin', 'superadmin', 'dueno', 'supervisor', 'cajero'].includes(role)) {
            isAdmin = true;
          }
        }
      }

      if (!isAdmin) {
        await auth.signOut();
        setError("Acceso denegado: Este portal es exclusivo para personal administrativo.");
        setLoading(false);
        return;
      }

      if (biometricSupported && isBiometricsEnabledForUser(userEmail)) {
        const bioResult = await verifyBiometrics(userEmail);
        if (bioResult.success) {
          localStorage.setItem('kalu_pin_verified', 'true');
          return;
        }
      }

      setEmailOrCedula(userEmail);
      setGoogleUserPendingPin(result.user);
      setStepLogin(2);
    } catch (err: any) {
      setError('Error con Google: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  const handlePinLogin = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (stepLogin === 1) {
      if (emailOrCedula.length < 4) {
        setError('Ingrese usuario válido');
        return;
      }
      setLoading(true);
      try {
        const cleanVal = emailOrCedula.trim().toLowerCase();
        
        let isAdmin = false;
        let finalEmail = cleanVal;

        const superAdmins = ['dominguezcontrucciones2012@gmail.com', 'dominguezconstrucciones2012@gmail.com', 'domingueconstrucciones@gmail.com', 'dominguezconstrucciones@gmail.com'];
        if (superAdmins.includes(cleanVal)) {
          isAdmin = true;
        } else {
          const qAdmin = query(collection(db, 'administradores'), where('email', '==', cleanVal));
          const snapAdmin = await getDocs(qAdmin);
          if (!snapAdmin.empty) {
            isAdmin = true;
            finalEmail = snapAdmin.docs[0].data().email || cleanVal;
          } else {
            const qUsers = query(collection(db, 'users'), where('email', '==', cleanVal));
            const snapUsers = await getDocs(qUsers);
            if (!snapUsers.empty) {
              const role = snapUsers.docs[0].data().role;
              if (['admin', 'superadmin', 'dueno', 'supervisor', 'cajero'].includes(role)) {
                isAdmin = true;
                finalEmail = snapUsers.docs[0].data().email || cleanVal;
              }
            }
          }
        }

        if (!isAdmin) {
          setError('❌ Usuario no encontrado o no autorizado.');
          setLoading(false);
          return;
        }

        setEmailOrCedula(finalEmail);
        setStepLogin(2);
      } catch (err: any) {
        setError('Error de conexión.');
      } finally {
        setLoading(false);
      }
      return;
    }

    if (pin.length !== 6) return;
    setLoading(true);
    
    try {
      const cleanEmail = emailOrCedula.trim().toLowerCase();
      const superAdmins = ['dominguezcontrucciones2012@gmail.com', 'dominguezconstrucciones2012@gmail.com', 'domingueconstrucciones@gmail.com', 'dominguezconstrucciones@gmail.com'];
      
      let validPin = false;
      let userDocData: any = null;
      let userId: string = '';

      const qAdmin = query(collection(db, 'administradores'), where('email', '==', cleanEmail));
      const snapAdmin = await getDocs(qAdmin);
      if (!snapAdmin.empty) {
        userDocData = snapAdmin.docs[0].data();
        userId = snapAdmin.docs[0].id;
        validPin = String(userDocData.pin).trim() === String(pin).trim();
      } else {
        const qUsers = query(collection(db, 'users'), where('email', '==', cleanEmail));
        const snapUsers = await getDocs(qUsers);
        if (!snapUsers.empty) {
          userDocData = snapUsers.docs[0].data();
          userId = snapUsers.docs[0].id;
          validPin = String(userDocData.pin).trim() === String(pin).trim();
        }
      }
      
      if (validPin && userDocData) {
        setFailedAttempts(0);
        localStorage.setItem('kalu_pin_verified', 'true');
        
        // Ensure local storage has the user data for anonymous fallback
        const fullUser = {
          id: userId,
          username: userDocData.username || userDocData.nombre || 'Admin',
          role: userDocData.role || 'admin',
          email: cleanEmail,
          storeId: userDocData.storeId,
          method: 'pin'
        };
        localStorage.setItem('kalu_current_user', JSON.stringify(fullUser));
        setUser(fullUser as any);
        if (userDocData.storeId) {
          localStorage.setItem('activeStoreId', userDocData.storeId);
        }

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
      
      const newAttempts = failedAttempts + 1;
      setFailedAttempts(newAttempts);
      if (newAttempts >= 3) {
        setLockoutTimer(30);
        setError(`Demasiados intentos fallidos. Sistema bloqueado temporalmente. Reintente en 30 segundos...`);
      } else {
        setError(`PIN de 6 dígitos incorrecto. Intento ${newAttempts}/3`);
      }
    } catch (err) {
      setError("Error verificando credenciales.");
    } finally {
      setPin('');
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#0f172a] text-slate-100 flex items-center justify-center p-4" style={{ backgroundImage: "url('/dashboard-bg.jpg')", backgroundSize: 'cover', backgroundPosition: 'center' }}>
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm z-0"></div>
      
      <div className="max-w-md w-full bg-slate-900/90 p-8 rounded-3xl shadow-2xl border border-slate-700 z-10 relative">
        <div className="text-center mb-8">
          <img 
            src="/logo.jpg?v=2027" 
            alt="Mercado San Juan" 
            className="w-20 h-20 rounded-full object-cover flex-shrink-0 shadow-lg mx-auto mb-4 border-2 border-emerald-500"
          />
          <h1 className="text-3xl font-black uppercase tracking-widest text-emerald-400">KALU ADMIN</h1>
          <p className="text-gray-400 mt-2 text-sm uppercase font-bold tracking-widest">Portal Administrativo Exclusivo</p>
        </div>

        {error && lockoutTimer === 0 && (
          <div className="bg-red-500/20 text-red-400 p-4 rounded-xl mb-6 text-sm font-bold text-center">
            {error}
          </div>
        )}
        
        {lockoutTimer > 0 && (
          <div className="bg-red-500/20 text-red-500 p-4 rounded-xl mb-6 text-sm font-black text-center animate-pulse border border-red-500/50">
            Demasiados intentos fallidos. Sistema bloqueado temporalmente. Reintente en {lockoutTimer} segundos...
          </div>
        )}

        {stepLogin === 1 ? (
          <div className="space-y-4">
            <button type="button" onClick={handleGoogleLogin} disabled={loading} className="w-full bg-white text-gray-900 py-4 rounded-xl font-bold flex items-center justify-center gap-3 hover:bg-gray-100 transition-colors shadow-md group">
              {loading && isGoogleLoginActiveRef.current ? <AdminLoader /> : (
                <>
                  <img src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg" className="w-6 h-6 group-hover:scale-110 transition-transform" alt="Google" />
                  Continuar con Google
                </>
              )}
            </button>
            
            <div className="relative py-2">
              <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-slate-700"></div></div>
              <div className="relative flex justify-center"><span className="bg-slate-900 px-4 text-sm text-slate-500 uppercase font-black">O</span></div>
            </div>
            
            <form onSubmit={handlePinLogin} className="space-y-4">
              <div className="text-left">
                <label className="block text-slate-400 text-sm font-bold mb-2 ml-1">Correo Electrónico</label>
                <input type="email" placeholder="ejemplo@empresa.com" value={emailOrCedula} onChange={e => setEmailOrCedula(e.target.value)} className="w-full bg-black/50 border border-slate-700 rounded-xl p-4 text-white placeholder-slate-600 outline-none focus:border-emerald-500 transition-colors" required />
              </div>
              <button type="submit" disabled={loading} className="w-full bg-emerald-600 hover:bg-emerald-500 transition-colors text-white py-4 rounded-xl font-bold shadow-lg shadow-emerald-600/20 disabled:opacity-50 h-[56px] flex items-center justify-center">
                {loading && !isGoogleLoginActiveRef.current ? <AdminLoader /> : 'Siguiente'}
              </button>
            </form>
            
            {biometricSupported && bioUserEmail && (
              <button type="button" onClick={() => handleBiometricUnlock(false)} disabled={loading} className="w-full bg-emerald-500/10 text-emerald-400 py-4 rounded-xl font-bold flex items-center justify-center gap-3 mt-4 hover:bg-emerald-500/20 transition-colors border border-emerald-500/30">
                <Fingerprint size={20} />
                Ingreso Rápido (Huella)
              </button>
            )}

            <button 
              type="button" 
              onClick={() => alert("Para restablecer tu PIN o acceso administrativo, contacta directamente al SuperAdmin o Dueño del portal.")} 
              className="w-full pt-4 pb-2 text-sm text-slate-500 font-bold hover:text-emerald-400 transition-colors underline underline-offset-4"
            >
              ¿Olvidaste tu clave de acceso? Recuperar
            </button>
          </div>
        ) : (
          <form onSubmit={handlePinLogin} className="space-y-6">
            <div className="text-center mb-4">
              <p className="text-gray-400">Ingresa PIN Autorizado para</p>
              <p className="font-bold text-emerald-400">{emailOrCedula}</p>
            </div>
            <input type="password" placeholder="PIN Secreto" maxLength={6} value={pin} onChange={e => setPin(e.target.value)} disabled={lockoutTimer > 0} className="w-full bg-black/50 border border-slate-700 rounded-xl p-4 text-white text-center text-2xl tracking-[1em] outline-none focus:border-emerald-500 disabled:opacity-50" required />
            <button type="submit" disabled={loading || pin.length !== 6 || lockoutTimer > 0} className="w-full bg-emerald-600 hover:bg-emerald-500 text-white py-4 rounded-xl font-bold transition-colors disabled:opacity-50 h-[56px] flex items-center justify-center">
              {loading && !isGoogleLoginActiveRef.current ? <AdminLoader /> : 'Autorizar Ingreso'}
            </button>
            {biometricSupported && isBiometricsEnabledForUser(emailOrCedula) && (
              <button type="button" onClick={() => handleBiometricUnlock(false)} className="w-full bg-emerald-500/10 text-emerald-400 py-4 rounded-xl font-bold flex justify-center gap-2 mt-4">
                <Fingerprint size={20} /> Usar Biometría
              </button>
            )}
            <button type="button" onClick={() => { setStepLogin(1); setPin(''); setError(null); }} className="w-full py-4 text-slate-500 font-bold hover:text-white transition-colors">Cancelar</button>
            
            <button 
              type="button" 
              onClick={() => alert("Para restablecer tu PIN o acceso administrativo, contacta directamente al SuperAdmin o Dueño del portal.")} 
              className="w-full pt-2 pb-2 text-sm text-slate-500 font-bold hover:text-emerald-400 transition-colors underline underline-offset-4"
            >
              ¿Olvidaste tu clave de acceso? Recuperar
            </button>
          </form>
        )}
      </div>
    </div>
  );
};

export default AdminLoginScreen;
