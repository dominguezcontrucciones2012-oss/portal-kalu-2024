import { initializeApp, cert } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore } from 'firebase-admin/firestore';
import fs from 'fs';

const serviceAccount = JSON.parse(fs.readFileSync('./service-account.json', 'utf8'));

initializeApp({ credential: cert(serviceAccount) });
const auth = getAuth();
const db = getFirestore();

async function fixBochinche() {
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

  // 1. Restaurar el nombre en users y asegurar rol superadmin
  await db.collection('users').doc(uid).set({
    nombre: 'Eduardo Domínguez', 
    username: 'Eduardo',
  }, { merge: true });
  
  // 2. ELIMINAR de la colección 'administradores' (porque esa es solo para administradores de tiendas)
  console.log('Eliminando cuenta maestra de la colección administradores locales...');
  await db.collection('administradores').doc(uid).delete();
  
  console.log(`Corregido: ${masterEmail} ya no aparece como admin de tienda y se restauró su nombre.`);
  process.exit(0);
}

fixBochinche().catch(console.error);
