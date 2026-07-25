const admin = require('firebase-admin');
const serviceAccount = require('../service-account.json');

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
  });
}
const db = admin.firestore();

async function check() {
  const listUsersResult = await admin.auth().listUsers();
  let fixable = 0;
  for (const user of listUsersResult.users) {
    if (user.email) {
      const doc = await db.collection('users').doc(user.uid).get();
      if (doc.exists) {
        const docEmail = doc.data().email;
        if (docEmail && docEmail !== user.email) {
          console.log(`Mismatch found! UID: ${user.uid}, Auth Email: ${user.email}, Doc Email: ${docEmail}`);
          fixable++;
        }
      }
    }
  }
  console.log(`Total mismatches found: ${fixable}`);
}
check().catch(console.error);
