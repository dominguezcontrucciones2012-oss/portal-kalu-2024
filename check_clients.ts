import { initializeApp } from 'firebase/app';
import { getFirestore, collection, getDocs } from 'firebase/firestore';
import * as fs from 'fs';

const config = JSON.parse(fs.readFileSync('./firebase-applet-config.json', 'utf8'));
const app = initializeApp(config);
const db = config.firestoreDatabaseId ? getFirestore(app, config.firestoreDatabaseId) : getFirestore(app);

async function checkClients() {
  const snap = await getDocs(collection(db, 'clients'));
  console.log(`TOTAL CLIENTS IN DB: ${snap.size}`);
  snap.forEach(doc => {
    const data = doc.data();
    console.log(`CLIENT ID: ${doc.id} | nombre: ${data.nombre} | cedula: ${data.cedula} | telefono: ${data.telefono}`);
  });
  
  process.exit(0);
}

checkClients().catch(console.error);
