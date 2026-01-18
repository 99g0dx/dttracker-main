import { Link } from 'react-router-dom';
import { Button } from '../ui/button';
import { ArrowRight } from 'lucide-react';

interface FinalCTAProps {
  onOpenDemo: () => void;
}

export function FinalCTA({ onOpenDemo }: FinalCTAProps) {
  return (
    <section 
      className="py-16 lg:py-18 relative overflow-hidden bg-black"
      style={{ 
        paddingTop: '64px',
        paddingBottom: '64px'
      }}
    >
      {/* Background gradient */}
      <div 
        className="absolute inset-0 opacity-25"
        style={{
          background: 'radial-gradient(circle at center, rgba(229,9,20,0.25), transparent 60%)'
        }}
      />
      
      <div className="relative max-w-[420px] lg:max-w-[800px] mx-auto px-4 lg:px-8 text-center">
        <h2 
          className="text-[34px] lg:text-[40px] leading-[1.1] text-white mb-4 tracking-[-0.02em]"
          style={{ fontFamily: 'var(--font-heading)' }}
        >
          Ready to Turn Data Into Streaming Growth?
        </h2>

        <p 
          className="text-base lg:text-lg text-[#A1A1A1] mb-8"
          style={{ fontFamily: 'var(--font-body)' }}
        >
          Join the teams who stopped guessing and started winning.
        </p>

        {/* CTAs - Stacked mobile */}
        <div className="flex flex-col lg:flex-row gap-3 lg:gap-4 lg:justify-center mb-6">
          <Button
            asChild
            className="w-full lg:w-auto bg-[#E50914] hover:opacity-90 text-white h-12 px-8 rounded-xl transition-scale shadow-lg shadow-[#E50914]/30"
            style={{ fontFamily: 'var(--font-body)' }}
          >
            <Link to="/signup">
              Start Free Trial
              <ArrowRight className="ml-2" size={20} strokeWidth={1.5} />
            </Link>
          </Button>
          <Button 
            onClick={onOpenDemo}
            className="w-full lg:w-auto border border-[#1F1F1F] bg-white text-black hover:bg-gray-100 h-12 px-8 rounded-xl transition-scale"
            style={{ fontFamily: 'var(--font-body)' }}
          >
            Book a Demo
          </Button>
        </div>

        {/* Fine print */}
        <p 
          className="text-xs lg:text-sm text-[#A1A1A1] mb-2"
          style={{ fontFamily: 'var(--font-body)' }}
        >
          No credit card required · 14-day free trial · Cancel anytime
        </p>
        
        <p 
          className="text-xs text-[#A1A1A1]"
          style={{ fontFamily: 'var(--font-body)' }}
        >
          Questions? Contact sales
        </p>
      </div>
    </section>
  );
}
