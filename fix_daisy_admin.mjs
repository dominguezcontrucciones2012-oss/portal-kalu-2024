import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import fs from 'fs';

const serviceAccount = JSON.parse(fs.readFileSync('./service-account.json', 'utf8'));

initializeApp({ credential: cert(serviceAccount) });
const db = getFirestore();

async function fixDaisy() {
  console.log("=== FIXING DAISY ADMIN CREDENTIALS ===");
  const targetEmail = 'daisycorro77@gmail.com';
  const targetPin = '234567';
  
  // Clean from clients
  const clientsSnap = await db.collection('clients').get();
  for (const doc of clientsSnap.docs) {
    if (doc.data().email === targetEmail || doc.data().email === 'deisycorro77@gmail.com' || (doc.data().nombre || '').includes('Deisy')) {
      console.log('Deleting client doc:', doc.id);
      await db.collection('clients').doc(doc.id).delete();
    }
  }

  // Find user doc
  let userId = null;
  const usersSnap = await db.collection('users').get();
  for (const doc of usersSnap.docs) {
    if (doc.data().email === targetEmail || doc.data().email === 'deisycorro77@gmail.com' || (doc.data().username || '').includes('Deisy') || (doc.data().nombre || '').includes('Deisy') || (doc.data().nombre || '').includes('Daisy')) {
      userId = doc.id;
      break;
    }
  }

  if (!userId) {
    userId = 'daisy_admin_' + Date.now();
    console.log('User not found. Creating new user ID:', userId);
  } else {
    console.log('Found user to update:', userId);
  }

  const storeId = 'kalu-queso-sanjuan'; // assuming this is the store

  const adminData = {
    email: targetEmail,
    pin: targetPin,
    role: 'admin',
    storeId: storeId,
    nombre: 'Daisy Corro',
    username: 'Admin Kalu Queso San Juan',
    updatedAt: new Date().toISOString()
  };

  await db.collection('users').doc(userId).set(adminData, { merge: true });
  await db.collection('administradores').doc(userId).set(adminData, { merge: true });

  console.log(`Updated user ${userId} to be local admin for ${storeId} with email ${targetEmail}`);
  process.exit(0);
}

fixDaisy().catch(console.error);
