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
  const snap = await db.collection('tasas_bcv').get();
  console.log(`Hay ${snap.size} documentos en tasas_bcv`);
  snap.forEach(d => {
    console.log(d.id, d.data());
  });
  process.exit(0);
}

run();
