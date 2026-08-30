import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import * as Sentry from "@sentry/react";
import App from './App.tsx';
import './index.css';

// ── Deploy-time cache buster & Service Worker Auto-Update ──────────────────────
// __APP_BUILD__ is injected by vite.config.ts as a build-time ISO timestamp.
// On every new deploy the value changes. If the user has an older cached copy,
// we detect the mismatch here, wipe SW caches, unregister stale workers, and
// perform a clean reload so users always run the latest version.
declare const __APP_BUILD__: string;
(function checkAppVersion() {
  const KEY = '__app_build__';
  const stored = localStorage.getItem(KEY);
  localStorage.setItem(KEY, __APP_BUILD__);

  if (stored && stored !== __APP_BUILD__) {
    // 1. Clear all service worker caches
    if ('caches' in window) {
      caches.keys().then(keys => {
        Promise.all(keys.map(k => caches.delete(k))).then(() => {
          // 2. Unregister stale workers
          if ('serviceWorker' in navigator) {
            navigator.serviceWorker.getRegistrations().then(regs => {
              Promise.all(regs.map(r => r.unregister())).then(() => {
                window.location.reload();
              });
            });
          } else {
            window.location.reload();
          }
        });
      });
      return;
    }
    window.location.reload();
  }
})();


Sentry.init({
  dsn: "https://400a0cc798e6379bc9bd89054b1a4ffe@o4511284242153472.ingest.de.sentry.io/4511284250738768",
  sendDefaultPii: true
});

/* Suppress the i18next Locize promotional banner.
   The library hardcodes a console.log regardless of debug:false. */
const _origLog = console.log.bind(console);
console.log = (...args: unknown[]) => {
  if (typeof args[0] === 'string' && args[0].includes('i18next')) return;
  _origLog(...args);
};

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
