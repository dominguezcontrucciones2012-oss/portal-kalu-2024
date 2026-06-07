import { initializeApp } from 'firebase/app';
import { getFirestore, doc, setDoc, deleteDoc, Timestamp } from 'firebase/firestore';
import * as fs from 'fs';

const config = JSON.parse(fs.readFileSync('./firebase-applet-config.json', 'utf8'));
const app = initializeApp(config);
const db = config.firestoreDatabaseId ? getFirestore(app, config.firestoreDatabaseId) : getFirestore(app);

async function setup() {
  // Delete the old one
  try {
    await deleteDoc(doc(db, 'users', 'yoaEQclJufJTB16ssAXr'));
    console.log("Deleted old user");
  } catch(e) {
    console.error("Error deleting old user:", e);
  }

  // Create new test repartidor
  await setDoc(doc(db, 'users', 'test_repartidor'), {
    username: 'Repartidor Prueba',
    cedula: '99999999',
    pin: '1234',
    role: 'repartidor',
    requirePinChange: false,
    clientId: 'test_repartidor',
    createdAt: Timestamp.now(),
    updatedAt: Timestamp.now()
  });
  
  console.log("Created new repartidor: Cedula 99999999, PIN 1234");
  process.exit(0);
}

setup().catch(e => {
  console.error("Error:", e);
  process.exit(1);
});
