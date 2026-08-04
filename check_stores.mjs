import { initializeApp } from 'firebase/app';
import { getFirestore, collection, getDocs, doc, setDoc } from 'firebase/firestore';

const firebaseConfig = {
  "apiKey": "AIzaSyCyUtNCXwe_SRxwFDvX9WPBpd-_mE0FgsE",
  "authDomain": "kalu-queso-sanjuam.firebaseapp.com",
  "projectId": "kalu-queso-sanjuam",
  "storageBucket": "kalu-queso-sanjuam.firebasestorage.app",
  "messagingSenderId": "376295544090",
  "appId": "1:376295544090:web:3e5e66de3298e862fa48a3"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

async function checkStores() {
  const snap = await getDocs(collection(db, 'stores'));
  console.log("Stores found:");
  snap.docs.forEach(d => {
    console.log(`Doc ID: ${d.id}`, d.data());
  });
  process.exit(0);
}

checkStores();
