import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import App from './App.tsx';
import './index.css';

import { AuthProvider } from './context/AuthContext';
import { ToastProvider } from './context/ToastContext';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <BrowserRouter>
      <AuthProvider>
        <ToastProvider>
          <App />
        </ToastProvider>
      </AuthProvider>
    </BrowserRouter>
  </React.StrictMode>,
);

// Register PWA service worker lazily after load so Workbox precaching never blocks FCP/LCP/TBT
if (import.meta.env.PROD && import.meta.env.MODE !== 'mobile' && 'serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    window.setTimeout(() => {
      navigator.serviceWorker.register('/sw.js', { scope: '/' }).catch(() => {});
    }, 6500);
  }, { once: true });
}
