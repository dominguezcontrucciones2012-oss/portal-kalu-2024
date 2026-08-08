import { initializeApp, cert } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';
import fs from 'fs';

const serviceAccount = JSON.parse(fs.readFileSync('./service-account.json', 'utf8'));

initializeApp({ credential: cert(serviceAccount) });
const auth = getAuth();
const db = getFirestore();

async function revert() {
  const masterEmail = 'dominguezcontrucciones2012@gmail.com';
  let uid = null;
  
  try {
    const userRecord = await auth.getUserByEmail(masterEmail);
    uid = userRecord.uid;
    console.log('Master found in Auth with UID:', uid);
  } catch (error) {
    console.error('Error fetching master from Auth:', error);
    process.exit(1);
  }

  // 1. Asegurar rol superadmin
  await db.collection('users').doc(uid).set({
    email: masterEmail,
    role: 'superadmin',
    storeId: FieldValue.delete(),
    nombre: 'Eduardo Domínguez',
    username: 'Eduardo',
  }, { merge: true });
  
  console.log(`Corregido: ${masterEmail} ha sido restaurado con el rol 'superadmin' en users.`);
  process.exit(0);
}

revert().catch(console.error);
