import React, { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { ArrowLeft, Eye, EyeOff, Check, X } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '../../lib/supabase';
import logoImage from '../../assets/fcad7446971be733d3427a6b22f8f64253529daf.png';
import { useEffect } from 'react';

interface SignupProps {
  onNavigate: (path: string) => void;
}

const checkEmailExists = async (email: string) => {
  try {
    const response = await fetch("https://ucbueapoexnxhttynfzy.supabase.co/functions/v1/checkEmail", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email }),
    });

    if (!response.ok) {
      const errorData = await response.json();
      console.error("Error checking email:", errorData);
      return false;
    }

    const data = await response.json();
    return data.exists; // true if email exists, false otherwise
  } catch (err) {
    console.error("Network error:", err);
    return false;
  }
};


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
  const [touched, setTouched] = useState({
    fullName: false,
    email: false,
    password: false,
    confirmPassword: false,
  });
const [emailExists, setEmailExists] = useState(false);
const [checkingEmail, setCheckingEmail] = useState(false);

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

  // Check if password meets all requirements
  const isPasswordValid = Object.values(passwordChecks).every(check => check);

  // Email validation
  const isEmailValid = useMemo(() => {
    if (!formData.email) return false;
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(formData.email);
  }, [formData.email]);

  // Form validation
  const errors = useMemo(() => ({
  fullName: touched.fullName && !formData.fullName ? 'Full name is required' : null,

  email:
    touched.email && !formData.email
      ? 'Email is required'
      : touched.email && !isEmailValid
      ? 'Please enter a valid email address'
      : touched.email && emailExists
      ? 'An account with this email already exists'
      : null,

  password: touched.password && !formData.password
    ? 'Password is required'
    : touched.password && !isPasswordValid
    ? 'Password does not meet requirements'
    : null,

  confirmPassword:
    touched.confirmPassword && !formData.confirmPassword
      ? 'Please confirm your password'
      : touched.confirmPassword && formData.password !== formData.confirmPassword
      ? 'Passwords do not match'
      : null,
}), [formData, touched, isPasswordValid, isEmailValid, emailExists]);

 

  useEffect(() => {
    if (!isEmailValid) {
      setEmailExists(false);
      return;
    }

    setCheckingEmail(true);

    const timeout = setTimeout(async () => {
      try {
        const exists = await checkEmailExists(formData.email);
        setEmailExists(exists);
      } finally {
        setCheckingEmail(false);
      }
    }, 500); // debounce

    return () => clearTimeout(timeout);
  }, [formData.email, isEmailValid]);




  const handleBlur = (field: keyof typeof touched) => {
    setTouched({ ...touched, [field]: true });
  };
const handleSubmit = async (e: React.FormEvent) => {
  e.preventDefault();
  setTouched({
    fullName: true,
    email: true,
    password: true,
    confirmPassword: true,
  });

  if (!formData.fullName || !formData.email || !isEmailValid) {
    toast.error('Please fill in all required fields correctly');
    return;
  }

  if (!isPasswordValid) {
    toast.error('Password does not meet security requirements');
    return;
  }

  if (formData.password !== formData.confirmPassword) {
    toast.error('Passwords do not match');
    return;
  }

  setIsLoading(true);

  try {
    // 🔴 CHECK EMAIL FIRST USING SERVERLESS ENDPOINT
    const exists = await checkEmailExists(formData.email);
      setEmailExists(exists);

    if (exists) {
      // ✅ EMAIL EXISTS → LOGIN WITH OTP
      const { error } = await supabase.auth.signInWithOtp({
        email: formData.email,
      });

      if (error) {
        toast.error(error.message);
        return;
      }

      localStorage.setItem('pending_verification_email', formData.email);
      toast.success(
        'Email exists! A magic login link has been sent to your email.'
      );
      navigate('/verification');
      return; // ⛔ STOP HERE
    }

    // ✅ EMAIL DOESN’T EXIST → SIGNUP FLOW
    const { data, error } = await supabase.auth.signUp({
      email: formData.email,
      password: formData.password,
      options: {
        data: {
          full_name: formData.fullName,
          phone: formData.phone || undefined,
        },
      },
    });

    if (error) {
      toast.error(error.message);
      return;
    }

    localStorage.setItem('pending_verification_email', formData.email);
    toast.success('Account created successfully! Please check your email.');

    navigate(
      data.user?.email_confirmed_at ? '/onboarding' : '/verification'
    );
  } catch (err) {
    const errorMessage =
      err instanceof Error ? err.message : 'An unexpected error occurred';
    toast.error(errorMessage);
  } finally {
    setIsLoading(false);
  }
};


  const updateFormData = (field: string, value: string) => {
    setFormData({ ...formData, [field]: value });
  };

  // Disable submit button if form is invalid
  const isFormValid =
  formData.fullName &&
  isEmailValid &&
  !emailExists &&
  isPasswordValid &&
  formData.password === formData.confirmPassword;


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
          {/* Full Name */}
          <div>
            <label className="block text-sm text-slate-400 mb-2">
              Full Name <span className="text-red-400">*</span>
            </label>
            <Input
              type="text"
              placeholder="Enter your full name"
              value={formData.fullName}
              onChange={(e) => updateFormData('fullName', e.target.value)}
              onBlur={() => handleBlur('fullName')}
              className={`h-10 bg-white/[0.03] text-white placeholder:text-slate-600 focus:bg-white/[0.05] ${
                errors.fullName
                  ? 'border-red-500/50 focus:border-red-500'
                  : 'border-white/[0.08] focus:border-white/[0.15]'
              }`}
            />
            {errors.fullName && (
              <p className="text-xs text-red-400 mt-1.5 flex items-center gap-1">
                <X className="w-3 h-3" />
                {errors.fullName}
              </p>
            )}
          </div>

          {/* Email */}
          <div>
            <label className="block text-sm text-slate-400 mb-2">
              Email <span className="text-red-400">*</span>
            </label>
            <Input
              type="email"
              placeholder="name@company.com"
              value={formData.email}
              onFocus={() => checkEmailExists(formData.email)}
              onChange={(e) => updateFormData('email', e.target.value)}
              onBlur={() => handleBlur('email')}
              className={`h-10 bg-white/[0.03] text-white placeholder:text-slate-600 focus:bg-white/[0.05] ${
                errors.email
                  ? 'border-red-500/50 focus:border-red-500'
                  : 'border-white/[0.08] focus:border-white/[0.15]'
                                }`}
                              />
                              {checkingEmail && (
                    <p className="text-xs text-slate-500 mt-1.5">
                      Checking email availability…
                    </p>
                  )}

                  {errors.email && (
                    <p className="text-xs text-red-400 mt-1.5 flex items-center gap-1">
                      <X className="w-3 h-3" />
                      {errors.email}
                    </p>
                  )}

          </div>

          {/* Phone */}
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

          {/* Password */}
          <div>
            <label className="block text-sm text-slate-400 mb-2">
              Password <span className="text-red-400">*</span>
            </label>
            <div className="relative">
              <Input
                type={showPassword ? 'text' : 'password'}
                placeholder="Create a password"
                value={formData.password}
                onChange={(e) => updateFormData('password', e.target.value)}
                onBlur={() => handleBlur('password')}
                className={`h-10 bg-white/[0.03] text-white placeholder:text-slate-600 focus:bg-white/[0.05] pr-10 ${
                  errors.password
                    ? 'border-red-500/50 focus:border-red-500'
                    : 'border-white/[0.08] focus:border-white/[0.15]'
                }`}
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-400 transition-colors"
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>

            {errors.password && !formData.password && (
              <p className="text-xs text-red-400 mt-1.5 flex items-center gap-1">
                <X className="w-3 h-3" />
                {errors.password}
              </p>
            )}

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

          {/* Confirm Password */}
          <div>
            <label className="block text-sm text-slate-400 mb-2">
              Confirm Password <span className="text-red-400">*</span>
            </label>
            <div className="relative">
              <Input
                type={showConfirmPassword ? 'text' : 'password'}
                placeholder="Re-enter your password"
                value={formData.confirmPassword}
                onChange={(e) => updateFormData('confirmPassword', e.target.value)}
                onBlur={() => handleBlur('confirmPassword')}
                className={`h-10 bg-white/[0.03] text-white placeholder:text-slate-600 focus:bg-white/[0.05] pr-10 ${
                  errors.confirmPassword
                    ? 'border-red-500/50 focus:border-red-500'
                    : formData.confirmPassword && formData.password === formData.confirmPassword
                    ? 'border-green-500/50 focus:border-green-500'
                    : 'border-white/[0.08] focus:border-white/[0.15]'
                }`}
              />
              <button
                type="button"
                onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-400 transition-colors"
              >
                {showConfirmPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
            {errors.confirmPassword && (
              <p className="text-xs text-red-400 mt-1.5 flex items-center gap-1">
                <X className="w-3 h-3" />
                {errors.confirmPassword}
              </p>
            )}
            {formData.confirmPassword && formData.password === formData.confirmPassword && (
              <p className="text-xs text-green-400 mt-1.5 flex items-center gap-1">
                <Check className="w-3 h-3" />
                Passwords match
              </p>
            )}
          </div>

          <Button
            type="submit"
            disabled={isLoading || !isFormValid}
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