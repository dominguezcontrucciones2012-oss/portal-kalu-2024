const admin = require('firebase-admin');
const serviceAccount = require('../service-account.json');

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
  });
}
const db = admin.firestore();

async function run() {
  const u1 = await db.collection('users').doc('622vdgp7VcPGN4QRE0bMGuYKHGp2').get();
  console.log("GOOGLE USER DOC:", u1.exists ? u1.data() : "NOT FOUND");

  const u2 = await db.collection('users').doc('Z7lehjygoPKJ43Nrltlw').get();
  console.log("TRADITIONAL USER DOC:", u2.exists ? u2.data() : "NOT FOUND");
}
run();
