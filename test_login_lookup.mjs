import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import fs from 'fs';

const serviceAccount = JSON.parse(fs.readFileSync('./service-account.json', 'utf8'));

initializeApp({
  credential: cert(serviceAccount)
});

const db = getFirestore();

async function testLookup() {
  console.log("=== TESTING ALL USERS & CLIENTS IN FIRESTORE ===");
  
  const usersSnap = await db.collection('users').get();
  console.log(`Total users docs: ${usersSnap.docs.length}`);
  usersSnap.docs.forEach(doc => {
    console.log(`[USER DOC] ID: "${doc.id}"`, JSON.stringify(doc.data(), null, 2));
  });

  const clientsSnap = await db.collection('clients').get();
  console.log(`Total clients docs: ${clientsSnap.docs.length}`);
  clientsSnap.docs.forEach(doc => {
    console.log(`[CLIENT DOC] ID: "${doc.id}"`, JSON.stringify(doc.data(), null, 2));
  });

  process.exit(0);
}

testLookup().catch(console.error);
