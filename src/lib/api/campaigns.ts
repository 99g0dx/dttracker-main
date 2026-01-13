import { supabase } from '../supabase';
import type {
  Campaign,
  CampaignInsert,
  CampaignUpdate,
  CampaignWithStats,
  ApiResponse,
  ApiListResponse,
} from '../types/database';

/**
 * Fetch all campaigns for the current user's workspace with aggregated stats
 */
export async function list(): Promise<ApiListResponse<CampaignWithStats>> {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return { data: null, error: new Error('Not authenticated') };
    }

    // RLS automatically filters campaigns by workspace
    // No need to manually filter - the policy handles it!
    const { data: campaigns, error } = await supabase
      .from('campaigns')
      .select(`
        *,
        posts:posts(
          views,
          likes,
          comments,
          shares,
          engagement_rate
        )
      `)
      .order('created_at', { ascending: false });

    if (error) {
      return { data: null, error };
    }

    // Transform data to include computed stats
    const campaignsWithStats: CampaignWithStats[] = (campaigns || []).map((campaign: any) => {
      const posts = campaign.posts || [];
      const posts_count = posts.length;
      const total_views = posts.reduce((sum: number, p: any) => sum + (p.views || 0), 0);
      const total_likes = posts.reduce((sum: number, p: any) => sum + (p.likes || 0), 0);
      const total_comments = posts.reduce((sum: number, p: any) => sum + (p.comments || 0), 0);
      const total_shares = posts.reduce((sum: number, p: any) => sum + (p.shares || 0), 0);
      const avg_engagement_rate = posts_count > 0
        ? posts.reduce((sum: number, p: any) => sum + (p.engagement_rate || 0), 0) / posts_count
        : 0;

      // Remove posts from response, only keep stats
      const { posts: _, ...campaignData } = campaign;

      return {
        ...campaignData,
        posts_count,
        total_views,
        total_likes,
        total_comments,
        total_shares,
        avg_engagement_rate: Number(avg_engagement_rate.toFixed(2)),
      };
    });

    return { data: campaignsWithStats, error: null, count: campaignsWithStats.length };
  } catch (err) {
    return { data: null, error: err as Error };
  }
}

/**
 * Fetch a single campaign by ID
 * RLS automatically checks if user has access
 */
export async function getById(id: string): Promise<ApiResponse<Campaign>> {
  try {
    const { data, error } = await supabase
      .from('campaigns')
      .select('*')
      .eq('id', id)
      .single();

    if (error) {
      return { data: null, error };
    }

    return { data, error: null };
  } catch (err) {
    return { data: null, error: err as Error };
  }
}

/**
 * Create a new campaign in the user's workspace
 */
export async function create(campaign: CampaignInsert): Promise<ApiResponse<Campaign>> {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return { data: null, error: new Error('Not authenticated') };
    }

    // Get user's workspace_id from team_members
    const { data: memberData, error: memberError } = await supabase
      .from('team_members')
      .select('workspace_id')
      .eq('user_id', user.id)
      .single();

    if (memberError || !memberData) {
      return { 
        data: null, 
        error: new Error('User is not part of any workspace. Please contact support.') 
      };
    }

    // Create campaign with workspace_id
    const { data, error } = await supabase
      .from('campaigns')
      .insert({
        ...campaign,
        user_id: user.id,
        owner_id: user.id,
        created_by: user.id,
        workspace_id: memberData.workspace_id, // Add workspace_id
      })
      .select()
      .single();

    if (error) {
      // Provide helpful error messages
      if (error.message?.includes('does not exist')) {
    if (error.message?.includes('column')) {
      return { 
        data: null, 
        error: new Error(`Database Schema Mismatch: ${error.message}. You might be missing a column like workspace_id.`) 
      };
    }
    return { 
      data: null, 
      error: new Error('Database table not found. Please run the database schema.') 
    };
  }
  
      if (error.message?.includes('schema cache') || error.message?.includes('does not exist')) {
        return { 
          data: null, 
          error: new Error(
            'Database table not found. Please run the database schema. ' +
            'See DATABASE_SETUP_FIX.md for instructions.'
          ) 
        };
      }
      
      if (error.message?.includes('policy') || error.message?.includes('permission') || error.message?.includes('row-level security')) {
        return { 
          data: null, 
          error: new Error(
            `Permission denied: ${error.message}. ` +
            'This usually means RLS policies are missing. ' +
            'Please verify that all policies in database/schema.sql were created successfully.'
          ) 
        };
      }
      
      if (error.message?.includes('violates') || error.message?.includes('constraint')) {
        return { 
          data: null, 
          error: new Error(
            `Database constraint error: ${error.message}. ` +
            'Please check that all required fields are provided and valid.'
          ) 
        };
      }
      
      console.error('Campaign creation error:', error);
      return { data: null, error: new Error(error.message || 'Failed to create campaign') };
    }

    return { data, error: null };
  } catch (err) {
    return { data: null, error: err as Error };
  }
}

/**
 * Update an existing campaign
 * RLS automatically checks if user has access
 */
export async function update(id: string, updates: CampaignUpdate): Promise<ApiResponse<Campaign>> {
  try {
    const { data, error } = await supabase
      .from('campaigns')
      .update(updates)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      return { data: null, error };
    }

    return { data, error: null };
  } catch (err) {
    return { data: null, error: err as Error };
  }
}

/**
 * Delete a campaign
 * RLS automatically checks if user is admin/owner
 */
export async function deleteCampaign(id: string): Promise<ApiResponse<void>> {
  try {
    const { error } = await supabase
      .from('campaigns')
      .delete()
      .eq('id', id);

    if (error) {
      // Check if it's a permission error
      if (error.message?.includes('policy') || error.message?.includes('permission')) {
        return { 
          data: null, 
          error: new Error('You do not have permission to delete this campaign. Only admins and owners can delete campaigns.') 
        };
      }
      return { data: null, error };
    }

    return { data: null, error: null };
  } catch (err) {
    return { data: null, error: err as Error };
  }
}

/**
 * Duplicate a campaign (creates a copy without posts)
 */
export async function duplicate(id: string): Promise<ApiResponse<Campaign>> {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return { data: null, error: new Error('Not authenticated') };
    }

    // Get user's workspace_id
    const { data: memberData, error: memberError } = await supabase
      .from('team_members')
      .select('workspace_id')
      .eq('user_id', user.id)
      .single();

    if (memberError || !memberData) {
      return { 
        data: null, 
        error: new Error('User is not part of any workspace.') 
      };
    }

    // Fetch original campaign (RLS checks access automatically)
    const { data: original, error: fetchError } = await supabase
      .from('campaigns')
      .select('*')
      .eq('id', id)
      .single();

    if (fetchError || !original) {
      return { data: null, error: fetchError || new Error('Campaign not found') };
    }

    // Create duplicate with workspace_id
    const { data: duplicate, error: createError } = await supabase
      .from('campaigns')
      .insert({
        user_id: user.id,
        workspace_id: memberData.workspace_id, // Add workspace_id
        name: `${original.name} (Copy)`,
        brand_name: original.brand_name,
        cover_image_url: original.cover_image_url,
        status: 'active', // Reset to active
        start_date: original.start_date,
        end_date: original.end_date,
        notes: original.notes,
      })
      .select()
      .single();

    if (createError) {
      return { data: null, error: createError };
    }

    return { data: duplicate, error: null };
  } catch (err) {
    return { data: null, error: err as Error };
  }
}