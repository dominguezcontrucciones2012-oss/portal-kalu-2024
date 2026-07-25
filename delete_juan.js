import { initializeApp } from 'firebase/app';
import { getFirestore, deleteDoc, doc } from 'firebase/firestore';
import fs from 'fs';

const firebaseConfig = JSON.parse(fs.readFileSync('./firebase-applet-config.json'));
const app = initializeApp(firebaseConfig);
const db = getFirestore(app, firebaseConfig.firestoreDatabaseId);

async function run() {
  await deleteDoc(doc(db, 'clients', 'O5eiRRiffj86z4tWzMlt'));
  console.log('Deleted O5eiRRiffj86z4tWzMlt');
  process.exit(0);
}
run();
