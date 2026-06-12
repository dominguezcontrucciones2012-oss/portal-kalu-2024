import React, { Suspense, lazy } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './contexts/AuthProvider';
import Layout from './components/layout/Layout';
import { ToastProvider } from './contexts/ToastProvider';

const DashboardScreen = lazy(() => import('./components/Dashboard/DashboardScreen'));
const POSScreen = lazy(() => import('./components/POS/POSScreen'));
const InventoryScreen = lazy(() => import('./components/Inventory/InventoryScreen'));
const ClientsScreen = lazy(() => import('./components/Clients/ClientsScreen'));
const MorososScreen = lazy(() => import('./components/Clients/MorososScreen'));
const LedgerScreen = lazy(() => import('./components/Ledger/LedgerScreen'));
const HistoryScreen = lazy(() => import('./components/History/HistoryScreen'));
const ReportsScreen = lazy(() => import('./components/Reports/ReportsScreen'));
const ClientPortal = lazy(() => import('./components/Portal/ClientPortalScreen'));
const ClosureScreen = lazy(() => import('./components/Account/ClosureScreen'));
const PurchasesScreen = lazy(() => import('./components/Inventory/PurchasesScreen'));
const ProvidersScreen = lazy(() => import('./components/Inventory/ProvidersScreen'));
const ProfileScreen = lazy(() => import('./components/Account/ProfileScreen'));
const LoginScreen = lazy(() => import('./components/Auth/LoginScreen'));
const AccountingScreen = lazy(() => import('./components/Ledger/AccountingScreen'));
const SettingsScreen = lazy(() => import('./components/Account/SettingsScreen'));
const AIMarketScreen = lazy(() => import('./components/AI/AIMarketScreen'));
const PublicMarketScreen = lazy(() => import('./components/Market/PublicMarketScreen'));
const VendorPortalScreen = lazy(() => import('./components/Market/VendorPortalScreen'));
const ApprovalScreen = lazy(() => import('./components/Market/ApprovalScreen'));
const PublicCatalogScreen = lazy(() => import('./components/Portal/PublicCatalogScreen'));
const DispatchScreen = lazy(() => import('./components/Dispatch/DispatchScreen'));
const DriverPortalScreen = lazy(() => import('./components/Portal/DriverPortalScreen'));

const LoadingFallback = () => (
  <div className="h-screen w-full bg-[#0f172a] flex items-center justify-center">
    <div className="w-12 h-12 border-4 border-white/10 border-t-[#3498db] rounded-full animate-spin" />
  </div>
);

const Root = () => {
  const { user, loading } = useAuth();

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
          <Route path="*" element={<Navigate to="/client-portal" replace />} />
        </Route>
      </Routes>
    );
  }

  // Restringir el acceso de los repartidores para que solo vean su app
  if (user.role === 'repartidor') {
    return (
      <Routes>
        <Route path="/" element={<Layout />}>
          <Route index element={<Navigate to="/repartidor" replace />} />
          <Route path="repartidor" element={<DriverPortalScreen />} />
          <Route path="*" element={<Navigate to="/repartidor" replace />} />
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
        <Route path="morosos" element={<MorososScreen />} />
        <Route path="purchases" element={<PurchasesScreen />} />
        <Route path="providers" element={<ProvidersScreen />} />
        <Route path="reports" element={<ReportsScreen />} />
        <Route path="closure" element={<ClosureScreen />} />
        <Route path="ai-market" element={<AIMarketScreen />} />
        <Route path="public-market" element={<PublicMarketScreen />} />
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
          <Suspense fallback={<LoadingFallback />}>
            <Root />
          </Suspense>
        </ToastProvider>
      </AuthProvider>
    </BrowserRouter>
  );
}
