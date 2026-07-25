const admin = require('firebase-admin');
const fs = require('fs');

const serviceAccount = JSON.parse(fs.readFileSync('./service-account.json', 'utf8'));

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

const db = admin.firestore();

async function run() {
  console.log("Iniciando restauración de clientes usando Admin SDK (Bypass rules)...");
  const usersSnap = await db.collection('users').get();
  
  let restoredCount = 0;
  for (const userDoc of usersSnap.docs) {
    const data = userDoc.data();
    
    // Solo restauramos si el rol es 'cliente' (o si no tiene rol pero tiene clientId)
    if (data.role === 'cliente' || (!data.role && data.clientId && data.clientId.startsWith('c'))) {
      const clientId = data.clientId || userDoc.id;
      
      const clientData = {
        nombre: data.nombre || data.username || 'Cliente Desconocido',
        cedula: data.cedula || 'N/A',
        email: data.email || null,
        telefono: data.telefono || '',
        direccion: data.direccion || '',
        saldo_usd: data.saldo_usd || 0,
        puntos: data.puntos || 0,
        createdAt: data.createdAt || admin.firestore.FieldValue.serverTimestamp(),
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
      };
      
      console.log(`Restaurando cliente: ${clientId} (${clientData.nombre})...`);
      
      await db.collection('clients').doc(clientId).set(clientData, { merge: true });
      restoredCount++;
    }
  }
  
  console.log(`¡Restauración completada! Se restauraron ${restoredCount} clientes en total.`);
  process.exit(0);
}

run().catch(console.error);
