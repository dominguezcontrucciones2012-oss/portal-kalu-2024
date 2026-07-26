import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { readFileSync } from 'fs';

const serviceAccount = JSON.parse(readFileSync('./service-account.json', 'utf8'));
initializeApp({ credential: cert(serviceAccount) });
const db = getFirestore();

async function fixAdmin() {
  const oldId = '5eSvcHpeauMFHIzDOOppO9lMPgy2';
  const newId = '9e9wJGSJNOaQAkZowcm3b43M3eS2';

  const oldDoc = await db.collection('users').doc(oldId).get();
  if (oldDoc.exists) {
    const data = oldDoc.data();
    data.role = 'admin'; // Ensure role is admin
    data.clientId = newId;
    await db.collection('users').doc(newId).set(data);
    console.log(`Created new admin document with ID ${newId}`);
    
    // Optionally delete old doc to avoid confusion
    // await db.collection('users').doc(oldId).delete();
    console.log(`Kept old document ${oldId} just in case.`);
  } else {
    console.log(`Old admin document ${oldId} not found.`);
  }
}

fixAdmin();
