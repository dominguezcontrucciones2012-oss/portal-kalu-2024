import React from 'react';
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
  ResponsiveContainer,
  Cell,
  LineChart,
  Line
} from 'recharts';
import { formatCurrency } from '../../lib/utils';

const profitData = [
  { month: 'Ene', income: 4500, expense: 3200, profit: 1300 },
  { month: 'Feb', income: 5200, expense: 3800, profit: 1400 },
  { month: 'Mar', income: 4800, expense: 3500, profit: 1300 },
  { month: 'Abr', income: 6100, expense: 4200, profit: 1900 },
  { month: 'May', income: 5900, expense: 4100, profit: 1800 },
];

const categoryData = [
  { name: 'Víveres', value: 45, color: '#3498db' },
  { name: 'Queso', value: 30, color: '#f1c40f' },
  { name: 'Repuestos', value: 15, color: '#e74c3c' },
  { name: 'Ferretería', value: 10, color: '#9b59b6' },
];

const ReportsScreen: React.FC = () => {
  return (
    <div className="space-y-8 animate-in fade-in duration-700">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div>
          <h1 className="text-3xl font-black text-white flex items-center gap-3">
            <BarChart2 className="text-[#3498db]" /> ANÁLISIS DE UTILIDAD
          </h1>
          <p className="text-gray-400 text-sm">Visualización avanzada de margenes y rendimiento</p>
        </div>
        <div className="flex gap-3">
          <select className="bg-white/5 border border-white/10 text-white font-bold py-3 px-4 rounded-2xl text-sm focus:outline-none focus:border-[#3498db] transition-all">
            <option>Últimos 30 días</option>
            <option>Año 2026</option>
            <option>Todo el tiempo</option>
          </select>
          <button onClick={() => window.print()} className="bg-[#3498db] hover:bg-[#2980b9] text-white font-black py-3 px-6 rounded-2xl transition-all flex items-center gap-2 text-sm">
            <Download size={18} /> INFORME PDF
          </button>
        </div>
      </div>

      {/* High-Level KPIs */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {[
          { label: 'Utilidad Neta', value: '$2,450.00', sub: '+15.2%', up: true, color: 'text-green-400' },
          { label: 'Ingresos Brutos', value: '$8,120.00', sub: '+8.4%', up: true, color: 'text-blue-400' },
          { label: 'Costo Mercancía', value: '$5,670.00', sub: '-3.1%', up: false, color: 'text-red-400' },
          { label: 'Margen Promedio', value: '30.2%', sub: '+2.1%', up: true, color: 'text-purple-400' },
        ].map((kpi, idx) => (
          <div key={idx} className="bg-white/5 border border-white/10 p-6 rounded-[2rem] backdrop-blur-sm">
            <div className="text-[10px] font-black text-gray-500 uppercase tracking-widest mb-1">{kpi.label}</div>
            <div className={`text-2xl font-black ${kpi.color}`}>{kpi.value}</div>
            <div className="flex items-center gap-1 mt-2">
              {kpi.up ? <ArrowUp size={12} className="text-green-500" /> : <ArrowDown size={12} className="text-red-500" />}
              <span className={`text-[10px] font-bold ${kpi.up ? 'text-green-500' : 'text-red-500'}`}>{kpi.sub} vs mes anterior</span>
            </div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Main Chart */}
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

        {/* Category Breakdown */}
        <div className="bg-white/5 border border-white/10 rounded-[2.5rem] p-8 flex flex-col">
          <h3 className="text-xl font-bold mb-8 flex items-center gap-2">
            <PieChart size={20} className="text-[#f1c40f]" /> Venta por Rubro
          </h3>
          
          <div className="flex-1 flex flex-col justify-center gap-6">
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
              <p className="text-xs text-white leading-tight font-medium">Incrementar stock de <b>Víveres</b>. Demanda subió 20%.</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ReportsScreen;
