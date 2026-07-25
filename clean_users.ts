import { initializeApp } from 'firebase/app';
import { getFirestore, collection, getDocs, deleteDoc, doc } from 'firebase/firestore';
import * as fs from 'fs';

const config = JSON.parse(fs.readFileSync('./firebase-applet-config.json', 'utf8'));
const app = initializeApp(config);
const db = config.firestoreDatabaseId ? getFirestore(app, config.firestoreDatabaseId) : getFirestore(app);

async function cleanUsers() {
  console.log("Obteniendo usuarios...");
  const usersSnap = await getDocs(collection(db, 'users'));
  
  for (const userDoc of usersSnap.docs) {
    if (userDoc.id !== 'user_juan') { // Asumiendo que user_juan es Juan Carlos
      console.log(`Borrando usuario: ${userDoc.id} (${userDoc.data().username})`);
      await deleteDoc(doc(db, 'users', userDoc.id));
    } else {
      console.log(`Manteniendo usuario administrador: ${userDoc.id} (${userDoc.data().username})`);
    }
  }
  console.log("¡Limpieza de usuarios completada!");
  process.exit(0);
}

cleanUsers().catch(console.error);
