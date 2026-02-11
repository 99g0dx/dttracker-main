import { supabase } from '../supabase';
import type { ApiResponse, CampaignMember, CampaignMemberInsert } from '../types/database';

/**
 * Get all team members (users in the same organization)
 * For now, this returns all users from profiles table
 * In a production app, you'd filter by organization/team
 */
export async function getTeamMembers(): Promise<ApiResponse<{ id: string; email: string; full_name: string | null }[]>> {
  try {
    // Get all profiles (in production, you'd filter by organization)
    const { data: profiles, error: profilesError } = await supabase
      .from('profiles')
      .select('id, full_name');

    if (profilesError) {
      return { data: null, error: profilesError };
    }

    // Get corresponding user emails from auth.users
    // Note: This requires a helper function or view in production
    // For now, we'll use the RPC function or return profiles only
    const { data: { users }, error: usersError } = await supabase.auth.admin.listUsers();

    if (usersError) {
      // Fallback: return profiles without emails
      return {
        data: profiles?.map(p => ({
          id: p.id,
          email: 'user@example.com',
          full_name: p.full_name
        })) || [],
        error: null
      };
    }

    // Merge profiles with user emails
    const teamMembers = profiles?.map(profile => {
      const user = users.find(u => u.id === profile.id);
      return {
        id: profile.id,
        email: user?.email || 'unknown@example.com',
        full_name: profile.full_name,
      };
    }) || [];

    return { data: teamMembers, error: null };
  } catch (error: any) {
    return { data: null, error };
  }
}

/**
 * Get all members with access to a specific campaign
 */
export async function getCampaignMembers(campaignId: string): Promise<ApiResponse<(CampaignMember & { profile: { full_name: string | null } })[]>> {
  try {
    const { data, error } = await supabase
      .from('campaign_members')
      .select(`
        *,
        profile:user_id (
          full_name
        )
      `)
      .eq('campaign_id', campaignId)
      .order('created_at', { ascending: false });

    if (error) {
      return { data: null, error };
    }

    return { data: data || [], error: null };
  } catch (error: any) {
    return { data: null, error };
  }
}

/**
 * Add a user to a campaign with specific role
 */
export async function addCampaignMember(member: CampaignMemberInsert): Promise<ApiResponse<CampaignMember>> {
  try {
    const { data, error } = await supabase
      .from('campaign_members')
      .insert(member)
      .select()
      .single();

    if (error) {
      return { data: null, error };
    }

    return { data, error: null };
  } catch (error: any) {
    return { data: null, error };
  }
}

/**
 * Update a member's role in a campaign
 */
export async function updateCampaignMemberRole(
  campaignId: string,
  userId: string,
  role: 'owner' | 'editor' | 'viewer'
): Promise<ApiResponse<CampaignMember>> {
  try {
    const { data, error } = await supabase
      .from('campaign_members')
      .update({ role })
      .eq('campaign_id', campaignId)
      .eq('user_id', userId)
      .select()
      .single();

    if (error) {
      return { data: null, error };
    }

    return { data, error: null };
  } catch (error: any) {
    return { data: null, error };
  }
}

/**
 * Remove a user's access to a campaign
 */
export async function removeCampaignMember(
  campaignId: string,
  userId: string
): Promise<ApiResponse<void>> {
  try {
    const { error } = await supabase
      .from('campaign_members')
      .delete()
      .eq('campaign_id', campaignId)
      .eq('user_id', userId);

    if (error) {
      return { data: null, error };
    }

    return { data: null, error: null };
  } catch (error: any) {
    return { data: null, error };
  }
}

export type CampaignMemberWithEmail = {
  user_id: string;
  email: string;
  full_name: string | null;
  role: string;
};

/**
 * Get campaign members with email (for sharing modal; includes users added by email).
 * Tries the SECURITY DEFINER RPC first; falls back to a direct query on campaign_members.
 */
export async function getCampaignMembersWithEmails(
  campaignId: string
): Promise<ApiResponse<CampaignMemberWithEmail[]>> {
  // --- Approach 1: Try RPC (returns emails from auth.users via SECURITY DEFINER) ---
  try {
    const { data, error } = await supabase.rpc('get_campaign_members_with_emails', {
      p_campaign_id: campaignId,
    });

    if (!error && data) {
      let parsed: CampaignMemberWithEmail[];
      if (typeof data === 'string') {
        try { parsed = JSON.parse(data); } catch { parsed = []; }
      } else if (Array.isArray(data)) {
        parsed = data;
      } else {
        parsed = [];
      }
      if (parsed.length > 0) {
        return { data: parsed, error: null };
      }
    }
  } catch {
    // RPC not available or failed; fall through to direct query
  }

  // --- Approach 2: Direct query on campaign_members + profiles + auth admin ---
  try {
    const { data: members, error: membersError } = await supabase
      .from('campaign_members')
      .select('user_id, role')
      .eq('campaign_id', campaignId)
      .order('created_at', { ascending: false });

    if (membersError || !members || members.length === 0) {
      return { data: [], error: membersError || null };
    }

    const userIds = members.map((m: any) => m.user_id);

    // Get full_name from profiles
    const { data: profiles } = await supabase
      .from('profiles')
      .select('id, full_name')
      .in('id', userIds);

    const profileMap = new Map((profiles || []).map((p: any) => [p.id, p]));

    // Get emails from auth.admin.listUsers (same approach as getTeamMembers)
    let userMap = new Map<string, any>();
    try {
      const { data: { users } } = await supabase.auth.admin.listUsers();
      if (users) {
        userMap = new Map(users.map((u: any) => [u.id, u]));
      }
    } catch {
      // auth.admin may not be available
    }

    const list: CampaignMemberWithEmail[] = members.map((m: any) => ({
      user_id: m.user_id,
      email: userMap.get(m.user_id)?.email || '',
      full_name: profileMap.get(m.user_id)?.full_name || null,
      role: m.role || 'editor',
    }));

    return { data: list, error: null };
  } catch (error: any) {
    return { data: null, error };
  }
}

export type AddCampaignMemberByEmailParams = {
  campaignId: string;
  email: string;
  role: 'editor' | 'viewer';
  campaignName: string;
};

/**
 * Add a user to a campaign by email; sends "You've been added" email.
 * campaignName and campaignUrl are used for the email. campaignUrl should be e.g. origin + /campaigns/{id}.
 */
export async function addCampaignMemberByEmail(
  params: AddCampaignMemberByEmailParams,
  campaignUrl: string
): Promise<ApiResponse<{ user_id: string }>> {
  try {
    const { campaignId, email, role, campaignName } = params;
    const { data: rpcData, error: rpcError } = await supabase.rpc('add_campaign_member_by_email', {
      p_campaign_id: campaignId,
      p_email: email.trim(),
      p_role: role,
    });
    if (rpcError) {
      return { data: null, error: rpcError };
    }
    const result = rpcData as { success: boolean; user_id?: string; error?: string } | null;
    if (!result || !result.success) {
      return {
        data: null,
        error: new Error(result?.error || 'Failed to add member'),
      };
    }
    // Send "You've been added" email (fire-and-forget; don't fail the add)
    try {
      const { data: emailData, error: emailError } = await supabase.functions.invoke('send-campaign-added-email', {
        body: { email: email.trim(), campaignName, campaignUrl, role },
      });
      if (emailError) {
        console.warn('Campaign added email failed:', emailError);
      } else if (emailData && !emailData.success) {
        console.warn('Campaign added email failed:', emailData.error, emailData.details);
      }
    } catch (emailErr) {
      console.warn('Campaign added email failed:', emailErr);
    }
    return { data: { user_id: result.user_id! }, error: null };
  } catch (error: any) {
    return { data: null, error };
  }
}

/**
 * Check which users have an active subscription (for campaign-sharing: only subscribed users can be added).
 * Calls RPC check_users_subscription_status; returns map of user_id -> hasActiveSubscription.
 */
export async function checkUsersSubscriptionStatus(
  userIds: string[]
): Promise<ApiResponse<Record<string, boolean>>> {
  try {
    if (userIds.length === 0) {
      return { data: {}, error: null };
    }
    const { data, error } = await supabase.rpc('check_users_subscription_status', {
      p_user_ids: userIds,
    });
    if (error) {
      return { data: null, error };
    }
    return { data: (data as Record<string, boolean>) || {}, error: null };
  } catch (error: any) {
    return { data: null, error };
  }
}

/**
 * Check if a user has access to a campaign
 */
export async function checkCampaignAccess(
  campaignId: string,
  userId: string
): Promise<ApiResponse<{ hasAccess: boolean; role?: 'owner' | 'editor' | 'viewer' }>> {
  try {
    // Check if user is the campaign owner
    const { data: campaign, error: campaignError } = await supabase
      .from('campaigns')
      .select('user_id')
      .eq('id', campaignId)
      .single();

    if (campaignError) {
      return { data: null, error: campaignError };
    }

    if (campaign.user_id === userId) {
      return { data: { hasAccess: true, role: 'owner' }, error: null };
    }

    // Check if user is a member
    const { data: member, error: memberError } = await supabase
      .from('campaign_members')
      .select('role')
      .eq('campaign_id', campaignId)
      .eq('user_id', userId)
      .maybeSingle();

    if (memberError) {
      return { data: null, error: memberError };
    }

    if (member) {
      return { data: { hasAccess: true, role: member.role as 'owner' | 'editor' | 'viewer' }, error: null };
    }

    return { data: { hasAccess: false }, error: null };
  } catch (error: any) {
    return { data: null, error };
  }
}
