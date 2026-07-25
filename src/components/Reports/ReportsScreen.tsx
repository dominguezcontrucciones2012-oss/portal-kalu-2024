import React, { useState, useEffect, useMemo } from 'react';
import { motion } from 'motion/react';
import { 
  BarChart2, 
  TrendingUp, 
  ArrowUp, 
  ArrowDown, 
  PieChart, 
  Download,
  Calendar,
  Layers,
  Zap
} from 'lucide-react';
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer
} from 'recharts';
import { formatCurrency } from '../../lib/utils';
import { subscribeToCollection } from '../../lib/dbUtils';

const COLORS = ['#3498db', '#f1c40f', '#e74c3c', '#9b59b6', '#2ecc71', '#e67e22'];

const ReportsScreen: React.FC = () => {
  const [sales, setSales] = useState<any[]>([]);
  const [compras, setCompras] = useState<any[]>([]);
  const [gastos, setGastos] = useState<any[]>([]);
  const [movimientos, setMovimientos] = useState<any[]>([]);
  const [filter, setFilter] = useState('Mes Actual');

  useEffect(() => {
    const unsubSales = subscribeToCollection('sales', setSales);
    const unsubCompras = subscribeToCollection('compras_mercancia', setCompras);
    const unsubGastos = subscribeToCollection('gastos', setGastos);
    const unsubMovs = subscribeToCollection('movimientos_productores', setMovimientos);

    return () => {
      unsubSales(); unsubCompras(); unsubGastos(); unsubMovs();
    };
  }, []);

  const { profitData, categoryData, kpis } = useMemo(() => {
    // 1. Filtrar por fecha
    const now = new Date();
    let startDate = new Date(0); // Todo el tiempo
    
    if (filter === 'Mes Actual') {
      startDate = new Date(now.getFullYear(), now.getMonth(), 1);
    } else if (filter === 'Últimos 30 días') {
      startDate = new Date(now.getTime() - (30 * 24 * 60 * 60 * 1000));
    } else if (filter === 'Año 2026') {
      startDate = new Date(2026, 0, 1);
    }

    const validSales = sales.filter(s => new Date(s.fecha || s.createdAt) >= startDate);
    const validCompras = compras.filter(c => new Date(c.fecha || c.createdAt) >= startDate);
    const validGastos = gastos.filter(g => new Date(g.fecha || g.createdAt) >= startDate);
    const validMovs = movimientos.filter(m => new Date(m.fecha || m.createdAt) >= startDate && m.tipo === 'ENTREGA_QUESO');

    // 2. Calcular KPIs
    const ingresosBrutos = validSales.reduce((acc, s) => acc + (s.total_usd || 0), 0);
    const costoQueso = validMovs.reduce((acc, m) => acc + (m.monto_usd || 0), 0);
    const costoMercancia = validCompras.reduce((acc, c) => acc + (c.total_usd || 0), 0);
    const totalGastos = validGastos.reduce((acc, g) => acc + (g.monto_usd || 0), 0);
    
    const totalEgresos = costoQueso + costoMercancia + totalGastos;
    const utilidadNeta = ingresosBrutos - totalEgresos;
    const margen = ingresosBrutos > 0 ? (utilidadNeta / ingresosBrutos) * 100 : 0;

    // 3. Agrupar Flujo de Caja por Mes
    const months = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
    const flowMap = new Map<string, { income: number, expense: number }>();
    
    validSales.forEach(s => {
      const m = months[new Date(s.fecha || s.createdAt).getMonth()];
      const curr = flowMap.get(m) || { income: 0, expense: 0 };
      curr.income += s.total_usd || 0;
      flowMap.set(m, curr);
    });

    const addExpense = (item: any, amt: number) => {
      const m = months[new Date(item.fecha || item.createdAt).getMonth()];
      const curr = flowMap.get(m) || { income: 0, expense: 0 };
      curr.expense += amt;
      flowMap.set(m, curr);
    };

    validCompras.forEach(c => addExpense(c, c.total_usd || 0));
    validMovs.forEach(m => addExpense(m, m.monto_usd || 0));
    validGastos.forEach(g => addExpense(g, g.monto_usd || 0));

    const profitData = Array.from(flowMap.entries()).map(([month, data]) => ({
      month,
      income: data.income,
      expense: data.expense,
      profit: data.income - data.expense
    })).sort((a, b) => months.indexOf(a.month) - months.indexOf(b.month));

    // 4. Categorías más vendidas (aproximación por ventas)
    const catMap = new Map<string, number>();
    validSales.forEach(s => {
      (s.detalles || []).forEach((d: any) => {
        let cat = (d.nombre || '').toUpperCase().includes('QUESO') ? 'Queso' : 'Víveres';
        const nombre = (d.nombre || '').toUpperCase();
        if (nombre.includes('ACEITE') || nombre.includes('HARINA') || nombre.includes('ARROZ') || nombre.includes('PASTA') || nombre.includes('AZUCAR') || nombre.includes('CAFE') || nombre.includes('MAYONESA')) cat = 'Víveres Básicos';
        if (nombre.includes('BOMBILLO') || nombre.includes('TORNILLO') || nombre.includes('CLAVO') || nombre.includes('CEMENTO') || nombre.includes('PINTURA')) cat = 'Ferretería';
        if (nombre.includes('BUJIA') || nombre.includes('ACEITE MOTOR') || nombre.includes('FILTRO') || nombre.includes('LIGA') || nombre.includes('TRIPA')) cat = 'Repuestos';
        if (nombre.includes('REFRESCO') || nombre.includes('COCA') || nombre.includes('PEPSI') || nombre.includes('JUGO') || nombre.includes('AGUA')) cat = 'Bebidas';
        
        const lineTotal = d.cantidad * d.precio_unitario_usd;
        catMap.set(cat, (catMap.get(cat) || 0) + lineTotal);
      });
    });

    const totalVendido = Array.from(catMap.values()).reduce((a, b) => a + b, 0);
    const categoryData = Array.from(catMap.entries())
      .map(([name, value], i) => ({
        name,
        value: totalVendido > 0 ? Math.round((value / totalVendido) * 100) : 0,
        color: COLORS[i % COLORS.length]
      }))
      .filter(c => c.value > 0)
      .sort((a, b) => b.value - a.value);

    return {
      profitData,
      categoryData,
      kpis: {
        utilidadNeta,
        ingresosBrutos,
        totalEgresos,
        margen
      }
    };
  }, [sales, compras, gastos, movimientos, filter]);

  return (
    <div className="space-y-8 animate-in fade-in duration-700">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div>
          <h1 className="text-3xl font-black text-white flex items-center gap-3">
            <BarChart2 className="text-[#3498db]" /> ANÁLISIS DE UTILIDAD
          </h1>
          <p className="text-gray-400 text-sm">Visualización avanzada de márgenes y rendimiento en tiempo real</p>
        </div>
        <div className="flex gap-3">
          <select 
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            className="bg-white/5 border border-white/10 text-white font-bold py-3 px-4 rounded-2xl text-sm focus:outline-none focus:border-[#3498db] transition-all"
          >
            <option>Mes Actual</option>
            <option>Últimos 30 días</option>
            <option>Año 2026</option>
            <option>Todo el tiempo</option>
          </select>
          <button onClick={() => window.print()} className="bg-[#3498db] hover:bg-[#2980b9] text-white font-black py-3 px-6 rounded-2xl transition-all flex items-center gap-2 text-sm">
            <Download size={18} /> INFORME PDF
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {[
          { label: 'Utilidad Neta', value: formatCurrency(kpis.utilidadNeta), sub: 'Beneficio', up: kpis.utilidadNeta >= 0, color: kpis.utilidadNeta >= 0 ? 'text-green-400' : 'text-red-400' },
          { label: 'Ingresos Brutos', value: formatCurrency(kpis.ingresosBrutos), sub: 'Ventas', up: true, color: 'text-blue-400' },
          { label: 'Egresos Totales', value: formatCurrency(kpis.totalEgresos), sub: 'Compras+Gastos', up: false, color: 'text-red-400' },
          { label: 'Margen Promedio', value: `${kpis.margen.toFixed(1)}%`, sub: 'Rentabilidad', up: kpis.margen > 0, color: 'text-purple-400' },
        ].map((kpi, idx) => (
          <div key={idx} className="bg-white/5 border border-white/10 p-6 rounded-[2rem] backdrop-blur-sm">
            <div className="text-[10px] font-black text-gray-500 uppercase tracking-widest mb-1">{kpi.label}</div>
            <div className={`text-2xl font-black ${kpi.color}`}>{kpi.value}</div>
            <div className="flex items-center gap-1 mt-2">
              {kpi.up ? <ArrowUp size={12} className="text-green-500" /> : <ArrowDown size={12} className="text-red-500" />}
              <span className={`text-[10px] font-bold ${kpi.up ? 'text-green-500' : 'text-red-500'}`}>{kpi.sub}</span>
            </div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 bg-white/5 border border-white/10 rounded-[2.5rem] p-8">
          <div className="flex items-center justify-between mb-8">
            <div>
              <h3 className="text-xl font-bold">Flujo de Caja</h3>
              <p className="text-sm text-gray-400">Comparativa Ingresos vs Egresos</p>
            </div>
            <div className="flex gap-4">
               <div className="flex items-center gap-2">
                 <span className="w-3 h-3 rounded-full bg-[#3498db]"></span>
                 <span className="text-[10px] font-black uppercase text-gray-500">Ingresos</span>
               </div>
               <div className="flex items-center gap-2">
                 <span className="w-3 h-3 rounded-full bg-[#e74c3c]"></span>
                 <span className="text-[10px] font-black uppercase text-gray-500">Egresos</span>
               </div>
            </div>
          </div>
          <div className="h-[350px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={profitData}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(255,255,255,0.05)" />
                <XAxis dataKey="month" axisLine={false} tickLine={false} tick={{fill: '#94a3b8', fontSize: 12}} />
                <YAxis axisLine={false} tickLine={false} tick={{fill: '#94a3b8', fontSize: 12}} />
                <Tooltip 
                  cursor={{fill: 'rgba(255,255,255,0.05)'}}
                  contentStyle={{ backgroundColor: '#1e293b', border: 'none', borderRadius: '16px' }}
                />
                <Bar dataKey="income" fill="#3498db" radius={[4, 4, 0, 0]} />
                <Bar dataKey="expense" fill="#e74c3c" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="bg-white/5 border border-white/10 rounded-[2.5rem] p-8 flex flex-col">
          <h3 className="text-xl font-bold mb-8 flex items-center gap-2">
            <PieChart size={20} className="text-[#f1c40f]" /> Venta por Rubro
          </h3>
          
          <div className="flex-1 flex flex-col justify-center gap-6">
            {categoryData.length === 0 && <div className="text-center text-gray-500 uppercase font-bold text-xs">No hay datos suficientes</div>}
            {categoryData.map((cat, idx) => (
              <div key={idx} className="space-y-2">
                <div className="flex justify-between items-end">
                  <span className="text-sm font-bold text-white">{cat.name}</span>
                  <span className="text-xs font-black" style={{ color: cat.color }}>{cat.value}%</span>
                </div>
                <div className="h-2 w-full bg-white/5 rounded-full overflow-hidden">
                  <motion.div 
                    initial={{ width: 0 }}
                    animate={{ width: `${cat.value}%` }}
                    transition={{ duration: 1, delay: idx * 0.1 }}
                    className="h-full" 
                    style={{ backgroundColor: cat.color }} 
                  />
                </div>
              </div>
            ))}
          </div>

          <div className="mt-8 p-4 bg-[#3498db]/10 border border-[#3498db]/20 rounded-2xl flex items-center gap-4">
            <div className="p-3 bg-[#3498db] rounded-xl text-white">
              <Zap size={20} />
            </div>
            <div>
              <div className="text-[10px] font-black uppercase text-[#3498db]">Sugerencia IA</div>
              <p className="text-xs text-white leading-tight font-medium">Mantén un flujo de caja positivo gestionando el inventario de más rotación según los rubros principales.</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ReportsScreen;
