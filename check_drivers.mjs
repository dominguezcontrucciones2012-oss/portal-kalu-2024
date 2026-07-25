const fs = require('fs');

async function run() {
  const { initializeApp } = await import('firebase/app');
  const { getFirestore, collection, getDocs } = await import('firebase/firestore');

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

  const usersRef = collection(db, 'users');
  const snap = await getDocs(usersRef);

  console.log('--- REPARTIDORES ---');
  snap.forEach(doc => {
    const data = doc.data();
    const role = data.role ? String(data.role).toLowerCase() : '';
    if (role.includes('repartidor') || role.includes('delivery')) {
      console.log(`User: ${data.username}, Role: "${data.role}"`);
    }
  });
  console.log('--- ALL UNIQUE ROLES IN DB ---');
  const roles = new Set();
  snap.forEach(doc => {
    roles.add(doc.data().role);
  });
  console.log(Array.from(roles));
}

run().catch(console.error);
