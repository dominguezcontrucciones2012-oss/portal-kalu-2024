import React, { Suspense, lazy } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './contexts/AuthProvider';
import Layout from './components/layout/Layout';
import { ToastProvider } from './contexts/ToastProvider';
import ErrorBoundary from './components/common/ErrorBoundary';

// Helper for ChunkLoadError (deployment cache issues)
const lazyRetry = (componentImport: () => Promise<any>) => {
  return lazy(async () => {
    const hasRefreshed = JSON.parse(
      window.sessionStorage.getItem('retry-lazy-refreshed') || 'false'
    );
    try {
      const component = await componentImport();
      window.sessionStorage.setItem('retry-lazy-refreshed', 'false');
      return component;
    } catch (error) {
      if (!hasRefreshed) {
        window.sessionStorage.setItem('retry-lazy-refreshed', 'true');
        window.location.reload();
        // Return a never-resolving promise to stop React from crashing while reloading
        return new Promise(() => {});
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
const LoginScreen = lazyRetry(() => import('./components/Auth/LoginScreen'));
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

const LoadingFallback = () => (
  <div className="h-screen w-full bg-[#0f172a] flex items-center justify-center">
    <div className="w-12 h-12 border-4 border-white/10 border-t-[#3498db] rounded-full animate-spin" />
  </div>
);

const Root = () => {
  const { user, loading } = useAuth();

  // Recarga automática al volver del segundo plano (después de 4 horas)
  React.useEffect(() => {
    let backgroundTime = 0;
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'hidden') {
        backgroundTime = Date.now();
      } else if (document.visibilityState === 'visible') {
        const timeAway = Date.now() - backgroundTime;
        if (backgroundTime > 0 && timeAway > 4 * 60 * 60 * 1000) {
          console.log("Reabriendo la app después de 4h: Recargando para actualizar datos...");
          window.location.reload();
        }
      }
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, []);

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
        <Route path="/catalogo" element={<PublicCatalogScreen />} />
        <Route path="/sorteo" element={<SorteoScreen />} />
        <Route path="*" element={<LoginScreen />} />
      </Routes>
    );
  }

  // Restringir el acceso de los clientes para que no entren al panel administrativo
  if (user.role === 'cliente') {
    return (
      <Routes>
        <Route path="/" element={<Layout />}>
          <Route index element={<Navigate to="/client-portal" replace />} />
          <Route path="client-portal" element={<ClientPortal />} />
          <Route path="catalogo" element={<PublicCatalogScreen />} />
          <Route path="sorteo" element={<SorteoScreen />} />
          <Route path="*" element={<Navigate to="/client-portal" replace />} />
        </Route>
      </Routes>
    );
  }

  // Los repartidores tienen modo dual: entran como cliente por defecto, pero pueden cambiar a su portal
  if (user.role === 'repartidor') {
    return (
      <Routes>
        <Route path="/" element={<Layout />}>
          <Route index element={<DriverOrClientGate />} />
          <Route path="client-portal" element={<ClientPortal />} />
          <Route path="catalogo" element={<PublicCatalogScreen />} />
          <Route path="repartidor" element={<DriverPortalScreen />} />
          <Route path="*" element={<Navigate to="/client-portal" replace />} />
        </Route>
      </Routes>
    );
  }

  return (
    <Routes>
      <Route path="/" element={<Layout />}>
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
