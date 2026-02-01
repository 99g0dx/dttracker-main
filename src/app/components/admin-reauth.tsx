import React from 'react';
import { supabase } from '../../lib/supabase';

type AdminReauthProps = {
  open: boolean;
  onClose: () => void;
  onVerified: () => void;
};

const REAUTH_WINDOW_MS = 10 * 60 * 1000;

export function hasRecentAdminReauth() {
  const raw = typeof window !== 'undefined' ? localStorage.getItem('company_admin_reauth_at') : null;
  const lastAt = raw ? Number(raw) : 0;
  return Boolean(lastAt && Date.now() - lastAt < REAUTH_WINDOW_MS);
}

export async function ensureAdminReauth(
  openModal: (action: () => Promise<void>) => void,
  action: () => Promise<void>
) {
  if (hasRecentAdminReauth()) {
    await action();
    return;
  }
  openModal(action);
}

export function AdminReauth({ open, onClose, onVerified }: AdminReauthProps) {
  const [email, setEmail] = React.useState('');
  const [password, setPassword] = React.useState('');
  const [working, setWorking] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (!open) return;
    const loadEmail = async () => {
      const { data } = await supabase.auth.getSession();
      const sessionEmail = data.session?.user.email || '';
      setEmail(sessionEmail);
    };
    loadEmail();
  }, [open]);

  const handleVerify = async () => {
    if (!email || !password) {
      setError('Enter your password to continue.');
      return;
    }
    setWorking(true);
    setError(null);
    const { error: signInError } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    setWorking(false);
    if (signInError) {
      setError(signInError.message || 'Re-auth failed.');
      return;
    }
    if (typeof window !== 'undefined') {
      localStorage.setItem('company_admin_reauth_at', String(Date.now()));
    }
    setPassword('');
    onVerified();
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[300] bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="w-full max-w-md rounded-xl border border-white/[0.08] bg-[#0D0D0D] p-6">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-white">Re-authenticate</h2>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-lg hover:bg-white/[0.06] flex items-center justify-center text-slate-400"
          >
            ✕
          </button>
        </div>
        <p className="mt-2 text-sm text-slate-400">
          Confirm your password to continue. This session lasts 10 minutes.
        </p>
        <div className="mt-4 space-y-3">
          <input
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            placeholder="Admin email"
            className="h-10 w-full rounded-md bg-white/[0.03] border border-white/[0.08] text-sm text-white px-3"
          />
          <input
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            placeholder="Password"
            className="h-10 w-full rounded-md bg-white/[0.03] border border-white/[0.08] text-sm text-white px-3"
          />
          {error && <p className="text-xs text-red-400">{error}</p>}
          <button
            onClick={handleVerify}
            disabled={working}
            className="w-full h-10 rounded-md bg-white text-black hover:bg-white/90 text-sm font-medium disabled:opacity-60"
          >
            {working ? 'Verifying...' : 'Continue'}
          </button>
        </div>
      </div>
    </div>
  );
}
