import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import App from './App';
import NativeShell from './components/NativeShell';
import PendingUploadPill from './components/PendingUploadPill';
import { startOfflineSync } from './lib/offlineSync';
import './index.css';

// Uploads days saved while offline, when the app starts and whenever the connection returns.
startOfflineSync();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      <AuthProvider>
        <NativeShell />
        <App />
        <PendingUploadPill />
      </AuthProvider>
    </BrowserRouter>
  </StrictMode>,
);

// Offline shell. Production web only (public/sw.js caches static files, never data; the Capacitor
// apps already ship their files on the device).
if ('serviceWorker' in navigator && import.meta.env.PROD && /^https?:$/.test(location.protocol)) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch(() => {
      // No worker (private window, blocked): the app works as before.
    });
  });
}
