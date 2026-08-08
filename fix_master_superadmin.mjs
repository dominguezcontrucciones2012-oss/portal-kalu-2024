import { initializeApp, cert } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';
import fs from 'fs';

const serviceAccount = JSON.parse(fs.readFileSync('./service-account.json', 'utf8'));

initializeApp({ credential: cert(serviceAccount) });
const auth = getAuth();
const db = getFirestore();

async function fixSuperadmin() {
  const masterEmail = 'dominguezcontrucciones2012@gmail.com';
  let uid = null;
  
  // 1. Try to get or create user in Firebase Auth
  try {
    const userRecord = await auth.getUserByEmail(masterEmail);
    uid = userRecord.uid;
    console.log('Master found in Auth with UID:', uid);
  } catch (error) {
    if (error.code === 'auth/user-not-found') {
      const newUser = await auth.createUser({
        email: masterEmail,
        password: 'password123', // just a placeholder if it didn't exist
        displayName: 'Super Admin Master'
      });
      uid = newUser.uid;
      console.log('Created new Master in Auth with UID:', uid);
    } else {
      console.error('Error fetching user from Auth:', error);
      process.exit(1);
    }
  }

  // 2. Clear any storeId and ensure role is 'superadmin'
  const adminData = {
    email: masterEmail,
    role: 'superadmin',
    storeId: FieldValue.delete(), // Remove association to any local store
    nombre: 'Super Admin Master',
    username: 'Master',
    updatedAt: new Date().toISOString()
  };

  await db.collection('users').doc(uid).set(adminData, { merge: true });
  await db.collection('administradores').doc(uid).set(adminData, { merge: true });
  
  // Remove from clients just in case
  const clientsSnap = await db.collection('clients').get();
  for (const doc of clientsSnap.docs) {
    if (doc.data().email === masterEmail) {
      await db.collection('clients').doc(doc.id).delete();
    }
  }
  
  console.log(`Firestore updated for Master UID: ${uid}, storeId removed, role set to superadmin.`);
  process.exit(0);
}

fixSuperadmin().catch(console.error);
