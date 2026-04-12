import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';

export type ThemeName = 'light' | 'midnight' | 'forest';

type ThemeTokens = Record<string, string>;

interface ThemeContextValue {
  theme: ThemeName;
  setTheme: (theme: ThemeName) => void;
  cycleTheme: () => void;
}

const THEME_STORAGE_KEY = 'school-saas-theme';
const THEME_ORDER: ThemeName[] = ['light', 'midnight', 'forest'];
const THEME_TOKENS: Record<ThemeName, ThemeTokens> = {
  light: {
    '--app-bg': '#f8fafc',
    '--surface': '#ffffff',
    '--surface-muted': '#f8fafc',
    '--border-strong': '#e5e7eb',
    '--border-soft': '#eef2f7',
    '--text-strong': '#111827',
    '--text-secondary': '#4b5563',
    '--text-muted': '#6b7280',
    '--sidebar-bg': '#ffffff',
    '--topbar-bg': '#ffffff',
    '--brand': 'linear-gradient(135deg, #2563eb, #1d4ed8)',
    '--brand-contrast': '#ffffff',
    '--nav-hover': '#f3f4f6',
    '--nav-active-bg': '#dbeafe',
    '--nav-active-text': '#1d4ed8',
  },
  midnight: {
    '--app-bg': '#0b1120',
    '--surface': '#111827',
    '--surface-muted': '#0f172a',
    '--border-strong': '#253045',
    '--border-soft': '#1f2937',
    '--text-strong': '#e5eefb',
    '--text-secondary': '#cbd5e1',
    '--text-muted': '#94a3b8',
    '--sidebar-bg': '#0f172a',
    '--topbar-bg': '#0f172a',
    '--brand': 'linear-gradient(135deg, #38bdf8, #2563eb)',
    '--brand-contrast': '#eff6ff',
    '--nav-hover': '#172036',
    '--nav-active-bg': 'rgba(56, 189, 248, 0.15)',
    '--nav-active-text': '#7dd3fc',
  },
  forest: {
    '--app-bg': '#eff7f1',
    '--surface': '#f8fffa',
    '--surface-muted': '#eef8f1',
    '--border-strong': '#cfe3d4',
    '--border-soft': '#dcecdf',
    '--text-strong': '#173126',
    '--text-secondary': '#305244',
    '--text-muted': '#537062',
    '--sidebar-bg': '#f6fff8',
    '--topbar-bg': '#f8fffa',
    '--brand': 'linear-gradient(135deg, #15803d, #166534)',
    '--brand-contrast': '#f0fdf4',
    '--nav-hover': '#e7f4ea',
    '--nav-active-bg': '#d8efde',
    '--nav-active-text': '#166534',
  },
};

const ThemeContext = createContext<ThemeContextValue>({
  theme: 'light',
  setTheme: () => {},
  cycleTheme: () => {},
});

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setThemeState] = useState<ThemeName>(() => {
    const stored = localStorage.getItem(THEME_STORAGE_KEY) as ThemeName | null;
    return stored && THEME_ORDER.includes(stored) ? stored : 'light';
  });

  useEffect(() => {
    const root = document.documentElement;
    const tokens = THEME_TOKENS[theme];

    root.dataset.theme = theme;
    (Object.entries(tokens) as Array<[string, string]>).forEach(([token, value]) => {
      root.style.setProperty(token, value);
    });
    document.body.style.backgroundColor = tokens['--app-bg'];
    document.body.style.color = tokens['--text-strong'];
    localStorage.setItem(THEME_STORAGE_KEY, theme);
  }, [theme]);

  const value = useMemo(() => ({
    theme,
    setTheme: (nextTheme: ThemeName) => setThemeState(nextTheme),
    cycleTheme: () => {
      const currentIndex = THEME_ORDER.indexOf(theme);
      setThemeState(THEME_ORDER[(currentIndex + 1) % THEME_ORDER.length]);
    },
  }), [theme]);

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  return useContext(ThemeContext);
}
