import React, { useState, useEffect } from 'react';
import { 
  Users,
  Clock,
  Search, 
  DollarSign, 
  Calendar, 
  ArrowRight, 
  AlertCircle,
  CheckCircle2,
  Phone,
  MessageSquare,
  X
} from 'lucide-react';
import { cn, formatCurrency } from '../../lib/utils';
import { subscribeToCollection, getLatestTasa, createSale, updateDocument, addDocument } from '../../lib/dbUtils';
import { type Client } from '../../types';

const MorososScreen: React.FC = () => {
  const [search, setSearch] = useState('');
  const [clients, setClients] = useState<Client[]>([]);
  const [tasaBcv, setTasaBcv] = useState(40.50);
  const [loading, setLoading] = useState(true);

  // Estados para Modal de Abono
  const [showAbonoModal, setShowAbonoModal] = useState(false);
  const [selectedClient, setSelectedClient] = useState<Client | null>(null);
  const [montoAbonoUSD, setMontoAbonoUSD] = useState('');
  const [metodoPago, setMetodoPago] = useState<'efectivo_usd' | 'efectivo_bs' | 'pago_movil_bs' | 'transferencia_bs'>('efectivo_usd');
  const [referencia, setReferencia] = useState('');
  const [savingAbono, setSavingAbono] = useState(false);

  useEffect(() => {
    const unsubscribe = subscribeToCollection('clients', (data) => {
      setClients(data as Client[]);
      setLoading(false);
    });
    getLatestTasa().then(rate => setTasaBcv(rate)).catch(() => {});
    return () => unsubscribe();
  }, []);

  const handleRegisterAbono = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedClient) return;
    const monto = parseFloat(montoAbonoUSD);
    if (isNaN(monto) || monto <= 0) {
      alert("Por favor ingresa un monto válido mayor a 0.");
      return;
    }
    if (monto > selectedClient.saldo_usd) {
      alert(`El monto del abono ($${monto.toFixed(2)}) no puede ser mayor que la deuda del cliente ($${selectedClient.saldo_usd.toFixed(2)}).`);
      return;
    }

    setSavingAbono(true);
    try {
      const today = new Date().toISOString();
      const abonoValores = {
        pago_efectivo_usd: metodoPago === 'efectivo_usd' ? monto : 0,
        pago_efectivo_bs: metodoPago === 'efectivo_bs' ? parseFloat((monto * tasaBcv).toFixed(2)) : 0,
        pago_movil_bs: metodoPago === 'pago_movil_bs' ? parseFloat((monto * tasaBcv).toFixed(2)) : 0,
        pago_transferencia_bs: metodoPago === 'transferencia_bs' ? parseFloat((monto * tasaBcv).toFixed(2)) : 0,
        biopago_bdv: 0,
        pago_debito_bs: 0,
        pago_otros_usd: 0,
        referencia: referencia
      };

      const saleData = {
        fecha: today,
        cliente_id: selectedClient.id,
        nombre_cliente: selectedClient.nombre,
        total_usd: 0,
        tasa_momento: tasaBcv,
        es_fiado: false,
        pagada: true,
        detalles: [
          { producto_id: 'abono', nombre: `ABONO A CUENTA - ${selectedClient.nombre}`, cantidad: 1, precio_unitario_usd: 0 }
        ],
        ...abonoValores,
        vuelto_entregado_usd: 0,
        saldo_pendiente_usd: 0,
        tipo_transaccion: 'abono',
        monto_abono_usd: monto,
        user_id: 'current-user'
      };

      await createSale(saleData);

      const nuevoSaldo = parseFloat((selectedClient.saldo_usd - monto).toFixed(2));
      await updateDocument('clients', selectedClient.id, {
        saldo_usd: nuevoSaldo
      });

      // Crear mensaje de confirmación directa para el portal del cliente
      const metodoTexto = metodoPago === 'efectivo_usd' ? 'Efectivo Dólares ($)' : metodoPago === 'efectivo_bs' ? 'Efectivo Bolívares (Bs)' : metodoPago === 'pago_movil_bs' ? 'Pago Móvil (Bs)' : 'Transferencia Bancaria (Bs)';
      await addDocument('mensajes', {
        cliente_id: selectedClient.id,
        fecha: today,
        titulo: "✅ Abono Confirmado",
        contenido: `Hemos recibido tu abono de $${monto.toFixed(2)} (${metodoTexto}). Tu saldo deudor actual es de $${nuevoSaldo.toFixed(2)}. ¡Gracias por tu pago!`,
        leido: false
      });

      setShowAbonoModal(false);
      setSelectedClient(null);
      setMontoAbonoUSD('');
      setReferencia('');
      alert("¡Abono registrado exitosamente!");
    } catch (err) {
      console.error("Error al registrar abono:", err);
      alert("Error al registrar el abono.");
    } finally {
      setSavingAbono(false);
    }
  };

  const morosos = clients.filter(c => c.saldo_usd > 0 && (
    c.nombre.toLowerCase().includes(search.toLowerCase()) || 
    c.cedula.includes(search)
  ));

  const totalDeuda = morosos.reduce((acc, curr) => acc + curr.saldo_usd, 0);

  if (loading) {
    return (
      <div className="h-[calc(100vh-14rem)] flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-red-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-8 animate-in fade-in duration-700">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div>
          <h1 className="text-3xl font-black text-white flex items-center gap-3">
            <Users className="text-[#e74c3c]" /> CUENTAS POR COBRAR
          </h1>
          <p className="text-gray-400 text-sm">Control estricto de mercancía fiada y abonos</p>
        </div>
        <div className="bg-red-500/10 border border-red-500/20 px-6 py-3 rounded-2xl">
          <div className="text-[10px] font-black text-red-400 uppercase tracking-widest leading-none mb-1">Deuda Total en la Calle</div>
          <div className="text-2xl font-black text-red-500">{formatCurrency(totalDeuda)}</div>
        </div>
      </div>

      <div className="bg-white/5 border border-white/10 p-2 rounded-3xl">
        <div className="relative">
          <Search className="absolute left-6 top-1/2 -translate-y-1/2 text-gray-500" size={20} />
          <input 
            type="text" 
            placeholder="Buscar por cliente moroso..."
            className="w-full bg-transparent py-5 pl-16 pr-6 focus:outline-none text-lg font-bold"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4">
        {morosos.length > 0 ? morosos.map(c => (
          <div key={c.id} className="bg-white/5 border border-white/10 rounded-3xl p-6 hover:bg-white/10 transition-all flex flex-col md:flex-row md:items-center justify-between gap-6 border-l-4 border-l-red-500">
            <div className="flex items-center gap-6">
              <div className="w-16 h-16 rounded-2xl bg-red-500/10 flex items-center justify-center text-red-500 shadow-inner">
                <Users size={32} />
              </div>
              <div>
                <h3 className="text-xl font-black text-white">{c.nombre}</h3>
                <div className="flex items-center gap-3 mt-1">
                  <span className="text-xs font-bold text-gray-500 uppercase">{c.cedula}</span>
                  <span className="w-1 h-1 rounded-full bg-gray-700" />
                  <span className="text-xs font-bold text-gray-500 uppercase flex items-center gap-1"><Calendar size={12} /> Hace unos días</span>
                </div>
              </div>
            </div>

            <div className="flex flex-col md:flex-row items-center gap-8">
              <div className="text-center md:text-right">
                <div className="text-[10px] text-gray-500 font-black uppercase mb-1">Monto Pendiente</div>
                <div className="text-2xl font-black text-red-400">{formatCurrency(c.saldo_usd)}</div>
                <div className="text-xs font-bold text-gray-600">Bs. {(c.saldo_usd * tasaBcv).toLocaleString()}</div>
              </div>
              
              <div className="flex gap-2">
                <button 
                  onClick={() => c.telefono ? window.open(`tel:${c.telefono}`) : alert('Cliente sin teléfono registrado')}
                  className="p-4 bg-green-500/10 hover:bg-green-500/20 text-green-500 rounded-2xl transition-all" 
                  title="Llamar"
                >
                  <Phone size={20} />
                </button>
                <button 
                  onClick={() => c.telefono ? window.open(`https://wa.me/${c.telefono.replace(/\\D/g,'')}`) : alert('Cliente sin teléfono registrado')}
                  className="p-4 bg-blue-500/10 hover:bg-blue-500/20 text-blue-500 rounded-2xl transition-all" 
                  title="WhatsApp"
                >
                  <MessageSquare size={20} />
                </button>
                <button 
                  onClick={() => { setSelectedClient(c); setMontoAbonoUSD(String(c.saldo_usd)); setShowAbonoModal(true); }}
                  className="bg-white text-black font-black px-6 rounded-2xl hover:bg-gray-200 transition-all text-xs uppercase tracking-widest"
                >
                  Registrar Abono
                </button>
              </div>
            </div>
          </div>
        )) : (
          <div className="text-center py-20 bg-white/5 border border-dashed border-white/10 rounded-[3rem]">
            <CheckCircle2 size={64} className="mx-auto text-green-500 opacity-20 mb-4" />
            <h3 className="text-xl font-bold text-gray-500 uppercase tracking-widest leading-loose">No hay morosos pendientes</h3>
            <p className="text-sm text-gray-700 font-bold uppercase">Cartera de clientes 100% al día</p>
          </div>
        )}
      </div>

      {/* Modal Registrar Abono */}
      {showAbonoModal && selectedClient && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm">
          <div className="relative w-full max-w-md bg-[#1e293b] border border-white/10 rounded-[2.5rem] shadow-2xl p-6 sm:p-8 text-white animate-in zoom-in-95 duration-200">
            <button 
              onClick={() => { setShowAbonoModal(false); setSelectedClient(null); }}
              className="absolute top-4 right-4 text-gray-400 hover:text-white bg-white/5 p-2 rounded-xl"
            >
              <X size={18} />
            </button>

            <h3 className="text-xl font-black uppercase tracking-tight text-white mb-2">Registrar Abono</h3>
            <p className="text-xs text-gray-400 font-bold mb-6">
              Cliente: <span className="text-white uppercase font-black">{selectedClient.nombre}</span> ({selectedClient.cedula})
            </p>

            <form onSubmit={handleRegisterAbono} className="space-y-4">
              <div className="p-4 bg-red-500/10 border border-red-500/20 rounded-2xl flex justify-between items-center text-xs">
                <span className="text-gray-400 font-bold uppercase">Deuda actual:</span>
                <span className="font-black text-red-400 text-lg">${selectedClient.saldo_usd.toFixed(2)}</span>
              </div>

              <div className="space-y-1.5">
                <label className="text-[10px] font-black uppercase text-gray-500 tracking-widest px-1">Monto a Abonar (USD)</label>
                <div className="relative">
                  <span className="absolute left-4 top-1/2 -translate-y-1/2 text-green-500 font-black text-sm">$</span>
                  <input 
                    type="number" 
                    step="0.01"
                    className="w-full bg-black/40 border border-white/10 rounded-2xl py-3 pl-10 pr-4 text-right text-green-400 font-black text-lg focus:border-green-500 outline-none" 
                    placeholder="0.00"
                    value={montoAbonoUSD}
                    onChange={e => setMontoAbonoUSD(e.target.value)}
                    required
                  />
                </div>
                {parseFloat(montoAbonoUSD) > 0 && (
                  <span className="text-[10px] text-gray-500 font-bold block text-right">
                    Equivale a Bs. {(parseFloat(montoAbonoUSD) * tasaBcv).toFixed(2)}
                  </span>
                )}
              </div>

              <div className="space-y-1.5">
                <label className="text-[10px] font-black uppercase text-gray-500 tracking-widest px-1">Método de Pago</label>
                <select 
                  className="w-full bg-[#151f32] border border-white/10 rounded-2xl p-3 text-sm font-bold text-white outline-none focus:border-blue-500"
                  value={metodoPago}
                  onChange={e => setMetodoPago(e.target.value as any)}
                >
                  <option value="efectivo_usd">💵 Efectivo Dólares ($)</option>
                  <option value="efectivo_bs">💵 Efectivo Bolívares (Bs)</option>
                  <option value="pago_movil_bs">📱 Pago Móvil (Bs)</option>
                  <option value="transferencia_bs">🏦 Transferencia Bancaria (Bs)</option>
                </select>
              </div>

              {metodoPago !== 'efectivo_usd' && metodoPago !== 'efectivo_bs' && (
                <div className="space-y-1.5 animate-in fade-in slide-in-from-top-2 duration-200">
                  <label className="text-[10px] font-black uppercase text-gray-500 tracking-widest px-1">Referencia</label>
                  <input 
                    type="text" 
                    className="w-full bg-black/40 border border-white/10 rounded-2xl p-3 text-sm font-bold text-white focus:border-blue-500 outline-none"
                    placeholder="Referencia o Rastro bancario..."
                    value={referencia}
                    onChange={e => setReferencia(e.target.value)}
                    required
                  />
                </div>
              )}

              <button 
                type="submit"
                disabled={savingAbono}
                className="w-full py-4 bg-green-600 hover:bg-green-500 text-white font-black uppercase tracking-[3px] rounded-2xl shadow-xl shadow-green-500/10 transition-all active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed mt-4 text-xs"
              >
                {savingAbono ? 'Registrando...' : 'Confirmar Abono'}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default MorososScreen;
