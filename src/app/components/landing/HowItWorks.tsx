import { FolderKanban, Cable, Workflow, ArrowUpRight } from 'lucide-react';

export function HowItWorks() {
  const steps = [
    {
      icon: FolderKanban,
      number: 1,
      title: 'Create a Campaign',
      description: 'Add your track, artist name, and campaign goals in 60 seconds.'
    },
    {
      icon: Cable,
      number: 2,
      title: 'Add Creator Links',
      description: 'Input URLs of creators promoting your music on TikTok, Instagram, and YouTube.'
    },
    {
      icon: Workflow,
      number: 3,
      title: 'System Gathers Data',
      description: 'Our automated scraping engine collects engagement data in real-time.'
    },
    {
      icon: ArrowUpRight,
      number: 4,
      title: 'Get Insights & Reports',
      description: 'View performance analytics and optimize your creator partnerships.'
    }
  ];

  return (
    <section 
      className="py-12 lg:py-18 bg-black"
      style={{ 
        paddingTop: '48px',
        paddingBottom: '48px'
      }}
    >
      <div className="max-w-[420px] lg:max-w-[1140px] mx-auto px-4 lg:px-8">
        <div className="text-center mb-8 lg:mb-12 animate-fade-up">
          <h2 
            className="text-[34px] lg:text-[32px] leading-[1.2] text-white mb-4 tracking-[-0.02em]"
            style={{ fontFamily: 'var(--font-heading)' }}
          >
            How It Works
          </h2>
          <p 
            className="text-base lg:text-lg text-[#A1A1A1]"
            style={{ fontFamily: 'var(--font-body)' }}
          >
            From setup to insights in under 5 minutes. No onboarding calls needed.
          </p>
        </div>

        {/* Mobile: Vertical stepper, Desktop: Horizontal grid */}
        <div className="lg:hidden space-y-0">
          {steps.map((step, index) => {
            const IconComponent = step.icon;
            const isLast = index === steps.length - 1;
            return (
              <div key={index} className="relative flex gap-4 pb-6">
                {/* Vertical line */}
                {!isLast && (
                  <div className="absolute left-5 top-11 bottom-0 w-px bg-[#1F1F1F]" />
                )}
                
                {/* Icon circle */}
                <div 
                  className="relative z-10 w-10 h-10 rounded-full bg-[#E50914]/10 border border-[#E50914]/20 flex items-center justify-center flex-shrink-0"
                  style={{ minWidth: '44px', minHeight: '44px' }}
                >
                  <IconComponent size={18} strokeWidth={1.5} className="text-[#E50914]" />
                </div>
                
                {/* Content */}
                <div className="flex-1 pt-1">
                  <div 
                    className="text-xs text-[#E50914] font-semibold mb-1"
                    style={{ fontFamily: 'var(--font-body)' }}
                  >
                    Step {step.number}
                  </div>
                  <h3 
                    className="text-lg font-bold text-white mb-2"
                    style={{ fontFamily: 'var(--font-heading)', letterSpacing: '-0.02em' }}
                  >
                    {step.title}
                  </h3>
                  <p 
                    className="text-sm text-[#A1A1A1] leading-relaxed"
                    style={{ fontFamily: 'var(--font-body)' }}
                  >
                    {step.description}
                  </p>
                </div>
              </div>
            );
          })}
        </div>

        {/* Desktop: 4-column grid */}
        <div className="hidden lg:grid grid-cols-4 gap-6">
          {steps.map((step, index) => {
            const IconComponent = step.icon;
            return (
              <div 
                key={index}
                className="relative p-6 rounded-xl bg-[#0C0C0C] border border-[#1F1F1F] hover:bg-[#121212] hover:-translate-y-1 transition-all duration-150"
                style={{ 
                  borderRadius: '16px',
                  padding: '20px'
                }}
              >
                <div className="absolute top-6 right-6 text-6xl font-bold text-white/5">
                  {step.number}
                </div>
                
                <div className="relative">
                  <div className="w-12 h-12 rounded-lg bg-[#E50914]/10 flex items-center justify-center mb-4">
                    <IconComponent size={24} strokeWidth={1.5} className="text-[#E50914]" />
                  </div>
                  
                  <div 
                    className="text-sm text-[#E50914] font-semibold mb-2"
                    style={{ fontFamily: 'var(--font-body)' }}
                  >
                    Step {step.number}
                  </div>
                  <h3 
                    className="text-xl font-bold text-white mb-3"
                    style={{ fontFamily: 'var(--font-heading)', letterSpacing: '-0.02em' }}
                  >
                    {step.title}
                  </h3>
                  <p 
                    className="text-sm text-[#A1A1A1] leading-relaxed"
                    style={{ fontFamily: 'var(--font-body)' }}
                  >
                    {step.description}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}