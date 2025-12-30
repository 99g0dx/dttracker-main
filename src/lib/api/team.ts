import { supabase } from "../supabase";
import type {
  TeamMember,
  TeamMemberInsert,
  TeamMemberUpdate,
  TeamInvite,
  TeamInviteInsert,
  TeamInviteUpdate,
  MemberScope,
  MemberScopeInsert,
  TeamMemberWithScopes,
  TeamInviteWithInviter,
  ApiResponse,
  ApiListResponse,
} from "../types/database";
// Generate UUID v4 for invite tokens
function generateUUID(): string {
  // Use crypto.randomUUID if available, otherwise generate manually
  if (typeof crypto !== "undefined" && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  // Fallback: simple UUID v4 generator
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === "x" ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

/**
 * Get team members for a workspace
 * For now, workspace_id is the owner's user_id
 */
export async function getTeamMembers(
  workspaceId?: string
): Promise<ApiListResponse<TeamMemberWithScopes>> {
  try {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      return { data: null, error: new Error("Not authenticated") };
    }

    const targetWorkspaceId = workspaceId || user.id;

    const { data: members, error } = await supabase
      .from("team_members")
      .select("*")
      .eq("workspace_id", targetWorkspaceId)
      .order("created_at", { ascending: false });

    if (error) {
      return { data: null, error };
    }

    // Fetch scopes for each member
    const membersWithScopes: TeamMemberWithScopes[] = await Promise.all(
      (members || []).map(async (member) => {
        const { data: scopes } = await supabase
          .from("member_scopes")
          .select("*")
          .eq("team_member_id", member.id);

        return {
          ...member,
          scopes: (scopes || []) as MemberScope[],
        };
      })
    );

    return {
      data: membersWithScopes,
      error: null,
      count: membersWithScopes.length,
    };
  } catch (err) {
    return { data: null, error: err as Error };
  }
}

/**
 * Get pending team invites for a workspace
 */
export async function getTeamInvites(
  workspaceId?: string
): Promise<ApiListResponse<TeamInviteWithInviter>> {
  try {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      return { data: null, error: new Error("Not authenticated") };
    }

    const targetWorkspaceId = workspaceId || user.id;

    const { data: invites, error } = await supabase
      .from("team_invites")
      .select("*")
      .eq("workspace_id", targetWorkspaceId)
      .is("accepted_at", null)
      .gt("expires_at", new Date().toISOString())
      .order("created_at", { ascending: false });

    if (error) {
      return { data: null, error };
    }

    // Fetch inviter info for each invite
    const invitesWithInviter: TeamInviteWithInviter[] = await Promise.all(
      (invites || []).map(async (invite) => {
        const { data: profile } = await supabase
          .from("profiles")
          .select("full_name")
          .eq("id", invite.invited_by)
          .single();

        // Note: Can't fetch email directly without admin API
        // We'll just use the profile name for now
        return {
          ...invite,
          inviter_name: profile?.full_name || null,
          inviter_email: null, // Can't fetch without admin API
        };
      })
    );

    return {
      data: invitesWithInviter,
      error: null,
      count: invitesWithInviter.length,
    };
  } catch (err) {
    return { data: null, error: err as Error };
  }
}

/**
 * Create a team invite
 */
export async function createTeamInvite(
  workspaceId: string,
  email: string,
  role: TeamMember["role"],
  scopes: Array<{ scope_type: MemberScope["scope_type"]; scope_value: string }>,
  message?: string | null
): Promise<ApiResponse<TeamInvite>> {
  try {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      return { data: null, error: new Error("Not authenticated") };
    }

    // Generate invite token
    const inviteToken = generateUUID();

    // Set expiry to 7 days from now
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7);

    const inviteData: TeamInviteInsert = {
      workspace_id: workspaceId,
      email: email.toLowerCase().trim(),
      invited_by: user.id,
      role,
      invite_token: inviteToken,
      expires_at: expiresAt.toISOString(),
      message: message || null,
    };

    const { data: invite, error } = await supabase
      .from("team_invites")
      .insert(inviteData)
      .select()
      .single();

    if (error) {
      return { data: null, error };
    }

    // Note: Member scopes will be added when the invite is accepted
    // We can store them temporarily or add them to the invite acceptance flow

    return { data: invite, error: null };
  } catch (err) {
    return { data: null, error: err as Error };
  }
}

/**
 * Accept a team invite
 * This should be called when a user accepts an invite via the invite link
 */
export async function acceptTeamInvite(
  token: string
): Promise<ApiResponse<TeamMember>> {
  try {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      return { data: null, error: new Error("Not authenticated") };
    }

    // Find the invite
    const { data: invite, error: inviteError } = await supabase
      .from("team_invites")
      .select("*")
      .eq("invite_token", token)
      .is("accepted_at", null)
      .gt("expires_at", new Date().toISOString())
      .single();

    if (inviteError || !invite) {
      return { data: null, error: new Error("Invalid or expired invite") };
    }

    // Check if email matches
    const {
      data: { user: authUser },
    } = await supabase.auth.getUser();
    if (authUser?.email?.toLowerCase() !== invite.email.toLowerCase()) {
      return {
        data: null,
        error: new Error("Invite email does not match your account email"),
      };
    }

    // Create team member
    const memberData: TeamMemberInsert = {
      workspace_id: invite.workspace_id,
      user_id: user.id,
      role: invite.role,
      status: "active",
      invited_by: invite.invited_by,
      joined_at: new Date().toISOString(),
    };

    const { data: member, error: memberError } = await supabase
      .from("team_members")
      .insert(memberData)
      .select()
      .single();

    if (memberError) {
      return { data: null, error: memberError };
    }

    // Mark invite as accepted
    const { error: updateError } = await supabase
      .from("team_invites")
      .update({ accepted_at: new Date().toISOString() })
      .eq("id", invite.id);

    if (updateError) {
      console.error("Failed to mark invite as accepted:", updateError);
      // Don't fail the whole operation if this fails
    }

    return { data: member, error: null };
  } catch (err) {
    return { data: null, error: err as Error };
  }
}

/**
 * Get invite by token (for public invite acceptance page)
 */
export async function getTeamInviteByToken(
  token: string
): Promise<ApiResponse<TeamInviteWithInviter>> {
  try {
    const { data: invite, error } = await supabase
      .from("team_invites")
      .select("*")
      .eq("invite_token", token)
      .is("accepted_at", null)
      .gt("expires_at", new Date().toISOString())
      .single();

    if (error || !invite) {
      return { data: null, error: new Error("Invalid or expired invite") };
    }

    // Fetch inviter info
    const { data: profile } = await supabase
      .from("profiles")
      .select("full_name")
      .eq("id", invite.invited_by)
      .single();

    // Note: We can't use admin API here, so we'll need to fetch from profiles
    // For now, we'll just use the profile name
    const inviteWithInviter: TeamInviteWithInviter = {
      ...invite,
      inviter_name: profile?.full_name || null,
      inviter_email: null, // Can't fetch email without admin API
    };

    return { data: inviteWithInviter, error: null };
  } catch (err) {
    return { data: null, error: err as Error };
  }
}

/**
 * Delete/remove a team member
 */
export async function deleteTeamMember(
  memberId: string
): Promise<ApiResponse<void>> {
  try {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      return { data: null, error: new Error("Not authenticated") };
    }

    // Verify user has permission (workspace owner)
    const { data: member, error: memberError } = await supabase
      .from("team_members")
      .select("workspace_id")
      .eq("id", memberId)
      .single();

    if (memberError || !member) {
      return { data: null, error: new Error("Team member not found") };
    }

    if (member.workspace_id !== user.id) {
      return {
        data: null,
        error: new Error("Not authorized to remove this team member"),
      };
    }

    const { error } = await supabase
      .from("team_members")
      .delete()
      .eq("id", memberId);

    if (error) {
      return { data: null, error };
    }

    return { data: null, error: null };
  } catch (err) {
    return { data: null, error: err as Error };
  }
}

/**
 * Update team member role
 */
export async function updateTeamMemberRole(
  memberId: string,
  role: TeamMember["role"]
): Promise<ApiResponse<TeamMember>> {
  try {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      return { data: null, error: new Error("Not authenticated") };
    }

    // Verify user has permission (workspace owner)
    const { data: member, error: memberError } = await supabase
      .from("team_members")
      .select("workspace_id")
      .eq("id", memberId)
      .single();

    if (memberError || !member) {
      return { data: null, error: new Error("Team member not found") };
    }

    if (member.workspace_id !== user.id) {
      return {
        data: null,
        error: new Error("Not authorized to update this team member"),
      };
    }

    const updateData: TeamMemberUpdate = { role };

    const { data: updated, error } = await supabase
      .from("team_members")
      .update(updateData)
      .eq("id", memberId)
      .select()
      .single();

    if (error) {
      return { data: null, error };
    }

    return { data: updated, error: null };
  } catch (err) {
    return { data: null, error: err as Error };
  }
}

/**
 * Revoke/cancel a team invite
 */
export async function revokeTeamInvite(
  inviteId: string
): Promise<ApiResponse<void>> {
  try {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      return { data: null, error: new Error("Not authenticated") };
    }

    // Verify user has permission (workspace owner)
    const { data: invite, error: inviteError } = await supabase
      .from("team_invites")
      .select("workspace_id")
      .eq("id", inviteId)
      .single();

    if (inviteError || !invite) {
      return { data: null, error: new Error("Invite not found") };
    }

    if (invite.workspace_id !== user.id) {
      return {
        data: null,
        error: new Error("Not authorized to revoke this invite"),
      };
    }

    const { error } = await supabase
      .from("team_invites")
      .delete()
      .eq("id", inviteId);

    if (error) {
      return { data: null, error };
    }

    return { data: null, error: null };
  } catch (err) {
    return { data: null, error: err as Error };
  }
}

/**
 * Get member scopes for a team member
 */
export async function getMemberScopes(
  memberId: string
): Promise<ApiListResponse<MemberScope>> {
  try {
    const { data, error } = await supabase
      .from("member_scopes")
      .select("*")
      .eq("team_member_id", memberId)
      .order("created_at", { ascending: false });

    if (error) {
      return { data: null, error };
    }

    return {
      data: data as MemberScope[],
      error: null,
      count: data?.length || 0,
    };
  } catch (err) {
    return { data: null, error: err as Error };
  }
}

/**
 * Add scope to a team member
 */
export async function addMemberScope(
  scope: MemberScopeInsert
): Promise<ApiResponse<MemberScope>> {
  try {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      return { data: null, error: new Error("Not authenticated") };
    }

    // Verify user has permission (workspace owner)
    const { data: member, error: memberError } = await supabase
      .from("team_members")
      .select("workspace_id")
      .eq("id", scope.team_member_id)
      .single();

    if (memberError || !member) {
      return { data: null, error: new Error("Team member not found") };
    }

    if (member.workspace_id !== user.id) {
      return { data: null, error: new Error("Not authorized to add scopes") };
    }

    const { data: created, error } = await supabase
      .from("member_scopes")
      .insert(scope)
      .select()
      .single();

    if (error) {
      return { data: null, error };
    }

    return { data: created, error: null };
  } catch (err) {
    return { data: null, error: err as Error };
  }
}

/**
 * Remove scope from a team member
 */
export async function removeMemberScope(
  scopeId: string
): Promise<ApiResponse<void>> {
  try {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      return { data: null, error: new Error("Not authenticated") };
    }

    // Verify user has permission (workspace owner)
    const { data: scope, error: scopeError } = await supabase
      .from("member_scopes")
      .select(
        `
        *,
        team_member:team_members(workspace_id)
      `
      )
      .eq("id", scopeId)
      .single();

    if (scopeError || !scope) {
      return { data: null, error: new Error("Scope not found") };
    }

    const teamMember = (scope as any).team_member;
    if (teamMember.workspace_id !== user.id) {
      return {
        data: null,
        error: new Error("Not authorized to remove this scope"),
      };
    }

    const { error } = await supabase
      .from("member_scopes")
      .delete()
      .eq("id", scopeId);

    if (error) {
      return { data: null, error };
    }

    return { data: null, error: null };
  } catch (err) {
    return { data: null, error: err as Error };
  }
}
