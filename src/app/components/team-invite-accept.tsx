import React, { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Card, CardContent } from "./ui/card";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { useTeamInviteByToken, useAcceptTeamInvite } from "../../hooks/useTeam";
import { useAuth } from "../../contexts/AuthContext";
import { useCheckOnboarding } from "../../hooks/useOnboarding";
import { toast } from "sonner";
import { supabase } from "../../lib/supabase";
import {
  Users,
  Mail,
  Shield,
  Eye,
  Crown,
  CheckCircle2,
  ArrowRight,
  XCircle,
  Clock,
  EyeOff,
} from "lucide-react";

export function TeamInviteAccept() {
  const { token } = useParams<{ token: string }>();
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const {
    data: invite,
    isLoading: inviteLoading,
    error: inviteError,
  } = useTeamInviteByToken(token || "", !!token);
  const acceptInviteMutation = useAcceptTeamInvite();
  const { needsOnboarding } = useCheckOnboarding();
  const [isProcessing, setIsProcessing] = useState(false);
  
  // Signup form state
  const [signupData, setSignupData] = useState({
    fullName: "",
    password: "",
    confirmPassword: "",
  });
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [isSigningUp, setIsSigningUp] = useState(false);
  const [signupError, setSignupError] = useState<string | null>(null);

  const handleAccept = async () => {
    if (!token) {
      toast.error("Invalid invite token");
      return;
    }

    if (!user) {
      toast.error("Please sign in to accept the invite");
      navigate("/login");
      return;
    }

    setIsProcessing(true);
    try {
      await acceptInviteMutation.mutateAsync(token);
      // Navigate to onboarding if needed, otherwise to team page
      setTimeout(() => {
        navigate(needsOnboarding ? "/onboarding" : "/team");
      }, 1500);
    } catch (error) {
      setIsProcessing(false);
    }
  };

  const handleSignupAndAccept = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token || !invite) {
      toast.error("Invalid invite token");
      return;
    }

    setSignupError(null);

    // Validate password confirmation
    if (signupData.password !== signupData.confirmPassword) {
      setSignupError("Passwords do not match");
      toast.error("Passwords do not match");
      return;
    }

    // Validate password length
    if (signupData.password.length < 8) {
      setSignupError("Password must be at least 8 characters");
      toast.error("Password must be at least 8 characters");
      return;
    }

    setIsSigningUp(true);

    try {
      // Sign up with Supabase using the invite email
      const { data: signupData_result, error: signUpError } = await supabase.auth.signUp({
        email: invite.email,
        password: signupData.password,
        options: {
          data: {
            full_name: signupData.fullName || invite.email.split("@")[0],
          },
        },
      });

      if (signUpError) {
        setSignupError(signUpError.message);
        toast.error(signUpError.message);
        setIsSigningUp(false);
        return;
      }

      if (signupData_result.user) {
        toast.success("Account created successfully");
        
        // Check if email confirmation is required
        if (!signupData_result.user.email_confirmed_at) {
          // Email confirmation required - redirect to verification
          toast.info("Please check your email to confirm your account, then return here to accept the invitation");
          navigate("/verification");
          setIsSigningUp(false);
          return;
        }

        // Email already confirmed (or confirmation disabled) - proceed with accepting invite
        // Wait a moment for the session to be established in AuthContext
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        // Refresh the session to ensure we have the latest user data
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) {
          setSignupError("Session not established. Please try logging in.");
          setIsSigningUp(false);
          return;
        }

        // Try to accept the invite
        try {
          await acceptInviteMutation.mutateAsync(token);
          toast.success("Invitation accepted!");
          // Wait a moment for profile to sync, then check onboarding
          setTimeout(() => {
            navigate(needsOnboarding ? "/onboarding" : "/team");
          }, 1500);
        } catch (acceptError) {
          setIsSigningUp(false);
          const errorMessage = acceptError instanceof Error ? acceptError.message : "Failed to accept invitation";
          setSignupError(errorMessage);
          toast.error(errorMessage);
        }
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "An unexpected error occurred";
      setSignupError(errorMessage);
      toast.error(errorMessage);
      setIsSigningUp(false);
    }
  };

  const getRoleInfo = (role: string) => {
    switch (role) {
      case "owner":
        return {
          icon: <Crown className="w-4 h-4" />,
          label: "Owner",
          color: "text-amber-400",
        };
      case "admin":
        return {
          icon: <Shield className="w-4 h-4" />,
          label: "Admin",
          color: "text-purple-400",
        };
      case "member":
        return {
          icon: <Users className="w-4 h-4" />,
          label: "Member",
          color: "text-primary",
        };
      case "viewer":
        return {
          icon: <Eye className="w-4 h-4" />,
          label: "Viewer",
          color: "text-slate-400",
        };
      default:
        return {
          icon: <Users className="w-4 h-4" />,
          label: role,
          color: "text-slate-400",
        };
    }
  };

  if (authLoading || inviteLoading) {
    return (
      <div className="min-h-screen bg-[#0A0A0A] flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 border-2 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-slate-400">Loading invite...</p>
        </div>
      </div>
    );
  }

  if (!token || inviteError || !invite) {
    return (
      <div className="min-h-screen bg-[#0A0A0A] flex items-center justify-center p-6">
        <Card className="bg-[#0D0D0D] border-white/[0.08] max-w-md w-full">
          <CardContent className="p-6 text-center">
            <div className="w-12 h-12 rounded-full bg-red-500/10 flex items-center justify-center mx-auto mb-4">
              <XCircle className="w-6 h-6 text-red-400" />
            </div>
            <h2 className="text-xl font-semibold text-white mb-2">
              Invalid Invite
            </h2>
            <p className="text-slate-400 mb-6">
              {inviteError?.message ||
                "This invite link is invalid or has expired."}
            </p>
            <Button
              onClick={() => navigate("/home")}
              className="bg-primary hover:bg-primary/90 text-black"
            >
              Go to Home
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Check if expired
  const isExpired = new Date(invite.expires_at) < new Date();
  if (isExpired) {
    return (
      <div className="min-h-screen bg-[#0A0A0A] flex items-center justify-center p-6">
        <Card className="bg-[#0D0D0D] border-white/[0.08] max-w-md w-full">
          <CardContent className="p-6 text-center">
            <div className="w-12 h-12 rounded-full bg-amber-500/10 flex items-center justify-center mx-auto mb-4">
              <Clock className="w-6 h-6 text-amber-400" />
            </div>
            <h2 className="text-xl font-semibold text-white mb-2">
              Invite Expired
            </h2>
            <p className="text-slate-400 mb-6">This invite link has expired.</p>
            <Button
              onClick={() => navigate("/home")}
              className="bg-primary hover:bg-primary/90 text-black"
            >
              Go to Home
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Check if already accepted
  if (invite.accepted_at) {
    return (
      <div className="min-h-screen bg-[#0A0A0A] flex items-center justify-center p-6">
        <Card className="bg-[#0D0D0D] border-white/[0.08] max-w-md w-full">
          <CardContent className="p-6 text-center">
            <div className="w-12 h-12 rounded-full bg-emerald-500/10 flex items-center justify-center mx-auto mb-4">
              <CheckCircle2 className="w-6 h-6 text-emerald-400" />
            </div>
            <h2 className="text-xl font-semibold text-white mb-2">
              Already Accepted
            </h2>
            <p className="text-slate-400 mb-6">
              This invite has already been accepted.
            </p>
            <Button
              onClick={() => navigate("/team")}
              className="bg-primary hover:bg-primary/90 text-black"
            >
              Go to Team Page
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const roleInfo = getRoleInfo(invite.role);

  return (
    <div className="min-h-screen bg-[#0A0A0A] flex items-center justify-center p-6">
      <Card className="bg-[#0D0D0D] border-white/[0.08] max-w-lg w-full">
        <CardContent className="p-8">
          <div className="text-center mb-8">
            <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-4">
              <Mail className="w-8 h-8 text-primary" />
            </div>
            <h2 className="text-2xl font-semibold text-white mb-2">
              Team Invitation
            </h2>
            <p className="text-slate-400">
              You've been invited to join a workspace
            </p>
          </div>

          {/* Invite Details */}
          <div className="space-y-4 mb-8">
            <div className="p-4 bg-white/[0.02] border border-white/[0.06] rounded-lg">
              <div className="flex items-center justify-between mb-3">
                <span className="text-sm text-slate-400">Invited Email</span>
              </div>
              <div className="flex items-center gap-2">
                <Mail className="w-4 h-4 text-slate-400" />
                <span className="text-white font-medium">{invite.email}</span>
              </div>
            </div>

            <div className="p-4 bg-white/[0.02] border border-white/[0.06] rounded-lg">
              <div className="flex items-center justify-between mb-3">
                <span className="text-sm text-slate-400">Role</span>
              </div>
              <div className={`flex items-center gap-2 ${roleInfo.color}`}>
                {roleInfo.icon}
                <span className="font-medium">{roleInfo.label}</span>
              </div>
            </div>

            {invite.inviter_name && (
              <div className="p-4 bg-white/[0.02] border border-white/[0.06] rounded-lg">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-sm text-slate-400">Invited By</span>
                </div>
                <div className="flex items-center gap-2">
                  <Users className="w-4 h-4 text-slate-400" />
                  <span className="text-white">{invite.inviter_name}</span>
                </div>
              </div>
            )}

            {invite.message && (
              <div className="p-4 bg-white/[0.02] border border-white/[0.06] rounded-lg">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-sm text-slate-400">Message</span>
                </div>
                <p className="text-white">{invite.message}</p>
              </div>
            )}
          </div>

          {/* Action Buttons / Signup Form */}
          {!user ? (
            <form onSubmit={handleSignupAndAccept} className="space-y-4">
              {/* Signup Form */}
              <div className="space-y-4">
                {/* Email (read-only, pre-filled) */}
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-2">
                    Email
                  </label>
                  <Input
                    type="email"
                    value={invite.email}
                    disabled
                    className="h-10 bg-white/[0.02] border-white/[0.06] text-slate-400 cursor-not-allowed"
                  />
                </div>

                {/* Full Name */}
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-2">
                    Full Name (optional)
                  </label>
                  <Input
                    type="text"
                    placeholder="John Doe"
                    value={signupData.fullName}
                    onChange={(e) =>
                      setSignupData({ ...signupData, fullName: e.target.value })
                    }
                    className="h-10 bg-white/[0.04] border-white/[0.1] text-white placeholder:text-slate-500"
                  />
                </div>

                {/* Password */}
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-2">
                    Password
                  </label>
                  <div className="relative">
                    <Input
                      type={showPassword ? "text" : "password"}
                      placeholder="Enter password"
                      value={signupData.password}
                      onChange={(e) =>
                        setSignupData({ ...signupData, password: e.target.value })
                      }
                      className="h-10 bg-white/[0.04] border-white/[0.1] text-white placeholder:text-slate-500 pr-10"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-300"
                    >
                      {showPassword ? (
                        <EyeOff className="w-4 h-4" />
                      ) : (
                        <Eye className="w-4 h-4" />
                      )}
                    </button>
                  </div>
                  <p className="text-xs text-slate-500 mt-1">
                    Must be at least 8 characters
                  </p>
                </div>

                {/* Confirm Password */}
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-2">
                    Confirm Password
                  </label>
                  <div className="relative">
                    <Input
                      type={showConfirmPassword ? "text" : "password"}
                      placeholder="Confirm password"
                      value={signupData.confirmPassword}
                      onChange={(e) =>
                        setSignupData({
                          ...signupData,
                          confirmPassword: e.target.value,
                        })
                      }
                      className="h-10 bg-white/[0.04] border-white/[0.1] text-white placeholder:text-slate-500 pr-10"
                    />
                    <button
                      type="button"
                      onClick={() =>
                        setShowConfirmPassword(!showConfirmPassword)
                      }
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-300"
                    >
                      {showConfirmPassword ? (
                        <EyeOff className="w-4 h-4" />
                      ) : (
                        <Eye className="w-4 h-4" />
                      )}
                    </button>
                  </div>
                </div>

                {/* Error Message */}
                {signupError && (
                  <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-lg">
                    <p className="text-sm text-red-400">{signupError}</p>
                  </div>
                )}
              </div>

              {/* Submit Button */}
              <Button
                type="submit"
                disabled={isSigningUp || acceptInviteMutation.isPending}
                className="w-full h-11 bg-primary hover:bg-primary/90 text-black font-medium"
              >
                {isSigningUp || acceptInviteMutation.isPending ? (
                  <>
                    <div className="w-4 h-4 border-2 border-black border-t-transparent rounded-full animate-spin mr-2"></div>
                    Creating Account...
                  </>
                ) : (
                  <>
                    Create Account & Accept
                    <ArrowRight className="w-4 h-4 ml-2" />
                  </>
                )}
              </Button>

              {/* Login Link */}
              <Button
                type="button"
                onClick={() => navigate("/login")}
                variant="outline"
                className="w-full h-11 bg-white/[0.04] hover:bg-white/[0.08] border-white/[0.1] text-white"
              >
                Already have an account? Sign In
              </Button>
            </form>
          ) : user.email?.toLowerCase() !== invite.email.toLowerCase() ? (
            <div className="space-y-3">
              <div className="p-4 bg-amber-500/10 border border-amber-500/20 rounded-lg">
                <p className="text-sm text-amber-400 text-center">
                  This invite is for <strong>{invite.email}</strong>, but you're
                  signed in as <strong>{user.email}</strong>. Please sign out
                  and sign in with the correct email.
                </p>
              </div>
              <Button
                onClick={() => navigate("/login")}
                variant="outline"
                className="w-full h-11 bg-white/[0.04] hover:bg-white/[0.08] border-white/[0.1] text-white"
              >
                Sign In with Different Account
              </Button>
            </div>
          ) : (
            <Button
              onClick={handleAccept}
              disabled={isProcessing || acceptInviteMutation.isPending}
              className="w-full h-11 bg-primary hover:bg-primary/90 text-black font-medium"
            >
              {isProcessing || acceptInviteMutation.isPending ? (
                <>
                  <div className="w-4 h-4 border-2 border-black border-t-transparent rounded-full animate-spin mr-2"></div>
                  Accepting...
                </>
              ) : (
                <>
                  <CheckCircle2 className="w-4 h-4 mr-2" />
                  Accept Invitation
                </>
              )}
            </Button>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
