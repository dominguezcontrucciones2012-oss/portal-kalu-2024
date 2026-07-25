import { initializeApp } from 'firebase/app';
import { getFirestore, collection, getDocs } from 'firebase/firestore';
import * as fs from 'fs';

const config = JSON.parse(fs.readFileSync('./firebase-applet-config.json', 'utf8'));
const app = initializeApp(config);
const db = config.firestoreDatabaseId ? getFirestore(app, config.firestoreDatabaseId) : getFirestore(app);

async function checkUsers() {
  const usersSnap = await getDocs(collection(db, 'users'));
  usersSnap.forEach(doc => {
    const data = doc.data();
    console.log(`USER: ${doc.id} | username: ${data.username} | cedula: ${data.cedula} | role: ${data.role} | pin: ${data.pin}`);
  });
  
  process.exit(0);
}

checkUsers().catch(console.error);
