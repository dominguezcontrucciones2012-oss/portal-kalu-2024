import admin from 'firebase-admin';
import fs from 'fs';

const serviceAccount = JSON.parse(fs.readFileSync('C:\\Users\\pc\\Downloads\\kalu-queso-sanjuam-firebase-adminsdk-fbsvc-2af83a2284.json', 'utf8'));

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

const db = admin.firestore();

const users = [
  {
    username: "Diana Aponte",
    role: "cajero",
    pin: "1111",
    codigo_barra: "BARCODE-DIANA"
  },
  {
    username: "Andres Eloy Aponte",
    role: "cajero",
    pin: "2222",
    codigo_barra: "BARCODE-ANDRES"
  },
  {
    username: "Deisy Coromoto Corro",
    role: "admin",
    pin: "3333",
    codigo_barra: "BARCODE-DEISY"
  },
  {
    username: "Juan Carlos Domingues",
    role: "dueno",
    pin: "4444",
    codigo_barra: "BARCODE-JUAN"
  }
];

async function run() {
  console.log("Creating users...");
  for (const u of users) {
    const id = 'user_' + u.username.split(' ')[0].toLowerCase();
    await db.collection('users').doc(id).set({
      ...u,
      id: id,
      clientId: id,
      createdAt: admin.firestore.FieldValue.serverTimestamp()
    });
    console.log("Created: " + u.username);
  }
  console.log("Done!");
  process.exit(0);
}

run().catch(console.error);
