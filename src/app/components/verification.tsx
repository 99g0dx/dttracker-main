import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from './ui/button';
import { toast } from 'sonner';
import { supabase } from '../../lib/supabase';
import logoImage from '../../assets/fcad7446971be733d3427a6b22f8f64253529daf.png';
import { Loader, Mail, CheckCircle } from 'lucide-react';

interface VerificationProps {
  onNavigate: (path: string) => void;
}

export function Verification({ onNavigate }: VerificationProps) {
  const navigate = useNavigate();

  const [userEmail, setUserEmail] = useState<string | null>(() =>
    localStorage.getItem('pending_verification_email')
  );
  const [resendCooldown, setResendCooldown] = useState(0);
  const [isResending, setIsResending] = useState(false);
  const [linkClicked, setLinkClicked] = useState(false);

  // Cooldown timer
  useEffect(() => {
    if (resendCooldown > 0) {
      const timer = setTimeout(() => {
        setResendCooldown(resendCooldown - 1);
      }, 1000);
      return () => clearTimeout(timer);
    }
  }, [resendCooldown]);

  useEffect(() => {
    // Listen for auth state changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      console.log('Auth event:', event);

      if (event === 'SIGNED_IN' && session) {
        setLinkClicked(true);
        
        console.log('User authenticated:', session.user);
        toast.success('Email verified! Redirecting...');
        
        // Clean up localStorage
        localStorage.removeItem('pending_verification_email');
        const authMode = localStorage.getItem('auth_mode');
        localStorage.removeItem('auth_mode');

        // Small delay so user sees the success message
        setTimeout(async () => {
          // Check if user needs onboarding
          const { data: profile } = await supabase
            .from('user_profiles')
            .select('onboarding_completed')
            .eq('user_id', session.user.id)
            .single();

          const authMode = localStorage.getItem('auth_mode');
          if (authMode === 'signup' || !profile || !profile.onboarding_completed) {
            navigate('/onboarding');
          } else {
            navigate('/');
          }
        }, 1000);
      }
    });

    // Check if already authenticated
   


    return () => {
      subscription.unsubscribe();
    };
  }, [navigate]);

 useEffect(() => {
  supabase.auth.getSession().then(({ data }) => {
    if (data.session?.user?.email_confirmed_at) {
      navigate('/');
    }
  });
}, [navigate]);


const handleResend = async () => {
  if (!userEmail || resendCooldown > 0) return;

  setIsResending(true);

  const { error } = await supabase.auth.signInWithOtp({
    email: userEmail,
    options: {
      shouldCreateUser: false,
      emailRedirectTo: `${window.location.origin}/verification`,
    },
  });

  setIsResending(false);

  if (error) {
    toast.error(error.message);
    return;
  }

  toast.success('Verification email resent!');
  setResendCooldown(60);
};



  const authMode = localStorage.getItem('auth_mode');
  const isExistingUser = authMode === 'login';

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-6">
      <div className="w-full max-w-md">
        <div className="flex flex-col items-center gap-6 text-center">
          <img src={logoImage} alt="DTTracker" className="w-10 h-10 object-contain" />
          
          {linkClicked ? (
            // Success state - link was clicked
            <>
              <div className="w-16 h-16 rounded-full bg-green-500/10 flex items-center justify-center">
                <CheckCircle className="w-8 h-8 text-green-500" />
              </div>
              <div className="space-y-2">
                <h1 className="text-2xl font-semibold text-foreground">
                  Verified!
                </h1>
                <p className="text-sm text-muted-foreground">
                  Your email has been verified. Redirecting you now...
                </p>
              </div>
            </>
          ) : (
            // Waiting for verification
            <>
              <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center">
                <Mail className="w-8 h-8 text-primary" />
              </div>
              
              <div className="space-y-2">
                <h1 className="text-2xl font-semibold text-foreground">
                  Check your email
                </h1>
                <p className="text-sm text-muted-foreground">
                  We sent a verification link to
                </p>
                <p className="text-sm font-medium text-foreground">
                  {userEmail}
                </p>
              </div>

              <div className="w-full max-w-sm space-y-4">
                <div className="p-4 rounded-lg bg-muted/40 border border-border">
                  <p className="text-xs text-muted-foreground text-left">
                    Click the link in the email to verify your account. The page will automatically update once verified.
                  </p>
                </div>

                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <div className="flex-1 h-px bg-muted/70" />
                  <span>Didn't receive it?</span>
                  <div className="flex-1 h-px bg-muted/70" />
                </div>
              {userEmail && !linkClicked && (
                <Button 
                  onClick={handleResend} 
                  disabled={resendCooldown > 0 || isResending}
                  variant="outline"
                  className="w-full bg-muted/40 border-border text-foreground hover:bg-muted/60 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isResending 
                    ? 'Sending...' 
                    : resendCooldown > 0 
                    ? `Resend in ${resendCooldown}s` 
                    : 'Resend verification email'}
                </Button>
              )}
                {resendCooldown > 0 && (
                  <p className="text-xs text-muted-foreground">
                    Please wait {resendCooldown}s before requesting another email
                  </p>
                )}
              </div>

              <button
                onClick={() => navigate('/login')}
                className="text-sm text-muted-foreground hover:text-foreground transition-colors"
              >
                Back to login
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}