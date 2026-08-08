import React, { useEffect, useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { useActiveStore } from '../../hooks/useActiveStore';
import { 
  ShoppingBag, 
  Search, 
  Plus, 
  Minus, 
  ShoppingCart, 
  ArrowRight, 
  ArrowLeft,
  Sparkles, 
  ShieldCheck, 
  Smartphone,
  Shield,
  KeyRound,
  UserPlus,
  X,
  LogIn,
  CheckCircle2,
  Rocket
} from 'lucide-react';
import { cn, formatCurrency, compressImage } from '../../lib/utils';
import { 
  subscribeToCollection, 
  getLatestTasa, 
  createClient,
  updateStock,
  updateDocument,
  createSale,
  addDocument,
  getActiveStoreId
} from '../../lib/dbUtils';
import { signInWithPinCustom, db, isMock } from '../../lib/firebase';
import { collection, query, where, getDocs, doc, getDoc } from 'firebase/firestore';
import { useAuth } from '../../contexts/AuthProvider';
import { type Product } from '../../types';

interface CartItem {
  product: Product;
  cantidad: number;
}

const PublicCatalogScreen: React.FC = () => {
  const navigate = useNavigate();
  const { user, setUser } = useAuth();
  const { activeStore } = useActiveStore();
  
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [tasaBcv, setTasaBcv] = useState(40.50);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('TODOS');
  const [portalFueraDeServicio, setPortalFueraDeServicio] = useState(false);
  const [estadoPortalVal, setEstadoPortalVal] = useState('automatico');
  const [storeName, setStoreName] = useState<string>('');

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

  
  // Carrito de compras local
  const [cart, setCart] = useState<CartItem[]>([]);
  const [showCartDrawer, setShowCartDrawer] = useState(false);

  // Estados del Modal de Autenticación Integrado
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [authView, setAuthView] = useState<'register' | 'login'>('register');
  const [authLoading, setAuthLoading] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);
  const [showDownloadPrompt, setShowDownloadPrompt] = useState(false);
  const [pendingUser, setPendingUser] = useState<any>(null);

  // Estados de carga de pedido
  const [placingOrder, setPlacingOrder] = useState(false);
  const [orderSuccess, setOrderSuccess] = useState<string | null>(null);
  const [tipoEntrega, setTipoEntrega] = useState<'retiro' | 'delivery'>('retiro');
  const [metodoPago, setMetodoPago] = useState<'al_recibir' | 'inmediato'>('al_recibir');
  const [referenciaPago, setReferenciaPago] = useState('');
  const [captureBase64, setCaptureBase64] = useState<string | null>(null);
  const [cargandoCapture, setCargandoCapture] = useState(false);

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

  const DELIVERY_MINIMO_USD = 5.00;

  // Formulario de Registro
  const [regNombre, setRegNombre] = useState('');
  const [regCedula, setRegCedula] = useState('');
  const [regTelefono, setRegTelefono] = useState('');
  const [regDireccion, setRegDireccion] = useState('');
  const [showAddressModal, setShowAddressModal] = useState(false);
  const [addressData, setAddressData] = useState({
    tipoVia: '',
    nombreVia: '',
    detalle: ''
  });
  const [regPin, setRegPin] = useState('');
  const [regConfirmPin, setRegConfirmPin] = useState('');

  // Formulario de Login
  const [loginPin, setLoginPin] = useState('');

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

  // Cargar productos y tasa BCV
  useEffect(() => {
    const fetchProducts = async () => {
      try {
        const q = query(collection(db, 'products'), where('storeId', '==', getActiveStoreId()));
        const snap = await getDocs(q);
        const data = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        setProducts(data as Product[]);
      } catch (error) {
        console.error("Error fetching products:", error);
      } finally {
        setLoading(false);
      }
    };
    fetchProducts();

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

    const unsubConfig = subscribeToCollection('configuracion', (data) => {
      const globalConfig = data.find((c: any) => c.id === 'global');
      let outOfService = false;
      const estado = globalConfig?.estado_portal || 'automatico';
      setEstadoPortalVal(estado);

      if (estado === 'abierto') {
        outOfService = false;
      } else if (estado === 'cerrado') {
        outOfService = true;
      } else {
        // Modo automático: Abierto solo de 6:00 AM a 6:00 PM (18:00)
        const hour = new Date().getHours();
        outOfService = (hour < 6 || hour >= 18);
      }
      
      setPortalFueraDeServicio(outOfService);
    });

    // Cargar carrito previo del localStorage
    const savedCart = localStorage.getItem('kalu_public_cart');
    if (savedCart) {
      try {
        setCart(JSON.parse(savedCart));
      } catch (e) {
        console.error("Error cargando carrito local:", e);
      }
    }

    return () => {
      unsubTasa();
      unsubConfig();
    };
  }, []);

  // Guardar carrito en localStorage cuando cambie
  useEffect(() => {
    localStorage.setItem('kalu_public_cart', JSON.stringify(cart));
  }, [cart]);

  // Filtro de categorías y búsqueda
  const categories = ['TODOS', ...Array.from(new Set(products.map(p => String(p.categoria || 'GENERAL').trim().toUpperCase())))];

  const filteredProducts = products.filter(product => {
    const matchesSearch = (product.nombre || '').toLowerCase().includes(searchTerm.toLowerCase()) || 
                          String(product.codigo || '').toLowerCase().includes(searchTerm.toLowerCase());
    const matchesCategory = selectedCategory === 'TODOS' || 
                            (product.categoria || 'GENERAL').trim().toUpperCase() === selectedCategory;
    return matchesSearch && matchesCategory;
  });

  const addToCart = (product: Product) => {
    setCart(prev => {
      const existing = prev.find(item => item.product.id === product.id);
      if (existing) {
        if (existing.cantidad >= product.stock) return prev;
        return prev.map(item => 
          item.product.id === product.id 
            ? { ...item, cantidad: Number(item.cantidad) + 0.5 } 
            : item
        );
      }
      return [...prev, { product, cantidad: 1 }];
    });
  };

  const removeFromCart = (productId: string) => {
    setCart(prev => {
      const existing = prev.find(item => item.product.id === productId);
      if (existing && existing.cantidad > 0.5) {
        return prev.map(item => 
          item.product.id === productId 
            ? { ...item, cantidad: Number(item.cantidad) - 0.5 } 
            : item
        );
      }
      return prev.filter(item => item.product.id !== productId);
    });
  };

  const removeItemCompletely = (productId: string) => {
    setCart(prev => prev.filter(item => item.product.id !== productId));
  };

  const getQuantityInCart = (productId: string) => {
    return cart.find(item => item.product.id === productId)?.cantidad || 0;
  };

  const cartTotalUsd = cart.reduce((sum, item) => {
    const price = item.product.precio_oferta_usd || item.product.precio_normal_usd;
    return sum + (price * item.cantidad);
  }, 0);

  const cartTotalItems = cart.reduce((sum, item) => sum + item.cantidad, 0);

  // Registro de Cliente "Ahí Mismo"
  const handleRegisterSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    const nombreLimpio = regNombre.trim();
    const cedulaLimpia = regCedula.trim();

    if (!nombreLimpio || !cedulaLimpia || !regPin || !regConfirmPin) {
      setAuthError('Por favor complete los campos obligatorios (*)');
      return;
    }
    if (!regDireccion || !addressData.tipoVia || !addressData.nombreVia || !addressData.detalle) {
      setAuthError('Por favor agregue y complete su Dirección de Entrega detallada.');
      return;
    }
    if (regPin.length !== 6 || !/^\d+$/.test(regPin)) {
      setAuthError('El PIN debe tener exactamente 6 números');
      return;
    }
    if (regPin !== regConfirmPin) {
      setAuthError('Los códigos PIN no coinciden');
      return;
    }

    setAuthLoading(true);
    setAuthError(null);

    try {
      // El sistema ahora permite repetir PIN porque la llave primaria de acceso es (Cédula + PIN)

      const clientData = {
        nombre: nombreLimpio,
        cedula: cedulaLimpia,
        telefono: regTelefono.trim(),
        direccion: regDireccion,
        direccion_estructurada: {
          tipoVia: addressData.tipoVia.trim(),
          nombreVia: addressData.nombreVia.trim(),
          detalle: addressData.detalle.trim()
        },
        pin: regPin,
        saldo_usd: 0,
        puntos: 0
      };

      const clientId = await createClient(clientData);

      const registeredUser = {
        id: clientId,
        username: nombreLimpio,
        role: 'cliente' as any,
        pin: regPin,
        cedula: cedulaLimpia,
        clientId: clientId
      };
      
      setPendingUser(registeredUser);
      setShowDownloadPrompt(true);
      
      // Limpiar inputs
      setRegNombre('');
      setRegCedula('');
      setRegTelefono('');
      setRegDireccion('');
      setRegPin('');
      setRegConfirmPin('');
    } catch (err: any) {
      setAuthError('Error al registrarse: ' + err.message);
    } finally {
      setAuthLoading(false);
    }
  };

  // Login de Cliente por PIN "Ahí Mismo"
  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (loginPin.length < 4) return;

    setAuthLoading(true);
    setAuthError(null);

    try {
      const loggedUser = await signInWithPinCustom(loginPin);
      setUser(loggedUser);
      setShowAuthModal(false);
      setLoginPin('');
    } catch (err: any) {
      setAuthError('PIN incorrecto o usuario no registrado');
      setLoginPin('');
    } finally {
      setAuthLoading(false);
    }
  };

  // Confirmar y procesar pedido para clientes ya autenticados
  const handleConfirmOrder = async () => {
    
    if (cart.length === 0 || placingOrder || !user) return;
    setPlacingOrder(true);
    setAuthError(null);

    try {
      // 1. Obtener datos del cliente y productos
      let clientData: any = null;
      let latestProducts: any[] = [];

      if (isMock) {
        const clientsRes = await fetch('/api/db/clients');
        const allClients = await clientsRes.json();
        clientData = allClients.find((c: any) => c.id === user.clientId || c.id === user.id || c.cedula === user.cedula);

        const productsRes = await fetch('/api/db/products');
        latestProducts = await productsRes.json();
      } else {
        
        // 1. Intentar por ID directo (clientId o id)
        const targetClientId = user.clientId || user.id;
        if (targetClientId) {
          const docSnap = await getDoc(doc(db, 'clients', targetClientId));
          if (docSnap.exists()) {
            clientData = { id: docSnap.id, ...docSnap.data() };
          }
        }
        
        // 2. Fallback por Cédula
        if (!clientData && user.cedula) {
          const qClient = query(collection(db, 'clients'), where('cedula', '==', user.cedula));
          const clientSnap = await getDocs(qClient);
          if (!clientSnap.empty) {
            clientData = { id: clientSnap.docs[0].id, ...clientSnap.docs[0].data() };
          }
        }

        // Buscar productos
        const productsSnap = await getDocs(collection(db, 'products'));
        latestProducts = productsSnap.docs.map(d => ({ id: d.id, ...d.data() }));
      }

      if (!clientData) {
        throw new Error("No se encontraron los datos de tu cliente en el sistema.");
      }

      if (tipoEntrega === 'delivery') {
        const hasDireccion = clientData.direccion && clientData.direccion.trim() !== '';
        const hasEstructurada = clientData.direccion_estructurada && 
                                clientData.direccion_estructurada.tipoVia && 
                                clientData.direccion_estructurada.nombreVia;
        
        if (!hasDireccion && !hasEstructurada) {
          alert("Para solicitar delivery debes tener una dirección de entrega válida registrada. Comunícate con la tienda para actualizarla o escoge Retiro.");
          setPlacingOrder(false);
          return;
        }
      }

      for (const item of cart) {
        const dbProd = latestProducts.find((p: any) => p.id === item.product.id);
        if (dbProd && dbProd.stock < item.cantidad) {
          alert(`Lo sentimos, el producto "${item.product.nombre}" ya no tiene suficiente stock.`);
          setPlacingOrder(false);
          return;
        }
      }

      if (metodoPago === 'inmediato' && !referenciaPago.trim()) {
        alert("Por favor introduce el número de referencia del pago.");
        setPlacingOrder(false);
        return;
      }

      // 3. Crear la Venta
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
          precio_unitario_usd: item.product.precio_oferta_usd || item.product.precio_normal_usd
        }))
      };

      const newSaleId = await createSale(saleData);

      // 4. Descontar Stock de Productos
      for (const item of cart) {
        await updateStock(item.product.id, item.cantidad, 'VENTA_TIENDA_VIRTUAL', user?.id || 'cliente');
      }

      // 5. Actualizar la Deuda y los Puntos del Cliente en el servidor
      const nuevoSaldo = metodoPago === 'inmediato' ? (clientData.saldo_usd || 0) : ((clientData.saldo_usd || 0) + cartTotalUsd);
      const nuevosPuntos = (clientData.puntos || 0) + Math.round(cartTotalUsd);
      await updateDocument('clients', clientData.id, {
        saldo_usd: nuevoSaldo,
        puntos: nuevosPuntos
      });

      // 5.5 Generar Factura Digital en Mensajes
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
      });

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
      alert("Ocurrió un error al procesar tu pedido: " + e.message);
    } finally {
      setPlacingOrder(false);
    }
  };

  const handleCheckoutClick = () => {
    navigate('/login');
  };

  const isKaluStore = (activeStore?.name || storeName || '').toLowerCase().includes('kalu');
  const storeLogoFromDB = (activeStore as any)?.logo || (activeStore as any)?.image_url || (activeStore as any)?.imagen_url || (activeStore as any)?.imagen;
  const displayLogo = storeLogoFromDB ? storeLogoFromDB : (isKaluStore ? "/tienda.kalu.jpg?v=4" : "/logo.jpg?v=2027");

  if (portalFueraDeServicio) {
    return (
      <div 
        className="min-h-screen text-slate-100 font-sans flex flex-col items-center justify-center p-4 text-center"
        style={{
          backgroundImage: `linear-gradient(rgba(15, 23, 42, 0.95), rgba(15, 23, 42, 0.98)), url('${displayLogo}')`,
          backgroundSize: 'cover',
          backgroundPosition: 'center',
          backgroundAttachment: 'fixed'
        }}
      >
        <div className="w-24 h-24 bg-red-500/20 text-red-500 rounded-full flex items-center justify-center mb-6 border border-red-500/30">
          <Shield size={48} />
        </div>
        <h1 className="text-4xl font-black mb-4">PORTAL CERRADO</h1>
        <p className="text-gray-400 max-w-md text-lg">
          Nuestro portal de compras se encuentra cerrado por mantenimiento y mejoras.
        </p>
        <p className="text-amber-400 font-bold mt-2">
          El horario de atención es de 6:00 AM a 6:00 PM.
        </p>
        <button 
          onClick={() => window.location.reload()}
          className="mt-8 px-6 py-3 bg-white/10 hover:bg-white/20 border border-white/20 rounded-xl font-bold transition-all text-sm uppercase tracking-widest"
        >
          Actualizar Página
        </button>
        <button 
          onClick={() => navigate('/login')}
          className="mt-12 text-xs text-white/30 hover:text-white/60 transition-all font-medium uppercase tracking-widest"
        >
          Acceso Staff
        </button>
      </div>
    );
  }

  if (activeStore?.features?.hasOnlineStore === false) {
    return (
      <div 
        className="min-h-screen text-slate-100 font-sans flex flex-col items-center justify-center p-4 text-center"
        style={{
          backgroundImage: `linear-gradient(rgba(15, 23, 42, 0.95), rgba(15, 23, 42, 0.98)), url('${displayLogo}')`,
          backgroundSize: 'cover',
          backgroundPosition: 'center',
          backgroundAttachment: 'fixed'
        }}
      >
        <div className="w-24 h-24 bg-blue-500/20 text-blue-500 rounded-full flex items-center justify-center mb-6 border border-blue-500/30">
          <ShoppingBag size={48} />
        </div>
        <h1 className="text-4xl font-black mb-4">PORTAL INACTIVO</h1>
        <p className="text-gray-400 max-w-md text-lg">
          Esta tienda opera únicamente de forma presencial. El portal web se encuentra inactivo.
        </p>
        <button 
          onClick={() => navigate('/')}
          className="mt-8 px-6 py-3 bg-white/10 hover:bg-white/20 border border-white/20 rounded-xl font-bold transition-all text-sm uppercase tracking-widest flex items-center justify-center gap-2 mx-auto"
        >
          <ArrowLeft size={16} /> Volver al Directorio
        </button>
      </div>
    );
  }

  return (
    <div 
      className="min-h-screen text-slate-100 font-sans pb-28 bg-[#050505] relative overflow-x-hidden"
    >
      {/* Background Image overlay with dark tint */}
      <div 
        className="fixed inset-0 opacity-20 pointer-events-none mix-blend-overlay"
        style={{
          backgroundImage: `url('${displayLogo}')`,
          backgroundSize: 'cover',
          backgroundPosition: 'center',
          backgroundAttachment: 'fixed',
          filter: 'grayscale(50%)'
        }}
      />

      {/* Background Glows (Estilo Dorado) */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden z-0">
        <div className="absolute top-0 right-0 w-96 h-96 bg-amber-500 blur-[150px] rounded-full opacity-10 -translate-y-1/2 translate-x-1/2" />
        <div className="absolute top-1/3 left-0 w-96 h-96 bg-amber-400 blur-[150px] rounded-full opacity-[0.07] -translate-x-1/2" />
      </div>

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
                Tu pedido se ha enviado con éxito al POS. Ya puedes ver su estatus y retirar tus productos en tienda.
              </p>
            </div>
            <button 
              onClick={() => { setOrderSuccess(null); navigate('/client-portal'); }}
              className="w-full bg-amber-400 hover:bg-[#27ae60] text-white py-4 rounded-2xl font-black uppercase tracking-widest transition-colors active:scale-95"
            >
              Ir a mi Portal de Compras
            </button>
          </div>
        </div>
      )}

      <div className="relative z-10 max-w-6xl mx-auto px-4 pt-4">
        
        {/* Botón de Volver */}
        <button 
          onClick={() => navigate('/')}
          className="mb-4 flex items-center gap-1.5 text-amber-500 hover:text-amber-400 font-black uppercase tracking-widest text-xs transition-colors"
        >
          <ArrowLeft size={16} /> Volver al Directorio
        </button>

        {/* Header / Banner (Estilo Dorado - Idéntico en Móvil y PC) */}
        <header className="flex flex-col items-center justify-between gap-4 mb-6 bg-gradient-to-br from-[#1e1b04] to-black p-5 sm:p-6 rounded-3xl shadow-xl relative overflow-hidden text-white border-2 border-amber-400/80 shadow-amber-500/20">
          
          <div className="flex flex-col items-center gap-3 w-full text-center">
            <div className="w-20 h-20 rounded-full flex items-center justify-center bg-white p-0.5 shadow-md mx-auto shrink-0 border border-white/10">
              <img 
                src={displayLogo} 
                alt="Logo Tienda" 
                className="max-w-full max-h-full rounded-full object-contain"
              />
            </div>
            <div className="space-y-1">
              <div className="inline-flex items-center justify-center gap-1 bg-amber-500/20 text-amber-300 px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-widest mx-auto">
                ★ TIENDA OFICIAL
              </div>
              <h1 className="text-3xl font-black tracking-tight leading-none uppercase text-amber-400 mt-1">
                {getActiveStoreId() === 'farmacia-mastri' ? 'Farmacia Mastri' : (activeStore?.name || (storeName && storeName !== 'KALU' ? storeName : 'TIENDA VIRTUAL'))}
              </h1>
              <p className="text-xs font-medium text-gray-300 max-w-md mx-auto mt-1 line-clamp-2">
                Catálogo Digital: Añade productos al carrito y pide sin hacer cola.
              </p>
            </div>
          </div>

          <div className="flex flex-row items-center justify-between w-full gap-2 bg-black/40 backdrop-blur-md px-5 py-3 rounded-2xl border border-white/10 mt-2">
            <div className="text-[9px] font-black uppercase tracking-widest text-amber-500">Tasa de Cambio</div>
            <div className="text-2xl font-black text-white">{tasaBcv.toFixed(2)} <span className="text-[10px] font-bold text-gray-400">Bs/USD</span></div>
            <div className="text-[8px] uppercase tracking-widest font-black bg-amber-500/20 text-amber-300 px-2 py-0.5 rounded-full border border-amber-500/20">
              BCV Oficial
            </div>
          </div>
        </header>

        {/* Barra de Estatus de Sesión (Solo para Invitados) */}
        {!user && (
          <div className="bg-white/5 border border-white/10 rounded-[2rem] p-5 sm:p-6 mb-8 flex flex-col items-center gap-4 text-white backdrop-blur-md text-center">
            <div className="space-y-1">
              <p className="text-sm font-bold text-gray-300">¿Ya estás registrado en nuestro sistema?</p>
              <p className="text-[10px] text-gray-500 uppercase font-black tracking-wide">Inicia sesión rápido con tu PIN para comprar fiado y ver tus saldos.</p>
            </div>
            <button 
              onClick={() => navigate('/login')}
              className="bg-amber-500 hover:bg-amber-400 text-black font-black text-xs uppercase tracking-widest px-8 py-3.5 rounded-xl transition-all active:scale-95 flex items-center justify-center gap-2 shadow-lg shadow-amber-500/20 w-full sm:w-auto"
            >
              <LogIn size={14} className="text-black" /> INICIAR SESIÓN
            </button>
          </div>
        )}

        {/* Search & Filters */}
        <section className="bg-[#1e1b04]/40 border border-amber-500/10 backdrop-blur-md p-4 sm:p-5 rounded-[2rem] mb-6 space-y-3 shadow-xl">
          <div className="relative">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-amber-500/50" size={18} />
            <input 
              type="text"
              placeholder="Buscar productos por nombre o código..."
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              className="w-full bg-black/60 border border-amber-500/20 rounded-2xl py-3 pl-11 pr-4 text-white placeholder-gray-500 outline-none focus:border-amber-400 transition-colors font-semibold text-sm"
            />
          </div>

          <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-none">
            {categories.map((cat) => (
              <button
                key={cat}
                onClick={() => setSelectedCategory(cat)}
                className={cn(
                  "px-4 py-2 rounded-full text-[10px] sm:text-xs font-black uppercase tracking-widest whitespace-nowrap transition-all active:scale-95 border",
                  selectedCategory === cat 
                    ? "bg-amber-500 text-black border-amber-500 shadow-lg shadow-amber-500/20" 
                    : "bg-white/5 text-gray-400 hover:text-amber-400 hover:bg-white/10 border-white/5 hover:border-amber-500/30"
                )}
              >
                {cat === 'TODOS' ? '🏠 TODOS' : cat}
              </button>
            ))}
          </div>
        </section>

        {/* Product Grid */}
        {loading ? (
          <div className="flex flex-col items-center justify-center py-16 gap-5">
            <img 
              src={displayLogo} 
              alt="Logo Tienda" 
              className="w-12 h-12 rounded-full object-cover flex-shrink-0 shadow-sm border border-white/10"
            />
            <div className="flex flex-col items-center gap-2">
              <div className="w-8 h-8 border-4 border-amber-500 border-t-transparent rounded-full animate-spin" />
              <p className="text-amber-500/70 font-black uppercase tracking-widest text-[10px]">Cargando productos...</p>
            </div>
          </div>
        ) : filteredProducts.length === 0 ? (
          <div className="text-center py-16 bg-[#1e1b04]/40 border border-amber-500/10 rounded-[2rem] border-dashed">
            <ShoppingBag className="mx-auto text-amber-500/30 mb-4" size={48} />
            <h3 className="text-lg font-bold text-gray-300">No se encontraron productos</h3>
            <p className="text-gray-500 text-sm mt-1">Prueba con otra categoría o término de búsqueda.</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
            {filteredProducts.map(product => {
              const qty = getQuantityInCart(product.id);
              const price = product.precio_oferta_usd || product.precio_normal_usd;
              const hasOffer = !!product.precio_oferta_usd;

              return (
                <button 
                  key={product.id} 
                  onClick={handleCheckoutClick}
                  className={cn(
                    "rounded-3xl p-3 flex flex-col justify-between transition-all duration-300 group shadow-lg border text-left",
                    "bg-[#1e1b04]/40 border-amber-500/10 hover:bg-black/60 hover:border-amber-500/40 hover:-translate-y-1 hover:shadow-amber-500/10"
                  )}
                >
                  <div className="flex flex-col gap-2 flex-1 w-full">
                    <div className="w-full aspect-square rounded-2xl overflow-hidden bg-black/50 relative shrink-0 border border-white/5">
                      {product.imagen_url ? (
                        <img 
                          src={product.imagen_url} 
                          alt={product.nombre}
                          className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500"
                          loading="lazy"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-amber-500/20">
                          <ShoppingBag size={32} />
                        </div>
                      )}
                      
                      {product.stock <= 0 ? (
                        <div className="absolute inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center">
                          <span className="bg-red-500/90 text-white font-black text-[10px] uppercase tracking-widest px-2 py-1 rounded-lg">
                            Agotado
                          </span>
                        </div>
                      ) : product.stock <= 5 ? (
                        <span className="absolute bottom-2 left-2 bg-amber-500/90 text-black text-[8px] font-black uppercase tracking-widest px-2 py-0.5 rounded-full">
                          Quedan {product.stock}
                        </span>
                      ) : null}
                    </div>

                    <div className="space-y-1 mt-1 flex-1 flex flex-col w-full">
                      <div className="flex items-center gap-1.5 flex-wrap mb-1">
                        <span className="bg-black/60 text-[8px] font-black text-amber-200/50 uppercase px-1.5 py-0.5 rounded border border-amber-500/10 truncate max-w-[80%]">
                          {product.categoria}
                        </span>
                        {hasOffer && (
                          <span className="bg-amber-500 text-black text-[8px] font-black uppercase px-1.5 py-0.5 rounded shadow-lg">
                            Oferta
                          </span>
                        )}
                      </div>
                      <h3 className="text-xs font-black text-white leading-tight uppercase line-clamp-2 group-hover:text-amber-400 transition-colors">{product.nombre}</h3>
                    </div>
                  </div>

                  <div className="mt-2 pt-2 border-t border-amber-500/10 flex flex-col gap-2 w-full">
                    <div className="flex flex-col">
                      <div className="flex items-baseline gap-1.5">
                        <span className="text-sm font-black text-amber-400">
                          {formatCurrency(price)}
                        </span>
                        {hasOffer && (
                          <span className="text-[9px] text-gray-500 line-through font-bold">
                            {formatCurrency(product.precio_normal_usd)}
                          </span>
                        )}
                      </div>
                      <div className="text-[9px] text-amber-500/60 font-bold">
                        {formatCurrency(price , 'Bs', tasaBcv).replace('VES', 'Bs.')}
                      </div>
                    </div>

                    {product.stock > 0 && (
                      <div className="bg-amber-500/10 text-amber-500 border border-amber-500/30 group-hover:text-black px-2 py-1.5 rounded-xl shadow-lg flex items-center justify-center font-black uppercase text-[10px] tracking-widest group-hover:bg-amber-500 transition-colors w-full">
                        Comprar
                      </div>
                    )}
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* --- MODAL DE AUTENTICACIÓN / REGISTRO INTEGRADO --- */}
      {showAuthModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
          <div className="bg-[#1e293b] border border-white/10 rounded-[2.5rem] w-full max-w-md p-6 sm:p-8 relative overflow-hidden shadow-2xl animate-in zoom-in-95 duration-200">
            {/* Close button */}
            <button 
              onClick={() => setShowAuthModal(false)}
              className="absolute top-4 right-4 text-gray-400 hover:text-white bg-white/5 p-2 rounded-xl"
            >
              <X size={18} />
            </button>

            {/* Modal Title */}
            {!showDownloadPrompt && (
              <div className="text-center mb-6">
                <div className="inline-flex p-1.5 rounded-2xl bg-white border border-white/10 mb-3 shadow-md">
                  <img 
                    src={displayLogo} 
                    alt="Logo Tienda" 
                    className="w-10 h-10 rounded-full object-cover flex-shrink-0 shadow-sm"
                  />
                </div>
                <h3 className="text-xl font-black uppercase tracking-tight text-white">
                  {authView === 'register' ? 'Registro de Vecino' : 'Ingresa tu PIN'}
                </h3>
                <p className="text-xs text-gray-400 mt-1 font-bold">
                  {authView === 'register' ? 'Créate una cuenta en 10 segundos para comprar' : 'Accede rápido a tu portal de compras'}
                </p>
              </div>
            )}

            {authError && (
              <div className="bg-red-500/10 border border-red-500/20 p-3.5 rounded-2xl text-red-400 text-xs font-bold flex items-start gap-2.5 mb-4">
                <Shield size={16} className="shrink-0" />
                <span>{authError}</span>
              </div>
            )}

            {/* VISTA DE REGISTRO / DESCARGA */}
            {showDownloadPrompt ? (
              <div className="space-y-6 text-center animate-in zoom-in duration-500">
                <div className="w-24 h-24 bg-[#111] border border-amber-500/30 rounded-3xl mx-auto flex items-center justify-center shadow-2xl">
                   <Rocket size={48} className="text-white" />
                </div>
                <div>
                  <h2 className="text-2xl font-black text-white uppercase tracking-tight">¡Registro Exitoso!</h2>
                  <p className="text-amber-400 font-bold mt-1">¿Quieres descargar la Mini App?</p>
                </div>
                <div className="bg-white/5 p-4 rounded-2xl border border-white/10 text-left space-y-3">
                  <p className="text-sm text-gray-300 font-medium">Lleva Kalu siempre contigo. Para instalar rápido y fácil:</p>
                  <ul className="text-xs text-gray-400 space-y-2 font-bold">
                    <li className="flex items-center gap-2"><div className="w-1.5 h-1.5 rounded-full bg-amber-400"></div> 1. Toca Menú (⋮) o Compartir en tu navegador</li>
                    <li className="flex items-center gap-2"><div className="w-1.5 h-1.5 rounded-full bg-amber-400"></div> 2. Selecciona "Agregar a inicio" o "Instalar app"</li>
                  </ul>
                </div>
                <div className="flex flex-col gap-3 pt-4">
                  <button 
                    onClick={() => {
                      if (pendingUser) setUser(pendingUser);
                      setShowAuthModal(false);
                      setShowDownloadPrompt(false);
                    }}
                    className="w-full bg-amber-400 text-white py-4 rounded-xl font-black hover:bg-[#2980b9] transition-all shadow-[0_10px_20px_rgba(52,152,219,0.2)]"
                  >
                    ¡ENTENDIDO, ENTRAR A COMPRAR!
                  </button>
                </div>
              </div>
            ) : authView === 'register' ? (
              <form onSubmit={handleRegisterSubmit} className="space-y-4">
                <div className="space-y-1">
                  <label className="text-[9px] font-black uppercase text-gray-500 tracking-widest px-2">Nombre Completo *</label>
                  <input 
                    type="text"
                    required
                    value={regNombre}
                    onChange={(e) => setRegNombre(e.target.value)}
                    className="w-full bg-black/40 border border-white/10 rounded-xl py-2.5 px-4 text-sm font-semibold text-white outline-none focus:border-amber-400 transition-all"
                    placeholder="Ej. Juan Pérez"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[9px] font-black uppercase text-gray-500 tracking-widest px-2">Cédula de Identidad *</label>
                  <input 
                    type="text"
                    required
                    value={regCedula}
                    onChange={(e) => setRegCedula(e.target.value)}
                    className="w-full bg-black/40 border border-white/10 rounded-xl py-2.5 px-4 text-sm font-semibold text-white outline-none focus:border-amber-400 transition-all"
                    placeholder="Ej. V-12345678"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[9px] font-black uppercase text-gray-500 tracking-widest px-2">Teléfono</label>
                  <input 
                    type="text"
                    value={regTelefono}
                    onChange={(e) => setRegTelefono(e.target.value)}
                    className="w-full bg-black/40 border border-white/10 rounded-xl py-2.5 px-4 text-sm font-semibold text-white outline-none focus:border-amber-400 transition-all"
                    placeholder="Ej. 0424-5556677"
                  />
                </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-[9px] font-black uppercase text-gray-500 tracking-widest px-2">PIN Clave (6 números) *</label>
                  <input 
                    type="password"
                    required
                    maxLength={6}
                    value={regPin}
                    onChange={(e) => setRegPin(e.target.value.replace(/\D/g, ''))}
                    className="w-full bg-black/40 border border-white/10 rounded-xl py-2.5 px-4 text-center text-lg font-black tracking-widest text-amber-400 outline-none focus:border-amber-400 transition-all"
                    placeholder="****"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[9px] font-black uppercase text-gray-500 tracking-widest px-2">Confirmar PIN *</label>
                  <input 
                    type="password"
                    required
                    maxLength={6}
                    value={regConfirmPin}
                    onChange={(e) => setRegConfirmPin(e.target.value.replace(/\D/g, ''))}
                    className="w-full bg-black/40 border border-white/10 rounded-xl py-2.5 px-4 text-center text-lg font-black tracking-widest text-amber-400 outline-none focus:border-amber-400 transition-all"
                    placeholder="****"
                  />
                </div>
              </div>

              <div className="pt-2 pb-1">
                <div 
                  onClick={() => setShowAddressModal(true)}
                  className={`w-full border rounded-xl py-3.5 px-4 text-xs font-black uppercase tracking-widest text-center cursor-pointer transition-all shadow-[0_0_15px_rgba(251,191,36,0.1)] ${addressData.tipoVia ? 'bg-amber-500/20 border-amber-500 text-amber-400' : 'bg-black/60 border-white/20 text-gray-400 hover:border-amber-400'}`}
                >
                  {addressData.tipoVia ? "¡Dirección lista! ✓" : "Toca para agregar Dirección de Entrega *"}
                </div>
              </div>

              <button 
                type="submit"
                disabled={authLoading || !regNombre.trim() || !regCedula.trim() || regPin.length !== 6 || regPin !== regConfirmPin || !regDireccion}
                className={`w-full text-black shadow-[0_0_15px_rgba(251,191,36,0.4)] py-3.5 rounded-xl font-black text-xs uppercase tracking-widest transition-all ${authLoading || !regNombre.trim() || !regCedula.trim() || regPin.length !== 6 || regPin !== regConfirmPin || !regDireccion ? 'bg-gray-600 text-gray-400 cursor-not-allowed shadow-none' : 'bg-amber-400 text-black hover:opacity-90 active:scale-98'}`}
              >
                {authLoading ? 'REGISTRANDO...' : 'REGISTRARME Y COMPRAR'}
              </button>

              <div className="text-center pt-2">
                <button 
                  type="button"
                  onClick={() => { setAuthView('login'); setAuthError(null); }}
                  className="text-xs text-amber-400 font-bold hover:underline"
                >
                  ¿Ya tienes una cuenta? Inicia sesión aquí
                </button>
              </div>
            </form>
            ) : authView === 'login' ? (
            <form onSubmit={handleLoginSubmit} className="space-y-6">
              <div className="space-y-2">
                <label className="text-[10px] font-black uppercase text-gray-500 tracking-widest px-2 block text-center">Introduce tu PIN de 6 dígitos</label>
                <input 
                  type="password"
                  maxLength={6}
                  value={loginPin}
                  autoFocus
                  onChange={(e) => setLoginPin(e.target.value.replace(/\D/g, ''))}
                  className="w-full bg-black/40 border border-white/10 rounded-2xl py-4 px-4 text-center text-3xl font-black tracking-[0.8em] text-amber-400 outline-none focus:border-amber-400 transition-all"
                  placeholder="****"
                />
              </div>

              <button 
                type="submit"
                disabled={loginPin.length < 6 || authLoading}
                className="w-full bg-amber-400 text-white py-3.5 rounded-xl font-black text-xs uppercase tracking-widest hover:bg-[#27ae60] transition-all disabled:opacity-50"
              >
                {authLoading ? 'ENTRANDO...' : 'INICIAR SESIÓN Y COMPRAR'}
              </button>

              <div className="text-center pt-2">
                <button 
                  type="button"
                  onClick={() => { setAuthView('register'); setAuthError(null); }}
                  className="text-xs text-amber-400 font-bold hover:underline"
                >
                  ¿Eres nuevo? Regístrate gratis aquí
                </button>
              </div>
            </form>
            ) : null}
        </div>
      </div>
    )}

    <AnimatePresence>
      {showAddressModal && (
        <div className="fixed inset-0 z-[99999] flex items-center justify-center p-4">
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setShowAddressModal(false)}
            className="absolute inset-0 bg-black/80 backdrop-blur-md"
          />
          <motion.div 
            initial={{ opacity: 0, scale: 0.9, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9, y: 20 }}
            className="relative w-full max-w-sm bg-gradient-to-b from-[#1a1a1a] to-black border-2 border-amber-500/50 rounded-[2rem] shadow-[0_0_50px_-12px_rgba(251,191,36,0.3)] overflow-hidden"
          >
            <div className="p-6 border-b border-white/5 flex items-center justify-between bg-amber-500/10">
              <h2 className="text-xl font-black text-amber-500 uppercase tracking-widest">
                DIRECCIÓN
              </h2>
              <button onClick={() => setShowAddressModal(false)} className="p-2 hover:bg-white/5 rounded-xl transition-colors text-white">
                <X size={20} />
              </button>
            </div>

            <div className="p-6 space-y-5">
              <div className="space-y-2">
                <label className="text-[10px] font-black text-amber-500/70 uppercase tracking-widest px-2">Tipo de Vía</label>
                <select 
                  className="w-full bg-black/40 border border-amber-500/30 rounded-xl p-3 focus:outline-none focus:border-amber-500 transition-all font-bold text-amber-400 appearance-none"
                  value={addressData.tipoVia}
                  onChange={e => setAddressData({...addressData, tipoVia: e.target.value})}
                >
                  <option value="" className="bg-black text-white">Selecciona...</option>
                  <option value="Avenida" className="bg-black text-white">Avenida</option>
                  <option value="Calle" className="bg-black text-white">Calle</option>
                  <option value="Vereda" className="bg-black text-white">Vereda</option>
                  <option value="Calle Nacional" className="bg-black text-white">Calle Nacional</option>
                  <option value="Carrera" className="bg-black text-white">Carrera</option>
                  <option value="Carretera" className="bg-black text-white">Carretera</option>
                </select>
              </div>

              <div className="space-y-2">
                <label className="text-[10px] font-black text-amber-500/70 uppercase tracking-widest px-2">Nombre / Número de Vía</label>
                <input 
                  type="text" 
                  className="w-full bg-black/40 border border-amber-500/30 rounded-xl p-3 focus:outline-none focus:border-amber-500 transition-all font-bold text-amber-400 focus:text-amber-300 placeholder-amber-500/30" 
                  placeholder="Ej. Principal"
                  value={addressData.nombreVia}
                  onChange={e => setAddressData({...addressData, nombreVia: e.target.value})}
                />
              </div>

              <div className="space-y-2">
                <label className="text-[10px] font-black text-amber-500/70 uppercase tracking-widest px-2">Detalles (Urb, Bloque, Casa...)</label>
                <textarea 
                  rows={2}
                  className="w-full bg-black/40 border border-amber-500/30 rounded-xl p-3 focus:outline-none focus:border-amber-500 transition-all font-bold text-amber-400 focus:text-amber-300 placeholder-amber-500/30 resize-none" 
                  placeholder="Ej. Urb. Los Mangos, Bloque 5, Apto 23"
                  value={addressData.detalle}
                  onChange={e => setAddressData({...addressData, detalle: e.target.value})}
                />
              </div>

              <button 
                type="button"
                onClick={() => {
                  if (!addressData.tipoVia || !addressData.nombreVia.trim() || !addressData.detalle.trim()) {
                    alert('Por favor completa todos los campos de la dirección (Tipo de Vía, Nombre y Detalles).');
                    return;
                  }
                  const parts = [];
                  if (addressData.tipoVia) parts.push(addressData.tipoVia);
                  if (addressData.nombreVia) parts.push(addressData.nombreVia.trim());
                  let combined = parts.join(' ');
                  if (addressData.detalle) combined += combined ? `, ${addressData.detalle.trim()}` : addressData.detalle.trim();
                  setRegDireccion(combined.trim());
                  setShowAddressModal(false);
                }}
                className="w-full mt-4 bg-gradient-to-r from-amber-600 to-amber-500 hover:from-amber-500 hover:to-amber-400 text-black py-4 rounded-xl font-black uppercase tracking-[2px] shadow-[0_0_20px_rgba(251,191,36,0.3)] transition-all active:scale-95"
              >
                Confirmar Dirección
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  </div>
);
};

export default PublicCatalogScreen;

