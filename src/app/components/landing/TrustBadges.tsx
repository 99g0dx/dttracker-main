export function TrustBadges() {
  const badges = [
    'Labels',
    'Managers', 
    'Agencies',
    'Independent Artists'
  ];

  return (
    <section 
      className="py-8 lg:py-12 border-y border-[#1F1F1F] bg-black"
      style={{ 
        paddingTop: '32px',
        paddingBottom: '32px'
      }}
    >
      <div className="max-w-[420px] lg:max-w-[1140px] mx-auto px-4 lg:px-8">
        <p 
          className="text-xs uppercase tracking-wider text-[#E50914] text-center mb-6"
          style={{ fontFamily: 'var(--font-body)' }}
        >
          Trusted by Labels, Managers, Agencies, Independent Artists
        </p>
        
        {/* Mobile: Horizontal scroll with snap */}
        <div className="lg:hidden overflow-x-auto -mx-4 px-4 scrollbar-hide">
          <div className="flex gap-4 snap-x snap-mandatory">
            {badges.map((badge, index) => (
              <div 
                key={index}
                className="flex items-center justify-center px-4 h-10 text-xs text-[#A1A1A1] border border-[#1F1F1F] rounded-lg bg-[#0C0C0C] whitespace-nowrap snap-start flex-shrink-0"
                style={{ 
                  fontFamily: 'var(--font-body)',
                  borderRadius: '8px',
                  minHeight: '44px'
                }}
              >
                {badge}
              </div>
            ))}
          </div>
        </div>

        {/* Desktop: Flex row */}
        <div className="hidden lg:flex items-center justify-center gap-8 flex-wrap">
          {badges.map((badge, index) => (
            <div 
              key={index}
              className="text-[#A1A1A1] hover:text-white transition-colors text-sm font-medium"
              style={{ fontFamily: 'var(--font-body)' }}
            >
              {badge}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
