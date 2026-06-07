import { initializeApp } from 'firebase/app';
import { getFirestore, collection, getDocs, deleteDoc, doc, getDoc } from 'firebase/firestore';
import * as fs from 'fs';

const config = JSON.parse(fs.readFileSync('./firebase-applet-config.json', 'utf8'));
const app = initializeApp(config);
const db = config.firestoreDatabaseId ? getFirestore(app, config.firestoreDatabaseId) : getFirestore(app);

async function cleanOrders() {
  console.log("Revisando pedidos (ventas)...");
  const salesSnap = await getDocs(collection(db, 'sales'));
  
  let deletedCount = 0;
  for (const saleDoc of salesSnap.docs) {
    const data = saleDoc.data();
    let shouldDelete = false;

    // Si no tiene cliente o usuario asignado, o el cliente fue borrado
    if (!data.cliente_id && !data.user_id) {
      shouldDelete = true;
    } else if (data.cliente_id) {
      // Verificar si el cliente existe
      const clientSnap = await getDoc(doc(db, 'clients', data.cliente_id));
      if (!clientSnap.exists()) {
        shouldDelete = true;
      }
    }

    if (shouldDelete) {
      console.log(`Borrando pedido huerfano: ${saleDoc.id}`);
      await deleteDoc(doc(db, 'sales', saleDoc.id));
      deletedCount++;
    }
  }
  
  console.log(`¡Limpieza completada! Se borraron ${deletedCount} pedidos sin usuario.`);
  process.exit(0);
}

cleanOrders().catch(console.error);
