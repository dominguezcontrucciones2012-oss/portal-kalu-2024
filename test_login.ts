import { initializeApp } from 'firebase/app';
import { getFirestore, collection, query, where, getDocs } from 'firebase/firestore';
import * as fs from 'fs';

const config = JSON.parse(fs.readFileSync('./firebase-applet-config.json', 'utf8'));
const app = initializeApp(config);
const db = config.firestoreDatabaseId ? getFirestore(app, config.firestoreDatabaseId) : getFirestore(app);

async function testLogin(cedula: string, pin: string) {
  const q = query(
    collection(db, 'users'), 
    where('pin', '==', pin)
  );
  const querySnapshot = await getDocs(q);
  console.log(`Found ${querySnapshot.size} users with pin ${pin}`);
  
  const matchedDocs = querySnapshot.docs.filter(doc => {
    const data = doc.data();
    console.log(`Checking user ${doc.id}: cedula='${data.cedula}', username='${data.username}' against input cedula='${cedula}'`);
    return (data.cedula === cedula) || (data.username === cedula);
  });
  
  if (matchedDocs.length > 0) {
    console.log("Login SUCCESS", matchedDocs[0].data());
  } else {
    console.log("Login FAILED");
  }
  process.exit(0);
}

testLogin('15082352', '1234').catch(console.error);
