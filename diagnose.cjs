const { initializeApp, cert } = require('firebase-admin/app');
const { getFirestore } = require('firebase-admin/firestore');
const { readFileSync } = require('fs');

const serviceAccount = JSON.parse(readFileSync('./service-account.json', 'utf8'));

initializeApp({
  credential: cert(serviceAccount)
});

const db = getFirestore();

async function run() {
  const email = 'cherokejd566@gmail.com';
  console.log(`\n--- DIAGNÓSTICO PARA: ${email} ---\n`);

  try {
    // 1. Check 'administradores' collection
    console.log('1. Colección "administradores":');
    const adminSnap = await db.collection('administradores').where('email', '==', email).get();
    
    if (adminSnap.empty) {
      console.log('  -> [NO EXISTE] No se encontró ningún documento en "administradores".');
    } else {
      adminSnap.forEach(doc => {
        console.log(`  -> [EXISTE] Documento ID: ${doc.id}`);
        console.log(`  -> Campos:`, doc.data());
        console.log(`  -> Tipo de dato del PIN: ${typeof doc.data().pin}`);
      });
    }
    console.log('');

    // 2. Check 'users' collection
    console.log('2. Colección "users":');
    const userSnap = await db.collection('users').where('email', '==', email).get();
    
    if (userSnap.empty) {
      console.log('  -> [NO EXISTE] No se encontró ningún documento en "users".');
    } else {
      userSnap.forEach(doc => {
        console.log(`  -> [EXISTE] Documento ID: ${doc.id}`);
        console.log(`  -> Campos:`, doc.data());
        console.log(`  -> Tipo de dato del PIN: ${typeof doc.data().pin}`);
      });
    }
  } catch (err) {
    console.error("Error consultando la base de datos:", err);
  }

  console.log('\n--- FIN DEL DIAGNÓSTICO ---');
  process.exit(0);
}

run().catch(console.error);
