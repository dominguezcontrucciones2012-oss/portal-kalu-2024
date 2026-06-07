import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Search, 
  ShoppingCart, 
  User, 
  Trash2, 
  CreditCard, 
  DollarSign, 
  CheckCircle,
  UserPlus,
  ArrowRight,
  Info,
  AlertCircle,
  ShieldCheck,
  RotateCcw,
  Plus,
  Minus,
  Pause,
  Play,
  X,
  LogIn
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { cn, formatCurrency } from '../../lib/utils';
import { 
  subscribeToCollection, 
  createSale, 
  updateStock, 
  getLatestTasa, 
  pauseSale, 
  deletePausedSale,
  updateDocument,
  addDocument,
  deleteDocument
} from '../../lib/dbUtils';
import { useAuth } from '../../contexts/AuthProvider';
import { type Product, type Client, Role, type VentaPausada, type Sale } from '../../types';
import { useToast } from '../../contexts/ToastProvider';
import SupervisorCodeModal from '../common/SupervisorCodeModal';

interface CartItem extends Product {
  quantity: number;
  finalPrice: number;
}

const POSScreen: React.FC = () => {
  const { user } = useAuth();
  const { addToast } = useToast();
  const navigate = useNavigate();
  const searchInputRef = React.useRef<HTMLInputElement>(null);
  
  // -- ESTADOS --
  const [products, setProducts] = useState<Product[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedClient, setSelectedClient] = useState<Client | null>(null);
  const [clientSearch, setClientSearch] = useState('');
  const [isPaying, setIsPaying] = useState(false);
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const [pausedSales, setPausedSales] = useState<VentaPausada[]>([]);
  const [tasaBCV, setTasaBCV] = useState(40.50);
  const [isFiado, setIsFiado] = useState(false);
  
  // Estados para Pedidos Online/Web
  const [sales, setSales] = useState<Sale[]>([]);
  const [loadedWebOrderId, setLoadedWebOrderId] = useState<string | null>(null);
  const [showWebOrdersModal, setShowWebOrdersModal] = useState(false);

  const [paymentAmounts, setPaymentAmounts] = useState({
    pago_efectivo_usd: 0,
    pago_efectivo_bs: 0,
    pago_movil_bs: 0,
    pago_transferencia_bs: 0,
    biopago_bdv: 0,
    pago_debito_bs: 0,
    pago_otros_usd: 0,
    referencia: '',
    aprobacion_punto: ''
  });
  
  const [isVerifying, setIsVerifying] = useState(false);
  const [webOrdersTab, setWebOrdersTab] = useState<'pedidos' | 'abonos'>('pedidos');

  const loadedOrder = loadedWebOrderId ? sales.find(s => s.id === loadedWebOrderId) : null;
  const esAbonoWeb = !!(loadedOrder && (loadedOrder as any).tipo_transaccion === 'abono');

  // -- CÁLCULOS --
  const totalUSD = esAbonoWeb
    ? (Number((loadedOrder as any).monto_abono_usd) || 0)
    : cart.reduce((acc, curr) => acc + (Number(curr.finalPrice || 0) * Number(curr.quantity || 0)), 0);
  const totalBs = totalUSD * tasaBCV;
  
  const totalPaidUSD = 
    (paymentAmounts.pago_efectivo_usd || 0) + 
    (paymentAmounts.pago_otros_usd || 0) + 
    (((paymentAmounts.pago_efectivo_bs || 0) + 
      (paymentAmounts.pago_movil_bs || 0) + 
      (paymentAmounts.pago_transferencia_bs || 0) + 
      (paymentAmounts.biopago_bdv || 0) + 
      (paymentAmounts.pago_debito_bs || 0)) / (tasaBCV || 1));

  const changeUSD = esAbonoWeb ? 0 : Math.max(0, totalPaidUSD - totalUSD);
  const productWebOrders = sales.filter((s: any) => s.origen === 'web' && s.status_pedido !== 'entregado' && s.tipo_transaccion !== 'abono');
  const abonoReports = sales.filter((s: any) => s.origen === 'web' && s.status_pedido !== 'entregado' && s.tipo_transaccion === 'abono');

  // -- SINCRONIZACIÓN DE CAJERO ACTIVO --
  useEffect(() => {
    if (user && (user.role === Role.CAJERO || user.role === Role.ADMIN || user.role === Role.SUPERVISOR || user.role === Role.DUENO)) {
      updateDocument('configuracion', 'global', { cajero_activo: user.username })
        .catch(err => console.error("Error setting active cashier:", err));
    }
  }, [user]);

  // -- CARGA DE DATOS --
  useEffect(() => {
    const unsubProducts = subscribeToCollection('products', (data) => setProducts(data));
    const unsubClients = subscribeToCollection('clients', (data) => setClients(data));
    const unsubPaused = subscribeToCollection('ventas_pausadas', (data) => setPausedSales(data));
    const unsubSales = subscribeToCollection('sales', (data) => setSales(data as Sale[]));
    
    const unsubTasa = subscribeToCollection('tasas_bcv', (data) => {
      if (data && data.length > 0) {
        const sorted = data.sort((a: any, b: any) => {
          const fechaCmp = (b.fecha || '').localeCompare(a.fecha || '');
          if (fechaCmp !== 0) return fechaCmp;
          return (b.sincronizadoEn || '').localeCompare(a.sincronizadoEn || '');
        });
        setTasaBCV(Number(sorted[0].valor) || 40.50);
      }
    });

    // Mapa de Teclas Rápidas (F1 en adelante)
    const handleKeyDown = (e: KeyboardEvent) => {
      const activeKeys = ['F1', 'F2', 'F3', 'F4', 'F8', 'F10'];
      if (activeKeys.includes(e.key)) {
        e.preventDefault();
      }

      switch (e.key) {
        case 'F1': searchInputRef.current?.focus(); break;
        case 'F2': document.getElementById('cliente_search_input')?.focus(); break;
        case 'F3': pauseCurrentSale(); break;
        case 'F4': setIsAuthModalOpen(true); break;
        case 'F8': document.getElementById('pago_efectivo_usd_input')?.focus(); break;
        case 'F10': handleFinalize(); break;
      }
    };
    window.addEventListener('keydown', handleKeyDown);

    return () => {
      unsubProducts();
      unsubClients();
      unsubPaused();
      unsubSales();
      unsubTasa();
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [cart, totalPaidUSD, totalUSD, selectedClient, isFiado, isPaying, paymentAmounts]); // Dependencies for keyboard actions

  // Reset payment amounts if cart changes to avoid stuck/incorrect values
  useEffect(() => {
    setPaymentAmounts({
      pago_efectivo_usd: 0,
      pago_efectivo_bs: 0,
      pago_movil_bs: 0,
      pago_transferencia_bs: 0,
      biopago_bdv: 0,
      pago_debito_bs: 0,
      pago_otros_usd: 0,
      referencia: '',
      aprobacion_punto: ''
    });
  }, [cart]);

  // -- FILTROS --
  const filteredProducts = products.filter(p => 
    (p.nombre || '').toLowerCase().includes(searchQuery.toLowerCase()) || 
    String(p.codigo || '').includes(searchQuery)
  ).slice(0, 5);

  const filteredClients = clients.filter(c => 
    (c.nombre || '').toLowerCase().includes(clientSearch.toLowerCase()) || 
    String(c.cedula || '').includes(clientSearch)
  ).slice(0, 5);

  // -- ACCIONES --
  const addToCart = (product: Product) => {
    if (product.stock <= 0) {
      addToast('error', 'Producto sin stock');
      return;
    }
    const existing = cart.find(item => item.id === product.id);
    if (existing) {
      if (existing.quantity >= product.stock) {
        addToast('warning', 'Máximo stock alcanzado');
        return;
      }
      setCart(cart.map(item => 
        item.id === product.id ? { ...item, quantity: item.quantity + 1 } : item
      ));
    } else {
      setCart([...cart, { ...product, quantity: 1, finalPrice: product.precio_oferta_usd || product.precio_normal_usd }]);
    }
    setSearchQuery('');
    setTimeout(() => searchInputRef.current?.focus(), 10);
  };

  const pauseCurrentSale = async () => {
    if (cart.length === 0) return;
    try {
      await pauseSale({
        fecha: new Date().toISOString(),
        cliente_id: selectedClient?.id || null,
        cliente_nombre_manual: selectedClient?.nombre || 'Consumidor Final',
        cliente_tipo: 'consumidor',
        total_usd: totalUSD,
        detalles: cart.map(i => ({
          producto_id: i.id,
          nombre: i.nombre,
          cantidad: i.quantity,
          precio_unitario_usd: i.finalPrice
        })),
        user_id: 'current-user'
      });
      setCart([]);
      setSelectedClient(null);
      addToast('success', 'Venta pausada');
    } catch (err) {
      addToast('error', 'Error al pausar');
    }
  };

  const resumeSaleFromDB = async (pausada: VentaPausada) => {
    const itemsParaCarrito: CartItem[] = pausada.detalles.map(d => {
      const p = products.find(prod => prod.id === d.producto_id);
      return {
        id: d.producto_id,
        nombre: d.nombre,
        quantity: d.cantidad,
        finalPrice: d.precio_unitario_usd,
        codigo: p?.codigo || 'N/A',
        categoria: p?.categoria || 'General',
        costo_usd: p?.costo_usd || 0,
        precio_normal_usd: p?.precio_normal_usd || d.precio_unitario_usd,
        stock: p?.stock || 0,
        stock_minimo: p?.stock_minimo || 0,
        unidad_medida: p?.unidad_medida || 'Unid'
      } as CartItem;
    });

    setCart(itemsParaCarrito);
    if (pausada.cliente_id) {
      const client = clients.find(c => c.id === pausada.cliente_id);
      if (client) setSelectedClient(client);
    }
    await deletePausedSale(pausada.id);
    addToast('info', 'Venta retomada');
  };

  const handleFinalize = async () => {
    if (isPaying || (cart.length === 0 && !esAbonoWeb)) return;
    setIsPaying(true);
    try {
      const saleData = {
        fecha: new Date().toISOString(),
        cliente_id: selectedClient?.id || null,
        nombre_cliente: selectedClient?.nombre || 'Consumidor Final',
        total_usd: totalUSD,
        tasa_momento: tasaBCV,
        es_fiado: esAbonoWeb ? false : isFiado,
        pagada: esAbonoWeb ? true : (totalPaidUSD >= totalUSD - 0.01),
        detalles: esAbonoWeb 
          ? [{ producto_id: 'abono', nombre: `Reporte de Abono - ${selectedClient?.nombre || 'Cliente'}`, cantidad: 1, precio_unitario_usd: 0 }]
          : cart.map(i => ({ producto_id: i.id, nombre: i.nombre, cantidad: i.quantity, precio_unitario_usd: i.finalPrice })),
        ...paymentAmounts,
        vuelto_entregado_usd: esAbonoWeb ? 0 : changeUSD,
        saldo_pendiente_usd: esAbonoWeb ? 0 : Math.max(0, totalUSD - totalPaidUSD),
        user_id: 'current-user',
        ...(esAbonoWeb ? {
          tipo_transaccion: 'abono',
          monto_abono_usd: (loadedOrder as any).monto_abono_usd || 
                           ((paymentAmounts.pago_movil_bs || paymentAmounts.pago_transferencia_bs) / tasaBCV)
        } : {})
      };

      if (loadedWebOrderId) {
        const loadedOrder = sales.find(s => s.id === loadedWebOrderId);
        const esAbono = loadedOrder && (loadedOrder as any).tipo_transaccion === 'abono';
        
        if (esAbono) {
          const montoAbono = (loadedOrder as any).monto_abono_usd || 
                             ((loadedOrder.pago_movil_bs || loadedOrder.pago_transferencia_bs || 0) / (loadedOrder.tasa_momento || tasaBCV));
          if (selectedClient && montoAbono > 0) {
            const nuevoSaldo = parseFloat(Math.max(0, (selectedClient.saldo_usd || 0) - montoAbono).toFixed(2));
            await updateDocument('clients', selectedClient.id, {
              saldo_usd: nuevoSaldo
            });
          }
        }

        // Actualizar pedido web existente
        await updateDocument('sales', loadedWebOrderId, {
          ...saleData,
          // Solo marcamos como entregado automáticamente si NO era un pedido web normal (ej. es un abono) o si el negocio así lo decide,
          // pero para web orders normales debe seguir su flujo en Despacho
          status_pedido: esAbono ? 'entregado' : (loadedOrder?.status_pedido || 'pendiente'),
          pagada: esAbono ? true : (totalPaidUSD >= totalUSD - 0.01)
        });
        if (esAbono) {
          addToast('success', 'Abono Reportado Validado y Procesado Exitosamente');
        } else {
          addToast('success', 'Pedido Web Procesado Exitosamente (Enviado a Despacho)' + (changeUSD > 0 ? ` - Vuelto: $${changeUSD.toFixed(2)}` : ''));
        }
      } else {
        // Venta directa normal: crear nueva y descontar stock
        await createSale(saleData);
        for (const item of cart) {
          await updateStock(item.id, item.quantity);
        }
        addToast('success', 'Venta Exitosa' + (changeUSD > 0 ? ` - Entregar vuelto de $${changeUSD.toFixed(2)}` : ''));
      }

      // 1. Actualizar deuda/puntos del cliente para compras POS directas
      if (selectedClient && !loadedWebOrderId) {
        const saldoPendiente = Math.max(0, totalUSD - totalPaidUSD);
        const nuevosPuntos = (selectedClient.puntos || 0) + Math.round(totalUSD);
        if (isFiado && saldoPendiente > 0) {
          const nuevoSaldo = parseFloat(((selectedClient.saldo_usd || 0) + saldoPendiente).toFixed(2));
          await updateDocument('clients', selectedClient.id, {
            saldo_usd: nuevoSaldo,
            puntos: nuevosPuntos
          });
        } else {
          await updateDocument('clients', selectedClient.id, {
            puntos: nuevosPuntos
          });
        }
      }

      // 2. Enviar mensaje de notificación directa al usuario del cliente
      if (selectedClient) {
        const today = new Date().toISOString();
        if (loadedWebOrderId) {
          const loadedOrder = sales.find(s => s.id === loadedWebOrderId);
          const esInmediato = (loadedOrder as any)?.metodo_pago === 'inmediato';
          await addDocument('mensajes', {
            cliente_id: selectedClient.id,
            fecha: today,
            titulo: "📦 Pedido Web Entregado",
            contenido: esInmediato
              ? `Tu pedido web #${loadedWebOrderId.substring(0,8)} por un total de $${totalUSD.toFixed(2)} ha sido validado y entregado. ¡Gracias por preferirnos!`
              : `Tu pedido web #${loadedWebOrderId.substring(0,8)} por un total de $${totalUSD.toFixed(2)} ha sido entregado y cargado en tu saldo deudor.`,
            leido: false
          });
        } else {
          await addDocument('mensajes', {
            cliente_id: selectedClient.id,
            fecha: today,
            titulo: isFiado ? "⚠️ Compra a Crédito Registrada" : "✅ Compra Confirmada",
            contenido: isFiado
              ? `Se ha registrado una compra a crédito en tienda por un total de $${totalUSD.toFixed(2)}. Saldo restante pendiente: $${(totalUSD - totalPaidUSD).toFixed(2)}.`
              : `Tu compra en tienda por un total de $${totalUSD.toFixed(2)} ha sido cobrada y confirmada. ¡Gracias por tu compra!`,
            leido: false
          });
        }
      }

      setCart([]);
      setSelectedClient(null);
      setIsFiado(false);
      setLoadedWebOrderId(null);
      setPaymentAmounts({
        pago_efectivo_usd: 0,
        pago_efectivo_bs: 0,
        pago_movil_bs: 0,
        pago_transferencia_bs: 0,
        biopago_bdv: 0,
        pago_debito_bs: 0,
        pago_otros_usd: 0,
        referencia: '',
        aprobacion_punto: ''
      });
    } catch (err) {
      addToast('error', 'Error al guardar');
    } finally {
      setIsPaying(false);
    }
  };

  const handleMarkAsReady = async (orderId: string) => {
    try {
      await updateDocument('sales', orderId, { status_pedido: 'listo' });
      addToast('success', 'Pedido marcado como listo. Se notificó al vecino.');
    } catch (err) {
      addToast('error', 'Error al actualizar pedido.');
    }
  };

  const handleLoadWebOrder = (order: any) => {
    const itemsParaCarrito = (order.detalles || []).map((d: any) => {
      const p = products.find(prod => prod.id === d.producto_id);
      return {
        id: d.producto_id,
        nombre: d.nombre,
        quantity: d.cantidad,
        finalPrice: d.precio_unitario_usd,
        codigo: p?.codigo || 'N/A',
        categoria: p?.categoria || 'General',
        costo_usd: p?.costo_usd || 0,
        precio_normal_usd: p?.precio_normal_usd || d.precio_unitario_usd,
        stock: p?.stock || 0,
        stock_minimo: p?.stock_minimo || 0,
        unidad_medida: p?.unidad_medida || 'Unid'
      } as CartItem;
    });
    setCart(itemsParaCarrito);
    let clientToSelect: Client | null = null;

    // 1. Intentar buscar por ID y validar que el nombre coincida
    if (order.cliente_id) {
      const client = clients.find(c => c.id === order.cliente_id);
      if (client && order.nombre_cliente && client.nombre.toLowerCase().trim() === order.nombre_cliente.toLowerCase().trim()) {
        clientToSelect = client;
      }
    }

    // 2. Si no coincide o no se encontró por ID, buscar por nombre
    if (!clientToSelect && order.nombre_cliente) {
      const clientByName = clients.find(c => 
        c.nombre && c.nombre.toLowerCase().trim() === order.nombre_cliente.toLowerCase().trim()
      );
      if (clientByName) {
        clientToSelect = clientByName;
      } else {
        // 3. Si no, buscar por cédula
        const clientByCedula = clients.find(c => c.cedula === order.nombre_cliente);
        if (clientByCedula) {
          clientToSelect = clientByCedula;
        }
      }
    }

    setSelectedClient(clientToSelect);
    setLoadedWebOrderId(order.id);
    setIsFiado(order.es_fiado || false);
    
    // Auto-completar los datos de pago si el cliente pagó de una vez en el portal o es un abono
    if (order.metodo_pago === 'inmediato' || order.tipo_transaccion === 'abono') {
      setPaymentAmounts({
        pago_efectivo_usd: 0,
        pago_efectivo_bs: 0,
        pago_movil_bs: order.pago_movil_bs || 0,
        pago_transferencia_bs: order.pago_transferencia_bs || 0,
        biopago_bdv: 0,
        pago_debito_bs: 0,
        pago_otros_usd: 0,
        referencia: order.referencia || '',
        aprobacion_punto: ''
      });
    } else {
      setPaymentAmounts({
        pago_efectivo_usd: 0,
        pago_efectivo_bs: 0,
        pago_movil_bs: 0,
        pago_transferencia_bs: 0,
        biopago_bdv: 0,
        pago_debito_bs: 0,
        pago_otros_usd: 0,
        referencia: '',
        aprobacion_punto: ''
      });
    }

    setShowWebOrdersModal(false);
    addToast('info', `Pedido de ${order.nombre_cliente} cargado en caja.`);
  };

  // Función inteligente para auto-completar el pago al enfocar
  const handlePaymentFocus = (field: keyof typeof paymentAmounts) => {
    if (paymentAmounts[field] !== 0) return; // Si ya tiene monto, no sobreescribir
    
    // Calcular cuánto falta por pagar en USD
    const otherPaymentsUSD = 
      (field === 'pago_efectivo_usd' ? 0 : paymentAmounts.pago_efectivo_usd) +
      (field === 'pago_otros_usd' ? 0 : paymentAmounts.pago_otros_usd) +
      ((
        (field === 'pago_efectivo_bs' ? 0 : paymentAmounts.pago_efectivo_bs) +
        (field === 'pago_movil_bs' ? 0 : paymentAmounts.pago_movil_bs) +
        (field === 'pago_transferencia_bs' ? 0 : paymentAmounts.pago_transferencia_bs) +
        (field === 'biopago_bdv' ? 0 : paymentAmounts.biopago_bdv) +
        (field === 'pago_debito_bs' ? 0 : paymentAmounts.pago_debito_bs)
      ) / tasaBCV);

    const remainingUSD = Math.max(0, totalUSD - otherPaymentsUSD);

    if (remainingUSD > 0) {
      const isBsField = String(field).includes('_bs') || field === 'biopago_bdv';
      const newValue = isBsField ? parseFloat((remainingUSD * tasaBCV).toFixed(2)) : parseFloat(remainingUSD.toFixed(2));
      
      setPaymentAmounts(prev => ({ ...prev, [field]: newValue }));
    }
  };

  return (
    <motion.div 
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="grid grid-cols-1 lg:grid-cols-12 gap-8 min-h-full pb-20"
    >
      {/* Columna Izquierda: Productos y Carrito */}
      <div className="lg:col-span-8 flex flex-col gap-6">
        <div className="bg-white/5 border border-white/10 p-4 rounded-3xl relative backdrop-blur-xl z-40">
          <div className="absolute left-4 top-1/2 -translate-y-1/2 flex items-center gap-2">
            <span className="text-[10px] font-black bg-white/10 px-1.5 py-0.5 rounded text-gray-400">F1</span>
            <Search className="text-gray-500" size={18} />
          </div>
          <input 
            ref={searchInputRef}
            id="product_search_input"
            type="text"
            className="w-full bg-black/20 border border-white/10 rounded-2xl py-4 pl-20 pr-4 font-bold text-white focus:border-blue-500/50 outline-none transition-all"
            placeholder="Buscar producto..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            onKeyDown={e => {
              if (e.key === 'Enter' && filteredProducts.length > 0) {
                addToCart(filteredProducts[0]);
              }
            }}
          />
          <AnimatePresence>
            {searchQuery && (
              <motion.div 
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="absolute top-full left-0 right-0 mt-2 bg-[#1e293b] border border-white/10 rounded-2xl shadow-2xl z-50 overflow-hidden backdrop-blur-2xl"
              >
                {filteredProducts.map(p => (
                  <button 
                    key={p.id} 
                    onClick={() => addToCart(p)} 
                    className="w-full p-4 flex items-center justify-between hover:bg-white/5 text-left border-b border-white/5 last:border-0 transition-colors"
                  >
                    <div>
                      <div className="font-bold text-white">{p.nombre}</div>
                      <div className="text-[10px] text-gray-500 font-black uppercase tracking-widest">
                        Cod: {p.codigo} — <span className={p.stock < p.stock_minimo ? "text-red-400" : "text-blue-400"}>Stock: {p.stock}</span>
                      </div>
                    </div>
                    <div className="text-[#2ecc71] font-black text-lg">{formatCurrency(p.precio_oferta_usd || p.precio_normal_usd)}</div>
                  </button>
                ))}
                {filteredProducts.length === 0 && (
                  <div className="p-8 text-center text-gray-500 font-bold uppercase text-xs tracking-[4px]">Sin resultados</div>
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        <div className="flex-1 bg-white/5 border border-white/10 rounded-[2.5rem] flex flex-col overflow-hidden backdrop-blur-xl">
          <div className="p-6 border-b border-white/5 bg-black/20 flex justify-between items-center">
            <h2 className="font-black flex items-center gap-3 text-sm tracking-[2px] uppercase">
              <div className="p-2 bg-blue-500/10 rounded-xl">
                <ShoppingCart size={18} className="text-blue-400"/>
              </div>
              Cesta de Venta
            </h2>
            <div className="flex items-center gap-3">
              <button 
                onClick={() => setShowWebOrdersModal(true)}
                className="text-[10px] font-black text-green-400 bg-green-500/10 px-4 py-2 rounded-xl hover:bg-green-500 hover:text-white transition-all uppercase tracking-widest border border-green-500/20 flex items-center gap-1.5"
              >
                <span>📦 Pedidos Web</span>
                {(productWebOrders.length + abonoReports.length) > 0 && (
                  <span className="w-5 h-5 bg-red-500 text-white rounded-full flex items-center justify-center font-black text-[9px] leading-none animate-pulse">
                    {productWebOrders.length + abonoReports.length}
                  </span>
                )}
              </button>
              <button 
                onClick={() => navigate('/closure')}
                className="text-[10px] font-black text-blue-400 bg-blue-400/10 px-4 py-2 rounded-xl hover:bg-blue-500 hover:text-white transition-all uppercase tracking-widest border border-blue-500/20 flex items-center gap-2"
              >
                <ShieldCheck size={14} /> Cierre
              </button>
              <div className="flex -space-x-2 mr-2">
                {pausedSales.map((s, i) => (
                  <button 
                    key={s.id} 
                    onClick={() => resumeSaleFromDB(s)}
                    className="w-8 h-8 rounded-full bg-orange-500 border-2 border-[#0f172a] text-[10px] font-black flex items-center justify-center hover:scale-110 transition-all shadow-lg text-white"
                    title={`Retomar venta de $${s.total_usd}`}
                  >
                    {i + 1}
                  </button>
                ))}
              </div>
              <button 
                onClick={pauseCurrentSale} 
                disabled={cart.length === 0} 
                className="text-[10px] font-black text-orange-400 bg-orange-400/10 px-4 py-2 rounded-xl hover:bg-orange-500 hover:text-white transition-all uppercase tracking-widest disabled:opacity-30 border border-orange-500/20"
              >
                Pausar (F3)
              </button>
              {loadedWebOrderId ? (
                <button 
                  onClick={async () => {
                    const orderId = loadedWebOrderId;
                    const loadedOrder = sales.find(s => s.id === orderId);
                    
                    // 1. Eliminar el pedido de la base de datos
                    await deleteDocument('sales', orderId);
                    
                    // 2. Avisar al usuario enviando un mensaje directo
                    if (loadedOrder && loadedOrder.cliente_id) {
                      const today = new Date().toISOString();
                      await addDocument('mensajes', {
                        cliente_id: loadedOrder.cliente_id,
                        fecha: today,
                        titulo: "❌ Pedido Web Cancelado",
                        contenido: `Tu pedido #${orderId.substring(0, 8)} ha sido descartado de la caja por el personal de tienda. Si ya realizaste un pago, por favor contacta al cajero.`,
                        leido: false
                      });
                    }
                    
                    // 3. Limpiar estado en el POS
                    setCart([]);
                    setSelectedClient(null);
                    setLoadedWebOrderId(null);
                    setIsFiado(false);
                    addToast('warning', 'Pedido web descartado y eliminado del sistema');
                  }} 
                  className="text-[10px] font-black text-red-400 bg-red-500/10 px-4 py-2 rounded-xl hover:bg-red-500 hover:text-white transition-all uppercase tracking-widest border border-red-500/20"
                >
                  Descartar Pedido
                </button>
              ) : (
                <button 
                  onClick={() => setIsAuthModalOpen(true)} 
                  className="text-[10px] font-black text-red-500 bg-red-500/10 px-4 py-2 rounded-xl hover:bg-red-500 hover:text-white transition-all uppercase tracking-widest border border-red-500/20"
                >
                  Vaciar (F4)
                </button>
              )}
            </div>
          </div>
          
          <div className="flex-1 overflow-y-auto p-6 custom-scrollbar">
            {esAbonoWeb ? (
              <div className="h-full flex flex-col items-center justify-center gap-6 p-6 bg-purple-500/5 border border-purple-500/10 rounded-[2rem]">
                <div className="p-4 bg-purple-500/10 rounded-full text-purple-400">
                  <CreditCard size={48} />
                </div>
                <div className="text-center space-y-2">
                  <p className="text-[10px] text-purple-400 font-black uppercase tracking-[4px]">Reporte de Abono Cargado</p>
                  <h3 className="text-xl font-black text-white uppercase">{selectedClient?.nombre}</h3>
                  <p className="text-xs text-gray-400 font-bold">Cédula/ID: {selectedClient?.cedula}</p>
                </div>
                <div className="w-full bg-black/30 p-5 rounded-2xl border border-white/5 space-y-3">
                  <div className="flex justify-between text-xs font-bold">
                    <span className="text-gray-500 uppercase">Monto Reportado:</span>
                    <span className="text-emerald-400 font-black">${totalUSD.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between text-xs font-bold">
                    <span className="text-gray-500 uppercase">Equivalente en Bs:</span>
                    <span className="text-blue-400 font-black">Bs. {totalBs.toLocaleString('es-VE', { minimumFractionDigits: 2 })}</span>
                  </div>
                  <div className="flex justify-between text-xs font-bold">
                    <span className="text-gray-500 uppercase">Referencia:</span>
                    <span className="text-white font-black">{paymentAmounts.referencia || 'N/A'}</span>
                  </div>
                </div>
                <p className="text-[10px] text-center text-gray-500 font-bold max-w-xs">
                  Por favor, verifique el dinero en su cuenta o efectivo antes de presionar "FACTURAR" para procesar el abono.
                </p>
              </div>
            ) : cart.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center opacity-10 gap-4">
                <ShoppingCart size={80} strokeWidth={1} />
                <p className="font-black text-xl tracking-[10px] uppercase">Vacío</p>
              </div>
            ) : (
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-[10px] text-gray-500 uppercase border-b border-white/5">
                    <th className="pb-4 text-left tracking-[2px]">Ítem</th>
                    <th className="pb-4 text-center tracking-[2px]">Cant.</th>
                    <th className="pb-4 text-right tracking-[2px]">Unit.</th>
                    <th className="pb-4 text-right tracking-[2px]">Subtotal</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  <AnimatePresence>
                    {cart.map(item => (
                      <motion.tr 
                        key={item.id}
                        initial={{ opacity: 0, x: -20 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, x: 20 }}
                      >
                        <td className="py-4">
                           <div className="font-bold text-white uppercase text-xs">{item.nombre}</div>
                           <div className="text-[9px] text-gray-500 font-bold uppercase tracking-widest">{item.categoria}</div>
                        </td>
                        <td className="py-4">
                          <div className="flex items-center justify-center gap-3">
                            <button 
                              onClick={() => setCart(cart.map(i => i.id === item.id ? {...i, quantity: Math.max(0.5, Number(i.quantity) - 0.5)} : i))} 
                              className="w-8 h-8 bg-white/5 hover:bg-white/10 rounded-xl flex items-center justify-center transition-colors"
                            >
                              <Minus size={14} />
                            </button>
                            <input 
                              type="number" 
                              step="0.5" 
                              min="0.5" 
                              value={item.quantity}
                              onChange={(e) => {
                                const val = parseFloat(e.target.value);
                                if (!isNaN(val) && val > 0) {
                                  setCart(cart.map(i => i.id === item.id ? {...i, quantity: val} : i));
                                } else if (e.target.value === '') {
                                  setCart(cart.map(i => i.id === item.id ? {...i, quantity: e.target.value as any} : i));
                                }
                              }}
                              onBlur={(e) => {
                                let val = parseFloat(e.target.value);
                                if (isNaN(val) || val <= 0) val = 1;
                                setCart(cart.map(i => i.id === item.id ? {...i, quantity: val} : i));
                              }}
                              className="w-14 bg-black/20 text-center font-black text-blue-400 focus:outline-none rounded-lg p-1 border border-white/5"
                            />
                            <button 
                              onClick={() => {
                                if (Number(item.quantity) + 0.5 > item.stock) {
                                  addToast('warning', 'Máximo stock alcanzado');
                                } else {
                                  setCart(cart.map(i => i.id === item.id ? {...i, quantity: Number(i.quantity) + 0.5} : i));
                                }
                              }} 
                              className="w-8 h-8 bg-blue-500/10 hover:bg-blue-500/20 text-blue-400 rounded-xl flex items-center justify-center transition-colors"
                            >
                              <Plus size={14} />
                            </button>
                          </div>
                        </td>
                        <td className="py-4 text-right text-gray-400 font-medium">{formatCurrency(item.finalPrice)}</td>
                        <td className="py-4 text-right font-black text-green-400 text-base">{formatCurrency(item.finalPrice * item.quantity)}</td>
                      </motion.tr>
                    ))}
                  </AnimatePresence>
                </tbody>
              </table>
            )}
          </div>

          <div className="p-8 bg-black/40 border-t border-white/5 flex flex-wrap justify-between items-center gap-4">
            <div>
              <p className="text-[10px] text-gray-500 font-black uppercase tracking-[4px] mb-1">Total a Cobrar</p>
              <p className="text-2xl md:text-3xl font-black text-yellow-500">Bs. {totalBs.toLocaleString('es-VE', { minimumFractionDigits: 2 })}</p>
            </div>
            <div className="text-right">
              <p className="text-[10px] text-gray-500 font-black uppercase tracking-[4px] mb-1">Importe Neto</p>
              <div className="flex items-baseline gap-2">
                <span className="text-xl font-bold text-green-400/50">$</span>
                <span className="text-5xl md:text-6xl font-black text-green-400 tracking-tighter leading-none">{totalUSD.toFixed(2)}</span>
              </div>
            </div>
          </div>
          {(cart.length > 0 || esAbonoWeb) && (
            <div className="p-6 pt-0">
              <button 
                onClick={() => document.getElementById('pago_efectivo_usd_input')?.focus()}
                className="w-full py-5 bg-gradient-to-r from-blue-600 to-blue-500 hover:from-blue-500 hover:to-blue-400 text-white font-black rounded-[2rem] flex items-center justify-center gap-4 shadow-xl shadow-blue-500/20 transition-all active:scale-95 group border border-blue-400/20"
              >
                <div className="p-2 bg-white/20 rounded-xl group-hover:rotate-12 transition-transform">
                  <CreditCard size={20} />
                </div>
                <span className="tracking-[3px] uppercase text-xs">Ir a Cobrar (F8)</span>
                <ArrowRight size={20} className="ml-2 group-hover:translate-x-2 transition-transform" />
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Columna Derecha: Cliente y Pagos */}
      <div className="lg:col-span-4 flex flex-col gap-6">
        {/* Widget Cliente */}
        <div className="bg-white/5 border border-white/10 p-6 rounded-[2.5rem] backdrop-blur-xl relative z-30">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-[10px] font-black text-gray-500 uppercase tracking-[3px]">Identificación</h3>
            <User size={16} className="text-gray-600" />
          </div>
          
          {!selectedClient ? (
            <div className="space-y-4">
              <div className="relative">
                <div className="absolute left-4 top-1/2 -translate-y-1/2 flex items-center gap-2 z-10">
                   <span className="text-[9px] font-black bg-white/10 px-1 py-0.5 rounded text-gray-500">F2</span>
                   <Search className="text-gray-600" size={14} />
                </div>
                <input 
                  id="cliente_search_input"
                  className="w-full bg-black/30 border border-white/5 rounded-2xl py-4 pl-14 pr-4 text-sm font-bold text-white focus:border-blue-500/30 outline-none" 
                  placeholder="Cédula o Nombre..." 
                  value={clientSearch} 
                  onChange={e => setClientSearch(e.target.value)} 
                />
                <AnimatePresence>
                  {clientSearch && (
                    <motion.div 
                      initial={{ opacity: 0, scale: 0.95 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0, scale: 0.95 }}
                      className="absolute top-full left-0 right-0 mt-2 bg-[#1e293b] border border-white/10 rounded-2xl shadow-2xl z-50 max-h-60 overflow-y-auto backdrop-blur-2xl"
                    >
                      {filteredClients.map(c => (
                        <button 
                          key={c.id} 
                          onClick={() => { setSelectedClient(c); setClientSearch(''); }} 
                          className="w-full p-4 hover:bg-white/5 text-left border-b border-white/5 last:border-0 flex items-center justify-between group"
                        >
                          <div>
                            <div className="font-black text-xs text-white uppercase group-hover:text-blue-400 transition-colors">{String(c.nombre)}</div>
                            <div className="text-[9px] text-gray-500 font-bold tracking-widest">{String(c.cedula)}</div>
                          </div>
                          <ArrowRight size={14} className="text-gray-700 group-hover:text-blue-400" />
                        </button>
                      ))}
                      {filteredClients.length === 0 && (
                        <button 
                          onClick={() => navigate('/clients')}
                          className="w-full p-6 text-center text-blue-400 text-[10px] font-black uppercase tracking-widest hover:bg-blue-500/5"
                        >
                          + Registrar Nuevo
                        </button>
                      )}
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </div>
          ) : (
            <motion.div 
              initial={{ scale: 0.9 }}
              animate={{ scale: 1 }}
              className="bg-blue-500/10 border border-blue-500/20 p-5 rounded-2xl flex justify-between items-center"
            >
              <div className="flex items-center gap-4">
                <div className="w-10 h-10 bg-blue-500 rounded-xl flex items-center justify-center text-white font-black">
                  {selectedClient.nombre.substring(0, 1)}
                </div>
                <div>
                  <p className="font-black text-xs text-white uppercase tracking-tight">{String(selectedClient.nombre)}</p>
                  <p className="text-[10px] text-blue-400 font-bold">{String(selectedClient.cedula)}</p>
                </div>
              </div>
              <button 
                onClick={() => setSelectedClient(null)} 
                className="w-8 h-8 flex items-center justify-center text-red-500 hover:bg-red-500/10 rounded-full transition-colors"
              >
                <RotateCcw size={18}/>
              </button>
            </motion.div>
          )}
        </div>

        {/* Widget Cobro */}
        <div className="flex-1 bg-white/5 border border-white/10 p-8 rounded-[2.5rem] flex flex-col gap-6 backdrop-blur-xl relative z-20">
          <div className="flex items-center justify-between">
            <h3 className="text-[10px] font-black text-gray-500 uppercase tracking-[3px]">Métodos de Pago</h3>
            <CreditCard size={16} className="text-gray-600" />
          </div>

          {loadedWebOrderId && (
            (() => {
              const loadedOrder = sales.find(s => s.id === loadedWebOrderId);
              if (!loadedOrder) return null;
              const paidOnline = (loadedOrder as any).metodo_pago === 'inmediato';
              const capture = (loadedOrder as any).capture_base64;
              return (
                <div className="bg-purple-500/10 border border-purple-500/20 p-4 rounded-3xl space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-[9px] font-black text-purple-400 uppercase tracking-wider">Detalles del Pedido Web</span>
                    <span className="text-[8px] font-black uppercase bg-purple-500/20 text-purple-300 border border-purple-500/30 px-2 py-0.5 rounded-full">
                      {paidOnline ? 'Pagado de una Vez' : 'Pago al Recibir'}
                    </span>
                  </div>
                  {paidOnline && (
                    <div className="space-y-2">
                      <p className="text-xs text-gray-300 font-bold">
                        Referencia: <span className="text-white font-black">{loadedOrder.referencia || 'N/A'}</span>
                      </p>
                      {capture ? (
                        <div>
                          <p className="text-[8px] text-gray-500 font-black uppercase mb-1">Capture Adjunto:</p>
                          <div className="relative group w-32 h-20 rounded-xl overflow-hidden border border-white/10 bg-black/40">
                            <img src={capture} className="w-full h-full object-cover" alt="Capture pago" />
                            <button
                              onClick={() => {
                                const w = window.open();
                                if (w) {
                                  w.document.write(`<img src="${capture}" style="max-width:100%; max-height:100vh; display:block; margin:auto;" />`);
                                }
                              }}
                              className="absolute inset-0 bg-black/65 opacity-0 hover:opacity-100 flex items-center justify-center text-[10px] font-black text-white transition-opacity uppercase cursor-pointer"
                            >
                              Ver Grande
                            </button>
                          </div>
                        </div>
                      ) : (
                        <p className="text-xs text-amber-400 font-bold">⚠️ Sin capture de pantalla adjunto.</p>
                      )}
                    </div>
                  )}
                </div>
              );
            })()
          )}

          {/* Resumen de Cobro Rápido */}
          <div className="bg-black/40 p-5 rounded-3xl border border-white/10 shadow-inner">
            <div className="flex justify-between items-center mb-2">
              <span className="text-[10px] font-black text-gray-500 uppercase tracking-widest">Total a Cobrar</span>
              <div className="flex gap-2">
                <div className="text-[8px] font-black text-blue-400 bg-blue-500/10 px-2 py-1 rounded-lg">
                  SMART-PAY
                </div>
              </div>
            </div>
            <div className="flex items-baseline gap-2">
              <span className="text-3xl md:text-5xl font-black text-white tracking-tighter">${totalUSD.toFixed(2)}</span>
              <span className="text-xs font-bold text-gray-500">USD</span>
            </div>
          </div>

          <div className="space-y-4">
            <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
              <div className="space-y-1">
                <label className="text-[9px] text-gray-500 font-black uppercase ml-1 tracking-widest">Efectivo $</label>
                <div className="relative">
                  <span className="absolute left-4 top-1/2 -translate-y-1/2 text-green-500/50 font-bold text-sm">$</span>
                  <input 
                    id="pago_efectivo_usd_input"
                    type="number" 
                    className="w-full bg-black/40 border border-white/5 rounded-2xl p-4 pl-10 text-right text-green-400 font-black text-lg focus:border-green-500/30 outline-none" 
                    placeholder="0.00"
                    value={paymentAmounts.pago_efectivo_usd || ''} 
                    onFocus={() => handlePaymentFocus('pago_efectivo_usd')}
                    onChange={e => setPaymentAmounts({...paymentAmounts, pago_efectivo_usd: parseFloat(e.target.value) || 0})} 
                  />
                </div>
              </div>
              <div className="space-y-1">
                <label className="text-[9px] text-gray-500 font-black uppercase ml-1 tracking-widest">Efectivo Bs</label>
                <div className="relative">
                  <span className="absolute left-4 top-1/2 -translate-y-1/2 text-blue-500/50 font-bold text-sm">Bs</span>
                  <input 
                    type="number" 
                    className="w-full bg-black/40 border border-white/5 rounded-2xl p-4 pl-12 text-right text-blue-400 font-black text-lg focus:border-blue-500/30 outline-none" 
                    placeholder="0.00"
                    value={paymentAmounts.pago_efectivo_bs || ''} 
                    onFocus={() => handlePaymentFocus('pago_efectivo_bs')}
                    onChange={e => setPaymentAmounts({...paymentAmounts, pago_efectivo_bs: parseFloat(e.target.value) || 0})} 
                  />
                </div>
              </div>
            </div>

            <div className="space-y-1">
              <label className="text-[9px] text-gray-500 font-black uppercase ml-1 tracking-widest">Pago Móvil (Bs)</label>
              <input 
                type="number" 
                className="w-full bg-black/40 border border-white/5 rounded-2xl p-4 text-right text-purple-400 font-black text-lg focus:border-purple-500/30 outline-none" 
                placeholder="0.00"
                value={paymentAmounts.pago_movil_bs || ''} 
                onFocus={() => handlePaymentFocus('pago_movil_bs')}
                onChange={e => setPaymentAmounts({...paymentAmounts, pago_movil_bs: parseFloat(e.target.value) || 0})} 
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <label className="text-[9px] text-gray-500 font-black uppercase ml-1 tracking-widest">Biopago BDV (Bs)</label>
                <input 
                  type="number" 
                  className="w-full bg-black/40 border border-white/5 rounded-2xl p-4 text-right text-orange-400 font-black text-lg focus:border-orange-500/30 outline-none" 
                  placeholder="0.00"
                  value={paymentAmounts.biopago_bdv || ''} 
                  onFocus={() => handlePaymentFocus('biopago_bdv')}
                  onChange={e => setPaymentAmounts({...paymentAmounts, biopago_bdv: parseFloat(e.target.value) || 0})} 
                />
              </div>
              <div className="space-y-1">
                <label className="text-[9px] text-gray-500 font-black uppercase ml-1 tracking-widest">Tarjeta Débito (Bs)</label>
                <input 
                  type="number" 
                  className="w-full bg-black/40 border border-white/5 rounded-2xl p-4 text-right text-blue-400 font-black text-lg focus:border-blue-500/30 outline-none" 
                  placeholder="0.00"
                  value={paymentAmounts.pago_debito_bs || ''} 
                  onFocus={() => handlePaymentFocus('pago_debito_bs')}
                  onChange={e => setPaymentAmounts({...paymentAmounts, pago_debito_bs: parseFloat(e.target.value) || 0})} 
                />
              </div>
            </div>
            
            <div className="grid grid-cols-2 gap-4 mt-4 pt-4 border-t border-white/5">
              <div className="space-y-1">
                <label className="text-[9px] text-gray-500 font-black uppercase ml-1 tracking-widest">Ref. Pago Móvil</label>
                <input 
                  type="text" 
                  className="w-full bg-black/40 border border-white/5 rounded-2xl p-4 text-center text-white font-black text-xs focus:border-blue-500/30 outline-none" 
                  placeholder="Referencia..."
                  value={paymentAmounts.referencia || ''} 
                  onChange={e => setPaymentAmounts({...paymentAmounts, referencia: e.target.value})} 
                />
              </div>
              <div className="space-y-1">
                <label className="text-[9px] text-gray-500 font-black uppercase ml-1 tracking-widest">Aprobación Punto</label>
                <input 
                  type="text" 
                  className="w-full bg-black/40 border border-white/5 rounded-2xl p-4 text-center text-white font-black text-xs focus:border-orange-500/30 outline-none" 
                  placeholder="Código..."
                  value={paymentAmounts.aprobacion_punto || ''} 
                  onChange={e => setPaymentAmounts({...paymentAmounts, aprobacion_punto: e.target.value})} 
                />
              </div>
            </div>
          </div>

          <AnimatePresence>
            {changeUSD > 0 && (
              <motion.div 
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                className="p-6 bg-green-500/10 border border-green-500/20 rounded-[2rem] text-center shadow-2xl shadow-green-500/5 overflow-hidden"
              >
                <div className="text-[9px] font-black text-green-500 uppercase tracking-[4px] mb-2 leading-none">Cambio para entregar</div>
                <div className="text-4xl font-black text-green-400 leading-none mb-1">$ {changeUSD.toFixed(2)}</div>
                <div className="text-[10px] font-bold text-green-500/60 uppercase tracking-widest">Equivale a Bs. {(changeUSD * tasaBCV).toFixed(2)}</div>
              </motion.div>
            )}
          </AnimatePresence>

          <div className="mt-auto space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <button 
                onClick={handleFinalize}
                disabled={isPaying}
                className="bg-blue-600 hover:bg-blue-500 text-white p-5 rounded-2xl font-black text-xs uppercase tracking-[3px] flex items-center justify-center gap-2 shadow-2xl shadow-blue-500/20 active:scale-95 transition-all"
              >
                <CheckCircle size={18} /> FACTURAR
              </button>
              <button 
                onClick={() => {
                  if(!selectedClient) {
                    addToast('error', 'Seleccione un cliente para fiar');
                    return;
                  }
                  setIsFiado(true);
                  handleFinalize();
                }}
                disabled={isPaying}
                className="bg-red-500/10 hover:bg-red-500/20 text-red-400 p-5 rounded-2xl font-black text-[9px] uppercase tracking-widest border border-red-500/20 active:scale-95 transition-all"
              >
                FALLÓ PAGO (FIADO)
              </button>
            </div>

            <div className="flex items-center justify-between p-4 bg-black/20 rounded-2xl border border-white/5">
              <span className="text-[10px] font-black text-gray-500 uppercase tracking-widest">¿Venta a Crédito?</span>
              <label className="relative inline-flex items-center cursor-pointer">
                <input type="checkbox" checked={isFiado} onChange={e => setIsFiado(e.target.checked)} className="sr-only peer" />
                <div className="w-11 h-6 bg-white/10 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-gray-400 after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-red-500 peer-checked:after:bg-white"></div>
              </label>
            </div>
          </div>
        </div>
      </div>

      <SupervisorCodeModal 
        isOpen={isAuthModalOpen} 
        onClose={() => setIsAuthModalOpen(false)} 
        onSuccess={() => { setCart([]); setLoadedWebOrderId(null); setIsAuthModalOpen(false); addToast('info', 'Carrito vaciado'); }} 
        title="Autorizar Limpieza" 
      />

      {/* --- MODAL DE PEDIDOS WEB PENDIENTES --- */}
      <AnimatePresence>
        {showWebOrdersModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowWebOrdersModal(false)}
              className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="relative w-full max-w-2xl bg-[#1e293b] border border-white/10 rounded-[2.5rem] shadow-2xl overflow-hidden z-10 flex flex-col max-h-[85vh] text-white"
            >
              {/* Encabezado */}
              <div className="p-6 border-b border-white/5 bg-black/20 flex flex-col gap-4">
                <div className="flex items-center justify-between">
                  <h2 className="text-lg font-black text-white flex items-center gap-3">
                    <span>📦 PEDIDOS DESDE TIENDA VIRTUAL</span>
                    {(productWebOrders.length + abonoReports.length) > 0 && (
                      <span className="bg-red-500 text-white text-xs font-black px-2.5 py-0.5 rounded-full animate-pulse">
                        {productWebOrders.length + abonoReports.length}
                      </span>
                    )}
                  </h2>
                  <button 
                    onClick={() => setShowWebOrdersModal(false)} 
                    className="p-2 hover:bg-white/5 rounded-xl transition-colors text-gray-400 hover:text-white"
                  >
                    <X size={20} />
                  </button>
                </div>
                
                {/* Pestañas de Navegación */}
                <div className="flex gap-2 p-1 bg-black/40 rounded-2xl border border-white/5">
                  <button
                    type="button"
                    onClick={() => setWebOrdersTab('pedidos')}
                    className={cn(
                      "flex-1 py-3 text-xs font-black uppercase tracking-wider rounded-xl transition-all flex items-center justify-center gap-2",
                      webOrdersTab === 'pedidos'
                        ? "bg-blue-600 text-white shadow-lg"
                        : "text-gray-400 hover:text-white hover:bg-white/5"
                    )}
                  >
                    🛒 Pedidos de Productos
                    {productWebOrders.length > 0 && (
                      <span className="px-2 py-0.5 bg-red-500 text-white text-[10px] font-black rounded-full">
                        {productWebOrders.length}
                      </span>
                    )}
                  </button>
                  <button
                    type="button"
                    onClick={() => setWebOrdersTab('abonos')}
                    className={cn(
                      "flex-1 py-3 text-xs font-black uppercase tracking-wider rounded-xl transition-all flex items-center justify-center gap-2",
                      webOrdersTab === 'abonos'
                        ? "bg-purple-600 text-white shadow-lg"
                        : "text-gray-400 hover:text-white hover:bg-white/5"
                    )}
                  >
                    💳 Reportes de Pago (Abonos)
                    {abonoReports.length > 0 && (
                      <span className="px-2 py-0.5 bg-red-500 text-white text-[10px] font-black rounded-full animate-pulse">
                        {abonoReports.length}
                      </span>
                    )}
                  </button>
                </div>
              </div>

              {/* Contenido / Lista */}
              <div className="p-6 overflow-y-auto space-y-4 custom-scrollbar flex-1">
                {webOrdersTab === 'pedidos' ? (
                  productWebOrders.length === 0 ? (
                    <div className="text-center py-12 text-gray-500 font-bold uppercase text-xs tracking-widest">
                      No hay pedidos de productos pendientes en este momento.
                    </div>
                  ) : (
                    productWebOrders.map(order => {
                      // --- Temporizador de 7 horas ---
                      const DELIVERY_HOURS = 7;
                      const orderDate = order.fecha ? new Date(order.fecha) : null;
                      const deadlineMs = orderDate ? orderDate.getTime() + DELIVERY_HOURS * 60 * 60 * 1000 : null;
                      const nowMs = Date.now();
                      const remainingMs = deadlineMs ? deadlineMs - nowMs : null;
                      const isOverdue = remainingMs !== null && remainingMs <= 0;
                      const hoursLeft = remainingMs !== null && !isOverdue ? Math.floor(remainingMs / 3600000) : 0;
                      const minsLeft = remainingMs !== null && !isOverdue ? Math.floor((remainingMs % 3600000) / 60000) : 0;
                      const isDelivery = (order as any).tipo_entrega === 'delivery';
                      const deliveryGratis = (order as any).delivery_gratis;

                      return (
                      <div key={order.id} className="bg-white/5 border border-white/10 p-5 rounded-3xl space-y-3 hover:bg-white/10 transition-colors">
                        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2">
                          <div>
                            <div className="flex items-center gap-2 flex-wrap">
                              <div className="text-sm font-black text-white uppercase">{order.nombre_cliente}</div>
                              {/* Badge de tipo de entrega */}
                              <span className={`text-[8px] font-black uppercase px-2 py-0.5 rounded-full border tracking-wider ${
                                isDelivery
                                  ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30'
                                  : 'bg-blue-500/20 text-blue-300 border-blue-500/30'
                              }`}>
                                {isDelivery ? `🛵 Delivery${deliveryGratis ? ' GRATIS' : ''}` : '🏪 Retiro en Tienda'}
                              </span>
                              {/* Badge de método de pago */}
                              <span className={`text-[8px] font-black uppercase px-2 py-0.5 rounded-full border tracking-wider ${
                                order.metodo_pago === 'inmediato'
                                  ? 'bg-purple-500/20 text-purple-300 border-purple-500/30'
                                  : 'bg-amber-500/20 text-amber-300 border-amber-500/30'
                              }`}>
                                {order.metodo_pago === 'inmediato' ? `📱 Pago Inmediato (Ref: ${order.referencia || 'N/A'})` : '💵 Pagar al recibir'}
                              </span>
                            </div>
                            <div className="text-[10px] text-gray-500 font-bold uppercase mt-0.5">
                              #{order.id.substring(0, 8)} • {orderDate ? orderDate.toLocaleString() : 'Fecha N/A'}
                            </div>
                          </div>
                          <span className={cn(
                            "text-[9px] font-black uppercase px-2.5 py-1 rounded-lg border tracking-wider",
                            order.status_pedido === 'listo'
                              ? "bg-blue-500/20 text-blue-300 border-blue-500/30 animate-pulse"
                              : "bg-yellow-500/20 text-yellow-400 border-yellow-500/30"
                          )}>
                            {order.status_pedido === 'listo' ? '¡Listo!' : 'En preparación'}
                          </span>
                        </div>

                        {/* Temporizador de Entrega */}
                        {isDelivery && deadlineMs && (
                          <div className={`flex items-center gap-2 px-3 py-2 rounded-xl border text-[10px] font-black ${
                            isOverdue
                              ? 'bg-red-500/20 border-red-500/30 text-red-400'
                              : hoursLeft < 2
                              ? 'bg-orange-500/20 border-orange-500/30 text-orange-400'
                              : 'bg-gray-500/10 border-white/10 text-gray-400'
                          }`}>
                            <span className="text-base">{isOverdue ? '🔴' : hoursLeft < 2 ? '⚠️' : '⏱️'}</span>
                            <div>
                              <span className="uppercase tracking-wider block" style={{fontSize:'8px'}}>Tiempo para entrega</span>
                              {isOverdue
                                ? <span className="text-red-300 font-black">⛔ TIEMPO VENCIDO — lleva más de {DELIVERY_HOURS}h</span>
                                : <span>{hoursLeft}h {minsLeft}m restantes (límite: {new Date(deadlineMs).toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'})})</span>
                              }
                            </div>
                          </div>
                        )}

                        {/* Detalles del Pedido */}
                        <div className="bg-black/25 p-4 rounded-2xl border border-white/5 space-y-1.5">
                          {(order.detalles || []).map((d: any, idx: number) => (
                            <div key={idx} className="flex justify-between text-xs text-gray-300 font-bold">
                              <span>{d.nombre} <span className="text-gray-500 font-black">x{d.cantidad}</span></span>
                              <span>{formatCurrency(d.precio_unitario_usd * d.cantidad)}</span>
                            </div>
                          ))}
                        </div>

                        {/* Acciones */}
                        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 pt-2">
                          <div>
                            <span className="text-[9px] text-gray-500 font-black uppercase tracking-wider block">Total Pedido</span>
                            <span className="text-lg font-black text-emerald-400">{formatCurrency(order.total_usd)}</span>
                            <span className="text-[10px] text-gray-400 font-bold ml-2">Bs. {(order.total_usd * tasaBCV).toFixed(2)}</span>
                          </div>
                          <div className="flex gap-3 w-full sm:w-auto">
                            {order.status_pedido === 'pendiente' && (
                              <button
                                onClick={() => handleMarkAsReady(order.id)}
                                className="flex-1 sm:flex-initial bg-blue-600 hover:bg-blue-500 text-white px-4 py-2.5 rounded-xl text-xs font-black uppercase tracking-wider transition-colors"
                              >
                                Marcar Listo
                              </button>
                            )}
                            <button
                              onClick={() => handleLoadWebOrder(order)}
                              className="flex-1 sm:flex-initial bg-green-500 hover:bg-green-400 text-white px-4 py-2.5 rounded-xl text-xs font-black uppercase tracking-wider transition-colors flex items-center justify-center gap-1.5"
                            >
                              <LogIn size={14} /> Cobrar en POS
                            </button>
                          </div>
                        </div>
                      </div>
                      );
                    })
                  )
                ) : (
                  abonoReports.length === 0 ? (
                    <div className="text-center py-12 text-gray-500 font-bold uppercase text-xs tracking-widest">
                      No hay reportes de abono pendientes en este momento.
                    </div>
                  ) : (
                    abonoReports.map(order => {
                      const orderDate = order.fecha ? new Date(order.fecha) : null;
                      const capture = (order as any).capture_base64;
                      return (
                        <div key={order.id} className="bg-purple-500/5 border border-purple-500/10 p-5 rounded-3xl space-y-3 hover:bg-purple-500/10 transition-colors">
                          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2">
                            <div>
                              <div className="flex items-center gap-2 flex-wrap">
                                <div className="text-sm font-black text-white uppercase">{order.nombre_cliente}</div>
                                <span className="text-[8px] font-black uppercase px-2 py-0.5 bg-purple-500/20 text-purple-300 border border-purple-500/30 rounded-full tracking-wider">
                                  💰 Abono a Deuda
                                </span>
                                <span className="text-[8px] font-black uppercase px-2 py-0.5 bg-purple-500/20 text-purple-300 border border-purple-500/30 rounded-full tracking-wider">
                                  📱 {order.metodo_pago === 'pago_movil' ? 'Pago Móvil' : 'Transferencia'}
                                </span>
                              </div>
                              <div className="text-[10px] text-gray-500 font-bold uppercase mt-0.5">
                                #{order.id.substring(0, 8)} • {orderDate ? orderDate.toLocaleString() : 'Fecha N/A'}
                              </div>
                            </div>
                            <span className="text-[9px] font-black uppercase px-2.5 py-1 rounded-lg border border-purple-500/30 bg-purple-500/20 text-purple-300 tracking-wider">
                              Por Validar
                            </span>
                          </div>

                          <div className="flex flex-col sm:flex-row gap-4 items-start bg-black/20 p-4 rounded-2xl border border-white/5">
                            {capture ? (
                              <div className="relative group w-32 h-20 rounded-xl overflow-hidden border border-white/10 bg-black/40 flex-shrink-0">
                                <img src={capture} className="w-full h-full object-cover" alt="Capture pago" />
                                <button
                                  type="button"
                                  onClick={() => {
                                    const w = window.open();
                                    if (w) {
                                      w.document.write(`<img src="${capture}" style="max-width:100%; max-height:100vh; display:block; margin:auto;" />`);
                                    }
                                  }}
                                  className="absolute inset-0 bg-black/65 opacity-0 hover:opacity-100 flex items-center justify-center text-[10px] font-black text-white transition-opacity uppercase cursor-pointer"
                                >
                                  Ver Grande
                                </button>
                              </div>
                            ) : (
                              <div className="w-32 h-20 rounded-xl border border-dashed border-white/10 flex items-center justify-center bg-black/10 flex-shrink-0">
                                <span className="text-[8px] text-amber-400 font-bold uppercase">Sin capture</span>
                              </div>
                            )}
                            <div className="space-y-1">
                              <p className="text-xs text-gray-300 font-bold">
                                Referencia: <span className="text-white font-black">{order.referencia || 'N/A'}</span>
                              </p>
                              <p className="text-xs text-gray-300 font-bold">
                                Monto Reportado: <span className="text-emerald-400 font-black">${(order as any).monto_abono_usd?.toFixed(2)}</span>
                              </p>
                              <p className="text-[10px] text-gray-500 font-bold">
                                Equivalente: Bs. {((order as any).monto_abono_usd * tasaBCV).toLocaleString('es-VE', { minimumFractionDigits: 2 })}
                              </p>
                            </div>
                          </div>

                          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 pt-2">
                            <div>
                              <span className="text-[9px] text-gray-500 font-black uppercase tracking-wider block">Monto a Acreditar</span>
                              <span className="text-lg font-black text-emerald-400">${(order as any).monto_abono_usd?.toFixed(2)}</span>
                            </div>
                            <div className="flex gap-3 w-full sm:w-auto">
                              <button
                                type="button"
                                onClick={() => handleLoadWebOrder(order)}
                                className="flex-1 sm:flex-initial bg-purple-600 hover:bg-purple-500 text-white px-4 py-2.5 rounded-xl text-xs font-black uppercase tracking-wider transition-colors flex items-center justify-center gap-1.5"
                              >
                                <LogIn size={14} /> Validar Abono en POS
                              </button>
                            </div>
                          </div>
                        </div>
                      );
                    })
                  )
                )}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </motion.div>
  );
};

export default POSScreen;
