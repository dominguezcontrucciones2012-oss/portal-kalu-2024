const { initializeApp, cert } = require('firebase-admin/app');
const { getFirestore } = require('firebase-admin/firestore');
const { getAuth } = require('firebase-admin/auth');
const fs = require('fs');

// Inicializar app de Firebase Admin
const serviceAccountPath = './service-account.json';
if (!fs.existsSync(serviceAccountPath)) {
  console.error(`ERROR: No se encontró la llave de Firebase Admin.`);
  process.exit(1);
}

const serviceAccount = JSON.parse(fs.readFileSync(serviceAccountPath, 'utf8'));

initializeApp({
  credential: cert(serviceAccount)
});

const db = getFirestore();
const auth = getAuth();

async function runMigration() {
  console.log("Iniciando migración de usuarios a Firebase Auth...");
  const usersSnapshot = await db.collection('users').get();
  
  let migratedCount = 0;
  let errorCount = 0;
  let skippedCount = 0;

  for (const doc of usersSnapshot.docs) {
    const user = doc.data();
    
    // Si el usuario no tiene PIN de 4 dígitos o cédula, no podemos migrarlo fácilmente
    if (!user.pin || !user.cedula) {
      console.log(`[SKIPPED] Usuario ${doc.id} no tiene PIN o Cédula.`);
      skippedCount++;
      continue;
    }

    // Formatear cédula para usarla como correo si no existe un correo
    const formattedCedula = user.cedula.replace(/[^a-zA-Z0-9]/g, '').toLowerCase();
    const fallbackEmail = `${formattedCedula}@kalu.app`;
    const emailToUse = user.email || fallbackEmail;
    
    // Generar nuevo PIN de 6 dígitos (agregando "00" al final del PIN de 4 dígitos)
    let newPin = String(user.pin);
    if (newPin.length === 4) {
      newPin = newPin + "00";
    }

    try {
      // Verificar si ya existe en Firebase Auth
      let authRecord;
      try {
        authRecord = await auth.getUserByEmail(emailToUse);
        console.log(`[EXISTE] El usuario con correo ${emailToUse} ya está en Firebase Auth.`);
      } catch (err) {
        if (err.code === 'auth/user-not-found') {
          // No existe, lo creamos
          authRecord = await auth.createUser({
            uid: doc.id,
            email: emailToUse,
            password: newPin,
            displayName: user.username || user.nombre || 'Usuario Kalu',
          });
          console.log(`[CREADO] Usuario Auth creado para ${emailToUse}`);
          
          // Actualizar el documento de usuario con la nueva información
          await db.collection('users').doc(doc.id).update({
            pin: newPin,
            email: emailToUse,
            migratedToAuth: true
          });
          
          migratedCount++;
        } else {
          throw err;
        }
      }
    } catch (err) {
      console.error(`[ERROR] Falló la migración para ${user.username} (${doc.id}):`, err);
      errorCount++;
    }
  }

  console.log("====================================");
  console.log(`Migración Completada.`);
  console.log(`Migrados con éxito: ${migratedCount}`);
  console.log(`Saltados: ${skippedCount}`);
  console.log(`Errores: ${errorCount}`);
  console.log("====================================");
  process.exit(0);
}

runMigration().catch(console.error);
