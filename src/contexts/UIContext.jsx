// src/contexts/UIContext.jsx
'use client';
import React, { createContext, useState, useContext, useMemo, useCallback } from 'react';
import { translations } from '@/lib/translations';

const UIContext = createContext(null);

export const useUI = () => useContext(UIContext);

export const UIProvider = ({ children }) => {
  const [lang, setLang] = useState('cs');

  const toggleLang = useCallback(() => {
    setLang(prev => prev === 'cs' ? 'en' : 'cs');
  }, []);

  const t = useMemo(() => translations[lang] || translations.cs, [lang]);

  const value = useMemo(() => ({
    lang, setLang, toggleLang, t
  }), [lang, toggleLang, t]);

  return <UIContext.Provider value={value}>{children}</UIContext.Provider>;
};
