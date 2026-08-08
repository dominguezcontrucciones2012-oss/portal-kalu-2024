/// <reference types="vite/client" />
import React, { Suspense, lazy } from 'react';
import { BrowserRouter, MemoryRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './contexts/AuthProvider';
import Layout from './components/layout/Layout';
import { ToastProvider } from './contexts/ToastProvider';
import ErrorBoundary from './components/common/ErrorBoundary';
import { auth } from './lib/firebase';
import { AlertTriangle, RefreshCw } from 'lucide-react';

const lazyRetry = (componentImport: () => Promise<any>) => {
  return lazy(async () => {
    let retries = 3;
    let delay = 1000; // start with 1 second delay

    while (retries > 0) {
      try {
        // Aumentamos el timeout a 45 segundos para redes móviles lentas (CANTV/Digitel)
        const timeoutPromise = new Promise((_, reject) => {
          setTimeout(() => reject(new Error('Chunk load timeout')), 45000);
        });
        const component = await Promise.race([componentImport(), timeoutPromise]);
        
        // Si tiene éxito, reseteamos cualquier bandera de error previo
        window.sessionStorage.setItem('retry-lazy-refreshed', 'false');
        return component;
      } catch (error) {
        retries--;
        if (retries === 0) {
          // Fallback final: Si se acaban los reintentos, ahí sí forzamos recarga
          const hasRefreshed = JSON.parse(
            window.sessionStorage.getItem('retry-lazy-refreshed') || 'false'
          );
          if (!hasRefreshed) {
            window.sessionStorage.setItem('retry-lazy-refreshed', 'true');
            if ('caches' in window) {
              caches.keys().then(names => {
                for (let name of names) caches.delete(name);
              });
            }
            window.location.reload();
            setTimeout(() => { window.location.href = window.location.href; }, 500);
          }
          throw error;
        }
        // Esperamos antes del siguiente intento
        await new Promise(resolve => setTimeout(resolve, delay));
        delay *= 2; // backoff exponencial (1s, 2s, 4s)
      }
    }
    throw new Error("No se pudo cargar el módulo");
  });
};

const DashboardScreen = lazyRetry(() => import('./components/Dashboard/DashboardScreen'));
const POSScreen = lazyRetry(() => import('./components/POS/POSScreen'));
const InventoryScreen = lazyRetry(() => import('./components/Inventory/InventoryScreen'));
const ClientsScreen = lazyRetry(() => import('./components/Clients/ClientsScreen'));
const HistoryScreen = lazyRetry(() => import('./components/History/HistoryScreen'));
const ReportsScreen = lazyRetry(() => import('./components/Reports/ReportsScreen'));
const ClosureScreen = lazyRetry(() => import('./components/Account/ClosureScreen'));
const PurchasesScreen = lazyRetry(() => import('./components/Inventory/PurchasesScreen'));
const ProvidersScreen = lazyRetry(() => import('./components/Inventory/ProvidersScreen'));
const ProfileScreen = lazyRetry(() => import('./components/Account/ProfileScreen'));
const ClientLoginScreen = lazyRetry(() => import('./components/Auth/ClientLoginScreen'));
const AdminLoginScreen = lazyRetry(() => import('./components/Auth/AdminLoginScreen'));
const SettingsScreen = lazyRetry(() => import('./components/Account/SettingsScreen'));
const DirectoryScreen = lazyRetry(() => import('./components/Portal/DirectoryScreen'));

// Premium Components (Stripped in Offline Mode by Rollup Dead Code Elimination)
const DriversScreen = lazyRetry(() => import('./components/Drivers/DriversScreen'));
const MorososScreen = lazyRetry(() => import('./components/Clients/MorososScreen'));
const LedgerScreen = lazyRetry(() => import('./components/Ledger/LedgerScreen'));
const ClientPortal = lazyRetry(() => import('./components/Portal/ClientPortalScreen'));
const AccountingScreen = lazyRetry(() => import('./components/Ledger/AccountingScreen'));
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

const LoadingFallback = () => (
  <div className="h-screen w-full bg-[#0f172a] flex items-center justify-center">
    <div className="relative w-12 h-12 flex items-center justify-center">
      <div className="absolute inset-0 animate-[spin_2s_linear_infinite] flex items-center justify-center">
        <div className="relative w-12 h-12 animate-[explode_1.5s_ease-in-out_infinite]">
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-3 h-3 bg-emerald-400 rounded-full shadow-[0_0_12px_#34d399]"></div>
          <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-3 h-3 bg-emerald-400 rounded-full shadow-[0_0_12px_#34d399]"></div>
          <div className="absolute left-0 top-1/2 -translate-y-1/2 w-3 h-3 bg-emerald-400 rounded-full shadow-[0_0_12px_#34d399]"></div>
          <div className="absolute right-0 top-1/2 -translate-y-1/2 w-3 h-3 bg-emerald-400 rounded-full shadow-[0_0_12px_#34d399]"></div>
        </div>
      </div>
      <style>{`
        @keyframes explode {
          0%, 100% { transform: scale(1); }
          50% { transform: scale(0.1); filter: brightness(2) drop-shadow(0 0 15px #34d399); }
        }
      `}</style>
    </div>
  </div>
);




const adminRoles = ['admin', 'superadmin', 'dueno', 'supervisor', 'cajero'];

const ProtectedRoute = ({ children, allowedRoles }: { children: React.ReactNode, allowedRoles?: string[] }) => {
  const { user } = useAuth();
  if (!user) {
    const isStrictAdminRoute = allowedRoles && allowedRoles.every(r => adminRoles.includes(r));
    if (isStrictAdminRoute || window.location.hostname.includes('admin')) {
      return <Navigate to="/admin/login" replace />;
    }
    return <Navigate to="/login" replace />;
  }
  
  if (allowedRoles && !allowedRoles.includes(user.role)) {
    if (user.role === 'superadmin' || user.role === 'dueno') return <Navigate to="/superadmin" replace />;
    if (user.role === 'cliente') return <Navigate to="/client-portal" replace />;
    if (user.role === 'repartidor') return <Navigate to="/driver-gate" replace />;
    return <Navigate to="/dashboard" replace />;
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
    return <LoadingFallback />;
  }

  return (
    <Routes>
      {/* Public / Hybrid Routes */}
      <Route path="/" element={
        !user ? (window.location.hostname.includes('admin') ? <AdminLoginScreen /> : <DirectoryScreen />) :
        (user.role === 'superadmin' || user.role === 'dueno') ? <Navigate to="/superadmin" replace /> :
        user.role === 'cliente' ? <DirectoryScreen /> :
        user.role === 'repartidor' ? <Navigate to="/driver-gate" replace /> :
        <Navigate to="/dashboard" replace />
      } />
      <Route path="/tiendas" element={<DirectoryScreen />} />
      <Route path="/catalogo" element={<PublicCatalogScreen />} />
      <Route path="/login" element={
        user ? (
          (user.role === 'superadmin' || user.role === 'dueno') ? <Navigate to="/superadmin" replace /> :
          user.role === 'repartidor' ? <Navigate to="/driver-gate" replace /> :
          user.role === 'cliente' ? <Navigate to="/client-portal" replace /> :
          <Navigate to="/dashboard" replace />
        ) : <ClientLoginScreen />
      } />
      <Route path="/admin/login" element={
        user ? (
          (user.role === 'superadmin' || user.role === 'dueno') ? <Navigate to="/superadmin" replace /> :
          <Navigate to="/dashboard" replace />
        ) : <AdminLoginScreen />
      } />
      <Route path="/sentings" element={
        user ? (
          (user.role === 'superadmin' || user.role === 'dueno') ? <Navigate to="/superadmin" replace /> :
          <Navigate to="/dashboard" replace />
        ) : <AdminLoginScreen />
      } />

      {/* Isolated Master Route */}
      <Route path="/superadmin" element={<ProtectedRoute allowedRoles={['superadmin', 'dueno']}><SuperAdminScreen /></ProtectedRoute>} />

      {/* Unified Protected Layout Tree */}
      <Route element={<ProtectedRoute><Layout /></ProtectedRoute>}>
        
        {/* Client & Shared */}
        <Route path="/client-portal" element={<ProtectedRoute allowedRoles={['cliente', 'repartidor', ...adminRoles]}><ClientPortal /></ProtectedRoute>} />
        <Route path="/sorteo" element={<SorteoScreen />} />
        
        {/* Driver */}
        <Route path="/driver-gate" element={<ProtectedRoute allowedRoles={['repartidor', ...adminRoles]}><DriverOrClientGate /></ProtectedRoute>} />
        <Route path="/repartidor" element={<ProtectedRoute allowedRoles={['repartidor', ...adminRoles]}><DriverPortalScreen /></ProtectedRoute>} />

        {/* Admin only */}
        <Route path="/dashboard" element={<ProtectedRoute allowedRoles={adminRoles}><DashboardScreen /></ProtectedRoute>} />
        <Route path="/pos" element={<ProtectedRoute allowedRoles={adminRoles}><POSScreen /></ProtectedRoute>} />
        <Route path="/inventory" element={<ProtectedRoute allowedRoles={adminRoles}><InventoryScreen /></ProtectedRoute>} />
        <Route path="/history" element={<ProtectedRoute allowedRoles={adminRoles}><HistoryScreen /></ProtectedRoute>} />
        <Route path="/clients" element={<ProtectedRoute allowedRoles={adminRoles}><ClientsScreen /></ProtectedRoute>} />
        <Route path="/repartidores" element={<ProtectedRoute allowedRoles={adminRoles}><DriversScreen /></ProtectedRoute>} />
        <Route path="/morosos" element={<ProtectedRoute allowedRoles={adminRoles}><MorososScreen /></ProtectedRoute>} />
        <Route path="/purchases" element={<ProtectedRoute allowedRoles={adminRoles}><PurchasesScreen /></ProtectedRoute>} />
        <Route path="/providers" element={<ProtectedRoute allowedRoles={adminRoles}><ProvidersScreen /></ProtectedRoute>} />
        <Route path="/reports" element={<ProtectedRoute allowedRoles={adminRoles}><ReportsScreen /></ProtectedRoute>} />
        <Route path="/closure" element={<ProtectedRoute allowedRoles={adminRoles}><ClosureScreen /></ProtectedRoute>} />
        <Route path="/ai-market" element={<ProtectedRoute allowedRoles={adminRoles}><AIMarketScreen /></ProtectedRoute>} />
        <Route path="/public-market" element={<ProtectedRoute allowedRoles={adminRoles}><PublicMarketScreen /></ProtectedRoute>} />
        <Route path="/vendor-portal" element={<ProtectedRoute allowedRoles={adminRoles}><VendorPortalScreen /></ProtectedRoute>} />
        <Route path="/approval" element={<ProtectedRoute allowedRoles={adminRoles}><ApprovalScreen /></ProtectedRoute>} />
        <Route path="/ledger" element={<ProtectedRoute allowedRoles={adminRoles}><LedgerScreen /></ProtectedRoute>} />
        <Route path="/accounting" element={<ProtectedRoute allowedRoles={adminRoles}><AccountingScreen /></ProtectedRoute>} />
        <Route path="/settings" element={<ProtectedRoute allowedRoles={adminRoles}><SettingsScreen /></ProtectedRoute>} />
        <Route path="/profile" element={<ProtectedRoute allowedRoles={adminRoles}><ProfileScreen /></ProtectedRoute>} />
        <Route path="/despacho" element={<ProtectedRoute allowedRoles={adminRoles}><DispatchScreen /></ProtectedRoute>} />

        {/* Catch-all Protectivo */}
        <Route path="*" element={
          !user ? <Navigate to="/login" replace /> :
          (user.role === 'superadmin' || user.role === 'dueno') ? <Navigate to="/superadmin" replace /> :
          user.role === 'cliente' ? <Navigate to="/client-portal" replace /> :
          user.role === 'repartidor' ? <Navigate to="/driver-gate" replace /> :
          <Navigate to="/dashboard" replace />
        } />
      </Route>
    </Routes>
  );
};

export default function App() {
  const Router = BrowserRouter;

  return (
    <Router>
      <AuthProvider>
        <ToastProvider>
          <ErrorBoundary>
            <Suspense fallback={<LoadingFallback />}>
              <Root />
            </Suspense>
          </ErrorBoundary>
        </ToastProvider>
      </AuthProvider>
    </Router>
  );
}
