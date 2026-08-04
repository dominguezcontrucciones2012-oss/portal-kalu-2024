import React, { useState, useEffect } from 'react';
import { Truck, MapPin, Phone, CheckCircle, Camera, UploadCloud, X, ArrowLeft, Image as ImageIcon, MessageCircle, AlertTriangle, LogOut, ShoppingCart } from 'lucide-react';
import { useAuth } from '../../contexts/AuthProvider';
import { subscribeToCollection, updateDocument, getDocument, addDocument } from '../../lib/dbUtils';
import { auth } from '../../lib/firebase';
import { useToast } from '../../contexts/ToastProvider';
import { formatCurrency, compressImage } from '../../lib/utils';
import { useNavigate } from 'react-router-dom';
import BiometricSetupButton from '../common/BiometricSetupButton';

export default function DriverPortalScreen() {
  const { user, setUser } = useAuth();
  const [orders, setOrders] = useState<any[]>([]);
  const [isDataLoaded, setIsDataLoaded] = useState(false);
  const [activeTab, setActiveTab] = useState<'pendientes' | 'entregados'>('pendientes');
  const [selectedOrder, setSelectedOrder] = useState<any | null>(null);
  const { addToast } = useToast();
  const navigate = useNavigate();
  
  // Cierre de Jornada state
  const [showClosureModal, setShowClosureModal] = useState(false);
  const [closureMethod, setClosureMethod] = useState<'contador' | 'pago_movil'>('contador');
  const [closureCapture, setClosureCapture] = useState<string | null>(null);
  const [submittingClosure, setSubmittingClosure] = useState(false);
  
  // Status Repartidor
  const [isOnline, setIsOnline] = useState(user?.isOnline || false);
  const [togglingStatus, setTogglingStatus] = useState(false);

  // Deuda actual
  const pendingCashOrders = orders.filter(o => o.status_pedido === 'efectivo_en_ruta');
  const totalDeudaUsd = pendingCashOrders.reduce((sum, o) => sum + (o.total_usd || 0), 0);

  // Refs para notificaciones
  const previousOrdersRef = React.useRef<string[]>([]);

  const vibratePhone = () => {
    if (navigator.vibrate) {
      // Patrón de vibración: vibra, pausa, vibra, pausa, vibra largo
      navigator.vibrate([200, 100, 200, 100, 500]);
    }
  };

  const showSystemNotification = (title: string, body: string) => {
    if ('Notification' in window && Notification.permission === 'granted') {
      try {
        if (navigator.serviceWorker) {
          navigator.serviceWorker.ready.then((registration) => {
            registration.showNotification(title, {
              body,
              icon: '/logo.png',
              badge: '/logo.png',
              vibrate: [200, 100, 200, 100, 500],
              requireInteraction: true
            } as any);
          }).catch(() => {
            // Fallback si el SW falla
            new Notification(title, { body, icon: '/logo.png', vibrate: [200, 100, 200, 100, 500] } as any);
          });
        } else {
          new Notification(title, { body, icon: '/logo.png', vibrate: [200, 100, 200, 100, 500] } as any);
        }
      } catch (e) {
        console.error('Error al mostrar notificación del sistema:', e);
      }
    }
  };

  useEffect(() => {
    // Solicitar permiso de notificaciones al abrir si no se ha preguntado
    if ('Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission();
    }
  }, []);

  useEffect(() => {
    if (!user || user.role !== 'repartidor') return;

    // Suscripción al propio usuario para mantener el botón sincronizado en tiempo real
    const unsubUser = subscribeToCollection('users', (usersData) => {
      const me = usersData.find((u: any) => u.id === user.id);
      if (me && me.isOnline !== undefined) {
        setIsOnline(me.isOnline);
      }
    });

    let isMounted = true;

    // Timeout de seguridad: Si Firestore no responde en 5 segundos, liberamos la UI
    const loadingTimeout = setTimeout(() => {
      if (isMounted) setIsDataLoaded(true);
    }, 5000);

    const unsub = subscribeToCollection('sales', async (data) => {
      try {
        const myOrders = data.filter((s: any) => s.repartidor_id === user.id);
        
        // Notificar si hay un pedido nuevo
        const currentOrderIds = myOrders.map((o: any) => o.id);
        if (previousOrdersRef.current.length > 0) {
          const hasNewOrder = currentOrderIds.some(id => !previousOrdersRef.current.includes(id));
          if (hasNewOrder) {
            vibratePhone();
            showSystemNotification('Nuevo Reparto - Kalu', '¡Tienes un nuevo pedido asignado para despachar!');
            addToast('success', '¡Nuevo pedido asignado!');
          }
        }
        previousOrdersRef.current = currentOrderIds;
        
        // Enriquecer con datos del cliente
        const enrichedOrders = await Promise.all(myOrders.map(async (order: any) => {
          if (order.cliente_id) {
            try {
              const clientData = await getDocument('clients', order.cliente_id);
              if (clientData) {
                return {
                  ...order,
                  direccion_cliente: clientData.direccion || 'Dirección no registrada',
                  telefono_cliente: clientData.telefono || 'Teléfono no registrado'
                };
              }
            } catch (error) {
              console.error(`Error fetching client ${order.cliente_id}:`, error);
            }
          }
          return order;
        }));

        // Ordenar por fecha descendente
        enrichedOrders.sort((a, b) => new Date(b.fecha || 0).getTime() - new Date(a.fecha || 0).getTime());
        
        if (isMounted) {
          setOrders(enrichedOrders);
          setIsDataLoaded(true);
          clearTimeout(loadingTimeout);
        }
      } catch (err) {
        console.error("Error procesando pedidos del repartidor:", err);
        if (isMounted) {
          setIsDataLoaded(true);
          clearTimeout(loadingTimeout);
        }
      }
    });

    return () => {
      isMounted = false;
      clearTimeout(loadingTimeout);
      unsub();
      unsubUser();
    };
  }, [user, addToast]);

  // Recordatorio para cerrar turno después de las 6 PM
  useEffect(() => {
    if (!isOnline) return;
    
    const checkTime = () => {
      const hour = new Date().getHours();
      if (hour >= 18) {
        showSystemNotification('Recordatorio - Kalu', 'Ya son más de las 6:00 PM. No olvides APAGAR tu botón si ya terminaste tu jornada laboral.');
      }
    };

    // Revisar cada 30 minutos
    const interval = setInterval(checkTime, 30 * 60 * 1000);
    checkTime();
    
    return () => clearInterval(interval);
  }, [isOnline]);

  const handleClosureSubmit = async () => {
    if (totalDeudaUsd === 0) {
      setShowClosureModal(false);
      return;
    }
    if (closureMethod === 'pago_movil' && !closureCapture) {
      addToast('error', 'Debes subir un capture del pago móvil');
      return;
    }
    setSubmittingClosure(true);
    try {
      const pedidoIds = pendingCashOrders.map(o => o.id);
      const cierreData = {
        repartidor_id: user.id,
        repartidor_nombre: user.username,
        fecha: new Date().toISOString(),
        pedidos: pedidoIds,
        total_usd: totalDeudaUsd,
        metodo: closureMethod,
        captures_pago: closureCapture ? [closureCapture] : [],
        status: 'pendiente'
      };
      
      await addDocument('cierres_caja', cierreData);
      
      addToast('success', 'Cierre de jornada enviado a verificación.');
      setShowClosureModal(false);
      setClosureCapture(null);
    } catch(e) {
      addToast('error', 'Error al enviar el cierre');
    } finally {
      setSubmittingClosure(false);
    }
  };

  const handleDeliver = async (orderId: string, captures: string[], metodoPago: string) => {
    try {
      let status_pedido = 'verificando_pago';
      
      if (metodoPago === 'ya_pagado') {
        status_pedido = 'entregado';
      } else if (metodoPago === 'efectivo_usd' || metodoPago === 'efectivo_bs') {
        status_pedido = 'efectivo_en_ruta';
      }

      await updateDocument('sales', orderId, {
        status_pedido,
        captures_pago: captures,
        metodo_cobro_driver: metodoPago
      });
      
      if (status_pedido === 'efectivo_en_ruta') {
        addToast('success', 'Entregado en Efectivo. Recuerda entregar el billete.');
      } else if (status_pedido === 'entregado') {
        addToast('success', 'Pedido marcado como entregado exitosamente.');
      } else {
        // Enviar notificación a N8N para el administrador
        try {
          const { getAppConfig } = await import('../../lib/dbUtils');
          const config = await getAppConfig();
          if (config && config.n8n_webhook_url && captures.length > 0) {
            fetch(config.n8n_webhook_url, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                event: 'payment_capture',
                order_id: orderId,
                driver_name: user.username,
                capture_url: captures[0]
              })
            }).catch(err => console.error("Error notifying n8n:", err));
          }
        } catch (e) {
          console.error("Error fetching config for n8n:", e);
        }
        addToast('success', 'Pago enviado. Esperando verificación de tienda.');
      }
    setSelectedOrder(null);
  } catch (e: any) {
    console.error(e);
    addToast('error', 'Error: ' + (e.message || 'No se pudo subir'));
  }
};

const handleToggleStatus = async () => {
  setTogglingStatus(true);
  try {
    const newStatus = !isOnline;
    const targetId = user.id;
    await updateDocument('users', targetId, { isOnline: newStatus });
    setIsOnline(newStatus);
    
    // Actualizar también el contexto de usuario para que si refrescan la página
    // no se borre el estado de activo en el localStorage.
    if (user) {
      setUser({ ...user, isOnline: newStatus });
    }
    
    // Solicitar permiso de notificaciones al iniciar turno (interacción del usuario)
    if (newStatus && 'Notification' in window && Notification.permission !== 'granted') {
      Notification.requestPermission();
    }
    
    addToast('success', newStatus ? 'Turno Inciado: Ahora estás Online' : 'Turno Finalizado: Estás Offline');
  } catch (e: any) {
    console.error("Error toggling status:", e);
    addToast('error', 'Error al cambiar de estado: ' + (e.message || 'Desconocido'));
  } finally {
    setTogglingStatus(false);
  }
};

if (!user || user.role !== 'repartidor') {
    return (
      <div className="min-h-screen bg-black flex flex-col items-center justify-center p-4">
        <Truck size={64} className="text-red-500 mb-4" />
        <h1 className="text-2xl font-black text-white uppercase tracking-widest text-center">Acceso Denegado</h1>
        <p className="text-gray-400 text-center mt-2">No tienes permisos de repartidor.</p>
        <button onClick={() => navigate('/')} className="mt-8 bg-white/10 hover:bg-white/20 px-6 py-3 rounded-2xl text-white font-bold transition-colors">Volver</button>
      </div>
    );
  }

  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

  const pendingOrders = orders.filter(o => o.status_pedido === 'pendiente' || o.status_pedido === 'listo' || o.status_pedido === 'en_camino' || o.status_pedido === 'verificando_pago' || o.status_pedido === 'efectivo_en_ruta');
  const deliveredOrders = orders.filter(o => o.status_pedido === 'entregado' && new Date(o.fecha).getTime() > sevenDaysAgo.getTime());
  
  const groupedDelivered = deliveredOrders.reduce((acc, order) => {
    const date = new Date(order.fecha);
    const dateStr = date.toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'short' });
    const capitalizedDateStr = dateStr.charAt(0).toUpperCase() + dateStr.slice(1);
    if (!acc[capitalizedDateStr]) acc[capitalizedDateStr] = [];
    acc[capitalizedDateStr].push(order);
    return acc;
  }, {} as Record<string, any[]>);

  const renderOrderCard = (order: any) => {
    const isEfectivoEnRuta = order.status_pedido === 'efectivo_en_ruta';
    
    return (
    <div key={order.id} className={`p-5 rounded-3xl border transition-all duration-300 ${activeTab === 'pendientes' 
      ? isEfectivoEnRuta ? 'bg-orange-500/10 border-orange-500/30 shadow-2xl' : 'bg-gradient-to-br from-white/10 to-white/5 border-white/10 shadow-2xl' 
      : 'bg-white/5 border-transparent opacity-60'}`}>
      <div className="flex justify-between items-start mb-4">
        <div>
          <h3 className="text-lg font-black uppercase tracking-tight leading-tight">{order.nombre_cliente}</h3>
          <p className="text-xs text-gray-400 font-bold tracking-widest mt-1 uppercase">ID: {order.codigo_pedido || order.id.substring(0, 8)}</p>
        </div>
        <div className="text-right">
          <div className="bg-black/40 px-3 py-1.5 rounded-xl border border-white/5 mb-1">
            <p className="text-green-400 font-black text-sm">${formatCurrency(order.total_usd)}</p>
          </div>
          {activeTab === 'entregados' && (
            <p className={`text-[9px] font-black uppercase px-2 py-0.5 rounded-full ${order.status_pedido === 'entregado' ? 'bg-green-500/20 text-green-400' : 'bg-white/10 text-white'}`}>
              {order.status_pedido}
            </p>
          )}
          {activeTab === 'pendientes' && order.status_pedido === 'pendiente' && (
            <p className="text-[9px] font-black uppercase px-2 py-0.5 rounded-full bg-orange-500/20 text-orange-400 mt-1 inline-block">
              Empacando
            </p>
          )}
          {activeTab === 'pendientes' && order.status_pedido === 'en_camino' && (
            <p className="text-[9px] font-black uppercase px-2 py-0.5 rounded-full bg-purple-500/20 text-purple-400 mt-1 inline-block">
              En Camino
            </p>
          )}
        </div>
      </div>

      <div className="space-y-3 mb-5 bg-black/30 p-4 rounded-2xl border border-white/5">
        <div className="flex items-start gap-3">
          <MapPin size={16} className="text-red-400 mt-0.5 shrink-0" />
          <p className="text-sm text-gray-300 font-medium leading-snug">{order.direccion_cliente || 'Sin dirección registrada'}</p>
        </div>
        <div className="flex items-center gap-3">
          <Phone size={16} className="text-blue-400 shrink-0" />
          <p className="text-sm text-gray-300 font-medium">{order.telefono_cliente || 'Sin teléfono'}</p>
        </div>
      </div>

      {activeTab === 'pendientes' && order.status_pedido === 'listo' && order.pin_repartidor && (
        <div className="mb-4 bg-purple-500/10 border border-purple-500/30 p-4 rounded-2xl text-center">
          <p className="text-xs text-purple-400 font-bold uppercase tracking-widest mb-1">PIN de Retiro en Tienda</p>
          <p className="text-3xl font-black text-white tracking-[10px]">{order.pin_repartidor}</p>
        </div>
      )}

      {activeTab === 'pendientes' && (
        <div className="flex flex-col gap-3 mt-4">
          <button 
            onClick={() => {
              let cleanPhone = order.telefono_cliente ? order.telefono_cliente.replace(/\D/g, '') : '';
              if (cleanPhone.startsWith('0')) {
                cleanPhone = '58' + cleanPhone.substring(1);
              } else if (!cleanPhone.startsWith('58') && cleanPhone.length === 10) {
                cleanPhone = '58' + cleanPhone;
              }
              window.open(`https://wa.me/${cleanPhone}`, '_blank');
            }}
            className="bg-[#25D366]/20 border border-[#25D366]/30 hover:bg-[#25D366]/30 text-[#25D366] w-full py-3 rounded-xl font-black text-xs uppercase tracking-widest flex items-center justify-center gap-2 transition-colors"
          >
            <MessageCircle size={16} /> Contactar
          </button>
          
          {order.status_pedido === 'pendiente' ? (
            <div className="bg-orange-500/10 border border-orange-500/20 text-orange-400 py-3 rounded-xl font-black text-xs uppercase tracking-widest flex items-center justify-center gap-2 animate-pulse">
              <AlertTriangle size={14} /> Preparando en Tienda...
            </div>
          ) : order.status_pedido === 'verificando_pago' ? (
            <div className="bg-yellow-500/10 border border-yellow-500/20 text-yellow-400 py-3 rounded-xl font-black text-xs uppercase tracking-widest flex items-center justify-center gap-2 animate-pulse">
              <AlertTriangle size={14} /> Verificando en tienda...
            </div>
          ) : isEfectivoEnRuta ? (
            <div className="bg-orange-500/20 border border-orange-500/30 text-orange-400 py-3 rounded-xl font-black text-xs uppercase tracking-widest flex items-center justify-center gap-2">
              <AlertTriangle size={14} /> Efectivo en Ruta
            </div>
          ) : (
            <button 
              onClick={() => setSelectedOrder(order)}
              className="bg-purple-600 hover:bg-purple-500 text-white w-full py-3 rounded-xl font-black text-xs uppercase tracking-widest flex items-center justify-center gap-2 shadow-lg shadow-purple-900/50 transition-colors"
            >
              <CheckCircle size={14} /> Entregar
            </button>
          )}
        </div>
      )}
      
      {activeTab === 'entregados' && order.captures_pago && order.captures_pago.length > 0 && (
         <div className="mt-4 pt-4 border-t border-white/5 flex gap-2 overflow-x-auto">
           {order.captures_pago.map((cap: string, i: number) => (
             <img key={i} src={cap} alt="Pago" className="w-12 h-12 rounded-lg object-cover border border-white/10 shrink-0" />
           ))}
         </div>
      )}
    </div>
  );
  };

  return (
    <div className="min-h-screen bg-[#050505] text-white flex flex-col font-sans relative">
      {/* Header Premium */}
      <div className="bg-gradient-to-b from-purple-900/40 to-transparent pt-12 pb-6 px-6 sticky top-0 z-10 backdrop-blur-xl border-b border-white/5">
        <div className="flex justify-between items-center max-w-lg mx-auto w-full">
          <div>
            <p className="text-purple-400 text-xs font-black uppercase tracking-[3px] mb-1">Portal Repartidor</p>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-black tracking-tight">{user.username}</h1>
              <div className={`w-3 h-3 rounded-full ${isOnline ? 'bg-green-500 shadow-[0_0_10px_rgba(34,197,94,0.6)] animate-pulse' : 'bg-red-500/50'}`}></div>
            </div>
          </div>
          <div className="flex gap-2">
            <button 
              onClick={handleToggleStatus} 
              disabled={togglingStatus}
              className={`px-4 h-12 rounded-xl flex items-center justify-center font-black text-[9px] uppercase tracking-widest transition-colors ${
                isOnline 
                  ? 'bg-red-500/20 text-red-400 border border-red-500/30 hover:bg-red-500/30' 
                  : 'bg-green-500/20 text-green-400 border border-green-500/30 hover:bg-green-500/30'
              }`}
            >
              {togglingStatus ? '...' : (isOnline ? 'Finalizar Turno' : 'Iniciar Turno')}
            </button>
            <button onClick={() => setShowClosureModal(true)} className="px-4 h-12 rounded-xl bg-orange-500/20 border border-orange-500/30 flex items-center justify-center text-orange-400 font-black text-[9px] uppercase tracking-widest hover:bg-orange-500/30 transition-colors">
              Cerrar Caja
            </button>
            <button onClick={async () => {
              try {
                const storeParam = new URLSearchParams(window.location.search).get('store');
                const savedStore = localStorage.getItem('activeStoreId');
                const storeToKeep = storeParam || savedStore || 'kalu-queso-sanjuan';

                setUser(null);
                localStorage.removeItem('kalu_current_user');
                localStorage.removeItem('kalu_pin_verified');
                
                // Redirigir a Multitienda
                window.history.replaceState(null, '', '/');
                await auth.signOut();
                window.location.reload();
              } catch(e) {}
            }} className="w-12 h-12 rounded-full bg-white/5 border border-white/10 flex items-center justify-center text-gray-400 hover:bg-white/10 transition-colors">
              <LogOut size={16} />
            </button>
          </div>
        </div>
        
        {/* BOTÓN BIOMÉTRICO (NUEVO) */}
        <div className="max-w-lg mx-auto w-full mt-4 px-2">
          <BiometricSetupButton email={user?.email || ''} userData={user} />
        </div>
        
        {/* BOTÓN MODO CLIENTE */}
        <div className="max-w-lg mx-auto w-full mt-4 px-2">
          <button 
            onClick={() => navigate('/client-portal')}
            className="w-full bg-gradient-to-r from-emerald-500 to-green-600 text-white py-4 rounded-2xl font-black text-sm uppercase tracking-widest flex items-center justify-center gap-3 shadow-[0_0_20px_rgba(16,185,129,0.4)] hover:scale-[1.02] active:scale-95 transition-all"
          >
            <ShoppingCart size={20} className="animate-bounce" />
            CAMBIAR A MODO CLIENTE
          </button>
        </div>

        {/* Tabs */}
        <div className="flex gap-2 max-w-lg mx-auto w-full mt-6 bg-black/40 p-1.5 rounded-2xl border border-white/5">
          <button 
            onClick={() => setActiveTab('pendientes')}
            className={`flex-1 py-2.5 rounded-xl text-xs font-black uppercase tracking-wider transition-all duration-300 ${activeTab === 'pendientes' ? 'bg-purple-600 text-white shadow-lg' : 'text-gray-500 hover:text-gray-300'}`}
          >
            Fila ({pendingOrders.length})
          </button>
          <button 
            onClick={() => setActiveTab('entregados')}
            className={`flex-1 py-2.5 rounded-xl text-xs font-black uppercase tracking-wider transition-all duration-300 ${activeTab === 'entregados' ? 'bg-white/10 text-white shadow-lg' : 'text-gray-500 hover:text-gray-300'}`}
          >
            Historial ({deliveredOrders.length})
          </button>
        </div>
      </div>

      {/* Lista de Pedidos */}
      <div className="flex-1 p-6 overflow-y-auto max-w-lg mx-auto w-full">
        {!isDataLoaded && (
          <div className="h-full flex flex-col items-center justify-center opacity-50 mt-20">
            <div className="w-10 h-10 border-4 border-purple-500/20 border-t-purple-500 rounded-full animate-spin mb-4" />
            <p className="text-sm font-bold uppercase tracking-widest text-purple-200">Cargando turnos...</p>
          </div>
        )}

        {isDataLoaded && activeTab === 'pendientes' && pendingOrders.length === 0 && (
          <div className="h-full flex flex-col items-center justify-center opacity-30 mt-20">
            <CheckCircle size={80} className="mb-6" />
            <p className="text-xl font-black uppercase tracking-widest text-center">Todo al día</p>
            <p className="text-sm mt-2 font-bold text-center">No hay pedidos pendientes.</p>
          </div>
        )}

        {isDataLoaded && activeTab === 'entregados' && deliveredOrders.length === 0 && (
          <div className="h-full flex flex-col items-center justify-center opacity-30 mt-20">
            <CheckCircle size={80} className="mb-6" />
            <p className="text-xl font-black uppercase tracking-widest text-center">Todo al día</p>
            <p className="text-sm mt-2 font-bold text-center">No hay entregas en los últimos 7 días.</p>
          </div>
        )}

        {isDataLoaded && activeTab === 'pendientes' && pendingOrders.length > 0 && (
          <div className="space-y-4 pb-20">
            {pendingOrders.map(renderOrderCard)}
          </div>
        )}

        {isDataLoaded && activeTab === 'entregados' && deliveredOrders.length > 0 && (
          <div className="space-y-8 pb-20">
            {Object.entries(groupedDelivered).map(([dateLabel, dateOrders]: [string, any]) => (
              <div key={dateLabel}>
                <h3 className="text-xs font-black uppercase tracking-[3px] text-gray-500 mb-4 px-2">{dateLabel}</h3>
                <div className="space-y-4">
                  {dateOrders.map(renderOrderCard)}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Modal de Pago / Entrega */}
      {selectedOrder && (
        <PaymentModal 
          order={selectedOrder} 
          onClose={() => setSelectedOrder(null)} 
          onConfirm={handleDeliver} 
        />
      )}

      {/* Modal Cierre de Jornada */}
      {showClosureModal && (
        <div className="fixed inset-0 z-50 bg-black/90 backdrop-blur-md flex flex-col">
          <div className="flex items-center p-6 border-b border-white/10">
            <button onClick={() => setShowClosureModal(false)} className="w-10 h-10 bg-white/5 rounded-full flex items-center justify-center text-white mr-4">
              <ArrowLeft size={20} />
            </button>
            <div>
              <h2 className="text-xl font-black uppercase tracking-tight text-white">Cierre de Jornada</h2>
              <p className="text-xs text-gray-500 font-bold tracking-widest uppercase mt-1">Rendición de Cuentas</p>
            </div>
          </div>
          <div className="flex-1 overflow-y-auto p-6 flex flex-col">
            {totalDeudaUsd === 0 ? (
              <div className="flex-1 flex flex-col items-center justify-center text-center opacity-50">
                <CheckCircle size={64} className="mb-4 text-green-400" />
                <h3 className="text-xl font-black uppercase tracking-tight">Todo al Día</h3>
                <p className="text-sm font-bold mt-2">No tienes pedidos pendientes por rendir.</p>
                <button onClick={() => setShowClosureModal(false)} className="mt-8 px-6 py-3 bg-white/10 rounded-xl font-bold uppercase tracking-widest text-xs">Cerrar</button>
              </div>
            ) : (
              <>
                <div className="bg-gradient-to-br from-orange-500/20 to-orange-500/5 border border-orange-500/30 p-6 rounded-3xl mb-8 flex flex-col items-center text-center">
                  <p className="text-orange-500 text-xs font-black uppercase tracking-widest mb-2">Total a Rendir</p>
                  <p className="text-5xl font-black text-white tracking-tighter">${formatCurrency(totalDeudaUsd)}</p>
                  <p className="text-xs text-gray-400 mt-2 font-bold uppercase">{pendingCashOrders.length} pedidos en efectivo</p>
                </div>
                
                <h3 className="text-sm font-black text-gray-400 uppercase tracking-widest mb-4">¿Cómo entregarás el dinero?</h3>
                <div className="flex gap-2 mb-6">
                  <button 
                    onClick={() => setClosureMethod('contador')}
                    className={`flex-1 py-4 text-[10px] font-black uppercase tracking-widest rounded-2xl transition-all ${closureMethod === 'contador' ? 'bg-orange-600 text-white' : 'bg-white/5 text-gray-500 hover:bg-white/10'}`}
                  >
                    Entregar al Contador
                  </button>
                  <button 
                    onClick={() => setClosureMethod('pago_movil')}
                    className={`flex-1 py-4 text-[10px] font-black uppercase tracking-widest rounded-2xl transition-all ${closureMethod === 'pago_movil' ? 'bg-purple-600 text-white' : 'bg-white/5 text-gray-500 hover:bg-white/10'}`}
                  >
                    Pago Móvil a Tienda
                  </button>
                </div>

                {closureMethod === 'pago_movil' && (
                  <div className="mb-8">
                    <h3 className="text-sm font-black text-gray-400 uppercase tracking-widest mb-4">Capture de Transferencia</h3>
                    {closureCapture ? (
                      <div className="relative aspect-video rounded-3xl border border-white/10 overflow-hidden bg-white/5">
                        <img src={closureCapture} alt="Capture" className="w-full h-full object-cover" />
                        <button 
                          onClick={() => setClosureCapture(null)}
                          className="absolute top-4 right-4 w-10 h-10 bg-black/60 rounded-full flex items-center justify-center text-white backdrop-blur-sm"
                        >
                          <X size={20} />
                        </button>
                      </div>
                    ) : (
                      <label className="aspect-video rounded-3xl border-2 border-dashed border-white/20 bg-white/5 flex flex-col items-center justify-center cursor-pointer hover:bg-white/10 transition-colors">
                        <input type="file" accept="image/*" className="hidden" onChange={async (e) => {
                          const file = e.target.files?.[0];
                          if (file) {
                            const compressedBase64 = await compressImage(file);
                            setClosureCapture(compressedBase64);
                          }
                        }} />
                        <UploadCloud size={32} className="text-gray-400 mb-3" />
                        <span className="text-xs font-bold text-gray-400 uppercase tracking-wider">Subir Capture</span>
                      </label>
                    )}
                  </div>
                )}

                <div className="mt-auto">
                  <button 
                    onClick={handleClosureSubmit}
                    disabled={submittingClosure || (closureMethod === 'pago_movil' && !closureCapture)}
                    className="w-full py-5 bg-white text-black rounded-2xl font-black text-sm uppercase tracking-widest disabled:opacity-50 hover:bg-gray-200 transition-colors"
                  >
                    {submittingClosure ? 'Enviando...' : 'Enviar Rendición a Tienda'}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function PaymentModal({ order, onClose, onConfirm }: { order: any, onClose: () => void, onConfirm: (id: string, captures: string[], metodo: string) => void }) {
  const [captures, setCaptures] = useState<string[]>([]);
  const [metodoPago, setMetodoPago] = useState<string>('pago_movil');

  // Simulación de subida de imagen a Base64 para el demo
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      try {
        const compressedBase64 = await compressImage(file);
        setCaptures([...captures, compressedBase64]);
      } catch (err) {
        console.error("Error comprimiendo imagen", err);
      }
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/90 backdrop-blur-md flex flex-col">
      <div className="flex items-center p-6 border-b border-white/10">
        <button onClick={onClose} className="w-10 h-10 bg-white/5 rounded-full flex items-center justify-center text-white mr-4">
          <ArrowLeft size={20} />
        </button>
        <div>
          <h2 className="text-xl font-black uppercase tracking-tight text-white">Finalizar Entrega</h2>
          <p className="text-xs text-gray-500 font-bold tracking-widest uppercase mt-1">Pedido #{order.codigo_pedido || order.id.substring(0,8)}</p>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-6 flex flex-col">
        <div className="bg-gradient-to-br from-green-500/20 to-green-500/5 border border-green-500/30 p-6 rounded-3xl mb-8 flex flex-col items-center text-center">
          <p className="text-green-500 text-xs font-black uppercase tracking-widest mb-2">Total a Cobrar</p>
          <p className="text-5xl font-black text-white tracking-tighter">${formatCurrency(order.total_usd)}</p>
        </div>

        {order.pagada ? (
          <div className="bg-green-500/20 border border-green-500/30 text-green-400 p-6 rounded-3xl mb-8 flex flex-col items-center text-center">
            <CheckCircle size={48} className="mb-4" />
            <h3 className="text-xl font-black uppercase tracking-tight">PAGO VERIFICADO</h3>
            <p className="text-sm font-bold opacity-80 mt-2">El administrador ya confirmó el pago. Solo procede a entregar el pedido.</p>
          </div>
        ) : (
          <>
            <div className="mb-6 bg-white/5 p-2 rounded-2xl grid grid-cols-2 gap-2">
              <button 
                onClick={() => setMetodoPago('pago_movil')}
                className={`w-full py-3 text-[9px] font-black uppercase tracking-widest rounded-xl transition-all ${metodoPago === 'pago_movil' ? 'bg-purple-600 text-white' : 'text-gray-500 hover:bg-white/5'}`}
              >
                Pago Móvil / Transf.
              </button>
              <button 
                onClick={() => setMetodoPago('punto_venta')}
                className={`w-full py-3 text-[9px] font-black uppercase tracking-widest rounded-xl transition-all ${metodoPago === 'punto_venta' ? 'bg-blue-600 text-white' : 'text-gray-500 hover:bg-white/5'}`}
              >
                Punto (Tarjeta)
              </button>
              <button 
                onClick={() => setMetodoPago('efectivo_usd')}
                className={`w-full py-3 text-[9px] font-black uppercase tracking-widest rounded-xl transition-all ${metodoPago === 'efectivo_usd' ? 'bg-green-600 text-white' : 'text-gray-500 hover:bg-white/5'}`}
              >
                Efectivo USD
              </button>
              <button 
                onClick={() => setMetodoPago('efectivo_bs')}
                className={`w-full py-3 text-[9px] font-black uppercase tracking-widest rounded-xl transition-all ${metodoPago === 'efectivo_bs' ? 'bg-green-600 text-white' : 'text-gray-500 hover:bg-white/5'}`}
              >
                Efectivo BS
              </button>
            </div>

            {(metodoPago === 'pago_movil' || metodoPago === 'punto_venta') && (
              <>
                <h3 className="text-sm font-black text-gray-400 uppercase tracking-widest mb-4">Capturas de Pago</h3>
                <div className="grid grid-cols-2 gap-4 mb-8">
                  {captures.map((cap, i) => (
                    <div key={i} className="relative aspect-square rounded-2xl border border-white/10 overflow-hidden bg-white/5">
                      <img src={cap} alt="Capture" className="w-full h-full object-cover" />
                      <button 
                        onClick={() => setCaptures(captures.filter((_, idx) => idx !== i))}
                        className="absolute top-2 right-2 w-8 h-8 bg-black/60 rounded-full flex items-center justify-center text-white backdrop-blur-sm"
                      >
                        <X size={16} />
                      </button>
                    </div>
                  ))}
                  <label className="aspect-square rounded-2xl border-2 border-dashed border-white/20 bg-white/5 flex flex-col items-center justify-center cursor-pointer hover:bg-white/10 transition-colors">
                    <input type="file" accept="image/*" className="hidden" onChange={handleFileUpload} />
                    <Camera size={28} className="text-gray-400 mb-2" />
                    <span className="text-xs font-bold text-gray-400 uppercase tracking-wider">Subir Foto</span>
                  </label>
                </div>
              </>
            )}
          </>
        )}

        <div className="mt-auto pt-6">
          <button 
          onClick={() => onConfirm(order.id, order.pagada ? [] : captures, order.pagada ? 'ya_pagado' : metodoPago)}
          disabled={!order.pagada && (metodoPago === 'pago_movil' || metodoPago === 'punto_venta') && captures.length === 0}
          className="w-full py-5 bg-white text-black rounded-2xl font-black text-sm uppercase tracking-widest disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-200 transition-colors"
        >
          {order.pagada ? 'Marcar como Entregado' : (metodoPago === 'pago_movil' || metodoPago === 'punto_venta' ? 'Subir Foto y Notificar' : 'Notificar Cobro Efectivo')}
        </button>
          {!order.pagada && captures.length === 0 && (metodoPago === 'pago_movil' || metodoPago === 'punto_venta') && (
            <p className="text-center text-xs text-orange-400 mt-4 font-bold">Debes subir una foto del comprobante para finalizar.</p>
          )}
        </div>
      </div>
    </div>
  );
}
