import React, { createContext, useContext, useState, useEffect } from 'react';

const ThemeContext = createContext();

export const ThemeProvider = ({ children }) => {
  const [theme, setTheme] = useState(() => {
    const saved = localStorage.getItem('jfb_theme');
    return saved ? saved : 'dark';
  });

  const [colorScheme, setColorScheme] = useState(() => {
    const saved = localStorage.getItem('jfb_color');
    return saved ? saved : '#f97316'; // Default to Orange
  });

  useEffect(() => {
    localStorage.setItem('jfb_theme', theme);
    if (theme === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [theme]);

  useEffect(() => {
    localStorage.setItem('jfb_color', colorScheme);
    document.documentElement.style.setProperty('--brand-color', colorScheme);
  }, [colorScheme]);

  const toggleTheme = () => {
    setTheme(prev => (prev === 'light' ? 'dark' : 'light'));
  };

  return (
    <ThemeContext.Provider value={{ theme, setTheme, toggleTheme, colorScheme, setColorScheme }}>
      {children}
    </ThemeContext.Provider>
  );
};

export const useTheme = () => useContext(ThemeContext);
