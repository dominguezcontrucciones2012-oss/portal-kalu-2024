import React, { createContext, useContext, useState, useEffect } from 'react';
import { auth, db, onAuthStateChangedCustom, isMock } from '../lib/firebase';
import { doc, getDoc, setDoc, serverTimestamp, onSnapshot, query, collection, where, getDocs } from 'firebase/firestore';
import { Role, User } from '../types';

interface AuthContextType {
  user: User | null;
  loading: boolean;
  isAdmin: boolean;
  isStaff: boolean;
  setUser: (user: User | null) => void;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  loading: true,
  isAdmin: false,
  isStaff: false,
  setUser: () => {},
});

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUserState] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

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

  useEffect(() => {
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

    // Red de seguridad: si Firebase tarda más de 8 segundos, liberar el loading
    const safetyTimeout = setTimeout(() => {
      setLoading(false);
    }, 8000);

      const unsubscribe = onAuthStateChangedCustom(auth, async (firebaseUser: any) => {
        clearTimeout(safetyTimeout);
        if (firebaseUser) {
          // --- CONTROL DE VERIFICACIÓN DE PIN ---
          const pinVerified = localStorage.getItem('kalu_pin_verified') === 'true';
          if (!pinVerified) {
            setUserState(null);
            setLoading(false);
            return;
          }
          // ─────────────────────────────────────

          // Workaround for Firebase Auth -> Firestore rules propagation race condition
          // Wait 1.2s before attempting to read protected documents
          await new Promise(r => setTimeout(r, 1200));
          
          try {
            let userDoc: any = null;
            let retries = 0;
            let success = false;
            
            while (retries < 5 && !success) {
              try {
                const userDocPromise = getDoc(doc(db, 'users', firebaseUser.uid));
                const timeoutPromise = new Promise((_, reject) => 
                  setTimeout(() => reject(new Error("Timeout")), 4000)
                );
                userDoc = await Promise.race([userDocPromise, timeoutPromise]);
                
                if (!userDoc || !userDoc.exists()) {
                  if (firebaseUser.email) {
                    const cleanEmail = firebaseUser.email.trim().toLowerCase();
                    const q = query(collection(db, 'users'), where('email', '==', cleanEmail));
                    const snap = await getDocs(q);
                    if (!snap.empty) {
                      userDoc = snap.docs[0] as any;
                    }
                  }
                }
                
                success = true;
              } catch (err) {
                retries++;
                if (retries >= 5) throw err;
                await new Promise(r => setTimeout(r, 1000));
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
                clientId: profile.clientId
              } as User;
              setUserState(fullUser);
              localStorage.setItem('kalu_current_user', JSON.stringify(fullUser));
            } else {
              // Si el usuario no existe, NO lo creamos automáticamente. 
              // Dejamos que LoginScreen.tsx maneje esto (mostrará que no está vinculado).
              setUserState(null);
              localStorage.removeItem('kalu_current_user');
            }
          } catch (e) {
            console.error("Error crítico en AuthProvider:", e);
            const safeEmail = firebaseUser.email ? firebaseUser.email.trim().toLowerCase() : '';
            const isAdmin = ['dominguezcontrucciones2012@gmail.com', 'dominguezconstrucciones2012@gmail.com', 'domingueconstrucciones@gmail.com', 'dominguezconstrucciones@gmail.com'].includes(safeEmail);
            
            const fullUser = {
              id: firebaseUser.uid,
              username: firebaseUser.displayName || 'Usuario',
              role: isAdmin ? Role.ADMIN : Role.CLIENTE,
              email: firebaseUser.email || undefined,
            } as User;
            setUserState(fullUser);
            localStorage.setItem('kalu_current_user', JSON.stringify(fullUser));
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

      return unsubscribe;
  }, []);

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
    <AuthContext.Provider value={{ user, loading, isAdmin, isStaff, setUser }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
