import { Role, type Product, type Client, type Productor, type Sale, type User } from '../types';

export const TASA_BCV = 40.50;

export const MOCK_PRODUCTS: Product[] = [
  { 
    id: '1', 
    codigo: '7591234001', 
    nombre: 'Harina PAN 1kg', 
    categoria: 'VÍVERES', 
    costo_usd: 0.95, 
    precio_normal_usd: 1.25, 
    precio_oferta_usd: 1.15, 
    stock: 150, 
    stock_minimo: 20, 
    unidad_medida: 'UND',
    imagen_url: 'https://images.unsplash.com/photo-1509440159596-0249088772ff?w=600&auto=format&fit=crop&q=80',
    descripcion: 'La tradicional harina de maíz blanco precocida. ¡Perfecta para tus arepas diarias, empanadas y hallacas con el sabor original venezolano!'
  },
  { 
    id: '2', 
    codigo: '7591234002', 
    nombre: 'Arroz Primor 1kg', 
    categoria: 'VÍVERES', 
    costo_usd: 1.10, 
    precio_normal_usd: 1.50, 
    precio_oferta_usd: 1.40, 
    stock: 85, 
    stock_minimo: 15, 
    unidad_medida: 'UND',
    imagen_url: 'https://images.unsplash.com/photo-1586201375761-83865001e31c?w=600&auto=format&fit=crop&q=80',
    descripcion: 'Arroz de grano entero tipo I, súper seleccionado. Suelto y blanco en cada cocción para asegurar el mejor sabor en tus platos.'
  },
  { 
    id: '3', 
    codigo: '7591234003', 
    nombre: 'Aceite Diana 1L', 
    categoria: 'VÍVERES', 
    costo_usd: 2.20, 
    precio_normal_usd: 2.80, 
    precio_oferta_usd: 2.60, 
    stock: 45, 
    stock_minimo: 10, 
    unidad_medida: 'UND',
    imagen_url: 'https://images.unsplash.com/photo-1474979266404-7eaacbcd87c5?w=600&auto=format&fit=crop&q=80',
    descripcion: 'Aceite vegetal refinado y fortificado, ideal para ensaladas o frituras perfectas y crujientes con la mayor ligereza.'
  },
  { 
    id: '4', 
    codigo: 'QU-001', 
    nombre: 'Queso Duro Llanero', 
    categoria: ' PRODUCTORES / AGRÍCOLA', 
    costo_usd: 3.00, 
    precio_normal_usd: 4.50, 
    precio_oferta_usd: 4.20, 
    stock: 120, 
    stock_minimo: 50, 
    unidad_medida: 'KG',
    imagen_url: 'https://images.unsplash.com/photo-1486299267070-83823f5448dd?w=600&auto=format&fit=crop&q=80',
    descripcion: 'Queso llanero tradicional fresco y salado en su punto. Elaborado artesanalmente, ideal para rallar sobre tus arepas, caraotas y pastas.'
  },
  { 
    id: '5', 
    codigo: 'RP-001', 
    nombre: 'Tripa de Moto 2.75-18', 
    categoria: 'REPUESTOS DE MOTO', 
    costo_usd: 5.50, 
    precio_normal_usd: 8.50, 
    stock: 12, 
    stock_minimo: 5, 
    unidad_medida: 'UND',
    imagen_url: 'https://images.unsplash.com/photo-1558981806-ec527fa84c39?w=600&auto=format&fit=crop&q=80',
    descripcion: 'Tripa de caucho reforzada de alta resistencia al calor y fricción. Excelente rendimiento para soportar los baches y caminos del día a día.'
  },
  { 
    id: '6', 
    codigo: 'FR-001', 
    nombre: 'Pala de Construcción', 
    categoria: 'FERRETERÍA', 
    costo_usd: 9.00, 
    precio_normal_usd: 14.00, 
    stock: 8, 
    stock_minimo: 2, 
    unidad_medida: 'UND',
    imagen_url: 'https://images.unsplash.com/photo-1530124560072-a059b014b766?w=600&auto=format&fit=crop&q=80',
    descripcion: 'Pala cuadrada de acero de alta resistencia con mango de madera ergonómico. Durabilidad extrema para cualquier trabajo pesado en obra o jardinería.'
  },
];

export const MOCK_CLIENTS: Client[] = [
  { id: 'c1', nombre: 'Juan Perez', cedula: 'V-12345678', telefono: '0424-5551122', saldo_usd: 25.50, puntos: 150, role: Role.CLIENTE },
  { id: 'c2', nombre: 'Maria Rodriguez', cedula: 'V-87654321', telefono: '0412-9993344', saldo_usd: 0, puntos: 215, role: Role.CLIENTE },
  { id: 'c3', nombre: 'Pedro Gomez', cedula: 'V-11223344', telefono: '0416-1112233', saldo_usd: 8.75, puntos: 45, role: Role.CLIENTE },
];

export const MOCK_PRODUCTORES: Productor[] = [
  { id: 'p1', nombre: 'Hacienda El Socorro', rif: 'J-31234567-0', telefono: '0424-6663321', saldo_pendiente_usd: 450.00, kilos_semana: 125.5, puntos_ranking: 1250, es_obrero: false, role: Role.PRODUCTOR },
  { id: 'p2', nombre: 'Diana Aponte', rif: 'V-15667788', telefono: '0414-2228877', saldo_pendiente_usd: 45.00, kilos_semana: 0, puntos_ranking: 450, es_obrero: true, role: Role.PRODUCTOR },
  { id: 'p3', nombre: 'Andres Eloy', rif: 'V-14556677', telefono: '0412-3334455', saldo_pendiente_usd: 0, kilos_semana: 85.0, puntos_ranking: 890, es_obrero: false, role: Role.PRODUCTOR },
];

export const MOCK_SALES: Sale[] = [
  {
    id: '1001',
    fecha: '2026-05-09T14:30:00Z',
    nombre_cliente: 'Juan Perez',
    cliente_id: 'c1',
    total_usd: 15.50,
    tasa_momento: 40.20,
    es_fiado: true,
    pagada: false,
    pago_efectivo_usd: 0,
    pago_efectivo_bs: 0,
    pago_movil_bs: 0,
    pago_transferencia_bs: 0,
    biopago_bdv: 0,
    pago_debito_bs: 0,
    pago_otros_usd: 0,
    saldo_pendiente_usd: 15.50,
    detalles: [
      { producto_id: '1', nombre: 'Harina PAN 1kg', cantidad: 2, precio_unitario_usd: 1.25 },
      { producto_id: '2', nombre: 'Arroz Primor 1kg', cantidad: 3, precio_unitario_usd: 1.50 },
    ]
  },
  {
    id: '1002',
    fecha: '2026-05-10T09:15:00Z',
    nombre_cliente: 'Consumidor Final',
    total_usd: 4.80,
    tasa_momento: 40.50,
    es_fiado: false,
    pagada: true,
    pago_efectivo_usd: 4.80,
    pago_efectivo_bs: 0,
    pago_movil_bs: 0,
    pago_transferencia_bs: 0,
    biopago_bdv: 0,
    pago_debito_bs: 0,
    pago_otros_usd: 0,
    saldo_pendiente_usd: 0,
    detalles: [
      { producto_id: '3', nombre: 'Aceite Diana 1L', cantidad: 1, precio_unitario_usd: 2.80 },
      { producto_id: '1', nombre: 'Harina PAN 1kg', cantidad: 1, precio_unitario_usd: 1.25 },
    ]
  }
];

export const MOCK_USERS: User[] = [
  { id: 'u1', username: 'Administrador', role: Role.ADMIN, email: 'admin@kalu.com', pin: '9999' },
  { id: 'u2', username: 'Cajero Principal', role: Role.CAJERO, email: 'cajero@kalu.com', pin: '0000' },
  { id: 'u3', username: 'Supervisor', role: Role.SUPERVISOR, email: 'super@kalu.com', pin: '1111' },
];
