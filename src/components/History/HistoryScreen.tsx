import React, { useState } from 'react';
import { 
  Receipt, 
  Search, 
  Calendar, 
  ArrowRight, 
  CheckCircle, 
  Clock, 
  Filter,
  Download,
  Eye,
  Trash2
} from 'lucide-react';
import { cn, formatCurrency, exportToCSV, parseDate } from '../../lib/utils';
import { subscribeToCollection } from '../../lib/dbUtils';
import { type Sale } from '../../types';
import { motion } from 'motion/react';
import SaleDetailsModal from './SaleDetailsModal';
import { useLocation } from 'react-router-dom';
import { useToast } from '../../contexts/ToastProvider';
import { useAuth } from '../../contexts/AuthProvider';
import SupervisorCodeModal from '../common/SupervisorCodeModal';

const HistoryScreen: React.FC = () => {
  const location = useLocation();
  const [search, setSearch] = useState((location.state as any)?.searchQuery || '');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [sales, setSales] = useState<Sale[]>([]);
  const [selectedSale, setSelectedSale] = useState<Sale | null>(null);

  const [clients, setClients] = useState<any[]>([]);
  const [saleToDelete, setSaleToDelete] = useState<Sale | null>(null);
  const [isSuperModalOpen, setIsSuperModalOpen] = useState(false);
  const { addToast } = useToast();
  const { user } = useAuth();

  React.useEffect(() => {
    const unsubClients = subscribeToCollection('clients', (data) => setClients(data));
    const unsubSales = subscribeToCollection('sales', (data) => {
      // Sort by date descending
      const sorted = [...data].sort((a, b) => parseDate(b.createdAt || b.fecha).getTime() - parseDate(a.createdAt || a.fecha).getTime());
      setSales(sorted);
    });
    return () => {
      unsubClients();
      unsubSales();
    };
  }, []);

  const filteredSales = sales.filter(sale => {
    const saleDate = parseDate(sale.createdAt || sale.fecha);
    const matchesSearch = (sale.nombre_cliente || '').toLowerCase().includes(search.toLowerCase()) || (sale.id || '').toLowerCase().includes(search.toLowerCase());
    
    if (!matchesSearch) return false;
    if (dateFrom && saleDate < new Date(dateFrom)) return false;
    if (dateTo) {
      const endTo = new Date(dateTo);
      endTo.setHours(23, 59, 59, 999);
      if (saleDate > endTo) return false;
    }
    return true;
  });

  const handleExport = () => {
    const dataToExport = filteredSales.map(s => ({
      ID: s.id,
      Fecha: parseDate(s.createdAt || s.fecha).toLocaleString(),
      Cliente: s.nombre_cliente,
      Total_USD: s.total_usd,
      Tasa_BCV: s.tasa_momento,
      Total_Bs: s.total_usd * s.tasa_momento,
      Pagada: s.pagada ? 'Si' : 'No',
      Fiado: s.es_fiado ? 'Si' : 'No',
    }));
    exportToCSV(dataToExport, `Historial_Ventas_${new Date().toISOString().split('T')[0]}`);
  };

  const handleDeleteConfirm = async () => {
    if (!saleToDelete) return;
    const sale = saleToDelete;
    
    try {
      // 1. Revertir Stock
      if (sale.detalles && sale.detalles.length > 0) {
        for (const item of sale.detalles) {
          if (item.producto_id && item.producto_id !== 'abono') {
            await import('../../lib/dbUtils').then(m => m.updateStock(item.producto_id, -item.cantidad, `ANULACIÓN VENTA ${sale.id?.substring(0, 8)}`, user?.username || 'admin'));
          }
        }
      }

      // 2. Revertir Cliente (Saldo y Puntos)
      if (sale.cliente_id) {
        const client = clients.find(c => c.id === sale.cliente_id);
        if (client) {
          let saldoRevertido = client.saldo_usd || 0;
          let puntosRevertidos = client.puntos || 0;
          
          // Si era fiado y no estaba pagada completa, revertir la deuda
          if (sale.es_fiado && (sale as any).saldo_pendiente_usd > 0) {
            saldoRevertido = Math.max(0, saldoRevertido - (sale as any).saldo_pendiente_usd);
          }
          
          // Si fue un abono, devolvemos el saldo que se restó
          if ((sale as any).tipo_transaccion === 'abono' && (sale as any).monto_abono_usd) {
            saldoRevertido += parseFloat((sale as any).monto_abono_usd);
          }

          // Revertir puntos generados
          if (!((sale as any).tipo_transaccion === 'abono')) {
            puntosRevertidos = Math.max(0, puntosRevertidos - Math.round(sale.total_usd));
          }

          await import('../../lib/dbUtils').then(m => m.updateDocument('clients', client.id, {
            saldo_usd: parseFloat(saldoRevertido.toFixed(2)),
            puntos: puntosRevertidos
          }));
        }
      }
      
      // 3. Eliminar la Venta
      await import('../../lib/dbUtils').then(m => m.deleteDocument('sales', sale.id!));
      addToast('success', 'Venta eliminada y revertida exitosamente.');
    } catch (err) {
      console.error(err);
      addToast('error', 'Error al eliminar la venta.');
    } finally {
      setSaleToDelete(null);
    }
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-700">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div>
          <h1 className="text-3xl font-black text-white flex items-center gap-3">
            <Receipt className="text-[#3498db]" /> HISTORIAL DE VENTAS
          </h1>
          <p className="text-gray-400 text-sm">Registro permanente de todas las operaciones</p>
        </div>
        <div className="flex gap-2">
          <button onClick={handleExport} className="bg-white/5 hover:bg-white/10 text-gray-300 font-bold py-3 px-6 rounded-2xl border border-white/10 transition-all flex items-center gap-2 text-sm">
            <Download size={18} /> EXPORTAR EXCEL
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white/5 border border-white/10 p-6 rounded-[2.5rem] flex flex-wrap gap-4 items-end">
        <div className="flex-1 min-w-[200px] space-y-2">
          <label className="text-[10px] font-black text-gray-500 uppercase px-2 tracking-widest">Filtrar por Cliente o Venta</label>
          <div className="relative">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500" size={18} />
            <input 
              type="text" 
              placeholder="Nombre del cliente o ID..."
              className="w-full bg-black/20 border border-white/10 rounded-2xl py-3 pl-12 pr-4 focus:outline-none focus:border-[#3498db] text-sm"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
        </div>
        <div className="space-y-2 text-right">
          <label className="text-[10px] font-black text-gray-500 uppercase px-2 tracking-widest">Desde</label>
          <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} className="bg-black/20 border border-white/10 rounded-xl py-3 px-4 focus:outline-none text-sm" />
        </div>
        <div className="space-y-2 text-right">
          <label className="text-[10px] font-black text-gray-500 uppercase px-2 tracking-widest">Hasta</label>
          <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)} className="bg-black/20 border border-white/10 rounded-xl py-3 px-4 focus:outline-none text-sm" />
        </div>
        <button onClick={() => {}} className="bg-[#3498db] hover:bg-[#2980b9] text-white font-bold h-[46px] px-6 rounded-2xl transition-all flex items-center justify-center">
          <Filter size={18} />
        </button>
      </div>

      {/* Sales List */}
      <div className="space-y-4">
        {filteredSales.map((sale) => (
          <motion.div 
            key={sale.id}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="group bg-white/5 border border-white/10 rounded-3xl p-6 hover:bg-white/10 transition-all flex flex-col md:flex-row md:items-center justify-between gap-6 relative overflow-hidden"
          >
            {/* Payment Method Badge for background look */}
            <div className="absolute right-0 top-0 h-full w-1 bg-[#3498db]/40" />
            
            <div className="flex items-center gap-6 flex-1">
              <div className="w-16 h-16 rounded-2xl bg-white/5 flex flex-col items-center justify-center">
                 <span className="text-[10px] text-gray-500 font-black">ID</span>
                 <span className="text-[10px] font-black text-white truncate max-w-full px-2">{sale.id?.substring(0, 6)}</span>
              </div>
              
              <div className="space-y-1">
                <div className="flex items-center gap-3">
                  <h3 className="text-lg font-black text-white">{sale.nombre_cliente}</h3>
                  {sale.es_fiado ? (
                    <span className="bg-red-500/20 text-red-400 text-[9px] font-black uppercase px-2 py-0.5 rounded-full border border-red-500/20">Fiado</span>
                  ) : (
                    <span className="bg-green-500/20 text-green-400 text-[9px] font-black uppercase px-2 py-0.5 rounded-full border border-green-500/20 flex items-center gap-1">
                      <CheckCircle size={10} /> Pagado
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-4 text-xs font-bold text-gray-500 uppercase">
                  <span className="flex items-center gap-1"><Clock size={12} /> {parseDate(sale.createdAt || sale.fecha).toLocaleString()}</span>
                  <span className="text-blue-400">Tasa: Bs. {sale.tasa_momento}</span>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-8">
              <div className="text-right">
                <div className="text-[10px] text-gray-500 font-bold uppercase mb-1">Monto Total</div>
                <div className="text-2xl font-black text-[#2ecc71]">{formatCurrency(sale.total_usd)}</div>
                <div className="text-xs text-gray-500 font-bold">Bs. {(sale.total_usd * sale.tasa_momento).toLocaleString()}</div>
              </div>
              <div className="flex flex-col gap-2">
                <button 
                  onClick={() => setSelectedSale(sale)}
                  className="w-12 h-10 rounded-xl bg-white/5 hover:bg-[#3498db] transition-all flex items-center justify-center group/btn text-gray-400 hover:text-white border border-white/5"
                  title="Ver Detalles"
                >
                  <Eye size={18} className="group-hover/btn:scale-110 transition-transform" />
                </button>
                <button 
                  onClick={() => {
                    setSaleToDelete(sale);
                    setIsSuperModalOpen(true);
                  }}
                  className="w-12 h-10 rounded-xl bg-red-500/10 hover:bg-red-500 transition-all flex items-center justify-center group/btn text-red-400 hover:text-white border border-red-500/20"
                  title="Anular/Eliminar Venta"
                >
                  <Trash2 size={18} className="group-hover/btn:scale-110 transition-transform" />
                </button>
              </div>
            </div>
          </motion.div>
        ))}
      </div>

      <SaleDetailsModal 
        sale={selectedSale} 
        onClose={() => setSelectedSale(null)} 
      />

      <SupervisorCodeModal
        isOpen={isSuperModalOpen}
        onClose={() => {
          setIsSuperModalOpen(false);
          setSaleToDelete(null);
        }}
        onSuccess={() => {
          setIsSuperModalOpen(false);
          handleDeleteConfirm();
        }}
        actionName={`Anular Venta #${saleToDelete?.id?.substring(0, 8)}`}
      />
    </div>
  );
};

export default HistoryScreen;
