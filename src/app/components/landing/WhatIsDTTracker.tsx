import { LayoutDashboard, FileBarChart, Zap } from 'lucide-react';

export function WhatIsDTTracker() {
  const outcomes = [
    {
      icon: LayoutDashboard,
      title: 'Centralized Visibility',
      description: 'All your creator campaigns and performance data in one place.'
    },
    {
      icon: FileBarChart,
      title: 'Structured Reporting',
      description: 'Track engagement metrics and campaign results with automated reports.'
    },
    {
      icon: Zap,
      title: 'Faster Decisions',
      description: 'Know which creators deliver results and optimize your strategy in real-time.'
    }
  ];

  return (
    <section 
      className="py-12 lg:py-18 bg-black relative"
      style={{ 
        paddingTop: '48px',
        paddingBottom: '48px'
      }}
    >
      <div className="max-w-[420px] lg:max-w-[1140px] mx-auto px-4 lg:px-8">
        <div className="text-center mb-8 lg:mb-12 animate-fade-up">
          <h2 
            className="text-[34px] lg:text-[32px] leading-[1.2] text-white mb-4 lg:mb-6 tracking-[-0.02em]"
            style={{ fontFamily: 'var(--font-heading)' }}
          >
            The Intelligence Layer for Music Marketing
          </h2>
          <p 
            className="text-base lg:text-lg text-[#A1A1A1] leading-relaxed max-w-[600px] mx-auto"
            style={{ fontFamily: 'var(--font-body)' }}
          >
            DTTracker is the intelligence layer for music marketing. Track creator activity, measure campaign performance, and manage influencer campaigns—all in one unified platform.
          </p>
        </div>

        {/* Outcome cards - Stacked mobile, Grid desktop */}
        <div className="grid lg:grid-cols-3 gap-4 lg:gap-6">
          {outcomes.map((outcome, index) => {
            const IconComponent = outcome.icon;
            return (
              <div 
                key={index}
                className="p-5 rounded-xl bg-[#0C0C0C] border border-[#1F1F1F] hover:bg-[#121212] hover:-translate-y-1 transition-all duration-150"
                style={{ 
                  borderRadius: '16px',
                  padding: '20px'
                }}
              >
                <div className="w-12 h-12 rounded-xl bg-[#E50914]/10 flex items-center justify-center mb-4">
                  <IconComponent size={24} strokeWidth={1.5} className="text-[#E50914]" />
                </div>
                <h3 
                  className="text-lg lg:text-xl font-bold text-white mb-2"
                  style={{ fontFamily: 'var(--font-heading)', letterSpacing: '-0.02em' }}
                >
                  {outcome.title}
                </h3>
                <p 
                  className="text-sm lg:text-base text-[#A1A1A1] leading-relaxed"
                  style={{ fontFamily: 'var(--font-body)' }}
                >
                  {outcome.description}
                </p>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}