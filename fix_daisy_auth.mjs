import { initializeApp, cert } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore } from 'firebase-admin/firestore';
import fs from 'fs';

const serviceAccount = JSON.parse(fs.readFileSync('./service-account.json', 'utf8'));

initializeApp({ credential: cert(serviceAccount) });
const auth = getAuth();
const db = getFirestore();

async function fixDaisyAuth() {
  const email = 'daisycorro77@gmail.com';
  const password = '234567';
  const storeId = 'kalu-queso-sanjuan';
  
  let uid = null;
  
  // 1. Try to get or create user in Firebase Auth
  try {
    const userRecord = await auth.getUserByEmail(email);
    uid = userRecord.uid;
    console.log('User found in Auth with UID:', uid);
    // Update password
    await auth.updateUser(uid, { password: password });
    console.log('Password updated in Auth.');
  } catch (error) {
    if (error.code === 'auth/user-not-found') {
      const newUser = await auth.createUser({
        email: email,
        password: password,
        displayName: 'Daisy Corro Admin'
      });
      uid = newUser.uid;
      console.log('Created new user in Auth with UID:', uid);
    } else {
      console.error('Error fetching user from Auth:', error);
      process.exit(1);
    }
  }

  // 2. Ensure Firestore is fully updated with this UID
  const adminData = {
    email: email,
    pin: password, // As requested
    role: 'admin',
    storeId: storeId,
    nombre: 'Daisy Corro',
    username: 'Admin Kalu Queso San Juan',
    updatedAt: new Date().toISOString()
  };

  // We write to the document with id = uid
  await db.collection('users').doc(uid).set(adminData, { merge: true });
  await db.collection('administradores').doc(uid).set(adminData, { merge: true });
  
  console.log(`Firestore updated for UID: ${uid}`);
  process.exit(0);
}

fixDaisyAuth().catch(console.error);
