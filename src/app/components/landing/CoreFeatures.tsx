import { FolderKanban, Users, BarChart3, Database, Bell, CheckCircle2 } from 'lucide-react';

export function CoreFeatures() {
  const features = [
    {
      icon: FolderKanban,
      title: 'Campaign Tracking',
      summary: 'Monitor all creator posts and activity across platforms.',
      bullets: [
        'Real-time TikTok, IG, and YouTube monitoring',
        'Automated content discovery',
        'Engagement rate tracking'
      ]
    },
    {
      icon: Users,
      title: 'Creator Intelligence',
      summary: 'Manage your creator roster with detailed analytics.',
      bullets: [
        'Historical engagement data',
        'Audience demographics',
        'Campaign performance history'
      ]
    },
    {
      icon: BarChart3,
      title: 'Performance Analytics',
      summary: 'Measure every creator partnership in one dashboard.',
      bullets: [
        'Content performance metrics',
        'Campaign impact tracking',
        'ROI calculation tools'
      ]
    },
    {
      icon: Database,
      title: 'Automated Scraping Engine',
      summary: 'Collect creator data automatically without manual updates.',
      bullets: [
        'Continuous data collection',
        'No manual exports needed',
        'Always up-to-date insights'
      ]
    },
    {
      icon: Bell,
      title: 'Viral Radar / Alerts',
      summary: 'Get notified when opportunities emerge.',
      bullets: [
        'Viral moment detection',
        'Creator post notifications',
        'Trend shift warnings'
      ]
    }
  ];

  return (
    <section 
      id="features"
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
            Everything You Need to Win
          </h2>
          <p 
            className="text-base lg:text-lg text-[#A1A1A1]"
            style={{ fontFamily: 'var(--font-body)' }}
          >
            Five core features designed to turn creator content into measurable success.
          </p>
        </div>

        {/* Feature grid - 1 column mobile, 2 columns tablet, 3 columns desktop */}
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4 lg:gap-6">
          {features.map((feature, index) => {
            const IconComponent = feature.icon;
            return (
              <div 
                key={index}
                className="p-5 rounded-xl bg-[#0C0C0C] border border-[#1F1F1F] hover:bg-[#121212] hover:-translate-y-1 transition-all duration-150"
                style={{ 
                  borderRadius: '16px',
                  padding: '20px'
                }}
              >
                {/* Icon + Title row */}
                <div className="flex items-center gap-3 mb-3">
                  <div className="w-10 h-10 rounded-lg bg-[#E50914]/10 flex items-center justify-center flex-shrink-0">
                    <IconComponent size={20} strokeWidth={1.5} className="text-[#E50914]" />
                  </div>
                  <h3 
                    className="text-base lg:text-lg font-bold text-white"
                    style={{ fontFamily: 'var(--font-heading)', letterSpacing: '-0.02em' }}
                  >
                    {feature.title}
                  </h3>
                </div>
                
                {/* Summary */}
                <p 
                  className="text-sm text-[#A1A1A1] mb-4 leading-relaxed"
                  style={{ fontFamily: 'var(--font-body)' }}
                >
                  {feature.summary}
                </p>
                
                {/* Bullets */}
                <ul className="space-y-2">
                  {feature.bullets.map((bullet, i) => (
                    <li key={i} className="flex items-start gap-2">
                      <CheckCircle2 size={14} strokeWidth={1.5} className="text-[#E50914] flex-shrink-0 mt-0.5" />
                      <span 
                        className="text-xs text-[#A1A1A1]"
                        style={{ fontFamily: 'var(--font-body)' }}
                      >
                        {bullet}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
