import { useState } from 'react';
import { Hero } from './landing/Hero';
import { TrustBadges } from './landing/TrustBadges';
import { Problem } from './landing/Problem';
import { WhatIsDTTracker } from './landing/WhatIsDTTracker';
import { CoreFeatures } from './landing/CoreFeatures';
import { HowItWorks } from './landing/HowItWorks';
import { UseCases } from './landing/UseCases';
import { DashboardPreview } from './landing/DashboardPreview';
import { SocialProof } from './landing/SocialProof';
import { PricingTeaser } from './landing/PricingTeaser';
import { FinalCTA } from './landing/FinalCTA';
import { Footer } from './landing/Footer';
import { Navigation } from './landing/Navigation';
import { BookDemoModal } from './landing/BookDemoModal';

interface HomeProps {
  onNavigate: (path: string) => void;
}

export function Home({ onNavigate: _onNavigate }: HomeProps) {
  const [isDemoModalOpen, setIsDemoModalOpen] = useState(false);

  return (
    <div className="landing-page min-h-screen bg-black text-white overflow-x-hidden">
      <Navigation onOpenDemo={() => setIsDemoModalOpen(true)} />
      <main>
        <Hero onOpenDemo={() => setIsDemoModalOpen(true)} />
        <TrustBadges />
        <Problem />
        <WhatIsDTTracker />
        <CoreFeatures />
        <HowItWorks />
        <UseCases />
        <DashboardPreview onOpenDemo={() => setIsDemoModalOpen(true)} />
        <SocialProof />
        <PricingTeaser />
        <FinalCTA onOpenDemo={() => setIsDemoModalOpen(true)} />
      </main>
      <Footer />
      <BookDemoModal 
        isOpen={isDemoModalOpen} 
        onClose={() => setIsDemoModalOpen(false)} 
      />
    </div>
  );
}
