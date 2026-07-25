import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);
const serviceAccount = require('./service-account.json');

initializeApp({
  credential: cert(serviceAccount)
});

const db = getFirestore();

async function run() {
  console.log("Iniciando migración de emails...");
  const usersSnap = await db.collection('users').get();
  
  let fixedCount = 0;
  
  for (const doc of usersSnap.docs) {
    const userData = doc.data();
    if (userData.email && userData.role === 'cliente') {
      const clientId = doc.id; // users id matches clients id
      const clientRef = db.collection('clients').doc(clientId);
      const clientSnap = await clientRef.get();
      
      if (clientSnap.exists) {
        const clientData = clientSnap.data();
        if (!clientData.email || clientData.email.trim() === '') {
          console.log(`Fixing client ${clientData.nombre} (${clientId}) con email: ${userData.email}`);
          await clientRef.update({
            email: userData.email
          });
          fixedCount++;
        }
      }
    }
  }
  
  console.log(`Migración completada. ${fixedCount} clientes arreglados.`);
  process.exit(0);
}

run();
