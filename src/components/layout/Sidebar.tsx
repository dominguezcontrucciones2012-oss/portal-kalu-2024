import React, { useState, useEffect } from 'react';
import { NavLink, Link } from 'react-router-dom';
import { 
  ShoppingCart, 
  History, 
  Users, 
  UserPlus, 
  Boxes, 
  Truck, 
  FileText, 
  Settings, 
  LogOut,
  Calculator,
  BookOpen,
  PieChart,
  Bot,
  RefreshCw,
  ShieldCheck,
  Rocket,
  BarChart2,
  Lock,
  Store,
  ShoppingBag,
  LayoutDashboard,
  Package,
  TrendingUp,
  Brain,
  ChevronLeft,
  ChevronRight,
  Smartphone
} from 'lucide-react';
import { auth } from '../../lib/firebase';
import { useAuth } from '../../contexts/AuthProvider';
import { cn } from '../../lib/utils';
import { Role } from '../../types';
import { getLatestTasa, syncLatestTasa, updateManualTasa, subscribeToCollection } from '../../lib/dbUtils';

interface SidebarProps {
  userRole: Role;
}

const Sidebar: React.FC<SidebarProps> = ({ userRole }) => {
  const { user, setUser } = useAuth();
  const [isOpen, setIsOpen] = useState(true);
  const [tasa, setTasa] = useState<{ valor: number; estatus: string }>({ valor: 40.50, estatus: 'Cargando...' });
  const [syncing, setSyncing] = useState(false);

  useEffect(() => {
    const unsubTasa = subscribeToCollection('tasas_bcv', (data) => {
      if (data && data.length > 0) {
        const sorted = data.sort((a: any, b: any) => {
          const fechaA = String(a.fecha || '');
          const fechaB = String(b.fecha || '');
          const fechaCmp = fechaB.localeCompare(fechaA);
          if (fechaCmp !== 0) return fechaCmp;
          const timeA = a.sincronizadoEn?.seconds ? a.sincronizadoEn.seconds * 1000 : (typeof a.sincronizadoEn === 'string' ? new Date(a.sincronizadoEn).getTime() : 0);
          const timeB = b.sincronizadoEn?.seconds ? b.sincronizadoEn.seconds * 1000 : (typeof b.sincronizadoEn === 'string' ? new Date(b.sincronizadoEn).getTime() : 0);
          return timeB - timeA;
        });
        setTasa({ valor: Number(sorted[0].valor) || 40.50, estatus: sorted[0].estatus || 'Manual' });
      } else {
        setTasa({ valor: 40.50, estatus: 'Manual' });
      }
    });
    return () => unsubTasa();
  }, []);

  const [syncMsg, setSyncMsg] = useState<{type: 'ok'|'err', text: string} | null>(null);

  const handleSync = async () => {
    setSyncing(true);
    setSyncMsg(null);
    try {
      const result = await syncLatestTasa() as any;
      setSyncMsg({ type: 'ok', text: `✓ Bs. ${result.valor.toFixed(2)} — actualizada` });
      setTimeout(() => setSyncMsg(null), 5000);
    } catch (e: any) {
      setSyncMsg({ type: 'err', text: `✗ Sin conexión al BCV` });
      setTimeout(() => setSyncMsg(null), 5000);
    } finally {
      setSyncing(false);
    }
  };

  const menuGroups = [
    {
      label: 'Portal Vecino',
      items: [
        { path: '/client-portal', icon: Smartphone, label: 'MI PORTAL' },
      ]
    },
    {
      label: 'Ventas',
      items: [
        { path: '/', icon: LayoutDashboard, label: 'DASHBOARD' },
        { path: '/pos', icon: ShoppingBag, label: 'PUNTO DE VENTA' },
        { path: '/despacho', icon: Package, label: 'KDS / DESPACHO WEB' },
        { path: '/closure', icon: ShieldCheck, label: 'CIERRE DIARIO' },
        { path: '/history', icon: History, label: 'HISTORIAL VENTAS' },
        { path: '/clients', icon: Users, label: 'CLIENTES' },
        { path: '/morosos', icon: Users, label: 'CUENTAS X COBRAR' },
      ]
    },
    {
      label: 'Logística',
      items: [
        { path: '/inventory', icon: Package, label: 'INVENTARIO' },
        { path: '/purchases', icon: ShoppingBag, label: 'COMPRAS' },
        { path: '/providers', icon: Package, label: 'PROVEEDORES' },
      ]
    },
    {
      label: 'Gerencia',
      items: [
        { path: '/reports', icon: BarChart2, label: 'ANÁLISIS' },
        { path: '/accounting', icon: Calculator, label: 'CONTABILIDAD' },
        { path: '/ledger', icon: BookOpen, label: 'LIBRETA QUESO' },
        { path: '/ai-market', icon: Bot, label: 'IA MERCADO' },
        { path: '/settings', icon: Settings, label: 'AJUSTES' },
      ]
    }
  ];

  const handleLogout = async () => {
    try {
      setUser(null);
      await auth.signOut();
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <div className={cn(
      "h-screen bg-[#0f172a] border-r border-white/10 flex flex-col sticky top-0 font-sans transition-all duration-300 relative",
      isOpen ? "w-72" : "w-20"
    )}>
      {/* Toggle Button */}
      <button 
        onClick={() => setIsOpen(!isOpen)}
        className="absolute -right-4 top-8 w-8 h-8 bg-[#3498db] text-white rounded-full flex items-center justify-center shadow-lg shadow-[#3498db]/20 z-50 hover:bg-[#2980b9] transition-colors"
      >
        {isOpen ? <ChevronLeft size={16} /> : <ChevronRight size={16} />}
      </button>

      {/* Brand Section */}
      <div className={cn("p-6 pb-4 flex items-center", isOpen ? "gap-4" : "justify-center")}>
        <div className="w-10 h-10 bg-gradient-to-br from-[#3498db] to-[#2ecc71] rounded-2xl flex items-center justify-center shadow-lg shadow-[#3498db]/20 shrink-0">
          <Rocket className="text-white" size={18} fill="white" />
        </div>
        {isOpen && (
          <div className="overflow-hidden">
            <span className="block text-2xl font-black text-white tracking-tighter leading-none">KALU</span>
            <span className="block text-[10px] font-black text-[#3498db] tracking-[0.4em] mt-1 truncate">2024 PRO</span>
          </div>
        )}
      </div>

      {/* Navigation */}
      <div className="flex-1 overflow-y-auto px-4 space-y-6 custom-scrollbar pb-4">
        {menuGroups.filter(g => {
          if (userRole === Role.CLIENTE) {
            return g.label === 'Portal Vecino';
          }
          if (userRole === Role.PRODUCTOR) {
            return false;
          }
          if (userRole === Role.CAJERO) {
            return g.label === 'Ventas';
          }
          // Admins / Duenos / Supervisors see everything except Portal Vecino
          return g.label !== 'Portal Vecino';
        }).map((group, idx) => (
          <div key={idx} className="space-y-1">
            {isOpen && <h3 className="px-4 text-[9px] font-black text-gray-600 uppercase tracking-[0.25em] mb-2">{group.label}</h3>}
            {group.items.map((item) => (
              <NavLink
                key={item.path}
                to={item.path}
                title={!isOpen ? item.label : undefined}
                className={({ isActive }) => cn(
                  "flex items-center gap-4 py-3 rounded-2xl transition-all duration-200 group",
                  isOpen ? "px-4" : "justify-center",
                  isActive 
                    ? "bg-[#3498db] text-white shadow-lg shadow-[#3498db]/20 font-black" 
                    : "text-gray-500 hover:text-white hover:bg-white/5 font-bold"
                )}
              >
                <item.icon size={18} className="transition-transform group-hover:scale-110 group-active:scale-95 flex-shrink-0" />
                {isOpen && <span className="text-[10px] uppercase tracking-widest truncate">{item.label}</span>}
              </NavLink>
            ))}
          </div>
        ))}
      </div>

      {/* Footer: Tasa BCV + User */}
      <div className={cn("p-5 border-t border-white/5 space-y-5 bg-black/20", !isOpen && "px-2 flex flex-col items-center")}>
        {/* Tasa BCV Widget */}
        {isOpen && (
          <div className="bg-white/5 rounded-2xl p-4 border border-white/5">
            <div className="flex items-center justify-between mb-2">
              <span className="text-[9px] font-black text-gray-500 uppercase tracking-widest">Tasa BCV</span>
              <div className="flex items-center gap-1">
                <div className={cn(
                  "flex items-center gap-1 px-2 py-0.5 rounded-full text-[8px] font-black uppercase border",
                  tasa.estatus === 'Homologada' || tasa.estatus === 'Sincronizada'
                    ? "bg-green-500/10 text-green-400 border-green-500/20"
                    : "bg-yellow-500/10 text-yellow-400 border-yellow-500/20"
                )}>
                  <ShieldCheck size={8} />
                  {tasa.estatus}
                </div>
                <button
                  onClick={handleSync}
                  disabled={syncing}
                  title="Sincronizar tasa BCV"
                  className="ml-1 text-gray-600 hover:text-[#3498db] transition-colors"
                >
                  <RefreshCw size={12} className={syncing ? 'animate-spin' : ''} />
                </button>
              </div>
            </div>

            <div className="flex items-baseline gap-1 text-2xl font-black text-white tracking-tighter w-full text-left truncate mt-1">
              {tasa.valor.toFixed(2)}
              <span className="text-[10px] text-gray-500 font-bold uppercase tracking-widest">BS/USD</span>
            </div>
            {syncMsg && (
              <div className={`mt-1.5 text-[8px] font-black px-2 py-1 rounded-lg ${
                syncMsg.type === 'ok'
                  ? 'bg-green-500/15 text-green-400'
                  : 'bg-red-500/15 text-red-400'
              }`}>
                {syncMsg.text}
              </div>
            )}
          </div>
        )}

        {/* User + Logout */}
        <div className={cn("flex items-center gap-3", isOpen ? "justify-between" : "flex-col justify-center")}>
          <Link to="/profile" className="flex items-center gap-3 group min-w-0" title={!isOpen ? user?.username : undefined}>
            <div className="w-9 h-9 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center text-white font-black text-xs group-hover:border-[#3498db] transition-all flex-shrink-0">
              {user?.username?.substring(0, 2).toUpperCase() || 'AD'}
            </div>
            {isOpen && (
              <div className="flex flex-col min-w-0">
                <span className="text-xs font-black text-white leading-none uppercase tracking-tight truncate">{user?.username || 'Admin'}</span>
                <span className="text-[8px] text-gray-600 font-bold uppercase tracking-widest truncate">{user?.role || 'ADMIN'}</span>
              </div>
            )}
          </Link>
          <button 
            onClick={handleLogout}
            title={!isOpen ? "Cerrar Sesión" : undefined}
            className="w-9 h-9 rounded-xl bg-red-500/10 text-red-500 flex items-center justify-center hover:bg-red-500 hover:text-white transition-all border border-red-500/20 flex-shrink-0"
          >
            <LogOut size={16} />
          </button>
        </div>
      </div>
    </div>
  );
};

export default Sidebar;
