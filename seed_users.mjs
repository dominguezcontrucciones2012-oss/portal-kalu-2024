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

const newUsers = [
    {id: 'client_v15123456', username: 'V-15123456', cedula: 'V-15123456', correo: 'test1@kalu.com', pin: '112233', role: 'cliente', clientId: 'client_v15123456'},
    {id: 'client_v20987654', username: 'V-20987654', cedula: 'V-20987654', correo: 'test2@kalu.com', pin: '445566', role: 'cliente', clientId: 'client_v20987654'}
];

const newClients = [
    {id: 'client_v15123456', nombre: 'Test VIP 1', cedula: 'V-15123456', correo: 'test1@kalu.com', pin: '112233', saldo_usd: 50, limite_credito_usd: 100},
    {id: 'client_v20987654', nombre: 'Test VIP 2', cedula: 'V-20987654', correo: 'test2@kalu.com', pin: '445566', saldo_usd: 100, limite_credito_usd: 200}
];

async function seedUsers() {
    for (const u of newUsers) {
        await setDoc(doc(collection(db, 'users'), u.id), u);
        console.log('User created:', u.cedula);
    }
    for (const c of newClients) {
        await setDoc(doc(collection(db, 'clients'), c.id), c);
        console.log('Client created:', c.cedula);
    }
    console.log('Done seeding users.');
    process.exit(0);
}
seedUsers();
