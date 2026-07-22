import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import translations from '../i18n/translations';
import { useAuth } from './AuthContext';
import { authAPI } from '../utils/api';

// This app is large enough that translating every single string across
// every dashboard is out of scope for one pass — instead this covers the
// navigation shell, common actions, and auth screens (the surfaces every
// user sees regardless of role), with a clean fallback to English for
// anything not yet translated. More keys can be added to i18n/translations
// incrementally without touching this file.
const LanguageContext = createContext(null);

export function LanguageProvider({ children }) {
  const { user, isAuthenticated } = useAuth() || {};
  const [language, setLanguageState] = useState(() => localStorage.getItem('mc_lang') || 'en');

  // Once logged in, prefer whatever the user saved on their profile —
  // keeps the choice consistent across devices, not just this browser.
  useEffect(() => {
    if (isAuthenticated && user?.preferredLanguage && user.preferredLanguage !== language) {
      setLanguageState(user.preferredLanguage);
      localStorage.setItem('mc_lang', user.preferredLanguage);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAuthenticated, user?.preferredLanguage]);

  const setLanguage = useCallback((code) => {
    setLanguageState(code);
    localStorage.setItem('mc_lang', code);
    if (isAuthenticated) {
      authAPI.updateProfile({ preferredLanguage: code }).catch(() => {});
    }
  }, [isAuthenticated]);

  const t = useCallback((key) => {
    return translations[language]?.[key] ?? translations.en[key] ?? key;
  }, [language]);

  return (
    <LanguageContext.Provider value={{ language, setLanguage, t }}>
      {children}
    </LanguageContext.Provider>
  );
}

export const useLanguage = () => useContext(LanguageContext);
