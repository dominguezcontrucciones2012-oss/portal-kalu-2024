import { initializeApp } from 'firebase/app';
import { getFirestore, collection, query, where, getDocs, deleteDoc, doc } from 'firebase/firestore';
import fs from 'fs';

const firebaseConfig = JSON.parse(fs.readFileSync(new URL('./firebase-applet-config.json', import.meta.url)));
const app = initializeApp(firebaseConfig);
const db = getFirestore(app, firebaseConfig.firestoreDatabaseId);

async function deletePrueba() {
  const q = query(collection(db, 'users'), where('username', '==', 'Repartidor Prueba'));
  const snapshot = await getDocs(q);
  if (snapshot.empty) {
    console.log("No se encontró el repartidor de prueba.");
  } else {
    for (const docSnap of snapshot.docs) {
      await deleteDoc(doc(db, 'users', docSnap.id));
      console.log("✅ Repartidor de prueba eliminado de la base de datos.");
    }
  }
  process.exit(0);
}
deletePrueba();
