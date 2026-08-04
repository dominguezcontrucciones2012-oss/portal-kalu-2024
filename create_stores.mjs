import { initializeApp } from 'firebase/app';
import { getFirestore, collection, doc, setDoc } from 'firebase/firestore';

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

async function createStores() {
  const stores = [
    {
      id: 'kalu-queso-principal',
      name: 'Kalu Queso San Juan',
      status: 'active',
      ownerUid: 'kalu-owner',
      plan: 'premium',
      createdAt: new Date().toISOString()
    },
    {
      id: 'bodega-el-peruano',
      name: 'Bodega El Peruano',
      status: 'active',
      ownerUid: 'admin-123',
      plan: 'free',
      createdAt: new Date().toISOString()
    },
    {
      id: 'farmacia-san-juan',
      name: 'Farmacia San Juan',
      status: 'active',
      ownerUid: 'admin-local',
      plan: 'free',
      createdAt: new Date().toISOString()
    }
  ];

  for (const s of stores) {
    await setDoc(doc(db, 'stores', s.id), s, { merge: true });
    console.log(`Updated store: ${s.id}`);
  }
  
  process.exit(0);
}

createStores();
