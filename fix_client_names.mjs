import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';
import { getAuth } from 'firebase-admin/auth';
import fs from 'fs';

const serviceAccount = JSON.parse(fs.readFileSync('./service-account.json', 'utf8'));

initializeApp({
  credential: cert(serviceAccount)
});

const db = getFirestore();
const auth = getAuth();

async function run() {
  console.log("=== BUSCANDO Y RESTAURANDO NOMBRES REALES DE CLIENTES ===");
  
  // 1. Obtener todas las ventas para cruzar nombres por cliente_id
  const salesSnap = await db.collection('sales').get();
  const namesFromSales = {};
  salesSnap.docs.forEach(doc => {
    const data = doc.data();
    if (data.cliente_id && data.nombre_cliente && !/^\d+$/.test(data.nombre_cliente.trim())) {
      namesFromSales[data.cliente_id] = data.nombre_cliente.trim();
    }
  });
  console.log("Nombres encontrados en Ventas:", namesFromSales);

  // 2. Obtener todas las solicitudes de recuperación
  const recSnap = await db.collection('recuperaciones').get();
  const namesFromRec = {};
  recSnap.docs.forEach(doc => {
    const data = doc.data();
    if (data.clientId && data.nombre && !/^\d+$/.test(data.nombre.trim())) {
      namesFromRec[data.clientId] = data.nombre.trim();
    }
  });
  console.log("Nombres encontrados en Recuperaciones:", namesFromRec);

  // 3. Procesar todos los clientes
  const clientsSnap = await db.collection('clients').get();
  for (const clientDoc of clientsSnap.docs) {
    const clientId = clientDoc.id;
    const clientData = clientDoc.data();
    
    let realName = null;
    let realEmail = clientData.email;

    // A. Intentar por Firebase Auth
    try {
      const authUser = await auth.getUser(clientId);
      if (authUser.displayName && !/^\d+$/.test(authUser.displayName.trim())) {
        realName = authUser.displayName.trim();
      }
      if (authUser.email) {
        realEmail = authUser.email;
      }
    } catch (e) {
      // Ignorar si no existe en Auth
    }

    // B. Intentar por Recuperaciones
    if (!realName && namesFromRec[clientId]) {
      realName = namesFromRec[clientId];
    }

    // C. Intentar por Ventas
    if (!realName && namesFromSales[clientId]) {
      realName = namesFromSales[clientId];
    }

    if (realName) {
      console.log(`✅ Restaurando nombre real para cliente ${clientId}: ${realName} (Cédula: ${clientData.cedula})`);
      
      await db.collection('clients').doc(clientId).update({
        nombre: realName,
        email: realEmail || null,
        updatedAt: FieldValue.serverTimestamp()
      });

      await db.collection('users').doc(clientId).update({
        username: realName,
        nombre: realName,
        email: realEmail || null,
        updatedAt: FieldValue.serverTimestamp()
      });
    } else {
      console.log(`⚠️ No se encontró nombre alternativo para ${clientId} (Cédula actual: ${clientData.cedula}).`);
    }
  }

  console.log("=== PROCESO FINALIZADO ===");
  process.exit(0);
}

run().catch(console.error);
