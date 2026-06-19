import pkg from 'whatsapp-web.js';
const { Client, LocalAuth, MessageMedia } = pkg;
import qrcode from 'qrcode-terminal';
import { initializeApp } from 'firebase/app';
import { getFirestore, collection, query, where, onSnapshot, getDocs, updateDoc, doc, getDoc } from 'firebase/firestore';
import fs from 'fs';

// 1. Cargar config de Firebase
const firebaseConfig = JSON.parse(fs.readFileSync(new URL('./firebase-applet-config.json', import.meta.url)));
const app = initializeApp(firebaseConfig);
const db = getFirestore(app, firebaseConfig.firestoreDatabaseId);

// 2. Inicializar WhatsApp
const client = new Client({
    authStrategy: new LocalAuth({ dataPath: './.wwebjs_auth_cajero' }),
    puppeteer: {
        args: ['--no-sandbox', '--disable-setuid-sandbox'],
        headless: true
    },
    webVersionCache: {
        type: 'none'
    }
});

let isReady = false;

client.on('qr', (qr) => {
    console.log('\n🤖 CHARBOX - CAJERO AUTOMÁTICO');
    console.log('Por favor escanea este código QR con el WhatsApp de tu negocio:');
    qrcode.generate(qr, { small: true });
});

client.on('ready', () => {
    console.log('\n✅ Charbox conectado a WhatsApp correctamente!');
    console.log('👀 Escuchando nuevos pedidos...');
    isReady = true;
});

client.on('authenticated', () => {
    console.log('✅ WhatsApp Autenticado');
});

client.on('auth_failure', msg => {
    console.error('❌ Error de Autenticación en WhatsApp', msg);
});

// Número de WhatsApp del administrador (Reemplazar si es necesario)
let numeroAdministrador = '584125782054@c.us';

// Función para formatear número de teléfono al formato internacional de WhatsApp (Venezuela)
function formatearTelefonoWhatsApp(telefonoRaw) {
    if (!telefonoRaw) return '';
    let tel = telefonoRaw.replace(/\D/g, '');
    if (tel.length === 11 && tel.startsWith('0')) {
        return '58' + tel.substring(1);
    }
    if (tel.length === 10 && (tel.startsWith('412') || tel.startsWith('414') || tel.startsWith('424') || tel.startsWith('416') || tel.startsWith('426') || tel.startsWith('418'))) {
        return '58' + tel;
    }
    return tel;
}

// 3. Escuchar la base de datos (Ventas Pendientes)
let unsubscribe = null;
let repartidores = [];

// Función para cargar los repartidores disponibles
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
        // Marcar para no enviar dos veces
        await updateDoc(doc(db, 'sales', saleId), { verificacion_solicitada: true });
        
        const tasaDelPedido = saleData.tasa_momento || 40.50;
        const totalEnBs = (saleData.total_usd * tasaDelPedido).toFixed(2);
        
        const msgDueño = `🚨 *PAGO PENDIENTE DE VERIFICAR*\n\nPedido #${saleId}\nCliente: ${saleData.nombre_cliente}\nTotal: Bs ${totalEnBs} (Tasa: ${tasaDelPedido})\n\nResponde a este chat con la palabra *APROBAR ${saleId.substring(0,4)}* o *RECHAZAR ${saleId.substring(0,4)}*`;
        
        if (isReady) {
            const capture = captureUrl;
            if (capture.startsWith('data:image')) {
                // Es una imagen en Base64
                const base64Data = capture.split(',')[1];
                const mimeType = capture.split(';')[0].split(':')[1];
                const media = new MessageMedia(mimeType, base64Data);
                
                if (numeroAdministrador.includes('584120000000')) {
                    console.error('❌ ERROR FATAL: El número del administrador es el falso que viene por defecto (584120000000). El sistema no puede enviarle la foto a un número falso. ¡Por favor pon tu número real en el código!');
                    return;
                }
                
                const contactId = await client.getNumberId(numeroAdministrador);
                if (contactId) {
                    await client.sendMessage(contactId._serialized, media, { caption: msgDueño });
                    console.log(`📲 Solicitud de verificación de pago enviada al administrador.`);
                } else {
                    console.error(`❌ El número de administrador ${numeroAdministrador} no está registrado en WhatsApp.`);
                }
            } else {
                // Es un link normal
                await client.sendMessage(numeroAdministrador, `${msgDueño}\n\nEnlace del Capture: ${capture}`);
            }
            console.log(`📲 Solicitud de verificación de pago enviada al administrador.`);
        }
    } catch (e) {
        console.error('❌ Error enviando WhatsApp al administrador:', e);
    }
}

async function procesarPedido(saleId, saleData) {
    console.log(`\n📦 Procesando nuevo pedido #${saleId}`);
    
    if (repartidores.length === 0) await cargarRepartidores();
    
    if (repartidores.length === 0) {
        console.log('⚠️ No hay repartidores registrados.');
        return;
    }

    const repartidorElegido = repartidores[Math.floor(Math.random() * repartidores.length)];
    console.log(`🎯 Repartidor elegido: ${repartidorElegido.username}`);

    try {
        const docRef = doc(db, 'sales', saleId);
        
        if ((saleData.captures_pago && saleData.captures_pago.length > 0) || saleData.capture_base64) {
            // El cliente subió un pago desde el principio
            await updateDoc(docRef, {
                status_pedido: 'verificando_pago',
                repartidor_id: repartidorElegido.id
            });
            await solicitarVerificacion(saleId, saleData);
        } else {
            // Es efectivo o aún no han pagado, se asigna directo
            await updateDoc(docRef, {
                status_pedido: 'listo',
                repartidor_id: repartidorElegido.id
            });
            console.log(`✅ Pedido asignado a ${repartidorElegido.username}`);

            if (isReady && repartidorElegido.telefono) {
                let tel = formatearTelefonoWhatsApp(repartidorElegido.telefono);
                const msgRepartidor = `🚨 *NUEVO PEDIDO ASIGNADO*\n\nHola ${repartidorElegido.username}, el Charbox te ha asignado un nuevo pedido.\n\n*Cliente:* ${saleData.nombre_cliente}\n*Total a Cobrar:* $${saleData.total_usd}\n\nAbre tu portal de Kalu para ver la dirección.`;
                await client.sendMessage(`${tel}@c.us`, msgRepartidor);
            }
        }
    } catch (e) {
        console.error('❌ Error procesando el pedido:', e);
    }
}

// Inicializar el Listener
function iniciarListener() {
    const q = query(collection(db, 'sales'), where('origen', '==', 'web'));
    
    unsubscribe = onSnapshot(q, (snapshot) => {
        snapshot.docChanges().forEach((change) => {
            const saleData = change.doc.data();
            const saleId = change.doc.id;

            if (change.type === 'added' && saleData.status_pedido === 'pendiente') {
                procesarPedido(saleId, saleData);
            }
            
            // Escuchar cuando el repartidor sube una foto desde el portal
            if (change.type === 'modified' && saleData.status_pedido === 'verificando_pago' && !saleData.verificacion_solicitada) {
                solicitarVerificacion(saleId, saleData);
            }
        });
    });
}

// 5. Escuchar respuestas del administrador por WhatsApp para aprobar pagos
client.on('message_create', async msg => {
    let body = msg.body.toUpperCase().trim();
    if (body.startsWith('APROBAR')) {
        let shortId = body.replace('APROBAR', '').trim();
        if (shortId.length > 0) {
            // Buscar la venta
            const q = query(collection(db, 'sales'), where('status_pedido', '==', 'verificando_pago'));
            const snap = await getDocs(q);
            let encontrada = false;
            
            snap.forEach(async (docSnapshot) => {
                if (docSnapshot.id.toLowerCase().startsWith(shortId.toLowerCase())) {
                    encontrada = true;
                    const data = docSnapshot.data();
                    
                    const nuevoStatus = data.metodo_cobro_driver === 'pago_movil' ? 'entregado' : 'listo';
                    
                    // Aprobar
                    await updateDoc(doc(db, 'sales', docSnapshot.id), {
                        status_pedido: nuevoStatus,
                        pagada: true
                    });
                    
                    if (nuevoStatus === 'entregado') {
                        msg.reply(`✅ Pago aprobado. El pedido ha sido marcado como ENTREGADO y se sumó al historial del repartidor.`);
                    } else {
                        msg.reply(`✅ Pago aprobado. El pedido ha sido marcado como LISTO para que el repartidor lo lleve.`);
                    }
                    
                    // Avisar al repartidor
                    if (data.repartidor_id) {
                        const rep = repartidores.find(r => r.id === data.repartidor_id);
                        if (rep && rep.telefono) {
                            let tel = formatearTelefonoWhatsApp(rep.telefono);
                            
                            const msgRep = nuevoStatus === 'entregado' 
                                ? `✅ El pago de ${data.nombre_cliente} fue aprobado. Has completado la entrega con éxito.`
                                : `✅ El pago de ${data.nombre_cliente} fue aprobado. Ya puedes proceder a llevarle el pedido.`;
                                
                            await client.sendMessage(`${tel}@c.us`, msgRep);
                        }
                    }
                }
            });
            
            if (!encontrada) {
                msg.reply(`❌ No encontré ningún pedido en verificación con el código ${shortId}`);
            }
        }
    } else if (body.startsWith('RECHAZAR')) {
        let shortId = body.replace('RECHAZAR', '').trim();
        if (shortId.length > 0) {
            const q = query(collection(db, 'sales'), where('status_pedido', '==', 'verificando_pago'));
            const snap = await getDocs(q);
            
            snap.forEach(async (docSnapshot) => {
                if (docSnapshot.id.toLowerCase().startsWith(shortId.toLowerCase())) {
                    await updateDoc(doc(db, 'sales', docSnapshot.id), {
                        status_pedido: 'listo',
                        captures_pago: []
                    });
                    msg.reply(`❌ Pago rechazado. El pedido volverá a estado "listo" sin pago verificado.`);
                }
            });
        }
    }
});

client.initialize();
iniciarListener();
