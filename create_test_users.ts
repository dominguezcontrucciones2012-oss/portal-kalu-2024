import { initializeApp } from 'firebase/app';
import { getFirestore, doc, setDoc, updateDoc } from 'firebase/firestore';
import * as fs from 'fs';

const config = JSON.parse(fs.readFileSync('./firebase-applet-config.json', 'utf8'));
const app = initializeApp(config);
const db = config.firestoreDatabaseId ? getFirestore(app, config.firestoreDatabaseId) : getFirestore(app);

async function setupUsers() {
  console.log("Actualizando usuario administrador...");
  // Actualizar a Juan Carlos con su cédula
  await updateDoc(doc(db, 'users', 'user_juan'), {
    cedula: "15082352"
  });
  console.log("Administrador actualizado con cédula: 15082352");

  console.log("Creando usuario de prueba para el repartidor...");
  // Recrear repartidor de prueba
  await setDoc(doc(db, 'users', 'test_repartidor'), {
    username: "Repartidor Prueba",
    role: "repartidor",
    pin: "1234",
    cedula: "11223344", // Cédula de prueba para el repartidor
    clientId: 'test_repartidor',
    createdAt: new Date().toISOString()
  });
  console.log("Repartidor de prueba creado (Cédula: 11223344, PIN: 1234)");

  console.log("¡Todo listo!");
  process.exit(0);
}

setupUsers().catch(console.error);
