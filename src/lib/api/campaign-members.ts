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
