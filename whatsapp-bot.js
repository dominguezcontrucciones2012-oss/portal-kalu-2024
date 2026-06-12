import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import pkg from 'whatsapp-web.js';
const { Client, LocalAuth } = pkg;
import qrcode from 'qrcode-terminal';
import { initializeApp } from 'firebase/app';
import { getFirestore, collection, onSnapshot } from 'firebase/firestore';

// Leer configuración de Firebase
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const firebaseConfigPath = path.join(__dirname, 'firebase-applet-config.json');
let firebaseConfig;
try {
  firebaseConfig = JSON.parse(fs.readFileSync(firebaseConfigPath, 'utf8'));
} catch (e) {
  console.error("❌ No se encontró firebase-applet-config.json");
  process.exit(1);
}

const app = initializeApp(firebaseConfig);
const db = getFirestore(app, firebaseConfig.firestoreDatabaseId);

// Archivo de memoria para no enviar mensajes duplicados
const memoryFile = path.join(__dirname, 'bot-memory.json');
let memory = [];
if (fs.existsSync(memoryFile)) {
  try {
    memory = JSON.parse(fs.readFileSync(memoryFile, 'utf8'));
  } catch (e) {}
}

const saveMemory = () => {
  fs.writeFileSync(memoryFile, JSON.stringify(memory, null, 2));
};

console.log("Iniciando motor de WhatsApp...");

const client = new Client({
  authStrategy: new LocalAuth(), // Guarda la sesión para no escanear QR cada vez
  puppeteer: {
    headless: false, // Cambiado a false para que podamos ver si el navegador abre o qué error da
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  }
});

client.on('qr', (qr) => {
  console.log('===================================================');
  console.log('ESCANEA ESTE CÓDIGO QR CON TU WHATSAPP (Dispositivos Vinculados):');
  console.log('===================================================');
  qrcode.generate(qr, { small: true });
});

client.on('ready', () => {
  console.log('✅ WhatsApp conectado y listo para enviar mensajes.');
  startFirebaseListener();
});

client.on('auth_failure', msg => {
  console.error('❌ Fallo en la autenticación de WhatsApp:', msg);
});

client.on('disconnected', (reason) => {
  console.log('⚠️ WhatsApp fue desconectado:', reason);
});

client.initialize().catch(err => {
  console.error('❌ ERROR GRAVE al iniciar el motor:', err);
});

let isFirstLoad = true;

const formatPhoneNumber = (phone) => {
  if (!phone) return null;
  // Quitar espacios, guiones, paréntesis
  let cleaned = phone.replace(/\D/g, '');
  
  // Si empieza por 04 (ej 0414, 0424, 0412, 0416, 0426)
  if (cleaned.startsWith('04') && cleaned.length === 11) {
    cleaned = '58' + cleaned.substring(1);
  }
  
  // Si ya tiene el 58 no hacemos nada, si no lo tiene y tiene 10 digitos asumiendo venezuela...
  if (cleaned.length === 10 && cleaned.startsWith('4')) {
    cleaned = '58' + cleaned;
  }

  return cleaned + '@c.us'; // Formato de whatsapp-web.js
};

const sendWelcomeMessage = async (cliente) => {
  const number = formatPhoneNumber(cliente.telefono);
  if (!number) {
    console.log(`[INFO] Cliente ${cliente.nombre} no tiene un teléfono válido. Omitiendo.`);
    // Guardar en memoria de todas formas para no volver a intentarlo cada vez que se inicie
    memory.push(cliente.id);
    saveMemory();
    return;
  }

  const mensaje = `¡Hola *${cliente.nombre}*! 👋 Bienvenido a Kalu Quesos.\n\nYa estás registrado en nuestro sistema. Desde aquí podrás hacer tus pedidos y consultar tus pagos.\n\n¡Estamos a la orden para cualquier duda!`;

  try {
    console.log(`Intentando enviar mensaje a ${cliente.nombre} (${number})...`);
    await client.sendMessage(number, mensaje);
    console.log(`✅ Mensaje enviado con éxito a ${cliente.nombre}`);
    
    // Guardar en memoria
    memory.push(cliente.id);
    saveMemory();
  } catch (error) {
    console.error(`❌ Error al enviar mensaje a ${cliente.nombre}:`, error);
  }
};

let firstLoadClients = true;
let firstLoadUsers = true;

const startFirebaseListener = () => {
  console.log('📡 Conectando a Firebase... Escuchando nuevos registros.');
  
  const handleSnapshot = (snapshot, collectionName) => {
    snapshot.docChanges().forEach((change) => {
      const data = change.doc.data();
      const id = change.doc.id;
      // Some use 'nombre', others 'username' or 'displayName'
      const name = data.nombre || data.username || data.displayName || 'Cliente';
      const cliente = { id, ...data, nombre: name };

      if (change.type === 'added') {
        const isInitialLoad = (collectionName === 'clients' && firstLoadClients) || (collectionName === 'users' && firstLoadUsers);
        
        if (!isInitialLoad) {
          if (!memory.includes(id)) {
            console.log(`🎉 ¡Nuevo registro detectado en ${collectionName}!: ${cliente.nombre}`);
            sendWelcomeMessage(cliente);
          }
        } else {
          if (!memory.includes(id)) {
             memory.push(id);
          }
        }
      }
    });
    
    if (collectionName === 'clients' && firstLoadClients) {
      firstLoadClients = false;
      saveMemory();
    }
    if (collectionName === 'users' && firstLoadUsers) {
      firstLoadUsers = false;
      saveMemory();
      console.log(`✅ Base de datos sincronizada al 100%. ${memory.length} usuarios en memoria.`);
    }
  };

  const clientsRef = collection(db, 'clients');
  const usersRef = collection(db, 'users');
  
  onSnapshot(clientsRef, (s) => handleSnapshot(s, 'clients'), (error) => console.error('❌ Error escuchando clients:', error));
  onSnapshot(usersRef, (s) => handleSnapshot(s, 'users'), (error) => console.error('❌ Error escuchando users:', error));
};
