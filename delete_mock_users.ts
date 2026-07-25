import { initializeApp } from 'firebase/app';
import { getFirestore, doc, deleteDoc } from 'firebase/firestore';
import * as fs from 'fs';

const config = JSON.parse(fs.readFileSync('./firebase-applet-config.json', 'utf8'));
const app = initializeApp(config);
const db = config.firestoreDatabaseId ? getFirestore(app, config.firestoreDatabaseId) : getFirestore(app);

async function clean() {
  await deleteDoc(doc(db, 'users', 'user_andres'));
  await deleteDoc(doc(db, 'users', 'user_deisy'));
  await deleteDoc(doc(db, 'users', 'user_diana'));
  console.log('Mock users deleted.');
  process.exit(0);
}

clean().catch(console.error);
