const { initializeApp } = require('firebase/app');
const { getFirestore, collection, getDocs } = require('firebase/firestore');

const firebaseConfig = require('../firebase-applet-config.json');

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

async function main() {
  const snapshot = await getDocs(collection(db, 'tasas_bcv'));
  const docs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
  console.log(JSON.stringify(docs, null, 2));
}

main().catch(console.error);
