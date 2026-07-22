import React, { createContext, useContext, useState, useEffect } from 'react';

// Dark mode is applied via CSS custom-property overrides in global.css
// (under `html[data-theme="dark"]`) plus a small set of per-page overrides
// for pages built with inline styles rather than the shared .card/.btn
// classes. Persisted per-browser (not per-account) since it's a display
// preference, not patient data.
const ThemeContext = createContext(null);

export function ThemeProvider({ children }) {
  const [theme, setTheme] = useState(() => localStorage.getItem('mc_theme') || 'light');

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('mc_theme', theme);
  }, [theme]);

  const toggleTheme = () => setTheme(t => t === 'dark' ? 'light' : 'dark');

  return (
    <ThemeContext.Provider value={{ theme, setTheme, toggleTheme, isDark: theme === 'dark' }}>
      {children}
    </ThemeContext.Provider>
  );
}

export const useTheme = () => useContext(ThemeContext);
