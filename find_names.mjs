import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import fs from 'fs';

const serviceAccount = JSON.parse(fs.readFileSync('./service-account.json', 'utf8'));

initializeApp({
  credential: cert(serviceAccount)
});

const db = getFirestore();

async function inspectData() {
  console.log("=== INSPECCIONANDO CLIENTES ===");
  const clientsSnap = await db.collection('clients').get();
  clientsSnap.docs.forEach(d => console.log('Client:', d.id, d.data()));

  console.log("=== INSPECCIONANDO USUARIOS ===");
  const usersSnap = await db.collection('users').get();
  usersSnap.docs.forEach(d => console.log('User:', d.id, d.data()));

  console.log("=== INSPECCIONANDO VENTAS ===");
  const salesSnap = await db.collection('sales').get();
  salesSnap.docs.forEach(d => console.log('Sale:', d.id, d.data().nombre_cliente, d.data().cliente_id));

  console.log("=== INSPECCIONANDO MENSAJES ===");
  const msgsSnap = await db.collection('mensajes').get();
  msgsSnap.docs.forEach(d => console.log('Mensaje:', d.id, d.data()));

  console.log("=== INSPECCIONANDO RECUPERACIONES ===");
  const recSnap = await db.collection('recuperaciones').get();
  recSnap.docs.forEach(d => console.log('Recuperacion:', d.id, d.data()));

  process.exit(0);
}

inspectData().catch(console.error);
