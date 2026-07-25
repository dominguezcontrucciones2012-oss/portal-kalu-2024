import { initializeApp } from 'firebase/app';
import { getFirestore, doc, updateDoc, getDoc } from 'firebase/firestore';
import * as fs from 'fs';

const config = JSON.parse(fs.readFileSync('./firebase-applet-config.json', 'utf8'));
const app = initializeApp(config);
const db = config.firestoreDatabaseId ? getFirestore(app, config.firestoreDatabaseId) : getFirestore(app);

async function fix() {
  const userRef = doc(db, 'users', 'user_juan');
  const userDoc = await getDoc(userRef);
  
  if (userDoc.exists()) {
    const data = userDoc.data();
    console.log("Current user_juan data:", data);
    
    // Set a simple cedula if it doesn't have one
    await updateDoc(userRef, {
      cedula: data.cedula || 'V-12345678'
    });
    
    console.log("Updated cedula to V-12345678");
  } else {
    console.log("user_juan not found!");
  }
  process.exit(0);
}

fix().catch(e => {
  console.error("Error:", e);
  process.exit(1);
});
