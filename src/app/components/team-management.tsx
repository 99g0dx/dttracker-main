import React, { useState, useEffect, useMemo } from "react";
import { Card, CardContent } from "./ui/card";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import {
  Users,
  Plus,
  Mail,
  Crown,
  Shield,
  Eye,
  X,
  MoreVertical,
  Trash2,
  UserPlus,
  Clock,
  UsersRound,
  ArrowLeft,
  Loader2,
} from "lucide-react";
import { toast } from "sonner";
import { supabase } from "../../lib/supabase";
import { ResponsiveConfirmDialog } from "./ui/responsive-confirm-dialog";
import {
  getTeamMembers,
  getTeamInvites,
  createTeamInvite,
  deleteTeamMember,
  updateTeamMemberAccess,
  revokeTeamInvite,
  type TeamMemberWithScopes,
  type TeamInviteWithInviter,
} from "../../lib/api/team";
import type { TeamRole, ScopeType } from "../../lib/types/database";
import { BulkInviteModal } from "./bulk-invite-modal";
import { useWorkspace } from "../../contexts/WorkspaceContext";
import { useBillingSummary } from "../../hooks/useBilling";
import { UpgradeModal } from "./upgrade-modal";
import { getEffectiveLimits, hasAgencyBypass } from "../../lib/entitlements";
import { isWorkspaceOwner, normalizeWorkspaceRole } from "../../lib/roles";

// Keep InviteData type for the modal
export type InviteData = {
  rolePreset: "agency_admin" | "brand_member" | "agency_ops";
  email: string;
  message?: string;
};

interface TeamManagementProps {
  onNavigate: (path: string) => void;
}

type RolePreset = InviteData["rolePreset"];

// Helper function to map rolePreset to TeamRole and scopes
function mapRolePresetToRoleAndScopes(rolePreset: RolePreset): {
  role: TeamRole;
  scopes: Array<{ scope_type: ScopeType; scope_value: string }>;
} {
  const scopes: Array<{ scope_type: ScopeType; scope_value: string }> = [];
  const role: TeamRole = rolePreset;
  scopes.push({ scope_type: "workspace", scope_value: "editor" });

  return { role, scopes };
}

const getRolePresetFromMember = (member: TeamMemberWithScopes): RolePreset => {
  const normalizedRole = normalizeWorkspaceRole(member.role);
  if (normalizedRole === "agency_admin") return "agency_admin";
  if (normalizedRole === "brand_owner") return "agency_admin";
  if (normalizedRole === "brand_member") return "brand_member";
  if (normalizedRole === "agency_ops") return "agency_ops";
  const scopes = member.scopes || [];
  const workspaceScope = scopes.find(
    (scope) => scope.scope_type === "workspace"
  );
  if (workspaceScope?.scope_value === "editor") return "brand_member";
  return "agency_ops";
};

export function TeamManagement({ onNavigate }: TeamManagementProps) {
  const { activeWorkspaceId } = useWorkspace();
  const [members, setMembers] = useState<TeamMemberWithScopes[]>([]);
  const [pendingInvites, setPendingInvites] = useState<TeamInviteWithInviter[]>(
    []
  );
  const [currentUser, setCurrentUser] = useState<{
    id: string;
    email?: string;
  } | null>(null);
  const [loading, setLoading] = useState(true);
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [selectedMember, setSelectedMember] = useState<string | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState<string | null>(
    null
  );
  const [showBulkInviteModal, setShowBulkInviteModal] = useState(false);
  const [roleUpdatingId, setRoleUpdatingId] = useState<string | null>(null);
  const [revokingInviteId, setRevokingInviteId] = useState<string | null>(null);
  const [deletingMemberId, setDeletingMemberId] = useState<string | null>(null);
  const [pendingRoleChange, setPendingRoleChange] = useState<{
    memberId: string;
    memberName: string;
    rolePreset: RolePreset;
  } | null>(null);
  const { data: billing, isLoading: billingLoading } = useBillingSummary();
  const canAccessTeam = useMemo(
    () =>
      hasAgencyBypass(billing) ||
      billing?.plan?.tier === "pro" ||
      billing?.plan?.tier === "agency",
    [billing]
  );
  const activeMembers = useMemo(
    () => members.filter((m) => m.status === "active"),
    [members]
  );
  const adminCount = useMemo(
    () => members.filter((m) => isWorkspaceOwner(m.role)).length,
    [members]
  );
  const agencyBypass = useMemo(() => hasAgencyBypass(billing), [billing]);
  const seatLimit = useMemo(
    () => (agencyBypass ? -1 : getEffectiveLimits(billing).team_members),
    [agencyBypass, billing]
  );

  useEffect(() => {
    loadCurrentUser();
    loadMembers();
  }, [activeWorkspaceId]);

  const loadCurrentUser = async () => {
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (user) {
        setCurrentUser({ id: user.id, email: user.email });
      }
    } catch (error) {
      console.error("Error loading current user:", error);
    }
  };

  const loadMembers = async () => {
    setLoading(true);
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return;

      const [membersResult, invitesResult] = await Promise.all([
        getTeamMembers(activeWorkspaceId || undefined),
        getTeamInvites(activeWorkspaceId || undefined),
      ]);

      if (membersResult.data) {
        const memberUserIds = Array.from(
          new Set(
            membersResult.data.map((member) => member.user_id).filter(Boolean)
          )
        );
        let profileMap: Record<
          string,
          { full_name: string | null; email: string | null }
        > = {};
        if (memberUserIds.length) {
          const { data: profiles } = await supabase
            .from("profiles")
            .select("id, full_name, email")
            .in("id", memberUserIds);
          profileMap = (profiles || []).reduce((acc: any, profile: any) => {
            acc[profile.id] = {
              full_name: profile.full_name || null,
              email: profile.email || null,
            };
            return acc;
          }, {});
        }

        const membersWithProfiles = membersResult.data.map((member) => {
          const profile = profileMap[member.user_id] || {
            full_name: null,
            email: null,
          };
          return {
            ...member,
            profile_name: profile.full_name,
            profile_email: profile.email,
          };
        });
        setMembers(membersWithProfiles as any);
      }
      if (invitesResult.data) {
        setPendingInvites(invitesResult.data);
      }
    } catch (error) {
      console.error("Error loading team members:", error);
    } finally {
      setLoading(false);
    }
  };

  const refreshInvites = async () => {
    try {
      const invitesResult = await getTeamInvites(
        activeWorkspaceId || undefined
      );
      if (invitesResult.data) {
        setPendingInvites(invitesResult.data);
      }
    } catch (error) {
      console.error("Error refreshing invites:", error);
    }
  };

  const currentUserMember = useMemo(
    () => members.find((member) => member.user_id === currentUser?.id),
    [members, currentUser?.id]
  );
  const canManage = useMemo(
    () => isWorkspaceOwner(currentUserMember?.role),
    [currentUserMember?.role]
  );
  const seatsUsed = useMemo(
    () => billing?.seats_used ?? activeMembers.length,
    [billing?.seats_used, activeMembers.length]
  );
  const projectedSeats = useMemo(
    () => seatsUsed + pendingInvites.length,
    [seatsUsed, pendingInvites.length]
  );
  const seatLimitReached = useMemo(
    () => seatLimit !== -1 && projectedSeats >= seatLimit,
    [seatLimit, projectedSeats]
  );

  const handleInviteComplete = async (invite?: TeamInviteWithInviter) => {
    if (invite) {
      setPendingInvites((prev) => [invite, ...prev]);
    } else {
      await refreshInvites();
    }
    setShowInviteModal(false);
  };

  const handleDeleteMember = async (memberId: string) => {
    setDeletingMemberId(memberId);
    const member = members.find((item) => item.id === memberId);
    const memberEmail = (member as any)?.profile_email || null;
    const result = await deleteTeamMember(memberId);
    if (!result.error) {
      setMembers((prev) => prev.filter((member) => member.id !== memberId));
      if (memberEmail) {
        setPendingInvites((prev) =>
          prev.filter((invite) => invite.email !== memberEmail)
        );
      }
    }
    setDeletingMemberId(null);
    setShowDeleteConfirm(null);
  };

  const handleUpdateMemberRole = async (
    memberId: string,
    rolePreset: RolePreset
  ) => {
    setRoleUpdatingId(memberId);
    const { role, scopes } = mapRolePresetToRoleAndScopes(rolePreset);
    const result = await updateTeamMemberAccess(memberId, role, scopes);
    if (!result.error) {
      setMembers((prev) =>
        prev.map((member) =>
          member.id === memberId
            ? {
                ...member,
                role,
                scopes,
              }
            : member
        )
      );
    }
    setRoleUpdatingId(null);
  };

  const handleRevokeInvite = async (inviteId: string) => {
    setRevokingInviteId(inviteId);
    const result = await revokeTeamInvite(inviteId);
    if (!result.error) {
      setPendingInvites((prev) =>
        prev.filter((invite) => invite.id !== inviteId)
      );
    }
    setRevokingInviteId(null);
  };

  const getRoleBadge = (
    role: string,
    scopes?: TeamMemberWithScopes["scopes"]
  ) => {
    const normalizedRole = normalizeWorkspaceRole(role as TeamRole);
    const badges = {
      brand_owner: {
        icon: <Crown className="w-3 h-3" />,
        label: "Owner",
        color: "text-amber-400 bg-amber-400/10 border-amber-400/20",
      },
      agency_admin: {
        icon: <Shield className="w-3 h-3" />,
        label: "Operator",
        color: "text-purple-400 bg-purple-400/10 border-purple-400/20",
      },
      agency_ops: {
        icon: <Eye className="w-3 h-3" />,
        label: "Operator",
        color: "text-slate-300 bg-slate-300/10 border-slate-300/20",
      },
      brand_member: {
        icon: <Users className="w-3 h-3" />,
        label: "Operator",
        color: "text-primary bg-primary/10 border-primary/20",
      },
    };
    return (
      badges[(normalizedRole || "agency_ops") as keyof typeof badges] ||
      badges.agency_ops
    );
  };

  const getScopesSummary = (member: TeamMemberWithScopes) => {
    const normalizedRole = normalizeWorkspaceRole(member.role);
    if (normalizedRole === "brand_owner")
      return "Full control (billing, invites, campaigns)";
    return "Campaign operator access";
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-center py-12">
          <p className="text-slate-400">Loading team members...</p>
        </div>
      </div>
    );
  }

  if (!billingLoading && billing != null && !canAccessTeam) {
    return (
      <div className="space-y-6">
        <Card className="border-white/[0.08] bg-white/[0.02]">
          <CardContent className="pt-6">
            <div className="flex flex-col items-center justify-center py-12 px-4 text-center">
              <Shield className="w-12 h-12 text-slate-500 mb-4" />
              <h2 className="text-xl font-semibold text-white">
                Team is available on Pro and Agency plans
              </h2>
              <p className="mt-2 text-sm text-slate-400 max-w-md">
                Upgrade your plan to invite teammates, manage roles, and
                collaborate on campaigns.
              </p>
              <Button
                onClick={() => onNavigate("/subscription")}
                className="mt-6"
              >
                View plans
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3 sm:gap-4">
          <button
            onClick={() => onNavigate("/")}
            className="w-9 h-9 flex-shrink-0 rounded-md bg-white/[0.03] hover:bg-white/[0.06] border border-white/[0.08] flex items-center justify-center transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>
          <div className="flex-1 min-w-0">
            <h1 className="text-xl sm:text-2xl font-semibold tracking-tight text-white">
              Team
            </h1>
            <p className="text-xs sm:text-sm text-slate-400 mt-1">
              Manage workspace access and permissions
            </p>
          </div>
        </div>
        {canManage && (
          <div className="flex flex-wrap gap-2 sm:gap-3 w-full sm:w-auto">
            <Button
              onClick={() => setShowBulkInviteModal(true)}
              variant="outline"
              disabled={
                showBulkInviteModal || showInviteModal || seatLimitReached
              }
              className="h-9 px-4 flex-1 sm:flex-none bg-white/[0.04] hover:bg-white/[0.08] border-white/[0.1] text-slate-300 hover:text-white disabled:opacity-60 disabled:cursor-not-allowed"
              title={seatLimitReached ? "Seat limit reached" : undefined}
            >
              {showBulkInviteModal ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <UsersRound className="w-4 h-4 mr-2" />
              )}
              {showBulkInviteModal ? "Opening..." : "Bulk Invite"}
            </Button>
            <Button
              onClick={() => setShowInviteModal(true)}
              disabled={
                showInviteModal || showBulkInviteModal || seatLimitReached
              }
              className="h-9 px-4 flex-1 sm:flex-none bg-primary hover:bg-primary/90 text-[rgb(0,0,0)] disabled:opacity-60 disabled:cursor-not-allowed"
              title={seatLimitReached ? "Seat limit reached" : undefined}
            >
              {showInviteModal ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <UserPlus className="w-4 h-4 mr-2" />
              )}
              {showInviteModal ? "Opening..." : "Invite Member"}
            </Button>
          </div>
        )}
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card className="bg-[#0D0D0D] border-white/[0.08]">
          <CardContent className="p-4">
            <div className="text-2xl font-semibold text-white">
              {activeMembers.length}
            </div>
            <p className="text-sm text-slate-400 mt-1">Active Members</p>
          </CardContent>
        </Card>
        <Card className="bg-[#0D0D0D] border-white/[0.08]">
          <CardContent className="p-4">
            <div className="text-2xl font-semibold text-amber-400">
              {pendingInvites.length}
            </div>
            <p className="text-sm text-slate-400 mt-1">Pending Invites</p>
          </CardContent>
        </Card>
        <Card className="bg-[#0D0D0D] border-white/[0.08]">
          <CardContent className="p-4">
            <div className="text-2xl font-semibold text-primary">
              {adminCount}
            </div>
            <p className="text-sm text-slate-400 mt-1">Admins</p>
          </CardContent>
        </Card>
      </div>
      {seatLimitReached && (
        <div className="rounded-lg border border-amber-400/20 bg-amber-500/10 px-4 py-3 text-sm text-amber-300">
          {seatLimit === -1
            ? "Unlimited seats are enabled for this workspace."
            : `Seat limit reached (${projectedSeats}/${seatLimit}). Upgrade to invite more teammates.`}
        </div>
      )}

      {/* Active Members */}
      <Card className="bg-[#0D0D0D] border-white/[0.08]">
        <CardContent className="p-0">
          <div className="p-6 border-b border-white/[0.06]">
            <h3 className="font-medium text-white">Active Members</h3>
            <p className="text-sm text-slate-500 mt-1">
              {activeMembers.length} member
              {activeMembers.length !== 1 ? "s" : ""} with active access
            </p>
          </div>

          <div className="divide-y divide-white/[0.04]">
            {activeMembers.map((member) => {
              const badge = getRoleBadge(member.role, member.scopes);
              const scopesSummary = getScopesSummary(member);
              // Get name from profile or use user_id
              const memberName = (member as any).profile_name || "User";
              const memberEmail =
                (member as any).profile_email ||
                (member.user_id === currentUser?.id
                  ? currentUser?.email
                  : null) ||
                "Email unavailable";
              const memberInitial = memberName.charAt(0).toUpperCase();
              const isCurrentUser = member.user_id === currentUser?.id;
              const secondaryLine = isWorkspaceOwner(member.role)
                ? member.user_id
                : memberEmail;
              const rolePreset = getRolePresetFromMember(member);

              return (
                <div
                  key={member.id || member.user_id}
                  className="p-4 hover:bg-white/[0.02] transition-colors"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex items-start gap-3 flex-1">
                      <div className="w-10 h-10 rounded-full bg-gradient-to-br from-primary to-cyan-400 flex items-center justify-center text-white font-semibold flex-shrink-0">
                        {memberInitial}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <h4 className="font-medium text-white">
                            {memberName}
                          </h4>
                          {isCurrentUser && (
                            <span className="text-xs px-2 py-0.5 bg-primary/10 text-primary rounded border border-primary/20">
                              You
                            </span>
                          )}
                        </div>
                        <p className="text-sm text-slate-400 mb-2">
                          {secondaryLine}
                        </p>
                        <div className="flex items-center gap-3 text-xs text-slate-500">
                          <span
                            className={`inline-flex items-center gap-1.5 px-2 py-1 rounded border ${badge.color}`}
                          >
                            {badge.icon}
                            {badge.label}
                          </span>
                          <span>{scopesSummary}</span>
                        </div>
                      </div>
                    </div>

                    {canManage &&
                      !isCurrentUser &&
                      !isWorkspaceOwner(member.role) && (
                        <div className="flex items-center gap-1">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              const rolePreset =
                                getRolePresetFromMember(member);
                              setPendingRoleChange({
                                memberId: member.id,
                                memberName,
                                rolePreset,
                              });
                            }}
                            className="w-8 h-8 rounded-md hover:bg-white/[0.06] flex items-center justify-center transition-colors disabled:opacity-60"
                            disabled={roleUpdatingId === member.id}
                            title={
                              roleUpdatingId === member.id
                                ? "Updating role"
                                : "Change role"
                            }
                          >
                            {roleUpdatingId === member.id ? (
                              <Loader2 className="w-4 h-4 text-slate-400 animate-spin" />
                            ) : (
                              <MoreVertical className="w-4 h-4 text-slate-400" />
                            )}
                          </button>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              if (member.id) {
                                setShowDeleteConfirm(member.id);
                              }
                            }}
                            disabled={
                              !member.id || deletingMemberId === member.id
                            }
                            className="w-8 h-8 rounded-md hover:bg-red-500/10 flex items-center justify-center transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                            title={
                              !member.id
                                ? "Unable to remove this member"
                                : deletingMemberId === member.id
                                  ? "Removing..."
                                  : "Remove member"
                            }
                          >
                            {deletingMemberId === member.id ? (
                              <Loader2 className="w-4 h-4 text-red-400 animate-spin" />
                            ) : (
                              <Trash2 className="w-4 h-4 text-slate-400 hover:text-red-400" />
                            )}
                          </button>
                        </div>
                      )}
                  </div>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Pending Invites */}
      {pendingInvites.length > 0 && (
        <Card className="bg-[#0D0D0D] border-white/[0.08]">
          <CardContent className="p-0">
            <div className="p-6 border-b border-white/[0.06]">
              <h3 className="font-medium text-white">Pending Invites</h3>
              <p className="text-sm text-slate-500 mt-1">
                {pendingInvites.length} invitation
                {pendingInvites.length !== 1 ? "s" : ""} awaiting acceptance
              </p>
            </div>

            <div className="divide-y divide-white/[0.04]">
              {pendingInvites.map((invite) => {
                const badge = getRoleBadge(invite.role);

                return (
                  <div
                    key={invite.id}
                    className="p-4 hover:bg-white/[0.02] transition-colors"
                  >
                    <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
                      <div className="flex items-start gap-3 flex-1">
                        <div className="w-10 h-10 rounded-full bg-slate-800 flex items-center justify-center flex-shrink-0">
                          <Mail className="w-5 h-5 text-slate-500" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <h4 className="font-medium text-white">
                              {invite.email}
                            </h4>
                            <span className="inline-flex items-center gap-1.5 px-2 py-0.5 bg-amber-400/10 text-amber-400 text-xs rounded border border-amber-400/20">
                              <Clock className="w-3 h-3" />
                              Pending
                            </span>
                          </div>
                          {invite.inviter_name && (
                            <p className="text-sm text-slate-500 mb-2">
                              Invited by {invite.inviter_name}
                            </p>
                          )}
                          <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
                            <span
                              className={`inline-flex items-center gap-1.5 px-2 py-1 rounded border ${badge.color}`}
                            >
                              {badge.icon}
                              {badge.label}
                            </span>
                            {canManage && (
                              <button
                                onClick={() => handleRevokeInvite(invite.id)}
                                className="w-8 h-8 rounded-md hover:bg-red-500/10 flex items-center justify-center transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
                                title="Revoke invitation"
                                disabled={revokingInviteId === invite.id}
                              >
                                {revokingInviteId === invite.id ? (
                                  <Loader2 className="w-4 h-4 text-red-400 animate-spin" />
                                ) : (
                                  <X className="w-4 h-4 text-red-400" />
                                )}
                              </button>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Invite Modal */}
      {showInviteModal && (
        <InviteModal
          onClose={() => setShowInviteModal(false)}
          onComplete={handleInviteComplete}
          workspaceId={activeWorkspaceId || undefined}
        />
      )}

      {/* Delete Confirmation */}
      <ResponsiveConfirmDialog
        open={Boolean(showDeleteConfirm)}
        onOpenChange={(open) => {
          if (!open) setShowDeleteConfirm(null);
        }}
        title="Remove team member?"
        description="This member will lose access immediately. This action cannot be undone."
        confirmLabel={deletingMemberId ? "Removing..." : "Remove member"}
        confirmLoading={Boolean(deletingMemberId)}
        confirmDisabled={Boolean(deletingMemberId)}
        onConfirm={() =>
          showDeleteConfirm && handleDeleteMember(showDeleteConfirm)
        }
      />

      <ResponsiveConfirmDialog
        open={Boolean(pendingRoleChange)}
        onOpenChange={(open) => {
          if (!open) setPendingRoleChange(null);
        }}
        title="Update member role?"
        description={
          pendingRoleChange ? (
            <div className="space-y-4">
              <div className="text-sm text-slate-400">
                Update access for{" "}
                <span className="text-white">
                  {pendingRoleChange.memberName}
                </span>
                .
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2">
                  Access Level
                </label>
                <select
                  value={pendingRoleChange.rolePreset}
                  onChange={(e) => {
                    const nextPreset = e.target.value as RolePreset;
                    setPendingRoleChange((prev) =>
                      prev
                        ? {
                            ...prev,
                            rolePreset: nextPreset,
                          }
                        : prev
                    );
                  }}
                  className="w-full h-10 px-3 rounded-md bg-white/[0.04] border border-white/[0.1] text-sm text-white focus:bg-white/[0.06] focus:border-white/[0.2] transition-colors [&>option]:bg-[#0D0D0D] [&>option]:text-white [&>optgroup]:bg-[#0D0D0D] [&>optgroup]:text-slate-400 [&>optgroup]:font-semibold"
                >
                  <optgroup label="Team Role">
                    <option value="agency_admin">Admin</option>
                    <option value="brand_member">Member</option>
                    <option value="agency_ops">Ops</option>
                  </optgroup>
                </select>
              </div>
            </div>
          ) : (
            "Confirm role change."
          )
        }
        confirmLabel="Update role"
        confirmVariant="default"
        confirmLoading={
          Boolean(pendingRoleChange) &&
          roleUpdatingId === pendingRoleChange?.memberId
        }
        confirmDisabled={Boolean(roleUpdatingId)}
        onConfirm={() => {
          if (!pendingRoleChange) return;
          handleUpdateMemberRole(
            pendingRoleChange.memberId,
            pendingRoleChange.rolePreset
          );
          setPendingRoleChange(null);
        }}
      />

      {/* Bulk Invite Modal */}
      {showBulkInviteModal && (
        <BulkInviteModal
          onClose={() => setShowBulkInviteModal(false)}
          onComplete={() => {
            refreshInvites();
            setShowBulkInviteModal(false);
          }}
        />
      )}
    </div>
  );
}

// Invite Modal Component
function InviteModal({
  onClose,
  onComplete,
  workspaceId,
}: {
  onClose: () => void;
  onComplete: (invite?: TeamInviteWithInviter) => void;
  workspaceId?: string;
}) {
  const [email, setEmail] = useState("");
  const [rolePreset, setRolePreset] =
    useState<InviteData["rolePreset"]>("brand_member");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [upgradeOpen, setUpgradeOpen] = useState(false);

  const { data: billing } = useBillingSummary();
  const agencyBypass = hasAgencyBypass(billing);
  const seatLimit = agencyBypass
    ? -1
    : getEffectiveLimits(billing).team_members;

  const handleSubmit = async () => {
    if (!email) {
      setError("Please enter an email");
      return;
    }

    setError(null);
    setLoading(true);

    if (
      !agencyBypass &&
      seatLimit !== -1 &&
      (billing?.seats_used ?? 0) >= seatLimit
    ) {
      setUpgradeOpen(true);
      setLoading(false);
      return;
    }

    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) {
        setError("You must be logged in to send invites");
        setLoading(false);
        return;
      }

      const { role, scopes } = mapRolePresetToRoleAndScopes(rolePreset);

      const result = await createTeamInvite(
        workspaceId,
        email,
        role,
        scopes,
        message || null
      );

      if (result.error) {
        setError(result.error.message || "Failed to create invite");
        setLoading(false);
        return;
      }

      // Check if email failed (invite was created but email wasn't sent)
      const emailError = (result as any).emailError;
      if (emailError) {
        const inviteToken = (result.data as any)?.token;
        const inviteLink = inviteToken
          ? `${window.location.origin}/team/invite/${inviteToken}`
          : null;
        if (inviteLink && navigator.clipboard) {
          try {
            await navigator.clipboard.writeText(inviteLink);
          } catch {
            // Clipboard failure shouldn't block the user flow.
          }
        }
        setError(
          `Invite created, but email failed to send. ` +
            `${inviteLink ? "The invite link was copied to your clipboard." : "You can still resend or share the invite from the Pending Invites list."} ` +
            `Reason: ${emailError.message}`
        );
        setLoading(false);
        // Don't close modal so user can see the error
        return;
      }

      // Success - close modal and reload
      if (result.data) {
        onComplete(result.data as TeamInviteWithInviter);
      } else {
        onComplete();
      }
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "An unexpected error occurred"
      );
      setLoading(false);
    }
  };

  return (
    <div
      className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4"
      onClick={onClose}
    >
      <UpgradeModal
        open={upgradeOpen}
        title="Add More Seats"
        message="You've reached your team seat limit. Upgrade to invite more teammates."
        onClose={() => setUpgradeOpen(false)}
        onUpgrade={() => (window.location.href = "/subscription")}
      />
      <Card
        className="bg-[#0D0D0D] border-white/[0.08] max-w-2xl w-full max-h-[90vh] overflow-y-auto shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <CardContent className="p-0">
          <div className="sticky top-0 bg-[#0D0D0D]/95 backdrop-blur-xl border-b border-white/[0.08] px-8 py-6 z-10">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-xl font-semibold text-white tracking-tight">
                  Invite Team Member
                </h2>
                <p className="text-sm text-slate-500 mt-1.5">
                  Add someone to your workspace (all roles have full access)
                </p>
              </div>
              <button
                onClick={onClose}
                className="w-9 h-9 rounded-lg hover:bg-white/[0.08] flex items-center justify-center transition-all duration-200"
              >
                <X className="w-4.5 h-4.5 text-slate-400" />
              </button>
            </div>
          </div>

          <div className="px-8 py-8 space-y-7">
            {error && (
              <div className="p-4 bg-red-500/10 border border-red-500/20 rounded-lg">
                <p className="text-sm text-red-400">{error}</p>
              </div>
            )}
            <div>
              <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-3">
                Email <span className="text-red-400">*</span>
              </label>
              <Input
                type="email"
                placeholder="colleague@company.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="h-12 bg-white/[0.04] border-white/[0.1] text-white placeholder:text-slate-600 focus:bg-white/[0.06] focus:border-primary/50 focus:ring-2 focus:ring-primary/20 transition-all duration-200 rounded-lg"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-3">
                Role <span className="text-red-400">*</span>
              </label>
              <div className="relative">
                <select
                  value={rolePreset}
                  onChange={(e) =>
                    setRolePreset(e.target.value as InviteData["rolePreset"])
                  }
                  className="w-full h-12 pl-4 pr-12 bg-white/[0.04] border border-white/[0.1] rounded-lg text-white text-sm font-medium focus:bg-white/[0.06] focus:border-primary/50 focus:ring-2 focus:ring-primary/20 transition-all duration-200 appearance-none cursor-pointer [&>option]:bg-[#0D0D0D] [&>option]:text-white"
                >
                  <option value="agency_admin">Operator (Agency Admin)</option>
                  <option value="brand_member">Operator (Brand Member)</option>
                  <option value="agency_ops">Operator (Agency Ops)</option>
                </select>
                <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none">
                  <svg
                    width="16"
                    height="16"
                    viewBox="0 0 16 16"
                    fill="none"
                    className="text-slate-400"
                  >
                    <path
                      d="M4 6L8 10L12 6"
                      stroke="currentColor"
                      strokeWidth="1.5"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                </div>
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-3">
                Message{" "}
                <span className="text-slate-600 font-normal">(Optional)</span>
              </label>
              <textarea
                placeholder="Add a personal message to the invitation..."
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                rows={3}
                className="w-full px-4 py-3 bg-white/[0.04] border border-white/[0.1] rounded-lg text-white placeholder:text-slate-600 text-sm focus:bg-white/[0.06] focus:border-primary/50 focus:ring-2 focus:ring-primary/20 transition-all duration-200 resize-none"
              />
            </div>
          </div>

          <div className="sticky bottom-0 bg-[#0D0D0D]/95 backdrop-blur-xl border-t border-white/[0.08] px-8 py-5">
            <div className="flex gap-3">
              <Button
                onClick={handleSubmit}
                disabled={loading}
                className="flex-1 h-12 bg-primary hover:bg-primary/90 text-black font-semibold shadow-lg shadow-primary/25 hover:shadow-primary/40 transition-all duration-200 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed"
                style={
                  {
                    backgroundClip: "unset",
                    WebkitBackgroundClip: "unset",
                  } as React.CSSProperties
                }
              >
                <Mail className="w-4.5 h-4.5 mr-2.5" />
                {loading ? "Sending..." : "Send Invitation"}
              </Button>
              <Button
                onClick={onClose}
                variant="outline"
                className="h-12 px-8 bg-white/[0.04] hover:bg-white/[0.08] border-white/[0.1] hover:border-white/[0.15] text-slate-300 hover:text-white transition-all duration-200 rounded-lg font-medium"
              >
                Cancel
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
