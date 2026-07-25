import { initializeApp } from "firebase/app";
import { getAuth, signInWithEmailAndPassword } from "firebase/auth";
import { getFirestore, getDoc, doc, collection, getDocs, query, where } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyCyUtNCXwe_SRxwFDvX9WPBpd-_mE0FgsE",
  authDomain: "kalu-queso-sanjuam.firebaseapp.com",
  projectId: "kalu-queso-sanjuam",
  storageBucket: "kalu-queso-sanjuam.firebasestorage.app",
  messagingSenderId: "123456789",
  appId: "1:123456789:web:abcdef"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

async function testLogin() {
  try {
    const uc = await signInWithEmailAndPassword(auth, "878787092@kalu.app", "709200");
    console.log("Logged in! UID:", uc.user.uid);
    
    // Check users doc
    const userDoc = await getDoc(doc(db, "users", uc.user.uid));
    console.log("User doc exists:", userDoc.exists());
    if (userDoc.exists()) {
      console.log("User doc data:", userDoc.data());
      
      const clientId = userDoc.data().clientId || uc.user.uid;
      const clientDoc = await getDoc(doc(db, "clients", clientId));
      console.log("Client doc exists:", clientDoc.exists());
      if (clientDoc.exists()) {
        console.log("Client doc data:", clientDoc.data());
      } else {
        // Try finding by cedula
        const q = query(collection(db, 'clients'), where('cedula', '==', userDoc.data().cedula));
        try {
          const snap = await getDocs(q);
          console.log("Found in clients by cedula?", !snap.empty);
        } catch(e) {
          console.error("Permission denied querying clients by cedula");
        }
      }
    }
  } catch (e) {
    console.error("Login failed:", e);
  }
}

testLogin();
