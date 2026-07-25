import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, Receipt, User, Calendar, CreditCard, ShoppingBag, ArrowRight } from 'lucide-react';
import { type Sale } from '../../types';
import { formatCurrency, cn, parseDate } from '../../lib/utils';

interface SaleDetailsModalProps {
  sale: Sale | null;
  onClose: () => void;
}

const SaleDetailsModal: React.FC<SaleDetailsModalProps> = ({ sale, onClose }) => {
  if (!sale) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
        <motion.div 
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
          className="absolute inset-0 bg-[#0f172a]/80 backdrop-blur-sm"
        />
        
        <motion.div 
          initial={{ opacity: 0, scale: 0.9, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.9, y: 20 }}
          className="relative w-full max-w-2xl bg-[#1e293b] border border-white/10 rounded-[2.5rem] shadow-2xl overflow-hidden overflow-y-auto max-h-[90vh] custom-scrollbar"
        >
          {/* Header */}
          <div className="p-8 border-b border-white/5 bg-black/20 flex justify-between items-center sticky top-0 bg-[#1e293b] z-10">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-blue-500/10 rounded-2xl">
                <Receipt className="text-blue-400" size={24} />
              </div>
              <div>
                <h2 className="text-xl font-black text-white uppercase tracking-tight">Detalle de Venta</h2>
                <p className="text-[10px] text-gray-500 font-black uppercase tracking-widest">ID: {sale.id}</p>
              </div>
            </div>
            <button 
              onClick={onClose}
              className="p-2 hover:bg-white/5 rounded-full text-gray-500 hover:text-white transition-colors"
            >
              <X size={24} />
            </button>
          </div>

          <div className="p-8 space-y-8">
            {/* Info Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="bg-white/5 p-5 rounded-3xl border border-white/5">
                <div className="flex items-center gap-3 mb-3">
                  <User className="text-gray-500" size={16} />
                  <span className="text-[10px] font-black text-gray-500 uppercase tracking-widest">Cliente</span>
                </div>
                <p className="font-black text-white uppercase">{sale.nombre_cliente}</p>
                <p className="text-xs text-blue-400 font-bold">{sale.es_fiado ? 'Venta a Crédito' : 'Venta de Contado'}</p>
              </div>
              <div className="bg-white/5 p-5 rounded-3xl border border-white/5">
                <div className="flex items-center gap-3 mb-3">
                  <Calendar className="text-gray-500" size={16} />
                  <span className="text-[10px] font-black text-gray-500 uppercase tracking-widest">Fecha y Tasa</span>
                </div>
                <p className="font-black text-white uppercase">{parseDate(sale.createdAt || sale.fecha).toLocaleString()}</p>
                <p className="text-xs text-gray-500 font-bold">Tasa: Bs. {sale.tasa_momento.toFixed(2)}</p>
              </div>
            </div>

            {/* Product List */}
            <div className="space-y-4">
              <div className="flex items-center gap-3 px-2">
                <ShoppingBag className="text-gray-500" size={16} />
                <span className="text-[10px] font-black text-gray-500 uppercase tracking-widest">Productos</span>
              </div>
              <div className="bg-black/20 rounded-[2rem] border border-white/5 overflow-hidden">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-[9px] text-gray-600 uppercase tracking-widest border-b border-white/5">
                      <th className="p-4 text-left">Producto</th>
                      <th className="p-4 text-center">Cant.</th>
                      <th className="p-4 text-right">Precio</th>
                      <th className="p-4 text-right">Total</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5">
                    {sale.detalles.map((item, idx) => (
                      <tr key={idx} className="group hover:bg-white/5 transition-colors">
                        <td className="p-4">
                          <span className="font-bold text-white uppercase text-xs">{item.nombre}</span>
                        </td>
                        <td className="p-4 text-center">
                          <span className="font-black text-blue-400">{item.cantidad}</span>
                        </td>
                        <td className="p-4 text-right text-gray-400 font-medium">
                          {formatCurrency(item.precio_unitario_usd)}
                        </td>
                        <td className="p-4 text-right font-black text-white">
                          {formatCurrency(item.precio_unitario_usd * item.cantidad)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Payment Summary */}
            <div className="bg-gradient-to-br from-blue-600/10 to-blue-500/5 p-8 rounded-[2.5rem] border border-blue-500/10">
              <div className="flex flex-wrap justify-between items-end gap-6">
                <div className="space-y-4 flex-1 min-w-[200px]">
                  <div className="flex items-center gap-3">
                    <CreditCard className="text-blue-400" size={18} />
                    <span className="text-[10px] font-black text-blue-400 uppercase tracking-widest">Resumen de Pago</span>
                  </div>
                  
                  <div className="space-y-2">
                    {sale.pago_efectivo_usd > 0 && (
                      <div className="flex justify-between text-xs">
                        <span className="text-gray-500 font-bold uppercase">Efectivo USD</span>
                        <span className="text-white font-black">{formatCurrency(sale.pago_efectivo_usd)}</span>
                      </div>
                    )}
                    {sale.pago_efectivo_bs > 0 && (
                      <div className="flex justify-between text-xs">
                        <span className="text-gray-500 font-bold uppercase">Efectivo Bs</span>
                        <span className="text-white font-black">{formatCurrency(sale.pago_efectivo_bs, 'Bs')}</span>
                      </div>
                    )}
                    {sale.pago_movil_bs > 0 && (
                      <div className="flex justify-between text-xs">
                        <span className="text-gray-500 font-bold uppercase">Pago Móvil</span>
                        <span className="text-white font-black">{formatCurrency(sale.pago_movil_bs, 'Bs')}</span>
                      </div>
                    )}
                    {sale.biopago_bdv > 0 && (
                      <div className="flex justify-between text-xs">
                        <span className="text-gray-500 font-bold uppercase">Biopago</span>
                        <span className="text-white font-black">{formatCurrency(sale.biopago_bdv, 'Bs')}</span>
                      </div>
                    )}
                    {sale.pago_debito_bs > 0 && (
                      <div className="flex justify-between text-xs">
                        <span className="text-gray-500 font-bold uppercase">Débito</span>
                        <span className="text-white font-black">{formatCurrency(sale.pago_debito_bs, 'Bs')}</span>
                      </div>
                    )}
                    {sale.vuelto_entregado_usd > 0 && (
                      <div className="flex justify-between text-xs border-t border-white/5 pt-2">
                        <span className="text-red-400 font-bold uppercase">Vuelto Entregado</span>
                        <span className="text-red-400 font-black">-{formatCurrency(sale.vuelto_entregado_usd)}</span>
                      </div>
                    )}
                  </div>
                </div>

                <div className="text-right">
                  <span className="text-[10px] font-black text-gray-500 uppercase tracking-[4px] block mb-1">Total Final</span>
                  <div className="text-5xl font-black text-[#2ecc71] tracking-tighter">
                    {formatCurrency(sale.total_usd)}
                  </div>
                  <div className="text-sm font-bold text-gray-500 uppercase tracking-widest mt-1">
                    Bs. {(sale.total_usd * sale.tasa_momento).toLocaleString('es-VE', { minimumFractionDigits: 2 })}
                  </div>
                </div>
              </div>
            </div>

            {sale.es_fiado && sale.saldo_pendiente_usd > 0 && (
              <div className="p-6 bg-red-500/10 border border-red-500/20 rounded-[2rem] flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className="p-3 bg-red-500/20 rounded-2xl text-red-400">
                    <ArrowRight size={20} />
                  </div>
                  <div>
                    <p className="text-[10px] font-black text-red-500 uppercase tracking-widest leading-none mb-1">Saldo Pendiente</p>
                    <p className="text-xl font-black text-red-400 leading-none">{formatCurrency(sale.saldo_pendiente_usd)}</p>
                  </div>
                </div>
                <span className="bg-red-500 text-white text-[10px] font-black uppercase px-4 py-2 rounded-xl">POR COBRAR</span>
              </div>
            )}
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};

export default SaleDetailsModal;
