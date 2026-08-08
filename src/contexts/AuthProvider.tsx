import React, { createContext, useContext, useState, useEffect } from 'react';
import { auth, db, onAuthStateChangedCustom, isMock } from '../lib/firebase';
import { doc, getDoc, setDoc, serverTimestamp, onSnapshot, query, collection, where, getDocs } from 'firebase/firestore';
import { Role, User } from '../types';

interface AuthContextType {
  user: User | null;
  loading: boolean;
  isAdmin: boolean;
  isStaff: boolean;
  authError: string | null;
  setUser: (user: User | null) => void;
  retryAuth: () => void;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  loading: true,
  isAdmin: false,
  isStaff: false,
  authError: null,
  setUser: () => {},
  retryAuth: () => {},
  logout: async () => {},
});

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUserState] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [authError, setAuthError] = useState<string | null>(null);
  const [retryCount, setRetryCount] = useState(0);

  const retryAuth = () => {
    setAuthError(null);
    setLoading(true);
    setRetryCount(prev => prev + 1);
  };

  const setUser = (u: User | null) => {
    setUserState(u);
    if (u) {
      localStorage.setItem('kalu_current_user', JSON.stringify(u));
      localStorage.setItem('kalu_remembered_user', JSON.stringify({
        nombre: u.username,
        email: u.email || (u as any).cedula,
        method: u.email && !u.email.endsWith('@kalu.app') ? 'google' : 'email'
      }));
    } else {
      localStorage.removeItem('kalu_current_user');
    }
  };

  const logout = async () => {
    const role = user?.role;
    // 1. Limpieza total de estado local
    localStorage.clear();
    sessionStorage.clear();
    
    // Limpieza de caché residual en DOM/URL (Evita el flash de tienda anterior)
    if (typeof window !== 'undefined') {
      window.history.replaceState({}, document.title, window.location.pathname);
    }
    
    // 2. Cerrar sesión en Firebase
    try {
      await auth.signOut();
    } catch (e) {
      console.error("Error signing out:", e);
    }

    // 3. Redirección dura (Hard reset) dependiendo del rol
    if (role === 'superadmin' || role === 'dueno' || role === 'admin') {
      window.location.href = window.location.hostname.includes('admin') ? '/' : '/admin/login';
    } else {
      window.location.href = '/';
    }
  };

  useEffect(() => {
    setAuthError(null);
    // 1. Intentar cargar usuario desde LocalStorage primero (para persistencia de PIN o Mock)
    const savedUser = localStorage.getItem('kalu_current_user');
    if (savedUser) {
      try {
        const parsed = JSON.parse(savedUser);
        // Si tiene PIN, es un usuario de PIN local — restaurar inmediatamente sin esperar Firebase
        if (parsed && parsed.pin) {
          setUserState(parsed);
          setLoading(false);
          return; // No necesitamos esperar a Firebase para usuarios PIN
        }
        setUserState(parsed);
        setLoading(false);
      } catch (e) {
        console.error("Error cargando sesión persistente:", e);
      }
    }

    if (isMock) {
      setLoading(false);
      return;
    }

    const unsubscribe = onAuthStateChangedCustom(auth, async (firebaseUser: any) => {
      if (firebaseUser) {
          // --- CONTROL DE VERIFICACIÓN DE PIN ---
          const pinVerified = localStorage.getItem('kalu_pin_verified') === 'true';
          const savedUser = localStorage.getItem('kalu_current_user');
          const parsedSaved = savedUser ? JSON.parse(savedUser) : null;
          const isMasterRole = ['superadmin', 'dueno'].includes(parsedSaved?.role);
          
          if (!pinVerified && !isMasterRole) {
            setUserState(null);
            setLoading(false);
            return;
          }
          // ─────────────────────────────────────

          // Workaround for Firebase Auth -> Firestore rules propagation race condition
          // Reduced to 200ms to avoid UI flashes during login
          await new Promise(r => setTimeout(r, 200));
          
          try {
            let userDoc: any = null;
            let retries = 0;
            let success = false;
            
            while (retries < 1 && !success) {
              try {
                const userDocPromise = getDoc(doc(db, 'users', firebaseUser.uid));
                const timeoutPromise = new Promise((_, reject) => 
                  setTimeout(() => reject(new Error("Timeout")), 2000)
                );
                userDoc = await Promise.race([userDocPromise, timeoutPromise]);
                
                if (!userDoc || !userDoc.exists()) {
                  if (firebaseUser.email) {
                    const cleanEmail = firebaseUser.email.trim().toLowerCase();
                    // Primero buscar en administradores (prioridad)
                    const qAdmin = query(collection(db, 'administradores'), where('email', '==', cleanEmail));
                    const snapAdmin = await getDocs(qAdmin);
                    if (!snapAdmin.empty) {
                      userDoc = snapAdmin.docs[0] as any;
                    } else {
                      // Luego buscar en users
                      const q = query(collection(db, 'users'), where('email', '==', cleanEmail));
                      const snap = await getDocs(q);
                      if (!snap.empty) {
                        userDoc = snap.docs[0] as any;
                      }
                    }
                  }
                }
                
                success = true;
              } catch (err) {
                retries++;
                if (retries >= 1) throw err;
                await new Promise(r => setTimeout(r, 500));
              }
            }

            if (firebaseUser.isAnonymous) {
              const saved = localStorage.getItem('kalu_current_user');
              if (saved) {
                try {
                  const parsed = JSON.parse(saved);
                  setUserState(parsed);
                } catch (e) {
                  setUserState(null);
                }
              }
            } else if (userDoc && userDoc.exists()) {
              const profile = userDoc.data();
              const fullUser = {
                id: userDoc.id, // Usar el ID del documento en caso de ser un alias por email
                username: profile.username || firebaseUser.displayName || 'Usuario',
                role: profile.role || Role.CLIENTE,
                email: firebaseUser.email || undefined,
                avatar: firebaseUser.photoURL || undefined,
                cedula: profile.cedula,
                clientId: profile.clientId,
                storeId: profile.storeId
              } as User;
              setUserState(fullUser);
              localStorage.setItem('kalu_current_user', JSON.stringify(fullUser));
              if (profile.storeId) {
                localStorage.setItem('activeStoreId', profile.storeId);
              }
            } else {
              // Si el usuario no existe, NO lo creamos automáticamente. 
              // Dejamos que LoginScreen.tsx maneje esto (mostrará que no está vinculado).
              setUserState(null);
              localStorage.removeItem('kalu_current_user');
            }
          } catch (e: any) {
            console.error("Error crítico en AuthProvider:", e);
            setAuthError(e.message || "Error conectando con el servidor. Verifica tu conexión a internet.");
            setUserState(null);
          }
        } else {
          const saved = localStorage.getItem('kalu_current_user');
          if (saved) {
            try {
              const parsed = JSON.parse(saved);
              if (parsed && (parsed.method === 'biometric' || parsed.pin || parsed.id)) {
                if (!auth.currentUser) {
                  import('firebase/auth').then(({ signInAnonymously }) => signInAnonymously(auth).catch(() => {}));
                }
                const targetId = parsed.id || parsed.clientId;
                if (targetId) {
                  getDoc(doc(db, 'users', targetId)).then((snap) => {
                    if (snap.exists()) {
                      const freshData = snap.data();
                      const fullUser = {
                        ...parsed,
                        role: freshData.role || parsed.role || Role.CLIENTE,
                        username: freshData.username || freshData.nombre || parsed.username
                      };
                      setUserState(fullUser);
                      localStorage.setItem('kalu_current_user', JSON.stringify(fullUser));
                    } else {
                      setUserState(parsed);
                    }
                    setLoading(false);
                  }).catch(() => {
                    setUserState(parsed);
                    setLoading(false);
                  });
                  return;
                } else {
                  setUserState(parsed);
                  setLoading(false);
                  return;
                }
              }
            } catch (e) {}
          }
          setUserState(null);
          localStorage.removeItem('kalu_current_user');
          localStorage.removeItem('kalu_pin_verified');
        }
        setLoading(false);
      });

      return () => {
        unsubscribe();
      };
  }, [retryCount]);

  useEffect(() => {
    const targetUid = user?.id || user?.clientId;
    if (!targetUid || isMock) return;

    let isPolling = false;
    let pollInterval: any = null;

    const updateRoleFromData = (newRole: any) => {
      if (!newRole) return;
      setUserState(prevUser => {
        if (!prevUser || prevUser.role === newRole) return prevUser;
        console.log(`🔄 Rol actualizado en vivo: ${prevUser.role} -> ${newRole}`);
        const updatedUser = {
          ...prevUser,
          role: newRole as any,
        };
        localStorage.setItem('kalu_current_user', JSON.stringify(updatedUser));
        return updatedUser as any;
      });
    };

    const startPolling = () => {
      if (isPolling) return;
      isPolling = true;
      const pollRole = async () => {
        try {
          const params = new URLSearchParams();
          if (targetUid) params.append('uid', targetUid);
          if (user?.cedula) params.append('cedula', user.cedula);
          if (user?.email) params.append('email', user.email);
          params.append('_t', Date.now().toString());

          const res = await fetch(`/api/user-role?${params.toString()}`, { cache: 'no-store' });
          if (res.ok) {
            const data = await res.json();
            if (data && data.role) {
              updateRoleFromData(data.role);
            }
          }
        } catch (e) {}
      };
      // Poll initially and then every 10 seconds
      pollRole();
      pollInterval = setInterval(pollRole, 10000);
    };

    const unsub = onSnapshot(doc(db, 'users', targetUid), (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data();
        updateRoleFromData(data.role);
      } else {
        startPolling();
      }
    }, (err) => {
      console.warn("Snapshot listener warning:", err);
      startPolling();
    });

    // Unconditionally start polling as a bulletproof backup
    startPolling();

    return () => {
      unsub();
      if (pollInterval) clearInterval(pollInterval);
    };
  }, [user?.id, user?.clientId, user?.cedula, user?.email]);

  const isStaff = user ? [Role.ADMIN, Role.DUENO, Role.SUPERVISOR, Role.CAJERO].includes(user.role) : false;
  const isAdmin = user?.role === Role.ADMIN || user?.role === Role.DUENO;
      
  return (
    <AuthContext.Provider value={{ 
      user, 
      loading, 
      isAdmin, 
      isStaff, 
      authError, 
      setUser, 
      retryAuth,
      logout
    }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
