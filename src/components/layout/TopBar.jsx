import React, { useState, useEffect } from 'react';
import { SlidersHorizontal, Moon, Sun } from 'lucide-react';
import { useTheme } from '../../context/ThemeContext';
import { useLocation } from 'react-router-dom';
import AppearanceDrawer from './AppearanceDrawer';
import J4BLogo from '../common/J4BLogo';

const TopBar = () => {
  const [isAppearanceOpen, setIsAppearanceOpen] = useState(false);
  const { theme, toggleTheme } = useTheme();
  const location = useLocation();

  useEffect(() => {
    setIsAppearanceOpen(false);
  }, [location.pathname]);

  return (
    <>
      <header className="fixed top-0 left-0 right-0 h-16 bg-white dark:bg-black border-b border-gray-200 dark:border-gray-800 z-40 flex items-center justify-between px-3 sm:px-4">
        {/* Left Button - Settings (Appearance) */}
        <button
          onClick={() => setIsAppearanceOpen(true)}
          className="p-2 -ml-1 rounded-full text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-900 transition-colors shrink-0 z-10"
          aria-label="Adjust Settings"
        >
          <SlidersHorizontal className="w-5 h-5" />
        </button>

        {/* Center - Main Brand Logo (No click action) */}
        <div className="absolute left-1/2 -translate-x-1/2 flex items-center justify-center p-1.5 select-none">
          <J4BLogo className="w-9 h-9 sm:w-10 sm:h-10 text-brand transition-colors duration-300 pointer-events-none" />
        </div>

        {/* Right Button - Theme Switch */}
        <button
          onClick={toggleTheme}
          className="p-2 -mr-1 rounded-full text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-900 transition-colors shrink-0 z-10"
          aria-label="Toggle Theme"
        >
          {theme === 'dark' ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
        </button>
      </header>

      <AppearanceDrawer isOpen={isAppearanceOpen} onClose={() => setIsAppearanceOpen(false)} />
    </>
  );
};

export default TopBar;
