import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import fs from 'fs';

const serviceAccount = JSON.parse(fs.readFileSync('./service-account.json', 'utf8'));
initializeApp({ credential: cert(serviceAccount) });
const db = getFirestore();

async function check() {
  const storeId = 'kalu-queso-sanjuan';
  const snap = await db.collection('stores').doc(storeId).get();
  if (snap.exists) {
    console.log('Store data:', snap.data());
  } else {
    console.log('Store not found.');
  }
  process.exit(0);
}

check().catch(console.error);
