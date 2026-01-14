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
 */
async function resolveWorkspaceId(
  workspaceId?: string
): Promise<{ workspaceId: string | null; error: Error | null }> {
  if (workspaceId) {
    return { workspaceId, error: null };
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { workspaceId: null, error: new Error("Not authenticated") };
  }

  const { data, error } = await supabase
    .from("team_members")
    .select("workspace_id")
    .eq("user_id", user.id)
    .eq("status", "active")
    .order("created_at", { ascending: true })
    .limit(1)
    .single();

  if (error || !data?.workspace_id) {
    return { workspaceId: user.id, error: null };
  }

  return { workspaceId: data.workspace_id, error: null };
}

export async function getTeamMembers(
  workspaceId?: string
): Promise<ApiListResponse<TeamMemberWithScopes>> {
  try {
    const { workspaceId: targetWorkspaceId, error: workspaceError } =
      await resolveWorkspaceId(workspaceId);
    if (workspaceError || !targetWorkspaceId) {
      return {
        data: null,
        error: workspaceError || new Error("Workspace not found"),
      };
    }

    const { data: members, error: membersError } = await supabase
      .from("team_members")
      .select("*")
      .eq("workspace_id", targetWorkspaceId)
      .order("created_at", { ascending: false });

    if (membersError) {
      return { data: null, error: membersError };
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
    const { workspaceId: targetWorkspaceId, error: workspaceError } =
      await resolveWorkspaceId(workspaceId);
    if (workspaceError || !targetWorkspaceId) {
      return {
        data: null,
        error: workspaceError || new Error("Workspace not found"),
      };
    }

    const { data: invites, error: invitesError } = await supabase
      .from("team_invites")
      .select("*")
      .eq("workspace_id", targetWorkspaceId)
      .is("accepted_at", null)
      .gt("expires_at", new Date().toISOString())
      .order("created_at", { ascending: false });

    if (invitesError) {
      return { data: null, error: invitesError };
    }

    // Fetch inviter info for each invite
    const invitesWithInviter: TeamInviteWithInviter[] = await Promise.all(
      (invites || []).map(async (invite) => {
      const { data: profile } = await supabase
        .from("profiles")
        .select("full_name")
        .eq("id", invite.invited_by)
        .maybeSingle();

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
  workspaceId: string | undefined,
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

    const targetWorkspaceId = workspaceId || user.id;

    const inviteData: TeamInviteInsert = {
      workspace_id: targetWorkspaceId,
      email: email.toLowerCase().trim(),
      invited_by: user.id,
      role,
      invite_token: inviteToken,
      expires_at: expiresAt.toISOString(),
      scopes: scopes.length > 0 ? scopes : [],
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

    // Send invitation email via Edge Function
    // Don't fail invite creation if email fails, but return error info
    let emailError: Error | null = null;
    try {
      // Get inviter's name from profile
      const { data: profile } = await supabase
        .from("profiles")
        .select("full_name")
        .eq("id", user.id)
        .single();

      const inviterName = profile?.full_name || null;

      // Construct invite URL
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
      const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
      const origin = typeof window !== "undefined" ? window.location.origin : "";
      const inviteUrl = `${origin}/team/invite/${inviteToken}`;

      if (supabaseUrl && supabaseAnonKey && origin) {
        const edgeFunctionUrl = `${supabaseUrl}/functions/v1/send-team-invite`;

        const emailResponse = await fetch(edgeFunctionUrl, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "apikey": supabaseAnonKey,
            "Authorization": `Bearer ${supabaseAnonKey}`,
          },
          body: JSON.stringify({
            email: invite.email,
            inviteToken: inviteToken,
            inviterName: inviterName,
            role: invite.role,
            message: invite.message,
            inviteUrl: inviteUrl,
          }),
        });

        if (!emailResponse.ok) {
          const errorText = await emailResponse.text();
          console.warn("Failed to send invitation email:", errorText);
          let errorMessage = "Failed to send invitation email";
          try {
            const errorData = JSON.parse(errorText);
            if (errorData.error === "Email service not configured") {
              errorMessage = "Email service not configured. Please set RESEND_API_KEY in Supabase Edge Functions secrets.";
            } else if (errorData.message) {
              errorMessage = errorData.message;
            } else if (errorData.error) {
              errorMessage = errorData.error;
            }
          } catch {
            // If parsing fails, use the error text as-is
            if (errorText) errorMessage = errorText;
          }
          emailError = new Error(errorMessage);
        } else {
          const emailResult = await emailResponse.json();
          console.log("Invitation email sent:", emailResult);
          if (emailResult.success === false) {
            // Edge function returned success:false in body
            emailError = new Error(emailResult.message || emailResult.error || "Email sending failed");
          }
        }
      } else {
        emailError = new Error("Missing Supabase configuration (URL, key, or origin)");
      }
    } catch (err) {
      // Log but don't fail - invite is already created
      emailError = err instanceof Error ? err : new Error("Unknown error sending email");
      console.warn("Error sending invitation email:", emailError);
    }

    // Return the invite with any email error info attached
    // The invite is created successfully, but email may have failed
    const result: ApiResponse<TeamInvite> & { emailError?: Error | null } = { 
      data: invite, 
      error: null 
    };
    
    if (emailError) {
      // Attach email error as a property so UI can check it
      (result as any).emailError = emailError;
    }
    
    return result;
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

    const inviteScopes = Array.isArray(invite.scopes) ? invite.scopes : [];
    if (inviteScopes.length > 0) {
      const scopeRows = inviteScopes.map((scope) => ({
        team_member_id: member.id,
        scope_type: scope.scope_type,
        scope_value: scope.scope_value,
      }));

      const { error: scopesError } = await supabase
        .from("member_scopes")
        .insert(scopeRows);

      if (scopesError) {
        console.warn("Failed to add invite scopes:", scopesError);
      }
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
      .maybeSingle();

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
