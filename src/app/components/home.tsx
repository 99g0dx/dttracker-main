import React from 'react';
import { Button } from './ui/button';
import { 
  ArrowRight, 
  TrendingUp, 
  Users, 
  Calendar, 
  BarChart3,
  Zap,
  Shield,
} from 'lucide-react';
import logoImage from '../../assets/fcad7446971be733d3427a6b22f8f64253529daf.png';

interface HomeProps {
  onNavigate: (path: string) => void;
}

export function Home({ onNavigate }: HomeProps) {
  const features = [
    {
      icon: <BarChart3 className="w-5 h-5" />,
      title: 'Real-time Analytics',
      description: 'Track campaign performance across TikTok, Instagram, YouTube, Twitter, and Facebook.',
    },
    {
      icon: <Users className="w-5 h-5" />,
      title: 'Creator Management',
      description: 'Organize creators, track deliverables, and manage relationships in one place.',
    },
    {
      icon: <Calendar className="w-5 h-5" />,
      title: 'Content Planning',
      description: 'Schedule activities and coordinate campaigns with a powerful calendar interface.',
    },
    {
      icon: <TrendingUp className="w-5 h-5" />,
      title: 'Performance Reports',
      description: 'Generate detailed reports and insights to optimize your marketing strategy.',
    },
    {
      icon: <Shield className="w-5 h-5" />,
      title: 'Team Permissions',
      description: 'Control access at workspace, campaign, and calendar levels with granular permissions.',
    },
    {
      icon: <Zap className="w-5 h-5" />,
      title: 'Automated Tracking',
      description: 'Automatically scrape and update metrics without manual data entry.',
    },
  ];

  return (
    <div className="min-h-screen bg-[#0A0A0A]">
      {/* Navigation */}
      <nav className="fixed top-0 left-0 right-0 z-50 bg-[#0A0A0A]/95 backdrop-blur-sm border-b border-white/[0.06]">
        <div className="max-w-6xl mx-auto px-6">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-2">
              <img src={logoImage} alt="DTTracker" className="w-7 h-7 object-contain" />
              <span className="font-semibold text-white">DTTracker</span>
            </div>
            <div className="flex items-center gap-3">
              <Button
                onClick={() => onNavigate('/login')}
                variant="ghost"
                className="h-9 px-4 text-slate-400 hover:text-white hover:bg-transparent"
              >
                Sign In
              </Button>
              <Button
                onClick={() => onNavigate('/signup')}
                className="h-9 px-4 bg-white text-black hover:bg-white/90"
              >
                Get Started
              </Button>
            </div>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="pt-40 pb-24 px-6">
        <div className="max-w-3xl mx-auto text-center">
          <h1 className="text-5xl sm:text-6xl font-semibold text-white mb-6 tracking-tight leading-tight">
            Campaign tracking for<br />marketing teams
          </h1>
          <p className="text-lg text-slate-400 mb-10 max-w-xl mx-auto">
            Manage creator campaigns, track performance, and analyze results across all social platforms.
          </p>
          <div className="flex items-center justify-center gap-3">
            <Button
              onClick={() => onNavigate('/signup')}
              className="h-10 px-5 bg-white text-black hover:bg-white/90"
            >
              Start free trial
              <ArrowRight className="w-4 h-4 ml-2" />
            </Button>
          </div>
          <p className="text-sm text-slate-500 mt-4">
            Free 14-day trial · No credit card required
          </p>
        </div>
      </section>

      {/* Features Section */}
      <section className="py-20 px-6">
        <div className="max-w-5xl mx-auto">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {features.map((feature, index) => (
              <div key={index} className="space-y-2">
                <div className="w-10 h-10 rounded-md bg-white/[0.04] flex items-center justify-center text-white mb-3">
                  {feature.icon}
                </div>
                <h3 className="font-medium text-white">{feature.title}</h3>
                <p className="text-sm text-slate-500 leading-relaxed">{feature.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Pricing Section */}
      <section className="py-20 px-6">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-3xl font-semibold text-white mb-3">Pricing</h2>
            <p className="text-slate-400">Simple, transparent pricing for teams of all sizes</p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-4xl mx-auto">
            <div className="p-8 bg-white/[0.02] border border-white/[0.06] rounded-lg transition-all hover:bg-white/[0.04] hover:border-white/[0.08]">
              <div className="mb-6">
                <h3 className="font-medium text-white mb-1">Free</h3>
                <div className="flex items-baseline gap-1 mb-2">
                  <span className="text-3xl font-semibold text-white">$0</span>
                </div>
                <p className="text-sm text-slate-500">For individuals</p>
              </div>
              <ul className="space-y-2 mb-6 text-sm">
                <li className="text-slate-400">2 campaigns</li>
                <li className="text-slate-400">5 creators per campaign</li>
                <li className="text-slate-400">Basic analytics</li>
              </ul>
              <Button
                onClick={() => onNavigate('/signup')}
                variant="outline"
                className="w-full h-9 bg-transparent border-white/[0.1] text-white hover:bg-white/[0.04] transition-all"
              >
                Get started
              </Button>
            </div>

            <div className="p-8 bg-white/[0.04] border border-white/[0.1] rounded-lg relative transition-all hover:bg-white/[0.06] hover:border-white/[0.15] hover:shadow-lg hover:shadow-white/[0.05]">
              {/* Popular Badge */}
              <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                <span className="px-3 py-1 bg-primary text-black text-xs font-medium rounded-full">
                  Popular
                </span>
              </div>
              <div className="mb-6">
                <h3 className="font-medium text-white mb-1">Pro</h3>
                <div className="flex items-baseline gap-1 mb-2">
                  <span className="text-3xl font-semibold text-white">$49</span>
                  <span className="text-sm text-slate-500">/month</span>
                </div>
                <p className="text-sm text-slate-500">For small teams</p>
              </div>
              <ul className="space-y-2 mb-6 text-sm">
                <li className="text-slate-300">Unlimited campaigns</li>
                <li className="text-slate-300">Unlimited creators</li>
                <li className="text-slate-300">Advanced analytics</li>
                <li className="text-slate-300">Auto metric scraping</li>
                <li className="text-slate-300">Team collaboration</li>
              </ul>
              <Button
                onClick={() => onNavigate('/signup')}
                className="w-full h-9 bg-white text-black hover:bg-white/90 transition-all"
              >
                Start trial
              </Button>
            </div>

            <div className="p-8 bg-white/[0.02] border border-white/[0.06] rounded-lg transition-all hover:bg-white/[0.04] hover:border-white/[0.08]">
              <div className="mb-6">
                <h3 className="font-medium text-white mb-1">Enterprise</h3>
                <div className="flex items-baseline gap-1 mb-2">
                  <span className="text-3xl font-semibold text-white">Custom</span>
                </div>
                <p className="text-sm text-slate-500">For organizations</p>
              </div>
              <ul className="space-y-2 mb-6 text-sm">
                <li className="text-slate-400">Everything in Pro</li>
                <li className="text-slate-400">Custom integrations</li>
                <li className="text-slate-400">Dedicated support</li>
                <li className="text-slate-400">Advanced security</li>
              </ul>
              <Button
                onClick={() => onNavigate('/signup')}
                variant="outline"
                className="w-full h-9 bg-transparent border-white/[0.1] text-white hover:bg-white/[0.04] transition-all"
              >
                Contact sales
              </Button>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-white/[0.06] py-12 px-6 mt-20">
        <div className="max-w-6xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <img src={logoImage} alt="DTTracker" className="w-5 h-5 object-contain" />
            <span className="text-sm text-slate-500">© {new Date().getFullYear()} DTTracker</span>
          </div>
          <div className="flex items-center gap-6 text-sm text-slate-500">
            <button onClick={() => onNavigate('/privacy')} className="hover:text-slate-400 transition-colors">Privacy</button>
            <button onClick={() => onNavigate('/terms')} className="hover:text-slate-400 transition-colors">Terms</button>
            <button onClick={() => onNavigate('/contact')} className="hover:text-slate-400 transition-colors">Contact</button>
          </div>
        </div>
      </footer>
    </div>
  );
}