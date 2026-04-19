import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import en from './locales/en.json';
import ur from './locales/ur.json';

/* ── Suppress the i18next Locize promo banner ───────────────────────────────
   The library calls this.logger.log() unconditionally regardless of debug:false.
   We provide a custom logger plugin that filters out that specific message.    */
const silentLogger = {
  type: 'logger' as const,
  log:   (...args: any[]) => {
    const msg = String(args[0] ?? '');
    if (msg.includes('i18next') || msg.includes('locize') || msg.includes('Locize')) return;
    // eslint-disable-next-line no-console
    console.log(...args);
  },
  warn:  (...args: any[]) => console.warn(...args),
  error: (...args: any[]) => console.error(...args),
};

i18n.use(silentLogger).use(initReactI18next).init({
  resources: {
    en: { translation: en },
    ur: { translation: ur },
  },
  lng: 'en',
  fallbackLng: 'en',
  interpolation: {
    escapeValue: false,
  },
  // Disable debug/info logs (suppresses the Locize promo message)
  debug: false,
});

// Listen to language changes to update document direction for RTL support
i18n.on('languageChanged', (lng) => {
  document.documentElement.dir = lng === 'ur' ? 'rtl' : 'ltr';
  document.documentElement.lang = lng;
});

export default i18n;
