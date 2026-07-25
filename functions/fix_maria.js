const admin = require('firebase-admin');
const serviceAccount = require('../service-account.json');

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
  });
}
const db = admin.firestore();

async function run() {
  const googleUid = '622vdgp7VcPGN4QRE0bMGuYKHGp2';
  const traditionalClientId = 'Z7lehjygoPKJ43Nrltlw';

  // 1. Eliminar cliente duplicado de Google
  await db.collection('clients').doc(googleUid).delete();
  console.log("Deleted duplicate client doc:", googleUid);

  // 2. Vincular el usuario de Google al cliente tradicional con su PIN
  await db.collection('users').doc(googleUid).set({
    username: 'maria natividad',
    role: 'cliente',
    email: 'saavedravillalobosmarianativid@gmail.com',
    cedula: '8787092',
    clientId: traditionalClientId,
    pin: '709200',
    updatedAt: admin.firestore.FieldValue.serverTimestamp()
  }, { merge: true });
  console.log("Linked Google user doc to client Z7lehjygoPKJ43Nrltlw with PIN 709200");
}
run();
