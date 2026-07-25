const admin = require('firebase-admin');
const serviceAccount = require('../service-account.json');

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
  });
}
const db = admin.firestore();

async function run() {
  console.log("Searching in users...");
  const usersSnap = await db.collection('users').get();
  usersSnap.forEach(doc => {
    const data = doc.data();
    if (data.username && data.username.toLowerCase().includes('maria natividad')) {
      console.log("Found in users by name:", doc.id, data);
    }
    if (data.cedula && String(data.cedula).includes('878787092')) {
      console.log("Found in users by cedula:", doc.id, data);
    }
    if (data.email && String(data.email).includes('maria@gmail.com')) {
      console.log("Found in users by email:", doc.id, data);
    }
  });

  console.log("Searching in clients...");
  const clientsSnap = await db.collection('clients').get();
  clientsSnap.forEach(doc => {
    const data = doc.data();
    if (data.nombre && data.nombre.toLowerCase().includes('maria natividad')) {
      console.log("Found in clients by name:", doc.id, data);
    }
    if (data.cedula && String(data.cedula).includes('878787092')) {
      console.log("Found in clients by cedula:", doc.id, data);
    }
    if (data.email && String(data.email).includes('maria@gmail.com')) {
      console.log("Found in clients by email:", doc.id, data);
    }
  });
}

run();
