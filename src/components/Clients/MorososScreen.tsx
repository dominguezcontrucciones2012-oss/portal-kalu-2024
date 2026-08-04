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
import { useNavigate } from 'react-router-dom';

const MorososScreen: React.FC = () => {
  const navigate = useNavigate();
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
    String(c.cedula || '').includes(search)
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
    <div className="min-h-screen text-white p-4 md:p-6 pt-1 md:pt-1 transition-all duration-300">
      
      {/* 1. CABECERA PEGADA ARRIBA CON BOTÓN REGRESAR */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-3">
        <div className="flex items-center gap-3">
          <button 
            onClick={() => navigate(-1)}
            title="Volver atrás"
            className="w-9 h-9 flex items-center justify-center bg-cyan-500/20 hover:bg-cyan-500/40 text-cyan-400 rounded-full transition-all border border-cyan-500/30 shrink-0"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M15 19l-7-7 7-7" />
            </svg>
          </button>

          <div>
            <div className="flex items-center gap-2">
              <span className="bg-red-500/20 text-red-400 p-1 rounded-lg text-lg">💳</span>
              <h1 className="text-2xl md:text-3xl font-black tracking-wide uppercase leading-none">
                CUENTAS POR COBRAR
              </h1>
            </div>
            <p className="text-xs text-slate-400 mt-1">
              Control estricto de mercancía fiada y abonos
            </p>
          </div>
        </div>

        <div className="flex items-center gap-4">
          {search === 'RESET' && (
            <button 
              onClick={async () => {
                if (window.confirm("¿SEGURO QUE DESEAS LLEVAR A 0 LA DEUDA DE TODOS LOS CLIENTES DEL SISTEMA?")) {
                  for (const c of clients.filter(c => c.saldo_usd > 0)) {
                    await updateDocument('clients', c.id, { saldo_usd: 0 });
                  }
                  alert("Deuda reseteada a 0 para todos.");
                  setSearch('');
                }
              }}
              className="bg-red-600 px-4 py-2 rounded-xl text-white font-bold animate-pulse text-xs"
            >
              LIMPIAR BUG DE DEUDA
            </button>
          )}
          <div className="bg-red-500/10 border border-red-500/20 px-6 py-2 rounded-2xl self-start md:self-auto text-right">
            <div className="text-[10px] font-black text-red-400 uppercase tracking-widest leading-none mb-1">Deuda Total en la Calle</div>
            <div className="text-xl font-black text-red-500">{formatCurrency(totalDeuda)}</div>
          </div>
        </div>
      </div>

      {/* BLOQUE DE BÚSQUEDA */}
      <div className="bg-[#112d59]/80 backdrop-blur-md p-3 rounded-2xl border border-slate-700/50 shadow-md mb-4 flex items-center gap-2">
        <svg className="w-5 h-5 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
        </svg>
        <input 
          type="text" 
          placeholder="Buscar por cliente moroso, cédula o teléfono..." 
          className="bg-transparent w-full focus:outline-none text-sm text-white placeholder-slate-400"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      {/* 2. CUADRÍCULA DE MOROSOS (4 COLUMNAS POR FILA) */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
        {morosos.length > 0 ? morosos.map((c) => (
          <div 
            key={c.id}
            className="bg-[#112d59]/90 border border-red-500/40 p-3 rounded-2xl shadow-lg hover:border-red-500/70 transition-all duration-300 flex flex-col justify-between"
          >
            {/* DATOS DEL CLIENTE */}
            <div className="mb-2">
              <div className="flex items-center justify-between gap-1">
                <h3 className="font-black text-sm text-white truncate">{c.nombre}</h3>
                <span className="text-[9px] font-extrabold px-2 py-0.5 rounded-full bg-red-500/20 text-red-400 border border-red-500/30 shrink-0">
                  DEUDOR
                </span>
              </div>
              <p className="text-[10px] text-slate-400 mt-0.5 truncate flex items-center gap-1">
                🪪 {c.cedula} • 📞 {c.telefono}
              </p>
            </div>

            {/* DEUDA TOTAL */}
            <div className="bg-red-950/40 p-2 rounded-xl border border-red-500/30 mb-2.5 flex items-center justify-between">
              <span className="text-[10px] font-bold text-slate-400 uppercase">
                Deuda Total
              </span>
              <span className="text-lg font-black text-red-400">
                {formatCurrency(c.saldo_usd || 0)}
              </span>
            </div>

            {/* BOTÓN REGISTRAR ABONO */}
            <button 
              onClick={() => { setSelectedClient(c); setMontoAbonoUSD(String(c.saldo_usd)); setShowAbonoModal(true); }}
              className="w-full py-1.5 px-3 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold rounded-xl border border-emerald-500/50 transition-all shadow-md flex items-center justify-center gap-1.5"
            >
              <span>💵</span> Registrar Abono
            </button>
          </div>
        )) : (
          <div className="col-span-full flex flex-col items-center justify-center py-10 bg-[#112d59]/80 border border-slate-700/50 rounded-2xl shadow-md">
            <CheckCircle2 size={40} className="text-emerald-500 mb-2" />
            <h3 className="text-lg font-black text-white">No hay morosos pendientes</h3>
            <p className="text-slate-400 text-sm">Cartera de clientes 100% al día</p>
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
