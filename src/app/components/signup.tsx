import React, { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { ArrowLeft, Eye, EyeOff, Check, X } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '../../lib/supabase';
import logoImage from '../../assets/fcad7446971be733d3427a6b22f8f64253529daf.png';

interface SignupProps {
  onNavigate: (path: string) => void;
}

export function Signup({ onNavigate }: SignupProps) {
  const navigate = useNavigate();
  const [formData, setFormData] = useState({
    fullName: '',
    email: '',
    phone: '',
    password: '',
    confirmPassword: '',
  });
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Password strength calculation
  const passwordStrength = useMemo(() => {
    const password = formData.password;
    if (!password) return { strength: 'none', score: 0, label: '' };

    let score = 0;
    if (password.length >= 8) score++;
    if (password.length >= 12) score++;
    if (/[a-z]/.test(password) && /[A-Z]/.test(password)) score++;
    if (/\d/.test(password)) score++;
    if (/[^a-zA-Z\d]/.test(password)) score++;

    if (score <= 2) return { strength: 'weak', score, label: 'Weak', color: 'bg-red-500' };
    if (score <= 3) return { strength: 'medium', score, label: 'Medium', color: 'bg-yellow-500' };
    return { strength: 'strong', score, label: 'Strong', color: 'bg-green-500' };
  }, [formData.password]);

  // Password validation checks
  const passwordChecks = useMemo(() => ({
    length: formData.password.length >= 8,
    uppercase: /[A-Z]/.test(formData.password),
    lowercase: /[a-z]/.test(formData.password),
    number: /\d/.test(formData.password),
  }), [formData.password]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    // Validate password confirmation
    if (formData.password !== formData.confirmPassword) {
      setError('Passwords do not match');
      toast.error('Passwords do not match');
      return;
    }

    setIsLoading(true);

    try {
      // Sign up with Supabase
      const { data, error: signUpError } = await supabase.auth.signUp({
        email: formData.email,
        password: formData.password,
        options: {
          data: {
            full_name: formData.fullName,
            phone: formData.phone || undefined, // Optional phone
          },
        },
      });

      if (signUpError) {
        setError(signUpError.message);
        toast.error(signUpError.message);
        setIsLoading(false);
        return;
      }

      if (data.user) {
        // Check if email confirmation is required
        // If confirmation is enabled, user will receive email and should verify
        // If disabled, user is automatically signed in
        toast.success('Account created successfully');
        
        // If email confirmation is required, navigate to verification
        // Otherwise, navigate to onboarding (onboarding will check completion status)
        if (data.user.email_confirmed_at) {
          navigate('/onboarding');
        } else {
          navigate('/verification');
        }
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'An unexpected error occurred';
      setError(errorMessage);
      toast.error(errorMessage);
      setIsLoading(false);
    }
  };

  const updateFormData = (field: string, value: string) => {
    setFormData({ ...formData, [field]: value });
  };

  return (
    <div className="min-h-screen bg-[#0A0A0A] flex items-center justify-center p-6">
      <div className="w-full max-w-sm">
        <button
          onClick={() => onNavigate('/home')}
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
          <h1 className="text-2xl font-semibold text-white mb-2">Create account</h1>
          <p className="text-sm text-slate-500">Start your 14-day free trial</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm text-slate-400 mb-2">
              Full Name
            </label>
            <Input
              type="text"
              placeholder="Enter your full name"
              value={formData.fullName}
              onChange={(e) => updateFormData('fullName', e.target.value)}
              required
              className="h-10 bg-white/[0.03] border-white/[0.08] text-white placeholder:text-slate-600 focus:bg-white/[0.05] focus:border-white/[0.15]"
            />
          </div>

          <div>
            <label className="block text-sm text-slate-400 mb-2">
              Email
            </label>
            <Input
              type="email"
              placeholder="name@company.com"
              value={formData.email}
              onChange={(e) => updateFormData('email', e.target.value)}
              required
              className="h-10 bg-white/[0.03] border-white/[0.08] text-white placeholder:text-slate-600 focus:bg-white/[0.05] focus:border-white/[0.15]"
            />
          </div>

          <div>
            <label className="block text-sm text-slate-400 mb-2">
              Phone <span className="text-slate-600">(optional)</span>
            </label>
            <Input
              type="tel"
              placeholder="Enter your phone number"
              value={formData.phone}
              onChange={(e) => updateFormData('phone', e.target.value)}
              className="h-10 bg-white/[0.03] border-white/[0.08] text-white placeholder:text-slate-600 focus:bg-white/[0.05] focus:border-white/[0.15]"
            />
          </div>

          <div>
            <label className="block text-sm text-slate-400 mb-2">
              Password
            </label>
            <div className="relative">
              <Input
                type={showPassword ? 'text' : 'password'}
                placeholder="Create a password"
                value={formData.password}
                onChange={(e) => updateFormData('password', e.target.value)}
                required
                minLength={8}
                className="h-10 bg-white/[0.03] border-white/[0.08] text-white placeholder:text-slate-600 focus:bg-white/[0.05] focus:border-white/[0.15] pr-10"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-400 transition-colors"
              >
                {showPassword ? (
                  <EyeOff className="w-4 h-4" />
                ) : (
                  <Eye className="w-4 h-4" />
                )}
              </button>
            </div>

            {/* Password Strength Indicator */}
            {formData.password && (
              <div className="mt-3 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs text-slate-500">Password strength</span>
                  <span className={`text-xs font-medium ${
                    passwordStrength.strength === 'weak' ? 'text-red-400' :
                    passwordStrength.strength === 'medium' ? 'text-yellow-400' :
                    'text-green-400'
                  }`}>
                    {passwordStrength.label}
                  </span>
                </div>
                <div className="flex gap-1">
                  {[1, 2, 3, 4, 5].map((level) => (
                    <div
                      key={level}
                      className={`h-1 flex-1 rounded-full transition-colors ${
                        level <= passwordStrength.score
                          ? passwordStrength.color
                          : 'bg-white/[0.06]'
                      }`}
                    />
                  ))}
                </div>
                <div className="space-y-1">
                  {[
                    { check: passwordChecks.length, label: 'At least 8 characters' },
                    { check: passwordChecks.uppercase, label: 'One uppercase letter' },
                    { check: passwordChecks.lowercase, label: 'One lowercase letter' },
                    { check: passwordChecks.number, label: 'One number' },
                  ].map((item, idx) => (
                    <div key={idx} className="flex items-center gap-2 text-xs">
                      {item.check ? (
                        <Check className="w-3 h-3 text-green-500" />
                      ) : (
                        <X className="w-3 h-3 text-slate-600" />
                      )}
                      <span className={item.check ? 'text-slate-400' : 'text-slate-600'}>
                        {item.label}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          <div>
            <label className="block text-sm text-slate-400 mb-2">
              Confirm Password
            </label>
            <div className="relative">
              <Input
                type={showConfirmPassword ? 'text' : 'password'}
                placeholder="Re-enter your password"
                value={formData.confirmPassword}
                onChange={(e) => updateFormData('confirmPassword', e.target.value)}
                required
                className="h-10 bg-white/[0.03] border-white/[0.08] text-white placeholder:text-slate-600 focus:bg-white/[0.05] focus:border-white/[0.15] pr-10"
              />
              <button
                type="button"
                onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-400 transition-colors"
              >
                {showConfirmPassword ? (
                  <EyeOff className="w-4 h-4" />
                ) : (
                  <Eye className="w-4 h-4" />
                )}
              </button>
            </div>
            {formData.confirmPassword && formData.password !== formData.confirmPassword && (
              <p className="text-xs text-red-400 mt-2 flex items-center gap-1">
                <X className="w-3 h-3" />
                Passwords do not match
              </p>
            )}
            {formData.confirmPassword && formData.password === formData.confirmPassword && (
              <p className="text-xs text-green-400 mt-2 flex items-center gap-1">
                <Check className="w-3 h-3" />
                Passwords match
              </p>
            )}
          </div>

          {error && (
            <div className="p-3 rounded-md bg-red-500/10 border border-red-500/20 text-red-400 text-sm">
              {error}
            </div>
          )}

          <Button
            type="submit"
            disabled={isLoading}
            className="w-full h-10 bg-white text-black hover:bg-white/90 font-medium mt-6 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isLoading ? 'Creating account...' : 'Continue'}
          </Button>
        </form>

        <div className="mt-6 text-center">
          <span className="text-sm text-slate-500">Already have an account? </span>
          <button
            onClick={() => onNavigate('/login')}
            className="text-sm text-white hover:text-slate-300 transition-colors"
          >
            Sign in
          </button>
        </div>

        <p className="text-xs text-slate-600 mt-8 text-center">
          By continuing, you agree to our{' '}
          <a href="#" className="text-slate-500 hover:text-slate-400 transition-colors">Terms</a>
          {' '}and{' '}
          <a href="#" className="text-slate-500 hover:text-slate-400 transition-colors">Privacy Policy</a>
        </p>
      </div>
    </div>
  );
}