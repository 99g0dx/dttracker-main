import React, { useState, useEffect } from 'react';
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
  const [verificationCode, setVerificationCode] = useState(['', '', '', '', '', '']);
  const [isVerifying, setIsVerifying] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [resendCooldown, setResendCooldown] = useState(0);
  const [userEmail, setUserEmail] = useState<string>('');
  const { needsOnboarding } = useCheckOnboarding();

  // Get user email on mount
  useEffect(() => {
    const getUserEmail = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (user?.email) {
        setUserEmail(user.email);
      }
    };
    getUserEmail();
  }, []);

  useEffect(() => {
    if (resendCooldown > 0) {
      const timer = setTimeout(() => setResendCooldown(resendCooldown - 1), 1000);
      return () => clearTimeout(timer);
    }
  }, [resendCooldown]);

  // Auto-submit when all digits are entered
  useEffect(() => {
    const code = verificationCode.join('');
    if (code.length === 6 && !isVerifying) {
      handleVerify();
    }
  }, [verificationCode]);

  const handleCodeChange = (index: number, value: string) => {
    if (value.length > 1) return;

    const newCode = [...verificationCode];
    newCode[index] = value;
    setVerificationCode(newCode);
    setError(null);

    if (value && index < 5) {
      const nextInput = document.getElementById(`code-${index + 1}`);
      nextInput?.focus();
    }
  };

  const handleKeyDown = (index: number, e: React.KeyboardEvent) => {
    if (e.key === 'Backspace' && !verificationCode[index] && index > 0) {
      const prevInput = document.getElementById(`code-${index - 1}`);
      prevInput?.focus();
    }
  };

  const handlePaste = (e: React.ClipboardEvent) => {
    e.preventDefault();
    const pastedData = e.clipboardData.getData('text').trim();

    // Check if pasted data is 6 digits
    if (/^\d{6}$/.test(pastedData)) {
      const newCode = pastedData.split('');
      setVerificationCode(newCode);
      setError(null);
      // Focus the last input
      const lastInput = document.getElementById('code-5');
      lastInput?.focus();
    }
  };

  const handleVerify = async () => {
    const code = verificationCode.join('');
    if (code.length !== 6) return;

    setIsVerifying(true);
    setError(null);

    try {
      // Get token from URL params if available (email confirmation link)
      const token = searchParams.get('token');
      const type = searchParams.get('type');

      if (token && type === 'email') {
        // Verify email with token from URL
        const { error: verifyError } = await supabase.auth.verifyOtp({
          token_hash: token,
          type: 'email',
        });

        if (verifyError) {
          setError(verifyError.message);
          toast.error(verifyError.message);
          setIsVerifying(false);
          return;
        }

        toast.success('Email verified successfully');
        // Wait a moment for profile to sync, then check onboarding
        setTimeout(() => {
          navigate(needsOnboarding ? '/onboarding' : '/');
        }, 500);
      } else {
        // Manual code verification (if using OTP)
        const { error: verifyError } = await supabase.auth.verifyOtp({
          email: userEmail,
          token: code,
          type: 'email',
        });

        if (verifyError) {
          setError(verifyError.message);
          toast.error(verifyError.message);
          setIsVerifying(false);
          return;
        }

        toast.success('Email verified successfully');
        // Wait a moment for profile to sync, then check onboarding
        setTimeout(() => {
          navigate(needsOnboarding ? '/onboarding' : '/');
        }, 500);
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Verification failed';
      setError(errorMessage);
      toast.error(errorMessage);
      setIsVerifying(false);
    }
  };

  const handleResend = async () => {
    if (!userEmail) {
      toast.error('Email address not found');
      return;
    }

    try {
      const { error: resendError } = await supabase.auth.resend({
        type: 'signup',
        email: userEmail,
      });

      if (resendError) {
        toast.error(resendError.message);
        return;
      }

      toast.success('Verification email sent');
      setResendCooldown(60);
    } catch (err) {
      toast.error('Failed to resend verification email');
    }
  };

  const isCodeComplete = verificationCode.every(digit => digit !== '');

  return (
    <div className="min-h-screen bg-[#0A0A0A] flex items-center justify-center p-6">
      <div className="w-full max-w-sm">
        <button
          onClick={() => onNavigate('/signup')}
          className="flex items-center gap-2 text-slate-500 hover:text-slate-400 mb-12 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          <span className="text-sm">Back</span>
        </button>

        <div className="mb-8">
          <div className="flex items-center gap-2 mb-8">
            <img src={logoImage} alt="DTTracker" className="w-7 h-7 object-contain" />
            <span className="font-semibold text-white">DTTracker</span>
          </div>
          <h1 className="text-2xl font-semibold text-white mb-2">Check your email</h1>
          <p className="text-sm text-slate-500">
            We sent a verification code to{' '}
            {userEmail ? (
              <span className="text-slate-400 font-medium">{userEmail}</span>
            ) : (
              'your email address'
            )}
          </p>
        </div>

        <div className="space-y-6">
          <div>
            <label className="block text-sm text-slate-400 mb-3">
              Verification code
            </label>
            <div className="flex gap-2" onPaste={handlePaste}>
              {verificationCode.map((digit, index) => (
                <input
                  key={index}
                  id={`code-${index}`}
                  type="text"
                  inputMode="numeric"
                  pattern="\d*"
                  maxLength={1}
                  value={digit}
                  onChange={(e) => handleCodeChange(index, e.target.value.replace(/\D/g, ''))}
                  onKeyDown={(e) => handleKeyDown(index, e)}
                  className="w-full h-12 text-center text-lg bg-white/[0.03] border border-white/[0.08] rounded-md text-white focus:bg-white/[0.05] focus:border-white/[0.15] focus:outline-none transition-colors"
                />
              ))}
            </div>
            <p className="text-xs text-slate-600 mt-2">Paste your 6-digit code or enter manually</p>
          </div>

          {error && (
            <div className="p-3 rounded-md bg-red-500/10 border border-red-500/20 text-red-400 text-sm">
              {error}
            </div>
          )}

          <Button
            onClick={handleVerify}
            disabled={!isCodeComplete || isVerifying}
            className="w-full h-10 bg-white text-black hover:bg-white/90 font-medium disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isVerifying ? 'Verifying...' : 'Verify email'}
          </Button>

          <div className="text-center">
            <button
              onClick={handleResend}
              disabled={resendCooldown > 0}
              className="text-sm text-slate-500 hover:text-slate-400 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {resendCooldown > 0 ? `Resend code in ${resendCooldown}s` : 'Resend code'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}