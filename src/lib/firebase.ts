import { initializeApp } from 'firebase/app';
import { getAuth, onAuthStateChanged, signInWithPopup } from 'firebase/auth';
import { getFirestore, doc, getDocFromCache, getDocFromServer, collection, query, where, getDocs } from 'firebase/firestore';
import { getStorage } from 'firebase/storage';
import firebaseConfig from '../../firebase-applet-config.json';
import { MOCK_USERS } from '../data/mockData';

// Check for placeholder configuration
if (firebaseConfig.apiKey === 'YOUR_API_KEY') {
  console.warn("⚠️ Firebase configuration is using placeholders. Please update firebase-applet-config.json with real credentials.");
}

let app;
let db: any;
let auth: any;
let storage: any;
let isMock = false;

try {
  if (firebaseConfig.apiKey && firebaseConfig.apiKey !== 'YOUR_API_KEY') {
    app = initializeApp(firebaseConfig);
    db = getFirestore(app, firebaseConfig.firestoreDatabaseId);
    auth = getAuth(app);
    storage = getStorage(app);
    isMock = false;
  } else {
    console.warn("⚠️ Firebase configuration is using placeholders. Firebase services will be unavailable.");
    isMock = true;
    db = {}; 
    storage = {};
    const mockListeners: any[] = [];
    auth = { 
      onAuthStateChanged: (cb: any) => { 
        mockListeners.push(cb);
        cb(null); 
        return () => {
          const index = mockListeners.indexOf(cb);
          if (index > -1) mockListeners.splice(index, 1);
        }; 
      },
      signOut: () => {
        mockListeners.forEach(cb => cb(null));
        return Promise.resolve();
      },
      signInWithPopup: () => {
        const mockUser = {
          uid: 'mock-user-123',
          displayName: 'Admin Mock',
          email: 'admin@kalu.com',
          role: 'ADMIN'
        };
        mockListeners.forEach(cb => cb(mockUser));
        return Promise.resolve({ user: mockUser });
      }
    };


  }
} catch (error) {
  console.error("❌ Failed to initialize Firebase. The application may not function correctly.", error);
  isMock = true;
  db = {};
  storage = {};
  auth = { onAuthStateChanged: (cb: any) => { cb(null); return () => {}; } };
}

export const onAuthStateChangedCustom = (authObj: any, callback: any) => {
  if (isMock) {
    return authObj.onAuthStateChanged(callback);
  }
  return onAuthStateChanged(authObj, callback);
};

export const signInWithPopupCustom = (authObj: any, provider: any) => {
  if (isMock) {
    return authObj.signInWithPopup(provider);
  }
  return signInWithPopup(authObj, provider);
};

export const signInWithPinCustom = async (cedulaOrPin: string, pin?: string) => {
  const actualPin = pin !== undefined ? pin : cedulaOrPin;
  const actualCedula = pin !== undefined ? cedulaOrPin : undefined;

  if (isMock) {
    try {
      const res = await fetch('/api/db/users');
      if (res.ok) {
        const users = await res.json();
        const user = users.find((u: any) => {
          if (actualCedula) {
            return (u.cedula === actualCedula || u.username === actualCedula) && u.pin === actualPin;
          }
          return u.pin === actualPin;
        });
        if (user) {
          return user;
        }
      }
    } catch (e) {
      console.error("Error during PIN login:", e);
    }
    throw new Error(actualCedula ? 'Cédula o PIN Incorrecto' : 'PIN Incorrecto');
  }
  // Real implementation
  try {
    // Soporte para usuarios que tal vez inician sesión usando su ID o username como cedula por compatibilidad
    // Pero forzamos que el PIN coincida para ese documento específico
    const q = query(
      collection(db, 'users'), 
      where('pin', '==', actualPin)
    );
    const querySnapshot = await getDocs(q);
    
    // Filtrar localmente por cédula para mayor seguridad o soportar 'username' = cedula (como se guarda a veces)
    const matchedDocs = querySnapshot.docs.filter(doc => {
      const data = doc.data();
      if (actualCedula) {
        return (data.cedula === actualCedula) || (data.username === actualCedula);
      }
      return true;
    });

    if (matchedDocs.length > 0) {
      let userDoc = matchedDocs[0];
      
      // Si no se proporcionó cédula (ej. ventana de autorización de Supervisor), 
      // priorizar usuarios del staff en caso de que un cliente tenga el mismo PIN.
      if (!actualCedula && matchedDocs.length > 1) {
        const staffDoc = matchedDocs.find(doc => {
          const r = String(doc.data().role || '').toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
          return r.includes('admin') || r.includes('duen') || r.includes('super') || r.includes('cajero');
        });
        if (staffDoc) {
          userDoc = staffDoc;
        }
      }

      const profile = userDoc.data();
      return {
        id: userDoc.id,
        username: profile.username || 'Usuario',
        role: profile.role || 'cliente',
        email: profile.email || undefined,
        pin: profile.pin,
        cedula: profile.cedula,
        clientId: profile.clientId
      };
    }
  } catch (error) {
    console.error("Error during PIN login:", error);
  }
  throw new Error(actualCedula ? 'Cédula o PIN Incorrecto' : 'PIN Incorrecto');
};

export { db, auth, storage, isMock };




// Connectivity check
async function testConnection() {
  try {
    if (firebaseConfig.apiKey && firebaseConfig.apiKey !== 'YOUR_API_KEY' && db) {
      await getDocFromServer(doc(db, 'test', 'connection'));
    }
  } catch (error) {
    // Silent fail for connectivity
  }
}
testConnection();

