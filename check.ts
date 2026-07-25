import { initializeApp } from 'firebase/app';
import { getFirestore, collection, getDocs, query } from 'firebase/firestore';
import * as fs from 'fs';

const config = JSON.parse(fs.readFileSync('./firebase-applet-config.json', 'utf8'));
const app = initializeApp(config);
const db = config.firestoreDatabaseId ? getFirestore(app, config.firestoreDatabaseId) : getFirestore(app);

async function check() {
  const q = query(collection(db, 'sales'));
  const snap = await getDocs(q);
  console.log(`Found ${snap.size} sales.`);
  snap.docs.forEach(doc => {
    const data = doc.data();
    console.log(doc.id, data.origen, data.status_pedido, data.tipo_entrega, data.nombre_cliente);
  });
  process.exit(0);
}

check().catch(e => {
  console.error("Error:", e);
  process.exit(1);
});
