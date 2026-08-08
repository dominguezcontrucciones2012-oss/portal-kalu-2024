import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import { ErrorBoundary } from './components/ErrorBoundary.tsx';
import './index.css';

// El Service Worker se registra en index.html para máxima compatibilidad.
// Este archivo solo monta la app de React.

// 1. Inyección Offline Automática (Single-File)
if ((window as any).KALU_CONFIG) {
  const cfg = (window as any).KALU_CONFIG;
  localStorage.setItem('activeStoreId', cfg.storeId);
  localStorage.setItem('kalu_local_config', JSON.stringify(cfg));
}

const container = document.getElementById('root');
if (container) {
  createRoot(container).render(
    <StrictMode>
      <ErrorBoundary>
        <App />
      </ErrorBoundary>
    </StrictMode>,
  );
}
