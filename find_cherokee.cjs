const { initializeApp, cert } = require('firebase-admin/app');
const { getFirestore } = require('firebase-admin/firestore');
const serviceAccount = require('./service-account.json');

initializeApp({
  credential: cert(serviceAccount)
});

const db = getFirestore();

async function run() {
  const snapshot = await db.collection('administradores').get();
  console.log('--- ADMINISTRADORES ---');
  snapshot.forEach(doc => {
    console.log(doc.id, doc.data());
  });

  const snapshot2 = await db.collection('users').where('role', 'in', ['admin', 'superadmin', 'dueno']).get();
  console.log('--- USERS (admin/superadmin) ---');
  snapshot2.forEach(doc => {
    console.log(doc.id, doc.data());
  });
  
  process.exit(0);
}

run();
