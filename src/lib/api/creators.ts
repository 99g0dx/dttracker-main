import { supabase } from '../supabase';
import type { Creator, CreatorInsert, CreatorUpdate, CreatorWithStats, CampaignCreator, Platform, ApiResponse, ApiListResponse } from '../types/database';

/**
 * Get or create a creator by handle and platform
 * This is useful when importing posts from CSV - we need to ensure the creator exists
 * @param name - Optional. If not provided, uses handle as name
 */
export async function getOrCreate(
  name: string | null,
  handle: string,
  platform: Platform,
  followerCount?: number,
  email?: string | null,
  phone?: string | null,
  niche?: string | null,
  location?: string | null,
  sourceType?: 'manual' | 'csv_import' | 'scraper_extraction' | null
): Promise<ApiResponse<Creator>> {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return { data: null, error: new Error('Not authenticated') };
    }

    // Try to find existing creator
    const { data: existing, error: fetchError } = await supabase
      .from('creators')
      .select('*')
      .eq('user_id', user.id)
      .eq('handle', handle)
      .eq('platform', platform)
      .maybeSingle();

    if (fetchError) {
      return { data: null, error: fetchError };
    }

    // If creator exists, return it
    if (existing) {
      return { data: existing, error: null };
    }

    // Create new creator (use handle as name if name not provided)
    const creatorData: CreatorInsert = {
      user_id: user.id,
      name: name || handle,
      handle,
      platform,
      follower_count: followerCount || 0,
      avg_engagement: 0,
      email: email || null,
      phone: phone || null,
      niche: niche || null,
      location: location || null,
      source_type: sourceType || 'manual',
      imported_by_user_id: user.id,
    };

    const { data: created, error: createError } = await supabase
      .from('creators')
      .insert(creatorData)
      .select()
      .single();

    if (createError) {
      return { data: null, error: createError };
    }

    return { data: created, error: null };
  } catch (err) {
    return { data: null, error: err as Error };
  }
}

/**
 * List all creators for the current user
 */
export async function list(): Promise<ApiResponse<Creator[]>> {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return { data: null, error: new Error('Not authenticated') };
    }

    const { data, error } = await supabase
      .from('creators')
      .select('*')
      .eq('user_id', user.id)
      .order('name', { ascending: true });

    if (error) {
      return { data: null, error };
    }

    return { data: data || [], error: null };
  } catch (err) {
    return { data: null, error: err as Error };
  }
}

/**
 * Get creators assigned to a specific campaign roster
 */
export async function getByCampaign(campaignId: string): Promise<ApiResponse<Creator[]>> {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return { data: null, error: new Error('Not authenticated') };
    }

    // Primary source: Query campaign_creators table
    const { data: rosterRows, error: rosterError } = await supabase
      .from('campaign_creators')
      .select('creator_id')
      .eq('campaign_id', campaignId);

    if (rosterError) {
      return { data: null, error: rosterError };
    }

    let creatorIds = new Set<string>();
    
    // Get creator IDs from campaign_creators table
    if (rosterRows && rosterRows.length > 0) {
      rosterRows.forEach((row) => {
        if (row.creator_id) {
          creatorIds.add(row.creator_id);
        }
      });
    }

    // Fallback: Query posts table for unique creator_ids if roster is empty or incomplete
    const { data: posts, error: postsError } = await supabase
      .from('posts')
      .select('creator_id')
      .eq('campaign_id', campaignId)
      .not('creator_id', 'is', null);

    if (!postsError && posts && posts.length > 0) {
      // If roster is empty or has fewer creators than posts, use posts as fallback
      if (creatorIds.size === 0 || posts.length > creatorIds.size) {
        posts.forEach((post) => {
          if (post.creator_id) {
            creatorIds.add(post.creator_id);
          }
        });
      }
    }

    if (creatorIds.size === 0) {
      return { data: [], error: null };
    }

    // Fetch creators for all unique IDs
    const { data: creators, error: creatorsError } = await supabase
      .from('creators')
      .select('*')
      .eq('user_id', user.id)
      .in('id', Array.from(creatorIds))
      .order('name', { ascending: true });

    if (creatorsError) {
      return { data: null, error: creatorsError };
    }

    // Deduplicate by creator_id to ensure uniqueness
    const uniqueCreatorsMap = new Map<string, Creator>();
    (creators || []).forEach((creator) => {
      if (creator.id && !uniqueCreatorsMap.has(creator.id)) {
        uniqueCreatorsMap.set(creator.id, creator);
      }
    });

    return { data: Array.from(uniqueCreatorsMap.values()), error: null };
  } catch (err) {
    return { data: null, error: err as Error };
  }
}

/**
 * Create multiple creators in bulk
 * Skips duplicates (handle + platform already exists)
 * Returns success/error counts
 */
export interface BulkCreateResult {
  success_count: number;
  error_count: number;
  errors: Array<{ handle: string; platform: Platform; message: string }>;
  creators: Creator[];
}

export async function createMany(creators: CreatorInsert[]): Promise<ApiResponse<BulkCreateResult>> {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return { data: null, error: new Error('Not authenticated') };
    }

    const result: BulkCreateResult = {
      success_count: 0,
      error_count: 0,
      errors: [],
      creators: [],
    };

    if (creators.length === 0) {
      return { data: result, error: null };
    }

    // Step 1: Batch fetch ALL existing creators for this user (single query)
    const { data: allExistingCreators, error: fetchError } = await supabase
      .from('creators')
      .select('*')
      .eq('user_id', user.id);

    if (fetchError) {
      return { data: null, error: fetchError };
    }

    // Create a map for fast lookup: "handle:platform" -> Creator
    const existingMap = new Map<string, Creator>();
    (allExistingCreators || []).forEach((creator) => {
      const key = `${creator.handle}:${creator.platform}`;
      existingMap.set(key, creator);
    });

    // Step 2: Separate existing vs new creators (deduplicate within batch)
    const existingCreators: Creator[] = [];
    const newCreators: CreatorInsert[] = [];
    const creatorKeys = new Set<string>();

    for (const creatorData of creators) {
      const key = `${creatorData.handle}:${creatorData.platform}`;
      
      // Skip duplicates within the import batch
      if (creatorKeys.has(key)) {
        continue;
      }
      creatorKeys.add(key);

      const existing = existingMap.get(key);
      if (existing) {
        existingCreators.push(existing);
      } else {
        newCreators.push({
          ...creatorData,
          user_id: user.id,
          imported_by_user_id: creatorData.imported_by_user_id || user.id,
          source_type: creatorData.source_type || 'csv_import',
        });
      }
    }

    // Step 3: Batch insert all new creators at once (much faster!)
    if (newCreators.length > 0) {
      const { data: created, error: createError } = await supabase
        .from('creators')
        .insert(newCreators)
        .select();

      if (createError) {
        // If batch insert fails (e.g., constraint violation), try individual inserts
        // to get specific error messages for each creator
        for (const creatorData of newCreators) {
          const { data: singleCreated, error: singleError } = await supabase
            .from('creators')
            .insert(creatorData)
            .select()
            .single();

          if (singleError || !singleCreated) {
            result.error_count++;
            result.errors.push({
              handle: creatorData.handle,
              platform: creatorData.platform,
              message: singleError?.message || 'Unknown error',
            });
          } else {
            result.success_count++;
            result.creators.push(singleCreated);
          }
        }
      } else {
        // Batch insert succeeded - add all created creators
        result.success_count += created?.length || 0;
        if (created) {
          result.creators.push(...created);
        }
        console.log('✅ Batch inserted creators:', created?.length);
      }
    }

    // Add existing creators to results (they were already in the database)
    result.success_count += existingCreators.length;
    result.creators.push(...existingCreators);

    console.log('📊 Import complete:', {
      total: result.success_count,
      new: result.success_count - existingCreators.length,
      existing: existingCreators.length,
      errors: result.error_count
    });

    return { data: result, error: null };
  } catch (err) {
    return { data: null, error: err as Error };
  }
}

/**
 * List all creators with stats (campaigns count, total posts)
 * - 'my_network': Returns only user's own creators
 * - 'all': Returns ALL creators in DTTracker's network (not filtered by user_id)
 */
export async function listWithStats(networkFilter?: 'my_network' | 'all'): Promise<ApiResponse<CreatorWithStats[]>> {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return { data: null, error: new Error('Not authenticated') };
    }

    // Fetch creators with posts data
    // For 'my_network', show only user's creators
    // For 'all', show all creators in DTTracker's network (no user_id filter)
    let query = supabase
      .from('creators')
      .select('*');

    if (networkFilter === 'my_network') {
      query = query.eq('user_id', user.id);
    }
    // When networkFilter === 'all', we don't filter by user_id - shows all creators

    const { data: creators, error: creatorsError } = await query
      .order('name', { ascending: true });

    if (creatorsError) {
      console.error('❌ Error fetching creators:', creatorsError);
      return { data: null, error: creatorsError };
    }

    console.log(`📥 Fetched ${creators?.length || 0} creators (filter: ${networkFilter || 'my_network'})`);

    if (!creators || creators.length === 0) {
      return { data: [], error: null };
    }

    // Fetch posts for all creators to calculate stats
    const creatorIds = creators.map(c => c.id);
    const { data: posts, error: postsError } = await supabase
      .from('posts')
      .select('creator_id, campaign_id')
      .in('creator_id', creatorIds);

    if (postsError) {
      return { data: null, error: postsError };
    }

    // Fetch campaign_creators relationships
    const { data: campaignCreators, error: campaignCreatorsError } = await supabase
      .from('campaign_creators')
      .select('creator_id, campaign_id')
      .in('creator_id', creatorIds);

    if (campaignCreatorsError) {
      // Log warning but continue - table might not exist yet or be empty
      console.warn('⚠️ Could not fetch campaign_creators:', campaignCreatorsError.message);
    }

    // Calculate stats for each creator
    const creatorsWithStats: CreatorWithStats[] = creators.map((creator) => {
      const creatorPosts = posts?.filter(p => p.creator_id === creator.id) || [];
      const creatorCampaignRelations = campaignCreators?.filter(cc => cc.creator_id === creator.id) || [];
      const campaignsSet = new Set([
        ...creatorPosts.map(p => p.campaign_id),
        ...creatorCampaignRelations.map(cc => cc.campaign_id)
      ]);
      
      return {
        ...creator,
        campaigns: campaignsSet.size,
        totalPosts: creatorPosts.length,
      };
    });

    return { data: creatorsWithStats, error: null };
  } catch (err) {
    return { data: null, error: err as Error };
  }
}

/**
 * Update a creator by ID
 */
export async function update(id: string, updates: CreatorUpdate): Promise<ApiResponse<Creator>> {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return { data: null, error: new Error('Not authenticated') };
    }

    // Verify the creator belongs to the user
    const { data: existing, error: fetchError } = await supabase
      .from('creators')
      .select('user_id')
      .eq('id', id)
      .single();

    if (fetchError || !existing) {
      return { data: null, error: new Error('Creator not found') };
    }

    if (existing.user_id !== user.id) {
      return { data: null, error: new Error('Unauthorized') };
    }

    const { data: updated, error: updateError } = await supabase
      .from('creators')
      .update(updates)
      .eq('id', id)
      .select()
      .single();

    if (updateError) {
      return { data: null, error: updateError };
    }

    return { data: updated, error: null };
  } catch (err) {
    return { data: null, error: err as Error };
  }
}

/**
 * Delete a creator by ID
 */
export async function deleteCreator(id: string): Promise<ApiResponse<void>> {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return { data: null, error: new Error('Not authenticated') };
    }

    // Verify the creator belongs to the user
    const { data: existing, error: fetchError } = await supabase
      .from('creators')
      .select('user_id')
      .eq('id', id)
      .single();

    if (fetchError || !existing) {
      return { data: null, error: new Error('Creator not found') };
    }

    if (existing.user_id !== user.id) {
      return { data: null, error: new Error('Unauthorized') };
    }

    const { error: deleteError } = await supabase
      .from('creators')
      .delete()
      .eq('id', id);

    if (deleteError) {
      return { data: null, error: deleteError };
    }

    return { data: undefined, error: null };
  } catch (err) {
    return { data: null, error: err as Error };
  }
}

/**
 * Add creators to a campaign
 */
export async function addCreatorsToCampaign(
  campaignId: string,
  creatorIds: string[]
): Promise<ApiResponse<CampaignCreator[]>> {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return { data: null, error: new Error('Not authenticated') };
    }

    // Verify campaign belongs to user
    const { data: campaign, error: campaignError } = await supabase
      .from('campaigns')
      .select('user_id')
      .eq('id', campaignId)
      .single();

    if (campaignError || !campaign) {
      return { data: null, error: new Error('Campaign not found') };
    }

    // Verify all creators belong to user
    const { data: userCreators, error: creatorsError } = await supabase
      .from('creators')
      .select('id')
      .eq('user_id', user.id)
      .in('id', creatorIds);

    if (creatorsError) {
      return { data: null, error: creatorsError };
    }

    if (!userCreators || userCreators.length !== creatorIds.length) {
      return { data: null, error: new Error('Some creators not found or unauthorized') };
    }

    // Insert campaign-creator relationships (ignore duplicates)
    const relationships = creatorIds.map(creatorId => ({
      campaign_id: campaignId,
      creator_id: creatorId,
    }));

    const { data: inserted, error: insertError } = await supabase
      .from('campaign_creators')
      .insert(relationships)
      .select();

    if (insertError) {
      // If error is due to duplicates, fetch existing ones
      if (insertError.code === '23505') {
        const { data: existing } = await supabase
          .from('campaign_creators')
          .select('*')
          .eq('campaign_id', campaignId)
          .in('creator_id', creatorIds);
        return { data: existing || [], error: null };
      }
      return { data: null, error: insertError };
    }

    return { data: inserted || [], error: null };
  } catch (err) {
    return { data: null, error: err as Error };
  }
}

/**
 * Remove a creator from a campaign
 */
export async function removeCreatorFromCampaign(
  campaignId: string,
  creatorId: string
): Promise<ApiResponse<void>> {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return { data: null, error: new Error('Not authenticated') };
    }

    // Verify campaign belongs to user
    const { data: campaign, error: campaignError } = await supabase
      .from('campaigns')
      .select('user_id')
      .eq('id', campaignId)
      .single();

    if (campaignError || !campaign) {
      return { data: null, error: new Error('Campaign not found') };
    }

    const { error: deleteError } = await supabase
      .from('campaign_creators')
      .delete()
      .eq('campaign_id', campaignId)
      .eq('creator_id', creatorId);

    if (deleteError) {
      return { data: null, error: deleteError };
    }

    return { data: undefined, error: null };
  } catch (err) {
    return { data: null, error: err as Error };
  }
}

/**
 * Get creators for a specific campaign
 */
export async function getCampaignCreators(
  campaignId: string
): Promise<ApiResponse<CampaignCreator[]>> {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return { data: null, error: new Error('Not authenticated') };
    }

    // Verify campaign belongs to user
    const { data: campaign, error: campaignError } = await supabase
      .from('campaigns')
      .select('user_id')
      .eq('id', campaignId)
      .single();

    if (campaignError || !campaign) {
      return { data: null, error: new Error('Campaign not found') };
    }

    const { data: campaignCreators, error: fetchError } = await supabase
      .from('campaign_creators')
      .select('*')
      .eq('campaign_id', campaignId);

    if (fetchError) {
      return { data: null, error: fetchError };
    }

    return { data: campaignCreators || [], error: null };
  } catch (err) {
    return { data: null, error: err as Error };
  }
}

/**
 * Add creators to multiple campaigns at once
 */
export async function addCreatorsToMultipleCampaigns(
  campaignIds: string[],
  creatorIds: string[]
): Promise<ApiResponse<CampaignCreator[]>> {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return { data: null, error: new Error('Not authenticated') };
    }

    if (campaignIds.length === 0 || creatorIds.length === 0) {
      return { data: [], error: null };
    }

    // Verify all campaigns belong to user
    const { data: userCampaigns, error: campaignsError } = await supabase
      .from('campaigns')
      .select('id')
      .eq('user_id', user.id)
      .in('id', campaignIds);

    if (campaignsError) {
      return { data: null, error: campaignsError };
    }

    if (!userCampaigns || userCampaigns.length !== campaignIds.length) {
      return { data: null, error: new Error('Some campaigns not found or unauthorized') };
    }

    // Verify all creators belong to user
    const { data: userCreators, error: creatorsError } = await supabase
      .from('creators')
      .select('id')
      .eq('user_id', user.id)
      .in('id', creatorIds);

    if (creatorsError) {
      return { data: null, error: creatorsError };
    }

    if (!userCreators || userCreators.length !== creatorIds.length) {
      return { data: null, error: new Error('Some creators not found or unauthorized') };
    }

    // Create all relationships (campaign x creator combinations)
    const relationships: Array<{ campaign_id: string; creator_id: string }> = [];
    for (const campaignId of campaignIds) {
      for (const creatorId of creatorIds) {
        relationships.push({
          campaign_id: campaignId,
          creator_id: creatorId,
        });
      }
    }

    // Insert all relationships (ignore duplicates)
    const { data: inserted, error: insertError } = await supabase
      .from('campaign_creators')
      .insert(relationships)
      .select();

    if (insertError) {
      // If error is due to duplicates, fetch existing ones
      if (insertError.code === '23505') {
        const { data: existing } = await supabase
          .from('campaign_creators')
          .select('*')
          .in('campaign_id', campaignIds)
          .in('creator_id', creatorIds);
        return { data: existing || [], error: null };
      }
      return { data: null, error: insertError };
    }

    return { data: inserted || [], error: null };
  } catch (err) {
    return { data: null, error: err as Error };
  }
}
