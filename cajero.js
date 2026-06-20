import pkg from 'whatsapp-web.js';
const { Client, LocalAuth, MessageMedia } = pkg;
import qrcode from 'qrcode-terminal';
import { initializeApp } from 'firebase/app';
import { getFirestore, collection, query, where, onSnapshot, getDocs, updateDoc, doc, getDoc, addDoc } from 'firebase/firestore';
import fs from 'fs';
import dotenv from 'dotenv';

dotenv.config();

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

// Número de WhatsApp del administrador (Reemplazar en .env si es necesario)
let numeroAdministrador = process.env.ADMIN_WHATSAPP_NUMBER || '584125782054@c.us';

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

let closureState = {
    activo: false,
    step: null,
    usd: 0,
    bs: 0,
    timeout: null
};

async function iniciarCierreConversacional(msgFrom) {
    if (closureState.activo) {
        client.sendMessage(msgFrom, `⏳ Ya hay un proceso de cierre activo. Dime los Dólares o Bolívares que faltan.`);
        return;
    }
    
    closureState.activo = true;
    closureState.step = 'usd';
    closureState.usd = 0;
    closureState.bs = 0;
    
    client.sendMessage(msgFrom, `⏳ *Iniciando Cierre de Caja General.*\n\n💵 ¿Cuánto efectivo físico tienes en *Dólares*?\n(Responde solo con el número, ej: 20 o 0)`);
    
    closureState.timeout = setTimeout(async () => {
        if (closureState.activo) {
            closureState.activo = false;
            await client.sendMessage(msgFrom, `⏰ Tiempo de espera agotado (10 min). Generando cierre automático asumiendo caja física en 0...`);
            await generarCierreDiario(null, 0, 0);
        }
    }, 10 * 60 * 1000);
}

// ====== CIERRE DE CAJA GENERAL (CRM) ======
async function generarCierreDiario(fechaCierreStr = null, realUSD = 0, realBS = 0) {
    try {
        const targetDate = fechaCierreStr || new Date().toISOString().split('T')[0];
        
        // 1. Revisar si ya se cerró
        const qCierre = query(collection(db, 'cierres_caja'), where('fecha', '==', targetDate));
        const snapCierre = await getDocs(qCierre);
        if (!snapCierre.empty) {
            console.log(`⚠️ El cierre para ${targetDate} ya fue realizado.`);
            return;
        }

        // 2. Obtener ventas del día
        const startOfDay = new Date(targetDate + 'T00:00:00');
        const endOfDay = new Date(targetDate + 'T23:59:59');
        const qSales = query(collection(db, 'sales'), where('createdAt', '>=', startOfDay), where('createdAt', '<=', endOfDay));
        const qSalesData = await getDocs(qSales);
        
        const sales = qSalesData.docs.map(doc => doc.data());
        
        if (sales.length === 0) {
            console.log(`⚠️ No hay ventas para el ${targetDate}.`);
            return;
        }

        // 3. Calcular totales
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

        // 4. Obtener tasa desde la colección tasas_bcv
        let tasaCierre = 40.50;
        try {
            const tasasRef = collection(db, 'tasas_bcv');
            const qTasa = query(tasasRef, where('fecha', '==', targetDate));
            const snapTasa = await getDocs(qTasa);
            if (!snapTasa.empty) {
                tasaCierre = snapTasa.docs[0].data().valor;
            } else {
                const allTasas = await getDocs(query(tasasRef));
                if (!allTasas.empty) {
                    const sorted = allTasas.docs.map(d => d.data()).sort((a, b) => b.fecha.localeCompare(a.fecha));
                    tasaCierre = sorted[0].valor;
                }
            }
        } catch (e) {
            console.error('Error obteniendo tasa BCV:', e);
        }

        const difUSD = realUSD - expectedUSDCash;
        const difBS = realBS - expectedBsCash;

        // 5. Guardar el cierre 
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
            observaciones: `Cierre Automático Conversacional. Vueltos: $${totals.vueltos.toFixed(2)}.`,
            cajero_nombre: 'Robot Cajero',
            createdAt: new Date()
        };

        await addDoc(collection(db, 'cierres_caja'), newClosure);

        // 6. Enviar WhatsApp
        if (isReady) {
            const msg = `🧾 *CIERRE DE CAJA DIARIO*\n\nFecha: ${targetDate}\nVentas Totales: $${totals.total_usd.toFixed(2)}\n\n*Cuadre Dólares:*\nEsperado: $${expectedUSDCash.toFixed(2)} | Real: $${realUSD.toFixed(2)}\nDiferencia: $${difUSD.toFixed(2)}\n\n*Cuadre Bolívares:*\nEsperado: Bs ${expectedBsCash.toFixed(2)} | Real: Bs ${realBS.toFixed(2)}\nDiferencia: Bs ${difBS.toFixed(2)}\n\n*Otros Métodos:*\nPago Móvil: Bs ${totals.pago_movil.toFixed(2)}\nTasa Aplicada: ${tasaCierre} BS/USD\n\n_✅ Cierre registrado y cuadrado exitosamente._`;
            await client.sendMessage(numeroAdministrador, msg);
        }
        
        console.log(`✅ Cierre de caja del ${targetDate} generado con éxito.`);
    } catch (e) {
        console.error('❌ Error generando cierre automático:', e);
    }
}

// Cron Job a las 10:00 PM
setInterval(() => {
    const now = new Date();
    if (now.getHours() === 22 && now.getMinutes() === 0) {
        iniciarCierreConversacional(numeroAdministrador);
    }
}, 60000); // Revisa cada 1 minuto

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

    const qCierres = query(collection(db, 'cierres'), where('status', '==', 'pendiente'));
    onSnapshot(qCierres, (snapshot) => {
        snapshot.docChanges().forEach(async (change) => {
            const cierreData = change.doc.data();
            const cierreId = change.doc.id;
            
            if (change.type === 'added' && !cierreData.notificacion_enviada) {
                try {
                    // Marcar como enviado inmediatamente
                    await updateDoc(doc(db, 'cierres', cierreId), { notificacion_enviada: true });
                    
                    const numPedidos = cierreData.pedidos ? cierreData.pedidos.length : 0;
                    const msg = `🚨 *CIERRE DE JORNADA*\n\nRepartidor: ${cierreData.repartidor_nombre || 'Desconocido'}\nTotal a rendir: $${cierreData.total_usd || 0}\nMétodo: ${cierreData.metodo === 'contador' ? 'Efectivo al Contador' : 'Pago Móvil'}\nPedidos: ${numPedidos}\n\nResponde a este chat con la palabra *APROBAR CIERRE ${cierreId.substring(0,4)}* o *RECHAZAR CIERRE ${cierreId.substring(0,4)}*`;
                    
                    if (isReady) {
                        // PRIMERO enviamos el texto para asegurar que llegue
                        await client.sendMessage(numeroAdministrador, msg);
                        
                        // LUEGO intentamos enviar la imagen si existe
                        if (cierreData.metodo === 'pago_movil' && cierreData.captures_pago && cierreData.captures_pago.length > 0) {
                            const capture = cierreData.captures_pago[0];
                            if (capture && capture.includes('base64,')) {
                                try {
                                    const base64Data = capture.split('base64,')[1];
                                    const media = new MessageMedia('image/jpeg', base64Data, 'capture.jpg');
                                    await client.sendMessage(numeroAdministrador, media);
                                } catch (mediaErr) {
                                    console.error('❌ Error enviando la imagen del pago móvil:', mediaErr.message);
                                    await client.sendMessage(numeroAdministrador, `(No se pudo adjuntar el capture del pago móvil automáticamente, el repartidor deberá mostrarlo).`);
                                }
                            }
                        }
                    }
                } catch (err) {
                    console.error('❌ Error procesando nuevo cierre de jornada:', err);
                }
            }
        });
    });
}

// 5. Escuchar respuestas del administrador por WhatsApp para aprobar pagos
client.on('message_create', async msg => {
    let body = msg.body.toUpperCase().trim();

    // FLUJO CONVERSACIONAL DE CIERRE
    if (closureState.activo && msg.from === numeroAdministrador) {
        let num = parseFloat(body);
        if (isNaN(num)) {
            // Ignorar comandos normales si estan activos
            if (body === 'CERRAR TIENDA' || body === 'GENERAR CIERRE') {
                client.sendMessage(msg.from, `⏳ Ya estoy esperando que me des los montos. Dime los Dólares físicos.`);
            } else if (!body.includes('APROBAR')) {
                client.sendMessage(msg.from, `❌ Formato inválido. Por favor, responde solo con números (puedes usar punto para decimales).`);
            }
            return;
        }

        if (closureState.step === 'usd') {
            closureState.usd = num;
            closureState.step = 'bs';
            client.sendMessage(msg.from, `🇻🇪 Entendido. ¿Cuánto efectivo físico tienes en *Bolívares*?\n(Responde solo con el número)`);
            
            // Reiniciar timeout
            clearTimeout(closureState.timeout);
            closureState.timeout = setTimeout(async () => {
                if (closureState.activo) {
                    closureState.activo = false;
                    await client.sendMessage(msg.from, `⏰ Tiempo agotado. Generando cierre asumiendo Bs en 0...`);
                    await generarCierreDiario(null, closureState.usd, 0);
                }
            }, 10 * 60 * 1000);
            return;
        } 
        else if (closureState.step === 'bs') {
            closureState.bs = num;
            closureState.activo = false;
            clearTimeout(closureState.timeout);
            client.sendMessage(msg.from, `✅ ¡Datos recibidos! Cuadrando y guardando cierre en la base de datos...`);
            await generarCierreDiario(null, closureState.usd, closureState.bs);
            return;
        }
    }
    
    // GENERAR CIERRE MANUAL DE LA TIENDA
    if (body === 'CERRAR TIENDA' || body === 'GENERAR CIERRE') {
        iniciarCierreConversacional(msg.from);
        return;
    }
    
    // APROBAR CIERRE DE JORNADA
    if (body.startsWith('APROBAR CIERRE')) {
        let shortId = body.replace('APROBAR CIERRE', '').trim();
        if (shortId.length > 0) {
            const q = query(collection(db, 'cierres'), where('status', '==', 'pendiente'));
            const snap = await getDocs(q);
            let encontrada = false;
            
            snap.forEach(async (docSnapshot) => {
                if (docSnapshot.id.toLowerCase().startsWith(shortId.toLowerCase())) {
                    encontrada = true;
                    const data = docSnapshot.data();
                    
                    // Aprobar cierre
                    await updateDoc(doc(db, 'cierres', docSnapshot.id), { status: 'aprobado' });
                    
                    // Marcar pedidos como entregados
                    if (data.pedidos && data.pedidos.length > 0) {
                        for (const pedidoId of data.pedidos) {
                            await updateDoc(doc(db, 'sales', pedidoId), { 
                                status_pedido: 'entregado',
                                pagada: true
                            });
                        }
                    }
                    
                    client.sendMessage(msg.from, `✅ *CIERRE APROBADO*\nSe ha limpiado la deuda del repartidor ${data.repartidor_nombre}.`);
                }
            });
            if (!encontrada) {
                client.sendMessage(msg.from, `❌ No se encontró ningún cierre pendiente que coincida con el ID *${shortId}*.`);
            }
        }
        return;
    }

    // RECHAZAR CIERRE DE JORNADA
    if (body.startsWith('RECHAZAR CIERRE')) {
        let shortId = body.replace('RECHAZAR CIERRE', '').trim();
        if (shortId.length > 0) {
            const q = query(collection(db, 'cierres'), where('status', '==', 'pendiente'));
            const snap = await getDocs(q);
            let encontrada = false;
            
            snap.forEach(async (docSnapshot) => {
                if (docSnapshot.id.toLowerCase().startsWith(shortId.toLowerCase())) {
                    encontrada = true;
                    await updateDoc(doc(db, 'cierres', docSnapshot.id), { status: 'rechazado' });
                    client.sendMessage(msg.from, `❌ *CIERRE RECHAZADO*`);
                }
            });
            if (!encontrada) {
                client.sendMessage(msg.from, `❌ No se encontró ningún cierre pendiente.`);
            }
        }
        return;
    }

    // APROBAR PEDIDO INDIVIDUAL
    if (body.startsWith('APROBAR') && !body.startsWith('APROBAR CIERRE')) {
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
    } else if (body.startsWith('RECHAZAR') && !body.startsWith('RECHAZAR CIERRE')) {
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
