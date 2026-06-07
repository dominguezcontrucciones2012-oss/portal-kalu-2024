import React, { useState, useEffect } from 'react';
import { Package, MessageCircle, Printer, CheckCircle, Check, Clock, Truck, X, AlertTriangle } from 'lucide-react';
import { subscribeToCollection, updateDocument, getLatestTasa } from '../../lib/dbUtils';
import { formatCurrency, parseDate } from '../../lib/utils';
import { useToast } from '../../contexts/ToastProvider';
import { useAuth } from '../../contexts/AuthProvider';
import CashValidationModal from '../common/CashValidationModal';

export default function DispatchScreen() {
  const { user } = useAuth();
  const [orders, setOrders] = useState<any[]>([]);
  const [allSales, setAllSales] = useState<any[]>([]);
  const [drivers, setDrivers] = useState<any[]>([]);
  const [assignModalOpen, setAssignModalOpen] = useState<string | null>(null);
  const [pickupModalOpen, setPickupModalOpen] = useState<any>(null);
  const [pickupPaymentMethod, setPickupPaymentMethod] = useState<'efectivo_usd' | 'efectivo_bs' | 'pago_movil' | 'punto_venta'>('efectivo_usd');
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [cashValidationOrder, setCashValidationOrder] = useState<any>(null);
  const { addToast } = useToast();

  const [tasaActual, setTasaActual] = useState(40.50);

  useEffect(() => {
    // Cargar tasa actual para clculos
    getLatestTasa().then(setTasaActual).catch(console.error);

    const unsubOrders = subscribeToCollection('sales', (data) => {
      setAllSales(data);
      // Filtrar solo pedidos web pendientes o listos
      const webOrders = data.filter((s: any) => 
        (s.status_pedido === 'pendiente' || s.status_pedido === 'listo' || s.status_pedido === 'verificando_pago' || s.status_pedido === 'efectivo_en_ruta')
      );
      // Ordenar por fecha descendente
      webOrders.sort((a, b) => parseDate(b.createdAt || b.fecha).getTime() - parseDate(a.createdAt || a.fecha).getTime());
      setOrders(webOrders);
    });

    const unsubUsers = subscribeToCollection('users', (data) => {
      const repartidores = data.filter((u: any) => u.role === 'repartidor');
      setDrivers(repartidores);
    });

    return () => {
      unsubOrders();
      unsubUsers();
    };
  }, []);

  // Sonido de campana para nuevos pedidos pendientes
  useEffect(() => {
    const pendingCount = orders.filter(o => o.status_pedido === 'pendiente').length;
    if (pendingCount > 0) {
      // Intentar reproducir sonido de campana
      try {
        const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
        const oscillator = audioContext.createOscillator();
        const gainNode = audioContext.createGain();
        oscillator.type = 'sine';
        oscillator.frequency.setValueAtTime(880, audioContext.currentTime); // Nota La
        oscillator.frequency.exponentialRampToValueAtTime(440, audioContext.currentTime + 0.5);
        gainNode.gain.setValueAtTime(0.1, audioContext.currentTime);
        gainNode.gain.exponentialRampToValueAtTime(0.001, audioContext.currentTime + 0.5);
        oscillator.connect(gainNode);
        gainNode.connect(audioContext.destination);
        oscillator.start();
        oscillator.stop(audioContext.currentTime + 0.5);
      } catch (e) {
        console.log("No se pudo reproducir audio", e);
      }
    }
  }, [orders.filter(o => o.status_pedido === 'pendiente' || o.status_pedido === 'verificando_pago' || o.status_pedido === 'efectivo_en_ruta').length]);

  const handleMarkAsReady = async (id: string, repartidorId?: string) => {
    try {
      const updateData: any = { status_pedido: 'listo' };
      if (repartidorId) {
        updateData.repartidor_id = repartidorId;
      }
      await updateDocument('sales', id, updateData);
      addToast('success', 'Pedido empacado' + (repartidorId ? ' y asignado' : ''));
      setAssignModalOpen(null);
    } catch (error) {
      addToast('error', 'Error al actualizar estado');
    }
  };

  const handleApprovePayment = async (order: any) => {
    try {
      const updateData: any = {
        status_pedido: 'entregado',
        pagada: true
      };
      
      // Si fue pago mvil, registrarlo para el cierre de caja
      if (order.metodo_cobro_driver === 'pago_movil' || !order.metodo_cobro_driver) {
        const tasa = await getLatestTasa();
        updateData.pago_movil_bs = order.total_usd * tasa;
      }
      
      await updateDocument('sales', order.id, updateData);
      addToast('success', 'Pago aprobado. Pedido completado.');
    } catch (e) {
      addToast('error', 'Error al aprobar pago');
    }
  };

  const handleReceiveCash = async (order: any) => {
    try {
      const updateData: any = {
        status_pedido: 'entregado',
        pagada: true
      };
      
      const tasa = await getLatestTasa();
      if (order.metodo_cobro_driver === 'efectivo_usd') {
        updateData.pago_efectivo_usd = order.total_usd;
      } else if (order.metodo_cobro_driver === 'efectivo_bs') {
        updateData.pago_efectivo_bs = order.total_usd * tasa;
      }

      await updateDocument('sales', order.id, updateData);
      addToast('success', 'Efectivo recibido y sumado a la caja.');
    } catch (error) {
      addToast('error', 'Error al recibir efectivo');
    }
  };

  const handleRejectPayment = async (order: any) => {
    try {
      await updateDocument('sales', order.id, {
        status_pedido: 'listo',
        captures_pago: []
      });
      addToast('success', 'Pago rechazado. El repartidor fue notificado.');
    } catch (e) {
      addToast('error', 'Error al rechazar pago');
    }
  };

  const handleStorePickup = async (order: any, method: string) => {
    try {
      const updateData: any = {
        status_pedido: 'entregado',
        pagada: true
      };
      
      if (!order.pagada) {
        const tasa = await getLatestTasa();
        if (method === 'efectivo_usd') {
          updateData.pago_efectivo_usd = order.total_usd;
        } else if (method === 'efectivo_bs') {
          updateData.pago_efectivo_bs = order.total_usd * tasa;
        } else if (method === 'pago_movil') {
          updateData.pago_movil_bs = order.total_usd * tasa;
        } else if (method === 'punto_venta') {
          updateData.pago_debito_bs = order.total_usd * tasa;
        }
      }

      await updateDocument('sales', order.id, updateData);
      addToast('success', 'Pedido entregado en tienda.');
      setPickupModalOpen(null);
    } catch (e) {
      addToast('error', 'Error al procesar la entrega.');
    }
  };

  const handleWhatsApp = (order: any) => {
    const text = encodeURIComponent(`Hola ${order.nombre_cliente}, tu pedido de Kalu Queso San Juan ya está empacado y listo para retirar. ¡Te esperamos!`);
    window.open(`https://wa.me/?text=${text}`, '_blank');
  };

  const handlePrint = (order: any) => {
    const printWindow = window.open('', '_blank');
    if (!printWindow) return;
    
    const html = `
      <html>
        <head>
          <title>Ticket de Despacho</title>
          <style>
            body { font-family: monospace; width: 300px; margin: 0; padding: 10px; font-size: 14px; }
            h2 { text-align: center; margin: 0 0 10px 0; font-size: 18px; }
            .divider { border-bottom: 1px dashed #000; margin: 10px 0; }
            .item { display: flex; justify-content: space-between; margin-bottom: 5px; }
            .qty { font-weight: bold; margin-right: 10px; }
          </style>
        </head>
        <body>
          <h2>KALU QUESO - DESPACHO</h2>
          <p><strong>Cliente:</strong> ${order.nombre_cliente}</p>
          <p><strong>Pedido:</strong> #${order.id.substring(0, 8)}</p>
          <p><strong>Fecha:</strong> ${parseDate(order.createdAt || order.fecha).toLocaleString()}</p>
          <p><strong>Tipo:</strong> ${order.tipo_entrega === 'delivery' ? '🛵 DELIVERY' : '🏪 RETIRO'}</p>
          <div class="divider"></div>
          ${(order.detalles || []).map((d: any) => `
            <div class="item">
              <div><span class="qty">${d.cantidad}x</span> ${d.nombre}</div>
            </div>
          `).join('')}
          <div class="divider"></div>
          <p style="text-align:center;">--- LISTO PARA ENTREGAR ---</p>
          <script>
            window.onload = () => { window.print(); window.close(); }
          </script>
        </body>
      </html>
    `;
    printWindow.document.write(html);
    printWindow.document.close();
  };

  return (
    <div className="flex-1 p-8 space-y-6 max-h-screen overflow-hidden flex flex-col relative">
      <div className="flex justify-between items-end">
        <div>
          <h1 className="text-3xl font-black text-white uppercase tracking-tight flex items-center gap-3">
            <Package className="text-blue-400" size={32} />
            Pantalla de Despacho (KDS)
          </h1>
          <p className="text-gray-400 mt-2 font-bold">
            Zona exclusiva para preparadores. Empaca y asigna.
          </p>
        </div>

        <div className="flex gap-4 overflow-x-auto custom-scrollbar pb-2">
          {drivers.map(driver => {
            const driverOrdersEnRuta = allSales.filter(o => o.repartidor_id === driver.id && o.status_pedido === 'efectivo_en_ruta');
            
            const today = new Date();
            today.setHours(0, 0, 0, 0);
            
            const driverOrdersToday = allSales.filter(o => {
              if (o.repartidor_id !== driver.id) return false;
              if (o.status_pedido !== 'entregado') return false;
              const orderDate = parseDate(o.createdAt || o.fecha);
              return orderDate >= today;
            });
            
            if (driverOrdersEnRuta.length === 0 && driverOrdersToday.length === 0) return null;
            
            const usd = driverOrdersEnRuta.filter(o => o.metodo_cobro_driver === 'efectivo_usd').reduce((acc, o) => acc + (o.total_usd || 0), 0);
            const bs = driverOrdersEnRuta.filter(o => o.metodo_cobro_driver === 'efectivo_bs').reduce((acc, o) => acc + ((o.total_usd || 0) * tasaActual), 0);

            return (
              <div key={driver.id} className="bg-[#111] border border-white/10 rounded-2xl p-4 flex flex-col gap-2 min-w-[180px] shadow-lg">
                <span className="text-[10px] font-black uppercase text-purple-400 tracking-widest flex items-center gap-1">
                  <Truck size={12} /> {driver.nombre || driver.username}
                </span>
                
                <div className="bg-white/5 p-2 rounded-xl flex justify-between items-center">
                  <span className="text-[9px] font-bold text-gray-500 uppercase tracking-widest">Entregas Hoy</span>
                  <span className="text-sm font-black text-white">{driverOrdersToday.length}</span>
                </div>
                
                <div className="bg-orange-500/10 border border-orange-500/20 p-2 rounded-xl">
                  <span className="text-[9px] font-bold text-orange-500/70 uppercase tracking-widest block mb-1">Efectivo en Ruta</span>
                  <div className="text-sm font-black text-white">
                    {usd > 0 && <div>${usd.toFixed(2)}</div>}
                    {bs > 0 && <div>Bs {bs.toFixed(2)}</div>}
                    {usd === 0 && bs === 0 && <span className="text-gray-500 font-bold">$0.00</span>}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {cashValidationOrder && (
        <CashValidationModal
          isOpen={true}
          onClose={() => setCashValidationOrder(null)}
          onSuccess={() => {
            handleReceiveCash(cashValidationOrder);
            setCashValidationOrder(null);
          }}
          expectedPin={user?.pin || ''}
        />
      )}

      <div className="flex-1 overflow-y-auto custom-scrollbar">
        {orders.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center opacity-30">
            <Package size={80} />
            <p className="mt-4 text-xl font-black uppercase tracking-widest">Sin Pedidos Pendientes</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
            {orders.map(order => (
              <div 
                key={order.id} 
                className={`bg-white/5 border rounded-3xl p-6 flex flex-col gap-4 shadow-xl ${
                  order.status_pedido === 'pendiente' ? 'border-orange-500/30 bg-orange-500/5' : 'border-green-500/30 bg-green-500/5'
                }`}
              >
                {/* Header */}
                <div className="flex justify-between items-start">
                  <div>
                    <h3 className="text-xl font-black text-white uppercase">{order.nombre_cliente}</h3>
                    <div className="flex items-center gap-1.5 text-[10px] font-black text-gray-500 uppercase tracking-widest bg-black/40 px-3 py-1 rounded-full w-fit mt-1">
                      <Clock size={12} className="text-blue-400" /> 
                      {parseDate(order.createdAt || order.fecha).toLocaleTimeString()} • #{order.id.substring(0, 8)}
                    </div>
                  </div>
                  <span className={`text-[10px] font-black uppercase px-3 py-1.5 rounded-xl border tracking-widest ${
                    order.status_pedido === 'pendiente' 
                      ? 'bg-orange-500/20 text-orange-400 border-orange-500/30 animate-pulse'
                      : order.status_pedido === 'verificando_pago'
                      ? 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30 animate-pulse'
                      : order.status_pedido === 'efectivo_en_ruta'
                      ? 'bg-orange-600/20 text-orange-300 border-orange-600/30 animate-pulse'
                      : 'bg-green-500/20 text-green-400 border-green-500/30'
                  }`}>
                    {order.status_pedido === 'pendiente' ? 'Pte. Empacar' : order.status_pedido === 'verificando_pago' ? 'Verificando Pago' : order.status_pedido === 'efectivo_en_ruta' ? 'Efectivo en Ruta' : '¡LISTO!'}
                  </span>
                </div>

                {/* Items */}
                <div className="bg-black/30 p-4 rounded-2xl border border-white/5 flex-1">
                  <div className="space-y-3">
                    {(order.detalles || []).map((d: any, idx: number) => (
                      <div key={idx} className="flex justify-between items-center border-b border-white/5 pb-2 last:border-0 last:pb-0">
                        <span className="text-sm font-bold text-gray-300 uppercase">{d.nombre}</span>
                        <span className="text-lg font-black text-white bg-white/10 px-3 py-1 rounded-lg">x{d.cantidad}</span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Info adicional */}
                <div className="flex gap-2 text-[10px] font-black uppercase tracking-wider">
                  <span className={`px-3 py-2 rounded-xl flex-1 text-center flex items-center justify-center gap-1 ${order.tipo_entrega === 'delivery' ? 'bg-purple-500/20 text-purple-400 border border-purple-500/30' : 'bg-white/5 text-gray-400'}`}>
                    {order.tipo_entrega === 'delivery' ? <Truck size={12} /> : <Clock size={12} />} 
                    {order.tipo_entrega === 'delivery' ? 'Delivery' : 'Retiro Tienda'}
                  </span>
                  {order.repartidor_id && (
                    <span className="bg-blue-500/20 text-blue-400 border border-blue-500/30 px-3 py-2 rounded-xl flex items-center justify-center">
                      Asignado
                    </span>
                  )}
                </div>

                {/* Verificacin de Pago */}
                {order.status_pedido === 'verificando_pago' && order.captures_pago && (
                  <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-2xl p-4 flex flex-col gap-3">
                    <h4 className="text-yellow-400 font-black uppercase text-xs tracking-widest flex items-center gap-2">
                      <AlertTriangle size={14} /> Verificar Pago
                    </h4>
                    <div className="flex gap-2 overflow-x-auto custom-scrollbar">
                      {order.captures_pago.map((cap: string, i: number) => (
                        <button key={i} onClick={() => setSelectedImage(cap)} className="shrink-0 focus:outline-none hover:opacity-80 transition-opacity">
                          <img src={cap} alt="Pago" className="w-16 h-16 rounded-xl object-cover border border-yellow-500/30 cursor-pointer" />
                        </button>
                      ))}
                    </div>
                  </div>
                )}
                {order.status_pedido === 'efectivo_en_ruta' && (
                  <div className="bg-orange-500/10 border border-orange-500/30 rounded-2xl p-4 flex flex-col gap-3">
                    <h4 className="text-orange-400 font-black uppercase text-xs tracking-widest flex items-center gap-2">
                      <AlertTriangle size={14} /> Efectivo en Ruta
                    </h4>
                    <p className="text-xs font-bold text-orange-200 uppercase tracking-widest">
                      El repartidor tiene {order.metodo_cobro_driver === 'efectivo_usd' ? `USD $${order.total_usd}` : `Bs. ${(order.total_usd * tasaActual).toFixed(2)}`} en efectivo.
                    </p>
                  </div>
                )}

                {/* Actions */}
                <div className="grid grid-cols-3 gap-2 mt-auto">
                  {order.status_pedido === 'verificando_pago' ? (
                    <>
                      <button
                        onClick={() => handleApprovePayment(order)}
                        className="col-span-2 bg-green-600 hover:bg-green-500 text-white p-3 rounded-xl font-black text-[10px] uppercase tracking-[2px] flex items-center justify-center gap-2 transition-colors shadow-lg shadow-green-900/50"
                      >
                        <Check size={16} /> Aprobar
                      </button>
                      <button
                        onClick={() => handleRejectPayment(order)}
                        className="col-span-1 bg-red-600 hover:bg-red-500 text-white p-3 rounded-xl font-black text-[10px] uppercase tracking-[2px] flex items-center justify-center gap-2 transition-colors shadow-lg shadow-red-900/50"
                      >
                        <X size={16} />
                      </button>
                    </>
                  ) : order.status_pedido === 'efectivo_en_ruta' ? (
                    <button
                      onClick={() => setCashValidationOrder(order)}
                      className="col-span-3 bg-orange-600 hover:bg-orange-500 text-white p-3 rounded-xl font-black text-[10px] uppercase tracking-[2px] flex items-center justify-center gap-2 transition-colors shadow-lg shadow-orange-900/50"
                    >
                      <Check size={16} /> Recibir Efectivo
                    </button>
                  ) : order.status_pedido === 'pendiente' ? (
                    <button
                      onClick={() => setAssignModalOpen(order.id)}
                      className="col-span-2 bg-blue-600 hover:bg-blue-500 text-white p-3 rounded-xl font-black text-[10px] uppercase tracking-[2px] flex items-center justify-center gap-2 transition-colors"
                    >
                      <CheckCircle size={16} /> Marcar Empacado
                    </button>
                  ) : (
                    <div className="col-span-2 flex gap-1">
                      <button
                        onClick={() => handleWhatsApp(order)}
                        className="flex-1 bg-green-600 hover:bg-green-500 text-white p-3 rounded-xl font-black text-[9px] uppercase tracking-wider flex items-center justify-center gap-1 transition-colors"
                      >
                        <MessageCircle size={14} /> Avisar
                      </button>
                      {!order.repartidor_id && order.tipo_entrega === 'delivery' && (
                        <button
                          onClick={() => setAssignModalOpen(order.id)}
                          className="flex-1 bg-purple-600 hover:bg-purple-500 text-white p-3 rounded-xl font-black text-[9px] uppercase tracking-wider flex items-center justify-center gap-1 transition-colors"
                        >
                          <Truck size={14} /> Asignar
                        </button>
                      )}
                      {order.tipo_entrega !== 'delivery' && (
                        <button
                          onClick={() => setPickupModalOpen(order)}
                          className="flex-1 bg-blue-600 hover:bg-blue-500 text-white p-3 rounded-xl font-black text-[9px] uppercase tracking-wider flex items-center justify-center gap-1 transition-colors"
                        >
                          <CheckCircle size={14} /> Entregar
                        </button>
                      )}
                    </div>
                  )}
                  <button
                    onClick={() => handlePrint(order)}
                    className="col-span-1 bg-white/10 hover:bg-white/20 text-white p-3 rounded-xl flex items-center justify-center transition-colors"
                    title="Imprimir Ticket"
                  >
                    <Printer size={18} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Modal de Asignación */}
      {assignModalOpen && (
        <div className="absolute inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#111] border border-white/10 p-6 rounded-3xl w-full max-w-sm shadow-2xl animate-in fade-in zoom-in duration-200">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-xl font-black text-white uppercase tracking-wider">Asignar Pedido</h2>
              <button onClick={() => setAssignModalOpen(null)} className="text-gray-500 hover:text-white">
                <X size={24} />
              </button>
            </div>
            
            <p className="text-gray-400 mb-6 text-sm">Selecciona un repartidor para enviar este pedido a su fila de entregas, o déjalo sin asignar si es retiro en tienda.</p>
            
            <div className="space-y-3">
              {drivers.length > 0 ? drivers.map(d => (
                <button
                  key={d.id}
                  onClick={() => handleMarkAsReady(assignModalOpen as string, d.id)}
                  className="w-full bg-white/5 hover:bg-white/10 border border-white/10 p-4 rounded-2xl flex items-center gap-3 transition-colors text-left"
                >
                  <div className="w-10 h-10 bg-purple-500/20 text-purple-400 rounded-full flex items-center justify-center font-black">
                    {d.username.charAt(0).toUpperCase()}
                  </div>
                  <div>
                    <p className="text-white font-bold">{d.username}</p>
                    <p className="text-gray-500 text-xs">Repartidor</p>
                  </div>
                </button>
              )) : (
                <div className="text-center p-4 border border-dashed border-white/10 rounded-2xl">
                  <p className="text-gray-500 text-sm">No hay repartidores registrados.</p>
                </div>
              )}
              
              <button
                onClick={() => handleMarkAsReady(assignModalOpen as string)}
                className="w-full mt-4 bg-blue-600/20 text-blue-400 hover:bg-blue-600/30 border border-blue-500/30 p-4 rounded-2xl font-black tracking-widest uppercase transition-colors"
              >
                Solo Empacar (Retiro)
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal de Retiro en Tienda */}
      {pickupModalOpen && (
        <div className="absolute inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#111] border border-white/10 p-6 rounded-3xl w-full max-w-sm shadow-2xl animate-in fade-in zoom-in duration-200">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-xl font-black text-white uppercase tracking-wider">Entregar en Tienda</h2>
              <button onClick={() => setPickupModalOpen(null)} className="text-gray-500 hover:text-white">
                <X size={24} />
              </button>
            </div>
            
            <p className="text-gray-400 mb-6 text-sm">
              ¿Cómo está pagando el cliente el total de <strong className="text-white">${pickupModalOpen.total_usd}</strong>?
            </p>

            <div className="space-y-3">
              {pickupModalOpen.pagada ? (
                <div className="bg-green-500/20 text-green-400 border border-green-500/30 p-4 rounded-2xl text-center">
                  <p className="font-black tracking-widest uppercase">¡Este pedido ya está pagado!</p>
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-3 mb-6">
                  <button onClick={() => setPickupPaymentMethod('efectivo_usd')} className={`p-3 rounded-xl border font-black uppercase text-[10px] tracking-wider transition-all ${pickupPaymentMethod === 'efectivo_usd' ? 'bg-green-500/20 text-green-400 border-green-500/50' : 'bg-white/5 text-gray-400 border-white/10 hover:bg-white/10'}`}>Efectivo USD</button>
                  <button onClick={() => setPickupPaymentMethod('efectivo_bs')} className={`p-3 rounded-xl border font-black uppercase text-[10px] tracking-wider transition-all ${pickupPaymentMethod === 'efectivo_bs' ? 'bg-green-500/20 text-green-400 border-green-500/50' : 'bg-white/5 text-gray-400 border-white/10 hover:bg-white/10'}`}>Efectivo Bs</button>
                  <button onClick={() => setPickupPaymentMethod('pago_movil')} className={`p-3 rounded-xl border font-black uppercase text-[10px] tracking-wider transition-all ${pickupPaymentMethod === 'pago_movil' ? 'bg-blue-500/20 text-blue-400 border-blue-500/50' : 'bg-white/5 text-gray-400 border-white/10 hover:bg-white/10'}`}>Pago Móvil</button>
                  <button onClick={() => setPickupPaymentMethod('punto_venta')} className={`p-3 rounded-xl border font-black uppercase text-[10px] tracking-wider transition-all ${pickupPaymentMethod === 'punto_venta' ? 'bg-purple-500/20 text-purple-400 border-purple-500/50' : 'bg-white/5 text-gray-400 border-white/10 hover:bg-white/10'}`}>Punto Venta</button>
                </div>
              )}
              
              <button
                onClick={() => handleStorePickup(pickupModalOpen, pickupModalOpen.pagada ? 'ya_pagado' : pickupPaymentMethod)}
                className="w-full bg-blue-600 hover:bg-blue-500 text-white p-4 rounded-2xl font-black text-xs uppercase tracking-[3px] flex items-center justify-center gap-2 transition-colors shadow-lg shadow-blue-900/50"
              >
                <CheckCircle size={18} /> Confirmar Entrega
              </button>
            </div>
          </div>
        </div>
      )}

      {selectedImage && (
        <div className="fixed inset-0 z-[100] bg-black/90 backdrop-blur-md flex items-center justify-center p-4">
          <button 
            onClick={() => setSelectedImage(null)}
            className="absolute top-6 right-6 w-12 h-12 bg-white/10 rounded-full flex items-center justify-center text-white hover:bg-white/20 transition-colors"
          >
            <X size={24} />
          </button>
          <img src={selectedImage} alt="Capture completo" className="max-w-full max-h-[90vh] object-contain rounded-lg" />
        </div>
      )}
    </div>
  );
}
