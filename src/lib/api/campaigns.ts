import { supabase } from '../supabase';
import type {
  Campaign,
  CampaignInsert,
  CampaignUpdate,
  CampaignWithStats,
  CampaignWithSubcampaigns,
  ApiResponse,
  ApiListResponse,
} from '../types/database';
import { getSubcampaigns } from './subcampaigns';

/**
 * Fetch all campaigns for the current user with aggregated stats
 */
export async function list(): Promise<ApiListResponse<CampaignWithStats>> {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return { data: null, error: new Error('Not authenticated') };
    }

    // Fetch campaigns with posts count and aggregated metrics
    // Use nested queries as they were working before
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
        ),
        subcampaigns:campaigns!parent_campaign_id(count)
      `)
      .eq('user_id', user.id)
      .is('parent_campaign_id', null)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching campaigns:', error);
      console.error('Error details:', {
        message: error.message,
        details: error.details,
        hint: error.hint,
        code: error.code
      });
      
      // Provide more helpful error messages
      if (error.message?.includes('permission') || error.message?.includes('policy') || error.message?.includes('row-level security')) {
        return { 
          data: null, 
          error: new Error(
            `Permission denied: ${error.message}. ` +
            'This usually means RLS policies are missing or incorrect. ' +
            'Please check that RLS policies in database/schema.sql were created successfully.'
          ) 
        };
      }
      if (error.message?.includes('does not exist') || error.message?.includes('schema') || error.message?.includes('schema cache')) {
        return { 
          data: null, 
          error: new Error(
            'Database table not found. Run database/schema.sql in Supabase SQL Editor. See DATABASE_SETUP_FIX.md for step-by-step instructions.'
          ) 
        };
      }
      return { data: null, error };
    }

    // Log for debugging
    console.log('Campaigns query result:', {
      user_id: user.id,
      campaigns_count: campaigns?.length || 0,
      campaigns: campaigns?.map(c => ({ id: c.id, name: c.name })) || []
    });
    
    if (!campaigns || campaigns.length === 0) {
      console.log('No campaigns found for user:', user.id);
    } else {
      console.log(`Found ${campaigns.length} campaign(s) for user:`, user.id);
    }

    // Transform data to include computed stats
    // Handle cases where nested queries might return null or error
    const campaignsWithStats: CampaignWithStats[] = (campaigns || []).map((campaign: any) => {
      // Safely handle posts - might be null if query failed
      const posts = Array.isArray(campaign.posts) ? campaign.posts : [];
      const posts_count = posts.length;
      const total_views = posts.reduce((sum: number, p: any) => sum + (Number(p?.views) || 0), 0);
      const total_likes = posts.reduce((sum: number, p: any) => sum + (Number(p?.likes) || 0), 0);
      const total_comments = posts.reduce((sum: number, p: any) => sum + (Number(p?.comments) || 0), 0);
      const total_shares = posts.reduce((sum: number, p: any) => sum + (Number(p?.shares) || 0), 0);
      const avg_engagement_rate = posts_count > 0
        ? posts.reduce((sum: number, p: any) => sum + (Number(p?.engagement_rate) || 0), 0) / posts_count
        : 0;
      
      // Safely handle subcampaigns count
      const subcampaigns_count = Array.isArray(campaign.subcampaigns) && campaign.subcampaigns.length > 0
        ? (campaign.subcampaigns[0]?.count ?? 0)
        : 0;

      // Remove posts and subcampaigns from response, only keep stats
      const { posts: _, subcampaigns: __, ...campaignData } = campaign;

      return {
        ...campaignData,
        posts_count,
        total_views,
        total_likes,
        total_comments,
        total_shares,
        avg_engagement_rate: Number(avg_engagement_rate.toFixed(2)),
        subcampaigns_count,
      };
    });

    return { data: campaignsWithStats, error: null, count: campaignsWithStats.length };
  } catch (err) {
    return { data: null, error: err as Error };
  }
}

/**
 * Fetch a single campaign by ID
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
 * Fetch a campaign with subcampaigns and hierarchy flags
 */
export async function getWithSubcampaigns(
  id: string
): Promise<ApiResponse<CampaignWithSubcampaigns>> {
  try {
    const { data: campaign, error } = await supabase
      .from('campaigns')
      .select('*')
      .eq('id', id)
      .single();

    if (error || !campaign) {
      return { data: null, error: error || new Error('Campaign not found') };
    }

    const subcampaignsResult = await getSubcampaigns(id);
    if (subcampaignsResult.error) {
      return { data: null, error: subcampaignsResult.error };
    }

    const subcampaigns = subcampaignsResult.data || [];

    return {
      data: {
        ...campaign,
        subcampaigns,
        is_parent: subcampaigns.length > 0,
        is_subcampaign: !!campaign.parent_campaign_id,
      },
      error: null,
    };
  } catch (err) {
    return { data: null, error: err as Error };
  }
}

/**
 * Create a new campaign
 */
export async function create(campaign: CampaignInsert): Promise<ApiResponse<Campaign>> {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return { data: null, error: new Error('Not authenticated') };
    }

    const { data, error } = await supabase
      .from('campaigns')
      .insert({
        ...campaign,
        user_id: user.id,
      })
      .select()
      .single();

    if (error) {
      // Provide a more helpful error message if table doesn't exist
      if (error.message?.includes('schema cache') || error.message?.includes('does not exist')) {
        return { 
          data: null, 
          error: new Error(
            'Database table not found. Please run the database schema. ' +
            'See DATABASE_SETUP_FIX.md for instructions.'
          ) 
        };
      }
      
      // Check for RLS policy errors
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
      
      // Check for constraint violations
      if (error.message?.includes('violates') || error.message?.includes('constraint')) {
        return { 
          data: null, 
          error: new Error(
            `Database constraint error: ${error.message}. ` +
            'Please check that all required fields are provided and valid.'
          ) 
        };
      }
      
      // Log full error for debugging
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
 */
export async function deleteCampaign(id: string): Promise<ApiResponse<void>> {
  try {
    const { error } = await supabase
      .from('campaigns')
      .delete()
      .eq('id', id);

    if (error) {
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

    // Fetch original campaign
    const { data: original, error: fetchError } = await supabase
      .from('campaigns')
      .select('*')
      .eq('id', id)
      .single();

    if (fetchError || !original) {
      return { data: null, error: fetchError || new Error('Campaign not found') };
    }

    // Create duplicate
    const { data: duplicate, error: createError } = await supabase
      .from('campaigns')
      .insert({
        user_id: user.id,
        name: `${original.name} (Copy)`,
        brand_name: original.brand_name,
        cover_image_url: original.cover_image_url,
        parent_campaign_id: original.parent_campaign_id || null,
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
