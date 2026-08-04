import { initializeApp } from 'firebase/app';
import { getFirestore, collection, query, where, getDocs, doc, setDoc } from 'firebase/firestore';
import { readFileSync } from 'fs';

const firebaseConfig = JSON.parse(readFileSync('./firebase-applet-config.json', 'utf8'));
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

async function run() {
  const emails = [
    'dominguezcontrucciones2012@gmail.com',
    'dominguezconstrucciones2012@gmail.com',
    'domingueconstrucciones@gmail.com',
    'dominguecontrucciones2012@gmail.com'
  ];

  for (const email of emails) {
    const q = query(collection(db, 'users'), where('email', '==', email));
    const snapshot = await getDocs(q);
    for (const docSnap of snapshot.docs) {
      console.log('Actualizando:', docSnap.id, email);
      await setDoc(doc(db, 'users', docSnap.id), {
        storeId: 'kalu-queso-sanjuan',
        activeStoreId: 'kalu-queso-sanjuan',
        role: 'superadmin'
      }, { merge: true });
    }
  }
  console.log('Completado');
  process.exit(0);
}
run().catch(console.error);
