const admin = require('firebase-admin');
const serviceAccount = require('./service-account.json');

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
  });
}

const db = admin.firestore();

async function createAdmin() {
  const email = "domingueconstrucciones@gmail.com";
  const userId = "admin_dominguez";
  
  await db.collection('users').doc(userId).set({
    username: "Dominguez Construcciones",
    email: email,
    role: "admin",
    cedula: "V12345678", // Un placeholder, él puede cambiarlo
    pin: "123456", // Un PIN por defecto
    createdAt: new Date().toISOString()
  });
  
  console.log(`Usuario administrador creado con éxito para ${email} con PIN 123456`);
}

createAdmin().catch(console.error);
