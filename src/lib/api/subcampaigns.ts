import { supabase } from "../supabase";
import type {
  ApiListResponse,
  ApiResponse,
  Campaign,
  CampaignHierarchyMetrics,
  CampaignInsert,
  SubcampaignSummary,
} from "../types/database";

interface CreateSubcampaignInput {
  name: string;
  brand_name?: string | null;
  cover_image_url?: string | null;
  start_date?: string | null;
  end_date?: string | null;
  notes?: string | null;
  status?: CampaignInsert["status"];
}

/**
 * Fetch subcampaign summaries for a parent campaign
 */
export async function getSubcampaigns(
  parentCampaignId: string
): Promise<ApiListResponse<SubcampaignSummary>> {
  try {
    const { data, error } = await supabase.rpc("get_subcampaigns", {
      parent_campaign_id: parentCampaignId,
    });

    if (error) {
      return { data: null, error };
    }

    return {
      data: (data || []) as SubcampaignSummary[],
      error: null,
      count: data?.length || 0,
    };
  } catch (err) {
    return { data: null, error: err as Error };
  }
}

/**
 * Create a subcampaign under a parent campaign
 */
export async function createSubcampaign(
  parentCampaignId: string,
  subcampaign: CreateSubcampaignInput
): Promise<ApiResponse<Campaign>> {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return { data: null, error: new Error("Not authenticated") };
    }

    const { data: parent, error: parentError } = await supabase
      .from("campaigns")
      .select("id, user_id, brand_name")
      .eq("id", parentCampaignId)
      .eq("user_id", user.id)
      .single();

    if (parentError || !parent) {
      return {
        data: null,
        error: new Error("Parent campaign not found or access denied"),
      };
    }

    const payload: CampaignInsert = {
      user_id: user.id,
      parent_campaign_id: parentCampaignId,
      name: subcampaign.name,
      brand_name:
        subcampaign.brand_name === undefined
          ? parent.brand_name || null
          : subcampaign.brand_name,
      cover_image_url: subcampaign.cover_image_url || null,
      status: subcampaign.status || "active",
      start_date: subcampaign.start_date || null,
      end_date: subcampaign.end_date || null,
      notes: subcampaign.notes || null,
    };

    const { data, error } = await supabase
      .from("campaigns")
      .insert(payload)
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
 * Fetch aggregated metrics for a campaign hierarchy
 */
export async function getCampaignMetricsWithSubcampaigns(
  campaignId: string
): Promise<ApiResponse<CampaignHierarchyMetrics>> {
  try {
    const { data, error } = await supabase.rpc(
      "get_campaign_metrics_with_subcampaigns",
      { campaign_id: campaignId }
    );

    if (error) {
      return { data: null, error };
    }

    const payload = Array.isArray(data) ? data[0] : data;
    if (!payload) {
      return { data: null, error: new Error("No data returned") };
    }

    return { data: payload as CampaignHierarchyMetrics, error: null };
  } catch (err) {
    return { data: null, error: err as Error };
  }
}

/**
 * Check if a campaign has subcampaigns
 */
export async function isParentCampaign(
  campaignId: string
): Promise<ApiResponse<boolean>> {
  try {
    const { data, error } = await supabase.rpc("is_parent_campaign", {
      campaign_id: campaignId,
    });

    if (error) {
      return { data: null, error };
    }

    if (typeof data === "boolean") {
      return { data, error: null };
    }

    const payload = Array.isArray(data) ? data[0] : data;
    if (typeof payload === "boolean") {
      return { data: payload, error: null };
    }
    if (payload && typeof payload.is_parent === "boolean") {
      return { data: payload.is_parent, error: null };
    }

    return { data: false, error: null };
  } catch (err) {
    return { data: null, error: err as Error };
  }
}
