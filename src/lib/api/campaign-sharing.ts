import { supabase } from "../supabase";
import type {
  CampaignShareLink,
  CampaignShareLinkInsert,
  CampaignShareLinkUpdate,
  ApiResponse,
  ApiListResponse,
} from "../types/database";

// Generate UUID v4 for share tokens
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
 * Hash password using Web Crypto API
 */
async function hashPassword(password: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(password);
  const hash = await crypto.subtle.digest("SHA-256", data);
  const hashArray = Array.from(new Uint8Array(hash));
  return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
}

/**
 * Generate a share link for a campaign
 */
export async function generateShareLink(
  campaignId: string,
  isPasswordProtected: boolean,
  password?: string,
  expiresAt?: string | null
): Promise<ApiResponse<CampaignShareLink>> {
  try {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      return { data: null, error: new Error("Not authenticated") };
    }

    // Verify user owns the campaign
    const { data: campaign, error: campaignError } = await supabase
      .from("campaigns")
      .select("id")
      .eq("id", campaignId)
      .eq("user_id", user.id)
      .single();

    if (campaignError || !campaign) {
      return {
        data: null,
        error: new Error("Campaign not found or access denied"),
      };
    }

    // Delete any existing share links for this campaign (only one link allowed)
    const { error: deleteError } = await supabase
      .from("campaign_share_links")
      .delete()
      .eq("campaign_id", campaignId);

    if (deleteError) {
      console.warn("Error deleting existing share links:", deleteError);
      // Continue anyway - try to create the new link
    }

    // Generate share token
    const shareToken = generateUUID();

    // Hash password if provided
    let passwordHash: string | null = null;
    if (isPasswordProtected && password) {
      passwordHash = await hashPassword(password);
    }

    const shareLinkData: CampaignShareLinkInsert = {
      campaign_id: campaignId,
      share_token: shareToken,
      password_hash: passwordHash,
      is_password_protected: isPasswordProtected,
      created_by: user.id,
      expires_at: expiresAt || null,
    };

    const { data: shareLink, error } = await supabase
      .from("campaign_share_links")
      .insert(shareLinkData)
      .select()
      .single();

    if (error) {
      return { data: null, error };
    }

    return { data: shareLink, error: null };
  } catch (err) {
    return { data: null, error: err as Error };
  }
}


/**
 * Get all share links for a campaign
 */
export async function getShareLinksForCampaign(
  campaignId: string
): Promise<ApiListResponse<CampaignShareLink>> {
  try {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      return { data: null, error: new Error("Not authenticated") };
    }

    // Verify user owns the campaign
    const { data: campaign, error: campaignError } = await supabase
      .from("campaigns")
      .select("id")
      .eq("id", campaignId)
      .eq("user_id", user.id)
      .single();

    if (campaignError || !campaign) {
      return {
        data: null,
        error: new Error("Campaign not found or access denied"),
      };
    }

    const { data: shareLinks, error } = await supabase
      .from("campaign_share_links")
      .select("*")
      .eq("campaign_id", campaignId)
      .order("created_at", { ascending: false });

    if (error) {
      return { data: null, error };
    }

    return {
      data: shareLinks as CampaignShareLink[],
      error: null,
      count: shareLinks?.length || 0,
    };
  } catch (err) {
    return { data: null, error: err as Error };
  }
}

/**
 * Update a share link (password, expiry, etc.)
 */
export async function updateShareLink(
  token: string,
  updates: {
    password?: string;
    isPasswordProtected?: boolean;
    expiresAt?: string | null;
  }
): Promise<ApiResponse<CampaignShareLink>> {
  try {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      return { data: null, error: new Error("Not authenticated") };
    }

    // Verify user owns the share link's campaign
    const { data: shareLink, error: shareLinkError } = await supabase
      .from("campaign_share_links")
      .select(
        `
        *,
        campaign:campaigns!inner(user_id)
      `
      )
      .eq("share_token", token)
      .single();

    if (shareLinkError || !shareLink) {
      return { data: null, error: new Error("Share link not found") };
    }

    const campaign = (shareLink as any).campaign;
    if (campaign.user_id !== user.id) {
      return {
        data: null,
        error: new Error("Not authorized to update this share link"),
      };
    }

    // Prepare update data
    const updateData: CampaignShareLinkUpdate = {};

    if (updates.isPasswordProtected !== undefined) {
      updateData.is_password_protected = updates.isPasswordProtected;
    }

    if (updates.password !== undefined) {
      if (updates.password && updates.isPasswordProtected) {
        updateData.password_hash = await hashPassword(updates.password);
      } else {
        updateData.password_hash = null;
      }
    }

    if (updates.expiresAt !== undefined) {
      updateData.expires_at = updates.expiresAt;
    }

    const { data: updated, error } = await supabase
      .from("campaign_share_links")
      .update(updateData)
      .eq("share_token", token)
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
 * Delete/revoke a share link
 */
export async function deleteShareLink(
  token: string
): Promise<ApiResponse<void>> {
  try {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      return { data: null, error: new Error("Not authenticated") };
    }

    // Verify user owns the share link's campaign
    const { data: shareLink, error: shareLinkError } = await supabase
      .from("campaign_share_links")
      .select(
        `
        *,
        campaign:campaigns!inner(user_id)
      `
      )
      .eq("share_token", token)
      .single();

    if (shareLinkError || !shareLink) {
      return { data: null, error: new Error("Share link not found") };
    }

    const campaign = (shareLink as any).campaign;
    if (campaign.user_id !== user.id) {
      return {
        data: null,
        error: new Error("Not authorized to delete this share link"),
      };
    }

    const { error } = await supabase
      .from("campaign_share_links")
      .delete()
      .eq("share_token", token);

    if (error) {
      return { data: null, error };
    }

    return { data: null, error: null };
  } catch (err) {
    return { data: null, error: err as Error };
  }
}
