import { initializeApp } from "firebase/app";
import { getFirestore, collection, query, where, getDocs } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyCyUtNCXwe_SRxwFDvX9WPBpd-_mE0FgsE",
  authDomain: "kalu-queso-sanjuam.firebaseapp.com",
  projectId: "kalu-queso-sanjuam",
  storageBucket: "kalu-queso-sanjuam.firebasestorage.app",
  messagingSenderId: "123456789",
  appId: "1:123456789:web:abcdef"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

async function findMaria() {
  const usersRef = collection(db, "users");
  const q = query(usersRef, where("pin", "==", "709200"));
  try {
    const snap = await getDocs(q);
    snap.forEach(doc => {
      console.log("Found user:", doc.id, doc.data());
    });
  } catch(e) {
    console.error("Error finding in users:", e);
  }
}
findMaria();
