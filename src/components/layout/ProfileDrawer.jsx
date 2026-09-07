import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, User, Home, Download, Phone, Mail, Award, Flame, ChevronRight } from 'lucide-react';
import { useLanguage } from '../../context/LanguageContext';
import { Link } from 'react-router-dom';
import J4BLogo from '../common/J4BLogo';

const ProfileDrawer = ({ isOpen, onClose }) => {
  const { language, setLanguage, t } = useLanguage();
  const avatar = 'https://i.pravatar.cc/150?u=j4b';

  const links = [
    { to: '/', icon: <Home className="w-5 h-5" />, label: 'Home' },
    { to: '#download', icon: <Download className="w-5 h-5" />, label: 'Download App' },
    { to: '#contact', icon: <Phone className="w-5 h-5" />, label: 'Contact Us' },
  ];

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-black/50 backdrop-blur-xs z-50"
          />

          {/* Drawer Sliding from Left */}
          <motion.div 
            initial={{ x: '-100%' }}
            animate={{ x: 0 }}
            exit={{ x: '-100%' }}
            transition={{ type: 'tween', ease: [0.16, 1, 0.3, 1], duration: 0.28 }}
            className="fixed top-0 left-0 bottom-0 w-[85%] max-w-sm bg-white dark:bg-[#121212] z-50 flex flex-col overflow-y-auto hide-scrollbar border-r border-gray-200 dark:border-gray-800"
          >
            {/* Header */}
            <div className="h-16 px-4 flex items-center justify-between border-b border-gray-200 dark:border-gray-800 shrink-0">
              <div className="flex items-center gap-2">
                <J4BLogo className="w-7 h-7 text-brand transition-colors duration-300" />
                <span className="font-bold text-base text-gray-900 dark:text-white">
                  Profile & Menu
                </span>
              </div>
              <button 
                onClick={onClose}
                className="p-2 rounded-full hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-500 transition-colors"
                aria-label="Close Profile"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Profile Info Card */}
            <div className="p-4">
              <div className="p-4 rounded-2xl bg-gradient-to-br from-gray-50 to-gray-100/80 dark:from-[#1a1a1a] dark:to-[#161616] border border-gray-200/80 dark:border-white/5 shadow-xs mb-4">
                <div className="flex items-center gap-3.5 mb-3">
                  <div className="w-13 h-13 rounded-full bg-brand/15 text-brand flex items-center justify-center font-bold text-xl border border-brand/20 shadow-inner shrink-0 overflow-hidden">
                    <img 
                      src={avatar} 
                      alt="Profile" 
                      className="w-full h-full object-cover rounded-full scale-102 select-none" 
                    />
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5">
                      <h3 className="font-bold text-base text-gray-900 dark:text-white truncate">
                        Welcome Guest
                      </h3>
                      <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold bg-brand/15 text-brand uppercase">
                        N5
                      </span>
                    </div>
                    <p className="text-xs text-gray-500 dark:text-gray-400 truncate">
                      JLPT Beginner
                    </p>
                  </div>
                </div>

                {/* Micro Stats */}
                <div className="grid grid-cols-2 gap-2 pt-2 border-t border-gray-200/60 dark:border-gray-800">
                  <div className="flex items-center gap-2 p-2 rounded-xl bg-white/60 dark:bg-black/30 border border-gray-100 dark:border-white/5">
                    <Flame className="w-4 h-4 text-orange-500 shrink-0" />
                    <div>
                      <div className="text-[10px] text-gray-400 uppercase font-semibold">Streak</div>
                      <div className="text-xs font-bold text-gray-800 dark:text-gray-200">3 Days</div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 p-2 rounded-xl bg-white/60 dark:bg-black/30 border border-gray-100 dark:border-white/5">
                    <Award className="w-4 h-4 text-brand shrink-0" />
                    <div>
                      <div className="text-[10px] text-gray-400 uppercase font-semibold">XP</div>
                      <div className="text-xs font-bold text-gray-800 dark:text-gray-200">240 XP</div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Language Switcher */}
              <div className="mb-4">
                <p className="text-[11px] font-bold text-gray-400 uppercase tracking-wider mb-2 px-1">
                  Language
                </p>
                <div className="flex gap-1.5 p-1 bg-gray-100 dark:bg-[#181818] rounded-xl border border-gray-200/60 dark:border-gray-800">
                  {[
                    { id: 'en', label: 'English' },
                    { id: 'ja', label: '日本語' }
                  ].map((item) => (
                    <button
                      key={item.id}
                      onClick={() => setLanguage(item.id)}
                      className={`flex-1 py-1.5 text-xs font-semibold rounded-lg transition-all ${
                        language === item.id 
                          ? 'bg-white dark:bg-gray-800 text-brand shadow-xs' 
                          : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
                      }`}
                    >
                      {item.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Navigation Links */}
              <div>
                <p className="text-[11px] font-bold text-gray-400 uppercase tracking-wider mb-2 px-1">
                  Menu Navigation
                </p>
                <div className="space-y-1">
                  {links.map((link) => (
                    <a
                      key={link.to}
                      href={link.to}
                      onClick={onClose}
                      className="flex items-center justify-between px-3.5 py-2.5 text-gray-700 dark:text-gray-300 rounded-xl hover:bg-gray-100 dark:hover:bg-gray-800/60 transition-colors group"
                    >
                      <div className="flex items-center gap-3">
                        <span className="text-gray-400 group-hover:text-brand transition-colors">
                          {link.icon}
                        </span>
                        <span className="font-medium text-sm group-hover:text-gray-900 dark:group-hover:text-white transition-colors">
                          {link.label}
                        </span>
                      </div>
                      <ChevronRight className="w-4 h-4 text-gray-300 dark:text-gray-600 group-hover:text-brand group-hover:translate-x-0.5 transition-all" />
                    </a>
                  ))}
                </div>
              </div>
            </div>

            {/* Footer Branding */}
            <div className="mt-auto p-4 border-t border-gray-100 dark:border-gray-800/80 flex items-center justify-between text-xs text-gray-400">
              <div className="flex items-center gap-2">
                <J4BLogo className="w-5 h-5 text-brand" />
                <span>Japanese For Bangladeshi</span>
              </div>
              <span className="font-mono text-[10px]">v2.0</span>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
};

export default ProfileDrawer;
