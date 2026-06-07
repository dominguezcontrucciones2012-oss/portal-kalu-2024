import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './contexts/AuthProvider';
import Layout from './components/layout/Layout';
import DashboardScreen from './components/Dashboard/DashboardScreen';
import POSScreen from './components/POS/POSScreen';
import InventoryScreen from './components/Inventory/InventoryScreen';
import ClientsScreen from './components/Clients/ClientsScreen';
import MorososScreen from './components/Clients/MorososScreen';
import LedgerScreen from './components/Ledger/LedgerScreen';
import HistoryScreen from './components/History/HistoryScreen';
import ReportsScreen from './components/Reports/ReportsScreen';
import ClientPortal from './components/Portal/ClientPortalScreen';
import ClosureScreen from './components/Account/ClosureScreen';
import PurchasesScreen from './components/Inventory/PurchasesScreen';
import ProvidersScreen from './components/Inventory/ProvidersScreen';
import ProfileScreen from './components/Account/ProfileScreen';
import LoginScreen from './components/Auth/LoginScreen';
import AccountingScreen from './components/Ledger/AccountingScreen';
import SettingsScreen from './components/Account/SettingsScreen';
import AIMarketScreen from './components/AI/AIMarketScreen';
import PublicMarketScreen from './components/Market/PublicMarketScreen';
import VendorPortalScreen from './components/Market/VendorPortalScreen';
import ApprovalScreen from './components/Market/ApprovalScreen';
import PublicCatalogScreen from './components/Portal/PublicCatalogScreen';
import DispatchScreen from './components/Dispatch/DispatchScreen';
import DriverPortalScreen from './components/Portal/DriverPortalScreen';
import { ToastProvider } from './contexts/ToastProvider';

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

import { autoCancelExpiredOrders } from './lib/dbUtils';

export default function App() {
  React.useEffect(() => {
    autoCancelExpiredOrders();
  }, []);

  return (
    <BrowserRouter>
      <AuthProvider>
        <ToastProvider>
          <Root />
        </ToastProvider>
      </AuthProvider>
    </BrowserRouter>
  );
}
