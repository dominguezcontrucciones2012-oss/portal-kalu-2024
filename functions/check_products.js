const admin = require("firebase-admin");
admin.initializeApp();
const db = admin.firestore();

async function checkProducts() {
  const snapshot = await db.collection('products').get();
  let stores = {};
  snapshot.docs.forEach(doc => {
    const data = doc.data();
    stores[data.storeId] = (stores[data.storeId] || 0) + 1;
  });
  console.log("Product counts per store:", stores);
}

checkProducts().catch(console.error);
