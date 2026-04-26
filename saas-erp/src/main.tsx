import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import * as Sentry from "@sentry/react";
import App from './App.tsx';
import './index.css';

Sentry.init({
  dsn: "https://400a0cc798e6379bc9bd89054b1a4ffe@o4511284242153472.ingest.de.sentry.io/4511284250738768",
  sendDefaultPii: true
});

/* Suppress the i18next Locize promotional banner in production.
   The library hardcodes a console.log regardless of debug:false. */
if (import.meta.env.PROD) {
  const _origLog = console.log.bind(console);
  console.log = (...args: unknown[]) => {
    if (typeof args[0] === 'string' && args[0].includes('i18next')) return;
    _origLog(...args);
  };
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
