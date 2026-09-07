import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { MdClose, MdDarkMode, MdLightMode, MdPalette, MdChevronRight, MdLanguage, MdCheck } from 'react-icons/md';
import { useLanguage } from '../../context/LanguageContext';
import { useTheme } from '../../context/ThemeContext';
import J4BLogo from '../common/J4BLogo';

const COLORS = [
  { name: 'Red', value: '#dc2626' },
  { name: 'Orange', value: '#f97316' },
  { name: 'Emerald', value: '#10b981' },
  { name: 'Ocean', value: '#0284c7' },
  { name: 'Indigo', value: '#6366f1' },
  { name: 'Purple', value: '#a855f7' }
];

const SectionHeader = ({ title }) => (
  <h3 className="text-[13px] font-semibold text-brand px-4 py-2 mt-4">{title}</h3>
);

const ListItem = ({ icon: Icon, title, subtitle, rightElement, onClick }) => (
  <div 
    onClick={onClick}
    className={`flex items-center justify-between px-4 py-3 ${onClick ? 'cursor-pointer hover:bg-black/5 dark:hover:bg-white/5 active:bg-black/10 dark:active:bg-white/10 transition-colors' : ''}`}
  >
    <div className="flex items-center gap-4">
      <div className="w-10 h-10 rounded-xl bg-brand/10 flex items-center justify-center text-brand">
        <Icon className="w-5 h-5" />
      </div>
      <div>
        <p className="text-gray-900 dark:text-gray-100 font-medium text-[15px]">{title}</p>
        {subtitle && <p className="text-gray-500 dark:text-gray-400 text-[13px]">{subtitle}</p>}
      </div>
    </div>
    <div className="flex items-center">
      {rightElement || <MdChevronRight className="w-6 h-6 text-gray-400 dark:text-gray-500" />}
    </div>
  </div>
);

const AppearanceDrawer = ({ isOpen, onClose }) => {
  const { language, setLanguage, t } = useLanguage();
  const { theme, setTheme, colorScheme, setColorScheme } = useTheme();
  
  const [showColors, setShowColors] = useState(false);
  const [showLanguages, setShowLanguages] = useState(false);
  const selectedColorRef = useRef(null);

  useEffect(() => {
    if (showColors && selectedColorRef.current) {
      setTimeout(() => {
        selectedColorRef.current?.scrollIntoView({ block: 'center', behavior: 'smooth' });
      }, 50);
    }
  }, [showColors]);

  useEffect(() => {
    if (!isOpen) {
      setShowColors(false);
      setShowLanguages(false);
    }
  }, [isOpen]);

  const activeColorObject = COLORS.find(c => c.value === colorScheme);
  const activeColorName = activeColorObject ? t('colors.' + activeColorObject.name) : t('appearance.customColor');
  const languageNames = { bn: 'বাংলা (Bengali)', en: 'English', ja: '日本語 (Japanese)' };

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-black/50 backdrop-blur-xs z-50"
          />
          <motion.div 
            initial={{ x: '-100%' }}
            animate={{ x: 0 }}
            exit={{ x: '-100%' }}
            transition={{ type: 'tween', ease: [0.16, 1, 0.3, 1], duration: 0.28 }}
            className="fixed top-0 left-0 bottom-0 w-[85%] max-w-sm bg-white dark:bg-[#121212] z-50 flex flex-col overflow-y-auto hide-scrollbar border-r border-gray-200 dark:border-gray-800"
            onClick={(e) => {
              e.stopPropagation();
              setShowColors(false);
              setShowLanguages(false);
            }}
          >
            {/* Header */}
            <div className="h-16 px-4 flex items-center justify-between border-b border-gray-200 dark:border-gray-800 shrink-0">
              <div className="flex items-center gap-2.5">
                <J4BLogo className="w-6 h-6 text-brand transition-colors duration-300" />
                <span className="font-bold text-lg text-gray-900 dark:text-white">{t('appearance.settingsTitle')}</span>
              </div>
              <button 
                onClick={onClose}
                className="p-2 rounded-full hover:bg-black/5 dark:hover:bg-white/10 text-gray-500 dark:text-gray-400 transition-colors"
              >
                <MdClose className="w-6 h-6" />
              </button>
            </div>

            <div className="px-4 pb-8 space-y-4">
              
              {/* Language Card */}
              <div>
                <SectionHeader title={t('appearance.languageSection')} />
                <div className="bg-gray-50/80 dark:bg-[#1a1a1a] rounded-2xl overflow-hidden border border-gray-200 dark:border-white/5">
                  <ListItem 
                    icon={MdLanguage} 
                    title={t('appearance.appLanguage')} 
                    subtitle={languageNames[language]} 
                    onClick={(e) => {
                      e.stopPropagation();
                      setShowLanguages(!showLanguages);
                      setShowColors(false);
                    }}
                  />
                  
                  {showLanguages && (
                    <div onClick={(e) => e.stopPropagation()} className="px-4 pb-4 pt-1 flex gap-2">
                      {['bn', 'en', 'ja'].map((lang) => (
                        <button
                          key={lang}
                          onClick={() => {
                            setLanguage(lang);
                            setShowLanguages(false);
                          }}
                          className={`flex-1 py-2 text-xs font-medium rounded-xl border transition-all text-center whitespace-nowrap ${
                            language === lang 
                              ? 'border-brand bg-brand/10 text-brand font-bold' 
                              : 'border-gray-200 dark:border-white/10 text-gray-600 dark:bg-[#1a1a1a] dark:text-gray-300 hover:border-gray-300 dark:hover:border-white/30'
                          }`}
                        >
                          {{ bn: 'বাংলা', en: 'English', ja: '日本語' }[lang]}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {/* Appearance Card */}
              <div>
                <SectionHeader title={t('appearance.appearanceSection')} />
                <div className="bg-gray-50/80 dark:bg-[#1a1a1a] rounded-2xl overflow-hidden border border-gray-200 dark:border-white/5 flex flex-col">
                  
                  {/* Theme Mode */}
                  <ListItem 
                    icon={theme === 'dark' ? MdDarkMode : MdLightMode} 
                    title={t('appearance.themeMode')} 
                    subtitle={t('appearance.themeSubtitle')} 
                    rightElement={
                      <motion.button
                        onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
                        className="relative w-[72px] h-10 rounded-xl p-1 cursor-pointer"
                        animate={{ backgroundColor: theme === 'dark' ? '#0c0c0c' : '#f3f4f6' }}
                        transition={{ duration: 0.35, ease: 'easeInOut' }}
                      >
                        {/* Sliding background pill */}
                        <motion.div
                          className="absolute top-1 w-8 h-8 rounded-lg bg-brand shadow-sm"
                          animate={{ left: theme === 'dark' ? 'calc(100% - 36px)' : '4px' }}
                          transition={{ type: 'spring', stiffness: 500, damping: 30 }}
                        />
                        {/* Icons */}
                        <div className="relative flex items-center justify-between h-full px-1.5">
                          <div className={`w-5 h-5 flex items-center justify-center z-10 transition-colors duration-200 ${theme === 'light' ? 'text-white' : 'text-gray-400'}`}>
                            <MdLightMode className="w-5 h-5" />
                          </div>
                          <div className={`w-5 h-5 flex items-center justify-center z-10 transition-colors duration-200 ${theme === 'dark' ? 'text-white' : 'text-gray-400'}`}>
                            <MdDarkMode className="w-5 h-5" />
                          </div>
                        </div>
                      </motion.button>
                    }
                  />

                  {/* Color Scheme */}
                  <ListItem 
                    icon={MdPalette} 
                    title={t('appearance.colorScheme')} 
                    subtitle={activeColorName}
                    onClick={(e) => {
                      e.stopPropagation();
                      setShowColors(!showColors);
                      setShowLanguages(false);
                    }}
                  />

                  {showColors && (
                    <div onClick={(e) => e.stopPropagation()} className="max-h-[148px] overflow-y-auto px-4 py-2 bg-gray-50/50 dark:bg-white/5 border-t border-gray-100 dark:border-white/5">
                      {COLORS.map((color) => (
                        <div
                          key={color.name}
                          ref={colorScheme === color.value ? selectedColorRef : null}
                          onClick={() => {
                            setColorScheme(color.value);
                            setShowColors(false);
                          }}
                          className={`flex items-center justify-between p-3 mb-1 rounded-xl cursor-pointer transition-colors ${
                            colorScheme === color.value 
                              ? 'bg-brand/10' 
                              : 'hover:bg-black/5 dark:hover:bg-white/5'
                          }`}
                        >
                          <div className="flex items-center gap-3">
                            <div 
                              className="w-6 h-6 rounded-full border-2 border-black/10 dark:border-white/20 shadow-sm"
                              style={{ backgroundColor: color.value }}
                            />
                            <span className={`text-sm font-medium ${colorScheme === color.value ? 'text-brand' : 'text-gray-700 dark:text-gray-300'}`}>
                              {t('colors.' + color.name)}
                            </span>
                          </div>
                          {colorScheme === color.value && (
                            <MdCheck className="w-5 h-5 text-brand" />
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
};

export default AppearanceDrawer;
