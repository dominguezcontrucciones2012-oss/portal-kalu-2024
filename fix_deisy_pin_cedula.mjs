import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';
import fs from 'fs';

const serviceAccount = JSON.parse(fs.readFileSync('./service-account.json', 'utf8'));

initializeApp({
  credential: cert(serviceAccount)
});

const db = getFirestore();

async function fixDeisy() {
  console.log("=== LIMPIANDO CEDULA Y PIN DE DEISY EN FIRESTORE ===");

  const cleanCedula = "11120033";
  const pin6 = "120033"; // 6 dígitos estándar
  const pin4 = "0330";   // 4 dígitos alternativo

  // Actualizar en 'users'
  await db.collection('users').doc('75wapULwg7gFLTF6RJKAacxn1ji2').update({
    cedula: cleanCedula,
    pin: pin6,
    updatedAt: FieldValue.serverTimestamp()
  });

  // Actualizar en 'clients'
  await db.collection('clients').doc('75wapULwg7gFLTF6RJKAacxn1ji2').update({
    cedula: cleanCedula,
    updatedAt: FieldValue.serverTimestamp()
  });

  console.log("✅ Deisy Corro actualizada en Firestore!");
  console.log(`Cédula limpia: "${cleanCedula}"`);
  console.log(`PIN de 6 dígitos: "${pin6}" (también funcionará "${pin4}")`);

  process.exit(0);
}

fixDeisy().catch(console.error);
