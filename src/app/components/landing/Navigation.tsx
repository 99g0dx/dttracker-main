import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Menu, X } from 'lucide-react';
import { Button } from '../ui/button';
import logo from '../../../assets/fcad7446971be733d3427a6b22f8f64253529daf.png';

interface NavigationProps {
  onOpenDemo: () => void;
}

export function Navigation({ onOpenDemo }: NavigationProps) {
  const [isScrolled, setIsScrolled] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 20);
    };
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  useEffect(() => {
    if (!isMobileMenuOpen) {
      document.body.style.overflow = '';
      document.body.style.touchAction = '';
      return;
    }

    document.body.style.overflow = 'hidden';
    document.body.style.touchAction = 'none';

    return () => {
      document.body.style.overflow = '';
      document.body.style.touchAction = '';
    };
  }, [isMobileMenuOpen]);

  const handleMenuClick = () => {
    setIsMobileMenuOpen(false);
  };

  return (
    <>
      <nav 
        className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${
          isScrolled || isMobileMenuOpen
            ? 'bg-black/90 backdrop-blur-lg border-b border-[#1F1F1F]' 
            : 'bg-transparent'
        }`}
        style={{ height: '64px' }}
      >
        <div className="max-w-[1140px] mx-auto px-4 lg:px-8 h-full flex items-center justify-between">
          {/* Logo */}
          <Link to="/home" className="flex items-center gap-2">
            <img src={logo} alt="DTTracker" className="h-8 w-auto" />
            <span className="text-lg font-bold text-white" style={{ fontFamily: 'var(--font-heading)' }}>
              DTTracker
            </span>
          </Link>

          {/* Desktop Navigation */}
          <div className="hidden lg:flex items-center gap-8">
            <a 
              href="#" 
              className="text-[#A1A1A1] hover:text-white transition-colors text-base"
              style={{ fontFamily: 'var(--font-body)' }}
            >
              Product
            </a>
            <a 
              href="#features" 
              className="text-[#A1A1A1] hover:text-white transition-colors text-base"
              style={{ fontFamily: 'var(--font-body)' }}
            >
              Features
            </a>
            <a 
              href="#use-cases" 
              className="text-[#A1A1A1] hover:text-white transition-colors text-base"
              style={{ fontFamily: 'var(--font-body)' }}
            >
              Use Cases
            </a>
            <a 
              href="#pricing" 
              className="text-[#A1A1A1] hover:text-white transition-colors text-base"
              style={{ fontFamily: 'var(--font-body)' }}
            >
              Pricing
            </a>
            <a 
              href="#" 
              className="text-[#A1A1A1] hover:text-white transition-colors text-base"
              style={{ fontFamily: 'var(--font-body)' }}
            >
              About
            </a>
          </div>

          {/* Desktop Right Actions */}
          <div className="hidden lg:flex items-center gap-4">
            <Link
              to="/login"
              className="text-[#A1A1A1] hover:text-white transition-colors text-base"
              style={{ fontFamily: 'var(--font-body)' }}
            >
              Log In
            </Link>
            <Button 
              onClick={onOpenDemo}
              className="bg-[#E50914] hover:opacity-90 text-white transition-scale h-12 px-4 rounded-xl"
              style={{ fontFamily: 'var(--font-body)' }}
            >
              Book a Demo
            </Button>
          </div>

          {/* Mobile Hamburger */}
          <button 
            className="lg:hidden w-11 h-11 flex items-center justify-center text-white"
            onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
            aria-label={isMobileMenuOpen ? 'Close menu' : 'Open menu'}
            style={{ minHeight: '44px', minWidth: '44px' }}
          >
            {isMobileMenuOpen ? <X size={24} strokeWidth={1.5} /> : <Menu size={24} strokeWidth={1.5} />}
          </button>
        </div>
      </nav>

      {/* Mobile Slide-over Menu */}
      {isMobileMenuOpen && (
        <div className="lg:hidden fixed inset-0 z-40">
          {/* Backdrop */}
          <div 
            className="absolute inset-0 bg-black"
            onClick={() => setIsMobileMenuOpen(false)}
          />
          
          {/* Slide-over Panel */}
          <div 
            className="absolute right-0 bottom-0 top-16 w-[80%] max-w-[320px] z-50 border-l border-[#1F1F1F] shadow-2xl animate-in slide-in-from-right duration-300"
            style={{ backgroundColor: '#0B0B0B' }}
          >
            <div className="flex flex-col h-full">
              {/* Menu items */}
              <div className="flex-1 px-4 py-6 space-y-1">
                <a 
                  href="#features" 
                  className="block text-white py-3 px-4 rounded-lg hover:bg-white/5 transition-colors"
                  onClick={handleMenuClick}
                  style={{ minHeight: '48px', fontFamily: 'var(--font-body)' }}
                >
                  Features
                </a>
                <a 
                  href="#use-cases" 
                  className="block text-white py-3 px-4 rounded-lg hover:bg-white/5 transition-colors"
                  onClick={handleMenuClick}
                  style={{ minHeight: '48px', fontFamily: 'var(--font-body)' }}
                >
                  Use Cases
                </a>
                <a 
                  href="#pricing" 
                  className="block text-white py-3 px-4 rounded-lg hover:bg-white/5 transition-colors"
                  onClick={handleMenuClick}
                  style={{ minHeight: '48px', fontFamily: 'var(--font-body)' }}
                >
                  Pricing
                </a>
                <a 
                  href="#" 
                  className="block text-white py-3 px-4 rounded-lg hover:bg-white/5 transition-colors"
                  onClick={handleMenuClick}
                  style={{ minHeight: '48px', fontFamily: 'var(--font-body)' }}
                >
                  Resources
                </a>
                <Link
                  to="/login"
                  className="block text-white py-3 px-4 rounded-lg hover:bg-white/5 transition-colors"
                  onClick={handleMenuClick}
                  style={{ minHeight: '48px', fontFamily: 'var(--font-body)' }}
                >
                  Log In
                </Link>
              </div>

              {/* Bottom CTA */}
              <div className="p-4 border-t border-[#1F1F1F]">
                <Button 
                  onClick={() => {
                    onOpenDemo();
                    setIsMobileMenuOpen(false);
                  }}
                  className="w-full bg-[#E50914] hover:opacity-90 text-white h-12 rounded-xl"
                  style={{ fontFamily: 'var(--font-body)' }}
                >
                  Book a Demo
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
