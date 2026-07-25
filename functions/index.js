const functions = require("firebase-functions/v1");
const admin = require("firebase-admin");
const express = require("express");
const axios = require("axios");

if (!admin.apps.length) {
    admin.initializeApp();
}
const db = admin.firestore();

// Credenciales Meta (Token Permanente)
const META_TOKEN = process.env.META_TOKEN || "";
const META_PHONE_ID = process.env.META_PHONE_ID || "1166867286513063";
const META_VERIFY_TOKEN = process.env.META_VERIFY_TOKEN || "kalu_seguridad_2024";

const NUMERO_ADMIN = "584125782054";

// ==========================================
// ANTISPAM: Protección contra abuso del bot
// ==========================================
const SPAM_WINDOW_MS = 30 * 1000;        // Ventana de 30 segundos
const SPAM_MAX_MESSAGES = 5;             // Máx 5 mensajes por ventana de 30s
const SPAM_COOLDOWN_MS = 2 * 60 * 1000; // Bloqueo temporal: 2 minutos
const SPAM_HACK_THRESHOLD = 15;          // Mensajes para detectar intento de hackeo
const SPAM_BLOCK_DAYS = 7;              // Bloqueo severo: 7 días
const SPAM_DAILY_LIMIT = 20;            // Límite diario de mensajes por número

function getFechaHoyVenezuela() {
    return new Date().toLocaleString('en-CA', { timeZone: 'America/Caracas' }).split(',')[0];
}

async function checkAntispam(from) {
    // El admin nunca es bloqueado
    if (from.includes(NUMERO_ADMIN.replace('58', ''))) return { bloqueado: false };

    const ref = db.collection('antispam').doc(from);
    const snap = await ref.get();
    const now = Date.now();
    const hoy = getFechaHoyVenezuela();

    if (snap.exists) {
        const data = snap.data();

        // Bloqueo severo activo (7 días)
        if (data.bloqueo_severo && data.bloqueo_hasta && data.bloqueo_hasta > now) {
            return { bloqueado: true, severo: true };
        }

        // Cooldown temporal activo (2 minutos por ráfaga)
        if (data.cooldown_hasta && data.cooldown_hasta > now) {
            return { bloqueado: true, severo: false };
        }

        // ── Límite Diario (20 mensajes por día) ────────────────────────────
        const fechaGuardada = data.fecha_dia || '';
        let mensajesHoy = data.mensajes_hoy || 0;

        if (fechaGuardada !== hoy) {
            // Nuevo día: reiniciar el contador diario
            mensajesHoy = 0;
        }

        if (mensajesHoy >= SPAM_DAILY_LIMIT) {
            // Ya superó el límite diario — ignorar silenciosamente salvo primera vez
            const yaAvisado = data.limite_diario_avisado === hoy;
            if (!yaAvisado) {
                await ref.set({ limite_diario_avisado: hoy }, { merge: true });
                return { bloqueado: true, severo: false, limiteDiarioNuevo: true };
            }
            return { bloqueado: true, severo: false };
        }
        // ─────────────────────────────────────────────────────────────────

        // Limpiar ventana expirada y contar mensajes recientes (detección de ráfagas)
        const mensajesEnVentana = (data.timestamps || []).filter(t => (now - t) < SPAM_WINDOW_MS);
        const nuevosMensajesHoy = mensajesHoy + 1;

        // Detectar intento de hackeo (15+ mensajes rápidos en 30 segundos)
        if (mensajesEnVentana.length >= SPAM_HACK_THRESHOLD - 1) {
            const bloqueoHasta = now + (SPAM_BLOCK_DAYS * 24 * 60 * 60 * 1000);
            await ref.set({ bloqueo_severo: true, bloqueo_hasta: bloqueoHasta, timestamps: [], mensajes_hoy: nuevosMensajesHoy, fecha_dia: hoy, ultimo_mensaje: now, razon: 'Intento de hackeo/abuso detectado automaticamente' }, { merge: true });
            await enviarMensajeTexto(NUMERO_ADMIN, `🚨 *ALERTA DE SEGURIDAD*\n\nEl número +${from} ha sido bloqueado automáticamente por 7 días por intento de abuso masivo del bot.\nMensajes enviados: ${mensajesEnVentana.length + 1} en 30 segundos.`);
            return { bloqueado: true, severo: true, bloqueoNuevo: true };
        }

        // Spam normal (5+ mensajes en 30 segundos) → cooldown 2 minutos
        if (mensajesEnVentana.length >= SPAM_MAX_MESSAGES - 1) {
            const cooldownHasta = now + SPAM_COOLDOWN_MS;
            await ref.set({ cooldown_hasta: cooldownHasta, timestamps: [...mensajesEnVentana, now], mensajes_hoy: nuevosMensajesHoy, fecha_dia: hoy, ultimo_mensaje: now }, { merge: true });
            return { bloqueado: true, severo: false, cooldownNuevo: true };
        }

        // Todo normal: actualizar contadores
        await ref.set({ timestamps: [...mensajesEnVentana, now], mensajes_hoy: nuevosMensajesHoy, fecha_dia: hoy, ultimo_mensaje: now, bloqueo_severo: false, cooldown_hasta: 0 }, { merge: true });
        return { bloqueado: false };
    }

    // Primera vez que escribe este número
    await ref.set({ timestamps: [now], mensajes_hoy: 1, fecha_dia: hoy, ultimo_mensaje: now, bloqueo_severo: false, cooldown_hasta: 0 });
    return { bloqueado: false };
}

// ==========================================
// 1. HELPERS: Envío y Descarga por Meta API
// ==========================================

async function descargarAudioWhatsApp(mediaId) {
    try {
        // 1. Obtener la URL del archivo
        const resMedia = await axios({
            method: 'GET',
            url: `https://graph.facebook.com/v21.0/${mediaId}`,
            headers: {
                Authorization: `Bearer ${META_TOKEN}`
            }
        });
        const url = resMedia.data.url;
        const mimeType = resMedia.data.mime_type || "audio/ogg";

        // 2. Descargar el archivo binario
        const resFile = await axios({
            method: 'GET',
            url: url,
            headers: {
                Authorization: `Bearer ${META_TOKEN}`
            },
            responseType: 'arraybuffer'
        });

        // 3. Convertir a Base64
        const base64Data = Buffer.from(resFile.data, 'binary').toString('base64');
        return {
            mimeType: mimeType,
            data: base64Data
        };
    } catch (e) {
        console.error("Error descargando audio de WhatsApp:", e.message);
        return null;
    }
}

async function enviarPlantillaAvisoGeneral(to, textoVariable) {
    if (!textoVariable) return false;
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
                type: "template",
                template: {
                    name: "aviso_general",
                    language: {
                        code: "es"
                    },
                    components: [
                        {
                            type: "body",
                            parameters: [
                                {
                                    type: "text",
                                    text: String(textoVariable)
                                }
                            ]
                        }
                    ]
                }
            }
        });
        return true;
    } catch (err) {
        console.error("❌ Error enviando plantilla aviso_general:", err?.response?.data || err.message);
        return false;
    }
}

async function enviarMensajeTexto(to, text) {
    if (!text) return false;
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
                text: { body: String(text) }
            }
        });
        return true;
    } catch (err) {
        console.error("❌ Error enviando texto:", err?.response?.data || err.message);
        return false;
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


    // NOTA: Se eliminó la inyección de imagen en el header del interactive message
    // porque Meta API es muy estricta con las URLs y bloquea TODO el mensaje (incluyendo los botones)
    // si no puede descargar la imagen. Ahora se envía la imagen por separado.

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
        return true;
    } catch (err) {
        console.error("❌ Error enviando botones:", err?.response?.data || err.message);
        throw err; // Re-lanzar para que el try-catch de afuera ejecute el fallback
    }
}

async function enviarImagen(to, imageUrl, captionText = "") {
    if (!imageUrl || imageUrl.startsWith('data:image')) return false;
    
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
                type: "image",
                image: {
                    link: imageUrl,
                    caption: captionText
                }
            }
        });
        return true;
    } catch (err) {
        console.error("❌ Error enviando imagen individual:", err?.response?.data || err.message);
        return false; // No lanzamos error para que no detenga el flujo
    }
}

function formatearTelefonoWhatsApp(telefonoRaw) {
    if (!telefonoRaw) return '';
    let tel = telefonoRaw.replace(/\D/g, '');
    if (tel.length === 11 && tel.startsWith('0')) return '58' + tel.substring(1);
    if (tel.length === 10) return '58' + tel;
    return tel;
}

function normalizeText(text) {
    if (!text) return "";
    return text.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
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
            // Solo contar como fiado si la venta fue REALMENTE al credito (es_fiado === true)
            // Pedidos del portal con 'pago_al_recibir' tienen saldo_pendiente_usd > 0 pero NO son fiados.
            acc.fiado += sale.es_fiado ? (sale.saldo_pendiente_usd || 0) : 0;
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

// Lógica de Comandos por Inteligencia Artificial para el Admin
async function procesarComandoAdminIA(msgBodyRaw, from) {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
        await enviarMensajeTexto(from, `❌ La IA de Gemini no está configurada en Firebase (Falta GEMINI_API_KEY).`);
        return;
    }
    
    await enviarMensajeTexto(from, `🤖 Analizando tu solicitud...`);

    const { GoogleGenerativeAI } = require("@google/generative-ai");
    const genAI = new GoogleGenerativeAI(apiKey);

    let clientsListStr = "";
    try {
        const snapClients = await db.collection('clients').get();
        const clientNames = [];
        snapClients.forEach(d => {
            if (d.data().nombre) clientNames.push(d.data().nombre);
        });
        clientsListStr = clientNames.join(", ");
    } catch (e) {
        console.error("Error fetching clients for prompt:", e);
    }

    const systemInstruction = `Eres el asistente de inteligencia artificial de Kalu.
El administrador te acaba de dar una instrucción en lenguaje natural por WhatsApp.
Tu tarea es descubrir si quiere enviar un mensaje a un cliente específico, a TODOS los clientes, pedir un reporte de ventas (estado de cuenta), o si no es una instrucción de este tipo.

CLIENTES REGISTRADOS EN EL SISTEMA:
[${clientsListStr}]

Devuelve estrictamente un JSON con esta estructura:
{
  "action": "broadcast" | "message_user" | "report" | "none",
  "target_name": "Nombre de la persona o null",
  "message": "El texto exacto que el administrador quiere que le envíes. No incluyas explicaciones tuyas, solo el mensaje final a enviar.",
  "target_date_start": "YYYY-MM-DDT00:00:00-04:00",
  "target_date_end": "YYYY-MM-DDT23:59:59-04:00"
}
Nota para reportes: HOY es ${new Date().toISOString()}. Calcula las fechas de inicio y fin en base a lo que te pida el administrador.
IMPORTANTE PARA EL CAMPO "target_name": Si la acción es "message_user", debes comparar el nombre que te da el administrador con la lista de CLIENTES REGISTRADOS arriba. Selecciona de la lista el nombre que más se parezca semánticamente (por ejemplo, si te dice "Mariana Natividad", selecciona "maria natividad" si está en la lista) y devuélvelo EXACTAMENTE como aparece escrito en la lista de CLIENTES REGISTRADOS.
Ejemplo 1: "envíale un mensaje a Deisy Corro que actualice su correo electrónico." -> action: "message_user", target_name: "Dersy corro", message: "Hola Dersy corro..."
Ejemplo 2: "Dile a los clientes feliz inicio de semana. CONFIRMO" -> action: "broadcast", target_name: null, message: "¡Feliz inicio de semana..."
IMPORTANTE PARA BROADCAST: Para enviar un broadcast (mensaje masivo), el administrador DEBE incluir la palabra exacta "CONFIRMO" en su solicitud. Si te pide un mensaje para TODOS los clientes pero NO incluye la palabra "CONFIRMO", debes devolver {"action": "none"} para que el sistema lo rechace por seguridad (evitando gastos accidentales).
Ejemplo 3: "Pásame el estado de cuentas de hoy" -> action: "report", target_date_start: "2024-05-10T00:00:00-04:00", target_date_end: "2024-05-10T23:59:59-04:00"
No devuelvas NADA MÁS que el JSON puro.`;

    try {
        const model = genAI.getGenerativeModel({ 
            model: "gemini-2.5-flash",
            systemInstruction: systemInstruction
        });

        const result = await model.generateContent(msgBodyRaw);
        const responseText = result.response.text();
        
        console.log("🤖 Texto crudo devuelto por Gemini:", responseText);

        let parsed = { action: 'none' };
        try {
            parsed = JSON.parse(responseText.replace(/```json/g, '').replace(/```/g, '').trim());
            console.log("✅ JSON interpretado:", parsed);
        } catch(e) {
            console.error("❌ Error parseando JSON de Gemini:", e);
        }

        if (parsed.action === 'none') {
            if (msgBodyRaw.toLowerCase().includes('todos') || msgBodyRaw.toLowerCase().includes('clientes')) {
                await enviarMensajeTexto(from, `⚠️ *ALERTA DE SEGURIDAD* ⚠️\n\nEstás a punto de hacer un envío masivo. Esto usa plantillas de pago y podría tener un costo aproximado de $10 a $25 USD (aprox 4 centavos por cliente).\n\nSi estás *100% seguro* de que quieres hacer este gasto, por favor repite tu orden pero agrega la palabra mágica *CONFIRMO* al final.\n\nEjemplo: *"Dile a todos los clientes que tenemos oferta. CONFIRMO"*`);
            } else {
                await enviarMensajeTexto(from, `❌ No entendí muy bien a quién quieres enviarle el mensaje o qué mensaje es. Por favor especifica mejor (ej: "Dile a Pedro que...").`);
            }
            return;
        }

        if (parsed.action === 'message_user' && parsed.target_name) {
            const textoAEnviar = parsed.message || parsed.mensaje || "";
            if (!textoAEnviar || textoAEnviar.toLowerCase() === 'null') {
                await enviarMensajeTexto(from, `❌ No especificaste el texto del mensaje. Por favor repite la orden diciendo el texto exacto. Ejemplo: "Dile a ${parsed.target_name} que actualice su correo".`);
                return;
            }

            const targetNorm = normalizeText(parsed.target_name);
            const searchWords = targetNorm.split(" ").filter(w => w.trim() !== "");

            const snap = await db.collection('clients').get();
            let encontrado = null;
            snap.forEach(d => {
                const c = d.data();
                if (c.nombre) {
                    const clientNorm = normalizeText(c.nombre);
                    // Match if all search words are present in the client name
                    const isMatch = searchWords.every(word => clientNorm.includes(word));
                    if (isMatch) {
                        encontrado = c;
                    }
                }
            });

            if (encontrado) {
                if (!encontrado.telefono) {
                    await enviarMensajeTexto(from, `❌ Encontré a un cliente llamado "${encontrado.nombre}", pero no tiene un número de teléfono registrado en su perfil.`);
                    return;
                }

                const telFormateado = formatearTelefonoWhatsApp(encontrado.telefono);
                await enviarMensajeTexto(from, `✅ Cliente encontrado: ${encontrado.nombre}. Enviando mensaje...`);
                
                // Intentar mensaje normal primero
                let exito = await enviarMensajeTexto(telFormateado, textoAEnviar);
                
                // Si falla (por regla de 24h), intentar con plantilla de marketing
                if (!exito) {
                    exito = await enviarPlantillaAvisoGeneral(telFormateado, textoAEnviar);
                }

                if (exito) {
                    await enviarMensajeTexto(from, `✅ ¡Mensaje entregado con éxito a ${encontrado.nombre}!`);
                } else {
                    await enviarMensajeTexto(from, `❌ Hubo un error de WhatsApp al enviar el mensaje a ${encontrado.nombre}.`);
                }
            } else {
                await enviarMensajeTexto(from, `❌ Busqué en la base de datos pero no encontré ningún cliente llamado "${parsed.target_name}". Revisa cómo está escrito su nombre.`);
            }
        }

        if (parsed.action === 'broadcast') {
            const textoAEnviar = parsed.message || parsed.mensaje || "";
            if (!textoAEnviar || textoAEnviar.toLowerCase() === 'null') {
                await enviarMensajeTexto(from, `❌ No especificaste el texto del mensaje para enviar a todos.`);
                return;
            }

            const snap = await db.collection('clients').get();
            const clientes = [];
            snap.forEach(d => {
                const c = d.data();
                if (c.telefono) clientes.push(c);
            });

            await enviarMensajeTexto(from, `✅ Entendido. Iniciando envío masivo a ${clientes.length} clientes... (Esto tomará un poco de tiempo para evitar SPAM)`);
            
            let count = 0;
            for (const c of clientes) {
                const telFormateado = formatearTelefonoWhatsApp(c.telefono);
                const exito = await enviarPlantillaAvisoGeneral(telFormateado, textoAEnviar);
                if (exito) count++;
                await new Promise(r => setTimeout(r, 2000)); // 2 segundos delay
            }
            
            await enviarMensajeTexto(from, `✅ ¡Envío masivo finalizado! Se logró entregar el mensaje a ${count} clientes.`);
        }

        if (parsed.action === 'report' && parsed.target_date_start && parsed.target_date_end) {
            await enviarMensajeTexto(from, `📊 Calculando estado de cuenta...`);
            const start = new Date(parsed.target_date_start);
            const end = new Date(parsed.target_date_end);

            const salesSnap = await db.collection('sales')
                .where('createdAt', '>=', start)
                .where('createdAt', '<=', end)
                .get();

            if (salesSnap.empty) {
                await enviarMensajeTexto(from, `ℹ️ No se encontraron ventas registradas para esa fecha.`);
                return;
            }

            let totalUsd = 0;
            let totalBsCash = 0;
            let totalBsPM = 0;
            let fiadoUsd = 0;
            let fiadores = [];

            salesSnap.forEach(doc => {
                const s = doc.data();
                totalUsd += (s.pago_efectivo_usd || 0) - (s.vuelto_entregado_usd || 0);
                totalBsCash += (s.pago_efectivo_bs || 0);
                totalBsPM += (s.pago_movil_bs || 0) + (s.biopago_bdv || 0) + (s.pago_debito_bs || 0);
                
                if (s.saldo_pendiente_usd > 0) {
                    fiadoUsd += s.saldo_pendiente_usd;
                    fiadores.push(`${s.nombre_cliente} ($${s.saldo_pendiente_usd.toFixed(2)})`);
                }
            });

            let msg = `📈 *ESTADO DE CUENTA*\n`;
            msg += `📅 ${start.toLocaleDateString('es-VE')}\n`;
            msg += `Pedidos: ${salesSnap.size}\n\n`;
            msg += `*COBRADO:*\n`;
            msg += `💵 Efectivo USD: $${totalUsd.toFixed(2)}\n`;
            msg += `🇻🇪 Efectivo Bs: Bs ${totalBsCash.toFixed(2)}\n`;
            msg += `📱 Pago Móvil/Bio: Bs ${totalBsPM.toFixed(2)}\n\n`;
            msg += `*DEUDAS (FIADO):*\n`;
            msg += `⚠️ Total Fiado: $${fiadoUsd.toFixed(2)}\n`;
            
            if (fiadores.length > 0) {
                msg += `\n*Clientes con deuda de este periodo:*\n`;
                msg += fiadores.join('\n');
            }

            await enviarMensajeTexto(from, msg);
        }

    } catch (e) {
        console.error("Error en procesarComandoAdminIA:", e);
        await enviarMensajeTexto(from, `❌ Ups, hubo un error interno en mi cerebro de IA conectando con Google Gemini.`);
    }
}

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
            let audioData = null;

            if (message.type === "text") {
                textBody = message.text.body.toUpperCase().trim();
            } else if (message.type === "interactive" && message.interactive.type === "button_reply") {
                textBody = message.interactive.button_reply.id.toUpperCase();
            } else if (message.type === "audio") {
                console.log(`🎤 Nota de voz recibida de ${from}, media ID: ${message.audio.id}`);
                audioData = await descargarAudioWhatsApp(message.audio.id);
            }

            if (textBody || audioData) {
                console.log(`💬 Webhook procesando mensaje de ${from}: ${textBody || '[Audio]'}`);
                await procesarMensajeEntrante(from, textBody, audioData);
            }
        }
        res.status(200).send("EVENT_RECEIVED");
    } catch (e) {
        console.error("Error global en webhook:", e);
        res.status(500).send("ERROR");
    }
});

async function procesarMensajeEntrante(from, body, audioData = null) {
    // ── Verificación Antispam ──────────────────────────────────────────────────
    const spamResult = await checkAntispam(from);
    if (spamResult.bloqueado) {
        if (spamResult.bloqueoNuevo) {
            await enviarMensajeTexto(from, `🚫 *Tu número ha sido BLOQUEADO por ${SPAM_BLOCK_DAYS} días.*\n\nNuestro sistema de seguridad detectó un comportamiento inusual desde tu número. Si crees que esto es un error, comunícate directamente con la tienda Kalu.`);
        } else if (spamResult.limiteDiarioNuevo) {
            await enviarMensajeTexto(from, `⏸️ Has alcanzado el límite de *${SPAM_DAILY_LIMIT} mensajes por hoy*.\n\nPuedes volver a escribirme mañana. Si necesitas algo urgente, comunícate directamente con la tienda Kalu. ¡Hasta luego! 👋`);
        } else if (spamResult.cooldownNuevo) {
            await enviarMensajeTexto(from, `⏳ Estás enviando mensajes muy rápido. Por favor espera 2 minutos antes de continuar.`);
        }
        // Si ya fue notificado anteriormente, simplemente ignorar el mensaje silenciosamente
        return;
    }
    // ─────────────────────────────────────────────────────────────────────────

    const esAdmin = from.includes(NUMERO_ADMIN.replace('58', ''));

    // --- FLUJO DE BOTONES (APROBAR/RECHAZAR) ---
    if (body.startsWith('APROBAR_PEDIDO_') || body === 'APROBAR') {
        let shortId = body.replace('APROBAR_PEDIDO_', '').trim();
        if (body === 'APROBAR') shortId = ''; // Fallback if they just typed APROBAR

        const snap = await db.collection('sales').get();
        let encontrada = false;

        for (const docSnapshot of snap.docs) {
            const data = docSnapshot.data();
            const idMatches = shortId === '' || 
                              (data.codigo_pedido === shortId) || 
                              docSnapshot.id.toLowerCase().startsWith(shortId.toLowerCase());
            
            if (idMatches && data.status_pedido === 'verificando_pago') {
                encontrada = true;
                const nuevoStatus = data.tipo_entrega === 'delivery' ? 'entregado' : 'listo';
                
                const updatePayload = {
                    status_pedido: nuevoStatus,
                    pagada: true,
                    es_fiado: false,
                    saldo_pendiente_usd: 0
                };

                const montoUsd = data.total_usd || 0;
                const tasa = data.tasa_momento || 40.50;
                const montoBs = parseFloat((montoUsd * tasa).toFixed(2));

                const metodo = data.metodo_cobro_driver || data.metodo_pago;

                if (metodo) {
                    if (metodo.includes('pago_movil')) updatePayload.pago_movil_bs = montoBs;
                    else if (metodo.includes('transferencia')) updatePayload.pago_transferencia_bs = montoBs;
                    else if (metodo.includes('zelle')) updatePayload.zelle_usd = montoUsd;
                    else if (metodo === 'efectivo_usd') updatePayload.pago_efectivo_usd = montoUsd;
                    else if (metodo === 'efectivo_bs') updatePayload.pago_efectivo_bs = montoBs;
                    else if (metodo === 'punto_venta') updatePayload.pago_debito_bs = montoBs;
                }
                
                await db.collection('sales').doc(docSnapshot.id).update(updatePayload);
                
                // Deduct from client's saldo_usd if this was a credit (fiado) sale
                if (data.es_fiado && data.client_id) {
                    const clientRef = db.collection('clients').doc(data.client_id);
                    const clientSnap = await clientRef.get();
                    if (clientSnap.exists) {
                        const currentSaldo = clientSnap.data().saldo_usd || 0;
                        const nuevoSaldo = Math.max(0, currentSaldo - montoUsd);
                        await clientRef.update({ saldo_usd: nuevoSaldo });
                    }
                }
                
                await enviarMensajeTexto(from, `✅ Pago aprobado. El pedido de ${data.nombre_cliente} pasó a estado ${nuevoStatus.toUpperCase()} y se registró el pago en la caja.`);
                
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
            const data = docSnapshot.data();
            const idMatches = shortId === '' || 
                              (data.codigo_pedido === shortId) || 
                              docSnapshot.id.toLowerCase().startsWith(shortId.toLowerCase());

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

        // Si es admin y no es ninguno de los flujos anteriores, asumimos que es una instrucción IA
        // Ignoramos si está aprobando o rechazando (ya se procesó arriba)
        if (!body.startsWith('APROBAR') && !body.startsWith('RECHAZAR')) {
             await procesarComandoAdminIA(body, from);
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
Tu objetivo es responder a las consultas de los clientes por WhatsApp, siempre siendo amable, servicial y persuasivo para que hagan pedidos. Puedes responder a cualquier duda general sobre nuestro negocio.

INFORMACIÓN DEL NEGOCIO E HISTORIA:
- Ubicación: San Juan de los Morros, Venezuela.
- Historia: Somos una empresa local emprendedora que está naciendo con mucho esfuerzo, amor y dedicación en medio de la situación económica actual. Si te preguntan por nosotros, habla de manera muy bonita, inspiradora y orgullosa sobre nuestras raíces en San Juan de los Morros y nuestro compromiso de brindar productos de calidad con delivery directo en la localidad para hacerle la vida más fácil a nuestra gente.
- Horario de atención oficial: 6:00 AM a 6:00 PM.
- Delivery: ¡Hacemos delivery en toda la localidad GRATIS a partir de $5 en compras!
- Hora actual del sistema: ${horaActual}
- Link oficial para comprar y ver el catálogo: https://kalu-queso-sanjuam.web.app
- PRODUCTOS DISPONIBLES Y PRECIOS ACTUALES (Dólares):
${inventarioStr || "(No hay productos disponibles por ahora)"}

REGLAS ESTRICTAS Y DE PRIVACIDAD:
1. PRIVACIDAD ABSOLUTA: Tienes PROHIBIDO revelar información personal de cualquier cliente (cédulas, saldos, deudas, teléfonos, correos o nombres de otras personas). Si alguien te pregunta por los datos de otra persona, dile educadamente que por políticas de privacidad no puedes compartir esa información.
2. Sé conciso y directo, es WhatsApp. Usa emojis 🧀🚀.
3. Si te preguntan por productos o precios, SIEMPRE lee la lista de arriba y dale los precios exactos (Ejemplo: "Tenemos Queso Llanero a $X").
4. Si preguntan por el horario o si están abiertos, diles que trabajan de 6 AM a 6 PM.
5. Si el cliente quiere hacer un pedido o comprar, dile que use el portal oficial: https://kalu-queso-sanjuam.web.app (siempre dale este link).
6. Responde preguntas generales (dónde están ubicados, qué venden, etc.) usando la INFORMACIÓN DEL NEGOCIO.
7. No te inventes precios ni productos que no estén en tu lista.
8. Saluda cordialmente si te saludan. Nunca digas que eres una IA de Google, eres Kalu AI.`;

            // 3. Consultar a Gemini (Trunkando textos muy largos para evitar costos o abusos)
            const safeBody = body.length > 500 ? body.substring(0, 500) + ' [Texto truncado por seguridad]' : body;

            const model = genAI.getGenerativeModel({ 
                model: "gemini-2.5-flash",
                systemInstruction: systemPrompt
            });

            const parts = [];
            
            if (audioData && audioData.data) {
                parts.push({
                    text: safeBody ? safeBody : "El cliente envió una nota de voz adjunta. Por favor escúchala y respóndele acorde a su solicitud."
                });
                parts.push({
                    inlineData: {
                        mimeType: audioData.mimeType,
                        data: audioData.data
                    }
                });
            } else {
                parts.push({ text: safeBody });
            }

            const result = await model.generateContent(parts);
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
        const usersSnap = await db.collection('users').where('role', '==', 'repartidor').where('isOnline', '==', true).get();
        const repartidores = usersSnap.docs.map(d => ({ id: d.id, ...d.data() }));
        
        let updateData = {};
        let repElegido = null;
        
        if (repartidores.length > 0) {
            const targetDate = new Date().toLocaleString("en-CA", {timeZone: "America/Caracas"}).split(',')[0];
            const startOfDay = new Date(targetDate + 'T00:00:00-04:00'); 
            
            const ventasHoySnap = await db.collection('sales').where('createdAt', '>=', startOfDay).get();
            const asignaciones = {};
            repartidores.forEach(r => asignaciones[r.id] = 0);
            
            ventasHoySnap.forEach(doc => {
                const s = doc.data();
                if (s.repartidor_id && asignaciones[s.repartidor_id] !== undefined) {
                    asignaciones[s.repartidor_id]++;
                }
            });
            
            repElegido = repartidores[0];
            let minEntregas = asignaciones[repElegido.id];
            
            for (let i = 1; i < repartidores.length; i++) {
                const rep = repartidores[i];
                if (asignaciones[rep.id] < minEntregas) {
                    minEntregas = asignaciones[rep.id];
                    repElegido = rep;
                }
            }
            
            updateData.repartidor_id = repElegido.id;
            updateData.pin_repartidor = Math.floor(1000 + Math.random() * 9000).toString();
        }

        const tieneCapture = (saleData.captures_pago && saleData.captures_pago.length > 0) || saleData.capture_base64;

        if (tieneCapture) {
            updateData.status_pedido = 'verificando_pago';
            updateData.verificacion_solicitada = true; 
        } // Si no tiene capture, se deja como 'pendiente' para que Despacho lo empaque.

        if (Object.keys(updateData).length > 0) {
            await snap.ref.update(updateData);
        }

        // Notificación al repartidor (Removida por WhatsApp, ahora se maneja por notificaciones PWA en el portal)

        // Notificar al admin con capture
        if (tieneCapture) {
            const tasaDelPedido = saleData.tasa_momento || 40.50;
            const totalEnBs = (saleData.total_usd * tasaDelPedido).toFixed(2);
            const shortId = saleData.codigo_pedido || saleId.substring(0, 4);
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

            // Paso 4: Intentar enviar la imagen por separado (si falla, no importa)
            if (captureUrl && !captureUrl.startsWith('data:image')) {
                await enviarImagen(NUMERO_ADMIN, captureUrl, '📸 Capture del pedido #' + shortId);
            } else if (captureUrl && captureUrl.startsWith('data:image')) {
                await enviarMensajeTexto(NUMERO_ADMIN, '⚠️ El capture está en formato local (Base64). Revísalo directamente en el portal web.');
            } else {
                await enviarMensajeTexto(NUMERO_ADMIN, '⚠️ Este pedido no tiene imagen adjunta o hubo un error al subirla.');
            }

            // Paso 5: Enviar SIEMPRE los botones, de forma independiente a la imagen
            try {
                await enviarBotones(NUMERO_ADMIN, '¿Deseas procesar el pedido #' + shortId + '?', 'APROBAR_PEDIDO_' + shortId, 'RECHAZAR_PEDIDO_' + shortId);
            } catch (e) {
                console.error('Error enviando botones al admin:', e?.response?.data || e.message);
                await enviarMensajeTexto(NUMERO_ADMIN, '⚠️ Hubo un error de conexión con WhatsApp. Escribe APROBAR o RECHAZAR para procesar el pedido #' + shortId);
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
        const shortId = newData.codigo_pedido || saleId.substring(0, 4);
        
        let msgDueño = `🚨 *PAGO PENDIENTE DE VERIFICAR*\n\nPedido #${saleId}\nCliente: ${newData.nombre_cliente}\nTotal: Bs ${totalEnBs}`;

        let captureUrl = newData.capture_base64 || (newData.captures_pago && newData.captures_pago[0]);

        // Enviar imagen si existe
        if (captureUrl && captureUrl.startsWith('data:image')) {
            msgDueño += `\n\n*Aviso:* Captura en formato local. Revísala en el Portal Web.`;
        } else if (captureUrl) {
            await enviarImagen(NUMERO_ADMIN, captureUrl, '📸 Capture actualizado (Pedido #' + shortId + ')');
        }

        // Siempre enviar los botones al final
        try {
            await enviarBotones(NUMERO_ADMIN, msgDueño, `APROBAR_PEDIDO_${shortId}`, `RECHAZAR_PEDIDO_${shortId}`);
        } catch (e) {
            console.error('Error enviando botones al admin en update:', e?.response?.data || e.message);
            await enviarMensajeTexto(NUMERO_ADMIN, msgDueño + '\n\n⚠️ Escribe APROBAR o RECHAZAR para procesar el pedido #' + shortId);
        }

        // Aviso al repartidor de pago pendiente (Removido por WhatsApp)
    }

    // Aviso al repartidor de pedido asignado manualmente (Removido por WhatsApp, manejado por PWA)
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
        const shortId = data.codigo_pedido || saleId.substring(0, 4);
        const cap = data.capture_base64 || (data.captures_pago && data.captures_pago[0]);

        let capType = 'Ninguno';
        if (cap && cap.startsWith('https://')) capType = 'URL Storage ✅';
        else if (cap && cap.startsWith('data:')) capType = 'Base64 ❌';

        const msg = '🧪 *TEST NOTIFICACIÓN*\n\nPedido #' + saleId + '\nCliente: ' + data.nombre_cliente + '\nCapture tipo: ' + capType + '\n\nSi ves este mensaje, el bot SÍ puede enviarte notificaciones proactivas. ✅';

        if (cap && cap.startsWith('https://')) {
            await enviarImagen(NUMERO_ADMIN, cap, '📸 Imagen de Test');
        } 
        
        await enviarBotones(NUMERO_ADMIN, msg, 'APROBAR_PEDIDO_' + shortId, 'RECHAZAR_PEDIDO_' + shortId);

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

// ==========================================
// CRON AUTOMÁTICO DE TASA BCV
// ==========================================
// Se ejecuta automáticamente a las 3:30 PM y 9:00 AM hora Caracas.
// El BCV publica la tasa oficial entre 2-4pm los días hábiles.
// Así la app la muestra actualizada sin que nadie tenga que presionar nada.

exports.sincronizarTasaBcvCron = functions.pubsub.schedule('30 15 * * 1-5')
  .timeZone('America/Caracas')
  .onRun(async (context) => {
    const today = new Date().toLocaleString('en-CA', { timeZone: 'America/Caracas' }).split(',')[0];
    let rate = null;
    let fuente = '';

    try {
      const axios = require('axios');
      const resp = await axios.get('https://rates.dolarvzla.com/bcv/current.json', { timeout: 8000 });
      rate = resp.data?.current?.usd ?? null;
      fuente = 'dolarvzla.com';
    } catch (e) {
      console.warn('dolarvzla.com falló en cron:', e.message);
    }

    if (!rate) {
      try {
        const axios = require('axios');
        const resp = await axios.get('https://ve.dolarapi.com/v1/dolares/oficial', { timeout: 8000 });
        rate = resp.data?.promedio ?? resp.data?.venta ?? null;
        fuente = 've.dolarapi.com';
      } catch (e) {
        console.warn('ve.dolarapi.com falló en cron:', e.message);
        return null;
      }
    }

    if (!rate || rate <= 0) {
      console.warn('Cron tasa BCV: no se obtuvo tasa válida');
      return null;
    }

    const rateNum = parseFloat(parseFloat(rate).toFixed(4));
    await db.collection('tasas_bcv').doc(today).set({
      id: `tasa-${today}`,
      fecha: today,
      valor: rateNum,
      fuente: `BCV (Oficial) — ${fuente}`,
      estatus: 'Sincronizada',
      sincronizadoEn: admin.firestore.FieldValue.serverTimestamp()
    });

    console.log(`✅ Cron tasa BCV: ${rateNum} Bs/USD guardada para ${today} desde ${fuente}`);
    return null;
  });

// Backup a las 9:00 AM (por si el día anterior no se sincronizó)
exports.sincronizarTasaBcvManana = functions.pubsub.schedule('0 9 * * 1-5')
  .timeZone('America/Caracas')
  .onRun(async (context) => {
    const today = new Date().toLocaleString('en-CA', { timeZone: 'America/Caracas' }).split(',')[0];
    
    // Solo actualizar si no hay tasa para hoy aún
    const existing = await db.collection('tasas_bcv').doc(today).get();
    if (existing.exists) {
      console.log(`Cron mañana: ya existe tasa para ${today}, saltando.`);
      return null;
    }

    let rate = null;
    let fuente = '';
    try {
      const axios = require('axios');
      const resp = await axios.get('https://rates.dolarvzla.com/bcv/current.json', { timeout: 8000 });
      rate = resp.data?.current?.usd ?? null;
      fuente = 'dolarvzla.com';
    } catch (e) { /* silenciar */ }

    if (!rate) {
      try {
        const axios = require('axios');
        const resp = await axios.get('https://ve.dolarapi.com/v1/dolares/oficial', { timeout: 8000 });
        rate = resp.data?.promedio ?? resp.data?.venta ?? null;
        fuente = 've.dolarapi.com';
      } catch (e) { return null; }
    }

    if (!rate || rate <= 0) return null;

    const rateNum = parseFloat(parseFloat(rate).toFixed(4));
    await db.collection('tasas_bcv').doc(today).set({
      id: `tasa-${today}`,
      fecha: today,
      valor: rateNum,
      fuente: `BCV (Oficial) — ${fuente}`,
      estatus: 'Sincronizada',
      sincronizadoEn: admin.firestore.FieldValue.serverTimestamp()
    });
    console.log(`✅ Cron mañana tasa BCV: ${rateNum} Bs/USD para ${today}`);
    return null;
  });




// ==========================================
// PROXY BCV — Evita CORS desde el Frontend
// ==========================================
// Esta función actúa como intermediario entre el frontend (hosting) y la API del BCV.
// El navegador NO puede llamar a ve.dolarapi.com directamente por restricciones CORS.
// Esta Cloud Function sí puede, ya que corre en el servidor de Google.
//
// Uso desde el frontend: GET /api/bcv-rate
// Respuesta: { rate: 622.21, fecha: "2026-07-06", fuente: "ve.dolarapi.com" }

exports.debugTasas = functions.https.onRequest(async (req, res) => {
    cors(req, res, async () => {
        try {
            const snapshot = await db.collection('tasas_bcv').get();
            const docs = [];
            snapshot.forEach(doc => docs.push({ id: doc.id, ...doc.data() }));
            res.json(docs);
        } catch (e) {
            res.status(500).json({ error: e.message });
        }
    });
});

exports.cleanTasas = functions.https.onRequest(async (req, res) => {
    try {
        const snapshot = await db.collection('tasas_bcv').get();
        let deleted = [];
        let docs = [];
        snapshot.forEach(doc => {
            const data = doc.data();
            docs.push(data);
            if (data.valor === 476 || data.fecha > '2026-07-22') {
                doc.ref.delete();
                deleted.push(data);
            }
        });
        res.status(200).json({ deleted, allDocs: docs });
    } catch (e) {
        res.status(500).send(e.message);
    }
});

exports.getBcvRate = functions.https.onRequest(async (req, res) => {
    res.set('Access-Control-Allow-Origin', '*');
    res.set('Access-Control-Allow-Methods', 'GET');
    
    const force = req.query.force === 'true';
    if (force) {
        res.set('Cache-Control', 'no-cache, no-store, must-revalidate');
    } else {
        res.set('Cache-Control', 'public, max-age=3600'); // Cache 1 hora
    }

    if (req.method === 'OPTIONS') {
        res.status(204).send('');
        return;
    }

    const today = new Date().toLocaleString('en-CA', { timeZone: 'America/Caracas' }).split(',')[0];

    // 1. Intentar leer del caché de Firestore (para no llamar la API externa en cada click)
    if (!force) {
        try {
            const cached = await db.collection('tasas_bcv').doc(today).get();
            if (cached.exists && cached.data().valor > 0) {
                const data = cached.data();
                return res.json({
                    rate: data.valor,
                    fecha: today,
                    fuente: data.fuente || 've.dolarapi.com',
                    fromCache: true
                });
            }
        } catch (cacheErr) {
            console.warn('No se pudo leer caché Firestore:', cacheErr.message);
        }
    }

    // 2. Llamar a las APIs externas (empezando por la más confiable: dolarvzla)
    let rate = null;
    let fuente = '';

    try {
        const resp = await axios.get('https://rates.dolarvzla.com/bcv/current.json', { timeout: 8000 });
        const json = resp.data;
        rate = json?.current?.usd ?? null;
        fuente = 'dolarvzla.com';
        console.log('✅ Tasa BCV obtenida de dolarvzla.com:', rate);
    } catch (e) {
        console.warn('❌ dolarvzla.com falló:', e.message);
    }

    if (!rate) {
        try {
            const resp = await axios.get('https://ve.dolarapi.com/v1/dolares/oficial', { timeout: 8000 });
            const json = resp.data;
            rate = json.promedio ?? json.venta ?? null;
            fuente = 've.dolarapi.com';
            console.log('✅ Tasa BCV obtenida de ve.dolarapi.com:', rate);
        } catch (e) {
            console.warn('❌ ve.dolarapi.com falló:', e.message);
        }
    }

    if (!rate || rate <= 0) {
        return res.status(503).json({ error: 'No se pudo obtener la tasa BCV. Intente de nuevo más tarde.' });
    }

    const rateNum = parseFloat(parseFloat(rate).toFixed(4));

    // 4. Guardar en Firestore para cachear
    try {
        await db.collection('tasas_bcv').doc(today).set({
            id: `tasa-${today}`,
            fecha: today,
            valor: rateNum,
            fuente: `BCV (Oficial) — ${fuente}`,
            estatus: 'Sincronizada',
            sincronizadoEn: admin.firestore.FieldValue.serverTimestamp()
        });
    } catch (saveErr) {
        console.warn('No se pudo guardar en Firestore:', saveErr.message);
    }

    return res.json({ rate: rateNum, fecha: today, fuente });
});

// Endpoint seguro para buscar cliente sin estar autenticado (Olvidó su Clave)
exports.buscarCliente = functions.https.onRequest(async (req, res) => {
    res.set('Access-Control-Allow-Origin', '*');
    res.set('Access-Control-Allow-Methods', 'GET');

    if (req.method === 'OPTIONS') {
        res.status(204).send('');
        return;
    }

    try {
        const { type, value } = req.query;
        if (!type || !value) {
            return res.status(400).json({ error: "Faltan parámetros 'type' o 'value'" });
        }

        const clientsRef = db.collection('clients');
        let query;

        const val = String(value).trim();

        if (type === 'cedula') {
            query = clientsRef.where('cedula', '==', val);
        } else if (type === 'email') {
            query = clientsRef.where('email', '==', val.toLowerCase());
        } else if (type === 'phone') {
            query = clientsRef.where('telefono', '==', val);
        } else {
            return res.status(400).json({ error: "Tipo de búsqueda inválido" });
        }

        const snapshot = await query.limit(1).get();
        if (snapshot.empty) {
            return res.json({ exists: false });
        }

        const docSnap = snapshot.docs[0];
        const data = docSnap.data();
        const clientId = docSnap.id;

        // Obtener el correo de autenticación correcto desde la colección 'users'
        let loginEmail = data.email || '';
        try {
            const userDoc = await db.collection('users').doc(clientId).get();
            if (userDoc.exists && userDoc.data().email) {
                loginEmail = userDoc.data().email;
            }
        } catch (err) {
            console.warn("No se pudo obtener el user doc para loginEmail:", err.message);
        }

        // Si sigue sin correo de autenticación, usar cédula legacy
        if (!loginEmail) {
            const cleanCedula = String(data.cedula || '').replace(/[^a-zA-Z0-9]/g, '').toLowerCase();
            loginEmail = `${cleanCedula}@kalu.app`;
        }

        return res.json({
            exists: true,
            client: {
                id: clientId,
                nombre: data.nombre || 'N/A',
                cedula: data.cedula || 'N/A',
                email: data.email || 'N/A',
                telefono: data.telefono || 'N/A',
                loginEmail: loginEmail
            }
        });
    } catch (e) {
        console.error("❌ Error en buscarCliente:", e);
        return res.status(500).json({ error: "Error interno del servidor: " + e.message });
    }
});


// ==========================================
// 5. EXPRESS APP: WEBHOOK BANCARIO (Estructura Inicial)
// ==========================================
// Nota: Firebase Cloud Functions proporciona HTTPS/SSL de manera automática.
const appBank = express();
appBank.use(express.json());

// Endpoint principal para recibir notificaciones del banco (Pagos Móviles, Transferencias)
appBank.post("/bank-payment", async (req, res) => {
    try {
        const signature = req.headers['x-bank-signature'] || req.headers['authorization'];
        const body = req.body;
        
        console.log("💰 [WEBHOOK BANCO] Recibida notificación:", JSON.stringify(body));
        
        // TODO: 1. Validar la firma HMAC o Token del banco (Seguridad SSL/HTTPS asegurada por Firebase)
        // if (!validarFirma(signature, body)) return res.status(401).send("No autorizado");

        // TODO: 2. Extraer datos del pago (Referencia, Cédula/Teléfono emisor, Monto, Fecha)
        // const ref = body.referencia;
        // const montoBs = body.monto;
        // const cedulaOrigen = body.cedula_origen;

        // TODO: 3. Buscar en la base de datos ('sales') si existe un pedido en 'verificando_pago' 
        // con ese monto exacto y de ese cliente (o buscar la referencia si el cliente la ingresó previamente).
        /*
        const snapshot = await db.collection('sales')
            .where('status_pedido', '==', 'verificando_pago')
            .where('total_bs', '==', montoBs)
            .get();
        */

        // TODO: 4. Si coincide, aprobar el pago automáticamente y notificar al Cajero/Admin:
        // await db.collection('sales').doc(pedidoId).update({ status_pedido: 'listo', pagada: true });
        
        res.status(200).json({ status: "success", message: "Pago recibido (Estructura base activa)" });
    } catch (e) {
        console.error("❌ Error procesando webhook bancario:", e);
        res.status(500).json({ status: "error", message: "Error interno del servidor" });
    }
});

// Exportar el Webhook Bancario
exports.bankWebhook = functions.https.onRequest(appBank);

// Escuchar solicitudes de recuperación de clave y tramitarlas por el robot automáticamente
exports.onRecuperacionCreate = functions.firestore
    .document("recuperaciones/{id}")
    .onCreate(async (snap, context) => {
        const data = snap.data();
        if (!data.clientId) return;

        try {
            // 1. Buscar el PIN en la base de datos
            let pin = "";
            const userDoc = await db.collection("users").doc(data.clientId).get();
            if (userDoc.exists && userDoc.data().pin) {
                pin = userDoc.data().pin;
            } else {
                // Try finding a linked user document where clientId matches
                const linkedUserSnap = await db.collection("users").where("clientId", "==", data.clientId).limit(1).get();
                if (!linkedUserSnap.empty && linkedUserSnap.docs[0].data().pin) {
                    pin = linkedUserSnap.docs[0].data().pin;
                } else {
                    const clientDoc = await db.collection("clients").doc(data.clientId).get();
                    if (clientDoc.exists && clientDoc.data().pin) {
                        pin = clientDoc.data().pin;
                    }
                }
            }

            if (pin) {
                // 2. Formatear teléfono y construir mensaje para el cliente
                const telFormateado = formatearTelefonoWhatsApp(data.telefono);
                
                let msgCliente = `Hola, *${data.nombre}* 👋. Recibimos tu solicitud para recuperar tu clave de Kalu.\n\n`;
                if (data.metodo_envio === 'whatsapp') {
                    msgCliente += `Aquí tienes tu PIN de seguridad de 6 dígitos actual: *${pin}*\n\n`;
                } else if (data.metodo_envio === 'sms') {
                    msgCliente += `Solicitaste recibir tu clave por SMS. Por comodidad y seguridad, te la enviamos directamente por esta vía. Tu PIN es: *${pin}*\n\n`;
                } else {
                    msgCliente += `Solicitaste recibir tu clave por correo electrónico. Para tu comodidad y rapidez, te la compartimos directamente por acá. Tu PIN es: *${pin}*\n\n`;
                }
                msgCliente += `Ingresa a la aplicación utilizando este PIN para continuar con tus pedidos. ¡Gracias por preferirnos!`;

                // 3. Enviar mensaje al cliente
                await enviarMensajeTexto(telFormateado, msgCliente);

                // 4. Notificar al administrador que fue resuelto automáticamente
                const msgAdmin = `🤖 *RECUPERACIÓN AUTOMÁTICA DE PIN*\n\n` +
                                 `👤 *Cliente:* ${data.nombre || 'N/A'}\n` +
                                 `🆔 *Cédula:* ${data.cedula || 'N/A'}\n` +
                                 `📲 *Medio solicitado:* ${data.metodo_envio.toUpperCase()}\n` +
                                 `✅ *Estado:* Enviado con éxito al WhatsApp +${telFormateado} automáticamente por el robot.`;
                await enviarMensajeTexto(NUMERO_ADMIN, msgAdmin);
            } else {
                // Si no se encontró el PIN, avisar al administrador para soporte manual
                const msgAdmin = `🚨 *RECUPERACIÓN FALLIDA (SOPORTE MANUAL REQUERIDO)*\n\n` +
                                 `👤 *Cliente:* ${data.nombre || 'N/A'}\n` +
                                 `🆔 *Cédula:* ${data.cedula || 'N/A'}\n` +
                                 `❌ *Error:* No se encontró el PIN para el usuario con ID ${data.clientId} en Firestore. Por favor contacta al cliente manualmente al +${data.telefono}.`;
                await enviarMensajeTexto(NUMERO_ADMIN, msgAdmin);
            }
        } catch (err) {
            console.error("Error procesando recuperación automática:", err);
            const msgAdmin = `🚨 *ERROR EN RECUPERACIÓN AUTOMÁTICA*\n\n` +
                             `👤 *Cliente:* ${data.nombre || 'N/A'}\n` +
                             `❌ *Error:* ${err.message}\n` +
                             `Por favor atiende la solicitud manualmente.`;
            await enviarMensajeTexto(NUMERO_ADMIN, msgAdmin);
        }
    });

exports.fixEmails = functions.https.onRequest(async (req, res) => {
    try {
        const listUsersResult = await admin.auth().listUsers();
        let fixedCount = 0;
        
        for (const userRecord of listUsersResult.users) {
            const uid = userRecord.uid;
            const authEmail = userRecord.email;
            
            if (authEmail) {
                const userDoc = await db.collection('users').doc(uid).get();
                if (userDoc.exists) {
                    const storedEmail = userDoc.data().email;
                    if (storedEmail !== authEmail) {
                        await db.collection('users').doc(uid).update({ email: authEmail });
                        fixedCount++;
                    }
                }
            }
        }
        res.json({ success: true, fixedCount });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

exports.findOrphans = functions.https.onRequest(async (req, res) => {
    try {
        const listUsersResult = await admin.auth().listUsers(1000);
        let orphans = [];
        
        for (const userRecord of listUsersResult.users) {
            const uid = userRecord.uid;
            
            const userDoc = await db.collection('users').doc(uid).get();
            const clientDoc = await db.collection('clients').doc(uid).get();
            
            if (!userDoc.exists && !clientDoc.exists) {
                orphans.push({
                    uid: uid,
                    email: userRecord.email,
                    displayName: userRecord.displayName,
                    creationTime: userRecord.metadata.creationTime
                });
            }
        }
        res.json({ success: true, orphansCount: orphans.length, orphans });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

exports.deleteOrphan = functions.https.onRequest(async (req, res) => {
    try {
        const email = req.query.email;
        if (!email) return res.status(400).json({ error: 'Falta email' });
        
        const userRecord = await admin.auth().getUserByEmail(email);
        await admin.auth().deleteUser(userRecord.uid);
        
        res.json({ success: true, message: `Usuario ${email} eliminado correctamente.` });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

exports.wipeAllClients = functions.https.onRequest(async (req, res) => {
    try {
        let listUsersResult;
        let pageToken;
        let deletedAuthCount = 0;
        
        do {
            listUsersResult = await admin.auth().listUsers(1000, pageToken);
            const uids = listUsersResult.users.map(u => u.uid);
            if (uids.length > 0) {
                await admin.auth().deleteUsers(uids);
                deletedAuthCount += uids.length;
            }
            pageToken = listUsersResult.pageToken;
        } while (pageToken);
        
        let deletedClientsCount = 0;
        const clientsSnapshot = await db.collection('clients').get();
        if (!clientsSnapshot.empty) {
            const batchClients = db.batch();
            clientsSnapshot.forEach(doc => {
                batchClients.delete(doc.ref);
                deletedClientsCount++;
            });
            await batchClients.commit();
        }

        let deletedUsersCount = 0;
        const usersSnapshot = await db.collection('users').get();
        if (!usersSnapshot.empty) {
            const batchUsers = db.batch();
            usersSnapshot.forEach(doc => {
                batchUsers.delete(doc.ref);
                deletedUsersCount++;
            });
            await batchUsers.commit();
        }

        res.json({ 
            success: true, 
            message: `Wipe completado. Auth: ${deletedAuthCount}, Clients: ${deletedClientsCount}, Users: ${deletedUsersCount}`
        });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

exports.createAdmin = functions.https.onRequest(async (req, res) => {
    try {
        const pin = "123456";
        const email = "dominguezcontrucciones2012@gmail.com";
        const cedula = "admin";
        
        // 1. Borrar admin_master antiguo si existe
        try {
            await db.collection('users').doc('admin_master').delete();
        } catch(e) {}
        
        let uid;
        try {
            const userRecord = await admin.auth().getUserByEmail(email);
            uid = userRecord.uid;
        } catch (error) {
            // Si no existe, lo creamos
            const newUser = await admin.auth().createUser({
                email: email,
                password: "KaluPassword123!",
                displayName: "Admin Dominguez"
            });
            uid = newUser.uid;
        }

        // 2. Crear el documento de usuario administrador
        await db.collection('users').doc(uid).set({
            username: 'Domínguez Construcciones',
            role: 'dueno',
            pin: pin,
            cedula: cedula,
            email: email,
            telefono: '',
            createdAt: admin.firestore.FieldValue.serverTimestamp()
        });

        res.json({ 
            success: true, 
            message: `¡Usuario Administrador Creado Exitosamente!`, 
            email: email, 
            pin: pin, 
            cedula: cedula 
        });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

exports.getUserRole = functions.https.onRequest(async (req, res) => {
    res.set('Access-Control-Allow-Origin', '*');
    res.set('Access-Control-Allow-Methods', 'GET');
    
    if (req.method === 'OPTIONS') {
        res.status(204).send('');
        return;
    }

    try {
        const uid = req.query.uid;
        if (!uid) {
            return res.status(400).json({ error: "Missing uid" });
        }
        
        const doc = await admin.firestore().collection('users').doc(uid).get();
        if (!doc.exists) {
            let queries = [];
            queries.push(admin.firestore().collection('users').where('clientId', '==', uid).get());
            
            const cedula = req.query.cedula;
            if (cedula) {
                queries.push(admin.firestore().collection('users').where('cedula', '==', cedula).get());
            }
            
            const email = req.query.email;
            if (email) {
                queries.push(admin.firestore().collection('users').where('email', '==', email).get());
            }

            const results = await Promise.all(queries);
            for (const q of results) {
                if (!q.empty) {
                    return res.json({ role: q.docs[0].data().role || 'cliente' });
                }
            }
            
            return res.status(404).json({ error: "User not found" });
        }
        
        res.json({ role: doc.data().role || 'cliente' });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});
