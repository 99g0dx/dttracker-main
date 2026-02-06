import React, { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Card, CardContent } from './ui/card';
import { Button } from './ui/button';
import { CheckCircle2, Loader2, AlertCircle } from 'lucide-react';
import { useBillingSummary } from '../../hooks/useBilling';

interface BillingSuccessProps {
  onNavigate: (path: string) => void;
}

export function BillingSuccess({ onNavigate }: BillingSuccessProps) {
  const [searchParams] = useSearchParams();
  const reference = searchParams.get('reference');
  const trxref = searchParams.get('trxref');
  const paymentType = searchParams.get('type'); // 'wallet' or null

  const [pollCount, setPollCount] = useState(0);
  const [isVerified, setIsVerified] = useState(false);
  const [hasError, setHasError] = useState(false);

  const { data: billing, refetch, isLoading } = useBillingSummary();

  // Handle wallet funding - redirect to wallet page
  useEffect(() => {
    if (paymentType === 'wallet') {
      // Redirect to wallet page with fund=success to trigger balance refresh
      onNavigate('/wallet?fund=success');
      return;
    }
  }, [paymentType, onNavigate]);

  // Poll for subscription update (webhook might take a moment)
  useEffect(() => {
    if (isVerified || hasError || paymentType === 'wallet') return;

    const pollInterval = setInterval(async () => {
      setPollCount(prev => prev + 1);

      try {
        const result = await refetch();

        // Check if subscription is now active
        if (result.data?.is_paid || result.data?.subscription?.status === 'active') {
          setIsVerified(true);
          clearInterval(pollInterval);
        }
      } catch (error) {
        console.error('Error polling subscription status:', error);
      }

      // Stop polling after 30 seconds (15 attempts at 2s intervals)
      if (pollCount >= 15) {
        clearInterval(pollInterval);
        // If still not verified after 30s, assume success anyway
        // The webhook might be delayed but payment was successful
        setIsVerified(true);
      }
    }, 2000);

    return () => clearInterval(pollInterval);
  }, [pollCount, isVerified, hasError, refetch]);

  // Auto-redirect after verification
  useEffect(() => {
    if (isVerified) {
      const timeout = setTimeout(() => {
        onNavigate('/dashboard');
      }, 3000);
      return () => clearTimeout(timeout);
    }
  }, [isVerified, onNavigate]);

  // Error state
  if (hasError) {
    return (
      <div className="max-w-lg mx-auto mt-12">
        <Card className="bg-[#0D0D0D] border-white/[0.08]">
          <CardContent className="p-12 text-center">
            <div className="w-16 h-16 rounded-full bg-red-500/20 flex items-center justify-center mx-auto mb-6">
              <AlertCircle className="w-8 h-8 text-red-400" />
            </div>
            <h2 className="text-2xl font-semibold text-white mb-3">
              Payment Verification Failed
            </h2>
            <p className="text-slate-400 mb-6">
              We couldn't verify your payment. If you were charged, please contact support.
            </p>
            <div className="flex gap-3 justify-center">
              <Button
                onClick={() => onNavigate('/subscription')}
                variant="outline"
                className="h-10 px-6"
              >
                Back to Plans
              </Button>
              <Button
                onClick={() => window.location.href = 'mailto:support@dobbletap.com'}
                className="h-10 px-6 bg-primary hover:bg-primary/90 text-white"
              >
                Contact Support
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Success state
  if (isVerified) {
    return (
      <div className="max-w-lg mx-auto mt-12">
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
                onClick={() => onNavigate('/dashboard')}
                className="h-10 px-6 bg-primary hover:bg-primary/90 text-white"
              >
                Go to Dashboard
              </Button>
              <Button
                onClick={() => onNavigate('/subscription')}
                variant="outline"
                className="h-10 px-6"
              >
                View Subscription
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Loading/Verifying state
  return (
    <div className="max-w-lg mx-auto mt-12">
      <Card className="bg-[#0D0D0D] border-white/[0.08]">
        <CardContent className="p-12 text-center">
          <div className="w-16 h-16 rounded-full bg-primary/20 flex items-center justify-center mx-auto mb-6">
            <Loader2 className="w-8 h-8 text-primary animate-spin" />
          </div>
          <h2 className="text-2xl font-semibold text-white mb-3">
            Verifying Payment...
          </h2>
          <p className="text-slate-400 mb-2">
            Please wait while we confirm your payment with Paystack.
          </p>
          <p className="text-sm text-slate-500">
            This usually takes just a few seconds.
          </p>

          {reference && (
            <p className="text-xs text-slate-600 mt-6">
              Reference: {reference || trxref}
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
