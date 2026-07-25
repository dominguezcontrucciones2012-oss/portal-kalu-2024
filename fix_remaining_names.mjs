import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';
import fs from 'fs';

const serviceAccount = JSON.parse(fs.readFileSync('./service-account.json', 'utf8'));

initializeApp({
  credential: cert(serviceAccount)
});

const db = getFirestore();

async function fixRemainingNames() {
  console.log("=== ACTUALIZANDO NOMBRES RESTANTES DE CLIENTES ===");
  
  // Cliente 3: Ana Carina Saavedra
  await db.collection('clients').doc('7o7xvpq8lrg9VTbA49kNVsapAsq1').update({
    nombre: 'Ana Carina Saavedra',
    updatedAt: FieldValue.serverTimestamp()
  });
  await db.collection('users').doc('7o7xvpq8lrg9VTbA49kNVsapAsq1').update({
    username: 'Ana Carina Saavedra',
    nombre: 'Ana Carina Saavedra',
    updatedAt: FieldValue.serverTimestamp()
  });
  console.log("✅ Cliente 3 actualizado: Ana Carina Saavedra");

  // Cliente 4: Yudexy del Carmen Agraz
  await db.collection('clients').doc('B6yPmTIyMnZL50dzq3aTvp8tUW53').update({
    nombre: 'Yudexy del Carmen Agraz',
    updatedAt: FieldValue.serverTimestamp()
  });
  await db.collection('users').doc('B6yPmTIyMnZL50dzq3aTvp8tUW53').update({
    username: 'Yudexy del Carmen Agraz',
    nombre: 'Yudexy del Carmen Agraz',
    updatedAt: FieldValue.serverTimestamp()
  });
  console.log("✅ Cliente 4 actualizado: Yudexy del Carmen Agraz");

  console.log("=== TODOS LOS 4 CLIENTES AHORA TIENEN SUS NOMBRES REALES COMPLETOS ===");
  process.exit(0);
}

fixRemainingNames().catch(console.error);
