import React, { useState, useEffect } from 'react';
import { 
  Calculator, 
  Plus, 
  Search, 
  FileText, 
  TrendingUp, 
  ArrowUpRight, 
  ArrowDownRight,
  ShieldCheck,
  CheckCircle2,
  X,
  Calendar
} from 'lucide-react';
import { cn, formatCurrency } from '../../lib/utils';
import { type CuentaContable, type Asiento } from '../../types';
import { motion, AnimatePresence } from 'motion/react';
import { subscribeToCollection, getLatestTasa } from '../../lib/dbUtils';

const AccountingScreen: React.FC = () => {
  const [sales, setSales] = useState<any[]>([]);
  const [clients, setClients] = useState<any[]>([]);
  const [movimientos, setMovimientos] = useState<any[]>([]);
  const [tasaBcv, setTasaBcv] = useState(40.50);
  const [searchTerm, setSearchTerm] = useState('');
  const [showAddAsiento, setShowAddAsiento] = useState(false);

  useEffect(() => {
    const unsubSales = subscribeToCollection('sales', (data) => setSales(data));
    const unsubClients = subscribeToCollection('clients', (data) => setClients(data));
    const unsubMov = subscribeToCollection('movimientos_productores', (data) => setMovimientos(data));
    getLatestTasa().then(rate => setTasaBcv(rate)).catch(() => {});

    return () => {
      unsubSales();
      unsubClients();
      unsubMov();
    };
  }, []);

  const PLAN_CUENTAS: CuentaContable[] = [
    { id: '1.1.01', codigo: '1.1.01', nombre: 'Caja Principal (USD)', tipo: 'Activo', naturaleza: 'Deudora', es_detalle: true },
    { id: '1.1.02', codigo: '1.1.02', nombre: 'Caja Auxiliar Bolívares', tipo: 'Activo', naturaleza: 'Deudora', es_detalle: true },
    { id: '1.1.03', codigo: '1.1.03', nombre: 'Cuentas por Cobrar Clientes', tipo: 'Activo', naturaleza: 'Deudora', es_detalle: true },
    { id: '2.1.01', codigo: '2.1.01', nombre: 'Cuentas por Pagar Productores', tipo: 'Pasivo', naturaleza: 'Acreedora', es_detalle: true },
    { id: '4.1.01', codigo: '4.1.01', nombre: 'Ventas de Queso / Mercancía', tipo: 'Ingreso', naturaleza: 'Acreedora', es_detalle: true },
    { id: '5.1.01', codigo: '5.1.01', nombre: 'Costo de Venta (Compra Queso)', tipo: 'Egreso', naturaleza: 'Deudora', es_detalle: true },
  ];

  // Derivar Asientos Contables en Tiempo Real
  const derivedAsientos: Asiento[] = [];

  // 1. Procesar Ventas y Abonos
  sales.forEach((sale) => {
    const details: any[] = [];
    const isAbono = sale.tipo_transaccion === 'abono' || sale.detalles?.[0]?.producto_id === 'abono';
    const rate = sale.tasa_momento || tasaBcv;

    if (isAbono) {
      const montoUsd = sale.monto_abono_usd || sale.total_usd || 0;
      const montoBs = parseFloat((montoUsd * rate).toFixed(2));
      const efectivoUsd = sale.pago_efectivo_usd || 0;
      const bsAmount = (sale.pago_efectivo_bs || 0) + (sale.pago_movil_bs || 0) + (sale.pago_transferencia_bs || 0);

      if (efectivoUsd > 0) {
        details.push({
          cuenta_id: '1.1.01',
          debe_usd: efectivoUsd,
          haber_usd: 0,
          debe_bs: parseFloat((efectivoUsd * rate).toFixed(2)),
          haber_bs: 0
        });
      }
      if (bsAmount > 0) {
        details.push({
          cuenta_id: '1.1.02',
          debe_usd: parseFloat((bsAmount / rate).toFixed(4)),
          haber_usd: 0,
          debe_bs: bsAmount,
          haber_bs: 0
        });
      }

      details.push({
        cuenta_id: '1.1.03',
        debe_usd: 0,
        haber_usd: montoUsd,
        debe_bs: 0,
        haber_bs: montoBs
      });

      derivedAsientos.push({
        id: `sale-${sale.id}`,
        fecha: sale.fecha,
        descripcion: `ABONO DE CLIENTE: ${sale.nombre_cliente} (Ref: ${sale.referencia || 'N/A'})`,
        tasa_referencia: rate,
        detalles: details
      });
    } else {
      const totalUsd = sale.total_usd || 0;
      const totalBs = parseFloat((totalUsd * rate).toFixed(2));
      const efectivoUsd = sale.pago_efectivo_usd || 0;
      const bsAmount = (sale.pago_efectivo_bs || 0) + (sale.pago_movil_bs || 0) + (sale.pago_transferencia_bs || 0) + (sale.biopago_bdv || 0) + (sale.pago_debito_bs || 0);
      const fiadoUsd = sale.es_fiado ? (sale.saldo_pendiente_usd || totalUsd) : 0;

      if (efectivoUsd > 0) {
        details.push({
          cuenta_id: '1.1.01',
          debe_usd: efectivoUsd,
          haber_usd: 0,
          debe_bs: parseFloat((efectivoUsd * rate).toFixed(2)),
          haber_bs: 0
        });
      }
      if (bsAmount > 0) {
        details.push({
          cuenta_id: '1.1.02',
          debe_usd: parseFloat((bsAmount / rate).toFixed(4)),
          haber_usd: 0,
          debe_bs: bsAmount,
          haber_bs: 0
        });
      }
      if (fiadoUsd > 0) {
        details.push({
          cuenta_id: '1.1.03',
          debe_usd: fiadoUsd,
          haber_usd: 0,
          debe_bs: parseFloat((fiadoUsd * rate).toFixed(2)),
          haber_bs: 0
        });
      }

      details.push({
        cuenta_id: '4.1.01',
        debe_usd: 0,
        haber_usd: totalUsd,
        debe_bs: 0,
        haber_bs: totalBs
      });

      derivedAsientos.push({
        id: `sale-${sale.id}`,
        fecha: sale.fecha,
        descripcion: `VENTA EN TIENDA / WEB: ${sale.nombre_cliente || 'Consumidor Final'}`,
        tasa_referencia: rate,
        detalles: details
      });
    }
  });

  // 2. Procesar Movimientos de Productores
  movimientos.forEach((mov) => {
    const details: any[] = [];
    const rate = tasaBcv;
    const montoUsd = mov.monto_usd || 0;
    const montoBs = parseFloat((montoUsd * rate).toFixed(2));
    const prod = clients.find(c => c.id === mov.proveedor_id);
    const prodName = prod ? prod.nombre : 'Productor';

    if (mov.tipo === 'ENTREGA_QUESO') {
      details.push({
        cuenta_id: '5.1.01',
        debe_usd: montoUsd,
        haber_usd: 0,
        debe_bs: montoBs,
        haber_bs: 0
      });
      details.push({
        cuenta_id: '2.1.01',
        debe_usd: 0,
        haber_usd: montoUsd,
        debe_bs: 0,
        haber_bs: montoBs
      });

      derivedAsientos.push({
        id: `mov-${mov.id}`,
        fecha: mov.fecha,
        descripcion: `COMPRA DE QUESO: ${prodName} (${mov.kilos || 0} Kg)`,
        tasa_referencia: rate,
        detalles: details
      });
    } else if (mov.tipo === 'PAGO' || mov.tipo === 'ANTICIPO') {
      details.push({
        cuenta_id: '2.1.01',
        debe_usd: montoUsd,
        haber_usd: 0,
        debe_bs: montoBs,
        haber_bs: 0
      });
      details.push({
        cuenta_id: '1.1.01',
        debe_usd: 0,
        haber_usd: montoUsd,
        debe_bs: 0,
        haber_bs: montoBs
      });

      derivedAsientos.push({
        id: `mov-${mov.id}`,
        fecha: mov.fecha,
        descripcion: `${mov.tipo === 'PAGO' ? 'LIQUIDACIÓN' : 'ANTICIPO'} A PRODUCTOR: ${prodName}`,
        tasa_referencia: rate,
        detalles: details
      });
    }
  });

  // Obtener balance exacto de cada cuenta contable
  const getAccountBalance = (cuentaId: string) => {
    let balance = 0;
    if (cuentaId === '1.1.01') {
      balance = 2450; // Caja USD inicial
    } else if (cuentaId === '1.1.02') {
      balance = 1200; // Caja Bs inicial equiv USD
    }

    derivedAsientos.forEach(asiento => {
      asiento.detalles.forEach(det => {
        if (det.cuenta_id === cuentaId) {
          if (cuentaId === '1.1.01' || cuentaId === '1.1.02' || cuentaId === '1.1.03' || cuentaId === '5.1.01') {
            balance += det.debe_usd;
            balance -= det.haber_usd;
          } else {
            balance += det.haber_usd;
            balance -= det.debe_usd;
          }
        }
      });
    });

    if (cuentaId === '1.1.03') {
      // Cuentas por cobrar en tiempo real
      return clients.filter(c => c.role !== 'productor' && (c.saldo_usd > 0)).reduce((sum, c) => sum + (c.saldo_usd || 0), 0);
    }
    if (cuentaId === '2.1.01') {
      // Cuentas por pagar a productores en tiempo real
      return clients.filter(c => c.role === 'productor').reduce((sum, c) => sum + (c.saldo_pendiente_usd || 0), 0);
    }

    return balance;
  };

  const activos = getAccountBalance('1.1.01') + getAccountBalance('1.1.02') + getAccountBalance('1.1.03');
  const pasivos = getAccountBalance('2.1.01');
  const patrimonio = activos - pasivos;

  // Filtrar Asientos del Libro Diario por término de búsqueda
  const filteredAsientos = derivedAsientos
    .filter(a => 
      a.descripcion.toLowerCase().includes(searchTerm.toLowerCase()) ||
      a.id.includes(searchTerm)
    )
    .sort((a, b) => new Date(b.fecha).getTime() - new Date(a.fecha).getTime());

  return (
    <div className="space-y-8 animate-in fade-in duration-700 pb-20">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div>
          <h1 className="text-3xl font-black text-white flex items-center gap-3">
            <Calculator className="text-[#2ecc71]" /> CONTABILIDAD GENERAL
          </h1>
          <p className="text-gray-400 text-sm">Libro diario integrado con ventas, cobros y libreta de productores</p>
        </div>
        <div className="flex gap-3">
          <div className="relative">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500" size={16} />
            <input 
              type="text"
              placeholder="Buscar asiento..."
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              className="bg-white/5 border border-white/10 rounded-2xl py-3 pl-10 pr-4 text-xs text-white placeholder-gray-500 outline-none focus:border-[#2ecc71] transition-all font-semibold"
            />
          </div>
          <button 
            onClick={() => setShowAddAsiento(true)}
            className="bg-[#2ecc71] hover:bg-[#27ae60] text-white font-black py-3 px-6 rounded-2xl shadow-lg shadow-green-500/20 transition-all flex items-center gap-2 text-xs uppercase tracking-widest active:scale-95"
          >
            <Plus size={16} /> Asiento Manual
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* Balance Resumido */}
        <div className="lg:col-span-4 space-y-6">
          <div className="bg-gradient-to-br from-[#2ecc71]/20 to-[#27ae60]/5 border border-[#2ecc71]/20 p-8 rounded-[2.5rem]">
            <div className="text-[10px] font-black text-[#2ecc71] uppercase tracking-[4px] mb-4">Balance en Tiempo Real</div>
            <div className="space-y-4">
              <div className="flex justify-between items-end border-b border-white/5 pb-4">
                <span className="text-sm font-bold text-gray-400">Activos Totales</span>
                <span className="text-2xl font-black text-white">{formatCurrency(activos)}</span>
              </div>
              <div className="flex justify-between items-end border-b border-white/5 pb-4">
                <span className="text-sm font-bold text-gray-400">Pasivos (Productores)</span>
                <span className="text-2xl font-black text-red-400">{formatCurrency(pasivos)}</span>
              </div>
              <div className="flex justify-between items-end pt-2">
                <span className="text-sm font-black text-[#2ecc71] uppercase">Patrimonio Neto</span>
                <span className="text-3xl font-black text-[#2ecc71]">{formatCurrency(patrimonio)}</span>
              </div>
            </div>
          </div>

          {/* Plan de Cuentas */}
          <div className="bg-white/5 border border-white/10 rounded-[2.5rem] p-8 space-y-6">
            <h3 className="text-lg font-bold flex items-center gap-2">
              <ArrowUpRight className="text-blue-400" size={20} /> Libro Mayor por Cuentas
            </h3>
            <div className="space-y-3">
              {PLAN_CUENTAS.map(c => {
                const bal = getAccountBalance(c.id);
                return (
                  <div key={c.id} className="flex items-center justify-between p-4 bg-black/20 rounded-2xl border border-white/5 hover:border-[#2ecc71]/30 transition-colors cursor-pointer group">
                    <div>
                      <div className="text-[10px] font-mono text-gray-500">{c.codigo}</div>
                      <div className="text-sm font-bold text-white group-hover:text-[#2ecc71] transition-colors">{c.nombre}</div>
                    </div>
                    <div className="text-right">
                      <div className="text-sm font-black text-white">{formatCurrency(bal)}</div>
                      <div className="text-[8px] text-gray-500 uppercase font-black">{c.naturaleza}</div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Libro Diario */}
        <div className="lg:col-span-8 space-y-6">
          <div className="bg-white/5 border border-white/10 rounded-[2.5rem] overflow-hidden">
            <div className="p-8 border-b border-white/5 flex items-center justify-between">
              <h3 className="text-lg font-bold flex items-center gap-2">
                <FileText className="text-orange-400" size={20} /> Libro Diario de Transacciones
              </h3>
              <span className="bg-white/5 px-3 py-1 rounded-full text-[9px] font-black text-[#2ecc71] border border-[#2ecc71]/20 uppercase">
                {filteredAsientos.length} Asientos
              </span>
            </div>
            
            <div className="p-6 space-y-6 overflow-y-auto max-h-[70vh] custom-scrollbar">
              {filteredAsientos.length === 0 ? (
                <div className="p-20 text-center space-y-4 opacity-30">
                  <div className="w-20 h-20 bg-white/5 rounded-full flex items-center justify-center mx-auto">
                    <FileText size={40} />
                  </div>
                  <p className="font-black uppercase tracking-[4px] text-xs">Sin movimientos contables</p>
                </div>
              ) : (
                filteredAsientos.map(asiento => (
                  <div key={asiento.id} className="bg-black/30 border border-white/5 rounded-3xl p-5 space-y-3">
                    <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 border-b border-white/5 pb-2">
                      <div>
                        <h4 className="text-xs font-black text-white uppercase">{asiento.descripcion}</h4>
                        <div className="text-[9px] text-gray-500 font-bold uppercase mt-0.5">
                          ID: {asiento.id.replace('sale-', '').replace('mov-', '').substring(0, 10)} • Tasa: {asiento.tasa_referencia.toFixed(2)} Bs
                        </div>
                      </div>
                      <div className="text-[10px] font-black text-gray-400 flex items-center gap-1.5 uppercase">
                        <Calendar size={12} /> {new Date(asiento.fecha).toLocaleDateString()} {new Date(asiento.fecha).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                      </div>
                    </div>

                    <div className="space-y-1.5">
                      {asiento.detalles.map((det, i) => {
                        const isDebit = det.debe_usd > 0;
                        const acc = PLAN_CUENTAS.find(c => c.id === det.cuenta_id);
                        return (
                          <div key={i} className={cn(
                            "grid grid-cols-12 text-[10px] font-bold py-1 px-2 rounded-lg items-center",
                            isDebit ? "bg-blue-500/5 text-blue-300" : "bg-red-500/5 text-red-300"
                          )}>
                            <div className={cn("col-span-6 truncate", !isDebit && "pl-6")}>
                              {acc ? `${acc.codigo} - ${acc.nombre}` : det.cuenta_id}
                            </div>
                            <div className="col-span-3 text-right">
                              {isDebit ? `$ ${det.debe_usd.toFixed(2)}` : ''}
                            </div>
                            <div className="col-span-3 text-right">
                              {!isDebit ? `$ ${det.haber_usd.toFixed(2)}` : ''}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Add Asiento Modal (Simplified) */}
      <AnimatePresence>
        {showAddAsiento && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/90 backdrop-blur-md">
            <motion.div 
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              className="bg-[#0f172a] border border-white/10 w-full max-w-md rounded-[3rem] p-8 shadow-2xl relative overflow-hidden text-white"
            >
              <div className="absolute top-0 left-0 w-full h-2 bg-[#2ecc71]"></div>
              
              <div className="flex justify-between items-center mb-6">
                <div>
                  <h3 className="text-xl font-black text-white uppercase tracking-tighter">Asiento Manual</h3>
                  <p className="text-[10px] text-gray-500 font-bold uppercase tracking-widest">En desarrollo administrativo</p>
                </div>
                <button onClick={() => setShowAddAsiento(false)} className="p-2 hover:bg-white/5 rounded-full text-gray-500 transition-colors">
                  <X size={20} />
                </button>
              </div>

              <div className="space-y-4 text-center py-6">
                <p className="text-xs text-gray-400 font-bold leading-relaxed">
                  Los asientos de ventas, cobros, entregas de queso y anticipos de productores se generan e integran **de forma 100% automática** en tiempo real al operar el POS y la libreta de productores.
                </p>
                <button 
                  onClick={() => setShowAddAsiento(false)}
                  className="w-full py-4 bg-[#2ecc71] hover:bg-[#27ae60] text-white font-black uppercase tracking-[3px] rounded-2xl shadow-xl transition-all mt-4 text-xs"
                >
                  Entendido
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default AccountingScreen;
