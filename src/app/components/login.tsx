import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { ArrowLeft, Eye, EyeOff } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "../../lib/supabase";
import logoImage from "../../assets/fcad7446971be733d3427a6b22f8f64253529daf.png";

interface LoginProps {
  onNavigate: (path: string) => void;
}

export function Login({ onNavigate }: LoginProps) {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showForgotPassword, setShowForgotPassword] = useState(false);
  const [resetEmail, setResetEmail] = useState("");
  const [isResetting, setIsResetting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsLoading(true);

    try {
      // Check if Supabase is configured
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
      const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

      if (
        !supabaseUrl ||
        !supabaseAnonKey ||
        supabaseUrl.includes("your-project") ||
        supabaseUrl.includes("placeholder") ||
        supabaseAnonKey === "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9"
      ) {
        const errorMsg =
          "Supabase is not configured. Please update your .env file with valid credentials from https://app.supabase.com";
        setError(errorMsg);
        toast.error(errorMsg);
        setIsLoading(false);
        return;
      }

      const { data, error: signInError } =
        await supabase.auth.signInWithPassword({
          email,
          password,
        });

      if (signInError) {
        // Provide more helpful error messages
        let errorMessage = signInError.message;
        if (signInError.message.includes("Invalid login credentials")) {
          errorMessage =
            "Invalid email or password. Please check your credentials and try again.";
        } else if (signInError.message.includes("fetch")) {
          errorMessage =
            "Unable to connect to Supabase. Please check your internet connection and Supabase configuration.";
        }
        setError(errorMessage);
        toast.error(errorMessage);
        setIsLoading(false);
        return;
      }

      if (data.user) {
        // Store remember me preference
        if (rememberMe) {
          localStorage.setItem("dttracker-remember", "true");
        }
        toast.success("Signed in successfully");
        navigate("/");
      }
    } catch (err) {
      const errorMessage =
        err instanceof Error ? err.message : "An unexpected error occurred";
      setError(errorMessage);
      toast.error(errorMessage);
      setIsLoading(false);
    }
  };

  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsResetting(true);
    setError(null);

    try {
      const { error: resetError } = await supabase.auth.resetPasswordForEmail(
        resetEmail,
        {
          redirectTo: `${window.location.origin}/reset-password`,
        }
      );

      if (resetError) {
        toast.error(resetError.message);
        setIsResetting(false);
        return;
      }

      toast.success("Password reset link sent to your email");
      setShowForgotPassword(false);
      setResetEmail("");
      setIsResetting(false);
    } catch (err) {
      toast.error("Failed to send reset email");
      setIsResetting(false);
    }
  };

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
          <h1 className="text-2xl font-semibold text-foreground mb-2">Sign in</h1>
          <p className="text-sm text-muted-foreground">
            Enter your email and password to continue
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm text-muted-foreground mb-2">Email</label>
            <Input
              type="email"
              placeholder="name@company.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="h-10 bg-muted/40 border-border text-foreground placeholder:text-muted-foreground focus:bg-muted/60 focus:border-border/80"
            />
          </div>

          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="block text-sm text-muted-foreground">Password</label>
              <button
                type="button"
                onClick={() => {
                  setShowForgotPassword(true);
                  setResetEmail(email);
                }}
                className="text-sm text-muted-foreground hover:text-muted-foreground transition-colors"
              >
                Forgot?
              </button>
            </div>
            <div className="relative">
              <Input
                type={showPassword ? "text" : "password"}
                placeholder="Enter password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                className="h-10 bg-muted/40 border-border text-foreground placeholder:text-muted-foreground focus:bg-muted/60 focus:border-border/80 pr-10"
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
          </div>

          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="remember"
              checked={rememberMe}
              onChange={(e) => setRememberMe(e.target.checked)}
              className="w-4 h-4 rounded border-border bg-muted/40 text-primary focus:ring-ring/40 focus:ring-offset-0"
            />
            <label
              htmlFor="remember"
              className="text-sm text-muted-foreground cursor-pointer"
            >
              Remember me
            </label>
          </div>

          {error && (
            <div className="p-3 rounded-md bg-red-500/10 border border-red-500/20 text-red-400 text-sm animate-in fade-in slide-in-from-top-1 duration-200">
              {error}
            </div>
          )}

          <Button
            type="submit"
            disabled={isLoading}
            className="w-full h-10 bg-primary text-primary-foreground hover:bg-primary/90 font-medium disabled:opacity-50 disabled:cursor-not-allowed transition-all"
          >
            {isLoading ? "Signing in..." : "Sign in"}
          </Button>
        </form>

        <div className="mt-6 text-center">
          <span className="text-sm text-muted-foreground">
            Don't have an account?{" "}
          </span>
          <button
            onClick={() => onNavigate("/signup")}
            className="text-sm text-foreground hover:text-muted-foreground transition-colors"
          >
            Sign up
          </button>
        </div>
      </div>

      {/* Forgot Password Modal */}
      {showForgotPassword && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-6 z-50 animate-in fade-in duration-200">
          <div className="bg-card border border-border rounded-lg p-6 w-full max-w-sm animate-in zoom-in-95 duration-200">
            <h2 className="text-xl font-semibold text-foreground mb-2">
              Reset password
            </h2>
            <p className="text-sm text-muted-foreground mb-6">
              Enter your email and we'll send you a link to reset your password
            </p>

            <form onSubmit={handleForgotPassword} className="space-y-4">
              <div>
                <label className="block text-sm text-muted-foreground mb-2">
                  Email
                </label>
                <Input
                  type="email"
                  placeholder="name@company.com"
                  value={resetEmail}
                  onChange={(e) => setResetEmail(e.target.value)}
                  required
                  className="h-10 bg-muted/40 border-border text-foreground placeholder:text-muted-foreground focus:bg-muted/60 focus:border-border/80"
                />
              </div>

              <div className="flex gap-3">
                <Button
                  type="button"
                  onClick={() => {
                    setShowForgotPassword(false);
                    setResetEmail("");
                  }}
                  variant="outline"
                  className="flex-1 h-10 bg-transparent border-border/70 text-foreground hover:bg-muted/50"
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={isResetting}
                  className="flex-1 h-10 bg-primary text-primary-foreground hover:bg-primary/90 font-medium disabled:opacity-50"
                >
                  {isResetting ? "Sending..." : "Send link"}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
