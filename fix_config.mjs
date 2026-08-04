import { initializeApp } from 'firebase/app';
import { getFirestore, collection, getDocs, doc, setDoc, deleteField } from 'firebase/firestore';

const firebaseConfig = {
  "apiKey": "AIzaSyCyUtNCXwe_SRxwFDvX9WPBpd-_mE0FgsE",
  "authDomain": "kalu-queso-sanjuam.firebaseapp.com",
  "projectId": "kalu-queso-sanjuam",
  "storageBucket": "kalu-queso-sanjuam.firebasestorage.app",
  "messagingSenderId": "376295544090",
  "appId": "1:376295544090:web:3e5e66de3298e862fa48a3",
  "measurementId": "G-PVDN34DLJH",
  "firestoreDatabaseId": "(default)"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

async function fixConfigs() {
  const snap = await getDocs(collection(db, 'configuracion'));
  console.log("Configurations found:");
  
  for (const d of snap.docs) {
    const data = d.data();
    console.log(`Doc ID: ${d.id}, Empresa: ${data.empresa_nombre}`);
    
    // If the data has an 'id' field, delete it from Firestore because the document ID is what matters
    if (data.id) {
       console.log(`Fixing doc ${d.id}... Removing field 'id: ${data.id}'`);
       await setDoc(doc(db, 'configuracion', d.id), { id: deleteField() }, { merge: true });
    }
    
    // Check if the user accidentally overwrote kalu-queso-principal's name with Bodega el peruano
    if ((d.id === 'kalu-queso-principal' || d.id === 'global') && data.empresa_nombre?.toLowerCase().includes('peruano')) {
        console.log("Restoring Kalu Queso Principal name!");
        await setDoc(doc(db, 'configuracion', d.id), { empresa_nombre: "Kalu Queso San Juan" }, { merge: true });
    }
  }
  
  console.log("Done checking and fixing configs.");
  process.exit(0);
}

fixConfigs();
