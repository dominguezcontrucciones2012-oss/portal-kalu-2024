const admin = require("firebase-admin");
const express = require("express");
const axios = require("axios");

admin.initializeApp();
const db = admin.firestore();

const META_TOKEN = process.env.META_TOKEN || "EAATcZB4iyfAQBR7wSxXBBJcptl7glKxHYZBp1P6AaWw1ZCo3bIbO9MRGpTxBLqVwSzmva8slIZCcXhEvs2mstZBEkxMLzGf0Y3vGaR9KSlrThkzTTzzBt9uZCTmeruaKm9Cerh5gZCqzb4ZBS3BD0KPh3FDDBAgNOduqPDWXG6pm4SPcnI4IBycyAHrEWmM5dwCd2qZCK05I741ZBHXG3Qaw2ZAZCDNHuZCWkaZCSKP6gaE8JRRFtxEBjgyJRPTcYia1AhZAMimz5z1KF9f0ZCL9epSQGmawGwyc";
const META_PHONE_ID = process.env.META_PHONE_ID || "1166867286513063";
const META_VERIFY_TOKEN = process.env.META_VERIFY_TOKEN || "kalu_seguridad_2024";

const numeroAdministrador = "584125782054";

const app = express();
app.use(express.json());

// 1. Verificación del Webhook de Meta (GET)
app.get("/webhook", (req, res) => {
  const mode = req.query["hub.mode"];
  const token = req.query["hub.verify_token"];
  const challenge = req.query["hub.challenge"];

  if (mode && token) {
    if (mode === "subscribe" && token === META_VERIFY_TOKEN) {
      console.log("✅ Webhook verificado correctamente por Meta");
      return res.status(200).send(challenge);
    }
  }
  return res.sendStatus(403);
});

// 2. Recepción de mensajes (POST)
app.post("/webhook", async (req, res) => {
  const body = req.body;

  if (body.object) {
    if (
      body.entry &&
      body.entry[0].changes &&
      body.entry[0].changes[0] &&
      body.entry[0].changes[0].value.messages &&
      body.entry[0].changes[0].value.messages[0]
    ) {
      const message = body.entry[0].changes[0].value.messages[0];
      const from = message.from;

      let textBody = "";
      if (message.type === "text") {
        textBody = message.text.body.toUpperCase().trim();
      } else if (message.type === "interactive") {
        if (message.interactive.type === "button_reply") {
          textBody = message.interactive.button_reply.id.toUpperCase();
        }
      }

      if (textBody) {
        await procesarMensajeEntrante(from, textBody);
      }
    }
    return res.status(200).send("EVENT_RECEIVED");
  } else {
    return res.sendStatus(404);
  }
});

async function procesarMensajeEntrante(from, body) {
  if (from !== numeroAdministrador) return; 

  if (body.startsWith('APROBAR_PEDIDO_')) {
      let shortId = body.replace('APROBAR_PEDIDO_', '').trim();
      const q = db.collection('sales').where('status_pedido', '==', 'verificando_pago');
      const snap = await q.get();
      let encontrada = false;
      
      for (const docSnapshot of snap.docs) {
          if (docSnapshot.id.toLowerCase().startsWith(shortId.toLowerCase())) {
              encontrada = true;
              const data = docSnapshot.data();
              const nuevoStatus = data.metodo_cobro_driver === 'pago_movil' ? 'entregado' : 'listo';
              
              await db.collection('sales').doc(docSnapshot.id).update({
                  status_pedido: nuevoStatus,
                  pagada: true
              });
              
              await enviarMensajeTexto(from, `✅ Pago aprobado. El pedido de ${data.nombre_cliente} pasó a estado ${nuevoStatus.toUpperCase()}.`);
          }
      }
      if (!encontrada) {
          await enviarMensajeTexto(from, `❌ No encontré ningún pedido pendiente con el ID ${shortId}`);
      }
  } 
  else if (body.startsWith('RECHAZAR_PEDIDO_')) {
      let shortId = body.replace('RECHAZAR_PEDIDO_', '').trim();
      const q = db.collection('sales').where('status_pedido', '==', 'verificando_pago');
      const snap = await q.get();
      
      for (const docSnapshot of snap.docs) {
          if (docSnapshot.id.toLowerCase().startsWith(shortId.toLowerCase())) {
              await db.collection('sales').doc(docSnapshot.id).update({
                  status_pedido: 'listo',
                  captures_pago: []
              });
              await enviarMensajeTexto(from, `❌ Pago rechazado. El pedido volverá a estado LISTO.`);
          }
      }
  }
}

async function enviarMensajeTexto(to, text) {
  try {
    await axios({
      method: "POST",
      url: `https://graph.facebook.com/v20.0/${META_PHONE_ID}/messages`,
      headers: {
        Authorization: `Bearer ${META_TOKEN}`,
        "Content-Type": "application/json"
      },
      data: {
        messaging_product: "whatsapp",
        to: to,
        type: "text",
        text: { body: text }
      }
    });
  } catch (err) {
    console.error("Error enviando mensaje de texto:", err?.response?.data || err.message);
  }
}

async function enviarBotones(to, textoMensaje, botonAprobarID, botonRechazarID) {
  try {
    await axios({
      method: "POST",
      url: `https://graph.facebook.com/v20.0/${META_PHONE_ID}/messages`,
      headers: {
        Authorization: `Bearer ${META_TOKEN}`,
        "Content-Type": "application/json"
      },
      data: {
        messaging_product: "whatsapp",
        to: to,
        type: "interactive",
        interactive: {
          type: "button",
          body: { text: textoMensaje },
          action: {
            buttons: [
              { type: "reply", reply: { id: botonAprobarID, title: "✅ Aprobar" } },
              { type: "reply", reply: { id: botonRechazarID, title: "❌ Rechazar" } }
            ]
          }
        }
      }
    });
  } catch (err) {
    console.error("Error enviando botones:", err?.response?.data || err.message);
  }
}

// Emular el trigger de Firebase Firestore localmente
db.collection('sales').onSnapshot((snapshot) => {
    snapshot.docChanges().forEach(async (change) => {
        if (change.type === 'modified') {
            const newData = change.doc.data();
            // Evitar loop infinito comparando con verificacion_solicitada
            if (newData.status_pedido === 'verificando_pago' && !newData.verificacion_solicitada) {
                let captureUrl = newData.capture_base64 || (newData.captures_pago && newData.captures_pago[0]);
                if (!captureUrl) return;

                // Marcar como solicitada
                await db.collection('sales').doc(change.doc.id).update({ verificacion_solicitada: true });

                const tasaDelPedido = newData.tasa_momento || 40.50;
                const totalEnBs = (newData.total_usd * tasaDelPedido).toFixed(2);
                
                const shortId = change.doc.id.substring(0, 4);
                let msgDueño = `🚨 *PAGO PENDIENTE DE VERIFICAR*\n\nPedido #${change.doc.id}\nCliente: ${newData.nombre_cliente}\nTotal: Bs ${totalEnBs} (Tasa: ${tasaDelPedido})`;
                
                if (captureUrl.startsWith('http')) {
                    msgDueño += `\n\nEnlace del capture: ${captureUrl}`;
                } else {
                    msgDueño += `\n\n(El cliente subió una imagen).`;
                }

                await enviarBotones(
                    numeroAdministrador, 
                    msgDueño, 
                    `APROBAR_PEDIDO_${shortId}`, 
                    `RECHAZAR_PEDIDO_${shortId}`
                );
            }
        }
    });
});

const PORT = 3000;
app.listen(PORT, () => {
  console.log(`🤖 Servidor Webhook de Kalu Robot corriendo en el puerto ${PORT}`);
});
