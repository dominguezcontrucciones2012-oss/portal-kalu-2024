import React, { useEffect, useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  ShoppingBag, 
  Search, 
  Plus, 
  Minus, 
  ShoppingCart, 
  ArrowRight, 
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
  addDocument
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
  
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [tasaBcv, setTasaBcv] = useState(40.50);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('TODOS');
  const [portalFueraDeServicio, setPortalFueraDeServicio] = useState(false);

  
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
    const unsub = subscribeToCollection('products', (data) => {
      setProducts(data as Product[]);
      setLoading(false);
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

    const unsubConfig = subscribeToCollection('configuracion', (data) => {
      const globalConfig = data.find((c: any) => c.id === 'global');
      let outOfService = false;
      const estado = globalConfig?.estado_portal || 'automatico';

      if (estado === 'cerrado' || globalConfig?.portal_fuera_servicio === true) {
        outOfService = true;
      } else if (estado === 'abierto') {
        outOfService = false;
      } else {
        // Modo automático: Cerrado hasta el martes 16 a las 6:00 AM
        const now = new Date();
        const reopenDate = new Date(2026, 5, 16, 6, 0, 0); // Mes 5 = Junio
        if (now < reopenDate) {
          outOfService = true;
        } else {
          const hour = now.getHours();
          outOfService = (hour < 6 || hour >= 18);
        }
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
      unsub();
      unsubTasa();
      unsubConfig();
    };
  }, []);

  // Guardar carrito en localStorage cuando cambie
  useEffect(() => {
    localStorage.setItem('kalu_public_cart', JSON.stringify(cart));
  }, [cart]);

  // Filtro de categorías y búsqueda
  const categories = ['TODOS', ...Array.from(new Set(products.map(p => (p.categoria || 'GENERAL').trim().toUpperCase())))];

  const filteredProducts = products.filter(product => {
    const matchesSearch = (product.nombre || '').toLowerCase().includes(searchTerm.toLowerCase()) || 
                          (product.codigo || '').toLowerCase().includes(searchTerm.toLowerCase());
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
    if (!regNombre || !regCedula || !regPin || !regConfirmPin) {
      setAuthError('Por favor complete los campos obligatorios (*)');
      return;
    }
    if (regPin.length !== 4 || !/^\d+$/.test(regPin)) {
      setAuthError('El PIN debe tener exactamente 4 números');
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
        nombre: regNombre,
        cedula: regCedula,
        telefono: regTelefono,
        direccion: regDireccion,
        pin: regPin,
        saldo_usd: 0,
        puntos: 0
      };

      const clientId = await createClient(clientData);

      const registeredUser = {
        id: clientId,
        username: regNombre,
        role: 'cliente' as any,
        pin: regPin,
        cedula: regCedula,
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
      const saleData = {
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
      const invoiceContent = `📄 FACTURA DIGITAL #${newSaleId.substring(0, 8)}
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
        titulo: `📄 Factura Digital #${newSaleId.substring(0, 8)}`,
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
      setOrderSuccess(newSaleId);
    } catch (e: any) {
      console.error("Error al colocar pedido:", e);
      alert("Ocurrió un error al procesar tu pedido: " + e.message);
    } finally {
      setPlacingOrder(false);
    }
  };

  const handleCheckoutClick = () => {
    setAuthError(null);
    setAuthView('register');
    setShowAuthModal(true);
  };

  if (portalFueraDeServicio && (!user || user.role !== 'admin')) {
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
          <Shield size={48} />
        </div>
        <h1 className="text-4xl font-black mb-4">PORTAL CERRADO</h1>
        <p className="text-gray-400 max-w-md text-lg">
          Nuestro portal de compras se encuentra cerrado por mantenimiento y mejoras.
        </p>
        <p className="text-[#3498db] font-bold mt-2">
          Estaremos de vuelta el martes 16 a las 6:00 AM.
        </p>
        <button 
          onClick={() => window.location.reload()}
          className="mt-8 px-6 py-3 bg-white/10 hover:bg-white/20 border border-white/20 rounded-xl font-bold transition-all text-sm uppercase tracking-widest"
        >
          Actualizar Página
        </button>
      </div>
    );
  }

  return (
    <div 
      className="min-h-screen text-slate-100 font-sans pb-28"
      style={{
        backgroundImage: "linear-gradient(rgba(15, 23, 42, 0.88), rgba(15, 23, 42, 0.95)), url('/logo.png')",
        backgroundSize: 'cover',
        backgroundPosition: 'center',
        backgroundAttachment: 'fixed'
      }}
    >
      {/* Background Glows */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden z-0">
        <div className="absolute top-0 right-0 w-96 h-96 bg-[#3498db] blur-[150px] rounded-full opacity-10 -translate-y-1/2 translate-x-1/2" />
        <div className="absolute top-1/3 left-0 w-96 h-96 bg-[#2ecc71] blur-[150px] rounded-full opacity-5 -translate-x-1/2" />
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
              <p className="text-xs text-gray-400 font-bold uppercase tracking-wider">Factura #{orderSuccess.substring(0, 8)}</p>
              <p className="text-sm text-gray-300 mt-2">
                Tu pedido se ha enviado con éxito al POS. Ya puedes ver su estatus y retirar tus productos en tienda.
              </p>
            </div>
            <button 
              onClick={() => { setOrderSuccess(null); navigate('/client-portal'); }}
              className="w-full bg-[#2ecc71] hover:bg-[#27ae60] text-white py-4 rounded-2xl font-black uppercase tracking-widest transition-colors active:scale-95"
            >
              Ir a mi Portal de Compras
            </button>
          </div>
        </div>
      )}

      <div className="relative z-10 max-w-6xl mx-auto px-4 pt-6">
        
        {/* Header / Banner */}
        <header className="flex flex-col sm:flex-row items-center justify-between gap-4 mb-8 bg-gradient-to-br from-[#075E54] to-[#128C7E] p-6 sm:p-8 rounded-[2.5rem] shadow-2xl relative overflow-hidden text-white">
          <div className="absolute top-0 right-0 p-4 opacity-5 pointer-events-none">
            <img src="/logo.png" className="w-40 h-40 object-contain rounded-full" alt="" />
          </div>
          
          <div className="flex flex-col sm:flex-row items-center gap-6 text-center sm:text-left">
            <img src="/logo.png" className="w-20 h-20 rounded-3xl object-cover border-2 border-white/25 bg-white p-1 shadow-lg shrink-0" alt="Logo Kalu" />
            <div className="space-y-2">
              <div className="inline-flex items-center gap-2 bg-white/20 backdrop-blur-md px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-widest">
                <Sparkles size={12} className="text-yellow-400" /> Catálogo Digital del Vecino
              </div>
              <h1 className="text-3xl sm:text-4xl font-black tracking-tight leading-none">TIENDA VIRTUAL KALU</h1>
              <p className="text-sm font-medium text-emerald-100 max-w-md">
                Explora nuestros productos de calidad. Añade lo que necesites al carrito y realiza tu pedido en segundos sin colas.
              </p>
            </div>
          </div>

          <div className="flex flex-col items-center sm:items-end gap-2 bg-black/20 backdrop-blur-md px-6 py-4 rounded-3xl border border-white/10 shrink-0">
            <div className="text-[10px] font-black uppercase tracking-widest opacity-60">Tasa de Cambio BCV</div>
            <div className="text-3xl font-black">{tasaBcv.toFixed(2)} <span className="text-xs font-bold text-emerald-300">Bs/USD</span></div>
            <div className="text-[9px] uppercase tracking-widest font-black bg-emerald-500/20 text-emerald-300 px-2.5 py-0.5 rounded-full border border-emerald-500/20">
              Homologada
            </div>
          </div>
        </header>

        {/* Barra de Estatus de Sesión */}
        {user && user.role === 'cliente' ? (
          <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-[2rem] p-4 sm:p-6 mb-8 flex flex-col sm:flex-row items-center justify-between gap-4 text-white relative overflow-hidden backdrop-blur-md">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-2xl bg-emerald-500/20 flex items-center justify-center text-emerald-400 font-black text-lg">
                {user.username.charAt(0).toUpperCase()}
              </div>
              <div className="text-center sm:text-left">
                <p className="text-[9px] text-emerald-400 font-black uppercase tracking-wider leading-none">SESIÓN ACTIVA</p>
                <h4 className="text-base font-black text-white mt-1">¡Bienvenido de nuevo, {user.username}!</h4>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button 
                onClick={() => navigate('/client-portal')}
                className="bg-[#2ecc71] hover:bg-[#27ae60] text-white font-bold text-xs uppercase tracking-widest px-6 py-3 rounded-xl transition-all active:scale-95 shadow-lg"
              >
                Ir a mi Portal de Compras
              </button>
              <button 
                onClick={() => setUser(null)}
                className="bg-white/5 hover:bg-red-500/20 hover:text-red-400 border border-white/10 text-gray-300 font-bold text-xs uppercase tracking-widest px-4 py-3 rounded-xl transition-all"
              >
                Cerrar Sesión
              </button>
            </div>
          </div>
        ) : user ? (
          <div className="bg-blue-500/10 border border-blue-500/20 rounded-[2rem] p-4 sm:p-6 mb-8 flex flex-col sm:flex-row items-center justify-between gap-4 text-white relative overflow-hidden backdrop-blur-md">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-2xl bg-blue-500/20 flex items-center justify-center text-blue-400 font-black text-lg">
                A
              </div>
              <div className="text-center sm:text-left">
                <p className="text-[9px] text-blue-400 font-black uppercase tracking-wider leading-none">ACCESO ADMINISTRATIVO</p>
                <h4 className="text-base font-black text-white mt-1">{user.username} ({user.role.toUpperCase()})</h4>
              </div>
            </div>
            <button 
              onClick={() => navigate('/')}
              className="bg-[#3498db] hover:bg-[#2980b9] text-white font-bold text-xs uppercase tracking-widest px-6 py-3 rounded-xl transition-all active:scale-95"
            >
              Volver al Panel Admin
            </button>
          </div>
        ) : (
          <div className="bg-white/5 border border-white/10 rounded-[2rem] p-4 sm:p-6 mb-8 flex flex-col sm:flex-row items-center justify-between gap-4 text-white backdrop-blur-md">
            <div className="text-center sm:text-left space-y-1">
              <p className="text-sm font-bold text-gray-300">¿Ya estás registrado en nuestro sistema?</p>
              <p className="text-[10px] text-gray-500 uppercase font-black tracking-wide">Inicia sesión rápido con tu PIN para comprar fiado y ver tus saldos.</p>
            </div>
            <button 
              onClick={() => { setAuthView('login'); setAuthError(null); setShowAuthModal(true); }}
              className="bg-[#3498db] hover:bg-[#2980b9] text-white font-bold text-xs uppercase tracking-widest px-6 py-3 rounded-xl transition-all active:scale-95 flex items-center gap-2"
            >
              <LogIn size={14} /> INICIAR SESIÓN CON PIN
            </button>
          </div>
        )}

        {/* Search & Filters */}
        <section className="bg-white/5 border border-white/10 backdrop-blur-md p-6 rounded-[2rem] mb-8 space-y-4 shadow-xl">
          <div className="relative">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500" size={20} />
            <input 
              type="text"
              placeholder="Buscar productos por nombre o código..."
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              className="w-full bg-black/40 border border-white/10 rounded-2xl py-4 pl-12 pr-4 text-white placeholder-gray-500 outline-none focus:border-[#3498db] transition-colors font-semibold"
            />
          </div>

          <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-none">
            {categories.map((cat) => (
              <button
                key={cat}
                onClick={() => setSelectedCategory(cat)}
                className={cn(
                  "px-5 py-2.5 rounded-full text-xs font-black uppercase tracking-widest whitespace-nowrap transition-all active:scale-95",
                  selectedCategory === cat 
                    ? "bg-[#3498db] text-white shadow-lg shadow-[#3498db]/20" 
                    : "bg-white/5 text-gray-400 hover:text-white hover:bg-white/10 border border-white/5"
                )}
              >
                {cat === 'TODOS' ? '🏠 TODOS' : cat}
              </button>
            ))}
          </div>
        </section>

        {/* Product Grid */}
        {loading ? (
          <div className="flex flex-col items-center justify-center py-20 gap-6">
            <img src="/logo.png" className="w-20 h-20 object-contain rounded-2xl animate-pulse bg-white p-1 shadow-lg shadow-black/50" alt="Kalu Logo" />
            <div className="flex flex-col items-center gap-2">
              <div className="w-10 h-10 border-4 border-[#3498db] border-t-transparent rounded-full animate-spin" />
              <p className="text-gray-400 font-black uppercase tracking-widest text-[10px]">Cargando productos...</p>
            </div>
          </div>
        ) : filteredProducts.length === 0 ? (
          <div className="text-center py-20 bg-white/5 border border-white/10 rounded-[2rem] border-dashed">
            <ShoppingBag className="mx-auto text-gray-600 mb-4" size={48} />
            <h3 className="text-lg font-bold text-gray-300">No se encontraron productos</h3>
            <p className="text-gray-500 text-sm mt-1">Prueba con otra categoría o término de búsqueda.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
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
                  <div className="space-y-4">
                    <div className="h-48 rounded-[2rem] overflow-hidden bg-black/30 relative">
                      {product.imagen_url ? (
                        <img 
                          src={product.imagen_url} 
                          alt={product.nombre}
                          className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500"
                          loading="lazy"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-gray-600">
                          <ShoppingBag size={48} />
                        </div>
                      )}
                      
                      <span className="absolute top-4 left-4 bg-black/60 backdrop-blur-md text-white border border-white/10 text-[8px] font-black uppercase tracking-widest px-3 py-1 rounded-full">
                        {product.categoria}
                      </span>

                      {hasOffer && (
                        <span className="absolute top-4 right-4 bg-yellow-500 text-black text-[9px] font-black uppercase tracking-widest px-3 py-1 rounded-full shadow-lg">
                          Oferta
                        </span>
                      )}

                      {product.stock <= 0 ? (
                        <div className="absolute inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center">
                          <span className="bg-red-500 text-white font-black text-xs uppercase tracking-widest px-4 py-2 rounded-xl">
                            Agotado
                          </span>
                        </div>
                      ) : product.stock <= 5 ? (
                        <span className="absolute bottom-4 left-4 bg-red-500/90 text-white text-[8px] font-black uppercase tracking-widest px-2.5 py-1 rounded-full">
                          Pocas unidades ({product.stock})
                        </span>
                      ) : null}
                    </div>

                    <div className="px-2 space-y-2">
                      <h3 className="text-lg font-black text-white leading-tight uppercase truncate">{product.nombre}</h3>
                      <p className="text-xs text-gray-400 font-bold line-clamp-2 min-h-[2rem]">
                        {product.descripcion || 'Sin descripción disponible.'}
                      </p>
                    </div>
                  </div>

                  <div className="mt-6 pt-4 border-t border-white/5 px-2 flex items-center justify-between">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-xl font-black text-emerald-400">
                          {formatCurrency(price)}
                        </span>
                        {hasOffer && (
                          <span className="text-xs text-gray-500 line-through font-bold">
                            {formatCurrency(product.precio_normal_usd)}
                          </span>
                        )}
                      </div>
                      <div className="text-[10px] text-gray-500 font-bold">
                        {formatCurrency(price , 'Bs', tasaBcv).replace('VES', 'Bs.')}
                      </div>
                    </div>

                    {product.stock > 0 && (
                      <div className="flex items-center">
                        {qty > 0 ? (
                          <div className="bg-white/5 border border-white/10 rounded-2xl p-1.5 flex items-center gap-3 backdrop-blur-md">
                            <button 
                              onClick={() => removeFromCart(product.id)}
                              className="w-8 h-8 rounded-xl bg-white/10 text-white flex items-center justify-center hover:bg-white/20 active:scale-90 transition-transform"
                            >
                              <Minus size={14} />
                            </button>
                            <span className="text-sm font-black text-white w-4 text-center">{qty}</span>
                            <button 
                              onClick={() => addToCart(product)}
                              disabled={qty >= product.stock}
                              className="w-8 h-8 rounded-xl bg-white/10 text-white flex items-center justify-center hover:bg-white/20 active:scale-90 transition-transform disabled:opacity-30"
                            >
                              <Plus size={14} />
                            </button>
                          </div>
                        ) : (
                          <button
                            onClick={() => addToCart(product)}
                            className="bg-[#3498db] text-white p-3 rounded-2xl shadow-lg shadow-[#3498db]/20 hover:bg-[#2980b9] active:scale-95 transition-all flex items-center justify-center"
                          >
                            <Plus size={18} />
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
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

      {/* Shopping Cart Drawer Modal */}
      {showCartDrawer && (
        <div className="fixed inset-0 z-45 flex justify-end">
          <div 
            onClick={() => setShowCartDrawer(false)}
            className="absolute inset-0 bg-black/60 backdrop-blur-sm transition-opacity" 
          />

          <div className="relative w-full max-w-md bg-[#0f172a] h-screen max-h-screen shadow-2xl flex flex-col border-l border-white/10 z-10 animate-in slide-in-from-right duration-300">
            <div className="p-6 border-b border-white/10 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-emerald-500/10 text-emerald-400 flex items-center justify-center">
                  <ShoppingCart size={20} />
                </div>
                <div>
                  <h2 className="text-lg font-black uppercase tracking-tight text-white">Tu Carrito</h2>
                  <p className="text-[10px] text-gray-500 font-bold uppercase">{cartTotalItems} Productos seleccionados</p>
                </div>
              </div>
              <button 
                onClick={() => setShowCartDrawer(false)}
                className="text-gray-500 hover:text-white text-sm font-bold bg-white/5 px-3 py-1.5 rounded-xl border border-white/5"
              >
                CERRAR
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-6 space-y-4 custom-scrollbar">
              {cart.map(item => {
                const itemPrice = item.product.precio_oferta_usd || item.product.precio_normal_usd;
                return (
                  <div key={item.product.id} className="relative flex items-center justify-between bg-white/5 border border-white/10 p-4 rounded-3xl gap-4 mt-2">
                    <button 
                      onClick={() => removeItemCompletely(item.product.id)}
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
            </div>

            <div className="p-6 border-t border-white/10 bg-black/40 space-y-4">

              {/* Selector de Tipo de Entrega */}
              <div className="space-y-2">
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

                {tipoEntrega === 'delivery' && (
                  <div className={`p-3 rounded-xl border text-[9px] font-bold leading-relaxed ${
                    cartTotalUsd >= DELIVERY_MINIMO_USD
                      ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400'
                      : 'bg-yellow-500/10 border-yellow-500/20 text-yellow-400'
                  }`}>
                    {cartTotalUsd >= DELIVERY_MINIMO_USD ? (
                      <>
                        <span className="font-black">🎉 ¡DELIVERY GRATIS!</span> Tu pedido califica porque supera los {formatCurrency(DELIVERY_MINIMO_USD)}. Llegará en aprox. <span className="font-black">7 horas</span> desde que confirmes.
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
                  <div className="bg-black/30 border border-white/5 rounded-2xl p-4 space-y-3 mt-2 animate-in fade-in slide-in-from-top-2 duration-300 text-[10px]">
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
                      />
                    </div>

                    <div className="space-y-1.5">
                      <label className="text-gray-500 font-black uppercase block" style={{fontSize: '8px'}}>Sube Capture del Pago</label>
                      <div className="relative">
                        <input 
                          type="file"
                          accept="image/*"
                          className="hidden"
                          id="capture-upload-public"
                          onChange={handleCaptureChange}
                          disabled={cargandoCapture}
                        />
                        <label 
                          htmlFor="capture-upload-public"
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
                  <span className="text-sm font-black uppercase text-white">Total a Pagar</span>
                  <div className="text-right">
                    <div className="text-2xl font-black text-emerald-400">{formatCurrency(cartTotalUsd)}</div>
                    <div className="text-xs text-gray-500 font-bold">Equivalente: {formatCurrency(cartTotalUsd , 'Bs', tasaBcv).replace('VES', 'Bs.')}</div>
                  </div>
                </div>
              </div>

              {user && user.role === 'cliente' ? (
                <button 
                  onClick={handleConfirmOrder}
                  disabled={placingOrder || cartTotalItems === 0}
                  className="w-full bg-[#2ecc71] hover:bg-[#27ae60] text-white py-4 rounded-2xl font-black text-sm uppercase tracking-widest flex items-center justify-center gap-3 hover:opacity-95 active:scale-[0.98] transition-all shadow-lg disabled:opacity-50"
                >
                  {placingOrder 
                    ? 'PROCESANDO...' 
                    : metodoPago === 'inmediato' 
                      ? '📱 ENVIAR PAGO Y PEDIDO' 
                      : tipoEntrega === 'delivery' 
                        ? '🛵 CONFIRMAR CON DELIVERY' 
                        : '🏪 CONFIRMAR PEDIDO'} <ArrowRight size={18} />
                </button>
              ) : (
                <button 
                  onClick={handleCheckoutClick}
                  className="w-full bg-gradient-to-r from-[#3498db] to-[#2ecc71] text-white py-4 rounded-2xl font-black flex items-center justify-center gap-3 hover:opacity-95 active:scale-[0.98] transition-all shadow-lg"
                >
                  REGÍSTRATE GRATIS PARA COMPRAR <ArrowRight size={18} />
                </button>
              )}

              <div className="flex items-center justify-center gap-1.5 text-[9px] text-gray-600 font-black uppercase tracking-wider text-center">
                <ShieldCheck size={12} className="text-green-600" /> {user && user.role === 'cliente' ? (metodoPago === 'inmediato' ? 'Pago pendiente por validar en caja' : 'Tu pedido se añadirá a tu cuenta de fiado') : 'Registro rápido de 10 segundos'}
              </div>
            </div>
          </div>
        </div>
      )}

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
                  <img src="/logo.png" className="w-12 h-12 rounded-xl object-cover" alt="Logo Kalu" />
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
                <div className="w-24 h-24 bg-gradient-to-br from-[#3498db] to-[#2ecc71] rounded-3xl mx-auto flex items-center justify-center shadow-2xl">
                   <Rocket size={48} className="text-white" />
                </div>
                <div>
                  <h2 className="text-2xl font-black text-white uppercase tracking-tight">¡Registro Exitoso!</h2>
                  <p className="text-[#3498db] font-bold mt-1">¿Quieres descargar la Mini App?</p>
                </div>
                <div className="bg-white/5 p-4 rounded-2xl border border-white/10 text-left space-y-3">
                  <p className="text-sm text-gray-300 font-medium">Lleva Kalu siempre contigo. Para instalar rápido y fácil:</p>
                  <ul className="text-xs text-gray-400 space-y-2 font-bold">
                    <li className="flex items-center gap-2"><div className="w-1.5 h-1.5 rounded-full bg-[#2ecc71]"></div> 1. Toca Menú (⋮) o Compartir en tu navegador</li>
                    <li className="flex items-center gap-2"><div className="w-1.5 h-1.5 rounded-full bg-[#2ecc71]"></div> 2. Selecciona "Agregar a inicio" o "Instalar app"</li>
                  </ul>
                </div>
                <div className="flex flex-col gap-3 pt-4">
                  <button 
                    onClick={() => {
                      if (pendingUser) setUser(pendingUser);
                      setShowAuthModal(false);
                      setShowDownloadPrompt(false);
                    }}
                    className="w-full bg-[#3498db] text-white py-4 rounded-xl font-black hover:bg-[#2980b9] transition-all shadow-[0_10px_20px_rgba(52,152,219,0.2)]"
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
                    className="w-full bg-black/40 border border-white/10 rounded-xl py-2.5 px-4 text-sm font-semibold text-white outline-none focus:border-[#3498db] transition-all"
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
                    className="w-full bg-black/40 border border-white/10 rounded-xl py-2.5 px-4 text-sm font-semibold text-white outline-none focus:border-[#3498db] transition-all"
                    placeholder="Ej. V-12345678"
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="text-[9px] font-black uppercase text-gray-500 tracking-widest px-2">Teléfono</label>
                    <input 
                    type="text"
                    value={regTelefono}
                    onChange={(e) => setRegTelefono(e.target.value)}
                    className="w-full bg-black/40 border border-white/10 rounded-xl py-2.5 px-4 text-xs font-semibold text-white outline-none focus:border-[#3498db] transition-all"
                    placeholder="0424-5556677"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[9px] font-black uppercase text-gray-500 tracking-widest px-2">Dirección</label>
                  <input 
                    type="text"
                    value={regDireccion}
                    onChange={(e) => setRegDireccion(e.target.value)}
                    className="w-full bg-black/40 border border-white/10 rounded-xl py-2.5 px-4 text-xs font-semibold text-white outline-none focus:border-[#3498db] transition-all"
                    placeholder="Calle 3, Casa #10"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-[9px] font-black uppercase text-gray-500 tracking-widest px-2">PIN Clave (4 números) *</label>
                  <input 
                    type="password"
                    required
                    maxLength={4}
                    value={regPin}
                    onChange={(e) => setRegPin(e.target.value.replace(/\D/g, ''))}
                    className="w-full bg-black/40 border border-white/10 rounded-xl py-2.5 px-4 text-center text-lg font-black tracking-widest text-[#3498db] outline-none focus:border-[#3498db] transition-all"
                    placeholder="****"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[9px] font-black uppercase text-gray-500 tracking-widest px-2">Confirmar PIN *</label>
                  <input 
                    type="password"
                    required
                    maxLength={4}
                    value={regConfirmPin}
                    onChange={(e) => setRegConfirmPin(e.target.value.replace(/\D/g, ''))}
                    className="w-full bg-black/40 border border-white/10 rounded-xl py-2.5 px-4 text-center text-lg font-black tracking-widest text-[#3498db] outline-none focus:border-[#3498db] transition-all"
                    placeholder="****"
                  />
                </div>
              </div>

              <button 
                type="submit"
                disabled={authLoading}
                className="w-full bg-gradient-to-r from-[#3498db] to-[#2ecc71] text-white py-3.5 rounded-xl font-black text-xs uppercase tracking-widest transition-all hover:opacity-90 active:scale-98"
              >
                {authLoading ? 'REGISTRANDO...' : 'REGISTRARME Y COMPRAR'}
              </button>

              <div className="text-center pt-2">
                <button 
                  type="button"
                  onClick={() => { setAuthView('login'); setAuthError(null); }}
                  className="text-xs text-[#3498db] font-bold hover:underline"
                >
                  ¿Ya tienes una cuenta? Inicia sesión aquí
                </button>
              </div>
            </form>
            ) : authView === 'login' ? (
            <form onSubmit={handleLoginSubmit} className="space-y-6">
              <div className="space-y-2">
                <label className="text-[10px] font-black uppercase text-gray-500 tracking-widest px-2 block text-center">Introduce tu PIN de 4 dígitos</label>
                <input 
                  type="password"
                  maxLength={4}
                  value={loginPin}
                  autoFocus
                  onChange={(e) => setLoginPin(e.target.value.replace(/\D/g, ''))}
                  className="w-full bg-black/40 border border-white/10 rounded-2xl py-4 px-4 text-center text-3xl font-black tracking-[0.8em] text-[#2ecc71] outline-none focus:border-[#2ecc71] transition-all"
                  placeholder="****"
                />
              </div>

              <button 
                type="submit"
                disabled={loginPin.length < 4 || authLoading}
                className="w-full bg-[#2ecc71] text-white py-3.5 rounded-xl font-black text-xs uppercase tracking-widest hover:bg-[#27ae60] transition-all disabled:opacity-50"
              >
                {authLoading ? 'ENTRANDO...' : 'INICIAR SESIÓN Y COMPRAR'}
              </button>

              <div className="text-center pt-2">
                <button 
                  type="button"
                  onClick={() => { setAuthView('register'); setAuthError(null); }}
                  className="text-xs text-[#3498db] font-bold hover:underline"
                >
                  ¿Eres nuevo? Regístrate gratis aquí
                </button>
              </div>
            </form>
            ) : null}
        </div>
      </div>
    )}
  </div>
);
};

export default PublicCatalogScreen;
