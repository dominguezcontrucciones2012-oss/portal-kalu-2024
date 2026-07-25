const admin = require('firebase-admin');

admin.initializeApp();
const db = admin.firestore();

async function checkTasas() {
    const snap = await db.collection('tasas_bcv').get();
    snap.forEach(doc => {
        console.log(doc.id, '=>', doc.data());
    });
}

checkTasas().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1); });
