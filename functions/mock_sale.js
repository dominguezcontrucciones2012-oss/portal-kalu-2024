const admin = require("firebase-admin");

admin.initializeApp({
  projectId: "kalu-queso-sanjuam"
});

const db = admin.firestore();

async function addMockSale() {
  try {
    const saleData = {
      cliente_id: "test_client",
      nombre_cliente: "PRUEBA AUTOMATIZACIÓN",
      status_pedido: "verificando_pago",
      total_usd: 15.50,
      total_bs: 620.00,
      fecha: new Date().toISOString(),
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      captures_pago: ["https://firebasestorage.googleapis.com/v0/b/kalu-queso-sanjuam.appspot.com/o/test.jpg?alt=media"]
    };

    const docRef = await db.collection("sales").add(saleData);
    console.log("Mock sale created with ID:", docRef.id);
  } catch (error) {
    console.error("Error creating mock sale:", error);
  }
}

addMockSale();
