import React, { Suspense, lazy } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './contexts/AuthProvider';
import Layout from './components/layout/Layout';
import { ToastProvider } from './contexts/ToastProvider';
import ErrorBoundary from './components/common/ErrorBoundary';
import { auth } from './lib/firebase';
import { AlertTriangle, RefreshCw } from 'lucide-react';

const lazyRetry = (componentImport: () => Promise<any>) => {
  return lazy(async () => {
    const hasRefreshed = JSON.parse(
      window.sessionStorage.getItem('retry-lazy-refreshed') || 'false'
    );
    try {
      // Add a 15-second timeout to prevent infinite hanging on bad networks
      const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => reject(new Error('Chunk load timeout')), 15000);
      });
      const component = await Promise.race([componentImport(), timeoutPromise]);
      window.sessionStorage.setItem('retry-lazy-refreshed', 'false');
      return component;
    } catch (error) {
      if (!hasRefreshed) {
        window.sessionStorage.setItem('retry-lazy-refreshed', 'true');
        
        // Intentar limpiar caché y Service Workers antes de recargar
        if ('caches' in window) {
          caches.keys().then(names => {
            for (let name of names) caches.delete(name);
          });
        }
        
        window.location.reload();
        // Fallback agresivo por si reload() es interceptado en iOS PWA
        setTimeout(() => {
          window.location.href = window.location.href;
        }, 500);

        // Ya no devolvemos una promesa infinita, lanzamos el error para que 
        // caiga en el ErrorBoundary si el reload falla.
        throw new Error("Forzando recarga por fallo de módulo...");
      }
      throw error;
    }
  });
};

const DashboardScreen = lazyRetry(() => import('./components/Dashboard/DashboardScreen'));
const POSScreen = lazyRetry(() => import('./components/POS/POSScreen'));
const InventoryScreen = lazyRetry(() => import('./components/Inventory/InventoryScreen'));
const ClientsScreen = lazyRetry(() => import('./components/Clients/ClientsScreen'));
const DriversScreen = lazyRetry(() => import('./components/Drivers/DriversScreen'));
const MorososScreen = lazyRetry(() => import('./components/Clients/MorososScreen'));
const LedgerScreen = lazyRetry(() => import('./components/Ledger/LedgerScreen'));
const HistoryScreen = lazyRetry(() => import('./components/History/HistoryScreen'));
const ReportsScreen = lazyRetry(() => import('./components/Reports/ReportsScreen'));
const ClientPortal = lazyRetry(() => import('./components/Portal/ClientPortalScreen'));
const ClosureScreen = lazyRetry(() => import('./components/Account/ClosureScreen'));
const PurchasesScreen = lazyRetry(() => import('./components/Inventory/PurchasesScreen'));
const ProvidersScreen = lazyRetry(() => import('./components/Inventory/ProvidersScreen'));
const ProfileScreen = lazyRetry(() => import('./components/Account/ProfileScreen'));
const ClientLoginScreen = lazyRetry(() => import('./components/Auth/ClientLoginScreen'));
const AdminLoginScreen = lazyRetry(() => import('./components/Auth/AdminLoginScreen'));
const AccountingScreen = lazyRetry(() => import('./components/Ledger/AccountingScreen'));
const SettingsScreen = lazyRetry(() => import('./components/Account/SettingsScreen'));
const AIMarketScreen = lazyRetry(() => import('./components/AI/AIMarketScreen'));
const PublicMarketScreen = lazyRetry(() => import('./components/Market/PublicMarketScreen'));
const VendorPortalScreen = lazyRetry(() => import('./components/Market/VendorPortalScreen'));
const ApprovalScreen = lazyRetry(() => import('./components/Market/ApprovalScreen'));
const PublicCatalogScreen = lazyRetry(() => import('./components/Portal/PublicCatalogScreen'));
const DispatchScreen = lazyRetry(() => import('./components/Dispatch/DispatchScreen'));
const DriverPortalScreen = lazyRetry(() => import('./components/Portal/DriverPortalScreen'));
const SorteoScreen = lazyRetry(() => import('./components/Sorteo/SorteoScreen'));
const DriverOrClientGate = lazyRetry(() => import('./components/Portal/DriverOrClientGate'));
const SuperAdminScreen = lazyRetry(() => import('./components/SuperAdmin/SuperAdminScreen'));
const DirectoryScreen = lazyRetry(() => import('./components/Portal/DirectoryScreen'));

const LoadingFallback = () => (
  <div className="h-screen w-full bg-slate-900 flex items-center justify-center">
    <div className="w-12 h-12 border-4 border-white/10 border-t-[#3498db] rounded-full animate-spin" />
  </div>
);




const ProtectedRoute = ({ children }: { children: React.ReactNode }) => {
  const { user } = useAuth();
  if (!user) {
    return <Navigate to="/login" replace />;
  }
  return <>{children}</>;
};

const Root = () => {
  const { user, loading, authError, retryAuth } = useAuth();

  // Recarga automática al volver del segundo plano (16 horas solo para STAFF)
  React.useEffect(() => {
    let backgroundTime = 0;
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'hidden') {
        backgroundTime = Date.now();
      } else if (document.visibilityState === 'visible') {
        const timeAway = Date.now() - backgroundTime;
        if (backgroundTime > 0 && timeAway > 16 * 60 * 60 * 1000) {
          if (user && ['admin', 'dueno', 'supervisor', 'cajero', 'repartidor'].includes(user.role)) {
            console.log("Reabriendo la app después de 16h (Staff): Recargando para actualizar datos...");
            window.location.reload();
          }
        }
      }
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, [user]);

  if (authError) {
    return (
      <div className="min-h-screen bg-[#0f172a] flex flex-col items-center justify-center p-4">
        <div className="bg-white/5 border border-red-500/30 p-8 rounded-[2.5rem] max-w-md w-full text-center space-y-6">
          <div className="w-20 h-20 bg-red-500/20 rounded-full flex items-center justify-center mx-auto text-red-500">
            <AlertTriangle size={40} />
          </div>
          <div>
            <h2 className="text-2xl font-black text-white mb-2">Error de Conexión</h2>
            <p className="text-gray-400 text-sm">
              {authError}
            </p>
          </div>
          <button
            onClick={retryAuth}
            className="w-full bg-[#3498db] hover:bg-[#2980b9] text-white font-black py-4 rounded-2xl flex items-center justify-center gap-2 transition-all"
          >
            <RefreshCw size={18} /> REINTENTAR
          </button>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="h-screen w-full bg-[#0f172a] flex items-center justify-center">
        <div className="w-12 h-12 border-4 border-white/10 border-t-[#3498db] rounded-full animate-spin" />
      </div>
    );
  }

  if (!user) {
    return (
      <Routes>
        <Route path="/" element={<DirectoryScreen />} />
        <Route path="/tiendas" element={<DirectoryScreen />} />
        <Route path="/login" element={<ClientLoginScreen />} />
        <Route path="/admin/login" element={<AdminLoginScreen />} />
        <Route path="/sentings" element={<AdminLoginScreen />} />
        <Route path="/catalogo" element={<PublicCatalogScreen />} />
        <Route path="/sorteo" element={<SorteoScreen />} />
        {/* FALLBACK: Si entran a una ruta que no existe o están deslogueados, NUNCA forzarlos al /login azul.
            Deben caer siempre en la PANTALLA 1 (Multitienda) como dicta la secuencia. */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    );
  }

  // Restringir el acceso de los clientes para que no entren al panel administrativo
  if (user.role === 'cliente') {
    return (
      <Routes>
        {/* PANTALLA 1 SIEMPRE LIBRE, INCLUSO CON SESIÓN ACTIVA */}
        <Route path="/" element={<DirectoryScreen />} />
        <Route path="/tiendas" element={<DirectoryScreen />} />
        
        {/* ENVOLTURA PROTEGIDA SIN RUTA BASE QUE SECUESTRE EL '/' */}
        <Route element={<ProtectedRoute><Layout /></ProtectedRoute>}>
          <Route path="/client-portal" element={<ClientPortal />} />
          <Route path="/catalogo" element={<PublicCatalogScreen />} />
          <Route path="/sorteo" element={<SorteoScreen />} />
          <Route path="*" element={<Navigate to="/client-portal" replace />} />
        </Route>
      </Routes>
    );
  }

  // Los repartidores tienen modo dual: entran como cliente por defecto, pero pueden cambiar a su portal
  if (user.role === 'repartidor') {
    return (
      <Routes>
        {/* PANTALLA 1 SIEMPRE LIBRE, INCLUSO CON SESIÓN ACTIVA */}
        <Route path="/" element={<DirectoryScreen />} />
        <Route path="/tiendas" element={<DirectoryScreen />} />
        
        <Route element={<ProtectedRoute><Layout /></ProtectedRoute>}>
          <Route path="/driver-gate" element={<DriverOrClientGate />} />
          <Route path="/client-portal" element={<ClientPortal />} />
          <Route path="/catalogo" element={<PublicCatalogScreen />} />
          <Route path="/repartidor" element={<DriverPortalScreen />} />
          <Route path="*" element={<Navigate to="/driver-gate" replace />} />
        </Route>
      </Routes>
    );
  }

  const adminRoles = ['admin', 'superadmin', 'dueno', 'supervisor', 'cajero'];
  if (!adminRoles.includes(user.role)) {
    return (
      <Routes>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    );
  }

  return (
    <Routes>
      <Route path="/tiendas" element={<DirectoryScreen />} />
      <Route path="/" element={<ProtectedRoute><Layout /></ProtectedRoute>}>
        <Route index element={<DashboardScreen />} />
        <Route path="pos" element={<POSScreen />} />
        <Route path="inventory" element={<InventoryScreen />} />
        <Route path="history" element={<HistoryScreen />} />
        <Route path="clients" element={<ClientsScreen />} />
        <Route path="repartidores" element={<DriversScreen />} />
        <Route path="morosos" element={<MorososScreen />} />
        <Route path="purchases" element={<PurchasesScreen />} />
        <Route path="providers" element={<ProvidersScreen />} />
        <Route path="reports" element={<ReportsScreen />} />
        <Route path="closure" element={<ClosureScreen />} />
        <Route path="ai-market" element={<AIMarketScreen />} />
        <Route path="public-market" element={<PublicMarketScreen />} />
        <Route path="sorteo" element={<SorteoScreen />} />
        <Route path="vendor-portal" element={<VendorPortalScreen />} />
        <Route path="approval" element={<ApprovalScreen />} />
        <Route path="ledger" element={<LedgerScreen />} />
        <Route path="accounting" element={<AccountingScreen />} />
        <Route path="settings" element={<SettingsScreen />} />
        <Route path="profile" element={<ProfileScreen />} />
        <Route path="despacho" element={<DispatchScreen />} />
        <Route path="catalogo" element={<PublicCatalogScreen />} />
        <Route path="client-portal" element={<ClientPortal />} />
        <Route path="superadmin" element={user.role === 'superadmin' ? <SuperAdminScreen /> : <Navigate to="/" replace />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  );
};

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <ToastProvider>
          <ErrorBoundary>
            <Suspense fallback={<LoadingFallback />}>
              <Root />
            </Suspense>
          </ErrorBoundary>
        </ToastProvider>
      </AuthProvider>
    </BrowserRouter>
  );
}
