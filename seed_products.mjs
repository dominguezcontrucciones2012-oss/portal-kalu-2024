import { initializeApp } from 'firebase/app';
import { getFirestore, collection, doc, setDoc } from 'firebase/firestore';

const firebaseConfig = {
  "apiKey": "AIzaSyCyUtNCXwe_SRxwFDvX9WPBpd-_mE0FgsE",
  "authDomain": "kalu-queso-sanjuam.firebaseapp.com",
  "projectId": "kalu-queso-sanjuam",
  "storageBucket": "kalu-queso-sanjuam.firebasestorage.app",
  "messagingSenderId": "376295544090",
  "appId": "1:376295544090:web:3e5e66de3298e862fa48a3"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

const products = [
  // Kaluqueso San Juan
  { storeId: 'kalu-queso-principal', codigo: 'KQ-001', nombre: 'Queso Duro Blanco (por kg)', costo_usd: 4.00, precio_normal_usd: 5.50, stock: 50, categoria: 'Charcutería', is_weighable: true, status: 'active', imageUrl: '' },
  { storeId: 'kalu-queso-principal', codigo: 'KQ-002', nombre: 'Harina PAN 1kg', costo_usd: 0.90, precio_normal_usd: 1.10, stock: 50, categoria: 'Víveres', is_weighable: false, status: 'active', imageUrl: '' },
  { storeId: 'kalu-queso-principal', codigo: 'KQ-003', nombre: 'Aceite Vegetal 1L', costo_usd: 1.80, precio_normal_usd: 2.20, stock: 50, categoria: 'Víveres', is_weighable: false, status: 'active', imageUrl: '' },
  { storeId: 'kalu-queso-principal', codigo: 'KQ-004', nombre: 'Mantequilla Mavesa 500g', costo_usd: 2.00, precio_normal_usd: 2.50, stock: 50, categoria: 'Víveres', is_weighable: false, status: 'active', imageUrl: '' },
  { storeId: 'kalu-queso-principal', codigo: 'KQ-005', nombre: 'Jamón de Espalda (por kg)', costo_usd: 4.50, precio_normal_usd: 6.00, stock: 50, categoria: 'Charcutería', is_weighable: true, status: 'active', imageUrl: '' },

  // Farmacia San Juan
  { storeId: 'farmacia-san-juan', codigo: 'FSJ-001', nombre: 'Acetaminofén 500mg (Caja 10 tab)', costo_usd: 1.00, precio_normal_usd: 1.50, stock: 50, categoria: 'Medicamentos', is_weighable: false, status: 'active', imageUrl: '' },
  { storeId: 'farmacia-san-juan', codigo: 'FSJ-002', nombre: 'Ibuprofeno 400mg', costo_usd: 1.20, precio_normal_usd: 2.00, stock: 50, categoria: 'Medicamentos', is_weighable: false, status: 'active', imageUrl: '' },
  { storeId: 'farmacia-san-juan', codigo: 'FSJ-003', nombre: 'Alcohol Antiséptico 70% 250ml', costo_usd: 0.80, precio_normal_usd: 1.20, stock: 50, categoria: 'Primeros Auxilios', is_weighable: false, status: 'active', imageUrl: '' },
  { storeId: 'farmacia-san-juan', codigo: 'FSJ-004', nombre: 'Suero Oral Electrolitos', costo_usd: 1.20, precio_normal_usd: 1.80, stock: 50, categoria: 'Hidratación', is_weighable: false, status: 'active', imageUrl: '' },
  { storeId: 'farmacia-san-juan', codigo: 'FSJ-005', nombre: 'Mascarillas Quirúrgicas (Paquete 10 ud)', costo_usd: 1.50, precio_normal_usd: 2.50, stock: 50, categoria: 'Salud', is_weighable: false, status: 'active', imageUrl: '' },

  // Bodega El Peruano
  { storeId: 'bodega-el-peruano', codigo: 'BP-001', nombre: 'Arroz Primor 1kg', costo_usd: 0.90, precio_normal_usd: 1.20, stock: 50, categoria: 'Abarrotes', is_weighable: false, status: 'active', imageUrl: '' },
  { storeId: 'bodega-el-peruano', codigo: 'BP-002', nombre: 'Café Molido 250g', costo_usd: 2.20, precio_normal_usd: 3.00, stock: 50, categoria: 'Abarrotes', is_weighable: false, status: 'active', imageUrl: '' },
  { storeId: 'bodega-el-peruano', codigo: 'BP-003', nombre: 'Refresco Coca-Cola 1.5L', costo_usd: 1.30, precio_normal_usd: 1.80, stock: 50, categoria: 'Bebidas', is_weighable: false, status: 'active', imageUrl: '' },
  { storeId: 'bodega-el-peruano', codigo: 'BP-004', nombre: 'Azúcar Blanca 1kg', costo_usd: 0.85, precio_normal_usd: 1.15, stock: 50, categoria: 'Abarrotes', is_weighable: false, status: 'active', imageUrl: '' },
  { storeId: 'bodega-el-peruano', codigo: 'BP-005', nombre: 'Mayonesa Mavesa 445g', costo_usd: 2.10, precio_normal_usd: 2.80, stock: 50, categoria: 'Abarrotes', is_weighable: false, status: 'active', imageUrl: '' }
];

async function seedProducts() {
  console.log('Seeding products...');
  for (const product of products) {
    const docId = product.storeId + '_' + product.codigo;
    try {
      await setDoc(doc(db, 'products', docId), {
        ...product,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      }, { merge: true });
      console.log(`Added: ${product.nombre}`);
    } catch (e) {
      console.error(`Failed to add: ${product.nombre}`, e);
    }
  }
  console.log('Done.');
  process.exit(0);
}

seedProducts();
