import React, { useState } from 'react';
import { Card, CardContent } from './ui/card';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { ArrowLeft, CreditCard, CheckCircle2, Shield, Lock } from 'lucide-react';

interface PaymentProps {
  onNavigate: (path: string) => void;
}

type PaymentMethod = 'stripe' | 'paystack' | null;

export function Payment({ onNavigate }: PaymentProps) {
  const [selectedMethod, setSelectedMethod] = useState<PaymentMethod>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [paymentSuccess, setPaymentSuccess] = useState(false);

  const handlePayment = async (method: PaymentMethod) => {
    setIsProcessing(true);
    
    // Simulate payment processing
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    // In a real implementation:
    // if (method === 'stripe') {
    //   // Initialize Stripe payment
    //   const stripe = await loadStripe('YOUR_STRIPE_PUBLIC_KEY');
    //   // Create payment intent and redirect to Stripe checkout
    // } else if (method === 'paystack') {
    //   // Initialize Paystack payment
    //   const paystack = new PaystackPop();
    //   paystack.newTransaction({...});
    // }
    
    setIsProcessing(false);
    setPaymentSuccess(true);
    
    // Redirect after success
    setTimeout(() => {
      onNavigate('/');
    }, 3000);
  };

  // Success State
  if (paymentSuccess) {
    return (
      <div className="max-w-2xl mx-auto">
        <Card className="bg-[#0D0D0D] border-white/[0.08]">
          <CardContent className="p-12 text-center">
            <div className="w-16 h-16 rounded-full bg-emerald-500/20 flex items-center justify-center mx-auto mb-6">
              <CheckCircle2 className="w-8 h-8 text-emerald-400" />
            </div>
            <h2 className="text-2xl font-semibold text-white mb-3">
              Payment Successful!
            </h2>
            <p className="text-slate-400 mb-2">
              Welcome to DTTracker Pro! Your subscription is now active.
            </p>
            <p className="text-sm text-slate-500 mb-8">
              Redirecting to dashboard...
            </p>
            <div className="flex gap-3 justify-center">
              <Button 
                onClick={() => onNavigate('/')}
                className="h-10 px-6 bg-primary hover:bg-primary/90 text-white"
              >
                Go to Dashboard
              </Button>
            </div>
          </CardContent>
        </Card>
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
          <p className="text-sm text-slate-400 mt-1">Choose your preferred payment method</p>
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
                    <p className="font-medium text-white">DTTracker Pro</p>
                    <p className="text-xs text-slate-500">Monthly subscription</p>
                  </div>
                  <p className="font-semibold text-white">$49.00</p>
                </div>
                
                <div className="pt-3 border-t border-white/[0.06]">
                  <div className="flex justify-between items-center">
                    <p className="text-sm text-slate-400">Subtotal</p>
                    <p className="text-slate-300">$49.00</p>
                  </div>
                  <div className="flex justify-between items-center mt-2">
                    <p className="text-sm text-slate-400">Tax</p>
                    <p className="text-slate-300">$0.00</p>
                  </div>
                </div>

                <div className="pt-3 border-t border-white/[0.06]">
                  <div className="flex justify-between items-center">
                    <p className="font-semibold text-white">Total</p>
                    <p className="text-xl font-semibold text-white">$49.00</p>
                  </div>
                  <p className="text-xs text-slate-500 mt-1">Billed monthly</p>
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

        {/* Payment Methods */}
        <div className="lg:col-span-2 space-y-4">
          {/* Payment Method Selection */}
          {!selectedMethod && (
            <>
              <h3 className="font-semibold text-white mb-4">Select Payment Method</h3>
              
              {/* Stripe Option */}
              <Card 
                className="bg-[#0D0D0D] border-white/[0.08] hover:border-primary/50 transition-all cursor-pointer group"
                onClick={() => setSelectedMethod('stripe')}
              >
                <CardContent className="p-6">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 rounded-lg bg-[#635BFF]/10 flex items-center justify-center">
                        <svg className="w-8 h-8" viewBox="0 0 60 25" fill="none" xmlns="http://www.w3.org/2000/svg">
                          <path d="M59.64 14.28h-8.06c.19 1.93 1.6 2.55 3.2 2.55 1.64 0 2.96-.37 4.05-.95v3.32a8.33 8.33 0 0 1-4.56 1.1c-4.01 0-6.83-2.5-6.83-7.48 0-4.19 2.39-7.52 6.3-7.52 3.92 0 5.96 3.28 5.96 7.5 0 .4-.04 1.26-.06 1.48zm-5.92-5.62c-1.03 0-2.17.73-2.17 2.58h4.25c0-1.85-1.07-2.58-2.08-2.58zM40.95 20.3c-1.44 0-2.32-.6-2.9-1.04l-.02 4.63-4.12.87V5.57h3.76l.08 1.02a4.7 4.7 0 0 1 3.23-1.29c2.9 0 5.62 2.6 5.62 7.4 0 5.23-2.7 7.6-5.65 7.6zM40 8.95c-.95 0-1.54.34-1.97.81l.02 6.12c.4.44.98.78 1.95.78 1.52 0 2.54-1.65 2.54-3.87 0-2.15-1.04-3.84-2.54-3.84zM28.24 5.57h4.13v14.44h-4.13V5.57zm0-4.7L32.37 0v3.36l-4.13.88V.88zm-4.32 9.35v9.79H19.8V5.57h3.7l.12 1.22c1-1.77 3.07-1.41 3.62-1.22v3.79c-.52-.17-2.29-.43-3.32.86zm-8.55 4.72c0 2.43 2.6 1.68 3.12 1.46v3.36c-.55.3-1.54.54-2.89.54a4.15 4.15 0 0 1-4.27-4.24l.01-13.17 4.02-.86v3.54h3.14V9.1h-3.13v5.85zm-4.91.7c0 2.97-2.31 4.66-5.73 4.66a11.2 11.2 0 0 1-4.46-.93v-3.93c1.38.75 3.1 1.31 4.46 1.31.92 0 1.53-.24 1.53-1C6.26 13.77 0 14.51 0 9.95 0 7.04 2.28 5.3 5.62 5.3c1.36 0 2.72.2 4.09.75v3.88a9.23 9.23 0 0 0-4.1-1.06c-.86 0-1.44.25-1.44.93 0 1.85 6.29.97 6.29 5.88z" fill="#635BFF"/>
                        </svg>
                      </div>
                      <div>
                        <h4 className="font-semibold text-white group-hover:text-primary transition-colors">Pay with Stripe</h4>
                        <p className="text-sm text-slate-400">Credit card, debit card, or digital wallet</p>
                      </div>
                    </div>
                    <div className="w-6 h-6 rounded-full border-2 border-white/[0.12] group-hover:border-primary transition-colors" />
                  </div>
                </CardContent>
              </Card>

              {/* Paystack Option */}
              <Card 
                className="bg-[#0D0D0D] border-white/[0.08] hover:border-primary/50 transition-all cursor-pointer group"
                onClick={() => setSelectedMethod('paystack')}
              >
                <CardContent className="p-6">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 rounded-lg bg-[#00C3F7]/10 flex items-center justify-center">
                        <svg className="w-8 h-8" viewBox="0 0 120 120" fill="none" xmlns="http://www.w3.org/2000/svg">
                          <rect width="120" height="120" rx="20" fill="#00C3F7"/>
                          <path d="M30 60L50 40V80L30 60Z" fill="white"/>
                          <path d="M50 40L70 20V100L50 80V40Z" fill="white"/>
                          <path d="M70 20L90 40V60L70 80V20Z" fill="white"/>
                        </svg>
                      </div>
                      <div>
                        <h4 className="font-semibold text-white group-hover:text-primary transition-colors">Pay with Paystack</h4>
                        <p className="text-sm text-slate-400">Popular in Nigeria and Africa</p>
                      </div>
                    </div>
                    <div className="w-6 h-6 rounded-full border-2 border-white/[0.12] group-hover:border-primary transition-colors" />
                  </div>
                </CardContent>
              </Card>
            </>
          )}

          {/* Stripe Payment Form */}
          {selectedMethod === 'stripe' && (
            <Card className="bg-[#0D0D0D] border-white/[0.08]">
              <CardContent className="p-6">
                <div className="flex items-center justify-between mb-6">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-[#635BFF]/10 flex items-center justify-center">
                      <CreditCard className="w-5 h-5 text-[#635BFF]" />
                    </div>
                    <h3 className="font-semibold text-white">Stripe Payment</h3>
                  </div>
                  <button
                    onClick={() => setSelectedMethod(null)}
                    className="text-sm text-slate-400 hover:text-white"
                  >
                    Change
                  </button>
                </div>

                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-white mb-2">Card Number</label>
                    <Input
                      placeholder="1234 5678 9012 3456"
                      className="h-11 bg-white/[0.03] border-white/[0.08] text-white"
                    />
                  </div>
                  
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-white mb-2">Expiry Date</label>
                      <Input
                        placeholder="MM / YY"
                        className="h-11 bg-white/[0.03] border-white/[0.08] text-white"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-white mb-2">CVC</label>
                      <Input
                        placeholder="123"
                        className="h-11 bg-white/[0.03] border-white/[0.08] text-white"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-white mb-2">Cardholder Name</label>
                    <Input
                      placeholder="John Doe"
                      className="h-11 bg-white/[0.03] border-white/[0.08] text-white"
                    />
                  </div>

                  <div className="pt-4">
                    <Button
                      onClick={() => handlePayment('stripe')}
                      disabled={isProcessing}
                      className="w-full h-12 bg-primary hover:bg-primary/90 text-white font-medium"
                    >
                      {isProcessing ? (
                        <span className="flex items-center gap-2">
                          <svg className="animate-spin h-5 w-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                          </svg>
                          Processing...
                        </span>
                      ) : (
                        `Pay $49.00`
                      )}
                    </Button>
                    <p className="text-xs text-center text-slate-500 mt-3">
                      Your payment is secured by Stripe. By confirming, you agree to our Terms of Service.
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Paystack Payment Form */}
          {selectedMethod === 'paystack' && (
            <Card className="bg-[#0D0D0D] border-white/[0.08]">
              <CardContent className="p-6">
                <div className="flex items-center justify-between mb-6">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-[#00C3F7]/10 flex items-center justify-center">
                      <CreditCard className="w-5 h-5 text-[#00C3F7]" />
                    </div>
                    <h3 className="font-semibold text-white">Paystack Payment</h3>
                  </div>
                  <button
                    onClick={() => setSelectedMethod(null)}
                    className="text-sm text-slate-400 hover:text-white"
                  >
                    Change
                  </button>
                </div>

                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-white mb-2">Email Address</label>
                    <Input
                      type="email"
                      placeholder="your@email.com"
                      className="h-11 bg-white/[0.03] border-white/[0.08] text-white"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-white mb-2">Card Number</label>
                    <Input
                      placeholder="1234 5678 9012 3456"
                      className="h-11 bg-white/[0.03] border-white/[0.08] text-white"
                    />
                  </div>
                  
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-white mb-2">Expiry Date</label>
                      <Input
                        placeholder="MM / YY"
                        className="h-11 bg-white/[0.03] border-white/[0.08] text-white"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-white mb-2">CVV</label>
                      <Input
                        placeholder="123"
                        className="h-11 bg-white/[0.03] border-white/[0.08] text-white"
                      />
                    </div>
                  </div>

                  <div className="pt-4">
                    <Button
                      onClick={() => handlePayment('paystack')}
                      disabled={isProcessing}
                      className="w-full h-12 bg-primary hover:bg-primary/90 text-white font-medium"
                    >
                      {isProcessing ? (
                        <span className="flex items-center gap-2">
                          <svg className="animate-spin h-5 w-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                          </svg>
                          Processing...
                        </span>
                      ) : (
                        `Pay $49.00`
                      )}
                    </Button>
                    <p className="text-xs text-center text-slate-500 mt-3">
                      Your payment is secured by Paystack. By confirming, you agree to our Terms of Service.
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Security Notice */}
          {selectedMethod && (
            <div className="flex items-start gap-3 p-4 bg-white/[0.03] rounded-lg border border-white/[0.06]">
              <Lock className="w-5 h-5 text-emerald-400 flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-medium text-white mb-1">Secure Payment</p>
                <p className="text-xs text-slate-400">
                  Your payment information is encrypted and secure. We never store your card details on our servers.
                </p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
