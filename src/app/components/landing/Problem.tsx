import { SearchX, Table2, BarChartHorizontal, TrendingDown, Unlink } from 'lucide-react';

export function Problem() {
  const painPoints = [
    { text: 'Manual creator research takes days', icon: SearchX },
    { text: 'Spreadsheets can\'t track real-time trends', icon: Table2 },
    { text: 'Influencer ROI is impossible to measure', icon: BarChartHorizontal },
    { text: 'Finding viral moments before they peak', icon: TrendingDown },
    { text: 'No centralized view of campaign performance', icon: Unlink }
  ];

  return (
    <section 
      className="py-12 lg:py-18 relative bg-black"
      style={{ 
        paddingTop: '48px',
        paddingBottom: '48px'
      }}
    >
      <div className="max-w-[420px] lg:max-w-[1140px] mx-auto px-4 lg:px-8">
        <div className="animate-fade-up">
          <h2 
            className="text-[34px] lg:text-[32px] leading-[1.2] text-white text-center mb-8 lg:mb-12 tracking-[-0.02em]"
            style={{ fontFamily: 'var(--font-heading)' }}
          >
            Stop Guessing. Start Knowing.
          </h2>

          {/* Mobile: 1-column, Desktop: 2-column */}
          <div className="grid lg:grid-cols-2 gap-3 lg:gap-4 mb-8">
            {painPoints.map((point, index) => {
              const IconComponent = point.icon;
              return (
                <div 
                  key={index}
                  className="flex items-center gap-3 p-4 lg:p-5 rounded-lg bg-[#0C0C0C] border-l-2 border-[#E50914] hover:bg-[#121212] transition-all"
                  style={{ 
                    borderRadius: '8px',
                    minHeight: '44px'
                  }}
                >
                  <IconComponent size={18} strokeWidth={1.5} className="text-[#E50914] flex-shrink-0" />
                  <span 
                    className="text-white text-sm lg:text-base"
                    style={{ fontFamily: 'var(--font-body)' }}
                  >
                    {point.text}
                  </span>
                </div>
              );
            })}
          </div>

          <p 
            className="text-center text-[#E50914] text-lg lg:text-xl font-bold"
            style={{ fontFamily: 'var(--font-heading)' }}
          >
            DTTracker fixes all of that.
          </p>
        </div>
      </div>
    </section>
  );
}