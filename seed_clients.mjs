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

const clients = [
  {
    nombre: "Ana María García",
    cedula: "V-15123456",
    correo: "ana.garcia@test.com",
    telefono: "0414-1234567",
    direccion: "Av. Principal San Juan, Edif. Los Pinos",
    pin: "112233",
    saldo_usd: 20.00,
    puntos: 50
  },
  {
    nombre: "Carlos Luis Mendoza",
    cedula: "V-20987654",
    correo: "carlos.mendoza@test.com",
    telefono: "0424-9876543",
    direccion: "Calle 4, Casa #15, San Juan",
    pin: "445566",
    saldo_usd: 0.00,
    puntos: 10
  },
  {
    nombre: "María Fernanda López",
    cedula: "V-22333444",
    correo: "maria.lopez@test.com",
    telefono: "0412-3334445",
    direccion: "Urb. El Bosque, Qta. La Rosita",
    pin: "778899",
    saldo_usd: 5.50,
    puntos: 120
  }
];

async function seedClients() {
  console.log('Seeding test clients...');
  for (const client of clients) {
    const docId = client.cedula.replace(/[^0-9]/g, ''); // Use numbers from cedula as ID
    try {
      await setDoc(doc(db, 'clients', docId), {
        ...client,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      }, { merge: true });
      console.log(`Added client: ${client.nombre} (PIN: ${client.pin})`);
    } catch (e) {
      console.error(`Failed to add client: ${client.nombre}`, e);
    }
  }
  console.log('Done.');
  process.exit(0);
}

seedClients();
