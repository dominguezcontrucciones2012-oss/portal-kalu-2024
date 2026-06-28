async function run() {
  const { initializeApp } = await import('firebase/app');
  const { getFirestore, collection, getDocs, deleteDoc, doc, getDoc } = await import('firebase/firestore');

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
  // Este es el ID CORRECTO - el que tiene el perfil de cliente vinculado
  const KEEP_ID = 'ge3w7pZV23HHO1KtAZsX';

  console.log('=== Buscando duplicados para cedula: ' + CEDULA + ' ===');
  const usersSnap = await getDocs(collection(db, 'users'));
  
  const duplicados = [];
  usersSnap.forEach(d => {
    const data = d.data();
    if ((data.cedula === CEDULA || data.username === CEDULA || String(data.cedula || '').replace(/\D/g,'') === CEDULA) && d.id !== KEEP_ID) {
      duplicados.push({ id: d.id, data: data });
    }
  });

  console.log('Encontrados ' + duplicados.length + ' duplicados a eliminar:');
  for (const dup of duplicados) {
    console.log('  Eliminando users/' + dup.id + ' (role: ' + dup.data.role + ', tel: ' + (dup.data.telefono || 'NINGUNO') + ')');
    await deleteDoc(doc(db, 'users', dup.id));
    console.log('  ✅ Eliminado');
  }

  // Verificar el doc correcto
  const keepDoc = await getDoc(doc(db, 'users', KEEP_ID));
  if (keepDoc.exists()) {
    const d = keepDoc.data();
    console.log('\n✅ Doc correcto conservado:');
    console.log('  ID: ' + KEEP_ID);
    console.log('  username: ' + d.username);
    console.log('  cedula: ' + d.cedula);
    console.log('  role: ' + d.role);
    console.log('  telefono: ' + (d.telefono || 'NINGUNO'));
  }

  console.log('\n=== Repartidores finales en DB ===');
  const finalSnap = await getDocs(collection(db, 'users'));
  finalSnap.forEach(d => {
    if (d.data().role === 'repartidor') {
      console.log('Repartidor: ' + (d.data().username || d.id) + ' | ID: ' + d.id + ' | Tel: ' + (d.data().telefono || 'NO TIENE'));
    }
  });
}

run().then(() => { console.log('\nListo. Solo queda 1 doc de repartidor.'); process.exit(0); })
     .catch(e => { console.error(e); process.exit(1); });
