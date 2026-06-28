import express from 'express';
import axios from 'axios';
import { initializeApp } from 'firebase/app';
import { getFirestore, collection, query, where, onSnapshot, getDocs, updateDoc, doc, addDoc } from 'firebase/firestore';
import fs from 'fs';
import dotenv from 'dotenv';

dotenv.config();

// 1. Cargar config de Firebase
const firebaseConfig = JSON.parse(fs.readFileSync(new URL('./firebase-applet-config.json', import.meta.url)));
const appFirebase = initializeApp(firebaseConfig);
const db = getFirestore(appFirebase, firebaseConfig.firestoreDatabaseId);

// 2. Variables de Entorno y Configuración de Meta
const token = process.env.WHATSAPP_ACCESS_TOKEN;
const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID;
const verifyToken = process.env.VERIFY_TOKEN;
let numeroAdministrador = process.env.ADMIN_WHATSAPP_NUMBER || '584125782054';

let isReady = true;

// Función para enviar mensajes de texto con Meta Cloud API
async function sendMessageMeta(to, text) {
    if (!to) return;
    let recipient = to.replace(/\D/g, '');
    if (recipient.endsWith('c.us')) recipient = recipient.replace('c.us', '');
    
    try {
        await axios({
            method: 'POST',
            url: `https://graph.facebook.com/v21.0/${phoneNumberId}/messages`,
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            },
            data: {
                messaging_product: 'whatsapp',
                to: recipient,
                type: 'text',
                text: { body: text }
            }
        });
        console.log(`✅ Mensaje enviado a ${recipient}`);
    } catch (error) {
        console.error(`❌ Error enviando mensaje a ${recipient}:`, error.response ? error.response.data : error.message);
    }
}

// Función para enviar imágenes con Meta Cloud API
async function sendMediaMeta(to, mediaUrl, caption) {
    if (!to) return;
    let recipient = to.replace(/\D/g, '');
    if (recipient.endsWith('c.us')) recipient = recipient.replace('c.us', '');
    
    try {
        await axios({
            method: 'POST',
            url: `https://graph.facebook.com/v21.0/${phoneNumberId}/messages`,
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            },
            data: {
                messaging_product: 'whatsapp',
                to: recipient,
                type: 'image',
                image: { link: mediaUrl },
                text: caption ? { body: caption } : undefined
            }
        });
        console.log(`✅ Imagen enviada a ${recipient}`);
    } catch (error) {
        console.error(`❌ Error enviando imagen a ${recipient}:`, error.response ? error.response.data : error.message);
        await sendMessageMeta(recipient, `${caption}\n\nEnlace a la imagen: ${mediaUrl}`);
    }
}

function formatearTelefonoWhatsApp(telefonoRaw) {
    if (!telefonoRaw) return '';
    let tel = telefonoRaw.replace(/\D/g, '');
    if (tel.length === 11 && tel.startsWith('0')) return '58' + tel.substring(1);
    if (tel.length === 10) return '58' + tel;
    return tel;
}

// 3. Escuchar la base de datos (Ventas Pendientes)
let unsubscribe = null;
let repartidores = [];

async function cargarRepartidores() {
    const q = query(collection(db, 'users'), where('role', '==', 'repartidor'));
    const snapshot = await getDocs(q);
    repartidores = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    console.log(`🚚 Cargados ${repartidores.length} repartidores de la base de datos.`);
}

async function solicitarVerificacion(saleId, saleData) {
    let captureUrl = saleData.capture_base64 || (saleData.captures_pago && saleData.captures_pago[0]);
    if (!captureUrl) return;
    
    try {
        await updateDoc(doc(db, 'sales', saleId), { verificacion_solicitada: true });
        
        const tasaDelPedido = saleData.tasa_momento || 40.50;
        const totalEnBs = (saleData.total_usd * tasaDelPedido).toFixed(2);
        
        const msgDueño = `🚨 *PAGO PENDIENTE DE VERIFICAR*\n\nPedido #${saleId}\nCliente: ${saleData.nombre_cliente}\nTotal: Bs ${totalEnBs} (Tasa: ${tasaDelPedido})\n\nResponde a este chat con la palabra *APROBAR ${saleId.substring(0,4)}* o *RECHAZAR ${saleId.substring(0,4)}*`;
        
        if (captureUrl.startsWith('data:image') || captureUrl.startsWith('base64,')) {
            await sendMessageMeta(numeroAdministrador, `${msgDueño}\n\n*Aviso:* Captura en Base64. Por favor, revísala en el Portal Web.`);
        } else {
            await sendMediaMeta(numeroAdministrador, captureUrl, msgDueño);
        }
        console.log(`📲 Solicitud enviada al administrador.`);
    } catch (e) {
        console.error('❌ Error enviando solicitud:', e);
    }
}

async function procesarPedido(saleId, saleData) {
    console.log(`\n📦 Procesando nuevo pedido #${saleId}`);
    
    if (repartidores.length === 0) await cargarRepartidores();
    if (repartidores.length === 0) return console.log('⚠️ No hay repartidores registrados.');

    const repartidorElegido = repartidores[Math.floor(Math.random() * repartidores.length)];

    try {
        const docRef = doc(db, 'sales', saleId);
        
        if ((saleData.captures_pago && saleData.captures_pago.length > 0) || saleData.capture_base64) {
            await updateDoc(docRef, { status_pedido: 'verificando_pago', repartidor_id: repartidorElegido.id });
            await solicitarVerificacion(saleId, saleData);
        } else {
            await updateDoc(docRef, { status_pedido: 'listo', repartidor_id: repartidorElegido.id });
            if (repartidorElegido.telefono) {
                let tel = formatearTelefonoWhatsApp(repartidorElegido.telefono);
                const msgRepartidor = `🚨 *NUEVO PEDIDO ASIGNADO*\n\nHola ${repartidorElegido.username}, el Charbox te ha asignado un nuevo pedido.\n\n*Cliente:* ${saleData.nombre_cliente}\n*Total a Cobrar:* $${saleData.total_usd}`;
                await sendMessageMeta(tel, msgRepartidor);
            }
        }
    } catch (e) {
        console.error('❌ Error procesando el pedido:', e);
    }
}

let closureState = { activo: false, step: null, usd: 0, bs: 0, timeout: null };

async function iniciarCierreConversacional(msgFrom) {
    if (closureState.activo) {
        await sendMessageMeta(msgFrom, `⏳ Ya hay un proceso de cierre activo.`);
        return;
    }
    
    closureState.activo = true;
    closureState.step = 'usd';
    closureState.usd = 0;
    closureState.bs = 0;
    
    await sendMessageMeta(msgFrom, `⏳ *Iniciando Cierre de Caja General.*\n\n💵 ¿Cuánto efectivo físico tienes en *Dólares*? (Responde solo con el número)`);
    
    closureState.timeout = setTimeout(async () => {
        if (closureState.activo) {
            closureState.activo = false;
            await sendMessageMeta(msgFrom, `⏰ Tiempo agotado. Cierre automático asumiendo caja en 0.`);
            await generarCierreDiario(null, 0, 0);
        }
    }, 10 * 60 * 1000);
}

async function generarCierreDiario(fechaCierreStr = null, realUSD = 0, realBS = 0) {
    // Implementación original simplificada aquí
    console.log(`Generando cierre diario para realUSD=${realUSD}, realBS=${realBS}`);
    const msg = `🧾 *CIERRE DE CAJA DIARIO GENERADO*`;
    await sendMessageMeta(numeroAdministrador, msg);
}

function iniciarListener() {
    const q = query(collection(db, 'sales'), where('origen', '==', 'web'));
    unsubscribe = onSnapshot(q, (snapshot) => {
        snapshot.docChanges().forEach((change) => {
            const saleData = change.doc.data();
            const saleId = change.doc.id;

            if (change.type === 'added' && saleData.status_pedido === 'pendiente') {
                procesarPedido(saleId, saleData);
            }
            if (change.type === 'modified' && saleData.status_pedido === 'verificando_pago' && !saleData.verificacion_solicitada) {
                solicitarVerificacion(saleId, saleData);
            }
        });
    });
}

// 4. Configurar Servidor Express para Webhooks de Meta
const expressApp = express();
expressApp.use(express.json());

expressApp.get('/webhook', (req, res) => {
    const mode = req.query['hub.mode'];
    const token = req.query['hub.verify_token'];
    const challenge = req.query['hub.challenge'];

    if (mode && token) {
        if (mode === 'subscribe' && token === verifyToken) {
            console.log('✅ WEBHOOK VERIFICADO POR META!');
            res.status(200).send(challenge);
        } else {
            res.sendStatus(403);
        }
    }
});

expressApp.post('/webhook', async (req, res) => {
    const body = req.body;
    if (body.object) {
        if (body.entry && body.entry[0].changes && body.entry[0].changes[0].value.messages && body.entry[0].changes[0].value.messages[0]) {
            const wa_msg = body.entry[0].changes[0].value.messages[0];
            const msgFrom = wa_msg.from; 
            const msgBody = wa_msg.text ? wa_msg.text.body.toUpperCase().trim() : '';

            res.sendStatus(200);

            // Logica Conversacional del Cierre
            if (closureState.activo && msgFrom.includes(numeroAdministrador.replace('58',''))) {
                let num = parseFloat(msgBody);
                if (!isNaN(num)) {
                    if (closureState.step === 'usd') {
                        closureState.usd = num;
                        closureState.step = 'bs';
                        await sendMessageMeta(msgFrom, `🇻🇪 Entendido. ¿Cuánto tienes en *Bolívares*?`);
                    } else if (closureState.step === 'bs') {
                        closureState.bs = num;
                        closureState.activo = false;
                        await sendMessageMeta(msgFrom, `✅ ¡Cuadrando y guardando cierre!`);
                        await generarCierreDiario(null, closureState.usd, closureState.bs);
                    }
                }
                return;
            }
            
            if (msgBody === 'CERRAR TIENDA') {
                await iniciarCierreConversacional(msgFrom);
                return;
            }
            
            if (msgBody.startsWith('APROBAR')) {
                await sendMessageMeta(msgFrom, `✅ Aprobando: ${msgBody}`);
            }
        } else {
            res.sendStatus(200);
        }
    } else {
        res.sendStatus(404);
    }
});

const PORT = 3001; 
expressApp.listen(PORT, () => {
    console.log(`\n🤖 CHARBOX - CAJERO AUTOMÁTICO (CLOUD API)`);
    console.log(`✅ Servidor Webhook escuchando en puerto ${PORT}`);
    console.log(`🌍 Usa 'npm run webhook' para exponerlo al internet con localtunnel`);
});

iniciarListener();
