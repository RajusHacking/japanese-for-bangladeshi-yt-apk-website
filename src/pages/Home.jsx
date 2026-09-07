import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Download, Monitor, Terminal, Sparkles, X, Info } from 'lucide-react';
import { FaApple, FaAndroid } from 'react-icons/fa';
import { useLanguage } from '../context/LanguageContext';

// Dynamically import files from the folders
const androidFiles = import.meta.glob('../Storage/softwere/Android/*.*', { query: '?url', import: 'default', eager: true });
const appleFiles = import.meta.glob('../Storage/softwere/Apple/*.*', { query: '?url', import: 'default', eager: true });
const windowsFiles = import.meta.glob('../Storage/softwere/Windows/*.*', { query: '?url', import: 'default', eager: true });
const linuxFiles = import.meta.glob('../Storage/softwere/Linux/*.*', { query: '?url', import: 'default', eager: true });

const DownloadButton = ({ icon: Icon, title, subtitle, className = "", href, onUnavailable }) => {
  const isAvailable = href && href !== '#';
  return (
    <a 
      href={href}
      download={isAvailable ? true : undefined}
      onClick={(e) => {
        if (!isAvailable) {
          e.preventDefault();
          onUnavailable();
        }
      }}
      className={`group flex items-center gap-4 bg-white dark:bg-[#161616] border border-gray-100 dark:border-[#2a2a2a] p-3.5 rounded-2xl hover:border-brand dark:hover:border-brand w-full shadow-sm cursor-pointer ${className} ${!isAvailable ? 'opacity-75 grayscale' : ''}`}
    >
      <div className="bg-brand/10 dark:bg-brand/20 p-2.5 rounded-xl text-brand group-hover:bg-brand group-hover:text-white">
        <Icon size={24} />
      </div>
      <div className="text-left flex-1">
        <div className="text-[11px] text-gray-500 dark:text-gray-400 font-medium tracking-wide uppercase">{subtitle}</div>
        <div className="text-base font-bold text-gray-900 dark:text-white group-hover:text-brand">{title}</div>
      </div>
      <div className="w-8 h-8 rounded-full bg-gray-50 dark:bg-[#222] flex items-center justify-center group-hover:bg-brand group-hover:text-white text-gray-400">
        <Download size={16} />
      </div>
    </a>
  );
};

const UnavailableModal = ({ isOpen, onClose, t }) => {
  return (
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[100]"
          />
          <div className="fixed inset-0 z-[101] flex items-center justify-center p-4 pointer-events-none">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="bg-white dark:bg-[#1a1a1a] border border-gray-200 dark:border-[#333] p-6 rounded-2xl max-w-sm w-full shadow-2xl pointer-events-auto flex flex-col items-center text-center relative"
            >
              <button 
                onClick={onClose}
                className="absolute top-4 right-4 text-gray-400 hover:text-gray-900 dark:hover:text-white transition-colors p-1"
              >
                <X size={20} />
              </button>
              
              <div className="w-12 h-12 rounded-full bg-brand/10 text-brand flex items-center justify-center mb-4">
                <Info size={24} />
              </div>
              
              <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-2">{t('website.comingSoon')}</h3>
              <p className="text-gray-500 dark:text-gray-400 mb-6">
                {t('website.notPublished')}
              </p>
              
              <button 
                onClick={onClose}
                className="w-full py-2.5 rounded-xl bg-brand text-white font-medium hover:opacity-90 transition-opacity"
              >
                {t('website.okay')}
              </button>
            </motion.div>
          </div>
        </>
      )}
    </AnimatePresence>
  );
};

const Home = () => {
  const [showModal, setShowModal] = useState(false);
  const { t } = useLanguage();

  const androidFileUrl = Object.values(androidFiles)[0] || '#';
  const appleFileUrl = Object.values(appleFiles)[0] || '#';
  const windowsFileUrl = Object.values(windowsFiles)[0] || '#';
  const linuxFileUrl = Object.values(linuxFiles)[0] || '#';

  return (
    <div className="w-full flex-1 flex flex-col justify-center pb-20">
      <UnavailableModal isOpen={showModal} onClose={() => setShowModal(false)} t={t} />
      
      {/* Hero Section */}
      <section className="container mx-auto px-4 pt-8 pb-16 md:pt-12 md:pb-24 flex flex-col items-center text-center">
        <motion.div 
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full border border-gray-200 dark:border-white/10 bg-white dark:bg-white/5 text-gray-600 dark:text-gray-300 text-xs font-medium mb-8 shadow-sm"
        >
          <Sparkles size={14} className="text-brand" />
          <span>{t('website.ultimatePlatform')}</span>
        </motion.div>
        
        <motion.h1 
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.1 }}
          className="text-[26px] leading-[1.2] sm:text-4xl md:text-5xl font-bold tracking-tight mb-3 sm:mb-4 max-w-3xl capitalize sm:leading-tight text-gray-900 dark:text-white"
        >
          Japanese For <span className="text-transparent bg-clip-text bg-gradient-to-r from-brand to-orange-500">Bangladeshi</span>
        </motion.h1>
        
        <motion.p 
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.2 }}
          className="text-sm sm:text-base md:text-lg text-gray-500 dark:text-zinc-400 max-w-xl mb-8 sm:mb-12 font-medium px-2"
        >
          {t('website.downloadAppDesc')}
        </motion.p>

        {/* Download Section Inside Hero to be more compact */}
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.3 }}
          className="w-full max-w-2xl mx-auto grid grid-cols-1 sm:grid-cols-2 gap-4 place-items-center"
        >
          <DownloadButton icon={FaAndroid} subtitle={t('website.downloadFor')} title="Android" href={androidFileUrl} onUnavailable={() => setShowModal(true)} />
          <DownloadButton icon={FaApple} subtitle={t('website.downloadFor')} title="iPhone" href={appleFileUrl} onUnavailable={() => setShowModal(true)} />
          <DownloadButton icon={Monitor} subtitle={t('website.downloadFor')} title="Windows" className="hidden lg:flex" href={windowsFileUrl} onUnavailable={() => setShowModal(true)} />
          <DownloadButton icon={Terminal} subtitle={t('website.downloadFor')} title="Linux" className="hidden lg:flex" href={linuxFileUrl} onUnavailable={() => setShowModal(true)} />
        </motion.div>
      </section>
    </div>
  );
};

export default Home;
