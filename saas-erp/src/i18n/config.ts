import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import en from './locales/en.json';
import ur from './locales/ur.json';

i18n.use(initReactI18next).init({
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
