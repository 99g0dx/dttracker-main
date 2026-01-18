import { PlayCircle } from 'lucide-react';
import { Button } from '../ui/button';

interface DashboardPreviewProps {
  onOpenDemo: () => void;
}

export function DashboardPreview({ onOpenDemo }: DashboardPreviewProps) {
  return (
    <section 
      className="py-12 lg:py-18 relative overflow-hidden bg-black"
      style={{ 
        paddingTop: '48px',
        paddingBottom: '48px'
      }}
    >
      <div className="max-w-[420px] lg:max-w-[1140px] mx-auto px-4 lg:px-8">
        <h2 
          className="text-[34px] lg:text-[32px] leading-[1.2] text-white text-center mb-4 tracking-[-0.02em]"
          style={{ fontFamily: 'var(--font-heading)' }}
        >
          See Everything in One Place
        </h2>
        
        <p 
          className="text-base lg:text-lg text-[#A1A1A1] text-center max-w-[600px] mx-auto mb-8"
          style={{ fontFamily: 'var(--font-body)' }}
        >
          Track campaigns, analyze creators, and uncover insights—all from a single dashboard.
        </p>

        {/* Dashboard Screenshot */}
        <div 
          className="relative rounded-2xl border border-[#1F1F1F] bg-[#0C0C0C] p-4 lg:p-6 shadow-2xl mb-6"
          style={{ 
            borderRadius: '16px',
            padding: '20px'
          }}
        >
          <div className="space-y-4">
            {/* Top Bar */}
            <div className="flex items-center justify-between pb-3 border-b border-[#1F1F1F]">
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-[#E50914]"></div>
                <div className="w-2 h-2 rounded-full bg-[#F59E0B]"></div>
                <div className="w-2 h-2 rounded-full bg-[#22C55E]"></div>
              </div>
              <div className="flex gap-2">
                <div className="h-6 w-20 rounded bg-[#1F1F1F]"></div>
                <div className="h-6 w-16 rounded bg-[#1F1F1F]"></div>
              </div>
            </div>

            {/* Main Content Area */}
            <div className="space-y-4 lg:space-y-0 lg:grid lg:grid-cols-3 lg:gap-4">
              {/* Chart */}
              <div className="lg:col-span-2 h-48 lg:h-64 rounded-xl bg-gradient-to-br from-[#E50914]/20 to-transparent border border-[#1F1F1F] p-4 relative overflow-hidden">
                <div className="absolute bottom-0 left-0 right-0 flex items-end justify-around h-32 lg:h-40 gap-2 px-4 pb-4">
                  <div className="w-full bg-[#E50914]/20 rounded-t" style={{height: '30%'}}></div>
                  <div className="w-full bg-[#E50914]/30 rounded-t" style={{height: '55%'}}></div>
                  <div className="w-full bg-[#E50914]/40 rounded-t" style={{height: '45%'}}></div>
                  <div className="w-full bg-[#E50914]/50 rounded-t" style={{height: '70%'}}></div>
                  <div className="w-full bg-[#E50914]/60 rounded-t" style={{height: '85%'}}></div>
                  <div className="w-full bg-[#E50914] rounded-t shadow-lg shadow-[#E50914]/50" style={{height: '100%'}}></div>
                </div>
                <div 
                  className="text-xs text-[#A1A1A1] mb-2"
                  style={{ fontFamily: 'var(--font-body)' }}
                >
                  Engagement Over Time
                </div>
              </div>

              {/* Stats */}
              <div className="space-y-3">
                <div className="p-3 rounded-xl bg-[#0C0C0C] border border-[#1F1F1F]">
                  <div 
                    className="text-xs text-[#A1A1A1] mb-1"
                    style={{ fontFamily: 'var(--font-body)' }}
                  >
                    Total Reach
                  </div>
                  <div 
                    className="text-2xl font-bold text-white"
                    style={{ fontFamily: 'var(--font-heading)' }}
                  >
                    12.4M
                  </div>
                  <div 
                    className="text-xs text-[#22C55E]"
                    style={{ fontFamily: 'var(--font-body)' }}
                  >
                    +23% this week
                  </div>
                </div>
                <div className="p-3 rounded-xl bg-[#0C0C0C] border border-[#1F1F1F]">
                  <div 
                    className="text-xs text-[#A1A1A1] mb-1"
                    style={{ fontFamily: 'var(--font-body)' }}
                  >
                    Active Creators
                  </div>
                  <div 
                    className="text-2xl font-bold text-white"
                    style={{ fontFamily: 'var(--font-heading)' }}
                  >
                    847
                  </div>
                  <div 
                    className="text-xs text-[#22C55E]"
                    style={{ fontFamily: 'var(--font-body)' }}
                  >
                    +12% this week
                  </div>
                </div>
                <div className="p-3 rounded-xl bg-[#0C0C0C] border border-[#1F1F1F]">
                  <div 
                    className="text-xs text-[#A1A1A1] mb-1"
                    style={{ fontFamily: 'var(--font-body)' }}
                  >
                    Avg. Engagement
                  </div>
                  <div 
                    className="text-2xl font-bold text-[#E50914]"
                    style={{ fontFamily: 'var(--font-heading)' }}
                  >
                    8.2%
                  </div>
                  <div 
                    className="text-xs text-[#22C55E]"
                    style={{ fontFamily: 'var(--font-body)' }}
                  >
                    +5% this week
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* CTA - Full width on mobile */}
        <div className="text-center">
          <Button 
            onClick={onOpenDemo}
            className="w-full lg:w-auto border border-[#1F1F1F] bg-white text-black hover:bg-gray-100 h-12 px-6 rounded-xl transition-scale"
            style={{ fontFamily: 'var(--font-body)' }}
          >
            <PlayCircle size={20} strokeWidth={1.5} className="mr-2" />
            Watch a 90-Second Demo
          </Button>
        </div>
      </div>
    </section>
  );
}
