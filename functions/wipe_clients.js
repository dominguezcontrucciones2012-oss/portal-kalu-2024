const admin = require('firebase-admin');
const serviceAccount = require('./service-account.json');

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
  });
}

const db = admin.firestore();

async function wipeClients() {
  console.log("Iniciando borrado total de clientes y usuarios...");
  
  // 1. Delete all Firebase Auth users
  let listUsersResult;
  let pageToken;
  let deletedAuthCount = 0;
  
  do {
    listUsersResult = await admin.auth().listUsers(1000, pageToken);
    const uids = listUsersResult.users.map(u => u.uid);
    if (uids.length > 0) {
      await admin.auth().deleteUsers(uids);
      deletedAuthCount += uids.length;
    }
    pageToken = listUsersResult.pageToken;
  } while (pageToken);
  
  console.log(`Borrados ${deletedAuthCount} usuarios de Firebase Auth.`);

  // 2. Delete all docs in 'clients' collection
  let deletedClientsCount = 0;
  const clientsSnapshot = await db.collection('clients').get();
  const batchClients = db.batch();
  clientsSnapshot.forEach(doc => {
    batchClients.delete(doc.ref);
    deletedClientsCount++;
  });
  if (deletedClientsCount > 0) {
    await batchClients.commit();
  }
  console.log(`Borrados ${deletedClientsCount} documentos de la colección 'clients'.`);

  // 3. Delete all docs in 'users' collection
  let deletedUsersCount = 0;
  const usersSnapshot = await db.collection('users').get();
  const batchUsers = db.batch();
  usersSnapshot.forEach(doc => {
    batchUsers.delete(doc.ref);
    deletedUsersCount++;
  });
  if (deletedUsersCount > 0) {
    await batchUsers.commit();
  }
  console.log(`Borrados ${deletedUsersCount} documentos de la colección 'users'.`);

  console.log("¡Limpieza completada exitosamente!");
}

wipeClients().catch(console.error);
