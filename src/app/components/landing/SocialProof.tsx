import { useEffect, useRef, useState } from 'react';
import { Gauge, UserCheck, Rocket } from 'lucide-react';

function useCountUp(end: number, duration: number = 2000) {
  const [count, setCount] = useState(0);
  const [isVisible, setIsVisible] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsVisible(true);
        }
      },
      { threshold: 0.1 }
    );

    if (ref.current) {
      observer.observe(ref.current);
    }

    return () => {
      if (ref.current) {
        observer.unobserve(ref.current);
      }
    };
  }, []);

  useEffect(() => {
    if (!isVisible) return;

    let startTime: number;
    let animationFrame: number;

    const animate = (timestamp: number) => {
      if (!startTime) startTime = timestamp;
      const progress = Math.min((timestamp - startTime) / duration, 1);
      
      setCount(Math.floor(progress * end));

      if (progress < 1) {
        animationFrame = requestAnimationFrame(animate);
      }
    };

    animationFrame = requestAnimationFrame(animate);

    return () => {
      if (animationFrame) {
        cancelAnimationFrame(animationFrame);
      }
    };
  }, [isVisible, end, duration]);

  return { count, ref };
}

export function SocialProof() {
  const metrics = [
    {
      value: 3,
      suffix: 'x',
      label: 'faster campaign analysis',
      description: 'Teams reduce manual research time by 67%',
      icon: Gauge
    },
    {
      value: 60,
      suffix: '%',
      label: 'better creator selection',
      description: 'Data-driven discovery leads to higher engagement',
      icon: UserCheck
    },
    {
      value: 40,
      suffix: '%',
      label: 'increase in efficiency',
      description: 'Automate tracking and focus on strategy',
      icon: Rocket
    }
  ];

  const testimonials = [
    {
      quote: 'DTTracker gave us visibility we never had before. We identified a micro-influencer who drove 200k streams in one weekend.',
      author: 'Sarah Chen',
      role: 'A&R Manager',
      company: 'Indie Label Co.'
    },
    {
      quote: 'We cut our research time in half and doubled our influencer ROI. This is the tool we didn\'t know we needed.',
      author: 'Marcus Rivera',
      role: 'Digital Marketing Lead',
      company: 'Pulse Media Agency'
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
        <h2 
          className="text-[34px] lg:text-[32px] leading-[1.2] text-white text-center mb-8 lg:mb-12 tracking-[-0.02em]"
          style={{ fontFamily: 'var(--font-heading)' }}
        >
          Real Results from Real Teams
        </h2>

        {/* Metrics - Stack mobile, Grid desktop */}
        <div className="space-y-6 lg:space-y-0 lg:grid lg:grid-cols-3 lg:gap-6 mb-12 lg:mb-16">
          {metrics.map((metric, index) => {
            const { count, ref } = useCountUp(metric.value);
            const IconComponent = metric.icon;
            return (
              <div 
                key={index}
                ref={ref}
                className="text-center p-6 rounded-xl bg-[#0C0C0C] border border-[#1F1F1F]"
                style={{ 
                  borderRadius: '16px',
                  padding: '20px',
                  minHeight: '120px'
                }}
              >
                <div className="w-12 h-12 rounded-xl bg-[#E50914]/10 flex items-center justify-center mx-auto mb-3">
                  <IconComponent size={24} strokeWidth={1.5} className="text-[#E50914]" />
                </div>
                <div 
                  className="text-5xl lg:text-6xl font-bold text-[#E50914] mb-2"
                  style={{ fontFamily: 'var(--font-heading)' }}
                >
                  {count}{metric.suffix}
                </div>
                <div 
                  className="text-base lg:text-xl font-bold text-white mb-1"
                  style={{ fontFamily: 'var(--font-heading)', letterSpacing: '-0.02em' }}
                >
                  {metric.label}
                </div>
                <div 
                  className="text-sm text-[#A1A1A1]"
                  style={{ fontFamily: 'var(--font-body)' }}
                >
                  {metric.description}
                </div>
              </div>
            );
          })}
        </div>

        {/* Testimonials - 1 on mobile, 2 on desktop */}
        <div className="lg:hidden">
          <div 
            className="p-6 rounded-xl bg-[#0C0C0C] border border-[#1F1F1F]"
            style={{ 
              borderRadius: '16px',
              padding: '20px'
            }}
          >
            <p 
              className="text-base text-white italic mb-4 leading-relaxed"
              style={{ fontFamily: 'var(--font-body)' }}
            >
              "{testimonials[0].quote}"
            </p>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-[#E50914]/20 flex items-center justify-center flex-shrink-0">
                <span className="text-[#E50914] font-bold text-sm">
                  {testimonials[0].author.split(' ').map(n => n[0]).join('')}
                </span>
              </div>
              <div>
                <div 
                  className="text-sm text-white font-medium"
                  style={{ fontFamily: 'var(--font-body)' }}
                >
                  {testimonials[0].author}
                </div>
                <div 
                  className="text-xs text-[#A1A1A1]"
                  style={{ fontFamily: 'var(--font-body)' }}
                >
                  {testimonials[0].role}, {testimonials[0].company}
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="hidden lg:grid grid-cols-2 gap-6">
          {testimonials.map((testimonial, index) => (
            <div 
              key={index}
              className="p-8 rounded-xl bg-[#0C0C0C] border border-[#1F1F1F] hover:bg-[#121212] hover:-translate-y-1 transition-all duration-150"
              style={{ 
                borderRadius: '16px',
                padding: '24px'
              }}
            >
              <p 
                className="text-lg text-white italic mb-6 leading-relaxed"
                style={{ fontFamily: 'var(--font-body)' }}
              >
                "{testimonial.quote}"
              </p>
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-full bg-[#E50914]/20 flex items-center justify-center">
                  <span className="text-[#E50914] font-bold">
                    {testimonial.author.split(' ').map(n => n[0]).join('')}
                  </span>
                </div>
                <div>
                  <div 
                    className="text-white font-medium"
                    style={{ fontFamily: 'var(--font-body)' }}
                  >
                    {testimonial.author}
                  </div>
                  <div 
                    className="text-sm text-[#A1A1A1]"
                    style={{ fontFamily: 'var(--font-body)' }}
                  >
                    {testimonial.role}, {testimonial.company}
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
