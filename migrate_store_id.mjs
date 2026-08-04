import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import fs from 'fs';

const serviceAccount = JSON.parse(fs.readFileSync('./service-account.json', 'utf8'));

initializeApp({
  credential: cert(serviceAccount)
});

const db = getFirestore();
const STORE_ID = 'kalu-queso-principal';

const collectionsToMigrate = [
  'products',
  'clients',
  'sales',
  'ventas_pausadas',
  'cierres_caja',
  'movimientos_productores',
  'asientos',
  'inventory_audit',
  'gastos',
  'compras_mercancia',
  'providers',
  'mensajes',
  'sorteos_activos',
  'users' // we might want to attach users to a store, though users often span stores. Let's add it anyway as default.
];

async function run() {
  console.log("Iniciando migración de storeId...");

  for (const colName of collectionsToMigrate) {
    console.log(`Migrando colección: ${colName}...`);
    const snapshot = await db.collection(colName).get();
    let updatedCount = 0;
    
    // Batch updates for efficiency
    let batch = db.batch();
    let batchCount = 0;

    for (const doc of snapshot.docs) {
      const data = doc.data();
      if (!data.storeId) {
        batch.update(doc.ref, { storeId: STORE_ID });
        batchCount++;
        updatedCount++;
        
        if (batchCount === 500) {
          await batch.commit();
          batch = db.batch();
          batchCount = 0;
        }
      }
    }
    
    if (batchCount > 0) {
      await batch.commit();
    }
    
    console.log(` - ${updatedCount} documentos actualizados en ${colName}.`);
  }

  console.log("✅ Migración completada.");
  process.exit(0);
}

run().catch(console.error);
