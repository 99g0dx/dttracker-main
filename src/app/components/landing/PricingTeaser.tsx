import { Link } from 'react-router-dom';
import { Button } from '../ui/button';
import { User, UsersRound, Building2 } from 'lucide-react';

export function PricingTeaser() {
  const tiers = [
    {
      name: 'Starter',
      badge: 'Great for solo campaigns',
      positioning: 'Perfect for independent artists and emerging managers',
      featured: false,
      icon: User
    },
    {
      name: 'Pro',
      badge: 'Most Popular',
      positioning: 'Built for artist managers and small labels',
      featured: true,
      icon: UsersRound
    },
    {
      name: 'Agency',
      badge: 'Unlimited scale',
      positioning: 'For agencies and labels managing multiple clients',
      featured: false,
      icon: Building2
    }
  ];

  return (
    <section 
      id="pricing"
      className="py-12 lg:py-18 relative bg-black"
      style={{ 
        paddingTop: '48px',
        paddingBottom: '48px'
      }}
    >
      <div className="max-w-[420px] lg:max-w-[1140px] mx-auto px-4 lg:px-8">
        <h2 
          className="text-[34px] lg:text-[32px] leading-[1.2] text-white text-center mb-8 lg:mb-12 tracking-[-0.02em]"
          style={{ fontFamily: 'var(--font-heading)' }}
        >
          Pricing Built for Your Scale
        </h2>

        {/* Mobile: Horizontal scroll snap */}
        <div className="lg:hidden overflow-x-auto -mx-4 px-4 mb-8 scrollbar-hide">
          <div className="flex gap-4 snap-x snap-mandatory pb-4">
            {tiers.map((tier, index) => {
              const IconComponent = tier.icon;
              return (
                <div 
                  key={index}
                  className={`snap-center flex-shrink-0 w-[85vw] max-w-[340px] p-6 rounded-xl transition-all ${
                    tier.featured
                      ? 'bg-[#E50914]/10 border-2 border-[#E50914]'
                      : 'bg-[#0C0C0C] border border-[#1F1F1F]'
                  }`}
                  style={{ 
                    borderRadius: '16px',
                    padding: '20px'
                  }}
                >
                  <div className={`w-10 h-10 rounded-lg flex items-center justify-center mb-4 ${
                    tier.featured ? 'bg-[#E50914]/20' : 'bg-[#1F1F1F]'
                  }`}>
                    <IconComponent size={20} strokeWidth={1.5} className={tier.featured ? 'text-[#E50914]' : 'text-[#A1A1A1]'} />
                  </div>

                  <div className={`inline-block px-3 py-1 rounded-full text-xs font-medium mb-4 ${
                    tier.featured
                      ? 'bg-[#E50914] text-white'
                      : 'bg-[#1F1F1F] text-[#A1A1A1]'
                  }`}
                  style={{ 
                    borderRadius: '12px',
                    fontFamily: 'var(--font-body)'
                  }}
                  >
                    {tier.badge}
                  </div>

                  <h3 
                    className="text-xl font-bold text-white mb-3"
                    style={{ fontFamily: 'var(--font-heading)', letterSpacing: '-0.02em' }}
                  >
                    {tier.name}
                  </h3>

                  <p 
                    className="text-sm text-[#A1A1A1] mb-6 leading-relaxed"
                    style={{ fontFamily: 'var(--font-body)' }}
                  >
                    {tier.positioning}
                  </p>

                  <div className="h-14 flex items-center justify-center border-t border-b border-[#1F1F1F]">
                    <span 
                      className="text-sm text-[#A1A1A1]"
                      style={{ fontFamily: 'var(--font-body)' }}
                    >
                      View pricing details
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Desktop: Grid */}
        <div className="hidden lg:grid grid-cols-3 gap-6 mb-12">
          {tiers.map((tier, index) => {
            const IconComponent = tier.icon;
            return (
              <div 
                key={index}
                className={`relative p-10 rounded-xl transition-all duration-150 ${
                  tier.featured
                    ? 'bg-[#E50914]/10 border-2 border-[#E50914] scale-105 hover:-translate-y-1'
                    : 'bg-[#0C0C0C] border border-[#1F1F1F] hover:bg-[#121212] hover:-translate-y-1'
                }`}
                style={{ 
                  borderRadius: '16px',
                  padding: '24px'
                }}
              >
                <div className={`w-12 h-12 rounded-lg flex items-center justify-center mb-6 ${
                  tier.featured ? 'bg-[#E50914]/20' : 'bg-[#1F1F1F]'
                }`}>
                  <IconComponent size={24} strokeWidth={1.5} className={tier.featured ? 'text-[#E50914]' : 'text-[#A1A1A1]'} />
                </div>

                <div className={`inline-block px-3 py-1 rounded-full text-xs font-medium mb-6 ${
                  tier.featured
                    ? 'bg-[#E50914] text-white'
                    : 'bg-[#1F1F1F] text-[#A1A1A1]'
                }`}
                style={{ 
                  borderRadius: '12px',
                  fontFamily: 'var(--font-body)'
                }}
                >
                  {tier.badge}
                </div>

                <h3 
                  className="text-2xl font-bold text-white mb-3"
                  style={{ fontFamily: 'var(--font-heading)', letterSpacing: '-0.02em' }}
                >
                  {tier.name}
                </h3>

                <p 
                  className="text-[#A1A1A1] mb-6 leading-relaxed"
                  style={{ fontFamily: 'var(--font-body)' }}
                >
                  {tier.positioning}
                </p>

                <div className="h-16 flex items-center justify-center border-t border-b border-[#1F1F1F] mb-6">
                  <span 
                    className="text-[#A1A1A1]"
                    style={{ fontFamily: 'var(--font-body)' }}
                  >
                    View pricing details
                  </span>
                </div>
              </div>
            );
          })}
        </div>

        {/* CTA - Full width mobile */}
        <div className="text-center">
          <Button
            asChild
            className="w-full lg:w-auto bg-[#E50914] hover:opacity-90 text-white h-12 px-8 rounded-xl transition-scale"
            style={{ fontFamily: 'var(--font-body)' }}
          >
            <Link to="/signup">View Full Pricing & Features</Link>
          </Button>
        </div>
      </div>
      
    </section>
  );
}
