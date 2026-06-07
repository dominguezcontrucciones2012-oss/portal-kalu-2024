import React, { useState, useEffect } from 'react';
import { 
  Lock, 
  Unlock, 
  DollarSign, 
  ShieldCheck, 
  TrendingUp, 
  PieChart, 
  FileText,
  AlertTriangle,
  CheckCircle2,
  RefreshCw,
  Calendar
} from 'lucide-react';
import { formatCurrency, cn } from '../../lib/utils';
import { motion } from 'motion/react';
import { getTodaySales, getLatestTasa, saveClosure, getClosures } from '../../lib/dbUtils';
import { type Sale, type CierreCaja } from '../../types';
import { useToast } from '../../contexts/ToastProvider';

const ClosureScreen: React.FC = () => {
  const { addToast } = useToast();
  const [isClosed, setIsClosed] = useState(false);
  const [loading, setLoading] = useState(true);
  const [tasaCierre, setTasaCierre] = useState(40.50);
  const [sales, setSales] = useState<Sale[]>([]);
  const [pastClosures, setPastClosures] = useState<CierreCaja[]>([]);
  const [expandedClosureId, setExpandedClosureId] = useState<string | null>(null);
  
  const [physicalData, setPhysicalData] = useState({
    monto_real_usd: 0,
    monto_real_bs: 0,
    observaciones: ''
  });

  const fetchData = async () => {
    setLoading(true);
    try {
      const todaySales = await getTodaySales();
      const rate = await getLatestTasa();
      const history = await getClosures();
      setSales(todaySales as Sale[]);
      setTasaCierre(rate);
      setPastClosures(history as CierreCaja[]);
      
      // Verificar si ya existe un cierre de caja para el día de hoy
      const todayStr = new Date().toISOString().split('T')[0];
      const hasTodayClosure = history.some((c: any) => c.fecha === todayStr);
      setIsClosed(hasTodayClosure);
    } catch (err) {
      console.error("Error fetching closure data:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const totals = sales.reduce((acc, sale) => {
    acc.usd_cash += sale.pago_efectivo_usd || 0;
    acc.vueltos += sale.vuelto_entregado_usd || 0;
    acc.bs_cash += sale.pago_efectivo_bs || 0;
    acc.pago_movil += sale.pago_movil_bs || 0;
    acc.biopago += sale.biopago_bdv || 0;
    acc.debito += sale.pago_debito_bs || 0;
    acc.total_usd += sale.total_usd || 0;
    acc.fiado += sale.saldo_pendiente_usd || 0;
    return acc;
  }, { usd_cash: 0, vueltos: 0, bs_cash: 0, pago_movil: 0, biopago: 0, debito: 0, total_usd: 0, fiado: 0 });

  // El efectivo esperado es: Lo que entró - Lo que salió como vuelto
  const expectedUSDCash = totals.usd_cash - totals.vueltos;
  const expectedBsCash = totals.bs_cash;
  
  const differenceUSD = (physicalData.monto_real_usd || 0) - expectedUSDCash;
  const differenceBS = (physicalData.monto_real_bs || 0) - expectedBsCash;

  const handleFinalize = async () => {
    setLoading(true);
    try {
      const closure: Omit<CierreCaja, 'id'> = {
        fecha: new Date().toISOString().split('T')[0],
        monto_bs: expectedBsCash,
        monto_usd: expectedUSDCash,
        pago_movil: totals.pago_movil,
        transferencia: totals.pago_movil, // Se puede separar si hay campo
        biopago: totals.biopago,
        tarjeta_debito: totals.debito,
        tasa_cierre: tasaCierre,
        total_ventas_usd: totals.total_usd,
        total_compras_usd: 0,
        fiado_dia_usd: totals.fiado,
        monto_real_usd: physicalData.monto_real_usd,
        monto_real_bs: physicalData.monto_real_bs,
        diferencia_usd: differenceUSD,
        diferencia_bs: differenceBS,
        observaciones: `Vueltos entregados: $${totals.vueltos.toFixed(2)}. ${physicalData.observaciones}`,
        cajero_nombre: 'Administrador Principal', 
        monto_apertura_usd: 0,
        monto_apertura_bs: 0
      };
      
      await saveClosure(closure);
      setIsClosed(true);
      addToast('success', 'Cierre de Caja Procesado Exitosamente');
      fetchData(); // Refresh history
    } catch (err) {
      console.error("Error saving closure:", err);
    } finally {
      setLoading(false);
    }
  };

  if (loading && sales.length === 0 && pastClosures.length === 0) {
    return (
      <div className="h-full flex items-center justify-center">
        <RefreshCw className="animate-spin text-blue-400" size={48} />
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto space-y-8 animate-in fade-in duration-700 pb-20">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div>
          <h1 className="text-3xl font-black text-white flex items-center gap-3">
            <Lock className="text-[#e74c3c]" /> CIERRE DE CAJA DIARIO
          </h1>
          <p className="text-gray-400 text-sm">Conciliación de saldos y declaración de efectivo físico</p>
        </div>
        <div className="flex items-center gap-4">
          <button onClick={fetchData} className="p-3 bg-white/5 hover:bg-white/10 rounded-2xl transition-all">
            <RefreshCw size={18} className={loading ? 'animate-spin' : ''} />
          </button>
          {isClosed ? (
            <span key="caja-cerrada" className="bg-green-500/20 text-green-400 text-xs font-black uppercase px-6 py-3 rounded-2xl border border-green-500/20 flex items-center gap-2">
              <CheckCircle2 size={18} /> Caja Cerrada
            </span>
          ) : (
            <span key="caja-abierta" className="bg-yellow-500/20 text-yellow-400 text-xs font-black uppercase px-6 py-3 rounded-2xl border border-yellow-500/20 flex items-center gap-2">
              <Unlock size={18} /> Caja Abierta
            </span>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        {/* Expected Balances (System) */}
        <div className="bg-white/5 border border-white/10 rounded-[2.5rem] p-8 h-fit animate-in fade-in duration-500">
          <h3 className="text-lg font-bold mb-6 flex items-center gap-2">
            <FileText className="text-blue-400" size={20} /> Saldo en Sistema
          </h3>
          <div className="space-y-4">
             <div className="flex justify-between items-center p-4 bg-black/20 rounded-2xl border border-white/5">
               <div>
                 <span className="text-xs font-bold text-gray-400">Efectivo USD (Neto)</span>
                 <p className="text-[9px] text-gray-500 uppercase font-black">Cobros - Vueltos</p>
               </div>
               <span className="text-xl font-black text-green-400">{formatCurrency(expectedUSDCash)}</span>
             </div>
             
             <div className="grid grid-cols-2 gap-3">
               <div className="p-3 bg-black/20 rounded-2xl border border-white/5">
                 <span className="text-[9px] font-black text-gray-500 uppercase block mb-1">Efectivo Bs</span>
                 <span className="text-sm font-bold text-white">{formatCurrency(expectedBsCash, 'Bs')}</span>
               </div>
               <div className="p-3 bg-black/20 rounded-2xl border border-white/5">
                 <span className="text-[9px] font-black text-gray-500 uppercase block mb-1">Pago Móvil</span>
                 <span className="text-sm font-bold text-white">{formatCurrency(totals.pago_movil, 'Bs')}</span>
               </div>
               <div className="p-3 bg-black/20 rounded-2xl border border-white/5">
                 <span className="text-[9px] font-black text-gray-500 uppercase block mb-1">Biopago</span>
                 <span className="text-sm font-bold text-white">{formatCurrency(totals.biopago, 'Bs')}</span>
               </div>
               <div className="p-3 bg-black/20 rounded-2xl border border-white/5">
                 <span className="text-[9px] font-black text-gray-500 uppercase block mb-1">Tarjeta</span>
                 <span className="text-sm font-bold text-white">{formatCurrency(totals.debito, 'Bs')}</span>
               </div>
             </div>

             <div className="p-4 bg-red-500/10 rounded-2xl border border-red-500/20 flex justify-between items-center">
               <span className="text-[10px] font-black text-red-400 uppercase tracking-widest">Total Vueltos Dados</span>
               <span className="text-lg font-black text-red-400">-{formatCurrency(totals.vueltos)}</span>
             </div>

             <div className="flex justify-between items-center p-4 bg-[#3498db]/10 rounded-2xl border border-[#3498db]/20">
               <span className="text-sm font-black text-blue-400 uppercase tracking-widest">Ventas Totales USD</span>
               <span className="text-2xl font-black text-blue-400">{formatCurrency(totals.total_usd)}</span>
             </div>
          </div>
        </div>

        {/* Declaration (Manual) */}
        <div className="bg-white/5 border border-white/10 rounded-[2.5rem] p-8 space-y-6 animate-in fade-in duration-500">
          <h3 className="text-lg font-bold flex items-center gap-2">
            <AlertTriangle className="text-yellow-500" size={20} /> Declaración Física
          </h3>
          
          <div className="space-y-4">
            <div className="space-y-2">
              <label className="text-[10px] font-black uppercase text-gray-500 tracking-widest px-2">Efectivo Dólares Contado</label>
              <input 
                type="number" 
                placeholder="0.00" 
                className="w-full bg-black/30 border border-white/10 rounded-2xl py-4 px-6 text-xl font-black focus:border-[#e74c3c] outline-none transition-all placeholder:text-gray-800"
                value={physicalData.monto_real_usd || ''}
                onChange={(e) => setPhysicalData({...physicalData, monto_real_usd: parseFloat(e.target.value) || 0})}
              />
            </div>
            <div className="space-y-2">
              <label className="text-[10px] font-black uppercase text-gray-500 tracking-widest px-2">Efectivo Bolívares Contado</label>
              <input 
                type="number" 
                placeholder="0.00" 
                className="w-full bg-black/30 border border-white/10 rounded-2xl py-4 px-6 text-xl font-black focus:border-[#e74c3c] outline-none transition-all placeholder:text-gray-800"
                value={physicalData.monto_real_bs || ''}
                onChange={(e) => setPhysicalData({...physicalData, monto_real_bs: parseFloat(e.target.value) || 0})}
              />
            </div>
            <div className="space-y-2">
              <label className="text-[10px] font-black uppercase text-gray-500 tracking-widest px-2">Observaciones / Diferencias</label>
              <textarea 
                placeholder="Ej: Billete de 5$ dañado..." 
                rows={3} 
                className="w-full bg-black/30 border border-white/10 rounded-2xl py-4 px-6 text-sm font-bold focus:border-[#3498db] outline-none transition-all"
                value={physicalData.observaciones}
                onChange={(e) => setPhysicalData({...physicalData, observaciones: e.target.value})}
              />
            </div>
          </div>

          <button 
            onClick={handleFinalize}
            disabled={isClosed || loading}
            className="w-full py-5 bg-[#e74c3c] hover:bg-[#c0392b] text-white font-black uppercase tracking-[4px] rounded-2xl shadow-xl shadow-red-500/10 transition-all active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? 'Procesando...' : 'Finalizar y Cerrar Caja'}
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white/5 border border-white/10 p-6 rounded-3xl text-center">
          <div className="text-[10px] font-black text-gray-500 uppercase tracking-widest mb-1">Diferencia USD</div>
          <div className={cn("text-2xl font-black", differenceUSD === 0 ? "text-gray-400" : differenceUSD > 0 ? "text-green-400" : "text-red-400")}>
            {differenceUSD > 0 ? '+' : ''}{differenceUSD.toFixed(2)}
          </div>
        </div>
        <div className="bg-white/5 border border-white/10 p-6 rounded-3xl text-center">
          <div className="text-[10px] font-black text-gray-500 uppercase tracking-widest mb-1">Diferencia BS</div>
          <div className={cn("text-2xl font-black", differenceBS === 0 ? "text-gray-400" : differenceBS > 0 ? "text-green-400" : "text-red-400")}>
            {differenceBS > 0 ? '+' : ''}{differenceBS.toFixed(2)}
          </div>
        </div>
        <div className="bg-white/5 border border-white/10 p-6 rounded-3xl text-center">
          <div className="text-[10px] font-black text-gray-500 uppercase tracking-widest mb-1">Tasa de Cierre</div>
          <div className="text-2xl font-black text-blue-400">{tasaCierre.toFixed(2)}</div>
        </div>
      </div>

      {/* Historial de Cierres */}
      <div className="space-y-6">
        <h3 className="text-xl font-black text-white flex items-center gap-3">
          <TrendingUp className="text-blue-400" /> HISTORIAL DE AUDITORÍA
        </h3>
        <div className="grid grid-cols-1 gap-4">
          {pastClosures.length === 0 ? (
            <div className="p-10 border border-dashed border-white/10 rounded-[2rem] text-center text-gray-600 font-bold uppercase text-xs tracking-widest">
              No hay cierres registrados
            </div>
          ) : (
            [...pastClosures].sort((a,b) => (b.fecha || '').localeCompare(a.fecha || '')).map((c, idx) => {
              const itemKey = c.id || idx.toString();
              const isExpanded = expandedClosureId === itemKey;
              return (
                <div 
                  key={itemKey} 
                  className="bg-white/5 border border-white/10 rounded-3xl overflow-hidden hover:bg-white/10 transition-all cursor-pointer"
                  onClick={() => setExpandedClosureId(isExpanded ? null : itemKey)}
                >
                  <div className="p-6 flex flex-wrap items-center justify-between gap-6">
                    <div className="flex items-center gap-4">
                       <div className="w-12 h-12 bg-white/5 rounded-2xl flex items-center justify-center text-gray-400">
                         <Calendar size={20} />
                       </div>
                       <div>
                         <div className="font-black text-white">{c.fecha}</div>
                         <div className="text-[10px] text-gray-500 font-bold uppercase tracking-widest">Auditado por: {c.cajero_nombre}</div>
                       </div>
                    </div>
                    
                    <div className="flex items-center gap-8">
                      <div className="text-right">
                        <div className="text-[10px] text-gray-500 font-bold uppercase mb-1">Ventas Totales</div>
                        <div className="text-lg font-black text-blue-400">{formatCurrency(c.total_ventas_usd ?? 0)}</div>
                      </div>
                      <div className="text-right">
                        <div className="text-[10px] text-gray-500 font-bold uppercase mb-1">Efectivo Real</div>
                        <div className="text-lg font-black text-green-400">{formatCurrency(c.monto_real_usd ?? 0)}</div>
                      </div>
                      <div className="text-right">
                        <div className="text-[10px] text-gray-500 font-bold uppercase mb-1">Diferencia</div>
                        <div className={cn("text-lg font-black", (c.diferencia_usd ?? 0) === 0 ? "text-gray-400" : (c.diferencia_usd ?? 0) > 0 ? "text-green-400" : "text-red-400")}>
                          {(c.diferencia_usd ?? 0) > 0 ? '+' : ''}{(c.diferencia_usd ?? 0).toFixed(2)}
                        </div>
                      </div>
                    </div>
                  </div>
                  
                  {isExpanded && (
                    <div className="px-6 pb-6 pt-2 border-t border-white/5 bg-black/20 grid grid-cols-1 md:grid-cols-2 gap-6 animate-in fade-in duration-300">
                      <div className="space-y-3">
                        <h4 className="text-[10px] font-black text-blue-400 uppercase tracking-widest">Detalle de Conciliación</h4>
                        <div className="grid grid-cols-2 gap-3 text-xs">
                          <div className="p-3 bg-black/30 rounded-xl">
                            <span className="text-gray-500 block text-[9px] font-bold uppercase mb-1">Efectivo USD Esperado</span>
                            <span className="font-bold text-white">{formatCurrency(c.monto_usd ?? 0)}</span>
                          </div>
                          <div className="p-3 bg-black/30 rounded-xl">
                            <span className="text-gray-500 block text-[9px] font-bold uppercase mb-1">Efectivo USD Real</span>
                            <span className="font-bold text-green-400">{formatCurrency(c.monto_real_usd ?? 0)}</span>
                          </div>
                          <div className="p-3 bg-black/30 rounded-xl">
                            <span className="text-gray-500 block text-[9px] font-bold uppercase mb-1">Efectivo Bs Esperado</span>
                            <span className="font-bold text-white">{formatCurrency(c.monto_bs ?? 0, 'Bs')}</span>
                          </div>
                          <div className="p-3 bg-black/30 rounded-xl">
                            <span className="text-gray-500 block text-[9px] font-bold uppercase mb-1">Efectivo Bs Real</span>
                            <span className="font-bold text-blue-400">{formatCurrency(c.monto_real_bs ?? 0, 'Bs')}</span>
                          </div>
                        </div>
                      </div>
                      
                      <div className="space-y-3">
                        <h4 className="text-[10px] font-black text-purple-400 uppercase tracking-widest">Otros Métodos & Info</h4>
                        <div className="grid grid-cols-2 gap-3 text-xs">
                          <div className="p-3 bg-black/30 rounded-xl">
                            <span className="text-gray-500 block text-[9px] font-bold uppercase mb-1">Pago Móvil</span>
                            <span className="font-bold text-white">{formatCurrency(c.pago_movil ?? 0, 'Bs')}</span>
                          </div>
                          <div className="p-3 bg-black/30 rounded-xl">
                            <span className="text-gray-500 block text-[9px] font-bold uppercase mb-1">Biopago BDV</span>
                            <span className="font-bold text-white">{formatCurrency(c.biopago ?? 0, 'Bs')}</span>
                          </div>
                          <div className="p-3 bg-black/30 rounded-xl">
                            <span className="text-gray-500 block text-[9px] font-bold uppercase mb-1">Tarjeta Débito</span>
                            <span className="font-bold text-white">{formatCurrency(c.tarjeta_debito ?? 0, 'Bs')}</span>
                          </div>
                          <div className="p-3 bg-black/30 rounded-xl">
                            <span className="text-gray-500 block text-[9px] font-bold uppercase mb-1">Tasa Aplicada</span>
                            <span className="font-bold text-yellow-500">{c.tasa_cierre ? c.tasa_cierre.toFixed(2) : '40.50'} BS/USD</span>
                          </div>
                        </div>
                      </div>

                      {c.observaciones && (
                        <div className="md:col-span-2 p-3 bg-black/30 rounded-xl text-xs">
                          <span className="text-gray-500 block text-[9px] font-bold uppercase mb-1">Observaciones</span>
                          <p className="text-gray-300 font-medium">{c.observaciones}</p>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      </div>

      <div className="bg-white/5 border border-white/10 p-8 rounded-[2.5rem] flex items-center gap-6">
        <div className="p-4 bg-[#3498db]/20 text-[#3498db] rounded-3xl shrink-0">
          <ShieldCheck size={32} />
        </div>
        <div>
          <h4 className="font-bold text-white mb-2">Protocolo de Cierre Seguro</h4>
          <p className="text-sm text-gray-500 max-w-2xl leading-relaxed font-medium">
            Al realizar el cierre, se generará un reporte inmutable. 
            El inventario se ajustará automáticamente y se bloquearán nuevas ventas hasta la apertura del próximo turno.
          </p>
        </div>
      </div>
    </div>
  );
};

export default ClosureScreen;
