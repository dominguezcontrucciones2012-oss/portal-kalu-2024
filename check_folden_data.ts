import { initializeApp } from 'firebase/app';
import { getFirestore, collection, getDocs } from 'firebase/firestore';

const config = {
  "projectId": "kalu-folden",
  "appId": "1:1048146290145:web:056598a334f6f606aa1ea0",
  "storageBucket": "kalu-folden.firebasestorage.app",
  "apiKey": "AIzaSyBuO9MnkmVM2_kH33euZx-x8T9Fw-4e0TI",
  "authDomain": "kalu-folden.firebaseapp.com",
  "messagingSenderId": "1048146290145"
};

const app = initializeApp(config);
const db = getFirestore(app);

async function check() {
  try {
    const clientsSnap = await getDocs(collection(db, 'clients'));
    console.log(`TOTAL CLIENTS IN FOLDEN: ${clientsSnap.size}`);
    
    const usersSnap = await getDocs(collection(db, 'users'));
    console.log(`TOTAL USERS IN FOLDEN: ${usersSnap.size}`);
    usersSnap.forEach(doc => {
      console.log(`USER: ${doc.id} | username: ${doc.data().username} | role: ${doc.data().role} | pin: ${doc.data().pin}`);
    });

    const closuresSnap = await getDocs(collection(db, 'cierres_caja'));
    console.log(`TOTAL CLOSURES IN FOLDEN: ${closuresSnap.size}`);
  } catch (e) {
    console.error("Error querying FOLDEN:", e);
  }
  process.exit(0);
}

check();
