import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import fs from 'fs';

const serviceAccount = JSON.parse(fs.readFileSync('./service-account.json', 'utf8'));

initializeApp({
  credential: cert(serviceAccount)
});

const db = getFirestore();

async function checkTasa() {
  console.log("=== CHECK TASAS_BCV IN FIRESTORE ===");
  const snap = await db.collection('tasas_bcv').get();
  snap.docs.forEach(doc => {
    console.log('Doc ID:', doc.id, JSON.stringify(doc.data(), null, 2));
  });

  process.exit(0);
}

checkTasa().catch(console.error);
