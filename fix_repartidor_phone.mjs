async function run() {
  const { initializeApp } = await import('firebase/app');
  const { getFirestore, collection, query, where, getDocs, updateDoc, doc, setDoc } = await import('firebase/firestore');

  const firebaseConfig = {
    apiKey: "AIzaSyCyUtNCXwe_SRxwFDvX9WPBpd-_mE0FgsE",
    authDomain: "kalu-queso-sanjuam.firebaseapp.com",
    projectId: "kalu-queso-sanjuam",
    storageBucket: "kalu-queso-sanjuam.firebasestorage.app",
    messagingSenderId: "376295544090",
    appId: "1:376295544090:web:3e5e66de3298e862fa48a3"
  };

  const app = initializeApp(firebaseConfig);
  const db = getFirestore(app);

  const CEDULA = '11120033';
  const TELEFONO = '584243068286';

  console.log('=== Buscando en users collection ===');
  const usersSnap = await getDocs(collection(db, 'users'));
  let found = false;
  for (const d of usersSnap.docs) {
    const data = d.data();
    if (data.cedula === CEDULA || data.username === CEDULA || String(data.cedula).replace(/\D/g,'') === CEDULA) {
      console.log(`Encontrado: ID=${d.id}, username=${data.username}, cedula=${data.cedula}, role=${data.role}, telefono=${data.telefono || 'NINGUNO'}`);
      await updateDoc(doc(db, 'users', d.id), { telefono: TELEFONO, role: 'repartidor' });
      console.log(`✅ Actualizado users/${d.id} con telefono=${TELEFONO} y role=repartidor`);
      found = true;
    }
  }

  console.log('\n=== Buscando en clients collection ===');
  const clientsSnap = await getDocs(collection(db, 'clients'));
  for (const d of clientsSnap.docs) {
    const data = d.data();
    if (data.cedula === CEDULA || String(data.cedula).replace(/\D/g,'') === CEDULA) {
      console.log(`Cliente encontrado: ID=${d.id}, nombre=${data.nombre}, telefono=${data.telefono || 'NINGUNO'}`);
      // Intentar actualizar users con el mismo ID
      try {
        await updateDoc(doc(db, 'users', d.id), { telefono: TELEFONO, role: 'repartidor' });
        console.log(`✅ Actualizado users/${d.id} con telefono=${TELEFONO}`);
        found = true;
      } catch(e) {
        console.log(`  Doc users/${d.id} no existe, creando...`);
        await setDoc(doc(db, 'users', d.id), {
          cedula: CEDULA,
          username: CEDULA,
          nombre: data.nombre,
          telefono: TELEFONO,
          role: 'repartidor'
        }, { merge: true });
        console.log(`✅ Creado/actualizado users/${d.id}`);
        found = true;
      }
    }
  }

  if (!found) {
    console.log('❌ No se encontró ningún usuario con cédula ' + CEDULA);
  }

  console.log('\n=== Verificando repartidores finales ===');
  const finalSnap = await getDocs(collection(db, 'users'));
  finalSnap.forEach(d => {
    if (d.data().role === 'repartidor') {
      console.log(`Repartidor: ${d.data().username || d.id} | Tel: ${d.data().telefono || 'NO TIENE'}`);
    }
  });
}

run().then(() => { console.log('\nListo.'); process.exit(0); }).catch(e => { console.error(e); process.exit(1); });
