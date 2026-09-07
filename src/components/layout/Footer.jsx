import React from 'react';
import { FaEnvelope, FaYoutube } from 'react-icons/fa';
import { useLanguage } from '../../context/LanguageContext';

const Footer = () => {
  const { t } = useLanguage();

  return (
    <footer className="fixed bottom-0 left-0 z-50 w-full h-16 flex items-center border-t border-gray-200 dark:border-white/5 bg-white dark:bg-[#0a0a0a]">
      <div className="container mx-auto px-4 flex justify-center items-center gap-4 sm:gap-6">
        <a 
          href="mailto:japaneseforbangladeshi@gmail.com" 
          className="flex items-center gap-2 sm:gap-2.5 text-xs sm:text-sm font-medium text-gray-400 hover:text-black dark:text-gray-500 dark:hover:text-white transition-colors"
          aria-label="Email"
        >
          <FaEnvelope className="w-4 h-4 sm:w-5 sm:h-5" />
          <span>{t('website.contactUs')}</span>
        </a>
        
        <span className="text-gray-300 dark:text-gray-700 font-medium text-xs sm:text-sm">|</span>

        <a 
          href="https://www.youtube.com/@JapaneseForBangladeshi" 
          target="_blank" 
          rel="noopener noreferrer"
          className="flex items-center gap-2 sm:gap-2.5 text-xs sm:text-sm font-medium text-gray-400 hover:text-black dark:text-gray-500 dark:hover:text-white transition-colors"
          aria-label="YouTube"
        >
          <FaYoutube className="w-4 h-4 sm:w-5 sm:h-5" />
          <span>{t('website.visitChannel')}</span>
        </a>
      </div>
    </footer>
  );
};

export default Footer;
