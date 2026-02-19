import { supabase } from "../supabase";
import { normalizeHandle } from "../utils/urlParser";
import type {
  Creator,
  CreatorInsert,
  CreatorUpdate,
  CreatorWithStats,
  CreatorWithSocialAndStats,
  CreatorSocialAccount,
  CreatorStats,
  CampaignCreator,
  Platform,
  ApiResponse,
  ApiListResponse,
} from "../types/database";

export interface CreatorFilters {
  platforms?: Platform[];
  niches?: string[];
  followerMin?: number;
  followerMax?: number;
  followerTier?: string;
  location?: string;
  engagementMin?: number;
  sortBy?: string;
  sortDir?: "asc" | "desc";
}

type WorkspaceCreatorKeys = {
  workspaceId: string;
  ownerUserId: string | null;
};

async function isCompanyAdmin(): Promise<boolean> {
  try {
    const { data, error } = await supabase.rpc("is_company_admin");
    if (error) {
      return false;
    }
    return Boolean(data);
  } catch {
    return false;
  }
}

async function getWorkspaceCreatorKeys(
  workspaceId: string
): Promise<WorkspaceCreatorKeys> {
  const { data, error } = await supabase
    .from("workspaces")
    .select("id, owner_user_id")
    .eq("id", workspaceId)
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

  return filters.join(",");
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
    return { workspaceId: null, error: new Error("Not authenticated") };
  }

  const { data, error } = await supabase
    .from("workspace_members")
    .select("workspace_id")
    .eq("user_id", user.id)
    .eq("status", "active")
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();

  if (error || !data?.workspace_id) {
    return { workspaceId: null, error: new Error("Workspace not found") };
  }

  return { workspaceId: data.workspace_id, error: null };
}

/**
 * Helper function to ensure a creator is in workspace_creators
 */
async function ensureWorkspaceCreator(
  workspaceId: string,
  creatorId: string,
  sourceType: "manual" | "csv_import" | "scraper_extraction" | null = "manual"
): Promise<void> {
  const sourceMap: Record<string, "scraper" | "csv" | "manual"> = {
    scraper_extraction: "scraper",
    csv_import: "csv",
    manual: "manual",
  };

  const mappedSource = sourceMap[sourceType ?? "manual"] ?? "manual";
  const workspaceKeys = await getWorkspaceCreatorKeys(workspaceId);

  if (import.meta.env.DEV) {
    const { data: sessionData } = await supabase.auth.getSession();
    console.log("[Workspace Creator Upsert]", {
      workspace_id: workspaceId,
      workspace_uuid: workspaceKeys.workspaceId,
      workspace_owner_id: workspaceKeys.ownerUserId,
      creator_id: creatorId,
      source: mappedSource,
      user_id: sessionData?.session?.user?.id,
      user_email: sessionData?.session?.user?.email,
    });
  }

  let { error } = await supabase.from("workspace_creators").upsert(
    {
      workspace_id: workspaceKeys.workspaceId,
      workspace_uuid: workspaceKeys.workspaceId,
      creator_id: creatorId,
      source: mappedSource,
    },
    { onConflict: "workspace_id,creator_id" }
  );

  if (
    error &&
    (error as any).code === "23503" &&
    error.message.includes("workspace_creators_workspace_id_fkey") &&
    workspaceKeys.ownerUserId
  ) {
    ({ error } = await supabase.from("workspace_creators").upsert(
      {
        workspace_id: workspaceKeys.ownerUserId,
        workspace_uuid: workspaceKeys.workspaceId,
        creator_id: creatorId,
        source: mappedSource,
      },
      { onConflict: "workspace_id,creator_id" }
    ));
  }

  if (error) {
    console.error("[Workspace Creator Upsert Failed]", {
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
  sourceType?: "manual" | "csv_import" | "scraper_extraction" | null,
  workspaceId?: string | null
): Promise<ApiResponse<Creator>> {
  try {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      return { data: null, error: new Error("Not authenticated") };
    }

    const { workspaceId: targetWorkspaceId, error: workspaceError } =
      await resolveWorkspaceId(workspaceId);
    if (workspaceError || !targetWorkspaceId) {
      return {
        data: null,
        error: workspaceError || new Error("Workspace not found"),
      };
    }

    // Use the get_or_create_creator RPC which runs as SECURITY DEFINER
    // to bypass RLS on both creators and workspace_creators tables.
    const { data: creatorId, error: rpcError } = await supabase.rpc(
      "get_or_create_creator",
      {
        p_platform: platform,
        p_handle: handle,
        p_name: name || null,
        p_user_id: user.id,
        p_follower_count: followerCount || 0,
        p_email: email || null,
        p_phone: phone || null,
        p_niche: niche || null,
        p_location: location || null,
        p_source_type: sourceType || "manual",
        p_imported_by_user_id: user.id,
        p_workspace_id: targetWorkspaceId,
      }
    );

    if (rpcError || !creatorId) {
      return {
        data: null,
        error: rpcError || new Error("Failed to get or create creator"),
      };
    }

    // Fetch the full creator object (RLS will allow it since the RPC
    // already added them to workspace_creators)
    const { data: creator, error: fetchError } = await supabase
      .from("creators")
      .select("*")
      .eq("id", creatorId as string)
      .single();

    if (fetchError || !creator) {
      return {
        data: null,
        error: fetchError || new Error("Creator created but could not be fetched"),
      };
    }

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
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      return { data: null, error: new Error("Not authenticated") };
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
      return {
        data: null,
        error: workspaceError || new Error("Workspace not found"),
      };
    }
    const workspaceKeys = await getWorkspaceCreatorKeys(targetWorkspaceId);

    // Join workspace_creators with creators
    if (scope === "my_network") {
      const { data, error } = await supabase
        .from("workspace_creators")
        .select(
          `
            creator_id,
            creators:creator_id (*)
          `
        )
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

    const myCreatorIds = myCreators?.map((c) => c.creator_id) ?? [];

    let query = supabase
      .from("creators")
      .select("*")
      .order("name", { ascending: true });

    if (myCreatorIds.length > 0) {
      const formattedIds = myCreatorIds.map((id) => `"${id}"`).join(",");
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
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      return { data: null, error: new Error("Not authenticated") };
    }

    const { workspaceId: targetWorkspaceId, error: workspaceError } =
      await resolveWorkspaceId(workspaceId);
    if (workspaceError || !targetWorkspaceId) {
      return {
        data: null,
        error: workspaceError || new Error("Workspace not found"),
      };
    }

    // Primary source: Query campaign_creators table
    const { data: rosterRows, error: rosterError } = await supabase
      .from("campaign_creators")
      .select("creator_id")
      .eq("campaign_id", campaignId);

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
      .from("posts")
      .select("creator_id")
      .eq("campaign_id", campaignId)
      .not("creator_id", "is", null);

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
      .from("campaigns")
      .select("workspace_id")
      .eq("id", campaignId)
      .single();

    if (campaignError || !campaign?.workspace_id) {
      return {
        data: null,
        error: campaignError || new Error("Campaign not found"),
      };
    }

    const campaignWorkspaceId = campaign.workspace_id;

    // Fetch creators for all unique IDs (only My Network creators for campaigns)
    // Join workspace_creators to ensure we only get workspace-owned creators
    const workspaceKeys = await getWorkspaceCreatorKeys(campaignWorkspaceId);
    const { data: workspaceCreators, error: creatorsError } = await supabase
      .from("workspace_creators")
      .select(
        `
        creator_id,
        creators:creator_id (*)
      `
      )
      .or(buildWorkspaceCreatorsFilter(workspaceKeys))
      .in("creator_id", Array.from(creatorIds));

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
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      return { data: null, error: new Error("Not authenticated") };
    }

    const { workspaceId: targetWorkspaceId, error: workspaceError } =
      await resolveWorkspaceId(workspaceId);
    if (workspaceError || !targetWorkspaceId) {
      return {
        data: null,
        error: workspaceError || new Error("Workspace not found"),
      };
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
        source_type: creatorData.source_type || "csv_import",
        // created_by_workspace_id: user.id, // Track who introduced this creator
      });
    }

    // Step 2: Upsert creators (insert or update if exists by platform+handle)
    const upsertedCreators: Creator[] = [];

    for (const creatorData of uniqueCreators) {
      // Normalize handle for consistent searching/storage
      const normalizedHandle = normalizeHandle(creatorData.handle);
      if (!normalizedHandle) {
        result.error_count++;
        result.errors.push({
          handle: creatorData.handle,
          platform: creatorData.platform,
          message: "Invalid handle: handle cannot be empty",
        });
        continue;
      }

      // Resolve workspace first
      const { workspaceId: targetWorkspaceId, error: workspaceError } =
        await resolveWorkspaceId(workspaceId);
      if (workspaceError || !targetWorkspaceId) {
        result.error_count++;
        result.errors.push({
          handle: creatorData.handle,
          platform: creatorData.platform,
          message: workspaceError?.message || "Workspace not found",
        });
        continue;
      }

      // Use RPC to get-or-create creator + add to workspace (bypasses RLS)
      const { data: creatorId, error: rpcError } = await supabase.rpc(
        "get_or_create_creator",
        {
          p_platform: creatorData.platform,
          p_handle: normalizedHandle,
          p_name: creatorData.name || normalizedHandle,
          p_user_id: user.id,
          p_follower_count: creatorData.follower_count || 0,
          p_email: creatorData.email || null,
          p_phone: creatorData.phone || null,
          p_niche: creatorData.niche || null,
          p_location: creatorData.location || null,
          p_source_type: creatorData.source_type || "csv_import",
          p_imported_by_user_id: user.id,
          p_workspace_id: targetWorkspaceId,
        }
      );

      if (rpcError || !creatorId) {
        result.error_count++;
        result.errors.push({
          handle: creatorData.handle,
          platform: creatorData.platform,
          message: rpcError?.message || "Failed to get or create creator",
        });
        continue;
      }

      // Fetch full creator object (RLS allows it now since RPC added to workspace)
      const { data: creator, error: fetchErr } = await supabase
        .from("creators")
        .select("*")
        .eq("id", creatorId as string)
        .single();

      if (fetchErr || !creator) {
        result.error_count++;
        result.errors.push({
          handle: creatorData.handle,
          platform: creatorData.platform,
          message: fetchErr?.message || "Creator created but could not be fetched",
        });
        continue;
      }

      upsertedCreators.push(creator);
    }

    result.success_count = upsertedCreators.length;
    result.creators = upsertedCreators;

    console.log("📊 Import complete:", {
      total: result.success_count,
      errors: result.error_count,
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
  networkFilter?: "my_network" | "all",
  workspaceId?: string | null
): Promise<ApiResponse<CreatorWithStats[]>> {
  try {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      return { data: null, error: new Error("Not authenticated") };
    }

    const companyAdmin = await isCompanyAdmin();
    if (companyAdmin) {
      const { data, error } = await supabase
        .from("creators")
        .select(
          `
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
        `
        )
        .order("name", { ascending: true });

      if (error) {
        return { data: null, error };
      }

      const creators = (data || []) as Creator[];
      if (creators.length === 0) {
        return { data: [], error: null };
      }

      const creatorIds = creators.map((creator) => creator.id);
      const { data: posts, error: postsError } = await supabase
        .from("posts")
        .select("creator_id, campaign_id")
        .in("creator_id", creatorIds);

      if (postsError) {
        return { data: null, error: postsError };
      }

      const { data: campaignCreators, error: campaignCreatorsError } =
        await supabase
          .from("campaign_creators")
          .select("creator_id, campaign_id")
          .in("creator_id", creatorIds);

      if (campaignCreatorsError) {
        console.warn(
          "⚠️ Could not fetch campaign_creators:",
          campaignCreatorsError.message
        );
      }

      const creatorsWithStats: CreatorWithStats[] = creators.map((creator) => {
        const creatorPosts =
          posts?.filter((p) => p.creator_id === creator.id) || [];
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
      return {
        data: null,
        error: workspaceError || new Error("Workspace not found"),
      };
    }
    const workspaceKeys = await getWorkspaceCreatorKeys(targetWorkspaceId);

    let creators: Creator[] = [];

    if (networkFilter === "my_network") {
      // My Network: Join workspace_creators with creators
      const { data: workspaceCreators, error: workspaceError } = await supabase
        .from("workspace_creators")
        .select(
          `
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
        `
        )
        .or(buildWorkspaceCreatorsFilter(workspaceKeys));

      if (workspaceError) {
        console.error("❌ Error fetching workspace creators:", workspaceError);
        return { data: null, error: workspaceError };
      }

      creators = (workspaceCreators || [])
        .map((wc: any) => wc.creators)
        .filter(Boolean) as Creator[];

      console.log(`📥 Fetched ${creators.length} creators from My Network`);
    } else if (networkFilter === "all") {
      const { data: myCreators, error: myCreatorsError } = await supabase
        .from("workspace_creators")
        .select("creator_id")
        .or(buildWorkspaceCreatorsFilter(workspaceKeys));

      if (myCreatorsError) {
        console.error("❌ Error fetching workspace creators:", myCreatorsError);
        return { data: null, error: myCreatorsError };
      }

      const myCreatorIds = myCreators?.map((c) => c.creator_id) ?? [];

      let query = supabase
        .from("creators")
        .select(
          `
          id,
          name,
          handle,
          platform,
          follower_count,
          avg_engagement,
          niche,
          location
        `
        )
        .order("name", { ascending: true });

      // Exclude creators already in the user's network.
      if (myCreatorIds.length > 0) {
        const formattedIds = myCreatorIds.map((id) => `"${id}"`).join(",");
        query = query.not("id", "in", `(${formattedIds})`);
      }

      const { data, error } = await query;

      if (error) {
        console.error("❌ Error fetching all creators:", error);
        return { data: null, error };
      }

      creators = (data || []) as Creator[];
    } else {
      // Default to my_network
      const { data: workspaceCreators, error: workspaceError } = await supabase
        .from("workspace_creators")
        .select(
          `
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
        `
        )
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
    const creatorIds = creators.map((c) => c.id);
    const { data: posts, error: postsError } = await supabase
      .from("posts")
      .select("creator_id, campaign_id")
      .in("creator_id", creatorIds);

    if (postsError) {
      return { data: null, error: postsError };
    }

    // Fetch campaign_creators relationships
    const { data: campaignCreators, error: campaignCreatorsError } =
      await supabase
        .from("campaign_creators")
        .select("creator_id, campaign_id")
        .in("creator_id", creatorIds);

    if (campaignCreatorsError) {
      // Log warning but continue - table might not exist yet or be empty
      console.warn(
        "⚠️ Could not fetch campaign_creators:",
        campaignCreatorsError.message
      );
    }

    // Calculate stats for each creator and filter contact fields
    const creatorsWithStats: CreatorWithStats[] = creators.map((creator) => {
      const creatorPosts =
        posts?.filter((p) => p.creator_id === creator.id) || [];
      const creatorCampaignRelations =
        campaignCreators?.filter((cc) => cc.creator_id === creator.id) || [];
      const campaignsSet = new Set([
        ...creatorPosts.map((p) => p.campaign_id),
        ...creatorCampaignRelations.map((cc) => cc.campaign_id),
      ]);

      // Filter contact fields based on network filter:
      // - My Network: show full contacts (workspace-owned)
      // - All Creators: always hide contacts (marketplace)
      const filteredCreator = {
        ...creator,
        email: networkFilter === "all" ? null : creator.email,
        phone: networkFilter === "all" ? null : creator.phone,
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
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      return { data: null, error: new Error("Not authenticated") };
    }

    const { workspaceId: targetWorkspaceId, error: workspaceError } =
      await resolveWorkspaceId(workspaceId);
    if (workspaceError || !targetWorkspaceId) {
      return {
        data: null,
        error: workspaceError || new Error("Workspace not found"),
      };
    }
    const workspaceKeys = await getWorkspaceCreatorKeys(targetWorkspaceId);
    // Verify the creator belongs to the workspace (check workspace_creators)
    const { data: workspaceCreator, error: fetchError } = await supabase
      .from("workspace_creators")
      .select("creator_id")
      .or(buildWorkspaceCreatorsFilter(workspaceKeys))
      .eq("creator_id", id)
      .maybeSingle();

    if (fetchError || !workspaceCreator) {
      return {
        data: null,
        error: new Error("Creator not found or unauthorized"),
      };
    }

    const { data: updated, error: updateError } = await supabase
      .from("creators")
      .update(updates)
      .eq("id", id)
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
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      return { data: null, error: new Error("Not authenticated") };
    }

    const { workspaceId: targetWorkspaceId, error: workspaceError } =
      await resolveWorkspaceId(workspaceId);
    if (workspaceError || !targetWorkspaceId) {
      return {
        data: null,
        error: workspaceError || new Error("Workspace not found"),
      };
    }
    const workspaceKeys = await getWorkspaceCreatorKeys(targetWorkspaceId);
    // Verify the creator belongs to the workspace (check workspace_creators)
    const { data: workspaceCreator, error: fetchError } = await supabase
      .from("workspace_creators")
      .select("creator_id")
      .or(buildWorkspaceCreatorsFilter(workspaceKeys))
      .eq("creator_id", id)
      .maybeSingle();

    if (fetchError || !workspaceCreator) {
      return {
        data: null,
        error: new Error("Creator not found or unauthorized"),
      };
    }

    // Delete from workspace_creators (removes from My Network)
    // Note: This doesn't delete the creator from the global creators table
    const { error: deleteError } = await supabase
      .from("workspace_creators")
      .delete()
      .or(buildWorkspaceCreatorsFilter(workspaceKeys))
      .eq("creator_id", id);

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
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      return { data: null, error: new Error("Not authenticated") };
    }

    // Verify campaign belongs to workspace
    const { data: campaign, error: campaignError } = await supabase
      .from("campaigns")
      .select("workspace_id")
      .eq("id", campaignId)
      .single();

    if (campaignError || !campaign) {
      return { data: null, error: new Error("Campaign not found") };
    }

    const targetWorkspaceId = campaign.workspace_id;
    if (!targetWorkspaceId) {
      return { data: null, error: new Error("Campaign workspace not found") };
    }

    // Verify all creators belong to workspace (My Network creators only)
    // Check via workspace_creators table
    const workspaceKeys = await getWorkspaceCreatorKeys(targetWorkspaceId);
    const { data: workspaceCreators, error: creatorsError } = await supabase
      .from("workspace_creators")
      .select("creator_id")
      .or(buildWorkspaceCreatorsFilter(workspaceKeys))
      .in("creator_id", creatorIds);

    if (creatorsError) {
      return { data: null, error: creatorsError };
    }

    const workspaceCreatorIds = new Set(
      (workspaceCreators || []).map((wc: any) => wc.creator_id)
    );
    const missingCreatorIds = creatorIds.filter(
      (id) => !workspaceCreatorIds.has(id)
    );

    if (missingCreatorIds.length > 0) {
      for (const creatorId of missingCreatorIds) {
        await supabase.rpc("ensure_workspace_creator", {
          p_workspace_id: targetWorkspaceId,
          p_creator_id: creatorId,
          p_source: "scraper",
        });
      }

      const { data: refreshedCreators, error: refreshError } = await supabase
        .from("workspace_creators")
        .select("creator_id")
        .or(buildWorkspaceCreatorsFilter(workspaceKeys))
        .in("creator_id", creatorIds);

      if (refreshError) {
        return { data: null, error: refreshError };
      }

      const refreshedIds = new Set(
        (refreshedCreators || []).map((wc: any) => wc.creator_id)
      );
      const stillMissing = creatorIds.some((id) => !refreshedIds.has(id));
      if (stillMissing) {
        return {
          data: null,
          error: new Error("Some creators not found or unauthorized"),
        };
      }
    }

    // Insert campaign-creator relationships (ignore duplicates)
    const relationships = creatorIds.map((creatorId) => ({
      campaign_id: campaignId,
      creator_id: creatorId,
    }));

    const { data: inserted, error: insertError } = await supabase
      .from("campaign_creators")
      .insert(relationships)
      .select();

    if (insertError) {
      // If error is due to duplicates, fetch existing ones
      if (insertError.code === "23505") {
        const { data: existing } = await supabase
          .from("campaign_creators")
          .select("*")
          .eq("campaign_id", campaignId)
          .in("creator_id", creatorIds);
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
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      return { data: null, error: new Error("Not authenticated") };
    }

    // Verify campaign belongs to workspace
    const { data: campaign, error: campaignError } = await supabase
      .from("campaigns")
      .select("workspace_id")
      .eq("id", campaignId)
      .single();

    if (campaignError || !campaign) {
      return { data: null, error: new Error("Campaign not found") };
    }

    const targetWorkspaceId = campaign.workspace_id;
    if (!targetWorkspaceId) {
      return { data: null, error: new Error("Campaign workspace not found") };
    }

    const { error: deleteError } = await supabase
      .from("campaign_creators")
      .delete()
      .eq("campaign_id", campaignId)
      .eq("creator_id", creatorId);

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
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      return { data: null, error: new Error("Not authenticated") };
    }

    // Verify campaign belongs to workspace
    const { data: campaign, error: campaignError } = await supabase
      .from("campaigns")
      .select("workspace_id")
      .eq("id", campaignId)
      .single();

    if (campaignError || !campaign) {
      return { data: null, error: new Error("Campaign not found") };
    }

    const targetWorkspaceId = campaign.workspace_id;
    if (!targetWorkspaceId) {
      return { data: null, error: new Error("Campaign workspace not found") };
    }

    const { data: campaignCreators, error: fetchError } = await supabase
      .from("campaign_creators")
      .select("*")
      .eq("campaign_id", campaignId);

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
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      return { data: null, error: new Error("Not authenticated") };
    }

    if (campaignIds.length === 0) {
      return { data: [], error: null };
    }

    const { data, error } = await supabase
      .from("campaign_creators")
      .select("creator_id")
      .in("campaign_id", campaignIds);

    if (error) {
      return { data: null, error };
    }

    const { data: postsData, error: postsError } = await supabase
      .from("posts")
      .select("creator_id")
      .in("campaign_id", campaignIds);

    if (postsError) {
      return { data: null, error: postsError };
    }

    const creatorIds = Array.from(
      new Set([
        ...(data || []).map((row) => row.creator_id),
        ...(postsData || []).map((row) => row.creator_id),
      ])
    );
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
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      return { data: null, error: new Error("Not authenticated") };
    }

    const { workspaceId: targetWorkspaceId, error: workspaceError } =
      await resolveWorkspaceId(workspaceId);
    if (workspaceError || !targetWorkspaceId) {
      return {
        data: null,
        error: workspaceError || new Error("Workspace not found"),
      };
    }

    if (campaignIds.length === 0 || creatorIds.length === 0) {
      return { data: [], error: null };
    }

    // Verify all campaigns belong to workspace
    const { data: userCampaigns, error: campaignsError } = await supabase
      .from("campaigns")
      .select("id")
      .eq("workspace_id", targetWorkspaceId)
      .in("id", campaignIds);

    if (campaignsError) {
      return { data: null, error: campaignsError };
    }

    if (!userCampaigns || userCampaigns.length !== campaignIds.length) {
      return {
        data: null,
        error: new Error("Some campaigns not found or unauthorized"),
      };
    }

    // Verify all creators belong to workspace (My Network creators only)
    // Check via workspace_creators table
    const workspaceKeys = await getWorkspaceCreatorKeys(targetWorkspaceId);
    const { data: workspaceCreators, error: creatorsError } = await supabase
      .from("workspace_creators")
      .select("creator_id")
      .or(buildWorkspaceCreatorsFilter(workspaceKeys))
      .in("creator_id", creatorIds);

    if (creatorsError) {
      return { data: null, error: creatorsError };
    }

    const workspaceCreatorIds = new Set(
      (workspaceCreators || []).map((wc: any) => wc.creator_id)
    );
    const missingCreatorIds = creatorIds.filter(
      (id) => !workspaceCreatorIds.has(id)
    );

    if (missingCreatorIds.length > 0) {
      for (const creatorId of missingCreatorIds) {
        await supabase.rpc("ensure_workspace_creator", {
          p_workspace_id: targetWorkspaceId,
          p_creator_id: creatorId,
          p_source: "scraper",
        });
      }

      const { data: refreshedCreators, error: refreshError } = await supabase
        .from("workspace_creators")
        .select("creator_id")
        .or(buildWorkspaceCreatorsFilter(workspaceKeys))
        .in("creator_id", creatorIds);

      if (refreshError) {
        return { data: null, error: refreshError };
      }

      const refreshedIds = new Set(
        (refreshedCreators || []).map((wc: any) => wc.creator_id)
      );
      const stillMissing = creatorIds.some((id) => !refreshedIds.has(id));
      if (stillMissing) {
        return {
          data: null,
          error: new Error("Some creators not found or unauthorized"),
        };
      }
    }

    // Create all relationships (campaign x creator combinations)
    const relationships: Array<{ campaign_id: string; creator_id: string }> =
      [];
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
      .from("campaign_creators")
      .insert(relationships)
      .select();

    if (insertError) {
      // If error is due to duplicates, fetch existing ones
      if (insertError.code === "23505") {
        const { data: existing } = await supabase
          .from("campaign_creators")
          .select("*")
          .in("campaign_id", campaignIds)
          .in("creator_id", creatorIds);
        return { data: existing || [], error: null };
      }
      return { data: null, error: insertError };
    }

    return { data: inserted || [], error: null };
  } catch (err) {
    return { data: null, error: err as Error };
  }
}

// ========== Creators Page API (My Network, Discover, Favorites) ==========

/**
 * List My Network creators - workspace_creators with creators, social accounts, stats
 */
export async function listMyNetwork(
  workspaceId: string | null
): Promise<ApiListResponse<CreatorWithSocialAndStats[]>> {
  try {
    const { workspaceId: targetId, error: wsError } = await resolveWorkspaceId(workspaceId);
    if (wsError || !targetId) return { data: null, error: wsError || new Error("Workspace required") };

    const keys = await getWorkspaceCreatorKeys(targetId);
    const { data: wcRows, error } = await supabase
      .from("workspace_creators")
      .select(`
        id,
        creator_id,
        manual_name,
        manual_email,
        manual_phone,
        manual_handle,
        manual_platform,
        manual_followers,
        manual_niche,
        manual_location,
        manual_base_rate,
        source,
        creators:creator_id (
          id,
          name,
          handle,
          platform,
          follower_count,
          avg_engagement,
          email,
          phone,
          niche,
          location,
          profile_photo,
          bio,
          status,
          creator_social_accounts (*),
          creator_stats (*)
        )
      `)
      .or(`workspace_id.eq.${keys.workspaceId},workspace_id.eq.${keys.ownerUserId || keys.workspaceId}`);

    if (error) return { data: null, error };

    const result: CreatorWithSocialAndStats[] = (wcRows || []).map((wc: any) => {
      if (wc.creator_id && wc.creators) {
        const c = Array.isArray(wc.creators) ? wc.creators[0] : wc.creators;
        return { ...c, in_my_network: true };
      }
      return {
        id: `manual-${wc.id}`,
        user_id: null,
        name: wc.manual_name || wc.manual_handle || "Unknown",
        handle: wc.manual_handle || "",
        platform: (wc.manual_platform || "tiktok") as Platform,
        follower_count: wc.manual_followers || 0,
        avg_engagement: 0,
        email: wc.manual_email || null,
        phone: wc.manual_phone || null,
        niche: wc.manual_niche || null,
        location: wc.manual_location || null,
        profile_url: null,
        display_name: null,
        country: null,
        state: null,
        city: null,
        contact_email: wc.manual_email || null,
        whatsapp: wc.manual_phone || null,
        created_at: "",
        updated_at: "",
        source_type: "manual",
        imported_by_user_id: null,
        created_by_workspace_id: null,
        in_my_network: true,
        _workspace_creator_id: wc.id,
      } as CreatorWithSocialAndStats;
    });

    return { data: result, error: null };
  } catch (err) {
    return { data: null, error: err as Error };
  }
}

/**
 * List Discover creators - all platform creators not in workspace
 */
export async function listDiscover(
  workspaceId: string | null,
  filters?: CreatorFilters
): Promise<ApiListResponse<CreatorWithSocialAndStats[]>> {
  try {
    let query = supabase
      .from("creators")
      .select(`
        *,
        creator_social_accounts (*),
        creator_stats (*)
      `)
      .eq("status", "active")
      .eq("profile_status", "live")
      .order("name", { ascending: true });

    if (filters?.platforms?.length) {
      query = query.in("platform", filters.platforms);
    }
    if (filters?.followerMin != null) {
      query = query.gte("follower_count", filters.followerMin);
    }
    if (filters?.followerMax != null) {
      query = query.lte("follower_count", filters.followerMax);
    }
    if (filters?.location) {
      query = query.ilike("location", `%${filters.location}%`);
    }

    const { data, error } = await query;
    if (error) return { data: null, error };

    let list = (data || []) as CreatorWithSocialAndStats[];
    if (workspaceId) {
      const { data: myWc } = await supabase
        .from("workspace_creators")
        .select("creator_id")
        .eq("workspace_id", workspaceId)
        .not("creator_id", "is", null);
      const myIds = new Set((myWc || []).map((r: any) => r.creator_id));
      list = list.filter((c) => !myIds.has(c.id));
    }

    return { data: list, error: null };
  } catch (err) {
    return { data: null, error: err as Error };
  }
}

/**
 * List Favorites for current user
 */
export async function listFavorites(): Promise<ApiListResponse<CreatorWithSocialAndStats[]>> {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { data: null, error: new Error("Not authenticated") };

    const { data, error } = await supabase
      .from("creator_favorites")
      .select(`
        creator_id,
        creators:creator_id (
          *,
          creator_social_accounts (*),
          creator_stats (*)
        )
      `)
      .eq("user_id", user.id);

    if (error) return { data: null, error };

    const list = (data || [])
      .map((f: any) => (Array.isArray(f.creators) ? f.creators[0] : f.creators))
      .filter(Boolean)
      .map((c: any) => ({ ...c, is_favorite: true }));

    return { data: list, error: null };
  } catch (err) {
    return { data: null, error: err as Error };
  }
}

/**
 * Toggle favorite for a creator
 */
export async function toggleFavorite(
  creatorId: string
): Promise<ApiResponse<{ is_favorite: boolean }>> {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { data: null, error: new Error("Not authenticated") };

    const { data: existing } = await supabase
      .from("creator_favorites")
      .select("id")
      .eq("user_id", user.id)
      .eq("creator_id", creatorId)
      .maybeSingle();

    if (existing) {
      await supabase
        .from("creator_favorites")
        .delete()
        .eq("user_id", user.id)
        .eq("creator_id", creatorId);
      return { data: { is_favorite: false }, error: null };
    }

    await supabase.from("creator_favorites").insert({
      user_id: user.id,
      creator_id: creatorId,
    });
    return { data: { is_favorite: true }, error: null };
  } catch (err) {
    return { data: null, error: err as Error };
  }
}

/**
 * Add creator manually (workspace_creators with manual_* or linked creator)
 */
export async function addCreatorManually(
  workspaceId: string,
  data: {
    platform: Platform;
    handle: string;
    name?: string;
    email?: string;
    phone?: string;
    niche?: string;
    location?: string;
    follower_count?: number;
    base_rate?: number;
    createLinkedCreator?: boolean;
  }
): Promise<ApiResponse<CreatorWithSocialAndStats>> {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { data: null, error: new Error("Not authenticated") };

    const handleNorm = data.handle.replace(/^@/, "");
    const keys = await getWorkspaceCreatorKeys(workspaceId);

    if (data.createLinkedCreator) {
      const existing = await getOrCreate(
        data.name || handleNorm,
        handleNorm,
        data.platform,
        data.follower_count,
        data.email || null,
        data.phone || null,
        data.niche || null,
        data.location || null,
        "manual",
        workspaceId
      );
      if (existing.error) return { data: null, error: existing.error };
      const list = await listMyNetwork(workspaceId);
      const found = list.data?.find((c) => c.id === existing.data!.id);
      return { data: found || (existing.data as CreatorWithSocialAndStats), error: null };
    }

    const { data: inserted, error } = await supabase
      .from("workspace_creators")
      .insert({
        workspace_id: keys.workspaceId,
        creator_id: null,
        manual_handle: handleNorm.startsWith("@") ? handleNorm : `@${handleNorm}`,
        manual_platform: data.platform,
        manual_name: data.name || handleNorm,
        manual_email: data.email || null,
        manual_phone: data.phone || null,
        manual_niche: data.niche || null,
        manual_location: data.location || null,
        manual_followers: data.follower_count || null,
        manual_base_rate: data.base_rate || null,
        source: "manual",
        added_by: user.id,
      })
      .select()
      .single();

    if (error) return { data: null, error };

    const synthetic: CreatorWithSocialAndStats = {
      id: `manual-${inserted.id}`,
      user_id: null,
      name: inserted.manual_name || inserted.manual_handle || "Unknown",
      handle: inserted.manual_handle || "",
      platform: inserted.manual_platform as Platform,
      follower_count: inserted.manual_followers || 0,
      avg_engagement: 0,
      email: inserted.manual_email || null,
      phone: inserted.manual_phone || null,
      niche: inserted.manual_niche || null,
      location: inserted.manual_location || null,
      profile_url: null,
      display_name: null,
      country: null,
      state: null,
      city: null,
      contact_email: inserted.manual_email || null,
      whatsapp: inserted.manual_phone || null,
      created_at: inserted.created_at,
      updated_at: inserted.created_at,
      source_type: "manual",
      imported_by_user_id: null,
      created_by_workspace_id: null,
      in_my_network: true,
    };
    return { data: synthetic, error: null };
  } catch (err) {
    return { data: null, error: err as Error };
  }
}

/**
 * Get full creator profile
 */
export async function getCreatorProfile(
  creatorId: string
): Promise<ApiResponse<CreatorWithSocialAndStats>> {
  try {
    if (creatorId.startsWith("manual-")) {
      return { data: null, error: new Error("Manual creators do not have full profiles") };
    }

    const { data, error } = await supabase
      .from("creators")
      .select(`
        *,
        creator_social_accounts (*),
        creator_stats (*)
      `)
      .eq("id", creatorId)
      .single();

    if (error || !data) return { data: null, error: error || new Error("Creator not found") };

    const { data: fav } = await supabase
      .from("creator_favorites")
      .select("id")
      .eq("creator_id", creatorId)
      .eq("user_id", (await supabase.auth.getUser()).data.user?.id)
      .maybeSingle();

    return { data: { ...data, is_favorite: !!fav }, error: null };
  } catch (err) {
    return { data: null, error: err as Error };
  }
}

/**
 * Send offer to activation (deduct wallet, create offer record)
 */
export async function sendOfferToActivation(
  creatorId: string,
  activationId: string,
  amount: number,
  message?: string
): Promise<ApiResponse<{ success: boolean }>> {
  try {
    const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
    const { data: sessionData } = await supabase.auth.getSession();
    const token = sessionData?.session?.access_token;

    if (!supabaseUrl) return { data: null, error: new Error("Missing Supabase URL") };

    const res = await fetch(`${supabaseUrl}/functions/v1/send-offer-to-activation`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": token ? `Bearer ${token}` : "",
        ...(import.meta.env.VITE_SUPABASE_ANON_KEY && {
          apikey: import.meta.env.VITE_SUPABASE_ANON_KEY,
        }),
      },
      body: JSON.stringify({ creatorId, activationId, amount, message }),
    });

    const json = await res.json();
    if (!res.ok) return { data: null, error: new Error(json?.error || "Failed to send offer") };
    return { data: { success: true }, error: null };
  } catch (err) {
    return { data: null, error: err as Error };
  }
}
