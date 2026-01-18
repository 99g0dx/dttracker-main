import { Disc3, Headphones, LayoutDashboard } from 'lucide-react';

export function UseCases() {
  const useCases = [
    {
      icon: Disc3,
      persona: 'Record Labels',
      challenge: 'Managing campaigns for multiple artists with no unified view.',
      outcome: 'Track every campaign, across every artist, in one dashboard.'
    },
    {
      icon: Headphones,
      persona: 'Artist Managers',
      challenge: 'Proving ROI to artists and stakeholders without clear data.',
      outcome: 'Show exact creator-to-stream impact for every dollar spent.'
    },
    {
      icon: LayoutDashboard,
      persona: 'Marketing Agencies',
      challenge: 'Running manual reports and losing hours on influencer research.',
      outcome: 'Automated reporting and real-time access to 10M+ creators.'
    }
  ];

  return (
    <section 
      id="use-cases"
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
            Built for the Full Music Ecosystem
          </h2>
          <p 
            className="text-base lg:text-lg text-[#A1A1A1]"
            style={{ fontFamily: 'var(--font-body)' }}
          >
            Whether you're a label, manager, or agency—DTTracker adapts to your workflow.
          </p>
        </div>

        {/* Use case cards - Stack mobile, Grid desktop */}
        <div className="grid lg:grid-cols-3 gap-6">
          {useCases.map((useCase, index) => {
            const IconComponent = useCase.icon;
            return (
              <div 
                key={index}
                className="p-6 rounded-xl bg-[#0C0C0C] border border-[#1F1F1F] hover:bg-[#121212] hover:-translate-y-1 transition-all duration-150"
                style={{ 
                  borderRadius: '16px',
                  padding: '24px'
                }}
              >
                <div className="w-14 h-14 rounded-xl bg-[#E50914]/10 flex items-center justify-center mb-4">
                  <IconComponent size={24} strokeWidth={1.5} className="text-[#E50914]" />
                </div>
                
                <h3 
                  className="text-xl lg:text-2xl font-bold text-white mb-4"
                  style={{ fontFamily: 'var(--font-heading)', letterSpacing: '-0.02em' }}
                >
                  {useCase.persona}
                </h3>
                
                <div className="mb-4">
                  <div 
                    className="text-xs text-[#E50914] font-semibold mb-2"
                    style={{ fontFamily: 'var(--font-body)' }}
                  >
                    Challenge
                  </div>
                  <p 
                    className="text-sm text-[#A1A1A1] leading-relaxed"
                    style={{ fontFamily: 'var(--font-body)' }}
                  >
                    {useCase.challenge}
                  </p>
                </div>
                
                <div className="mb-4">
                  <div 
                    className="text-xs text-[#22C55E] font-semibold mb-2"
                    style={{ fontFamily: 'var(--font-body)' }}
                  >
                    DTTracker Solution
                  </div>
                  <p 
                    className="text-sm text-white leading-relaxed"
                    style={{ fontFamily: 'var(--font-body)' }}
                  >
                    {useCase.outcome}
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
