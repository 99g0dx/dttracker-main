import { supabase } from '../supabase';
import type { Creator, CreatorInsert, CreatorUpdate, CreatorWithStats, CampaignCreator, Platform, ApiResponse, ApiListResponse } from '../types/database';

type WorkspaceCreatorKeys = {
  workspaceId: string;
  ownerUserId: string | null;
};

async function isCompanyAdmin(): Promise<boolean> {
  try {
    const { data, error } = await supabase.rpc('is_company_admin');
    if (error) {
      return false;
    }
    return Boolean(data);
  } catch {
    return false;
  }
}

async function getWorkspaceCreatorKeys(workspaceId: string): Promise<WorkspaceCreatorKeys> {
  const { data, error } = await supabase
    .from('workspaces')
    .select('id, owner_user_id')
    .eq('id', workspaceId)
    .maybeSingle();

  if (error || !data) {
    return { workspaceId, ownerUserId: null };
  }

  return { workspaceId: data.id, ownerUserId: data.owner_user_id };
}

function buildWorkspaceCreatorsFilter(keys: WorkspaceCreatorKeys): string {
  const filters = [
    `workspace_id.eq.${keys.workspaceId}`,
    `workspace_uuid.eq.${keys.workspaceId}`,
  ];

  if (keys.ownerUserId) {
    filters.push(`workspace_id.eq.${keys.ownerUserId}`);
  }

  return filters.join(',');
}

async function resolveWorkspaceId(
  workspaceId?: string | null
): Promise<{ workspaceId: string | null; error: Error | null }> {
  if (workspaceId) {
    return { workspaceId, error: null };
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { workspaceId: null, error: new Error('Not authenticated') };
  }

  const { data, error } = await supabase
    .from('workspace_members')
    .select('workspace_id')
    .eq('user_id', user.id)
    .eq('status', 'active')
    .order('created_at', { ascending: true })
    .limit(1)
    .maybeSingle();

  if (error || !data?.workspace_id) {
    return { workspaceId: null, error: new Error('Workspace not found') };
  }

  return { workspaceId: data.workspace_id, error: null };
}

/**
 * Helper function to ensure a creator is in workspace_creators
 */
async function ensureWorkspaceCreator(
  workspaceId: string,
  creatorId: string,
  sourceType: 'manual' | 'csv_import' | 'scraper_extraction' | null = 'manual'
): Promise<void> {
  const sourceMap: Record<string, 'scraper' | 'csv' | 'manual'> = {
    scraper_extraction: 'scraper',
    csv_import: 'csv',
    manual: 'manual',
  };

  const mappedSource = sourceMap[sourceType ?? 'manual'] ?? 'manual';
  const workspaceKeys = await getWorkspaceCreatorKeys(workspaceId);

  if (import.meta.env.DEV) {
    const { data: sessionData } = await supabase.auth.getSession();
    console.log('[Workspace Creator Upsert]', {
      workspace_id: workspaceId,
      workspace_uuid: workspaceKeys.workspaceId,
      workspace_owner_id: workspaceKeys.ownerUserId,
      creator_id: creatorId,
      source: mappedSource,
      user_id: sessionData?.session?.user?.id,
      user_email: sessionData?.session?.user?.email,
    });
  }

  let { error } = await supabase
    .from('workspace_creators')
    .upsert(
      {
        workspace_id: workspaceKeys.workspaceId,
        workspace_uuid: workspaceKeys.workspaceId,
        creator_id: creatorId,
        source: mappedSource,
      },
      { onConflict: 'workspace_id,creator_id' }
    );

  if (
    error &&
    (error as any).code === '23503' &&
    error.message.includes('workspace_creators_workspace_id_fkey') &&
    workspaceKeys.ownerUserId
  ) {
    ({ error } = await supabase
      .from('workspace_creators')
      .upsert(
        {
          workspace_id: workspaceKeys.ownerUserId,
          workspace_uuid: workspaceKeys.workspaceId,
          creator_id: creatorId,
          source: mappedSource,
        },
        { onConflict: 'workspace_id,creator_id' }
      ));
  }

  if (error) {
    const msg = String((error as any).message || '');
    const isRlsOrPolicy =
      msg.includes('row-level security') ||
      msg.includes('workspace_creators') ||
      msg.includes('policy');
    const isConflict = (error as any).code === '23505';
    if (isRlsOrPolicy || isConflict) {
      const workspaceIds = [workspaceKeys.workspaceId];
      if (workspaceKeys.ownerUserId) workspaceIds.push(workspaceKeys.ownerUserId);
      const { data: rows } = await supabase
        .from('workspace_creators')
        .select('creator_id')
        .eq('creator_id', creatorId)
        .in('workspace_id', workspaceIds)
        .limit(1);
      if (rows && rows.length > 0) {
        return;
      }
    }
    console.error('[Workspace Creator Upsert Failed]', {
      message: error.message,
      code: (error as any).code,
      workspace_id: workspaceId,
      creator_id: creatorId,
    });
    throw error;
  }
}


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
  sourceType?: 'manual' | 'csv_import' | 'scraper_extraction' | null,
  workspaceId?: string | null
): Promise<ApiResponse<Creator>> {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return { data: null, error: new Error('Not authenticated') };
    }

    const { workspaceId: targetWorkspaceId, error: workspaceError } =
      await resolveWorkspaceId(workspaceId);
    if (workspaceError || !targetWorkspaceId) {
      return { data: null, error: workspaceError || new Error('Workspace not found') };
    }

    // First, try to find existing creator by platform + handle
    const { data: existing, error: fetchError } = await supabase
      .from('creators')
      .select('*')
      .eq('platform', platform)
      .eq('handle', handle)
      .maybeSingle();

    if (fetchError && fetchError.code !== 'PGRST116') { // PGRST116 = no rows returned
      return { data: null, error: fetchError };
    }

    let creator: Creator;

    if (existing) {
      // Creator exists globally, use it
      creator = existing;
    } else {
      // Create new creator
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
        // created_by_workspace_id: user.id, // Track who introduced this creator
      };

      const { data: created, error: createError } = await supabase
        .from('creators')
        .insert(creatorData)
        .select()
        .single();

      if (createError) {
        // Race: another request already inserted this creator (e.g. double-tap Add & Scrape). Refetch and use existing.
        const isUniqueViolation =
          (createError as any).code === '23505' ||
          (typeof (createError as any).code === 'string' && (createError as any).code === '23505') ||
          String((createError as any).message || '').includes('creators_platform_handle_unique') ||
          String((createError as any).message || '').includes('duplicate key');
        if (isUniqueViolation) {
          const { data: existingAfterRace, error: refetchError } = await supabase
            .from('creators')
            .select('*')
            .eq('platform', platform)
            .eq('handle', handle)
            .maybeSingle();
          if (refetchError || !existingAfterRace) {
            return { data: null, error: createError };
          }
          creator = existingAfterRace;
        } else {
          return { data: null, error: createError };
        }
      } else {
        creator = created!;
      }
    }

    // Ensure creator is in workspace_creators (for My Network)
    await ensureWorkspaceCreator(targetWorkspaceId, creator.id, sourceType || 'manual');

    return { data: creator, error: null };
  } catch (err) {
    return { data: null, error: err as Error };
  }
}

/**
 * List all creators for the current workspace (My Network)
 */
export async function list(
  scope: "my_network" | "all" = "my_network",
  workspaceId?: string | null
): Promise<ApiResponse<Creator[]>> {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return { data: null, error: new Error('Not authenticated') };
    }

    if (await isCompanyAdmin()) {
      const { data, error } = await supabase
        .from("creators")
        .select("*")
        .order("name", { ascending: true });
      if (error) {
        return { data: null, error };
      }
      return { data: data || [], error: null };
    }

    const { workspaceId: targetWorkspaceId, error: workspaceError } =
      await resolveWorkspaceId(workspaceId);
    if (workspaceError || !targetWorkspaceId) {
      return { data: null, error: workspaceError || new Error('Workspace not found') };
    }
    const workspaceKeys = await getWorkspaceCreatorKeys(targetWorkspaceId);

    // Join workspace_creators with creators
    if (scope === "my_network") {
        const { data, error } = await supabase
          .from("workspace_creators")
          .select(`
            creator_id,
            creators:creator_id (*)
          `)
          .or(buildWorkspaceCreatorsFilter(workspaceKeys))
          .order("created_at", { ascending: false });

        if (error) return { data: null, error };

        const creators = (data ?? [])
          .map((wc: any) => wc.creators)
          .filter(Boolean)
          .sort((a, b) => a.name.localeCompare(b.name));

        return { data: creators, error: null };
      }

      const { data: myCreators } = await supabase
          .from("workspace_creators")
          .select("creator_id")
          .or(buildWorkspaceCreatorsFilter(workspaceKeys));

        const myCreatorIds = myCreators?.map(c => c.creator_id) ?? [];

        let query = supabase
          .from("creators")
          .select("*")
          .order("name", { ascending: true });

        if (myCreatorIds.length > 0) {
          const formattedIds = myCreatorIds.map(id => `"${id}"`).join(",");
          query = query.not("id", "in", `(${formattedIds})`);
        }

        const { data, error } = await query;

        if (error) return { data: null, error };

        return { data, error: null };


  } catch (err) {
    return { data: null, error: err as Error };
  }
}

/**
 * Get creators assigned to a specific campaign roster
 */
export async function getByCampaign(
  campaignId: string,
  workspaceId?: string | null
): Promise<ApiResponse<Creator[]>> {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return { data: null, error: new Error('Not authenticated') };
    }

    const { workspaceId: targetWorkspaceId, error: workspaceError } =
      await resolveWorkspaceId(workspaceId);
    if (workspaceError || !targetWorkspaceId) {
      return { data: null, error: workspaceError || new Error('Workspace not found') };
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

    const { data: campaign, error: campaignError } = await supabase
      .from('campaigns')
      .select('workspace_id')
      .eq('id', campaignId)
      .single();

    if (campaignError || !campaign?.workspace_id) {
      return { data: null, error: campaignError || new Error('Campaign not found') };
    }

    const campaignWorkspaceId = campaign.workspace_id;

    // Fetch creators for all unique IDs (only My Network creators for campaigns)
    // Join workspace_creators to ensure we only get workspace-owned creators
    const workspaceKeys = await getWorkspaceCreatorKeys(campaignWorkspaceId);
    const { data: workspaceCreators, error: creatorsError } = await supabase
      .from('workspace_creators')
      .select(`
        creator_id,
        creators:creator_id (*)
      `)
      .or(buildWorkspaceCreatorsFilter(workspaceKeys))
      .in('creator_id', Array.from(creatorIds));

    if (creatorsError) {
      return { data: null, error: creatorsError };
    }

    // Extract creators and deduplicate
    const creators = (workspaceCreators || [])
      .map((wc: any) => wc.creators)
      .filter(Boolean) as Creator[];

    // Deduplicate by creator_id to ensure uniqueness
    const uniqueCreatorsMap = new Map<string, Creator>();
    creators.forEach((creator) => {
      if (creator.id && !uniqueCreatorsMap.has(creator.id)) {
        uniqueCreatorsMap.set(creator.id, creator);
      }
    });

    // Sort by name
    const sortedCreators = Array.from(uniqueCreatorsMap.values());
    sortedCreators.sort((a, b) => a.name.localeCompare(b.name));

    return { data: sortedCreators, error: null };
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

export async function createMany(
  creators: CreatorInsert[],
  workspaceId?: string | null
): Promise<ApiResponse<BulkCreateResult>> {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return { data: null, error: new Error('Not authenticated') };
    }

    const { workspaceId: targetWorkspaceId, error: workspaceError } =
      await resolveWorkspaceId(workspaceId);
    if (workspaceError || !targetWorkspaceId) {
      return { data: null, error: workspaceError || new Error('Workspace not found') };
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
    
    // Step 1: Deduplicate creators within batch
    const processedKeys = new Set<string>();
    const uniqueCreators: CreatorInsert[] = [];

    for (const creatorData of creators) {
      const key = `${creatorData.handle}:${creatorData.platform}`;
      
      // Skip duplicates within the import batch
      if (processedKeys.has(key)) {
        continue;
      }
      processedKeys.add(key);

      uniqueCreators.push({
        ...creatorData,
        user_id: user.id,
        imported_by_user_id: creatorData.imported_by_user_id || user.id,
        source_type: creatorData.source_type || 'csv_import',
        // created_by_workspace_id: user.id, // Track who introduced this creator
      });
    }

    // Step 2: Upsert creators (insert or update if exists by platform+handle)
    const upsertedCreators: Creator[] = [];

    for (const creatorData of uniqueCreators) {
      const { data: existing } = await supabase
        .from('creators')
        .select('*')
        .eq('platform', creatorData.platform)
        .eq('handle', creatorData.handle)
        .maybeSingle();

      let creator: Creator;

      if (existing) {
        creator = existing;
      } else {
        const { data: created, error: createError } = await supabase
          .from('creators')
          .insert(creatorData)
          .select()
          .single();

        if (createError || !created) {
          result.error_count++;
          result.errors.push({
            handle: creatorData.handle,
            platform: creatorData.platform,
            message: createError?.message || 'Unknown error',
          });
          continue;
        }

        creator = created;
      }

      const { workspaceId: targetWorkspaceId, error: workspaceError } =
        await resolveWorkspaceId(workspaceId);
      if (workspaceError || !targetWorkspaceId) {
        result.error_count++;
        result.errors.push({
          handle: creatorData.handle,
          platform: creatorData.platform,
          message: workspaceError?.message || 'Workspace not found',
        });
        continue;
      }
      // Ensure creator is in workspace_creators
      await ensureWorkspaceCreator(
        targetWorkspaceId,
        creator.id,
        creatorData.source_type || 'csv_import'
      );

      upsertedCreators.push(creator);
    }


    result.success_count = upsertedCreators.length;
    result.creators = upsertedCreators;

    console.log('📊 Import complete:', {
      total: result.success_count,
      errors: result.error_count
    });

    return { data: result, error: null };
  } catch (err) {
    return { data: null, error: err as Error };
  }
}

/**
 * List all creators with stats (campaigns count, total posts)
 * - 'my_network': Returns creators from workspace_creators table (owned by workspace)
 * - 'all': Returns creators from agency_inventory table (marketplace)
 */
export async function listWithStats(
  networkFilter?: 'my_network' | 'all',
  workspaceId?: string | null
): Promise<ApiResponse<CreatorWithStats[]>> {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return { data: null, error: new Error('Not authenticated') };
    }

    const companyAdmin = await isCompanyAdmin();
    if (companyAdmin) {
      const { data, error } = await supabase
        .from('creators')
        .select(`
          id,
          name,
          handle,
          email,
          phone,
          platform,
          follower_count,
          avg_engagement,
          niche,
          location
        `)
        .order('name', { ascending: true });

      if (error) {
        return { data: null, error };
      }

      const creators = (data || []) as Creator[];
      if (creators.length === 0) {
        return { data: [], error: null };
      }

      const creatorIds = creators.map((creator) => creator.id);
      const { data: posts, error: postsError } = await supabase
        .from('posts')
        .select('creator_id, campaign_id')
        .in('creator_id', creatorIds);

      if (postsError) {
        return { data: null, error: postsError };
      }

      const { data: campaignCreators, error: campaignCreatorsError } = await supabase
        .from('campaign_creators')
        .select('creator_id, campaign_id')
        .in('creator_id', creatorIds);

      if (campaignCreatorsError) {
        console.warn('⚠️ Could not fetch campaign_creators:', campaignCreatorsError.message);
      }

      const creatorsWithStats: CreatorWithStats[] = creators.map((creator) => {
        const creatorPosts = posts?.filter((p) => p.creator_id === creator.id) || [];
        const creatorCampaignRelations =
          campaignCreators?.filter((cc) => cc.creator_id === creator.id) || [];
        const campaignsSet = new Set([
          ...creatorPosts.map((p) => p.campaign_id),
          ...creatorCampaignRelations.map((cc) => cc.campaign_id),
        ]);

        return {
          ...creator,
          campaigns: campaignsSet.size,
          totalPosts: creatorPosts.length,
        };
      });

      return { data: creatorsWithStats, error: null };
    }

    const { workspaceId: targetWorkspaceId, error: workspaceError } =
      await resolveWorkspaceId(workspaceId);
    if (workspaceError || !targetWorkspaceId) {
      return { data: null, error: workspaceError || new Error('Workspace not found') };
    }
    const workspaceKeys = await getWorkspaceCreatorKeys(targetWorkspaceId);

    let creators: Creator[] = [];

    if (networkFilter === 'my_network') {
      // My Network: Join workspace_creators with creators
      const { data: workspaceCreators, error: workspaceError } = await supabase
        .from('workspace_creators')
        .select(`
          creator_id,
          creators:creator_id (
            id,
            name,
            handle,
            email,
            phone,
            platform,
            follower_count,
            avg_engagement,
            niche,
            location
          )
        `)
        .or(buildWorkspaceCreatorsFilter(workspaceKeys));

      if (workspaceError) {
        console.error('❌ Error fetching workspace creators:', workspaceError);
        return { data: null, error: workspaceError };
      }

      creators = (workspaceCreators || [])
        .map((wc: any) => wc.creators)
        .filter(Boolean) as Creator[];

      console.log(`📥 Fetched ${creators.length} creators from My Network`);
    } else if (networkFilter === 'all') {
      // All Creators = only agency_inventory (marketplace / admin-imported). User-added creators stay in My Network only.
      try {
        const { data: inventory, error: inventoryError } = await supabase
          .from('agency_inventory')
          .select('creator_id')
          .eq('status', 'active');

        if (inventoryError) {
          console.warn('⚠️ agency_inventory not available:', inventoryError.message);
          creators = [];
        } else if (inventory && inventory.length > 0) {
          const creatorIds = inventory.map((row: { creator_id: string }) => row.creator_id);
          const { data: creatorRows, error: creatorsError } = await supabase
            .from('creators')
            .select(`
              id,
              name,
              handle,
              platform,
              follower_count,
              avg_engagement,
              niche,
              location
            `)
            .in('id', creatorIds)
            .order('name', { ascending: true });

          if (creatorsError) {
            console.error('❌ Error fetching creators from agency_inventory:', creatorsError);
            return { data: null, error: creatorsError };
          }
          creators = (creatorRows || []) as Creator[];
        } else {
          creators = [];
        }
      } catch (err) {
        console.warn('⚠️ All Creators (agency_inventory) failed:', err);
        creators = [];
      }
    } else {
      // Default to my_network
      const { data: workspaceCreators, error: workspaceError } = await supabase
        .from('workspace_creators')
        .select(`
          creator_id,
          creators:creator_id (
            id,
            name,
            handle,
            email,
            phone,
            platform,
            follower_count,
            avg_engagement,
            niche,
            location
          )
        `)
        .or(buildWorkspaceCreatorsFilter(workspaceKeys));

      if (workspaceError) {
        return { data: null, error: workspaceError };
      }

      creators = (workspaceCreators || [])
        .map((wc: any) => wc.creators)
        .filter(Boolean) as Creator[];
    }

    if (creators.length === 0) {
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

    // Calculate stats for each creator and filter contact fields
    const creatorsWithStats: CreatorWithStats[] = creators.map((creator) => {
      const creatorPosts = posts?.filter(p => p.creator_id === creator.id) || [];
      const creatorCampaignRelations = campaignCreators?.filter(cc => cc.creator_id === creator.id) || [];
      const campaignsSet = new Set([
        ...creatorPosts.map(p => p.campaign_id),
        ...creatorCampaignRelations.map(cc => cc.campaign_id)
      ]);
      
      // Filter contact fields based on network filter:
      // - My Network: show full contacts (workspace-owned)
      // - All Creators: always hide contacts (marketplace)
      const filteredCreator = {
        ...creator,
        email: networkFilter === 'all' ? null : creator.email,
        phone: networkFilter === 'all' ? null : creator.phone,
        campaigns: campaignsSet.size,
        totalPosts: creatorPosts.length,
      };
      
      return filteredCreator;
    });

    return { data: creatorsWithStats, error: null };
  } catch (err) {
    return { data: null, error: err as Error };
  }
}

/**
 * Update a creator by ID
 */
export async function update(
  id: string,
  updates: CreatorUpdate,
  workspaceId?: string | null
): Promise<ApiResponse<Creator>> {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return { data: null, error: new Error('Not authenticated') };
    }

    const { workspaceId: targetWorkspaceId, error: workspaceError } =
      await resolveWorkspaceId(workspaceId);
    if (workspaceError || !targetWorkspaceId) {
      return { data: null, error: workspaceError || new Error('Workspace not found') };
    }
    const workspaceKeys = await getWorkspaceCreatorKeys(targetWorkspaceId);
    // Verify the creator belongs to the workspace (check workspace_creators)
    const { data: workspaceCreator, error: fetchError } = await supabase
      .from('workspace_creators')
      .select('creator_id')
      .or(buildWorkspaceCreatorsFilter(workspaceKeys))
      .eq('creator_id', id)
      .maybeSingle();

    if (fetchError || !workspaceCreator) {
      return { data: null, error: new Error('Creator not found or unauthorized') };
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
export async function deleteCreator(
  id: string,
  workspaceId?: string | null
): Promise<ApiResponse<void>> {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return { data: null, error: new Error('Not authenticated') };
    }

    const { workspaceId: targetWorkspaceId, error: workspaceError } =
      await resolveWorkspaceId(workspaceId);
    if (workspaceError || !targetWorkspaceId) {
      return { data: null, error: workspaceError || new Error('Workspace not found') };
    }
    const workspaceKeys = await getWorkspaceCreatorKeys(targetWorkspaceId);
    // Verify the creator belongs to the workspace (check workspace_creators)
    const { data: workspaceCreator, error: fetchError } = await supabase
      .from('workspace_creators')
      .select('creator_id')
      .or(buildWorkspaceCreatorsFilter(workspaceKeys))
      .eq('creator_id', id)
      .maybeSingle();

    if (fetchError || !workspaceCreator) {
      return { data: null, error: new Error('Creator not found or unauthorized') };
    }

    // Delete from workspace_creators (removes from My Network)
    // Note: This doesn't delete the creator from the global creators table
    const { error: deleteError } = await supabase
      .from('workspace_creators')
      .delete()
      .or(buildWorkspaceCreatorsFilter(workspaceKeys))
      .eq('creator_id', id);

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
  creatorIds: string[],
  workspaceId?: string | null
): Promise<ApiResponse<CampaignCreator[]>> {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return { data: null, error: new Error('Not authenticated') };
    }

    // Verify campaign belongs to workspace
    const { data: campaign, error: campaignError } = await supabase
      .from('campaigns')
      .select('workspace_id')
      .eq('id', campaignId)
      .single();

    if (campaignError || !campaign) {
      return { data: null, error: new Error('Campaign not found') };
    }

    const targetWorkspaceId = campaign.workspace_id;
    if (!targetWorkspaceId) {
      return { data: null, error: new Error('Campaign workspace not found') };
    }

    // Verify all creators belong to workspace (My Network creators only)
    // Check via workspace_creators table
    const workspaceKeys = await getWorkspaceCreatorKeys(targetWorkspaceId);
    const { data: workspaceCreators, error: creatorsError } = await supabase
      .from('workspace_creators')
      .select('creator_id')
      .or(buildWorkspaceCreatorsFilter(workspaceKeys))
      .in('creator_id', creatorIds);

    if (creatorsError) {
      return { data: null, error: creatorsError };
    }

    const workspaceCreatorIds = new Set((workspaceCreators || []).map((wc: any) => wc.creator_id));
    const missingCreatorIds = creatorIds.filter((id) => !workspaceCreatorIds.has(id));

    if (missingCreatorIds.length > 0) {
      for (const creatorId of missingCreatorIds) {
        await ensureWorkspaceCreator(targetWorkspaceId, creatorId, 'scraper_extraction');
      }

      const { data: refreshedCreators, error: refreshError } = await supabase
        .from('workspace_creators')
        .select('creator_id')
        .or(buildWorkspaceCreatorsFilter(workspaceKeys))
        .in('creator_id', creatorIds);

      if (refreshError) {
        return { data: null, error: refreshError };
      }

      const refreshedIds = new Set((refreshedCreators || []).map((wc: any) => wc.creator_id));
      const stillMissing = creatorIds.some((id) => !refreshedIds.has(id));
      if (stillMissing) {
        return { data: null, error: new Error('Some creators not found or unauthorized') };
      }
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
  creatorId: string,
  workspaceId?: string | null
): Promise<ApiResponse<void>> {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return { data: null, error: new Error('Not authenticated') };
    }

    // Verify campaign belongs to workspace
    const { data: campaign, error: campaignError } = await supabase
      .from('campaigns')
      .select('workspace_id')
      .eq('id', campaignId)
      .single();

    if (campaignError || !campaign) {
      return { data: null, error: new Error('Campaign not found') };
    }

    const targetWorkspaceId = campaign.workspace_id;
    if (!targetWorkspaceId) {
      return { data: null, error: new Error('Campaign workspace not found') };
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
  campaignId: string,
  workspaceId?: string | null
): Promise<ApiResponse<CampaignCreator[]>> {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return { data: null, error: new Error('Not authenticated') };
    }

    // Verify campaign belongs to workspace
    const { data: campaign, error: campaignError } = await supabase
      .from('campaigns')
      .select('workspace_id')
      .eq('id', campaignId)
      .single();

    if (campaignError || !campaign) {
      return { data: null, error: new Error('Campaign not found') };
    }

    const targetWorkspaceId = campaign.workspace_id;
    if (!targetWorkspaceId) {
      return { data: null, error: new Error('Campaign workspace not found') };
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
 * Get creator IDs for multiple campaigns
 */
export async function getCampaignCreatorIds(
  campaignIds: string[]
): Promise<ApiResponse<string[]>> {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return { data: null, error: new Error('Not authenticated') };
    }

    if (campaignIds.length === 0) {
      return { data: [], error: null };
    }

    const { data, error } = await supabase
      .from('campaign_creators')
      .select('creator_id')
      .in('campaign_id', campaignIds);

    if (error) {
      return { data: null, error };
    }

    const { data: postsData, error: postsError } = await supabase
      .from('posts')
      .select('creator_id')
      .in('campaign_id', campaignIds);

    if (postsError) {
      return { data: null, error: postsError };
    }

    const creatorIds = Array.from(new Set([
      ...(data || []).map(row => row.creator_id),
      ...(postsData || []).map(row => row.creator_id),
    ]));
    return { data: creatorIds, error: null };
  } catch (err) {
    return { data: null, error: err as Error };
  }
}

/**
 * Add creators to multiple campaigns at once
 */
export async function addCreatorsToMultipleCampaigns(
  campaignIds: string[],
  creatorIds: string[],
  workspaceId?: string | null
): Promise<ApiResponse<CampaignCreator[]>> {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return { data: null, error: new Error('Not authenticated') };
    }

    const { workspaceId: targetWorkspaceId, error: workspaceError } =
      await resolveWorkspaceId(workspaceId);
    if (workspaceError || !targetWorkspaceId) {
      return { data: null, error: workspaceError || new Error('Workspace not found') };
    }

    if (campaignIds.length === 0 || creatorIds.length === 0) {
      return { data: [], error: null };
    }

    // Verify all campaigns belong to workspace
    const { data: userCampaigns, error: campaignsError } = await supabase
      .from('campaigns')
      .select('id')
      .eq('workspace_id', targetWorkspaceId)
      .in('id', campaignIds);

    if (campaignsError) {
      return { data: null, error: campaignsError };
    }

    if (!userCampaigns || userCampaigns.length !== campaignIds.length) {
      return { data: null, error: new Error('Some campaigns not found or unauthorized') };
    }

    // Verify all creators belong to workspace (My Network creators only)
    // Check via workspace_creators table
    const workspaceKeys = await getWorkspaceCreatorKeys(targetWorkspaceId);
    const { data: workspaceCreators, error: creatorsError } = await supabase
      .from('workspace_creators')
      .select('creator_id')
      .or(buildWorkspaceCreatorsFilter(workspaceKeys))
      .in('creator_id', creatorIds);

    if (creatorsError) {
      return { data: null, error: creatorsError };
    }

    const workspaceCreatorIds = new Set((workspaceCreators || []).map((wc: any) => wc.creator_id));
    const missingCreatorIds = creatorIds.filter((id) => !workspaceCreatorIds.has(id));

    if (missingCreatorIds.length > 0) {
      for (const creatorId of missingCreatorIds) {
        await ensureWorkspaceCreator(targetWorkspaceId, creatorId, 'scraper_extraction');
      }

      const { data: refreshedCreators, error: refreshError } = await supabase
        .from('workspace_creators')
        .select('creator_id')
        .or(buildWorkspaceCreatorsFilter(workspaceKeys))
        .in('creator_id', creatorIds);

      if (refreshError) {
        return { data: null, error: refreshError };
      }

      const refreshedIds = new Set((refreshedCreators || []).map((wc: any) => wc.creator_id));
      const stillMissing = creatorIds.some((id) => !refreshedIds.has(id));
      if (stillMissing) {
        return { data: null, error: new Error('Some creators not found or unauthorized') };
      }
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
