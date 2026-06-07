import { initializeApp } from 'firebase/app';
import { getFirestore, collection, getDocs, query, where } from 'firebase/firestore';

const firebaseConfig = {
  apiKey: "AIzaSyCyUtNCXwe_SRxwFDvX9WPBpd-_mE0FgsE",
  authDomain: "kalu-queso-sanjuam.firebaseapp.com",
  projectId: "kalu-queso-sanjuam",
  storageBucket: "kalu-queso-sanjuam.firebasestorage.app",
  messagingSenderId: "376295544090",
  appId: "1:376295544090:web:3e5e66de3298e862fa48a3"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

async function run() {
  const usersRef = collection(db, 'users');
  const snap = await getDocs(usersRef);
  let admin = null;
  let adminPin = null;

  snap.forEach(doc => {
    const data = doc.data();
    if (data.cedula === '15082352' || data.username === '15082352' || data.role === 'admin' || data.role === 'Dueño' || data.role === 'dueno') {
      admin = data;
      adminPin = data.pin;
      console.log('Admin found:', data);
    }
  });

  if (adminPin) {
    const q = query(usersRef, where('pin', '==', adminPin));
    const qs = await getDocs(q);
    console.log(`Users with PIN ${adminPin}:`);
    qs.forEach(d => {
      console.log(d.id, d.data().role, d.data().cedula);
    });

    const matchedDocs = qs.docs;
    
    let userDoc = matchedDocs[0];
    if (matchedDocs.length > 1) {
      const staffDoc = matchedDocs.find(doc => {
        const r = String(doc.data().role || '').toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
        return r.includes('admin') || r.includes('duen') || r.includes('super') || r.includes('cajero');
      });
      if (staffDoc) {
        userDoc = staffDoc;
      }
    }
    console.log("Resolved user from signInWithPinCustom:", userDoc.data().role, userDoc.data().cedula);
  }
}

run().catch(console.error);
