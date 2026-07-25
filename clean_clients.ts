import { initializeApp } from 'firebase/app';
import { getFirestore, collection, getDocs, deleteDoc, doc } from 'firebase/firestore';
import * as fs from 'fs';

const config = JSON.parse(fs.readFileSync('./firebase-applet-config.json', 'utf8'));
const app = initializeApp(config);
const db = config.firestoreDatabaseId ? getFirestore(app, config.firestoreDatabaseId) : getFirestore(app);

async function cleanClients() {
  console.log("Obteniendo todos los clientes...");
  const clientsSnap = await getDocs(collection(db, 'clients'));
  
  let deletedCount = 0;
  for (const clientDoc of clientsSnap.docs) {
    console.log(`Borrando cliente: ${clientDoc.id} (${clientDoc.data().nombre})`);
    await deleteDoc(doc(db, 'clients', clientDoc.id));
    deletedCount++;
  }
  
  console.log(`¡Limpieza completada! Se borraron ${deletedCount} clientes en total.`);
  process.exit(0);
}

cleanClients().catch(console.error);
