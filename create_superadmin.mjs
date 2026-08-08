import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import fs from 'fs';

const serviceAccount = JSON.parse(fs.readFileSync('./service-account.json', 'utf8'));
initializeApp({ credential: cert(serviceAccount) });
const db = getFirestore();

async function createSuperAdmin() {
  const email = 'dominguezcontrucciones2012@gmail.com';
  const id = 'superadmin-master';
  
  const payload = {
    email: email,
    pin: '000000',
    role: 'superadmin',
    storeId: 'Brequera Central (Maestro)',
    username: 'Propietario Kalu',
    nombre: 'Propietario Kalu'
  };

  await db.collection('administradores').doc(id).set(payload, { merge: true });
  await db.collection('users').doc(id).set(payload, { merge: true });
  
  console.log(`✅ Super Admin master account created for ${email}`);
  process.exit(0);
}

createSuperAdmin().catch(console.error);
