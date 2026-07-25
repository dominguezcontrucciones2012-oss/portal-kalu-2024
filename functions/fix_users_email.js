const admin = require('firebase-admin');
const serviceAccount = require('../service-account.json');

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
  });
}
const db = admin.firestore();

async function run() {
  const listUsersResult = await admin.auth().listUsers();
  let fixedCount = 0;
  
  for (const userRecord of listUsersResult.users) {
    const uid = userRecord.uid;
    const authEmail = userRecord.email;
    
    if (authEmail) {
      const userDoc = await db.collection('users').doc(uid).get();
      if (userDoc.exists) {
        const storedEmail = userDoc.data().email;
        if (storedEmail !== authEmail) {
          console.log(`Fixing user ${uid}: stored '${storedEmail}' -> auth '${authEmail}'`);
          await db.collection('users').doc(uid).update({ email: authEmail });
          fixedCount++;
        }
      }
    }
  }
  console.log(`Fixed ${fixedCount} users.`);
}

run().catch(console.error);
