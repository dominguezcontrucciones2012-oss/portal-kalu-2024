const admin = require("firebase-admin");
admin.initializeApp();
const db = admin.firestore();

async function check() {
    const snap = await db.collection('users').where('role', '==', 'repartidor').get();
    console.log("Found", snap.size, "drivers.");
    snap.forEach(doc => {
        console.log(doc.id, "=>", doc.data().username, "| Telefono:", doc.data().telefono);
    });
}
check().catch(console.error);
