import React, { useEffect, useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  Smartphone, 
  ShieldCheck, 
  Star, 
  ShoppingBag, 
  History, 
  ChevronRight,
  ArrowLeft,
  Search,
  Plus,
  Minus,
  ShoppingCart,
  CheckCircle2,
  Calendar,
  DollarSign,
  LogOut,
  Rocket,
  X,
  Clock,
  MessageSquare,
  Play,
  Settings,
  PackageSearch,
  Truck,
  Check,
  Bot,
  Ticket,
  Trophy
} from 'lucide-react';
import { cn, formatCurrency, compressImage } from '../../lib/utils';
import { useAuth } from '../../contexts/AuthProvider';
import { auth } from '../../lib/firebase';
import { 
  subscribeToCollection, 
  getLatestTasa, 
  createSale, 
  updateStock, 
  updateDocument,
  addDocument,
  subscribeToDocument,
  subscribeToUserSales,
  subscribeToUserMessages
} from '../../lib/dbUtils';
import { type Client, type Sale, type Product, type PiezaProducto } from '../../types';
import AIShoppingAssistant from './AIShoppingAssistant';
import BiometricSetupButton from '../common/BiometricSetupButton';
import PieceSelectionModal from '../common/PieceSelectionModal';

interface CartItem {
  product: Product;
  cantidad: number;
  pieza_id?: string;
  pieza_numero?: string;
}

const OrderStepper = ({ status, tipoEntrega }: { status: string, tipoEntrega: string }) => {
  let step = 1;
  if (status === 'listo') step = 2;
  if (status === 'en_camino' || status === 'efectivo_en_ruta') step = 3;
  if (status === 'entregado') step = 4;
  
  if (status === 'rechazado') return null; // No stepper for cancelled

  const isDelivery = tipoEntrega === 'delivery';

  return (
    <div className="mt-6 mb-2 bg-black/20 p-4 rounded-3xl border border-white/5">
      <h4 className="text-[10px] font-black uppercase text-gray-500 mb-4 tracking-widest text-center">Seguimiento de tu pedido</h4>
      <div className="relative flex justify-between items-center px-2 sm:px-6">
        <div className="absolute left-0 top-1/2 -translate-y-1/2 w-full h-1 bg-white/10 rounded-full z-0"></div>
        <div 
          className="absolute left-0 top-1/2 -translate-y-1/2 h-1 bg-gradient-to-r from-orange-500 to-purple-500 rounded-full z-0 transition-all duration-500 ease-in-out"
          style={{ width: `${(step - 1) * 33.33}%` }}
        ></div>
        
        {/* Step 1: Recibido */}
        <div className="relative z-10 flex flex-col items-center gap-2">
          <div className={`w-8 h-8 rounded-full flex items-center justify-center transition-colors ${step >= 1 ? 'bg-orange-500 text-white shadow-[0_0_15px_rgba(249,115,22,0.5)]' : 'bg-gray-800 text-gray-500'}`}>
            <PackageSearch size={14} />
          </div>
          <span className={`text-[9px] font-bold uppercase tracking-wider ${step >= 1 ? 'text-white' : 'text-gray-500'}`}>Recibido</span>
        </div>

        {/* Step 2: Preparado */}
        <div className="relative z-10 flex flex-col items-center gap-2">
          <div className={`w-8 h-8 rounded-full flex items-center justify-center transition-colors ${step >= 2 ? 'bg-orange-500 text-white shadow-[0_0_15px_rgba(249,115,22,0.5)]' : 'bg-gray-800 text-gray-500'}`}>
            <CheckCircle2 size={14} />
          </div>
          <span className={`text-[9px] font-bold uppercase tracking-wider ${step >= 2 ? 'text-white' : 'text-gray-500'}`}>{isDelivery ? 'Empacado' : 'Listo'}</span>
        </div>

        {/* Step 3: En Camino */}
        <div className="relative z-10 flex flex-col items-center gap-2">
          <div className={`w-8 h-8 rounded-full flex items-center justify-center transition-colors ${step >= 3 ? 'bg-purple-500 text-white shadow-[0_0_15px_rgba(168,85,247,0.5)]' : 'bg-gray-800 text-gray-500'}`}>
            {isDelivery ? <Truck size={14} /> : <CheckCircle2 size={14} />}
          </div>
          <span className={`text-[9px] font-bold uppercase tracking-wider ${step >= 3 ? 'text-white' : 'text-gray-500'}`}>{isDelivery ? 'En Camino' : 'Retiro'}</span>
        </div>

        {/* Step 4: Entregado */}
        <div className="relative z-10 flex flex-col items-center gap-2">
          <div className={`w-8 h-8 rounded-full flex items-center justify-center transition-colors ${step >= 4 ? 'bg-green-500 text-white shadow-[0_0_15px_rgba(34,197,94,0.5)]' : 'bg-gray-800 text-gray-500'}`}>
            <Check size={14} />
          </div>
          <span className={`text-[9px] font-bold uppercase tracking-wider ${step >= 4 ? 'text-white' : 'text-gray-500'}`}>Entregado</span>
        </div>
      </div>
    </div>
  );
};

const ClientPortal: React.FC = () => {
  const { user, setUser } = useAuth();
  const navigate = useNavigate();
  const [clientData, setClientData] = useState<Client | null>(null);
  const [mySales, setMySales] = useState<Sale[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [isClientDataLoaded, setIsClientDataLoaded] = useState(false);
  const [loadError, setLoadError] = useState(false);
  const [tasaBcv, setTasaBcv] = useState(40.50);
  const [myTickets, setMyTickets] = useState<any[]>([]);

  const handleLogout = async () => {
    try {
      setUser(null);
      localStorage.removeItem('kalu_current_user');
      localStorage.removeItem('kalu_remembered_user');
      localStorage.removeItem('kalu_pin_verified');
      localStorage.removeItem('kalu_bio_last_user_email');
      await auth.signOut();
      window.location.href = '/';
    } catch (err) {
      console.error(err);
    }
  };

  // Estados de navegación e interfaz
  const [activeTab, setActiveTab] = useState<'inicio' | 'tienda' | 'compras'>('inicio');
  const [searchTerm, setSearchTerm] = useState('');
  const [expandedInvoiceId, setExpandedInvoiceId] = useState<string | null>(null);

  // Profile Update States
  const [showProfileModal, setShowProfileModal] = useState(false);
  const [editPhone, setEditPhone] = useState('');
  const [editEmail, setEditEmail] = useState('');
  const [isSavingProfile, setIsSavingProfile] = useState(false);
  const [profileSuccessMessage, setProfileSuccessMessage] = useState('');

  const handleOpenProfile = () => {
    setEditPhone(clientData?.telefono || '');
    setEditEmail(clientData?.email || '');
    setProfileSuccessMessage('');
    setShowProfileModal(true);
  };

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!clientData) return;
    
    const phoneRegex = /^[0-9+-\s]+$/;
    if (editPhone && !phoneRegex.test(editPhone)) {
      alert("El número de teléfono tiene un formato inválido.");
      return;
    }

    setIsSavingProfile(true);
    setProfileSuccessMessage('');
    try {
      await updateDocument('clients', clientData.id, {
        telefono: editPhone,
        email: editEmail
      });
      setProfileSuccessMessage("¡Datos actualizados con éxito!");
      setTimeout(() => setShowProfileModal(false), 2000);
    } catch (err) {
      console.error("Error updating profile:", err);
      alert("Ocurrió un error al actualizar los datos.");
    } finally {
      setIsSavingProfile(false);
    }
  };
  const [selectedCategory, setSelectedCategory] = useState('TODOS');
  
  const getInitialPortalStatus = () => {
    const hour = new Date().getHours();
    return hour < 6 || hour >= 18;
  };
  const [portalFueraDeServicio, setPortalFueraDeServicio] = useState(getInitialPortalStatus);
  const [estadoPortalVal, setEstadoPortalVal] = useState('automatico');

  // Dynamic time check
  useEffect(() => {
    const interval = setInterval(() => {
      if (estadoPortalVal === 'automatico') {
        const hour = new Date().getHours();
        setPortalFueraDeServicio(hour < 6 || hour >= 18);
      }
    }, 60000);
    return () => clearInterval(interval);
  }, [estadoPortalVal]);
  
  // Carrito de compras compartido
  const [cart, setCart] = useState<CartItem[]>([]);
  const [selectedPieceProduct, setSelectedPieceProduct] = useState<Product | null>(null);
  const [showCartDrawer, setShowCartDrawer] = useState(false);
  const [placingOrder, setPlacingOrder] = useState(false);
  const [orderSuccess, setOrderSuccess] = useState<string | null>(null);
  const [tipoEntrega, setTipoEntrega] = useState<'retiro' | 'delivery'>('retiro');
  const [metodoPago, setMetodoPago] = useState<'al_recibir' | 'inmediato'>('al_recibir');
  const [referenciaPago, setReferenciaPago] = useState('');
  const [captureBase64, setCaptureBase64] = useState<string | null>(null);
  const [cargandoCapture, setCargandoCapture] = useState(false);

  // Floating Cart Drag Logic
  const cartRef = useRef<HTMLButtonElement>(null);
  const [cartPos, setCartPos] = useState({ x: 0, y: 0 });
  const [isDraggingCart, setIsDraggingCart] = useState(false);
  const dragState = useRef({ startX: 0, startY: 0, initialX: 0, initialY: 0, isDragging: false, hasMoved: false });

  const handlePointerDown = (e: React.PointerEvent) => {
    if (e.button !== 0) return;
    const el = cartRef.current;
    if (!el) return;
    
    e.preventDefault();
    el.setPointerCapture(e.pointerId);
    
    dragState.current = {
      startX: e.clientX,
      startY: e.clientY,
      initialX: cartPos.x,
      initialY: cartPos.y,
      isDragging: true,
      hasMoved: false,
    };
    setIsDraggingCart(true);
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (!dragState.current.isDragging) return;
    
    const dx = e.clientX - dragState.current.startX;
    const dy = e.clientY - dragState.current.startY;
    
    if (Math.abs(dx) > 3 || Math.abs(dy) > 3) {
      dragState.current.hasMoved = true;
    }

    setCartPos({
      x: dragState.current.initialX + dx,
      y: dragState.current.initialY + dy,
    });
  };

  const handlePointerUp = (e: React.PointerEvent) => {
    if (!dragState.current.isDragging) return;
    dragState.current.isDragging = false;
    setIsDraggingCart(false);
    
    const el = cartRef.current;
    if (el) {
      el.releasePointerCapture(e.pointerId);
    }
  };

  const handleCartClick = (e: React.MouseEvent) => {
    if (dragState.current.hasMoved) {
      e.preventDefault();
      e.stopPropagation();
      return;
    }
    setShowCartDrawer(true);
  };

  // Estados para Reportar Pago de Deuda (Abono)
  const [showReportarPagoModal, setShowReportarPagoModal] = useState(false);
  const [montoReportarUSD, setMontoReportarUSD] = useState('');
  const [metodoPagoReportar, setMetodoPagoReportar] = useState<'pago_movil_bs' | 'transferencia_bs'>('pago_movil_bs');
  const [referenciaReportar, setReferenciaReportar] = useState('');
  const [captureReportarBase64, setCaptureReportarBase64] = useState<string | null>(null);
  const [cargandoCaptureReportar, setCargandoCaptureReportar] = useState(false);
  const [enviandoReporte, setEnviandoReporte] = useState(false);

  // Estados para Quejas/Sugerencias y Cajero Activo
  const [cajeroActivo, setCajeroActivo] = useState('Cajero Principal');
  const [showQuejaModal, setShowQuejaModal] = useState(false);
  const [tituloQueja, setTituloQueja] = useState('');
  const [mensajeQueja, setMensajeQueja] = useState('');
  const [enviandoQueja, setEnviandoQueja] = useState(false);
  const [showPropagandaModal, setShowPropagandaModal] = useState(false);
  const [propagandaVideoUrl, setPropagandaVideoUrl] = useState('https://assets.mixkit.co/videos/preview/mixkit-delivery-man-filtering-packages-in-the-trunk-40248-large.mp4');

  // PWA Installation
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [isStandalone, setIsStandalone] = useState(false);

  useEffect(() => {
    setIsStandalone(window.matchMedia('(display-mode: standalone)').matches);
    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e);
    };
    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    return () => window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
  }, []);

  const handleCaptureChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setCargandoCapture(true);
      compressImage(file)
        .then(compressedBase64 => {
          setCaptureBase64(compressedBase64);
          setCargandoCapture(false);
        })
        .catch(err => {
          console.error("Error compressing image:", err);
          const reader = new FileReader();
          reader.onloadend = () => {
            setCaptureBase64(reader.result as string);
            setCargandoCapture(false);
          };
          reader.readAsDataURL(file);
        });
    }
  };

  const handleCaptureReportarChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setCargandoCaptureReportar(true);
      compressImage(file)
        .then(compressedBase64 => {
          setCaptureReportarBase64(compressedBase64);
          setCargandoCaptureReportar(false);
        })
        .catch(err => {
          console.error("Error compressing image:", err);
          const reader = new FileReader();
          reader.onloadend = () => {
            setCaptureReportarBase64(reader.result as string);
            setCargandoCaptureReportar(false);
          };
          reader.readAsDataURL(file);
        });
    }
  };

  const handleSendReportarPago = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!clientData) return;
    const monto = parseFloat(montoReportarUSD);
    if (isNaN(monto) || monto <= 0) {
      alert("Por favor ingresa un monto válido mayor a 0.");
      return;
    }
    if (monto > clientData.saldo_usd) {
      alert(`El monto a reportar ($${monto.toFixed(2)}) no puede ser mayor que tu deuda actual ($${clientData.saldo_usd.toFixed(2)}).`);
      return;
    }
    if (!referenciaReportar.trim()) {
      alert("Por favor ingresa la referencia de pago.");
      return;
    }
    if (!captureReportarBase64) {
      alert("Por favor sube el capture del pago.");
      return;
    }

    setEnviandoReporte(true);
    try {
      const today = new Date().toISOString();
      const saleData = {
        fecha: today,
        cliente_id: clientData.id,
        nombre_cliente: clientData.nombre,
        total_usd: 0,
        tasa_momento: tasaBcv,
        es_fiado: false,
        pagada: false,
        pago_efectivo_usd: 0,
        pago_efectivo_bs: 0,
        pago_movil_bs: metodoPagoReportar === 'pago_movil_bs' ? parseFloat((monto * tasaBcv).toFixed(2)) : 0,
        pago_transferencia_bs: metodoPagoReportar === 'transferencia_bs' ? parseFloat((monto * tasaBcv).toFixed(2)) : 0,
        biopago_bdv: 0,
        pago_debito_bs: 0,
        pago_otros_usd: 0,
        vuelto_entregado_usd: 0,
        saldo_pendiente_usd: 0,
        origen: 'web',
        tipo_transaccion: 'abono',
        status_pedido: 'pendiente',
        metodo_pago: metodoPagoReportar === 'pago_movil_bs' ? 'pago_movil' : 'transferencia',
        referencia: referenciaReportar,
        capture_base64: captureReportarBase64,
        monto_abono_usd: monto,
        detalles: [
          { producto_id: 'abono', nombre: `Reporte de Abono - ${clientData.nombre}`, cantidad: 1, precio_unitario_usd: 0 }
        ]
      };

      const { addDocument } = await import('../../lib/dbUtils');
      await createSale(saleData);

      await addDocument('mensajes', {
        cliente_id: clientData.id,
        fecha: today,
        titulo: "📱 Reporte de Pago Recibido",
        contenido: `Hemos recibido tu reporte de pago de $${monto.toFixed(2)}. Está en proceso de validación en caja.`,
        leido: false
      });

      setMontoReportarUSD('');
      setReferenciaReportar('');
      setCaptureReportarBase64(null);
      setShowReportarPagoModal(false);
      alert("Tu reporte de pago ha sido enviado con éxito a la caja para su validación.");
    } catch (err) {
      console.error("Error al reportar pago:", err);
      alert("Ocurrió un error al enviar el reporte de pago.");
    } finally {
      setEnviandoReporte(false);
    }
  };

  const handleSendQueja = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!clientData) return;
    if (!tituloQueja.trim() || !mensajeQueja.trim()) {
      alert("Por favor completa todos los campos.");
      return;
    }
    setEnviandoQueja(true);
    try {
      const today = new Date().toISOString();
      await addDocument('quejas', {
        cliente_id: clientData.id,
        cliente_nombre: clientData.nombre,
        cliente_cedula: clientData.cedula,
        titulo: tituloQueja.trim(),
        mensaje: mensajeQueja.trim(),
        fecha: today,
        leido: false
      });

      alert("Tu queja/sugerencia ha sido enviada directamente al dueño de forma exitosa.");
      setTituloQueja('');
      setMensajeQueja('');
      setShowQuejaModal(false);
    } catch (err) {
      console.error("Error al enviar queja:", err);
      alert("Ocurrió un error al enviar tu queja. Intenta de nuevo.");
    } finally {
      setEnviandoQueja(false);
    }
  };

  const [mensajes, setMensajes] = useState<any[]>([]);
  const DELIVERY_MINIMO_USD = 5.00;

  useEffect(() => {
    if (!user) return;

    const targetClientId = String(user.clientId || user.id || '').trim();
    
    // Suscribirse a los datos del cliente específico
    const unsubClient = subscribeToDocument('clients', targetClientId, (clientDoc) => {
      if (clientDoc) {
        setClientData(clientDoc as Client);
      }
      setIsClientDataLoaded(true);
    });

    // Suscribirse a las ventas de este cliente (ahora movido a otro useEffect)
    const safetyTimeout = setTimeout(() => {
      setLoading(false);
      setLoadError(true);
    }, 10000);

    // Suscribirse a los productos
    const unsubProducts = subscribeToCollection('products', (data) => {
      setProducts(data as Product[]);
    });

    // Suscribirse a los mensajes directos y globales del cliente
    const unsubMensajes = subscribeToUserMessages([targetClientId, 'todos', 'global'], (myMsgs) => {
      const sorted = myMsgs.sort((a, b) => new Date(b.fecha).getTime() - new Date(a.fecha).getTime());
      setMensajes(sorted);
    });

    // Suscribirse a configuracion para obtener cajero_activo y propaganda_url
    const unsubConfig = subscribeToCollection('configuracion', (data) => {
      const globalConfig = data.find(c => c.id === 'global');
      if (globalConfig) {
        if (globalConfig.cajero_activo) {
          setCajeroActivo(prev => prev === globalConfig.cajero_activo ? prev : globalConfig.cajero_activo);
        }
        if (globalConfig.propaganda_url) {
          setPropagandaVideoUrl(prev => prev === globalConfig.propaganda_url ? prev : globalConfig.propaganda_url);
        }
        let outOfService = false;
        const estado = globalConfig.estado_portal || 'automatico';
        setEstadoPortalVal(estado);
        if (estado === 'abierto') {
          outOfService = false;
        } else if (estado === 'cerrado') {
          outOfService = true;
        } else {
          const hour = new Date().getHours();
          outOfService = (hour < 6 || hour >= 18);
        }
        setPortalFueraDeServicio(outOfService);
      }
    });

    const unsubTasa = subscribeToCollection('tasas_bcv', (data) => {
      if (data && data.length > 0) {
        const sorted = data.sort((a: any, b: any) => {
          const fechaA = String(a.fecha || '');
          const fechaB = String(b.fecha || '');
          const fechaCmp = fechaB.localeCompare(fechaA);
          if (fechaCmp !== 0) return fechaCmp;
          const timeA = a.sincronizadoEn?.seconds ? a.sincronizadoEn.seconds * 1000 : (typeof a.sincronizadoEn === 'string' ? new Date(a.sincronizadoEn).getTime() : 0);
          const timeB = b.sincronizadoEn?.seconds ? b.sincronizadoEn.seconds * 1000 : (typeof b.sincronizadoEn === 'string' ? new Date(b.sincronizadoEn).getTime() : 0);
          return timeB - timeA;
        });
        setTasaBcv(Number(sorted[0].valor) || 40.50);
      }
    });

    const unsubSorteo = subscribeToCollection('sorteos_activos', (ticketsData) => {
      if (clientData?.id) {
        const clientIds = Array.from(new Set([user?.clientId, user?.id, clientData?.id].filter(Boolean).map(id => String(id).trim())));
        const filtered = ticketsData.filter(t => clientIds.includes(String(t.cliente_id)));
        setMyTickets(filtered);
      }
    });

    // Cargar carrito local si existe
    const savedCart = localStorage.getItem('kalu_public_cart');
    if (savedCart) {
      try {
        setCart(JSON.parse(savedCart));
      } catch (e) {
        console.error("Error cargando carrito:", e);
      }
    }

    return () => {
      clearTimeout(safetyTimeout);
      unsubClient();
      unsubProducts();
      unsubMensajes();
      unsubConfig();
      unsubTasa();
      unsubSorteo();
    };
  }, [user]);

  // Suscribirse a las ventas cuando ya tenemos el clientData cargado
  useEffect(() => {
    if (!clientData?.id && !user?.id) return;
    
    // Usamos Set para valores unicos. Aseguramos no usar toLowerCase() 
    // porque los UIDs de Firebase son sensibles a mayúsculas/minúsculas.
    const uniqueIds = Array.from(new Set([user?.clientId, user?.id, clientData?.id, clientData?.cedula].filter(Boolean).map(id => String(id).trim())));
    
    // subscribeToUserSales usa where('cliente_id', 'in', [...])
    // lo cual pasa la regla de seguridad de Firebase en lugar de pedir toda la coleccion.
    const unsubSales = subscribeToUserSales(uniqueIds, (userSales) => {
      const sorted = userSales.sort((a, b) => {
        const dateA = new Date(a.fecha || a.createdAt || 0).getTime();
        const dateB = new Date(b.fecha || b.createdAt || 0).getTime();
        return dateB - dateA;
      });
      setMySales(sorted as Sale[]);
      setLoading(false);
    });
    
    return () => unsubSales();
  }, [clientData?.id, user?.id, user?.clientId]);


  // Guardar cambios en el carrito
  useEffect(() => {
    localStorage.setItem('kalu_public_cart', JSON.stringify(cart));
  }, [cart]);

  if (loading || !isClientDataLoaded) {
    return (
      <div 
        className="h-screen w-full flex flex-col items-center justify-center gap-6"
        style={{
          backgroundImage: "linear-gradient(rgba(15, 23, 42, 0.9), rgba(15, 23, 42, 0.95)), url('/logo.png')",
          backgroundSize: 'cover',
          backgroundPosition: 'center'
        }}
      >
        <img src="/logo.png" className="w-20 h-20 object-contain rounded-2xl animate-pulse bg-white p-1 shadow-lg shadow-black/50" alt="Kalu Logo" />
        <div className="flex flex-col items-center gap-2">
          <div className="w-10 h-10 border-4 border-[#075E54] border-t-transparent rounded-full animate-spin" />
          <p className="text-gray-400 font-black uppercase tracking-widest text-[10px]">Cargando tu portal...</p>
        </div>
      </div>
    );
  }

  if (!clientData) {
    return (
      <div 
        className="h-screen w-full flex flex-col items-center justify-center gap-6 p-8 text-center"
        style={{
          backgroundImage: "linear-gradient(rgba(15, 23, 42, 0.9), rgba(15, 23, 42, 0.95)), url('/logo.png')",
          backgroundSize: 'cover',
          backgroundPosition: 'center'
        }}
      >
        <img src="/logo.png" className="w-20 h-20 object-contain rounded-2xl bg-white p-1 shadow-lg shadow-black/50" alt="Kalu Logo" />
        <div className="flex flex-col items-center gap-3">
          <p className="text-red-400 font-black uppercase tracking-widest text-sm">Perfil no encontrado</p>
          <p className="text-gray-500 text-xs max-w-xs">No se encontró tu perfil de cliente. Por favor contacta a la tienda o intenta nuevamente.</p>
          <button
            onClick={handleLogout}
            className="mt-4 px-6 py-3 bg-[#3498db] text-white rounded-2xl font-black text-sm hover:bg-[#2980b9] transition-all"
          >
            VOLVER AL INICIO
          </button>
        </div>
      </div>
    );
  }

  if (portalFueraDeServicio) {
    return (
      <div 
        className="min-h-screen text-slate-100 font-sans flex flex-col items-center justify-center p-4 text-center"
        style={{
          backgroundImage: "linear-gradient(rgba(15, 23, 42, 0.95), rgba(15, 23, 42, 0.98)), url('/logo.png')",
          backgroundSize: 'cover',
          backgroundPosition: 'center',
          backgroundAttachment: 'fixed'
        }}
      >
        <div className="w-24 h-24 bg-red-500/20 text-red-500 rounded-full flex items-center justify-center mb-6 border border-red-500/30">
          <ShieldCheck size={48} />
        </div>
        <h1 className="text-4xl font-black mb-4">PORTAL CERRADO</h1>
        <p className="text-gray-400 max-w-md text-lg">
          Nuestro portal de clientes se encuentra cerrado por mantenimiento y mejoras.
        </p>
        <p className="text-[#3498db] font-bold mt-2">
          El horario de atención es de 6:00 AM a 6:00 PM.
        </p>
        <button 
          onClick={handleLogout}
          className="mt-8 px-6 py-3 bg-red-500/20 hover:bg-red-500/30 border border-red-500/30 text-red-200 rounded-xl font-bold transition-all text-sm uppercase tracking-widest flex items-center gap-2 mx-auto"
        >
          <LogOut size={16} /> Cerrar Sesión
        </button>
      </div>
    );
  }

  // Lógica del carrito
  const addToCart = (product: Product, quantity?: number) => {
    if (quantity !== undefined && quantity > 100) {
      alert(`⚠️ ADVERTENCIA: Estás intentando añadir una cantidad muy alta (${quantity}). Por tu seguridad, se ha limitado a 100. Por favor verifica tu pedido.`);
      quantity = 100;
    }

    if (product.usa_piezas && Array.isArray(product.piezas) && product.piezas.filter(p => !p.vendida).length > 0) {
      setSelectedPieceProduct(product);
      return;
    }

    setCart(prev => {
      const existing = prev.find(item => item.product.id === product.id && !item.pieza_id);
      
      if (existing) {
        const increment = quantity !== undefined ? quantity : 0.5;
        if (existing.cantidad + increment > product.stock) {
          return prev.map(item => 
            item.product.id === product.id && !item.pieza_id
              ? { ...item, cantidad: product.stock } 
              : item
          );
        }
        return prev.map(item => 
          item.product.id === product.id && !item.pieza_id
            ? { ...item, cantidad: Number(item.cantidad) + increment } 
            : item
        );
      }
      
      const initialQuantity = quantity !== undefined ? quantity : 1;
      return [...prev, { product, cantidad: initialQuantity > product.stock ? product.stock : initialQuantity }];
    });
  };

  const handlePieceSelect = (pieza: PiezaProducto) => {
    if (!selectedPieceProduct) return;
    
    // Validar si ya está en el carrito
    if (cart.some(item => item.pieza_id === pieza.id)) {
      alert('Esta pieza ya está en tu carrito');
      return;
    }

    setCart(prev => [...prev, { 
      product: selectedPieceProduct, 
      cantidad: pieza.peso, 
      pieza_id: pieza.id,
      pieza_numero: pieza.numero
    }]);
    
    alert(`¡Horma #${pieza.numero} agregada al carrito con éxito!`);
    setSelectedPieceProduct(null);
  };

  const removeFromCart = (productId: string, piezaId?: string) => {
    setCart(prev => {
      if (piezaId) {
        return prev.filter(item => item.pieza_id !== piezaId);
      }
      const existing = prev.find(item => item.product.id === productId && !item.pieza_id);
      if (existing && existing.cantidad > 0.5) {
        return prev.map(item => 
          item.product.id === productId && !item.pieza_id
            ? { ...item, cantidad: Number(item.cantidad) - 0.5 } 
            : item
        );
      }
      return prev.filter(item => item.product.id !== productId || !!item.pieza_id);
    });
  };

  const removeItemCompletely = (productId: string, piezaId?: string) => {
    if (piezaId) {
      setCart(prev => prev.filter(item => item.pieza_id !== piezaId));
    } else {
      setCart(prev => prev.filter(item => item.product.id !== productId || !!item.pieza_id));
    }
  };

  const getQuantityInCart = (productId: string) => {
    return cart.find(item => item.product.id === productId)?.cantidad || 0;
  };

  const cartTotalUsd = cart.reduce((sum, item) => {
    if (item.pieza_id && Array.isArray(item.product.piezas)) {
      const pieza = item.product.piezas.find(p => p.id === item.pieza_id);
      return sum + (pieza?.precio_usd || (pieza?.peso ? pieza.peso * (item.product.precio_oferta_usd || item.product.precio_normal_usd) : 0));
    }
    const price = item.product.precio_oferta_usd || item.product.precio_normal_usd;
    return sum + (price * item.cantidad);
  }, 0);

  const cartTotalItems = cart.reduce((sum, item) => sum + item.cantidad, 0);

  // Confirmar y procesar pedido
  const handleConfirmOrder = async () => {
    
    if (cart.length === 0 || placingOrder) return;
    
    if (metodoPago === 'inmediato' && !referenciaPago.trim()) {
      alert("Por favor introduce el número de referencia del pago.");
      return;
    }

    setPlacingOrder(true);

    try {
      // 0. Token is refreshed automatically by Firebase. No need to force it here to avoid race conditions.
      // 1. Validar stock actual (opcional pero recomendado)
      for (const item of cart) {
        const dbProd = products.find(p => p.id === item.product.id);
        if (dbProd && !item.pieza_id && dbProd.stock < item.cantidad) {
          alert(`Lo sentimos, el producto "${item.product.nombre}" ya no tiene suficiente stock.`);
          setPlacingOrder(false);
          return;
        }
      }

      // 2. Crear la Venta
      const codigo_pedido = Math.floor(100000 + Math.random() * 900000).toString();
      const saleData = {
        codigo_pedido,
        fecha: new Date().toISOString(),
        cliente_id: clientData.id,
        nombre_cliente: clientData.nombre,
        total_usd: cartTotalUsd,
        tasa_momento: tasaBcv,
        es_fiado: metodoPago === 'inmediato' ? false : true,
        pagada: false,
        pago_efectivo_usd: 0,
        pago_efectivo_bs: 0,
        pago_movil_bs: metodoPago === 'inmediato' ? parseFloat((cartTotalUsd * tasaBcv).toFixed(2)) : 0,
        pago_transferencia_bs: 0,
        biopago_bdv: 0,
        pago_debito_bs: 0,
        pago_otros_usd: 0,
        saldo_pendiente_usd: metodoPago === 'inmediato' ? 0 : cartTotalUsd,
        origen: 'web',
        status_pedido: 'pendiente',
        tipo_entrega: tipoEntrega,
        delivery_gratis: tipoEntrega === 'delivery' && cartTotalUsd >= DELIVERY_MINIMO_USD,
        metodo_pago: metodoPago,
        referencia: metodoPago === 'inmediato' ? referenciaPago : '',
        capture_base64: metodoPago === 'inmediato' ? captureBase64 : null,
        detalles: cart.map(item => ({
          producto_id: item.product.id,
          nombre: item.product.nombre,
          cantidad: item.cantidad,
          precio_unitario_usd: (item.pieza_id && Array.isArray(item.product.piezas)) 
            ? ((item.product.piezas.find(p => p.id === item.pieza_id)?.precio_usd || (item.cantidad * (item.product.precio_oferta_usd || item.product.precio_normal_usd))) / item.cantidad)
            : (item.product.precio_oferta_usd || item.product.precio_normal_usd),
          pieza_id: item.pieza_id || null,
          pieza_numero: item.pieza_numero || null
        }))
      };

      const newSaleId = await createSale(saleData).catch(e => { throw new Error('createSale: ' + e.message); });

      // 3. Descontar Stock de Productos
      for (const item of cart) {
        await updateStock(item.product.id, item.cantidad, 'VENTA_TIENDA_VIRTUAL', user?.id || 'cliente', item.pieza_id).catch(e => { throw new Error('updateStock: ' + e.message); });
      }

      // 4. Actualizar los Puntos del Cliente (sin tocar la deuda)
      const nuevosPuntos = clientData.puntos + Math.round(cartTotalUsd);
      await updateDocument('clients', clientData.id, {
        puntos: nuevosPuntos
      }).catch(e => { throw new Error('updateClient: ' + e.message); });

      // 4.5 Generar Factura Digital en Mensajes
      const today = new Date();
      const invoiceContent = `📄 FACTURA DIGITAL #${codigo_pedido}
Fecha: ${today.toLocaleDateString()} ${today.toLocaleTimeString()}
Cliente: ${clientData.nombre}
Cédula: ${clientData.cedula}
----------------------------------
${cart.map(item => `${item.cantidad}x ${item.product.nombre} - $${((item.product.precio_oferta_usd || item.product.precio_normal_usd) * item.cantidad).toFixed(2)}`).join('\n')}
----------------------------------
Total USD: $${cartTotalUsd.toFixed(2)}
Tasa BCV: ${tasaBcv.toFixed(2).replace('.', ',')} Bs/USD
Total en Bolívares: ${formatCurrency(cartTotalUsd , 'Bs', tasaBcv).replace('VES', 'Bs.')}
----------------------------------
Método de Pago: ${metodoPago === 'inmediato' ? 'Pago Móvil / Transferencia (Inmediato)' : 'Pagar al Recibir (Fiado / Efectivo)'}
Tipo de Entrega: ${tipoEntrega === 'delivery' ? 'Delivery' : 'Retiro en Tienda'}
Estatus: Pendiente por verificar/entregar

¡Gracias por su compra en KALUNEVA2024!`;

      await addDocument('mensajes', {
        cliente_id: clientData.id,
        fecha: today.toISOString(),
        titulo: `📄 Factura Digital #${codigo_pedido}`,
        contenido: invoiceContent,
        leido: false
      }).catch(e => { throw new Error('addMensaje: ' + e.message); });

      // Limpiar carrito e inputs de pago
      setCart([]);
      setReferenciaPago('');
      setCaptureBase64(null);
      setMetodoPago('al_recibir');
      localStorage.removeItem('kalu_public_cart');
      setShowCartDrawer(false);
      
      // Mostrar pantalla de éxito
      setOrderSuccess(codigo_pedido);
    } catch (e: any) {
      console.error("Error al colocar pedido:", e);
      try {
        const { collection, addDoc } = await import('firebase/firestore');
        const { db } = await import('../../lib/firebase');
        await addDoc(collection(db, 'debug_logs'), {
          error: e.message || String(e),
          stack: e.stack,
          userId: user?.id || 'unknown',
          time: new Date().toISOString()
        });
      } catch (logErr) {
        console.error("Failed to log error to DB:", logErr);
      }
      
      if (e.message === 'PIECE_ALREADY_SOLD') {
        alert("⚠️ Lo sentimos, una de las piezas seleccionadas acaba de ser comprada por otro usuario. Por favor elimínala del carrito e intenta con otra.");
      } else if (e.message.toLowerCase().includes('missing or insufficient permissions')) {
        alert("⚠️ Tu sesión por seguridad ha caducado por inactividad. La página se actualizará automáticamente para que vuelvas a iniciar sesión y tu compra sea segura.");
        window.location.reload();
      } else {
        alert(`Ocurrió un error al procesar tu pedido. Detalle técnico: ${e.message || String(e)}`);
      }
    } finally {
      setPlacingOrder(false);
    }
  };

  // Filtros de categoría y búsqueda
  const categories = ['TODOS', ...Array.from(new Set(products.map(p => (p.categoria || 'GENERAL').trim().toUpperCase())))];
  
  const filteredProducts = products.filter(product => {
    const matchesSearch = (product.nombre || '').toLowerCase().includes(searchTerm.toLowerCase()) || 
                          String(product.codigo || '').toLowerCase().includes(searchTerm.toLowerCase());
    const matchesCategory = selectedCategory === 'TODOS' || 
                            (product.categoria || 'GENERAL').trim().toUpperCase() === selectedCategory;
    return matchesSearch && matchesCategory;
  });

  const activeOrders = mySales.filter(sale => {
    const activeStatuses = ['pendiente', 'verificando_pago', 'listo', 'en_camino', 'efectivo_en_ruta'];
    return activeStatuses.includes(sale.status_pedido as string);
  });
  // Se muestran todas las compras en el historial (sin límite de 7 días)
  const allRecentOrders = mySales;

  return (
    <div className="max-w-4xl mx-auto space-y-6 pb-20 font-sans">
      
      {/* Modal de Pedido Exitoso */}
      {orderSuccess && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-md">
          <div className="bg-[#1e293b] border border-white/10 p-8 rounded-[2.5rem] max-w-sm w-full text-center space-y-6 animate-in zoom-in-95 duration-300">
            <div className="w-20 h-20 bg-emerald-500/10 text-emerald-400 rounded-full flex items-center justify-center mx-auto shadow-lg shadow-emerald-500/5">
              <CheckCircle2 size={48} />
            </div>
            <div className="space-y-2">
              <h3 className="text-2xl font-black text-white">¡PEDIDO RECIBIDO!</h3>
              <p className="text-xs text-gray-400 font-bold uppercase tracking-wider">Factura #{orderSuccess}</p>
              <p className="text-sm text-gray-300 mt-2">
                Tu pedido se ha procesado con éxito. Ya puedes pasar por caja a retirar y pagar tus productos.
              </p>
            </div>
            <button 
              onClick={() => { setOrderSuccess(null); setActiveTab('inicio'); }}
              className="w-full bg-[#2ecc71] hover:bg-[#27ae60] text-white py-4 rounded-2xl font-black uppercase tracking-widest transition-colors active:scale-95"
            >
              Entendido
            </button>
          </div>
        </div>
      )}

      {/* --- PESTAÑA INICIO (DASHBOARD) --- */}
      {activeTab === 'inicio' && (
        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-6 duration-700">
          
          {/* Header Superior (Fuera del recuadro verde) */}
          <div className="flex items-center justify-between px-2 pt-2 pb-4">
            <h1 className="text-2xl font-black text-white flex items-center gap-2 drop-shadow-md">
              <img src="/logo.png" className="w-8 h-8 rounded-lg bg-white p-0.5" alt="Kalu Logo" />
              KALU <span className="text-[10px] text-blue-400 bg-blue-500/10 px-2 py-0.5 rounded-full tracking-widest uppercase">2024</span>
            </h1>
            <div className="flex gap-2">
              {user?.role === 'repartidor' && (
                <button 
                  onClick={() => navigate('/repartidor')}
                  className="w-11 h-11 rounded-2xl bg-purple-500/20 border border-purple-500/30 text-purple-300 flex items-center justify-center hover:bg-purple-500 hover:text-white transition-all active:scale-95 shadow-lg backdrop-blur-sm"
                  title="Modo Repartidor"
                >
                  <Truck size={20} />
                </button>
              )}
              <button 
                onClick={handleOpenProfile}
                className="w-11 h-11 rounded-2xl bg-white/10 border border-white/20 text-white flex items-center justify-center hover:bg-white/20 transition-all active:scale-95 shadow-lg backdrop-blur-sm"
                title="Mi Perfil"
              >
                <Settings size={20} />
              </button>
              <button 
                onClick={handleLogout}
                className="w-11 h-11 rounded-2xl bg-red-500/20 border border-red-500/30 text-red-200 flex items-center justify-center hover:bg-red-500 hover:text-white transition-all active:scale-95 shadow-lg backdrop-blur-sm"
                title="Cerrar Sesión"
              >
                <LogOut size={20} />
              </button>
            </div>
          </div>

          {/* Tarjeta de Saldo y WhatsApp Look */}
          <div className="bg-gradient-to-br from-[#075E54] to-[#128C7E] p-8 rounded-[2.5rem] text-white shadow-2xl relative overflow-hidden">
            {/* El fondo limpio sin el ícono feo */}
            
            <div className="relative z-10">
              {/* Day AI Assistant Header Clickable */}
              <button 
                onClick={() => window.dispatchEvent(new Event('open-ai-chat'))}
                className="flex flex-col items-start gap-4 mb-6 mt-2 text-left hover:scale-[1.02] active:scale-95 transition-transform w-full"
              >
                <div className="flex items-center gap-4">
                  <div className="w-16 h-16 rounded-full flex items-center justify-center shadow-lg shadow-black/30 shrink-0 border-2 border-emerald-300 relative overflow-hidden">
                    <img src="/day_avatar.jpg" className="w-full h-full object-cover" alt="Day AI" />
                  </div>
                  <div>
                    <h2 className="text-xl font-black tracking-tight leading-none text-white flex items-center gap-1.5">
                      <span>Soy Day, tu IA</span>
                      <span className="text-[10px] font-black text-emerald-200 tracking-[0.2em] bg-black/20 px-2 py-0.5 rounded-full">KALU</span>
                    </h2>
                    <p className="text-xs font-medium text-emerald-100 mt-1">
                      {new Date().getHours() < 12 ? '¡Buenos días' : new Date().getHours() < 18 ? '¡Buenas tardes' : '¡Buenas noches'}, {clientData.nombre.split(' ')[0]}!
                    </p>
                  </div>
                </div>
                <div className="bg-black/20 px-4 py-2.5 rounded-2xl border border-white/10 flex items-center gap-2 shadow-inner w-full sm:w-auto">
                  <Bot size={18} className="text-emerald-300 animate-pulse" />
                  <p className="text-xs font-black uppercase tracking-wider text-emerald-100 flex-1">
                    Toca aquí para hacer tu pedido por IA
                  </p>
                </div>
              </button>

              <div className="bg-black/20 backdrop-blur-md rounded-3xl p-6 border border-white/10">
                <div className="text-[10px] font-black uppercase tracking-widest opacity-60 mb-1">Tu Deuda Total</div>
                <div className="text-4xl font-black mb-1">{formatCurrency(clientData.saldo_usd)}</div>
                <div className="text-xs font-bold opacity-80">Equivalente a: {formatCurrency(clientData.saldo_usd, 'Bs', tasaBcv)}</div>
                
                <div className="mt-6 pt-6 border-t border-white/10 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="p-2 bg-yellow-500 rounded-xl text-black">
                      <Star size={16} fill="currentColor" />
                    </div>
                    <div>
                      <div className="text-lg font-black">{clientData.puntos}</div>
                      <div className="text-[8px] font-black uppercase opacity-60 leading-none">Club Kalu Pts</div>
                    </div>
                  </div>
                  <button 
                    onClick={() => {
                      setMontoReportarUSD(clientData.saldo_usd > 0 ? clientData.saldo_usd.toFixed(2) : '');
                      setShowReportarPagoModal(true);
                    }}
                    className="bg-white text-[#075E54] px-4 py-2 rounded-xl text-xs font-black uppercase tracking-widest active:scale-95 transition-transform"
                  >
                    Reportar Pago
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* Acciones principales */}
          <div className="grid grid-cols-3 gap-3">
            <button 
              onClick={() => setActiveTab('tienda')}
              className="bg-white/5 border border-white/10 p-4 rounded-[1.5rem] flex flex-col items-center gap-2 transition-colors hover:bg-white/10 text-white text-center"
            >
              <div className="p-2.5 bg-blue-500/20 text-blue-400 rounded-xl">
                <ShoppingBag size={20} />
              </div>
              <span className="text-[10px] font-black uppercase tracking-wider">Tienda Virtual</span>
            </button>
            <button 
              onClick={() => setActiveTab('compras')}
              className="bg-white/5 border border-white/10 p-4 rounded-[1.5rem] flex flex-col items-center gap-2 transition-colors hover:bg-white/10 text-white text-center"
            >
              <div className="p-2.5 bg-purple-500/20 text-purple-400 rounded-xl">
                <History size={20} />
              </div>
              <span className="text-[10px] font-black uppercase tracking-wider">Mis Movimientos</span>
            </button>
            <button 
              onClick={() => setShowQuejaModal(true)}
              className="bg-white/5 border border-white/10 p-4 rounded-[1.5rem] flex flex-col items-center gap-2 transition-colors hover:bg-white/10 text-white text-center"
            >
              <div className="p-2.5 bg-red-500/20 text-red-400 rounded-xl">
                <MessageSquare size={20} />
              </div>
              <span className="text-[10px] font-black uppercase tracking-wider text-ellipsis overflow-hidden whitespace-nowrap w-full">Buzón de Quejas</span>
            </button>
          </div>

          {/* Banner de Instalación PWA (Solo si no está instalada) */}
          {!isStandalone && (
            <div className="bg-gradient-to-r from-emerald-600/20 to-teal-600/20 border border-emerald-500/20 rounded-[2rem] p-6 text-white flex flex-col sm:flex-row items-center justify-between gap-4 relative overflow-hidden backdrop-blur-md">
              <div className="absolute top-0 left-0 w-32 h-32 bg-emerald-500/10 rounded-full blur-2xl pointer-events-none" />
              <div className="space-y-1 text-center sm:text-left z-10">
                <span className="text-[9px] font-black uppercase text-emerald-300 tracking-widest bg-emerald-500/25 px-2 py-0.5 rounded-full inline-block">Recomendado</span>
                <h3 className="text-base font-black uppercase tracking-tight text-white mt-1">Instala la Mini App</h3>
                <p className="text-xs text-gray-400 font-bold">Lleva tu portal siempre a la mano para acceso instantáneo.</p>
              </div>
              <button 
                onClick={async () => {
                  const promptEvent = (window as any).deferredPrompt || deferredPrompt;
                  if (promptEvent) {
                    promptEvent.prompt();
                    const { outcome } = await promptEvent.userChoice;
                    if (outcome === 'accepted') {
                      (window as any).deferredPrompt = null;
                      setDeferredPrompt(null);
                    }
                  } else {
                    alert('Para instalar: \n\n1. Abre las opciones de tu navegador (los tres puntitos ⋮ o el botón de compartir).\n2. Selecciona "Agregar a la pantalla principal" o "Instalar".');
                  }
                }}
                className="bg-emerald-500 hover:bg-emerald-400 text-white px-5 py-3 rounded-2xl text-xs font-black uppercase tracking-widest flex items-center gap-2 active:scale-95 transition-transform shrink-0 shadow-lg shadow-emerald-500/20 font-sans z-10"
              >
                <Smartphone size={16} /> Instalar
              </button>
            </div>
          )}

          {/* Banner de Propaganda / Video Promocional */}
          <div 
            onClick={() => setShowPropagandaModal(true)}
            className="group relative w-full aspect-[16/9] sm:aspect-[21/9] bg-slate-900 rounded-[2rem] overflow-hidden cursor-pointer border border-white/10 shadow-2xl"
          >
            {/* Video Thumbnail (solo primera toma) */}
            <video 
              src={propagandaVideoUrl ? (propagandaVideoUrl.includes('#t=') ? propagandaVideoUrl : `${propagandaVideoUrl}#t=0.001`) : ''}
              className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105 opacity-80"
              muted
              playsInline
              preload="metadata"
            />
            
            {/* Overlay Degradado para legibilidad */}
            <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/30 to-transparent pointer-events-none" />
            
            {/* Contenido y Botón de Play */}
            <div className="absolute inset-0 flex flex-col items-center justify-center p-6 text-center">
              <div className="w-16 h-16 bg-white/20 backdrop-blur-md rounded-full flex items-center justify-center border border-white/30 text-white mb-4 group-hover:scale-110 group-hover:bg-white/30 transition-all duration-300 shadow-[0_0_30px_rgba(255,255,255,0.2)]">
                <Play size={32} fill="currentColor" className="ml-1 drop-shadow-lg" />
              </div>
            </div>

            {/* Textos inferiores */}
            <div className="absolute bottom-6 left-6 right-6 flex flex-col sm:flex-row items-start sm:items-end justify-between gap-2">
              <div className="text-left">
                <span className="text-[10px] font-black uppercase text-purple-300 tracking-[0.2em] bg-purple-500/30 px-3 py-1 rounded-full backdrop-blur-md border border-purple-500/30 mb-2 inline-block">
                  Novedades Kalu
                </span>
                <h3 className="text-xl font-black text-white uppercase tracking-tight drop-shadow-lg leading-tight">
                  Propaganda Comercial
                </h3>
              </div>
              <span className="text-[10px] text-white/70 font-bold uppercase tracking-wider hidden sm:block">
                Toca para reproducir
              </span>
            </div>
          </div>

          {/* Sección de Mensajes y Avisos */}
          {mensajes.length > 0 && (
            <div className="space-y-4 animate-in fade-in slide-in-from-top-4 duration-500">
              <h3 className="text-sm font-black text-gray-500 uppercase tracking-[0.2em] px-4">Mensajes y Avisos</h3>
              <div className="space-y-3">
                {mensajes.map(m => (
                  <div key={m.id} className="bg-white/5 border border-white/10 rounded-3xl p-5 text-white flex gap-4 items-start relative">
                    <div className="p-2.5 bg-blue-500/10 text-blue-400 rounded-2xl shrink-0">
                      <Clock size={16} />
                    </div>
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <h4 className="font-black text-sm">{m.titulo}</h4>
                        <span className="text-[8px] font-bold text-gray-500">{new Date(m.fecha).toLocaleDateString()}</span>
                      </div>
                      <p className="text-xs text-gray-400 font-bold leading-relaxed">{m.contenido}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* SECCIÓN DE TICKETS DE SORTEO */}
          {myTickets.length > 0 && (
            <div className="bg-gradient-to-br from-yellow-500/20 to-orange-500/20 border border-yellow-500/30 p-6 rounded-[2rem] space-y-4 mb-2 relative overflow-hidden animate-in fade-in slide-in-from-top-4 duration-500">
              <div className="absolute top-[-20%] left-[-10%] w-[50%] h-[50%] bg-yellow-500/30 rounded-full blur-[120px] pointer-events-none" />
              <div className="relative z-10">
                <h3 className="text-xl font-black uppercase tracking-tighter text-transparent bg-clip-text bg-gradient-to-r from-yellow-300 to-orange-500 flex items-center gap-2 mb-4">
                  <Trophy className="text-yellow-400" size={24} /> 
                  Tus Tickets del Sorteo (15 KG Queso)
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {myTickets.map(ticket => (
                    <div key={ticket.id} className="bg-black/40 border border-yellow-500/20 p-4 rounded-2xl flex items-center gap-4">
                      <div className="bg-yellow-500/20 p-3 rounded-xl text-yellow-400 shrink-0">
                        <Ticket size={24} />
                      </div>
                      <div>
                        <p className="text-[10px] text-gray-400 font-black uppercase tracking-wider leading-none mb-1">TICKET POR COMPRA</p>
                        <p className="text-lg font-black text-white leading-none"># {ticket.codigo_pedido || 'TICKET'}</p>
                        <p className="text-[10px] text-gray-500 mt-1">{new Date(ticket.fecha).toLocaleDateString()}</p>
                      </div>
                    </div>
                  ))}
                </div>
                <p className="text-[10px] text-yellow-400/80 font-bold mt-4 leading-relaxed">
                  ¡Guarda estos tickets! Participas automáticamente en el sorteo semanal de 15 KG de queso. El ganador será anunciado en nuestras redes sociales este fin de semana.
                </p>
              </div>
            </div>
          )}

          {/* Facturas Pendientes */}
          <div className="space-y-4">
            <div className="flex items-center justify-between px-4">
              <h3 className="text-sm font-black text-gray-500 uppercase tracking-[0.2em]">Facturas Pendientes</h3>
              {mySales.length > 3 && (
                <button onClick={() => setActiveTab('compras')} className="text-xs font-bold text-[#3498db] uppercase tracking-wider">
                  Ver todas
                </button>
              )}
            </div>
            
            {activeOrders.map(sale => (
              <div 
                key={sale.id} 
                className="bg-white/5 border border-white/10 rounded-3xl overflow-hidden text-white"
              >
                {/* Header Compacto */}
                <div 
                  onClick={() => setExpandedInvoiceId(expandedInvoiceId === sale.id ? null : sale.id)}
                  className="flex items-center justify-between p-4 cursor-pointer hover:bg-white/10 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-white/5 flex items-center justify-center text-gray-400 shrink-0">
                      <ShoppingBag size={18} />
                    </div>
                    <div>
                      <div className="text-sm font-bold leading-tight">#{sale.codigo_pedido || sale.id.substring(0, 8)}</div>
                      <div className="text-[9px] text-gray-500 font-bold uppercase mt-0.5">
                        {sale.fecha ? new Date(sale.fecha).toLocaleDateString() : 'Pendiente'}
                      </div>
                    </div>
                  </div>
                  <div className="text-right flex items-center gap-3">
                    <div className="flex flex-col items-end">
                      <div className="text-sm font-black text-[#2ecc71] leading-tight">{formatCurrency(sale.total_usd)}</div>
                      <span className={cn(
                        "text-[8px] font-black uppercase px-2 py-0.5 rounded-full border mt-1",
                        (sale as any).status_pedido === 'listo'
                          ? "bg-blue-500/20 text-blue-400 border-blue-500/30 animate-pulse"
                          : sale.pagada 
                          ? "bg-green-500/20 text-green-400 border-green-500/10" 
                          : "bg-red-500/20 text-red-400 border-red-500/10"
                      )}>
                        {(sale as any).status_pedido === 'listo'
                          ? '¡Listo!'
                          : sale.pagada ? 'Pagada' : 'Pendiente'}
                      </span>
                    </div>
                    <ChevronRight size={16} className={cn("text-gray-500 transition-transform duration-300", expandedInvoiceId === sale.id ? "rotate-90" : "")} />
                  </div>
                </div>

                {/* Detalle Expandido */}
                {expandedInvoiceId === sale.id && (
                  <div className="p-4 border-t border-white/5 bg-black/20">
                    <OrderStepper status={(sale as any).status_pedido} tipoEntrega={(sale as any).tipo_entrega} />
                    <button 
                      onClick={(e) => { e.stopPropagation(); setActiveTab('compras'); }}
                      className="w-full mt-4 text-[10px] font-bold text-gray-400 uppercase tracking-widest text-center py-2 hover:text-white transition-colors"
                    >
                      Ver detalle completo
                    </button>
                  </div>
                )}
              </div>
            ))}

            {activeOrders.length === 0 && (
              <div className="text-center py-8 bg-white/5 border border-white/10 border-dashed rounded-3xl text-gray-500 text-xs font-bold">
                No tienes facturas pendientes.
              </div>
            )}
          </div>

          {/* Seguridad */}
          <div className="p-6 bg-white/5 border border-white/10 rounded-[2rem] text-center border-dashed">
            <div className="flex items-center justify-center gap-2 text-[10px] font-black text-gray-500 uppercase tracking-widest mb-2">
              <ShieldCheck size={14} className="text-green-500" /> Sistema Seguro SSL
            </div>
            <p className="text-[10px] text-gray-600 leading-relaxed font-bold">
              Tus datos están protegidos por KALUNEVA2024.<br/>
              Reporta cualquier irregularidad en caja.
            </p>
          </div>
        </div>
      )}

      {/* --- PESTAÑA TIENDA VIRTUAL --- */}
      {activeTab === 'tienda' && (
        <div className="space-y-6 animate-in fade-in duration-500">
          
          {/* Header de Tienda */}
          <div className="flex items-center justify-between text-white border-b border-white/5 pb-4 gap-2">
            <button 
              onClick={() => setActiveTab('inicio')}
              className="flex items-center gap-2 bg-white/5 border border-white/10 hover:bg-white/10 px-4 py-2 rounded-2xl text-xs font-black uppercase tracking-widest transition-all shrink-0"
            >
              <ArrowLeft size={16} /> Volver
            </button>
            <div className="flex items-center gap-2">
              <img src="/logo.png" className="w-8 h-8 rounded-lg object-contain bg-white p-0.5 shadow-sm" alt="Logo Kalu" />
              <span className="text-xs font-black tracking-widest uppercase hidden xs:inline">TIENDA KALU</span>
            </div>
            <div className="text-right shrink-0">
              <span className="text-[9px] text-gray-500 font-black uppercase tracking-wider block">Tasa BCV</span>
              <span className="text-sm font-black text-white">{tasaBcv.toFixed(2).replace('.', ',')} Bs/USD</span>
            </div>
          </div>

          {/* Buscador & Categorías */}
          <div className="bg-white/5 border border-white/10 p-5 rounded-[2rem] space-y-4">
            <div className="relative">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500" size={18} />
              <input 
                type="text"
                placeholder="Buscar productos..."
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
                className="w-full bg-black/40 border border-white/10 rounded-2xl py-3 pl-11 pr-4 text-sm text-white placeholder-gray-500 outline-none focus:border-[#3498db] transition-all font-semibold"
              />
            </div>
            <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-none">
              {categories.map((cat) => (
                <button
                  key={cat}
                  onClick={() => setSelectedCategory(cat)}
                  className={cn(
                    "px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest whitespace-nowrap transition-all",
                    selectedCategory === cat 
                      ? "bg-[#3498db] text-white" 
                      : "bg-white/5 text-gray-400 hover:text-white border border-white/5"
                  )}
                >
                  {cat}
                </button>
              ))}
            </div>
          </div>

          {/* Grid de Productos */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {filteredProducts.map(product => {
              const qty = getQuantityInCart(product.id);
              const price = product.precio_oferta_usd || product.precio_normal_usd;
              const hasOffer = !!product.precio_oferta_usd;

              return (
                <div 
                  key={product.id} 
                  className={cn(
                    "rounded-[2.5rem] p-5 flex flex-col justify-between transition-all duration-300 group shadow-lg border",
                    qty > 0 
                      ? "bg-[#3498db]/20 border-[#3498db]/40 shadow-[#3498db]/10 scale-[1.02]" 
                      : "bg-white/5 border-white/10 hover:bg-white/10 hover:border-white/20"
                  )}
                >
                  <div className="flex gap-4">
                    <div className="w-24 h-24 rounded-2xl overflow-hidden bg-black/40 relative shrink-0">
                      {product.imagen_url ? (
                        <img src={product.imagen_url} alt={product.nombre} className="w-full h-full object-cover group-hover:scale-105 transition-transform" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-gray-600">
                          <ShoppingBag size={24} />
                        </div>
                      )}
                      {product.stock <= 0 && (
                        <div className="absolute inset-0 bg-black/80 flex items-center justify-center">
                          <span className="text-[8px] font-black uppercase bg-red-500 px-1.5 py-0.5 rounded">Agotado</span>
                        </div>
                      )}
                    </div>

                    <div className="space-y-1 min-w-0 flex-1">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="bg-black/40 text-[7px] font-black uppercase px-2 py-0.5 rounded border border-white/5">
                          {product.categoria}
                        </span>
                        {hasOffer && (
                          <span className="bg-yellow-500 text-black text-[7px] font-black uppercase px-1.5 py-0.5 rounded">
                            Oferta
                          </span>
                        )}
                      </div>
                      <h4 className="font-bold text-sm uppercase truncate text-white">{product.nombre}</h4>
                      <p className="text-[10px] text-gray-400 line-clamp-2 leading-snug">{product.descripcion}</p>
                    </div>
                  </div>

                  <div className="mt-4 pt-3 border-t border-white/5 flex items-center justify-between">
                    <div>
                      <div className="flex items-baseline gap-1.5">
                        <span className="text-base font-black text-emerald-400">{formatCurrency(price)}</span>
                        {hasOffer && (
                          <span className="text-[10px] text-gray-500 line-through">{formatCurrency(product.precio_normal_usd)}</span>
                        )}
                      </div>
                      <div className="text-[9px] text-gray-500 font-bold">Bs. {formatCurrency(price * tasaBcv, 'Bs')}</div>
                    </div>

                    {product.stock > 0 && (
                      <div className="flex items-center">
                        {qty > 0 ? (
                          <div className="bg-white/5 border border-white/10 rounded-xl p-1 flex items-center gap-2">
                            <button 
                              onClick={() => removeFromCart(product.id)}
                              className="w-6 h-6 rounded-lg bg-white/10 flex items-center justify-center hover:bg-white/20"
                            >
                              <Minus size={10} />
                            </button>
                            <span className="text-xs font-black text-white w-4 text-center">{qty}</span>
                            <button 
                              onClick={() => addToCart(product)}
                              disabled={qty >= product.stock}
                              className="w-6 h-6 rounded-lg bg-white/10 flex items-center justify-center hover:bg-white/20 disabled:opacity-30"
                            >
                              <Plus size={10} />
                            </button>
                          </div>
                        ) : (
                          <button
                            onClick={() => addToCart(product)}
                            className="bg-[#3498db] text-white p-2.5 rounded-xl hover:bg-[#2980b9] active:scale-95 transition-all"
                          >
                            <Plus size={14} />
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Botón flotante de carrito siempre visible y movible */}
          <button 
            ref={cartRef}
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
            onPointerCancel={handlePointerUp}
            onClick={handleCartClick}
            style={{ transform: `translate(${cartPos.x}px, ${cartPos.y}px)`, touchAction: 'none' }}
            className={cn(
              "fixed bottom-6 right-6 bg-[#2ecc71] hover:bg-[#27ae60] text-white px-6 py-4 rounded-[2rem] shadow-2xl flex items-center gap-3 z-40 border border-emerald-400/20 touch-none select-none",
              isDraggingCart ? "opacity-90 scale-105 shadow-emerald-500/50 cursor-grabbing" : "transition-all active:scale-95 cursor-grab"
            )}
          >
            <div className="relative">
              <ShoppingCart size={20} fill="white" />
              {cartTotalItems > 0 && (
                <span className="absolute -top-3 -right-3 w-5 h-5 rounded-full bg-red-500 border border-white flex items-center justify-center text-[9px] font-black leading-none">
                  {cartTotalItems}
                </span>
              )}
            </div>
            <span className="text-xs font-black uppercase tracking-widest hidden sm:inline">Ver Carrito</span>
            <div className="flex flex-col items-end bg-black/20 px-3 py-1.5 rounded-xl">
              <span className="text-sm font-black leading-none mb-1">
                {formatCurrency(cartTotalUsd)}
              </span>
              <span className="text-[10px] text-emerald-200 font-bold leading-none">
                {formatCurrency(cartTotalUsd, 'Bs', tasaBcv).replace('VES', 'Bs.')}
              </span>
            </div>
          </button>
        </div>
      )}

      {/* --- PESTAÑA MOVIMIENTOS / HISTORIAL --- */}
      {activeTab === 'compras' && (
        <div className="space-y-6 animate-in fade-in duration-500 text-white">
          
          {/* Header */}
          <div className="flex items-center justify-between border-b border-white/5 pb-4 gap-2">
            <button 
              onClick={() => setActiveTab('inicio')}
              className="flex items-center gap-2 bg-white/5 border border-white/10 hover:bg-white/10 px-4 py-2 rounded-2xl text-xs font-black uppercase tracking-widest transition-all shrink-0"
            >
              <ArrowLeft size={16} /> Volver
            </button>
            <div className="flex items-center gap-2">
              <img src="/logo.png" className="w-8 h-8 rounded-lg object-contain bg-white p-0.5 shadow-sm" alt="Logo Kalu" />
              <span className="text-xs font-black tracking-widest uppercase text-gray-400 hidden xs:inline">HISTORIAL</span>
            </div>
            <h3 className="text-sm font-black uppercase tracking-widest text-gray-500 shrink-0">Mis Compras</h3>
          </div>

          {/* Lista de facturas completas */}
          <div className="space-y-6">
            {allRecentOrders.map(sale => (
              <div key={sale.id} className="bg-white/5 border border-white/10 p-6 rounded-[2rem] space-y-4">
                
                {/* Cabecera de Factura */}
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 border-b border-white/5 pb-3">
                  <div>
                    <div className="text-base font-black text-white uppercase tracking-tight">Factura #{sale.codigo_pedido || sale.id.substring(0, 8)}</div>
                    <div className="text-[10px] text-gray-500 font-bold uppercase flex items-center gap-1.5 mt-1">
                      <Calendar size={12} /> {new Date(sale.fecha).toLocaleDateString()} {new Date(sale.fecha).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <span className={cn(
                      "text-[9px] font-black uppercase px-2 py-1 rounded-lg border tracking-wider",
                      (sale as any).status_pedido === 'listo'
                        ? "bg-blue-500/20 text-blue-300 border-blue-500/35 animate-pulse"
                        : ((sale as any).status_pedido === 'en_camino' || (sale as any).status_pedido === 'efectivo_en_ruta')
                        ? "bg-purple-500/20 text-purple-300 border-purple-500/35 animate-pulse"
                        : (sale as any).status_pedido === 'entregado'
                        ? "bg-gray-500/10 text-gray-400 border-gray-500/20"
                        : (sale as any).status_pedido === 'verificando_pago'
                        ? "bg-orange-500/20 text-orange-400 border-orange-500/30 animate-pulse"
                        : "bg-yellow-500/10 text-yellow-400 border-yellow-500/20"
                    )}>
                      {(sale as any).status_pedido === 'pendiente' ? 'En espera (Recibido)' :
                       (sale as any).status_pedido === 'verificando_pago' ? 'Verificando Pago...' :
                       (sale as any).status_pedido === 'listo' ? ((sale as any).tipo_entrega === 'delivery' ? 'Listo (Esperando Repartidor)' : '¡Listo para Retirar!') :
                       ((sale as any).status_pedido === 'en_camino' || (sale as any).status_pedido === 'efectivo_en_ruta') ? '🚗 ¡En Camino!' :
                       (sale as any).status_pedido === 'entregado' ? 'Entregado' :
                       (sale as any).status_pedido === 'rechazado' ? 'Cancelado' :
                       'En preparación'}
                    </span>
                    <span className={cn(
                      "text-[9px] font-black uppercase px-2 py-1 rounded-lg border tracking-wider",
                      sale.pagada 
                        ? "bg-green-500/10 text-green-400 border-green-500/20" 
                        : "bg-red-500/10 text-red-400 border-red-500/20"
                    )}>
                      {sale.pagada ? 'Pagado' : 'Por Pagar'}
                    </span>
                  </div>
                </div>

                <OrderStepper status={(sale as any).status_pedido} tipoEntrega={(sale as any).tipo_entrega} />

                {/* Detalles de productos */}
                <div className="space-y-2">
                  {(sale.detalles || []).map((det, i) => (
                    <div key={i} className="flex justify-between items-center text-xs font-bold text-gray-300">
                      <span>{det.nombre} <span className="text-gray-500 font-black">x{det.cantidad}</span></span>
                      <span>{formatCurrency(det.precio_unitario_usd * det.cantidad)}</span>
                    </div>
                  ))}
                </div>

                {/* Totales y Tasa */}
                <div className="pt-3 border-t border-white/5 flex flex-col sm:flex-row justify-between items-start sm:items-end gap-2">
                  <div className="text-[10px] text-gray-500 font-bold">
                    Tasa de cambio: {sale.tasa_momento.toFixed(2).replace('.', ',')} Bs/USD
                  </div>
                  <div className="text-right w-full sm:w-auto">
                    <div className="text-[9px] text-gray-500 font-black uppercase tracking-wider leading-none">Total Factura</div>
                    <div className="text-xl font-black text-emerald-400">{formatCurrency(sale.total_usd)}</div>
                    <div className="text-xs text-gray-400 font-bold">Equivalente: {formatCurrency(sale.total_usd , 'Bs', sale.tasa_momento).replace('VES', 'Bs.')}</div>
                  </div>
                </div>
              </div>
            ))}

            {allRecentOrders.length === 0 && (
              <div className="text-center py-20 bg-white/5 border border-white/10 rounded-[2rem] border-dashed text-gray-500 font-bold uppercase tracking-widest text-xs">
                Ninguna compra registrada todavía.
              </div>
            )}
          </div>
        </div>
      )}

      {/* --- CART DRAWER PARA LA TIENDA --- */}
      {showCartDrawer && (
        <div className="fixed inset-0 z-50 flex justify-end">
          <div onClick={() => setShowCartDrawer(false)} className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
          
          <div className="relative w-full max-w-md bg-[#0f172a] h-screen max-h-screen shadow-2xl flex flex-col border-l border-white/10 z-10 animate-in slide-in-from-right duration-300 text-white">
            
            {/* Header */}
            <div className="p-6 border-b border-white/10 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-[#075E54]/20 text-[#2ecc71] flex items-center justify-center">
                  <ShoppingCart size={20} />
                </div>
                <div>
                  <h2 className="text-lg font-black uppercase tracking-tight">Tu Compra</h2>
                  <p className="text-[10px] text-gray-500 font-bold uppercase">{cartTotalItems} Artículos seleccionados</p>
                </div>
              </div>
              <button 
                onClick={() => setShowCartDrawer(false)}
                className="text-gray-500 hover:text-white text-xs font-black bg-white/5 px-3 py-1.5 rounded-xl border border-white/5"
              >
                CERRAR
              </button>
            </div>

            {/* List */}
            <div className="flex-1 overflow-y-auto p-6 space-y-4 custom-scrollbar">
              {cart.map((item, i) => {
                const itemPrice = item.product.precio_oferta_usd || item.product.precio_normal_usd;
                return (
                  <div key={`${item.product.id}-${item.pieza_id || i}`} className="relative flex items-center justify-between bg-white/5 border border-white/10 p-4 rounded-3xl gap-4 mt-2">
                    <button 
                      onClick={() => removeItemCompletely(item.product.id, item.pieza_id)}
                      className="absolute -top-2 -right-2 w-6 h-6 bg-red-500 text-white rounded-full flex items-center justify-center shadow-lg shadow-red-500/20 hover:bg-red-600 active:scale-95 z-10"
                    >
                      <X size={12} />
                    </button>
                    <div className="flex items-center gap-4 min-w-0">
                      <div className="w-12 h-12 rounded-xl overflow-hidden bg-black/40 shrink-0">
                        {item.product.imagen_url ? (
                          <img src={item.product.imagen_url} alt={item.product.nombre} className="w-full h-full object-cover" />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center text-gray-600">
                            <ShoppingBag size={18} />
                          </div>
                        )}
                      </div>
                      <div className="min-w-0">
                        <h4 className="text-sm font-bold text-white uppercase truncate">{item.product.nombre}</h4>
                        <div className="text-xs text-[#3498db] font-black">{formatCurrency(itemPrice)}</div>
                      </div>
                    </div>
                    
                    <div className="flex items-center gap-3 shrink-0">
                      <button 
                        onClick={() => removeFromCart(item.product.id)}
                        className="w-7 h-7 rounded-lg bg-white/5 text-gray-400 flex items-center justify-center hover:bg-white/10 hover:text-white"
                      >
                        <Minus size={12} />
                      </button>
                      <span className="text-xs font-black text-white w-4 text-center">{item.cantidad}</span>
                      <button 
                        onClick={() => addToCart(item.product)}
                        disabled={item.cantidad >= item.product.stock}
                        className="w-7 h-7 rounded-lg bg-white/5 text-gray-400 flex items-center justify-center hover:bg-white/10 hover:text-white disabled:opacity-30"
                      >
                        <Plus size={12} />
                      </button>
                    </div>
                  </div>
                );
              })}

              {/* Selector de Tipo de Entrega (Dentro del Scroll) */}
              <div className="space-y-2 border-t border-white/5 pt-4">
                <p className="text-[9px] font-black text-gray-500 uppercase tracking-widest">¿Cómo quieres recibir tu pedido?</p>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    onClick={() => setTipoEntrega('retiro')}
                    className={`p-3 rounded-2xl border text-xs font-black uppercase tracking-wider transition-all flex flex-col items-center gap-1.5 ${
                      tipoEntrega === 'retiro'
                        ? 'bg-blue-500/20 border-blue-500/50 text-blue-300'
                        : 'bg-white/5 border-white/10 text-gray-400 hover:bg-white/10'
                    }`}
                  >
                    <span className="text-lg">🏪</span>
                    Retiro en Tienda
                  </button>
                  <button
                    onClick={() => setTipoEntrega('delivery')}
                    className={`p-3 rounded-2xl border text-xs font-black uppercase tracking-wider transition-all flex flex-col items-center gap-1.5 relative ${
                      tipoEntrega === 'delivery'
                        ? 'bg-emerald-500/20 border-emerald-500/50 text-emerald-300'
                        : 'bg-white/5 border-white/10 text-gray-400 hover:bg-white/10'
                    }`}
                  >
                    {cartTotalUsd >= DELIVERY_MINIMO_USD && (
                      <span className="absolute -top-2 -right-2 bg-emerald-500 text-white text-[7px] font-black px-1.5 py-0.5 rounded-full leading-none">GRATIS</span>
                    )}
                    <span className="text-lg">🛵</span>
                    Delivery
                  </button>
                </div>

                {/* Banner de condiciones de delivery */}
                {tipoEntrega === 'delivery' && (
                  <div className={`p-3 rounded-xl border text-[9px] font-bold leading-relaxed ${
                    cartTotalUsd >= DELIVERY_MINIMO_USD
                      ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400'
                      : 'bg-yellow-500/10 border-yellow-500/20 text-yellow-400'
                  }`}>
                    {cartTotalUsd >= DELIVERY_MINIMO_USD ? (
                      <>
                        <span className="font-black">🎉 ¡DELIVERY GRATIS!</span> Tu pedido califica porque supera los {formatCurrency(DELIVERY_MINIMO_USD)}. El repartidor llegará en aprox. <span className="font-black">7 horas</span> desde que confirmes.
                      </>
                    ) : (
                      <>
                        <span className="font-black">⚡ Delivery Gratis desde {formatCurrency(DELIVERY_MINIMO_USD)}</span><br/>
                        Te faltan solo <span className="font-black text-white">{formatCurrency(DELIVERY_MINIMO_USD - cartTotalUsd)}</span> para calificar. ¡Agrega más productos!
                      </>
                    )}
                  </div>
                )}
              </div>

              {/* Selector de Método de Pago (Dentro del Scroll) */}
              <div className="space-y-2 border-t border-white/5 pt-4">
                <p className="text-[9px] font-black text-gray-500 uppercase tracking-widest">¿Cómo deseas pagar?</p>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    onClick={() => setMetodoPago('al_recibir')}
                    className={`p-3 rounded-2xl border text-[10px] font-black uppercase tracking-wider transition-all flex flex-col items-center gap-1.5 ${
                      metodoPago === 'al_recibir'
                        ? 'bg-blue-500/20 border-blue-500/50 text-blue-300'
                        : 'bg-white/5 border-white/10 text-gray-400 hover:bg-white/10'
                    }`}
                  >
                    <span className="text-base">💵</span>
                    Pagar al recibir
                  </button>
                  <button
                    onClick={() => setMetodoPago('inmediato')}
                    className={`p-3 rounded-2xl border text-[10px] font-black uppercase tracking-wider transition-all flex flex-col items-center gap-1.5 ${
                      metodoPago === 'inmediato'
                        ? 'bg-purple-500/20 border-purple-500/50 text-purple-300'
                        : 'bg-white/5 border-white/10 text-gray-400 hover:bg-white/10'
                    }`}
                  >
                    <span className="text-base">📱</span>
                    Pagar de una vez
                  </button>
                </div>

                {metodoPago === 'inmediato' && (
                  <div className="bg-black/30 border border-white/5 rounded-2xl p-4 space-y-3 mt-2 text-[10px]">
                    <div className="border-b border-white/5 pb-2 text-gray-400 font-bold">
                      <p className="text-purple-400 font-black mb-1 uppercase tracking-wider" style={{fontSize: '8px'}}>Datos de Pago Móvil (Toca para copiar):</p>
                      <p onClick={() => navigator.clipboard.writeText('0114')} className="cursor-pointer hover:text-emerald-400 active:scale-95 transition-all">🏦 Banco Caribe (0114)</p>
                      <p onClick={() => navigator.clipboard.writeText('04243068286')} className="cursor-pointer hover:text-emerald-400 active:scale-95 transition-all">📞 Teléfono: 0424-3068286</p>
                      <p onClick={() => navigator.clipboard.writeText('15082352')} className="cursor-pointer hover:text-emerald-400 active:scale-95 transition-all">🪪 Cédula: V-15082352</p>
                      <p className="mt-1 text-white font-black">Monto: {formatCurrency(cartTotalUsd , 'Bs', tasaBcv).replace('VES', 'Bs.')} (${cartTotalUsd.toFixed(2)})</p>
                    </div>

                    <div className="space-y-1.5">
                      <label className="text-gray-500 font-black uppercase" style={{fontSize: '8px'}}>Referencia de Pago</label>
                      <input 
                        type="text"
                        placeholder="Ingresa los últimos 4 o 6 dígitos..."
                        className="w-full bg-black/40 border border-white/10 rounded-xl px-3 py-2 text-white font-black focus:border-purple-500 outline-none text-xs"
                        value={referenciaPago}
                        onChange={e => setReferenciaPago(e.target.value)}
                        maxLength={50}
                      />
                    </div>

                    <div className="space-y-1.5">
                      <label className="text-gray-500 font-black uppercase block" style={{fontSize: '8px'}}>Sube Capture del Pago</label>
                      <div className="relative">
                        <input 
                          type="file"
                          accept="image/*"
                          className="hidden"
                          id="capture-upload"
                          onChange={handleCaptureChange}
                          disabled={cargandoCapture}
                        />
                        <label 
                          htmlFor="capture-upload"
                          className="w-full bg-white/5 hover:bg-white/10 border border-dashed border-white/10 rounded-xl py-3 px-4 flex items-center justify-center gap-2 cursor-pointer text-center text-xs font-bold text-gray-400 hover:text-white transition-colors"
                        >
                          {cargandoCapture ? (
                            <span className="w-4 h-4 border-2 border-purple-500 border-t-transparent rounded-full animate-spin" />
                          ) : captureBase64 ? (
                            <span className="text-purple-400">✓ Capture Cargado</span>
                          ) : (
                            <span>📸 Seleccionar Foto / Capture</span>
                          )}
                        </label>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Footer Fijo */}
            <div className="p-6 border-t border-white/10 bg-black/40 space-y-4 shrink-0">
              <div className="space-y-1.5">
                <div className="flex items-center justify-between text-xs text-gray-400 font-bold">
                  <span>Subtotal</span>
                  <span>{formatCurrency(cartTotalUsd)}</span>
                </div>
                <div className="flex items-baseline justify-between">
                  <span className="text-sm font-black uppercase text-white">Total del Pedido</span>
                  <div className="text-right">
                    <div className="text-2xl font-black text-emerald-400">{formatCurrency(cartTotalUsd)}</div>
                    <div className="text-xs text-gray-500 font-bold">Equivalente: {formatCurrency(cartTotalUsd , 'Bs', tasaBcv).replace('VES', 'Bs.')}</div>
                  </div>
                </div>
              </div>

              <button 
                onClick={handleConfirmOrder}
                disabled={placingOrder || cartTotalItems === 0}
                className="w-full bg-[#2ecc71] hover:bg-[#27ae60] text-white py-4 rounded-2xl font-black text-sm uppercase tracking-widest flex items-center justify-center gap-3 hover:opacity-95 active:scale-[0.98] transition-all shadow-lg shadow-emerald-500/10 disabled:opacity-50"
              >
                {placingOrder 
                  ? 'PROCESANDO...' 
                  : metodoPago === 'inmediato' 
                    ? '📱 ENVIAR PAGO Y PEDIDO' 
                    : tipoEntrega === 'delivery' 
                      ? '🛵 CONFIRMAR PEDIDO CON DELIVERY' 
                      : '🏪 CONFIRMAR PEDIDO'}
              </button>

              <div className="flex items-center justify-center gap-1.5 text-[8px] text-gray-600 font-black uppercase tracking-wider text-center">
                <ShieldCheck size={12} className="text-green-600" /> {metodoPago === 'inmediato' ? 'Pago pendiente por validar en caja' : 'Pagarás tu pedido al momento de recibirlo.'}
              </div>
            </div>

          </div>
        </div>
      )}

      {/* Modal Reportar Pago de Deuda */}
      {showReportarPagoModal && clientData && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
          <div className="relative w-full max-w-md bg-[#1e293b] border border-white/10 rounded-[2.5rem] shadow-2xl p-6 sm:p-8 text-white animate-in zoom-in-95 duration-200">
            <button 
              onClick={() => { setShowReportarPagoModal(false); setCaptureReportarBase64(null); }}
              className="absolute top-4 right-4 text-gray-400 hover:text-white bg-white/5 p-2 rounded-xl"
            >
              <X size={18} />
            </button>

            <h3 className="text-xl font-black uppercase tracking-tight text-white mb-2">Reportar Pago de Deuda</h3>
            <p className="text-xs text-gray-400 font-bold mb-6">
              Tu Deuda Total: <span className="text-red-400 font-black">${clientData.saldo_usd.toFixed(2)}</span> ({formatCurrency(clientData.saldo_usd , 'Bs', tasaBcv).replace('VES', 'Bs.')})
            </p>

            <form onSubmit={handleSendReportarPago} className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-[10px] font-black uppercase text-gray-500 tracking-widest px-1">Monto a Reportar (USD)</label>
                <div className="relative">
                  <span className="absolute left-4 top-1/2 -translate-y-1/2 text-green-500 font-black text-sm">$</span>
                  <input 
                    type="number" 
                    step="0.01"
                    className="w-full bg-black/40 border border-white/10 rounded-2xl py-3 pl-10 pr-4 text-right text-green-400 font-black text-lg focus:border-green-500 outline-none" 
                    placeholder="0.00"
                    value={montoReportarUSD}
                    onChange={e => setMontoReportarUSD(e.target.value)}
                    max={clientData.saldo_usd}
                    required
                  />
                </div>
                {parseFloat(montoReportarUSD) > 0 && (
                  <span className="text-[10px] text-gray-500 font-bold block text-right">
                    Equivale a {formatCurrency(parseFloat(montoReportarUSD), 'Bs', tasaBcv).replace('VES', 'Bs.')}
                  </span>
                )}
              </div>

              <div className="space-y-1.5">
                <label className="text-[10px] font-black uppercase text-gray-500 tracking-widest px-1">Método de Pago</label>
                <select 
                  className="w-full bg-[#151f32] border border-white/10 rounded-2xl p-3 text-sm font-bold text-white outline-none focus:border-blue-500"
                  value={metodoPagoReportar}
                  onChange={e => setMetodoPagoReportar(e.target.value as any)}
                >
                  <option value="pago_movil_bs">📱 Pago Móvil (Bs)</option>
                  <option value="transferencia_bs">🏦 Transferencia Bancaria (Bs)</option>
                </select>
              </div>

              <div className="bg-black/25 border border-white/5 rounded-2xl p-4 text-[10px] space-y-1 text-gray-400">
                <p className="text-purple-400 font-black uppercase tracking-wider mb-1" style={{fontSize: '8px'}}>Datos de Pago (Toca para copiar):</p>
                <p onClick={() => navigator.clipboard.writeText('0114')} className="cursor-pointer hover:text-emerald-400 active:scale-95 transition-all">🏦 Banco Caribe (0114)</p>
                <p onClick={() => navigator.clipboard.writeText('04243068286')} className="cursor-pointer hover:text-emerald-400 active:scale-95 transition-all">📞 Teléfono: 0424-3068286</p>
                <p onClick={() => navigator.clipboard.writeText('15082352')} className="cursor-pointer hover:text-emerald-400 active:scale-95 transition-all">🪪 Cédula: V-15082352</p>
              </div>

              <div className="space-y-1.5">
                <label className="text-[10px] font-black uppercase text-gray-500 tracking-widest px-1">Referencia</label>
                <input 
                  type="text" 
                  className="w-full bg-black/40 border border-white/10 rounded-2xl p-3 text-sm font-bold text-white focus:border-blue-500 outline-none"
                  placeholder="Últimos 4 o 6 dígitos..."
                  value={referenciaReportar}
                  onChange={e => setReferenciaReportar(e.target.value)}
                  maxLength={50}
                  required
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-[10px] font-black uppercase text-gray-500 tracking-widest px-1">Sube Capture del Pago</label>
                <div className="relative">
                  <input 
                    type="file"
                    accept="image/*"
                    className="hidden"
                    id="capture-upload-reportar"
                    onChange={handleCaptureReportarChange}
                    disabled={cargandoCaptureReportar}
                  />
                  <label 
                    htmlFor="capture-upload-reportar"
                    className="w-full bg-white/5 hover:bg-white/10 border border-dashed border-white/10 rounded-2xl py-3 px-4 flex items-center justify-center gap-2 cursor-pointer text-center text-xs font-bold text-gray-400 hover:text-white transition-colors"
                  >
                    {cargandoCaptureReportar ? (
                      <span className="w-4 h-4 border-2 border-purple-500 border-t-transparent rounded-full animate-spin" />
                    ) : captureReportarBase64 ? (
                      <span className="text-purple-400">✓ Capture Cargado</span>
                    ) : (
                      <span>📸 Seleccionar Foto / Capture</span>
                    )}
                  </label>
                </div>
              </div>

              <button 
                type="submit"
                disabled={enviandoReporte || cargandoCaptureReportar || !captureReportarBase64}
                className="w-full py-4 bg-green-600 hover:bg-green-500 text-white font-black uppercase tracking-[3px] rounded-2xl shadow-xl transition-all active:scale-95 disabled:opacity-50 mt-4 text-xs"
              >
                {enviandoReporte ? 'Enviando...' : 'Enviar Pago'}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Modal Buzón de Quejas */}
      {showQuejaModal && clientData && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
          <div className="relative w-full max-w-md bg-[#1e293b] border border-white/10 rounded-[2.5rem] shadow-2xl p-6 sm:p-8 text-white animate-in zoom-in-95 duration-200">
            <button 
              onClick={() => { setShowQuejaModal(false); setTituloQueja(''); setMensajeQueja(''); }}
              className="absolute top-4 right-4 text-gray-400 hover:text-white bg-white/5 p-2 rounded-xl"
            >
              <X size={18} />
            </button>

            <h3 className="text-xl font-black uppercase tracking-tight text-white mb-2 flex items-center gap-2">
              <MessageSquare className="text-red-400 animate-pulse" size={24} />
              <span>Buzón de Quejas</span>
            </h3>
            <p className="text-xs text-gray-400 font-bold mb-6 uppercase tracking-wider">
              Tus comentarios van directamente al dueño y son 100% confidenciales.
            </p>

            <form onSubmit={handleSendQueja} className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-[10px] font-black uppercase text-gray-500 tracking-widest px-1">Asunto / Título</label>
                <input 
                  type="text" 
                  className="w-full bg-black/40 border border-white/10 rounded-2xl p-3 text-sm font-bold text-white focus:border-red-500 outline-none"
                  placeholder="Ej. Problema con mi saldo, Mala atención..."
                  value={tituloQueja}
                  onChange={e => setTituloQueja(e.target.value)}
                  maxLength={100}
                  required
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-[10px] font-black uppercase text-gray-500 tracking-widest px-1">Detalle de tu Queja o Sugerencia</label>
                <textarea 
                  className="w-full bg-black/40 border border-white/10 rounded-2xl p-3 text-sm font-bold text-white focus:border-red-500 outline-none h-32 resize-none"
                  placeholder="Escribe aquí tu mensaje de forma detallada..."
                  value={mensajeQueja}
                  onChange={e => setMensajeQueja(e.target.value)}
                  maxLength={500}
                  required
                />
              </div>

              <button 
                type="submit"
                disabled={enviandoQueja || !tituloQueja.trim() || !mensajeQueja.trim()}
                className="w-full py-4 bg-red-600 hover:bg-red-500 text-white font-black uppercase tracking-[3px] rounded-2xl shadow-xl transition-all active:scale-95 disabled:opacity-50 mt-4 text-xs"
              >
                {enviandoQueja ? 'Enviando...' : 'Enviar al Dueño'}
              </button>
            </form>
          </div>
        </div>
      )}
      {/* Modal Mi Perfil */}
      {showProfileModal && clientData && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
          <div className="relative w-full max-w-md bg-[#1e293b] border border-white/10 rounded-[2.5rem] shadow-2xl p-6 sm:p-8 text-white animate-in zoom-in-95 duration-200">
            <button 
              onClick={() => setShowProfileModal(false)}
              className="absolute top-4 right-4 text-gray-400 hover:text-white bg-white/5 p-2 rounded-xl"
            >
              <X size={18} />
            </button>

            <h3 className="text-xl font-black uppercase tracking-tight text-white mb-2 flex items-center gap-2">
              <Settings className="text-[#3498db]" size={24} />
              <span>Mi Perfil</span>
            </h3>
            <p className="text-xs text-gray-400 font-bold mb-6 uppercase tracking-wider">
              Actualiza tus datos de contacto para recibir notificaciones y promociones.
            </p>

            {profileSuccessMessage && (
              <div className="mb-4 p-4 bg-emerald-500/20 border border-emerald-500/30 rounded-2xl flex items-center gap-3">
                <CheckCircle2 className="text-emerald-400 shrink-0" size={20} />
                <p className="text-xs font-bold text-emerald-200">{profileSuccessMessage}</p>
              </div>
            )}
            
            <div className="mb-6">
              <BiometricSetupButton email={user?.email || ''} userData={user} />
            </div>

            <form onSubmit={handleSaveProfile} className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-[10px] font-black uppercase text-gray-500 tracking-widest px-1">Teléfono</label>
                <input 
                  type="tel" 
                  className="w-full bg-black/40 border border-white/10 rounded-2xl p-3 text-sm font-bold text-white focus:border-[#3498db] outline-none"
                  placeholder="Ej. +584141234567"
                  value={editPhone}
                  onChange={e => setEditPhone(e.target.value)}
                  maxLength={20}
                  required
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-[10px] font-black uppercase text-gray-500 tracking-widest px-1">Correo Electrónico (Opcional)</label>
                <input 
                  type="email" 
                  className="w-full bg-black/40 border border-white/10 rounded-2xl p-3 text-sm font-bold text-white focus:border-[#3498db] outline-none"
                  placeholder="ejemplo@correo.com"
                  value={editEmail}
                  onChange={e => setEditEmail(e.target.value)}
                  maxLength={100}
                />
              </div>

              <button 
                type="submit"
                disabled={isSavingProfile}
                className="w-full py-4 bg-[#3498db] hover:bg-[#2980b9] text-white font-black uppercase tracking-[3px] rounded-2xl shadow-xl transition-all active:scale-95 disabled:opacity-50 mt-4 text-xs"
              >
                {isSavingProfile ? 'Guardando...' : 'Guardar Cambios'}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Modal Reproductor de Propaganda (Pantalla Completa Inmersiva) */}
      {showPropagandaModal && (
        <div className="fixed inset-0 z-50 bg-black flex items-center justify-center animate-in fade-in duration-300">
          {/* Botón de Cerrar Flotante */}
          <button 
            onClick={() => setShowPropagandaModal(false)}
            className="absolute top-6 right-6 text-white/85 hover:text-white bg-white/10 hover:bg-white/20 p-4 rounded-full z-50 transition-all active:scale-95 shadow-2xl backdrop-blur-md border border-white/10"
            title="Cerrar Video"
          >
            <X size={24} />
          </button>

          {/* Contenedor del Video */}
          <div className="w-full h-full flex items-center justify-center relative">
            <video 
              src={propagandaVideoUrl ? (propagandaVideoUrl.includes('#t=') ? propagandaVideoUrl : `${propagandaVideoUrl}#t=0.001`) : ''} 
              controls 
              autoPlay 
              playsInline
              preload="metadata"
              className="w-full h-full object-contain max-h-screen"
            />
          </div>
        </div>
      )}

      {/* AI Shopping Assistant */}
      <AIShoppingAssistant
        products={products}
        clientName={clientData?.nombre || 'Cliente'}
        clientDebt={clientData?.saldo_usd || 0}
        cart={cart}
        tasaBcv={tasaBcv}
        onAddToCart={addToCart}
        onGoToStore={() => setActiveTab('tienda')}
        onShowCart={() => setShowCartDrawer(true)}
      />

      {/* Selector de Piezas */}
      {selectedPieceProduct && (
        <PieceSelectionModal
          isOpen={true}
          onClose={() => setSelectedPieceProduct(null)}
          product={selectedPieceProduct}
          onSelect={handlePieceSelect}
        />
      )}

    </div>
  );
};

export default ClientPortal;
