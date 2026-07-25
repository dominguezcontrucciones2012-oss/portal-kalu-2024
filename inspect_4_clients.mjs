import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import fs from 'fs';

const serviceAccount = JSON.parse(fs.readFileSync('./service-account.json', 'utf8'));

initializeApp({
  credential: cert(serviceAccount)
});

const db = getFirestore();

async function inspect() {
  console.log("=== CLIENTS COLLECTION ===");
  const clientsSnap = await db.collection('clients').get();
  clientsSnap.docs.forEach((doc, idx) => {
    console.log(`[Client #${idx + 1}] ID: ${doc.id}`);
    console.log('Data:', JSON.stringify(doc.data(), null, 2));
  });

  console.log("=== USERS COLLECTION ===");
  const usersSnap = await db.collection('users').get();
  usersSnap.docs.forEach((doc, idx) => {
    console.log(`[User #${idx + 1}] ID: ${doc.id}`);
    console.log('Data:', JSON.stringify(doc.data(), null, 2));
  });

  process.exit(0);
}

inspect().catch(console.error);
