import { initializeApp } from 'firebase/app';
import { getFirestore, doc, getDoc } from 'firebase/firestore';
import fs from 'fs';

const firebaseConfig = JSON.parse(fs.readFileSync(new URL('./firebase-applet-config.json', import.meta.url)));
const app = initializeApp(firebaseConfig);
const db = getFirestore(app, firebaseConfig.firestoreDatabaseId);

async function main() {
    const docRef = doc(db, 'configuracion', 'global');
    const docSnap = await getDoc(docRef);
    if (docSnap.exists()) {
        console.log("CONFIG GLOBAL:", docSnap.data());
    } else {
        console.log("No such document!");
    }
    process.exit(0);
}
main();
