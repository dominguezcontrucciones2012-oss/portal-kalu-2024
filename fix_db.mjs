import { initializeApp } from 'firebase/app';
import { getFirestore, doc, updateDoc } from 'firebase/firestore';
import fs from 'fs';

const firebaseConfig = JSON.parse(fs.readFileSync(new URL('./firebase-applet-config.json', import.meta.url)));
const app = initializeApp(firebaseConfig);
const db = getFirestore(app, firebaseConfig.firestoreDatabaseId);

async function main() {
    const docRef = doc(db, 'configuracion', 'global');
    await updateDoc(docRef, { estado_portal: 'automatico' });
    console.log("DB UPDATED to automatico");
    process.exit(0);
}
main();
