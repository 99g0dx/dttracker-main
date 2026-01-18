import { Link } from 'react-router-dom';
import { Linkedin, Twitter, Youtube } from 'lucide-react';
import logo from '../../../assets/fcad7446971be733d3427a6b22f8f64253529daf.png';

export function Footer() {
  const footerLinks = {
    product: ['Features', 'Use Cases', 'Pricing', 'Demo'],
    company: ['About', 'Careers', 'Contact'],
    legal: ['Terms', 'Privacy', 'Cookies']
  };

  return (
    <footer className="border-t border-[#1F1F1F] bg-black">
      <div 
        className="max-w-[420px] lg:max-w-[1140px] mx-auto px-4 lg:px-8"
        style={{ 
          paddingTop: '32px',
          paddingBottom: '32px'
        }}
      >
        {/* Brand Section - Above columns on mobile */}
        <div className="mb-8 lg:mb-12">
          <Link to="/home" className="flex items-center gap-2 mb-3">
            <img src={logo} alt="DTTracker" className="h-8 lg:h-10 w-auto" />
            <span 
              className="text-lg lg:text-xl font-bold text-white"
              style={{ fontFamily: 'var(--font-heading)' }}
            >
              DTTracker
            </span>
          </Link>
          <p 
            className="text-sm text-[#A1A1A1] mb-4 lg:mb-6"
            style={{ fontFamily: 'var(--font-body)' }}
          >
            Intelligence layer for music marketing
          </p>
          <div className="flex gap-4">
            <a 
              href="#" 
              className="text-[#A1A1A1] hover:text-[#E50914] transition-colors"
              aria-label="LinkedIn"
            >
              <Linkedin size={20} strokeWidth={1.5} />
            </a>
            <a 
              href="#" 
              className="text-[#A1A1A1] hover:text-[#E50914] transition-colors"
              aria-label="Twitter"
            >
              <Twitter size={20} strokeWidth={1.5} />
            </a>
            <a 
              href="#" 
              className="text-[#A1A1A1] hover:text-[#E50914] transition-colors"
              aria-label="YouTube"
            >
              <Youtube size={20} strokeWidth={1.5} />
            </a>
          </div>
        </div>

        {/* Footer Columns - Wrapping Layout */}
        <div 
          className="flex flex-wrap gap-x-8 gap-y-6 mb-8 lg:mb-12"
          style={{
            alignItems: 'flex-start'
          }}
        >
          {/* Product Column */}
          <div 
            className="flex-1"
            style={{ 
              minWidth: '120px',
              maxWidth: '220px'
            }}
          >
            <h4 
              className="font-medium text-white mb-3"
              style={{ 
                fontFamily: 'var(--font-body)',
                fontSize: '16px'
              }}
            >
              Product
            </h4>
            <ul className="space-y-3">
              {footerLinks.product.map((link, index) => (
                <li key={index}>
                  <a 
                    href="#" 
                    className="text-[#A1A1A1] hover:text-white transition-colors"
                    style={{ 
                      fontFamily: 'var(--font-body)',
                      fontSize: '14px'
                    }}
                  >
                    {link}
                  </a>
                </li>
              ))}
            </ul>
          </div>

          {/* Company Column */}
          <div 
            className="flex-1"
            style={{ 
              minWidth: '120px',
              maxWidth: '220px'
            }}
          >
            <h4 
              className="font-medium text-white mb-3"
              style={{ 
                fontFamily: 'var(--font-body)',
                fontSize: '16px'
              }}
            >
              Company
            </h4>
            <ul className="space-y-3">
              {footerLinks.company.map((link, index) => (
                <li key={index}>
                  <a 
                    href="#" 
                    className="text-[#A1A1A1] hover:text-white transition-colors"
                    style={{ 
                      fontFamily: 'var(--font-body)',
                      fontSize: '14px'
                    }}
                  >
                    {link}
                  </a>
                </li>
              ))}
            </ul>
          </div>

          {/* Legal Column */}
          <div 
            className="flex-1"
            style={{ 
              minWidth: '120px',
              maxWidth: '220px'
            }}
          >
            <h4 
              className="font-medium text-white mb-3"
              style={{ 
                fontFamily: 'var(--font-body)',
                fontSize: '16px'
              }}
            >
              Legal
            </h4>
            <ul className="space-y-3">
              {footerLinks.legal.map((link, index) => (
                <li key={index}>
                  <a 
                    href="#" 
                    className="text-[#A1A1A1] hover:text-white transition-colors"
                    style={{ 
                      fontFamily: 'var(--font-body)',
                      fontSize: '14px'
                    }}
                  >
                    {link}
                  </a>
                </li>
              ))}
            </ul>
          </div>
        </div>

        {/* Bottom Bar - Divider line above */}
        <div className="pt-6 lg:pt-8 border-t border-[#1F1F1F]">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <p 
              className="text-xs lg:text-sm text-[#A1A1A1]"
              style={{ fontFamily: 'var(--font-body)' }}
            >
              © 2026 DTTracker. All rights reserved.
            </p>
            <div className="flex flex-wrap gap-4 lg:gap-6">
              <a 
                href="#" 
                className="text-xs lg:text-sm text-[#A1A1A1] hover:text-white transition-colors"
                style={{ fontFamily: 'var(--font-body)' }}
              >
                Status
              </a>
              <a 
                href="#" 
                className="text-xs lg:text-sm text-[#A1A1A1] hover:text-white transition-colors"
                style={{ fontFamily: 'var(--font-body)' }}
              >
                Sitemap
              </a>
            </div>
          </div>
        </div>
      </div>
    </footer>
  );
}
