import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { useCheckOnboarding } from '../../hooks/useOnboarding';
import { useBillingSummary } from '../../hooks/useBilling';
import { supabase } from '../../lib/supabase';
import { Button } from './ui/button';

interface ProtectedRouteProps {
  children: React.ReactNode;
}

export function ProtectedRoute({ children }: ProtectedRouteProps) {
  const { user, loading } = useAuth();
  const { needsOnboarding, isLoading: onboardingLoading } = useCheckOnboarding();
  const { data: billing, isLoading: billingLoading } = useBillingSummary();
  const location = useLocation();
  const [banStatus, setBanStatus] = React.useState<{ banned: boolean; bannedUntil: string | null }>({
    banned: false,
    bannedUntil: null,
  });
  const [banLoading, setBanLoading] = React.useState(true);
  const [passwordResetRequired, setPasswordResetRequired] = React.useState(false);
  const [profileLoading, setProfileLoading] = React.useState(true);

  React.useEffect(() => {
    let mounted = true;
    const loadBan = async () => {
      if (!user) {
        if (!mounted) return;
        setBanLoading(false);
        return;
      }
      const { data, error } = await supabase.rpc('get_user_ban_status');
      if (!mounted) return;
      if (error) {
        setBanStatus({ banned: false, bannedUntil: null });
        setBanLoading(false);
        return;
      }
      const row = Array.isArray(data) ? data[0] : data;
      setBanStatus({
        banned: Boolean(row?.is_banned),
        bannedUntil: row?.banned_until ?? null,
      });
      setBanLoading(false);
    };
    loadBan();
    return () => {
      mounted = false;
    };
  }, [user?.id]);

  React.useEffect(() => {
    let mounted = true;
    const loadProfileFlag = async () => {
      if (!user) {
        if (!mounted) return;
        setProfileLoading(false);
        return;
      }
      const { data, error } = await supabase
        .from('profiles')
        .select('require_password_change')
        .eq('id', user.id)
        .maybeSingle();
      if (!mounted) return;
      if (error) {
        setPasswordResetRequired(false);
        setProfileLoading(false);
        return;
      }
      setPasswordResetRequired(Boolean(data?.require_password_change));
      setProfileLoading(false);
    };
    loadProfileFlag();
    return () => {
      mounted = false;
    };
  }, [user?.id]);

  if (loading || onboardingLoading || banLoading || profileLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-white mx-auto mb-4"></div>
          <p className="text-slate-400">Loading...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  // Redirect to onboarding if not completed
  if (needsOnboarding) {
    return <Navigate to="/onboarding" replace />;
  }

  if (banStatus.banned) {
    return (
      <div className="min-h-screen bg-[#0A0A0A] flex items-center justify-center p-6">
        <div className="max-w-lg rounded-xl border border-red-500/30 bg-red-500/5 p-8 text-center">
          <h2 className="text-2xl font-semibold text-white">Account Banned</h2>
          <p className="mt-2 text-sm text-slate-400">
            Your account has been suspended. Please contact support for assistance.
          </p>
          {banStatus.bannedUntil && (
            <p className="mt-3 text-xs text-red-300">
              Ban ends on {new Date(banStatus.bannedUntil).toLocaleString()}
            </p>
          )}
          <div className="mt-6 flex items-center justify-center gap-3">
            <Button variant="outline" onClick={() => supabase.auth.signOut()}>
              Sign out
            </Button>
          </div>
        </div>
      </div>
    );
  }

  const allowPaths = ['/subscription', '/payment', '/billing/success', '/billing/cancel', '/settings', '/reset-password'];
  const isAllowed = allowPaths.includes(location.pathname);

  if (passwordResetRequired && location.pathname !== '/reset-password') {
    return (
      <div className="min-h-screen bg-[#0A0A0A] flex items-center justify-center p-6">
        <div className="max-w-lg rounded-xl border border-purple-500/30 bg-purple-500/5 p-8 text-center">
          <h2 className="text-2xl font-semibold text-white">Password Reset Required</h2>
          <p className="mt-2 text-sm text-slate-400">
            Your account requires a password update before you can continue.
          </p>
          <div className="mt-6 flex items-center justify-center gap-3">
            <Button onClick={() => (window.location.href = '/reset-password')}>
              Reset Password
            </Button>
            <Button variant="outline" onClick={() => supabase.auth.signOut()}>
              Sign out
            </Button>
          </div>
        </div>
      </div>
    );
  }
  const subscriptionStatus = billing?.subscription?.status || 'active';
  const trialExpired =
    subscriptionStatus === 'trialing' && (billing?.days_until_period_end ?? 0) <= 0;
  const freeBlocked = billing?.plan?.tier === 'free' && !billing?.is_paid && !billing?.is_trialing;
  const subscriptionBlocked =
    ['past_due', 'canceled', 'incomplete'].includes(subscriptionStatus) ||
    trialExpired ||
    freeBlocked;

  if (!billingLoading && subscriptionBlocked && !isAllowed) {
    let title = 'Subscription Required';
    let message = 'Your trial or subscription has ended. Please upgrade to regain access.';
    if (trialExpired) {
      title = 'Trial Ended';
      message = 'Your free trial has expired. Upgrade to continue using DTTracker.';
    } else if (subscriptionStatus === 'past_due') {
      title = 'Payment Required';
      message = 'Your subscription is past due. Update billing to regain access.';
    } else if (subscriptionStatus === 'canceled' || subscriptionStatus === 'incomplete') {
      title = 'Subscription Inactive';
      message = 'Your subscription is inactive. Choose a plan to continue.';
    } else if (freeBlocked) {
      title = 'Plan Upgrade Needed';
      message = 'Your free access has ended. Please upgrade to continue.';
    }
    return (
      <div className="min-h-screen bg-[#0A0A0A] flex items-center justify-center p-6">
        <div className="max-w-lg rounded-xl border border-white/[0.08] bg-[#0D0D0D] p-8 text-center">
          <h2 className="text-2xl font-semibold text-white">{title}</h2>
          <p className="mt-2 text-sm text-slate-400">{message}</p>
          <div className="mt-6 flex items-center justify-center gap-3">
            <Button onClick={() => (window.location.href = '/subscription')}>
              Manage Subscription
            </Button>
            <Button variant="outline" onClick={() => supabase.auth.signOut()}>
              Sign out
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
