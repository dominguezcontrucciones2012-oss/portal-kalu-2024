import { initializeApp, cert } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore } from 'firebase-admin/firestore';
import fs from 'fs';

const serviceAccount = JSON.parse(fs.readFileSync('./service-account.json', 'utf8'));
initializeApp({ credential: cert(serviceAccount) });
const auth = getAuth();
const db = getFirestore();

async function check() {
  const emails = ['daisycorro77@gmail.com', 'deisycorro77@gmail.com'];
  
  for (const email of emails) {
    console.log(`Checking ${email}...`);
    try {
      const user = await auth.getUserByEmail(email);
      console.log(`AUTH: Found UID: ${user.uid} with email ${user.email}`);
    } catch (e) {
      console.log(`AUTH: Not found ${email}`);
    }

    const uSnap = await db.collection('users').where('email', '==', email).get();
    if (!uSnap.empty) {
      uSnap.forEach(d => console.log(`FIRESTORE (users): ${d.id} =>`, d.data()));
    } else {
      console.log(`FIRESTORE (users): No docs for ${email}`);
    }

    const aSnap = await db.collection('administradores').where('email', '==', email).get();
    if (!aSnap.empty) {
      aSnap.forEach(d => console.log(`FIRESTORE (administradores): ${d.id} =>`, d.data()));
    } else {
      console.log(`FIRESTORE (administradores): No docs for ${email}`);
    }
    
    const cSnap = await db.collection('clients').where('email', '==', email).get();
    if (!cSnap.empty) {
      cSnap.forEach(d => console.log(`FIRESTORE (clients): ${d.id} =>`, d.data()));
    }
    console.log('---');
  }
  process.exit(0);
}

check().catch(console.error);
