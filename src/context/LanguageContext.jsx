import React, { createContext, useContext, useState, useEffect } from 'react';
import en from '../data/translations/en.json';
import bn from '../data/translations/bn.json';
import ja from '../data/translations/ja.json';

const translations = { en, bn, ja };

const LanguageContext = createContext();

export const LanguageProvider = ({ children }) => {
  const [language, setLanguage] = useState(() => {
    const saved = localStorage.getItem('jfb_website_language');
    return saved ? saved : 'en'; // Default to English
  });

  const [fontFamily, setFontFamily] = useState(() => {
    const initialLang = localStorage.getItem('jfb_website_language') || 'en';
    const saved = localStorage.getItem(`jfb_website_fontFamily_${initialLang}`);
    return saved ? saved : (initialLang === 'bn' ? 'Hind Siliguri' : 'System');
  });

  useEffect(() => {
    localStorage.setItem('jfb_website_language', language);
  }, [language]);

  useEffect(() => {
    localStorage.setItem(`jfb_website_fontFamily_${language}`, fontFamily);
    if (fontFamily === 'System') {
      document.body.style.fontFamily = '';
    } else {
      const fontId = `font-${fontFamily.replace(/\s+/g, '-')}`;
      if (!document.getElementById(fontId)) {
        const link = document.createElement('link');
        link.id = fontId;
        link.rel = 'stylesheet';
        link.href = `https://fonts.googleapis.com/css2?family=${fontFamily.replace(/\s+/g, '+')}:wght@300;400;500;600;700&display=swap`;
        document.head.appendChild(link);
      }
      document.body.style.fontFamily = `'${fontFamily}', sans-serif`;
    }
  }, [fontFamily]);

  const changeLanguage = (newLang) => {
    setLanguage(newLang);
    const savedFont = localStorage.getItem(`jfb_website_fontFamily_${newLang}`);
    setFontFamily(savedFont ? savedFont : (newLang === 'bn' ? 'Hind Siliguri' : 'System'));
  };

  const t = (keyPath) => {
    const keys = keyPath.split('.');
    let current = translations[language];
    for (const key of keys) {
      if (!current || current[key] === undefined) {
        console.warn(`Translation key not found: ${keyPath}`);
        return keys[keys.length - 1]; // Return just the word instead of 'group.word'
      }
      current = current[key];
    }
    return current;
  };

  const getTranslated = (obj) => {
    if (!obj) return '';
    if (typeof obj === 'string') return obj;
    return obj[language] || obj['en'] || obj['bn'] || '';
  };

  return (
    <LanguageContext.Provider value={{ language, setLanguage: changeLanguage, t, getTranslated, fontFamily, setFontFamily }}>
      {children}
    </LanguageContext.Provider>
  );
};

export const useLanguage = () => useContext(LanguageContext);
