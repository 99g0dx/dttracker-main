import { Link } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';
import { Button } from '../ui/button';

interface HeroProps {
  onOpenDemo: () => void;
}

export function Hero({ onOpenDemo }: HeroProps) {
  return (
    <section className="relative pt-32 pb-12 lg:pt-40 lg:pb-18 overflow-hidden bg-black">
      {/* Background gradient */}
      <div 
        className="absolute inset-0 opacity-25"
        style={{
          background: 'radial-gradient(circle at top, rgba(229,9,20,0.25), transparent 60%)'
        }}
      />
      
      <div className="relative max-w-[420px] lg:max-w-[1140px] mx-auto px-4 lg:px-8">
        <div className="grid lg:grid-cols-2 gap-12 lg:gap-16 items-center">
          {/* Left Column - Content */}
          <div className="space-y-8 animate-fade-up">
            <h1 
              className="text-[34px] lg:text-[40px] leading-[1.1] text-white tracking-[-0.02em]"
              style={{ fontFamily: 'var(--font-heading)' }}
            >
              Turn Social Buzz Into Streaming Success
            </h1>

            <p 
              className="text-base lg:text-lg text-[#A1A1A1] leading-relaxed"
              style={{ fontFamily: 'var(--font-body)' }}
            >
              DTTracker is the intelligence layer for music marketing. Track creator activity, measure campaign performance, and manage influencer campaigns across TikTok, Instagram, and YouTube—all in one dashboard.
            </p>

            {/* CTAs - Stacked full width on mobile */}
            <div className="flex flex-col lg:flex-row gap-3 lg:gap-4">
              <Button
                asChild
                className="w-full lg:w-auto bg-[#E50914] hover:opacity-90 text-white h-12 px-6 rounded-xl transition-scale shadow-lg shadow-[#E50914]/30"
                style={{ fontFamily: 'var(--font-body)' }}
              >
                <Link to="/signup">
                  Start Free Trial
                  <ArrowRight className="ml-2" size={20} strokeWidth={1.5} />
                </Link>
              </Button>
              <Button 
                onClick={onOpenDemo}
                className="w-full lg:w-auto border border-[#1F1F1F] bg-white text-black hover:bg-gray-100 h-12 px-6 rounded-xl transition-scale"
                style={{ fontFamily: 'var(--font-body)' }}
              >
                Book a Demo
              </Button>
            </div>
          </div>

          {/* Right Column - Dashboard Visual */}
          <div className="relative animate-fade-up" style={{ animationDelay: '0.2s' }}>
            {/* Main Dashboard Card */}
            <div 
              className="relative rounded-2xl border border-[#1F1F1F] bg-[#0C0C0C] p-5 shadow-2xl backdrop-blur-sm transition-lift"
              style={{ borderRadius: '16px', padding: '20px' }}
            >
              <div className="space-y-4">
                {/* Chart Area */}
                <div className="h-40 lg:h-48 rounded-xl bg-gradient-to-br from-[#E50914]/10 to-transparent border border-[#1F1F1F] p-4 relative overflow-hidden">
                  <div className="absolute bottom-0 left-0 right-0 flex items-end justify-around h-28 lg:h-32 gap-2 px-4 pb-4">
                    <div className="w-full bg-[#E50914]/30 rounded-t" style={{height: '40%'}}></div>
                    <div className="w-full bg-[#E50914]/40 rounded-t" style={{height: '65%'}}></div>
                    <div className="w-full bg-[#E50914]/50 rounded-t" style={{height: '55%'}}></div>
                    <div className="w-full bg-[#E50914]/60 rounded-t" style={{height: '80%'}}></div>
                    <div className="w-full bg-[#E50914] rounded-t shadow-lg shadow-[#E50914]/50" style={{height: '100%'}}></div>
                  </div>
                </div>

                {/* Stats Row */}
                <div className="grid grid-cols-3 gap-3">
                  <div className="rounded-xl bg-[#0C0C0C] p-3 border border-[#1F1F1F]">
                    <div className="text-xs text-[#A1A1A1]" style={{ fontFamily: 'var(--font-body)' }}>Engagement</div>
                    <div className="text-lg font-bold text-white" style={{ fontFamily: 'var(--font-heading)' }}>2.4M</div>
                  </div>
                  <div className="rounded-xl bg-[#0C0C0C] p-3 border border-[#1F1F1F]">
                    <div className="text-xs text-[#A1A1A1]" style={{ fontFamily: 'var(--font-body)' }}>Creators</div>
                    <div className="text-lg font-bold text-white" style={{ fontFamily: 'var(--font-heading)' }}>847</div>
                  </div>
                  <div className="rounded-xl bg-[#0C0C0C] p-3 border border-[#1F1F1F]">
                    <div className="text-xs text-[#A1A1A1]" style={{ fontFamily: 'var(--font-body)' }}>ROI</div>
                    <div className="text-lg font-bold text-[#E50914]" style={{ fontFamily: 'var(--font-heading)' }}>4.2x</div>
                  </div>
                </div>
              </div>
            </div>

            {/* Floating Stat Chips - Only 2 */}
            <div 
              className="absolute -top-3 -right-3 bg-gradient-to-r from-green-900/40 to-green-900/20 backdrop-blur-md border border-green-600/30 rounded-lg px-3 py-1.5 shadow-lg"
              style={{ borderRadius: '8px' }}
            >
              <div className="text-xs text-green-400 font-medium" style={{ fontFamily: 'var(--font-body)' }}>+127% engagement</div>
            </div>
            
            <div 
              className="absolute bottom-8 left-4 bg-gradient-to-r from-yellow-900/40 to-yellow-900/20 backdrop-blur-md border border-yellow-600/30 rounded-lg px-3 py-1.5 shadow-lg"
              style={{ borderRadius: '8px' }}
            >
              <div className="text-xs text-yellow-400 font-medium whitespace-nowrap" style={{ fontFamily: 'var(--font-body)' }}>Campaign ROI: 4.2x</div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
