const admin = require('firebase-admin');

// Ensure we don't initialize multiple times
if (!admin.apps.length) {
    admin.initializeApp({
        projectId: 'kalu-queso-sanjuam' // Replace with your actual project ID if different
    });
}
const db = admin.firestore();

async function checkOrder() {
    try {
        const q = db.collection('sales').where('codigo_pedido', '==', '203855');
        const snap = await q.get();
        if (snap.empty) {
            console.log("No se encontró el pedido 203855 con codigo_pedido. Buscando por id...");
            const q2 = db.collection('sales').get();
            let found = false;
            for (let doc of (await q2).docs) {
                if (doc.id.toLowerCase().startsWith('203855')) {
                    console.log("Found by ID:", doc.id);
                    console.log(doc.data());
                    found = true;
                    break;
                }
            }
            if (!found) console.log("Not found at all.");
        } else {
            console.log("Found by codigo_pedido:");
            console.log(snap.docs[0].id, snap.docs[0].data());
        }
    } catch (e) {
        console.error(e);
    }
}

checkOrder();
