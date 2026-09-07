import React from 'react';
import { Link } from 'react-router-dom';
import { Menu, X } from 'lucide-react';

const Header = () => {
  const [isOpen, setIsOpen] = React.useState(false);

  return (
    <header className="sticky top-0 z-50 w-full border-b border-white/10 bg-dark-bg/80 backdrop-blur-md">
      <div className="container mx-auto px-4 h-16 flex items-center justify-between">
        <Link to="/" className="flex items-center gap-2">
          <div className="w-8 h-8 rounded bg-brand-red flex items-center justify-center font-bold text-white">
            J4B
          </div>
          <span className="font-bold text-lg text-white">J4B Mobile</span>
        </Link>
        
        <nav className="hidden md:flex items-center gap-6 text-sm font-medium text-zinc-300">
          <Link to="/" className="hover:text-brand-red transition-colors">Home</Link>
          <a href="#download" className="hover:text-brand-red transition-colors">Download</a>
        </nav>
        
        <button className="md:hidden text-white" onClick={() => setIsOpen(!isOpen)}>
          {isOpen ? <X size={24} /> : <Menu size={24} />}
        </button>
      </div>
      
      {isOpen && (
        <div className="md:hidden absolute top-16 left-0 w-full bg-dark-surface border-b border-white/10 p-4">
          <nav className="flex flex-col gap-4 text-sm font-medium text-zinc-300">
            <Link to="/" onClick={() => setIsOpen(false)} className="hover:text-brand-red transition-colors">Home</Link>
            <a href="#download" onClick={() => setIsOpen(false)} className="hover:text-brand-red transition-colors">Download</a>
          </nav>
        </div>
      )}
    </header>
  );
};

export default Header;
