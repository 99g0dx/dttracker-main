import React, { useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Card, CardContent } from './ui/card';
import { Button } from './ui/button';
import { ArrowLeft, CheckCircle2, Shield, Lock, Loader2, AlertCircle } from 'lucide-react';
import { useCreateCheckout, usePlans, useBillingSummary } from '../../hooks/useBilling';

interface PaymentProps {
  onNavigate: (path: string) => void;
}

export function Payment({ onNavigate }: PaymentProps) {
  const [searchParams] = useSearchParams();
  const planSlug = searchParams.get('plan') || 'pro';

  const { data: plans, isLoading: plansLoading } = usePlans();
  const { data: billing } = useBillingSummary();
  const createCheckout = useCreateCheckout();

  const selectedPlan = plans?.find(p => p.slug === planSlug) || plans?.find(p => p.slug === 'pro');

  const handlePayWithPaystack = async () => {
    if (!selectedPlan) return;

    try {
      await createCheckout.mutateAsync({
        planSlug: selectedPlan.slug,
        callbackUrl: `${window.location.origin}/billing/success`,
      });
      // The mutation will redirect to Paystack automatically
    } catch (error) {
      console.error('Failed to create checkout:', error);
    }
  };

  // If already subscribed, redirect to subscription page
  useEffect(() => {
    if (billing?.is_paid && billing?.subscription?.status === 'active') {
      onNavigate('/subscription');
    }
  }, [billing, onNavigate]);

  // Format price for display
  const formatPrice = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
    }).format(amount / 100);
  };

  if (plansLoading) {
    return (
      <div className="max-w-2xl mx-auto flex items-center justify-center min-h-[400px]">
        <Loader2 className="w-8 h-8 animate-spin text-slate-400" />
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <button
          onClick={() => onNavigate('/subscription')}
          className="w-10 h-10 rounded-lg bg-white/[0.03] hover:bg-white/[0.06] border border-white/[0.08] flex items-center justify-center transition-colors"
        >
          <ArrowLeft className="w-5 h-5 text-slate-400" />
        </button>
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-white">Complete Your Purchase</h1>
          <p className="text-sm text-slate-400 mt-1">Secure checkout powered by Paystack</p>
        </div>
      </div>

      <div className="grid lg:grid-cols-3 gap-6">
        {/* Order Summary */}
        <div className="lg:col-span-1">
          <Card className="bg-[#0D0D0D] border-white/[0.08] sticky top-6">
            <CardContent className="p-6">
              <h3 className="font-semibold text-white mb-4">Order Summary</h3>

              <div className="space-y-3 mb-6">
                <div className="flex justify-between items-start">
                  <div>
                    <p className="font-medium text-white">DTTracker {selectedPlan?.name || 'Pro'}</p>
                    <p className="text-xs text-slate-500">Monthly subscription</p>
                  </div>
                  <p className="font-semibold text-white">
                    {selectedPlan ? formatPrice(selectedPlan.price_amount) : '$49'}
                  </p>
                </div>

                <div className="pt-3 border-t border-white/[0.06]">
                  <div className="flex justify-between items-center">
                    <p className="text-sm text-slate-400">Subtotal</p>
                    <p className="text-slate-300">
                      {selectedPlan ? formatPrice(selectedPlan.price_amount) : '$49'}
                    </p>
                  </div>
                  <div className="flex justify-between items-center mt-2">
                    <p className="text-sm text-slate-400">Tax</p>
                    <p className="text-slate-300">Calculated at checkout</p>
                  </div>
                </div>

                <div className="pt-3 border-t border-white/[0.06]">
                  <div className="flex justify-between items-center">
                    <p className="font-semibold text-white">Total</p>
                    <p className="text-xl font-semibold text-white">
                      {selectedPlan ? formatPrice(selectedPlan.price_amount) : '$49'}
                    </p>
                  </div>
                  <p className="text-xs text-slate-500 mt-1">Billed monthly • Cancel anytime</p>
                </div>
              </div>

              <div className="space-y-2 pt-4 border-t border-white/[0.06]">
                <div className="flex items-center gap-2 text-xs text-slate-400">
                  <Shield className="w-4 h-4 text-emerald-400" />
                  <span>14-day free trial included</span>
                </div>
                <div className="flex items-center gap-2 text-xs text-slate-400">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                  <span>Cancel anytime</span>
                </div>
                <div className="flex items-center gap-2 text-xs text-slate-400">
                  <Lock className="w-4 h-4 text-emerald-400" />
                  <span>Secure payment processing</span>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Payment Section */}
        <div className="lg:col-span-2 space-y-4">
          <Card className="bg-[#0D0D0D] border-white/[0.08]">
            <CardContent className="p-6">
              <div className="flex items-center gap-3 mb-6">
                <div className="w-12 h-12 rounded-lg bg-[#00C3F7]/10 flex items-center justify-center">
                  <svg className="w-8 h-8" viewBox="0 0 120 120" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <rect width="120" height="120" rx="20" fill="#00C3F7"/>
                    <path d="M30 60L50 40V80L30 60Z" fill="white"/>
                    <path d="M50 40L70 20V100L50 80V40Z" fill="white"/>
                    <path d="M70 20L90 40V60L70 80V20Z" fill="white"/>
                  </svg>
                </div>
                <div>
                  <h3 className="font-semibold text-white">Pay with Paystack</h3>
                  <p className="text-sm text-slate-400">Credit card, debit card, bank transfer & more</p>
                </div>
              </div>

              <div className="bg-white/[0.03] rounded-lg p-4 mb-6 border border-white/[0.06]">
                <p className="text-sm text-slate-300 mb-2">
                  You'll be redirected to Paystack's secure checkout to complete your payment.
                </p>
                <p className="text-xs text-slate-500">
                  Paystack accepts cards from all countries and converts to your local currency at checkout.
                </p>
              </div>

              {/* Plan features preview */}
              {selectedPlan && (
                <div className="mb-6">
                  <h4 className="text-sm font-medium text-white mb-3">What's included in {selectedPlan.name}:</h4>
                  <div className="grid grid-cols-2 gap-2">
                    {selectedPlan.slug === 'pro' && (
                      <>
                        <div className="flex items-center gap-2 text-sm text-slate-400">
                          <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                          <span>Unlimited campaigns</span>
                        </div>
                        <div className="flex items-center gap-2 text-sm text-slate-400">
                          <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                          <span>Unlimited creators</span>
                        </div>
                        <div className="flex items-center gap-2 text-sm text-slate-400">
                          <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                          <span>Advanced analytics</span>
                        </div>
                        <div className="flex items-center gap-2 text-sm text-slate-400">
                          <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                          <span>API access</span>
                        </div>
                        <div className="flex items-center gap-2 text-sm text-slate-400">
                          <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                          <span>Team collaboration</span>
                        </div>
                        <div className="flex items-center gap-2 text-sm text-slate-400">
                          <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                          <span>Priority support</span>
                        </div>
                      </>
                    )}
                  </div>
                </div>
              )}

              {createCheckout.error && (
                <div className="flex items-start gap-3 p-4 mb-6 bg-red-500/10 rounded-lg border border-red-500/20">
                  <AlertCircle className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="text-sm font-medium text-red-400 mb-1">Payment Error</p>
                    <p className="text-xs text-red-400/80">
                      {createCheckout.error.message || 'Failed to initialize checkout. Please try again.'}
                    </p>
                  </div>
                </div>
              )}

              <Button
                onClick={handlePayWithPaystack}
                disabled={createCheckout.isPending || !selectedPlan}
                className="w-full h-12 bg-[#00C3F7] hover:bg-[#00C3F7]/90 text-white font-medium"
              >
                {createCheckout.isPending ? (
                  <span className="flex items-center gap-2">
                    <Loader2 className="w-5 h-5 animate-spin" />
                    Redirecting to Paystack...
                  </span>
                ) : (
                  `Continue to Payment • ${selectedPlan ? formatPrice(selectedPlan.price_amount) : '$49'}/month`
                )}
              </Button>

              <p className="text-xs text-center text-slate-500 mt-4">
                By continuing, you agree to our Terms of Service and Privacy Policy.
                Your subscription will automatically renew each month until canceled.
              </p>
            </CardContent>
          </Card>

          {/* Security Notice */}
          <div className="flex items-start gap-3 p-4 bg-white/[0.03] rounded-lg border border-white/[0.06]">
            <Lock className="w-5 h-5 text-emerald-400 flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-medium text-white mb-1">Secure Payment</p>
              <p className="text-xs text-slate-400">
                Your payment information is processed securely by Paystack. We never see or store your card details.
                Paystack is PCI-DSS Level 1 certified, the highest level of security.
              </p>
            </div>
          </div>

          {/* Accepted Payment Methods */}
          <div className="flex items-center justify-center gap-4 pt-4">
            <span className="text-xs text-slate-500">Accepted payment methods:</span>
            <div className="flex items-center gap-3">
              <div className="px-2 py-1 bg-white/[0.05] rounded text-xs text-slate-400">Visa</div>
              <div className="px-2 py-1 bg-white/[0.05] rounded text-xs text-slate-400">Mastercard</div>
              <div className="px-2 py-1 bg-white/[0.05] rounded text-xs text-slate-400">Bank Transfer</div>
              <div className="px-2 py-1 bg-white/[0.05] rounded text-xs text-slate-400">USSD</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
