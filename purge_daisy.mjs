import { initializeApp, cert } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore } from 'firebase-admin/firestore';
import fs from 'fs';

const serviceAccount = JSON.parse(fs.readFileSync('./service-account.json', 'utf8'));
initializeApp({ credential: cert(serviceAccount) });
const auth = getAuth();
const db = getFirestore();

async function deleteFromAuth(email) {
  try {
    const u = await auth.getUserByEmail(email);
    await auth.deleteUser(u.uid);
    console.log(`Deleted ${email} from Auth.`);
  } catch (e) {
    console.log(`No Auth record for ${email}`);
  }
}

async function purgeDocs(ids) {
  for (const id of ids) {
    await db.collection('users').doc(id).delete();
    await db.collection('administradores').doc(id).delete();
    await db.collection('clients').doc(id).delete();
    console.log(`Purged Firestore docs for ID: ${id}`);
  }
}

async function fixDaisy() {
  // 1. Delete old Auth accounts
  await deleteFromAuth('daisycorro77@gmail.com');
  await deleteFromAuth('deisycorro77@gmail.com');

  // 2. Purge old duplicate/ghost IDs
  const badIds = ['kalu-owner', 'PpfAcF80MPPtV5UssEdaxhPksFc2', 'SB846NJG6RcNe7ODe4ATtKrEDLY2'];
  await purgeDocs(badIds);

  // 3. Create fresh Auth account
  const email = 'daisycorro77@gmail.com';
  const pin = '234567';
  const storeId = 'kalu-queso-sanjuan';

  let uid;
  try {
    const newUser = await auth.createUser({
      email: email,
      password: pin,
      displayName: 'Daisy Corro Admin'
    });
    uid = newUser.uid;
    console.log(`Created clean Auth account for ${email} with UID: ${uid}`);
  } catch (e) {
    console.error('Error creating Auth:', e);
    process.exit(1);
  }

  // 4. Create fresh Firestore docs
  const adminData = {
    email: email,
    pin: pin,
    role: 'admin',
    storeId: storeId,
    nombre: 'Daisy Corro',
    username: 'Admin Kalu Queso San Juan',
    updatedAt: new Date().toISOString()
  };

  await db.collection('users').doc(uid).set(adminData);
  await db.collection('administradores').doc(uid).set(adminData);
  console.log(`Created clean Firestore docs in 'users' and 'administradores' for ${uid}`);

  process.exit(0);
}

fixDaisy().catch(console.error);
