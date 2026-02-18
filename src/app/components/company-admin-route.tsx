import React from 'react';
import { Navigate } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import { useCompanyAdmin } from '../../hooks/useCompanyAdmin';

type CompanyAdminRouteProps = {
  children: React.ReactNode;
};

export function CompanyAdminRoute({ children }: CompanyAdminRouteProps) {
  const { isCompanyAdmin, loading } = useCompanyAdmin();
  const [mfaReady, setMfaReady] = React.useState(false);
  const [mfaEnabled, setMfaEnabled] = React.useState(false);
  const [mfaError, setMfaError] = React.useState<string | null>(null);

  React.useEffect(() => {
    let mounted = true;
    const checkMfa = async () => {
      try {
        if (!supabase.auth.mfa?.listFactors) {
          if (!mounted) return;
          setMfaEnabled(true);
          setMfaReady(true);
          return;
        }
        const { data, error } = await supabase.auth.mfa.listFactors();
        if (!mounted) return;
        if (error) {
          setMfaError(error.message);
          setMfaEnabled(false);
          setMfaReady(true);
          return;
        }
        const hasVerified = (data?.totp || []).some((factor) => factor.status === 'verified');
        setMfaEnabled(hasVerified);
        setMfaReady(true);
      } catch (err: any) {
        if (!mounted) return;
        setMfaError(err?.message || 'Unable to verify MFA');
        setMfaEnabled(false);
        setMfaReady(true);
      }
    };
    checkMfa();
    return () => {
      mounted = false;
    };
  }, []);

  React.useEffect(() => {
    if (!isCompanyAdmin) return;
    const loadEmail = async () => {
      await supabase.auth.getSession();
    };
    loadEmail();
  }, [isCompanyAdmin]);

  if (loading) {
    return (
      <div className="flex h-full min-h-[50vh] items-center justify-center text-sm text-muted-foreground">
        Loading...
      </div>
    );
  }

  if (!isCompanyAdmin) {
    return <Navigate to="/dashboard" replace />;
  }

  if (!mfaReady) {
    return (
      <div className="flex h-full min-h-[50vh] items-center justify-center text-sm text-muted-foreground">
        Verifying admin security...
      </div>
    );
  }

  if (!mfaEnabled) {
    return (
      <div className="flex h-full min-h-[50vh] items-center justify-center px-6">
        <div className="max-w-md rounded-xl border border-border bg-card p-6 text-center">
          <h2 className="text-lg font-semibold text-foreground">MFA Required</h2>
          <p className="mt-2 text-sm text-muted-foreground">
            Admin access requires multi-factor authentication. Enable MFA on your account before continuing.
          </p>
          {mfaError && <p className="mt-2 text-xs text-red-400">{mfaError}</p>}
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
