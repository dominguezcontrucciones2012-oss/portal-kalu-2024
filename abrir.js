import { initializeApp } from 'firebase/app';
import { getFirestore, doc, setDoc } from 'firebase/firestore';
import fs from 'fs';

const firebaseConfig = JSON.parse(fs.readFileSync(new URL('./firebase-applet-config.json', import.meta.url)));
const app = initializeApp(firebaseConfig);
const db = getFirestore(app, firebaseConfig.firestoreDatabaseId);

async function abrir() {
  await setDoc(doc(db, 'configuracion', 'global'), { estado_portal: 'abierto' }, { merge: true });
  console.log("✅ Portal Público Abierto Exitosamente");
  process.exit(0);
}
abrir();
