import { initializeApp } from 'firebase/app';
import { getFirestore, collection, getDocs, deleteDoc, doc } from 'firebase/firestore';
import fs from 'fs';

const config = JSON.parse(fs.readFileSync('./firebase-applet-config.json', 'utf8'));
const app = initializeApp(config);
const db = config.firestoreDatabaseId ? getFirestore(app, config.firestoreDatabaseId) : getFirestore(app);

async function deleteAll() {
  console.log("Borrando todas las ventas...");
  const salesSnap = await getDocs(collection(db, 'sales'));
  for (const docSnap of salesSnap.docs) {
    await deleteDoc(doc(db, 'sales', docSnap.id));
  }
  console.log(`Borradas ${salesSnap.size} ventas.`);

  console.log("Borrando todos los cierres de repartidores...");
  const cierresSnap = await getDocs(collection(db, 'cierres'));
  for (const docSnap of cierresSnap.docs) {
    await deleteDoc(doc(db, 'cierres', docSnap.id));
  }
  console.log(`Borrados ${cierresSnap.size} cierres de repartidores.`);

  console.log("Borrando todos los cierres de caja general (CRM)...");
  const cierresCajaSnap = await getDocs(collection(db, 'cierres_caja'));
  for (const docSnap of cierresCajaSnap.docs) {
    await deleteDoc(doc(db, 'cierres_caja', docSnap.id));
  }
  console.log(`Borrados ${cierresCajaSnap.size} cierres de caja general.`);

  console.log("¡Limpieza de prueba completada al 100%!");
  process.exit(0);
}

deleteAll().catch(console.error);
