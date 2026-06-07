import { initializeApp } from 'firebase/app';
import { getFirestore, collection, getDocs, writeBatch, doc } from 'firebase/firestore';
import * as fs from 'fs';

const config = JSON.parse(fs.readFileSync('./firebase-applet-config.json', 'utf8'));
const app = initializeApp(config);
// Some configurations might not have firestoreDatabaseId explicitly
const db = config.firestoreDatabaseId ? getFirestore(app, config.firestoreDatabaseId) : getFirestore(app);

async function resetAll() {
  console.log("Conectando a la base de datos...");
  const salesSnap = await getDocs(collection(db, 'sales'));
  const movSnap = await getDocs(collection(db, 'movimientos_productores'));
  const clientsSnap = await getDocs(collection(db, 'clients'));

  console.log(`Encontrados: ${salesSnap.size} ventas, ${movSnap.size} movimientos, ${clientsSnap.size} clientes.`);

  let batch = writeBatch(db);
  let count = 0;

  for (const sale of salesSnap.docs) {
    batch.delete(doc(db, 'sales', sale.id));
    count++;
    if (count % 400 === 0) { await batch.commit(); batch = writeBatch(db); }
  }

  for (const mov of movSnap.docs) {
    batch.delete(doc(db, 'movimientos_productores', mov.id));
    count++;
    if (count % 400 === 0) { await batch.commit(); batch = writeBatch(db); }
  }

  for (const client of clientsSnap.docs) {
    batch.update(doc(db, 'clients', client.id), {
      saldo_usd: 0,
      saldo_bs: 0,
      saldo_pendiente_usd: 0,
      puntos: 0
    });
    count++;
    if (count % 400 === 0) { await batch.commit(); batch = writeBatch(db); }
  }

  if (count % 400 !== 0) {
    await batch.commit();
  }
  
  console.log("¡Todo listo! Ventas y movimientos borrados. Saldos de clientes en 0.");
  process.exit(0);
}

resetAll().catch(e => {
  console.error("Error al limpiar base de datos:", e);
  process.exit(1);
});
