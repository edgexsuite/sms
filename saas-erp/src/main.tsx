import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import * as Sentry from "@sentry/react";
import App from './App.tsx';
import './index.css';

// ── Deploy-time cache buster ──────────────────────────────────────────────────
// __APP_BUILD__ is injected by vite.config.ts as a build-time ISO timestamp.
// On every new deploy the value changes. If the user has an older cached copy
// we detect the mismatch here, wipe SW caches, and do one hard reload so they
// always run the latest code without needing to manually clear the browser.
declare const __APP_BUILD__: string;
(function checkAppVersion() {
  const KEY = '__app_build__';
  const stored = localStorage.getItem(KEY);
  localStorage.setItem(KEY, __APP_BUILD__);           // always update to latest
  if (stored && stored !== __APP_BUILD__) {
    // Clear all service-worker caches so stale assets don't persist
    if ('caches' in window) {
      caches.keys().then(keys => keys.forEach(k => caches.delete(k)));
    }
    window.location.reload();                          // single reload — key already updated above
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
