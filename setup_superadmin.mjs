import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';
import fs from 'fs';

const serviceAccount = JSON.parse(fs.readFileSync('./service-account.json', 'utf8'));

initializeApp({
  credential: cert(serviceAccount)
});

const db = getFirestore();

async function run() {
  console.log("Configurando Consola SuperAdmin...");

  // 1. Asignar rol superadmin a los dueños
  const usersSnapshot = await db.collection('users').where('role', 'in', ['dueno', 'admin']).get();
  let updatedUsers = 0;
  for (const userDoc of usersSnapshot.docs) {
    // Si queremos que todos los dueños/admins sean superadmins por ahora:
    await userDoc.ref.update({ role: 'superadmin' });
    console.log(`Rol actualizado a superadmin para el usuario: ${userDoc.id} (${userDoc.data().username || ''})`);
    updatedUsers++;
  }
  
  if (updatedUsers === 0) {
    console.log("No se encontraron dueños o admins para actualizar. Actualizando user_juan directamente si existe.");
    const juanRef = db.collection('users').doc('user_juan');
    const juanDoc = await juanRef.get();
    if (juanDoc.exists) {
      await juanRef.update({ role: 'superadmin' });
      console.log("Actualizado user_juan a superadmin.");
    }
  }

  // 2. Crear la tienda Bodega El Peruano
  const storeId = 'bodega-el-peruano';
  const storeRef = db.collection('stores').doc(storeId);
  const storeDoc = await storeRef.get();
  
  if (!storeDoc.exists) {
    await storeRef.set({
      id: storeId,
      name: 'Bodega El Peruano',
      status: 'active',
      ownerUid: 'user_juan', // Asignado a user_juan como default
      plan: 'free',
      createdAt: FieldValue.serverTimestamp()
    });
    console.log(`Tienda creada: ${storeId}`);
  } else {
    console.log(`La tienda ${storeId} ya existe.`);
  }

  console.log("✅ Configuración completada con éxito.");
  process.exit(0);
}

run().catch(console.error);
