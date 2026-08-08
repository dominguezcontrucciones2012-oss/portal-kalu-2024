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
  Smartphone,
  Trophy
} from 'lucide-react';
import { auth } from '../../lib/firebase';
import { useAuth } from '../../contexts/AuthProvider';
import { cn } from '../../lib/utils';
import firebaseConfig from '../../../firebase-applet-config.json';
import { Role } from '../../types';
import { getLatestTasa, syncLatestTasa, updateManualTasa, subscribeToCollection, getActiveStoreId } from '../../lib/dbUtils';

interface SidebarProps {
  userRole: Role;
  isMobileMenuOpen?: boolean;
  setIsMobileMenuOpen?: (isOpen: boolean) => void;
}

const Sidebar: React.FC<SidebarProps> = ({ userRole, isMobileMenuOpen, setIsMobileMenuOpen }) => {
  const { user, logout } = useAuth();
  const [isOpen, setIsOpen] = useState(true);

  // ── Tasa BCV: mostrar último valor conocido INSTANTANEAMENTE ──
  // Si no hay caché, muestra 737.88 como fallback en duro (última tasa BCV oficial conocida)
  const TASA_FALLBACK = 737.88;
  const getInitialTasa = () => {
    try {
      const cached = localStorage.getItem('kalu_tasa_bcv');
      if (cached) {
        const parsed = JSON.parse(cached);
        // Solo usar caché si el valor es razonable (>100) y no es muy antiguo
        const isFresh = parsed.timestamp ? (Date.now() - parsed.timestamp < 24 * 60 * 60 * 1000) : true;
        if (parsed.valor && parsed.valor > 100 && isFresh) return parsed;
      }
    } catch { }
    return { valor: TASA_FALLBACK, estatus: 'Referencial' };
  };

  const [tasa, setTasa] = useState<{ valor: number; estatus: string }>(getInitialTasa);
  const [tasaDebug, setTasaDebug] = useState<string>('Iniciando...');
  const [syncing, setSyncing] = useState(false);
  const [configName, setConfigName] = useState<{ name: string, tag: string } | null>(null);
  const [storeDocName, setStoreDocName] = useState<{ name: string, tag: string } | null>(null);
  const [storeFeatures, setStoreFeatures] = useState<any>({});

  useEffect(() => {
    let mounted = true;

    // ── Garantía: si en 5 segundos no hay respuesta, mostrar fallback ──
    const fallbackTimer = setTimeout(() => {
      if (!mounted) return;
      // Solo actuar si aún muestra el estado de carga
      setTasa(prev => {
        if (prev.estatus === 'Cargando...' || prev.estatus === 'Referencial') {
          const cached = localStorage.getItem('kalu_tasa_bcv');
          if (cached) {
            try {
              const parsed = JSON.parse(cached);
              if (parsed.valor > 100) return { valor: parsed.valor, estatus: 'Última conocida' };
            } catch { }
          }
          return { valor: TASA_FALLBACK, estatus: 'Referencial' };
        }
        return prev;
      });
      setTasaDebug('Sin respuesta del servidor');
    }, 5000);

    const fetchRateFromFirestore = async () => {
      if (mounted) setTasaDebug('Conectando...');

      const projectId = 'kalu-queso-sanjuam';

      // ── Función auxiliar con timeout garantizado ─────────────
      const withTimeout = <T,>(promise: Promise<T>, ms: number): Promise<T> => {
        const timeout = new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error(`Timeout ${ms}ms`)), ms)
        );
        return Promise.race([promise, timeout]);
      };

      // 1. REST directo a Firestore con ordenamiento por fecha descendente
      const fetchDirect = async () => {
        const dbId = firebaseConfig.firestoreDatabaseId || '(default)';
        const url = `https://firestore.googleapis.com/v1/projects/${projectId}/databases/${dbId}/documents/tasas_bcv?pageSize=50&orderBy=fecha+desc`;
        const res = await fetch(url);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const json = await res.json();
        if (json.documents && json.documents.length > 0) {
          const valid = json.documents
            .map((d: any) => ({
              fecha: d.fields?.fecha?.stringValue || '',
              valor: parseFloat(d.fields?.valor?.doubleValue ?? d.fields?.valor?.integerValue ?? 0),
              estatus: d.fields?.estatus?.stringValue || 'Sincronizada',
            }))
            .filter((d: any) => d.valor > 100)
            .sort((a: any, b: any) => b.fecha.localeCompare(a.fecha));
          if (valid.length > 0) return { valor: valid[0].valor, estatus: valid[0].estatus, source: 'REST' };
        }
        throw new Error('Sin documentos');
      };

      // 2. Proxy via Cloud Function (evita bloqueos de CANTV)
      const fetchProxy = async () => {
        const res = await fetch('/api/bcv-rate?force=false');
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const json = await res.json();
        if (json.rate && json.rate > 100) return { valor: Number(json.rate), estatus: 'Sincronizada', source: 'PROXY' };
        throw new Error('Sin tasa válida');
      };

      try {
        // Competir ambas con timeout máximo de 10 segundos cada una
        const result = await Promise.any([
          withTimeout(fetchDirect(), 8000),
          withTimeout(fetchProxy(), 10000),
        ]);

        if (mounted && result) {
          const newTasa = { valor: result.valor, estatus: result.estatus, timestamp: Date.now() };
          setTasa({ valor: result.valor, estatus: result.estatus });
          // Guardar en caché local para la próxima vez
          localStorage.setItem('kalu_tasa_bcv', JSON.stringify(newTasa));
          setTasaDebug(`OK ${result.source}: Bs. ${result.valor}`);
        }
      } catch (e: any) {
        // Si ambas fallaron o vencieron el tiempo, usar la última tasa guardada
        if (mounted) {
          const cached = localStorage.getItem('kalu_tasa_bcv');
          if (cached) {
            try {
              const parsed = JSON.parse(cached);
              if (parsed.valor > 100) {
                setTasa({ valor: parsed.valor, estatus: 'Última conocida' });
                setTasaDebug(`CACHE: Bs. ${parsed.valor} — sin conexión`);
                return;
              }
            } catch { }
          }
          setTasaDebug(`Sin conexión al BCV`);
        }
      }
    };

    fetchRateFromFirestore();

    // Suscripción secundaria vía WebSocket (funciona si CANTV no lo bloquea)
    const unsubTasa = subscribeToCollection('tasas_bcv', (data) => {
      if (!mounted) return;
      if (data && data.length > 0) {
        const sorted = [...data].sort((a: any, b: any) => {
          const fechaA = String(a.fecha || '');
          const fechaB = String(b.fecha || '');
          const fechaCmp = fechaB.localeCompare(fechaA);
          if (fechaCmp !== 0) return fechaCmp;
          const timeA = a.sincronizadoEn?.seconds ? a.sincronizadoEn.seconds * 1000 : (typeof a.sincronizadoEn === 'string' ? new Date(a.sincronizadoEn).getTime() : 0);
          const timeB = b.sincronizadoEn?.seconds ? b.sincronizadoEn.seconds * 1000 : (typeof b.sincronizadoEn === 'string' ? new Date(b.sincronizadoEn).getTime() : 0);
          return timeB - timeA;
        });
        const newVal = Number(sorted[0].valor);
        if (newVal && newVal > 100) {
          const newTasa = { valor: newVal, estatus: sorted[0].estatus || 'Sincronizada', timestamp: Date.now() };
          setTasa({ valor: newTasa.valor, estatus: newTasa.estatus });
          localStorage.setItem('kalu_tasa_bcv', JSON.stringify(newTasa));
          setTasaDebug(`WS OK: Bs. ${newVal}`);
        }
      }
    });
    const unsubConfig = subscribeToCollection('configuracion', (data) => {
      if (!mounted) return;
      import('../../lib/dbUtils').then(({ getActiveStoreId }) => {
        const activeStoreId = getActiveStoreId();
        const storeConfig = data.find(c => c.id === activeStoreId);
        if (storeConfig && storeConfig.empresa_nombre) {
          const parts = storeConfig.empresa_nombre.split(' ');
          setConfigName({
            name: parts[0].toUpperCase(),
            tag: parts.slice(1).join(' ').toUpperCase() || 'STORE'
          });
        } else if (activeStoreId === 'kalu-queso-sanjuan') {
          const globalConfig = data.find(c => c.id === 'global');
          if (globalConfig && globalConfig.empresa_nombre) {
            const parts = globalConfig.empresa_nombre.split(' ');
            setConfigName({
              name: parts[0].toUpperCase(),
              tag: parts.slice(1).join(' ').toUpperCase() || 'STORE'
            });
          }
        } else {
          setConfigName(null);
        }
      });
    });

    const unsubStores = subscribeToCollection('stores', (data) => {
      if (!mounted) return;
      import('../../lib/dbUtils').then(({ getActiveStoreId }) => {
        const activeStoreId = getActiveStoreId();
        const storeDoc = data.find(s => s.id === activeStoreId);
        if (storeDoc) {
          setStoreFeatures(storeDoc.features || {});
          if (storeDoc.name) {
            const parts = storeDoc.name.split(' ');
            setStoreDocName({
              name: parts[0].toUpperCase(),
              tag: parts.slice(1).join(' ').toUpperCase() || 'STORE'
            });
          }
        } else {
          setStoreDocName(null);
          setStoreFeatures({});
        }
      });
    });

    return () => {
      mounted = false;
      clearTimeout(fallbackTimer);
      unsubTasa();
      unsubConfig();
      unsubStores();
    };
  }, []);

  const [syncMsg, setSyncMsg] = useState<{ type: 'ok' | 'err', text: string } | null>(null);

  const handleSync = async () => {
    setSyncing(true);
    setSyncMsg(null);
    try {
      const result = await syncLatestTasa() as any;
      // Actualizar el estado local INMEDIATAMENTE sin esperar al WebSocket
      setTasa({ valor: Number(result.valor), estatus: result.estatus || 'Sincronizada' });
      setSyncMsg({ type: 'ok', text: `✓ Bs. ${result.valor.toFixed(2)} — actualizada` });
      setTimeout(() => setSyncMsg(null), 5000);
    } catch (e: any) {
      setSyncMsg({ type: 'err', text: `✗ Sin conexión al BCV` });
      setTimeout(() => setSyncMsg(null), 5000);
    } finally {
      setSyncing(false);
    }
  };

  let menuGroups = [
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
        ...((storeFeatures.pedidosWeb || storeFeatures.hasOnlineStore) ? [
          { path: '/despacho', icon: Package, label: 'KDS / DESPACHO WEB' }
        ] : []),
        { path: '/closure', icon: ShieldCheck, label: 'CIERRE DIARIO' },
        { path: '/history', icon: History, label: 'HISTORIAL VENTAS' },
        { path: '/clients', icon: Users, label: 'CLIENTES' },
        ...((storeFeatures.pedidosWeb || storeFeatures.hasOnlineStore) ? [
          { path: '/repartidores', icon: Truck, label: 'REPARTIDORES' }
        ] : []),
        ...((storeFeatures.cuentasAbiertas || storeFeatures.hasOpenTabs) ? [
          { path: '/morosos', icon: Users, label: 'CUENTAS X COBRAR' }
        ] : []),
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
        ...(storeFeatures.sorteoSemanal ? [{ path: '/sorteo', icon: Trophy, label: 'SORTEO SEMANAL' }] : []),
        ...((storeFeatures.aiModule || storeFeatures.hasAISales) ? [{ path: '/ai-market', icon: Bot, label: 'IA MERCADO' }] : []),
        { path: '/settings', icon: Settings, label: 'AJUSTES' },
      ]
    }
  ];

  const handleLogout = async () => {
    try {
      await logout();
    } catch (error) {
      console.error('Error logging out:', error);
    }
  };

  return (
    <div className={cn(
      "h-screen bg-[#0f172a] border-r border-white/10 flex flex-col font-sans transition-transform duration-300 z-50",
      "fixed inset-y-0 left-0 md:relative md:translate-x-0",
      isMobileMenuOpen ? "translate-x-0" : "-translate-x-full md:translate-x-0",
      isOpen ? "w-72" : "w-20 hidden md:flex"
    )}>
      {/* Toggle Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="hidden md:flex absolute -right-4 top-8 w-8 h-8 bg-[#3498db] text-white rounded-full items-center justify-center shadow-lg shadow-[#3498db]/20 z-50 hover:bg-[#2980b9] transition-colors"
      >
        {isOpen ? <ChevronLeft size={16} /> : <ChevronRight size={16} />}
      </button>

      {/* Brand Section */}
      <div className={cn("p-6 pb-4 flex items-center", isOpen ? "gap-4" : "justify-center")}>
        <img
          src="/logo.jpg?v=2026"
          alt="Mercado San Juan"
          className="w-10 h-10 rounded-full object-cover flex-shrink-0 shadow-sm"
        />
        {isOpen && (
          <div className="overflow-hidden">
            <span className="block text-2xl font-black text-white tracking-tighter leading-none truncate">{configName?.name || storeDocName?.name || 'CARGANDO'}</span>
            <span className="block text-[10px] font-black text-[#3498db] tracking-[0.2em] mt-1 truncate">{configName?.tag || storeDocName?.tag || 'STORE'}</span>
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
          if (g.label === 'SuperAdmin') {
            return userRole === Role.SUPERADMIN || user?.storeId === 'kalu-queso-sanjuan';
          }
          // Admins / Duenos / Supervisors see everything except Portal Vecino y SuperAdmin
          return g.label !== 'Portal Vecino';
        }).map((group, idx) => (
          <div key={idx} className="space-y-1">
            {isOpen && <h3 className="px-4 text-[9px] font-black text-gray-600 uppercase tracking-[0.25em] mb-2">{group.label}</h3>}
            {group.items.map((item) => (
              <NavLink
                key={item.path}
                to={item.path}
                onClick={() => setIsMobileMenuOpen?.(false)}
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
              {tasa.valor > 0 ? tasa.valor.toFixed(2) : '---'}
              <span className="text-[10px] text-gray-500 font-bold uppercase tracking-widest">BS/USD</span>
            </div>
            {/* Indicador de actualización */}
            <div className="mt-1 text-[8px] text-gray-600 font-mono truncate">
              {tasa.estatus === 'Sincronizada' || tasa.estatus === 'Homologada'
                ? `✅ En vivo · BCV oficial`
                : tasa.estatus === 'Manual'
                  ? `📝 Tasa manual`
                  : `🔄 Actualizando...`
              }
            </div>
            {syncMsg && (
              <div className={`mt-1.5 text-[8px] font-black px-2 py-1 rounded-lg ${syncMsg.type === 'ok'
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
                <span className="text-[8px] text-gray-600 font-bold uppercase tracking-widest truncate">
                  {userRole === Role.SUPERADMIN ? 'SUPERADMIN' : (user?.role || 'ADMIN')}
                </span>
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
