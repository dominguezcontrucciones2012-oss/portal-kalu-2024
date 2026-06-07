import { 
  collection, 
  doc, 
  setDoc, 
  getDocs, 
  query, 
  where, 
  updateDoc, 
  addDoc,
  deleteDoc,
  getDoc,
  serverTimestamp,
  increment,
  onSnapshot
} from 'firebase/firestore';
import { db, isMock } from './firebase';
import { MOCK_PRODUCTS, MOCK_CLIENTS, MOCK_SALES } from '../data/mockData';

// Local storage keys
const LS_KEYS = {
  products: 'kalu_products',
  clients: 'kalu_clients',
  sales: 'kalu_sales',
  users: 'kalu_users'
};

// Local storage helpers
const getLS = (key: string) => JSON.parse(localStorage.getItem(key) || 'null');
const setLS = (key: string, data: any) => localStorage.setItem(key, JSON.stringify(data));

// Initialize local storage if empty
if (typeof window !== 'undefined' && !localStorage.getItem(LS_KEYS.products)) {
  setLS(LS_KEYS.products, MOCK_PRODUCTS);
  setLS(LS_KEYS.clients, MOCK_CLIENTS);
  setLS(LS_KEYS.sales, MOCK_SALES);
  setLS(LS_KEYS.users, []);
  setLS('kalu_tasas_bcv', [{
    fecha: new Date().toISOString().split('T')[0],
    valor: 40.50,
    fuente: 'Manual / Interna',
    estatus: 'Manual',
    sincronizadoEn: new Date().toISOString()
  }]);
}


/**
 * Función para sembrar los datos mock en Firestore.
 * Solo debe usarse una vez para inicializar la base de datos.
 */
export async function seedDatabase() {
  console.log("Iniciando sembrado de datos...");

  // Sembrar Productos
  for (const product of MOCK_PRODUCTS) {
    await setDoc(doc(db, 'products', product.id), {
      ...product,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    });
  }

  // Sembrar Clientes
  for (const client of MOCK_CLIENTS) {
    await setDoc(doc(db, 'clients', client.id), {
      ...client,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    });
  }

  // Sembrar Ventas (Opcional, para historial)
  for (const sale of MOCK_SALES) {
    await setDoc(doc(db, 'sales', sale.id), {
      ...sale,
      createdAt: serverTimestamp()
    });
  }

  console.log("Sembrado completado con éxito.");
}

/**
 * Helpers genéricos para Firestore
 */

export const subscribeToCollection = (collectionName: string, callback: (data: any[]) => void) => {
  if (isMock) {
    const fetchCollection = () => {
      fetch(`/api/db/${collectionName}`)
        .then(r => {
          if (!r.ok) throw new Error("Error fetching collection");
          return r.json();
        })
        .then(data => callback(data))
        .catch(e => console.error(`Error in subscribeToCollection for ${collectionName}:`, e));
    };

    fetchCollection();
    
    // Poll the dev server for multi-device sync with optimized intervals
    const intervalTime = collectionName === 'sales' ? 8000 : 4000;
    const interval = setInterval(fetchCollection, intervalTime);
    return () => clearInterval(interval);
  }

  return onSnapshot(collection(db, collectionName), (snapshot) => {
    const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    callback(data);
  });
};


export const updateStock = async (productId: string, quantity: number, motivo: string = 'VENTA', userId: string = 'current-user') => {
  if (isMock) {
    try {
      const getRes = await fetch(`/api/db/products/${productId}`);
      if (getRes.ok) {
        const product = await getRes.json();
        product.stock -= quantity;
        await fetch(`/api/db/products/${productId}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(product)
        });
      }
    } catch (e) {
      console.error("Error updating stock in mock mode:", e);
    }
  } else {
    const productRef = doc(db, 'products', productId);
    await updateDoc(productRef, {
      stock: increment(-quantity),
      updatedAt: serverTimestamp()
    });
  }

  // Auditoría automática según el modelo AuditoriaInventario
  await addDocument('auditoria_inventario', {
    producto_id: productId,
    usuario_id: userId,
    tipo_movimiento: quantity > 0 ? 'SALIDA' : 'ENTRADA',
    cantidad: Math.abs(quantity),
    motivo: motivo,
    fecha: new Date().toISOString()
  });
};

/**
 * Configuración de Empresa
 */
export const getAppConfig = async () => {
  if (isMock) return null;
  const configRef = doc(db, 'configuracion', 'global');
  const snap = await getDoc(configRef);
  return snap.exists() ? snap.data() : null;
};

export const updateAppConfig = async (config: any) => {
  return setDoc(doc(db, 'configuracion', 'global'), {
    ...config,
    updatedAt: serverTimestamp()
  });
};


export const createClient = async (clientData: any) => {
  if (isMock) {
    try {
      const clientsRes = await fetch('/api/db/clients');
      const clients = await clientsRes.json();
      const newId = `c${clients.length + 1}`;
      
      const newClient = { 
        id: newId,
        nombre: clientData.nombre,
        cedula: clientData.cedula,
        telefono: clientData.telefono || '',
        direccion: clientData.direccion || '',
        saldo_usd: clientData.saldo_usd || 0, 
        puntos: clientData.puntos || 0 
      };

      // Guardar el nuevo cliente
      await fetch(`/api/db/clients/${newId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newClient)
      });
      
      // Guardar el nuevo usuario del portal
      const lastFour = clientData.cedula.slice(-4);
      const newUser = { 
        id: newId,
        username: clientData.nombre, 
        role: 'cliente', 
        pin: clientData.pin || lastFour,
        cedula: clientData.cedula,
        clientId: newId
      };
      
      await fetch(`/api/db/users/${newId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newUser)
      });
      
      return newId;
    } catch (e) {
      console.error("Error creating client in mock mode:", e);
      throw e;
    }
  }

  // 1. Crear el registro de cliente para el negocio
  const clientRef = collection(db, 'clients');
  const docRef = await addDoc(clientRef, {
    nombre: clientData.nombre,
    cedula: clientData.cedula,
    telefono: clientData.telefono || '',
    direccion: clientData.direccion || '',
    saldo_usd: clientData.saldo_usd || 0,
    puntos: clientData.puntos || 0,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp()
  });

  // 2. Crear el usuario para el Portal del Cliente automáticamente
  const lastFour = clientData.cedula.slice(-4);
  
  await setDoc(doc(db, 'users', docRef.id), {
    username: clientData.cedula, // Usuario es su cédula
    role: 'cliente',
    pin: clientData.pin || lastFour, // Clave son los últimos 4 dígitos o el pin personalizado
    cedula: clientData.cedula,
    email: clientData.email || null,
    clientId: docRef.id,
    requirePinChange: clientData.pin ? false : true, // Si establecen su propio pin, no requieren cambiarlo obligatoriamente
    createdAt: serverTimestamp()
  });

  return docRef.id;
};

export const checkPinUnique = async (pin: string): Promise<boolean> => {
  if (isMock) {
    try {
      const res = await fetch('/api/db/users');
      if (res.ok) {
        const users = await res.json();
        return !users.some((u: any) => u.pin === pin);
      }
    } catch (e) {
      console.error(e);
    }
    return true;
  }

  const usersRef = collection(db, 'users');
  const q = query(usersRef, where('pin', '==', pin));
  const snap = await getDocs(q);
  return snap.empty;
};

export const resetClientPin = async (clientId: string, newPin: string) => {
  if (isMock) {
    try {
      await fetch(`/api/db/users/${clientId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pin: newPin })
      });
    } catch(e) {
      console.error(e);
    }
    return;
  }
  
  const userRef = doc(db, 'users', clientId);
  await setDoc(userRef, {
    pin: newPin,
    updatedAt: serverTimestamp()
  }, { merge: true });
};

// AUTO-CANCELACIÓN DE PEDIDOS WEB EXPIRADOS (12 HORAS)
export const autoCancelExpiredOrders = async () => {
  console.log("Ejecutando limpieza de pedidos web expirados...");
  if (isMock) {
    try {
      const res = await fetch('/api/db/sales');
      if (res.ok) {
        const sales = await res.json();
        const now = Date.now();
        const twelveHoursMs = 12 * 60 * 60 * 1000;
        
        for (const sale of sales) {
          if (sale.origen === 'web' && sale.status_pedido === 'pendiente') {
            const saleDate = new Date(sale.fecha || 0).getTime();
            if (now - saleDate > twelveHoursMs) {
              console.log(`Cancelando pedido expirado: ${sale.id}`);
              // Actualizar estado
              sale.status_pedido = 'cancelado';
              await fetch(`/api/db/sales/${sale.id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(sale)
              });
              // Restaurar inventario
              for (const item of (sale.detalles || [])) {
                await updateStock(item.producto_id, -item.cantidad, 'CANCELACION_AUTOMATICA', 'sistema');
              }
            }
          }
        }
      }
    } catch (e) {
      console.error(e);
    }
    return;
  }

  // Lógica para Firebase Real
  try {
    const q = query(collection(db, 'sales'), where('origen', '==', 'web'), where('status_pedido', '==', 'pendiente'));
    const snapshot = await getDocs(q);
    const now = Date.now();
    const twelveHoursMs = 12 * 60 * 60 * 1000;

    const batchToCancel = [];
    for (const docSnap of snapshot.docs) {
      const sale = docSnap.data();
      const saleDate = new Date(sale.fecha || 0).getTime();
      if (now - saleDate > twelveHoursMs) {
        batchToCancel.push({ id: docSnap.id, ...sale });
      }
    }

    for (const sale of batchToCancel) {
      console.log(`Cancelando pedido expirado: ${sale.id}`);
      await updateDoc(doc(db, 'sales', sale.id), { status_pedido: 'cancelado' });
      for (const item of (sale.detalles || [])) {
        await updateStock(item.producto_id, -item.cantidad, 'CANCELACION_AUTOMATICA', 'sistema');
      }
    }
  } catch (e) {
    console.error("Error cancelando pedidos web expirados:", e);
  }
};

export const createSale = async (saleData: any) => {
  if (isMock) {
    try {
      const salesRes = await fetch('/api/db/sales');
      const sales = await salesRes.json();
      const nextNum = sales.length + 1001;
      const newId = String(nextNum);
      const newSale = { ...saleData, id: newId, createdAt: new Date().toISOString() };
      
      await fetch(`/api/db/sales/${newId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newSale)
      });
      return newId;
    } catch (e) {
      console.error("Error creating sale in mock mode:", e);
      throw e;
    }
  }

  const salesRef = collection(db, 'sales');
  const docRef = await addDoc(salesRef, {
    ...saleData,
    createdAt: serverTimestamp()
  });
  return docRef.id;
};


/**
 * Operaciones Genéricas CRUD
 */

export const addDocument = async (collectionName: string, data: any) => {
  if (isMock) {
    try {
      const res = await fetch(`/api/db/${collectionName}`);
      const items = await res.json();
      const newId = `${collectionName.charAt(0)}${items.length + 1}_${Date.now()}`;
      const newItem = { ...data, id: newId, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() };
      
      await fetch(`/api/db/${collectionName}/${newId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newItem)
      });
      return newId;
    } catch (e) {
      console.error(e);
      throw e;
    }
  }

  const colRef = collection(db, collectionName);
  const docRef = await addDoc(colRef, {
    ...data,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp()
  });
  return docRef.id;
};


export const getDocument = async (collectionName: string, id: string) => {
  if (isMock) {
    try {
      const res = await fetch(`/api/db/${collectionName}/${id}`);
      if (res.ok) {
        return await res.json();
      }
    } catch (e) {
      console.error(e);
    }
    return null;
  }

  const docRef = doc(db, collectionName, id);
  const docSnap = await getDoc(docRef);
  if (docSnap.exists()) {
    return { id: docSnap.id, ...docSnap.data() };
  }
  return null;
};


export const updateDocument = async (collectionName: string, id: string, data: any) => {
  if (isMock) {
    try {
      const getRes = await fetch(`/api/db/${collectionName}/${id}`);
      let current = {};
      if (getRes.ok) {
        current = await getRes.json();
      }
      const updated = { ...current, ...data, id, updatedAt: new Date().toISOString() };
      
      await fetch(`/api/db/${collectionName}/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updated)
      });
    } catch (e) {
      console.error("Error updating document in mock:", e);
    }
    return;
  }

  const docRef = doc(db, collectionName, id);
  await updateDoc(docRef, {
    ...data,
    updatedAt: serverTimestamp()
  });
};


export const deleteDocument = async (collectionName: string, id: string) => {
  if (isMock) {
    try {
      await fetch(`/api/db/${collectionName}/${id}`, {
        method: 'DELETE'
      });
    } catch (e) {
      console.error(e);
    }
    return;
  }

  const docRef = doc(db, collectionName, id);
  await deleteDoc(docRef);
};


/**
 * Tasa BCV
 */
export const getLatestTasa = async () => {
  if (isMock) {
    try {
      const res = await fetch('/api/db/tasas_bcv');
      if (res.ok) {
        const tasas = await res.json();
        if (tasas.length > 0) {
          // Ordenar: primero por fecha desc, luego por sincronizadoEn desc
          const sorted = tasas.sort((a: any, b: any) => {
            const fechaA = String(a.fecha || '');
            const fechaB = String(b.fecha || '');
            const fechaCmp = fechaB.localeCompare(fechaA);
            if (fechaCmp !== 0) return fechaCmp;
            const timeA = a.sincronizadoEn?.seconds ? a.sincronizadoEn.seconds * 1000 : (typeof a.sincronizadoEn === 'string' ? new Date(a.sincronizadoEn).getTime() : 0);
            const timeB = b.sincronizadoEn?.seconds ? b.sincronizadoEn.seconds * 1000 : (typeof b.sincronizadoEn === 'string' ? new Date(b.sincronizadoEn).getTime() : 0);
            return timeB - timeA;
          });
          return sorted[0].valor;
        }
      }
    } catch (e) {
      console.error(e);
    }
    return 40.50;
  }
  
  const tasasRef = collection(db, 'tasas_bcv');
  const q = query(tasasRef, where('fecha', '==', new Date().toISOString().split('T')[0]));
  const snapshot = await getDocs(q);
  
  if (!snapshot.empty) {
    return snapshot.docs[0].data().valor;
  }
  
  // Si no hay hoy, buscar la última
  const allTasas = await getDocs(query(tasasRef));
  if (!allTasas.empty) {
    const sorted = allTasas.docs.sort((a, b) => b.data().fecha.localeCompare(a.data().fecha));
    return sorted[0].data().valor;
  }
  
  return 40.50; // Fallback
};

export const syncLatestTasa = async () => {
  console.log("Sincronizando tasa oficial BCV...");

  const today = new Date().toISOString().split('T')[0];
  let officialRate: number | null = null;

  try {
    // En mock: usamos el proxy del servidor Vite para evitar CORS
    // En producción: llamamos directo a la API
    const apiUrl = isMock
      ? '/api/bcv-rate'
      : 'https://ve.dolarapi.com/v1/dolares/oficial';

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000);

    const res = await fetch(apiUrl, { signal: controller.signal });
    clearTimeout(timeoutId);
    
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const json = await res.json();

    if (isMock) {
      // Respuesta de nuestro proxy: { rate: number, fecha: string }
      officialRate = json.rate ?? null;
    } else {
      // Respuesta directa de ve.dolarapi.com
      officialRate = json.promedio ?? json.venta ?? null;
    }
  } catch (e) {
    console.warn("No se pudo obtener la tasa BCV online:", e);
  }

  if (!officialRate || officialRate <= 0) {
    throw new Error("No se pudo obtener una tasa válida del BCV. Verifica tu conexión a internet.");
  }

  const tasaData = {
    id: `tasa-${today}`,
    fecha: today,
    valor: parseFloat(officialRate.toFixed(4)),
    fuente: 'BCV (Oficial) — ve.dolarapi.com',
    estatus: 'Sincronizada',
    sincronizadoEn: new Date().toISOString()
  };

  if (isMock) {
    try {
      // 1. Borrar cualquier entrada previa del mismo día para evitar duplicados
      const existing = await fetch('/api/db/tasas_bcv');
      if (existing.ok) {
        const all = await existing.json();
        for (const t of all) {
          if (t.fecha === today && t.id && t.id !== tasaData.id) {
            await fetch(`/api/db/tasas_bcv/${t.id}`, { method: 'DELETE' });
          }
          // También eliminar entradas sin id que sean del mismo día
          if (t.fecha === today && !t.id) {
            // No se pueden borrar por id, las sobreescribimos con una actualizacion forzada
          }
        }
      }
      // 2. Guardar la nueva entrada
      await fetch(`/api/db/tasas_bcv/${tasaData.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(tasaData)
      });
      return tasaData;
    } catch (e) {
      console.error(e);
    }
    return tasaData;
  }
  
  try {
    await setDoc(doc(db, 'tasas_bcv', today), {
      ...tasaData,
      sincronizadoEn: serverTimestamp()
    });
    return tasaData;
  } catch (err) {
    console.error("Error sincronizando tasa:", err);
    throw err;
  }
};

export const updateManualTasa = async (nuevoValor: number) => {
  const today = new Date().toISOString().split('T')[0];
  const tasaData = {
    id: `tasa-${today}`,
    fecha: today,
    valor: nuevoValor,
    fuente: 'Manual / Interna',
    estatus: 'Manual',
    sincronizadoEn: new Date().toISOString()
  };
  
  if (isMock) {
    try {
      await fetch(`/api/db/tasas_bcv/${tasaData.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(tasaData)
      });
    } catch (e) {
      console.error(e);
    }
    return tasaData;
  }

  await setDoc(doc(db, 'tasas_bcv', today), {
    ...tasaData,
    sincronizadoEn: serverTimestamp()
  });
  return tasaData;
};

/**
 * Ventas Pausadas
 */
export const pauseSale = async (saleData: any) => {
  return addDocument('ventas_pausadas', saleData);
};

export const deletePausedSale = async (id: string) => {
  return deleteDocument('ventas_pausadas', id);
};

/**
 * Cierres de Caja
 */
export const saveClosure = async (closureData: any) => {
  return addDocument('cierres_caja', closureData);
};

export const getTodaySales = async () => {
  if (isMock) {
    try {
      const salesRes = await fetch('/api/db/sales');
      const sales = await salesRes.json();
      const closuresRes = await fetch('/api/db/cierres_caja');
      const closures = await closuresRes.json();
      
      let lastClosureTime = 0;
      if (closures.length > 0) {
        const sortedClosures = closures.sort((a: any, b: any) => b.createdAt.localeCompare(a.createdAt));
        lastClosureTime = new Date(sortedClosures[0].createdAt).getTime();
      }
      
      const todayStr = new Date().toISOString().split('T')[0];
      
      return sales.filter((s: any) => {
        if (!s.fecha) return false;
        const saleTime = new Date(s.fecha).getTime();
        return String(s.fecha || '').startsWith(todayStr) && saleTime > lastClosureTime;
      });
    } catch (e) {
      console.error(e);
      return [];
    }
  }
  
  const startOfDay = new Date();
  startOfDay.setHours(0, 0, 0, 0);
  
  const salesRef = collection(db, 'sales');
  const q = query(salesRef, where('createdAt', '>=', startOfDay));
  const snapshot = await getDocs(q);
  return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
};

export const getClosures = async () => {
  if (isMock) {
    try {
      const res = await fetch('/api/db/cierres_caja');
      if (res.ok) {
        return await res.json();
      }
    } catch (e) {
      console.error(e);
    }
    return [];
  }
  const colRef = collection(db, 'cierres_caja');
  const q = query(colRef);
  const snapshot = await getDocs(q);
  return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
};

/**
 * Movimientos de Productores
 */
export const addProductorMovement = async (mov: any) => {
  return addDocument('movimientos_productores', mov);
};

export const getProductorMovements = async (productorId: string) => {
  if (isMock) {
    try {
      const res = await fetch('/api/db/movimientos_productores');
      if (res.ok) {
        const movs = await res.json();
        return movs.filter((m: any) => m.proveedor_id === productorId);
      }
    } catch (e) {
      console.error(e);
    }
    return [];
  }
  const colRef = collection(db, 'movimientos_productores');
  const q = query(colRef, where('proveedor_id', '==', productorId));
  const snapshot = await getDocs(q);
  return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
};
