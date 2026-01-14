import React from "react";
import { Card, CardContent } from "./ui/card";
import { Button } from "./ui/button";
import { Check, Zap, Crown, ArrowLeft } from "lucide-react";

interface SubscriptionProps {
  onNavigate: (path: string) => void;
}

const freePlanFeatures = [
  "Up to 2 active campaigns",
  "Up to 5 creators per campaign",
  "Basic analytics dashboard",
  "Manual post tracking",
  "Email support",
  "Data export (CSV)",
];

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

export function Subscription({ onNavigate }: SubscriptionProps) {
  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-center gap-3 sm:gap-4">
        <button
          onClick={() => onNavigate("/settings")}
          className="w-9 h-9 flex-shrink-0 rounded-md bg-white/[0.03] hover:bg-white/[0.06] border border-white/[0.08] flex items-center justify-center transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
        </button>
        <div className="flex-1 text-left sm:text-center min-w-0">
          <h1 className="text-2xl sm:text-3xl font-semibold tracking-tight text-white mb-2 sm:mb-3">
            Choose Your Plan
          </h1>
          <p className="text-sm sm:text-base text-slate-400 px-2">
            Start with our free plan and upgrade anytime to unlock powerful
            features for professional campaign tracking.
          </p>
        </div>
      </div>

      {/* Pricing Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-5xl mx-auto">
        {/* Free Plan */}
        <Card className="bg-[#0D0D0D] border-white/[0.08] relative overflow-hidden">
          <CardContent className="p-8">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-lg bg-white/[0.06] flex items-center justify-center">
                <Zap className="w-5 h-5 text-slate-400" />
              </div>
              <div>
                <h3 className="font-semibold text-white">Free</h3>
                <p className="text-sm text-slate-500">For getting started</p>
              </div>
            </div>

            <div className="mb-8">
              <div className="flex items-baseline gap-2">
                <span className="text-4xl font-semibold text-white">$0</span>
                <span className="text-slate-500">/month</span>
              </div>
            </div>

            <Button
              disabled
              className="w-full h-10 bg-white/[0.03] hover:bg-white/[0.06] border border-white/[0.08] text-slate-400 cursor-default mb-8"
            >
              Current Plan
            </Button>

            <div className="space-y-4">
              <p className="text-sm font-medium text-slate-400">
                Features included:
              </p>
              <ul className="space-y-3">
                {freePlanFeatures.map((feature, index) => (
                  <li key={index} className="flex items-start gap-3">
                    <div className="mt-0.5 w-5 h-5 rounded-full bg-white/[0.06] flex items-center justify-center flex-shrink-0">
                      <Check className="w-3 h-3 text-slate-400" />
                    </div>
                    <span className="text-sm text-slate-300">{feature}</span>
                  </li>
                ))}
              </ul>
            </div>
          </CardContent>
        </Card>

        {/* Pro Plan */}
        <Card className="bg-gradient-to-b from-primary/10 to-[#0D0D0D] border-primary/30 relative overflow-hidden">
          {/* Premium Badge */}
          <div className="absolute top-0 right-0 bg-black text-[#1d293d] text-xs font-medium px-3 py-1 rounded-bl-lg [background-clip:unset] [-webkit-background-clip:unset]">
            Popular
          </div>

          <CardContent className="p-8">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-lg bg-primary/20 flex items-center justify-center">
                <Crown className="w-5 h-5 text-primary" />
              </div>
              <div>
                <h3 className="font-semibold text-white">Pro</h3>
                <p className="text-sm text-slate-400">For professionals</p>
              </div>
            </div>

            <div className="mb-8">
              <div className="flex items-baseline gap-2">
                <span className="text-4xl font-semibold text-white">$49</span>
                <span className="text-slate-400">/month</span>
              </div>
              <p className="text-sm text-slate-500 mt-1">Billed monthly</p>
            </div>

            <Button
              onClick={() => onNavigate("/payment")}
              className="w-full h-10 bg-primary hover:bg-primary/90 text-black font-medium mb-8 [background-clip:unset] [-webkit-background-clip:unset]"
            >
              Upgrade to Pro
            </Button>

            <div className="space-y-4">
              <p className="text-sm font-medium text-slate-400">
                Everything in Free, plus:
              </p>
              <ul className="space-y-3">
                {proPlanFeatures.map((feature, index) => (
                  <li key={index} className="flex items-start gap-3">
                    <div className="mt-0.5 w-5 h-5 rounded-full bg-primary/20 flex items-center justify-center flex-shrink-0">
                      <Check className="w-3 h-3 text-primary" />
                    </div>
                    <span className="text-sm text-slate-300">{feature}</span>
                  </li>
                ))}
              </ul>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* FAQ / Additional Info */}
      <Card className="bg-[#0D0D0D] border-white/[0.08] max-w-5xl mx-auto">
        <CardContent className="p-8">
          <h3 className="font-semibold text-white mb-4">
            Frequently Asked Questions
          </h3>
          <div className="space-y-4">
            <div>
              <h4 className="text-sm font-medium text-white mb-1">
                Can I cancel anytime?
              </h4>
              <p className="text-sm text-slate-400">
                Yes, you can cancel your Pro subscription at any time. You'll
                retain access until the end of your billing period.
              </p>
            </div>
            <div>
              <h4 className="text-sm font-medium text-white mb-1">
                What payment methods do you accept?
              </h4>
              <p className="text-sm text-slate-400">
                We accept all major credit cards (Visa, MasterCard, American
                Express) and PayPal.
              </p>
            </div>
            <div>
              <h4 className="text-sm font-medium text-white mb-1">
                Is there a free trial for Pro?
              </h4>
              <p className="text-sm text-slate-400">
                Yes! All new Pro subscriptions include a 14-day free trial. No
                credit card required.
              </p>
            </div>
            <div>
              <h4 className="text-sm font-medium text-white mb-1">
                Can I upgrade or downgrade later?
              </h4>
              <p className="text-sm text-slate-400">
                Absolutely. You can change your plan at any time from your
                account settings.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
