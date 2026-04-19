import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';

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
