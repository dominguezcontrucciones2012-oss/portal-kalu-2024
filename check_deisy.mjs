import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import fs from 'fs';

const serviceAccount = JSON.parse(fs.readFileSync('./service-account.json', 'utf8'));

initializeApp({
  credential: cert(serviceAccount)
});

const db = getFirestore();

async function checkDeisy() {
  console.log("=== CHECK DEISY CORRO IN FIRESTORE ===");
  const clientsSnap = await db.collection('clients').get();
  clientsSnap.docs.forEach(doc => {
    if (doc.data().email === 'deisycorro77@gmail.com' || doc.data().nombre?.includes('Deisy')) {
      console.log('Client doc:', doc.id, JSON.stringify(doc.data(), null, 2));
    }
  });

  const usersSnap = await db.collection('users').get();
  usersSnap.docs.forEach(doc => {
    if (doc.data().email === 'deisycorro77@gmail.com' || doc.data().username?.includes('Deisy') || doc.data().nombre?.includes('Deisy')) {
      console.log('User doc:', doc.id, JSON.stringify(doc.data(), null, 2));
    }
  });

  process.exit(0);
}

checkDeisy().catch(console.error);
