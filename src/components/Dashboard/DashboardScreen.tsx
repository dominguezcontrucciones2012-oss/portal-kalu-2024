import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'motion/react';
import { 
  TrendingUp, 
  Calendar, 
  DollarSign, 
  Users, 
  AlertTriangle, 
  ShoppingBag,
  ArrowUpRight,
  ArrowDownLeft,
  Zap,
  Plus,
  Calculator,
  FileText,
  Trash2,
  Download
} from 'lucide-react';
import { 
  AreaChart, 
  Area, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer 
} from 'recharts';
import { cn, formatCurrency, parseDate } from '../../lib/utils';
import { subscribeToCollection } from '../../lib/dbUtils';
import { type Product, type Sale } from '../../types';
import QRCode from 'react-qr-code';
import { doc, updateDoc, deleteDoc, getDocs, query, collection } from 'firebase/firestore';
import { db } from '../../lib/firebase';

const DAYS = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];

const topProducts = [
  { name: 'Harina PAN', sales: 120 },
  { name: 'Arroz Primor', sales: 98 },
  { name: 'Aceite Diana', sales: 86 },
  { name: 'Queso Duro', sales: 72 },
  { name: 'Tripa Moto', sales: 45 },
];

const StatCard = ({ title, value, icon: Icon, trend, color }: any) => (
  <div className="bg-white/5 border border-white/10 p-6 rounded-3xl backdrop-blur-xl transition-all hover:scale-[1.02] hover:bg-white/10 group cursor-default">
    <div className="flex items-center justify-between mb-4">
      <div className={cn("p-3 rounded-2xl", color)}>
        <Icon size={24} className="text-white" />
      </div>
      {trend && (
        <span className={cn(
          "flex items-center text-xs font-bold px-2 py-1 rounded-full",
          trend > 0 ? "bg-green-500/20 text-green-400" : "bg-red-500/20 text-red-400"
        )}>
          {trend > 0 ? <ArrowUpRight size={14} className="mr-1" /> : <ArrowDownLeft size={14} className="mr-1" />}
          {Math.abs(trend)}%
        </span>
      )}
    </div>
    <h3 className="text-gray-400 text-sm font-medium mb-1">{title}</h3>
    <div className="text-2xl font-black">{value}</div>
  </div>
);

import { useAuth } from '../../contexts/AuthProvider';
import { Role } from '../../types';
import { Navigate } from 'react-router-dom';

const DashboardScreen: React.FC = () => {
  const { user, isAdmin } = useAuth();
  const [products, setProducts] = useState<Product[]>([]);
  const [sales, setSales] = useState<Sale[]>([]);
  const [quejas, setQuejas] = useState<any[]>([]);
  const [clients, setClients] = useState<any[]>([]);
  const [mensajesPortal, setMensajesPortal] = useState<any[]>([]);
  const [propagandaUrl, setPropagandaUrl] = useState('');
  
  // Estados para formulario de nuevo aviso y video
  const [nuevoTitulo, setNuevoTitulo] = useState('');
  const [nuevoContenido, setNuevoContenido] = useState('');
  const [nuevoDestinatario, setNuevoDestinatario] = useState('todos');
  const [publicandoAviso, setPublicandoAviso] = useState(false);
  const [guardandoVideo, setGuardandoVideo] = useState(false);
  const [cargandoVideoLocal, setCargandoVideoLocal] = useState(false);
  const [selectedAvisos, setSelectedAvisos] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);

  const normalizedRole = user?.role?.toLowerCase();
  if (normalizedRole === Role.PRODUCTOR) {
    return <Navigate to="/vendor-portal" replace />;
  }

  if (normalizedRole === Role.CLIENTE) {
    return <Navigate to="/client-portal" replace />;
  }

  useEffect(() => {
    const unsubProducts = subscribeToCollection('products', (data) => setProducts(data));
    const unsubSales = subscribeToCollection('sales', (data) => {
      setSales(data);
      setLoading(false);
    });
    
    let unsubQuejas = () => {};
    let unsubClients = () => {};
    let unsubMensajes = () => {};
    let unsubConfig = () => {};

    if (isAdmin) {
      unsubQuejas = subscribeToCollection('quejas', (data) => {
        const sorted = data.sort((a, b) => new Date(b.fecha).getTime() - new Date(a.fecha).getTime());
        setQuejas(sorted);
      });
      unsubClients = subscribeToCollection('clients', (data) => setClients(data));
      unsubMensajes = subscribeToCollection('mensajes', (data) => {
        const sorted = data.sort((a, b) => new Date(b.fecha).getTime() - new Date(a.fecha).getTime());
        setMensajesPortal(sorted);
      });
      unsubConfig = subscribeToCollection('configuracion', (data) => {
        const globalConfig = data.find(c => c.id === 'global');
        if (globalConfig && globalConfig.propaganda_url) {
          setPropagandaUrl(globalConfig.propaganda_url);
        }
      });
    }

    return () => {
      unsubProducts();
      unsubSales();
      unsubQuejas();
      unsubClients();
      unsubMensajes();
      unsubConfig();
    };
  }, [user]);

  const handleBackupDB = async () => {
    try {
      const collectionsToBackup = [
        'sales', 'cierres_caja', 'clients', 'products', 'users', 
        'movimientos_productores', 'quejas', 'mensajes'
      ];
      const backupData: any = {};
      
      for (const col of collectionsToBackup) {
        const qCol = query(collection(db, col));
        const snap = await getDocs(qCol);
        backupData[col] = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      }
      
      const json = JSON.stringify(backupData, null, 2);
      const blob = new Blob([json], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `respaldo_kaluneva_${new Date().toISOString().split('T')[0]}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      
      alert("¡Respaldo descargado con éxito!");
    } catch (e: any) {
      console.error(e);
      alert("Error creando respaldo: " + e.message);
    }
  };

  const handleResetData = async () => {
    if (!window.confirm("¿Seguro que quieres borrar TODA la contabilidad? (Ventas, cierres, saldos de clientes y productores)")) return;
    try {
      // 1. Reset client balances
      const qClients = query(collection(db, 'clients'));
      const snapClients = await getDocs(qClients);
      snapClients.forEach(d => {
        updateDoc(doc(db, 'clients', d.id), { saldo_usd: 0, puntos: 0 });
      });

      // 2. Reset user balances (productores/repartidores)
      const qUsers = query(collection(db, 'users'));
      const snapUsers = await getDocs(qUsers);
      snapUsers.forEach(d => {
        updateDoc(doc(db, 'users', d.id), { saldo_pendiente_usd: 0 });
      });

      // 3. Reset collections
      const collectionsToDelete = [
        'sales', 
        'cierres_caja', 
        'movimientos_productores', 
        'ventas_pausadas', 
        'asientos', 
        'inventory_audit',
        'gastos',
        'ingresos_caja',
        'retiros_caja',
        'pagos_fiados',
        'transacciones'
      ];

      for (const col of collectionsToDelete) {
         const qCol = query(collection(db, col));
         const snap = await getDocs(qCol);
         snap.forEach(d => deleteDoc(doc(db, col, d.id)));
      }
      
      alert("¡Listo! Toda la contabilidad ha sido borrada desde cero.");
      window.location.reload();
    } catch (e: any) {
      console.error(e);
      alert("Error borrando datos: " + e.message);
    }
  };

  const handleDeleteQueja = async (id: string) => {
    if (window.confirm("¿Estás seguro de que deseas eliminar esta queja/sugerencia sin responder?")) {
      try {
        const { deleteDocument } = await import('../../lib/dbUtils');
        await deleteDocument('quejas', id);
      } catch (err) {
        console.error("Error al eliminar queja:", err);
      }
    }
  };

  const handleAgradecerQueja = async (q: any) => {
    if (window.confirm(`¿Marcar como revisada y enviar mensaje de agradecimiento a ${q.cliente_nombre}?`)) {
      try {
        const { addDocument, deleteDocument } = await import('../../lib/dbUtils');
        await addDocument('mensajes', {
          cliente_id: q.cliente_id || 'todos',
          fecha: new Date().toISOString(),
          titulo: "Sugerencia Revisada por Administración",
          contenido: `Estimado(a) ${q.cliente_nombre}, su mensaje ha sido leído y revisado por la administración. ¡Muchas gracias por ayudarnos a mejorar nuestro servicio!`,
          leido: false
        });
        await deleteDocument('quejas', q.id);
        alert("Mensaje de agradecimiento enviado exitosamente.");
      } catch (err) {
        console.error("Error al agradecer queja:", err);
      }
    }
  };

  const handlePublishAviso = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!nuevoTitulo.trim() || !nuevoContenido.trim()) return;
    setPublicandoAviso(true);
    try {
      const { addDocument } = await import('../../lib/dbUtils');
      await addDocument('mensajes', {
        cliente_id: nuevoDestinatario === 'todos' ? 'todos' : nuevoDestinatario,
        fecha: new Date().toISOString(),
        titulo: nuevoTitulo.trim(),
        contenido: nuevoContenido.trim(),
        leido: false
      });
      setNuevoTitulo('');
      setNuevoContenido('');
      alert("Aviso publicado exitosamente en el portal.");
    } catch (err) {
      console.error(err);
      alert("Error al publicar aviso.");
    } finally {
      setPublicandoAviso(false);
    }
  };

  const handleDeleteAviso = async (id: string) => {
    if (window.confirm("¿Deseas retirar esta publicación del portal?")) {
      try {
        const { deleteDocument } = await import('../../lib/dbUtils');
        await deleteDocument('mensajes', id);
      } catch (err) {
        console.error(err);
      }
    }
  };

  const handleBulkDeleteAvisos = async () => {
    if (selectedAvisos.length === 0) return;
    if (window.confirm(`¿Deseas retirar ${selectedAvisos.length} publicación(es) del portal?`)) {
      try {
        const { deleteDocument } = await import('../../lib/dbUtils');
        for (const id of selectedAvisos) {
          await deleteDocument('mensajes', id);
        }
        setSelectedAvisos([]);
      } catch (err) {
        console.error(err);
      }
    }
  };

  const toggleAvisoSelection = (id: string) => {
    setSelectedAvisos(prev => prev.includes(id) ? prev.filter(aId => aId !== id) : [...prev, id]);
  };
  
  const toggleAllAvisos = () => {
    if (selectedAvisos.length === mensajesPortal.length && mensajesPortal.length > 0) {
      setSelectedAvisos([]);
    } else {
      setSelectedAvisos(mensajesPortal.map(m => m.id));
    }
  };

  const handleVideoFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 20 * 1024 * 1024) {
        alert("El video es demasiado pesado. Por favor sube un video de máximo 20MB.");
        return;
      }
      
      setCargandoVideoLocal(true);
      
      try {
        const { ref, uploadBytesResumable, getDownloadURL } = await import('firebase/storage');
        const { storage } = await import('../../lib/firebase');
        
        if (!storage || !storage.app) {
          alert("El almacenamiento en la nube no está disponible (modo local/mock). Pega un enlace directo en su lugar.");
          setCargandoVideoLocal(false);
          return;
        }

        const fileExt = file.name.split('.').pop() || 'mp4';
        const fileName = `propaganda_${Date.now()}.${fileExt}`;
        const storageRef = ref(storage, `videos/${fileName}`);
        
        const uploadTask = uploadBytesResumable(storageRef, file);
        
        uploadTask.on('state_changed', 
          (snapshot) => {
            // Se puede agregar progreso aquí si se desea
          }, 
          (error) => {
            console.error("Error al subir video:", error);
            alert("Error al subir el video a la nube. Revisa tu conexión.");
            setCargandoVideoLocal(false);
          }, 
          async () => {
            const downloadURL = await getDownloadURL(uploadTask.snapshot.ref);
            setPropagandaUrl(downloadURL);
            
            // Guardar automáticamente en la configuración de la base de datos
            const { updateDocument } = await import('../../lib/dbUtils');
            await updateDocument('configuracion', 'global', { propaganda_url: downloadURL });
            alert("Video comercial subido y guardado exitosamente en la nube.");
            setCargandoVideoLocal(false);
          }
        );
      } catch (err) {
        console.error("Error iniciando subida de video:", err);
        alert("Error al iniciar la subida del video.");
        setCargandoVideoLocal(false);
      }
    }
  };

  const handleSavePropagandaUrl = async (e: React.FormEvent) => {
    e.preventDefault();
    setGuardandoVideo(true);
    try {
      const { updateDocument } = await import('../../lib/dbUtils');
      await updateDocument('configuracion', 'global', { propaganda_url: propagandaUrl.trim() });
      alert("Enlace del video actualizado con éxito.");
    } catch (err) {
      console.error(err);
      alert("Error al guardar enlace.");
    } finally {
      setGuardandoVideo(false);
    }
  };

  // Build last 7 days chart data from real sales
  const weeklyData = (() => {
    const today = new Date();
    return Array.from({ length: 7 }, (_, i) => {
      const d = new Date(today);
      d.setDate(today.getDate() - (6 - i));
      const dateStr = d.toISOString().split('T')[0];
      const salesForDay = sales
        .filter(s => {
          const d = parseDate(s.createdAt || s.fecha || new Date());
          return d.toISOString().split('T')[0] === dateStr;
        })
        .reduce((acc, s) => acc + (s.total_usd || 0), 0);
      return { name: DAYS[d.getDay()], sales: parseFloat(salesForDay.toFixed(2)) };
    });
  })();

  const lowStockProducts = products.filter(p => p.stock < p.stock_minimo).slice(0, 5);
  const totalSalesToday = sales
    .filter(s => {
      const d = parseDate(s.createdAt || s.fecha || new Date());
      return d.toISOString().split('T')[0] === new Date().toISOString().split('T')[0];
    })
    .reduce((acc, curr) => acc + (curr.total_usd || 0), 0);
  const totalBs = totalSalesToday * 40.5;

  const handlePrintQR = () => {
    const svg = document.getElementById('qr-code-svg');
    if (!svg) return;
    const svgData = new XMLSerializer().serializeToString(svg);
    
    const printWindow = window.open('', '_blank');
    if (printWindow) {
        printWindow.document.write(`
            <html>
                <head><title>Imprimir QR</title></head>
                <body style="display:flex; flex-direction:column; align-items:center; justify-content:center; height:100vh; margin:0; text-align:center; -webkit-print-color-adjust: exact; print-color-adjust: exact;">
                    <h1 style="font-family:Arial, sans-serif; color:#000; font-size:48px; margin-bottom:10px; text-transform:uppercase;">Catálogo Digital</h1>
                    <h2 style="font-family:Arial, sans-serif; color:#444; font-size:24px; margin-bottom:50px;">KALUNEVA 2024</h2>
                    <div style="width:400px; height:400px;">
                        ${svgData.replace('width="100%"', 'width="100%"').replace('height="100%"', 'height="100%"')}
                    </div>
                    <p style="font-family:Arial, sans-serif; color:#000; font-size:22px; margin-top:50px; max-width:600px; font-weight:bold;">
                        Escanea este código con la cámara de tu teléfono para realizar pedidos directamente.
                    </p>
                    <script>
                        setTimeout(() => {
                            window.print();
                        }, 800);
                    </script>
                </body>
            </html>
        `);
        printWindow.document.close();
    }
  };

  const handlePrintCarnets = () => {
    const users = [
      { name: 'Diana Aponte', role: 'Cajera', pin: '1111', barcode: 'BARCODE-DIANA' },
      { name: 'Andres Eloy Aponte', role: 'Cajero', pin: '2222', barcode: 'BARCODE-ANDRES' },
      { name: 'Deisy Coromoto Corro', role: 'Administradora', pin: '3333', barcode: 'BARCODE-DEISY' },
      { name: 'Juan Carlos Domingues', role: 'Programador y Dueño', pin: '4444', barcode: 'BARCODE-JUAN' }
    ];

    const printWindow = window.open('', '_blank');
    if (printWindow) {
      printWindow.document.write(`
        <html>
          <head>
            <title>Imprimir Carnets</title>
            <script src="https://cdn.jsdelivr.net/npm/jsbarcode@3.11.0/dist/JsBarcode.all.min.js"></script>
            <style>
              body { font-family: 'Segoe UI', Arial, sans-serif; display: flex; flex-wrap: wrap; gap: 30px; padding: 40px; justify-content: center; background: #fff; margin: 0; }
              .carnet { 
                width: 250px; 
                height: 400px; 
                border: 2px solid #1e293b; 
                border-radius: 20px; 
                display: flex; 
                flex-direction: column; 
                align-items: center; 
                justify-content: space-between;
                box-sizing: border-box;
                page-break-inside: avoid;
                overflow: hidden;
                box-shadow: 0 10px 20px rgba(0,0,0,0.1);
                background: #fff;
              }
              .header { 
                text-align: center; 
                width: 100%; 
                background: #1e293b; 
                color: #fff;
                padding: 20px 10px;
                box-sizing: border-box;
              }
              .header h2 { margin: 0; font-size: 22px; text-transform: uppercase; letter-spacing: 2px; font-weight: 900; }
              .header p { margin: 5px 0 0 0; font-size: 10px; font-weight: bold; letter-spacing: 3px; color: #3498db; }
              .content { text-align: center; flex-grow: 1; display: flex; flex-direction: column; justify-content: center; padding: 0 15px; }
              .name { font-size: 20px; font-weight: 900; margin-bottom: 5px; color: #0f172a; line-height: 1.1; }
              .role { font-size: 12px; color: #64748b; text-transform: uppercase; font-weight: 800; margin-bottom: 15px; }
              .pin-box { background: #f1f5f9; color: #0f172a; padding: 8px 15px; border-radius: 8px; font-size: 12px; font-weight: 800; margin-bottom: 10px; border: 1px dashed #cbd5e1; }
              .barcode-container { margin-bottom: 20px; text-align: center; width: 100%; padding: 0 10px; box-sizing: border-box; }
              svg { max-width: 100%; height: auto; }
              
              @media print {
                body { padding: 0; background: none; }
                .carnet { box-shadow: none; border: 1px solid #000; }
                .header { background: #000; color: #fff; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
                .header p { color: #ccc; }
                .pin-box { background: #eee; border: 1px dashed #666; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
              }
            </style>
          </head>
          <body>
            ${users.map((u, i) => `
              <div class="carnet">
                <div class="header">
                  <h2>KALUNEVA</h2>
                  <p>CREDENCIAL PERSONAL</p>
                </div>
                <div class="content">
                  <div class="name">${u.name}</div>
                  <div class="role">${u.role}</div>
                  <div class="pin-box">PIN: ${u.pin}</div>
                </div>
                <div class="barcode-container">
                  <svg id="barcode-${i}"></svg>
                </div>
              </div>
            `).join('')}
            
            <script>
              ${users.map((u, i) => `
                JsBarcode("#barcode-${i}", "${u.barcode}", {
                  format: "CODE128",
                  width: 2,
                  height: 50,
                  displayValue: true,
                  fontSize: 12,
                  margin: 0,
                  fontOptions: "bold"
                });
              `).join('')}
              
              setTimeout(() => {
                window.print();
              }, 1000);
            </script>
          </body>
        </html>
      `);
      printWindow.document.close();
    }
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-1000 pb-20">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div className="flex items-center gap-4">
          <div>
            <h1 className="text-4xl font-black tracking-tight text-white flex items-center gap-4">
              <div className="p-2 bg-[#3498db]/10 rounded-2xl">
                <TrendingUp className="text-[#3498db]" size={32} />
              </div>
              CONTROL GERENCIAL
            </h1>
            <p className="text-gray-400 text-sm mt-1 font-medium">Panel administrativo de alto rendimiento • KALUNEVA 2024</p>
          </div>
          <div className="ml-4 flex items-center gap-3">
            <button 
              onClick={handleBackupDB}
              className="flex items-center gap-2 bg-blue-600/20 text-blue-400 hover:bg-blue-500 hover:text-white px-4 py-2 rounded-xl text-xs font-black uppercase transition-colors border border-blue-500/20"
              title="Descargar Respaldo"
            >
              <Download size={16} /> RESPALDO BD
            </button>
            <button 
              onClick={handleResetData}
              className="flex items-center gap-2 bg-red-600/20 text-red-500 hover:bg-red-500 hover:text-white px-4 py-2 rounded-xl text-xs font-black uppercase transition-colors border border-red-500/20"
              title="Borrar Toda la Contabilidad"
            >
              <Trash2 size={16} /> RESETEAR BD
            </button>
          </div>
        </div>
        <div className="flex items-center gap-4 bg-white/5 px-6 py-3 rounded-2xl border border-white/10 backdrop-blur-md">
          <Calendar size={20} className="text-[#f1c40f]" />
          <div className="flex flex-col">
            <span className="text-[10px] font-black text-gray-500 uppercase tracking-widest">Fecha Actual</span>
            <span className="text-sm font-bold text-white">{new Date().toLocaleDateString('es-VE', { day: 'numeric', month: 'long', year: 'numeric' })}</span>
          </div>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        <StatCard 
          title="Ventas del Día" 
          value={formatCurrency(totalSalesToday)} 
          icon={DollarSign} 
          trend={12.5} 
          color="bg-gradient-to-br from-green-500 to-green-600 shadow-lg shadow-green-500/20"
        />
        <StatCard 
          title="Recaudación (Bs)" 
          value={`Bs. ${totalBs.toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
          icon={TrendingUp} 
          trend={8.2} 
          color="bg-gradient-to-br from-blue-500 to-blue-600 shadow-lg shadow-blue-500/20"
        />
        <StatCard 
          title="Total Ventas" 
          value={`${sales.length} Ops.`}
          icon={Users} 
          trend={5.4} 
          color="bg-gradient-to-br from-purple-500 to-purple-600 shadow-lg shadow-purple-500/20"
        />
        <StatCard 
          title="Stock Crítico" 
          value={products.filter(p => p.stock < p.stock_minimo).length.toString()} 
          icon={AlertTriangle} 
          color="bg-gradient-to-br from-red-500 to-red-600 shadow-lg shadow-red-500/20"
        />
      </div>

      {/* Charts Section */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 bg-[#1e293b]/40 border border-white/10 rounded-[3rem] p-10 backdrop-blur-md relative overflow-hidden group">
          <div className="absolute top-0 right-0 w-64 h-64 bg-[#3498db]/5 rounded-full -translate-y-1/2 translate-x-1/2 blur-3xl group-hover:bg-[#3498db]/10 transition-colors duration-1000"></div>
          
          <div className="flex items-center justify-between mb-10">
            <div>
              <h2 className="text-2xl font-black text-white tracking-tighter">RENDIMIENTO SEMANAL</h2>
              <p className="text-xs text-gray-500 font-bold uppercase tracking-widest mt-1">Volumen de ventas transaccionales (USD)</p>
            </div>
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-[#3498db] shadow-[0_0_8px_#3498db]"></span>
              <span className="text-[10px] text-gray-400 uppercase font-black tracking-widest">Ingresos</span>
            </div>
          </div>
          
          <div className="h-[280px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={weeklyData}>
                <defs>
                  <linearGradient id="colorSales" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#3498db" stopOpacity={0.3}/>
                    <stop offset="95%" stopColor="#3498db" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(255,255,255,0.05)" />
                <XAxis 
                  dataKey="name" 
                  axisLine={false} 
                  tickLine={false} 
                  tick={{ fill: '#64748b', fontSize: 10, fontWeight: 800 }} 
                  dy={10}
                />
                <YAxis 
                  axisLine={false} 
                  tickLine={false} 
                  tick={{ fill: '#64748b', fontSize: 10, fontWeight: 800 }} 
                />
                <Tooltip 
                  contentStyle={{ 
                    backgroundColor: '#0f172a', 
                    border: '1px solid rgba(255,255,255,0.1)',
                    borderRadius: '16px',
                    fontSize: '12px',
                    fontWeight: 'bold',
                    boxShadow: '0 10px 25px rgba(0,0,0,0.5)'
                  }}
                  itemStyle={{ color: '#3498db' }}
                  cursor={{ stroke: '#3498db', strokeWidth: 2 }}
                  formatter={(val: any) => [`$${val}`, 'Ventas']}
                />
                <Area 
                  type="monotone" 
                  dataKey="sales" 
                  stroke="#3498db" 
                  strokeWidth={4}
                  fillOpacity={1} 
                  fill="url(#colorSales)" 
                  animationDuration={2000}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="bg-[#1e293b]/40 border border-white/10 rounded-[3rem] p-10 backdrop-blur-md flex flex-col">
          <h2 className="text-2xl font-black text-white tracking-tighter mb-8 uppercase">Top Vendidos</h2>
          <div className="space-y-6 flex-1">
            {topProducts.map((prod, idx) => (
              <div key={idx} className="flex items-center gap-5">
                <div className="w-10 h-10 rounded-2xl bg-white/5 border border-white/5 flex items-center justify-center font-black text-gray-500 text-xs flex-shrink-0">
                  0{idx + 1}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex justify-between items-end mb-2">
                    <span className="text-sm font-black text-white uppercase tracking-tight truncate">{prod.name}</span>
                    <span className="text-xs font-black text-[#2ecc71] ml-2 flex-shrink-0">{prod.sales}</span>
                  </div>
                  <div className="h-2 w-full bg-black/20 rounded-full overflow-hidden p-[2px] border border-white/5">
                    <motion.div 
                      initial={{ width: 0 }}
                      animate={{ width: `${(prod.sales / 120) * 100}%` }}
                      transition={{ duration: 1.5, delay: idx * 0.1 }}
                      className="h-full bg-gradient-to-r from-[#3498db] to-[#2ecc71] rounded-full shadow-[0_0_8px_rgba(52,152,219,0.5)]" 
                    />
                  </div>
                </div>
              </div>
            ))}
          </div>
          <Link to="/inventory" className="block w-full mt-10 py-5 bg-white/5 hover:bg-white/10 rounded-[2rem] text-[10px] font-black text-gray-400 hover:text-white transition-all border border-white/5 uppercase tracking-[4px] text-center">
            Ver Inventario
          </Link>
        </div>
      </div>

      {/* Alerts and Quick Actions */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        <div className="bg-red-500/5 border border-red-500/20 p-10 rounded-[3rem] backdrop-blur-sm">
          <div className="flex items-center justify-between mb-8">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-red-500 rounded-2xl shadow-lg shadow-red-500/20">
                <AlertTriangle size={24} className="text-white" />
              </div>
              <h2 className="text-2xl font-black text-white tracking-tighter uppercase">Alertas de Stock</h2>
            </div>
            <span className="bg-red-500 text-white text-[10px] font-black px-3 py-1 rounded-full">{lowStockProducts.length} ÍTEMS</span>
          </div>
          
          <div className="space-y-4">
            {lowStockProducts.length === 0 ? (
              <div className="text-center py-8 text-gray-500 text-sm font-bold">✅ Todo el stock en niveles normales</div>
            ) : lowStockProducts.map(p => (
              <div key={p.id} className="flex items-center justify-between p-5 bg-black/20 rounded-3xl border border-white/5 hover:border-red-500/30 transition-all cursor-pointer group">
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 rounded-xl bg-white/5 flex items-center justify-center font-bold text-red-400">
                    <ShoppingBag size={20} />
                  </div>
                  <div>
                    <div className="font-black text-sm text-white uppercase">{p.nombre}</div>
                    <div className="text-[10px] text-gray-500 font-bold tracking-widest uppercase">Reponer inmediato</div>
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-xl font-black text-red-500">{p.stock}</div>
                  <div className="text-[8px] text-gray-600 font-black uppercase">Mín: {p.stock_minimo}</div>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="bg-[#3498db]/5 border border-[#3498db]/20 p-10 rounded-[3rem] backdrop-blur-sm">
          <div className="flex items-center gap-4 mb-8">
            <div className="p-3 bg-[#3498db] rounded-2xl shadow-lg shadow-[#3498db]/20">
              <Zap size={24} className="text-white" fill="currentColor" />
            </div>
            <h2 className="text-2xl font-black text-white tracking-tighter uppercase">Accesos Directos</h2>
          </div>
          
          <div className="grid grid-cols-2 gap-4">
            {[
              { label: 'Punto de Venta', icon: ShoppingBag, path: '/pos', color: 'hover:bg-blue-500' },
              { label: 'Cargar Compra', icon: Plus, path: '/purchases', color: 'hover:bg-purple-500' },
              { label: 'Contabilidad', icon: Calculator, path: '/accounting', color: 'hover:bg-green-500' },
              { label: 'Cierre Diario', icon: FileText, path: '/closure', color: 'hover:bg-orange-500' }
            ].map((action) => (
              <Link key={action.label} to={action.path} className={cn(
                "p-6 bg-black/20 border border-white/5 rounded-3xl flex flex-col items-center justify-center gap-3 transition-all hover:scale-105 active:scale-95 group",
                action.color
              )}>
                <action.icon size={28} className="text-gray-500 group-hover:text-white transition-colors" />
                <span className="text-[9px] font-black text-gray-400 group-hover:text-white uppercase tracking-widest text-center leading-tight">{action.label}</span>
              </Link>
            ))}
          </div>
        </div>
      </div>

      {/* Buzón de Quejas y Sugerencias (Solo Dueño/Admin) */}
      {isAdmin && (
        <div className="bg-red-500/5 border border-red-500/20 p-10 rounded-[3rem] backdrop-blur-sm space-y-8">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-red-500 rounded-2xl shadow-lg shadow-red-500/20">
                <FileText size={24} className="text-white" />
              </div>
              <div>
                <h2 className="text-2xl font-black text-white tracking-tighter uppercase">Buzón de Quejas y Sugerencias</h2>
                <p className="text-xs text-gray-500 font-bold uppercase tracking-wider mt-0.5">Mensajes confidenciales enviados por los clientes</p>
              </div>
            </div>
            <span className="bg-red-500 text-white text-[10px] font-black px-3 py-1 rounded-full">{quejas.length} MENSAJES</span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {quejas.length === 0 ? (
              <div className="col-span-full text-center py-12 bg-black/20 rounded-3xl border border-white/5 text-gray-500 text-sm font-bold uppercase tracking-widest">
                ✅ No hay quejas o sugerencias registradas
              </div>
            ) : quejas.map(q => (
              <div key={q.id} className="p-6 bg-black/25 border border-white/5 rounded-3xl space-y-4 relative hover:border-red-500/30 transition-all flex flex-col justify-between">
                <div className="space-y-2">
                  <div className="flex justify-between items-start gap-4">
                    <div>
                      <h3 className="font-black text-white uppercase text-sm leading-snug">{q.titulo}</h3>
                      <p className="text-[10px] text-gray-500 font-bold uppercase mt-1">Por: {q.cliente_nombre} ({q.cliente_cedula})</p>
                    </div>
                    <span className="text-[9px] text-gray-500 font-bold shrink-0">{new Date(q.fecha).toLocaleDateString()}</span>
                  </div>
                  <p className="text-xs text-gray-300 font-bold leading-relaxed whitespace-pre-wrap">{q.mensaje}</p>
                </div>
                <div className="flex justify-end gap-3 border-t border-white/5 pt-3">
                  <button 
                    onClick={() => handleAgradecerQueja(q)}
                    className="text-[9px] font-black text-emerald-400 hover:text-emerald-300 uppercase tracking-widest bg-emerald-500/10 px-3 py-1.5 rounded-xl border border-emerald-500/20 active:scale-95 transition-all"
                  >
                    Revisado y Agradecer
                  </button>
                  <button 
                    onClick={() => handleDeleteQueja(q.id)}
                    className="text-[9px] font-black text-red-400 hover:text-red-300 uppercase tracking-widest bg-red-500/10 px-3 py-1.5 rounded-xl border border-red-500/20 active:scale-95 transition-all"
                  >
                    Eliminar
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Gestión del Portal de Clientes (Solo Dueño/Admin) */}
      {isAdmin && (
        <div className="bg-blue-500/5 border border-blue-500/20 p-10 rounded-[3rem] backdrop-blur-sm space-y-8">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-blue-500 rounded-2xl shadow-lg shadow-blue-500/20">
              <Users size={24} className="text-white" />
            </div>
            <div>
              <h2 className="text-2xl font-black text-white tracking-tighter uppercase">Administración del Portal</h2>
              <p className="text-xs text-gray-500 font-bold uppercase tracking-wider mt-0.5">Publica anuncios y gestiona la propaganda del portal del cliente</p>
            </div>
          </div>
          
          <div className="bg-[#1e293b] border border-blue-500/30 p-6 rounded-3xl flex flex-col md:flex-row items-center justify-between shadow-2xl gap-6">
            <div>
              <h3 className="text-sm font-black text-white uppercase tracking-wider mb-2">📲 Código QR del Catálogo</h3>
              <p className="text-[10px] text-gray-400 font-bold leading-relaxed max-w-sm mb-4">Muestra o imprime este código QR en formato cartel para que tus clientes puedan entrar al catálogo público directamente desde sus celulares sin necesidad de descargar ninguna aplicación.</p>
              <button 
                onClick={handlePrintQR}
                className="bg-blue-600 hover:bg-blue-500 text-white text-[10px] font-black uppercase px-4 py-2 rounded-xl transition-all shadow-lg shadow-blue-500/30 flex items-center gap-2"
              >
                <span>🖨️ Imprimir / Guardar en PDF</span>
              </button>
            </div>
            <div className="bg-white p-3 rounded-2xl shadow-xl hover:scale-105 transition-transform cursor-pointer" title="Abrir catálogo" onClick={() => window.open(window.location.origin + '/catalogo', '_blank')}>
              <QRCode id="qr-code-svg" value={`${window.location.origin}/catalogo`} size={100} level="H" />
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            {/* Panel de Creación */}
            <div className="space-y-6">
              {/* Formulario Anuncios */}
              <form onSubmit={handlePublishAviso} className="bg-black/20 p-6 rounded-3xl border border-white/5 space-y-4">
                <h3 className="text-sm font-black text-white uppercase tracking-wider">📢 Publicar Nuevo Aviso / Mensaje</h3>
                
                <div className="space-y-1.5">
                  <label className="text-[10px] text-gray-500 font-bold uppercase tracking-wider">Destinatario</label>
                  <select 
                    className="w-full bg-[#151f32] border border-white/10 rounded-xl p-3 text-xs font-bold text-white outline-none focus:border-blue-500"
                    value={nuevoDestinatario}
                    onChange={e => setNuevoDestinatario(e.target.value)}
                  >
                    <option value="todos">🌟 Todos los Clientes (Aviso General)</option>
                    {clients.map(c => (
                      <option key={c.id} value={c.id}>👤 {c.nombre} ({c.cedula})</option>
                    ))}
                  </select>
                </div>

                <div className="space-y-1.5">
                  <label className="text-[10px] text-gray-500 font-bold uppercase tracking-wider">Título del Aviso</label>
                  <input 
                    type="text" 
                    placeholder="Ej. Promoción de Queso Llanero, Ajuste de Tasa..."
                    className="w-full bg-black/40 border border-white/10 rounded-xl p-3 text-xs font-bold text-white focus:border-blue-500 outline-none"
                    value={nuevoTitulo}
                    onChange={e => setNuevoTitulo(e.target.value)}
                    required
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-[10px] text-gray-500 font-bold uppercase tracking-wider">Contenido del Mensaje</label>
                  <textarea 
                    placeholder="Escribe el mensaje informativo aquí..."
                    className="w-full bg-black/40 border border-white/10 rounded-xl p-3 text-xs font-bold text-white focus:border-blue-500 outline-none h-24 resize-none"
                    value={nuevoContenido}
                    onChange={e => setNuevoContenido(e.target.value)}
                    required
                  />
                </div>

                <button 
                  type="submit" 
                  disabled={publicandoAviso || !nuevoTitulo.trim() || !nuevoContenido.trim()}
                  className="w-full py-3 bg-blue-600 hover:bg-blue-500 text-white font-black uppercase tracking-widest rounded-xl text-xs active:scale-[0.98] transition-all disabled:opacity-50"
                >
                  {publicandoAviso ? 'Publicando...' : 'Publicar Anuncio'}
                </button>
              </form>

              {/* Formulario Propaganda */}
              <form onSubmit={handleSavePropagandaUrl} className="bg-black/20 p-6 rounded-3xl border border-white/5 space-y-4">
                <h3 className="text-sm font-black text-white uppercase tracking-wider">📺 Video de Propaganda Comercial</h3>
                
                <p className="text-[10px] text-gray-400 font-medium leading-relaxed bg-white/5 p-3 rounded-xl border border-white/5">
                  <strong>Nota:</strong> Puedes ingresar una URL directa de la web o utilizar el botón <strong>"Examinar Carpetas"</strong> para elegir un video local. El sistema procesa el archivo y lo sincroniza en tiempo real con el portal de clientes.
                </p>

                <div className="space-y-1.5">
                  <label className="text-[10px] text-gray-500 font-bold uppercase tracking-wider block">Seleccionar Archivo de Video desde PC</label>
                  <div className="relative">
                    <input 
                      type="file"
                      accept="video/*"
                      className="hidden"
                      id="propaganda-video-upload"
                      onChange={handleVideoFileChange}
                      disabled={cargandoVideoLocal}
                    />
                    <label 
                      htmlFor="propaganda-video-upload"
                      className="w-full bg-white/5 hover:bg-white/10 border border-dashed border-white/10 rounded-xl py-3 px-4 flex items-center justify-center gap-2 cursor-pointer text-center text-xs font-bold text-gray-400 hover:text-white transition-colors"
                    >
                      {cargandoVideoLocal ? (
                        <span className="w-4 h-4 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
                      ) : propagandaUrl.startsWith('data:video/') ? (
                        <span className="text-emerald-400">✓ Video Cargado desde PC</span>
                      ) : (
                        <span>📁 Examinar Carpetas / Seleccionar Video</span>
                      )}
                    </label>
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="text-[10px] text-gray-500 font-bold uppercase tracking-wider block">O Enlace de Video (URL)</label>
                  <input 
                    type="text" 
                    placeholder="O ingresa la URL de un video en la web..."
                    className="w-full bg-black/40 border border-white/10 rounded-xl p-3 text-xs font-bold text-white focus:border-blue-500 outline-none"
                    value={propagandaUrl.startsWith('data:video/') ? '' : propagandaUrl}
                    onChange={e => setPropagandaUrl(e.target.value)}
                  />
                </div>
                
                <button 
                  type="submit" 
                  disabled={guardandoVideo || cargandoVideoLocal}
                  className="w-full py-3 bg-emerald-600 hover:bg-emerald-500 text-white font-black uppercase tracking-widest rounded-xl text-xs active:scale-[0.98] transition-all disabled:opacity-50"
                >
                  {guardandoVideo ? 'Guardando...' : 'Actualizar Video de Propaganda'}
                </button>
              </form>
            </div>

            {/* Listado de Anuncios Activos */}
            <div className="bg-black/20 p-6 rounded-3xl border border-white/5 flex flex-col h-[460px] overflow-hidden relative">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3">
                  <h3 className="text-sm font-black text-white uppercase tracking-wider">Avisos Activos en el Portal</h3>
                  {mensajesPortal.length > 0 && (
                    <button 
                      onClick={toggleAllAvisos}
                      className="text-[9px] font-black text-blue-400 hover:text-blue-300 uppercase tracking-widest bg-blue-500/10 px-2 py-1 rounded-lg border border-blue-500/20 active:scale-95 transition-all"
                    >
                      {selectedAvisos.length === mensajesPortal.length ? 'Desmarcar Todos' : 'Marcar Todos'}
                    </button>
                  )}
                </div>
                {selectedAvisos.length > 0 && (
                  <button 
                    onClick={handleBulkDeleteAvisos}
                    className="text-[10px] flex items-center gap-1 font-black text-white uppercase tracking-widest bg-red-600 hover:bg-red-500 px-3 py-1.5 rounded-xl shadow-lg shadow-red-500/30 active:scale-95 transition-all animate-in fade-in zoom-in"
                  >
                    <Trash2 size={12} /> Borrar Marcados ({selectedAvisos.length})
                  </button>
                )}
              </div>
              <div className="space-y-3 flex-1 overflow-y-auto pr-1">
                {mensajesPortal.length === 0 ? (
                  <div className="text-center py-20 text-gray-500 text-xs font-bold uppercase">No hay avisos publicados</div>
                ) : mensajesPortal.map(m => {
                  const dest = m.cliente_id === 'todos' ? 'Todos los Clientes' : clients.find(c => c.id === m.cliente_id)?.nombre || 'Cliente Específico';
                  const isSelected = selectedAvisos.includes(m.id);
                  return (
                    <div 
                      key={m.id} 
                      onClick={() => toggleAvisoSelection(m.id)}
                      className={cn(
                        "p-4 rounded-2xl border space-y-2 relative transition-all flex flex-col justify-between cursor-pointer",
                        isSelected 
                          ? "bg-red-500/10 border-red-500/30" 
                          : "bg-black/30 border-white/5 hover:border-white/10"
                      )}
                    >
                      <div>
                        <div className="flex justify-between items-start gap-4">
                          <div className="flex items-center gap-2">
                            <div className={cn(
                              "w-4 h-4 rounded flex items-center justify-center border transition-colors",
                              isSelected ? "bg-red-500 border-red-500 text-white" : "border-gray-500"
                            )}>
                              {isSelected && <span className="text-[10px] font-bold">✓</span>}
                            </div>
                            <span className="text-[8px] font-black uppercase tracking-widest text-blue-400 bg-blue-500/10 px-2 py-0.5 rounded-full inline-block">Para: {dest}</span>
                          </div>
                          <span className="text-[8px] text-gray-500 font-bold">{new Date(m.fecha).toLocaleDateString()}</span>
                        </div>
                        <h4 className="font-bold text-white text-xs mt-2 uppercase">{m.titulo}</h4>
                        <p className="text-[10px] text-gray-400 font-bold leading-relaxed">{m.contenido}</p>
                      </div>
                      <div className="flex justify-end pt-2 border-t border-white/5">
                        <button 
                          onClick={(e) => { e.stopPropagation(); handleDeleteAviso(m.id); }}
                          className="text-[8px] font-black text-red-400 hover:text-red-300 uppercase tracking-widest bg-red-500/10 px-2.5 py-1 rounded-lg border border-red-500/20 active:scale-95 transition-all"
                        >
                          Retirar Solo Este
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};

export default DashboardScreen;
