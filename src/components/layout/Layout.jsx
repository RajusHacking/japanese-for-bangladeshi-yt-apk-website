import React, { useEffect, useRef } from 'react';
import TopBar from './TopBar';
import Footer from './Footer';

const Layout = ({ children }) => {
  const topBarRef = useRef(null);
  const footerRef = useRef(null);

  // Save header & footer HTML to localStorage after render
  useEffect(() => {
    const saveToLocalStorage = () => {
      if (topBarRef.current) {
        localStorage.setItem('j4b_cached_topbar', topBarRef.current.innerHTML);
      }
      if (footerRef.current) {
        localStorage.setItem('j4b_cached_footer', footerRef.current.innerHTML);
      }
    };

    // Slight delay to ensure everything is rendered (icons, translations, etc.)
    const timer = setTimeout(saveToLocalStorage, 500);
    return () => clearTimeout(timer);
  });

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-black text-gray-900 dark:text-white flex flex-col font-sans pt-16">
      <div ref={topBarRef}>
        <TopBar />
      </div>
      <main className="flex-1 flex flex-col relative overflow-hidden pb-24">
        <div className="absolute inset-0 ambient-gradient-glow -z-10 opacity-30"></div>
        {children}
      </main>
      <div ref={footerRef}>
        <Footer />
      </div>
    </div>
  );
};

export default Layout;
