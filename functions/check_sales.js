const admin = require("firebase-admin");
admin.initializeApp();
const db = admin.firestore();

async function check() {
    const snap = await db.collection('sales').orderBy('createdAt', 'desc').limit(5).get();
    snap.forEach(doc => {
        console.log("ID:", doc.id, "| Status:", doc.data().status_pedido, "| VerifSol:", doc.data().verificacion_solicitada);
    });
}
check().catch(console.error);
