import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { initializeApp } from 'firebase/app';
import { getFirestore, collection, getDocs, deleteDoc, doc } from 'firebase/firestore';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const firebaseConfig = JSON.parse(fs.readFileSync(path.join(__dirname, 'firebase-applet-config.json'), 'utf8'));

const app = initializeApp(firebaseConfig);
const db = getFirestore(app, firebaseConfig.firestoreDatabaseId);

async function deleteClient() {
  try {
    const querySnapshot = await getDocs(collection(db, 'clients'));
    let found = false;
    for (const d of querySnapshot.docs) {
      const data = d.data();
      if (data.nombre && data.nombre.toLowerCase().includes('deisy corro')) {
        console.log(`Borrando cliente: ${data.nombre} (ID: ${d.id})`);
        await deleteDoc(doc(db, 'clients', d.id));
        found = true;
      }
    }
    
    // Si la tienen en 'users' (en caso de que se haya guardado allí en lugar de clients o en ambos)
    const usersSnapshot = await getDocs(collection(db, 'users'));
    for (const d of usersSnapshot.docs) {
      const data = d.data();
      if (data.username && data.username.toLowerCase().includes('deisy corro')) {
         console.log(`Borrando usuario: ${data.username} (ID: ${d.id})`);
         await deleteDoc(doc(db, 'users', d.id));
         found = true;
      }
    }
    
    if (!found) {
      console.log('No se encontró a Deisy Corro.');
    } else {
      console.log('Borrado exitoso.');
    }
  } catch (error) {
    console.error("Error al borrar:", error);
  }
  process.exit();
}

deleteClient();
