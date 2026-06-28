const functions = require("firebase-functions/v1");
const admin = require("firebase-admin");
const express = require("express");
const axios = require("axios");

if (!admin.apps.length) {
    admin.initializeApp();
}
const db = admin.firestore();

// Credenciales Meta (Token Permanente)
const META_TOKEN = process.env.META_TOKEN || "EAATcZB4iyfAQBR2eOenzZCSLZB3GD6HX0kGICRLhjK6br0hP0j4GNBX64JPbZBHRrThJ10kiqNlkjRdQHgQdEe4IkdsdMC0eA2hqK2cLwwt3lsZAchy1kQAbMCJUafaxzJ0gaIcNbQKiXoVunshQbkDfwlmFGXlQKUlLdtfojO4WaUM8RIgWZCS6wq0Y9Yd3n3sQZDZD";
const META_PHONE_ID = process.env.META_PHONE_ID || "1166867286513063";
const META_VERIFY_TOKEN = process.env.META_VERIFY_TOKEN || "kalu_seguridad_2024";

const NUMERO_ADMIN = "584125782054";

// ==========================================
// 1. HELPERS: Envío de Mensajes por Meta API
// ==========================================

async function enviarMensajeTexto(to, text) {
    try {
        await axios({
            method: "POST",
            url: `https://graph.facebook.com/v21.0/${META_PHONE_ID}/messages`,
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
        console.error("❌ Error enviando texto:", err?.response?.data || err.message);
    }
}

async function enviarBotones(to, textoMensaje, botonAprobarID, botonRechazarID, mediaUrl = null) {
    let payload = {
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
    };

    if (mediaUrl && !mediaUrl.startsWith('data:image')) {
        payload.interactive.header = {
            type: "image",
            image: { link: mediaUrl }
        };
    }

    try {
        await axios({
            method: "POST",
            url: `https://graph.facebook.com/v21.0/${META_PHONE_ID}/messages`,
            headers: {
                Authorization: `Bearer ${META_TOKEN}`,
                "Content-Type": "application/json"
            },
            data: payload
        });
    } catch (err) {
        console.error("❌ Error enviando botones:", err?.response?.data || err.message);
    }
}

function formatearTelefonoWhatsApp(telefonoRaw) {
    if (!telefonoRaw) return '';
    let tel = telefonoRaw.replace(/\D/g, '');
    if (tel.length === 11 && tel.startsWith('0')) return '58' + tel.substring(1);
    if (tel.length === 10) return '58' + tel;
    return tel;
}

// ==========================================
// 2. LÓGICA DE CIERRE DE CAJA (Base de Datos)
// ==========================================

async function generarCierreDiario(fechaCierreStr = null, realUSD = 0, realBS = 0) {
    try {
        const targetDate = fechaCierreStr || new Date().toLocaleString("en-CA", {timeZone: "America/Caracas"}).split(',')[0];
        const qCierre = await db.collection('cierres_caja').where('fecha', '==', targetDate).get();
        if (!qCierre.empty) {
            await enviarMensajeTexto(NUMERO_ADMIN, `⚠️ El cierre de caja para hoy ${targetDate} ya fue realizado anteriormente.`);
            return;
        }

        const startOfDay = new Date(targetDate + 'T00:00:00-04:00'); // Hora Vzla
        const endOfDay = new Date(targetDate + 'T23:59:59-04:00');

        const qSalesData = await db.collection('sales')
            .where('createdAt', '>=', startOfDay)
            .where('createdAt', '<=', endOfDay)
            .get();
        
        const sales = qSalesData.docs.map(doc => doc.data());
        if (sales.length === 0) {
            await enviarMensajeTexto(NUMERO_ADMIN, `⚠️ No hay ventas registradas en el sistema para hoy ${targetDate}. Cierre omitido.`);
            return;
        }

        const totals = sales.reduce((acc, sale) => {
            acc.usd_cash += sale.pago_efectivo_usd || 0;
            acc.vueltos += sale.vuelto_entregado_usd || 0;
            acc.bs_cash += sale.pago_efectivo_bs || 0;
            acc.pago_movil += sale.pago_movil_bs || 0;
            acc.biopago += sale.biopago_bdv || 0;
            acc.debito += sale.pago_debito_bs || 0;
            acc.total_usd += sale.total_usd || 0;
            acc.fiado += sale.saldo_pendiente_usd || 0;
            return acc;
        }, { usd_cash: 0, vueltos: 0, bs_cash: 0, pago_movil: 0, biopago: 0, debito: 0, total_usd: 0, fiado: 0 });

        const expectedUSDCash = totals.usd_cash - totals.vueltos;
        const expectedBsCash = totals.bs_cash;

        // Buscar tasa BCV
        let tasaCierre = 40.50;
        const snapTasa = await db.collection('tasas_bcv').where('fecha', '==', targetDate).get();
        if (!snapTasa.empty) {
            tasaCierre = snapTasa.docs[0].data().valor;
        }

        const difUSD = realUSD - expectedUSDCash;
        const difBS = realBS - expectedBsCash;

        const newClosure = {
            fecha: targetDate,
            monto_bs: expectedBsCash,
            monto_usd: expectedUSDCash,
            pago_movil: totals.pago_movil,
            transferencia: totals.pago_movil,
            biopago: totals.biopago,
            tarjeta_debito: totals.debito,
            tasa_cierre: tasaCierre,
            total_ventas_usd: totals.total_usd,
            total_compras_usd: 0,
            fiado_dia_usd: totals.fiado,
            monto_real_usd: realUSD,
            monto_real_bs: realBS,
            diferencia_usd: difUSD,
            diferencia_bs: difBS,
            cajero_nombre: 'Robot Cajero (Firebase)',
            createdAt: admin.firestore.FieldValue.serverTimestamp()
        };

        await db.collection('cierres_caja').add(newClosure);

        const msg = `🧾 *CIERRE DE CAJA DIARIO*\n\nFecha: ${targetDate}\nVentas Totales: $${totals.total_usd.toFixed(2)}\n\n*Cuadre Dólares:*\nEsperado: $${expectedUSDCash.toFixed(2)} | Real: $${realUSD.toFixed(2)}\nDiferencia: $${difUSD.toFixed(2)}\n\n*Cuadre Bolívares:*\nEsperado: Bs ${expectedBsCash.toFixed(2)} | Real: Bs ${realBS.toFixed(2)}\nDiferencia: Bs ${difBS.toFixed(2)}\n\n_✅ Guardado en base de datos exitosamente._`;
        await enviarMensajeTexto(NUMERO_ADMIN, msg);
    } catch (e) {
        console.error('❌ Error generando cierre automático:', e);
        await enviarMensajeTexto(NUMERO_ADMIN, `❌ Hubo un error procesando el cierre de caja.`);
    }
}


// ==========================================
// 3. EXPRESS APP: WEBHOOK META
// ==========================================

const app = express();
app.use(express.json());

app.get("*", (req, res) => {
    const mode = req.query["hub.mode"];
    const token = req.query["hub.verify_token"];
    const challenge = req.query["hub.challenge"];

    if (mode === "subscribe" && token === META_VERIFY_TOKEN) {
        return res.status(200).send(challenge);
    }
    return res.sendStatus(403);
});

app.post("*", async (req, res) => {
    try {
        const body = req.body;
        if (body.object && body.entry?.[0]?.changes?.[0]?.value?.messages?.[0]) {
            const message = body.entry[0].changes[0].value.messages[0];
            const from = message.from;

            let textBody = "";
            if (message.type === "text") {
                textBody = message.text.body.toUpperCase().trim();
            } else if (message.type === "interactive" && message.interactive.type === "button_reply") {
                textBody = message.interactive.button_reply.id.toUpperCase();
            }

            if (textBody) {
                console.log(`💬 Webhook procesando mensaje de ${from}: ${textBody}`);
                await procesarMensajeEntrante(from, textBody);
            }
        }
        res.status(200).send("EVENT_RECEIVED");
    } catch (e) {
        console.error("Error global en webhook:", e);
        res.status(500).send("ERROR");
    }
});

async function procesarMensajeEntrante(from, body) {
    const esAdmin = from.includes(NUMERO_ADMIN.replace('58', ''));

    // --- FLUJO DE BOTONES (APROBAR/RECHAZAR) ---
    if (body.startsWith('APROBAR_PEDIDO_') || body === 'APROBAR') {
        let shortId = body.replace('APROBAR_PEDIDO_', '').trim();
        if (body === 'APROBAR') shortId = ''; // Fallback if they just typed APROBAR

        const snap = await db.collection('sales').get();
        let encontrada = false;

        for (const docSnapshot of snap.docs) {
            const idMatches = shortId === '' || docSnapshot.id.toLowerCase().startsWith(shortId.toLowerCase());
            const data = docSnapshot.data();
            
            if (idMatches && data.status_pedido === 'verificando_pago') {
                encontrada = true;
                const nuevoStatus = 'listo';
                
                await db.collection('sales').doc(docSnapshot.id).update({
                    status_pedido: nuevoStatus,
                    pagada: true
                });
                
                await enviarMensajeTexto(from, `✅ Pago aprobado. El pedido de ${data.nombre_cliente} pasó a estado ${nuevoStatus.toUpperCase()}.`);
                
                // Avisar al repartidor
                if (data.repartidor_id) {
                    const repSnap = await db.collection('users').doc(data.repartidor_id).get();
                    if (repSnap.exists && repSnap.data().telefono) {
                        let tel = formatearTelefonoWhatsApp(repSnap.data().telefono);
                        await enviarMensajeTexto(tel, `✅ El pago de ${data.nombre_cliente} fue aprobado. Puedes proceder con la entrega.`);
                    }
                }
                break; // Procesar solo uno si escribieron "APROBAR" a secas
            }
        }
        if (!encontrada) await enviarMensajeTexto(from, `❌ No encontré ningún pedido pendiente de verificación con ese ID.`);
        return;
    } 

    if (body.startsWith('RECHAZAR_PEDIDO_') || body === 'RECHAZAR') {
        let shortId = body.replace('RECHAZAR_PEDIDO_', '').trim();
        if (body === 'RECHAZAR') shortId = '';

        const snap = await db.collection('sales').get();
        let encontrada = false;

        for (const docSnapshot of snap.docs) {
            const idMatches = shortId === '' || docSnapshot.id.toLowerCase().startsWith(shortId.toLowerCase());
            const data = docSnapshot.data();

            if (idMatches && data.status_pedido === 'verificando_pago') {
                encontrada = true;
                await db.collection('sales').doc(docSnapshot.id).update({
                    status_pedido: 'listo',
                    captures_pago: []
                });
                await enviarMensajeTexto(from, `❌ Pago rechazado. El pedido volverá a estado LISTO (sin pago) para revisarse.`);
                break;
            }
        }
        if (!encontrada) await enviarMensajeTexto(from, `❌ No se encontró ese pedido pendiente.`);
        return;
    }

    // --- FLUJO DE CIERRE DE CAJA ---
    if (esAdmin) {
        const stateRef = db.collection('config').doc('closure_state');
        const stateSnap = await stateRef.get();
        let state = stateSnap.exists ? stateSnap.data() : { activo: false };

        if (body.includes('CERRAR TIENDA') || body.includes('GENERAR CIERRE') || body.includes('CIERRA TIENDA') || body.includes('CERRA TIENDA')) {
            await stateRef.set({ activo: true, step: 'usd', usd: 0, bs: 0 });
            await enviarMensajeTexto(from, `⏳ *Iniciando Cierre de Caja General.*\n\n💵 ¿Cuánto efectivo físico tienes en *Dólares*?\n(Responde solo con el número, ej: 20)`);
            return;
        }

        if (state.activo) {
            if (body === 'ABORTAR' || body === 'CANCELAR' || body.includes('NO QUIERO CERRAR')) {
                await stateRef.update({ activo: false });
                await enviarMensajeTexto(from, `🛑 Cierre de caja cancelado. Sigo a tu disposición para aprobar pedidos.`);
                return;
            }

            let num = parseFloat(body);
            if (!isNaN(num)) {
                if (state.step === 'usd') {
                    await stateRef.update({ step: 'bs', usd: num });
                    await enviarMensajeTexto(from, `🇻🇪 Entendido. Dólares físicos: $${num}.\n\n¿Cuánto efectivo físico tienes en *Bolívares*?`);
                } else if (state.step === 'bs') {
                    await stateRef.update({ activo: false, bs: num });
                    await enviarMensajeTexto(from, `✅ ¡Datos recibidos! Generando el cuadre de caja...`);
                    await generarCierreDiario(null, state.usd, num);
                }
            } else {
                await enviarMensajeTexto(from, `❌ Formato inválido. Responde solo con números para el cuadre.`);
            }
            return;
        }
    }



    if (body.startsWith('RECHAZAR_PEDIDO_') || body === 'RECHAZAR') {
        let shortId = body.replace('RECHAZAR_PEDIDO_', '').trim();
        if (body === 'RECHAZAR') shortId = '';

        const snap = await db.collection('sales').get();
        let encontrada = false;

        for (const docSnapshot of snap.docs) {
            const idMatches = shortId === '' || docSnapshot.id.toLowerCase().startsWith(shortId.toLowerCase());
            const data = docSnapshot.data();

            if (idMatches && data.status_pedido === 'verificando_pago') {
                encontrada = true;
                await db.collection('sales').doc(docSnapshot.id).update({
                    status_pedido: 'listo',
                    captures_pago: []
                });
                await enviarMensajeTexto(from, `❌ Pago rechazado. El pedido volverá a estado LISTO (sin pago) para revisarse.`);
                break;
            }
        }
        if (!encontrada) await enviarMensajeTexto(from, `❌ No se encontró ese pedido pendiente.`);
        return;
    }

    // --- FALLBACK PARA CLIENTES NORMALES (ASISTENTE Kalu AI) ---
    if (!esAdmin) {
        try {
            // 1. Obtener productos y precios reales para dar contexto al robot
            const prodSnap = await db.collection('products').get();
            let inventarioStr = "";
            prodSnap.forEach(doc => {
                const p = doc.data();
                if (!p.estatus || p.estatus === 'disponible' || p.estatus === 'destacado') {
                    const precio = p.precio_oferta_usd || p.precio_normal_usd || 0;
                    inventarioStr += `- ${p.nombre}: $${precio}\n`;
                }
            });

            // 2. Construir el contexto para Gemini
            const apiKey = process.env.GEMINI_API_KEY;
            if (!apiKey) {
                console.warn("No hay GEMINI_API_KEY configurada. Usando fallback estático.");
                await enviarMensajeTexto(from, `¡Hola! Soy el asistente virtual de Kalu 🤖.\n\nPara hacer un pedido súper rápido o ver nuestros productos, entra a nuestra página oficial:\n👉 https://kalu-queso-sanjuam.web.app`);
                return;
            }

            const { GoogleGenerativeAI } = require("@google/generative-ai");
            const genAI = new GoogleGenerativeAI(apiKey);
            
            // Obtener la hora actual en Venezuela (UTC-4) para que el robot sepa la hora
            const horaActual = new Date().toLocaleString("es-VE", { timeZone: "America/Caracas" });

            const systemPrompt = `Eres Kalu AI, el asistente inteligente y amigable de Kalu Queso San Juan.
Tu objetivo es responder a las consultas de los clientes por WhatsApp, siempre siendo amable, servicial y persuasivo para que hagan pedidos.

INFORMACIÓN DEL NEGOCIO:
- Horario de atención oficial: 6:00 AM a 6:00 PM.
- Delivery: ¡Delivery GRATIS a partir de $5 en compras!
- Hora actual del sistema: ${horaActual}
- Link oficial para comprar y ver el catálogo: https://kalu-queso-sanjuam.web.app
- PRODUCTOS DISPONIBLES Y PRECIOS ACTUALES (Dólares):
${inventarioStr || "(No hay productos disponibles por ahora)"}

REGLAS ESTRICTAS:
1. Sé conciso y directo, es WhatsApp. Usa emojis 🧀🚀.
2. Si te preguntan por productos o precios, SIEMPRE lee la lista de arriba y dale los precios exactos (Ejemplo: "Tenemos Queso Llanero a $X").
3. Si preguntan por el horario o si están abiertos, diles que trabajan de 6 AM a 6 PM.
4. Si el cliente quiere hacer un pedido o comprar, dile que use el portal oficial: https://kalu-queso-sanjuam.web.app (siempre dale este link).
5. No te inventes precios ni productos que no estén en tu lista.
6. Saluda cordialmente si te saludan. Nunca digas que eres una IA de Google, eres Kalu AI.`;

            // 3. Consultar a Gemini
            const model = genAI.getGenerativeModel({ 
                model: "gemini-2.5-flash",
                systemInstruction: systemPrompt
            });

            const result = await model.generateContent(body);
            const response = result.response;

            const respuestaIA = response.text() || "¡Hola! Estoy teniendo un pequeño problema técnico, pero puedes ver todo en nuestra página oficial: https://kalu-queso-sanjuam.web.app";
            
            // 4. Enviar la respuesta generada al usuario
            await enviarMensajeTexto(from, respuestaIA);

        } catch (error) {
            console.error("Error en Gemini AI:", error);
            // Fallback con info de debug temporal
            const debugErr = error.message ? error.message : JSON.stringify(error);
            await enviarMensajeTexto(from, `¡Hola! Soy el asistente virtual de Kalu 🤖.\n(Debug: ${debugErr})\n\nPara hacer un pedido súper rápido o ver nuestros productos, entra a nuestra página oficial:\n👉 https://kalu-queso-sanjuam.web.app`);
        }
    }
}

// ==========================================
// 4. FIREBASE CLOUD FUNCTIONS TRIGGERS
// ==========================================

// Webhook principal
exports.webhook = functions.https.onRequest(app);

// Asignar Repartidor Automáticamente al CREAR un pedido
exports.onsalecreate = functions.firestore.document('sales/{saleId}').onCreate(async (snap, context) => {
    const saleData = snap.data();
    const saleId = context.params.saleId;
    
    if (saleData.status_pedido === 'pendiente' || !saleData.status_pedido) {
        const usersSnap = await db.collection('users').where('role', '==', 'repartidor').get();
        const repartidores = usersSnap.docs.map(d => ({ id: d.id, ...d.data() }));
        
        let updateData = {};
        let repElegido = null;
        
        if (repartidores.length > 0) {
            repElegido = repartidores[Math.floor(Math.random() * repartidores.length)];
            updateData.repartidor_id = repElegido.id;
        }

        const tieneCapture = (saleData.captures_pago && saleData.captures_pago.length > 0) || saleData.capture_base64;

        if (tieneCapture) {
            updateData.status_pedido = 'verificando_pago';
            updateData.verificacion_solicitada = true; 
        } else {
            updateData.status_pedido = 'listo';
        }

        await snap.ref.update(updateData);

        // Notificar al repartidor de inmediato
        if (repElegido && repElegido.telefono) {
            let tel = formatearTelefonoWhatsApp(repElegido.telefono);
            const appUrl = 'https://kalu-queso-sanjuam.web.app';
            const msgRep = '🛵 *NUEVO PEDIDO ASIGNADO*\n\nHola ' + (repElegido.username || 'Repartidor') + ', tienes un nuevo pedido en tu cuenta.\n\n📱 Entra a la app para ver los detalles y procesarlo:\n' + appUrl + '\n\n¡Atención rápida! 🚀';
            await enviarMensajeTexto(tel, msgRep);
        }

        // Notificar al admin con capture
        if (tieneCapture) {
            const tasaDelPedido = saleData.tasa_momento || 40.50;
            const totalEnBs = (saleData.total_usd * tasaDelPedido).toFixed(2);
            const shortId = saleId.substring(0, 4);
            const totalUsd = saleData.total_usd > 0
                ? '$' + saleData.total_usd.toFixed(2) + ' / Bs ' + totalEnBs
                : 'Bs ' + (saleData.monto_abono_usd ? (saleData.monto_abono_usd * tasaDelPedido).toFixed(2) : totalEnBs);

            const msgAdmin = '🚨 *PAGO PENDIENTE DE VERIFICAR*\n\nPedido #' + saleId + '\nCliente: ' + saleData.nombre_cliente + '\nTotal: ' + totalUsd;

            // Paso 1: Enviar texto simple PRIMERO (siempre llega, sin restricción de ventana WhatsApp)
            await enviarMensajeTexto(NUMERO_ADMIN, msgAdmin + '\n\n⏳ Verificando imagen del comprobante...\n\nResponde APROBAR o RECHAZAR cuando veas el capture.');

            // Paso 2: Esperar 10 segundos para que el frontend suba la imagen a Firebase Storage
            await new Promise(resolve => setTimeout(resolve, 10000));

            // Paso 3: Releer el documento para obtener la URL de Storage actualizada
            const freshDoc = await db.collection('sales').doc(saleId).get();
            const freshData = freshDoc.data() || saleData;
            let captureUrl = freshData.capture_base64 || (freshData.captures_pago && freshData.captures_pago[0]);

            // Paso 4: Enviar la imagen + botones si ya tenemos URL
            try {
                if (captureUrl && !captureUrl.startsWith('data:image')) {
                    await enviarBotones(NUMERO_ADMIN, '📸 *Comprobante del pedido #' + shortId + ':*', 'APROBAR_PEDIDO_' + shortId, 'RECHAZAR_PEDIDO_' + shortId, captureUrl);
                } else {
                    // Capture aún en base64 o no disponible - enviar instrucciones de texto
                    await enviarMensajeTexto(NUMERO_ADMIN, '⚠️ La imagen no pudo subirse automáticamente. Revísala en el portal:\n👉 https://kalu-queso-sanjuam.web.app\n\nEscribe APROBAR o RECHAZAR para procesar el pedido #' + shortId);
                }
            } catch (e) {
                console.error('Error enviando botones al admin:', e?.response?.data || e.message);
                await enviarMensajeTexto(NUMERO_ADMIN, '⚠️ No se pudo enviar la imagen. Revisa el portal:\n👉 https://kalu-queso-sanjuam.web.app\n\nEscribe APROBAR o RECHAZAR para el pedido #' + shortId);
            }
        }
    }
});


// Pedir verificación al dueño al MODIFICAR un pedido (subida de capture)
exports.onsaleupdate = functions.firestore.document('sales/{saleId}').onUpdate(async (change, context) => {
    const newData = change.after.data();
    const oldData = change.before.data();
    const saleId = context.params.saleId;

    if (newData.status_pedido === 'verificando_pago' && oldData.status_pedido !== 'verificando_pago' && !newData.verificacion_solicitada) {
        await db.collection('sales').doc(saleId).update({ verificacion_solicitada: true });

        const tasaDelPedido = newData.tasa_momento || 40.50;
        const totalEnBs = (newData.total_usd * tasaDelPedido).toFixed(2);
        const shortId = saleId.substring(0, 4);
        
        let msgDueño = `🚨 *PAGO PENDIENTE DE VERIFICAR*\n\nPedido #${saleId}\nCliente: ${newData.nombre_cliente}\nTotal: Bs ${totalEnBs}`;

        let captureUrl = newData.capture_base64 || (newData.captures_pago && newData.captures_pago[0]);

        if (captureUrl && captureUrl.startsWith('data:image')) {
            msgDueño += `\n\n*Aviso:* Captura en formato local. Revísala en el Portal Web.`;
            await enviarBotones(NUMERO_ADMIN, msgDueño, `APROBAR_PEDIDO_${shortId}`, `RECHAZAR_PEDIDO_${shortId}`);
        } else if (captureUrl) {
            await enviarBotones(NUMERO_ADMIN, msgDueño, `APROBAR_PEDIDO_${shortId}`, `RECHAZAR_PEDIDO_${shortId}`, captureUrl);
        } else {
            await enviarBotones(NUMERO_ADMIN, msgDueño, `APROBAR_PEDIDO_${shortId}`, `RECHAZAR_PEDIDO_${shortId}`);
        }
    }
});

exports.debugSales = functions.https.onRequest(async (req, res) => {
    let text = "--- DRIVERS ---\n";
    const drivers = await db.collection('users').where('role', '==', 'repartidor').get();
    drivers.forEach(d => {
        text += `Driver: ${d.data().username} | Tel: ${d.data().telefono || 'NO TIENE'}\n`;
    });

    const snap = await db.collection('sales').orderBy('createdAt', 'desc').limit(5).get();
    text += "\n--- ÚLTIMOS 5 PEDIDOS ---\n";
    snap.forEach(d => {
        const cap = d.data().capture_base64;
        const capsPago = d.data().captures_pago;
        let capStatus = 'No';
        if (cap && cap.startsWith('https://')) capStatus = 'URL-Storage ✅';
        else if (cap && cap.startsWith('data:image')) capStatus = 'Base64 ❌ (upload falló)';
        else if (capsPago && capsPago.length > 0) capStatus = capsPago[0].startsWith('https://') ? 'captures_pago URL ✅' : 'captures_pago Base64 ❌';
        text += `ID: ${d.id} | Cliente: ${d.data().nombre_cliente} | Status: ${d.data().status_pedido} | Capture: ${capStatus}\n`;
    });
    res.send(text);
});

// Endpoint para probar envío directo de notificación al admin
exports.testNotify = functions.https.onRequest(async (req, res) => {
    try {
        // Obtener últimas 20 ventas y filtrar en memoria (sin índice)
        const snap = await db.collection('sales').limit(20).get();
        let pendiente = null;
        snap.forEach(d => {
            if (!pendiente && d.data().status_pedido === 'verificando_pago') {
                pendiente = { id: d.id, data: d.data() };
            }
        });

        if (!pendiente) {
            await enviarMensajeTexto(NUMERO_ADMIN, '🧪 TEST: No hay pedidos en verificando_pago. El bot funciona. ✅');
            return res.send('Enviado mensaje de prueba (sin pedidos pendientes)');
        }

        const saleId = pendiente.id;
        const data = pendiente.data;
        const shortId = saleId.substring(0, 4);
        const cap = data.capture_base64 || (data.captures_pago && data.captures_pago[0]);

        let capType = 'Ninguno';
        if (cap && cap.startsWith('https://')) capType = 'URL Storage ✅';
        else if (cap && cap.startsWith('data:')) capType = 'Base64 ❌';

        const msg = '🧪 *TEST NOTIFICACIÓN*\n\nPedido #' + saleId + '\nCliente: ' + data.nombre_cliente + '\nCapture tipo: ' + capType + '\n\nSi ves este mensaje, el bot SÍ puede enviarte notificaciones proactivas. ✅';

        if (cap && cap.startsWith('https://')) {
            await enviarBotones(NUMERO_ADMIN, msg, 'APROBAR_PEDIDO_' + shortId, 'RECHAZAR_PEDIDO_' + shortId, cap);
        } else {
            await enviarBotones(NUMERO_ADMIN, msg, 'APROBAR_PEDIDO_' + shortId, 'RECHAZAR_PEDIDO_' + shortId);
        }

        res.send('OK - Notificación enviada. Capture tipo: ' + capType);
    } catch (e) {
        res.status(500).send('Error: ' + (e.message || e));
    }
});




// CRON JOB AUTOMÁTICO A LAS 10:00 PM (Caracas)
exports.cierreDiarioCron = functions.pubsub.schedule('0 22 * * *')
  .timeZone('America/Caracas')
  .onRun(async (context) => {
    await db.collection('config').doc('closure_state').set({ 
        activo: true, step: 'usd', usd: 0, bs: 0 
    });
    await enviarMensajeTexto(NUMERO_ADMIN, `⏳ *Hora del Cierre de Caja Automático.*\n\n💵 ¿Cuánto efectivo físico tienes en *Dólares*?\n(Responde solo con el número)`);
    return null;
});
