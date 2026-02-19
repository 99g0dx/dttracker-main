import React, { useState } from "react";
import { useParams } from "react-router-dom";
import { Card, CardContent } from "./ui/card";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import {
  useCommunityInviteByToken,
  useVerifyDobbleTapUser,
  useJoinCommunity,
} from "../../hooks/useCommunityInvite";
import type { DobbleTapVerifyResult } from "../../hooks/useCommunityInvite";
import { toast } from "sonner";
import {
  XCircle,
  CheckCircle2,
  ArrowRight,
  ArrowLeft,
  Loader2,
  UserCheck,
  UserPlus,
} from "lucide-react";
import logoImage from "../../assets/fcad7446971be733d3427a6b22f8f64253529daf.png";

type JoinStep =
  | "loading"
  | "invalid"
  | "choose_path"
  | "verify_dt"
  | "verify_loading"
  | "confirm_handle"
  | "signup_form"
  | "submitting"
  | "success"
  | "already_member"
  | "redirecting";

const PLATFORMS = [
  { value: "tiktok", label: "TikTok" },
  { value: "instagram", label: "Instagram" },
  { value: "youtube", label: "YouTube" },
  { value: "twitter", label: "X (Twitter)" },
];

const PLATFORM_LABELS: Record<string, string> = {
  tiktok: "TikTok",
  instagram: "Instagram",
  youtube: "YouTube",
  twitter: "X (Twitter)",
  facebook: "Facebook",
};

function PageShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-background relative flex items-center justify-center p-6">
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute top-[-40%] left-1/2 -translate-x-1/2 w-[800px] h-[800px] rounded-full bg-primary/[0.04] blur-[120px]" />
      </div>
      <div className="relative w-full max-w-[420px]">{children}</div>
    </div>
  );
}

function LogoHeader() {
  return (
    <div className="flex items-center justify-center mb-10">
      <img src={logoImage} alt="DTTracker" className="w-8 h-8 object-contain" />
    </div>
  );
}

export function CommunityJoin() {
  const { token } = useParams<{ token: string }>();
  const {
    data: invite,
    isLoading: inviteLoading,
    error: inviteError,
  } = useCommunityInviteByToken(token);
  const verifyDtMutation = useVerifyDobbleTapUser();
  const joinMutation = useJoinCommunity();

  const [step, setStep] = useState<JoinStep>("choose_path");

  const [dtEmail, setDtEmail] = useState("");
  const [dtResult, setDtResult] = useState<DobbleTapVerifyResult | null>(null);
  const [selectedHandleIdx, setSelectedHandleIdx] = useState(0);

  const [signupForm, setSignupForm] = useState({
    name: "",
    email: "",
    handle: "",
    platform: "tiktok",
    phone: "",
  });

  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const effectiveStep = inviteLoading
    ? "loading"
    : inviteError || !invite?.valid
      ? "invalid"
      : step;

  const handleVerifyDt = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token) return;
    setErrorMessage(null);
    setStep("verify_loading");

    try {
      const result = await verifyDtMutation.mutateAsync({
        inviteToken: token,
        email: dtEmail,
      });

      if (result.found && result.dobble_tap_user_id && result.handles?.length) {
        setDtResult(result);
        setSelectedHandleIdx(0);
        setStep("confirm_handle");
      } else {
        setErrorMessage(
          "No Dobble Tap account found with that email. Try again or sign up as a new user."
        );
        setStep("verify_dt");
      }
    } catch {
      setErrorMessage("Something went wrong. Please try again.");
      setStep("verify_dt");
    }
  };

  const handleConfirmAndJoin = async () => {
    if (!token || !dtResult?.handles) return;
    setErrorMessage(null);

    const chosen = dtResult.handles[selectedHandleIdx];
    setStep("submitting");

    try {
      const joinResult = await joinMutation.mutateAsync({
        invite_token: token,
        path: "existing_dt_user",
        handle: chosen.handle,
        platform: chosen.platform,
        email: dtEmail,
        dobble_tap_user_id: dtResult.dobble_tap_user_id,
      });

      if (joinResult.already_member) {
        setStep("already_member");
      } else if (joinResult.success) {
        setStep("success");
        toast.success("You've joined the community!");
      } else {
        setErrorMessage(joinResult.error || "Failed to join community");
        setStep("confirm_handle");
      }
    } catch {
      setErrorMessage("Something went wrong. Please try again.");
      setStep("confirm_handle");
    }
  };

  const handleSignupJoin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token) return;
    setErrorMessage(null);

    if (!signupForm.email || !signupForm.handle) {
      setErrorMessage("Email and handle are required");
      return;
    }

    setStep("submitting");

    try {
      const result = await joinMutation.mutateAsync({
        invite_token: token,
        path: "new_user",
        handle: signupForm.handle,
        platform: signupForm.platform,
        name: signupForm.name || undefined,
        email: signupForm.email,
        phone: signupForm.phone || undefined,
      });

      if (result.already_member) {
        setStep("already_member");
      } else if (result.success && result.redirect_url) {
        setStep("redirecting");
        toast.success("Redirecting you to create your Dobble Tap account...");
        setTimeout(() => {
          window.location.href = result.redirect_url!;
        }, 1500);
      } else if (result.success) {
        setStep("success");
        toast.success("You've joined the community!");
      } else {
        setErrorMessage(result.error || "Failed to join community");
        setStep("signup_form");
      }
    } catch {
      setErrorMessage("Something went wrong. Please try again.");
      setStep("signup_form");
    }
  };

  // ── Fullscreen states ─────────────────────────────────────────────────────

  if (effectiveStep === "loading") {
    return (
      <PageShell>
        <LogoHeader />
        <div className="text-center py-16">
          <div className="w-10 h-10 border-2 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-sm text-muted-foreground">Loading invite...</p>
        </div>
      </PageShell>
    );
  }

  if (effectiveStep === "invalid") {
    return (
      <PageShell>
        <LogoHeader />
        <Card className="bg-gradient-to-b from-card to-card/80 border-border shadow-[var(--shadow-card)]">
          <CardContent className="p-6 sm:p-8 text-center">
            <div className="w-11 h-11 rounded-full bg-red-500/10 flex items-center justify-center mx-auto mb-4">
              <XCircle className="w-5 h-5 text-red-400" />
            </div>
            <h2 className="text-lg font-semibold text-foreground mb-1.5">
              Invalid Invite Link
            </h2>
            <p className="text-sm text-muted-foreground leading-relaxed">
              {invite?.error || "This invite link is invalid or no longer active."}
            </p>
          </CardContent>
        </Card>
      </PageShell>
    );
  }

  if (effectiveStep === "already_member") {
    return (
      <PageShell>
        <LogoHeader />
        <Card className="bg-gradient-to-b from-card to-card/80 border-border shadow-[var(--shadow-card)]">
          <CardContent className="p-6 sm:p-8 text-center">
            <div className="w-11 h-11 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-4">
              <CheckCircle2 className="w-5 h-5 text-primary" />
            </div>
            <h2 className="text-lg font-semibold text-foreground mb-1.5">
              Already a Member
            </h2>
            <p className="text-sm text-muted-foreground leading-relaxed">
              You're already part of the{" "}
              <span className="text-foreground font-medium">
                {invite?.workspace_name}
              </span>{" "}
              community.
            </p>
          </CardContent>
        </Card>
      </PageShell>
    );
  }

  if (effectiveStep === "success") {
    return (
      <PageShell>
        <LogoHeader />
        <Card className="bg-gradient-to-b from-card to-card/80 border-border shadow-[var(--shadow-card)]">
          <CardContent className="p-6 sm:p-8 text-center">
            <div className="w-11 h-11 rounded-full bg-emerald-500/10 flex items-center justify-center mx-auto mb-4">
              <CheckCircle2 className="w-5 h-5 text-emerald-400" />
            </div>
            <h2 className="text-lg font-semibold text-foreground mb-1.5">
              Welcome to the Community!
            </h2>
            <p className="text-sm text-muted-foreground leading-relaxed">
              You've joined{" "}
              <span className="text-foreground font-medium">
                {invite?.workspace_name}
              </span>
              . You'll receive notifications when new activations are available.
            </p>
          </CardContent>
        </Card>
      </PageShell>
    );
  }

  if (effectiveStep === "redirecting") {
    return (
      <PageShell>
        <LogoHeader />
        <Card className="bg-gradient-to-b from-card to-card/80 border-border shadow-[var(--shadow-card)]">
          <CardContent className="p-6 sm:p-8 text-center">
            <div className="w-10 h-10 border-2 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-4" />
            <h2 className="text-lg font-semibold text-foreground mb-1.5">
              Redirecting to Dobble Tap
            </h2>
            <p className="text-sm text-muted-foreground leading-relaxed">
              Taking you to create your Dobble Tap account...
            </p>
          </CardContent>
        </Card>
      </PageShell>
    );
  }

  // ── Main card ─────────────────────────────────────────────────────────────

  return (
    <PageShell>
      <LogoHeader />

      <div className="mb-7 text-center">
        <h1 className="text-2xl font-semibold text-foreground mb-2">
          Join Community
        </h1>
        <p className="text-sm text-muted-foreground leading-relaxed">
          You've been invited to join{" "}
          <span className="text-foreground font-medium">
            {invite?.workspace_name}
          </span>
        </p>
      </div>

      {/* Choose Path */}
      {effectiveStep === "choose_path" && (
        <div className="space-y-3">
          <button
            onClick={() => {
              setErrorMessage(null);
              setStep("verify_dt");
            }}
            className="group w-full rounded-xl border border-border bg-gradient-to-b from-card to-card/80 p-4 text-left flex items-center gap-4 transition-all duration-200 hover:border-border/80 hover:shadow-[var(--shadow-card-hover)] active:scale-[0.98]"
          >
            <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center flex-shrink-0">
              <UserCheck className="w-[18px] h-[18px] text-foreground" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-sm font-medium text-foreground">
                I have a Dobble Tap account
              </div>
              <div className="text-xs text-muted-foreground mt-0.5">
                Verify with your email and join instantly
              </div>
            </div>
            <ArrowRight className="w-4 h-4 text-muted-foreground group-hover:text-foreground transition-colors flex-shrink-0" />
          </button>

          <button
            onClick={() => {
              setErrorMessage(null);
              setDtResult(null); // clear any Path A result so submitting shows the correct form
              setStep("signup_form");
            }}
            className="group w-full rounded-xl border border-border bg-gradient-to-b from-card to-card/80 p-4 text-left flex items-center gap-4 transition-all duration-200 hover:border-border/80 hover:shadow-[var(--shadow-card-hover)] active:scale-[0.98]"
          >
            <div className="w-10 h-10 rounded-full bg-emerald-500/10 flex items-center justify-center flex-shrink-0">
              <UserPlus className="w-[18px] h-[18px] text-emerald-400" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-sm font-medium text-foreground">
                I'm new to Dobble Tap
              </div>
              <div className="text-xs text-muted-foreground mt-0.5">
                Join the community and create an account
              </div>
            </div>
            <ArrowRight className="w-4 h-4 text-muted-foreground group-hover:text-foreground transition-colors flex-shrink-0" />
          </button>

          <p className="text-[11px] text-muted-foreground/60 text-center pt-2">
            By joining you agree to receive activation notifications
          </p>
        </div>
      )}

      {/* Path A — Step 1: Email lookup */}
      {(effectiveStep === "verify_dt" || effectiveStep === "verify_loading") && (
        <Card className="bg-gradient-to-b from-card to-card/80 border-border shadow-[var(--shadow-card)]">
          <CardContent className="p-5 sm:p-6">
            <form onSubmit={handleVerifyDt} className="space-y-4">
              <button
                type="button"
                onClick={() => {
                  setStep("choose_path");
                  setErrorMessage(null);
                }}
                className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors mb-1"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                Back
              </button>

              <p className="text-sm text-muted-foreground leading-relaxed">
                Enter the email linked to your Dobble Tap account.
              </p>

              <div>
                <label className="block text-sm text-muted-foreground mb-2">
                  Email
                </label>
                <Input
                  type="email"
                  placeholder="your@email.com"
                  value={dtEmail}
                  onChange={(e) => setDtEmail(e.target.value)}
                  required
                  className="h-10 bg-muted/40 border-border text-foreground placeholder:text-muted-foreground focus:bg-muted/60 focus:border-border/80"
                />
              </div>

              {errorMessage && (
                <div className="space-y-2 animate-in fade-in slide-in-from-top-1 duration-200">
                  <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/20">
                    <p className="text-sm text-red-400">{errorMessage}</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setErrorMessage(null);
                      setDtResult(null);
                      setStep("signup_form");
                    }}
                    className="w-full text-xs text-muted-foreground hover:text-foreground transition-colors text-center py-1"
                  >
                    Don't have a Dobble Tap account?{" "}
                    <span className="underline underline-offset-2">Sign up instead</span>
                  </button>
                </div>
              )}

              <Button
                type="submit"
                disabled={effectiveStep === "verify_loading"}
                className="w-full h-10 bg-primary text-primary-foreground hover:bg-primary/90 font-medium transition-all"
              >
                {effectiveStep === "verify_loading" ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Looking up account...
                  </>
                ) : (
                  <>
                    Find My Account
                    <ArrowRight className="w-4 h-4 ml-2" />
                  </>
                )}
              </Button>
            </form>
          </CardContent>
        </Card>
      )}

      {/* Path A — Step 2: Confirm handle */}
      {(effectiveStep === "confirm_handle" ||
        (effectiveStep === "submitting" && dtResult !== null)) && (
        <Card className="bg-gradient-to-b from-card to-card/80 border-border shadow-[var(--shadow-card)]">
          <CardContent className="p-5 sm:p-6">
            <div className="space-y-4">
              <button
                type="button"
                onClick={() => {
                  setStep("verify_dt");
                  setErrorMessage(null);
                }}
                className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors mb-1"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                Back
              </button>

              <div className="p-3.5 bg-emerald-500/10 border border-emerald-500/20 rounded-lg text-center">
                <CheckCircle2 className="w-5 h-5 text-emerald-400 mx-auto mb-1" />
                <p className="font-medium text-foreground text-sm">Account Found</p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {dtEmail} · select the handle to join with
                </p>
              </div>

              <div className="space-y-2">
                {dtResult?.handles?.map((h, idx) => {
                  const displayHandle = h.handle.startsWith("@")
                    ? h.handle
                    : `@${h.handle}`;
                  const platformLabel =
                    PLATFORM_LABELS[h.platform] || h.platform;
                  const isSelected = selectedHandleIdx === idx;

                  return (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => setSelectedHandleIdx(idx)}
                      className={`w-full p-3 rounded-lg border text-left flex items-center justify-between transition-all duration-150 ${
                        isSelected
                          ? "border-primary bg-primary/[0.06] ring-1 ring-primary/20"
                          : "border-border bg-muted/30 hover:bg-muted/50"
                      }`}
                    >
                      <div>
                        <span className="font-medium text-sm text-foreground">
                          {displayHandle}
                        </span>
                        <span className="text-xs text-muted-foreground ml-2">
                          {platformLabel}
                        </span>
                      </div>
                      {isSelected && (
                        <CheckCircle2 className="w-4 h-4 text-primary flex-shrink-0" />
                      )}
                    </button>
                  );
                })}
              </div>

              {errorMessage && (
                <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/20 animate-in fade-in slide-in-from-top-1 duration-200">
                  <p className="text-sm text-red-400">{errorMessage}</p>
                </div>
              )}

              <button
                type="button"
                onClick={() => {
                  setDtResult(null);
                  setErrorMessage(null);
                  setStep("verify_dt");
                }}
                className="w-full text-xs text-muted-foreground hover:text-foreground transition-colors text-center py-0.5"
              >
                <span className="underline underline-offset-2">Try a different email</span>
              </button>

              <Button
                onClick={handleConfirmAndJoin}
                disabled={effectiveStep === "submitting"}
                className="w-full h-10 bg-primary text-primary-foreground hover:bg-primary/90 font-medium transition-all"
              >
                {effectiveStep === "submitting" ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Joining...
                  </>
                ) : (
                  <>
                    Join Community
                    <ArrowRight className="w-4 h-4 ml-2" />
                  </>
                )}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Path B: New User Signup Form */}
      {(effectiveStep === "signup_form" ||
        (effectiveStep === "submitting" && dtResult === null)) && (
        <Card className="bg-gradient-to-b from-card to-card/80 border-border shadow-[var(--shadow-card)]">
          <CardContent className="p-5 sm:p-6">
            <form onSubmit={handleSignupJoin} className="space-y-4">
              <button
                type="button"
                onClick={() => {
                  setStep("choose_path");
                  setErrorMessage(null);
                }}
                className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors mb-1"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                Back
              </button>

              <div>
                <label className="block text-sm text-muted-foreground mb-2">
                  Name <span className="text-muted-foreground/50">(optional)</span>
                </label>
                <Input
                  type="text"
                  placeholder="Your name"
                  value={signupForm.name}
                  onChange={(e) =>
                    setSignupForm({ ...signupForm, name: e.target.value })
                  }
                  className="h-10 bg-muted/40 border-border text-foreground placeholder:text-muted-foreground focus:bg-muted/60 focus:border-border/80"
                />
              </div>

              <div>
                <label className="block text-sm text-muted-foreground mb-2">
                  Email
                </label>
                <Input
                  type="email"
                  placeholder="your@email.com"
                  value={signupForm.email}
                  onChange={(e) =>
                    setSignupForm({ ...signupForm, email: e.target.value })
                  }
                  required
                  className="h-10 bg-muted/40 border-border text-foreground placeholder:text-muted-foreground focus:bg-muted/60 focus:border-border/80"
                />
              </div>

              <div>
                <label className="block text-sm text-muted-foreground mb-2">
                  Handle
                </label>
                <Input
                  type="text"
                  placeholder="@username"
                  value={signupForm.handle}
                  onChange={(e) =>
                    setSignupForm({ ...signupForm, handle: e.target.value })
                  }
                  required
                  className="h-10 bg-muted/40 border-border text-foreground placeholder:text-muted-foreground focus:bg-muted/60 focus:border-border/80"
                />
              </div>

              <div>
                <label className="block text-sm text-muted-foreground mb-2">
                  Platform
                </label>
                <select
                  value={signupForm.platform}
                  onChange={(e) =>
                    setSignupForm({ ...signupForm, platform: e.target.value })
                  }
                  className="w-full h-10 rounded-md border border-border bg-muted/40 px-3 text-foreground text-sm focus:bg-muted/60 focus:border-border/80 transition-colors"
                >
                  {PLATFORMS.map((p) => (
                    <option key={p.value} value={p.value}>
                      {p.label}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm text-muted-foreground mb-2">
                  Phone <span className="text-muted-foreground/50">(optional)</span>
                </label>
                <Input
                  type="tel"
                  placeholder="+1234567890"
                  value={signupForm.phone}
                  onChange={(e) =>
                    setSignupForm({ ...signupForm, phone: e.target.value })
                  }
                  className="h-10 bg-muted/40 border-border text-foreground placeholder:text-muted-foreground focus:bg-muted/60 focus:border-border/80"
                />
              </div>

              {errorMessage && (
                <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/20 animate-in fade-in slide-in-from-top-1 duration-200">
                  <p className="text-sm text-red-400">{errorMessage}</p>
                </div>
              )}

              <Button
                type="submit"
                disabled={effectiveStep === "submitting"}
                className="w-full h-10 bg-primary text-primary-foreground hover:bg-primary/90 font-medium transition-all"
              >
                {effectiveStep === "submitting" ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Joining...
                  </>
                ) : (
                  <>
                    Join & Create Account
                    <ArrowRight className="w-4 h-4 ml-2" />
                  </>
                )}
              </Button>
            </form>
          </CardContent>
        </Card>
      )}
    </PageShell>
  );
}
