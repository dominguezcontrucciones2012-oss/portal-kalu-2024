import React, { useState, useEffect } from 'react';
import { Truck, MapPin, Phone, CheckCircle, Camera, UploadCloud, X, ArrowLeft, Image as ImageIcon, MessageCircle, AlertTriangle, LogOut } from 'lucide-react';
import { useAuth } from '../../contexts/AuthProvider';
import { subscribeToCollection, updateDocument, getDocument } from '../../lib/dbUtils';
import { useToast } from '../../contexts/ToastProvider';
import { formatCurrency, compressImage } from '../../lib/utils';
import { useNavigate } from 'react-router-dom';

export default function DriverPortalScreen() {
  const { user, setUser } = useAuth();
  const [orders, setOrders] = useState<any[]>([]);
  const [activeTab, setActiveTab] = useState<'pendientes' | 'entregados'>('pendientes');
  const [selectedOrder, setSelectedOrder] = useState<any | null>(null);
  const { addToast } = useToast();
  const navigate = useNavigate();

  useEffect(() => {
    if (!user || user.role !== 'repartidor') return;

    const unsub = subscribeToCollection('sales', async (data) => {
      const myOrders = data.filter((s: any) => s.repartidor_id === user.id);
      
      // Enriquecer con datos del cliente
      const enrichedOrders = await Promise.all(myOrders.map(async (order: any) => {
        if (order.cliente_id) {
          const clientData = await getDocument('clients', order.cliente_id);
          if (clientData) {
            return {
              ...order,
              direccion_cliente: clientData.direccion || 'Dirección no registrada',
              telefono_cliente: clientData.telefono || 'Teléfono no registrado'
            };
          }
        }
        return order;
      }));

      // Ordenar por fecha descendente
      enrichedOrders.sort((a, b) => new Date(b.fecha || 0).getTime() - new Date(a.fecha || 0).getTime());
      setOrders(enrichedOrders);
    });

    return () => unsub();
  }, [user]);

  const handleDeliver = async (orderId: string, captures: string[], metodoPago: string) => {
    try {
      // Si el mtodo es efectivo, no necesita que aprueben el capture, 
      // pero el pedido se queda 'efectivo_en_ruta' para que le cobren al repartidor despus.
      const status_pedido = (metodoPago === 'efectivo_usd' || metodoPago === 'efectivo_bs') 
        ? 'efectivo_en_ruta' 
        : 'verificando_pago';

      await updateDocument('sales', orderId, {
        status_pedido,
        captures_pago: captures,
        metodo_cobro_driver: metodoPago
      });
      
      if (status_pedido === 'efectivo_en_ruta') {
        addToast('success', 'Entregado en Efectivo. Recuerda entregar el billete.');
      } else {
        addToast('success', 'Pago enviado. Esperando verificacin de tienda.');
      }
      setSelectedOrder(null);
    } catch (e: any) {
      console.error(e);
      addToast('error', 'Error: ' + (e.message || 'No se pudo subir'));
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

  const pendingOrders = orders.filter(o => o.status_pedido === 'listo' || o.status_pedido === 'verificando_pago' || o.status_pedido === 'efectivo_en_ruta');
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
          <p className="text-xs text-gray-400 font-bold tracking-widest mt-1 uppercase">ID: {order.id.substring(0, 8)}</p>
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
        </div>
      </div>

      <div className="space-y-3 mb-5 bg-black/30 p-4 rounded-2xl border border-white/5">
        <div className="flex items-start gap-3">
          <MapPin size={16} className="text-red-400 mt-0.5 shrink-0" />
          <p className="text-sm text-gray-300 font-medium leading-snug">{order.direccion_cliente || 'Sin direccin registrada'}</p>
        </div>
        <div className="flex items-center gap-3">
          <Phone size={16} className="text-blue-400 shrink-0" />
          <p className="text-sm text-gray-300 font-medium">{order.telefono_cliente || 'Sin telfono'}</p>
        </div>
      </div>

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
          
          {order.status_pedido === 'verificando_pago' ? (
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
            <h1 className="text-2xl font-black tracking-tight">{user.username}</h1>
          </div>
          <div className="flex gap-3">
            <button onClick={() => setUser(null)} className="w-12 h-12 rounded-full bg-red-500/20 border border-red-500/30 flex items-center justify-center text-red-400 hover:bg-red-500/30 transition-colors">
              <LogOut size={20} />
            </button>
            <div className="w-12 h-12 rounded-full bg-purple-500/20 border border-purple-500/30 flex items-center justify-center text-purple-300">
              <Truck size={24} />
            </div>
          </div>
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
        {activeTab === 'pendientes' && pendingOrders.length === 0 && (
          <div className="h-full flex flex-col items-center justify-center opacity-30 mt-20">
            <CheckCircle size={80} className="mb-6" />
            <p className="text-xl font-black uppercase tracking-widest text-center">Todo al día</p>
            <p className="text-sm mt-2 font-bold text-center">No hay pedidos pendientes.</p>
          </div>
        )}

        {activeTab === 'entregados' && deliveredOrders.length === 0 && (
          <div className="h-full flex flex-col items-center justify-center opacity-30 mt-20">
            <CheckCircle size={80} className="mb-6" />
            <p className="text-xl font-black uppercase tracking-widest text-center">Todo al día</p>
            <p className="text-sm mt-2 font-bold text-center">No hay entregas en los últimos 7 días.</p>
          </div>
        )}

        {activeTab === 'pendientes' && pendingOrders.length > 0 && (
          <div className="space-y-4 pb-20">
            {pendingOrders.map(renderOrderCard)}
          </div>
        )}

        {activeTab === 'entregados' && deliveredOrders.length > 0 && (
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
          <p className="text-xs text-gray-500 font-bold tracking-widest uppercase mt-1">Pedido #{order.id.substring(0,8)}</p>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-6 flex flex-col">
        <div className="bg-gradient-to-br from-green-500/20 to-green-500/5 border border-green-500/30 p-6 rounded-3xl mb-8 flex flex-col items-center text-center">
          <p className="text-green-500 text-xs font-black uppercase tracking-widest mb-2">Total a Cobrar</p>
          <p className="text-5xl font-black text-white tracking-tighter">${formatCurrency(order.total_usd)}</p>
        </div>

        <div className="mb-6 bg-white/5 p-2 rounded-2xl flex gap-2">
          <button 
            onClick={() => setMetodoPago('pago_movil')}
            className={`flex-1 py-3 text-[10px] font-black uppercase tracking-widest rounded-xl transition-all ${metodoPago === 'pago_movil' ? 'bg-purple-600 text-white' : 'text-gray-500 hover:bg-white/5'}`}
          >
            Pago Mvil / Transf.
          </button>
          <button 
            onClick={() => setMetodoPago('efectivo_usd')}
            className={`flex-1 py-3 text-[10px] font-black uppercase tracking-widest rounded-xl transition-all ${metodoPago === 'efectivo_usd' ? 'bg-green-600 text-white' : 'text-gray-500 hover:bg-white/5'}`}
          >
            Efectivo USD
          </button>
          <button 
            onClick={() => setMetodoPago('efectivo_bs')}
            className={`flex-1 py-3 text-[10px] font-black uppercase tracking-widest rounded-xl transition-all ${metodoPago === 'efectivo_bs' ? 'bg-green-600 text-white' : 'text-gray-500 hover:bg-white/5'}`}
          >
            Efectivo BS
          </button>
        </div>

        {metodoPago === 'pago_movil' && (
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

        <div className="mt-auto pt-6">
          <button
            onClick={() => onConfirm(order.id, captures, metodoPago)}
            className={`w-full py-4 rounded-2xl font-black uppercase tracking-[2px] text-sm flex items-center justify-center gap-2 transition-all ${(metodoPago !== 'pago_movil' || captures.length > 0) ? 'bg-purple-600 hover:bg-purple-500 text-white shadow-xl shadow-purple-900/50' : 'bg-white/10 text-gray-500 cursor-not-allowed'}`}
            disabled={metodoPago === 'pago_movil' && captures.length === 0}
          >
            <CheckCircle size={18} /> Enviar Pago a Verificación
          </button>
          {captures.length === 0 && (
            <p className="text-center text-xs text-orange-400 mt-4 font-bold">Debes subir al menos un comprobante de pago para finalizar.</p>
          )}
        </div>
      </div>
    </div>
  );
}
