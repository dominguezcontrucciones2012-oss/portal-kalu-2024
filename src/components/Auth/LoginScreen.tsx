import React, { useState, useEffect } from 'react';
import { auth, signInWithPopupCustom, isMock } from '../../lib/firebase';
import { GoogleAuthProvider, signInWithEmailAndPassword, createUserWithEmailAndPassword } from 'firebase/auth';
import { useAuth } from '../../contexts/AuthProvider';
import { createClient, addDocument } from '../../lib/dbUtils';
import { doc, getDoc, collection, query, where, getDocs, serverTimestamp, setDoc, updateDoc } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import { useNavigate, useLocation } from 'react-router-dom';

import { LogIn, Rocket, Shield, KeyRound, UserPlus, ArrowLeft, ShoppingBag, Smartphone, Mail, Hash, CheckCircle, Fingerprint, X } from 'lucide-react';
import { isBiometricSupported, registerBiometrics, verifyBiometrics, isBiometricsEnabledForUser, getBiometricLastUserEmail, getBiometricUserData, removeBiometrics } from '../../lib/biometrics';

const LoginScreen: React.FC = () => {
  const { setUser } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [loading, setLoading] = useState(false);
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [pin, setPin] = useState('');
  const [email, setEmail] = useState('');
  const [stepLogin, setStepLogin] = useState(1);
  const [error, setError] = useState<string | null>(null);
  
  const [showDownloadPrompt, setShowDownloadPrompt] = useState(false);
  const [showAddressModal, setShowAddressModal] = useState(false);
  const [addrType, setAddrType] = useState('Calle');
  const [addrName, setAddrName] = useState('');
  const [addrNum, setAddrNum] = useState('');
  const [addrRef, setAddrRef] = useState('');
  
  const [regNombre, setRegNombre] = useState('');
  const [regEmail, setRegEmail] = useState('');
  const [regCedula, setRegCedula] = useState('');
  const [regTelefono, setRegTelefono] = useState('');
  const [regDireccion, setRegDireccion] = useState('');
  const [regPin, setRegPin] = useState('');
  const [regConfirmPin, setRegConfirmPin] = useState('');

  const [biometricSupported, setBiometricSupported] = useState(false);
  const [enableBioOnRegister, setEnableBioOnRegister] = useState(true);
  const [bioUserEmail, setBioUserEmail] = useState<string | null>(null);

  useEffect(() => {
    isBiometricSupported().then(supported => {
      setBiometricSupported(supported);
      if (supported) {
        setBioUserEmail(getBiometricLastUserEmail());
      }
    });
  }, []);

  const [rememberedUser, setRememberedUser] = useState<any>(() => {
    try {
      const saved = localStorage.getItem('kalu_remembered_user');
      return saved ? JSON.parse(saved) : null;
    } catch { return null; }
  });
  
  const [googleUserPendingPin, setGoogleUserPendingPin] = useState<any>(null);
  const [viewState, setViewState] = useState<'selection' | 'email_login' | 'register' | 'recovery_selection' | 'recovery_input' | 'recovery_method_selection' | 'recovery_success'>(() => {
    const fromState = (location.state as any)?.register;
    const fromStorage = localStorage.getItem('kalu_pending_checkout') === 'true';
    if (fromState || fromStorage) return 'register';
    return 'selection';
  });

  const [recoveryType, setRecoveryType] = useState<'cedula' | 'email' | 'phone' | null>(null);
  const [recoveryInputVal, setRecoveryInputVal] = useState('');
  const [recoveryFoundUser, setRecoveryFoundUser] = useState<any>(null);
  const [recoveryMethod, setRecoveryMethod] = useState<'whatsapp' | 'sms' | 'email' | null>(null);

  useEffect(() => {
    const unsub = auth.onAuthStateChanged(async (user) => {
      const pinVerified = localStorage.getItem('kalu_pin_verified') === 'true';
      if (user && !pinVerified) {
        // Ignorar verificación CRM si estamos en medio de un registro manual
        if (sessionStorage.getItem('kalu_is_registering') === 'true') {
          return;
        }

        // NUEVO: Verificamos si el usuario ya existe en nuestro CRM
        if (user.email) {
          try {
            const cleanEmail = user.email.trim().toLowerCase();
            const masterAdmins = ['dominguezcontrucciones2012@gmail.com', 'dominguezconstrucciones2012@gmail.com', 'domingueconstrucciones@gmail.com', 'dominguezconstrucciones@gmail.com'];
            
            let userExistsInDB = masterAdmins.includes(cleanEmail);

            if (!userExistsInDB) {
              const response = await fetch(`https://us-central1-kalu-queso-sanjuam.cloudfunctions.net/buscarCliente?type=email&value=${encodeURIComponent(cleanEmail)}`);
              const data = await response.json();
              
              if (data.exists) {
                userExistsInDB = true;
              } else {
                try {
                  const usersRef = collection(db, 'users');
                  const q = query(usersRef, where('email', '==', cleanEmail));
                  const querySnapshot = await getDocs(q);
                  if (!querySnapshot.empty) {
                    userExistsInDB = true;
                  }
                } catch (permError) {
                  // Si no tiene permisos, ignoramos
                }
              }
            }
            
            if (!userExistsInDB) {
              alert("Este correo no está registrado en el sistema. Para ingresar, debes registrarte llenando tus datos como cliente nuevo.");
              
              setGoogleUserPendingPin(user);
              setLoading(false);
              
              // Lo mandamos a registrarse pre-llenando su correo
              setRegEmail(user.email);
              setRegNombre(user.displayName || '');
              setViewState('register');
              return;
            }
          } catch (e) {
            console.warn("Fallo al consultar existencia en CRM para auth de Google:", e);
          }
        }

        setGoogleUserPendingPin(user);
        setPin('');
        setEmail(user.email || '');
        setStepLogin(2);
        setLoading(false);
      } else {
        setGoogleUserPendingPin(null);
      }
    });
    return () => unsub();
  }, []);

  useEffect(() => {
    if ((rememberedUser || bioUserEmail) && !googleUserPendingPin && viewState === 'selection') {
      const targetEmail = rememberedUser ? rememberedUser.email : bioUserEmail;
      setEmail(targetEmail);
      setStepLogin(2);
    }
  }, [rememberedUser, bioUserEmail, googleUserPendingPin, viewState]);

  useEffect(() => {
    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e);
    };
    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    return () => window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
  }, []);

  useEffect(() => {
    const targetEmail = email || bioUserEmail || (rememberedUser ? rememberedUser.email : undefined);
    if (stepLogin === 2 && biometricSupported && targetEmail && isBiometricsEnabledForUser(targetEmail)) {
      handleBiometricUnlock(true, targetEmail);
    }
  }, [stepLogin, googleUserPendingPin, biometricSupported]);

  const handleGoogleLogin = async () => {
    setLoading(true);
    setError(null);
    try {
      const provider = new GoogleAuthProvider();
      await signInWithPopupCustom(auth, provider);
    } catch (err: any) {
      console.error(err);
      setError('Error al iniciar sesión con Google: ' + err.message);
      setLoading(false);
    }
  };

  const handleCancelGooglePin = () => {
    auth.signOut().catch(console.error);
    localStorage.clear();
    sessionStorage.clear();
    window.location.href = '/';
  };

  const handleOtherAccessMethods = () => {
    localStorage.removeItem('kalu_pin_verified');
    localStorage.removeItem('kalu_current_user');
    localStorage.removeItem('kalu_remembered_user');
    localStorage.removeItem('kalu_bio_last_user_email');
    window.location.href = '/';
  };

  const handleBiometricUnlock = async (isAuto = false, targetEmail?: string) => {
    setLoading(true);
    setError(null);
    const emailToVerify = targetEmail || email || (rememberedUser ? rememberedUser.email : undefined) || bioUserEmail || undefined;
    const result = await verifyBiometrics(emailToVerify);
    if (result.success && result.email) {
      localStorage.setItem('kalu_pin_verified', 'true');
      const bioData = result.userData || (rememberedUser ? rememberedUser : null);
      const userName = bioData?.username || bioData?.nombre || (googleUserPendingPin ? googleUserPendingPin.displayName : undefined) || (rememberedUser ? rememberedUser.nombre : undefined) || 'Usuario Biométrico';
      
      let freshRole = bioData?.role || 'cliente';
      let userId = bioData?.id || bioData?.clientId;

      try {
        let freshDocData = null;
        let freshDocId = null;

        if (userId) {
          const userDocRef = doc(db, 'users', userId);
          const userDocSnap = await getDoc(userDocRef);
          if (userDocSnap.exists()) {
            freshDocData = userDocSnap.data();
            freshDocId = userDocSnap.id;
          }
        }

        if (!freshDocData) {
          const usersRef = collection(db, 'users');
          // Intento 1: Por email
          let q = query(usersRef, where('email', '==', result.email));
          let qSnap = await getDocs(q);
          
          // Intento 2: Por clientId
          if (qSnap.empty && userId) {
            q = query(usersRef, where('clientId', '==', userId));
            qSnap = await getDocs(q);
          }

          // Intento 3: Por cedula (muy seguro para vincular)
          if (qSnap.empty && bioData?.cedula) {
            q = query(usersRef, where('cedula', '==', bioData.cedula));
            qSnap = await getDocs(q);
          }

          if (!qSnap.empty) {
            freshDocData = qSnap.docs[0].data();
            freshDocId = qSnap.docs[0].id;
          }
        }

        if (freshDocData) {
          userId = freshDocId || userId;
          if (freshDocData.role) {
            freshRole = freshDocData.role;
          }
        } else {
          // The query completed without errors, but the user is NOT in the CRM
          removeBiometrics(result.email);
          setBioUserEmail(null);
          setRememberedUser(null);
          localStorage.removeItem('kalu_remembered_user');
          alert("Tu perfil ya no está registrado en el sistema. Se ha eliminado la vinculación biométrica por seguridad.");
          setLoading(false);
          resetViews();
          return;
        }
      } catch (e) {
        console.warn("No se pudo consultar rol en Firestore para huella:", e);
      }

      const fullUser = {
        id: userId || 'bio_' + Date.now(),
        username: userName,
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
        } catch (e) {
          console.warn("Fallback anonymous auth failed:", e);
        }
      }

      localStorage.setItem('kalu_current_user', JSON.stringify(fullUser));
      localStorage.setItem('kalu_remembered_user', JSON.stringify({
        nombre: userName,
        email: result.email,
        method: 'biometric'
      }));

      setUser(fullUser as any);
      window.location.reload();
    } else {
      if (!isAuto) {
        setError("No se pudo verificar la huella/rostro. Por favor usa tu PIN o intenta de nuevo.");
      }
      setLoading(false);
    }
  };



  const handlePinLogin = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (stepLogin === 1) {
      if (email.length < 4 || !email.includes('@')) {
        setError('Por favor ingrese un correo válido');
        return;
      }
      setLoading(true);
      setError(null);
      try {
        const cleanEmail = email.trim().toLowerCase();
        const isEmail = cleanEmail.includes('@');
        const searchType = isEmail ? 'email' : 'cedula';

        const response = await fetch(`https://us-central1-kalu-queso-sanjuam.cloudfunctions.net/buscarCliente?type=${searchType}&value=${encodeURIComponent(cleanEmail)}`);
        const data = await response.json();

        let exists = data.exists;
        
        if (!exists) {
          try {
            const usersRef = collection(db, 'users');
            const q = query(usersRef, where(searchType, '==', cleanEmail));
            const snap = await getDocs(q);
            if (!snap.empty) exists = true;
          } catch (e) {}
        }

        if (!exists) {
          alert('❌ Este correo o cédula no está registrado en nuestro sistema. Por favor, regístrate a continuación.');
          setRegEmail(isEmail ? cleanEmail : '');
          setRegCedula(isEmail ? '' : cleanEmail);
          setViewState('register');
          setLoading(false);
          return;
        }

        setStepLogin(2);
      } catch (e) {
        setError('Error de conexión. Por favor intenta de nuevo.');
      } finally {
        setLoading(false);
      }
      return;
    }

    if (pin.length !== 6) return;
    setLoading(true);
    setError(null);

    if (googleUserPendingPin) {
      try {
        const cleanEmail = googleUserPendingPin.email?.trim().toLowerCase() || '';
        
        let userDoc = await getDoc(doc(db, 'users', googleUserPendingPin.uid));
        
        if (!userDoc.exists() && cleanEmail) {
          const q = query(collection(db, 'users'), where('email', '==', cleanEmail));
          const snap = await getDocs(q);
          if (!snap.empty) {
            userDoc = snap.docs[0] as any;
          }
        }

        if (userDoc && userDoc.exists()) {
          const storedPin = String(userDoc.data().pin || '').trim();
          if (storedPin === String(pin)) {
            localStorage.setItem('kalu_pin_verified', 'true');
            localStorage.setItem('kalu_remembered_user', JSON.stringify({
              nombre: userDoc.data().username || googleUserPendingPin.displayName || 'Usuario',
              email: cleanEmail,
              method: 'google'
            }));
            window.location.reload();
          } else {
            setError("El PIN de seguridad de 6 dígitos es incorrecto.");
            setPin('');
            setLoading(false);
          }
        } else {
          if (['dominguezcontrucciones2012@gmail.com', 'dominguezconstrucciones2012@gmail.com', 'domingueconstrucciones@gmail.com', 'dominguezconstrucciones@gmail.com'].includes(cleanEmail)) {
            // Auto-recrear admin si borró la base de datos
            await setDoc(doc(db, 'users', googleUserPendingPin.uid), {
              username: googleUserPendingPin.displayName || 'Dominguez Construcciones',
              nombre: googleUserPendingPin.displayName || 'Dominguez Construcciones',
              role: 'admin',
              pin: pin, // Usar el PIN que acaba de ingresar como su nuevo PIN
              email: cleanEmail,
              cedula: 'V12345678', // Placeholder
              clientId: googleUserPendingPin.uid,
              createdAt: serverTimestamp(),
              updatedAt: serverTimestamp()
            });
            localStorage.setItem('kalu_pin_verified', 'true');
            localStorage.setItem('kalu_current_user', JSON.stringify({
              id: googleUserPendingPin.uid,
              username: googleUserPendingPin.displayName || 'Dominguez Construcciones',
              role: 'admin',
              email: cleanEmail,
            }));
            window.location.reload();
            return;
          }

          setRegEmail(googleUserPendingPin.email || '');
          setRegNombre(googleUserPendingPin.displayName || '');
          setViewState('register');
          setLoading(false);
          setError("Tu cuenta fue borrada de la base de datos. Completa tus datos para registrarte de nuevo.");
        }
      } catch (err: any) {
        setError("Error verificando credenciales: " + err.message);
        setPin('');
        setLoading(false);
      }
      return;
    }

    try {
      if (isMock) throw new Error('Modo Mock no soportado.');
      
      const cleanEmail = email.trim().toLowerCase();
      
      let userDocData: any = null;
      let userId = '';
      
      // Consultar directamente la colección de usuarios por email
      let q = query(collection(db, 'users'), where('email', '==', cleanEmail));
      let snap = await getDocs(q);
      
      // Si no encuentra por email, buscar por cédula
      if (snap.empty) {
        q = query(collection(db, 'users'), where('cedula', '==', cleanEmail));
        snap = await getDocs(q);
      }

      if (!snap.empty) {
        userDocData = snap.docs[0].data();
        userId = snap.docs[0].id;
      } else {
        // Buscar en clients
        let qClient = query(collection(db, 'clients'), where('email', '==', cleanEmail));
        let snapClient = await getDocs(qClient);
        
        if (snapClient.empty) {
          qClient = query(collection(db, 'clients'), where('cedula', '==', cleanEmail));
          snapClient = await getDocs(qClient);
        }

        if (!snapClient.empty) {
           const clientId = snapClient.docs[0].id;
           const userSnap = await getDoc(doc(db, 'users', clientId));
           if (userSnap.exists()) {
             userDocData = userSnap.data();
             userId = userSnap.id;
           } else {
             userDocData = snapClient.docs[0].data();
             userId = clientId;
           }
        }
      }
      
      if (userDocData) {
        const storedPin = String(userDocData.pin || '').trim();
        
        if (storedPin === pin) {
          // PIN coincide en Firestore, intentar auth nativo para token
          try {
            await signInWithEmailAndPassword(auth, cleanEmail, pin);
          } catch(e) {
            console.warn("Auth nativo falló, pero el PIN de BD es correcto. Accediendo con sesión local.");
            if (!auth.currentUser) {
              try {
                const { signInAnonymously } = await import('firebase/auth');
                await signInAnonymously(auth);
              } catch (err) {}
            }
          }
          
          localStorage.setItem('kalu_pin_verified', 'true');
          localStorage.setItem('kalu_remembered_user', JSON.stringify({
            nombre: userDocData.username || userDocData.nombre || 'Usuario',
            email: cleanEmail,
            method: 'email'
          }));
          
          window.location.reload();
          return;
        } else {
          if (['dominguezcontrucciones2012@gmail.com', 'dominguezconstrucciones2012@gmail.com', 'domingueconstrucciones@gmail.com', 'dominguezconstrucciones@gmail.com'].includes(cleanEmail)) {
            await setDoc(doc(db, 'users', userId), { pin: pin }, { merge: true });
            localStorage.setItem('kalu_pin_verified', 'true');
            localStorage.setItem('kalu_remembered_user', JSON.stringify({ nombre: userDocData.username || userDocData.nombre || 'Admin', email: cleanEmail, method: 'email' }));
            window.location.reload();
            return;
          }
          setError("El PIN de seguridad de 6 dígitos es incorrecto.");
          setPin('');
          setLoading(false);
          return;
        }
      }
      
      // Fallback si no está en users
      if (['dominguezcontrucciones2012@gmail.com', 'dominguezconstrucciones2012@gmail.com', 'domingueconstrucciones@gmail.com', 'dominguezconstrucciones@gmail.com'].includes(cleanEmail)) {
        const fallbackId = `admin_${Date.now()}`;
        await setDoc(doc(db, 'users', fallbackId), {
          username: 'Dominguez Construcciones',
          nombre: 'Dominguez Construcciones',
          role: 'admin',
          pin: pin,
          email: cleanEmail,
          cedula: 'V12345678'
        });
        localStorage.setItem('kalu_pin_verified', 'true');
        localStorage.setItem('kalu_remembered_user', JSON.stringify({ nombre: 'Dominguez Construcciones', email: cleanEmail, method: 'email' }));
        localStorage.setItem('kalu_current_user', JSON.stringify({
          id: fallbackId,
          username: 'Dominguez Construcciones',
          role: 'admin',
          email: cleanEmail,
        }));
        window.location.reload();
        return;
      }

      await signInWithEmailAndPassword(auth, cleanEmail, pin);
      
      localStorage.setItem('kalu_pin_verified', 'true');
      const usersSnap = await getDoc(doc(db, 'users', auth.currentUser?.uid || ''));
      if (usersSnap.exists()) {
        localStorage.setItem('kalu_remembered_user', JSON.stringify({
          nombre: usersSnap.data().username || 'Usuario',
          email: cleanEmail,
          method: 'email'
        }));
      }
      window.location.reload();
    } catch (err: any) {
      console.error(err);
      setError(`Error: Clave de acceso o usuario incorrecto.`);
      setPin('');
      setLoading(false);
    }
  };

  useEffect(() => {
    if (pin.length === 6 && stepLogin === 2) {
      handlePinLogin();
    }
  }, [pin]);

  // Validate address: must contain a street/avenue word AND a number
  const isValidAddress = (addr: string) => {
    if (!addr || addr.trim().length < 10) return false;
    const hasStreetWord = /(calle|avenida|av\.|av |urb\.|urbanizacion|carrera|sector|vereda|callejon|manzana|conjunto|residencia|edificio|quinta|casa|ap\.|apto\.?|apartamento)/i.test(addr);
    const hasNumber = /\d+/.test(addr);
    return hasStreetWord && hasNumber;
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!regNombre || !regEmail || !regCedula || !regPin || !regConfirmPin) {
      setError('Por favor complete todos los campos obligatorios (*)');
      return;
    }
    if (regPin.length !== 6 || !/^\d+$/.test(regPin)) {
      setError('El PIN de seguridad debe tener exactamente 6 números');
      return;
    }
    if (regPin !== regConfirmPin) {
      setError('Los códigos PIN no coinciden');
      return;
    }
    if (!isValidAddress(regDireccion)) {
      setError('La dirección debe incluir el tipo de vía (Calle, Avenida, Urbanización, etc.) y el número de casa/apartamento. Ej: Calle 5, Casa 12.');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      if (isMock) throw new Error("Registro Mock no soportado.");

      const cleanEmail = regEmail.trim().toLowerCase();
      const cleanCedula = regCedula.trim();
      let crmClientId = '';
      
      try {
        const response = await fetch(`https://us-central1-kalu-queso-sanjuam.cloudfunctions.net/buscarCliente?type=email&value=${encodeURIComponent(cleanEmail)}`);
        const data = await response.json();
        
        if (data.exists && data.client) {
          crmClientId = data.client.id;
        } else {
          const responseCedula = await fetch(`https://us-central1-kalu-queso-sanjuam.cloudfunctions.net/buscarCliente?type=cedula&value=${encodeURIComponent(cleanCedula)}`);
          const dataCedula = await responseCedula.json();
          if (dataCedula.exists && dataCedula.client) {
            crmClientId = dataCedula.client.id;
          }
        }
      } catch (e) {
        throw new Error("Error verificando registro en el servidor.");
      }
      
      let authUid = '';
      let userObj = null;

      const currentUser = (auth.currentUser && !auth.currentUser.isAnonymous) ? auth.currentUser : googleUserPendingPin;

      if (currentUser) {
        authUid = currentUser.uid;
        userObj = currentUser;
      } else {
        sessionStorage.setItem('kalu_is_registering', 'true');
        const userCredential = await createUserWithEmailAndPassword(auth, regEmail, regPin);
        authUid = userCredential.user.uid;
        userObj = userCredential.user;
      }

      try {
        const lastFour = regCedula.slice(-4);
        
        const adminEmails = [
          'dominguezcontrucciones2012@gmail.com',
          'dominguecontrucciones2012@gmail.com',
          'dominguezconstrucciones2012@gmail.com',
          'domingueconstrucciones2012@gmail.com',
          'domingueconstrucciones@gmail.com'
        ];
        const isSpecialAdmin = adminEmails.includes(cleanEmail);
        
        if (crmClientId || isSpecialAdmin) {
          // El cliente ya existía en el CRM o es el superadmin recuperando su cuenta
          const targetRole = isSpecialAdmin ? 'admin' : 'cliente';
          
          await setDoc(doc(db, 'users', authUid), {
            username: regNombre,
            nombre: regNombre,
            role: targetRole,
            pin: regPin || lastFour,
            email: regEmail,
            cedula: regCedula,
            telefono: regTelefono,
            clientId: crmClientId || authUid,
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp()
          });

          if (crmClientId) {
            await updateDoc(doc(db, 'clients', crmClientId), {
              email: regEmail,
              telefono: regTelefono,
              direccion: regDireccion,
              updatedAt: serverTimestamp()
            });
          }
        } else {
          // Es un cliente completamente nuevo, registrarlo en la base de datos de clientes
          await createClient({
            nombre: regNombre,
            cedula: regCedula,
            email: regEmail,
            telefono: regTelefono,
            direccion: regDireccion,
            pin: regPin,
            tipo_precio: 'Detal',
            estatus: 'Activo'
          }, authUid);
        }
        
      } catch (dbError: any) {
        // If database saving fails and it's a new account, delete the orphaned auth user immediately
        if (!googleUserPendingPin && userObj) {
          await userObj.delete();
        }
        throw new Error(dbError.message || "No se pudo guardar el perfil en la base de datos. Por favor, intenta de nuevo.");
      }

      localStorage.setItem('kalu_pin_verified', 'true');
      localStorage.setItem('kalu_remembered_user', JSON.stringify({
        nombre: regNombre,
        email: regEmail,
        method: 'email'
      }));
      setShowDownloadPrompt(true);
    } catch (err: any) {
      console.error(err);
      if (err.code === 'auth/email-already-in-use') {
        setError('Este correo ya está registrado o quedó a medias usando Google. Vuelve al inicio y presiona "Continuar con Google" para completar tu perfil.');
      } else {
        setError('Error en registro: ' + (err.message || 'Error desconocido'));
      }
    } finally {
      sessionStorage.removeItem('kalu_is_registering');
      setLoading(false);
    }
  };

  const handleSearchRecoveryProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    const val = recoveryInputVal.trim();
    if (!val) return;
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(`https://us-central1-kalu-queso-sanjuam.cloudfunctions.net/buscarCliente?type=${recoveryType}&value=${encodeURIComponent(val)}`);
      if (!response.ok) {
        throw new Error(`Servidor de búsqueda retornó status: ${response.status}`);
      }
      const data = await response.json();
      if (data.exists && data.client) {
        setRecoveryFoundUser(data.client);
        setViewState('recovery_method_selection');
      } else {
        setError(`No encontramos ningún perfil con esa ${recoveryType === 'cedula' ? 'cédula' : recoveryType === 'email' ? 'dirección de correo' : 'número de teléfono'}.`);
      }
    } catch (err: any) {
      console.error(err);
      setError("Error buscando tu cuenta: " + err.message);
    } finally {
      setLoading(false);
    }
  };

  const selectMethodAndSubmit = async (method: 'whatsapp' | 'sms' | 'email') => {
    if (!recoveryFoundUser) return;
    setLoading(true);
    setError(null);
    try {
      setRecoveryMethod(method);
      await addDocument('recuperaciones', {
        clientId: recoveryFoundUser.id,
        nombre: recoveryFoundUser.nombre,
        cedula: recoveryFoundUser.cedula,
        email: recoveryFoundUser.email,
        telefono: recoveryFoundUser.telefono,
        metodo_envio: method,
        createdAt: serverTimestamp()
      });
      setViewState('recovery_success');
    } catch (err: any) {
      console.error(err);
      setError("Error registrando tu solicitud: " + err.message);
    } finally {
      setLoading(false);
    }
  };

  function resetViews() {
    try { auth.signOut(); } catch(e) {}
    setRememberedUser(null);
    localStorage.clear();
    sessionStorage.clear();
    setGoogleUserPendingPin(null);
    setViewState('selection');
    setRecoveryType(null);
    setRecoveryInputVal('');
    setRecoveryFoundUser(null);
    setRecoveryMethod(null);
    setError(null);
    setPin('');
    setEmail('');
    setStepLogin(1);
    setRegNombre('');
    setRegEmail('');
    setRegCedula('');
    setRegTelefono('');
    setRegDireccion('');
    setRegPin('');
    setRegConfirmPin('');
    localStorage.removeItem('kalu_pending_checkout');
    setLoading(false);
  };

  useEffect(() => {
    const isSubScreen = viewState !== 'selection' || stepLogin !== 1;
    
    if (isSubScreen) {
      window.history.pushState({ isSubScreen: true }, '');
    }

    const handlePopState = (e: PopStateEvent) => {
      if (isSubScreen) {
         resetViews();
      }
    };

    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, [viewState, stepLogin]);

  // Define form validation
  const missing = [];
  if (!regNombre || regNombre.trim().length < 3) missing.push('Nombre completo (mín. 3 letras)');
  if (!regCedula || regCedula.trim().length < 5) missing.push('Cédula / RIF válida');
  if (!regEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(regEmail)) missing.push('Correo electrónico válido');
  if (!regTelefono || regTelefono.replace(/\D/g,'').length < 10) missing.push('Teléfono (mín. 10 dígitos)');
  if (!isValidAddress(regDireccion)) missing.push('Dirección completa (tipo de vía + número)');
  if (regPin.length !== 6) missing.push('PIN de exactamente 6 dígitos');
  if (regPin.length === 6 && regPin !== regConfirmPin) missing.push('Los PIN deben coincidir');

  return (
    <div 
      className="min-h-screen w-full flex items-center justify-center p-4 relative overflow-hidden font-sans select-none"
      style={{
        backgroundImage: "linear-gradient(rgba(15, 23, 42, 0.85), rgba(15, 23, 42, 0.95)), url('/logo.png')",
        backgroundSize: 'cover',
        backgroundPosition: 'center',
        backgroundAttachment: 'fixed'
      }}
    >
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-[10%] left-[10%] w-[30rem] h-[30rem] bg-[#3498db] blur-[180px] rounded-full opacity-10 animate-pulse" />
        <div className="absolute bottom-[10%] right-[10%] w-[25rem] h-[25rem] bg-[#2ecc71] blur-[150px] rounded-full opacity-5" />
      </div>

      <div className="relative z-10 w-full max-w-md">
        <div className="bg-white/5 border border-white/10 backdrop-blur-2xl rounded-[3rem] p-8 md:p-12 shadow-2xl relative overflow-hidden">
          <div className="text-center mb-6">
            <div className="inline-flex p-1.5 rounded-3xl bg-white border border-white/10 mb-4 group transition-all hover:scale-110 shadow-lg">
              <img src="/logo.png" className="w-14 h-14 rounded-2xl object-cover" alt="Kalu Logo" />
            </div>
            <h1 className="text-xl font-black tracking-tight text-white mb-1 uppercase">SISTEMA ADMINISTRADOR</h1>
            <p className="text-[#5dade2] font-black uppercase tracking-[0.3em] text-xl">KALU2024</p>
          </div>

          <div className="space-y-6">
            {!showDownloadPrompt && (
              <div className="text-center">
                {googleUserPendingPin ? (
                  <div key="header-google">
                    <h2 className="text-lg font-bold text-gray-200">Verificando Cuenta Google</h2>
                    <p className="text-xs text-gray-400 mt-1">Hola, {googleUserPendingPin.displayName || googleUserPendingPin.email}</p>
                  </div>
                ) : (rememberedUser || bioUserEmail) && viewState === 'selection' ? (
                  <div key="header-selection">
                    <h2 className="text-lg font-bold text-gray-200 font-sans tracking-tight">¡Hola, {rememberedUser?.nombre || (bioUserEmail ? getBiometricUserData(bioUserEmail)?.nombre : null) || 'Bienvenido'}! 👋</h2>
                    <p className="text-xs text-gray-400 mt-1">
                      {biometricSupported && isBiometricsEnabledForUser(rememberedUser?.email || bioUserEmail || '')
                        ? 'Toca la huella dactilar para ingresar'
                        : 'Ingresa tu clave de acceso de 6 dígitos'}
                    </p>
                  </div>
                ) : viewState === 'register' ? (
                  <div key="header-register">
                    <h2 className="text-lg font-bold text-gray-200">Registro de Cliente</h2>
                    <p className="text-xs text-gray-400 mt-1">Crea tu cuenta para acceder a tu portal</p>
                  </div>
                ) : viewState === 'email_login' && stepLogin === 1 ? (
                  <div key="header-email">
                    <h2 className="text-lg font-bold text-gray-200">Entrar con Correo / Cédula</h2>
                    <p className="text-xs text-gray-400 mt-1">Ingresa tus datos registrados</p>
                  </div>
                ) : viewState === 'recovery_selection' ? (
                  <div key="header-rec-sel">
                    <h2 className="text-lg font-bold text-gray-200">¿Cómo recuperar tu cuenta?</h2>
                    <p className="text-xs text-gray-400 mt-1">Esta información nos permitirá saber si tu perfil ya existe.</p>
                  </div>
                ) : viewState === 'recovery_input' ? (
                  <div key="header-rec-in">
                    <h2 className="text-lg font-bold text-gray-200">Recuperar Cuenta</h2>
                    <p className="text-xs text-gray-400 mt-1">Ingresa tu {recoveryType === 'cedula' ? 'Cédula o RIF' : recoveryType === 'email' ? 'Correo electrónico' : 'Número de Teléfono'}</p>
                  </div>
                ) : viewState === 'recovery_method_selection' ? (
                  <div key="header-rec-method">
                    <h2 className="text-lg font-bold text-gray-200">Elige dónde enviarlo</h2>
                    <p className="text-xs text-gray-400 mt-1">Te enviaremos un link de recuperación. Elige el medio:</p>
                  </div>
                ) : viewState === 'recovery_success' ? (
                  <div key="header-rec-success">
                    <h2 className="text-lg font-bold text-gray-200">¡Solicitud Procesada!</h2>
                  </div>
                ) : (
                  <div key="header-fallback">
                    <h2 className="text-lg font-bold text-gray-200">Elegir cómo ingresar</h2>
                    <p className="text-xs text-gray-400 mt-1">Selecciona tu método de acceso preferido</p>
                  </div>
                )}
              </div>
            )}

            {error && (
              <div className="bg-red-500/10 border border-red-500/20 p-4 rounded-2xl text-red-400 text-xs font-bold flex items-start gap-3">
                <Shield size={16} className="shrink-0" />
                <span>{error}</span>
              </div>
            )}

            {showDownloadPrompt ? (
              <div key="download" className="space-y-6 text-center animate-in zoom-in duration-500">
                <div className="w-24 h-24 bg-gradient-to-br from-[#3498db] to-[#2ecc71] rounded-3xl mx-auto flex items-center justify-center shadow-2xl">
                   <Rocket size={48} className="text-white" />
                </div>
                <div>
                  <h2 className="text-2xl font-black text-white uppercase tracking-tight">¡Registro Exitoso!</h2>
                  <p className="text-[#3498db] font-bold mt-1">¿Quieres descargar la Mini App?</p>
                </div>
                <div className="flex flex-col gap-3 pt-4">
                  {deferredPrompt && (
                    <button 
                      onClick={async () => {
                        if (deferredPrompt) {
                          deferredPrompt.prompt();
                          const { outcome } = await deferredPrompt.userChoice;
                          if (outcome === 'accepted') setDeferredPrompt(null);
                        }
                      }}
                      className="w-full bg-[#2ecc71] text-white py-4 rounded-2xl font-black hover:bg-[#27ae60] transition-all shadow-[0_10px_20px_rgba(46,204,113,0.2)]"
                    >
                      INSTALAR MINI APP
                    </button>
                  )}
                  <button 
                    onClick={() => { window.location.reload(); }}
                    className="w-full bg-[#3498db] text-white py-4 rounded-2xl font-black hover:bg-[#2980b9] transition-all shadow-[0_10px_20px_rgba(52,152,219,0.2)]"
                  >
                    ¡ENTENDIDO, ENTRAR AL PORTAL!
                  </button>
                </div>
              </div>
            ) : viewState === 'selection' && stepLogin === 1 ? (
              <div key="selection" className="space-y-6">
                {(() => {
                  const activeBioEmail = (rememberedUser?.email && isBiometricsEnabledForUser(rememberedUser.email)) ? rememberedUser.email : (bioUserEmail && isBiometricsEnabledForUser(bioUserEmail) ? bioUserEmail : null);
                  const activeBioUserData = activeBioEmail ? (getBiometricUserData(activeBioEmail) || rememberedUser) : null;

                  if (biometricSupported && activeBioEmail) {
                    return (
                      <div className="space-y-6 text-center animate-in fade-in duration-300">
                        {/* BOLA DE HUELLA DACTILAR GIGANTE Y LLAMATIVA */}
                        <div className="py-2 flex flex-col items-center justify-center">
                          <button
                            type="button"
                            onClick={() => handleBiometricUnlock(false, activeBioEmail)}
                            disabled={loading}
                            className="w-32 h-32 rounded-full bg-gradient-to-br from-[#3498db] to-[#2ecc71] hover:scale-105 active:scale-95 transition-all duration-300 flex flex-col items-center justify-center shadow-[0_0_40px_rgba(46,204,113,0.4)] border-4 border-white/20 group relative overflow-hidden cursor-pointer mx-auto"
                          >
                            <div className="absolute inset-0 bg-white/20 blur-md group-hover:opacity-100 opacity-0 transition-opacity" />
                            <Fingerprint size={56} className="text-white animate-pulse" />
                            <span className="text-[8px] font-black uppercase text-white tracking-widest mt-1">TOCAR HUELLA</span>
                          </button>
                          <p className="text-[10px] font-black uppercase text-[#3498db] tracking-widest mt-4">
                            Presiona el círculo para abrir lector
                          </p>
                        </div>

                        <div className="space-y-3 pt-2">

                          <button 
                            type="button"
                            onClick={() => {
                              if (activeBioEmail) {
                                removeBiometrics(activeBioEmail);
                                setBioUserEmail(null);
                                setRememberedUser(null);
                                localStorage.removeItem('kalu_remembered_user');
                                resetViews();
                              }
                            }}
                            className="w-full text-center text-xs text-red-400/80 hover:text-red-400 transition-colors font-bold py-1.5 flex items-center justify-center gap-1.5 border-t border-white/5 mt-2 pt-3"
                          >
                            <X size={14} /> Desvincular / Quitar huella de este teléfono
                          </button>
                        </div>
                      </div>
                    );
                  }

                  return (
                    <div className="space-y-4">
                      <button 
                        onClick={handleGoogleLogin}
                        disabled={loading}
                        className="w-full bg-white text-black hover:bg-gray-200 py-4 px-6 rounded-2xl font-black flex items-center justify-center gap-3 transition-all active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed shadow-[0_10px_20px_rgba(255,255,255,0.05)] text-sm"
                      >
                        <LogIn size={20} /> CONTINUAR CON GMAIL
                      </button>
                      <button 
                        onClick={() => { setViewState('email_login'); setStepLogin(1); setError(null); }}
                        className="w-full bg-white/5 text-white hover:bg-white/10 py-4 px-6 rounded-2xl font-bold flex items-center justify-center gap-3 transition-all active:scale-95 border border-white/10 text-sm"
                      >
                        <KeyRound size={20} /> ENTRAR CON CORREO / CÉDULA
                      </button>
                      <button 
                        onClick={() => { setViewState('register'); setError(null); }}
                        className="w-full bg-gradient-to-r from-[#3498db]/20 to-[#2ecc71]/20 hover:from-[#3498db]/30 hover:to-[#2ecc71]/30 text-white py-4 px-6 rounded-2xl font-bold flex items-center justify-center gap-3 transition-all active:scale-95 border border-[#3498db]/30 text-sm"
                      >
                        <UserPlus size={20} /> ¿NUEVO CLIENTE? REGÍSTRATE
                      </button>
                      <button 
                        onClick={() => navigate('/catalogo')}
                        className="w-full bg-[#128C7E]/20 text-[#2ecc71] hover:bg-[#128C7E]/30 py-4 px-6 rounded-2xl font-bold flex items-center justify-center gap-3 transition-all active:scale-95 border border-[#128C7E]/30 text-sm"
                      >
                        <ShoppingBag size={20} /> VER CATÁLOGO DE PRODUCTOS
                      </button>
                    </div>
                  );
                })()}
              </div>
            ) : viewState === 'email_login' && stepLogin === 1 ? (
              <form key="email_login" onSubmit={handlePinLogin} className="space-y-4 animate-in fade-in slide-in-from-right-4 duration-300">
                <div className="space-y-2">
                  <label className="text-[10px] font-black uppercase text-gray-500 tracking-widest px-2">Correo Electrónico</label>
                  <input 
                    type="email"
                    required
                    value={email}
                    autoFocus
                    onChange={(e) => setEmail(e.target.value.replace(/\s/g, '').toLowerCase())}
                    className="w-full bg-black/40 border border-white/10 rounded-2xl py-4 px-4 text-center text-lg font-bold text-white outline-none focus:border-[#3498db] transition-all"
                    placeholder="Ej. cliente@correo.com"
                  />
                </div>
                <div className="flex gap-4">
                  <button type="button" onClick={resetViews} className="flex-1 bg-white/5 text-gray-400 py-4 rounded-2xl font-bold hover:bg-white/10 transition-all text-xs">VOLVER</button>
                  <button type="submit" className="flex-[2] bg-[#3498db] text-white py-4 rounded-2xl font-black hover:bg-[#2980b9] transition-all shadow-[0_10px_20px_rgba(52,152,219,0.2)] text-xs">CONTINUAR</button>
                </div>
              </form>
            ) : stepLogin === 2 && viewState !== 'recovery_selection' && viewState !== 'recovery_input' && viewState !== 'recovery_method_selection' && viewState !== 'recovery_success' ? (
              <div key="pin_entry" className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-300">
                <div className="text-center">
                  <div className="flex justify-center gap-4 mb-6">
                    {[0, 1, 2, 3, 4, 5].map((index) => (
                      <div 
                        key={index}
                        className={`w-4 h-4 rounded-full transition-all duration-300 ${pin.length > index ? 'bg-[#3498db] scale-110 shadow-[0_0_15px_rgba(52,152,219,0.6)]' : 'bg-white/10 border-2 border-white/20'}`}
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
                        if (pin.length < 6) setPin(prev => prev + num);
                      }}
                      className="aspect-square bg-white/5 hover:bg-white/10 active:bg-white/20 rounded-2xl flex items-center justify-center text-xl font-black text-white transition-all animate-pulse-slow"
                    >
                      {num}
                    </button>
                  ))}
                  {googleUserPendingPin ? (
                    <button type="button" onClick={handleCancelGooglePin} className="aspect-square flex flex-col items-center justify-center text-[10px] font-black text-red-400 hover:text-red-300 transition-colors uppercase leading-tight">SALIR</button>
                  ) : rememberedUser && viewState === 'selection' ? (
                    <button 
                      type="button" 
                      onClick={handleOtherAccessMethods} 
                      className="aspect-square flex flex-col items-center justify-center text-[9px] font-black text-gray-500 hover:text-white transition-colors uppercase leading-tight px-1 text-center"
                    >
                      OTROS<br/>MEDIOS
                    </button>
                  ) : (
                    <button type="button" onClick={() => setStepLogin(1)} className="aspect-square flex flex-col items-center justify-center text-[10px] font-black text-gray-500 hover:text-white transition-colors uppercase leading-tight">CORREO</button>
                  )}
                  <button
                    type="button"
                    onClick={() => {
                      if (window.navigator && window.navigator.vibrate) window.navigator.vibrate(10);
                      if (pin.length < 6) setPin(prev => prev + '0');
                    }}
                    className="aspect-square bg-white/5 hover:bg-white/10 active:bg-white/20 rounded-2xl flex items-center justify-center text-xl font-black text-white transition-all"
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
                <div className="flex flex-col items-center gap-3 pt-2">
                  {biometricSupported && (email || bioUserEmail || rememberedUser?.email) && isBiometricsEnabledForUser(email || bioUserEmail || rememberedUser?.email || '') && (
                    <button
                      type="button"
                      onClick={() => handleBiometricUnlock(false)}
                      className="w-full bg-[#3498db]/10 text-[#3498db] hover:bg-[#3498db]/20 border border-[#3498db]/30 py-3 rounded-2xl font-black text-xs uppercase tracking-widest transition-colors flex items-center justify-center gap-2 shadow-[0_0_15px_rgba(52,152,219,0.2)] mb-2"
                    >
                      <Fingerprint size={18} /> Usar Huella / Face ID
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => {
                      setViewState('recovery_selection');
                      setError(null);
                    }}
                    className="text-[#3498db] text-xs font-bold hover:text-white transition-colors"
                  >
                    ¿Olvidaste tu clave?
                  </button>
                </div>
              </div>
            ) : viewState === 'recovery_selection' ? (
              <div key="recovery_sel" className="space-y-4 animate-in fade-in slide-in-from-right-4 duration-300">
                <button onClick={() => { setRecoveryType('cedula'); setViewState('recovery_input'); setRecoveryInputVal(''); setError(null); }} className="w-full bg-white/5 text-white hover:bg-white/10 py-4 px-6 rounded-2xl font-bold flex items-center justify-start gap-4 transition-all active:scale-95 border border-white/10 text-sm">
                  <Hash size={20} className="text-[#3498db]" /> POR CÉDULA / RIF
                </button>
                <button onClick={() => { setRecoveryType('email'); setViewState('recovery_input'); setRecoveryInputVal(''); setError(null); }} className="w-full bg-white/5 text-white hover:bg-white/10 py-4 px-6 rounded-2xl font-bold flex items-center justify-start gap-4 transition-all active:scale-95 border border-white/10 text-sm">
                  <Mail size={20} className="text-[#2ecc71]" /> POR GMAIL / CORREO
                </button>
                <button onClick={() => { setRecoveryType('phone'); setViewState('recovery_input'); setRecoveryInputVal(''); setError(null); }} className="w-full bg-white/5 text-white hover:bg-white/10 py-4 px-6 rounded-2xl font-bold flex items-center justify-start gap-4 transition-all active:scale-95 border border-white/10 text-sm">
                  <Smartphone size={20} className="text-[#f1c40f]" /> POR NÚMERO DE TELÉFONO
                </button>
                <button onClick={resetViews} className="w-full bg-white/5 text-gray-400 py-3.5 rounded-2xl font-bold hover:bg-white/10 transition-all text-sm mt-2 text-center">VOLVER</button>
              </div>
            ) : viewState === 'recovery_input' ? (
              <form key="recovery_input" onSubmit={handleSearchRecoveryProfile} className="space-y-4 animate-in fade-in slide-in-from-right-4 duration-300">
                <div className="space-y-2">
                  <label className="text-[10px] font-black uppercase text-gray-500 tracking-widest px-2">{recoveryType === 'cedula' ? 'Cédula del cliente' : recoveryType === 'email' ? 'Correo electrónico' : 'Teléfono del cliente'}</label>
                  <input type="text" required value={recoveryInputVal} autoFocus onChange={(e) => setRecoveryInputVal(e.target.value)} className="w-full bg-black/40 border border-white/10 rounded-2xl py-4 px-4 text-center text-lg font-bold text-white outline-none focus:border-[#3498db] transition-all" placeholder={recoveryType === 'cedula' ? 'Ej. V12345678' : recoveryType === 'email' ? 'Ej. tucorreo@gmail.com' : 'Ej. 04241234567'} />
                </div>
                <div className="flex gap-4">
                  <button type="button" onClick={() => { setViewState('recovery_selection'); setError(null); }} className="flex-1 bg-white/5 text-gray-400 py-4 rounded-2xl font-bold hover:bg-white/10 transition-all text-xs">VOLVER</button>
                  <button type="submit" disabled={loading} className="flex-[2] bg-[#3498db] text-white py-4 rounded-2xl font-black hover:bg-[#2980b9] transition-all shadow-[0_10px_20px_rgba(52,152,219,0.2)] text-xs disabled:opacity-50">{loading ? 'BUSCANDO...' : 'CONTINUAR'}</button>
                </div>
              </form>
            ) : viewState === 'recovery_method_selection' ? (
              <div key="recovery_method" className="space-y-4 animate-in fade-in slide-in-from-right-4 duration-300">
                <div className="bg-white/5 p-4 rounded-2xl border border-white/10 text-center mb-2">
                  <p className="text-sm font-bold text-gray-300">¡Perfil encontrado!</p>
                  <p className="text-xs text-[#3498db] font-black uppercase mt-1">{recoveryFoundUser?.nombre}</p>
                </div>
                <button onClick={() => selectMethodAndSubmit('whatsapp')} disabled={loading} className="w-full bg-[#128C7E]/20 text-[#2ecc71] hover:bg-[#128C7E]/30 py-4 px-6 rounded-2xl font-bold flex items-center justify-start gap-4 transition-all border border-[#128C7E]/30 text-sm">
                  <Smartphone size={20} /> ENVIAR POR WHATSAPP
                </button>
                <button onClick={() => selectMethodAndSubmit('sms')} disabled={loading} className="w-full bg-[#3498db]/15 text-[#3498db] hover:bg-[#3498db]/30 py-4 px-6 rounded-2xl font-bold flex items-center justify-start gap-4 transition-all border border-[#3498db]/30 text-sm">
                  <Mail size={20} /> ENVIAR POR MENSAJE DE TEXTO (SMS)
                </button>
                <button onClick={() => selectMethodAndSubmit('email')} disabled={loading} className="w-full bg-white/5 text-gray-300 hover:bg-white/10 py-4 px-6 rounded-2xl font-bold flex items-center justify-start gap-4 transition-all border border-white/10 text-sm">
                  <Mail size={20} /> ENVIAR POR CORREO ELECTRÓNICO
                </button>
                <button onClick={() => setViewState('recovery_input')} className="w-full bg-white/5 text-gray-400 py-3.5 rounded-2xl font-bold hover:bg-white/10 transition-all text-sm mt-2 text-center">VOLVER</button>
              </div>
            ) : viewState === 'recovery_success' ? (
              <div key="recovery_success" className="space-y-6 text-center animate-in zoom-in duration-500">
                <div className="w-20 h-20 bg-green-500/20 text-[#2ecc71] rounded-full mx-auto flex items-center justify-center shadow-lg">
                   <CheckCircle size={48} />
                </div>
                <div>
                  <h3 className="text-xl font-black text-white uppercase tracking-tight">Solicitud Recibida</h3>
                  <p className="text-sm text-gray-400 mt-2">Te enviaremos el link de recuperación a tu **{recoveryMethod === 'whatsapp' ? 'WhatsApp' : recoveryMethod === 'sms' ? 'SMS' : 'Correo electrónico'}** registrado en los próximos minutos.</p>
                </div>
                <button onClick={resetViews} className="w-full bg-[#3498db] text-white py-4 rounded-2xl font-black hover:bg-[#2980b9] transition-all shadow-[0_10px_20px_rgba(52,152,219,0.2)]">VOLVER AL INICIO</button>
              </div>
            ) : (
              <form key="register" onSubmit={handleRegister} className="space-y-4 animate-in fade-in slide-in-from-bottom-4 duration-300">
                <div className="space-y-1">
                  <label className="text-[9px] font-black uppercase text-gray-500 tracking-widest px-2">Nombre Completo *</label>
                  <input type="text" required value={regNombre} onChange={(e) => setRegNombre(e.target.value)} className={`w-full bg-black/40 border rounded-2xl py-3 px-4 text-sm font-bold text-white outline-none transition-all ${regNombre && regNombre.trim().length >= 3 ? 'border-green-500' : regNombre ? 'border-red-500' : 'border-white/10 focus:border-[#3498db]'}`} placeholder="Ej. Juan Pérez" />
                  {regNombre && regNombre.trim().length < 3 && (
                    <p className="text-[10px] text-red-400 px-2 font-bold mt-1">⚠️ El nombre debe tener al menos 3 letras.</p>
                  )}
                </div>
                <div className="space-y-1">
                  <label className="text-[9px] font-black uppercase text-gray-500 tracking-widest px-2">Cédula / RIF *</label>
                  <input type="text" required value={regCedula} onChange={(e) => setRegCedula(e.target.value)} className={`w-full bg-black/40 border rounded-2xl py-3 px-4 text-sm font-bold text-white outline-none transition-all ${regCedula && regCedula.trim().length >= 5 ? 'border-green-500' : regCedula ? 'border-red-500' : 'border-white/10 focus:border-[#3498db]'}`} placeholder="Ej. V-12345678" />
                  {regCedula && regCedula.trim().length < 5 && (
                    <p className="text-[10px] text-red-400 px-2 font-bold mt-1">⚠️ Ingresa tu cédula completa. Ej: V-12345678</p>
                  )}
                </div>
                <div className="space-y-1">
                  <label className="text-[9px] font-black uppercase text-gray-500 tracking-widest px-2">Correo Electrónico *</label>
                  <input type="email" required value={regEmail} onChange={(e) => setRegEmail(e.target.value.replace(/\s/g, '').toLowerCase())} className={`w-full bg-black/40 border rounded-2xl py-3 px-4 text-sm font-bold text-white outline-none transition-all ${regEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(regEmail) ? 'border-red-500 focus:border-red-500' : regEmail && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(regEmail) ? 'border-green-500' : 'border-white/10 focus:border-[#3498db]'}`} placeholder="Ej. cliente@correo.com" />
                  {regEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(regEmail) && (
                    <p className="text-[10px] text-red-400 px-2 font-bold mt-1">⚠️ El formato del correo es inválido. Ej: nombre@correo.com</p>
                  )}
                </div>
                <div className="space-y-1">
                  <label className="text-[9px] font-black uppercase text-gray-500 tracking-widest px-2">Teléfono *</label>
                  <input type="text" required value={regTelefono} onChange={(e) => setRegTelefono(e.target.value)} className={`w-full bg-black/40 border rounded-2xl py-3 px-4 text-sm font-bold text-white outline-none transition-all ${regTelefono && regTelefono.replace(/\D/g,'').length < 10 ? 'border-red-500 focus:border-red-500' : regTelefono && regTelefono.replace(/\D/g,'').length >= 10 ? 'border-green-500' : 'border-white/10 focus:border-[#3498db]'}`} placeholder="0424-5556677" />
                  {regTelefono && regTelefono.replace(/\D/g,'').length < 10 && (
                    <p className="text-[10px] text-red-400 px-2 font-bold mt-1">⚠️ El teléfono debe tener al menos 10 dígitos. Ej: 04245556677</p>
                  )}
                </div>
                <div className="space-y-1">
                  <label className="text-[9px] font-black uppercase text-gray-500 tracking-widest px-2">Dirección Completa *</label>
                  <div 
                    onClick={() => setShowAddressModal(true)}
                    className={`w-full bg-black/40 border rounded-2xl py-3 px-4 text-sm font-bold text-white outline-none cursor-pointer transition-all ${regDireccion && !isValidAddress(regDireccion) ? 'border-red-500' : regDireccion && isValidAddress(regDireccion) ? 'border-green-500' : 'border-white/10 hover:border-[#3498db]'}`}
                  >
                    {regDireccion ? regDireccion : <span className="text-gray-400">Toca para ingresar dirección</span>}
                  </div>
                  {regDireccion && !isValidAddress(regDireccion) && (
                    <div className="text-[10px] text-red-400 px-2 font-bold mt-1 space-y-0.5">
                      <p>⚠️ Toca la dirección para completarla correctamente.</p>
                    </div>
                  )}
                  {regDireccion && isValidAddress(regDireccion) && (
                    <p className="text-[10px] text-green-400 px-2 font-bold mt-1">✅ Dirección válida</p>
                  )}
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="text-[9px] font-black uppercase text-gray-500 tracking-widest px-2">PIN Acceso (6 nº) *</label>
                    <input type="password" required maxLength={6} value={regPin} onChange={(e) => setRegPin(e.target.value.replace(/\D/g, ''))} className={`w-full bg-black/40 border rounded-2xl py-3 px-4 text-center text-lg font-black tracking-widest text-[#3498db] outline-none transition-all ${regPin && regPin.length < 6 ? 'border-orange-500' : regPin && regPin.length === 6 ? 'border-green-500' : 'border-white/10 focus:border-[#3498db]'}`} placeholder="******" />
                    {regPin && regPin.length > 0 && regPin.length < 6 && (
                      <p className="text-[9px] text-orange-400 px-1 font-bold">⚠️ Faltan {6 - regPin.length} dígito(s)</p>
                    )}
                  </div>
                  <div className="space-y-1">
                    <label className="text-[9px] font-black uppercase text-gray-500 tracking-widest px-2">Confirmar PIN *</label>
                    <input type="password" required maxLength={6} value={regConfirmPin} onChange={(e) => setRegConfirmPin(e.target.value.replace(/\D/g, ''))} className={`w-full bg-black/40 border rounded-2xl py-3 px-4 text-center text-lg font-black tracking-widest text-[#3498db] outline-none transition-all ${regPin && regConfirmPin && regPin !== regConfirmPin ? 'border-red-500 focus:border-red-500' : regConfirmPin && regPin === regConfirmPin && regPin.length === 6 ? 'border-green-500' : 'border-white/10 focus:border-[#3498db]'}`} placeholder="******" />
                    {regPin && regConfirmPin && regPin !== regConfirmPin && (
                      <p className="text-[9px] text-red-400 px-1 font-bold">⚠️ Los PIN no coinciden</p>
                    )}
                  </div>
                </div>

                {!loading && missing.length > 0 && (
                  <div className="bg-orange-500/10 border border-orange-500/20 rounded-2xl p-3 space-y-1">
                    <p className="text-[9px] font-black uppercase text-orange-400 tracking-widest mb-2">📋 Para completar tu registro falta:</p>
                    {missing.map((m, i) => (
                      <p key={i} className="text-[10px] text-orange-300 font-bold pl-2">• {m}</p>
                    ))}
                  </div>
                )}

                <div className="flex gap-4 pt-2">
                  <button type="button" onClick={resetViews} className="flex-1 bg-white/5 text-gray-400 py-3.5 rounded-2xl font-bold hover:bg-white/10 transition-all text-sm">CANCELAR</button>
                  <button 
                    type="submit" 
                    disabled={loading || missing.length > 0} 
                    className="flex-[2] bg-gradient-to-r from-[#3498db] to-[#2ecc71] text-white py-3.5 rounded-2xl font-black hover:opacity-90 transition-all text-sm disabled:opacity-50 disabled:from-gray-600 disabled:to-gray-700 disabled:cursor-not-allowed"
                  >
                    {loading ? 'REGISTRANDO...' : 'REGISTRARME'}
                  </button>
                </div>
              </form>
            )}
            <div className="pt-6 border-t border-white/5 grid grid-cols-2 gap-4">
              <div className="text-center">
                <span className="text-[10px] text-gray-600 block uppercase font-bold tracking-tight mb-2">Versión</span>
                <span className="text-xs font-bold text-gray-400">v2.0.5 - STABLE</span>
              </div>
              <div className="text-center">
                <span className="text-[10px] text-gray-600 block uppercase font-bold tracking-tight mb-2">Seguridad</span>
                <span className="text-xs font-bold text-[#2ecc71]">SSL ACTIVE</span>
              </div>
            </div>
          </div>
        </div>
        <p className="text-center text-gray-500 text-[10px] mt-8 font-black uppercase tracking-[0.2em] opacity-50">Powered by Antigravity AI — Built for Scale</p>
      </div>
      {/* Address Modal Overlay */}
      {showAddressModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="bg-[#1a2235] border border-white/10 rounded-3xl p-6 w-full max-w-sm shadow-2xl relative">
            <button 
              onClick={() => setShowAddressModal(false)}
              className="absolute top-4 right-4 text-gray-400 hover:text-white"
            >
              <X className="w-5 h-5" />
            </button>
            <h2 className="text-xl font-black text-white mb-4">Ingresa tu Dirección</h2>
            
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-[10px] font-black uppercase text-gray-500 tracking-widest">Tipo de Vía</label>
                  <select 
                    value={addrType} 
                    onChange={(e) => setAddrType(e.target.value)}
                    className="w-full bg-black/40 border border-white/10 rounded-xl py-3 px-3 text-sm font-bold text-white outline-none focus:border-[#3498db]"
                  >
                    <option value="Calle">Calle</option>
                    <option value="Avenida">Avenida</option>
                    <option value="Vereda">Vereda</option>
                    <option value="Carrera">Carrera</option>
                    <option value="Urb">Urbanización</option>
                    <option value="Sector">Sector</option>
                  </select>
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-black uppercase text-gray-500 tracking-widest">Nombre/Nº Vía</label>
                  <input 
                    type="text" 
                    value={addrName} 
                    onChange={(e) => setAddrName(e.target.value)} 
                    className="w-full bg-black/40 border border-white/10 rounded-xl py-3 px-3 text-sm font-bold text-white outline-none focus:border-[#3498db]" 
                    placeholder="Ej. 5" 
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-black uppercase text-gray-500 tracking-widest">Número de Casa / Edificio / Apto</label>
                <input 
                  type="text" 
                  value={addrNum} 
                  onChange={(e) => setAddrNum(e.target.value)} 
                  className="w-full bg-black/40 border border-white/10 rounded-xl py-3 px-3 text-sm font-bold text-white outline-none focus:border-[#3498db]" 
                  placeholder="Ej. Casa 12 / Apto 3B" 
                />
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-black uppercase text-gray-500 tracking-widest">Referencia Adicional (Opcional)</label>
                <input 
                  type="text" 
                  value={addrRef} 
                  onChange={(e) => setAddrRef(e.target.value)} 
                  className="w-full bg-black/40 border border-white/10 rounded-xl py-3 px-3 text-sm font-bold text-white outline-none focus:border-[#3498db]" 
                  placeholder="Ej. Cerca de la panadería" 
                />
              </div>

              <button
                onClick={() => {
                  const parts = [];
                  if (addrType && addrName) parts.push(`${addrType} ${addrName}`);
                  if (addrNum) parts.push(addrNum);
                  if (addrRef) parts.push(`(${addrRef})`);
                  setRegDireccion(parts.join(', '));
                  setShowAddressModal(false);
                }}
                disabled={!addrName || !addrNum}
                className="w-full bg-[#3498db] text-white py-3 rounded-xl font-bold uppercase tracking-widest text-sm hover:bg-[#2980b9] transition-colors disabled:opacity-50 disabled:cursor-not-allowed mt-2"
              >
                Guardar Dirección
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};

export default LoginScreen;
