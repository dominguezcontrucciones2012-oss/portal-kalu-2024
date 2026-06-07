import React, { createContext, useContext, useState, useEffect } from 'react';
import { auth, db, onAuthStateChangedCustom, isMock } from '../lib/firebase';
import { doc, getDoc } from 'firebase/firestore';
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

  // Wrapper persistente para setUser
  const setUser = (u: User | null) => {
    setUserState(u);
    if (u) {
      localStorage.setItem('kalu_current_user', JSON.stringify(u));
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
        setUserState(parsed);
        if (isMock) {
          setLoading(false);
          return;
        }
      } catch (e) {
        console.error("Error cargando sesión persistente:", e);
      }
    }

    if (isMock) {
      setLoading(false);
      return;
    }

    try {
      const unsubscribe = onAuthStateChangedCustom(auth, async (firebaseUser: any) => {
        if (firebaseUser) {
          try {
            const userDoc = await getDoc(doc(db, 'users', firebaseUser.uid));

            if (userDoc.exists()) {
              const profile = userDoc.data();
              const fullUser = {
                id: firebaseUser.uid,
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
              const fullUser = {
                id: firebaseUser.uid,
                username: firebaseUser.displayName || 'Nuevo Usuario',
                role: Role.CLIENTE,
                email: firebaseUser.email || undefined,
              } as User;
              setUserState(fullUser);
              localStorage.setItem('kalu_current_user', JSON.stringify(fullUser));
            }
          } catch (e) {
            console.error("Error fetching user profile:", e);
            const fullUser = {
              id: firebaseUser.uid,
              username: firebaseUser.displayName || 'Usuario',
              role: Role.CLIENTE,
              email: firebaseUser.email || undefined,
            } as User;
            setUserState(fullUser);
            localStorage.setItem('kalu_current_user', JSON.stringify(fullUser));
          }
        } else {
          // Si no hay usuario de Firebase Auth, pero tenemos un usuario de tipo PIN en localStorage, no borrarlo
          const cachedUserStr = localStorage.getItem('kalu_current_user');
          if (cachedUserStr) {
            try {
              const cached = JSON.parse(cachedUserStr);
              if (cached.pin) {
                setUserState(cached);
                setLoading(false);
                return;
              }
            } catch (err) {}
          }
          setUserState(null);
          localStorage.removeItem('kalu_current_user');
        }
        setLoading(false);
      });

      return unsubscribe;
    } catch (error) {
      console.error("Failed to set up auth listener:", error);
      setLoading(false);
    }
  }, []);

  const isStaff = user ? [Role.ADMIN, Role.DUENO, Role.SUPERVISOR, Role.CAJERO].includes(user.role) : false;
  const isAdmin = user?.role === Role.ADMIN || user?.role === Role.DUENO;

  return (
    <AuthContext.Provider value={{ user, loading, isAdmin, isStaff, setUser }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
