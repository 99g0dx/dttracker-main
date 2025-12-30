import React, { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Card, CardContent } from "./ui/card";
import { Button } from "./ui/button";
import { useTeamInviteByToken, useAcceptTeamInvite } from "../../hooks/useTeam";
import { useAuth } from "../../contexts/AuthContext";
import { toast } from "sonner";
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
  const [isProcessing, setIsProcessing] = useState(false);

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
      // Navigate to team page after acceptance
      setTimeout(() => {
        navigate("/team");
      }, 1500);
    } catch (error) {
      setIsProcessing(false);
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

          {/* Action Buttons */}
          {!user ? (
            <div className="space-y-3">
              <Button
                onClick={() => navigate("/signup")}
                className="w-full h-11 bg-primary hover:bg-primary/90 text-black font-medium"
              >
                Sign Up to Accept
                <ArrowRight className="w-4 h-4 ml-2" />
              </Button>
              <Button
                onClick={() => navigate("/login")}
                variant="outline"
                className="w-full h-11 bg-white/[0.04] hover:bg-white/[0.08] border-white/[0.1] text-white"
              >
                Sign In to Accept
              </Button>
            </div>
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
