import { Link } from "react-router-dom";
import { Button } from "../ui/button";
import { Check, UsersRound, Building2, ArrowLeft } from "lucide-react";
import { Navigation } from "./Navigation";
import { Footer } from "./Footer";

const proPlanFeatures = [
  "Unlimited campaigns",
  "Unlimited creators",
  "Advanced analytics & insights",
  "Automated post scraping",
  "Multi-platform support (TikTok, Instagram, YouTube, Twitter, Facebook)",
  "Real-time performance tracking",
  "Custom reports & dashboards",
  "Priority support (24/7)",
  "API access",
  "Team collaboration",
  "Data retention (unlimited)",
  "White-label reports",
];

const agencyPlanFeatures = [
  "Everything in Pro",
  "Dedicated account manager",
  "Custom integrations",
  "SLA guarantees",
  "Volume discounts",
  "Custom onboarding",
  "Advanced security features",
];

interface PricingProps {
  onOpenDemo?: () => void;
}

export function Pricing({ onOpenDemo }: PricingProps) {
  const handleOpenDemo = () => {
    if (onOpenDemo) {
      onOpenDemo();
    }
  };

  return (
    <div className="min-h-screen bg-black">
      <Navigation onOpenDemo={handleOpenDemo} />

      <main className="pt-24 pb-16">
        <div className="max-w-[420px] lg:max-w-[1140px] mx-auto px-4 lg:px-8">
          {/* Back link */}
          <Link
            to="/"
            className="inline-flex items-center gap-2 text-[#A1A1A1] hover:text-white transition-colors mb-8"
            style={{ fontFamily: "var(--font-body)" }}
          >
            <ArrowLeft size={16} strokeWidth={1.5} />
            Back to Home
          </Link>

          {/* Header */}
          <div className="text-center mb-12">
            <h1
              className="text-[40px] lg:text-[48px] leading-[1.1] text-white mb-4 tracking-[-0.02em]"
              style={{ fontFamily: "var(--font-heading)" }}
            >
              Simple, Transparent Pricing
            </h1>
            <p
              className="text-lg text-[#A1A1A1] max-w-2xl mx-auto"
              style={{ fontFamily: "var(--font-body)" }}
            >
              Start with a 14-day Pro trial. Upgrade any time.
            </p>
          </div>

          {/* Pricing Cards */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-16">
            {/* Pro Plan */}
            <div className="bg-[#E50914]/10 border-2 border-[#E50914] rounded-2xl p-6 lg:p-8 relative lg:scale-105">
              <div
                className="absolute top-0 right-4 bg-[#E50914] text-white text-xs font-medium px-3 py-1 rounded-b-lg"
                style={{ fontFamily: "var(--font-body)" }}
              >
                Most Popular
              </div>

              <div className="w-12 h-12 rounded-lg bg-[#E50914]/20 flex items-center justify-center mb-6">
                <UsersRound
                  size={24}
                  strokeWidth={1.5}
                  className="text-[#E50914]"
                />
              </div>

              <div
                className="inline-block px-3 py-1 rounded-full text-xs font-medium mb-4 bg-[#E50914] text-white"
                style={{ fontFamily: "var(--font-body)" }}
              >
                Most Popular
              </div>

              <h3
                className="text-2xl font-bold text-white mb-2"
                style={{
                  fontFamily: "var(--font-heading)",
                  letterSpacing: "-0.02em",
                }}
              >
                Pro
              </h3>

              <div className="mb-4">
                <span
                  className="text-4xl font-bold text-[#E50914]"
                  style={{ fontFamily: "var(--font-heading)" }}
                >
                  $49
                </span>
                <span
                  className="text-sm text-[#A1A1A1]"
                  style={{ fontFamily: "var(--font-body)" }}
                >
                  /month
                </span>
              </div>

              <p
                className="text-[#A1A1A1] mb-6"
                style={{ fontFamily: "var(--font-body)" }}
              >
                14-day free trial included
              </p>

              <Button
                asChild
                className="w-full h-12 bg-[#E50914] hover:opacity-90 text-white rounded-xl mb-8"
                style={{ fontFamily: "var(--font-body)" }}
              >
                <Link to="/signup">Start 14-Day Free Trial</Link>
              </Button>

              <div className="space-y-3">
                <p
                  className="text-sm font-medium text-[#A1A1A1] mb-4"
                  style={{ fontFamily: "var(--font-body)" }}
                >
                  Everything you need to scale:
                </p>
                {proPlanFeatures.map((feature, index) => (
                  <div key={index} className="flex items-start gap-3">
                    <div className="mt-0.5 w-5 h-5 rounded-full bg-[#E50914]/20 flex items-center justify-center flex-shrink-0">
                      <Check
                        size={12}
                        strokeWidth={2}
                        className="text-[#E50914]"
                      />
                    </div>
                    <span
                      className="text-sm text-[#A1A1A1]"
                      style={{ fontFamily: "var(--font-body)" }}
                    >
                      {feature}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* Agency Plan */}
            <div className="bg-[#0C0C0C] border border-[#1F1F1F] rounded-2xl p-6 lg:p-8">
              <div className="w-12 h-12 rounded-lg bg-[#1F1F1F] flex items-center justify-center mb-6">
                <Building2
                  size={24}
                  strokeWidth={1.5}
                  className="text-[#A1A1A1]"
                />
              </div>

              <div
                className="inline-block px-3 py-1 rounded-full text-xs font-medium mb-4 bg-[#1F1F1F] text-[#A1A1A1]"
                style={{ fontFamily: "var(--font-body)" }}
              >
                Unlimited scale
              </div>

              <h3
                className="text-2xl font-bold text-white mb-2"
                style={{
                  fontFamily: "var(--font-heading)",
                  letterSpacing: "-0.02em",
                }}
              >
                Agency
              </h3>

              <div className="mb-4">
                <span
                  className="text-4xl font-bold text-white"
                  style={{ fontFamily: "var(--font-heading)" }}
                >
                  Custom
                </span>
              </div>

              <p
                className="text-[#A1A1A1] mb-6"
                style={{ fontFamily: "var(--font-body)" }}
              >
                For agencies and labels managing multiple clients
              </p>

              <Button
                onClick={handleOpenDemo}
                className="w-full h-12 bg-white/10 hover:bg-white/20 text-white border border-[#1F1F1F] rounded-xl mb-8"
                style={{ fontFamily: "var(--font-body)" }}
              >
                Contact Sales
              </Button>

              <div className="space-y-3">
                <p
                  className="text-sm font-medium text-[#A1A1A1] mb-4"
                  style={{ fontFamily: "var(--font-body)" }}
                >
                  Everything in Pro, plus:
                </p>
                {agencyPlanFeatures.map((feature, index) => (
                  <div key={index} className="flex items-start gap-3">
                    <div className="mt-0.5 w-5 h-5 rounded-full bg-[#1F1F1F] flex items-center justify-center flex-shrink-0">
                      <Check
                        size={12}
                        strokeWidth={2}
                        className="text-[#A1A1A1]"
                      />
                    </div>
                    <span
                      className="text-sm text-[#A1A1A1]"
                      style={{ fontFamily: "var(--font-body)" }}
                    >
                      {feature}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* FAQ Section */}
          <div className="max-w-3xl mx-auto">
            <h2
              className="text-2xl font-bold text-white text-center mb-8"
              style={{
                fontFamily: "var(--font-heading)",
                letterSpacing: "-0.02em",
              }}
            >
              Frequently Asked Questions
            </h2>

            <div className="space-y-6">
              <div className="bg-[#0C0C0C] border border-[#1F1F1F] rounded-xl p-6">
                <h4
                  className="font-medium text-white mb-2"
                  style={{ fontFamily: "var(--font-body)" }}
                >
                  Can I cancel anytime?
                </h4>
                <p
                  className="text-sm text-[#A1A1A1]"
                  style={{ fontFamily: "var(--font-body)" }}
                >
                  Yes, you can cancel your subscription at any time. You'll
                  retain access until the end of your billing period.
                </p>
              </div>

              <div className="bg-[#0C0C0C] border border-[#1F1F1F] rounded-xl p-6">
                <h4
                  className="font-medium text-white mb-2"
                  style={{ fontFamily: "var(--font-body)" }}
                >
                  What payment methods do you accept?
                </h4>
                <p
                  className="text-sm text-[#A1A1A1]"
                  style={{ fontFamily: "var(--font-body)" }}
                >
                  We accept all major credit cards (Visa, MasterCard, American
                  Express), PayPal, and Paystack for African payments.
                </p>
              </div>

              <div className="bg-[#0C0C0C] border border-[#1F1F1F] rounded-xl p-6">
                <h4
                  className="font-medium text-white mb-2"
                  style={{ fontFamily: "var(--font-body)" }}
                >
                  Is there a free trial for Pro?
                </h4>
                <p
                  className="text-sm text-[#A1A1A1]"
                  style={{ fontFamily: "var(--font-body)" }}
                >
                  Yes! All new Pro subscriptions include a 14-day free trial. No
                  credit card required to start.
                </p>
              </div>

              <div className="bg-[#0C0C0C] border border-[#1F1F1F] rounded-xl p-6">
                <h4
                  className="font-medium text-white mb-2"
                  style={{ fontFamily: "var(--font-body)" }}
                >
                  Can I upgrade or downgrade later?
                </h4>
                <p
                  className="text-sm text-[#A1A1A1]"
                  style={{ fontFamily: "var(--font-body)" }}
                >
                  Absolutely. You can change your plan at any time from your
                  account settings.
                </p>
              </div>
            </div>
          </div>
        </div>
      </main>

      <Footer />
    </div>
  );
}
