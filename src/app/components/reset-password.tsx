import React, { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Check, Eye, EyeOff, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { supabase } from "../../lib/supabase";
import logoImage from "../../assets/fcad7446971be733d3427a6b22f8f64253529daf.png";

export function ResetPassword() {
  const navigate = useNavigate();
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [sessionReady, setSessionReady] = useState(false);
  const [hasRecoverySession, setHasRecoverySession] = useState(false);
  const [sessionError, setSessionError] = useState<string | null>(null);

  const passwordStrength = useMemo(() => {
    if (!newPassword) return { strength: "none", score: 0, label: "" };

    let score = 0;
    if (newPassword.length >= 8) score++;
    if (newPassword.length >= 12) score++;
    if (/[a-z]/.test(newPassword) && /[A-Z]/.test(newPassword)) score++;
    if (/\d/.test(newPassword)) score++;
    if (/[^a-zA-Z\d]/.test(newPassword)) score++;

    if (score <= 2) {
      return { strength: "weak", score, label: "Weak", color: "bg-red-500" };
    }
    if (score <= 3) {
      return {
        strength: "medium",
        score,
        label: "Medium",
        color: "bg-yellow-500",
      };
    }
    return { strength: "strong", score, label: "Strong", color: "bg-green-500" };
  }, [newPassword]);

  const passwordChecks = useMemo(
    () => ({
      length: newPassword.length >= 8,
      uppercase: /[A-Z]/.test(newPassword),
      lowercase: /[a-z]/.test(newPassword),
      number: /\d/.test(newPassword),
    }),
    [newPassword]
  );

  const isPasswordValid = Object.values(passwordChecks).every(Boolean);

  const hasRecoveryParams = useMemo(() => {
    if (typeof window === "undefined") return false;
    const hash = window.location.hash;
    const search = window.location.search;
    return (
      hash.includes("type=recovery") ||
      hash.includes("access_token") ||
      search.includes("code=")
    );
  }, []);

  useEffect(() => {
    let isMounted = true;

    const checkSession = async () => {
      const { data, error } = await supabase.auth.getSession();
      if (!isMounted) return;
      if (error) {
        setSessionError(error.message);
      }
      setHasRecoverySession(!!data.session);
      setSessionReady(true);
    };

    checkSession();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      if (!isMounted) return;
      if (event === "PASSWORD_RECOVERY" || event === "SIGNED_IN") {
        setHasRecoverySession(!!session);
        setSessionReady(true);
      }
    });

    return () => {
      isMounted = false;
      subscription.unsubscribe();
    };
  }, []);

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!hasRecoverySession) {
      toast.error("This reset link is invalid or expired");
      return;
    }

    if (!newPassword || !confirmPassword) {
      toast.error("Please fill in both password fields");
      return;
    }

    if (!isPasswordValid) {
      toast.error("Password does not meet requirements");
      return;
    }

    if (newPassword !== confirmPassword) {
      toast.error("Passwords do not match");
      return;
    }

    setIsSubmitting(true);

    const { error } = await supabase.auth.updateUser({
      password: newPassword,
    });

    if (error) {
      toast.error(error.message || "Unable to update password");
      setIsSubmitting(false);
      return;
    }

    const { data: userData } = await supabase.auth.getUser();
    if (userData.user?.id) {
      await supabase
        .from('profiles')
        .update({ require_password_change: false })
        .eq('id', userData.user.id);
    }

    toast.success("Password updated successfully");
    await supabase.auth.signOut();
    navigate("/login");
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-6">
      <div className="w-full max-w-sm">
        <div className="flex items-center gap-2 mb-8">
          <img src={logoImage} alt="DTTracker" className="w-7 h-7 object-contain" />
          <span className="font-semibold text-foreground">DTTracker</span>
        </div>

        <div className="mb-8">
          <h1 className="text-2xl font-semibold text-foreground mb-2">Set a new password</h1>
          <p className="text-sm text-muted-foreground">
            Choose a new password for your account.
          </p>
        </div>

        {!sessionReady && (
          <div className="text-sm text-muted-foreground">Checking reset link...</div>
        )}

        {sessionReady && !hasRecoverySession && (
          <div className="space-y-4">
            <div className="p-3 rounded-md bg-red-500/10 border border-red-500/20 text-red-400 text-sm">
              {sessionError
                ? `Unable to verify reset link: ${sessionError}`
                : hasRecoveryParams
                ? "This reset link is invalid or expired."
                : "Open the reset link from your email to continue."}
            </div>
            <Button
              onClick={() => navigate("/login")}
              className="w-full h-10 bg-primary text-primary-foreground hover:bg-primary/90 font-medium"
            >
              Back to login
            </Button>
          </div>
        )}

        {sessionReady && hasRecoverySession && (
          <form onSubmit={handleResetPassword} className="space-y-4">
            <div>
              <label className="block text-sm text-muted-foreground mb-2">
                New password
              </label>
              <div className="relative">
                <Input
                  type={showNewPassword ? "text" : "password"}
                  placeholder="Enter a new password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  required
                  className="h-10 bg-muted/40 border-border text-foreground placeholder:text-muted-foreground focus:bg-muted/60 focus:border-border/80 pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowNewPassword(!showNewPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-muted-foreground transition-colors"
                >
                  {showNewPassword ? (
                    <EyeOff className="w-4 h-4" />
                  ) : (
                    <Eye className="w-4 h-4" />
                  )}
                </button>
              </div>

              {newPassword && (
                <div className="mt-3 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-muted-foreground">Password strength</span>
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
                      { check: passwordChecks.length, label: "At least 8 characters" },
                      { check: passwordChecks.uppercase, label: "One uppercase letter" },
                      { check: passwordChecks.lowercase, label: "One lowercase letter" },
                      { check: passwordChecks.number, label: "One number" },
                    ].map((item, idx) => (
                      <div key={idx} className="flex items-center gap-2 text-xs">
                        {item.check ? (
                          <Check className="w-3 h-3 text-green-500" />
                        ) : (
                          <X className="w-3 h-3 text-muted-foreground" />
                        )}
                        <span className={item.check ? "text-muted-foreground" : "text-muted-foreground"}>
                          {item.label}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <div>
              <label className="block text-sm text-muted-foreground mb-2">
                Confirm new password
              </label>
              <div className="relative">
                <Input
                  type={showConfirmPassword ? "text" : "password"}
                  placeholder="Re-enter the new password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  required
                  className="h-10 bg-muted/40 border-border text-foreground placeholder:text-muted-foreground focus:bg-muted/60 focus:border-border/80 pr-10"
                />
                <button
                  type="button"
                  onClick={() =>
                    setShowConfirmPassword(!showConfirmPassword)
                  }
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-muted-foreground transition-colors"
                >
                  {showConfirmPassword ? (
                    <EyeOff className="w-4 h-4" />
                  ) : (
                    <Eye className="w-4 h-4" />
                  )}
                </button>
              </div>
            </div>

            <Button
              type="submit"
              disabled={isSubmitting}
              className="w-full h-10 bg-primary text-primary-foreground hover:bg-primary/90 font-medium disabled:opacity-50 disabled:cursor-not-allowed transition-all"
            >
              {isSubmitting ? "Updating..." : "Update password"}
            </Button>
          </form>
        )}
      </div>
    </div>
  );
}
