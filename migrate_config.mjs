import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import fs from 'fs';

const serviceAccount = JSON.parse(fs.readFileSync('./service-account.json', 'utf8'));

initializeApp({
  credential: cert(serviceAccount)
});

const db = getFirestore();

async function run() {
  console.log("Migrando configuracion 'global' a 'kalu-queso-principal'...");

  const globalRef = db.collection('configuracion').doc('global');
  const globalDoc = await globalRef.get();
  
  if (globalDoc.exists) {
    const data = globalDoc.data();
    await db.collection('configuracion').doc('kalu-queso-principal').set(data);
    console.log("Configuración migrada exitosamente.");
  } else {
    console.log("No se encontró configuración 'global'.");
  }

  process.exit(0);
}

run().catch(console.error);
