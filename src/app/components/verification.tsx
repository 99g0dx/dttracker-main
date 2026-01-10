import React, { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Button } from './ui/button';
import { ArrowLeft } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '../../lib/supabase';
import { useCheckOnboarding } from '../../hooks/useOnboarding';
import logoImage from '../../assets/fcad7446971be733d3427a6b22f8f64253529daf.png';

interface VerificationProps {
  onNavigate: (path: string) => void;
}

export function Verification({ onNavigate }: VerificationProps) {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { needsOnboarding } = useCheckOnboarding();

  const [isVerifying, setIsVerifying] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [userEmail, setUserEmail] = useState<string | null>(() =>
    localStorage.getItem('pending_verification_email')
  );


  // Example using Supabase JS client


 useEffect(() => {
  const verifyEmail = async () => {
    // 1. Get params from query string (?)
    let tokenHash = searchParams.get('token_hash') || searchParams.get('token');
    let type = searchParams.get('type');

    // 2. Fallback: Parse params from the URL hash (#) if query params are empty
    if (!tokenHash && window.location.hash) {
      const hashParams = new URLSearchParams(window.location.hash.substring(1));
      tokenHash = hashParams.get('token_hash') || hashParams.get('access_token');
      type = hashParams.get('type');
    }

    console.log('Verification Details (Combined):', { tokenHash, type });

    if (!tokenHash) {
      // If we still have nothing, don't throw an error immediately 
      // as the page might be loading or user just landed here without a link.
      setIsVerifying(false); 
      return;
    }

    const { error } = await supabase.auth.verifyOtp({
      token_hash: tokenHash,
      type: (type as any) || 'signup', 
    });

    if (error) {
      setError(error.message);
      setIsVerifying(false);
      return;
    }

    toast.success('Email verified successfully');
    localStorage.removeItem('pending_verification_email');
    navigate(needsOnboarding ? '/onboarding' : '/');
  };

  verifyEmail();
}, [searchParams, navigate, needsOnboarding]);
  const handleResend = async () => {
    if (!userEmail) {
      toast.error('Email address not found');
      return;
    }

    const { error } = await supabase.auth.resend({
    type: 'signup',
    email: userEmail!, // non-null
  });


  if (error?.message.includes('already verified')) {
  toast.success('Email is already verified! You can log in now.');
  navigate('/login');
  return;
}


  toast.success('Verification email sent');
};

  return (
    <div className="min-h-screen bg-[#0A0A0A] flex items-center justify-center p-6">
      <div className="w-full max-w-sm">
        <button
          onClick={() => onNavigate('/signup')}
          className="flex items-center gap-2 text-slate-500 hover:text-slate-400 mb-12"
        >
          <ArrowLeft className="w-4 h-4" />
          <span className="text-sm">Back</span>
        </button>

        <div className="mb-8">
          <div className="flex items-center gap-2 mb-8">
            <img src={logoImage} alt="DTTracker" className="w-7 h-7" />
            <span className="font-semibold text-white">DTTracker</span>
          </div>

          <h1 className="text-2xl font-semibold text-white mb-2">
            Verifying your email
          </h1>

          <p className="text-sm text-slate-500">
            {userEmail
              ? `Confirming ${userEmail}`
              : 'Please wait while we verify your email'}
          </p>
        </div>

        {isVerifying && (
          <div className="text-slate-400 text-sm">Verifying…</div>
        )}

        {error && (
          <div className="p-3 mt-4 rounded-md bg-red-500/10 border border-red-500/20 text-red-400 text-sm">
            {error}
          </div>
        )}

        {!isVerifying && error && (
          <Button
            onClick={handleResend}
            className="w-full h-10 bg-white text-black mt-6"
          >
            Resend verification email
          </Button>
        )}
      </div>
    </div>
  );
}
