import React, { useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { ArrowLeft, Eye, EyeOff, Check, X } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "../../lib/supabase";
import logoImage from "../../assets/fcad7446971be733d3427a6b22f8f64253529daf.png";
import { useEffect } from "react";

interface SignupProps {
  onNavigate: (path: string) => void;
}

const checkEmailExists = async (email: string): Promise<boolean> => {
  if (!email || !email.includes("@")) return false;

  try {
    const res = await fetch(
      "https://ucbueapoexnxhttynfzy.supabase.co/functions/v1/checkEmail",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          apikey: import.meta.env.VITE_SUPABASE_ANON_KEY,
        },
        body: JSON.stringify({ email: email.trim().toLowerCase() }),
      }
    );

    if (!res.ok) return false;
    const data = await res.json();
    return Boolean(data.exists);
  } catch {
    return false;
  }
};

export function Signup({ onNavigate }: SignupProps) {
  const navigate = useNavigate();
  const [formData, setFormData] = useState({
    fullName: "",
    email: "",
    phone: "",
    password: "",
    confirmPassword: "",
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

  // Password strength calculation
  const passwordStrength = useMemo(() => {
    const password = formData.password;
    if (!password) return { strength: "none", score: 0, label: "" };

    let score = 0;
    if (password.length >= 8) score++;
    if (password.length >= 12) score++;
    if (/[a-z]/.test(password) && /[A-Z]/.test(password)) score++;
    if (/\d/.test(password)) score++;
    if (/[^a-zA-Z\d]/.test(password)) score++;

    if (score <= 2)
      return { strength: "weak", score, label: "Weak", color: "bg-red-500" };
    if (score <= 3)
      return {
        strength: "medium",
        score,
        label: "Medium",
        color: "bg-yellow-500",
      };
    return {
      strength: "strong",
      score,
      label: "Strong",
      color: "bg-green-500",
    };
  }, [formData.password]);

  // Password validation checks
  const passwordChecks = useMemo(
    () => ({
      length: formData.password.length >= 8,
      uppercase: /[A-Z]/.test(formData.password),
      lowercase: /[a-z]/.test(formData.password),
      number: /\d/.test(formData.password),
    }),
    [formData.password]
  );

  // Check if password meets all requirements
  const isPasswordValid = Object.values(passwordChecks).every((check) => check);

  // Email validation
  const isEmailValid = useMemo(() => {
    if (!formData.email) return false;
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(formData.email);
  }, [formData.email]);

  // Form validation
  const errors = useMemo(
    () => ({
      fullName:
        touched.fullName && !formData.fullName ? "Full name is required" : null,

      email:
        touched.email && !formData.email
          ? "Email is required"
          : touched.email && !isEmailValid
            ? "Please enter a valid email address"
            : touched.email && emailExists
              ? "An account with this email already exists"
              : null,

      password:
        touched.password && !formData.password
          ? "Password is required"
          : touched.password && !isPasswordValid
            ? "Password does not meet requirements"
            : null,

      confirmPassword:
        touched.confirmPassword && !formData.confirmPassword
          ? "Please confirm your password"
          : touched.confirmPassword &&
              formData.password !== formData.confirmPassword
            ? "Passwords do not match"
            : null,
    }),
    [formData, touched, isPasswordValid, isEmailValid, emailExists]
  );

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

    if (!isFormValid) {
      toast.error("Please fix the errors above");
      return;
    }

    setIsLoading(true);

    try {
      // ✅ Check email existence ONLY here
      const exists = await checkEmailExists(formData.email);

      if (exists) {
        setEmailExists(true);
        toast.error("An account with this email already exists");
        setIsLoading(false);
        return;
      }

      const { error } = await supabase.auth.signUp({
        email: formData.email.trim().toLowerCase(),
        password: formData.password,
        options: {
          emailRedirectTo: `${window.location.origin}/verification`,
          data: {
            full_name: formData.fullName,
            phone: formData.phone || undefined,
          },
        },
      });

      if (error) throw error;

      localStorage.setItem("auth_mode", "signup");
      localStorage.setItem("pending_verification_email", formData.email);
      toast.success("Account created! Check your email to verify.");
      navigate("/verification");
    } catch (err: any) {
      toast.error(err.message || "Signup failed. Please try again.");
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  const updateFormData = (field: keyof typeof formData, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }));

    if (field === "email") {
      setEmailExists(false);
    }
  };

  // Disable submit button if form is invalid
  const isFormValid =
    formData.fullName &&
    isEmailValid &&
    isPasswordValid &&
    formData.password === formData.confirmPassword;

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-6">
      <div className="w-full max-w-sm">
        <button
          onClick={() => onNavigate("/home")}
          className="flex items-center gap-2 text-muted-foreground hover:text-muted-foreground mb-12 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          <span className="text-sm">Back</span>
        </button>

        <div className="mb-8">
          <div className="flex items-center gap-2 mb-8">
            <img
              src={logoImage}
              alt="DTTracker"
              className="w-7 h-7 object-contain"
            />
            <span className="font-semibold text-foreground">DTTracker</span>
          </div>
          <h1 className="text-2xl font-semibold text-foreground mb-2">
            Create account
          </h1>
          <p className="text-sm text-muted-foreground">Start your 14-day free trial</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Full Name */}
          <div>
            <label className="block text-sm text-muted-foreground mb-2">
              Full Name <span className="text-red-400">*</span>
            </label>
            <Input
              name="name"
              autoComplete="name"
              type="text"
              placeholder="Enter your full name"
              value={formData.fullName}
              onChange={(e) => updateFormData("fullName", e.target.value)}
              className={`h-10 bg-muted/40 text-foreground placeholder:text-muted-foreground focus:bg-muted/60 ${
                errors.fullName
                  ? "border-red-500/50 focus:border-red-500"
                  : "border-border focus:border-border/80"
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
            <label className="block text-sm text-muted-foreground mb-2">
              Email <span className="text-red-400">*</span>
            </label>
            <Input
              name="email"
              autoComplete="email"
              type="email"
              placeholder="name@company.com"
              value={formData.email}
              onChange={(e) => updateFormData("email", e.target.value)}
              onBlur={() => handleBlur("email")}
              className={`h-10 bg-muted/40 text-foreground ${
                errors.email
                  ? "border-red-500/50 focus:border-red-500"
                  : "border-border focus:border-border/80"
              }`}
            />
          </div>

          {/* Phone */}
          <div>
            <label className="block text-sm text-muted-foreground mb-2">
              Phone <span className="text-muted-foreground">(optional)</span>
            </label>
            <Input
              name="tel"
              autoComplete="tel"
              type="tel"
              placeholder="Enter your phone number"
              value={formData.phone}
              onChange={(e) => updateFormData("phone", e.target.value)}
              className="h-10 bg-muted/40 border-border text-foreground placeholder:text-muted-foreground focus:bg-muted/60 focus:border-border/80"
            />
          </div>

          {/* Password */}
          <div>
            <label className="block text-sm text-muted-foreground mb-2">
              Password <span className="text-red-400">*</span>
            </label>
            <div className="relative">
              <Input
                name="new-password"
                autoComplete="new-password"
                type={showPassword ? "text" : "password"}
                placeholder="Create a password"
                value={formData.password}
                onChange={(e) => updateFormData("password", e.target.value)}
                onBlur={() => handleBlur("password")}
                className={`h-10 bg-muted/40 text-foreground placeholder:text-muted-foreground focus:bg-muted/60 pr-10 ${
                  errors.password
                    ? "border-red-500/50 focus:border-red-500"
                    : "border-border focus:border-border/80"
                }`}
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-muted-foreground transition-colors"
              >
                {showPassword ? (
                  <EyeOff className="w-4 h-4" />
                ) : (
                  <Eye className="w-4 h-4" />
                )}
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
                  <span className="text-xs text-muted-foreground">
                    Password strength
                  </span>
                  <span
                    className={`text-xs font-medium ${
                      passwordStrength.strength === "weak"
                        ? "text-red-400"
                        : passwordStrength.strength === "medium"
                          ? "text-yellow-400"
                          : "text-green-400"
                    }`}
                  >
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
                          : "bg-muted/60"
                      }`}
                    />
                  ))}
                </div>
                <div className="space-y-1">
                  {[
                    {
                      check: passwordChecks.length,
                      label: "At least 8 characters",
                    },
                    {
                      check: passwordChecks.uppercase,
                      label: "One uppercase letter",
                    },
                    {
                      check: passwordChecks.lowercase,
                      label: "One lowercase letter",
                    },
                    { check: passwordChecks.number, label: "One number" },
                  ].map((item, idx) => (
                    <div key={idx} className="flex items-center gap-2 text-xs">
                      {item.check ? (
                        <Check className="w-3 h-3 text-green-500" />
                      ) : (
                        <X className="w-3 h-3 text-muted-foreground" />
                      )}
                      <span
                        className={
                          item.check ? "text-muted-foreground" : "text-muted-foreground"
                        }
                      >
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
            <label className="block text-sm text-muted-foreground mb-2">
              Confirm Password <span className="text-red-400">*</span>
            </label>
            <div className="relative">
              <Input
                name="new-password"
                autoComplete="new-password"
                type={showConfirmPassword ? "text" : "password"}
                placeholder="Re-enter your password"
                value={formData.confirmPassword}
                onChange={(e) =>
                  updateFormData("confirmPassword", e.target.value)
                }
                onBlur={() => handleBlur("confirmPassword")}
                className={`h-10 bg-muted/40 text-foreground placeholder:text-muted-foreground focus:bg-muted/60 pr-10 ${
                  errors.confirmPassword
                    ? "border-red-500/50 focus:border-red-500"
                    : formData.confirmPassword &&
                        formData.password === formData.confirmPassword
                      ? "border-green-500/50 focus:border-green-500"
                      : "border-border focus:border-border/80"
                }`}
              />
              <button
                type="button"
                onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-muted-foreground transition-colors"
              >
                {showConfirmPassword ? (
                  <EyeOff className="w-4 h-4" />
                ) : (
                  <Eye className="w-4 h-4" />
                )}
              </button>
            </div>
            {errors.confirmPassword && (
              <p className="text-xs text-red-400 mt-1.5 flex items-center gap-1">
                <X className="w-3 h-3" />
                {errors.confirmPassword}
              </p>
            )}
            {formData.confirmPassword &&
              formData.password === formData.confirmPassword && (
                <p className="text-xs text-green-400 mt-1.5 flex items-center gap-1">
                  <Check className="w-3 h-3" />
                  Passwords match
                </p>
              )}
          </div>

          <Button
            type="submit"
            disabled={isLoading || !isFormValid}
            className="w-full h-10 bg-primary text-primary-foreground hover:bg-primary/90 font-medium mt-6 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isLoading ? "Creating account..." : "Continue"}
          </Button>
        </form>

        <div className="mt-6 text-center">
          <span className="text-sm text-muted-foreground">
            Already have an account?{" "}
          </span>
          <button
            onClick={() => onNavigate("/login")}
            className="text-sm text-foreground hover:text-muted-foreground transition-colors"
          >
            Sign in
          </button>
        </div>

        <p className="text-xs text-muted-foreground mt-8 text-center">
          By continuing, you agree to our{" "}
          <a
            href="#"
            className="text-muted-foreground hover:text-muted-foreground transition-colors"
          >
            Terms
          </a>{" "}
          and{" "}
          <a
            href="#"
            className="text-muted-foreground hover:text-muted-foreground transition-colors"
          >
            Privacy Policy
          </a>
        </p>
      </div>
    </div>
  );
}
