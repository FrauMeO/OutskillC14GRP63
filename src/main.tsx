import { StrictMode } from 'react';
import { createRoot, hydrateRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import App from './App';
import NativeShell from './components/NativeShell';
import PendingUploadPill from './components/PendingUploadPill';
import { startOfflineSync } from './lib/offlineSync';
import './index.css';

// Uploads days saved while offline, when the app starts and whenever the connection returns.
startOfflineSync();

const app = (
  <StrictMode>
    <BrowserRouter>
      <AuthProvider>
        <NativeShell />
        <App />
        <PendingUploadPill />
      </AuthProvider>
    </BrowserRouter>
  </StrictMode>
);

// The public pages arrive as real HTML (scripts/prerender.mjs), so the app hydrates on top of that text.
// Every other route arrives as the empty shell and renders as before.
const rootElement = document.getElementById('root')!;
if (rootElement.hasChildNodes()) hydrateRoot(rootElement, app);
else createRoot(rootElement).render(app);

// Offline shell. Production web only (public/sw.js caches static files, never data; the Capacitor
// apps already ship their files on the device).
if ('serviceWorker' in navigator && import.meta.env.PROD && /^https?:$/.test(location.protocol)) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch(() => {
      // No worker (private window, blocked): the app works as before.
    });
  });
}
