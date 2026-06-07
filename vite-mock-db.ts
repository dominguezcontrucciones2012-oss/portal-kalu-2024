import { Plugin } from 'vite';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import https from 'https';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DB_DIR = path.resolve(__dirname, 'db_mock');

// Seeding function
function checkAndSeed() {
  if (!fs.existsSync(DB_DIR)) {
    fs.mkdirSync(DB_DIR, { recursive: true });
  }

  const collections = {
    products: [
      { id: '1', codigo: '7591234001', nombre: 'Harina PAN 1kg', categoria: 'VÍVERES', costo_usd: 0.95, precio_normal_usd: 1.25, precio_oferta_usd: 1.15, stock: 150, stock_minimo: 20, unidad_medida: 'UND', imagen_url: 'https://images.unsplash.com/photo-1509440159596-0249088772ff?w=600&auto=format&fit=crop&q=80', descripcion: 'La tradicional harina de maíz blanco precocida. ¡Perfecta para tus arepas diarias, empanadas y hallacas con el sabor original venezolano!' },
      { id: '2', codigo: '7591234002', nombre: 'Arroz Primor 1kg', categoria: 'VÍVERES', costo_usd: 1.10, precio_normal_usd: 1.50, precio_oferta_usd: 1.40, stock: 85, stock_minimo: 15, unidad_medida: 'UND', imagen_url: 'https://images.unsplash.com/photo-1586201375761-83865001e31c?w=600&auto=format&fit=crop&q=80', descripcion: 'Arroz de grano entero tipo I, súper seleccionado. Suelto y blanco en cada cocción para asegurar el mejor sabor en tus platos.' },
      { id: '3', codigo: '7591234003', nombre: 'Aceite Diana 1L', categoria: 'VÍVERES', costo_usd: 2.20, precio_normal_usd: 2.80, precio_oferta_usd: 2.60, stock: 45, stock_minimo: 10, unidad_medida: 'UND', imagen_url: 'https://images.unsplash.com/photo-1474979266404-7eaacbcd87c5?w=600&auto=format&fit=crop&q=80', descripcion: 'Aceite vegetal refinado y fortificado, ideal para ensaladas o frituras perfectas y crujientes con la mayor ligereza.' },
      { id: '4', codigo: 'QU-001', nombre: 'Queso Duro Llanero', categoria: 'PRODUCTORES / AGRÍCOLA', costo_usd: 3.00, precio_normal_usd: 4.50, precio_oferta_usd: 4.20, stock: 120, stock_minimo: 50, unidad_medida: 'KG', imagen_url: 'https://images.unsplash.com/photo-1486299267070-83823f5448dd?w=600&auto=format&fit=crop&q=80', descripcion: 'Queso llanero tradicional fresco y salado en su punto. Elaborado artesanalmente, ideal para rallar sobre tus arepas, caraotas y pastas.' },
      { id: '5', codigo: 'RP-001', nombre: 'Tripa de Moto 2.75-18', categoria: 'REPUESTOS DE MOTO', costo_usd: 5.50, precio_normal_usd: 8.50, stock: 12, stock_minimo: 5, unidad_medida: 'UND', imagen_url: 'https://images.unsplash.com/photo-1558981806-ec527fa84c39?w=600&auto=format&fit=crop&q=80', descripcion: 'Tripa de caucho reforzada de alta resistencia al calor y fricción. Excelente rendimiento para soportar los baches y caminos del día a día.' },
      { id: '6', codigo: 'FR-001', nombre: 'Pala de Construcción', categoria: 'FERRETERÍA', costo_usd: 9.00, precio_normal_usd: 14.00, stock: 8, stock_minimo: 2, unidad_medida: 'UND', imagen_url: 'https://images.unsplash.com/photo-1530124560072-a059b014b766?w=600&auto=format&fit=crop&q=80', descripcion: 'Pala cuadrada de acero de alta resistencia con mango de madera ergonómico. Durabilidad extrema para cualquier trabajo pesado en obra o jardinería.' }
    ],
    clients: [
      { id: 'c1', nombre: 'Juan Perez', cedula: 'V-12345678', telefono: '0424-5551122', direccion: 'Calle Principal', saldo_usd: 25.50, puntos: 150, role: 'cliente' },
      { id: 'c2', nombre: 'Maria Rodriguez', cedula: 'V-87654321', telefono: '0412-9993344', direccion: 'Avenida 2', saldo_usd: 0, puntos: 215, role: 'cliente' },
      { id: 'c3', nombre: 'Pedro Gomez', cedula: 'V-11223344', telefono: '0416-1112233', direccion: 'Calle 3', saldo_usd: 8.75, puntos: 45, role: 'cliente' }
    ],
    users: [
      { id: 'u1', username: 'Administrador', role: 'admin', email: 'admin@kalu.com', pin: '9999' },
      { id: 'u2', username: 'Cajero Principal', role: 'cajero', email: 'cajero@kalu.com', pin: '0000' },
      { id: 'u3', username: 'Supervisor', role: 'supervisor', email: 'super@kalu.com', pin: '1111' },
      // Users for mock clients
      { id: 'c1', username: 'Juan Perez', role: 'cliente', pin: '1234', cedula: 'V-12345678', clientId: 'c1' },
      { id: 'c2', username: 'Maria Rodriguez', role: 'cliente', pin: '4321', cedula: 'V-87654321', clientId: 'c2' },
      { id: 'c3', username: 'Pedro Gomez', role: 'cliente', pin: '3344', cedula: 'V-11223344', clientId: 'c3' }
    ],
    sales: [
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
        origen: 'web',
        status_pedido: 'pendiente',
        detalles: [
          { producto_id: '1', nombre: 'Harina PAN 1kg', cantidad: 2, precio_unitario_usd: 1.25 },
          { producto_id: '2', nombre: 'Arroz Primor 1kg', cantidad: 3, precio_unitario_usd: 1.50 }
        ]
      }
    ],
    tasas_bcv: [
      {
        id: `tasa-${new Date().toISOString().split('T')[0]}`,
        fecha: new Date().toISOString().split('T')[0],
        valor: 530.00,
        fuente: 'Manual / Interna',
        estatus: 'Manual',
        sincronizadoEn: new Date().toISOString()
      }
    ],
    cierres_caja: [],
    ventas_pausadas: [],
    movimientos_productores: [],
    auditoria_inventario: []
  };

  for (const [col, initialData] of Object.entries(collections)) {
    const filePath = path.join(DB_DIR, `${col}.json`);
    if (!fs.existsSync(filePath)) {
      fs.writeFileSync(filePath, JSON.stringify(initialData, null, 2), 'utf-8');
    }
  }
}

function getBody(req: any): Promise<string> {
  return new Promise((resolve) => {
    let body = '';
    req.on('data', (chunk: any) => {
      body += chunk;
    });
    req.on('end', () => {
      resolve(body);
    });
  });
}

export function mockDbPlugin(): Plugin {
  // Initialize
  checkAndSeed();

  return {
    name: 'mock-db-api',
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        const url = req.url || '';

        // --- Proxy: Tasa BCV Real ---
        if (url.startsWith('/api/bcv-rate')) {
          res.setHeader('Content-Type', 'application/json');
          res.setHeader('Access-Control-Allow-Origin', '*');
          try {
            const data = await new Promise<string>((resolve, reject) => {
              https.get('https://ve.dolarapi.com/v1/dolares/oficial', (apiRes) => {
                let body = '';
                apiRes.on('data', (chunk) => body += chunk);
                apiRes.on('end', () => resolve(body));
              }).on('error', reject);
            });
            const parsed = JSON.parse(data);
            const rate = parsed.promedio || parsed.venta || null;
            return res.end(JSON.stringify({ rate, fecha: parsed.fechaActualizacion }));
          } catch (e: any) {
            res.statusCode = 503;
            return res.end(JSON.stringify({ error: 'No se pudo obtener la tasa BCV', detail: e.message }));
          }
        }

        // --- Upload Video Endpoint ---
        if (url.startsWith('/api/upload-video')) {
          res.setHeader('Content-Type', 'application/json');
          res.setHeader('Access-Control-Allow-Origin', '*');
          res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
          res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

          if (req.method === 'OPTIONS') {
            res.statusCode = 200;
            return res.end();
          }

          if (req.method === 'POST') {
            try {
              const bodyStr = await getBody(req);
              const body = JSON.parse(bodyStr);
              if (!body.file || !body.filename) {
                res.statusCode = 400;
                return res.end(JSON.stringify({ error: 'Faltan datos de archivo' }));
              }

              const base64Data = body.file.replace(/^data:video\/[^;]+;base64,/, "");
              const buffer = Buffer.from(base64Data, 'base64');
              
              const publicDir = path.resolve(__dirname, 'public');
              if (!fs.existsSync(publicDir)) {
                fs.mkdirSync(publicDir, { recursive: true });
              }

              const ext = path.extname(body.filename) || '.mp4';
              const targetPath = path.join(publicDir, `propaganda_video${ext}`);
              fs.writeFileSync(targetPath, buffer);

              return res.end(JSON.stringify({ url: `/propaganda_video${ext}` }));
            } catch (err: any) {
              res.statusCode = 500;
              return res.end(JSON.stringify({ error: 'Error al guardar el archivo', details: err.message }));
            }
          }
        }

        if (!url.startsWith('/api/db')) {
          return next();
        }

        res.setHeader('Content-Type', 'application/json');
        res.setHeader('Access-Control-Allow-Origin', '*');
        res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
        res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

        if (req.method === 'OPTIONS') {
          res.statusCode = 200;
          return res.end();
        }

        const parts = url.split('?')[0].split('/').filter(Boolean);
        // parts: ['api', 'db', 'collectionName', 'id']
        if (parts.length < 3) {
          res.statusCode = 400;
          return res.end(JSON.stringify({ error: 'Ruta inválida' }));
        }

        const collection = parts[2];
        const id = parts[3];
        const filePath = path.join(DB_DIR, `${collection}.json`);

        if (!fs.existsSync(filePath)) {
          fs.writeFileSync(filePath, '[]', 'utf-8');
        }

        const method = req.method;

        try {
          if (method === 'GET') {
            const dataStr = fs.readFileSync(filePath, 'utf-8');
            const data = JSON.parse(dataStr);
            if (id) {
              const item = data.find((x: any) => x.id === id);
              if (!item) {
                res.statusCode = 404;
                return res.end(JSON.stringify({ error: 'Documento no encontrado' }));
              }
              return res.end(JSON.stringify(item));
            }
            return res.end(dataStr);
          }

          if (method === 'POST') {
            const bodyStr = await getBody(req);
            const body = JSON.parse(bodyStr);
            const dataStr = fs.readFileSync(filePath, 'utf-8');
            const data = JSON.parse(dataStr);

            if (!body.id) {
              const prefix = collection.charAt(0);
              body.id = `${prefix}${Date.now()}`;
            }

            data.push(body);
            fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf-8');
            return res.end(JSON.stringify(body));
          }

          if (method === 'PUT') {
            if (!id) {
              res.statusCode = 400;
              return res.end(JSON.stringify({ error: 'ID requerido para actualizar' }));
            }
            const bodyStr = await getBody(req);
            const body = JSON.parse(bodyStr);
            const dataStr = fs.readFileSync(filePath, 'utf-8');
            const data = JSON.parse(dataStr);

            const index = data.findIndex((x: any) => x.id === id);
            if (index === -1) {
              body.id = id;
              data.push(body);
            } else {
              data[index] = { ...data[index], ...body, id };
            }

            fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf-8');
            return res.end(JSON.stringify(data[index] || body));
          }

          if (method === 'DELETE') {
            if (!id) {
              res.statusCode = 400;
              return res.end(JSON.stringify({ error: 'ID requerido para eliminar' }));
            }
            const dataStr = fs.readFileSync(filePath, 'utf-8');
            let data = JSON.parse(dataStr);
            data = data.filter((x: any) => x.id !== id);
            fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf-8');
            return res.end(JSON.stringify({ success: true }));
          }

          res.statusCode = 405;
          return res.end(JSON.stringify({ error: 'Método no soportado' }));
        } catch (e: any) {
          res.statusCode = 500;
          return res.end(JSON.stringify({ error: e.message }));
        }
      });
    }
  };
}
