import { supabase } from "../supabase";
import type { ApiResponse, SubcampaignSummary } from "../types/database";

// Generate a secure random token (12 characters)
function generateShareToken(): string {
  const array = new Uint8Array(6); // 6 bytes = 12 hex characters
  crypto.getRandomValues(array);
  return Array.from(array, (byte) => byte.toString(16).padStart(2, "0")).join("");
}

// Hash password using SHA-256
async function hashPassword(password: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(password);
  const hash = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(hash))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

interface EnableShareParams {
  campaignId: string;
  expiresInHours?: number | null; // null = never expires
  allowExport?: boolean;
  password?: string | null; // Optional password for password-protected links
}

interface ShareLinkResponse {
  shareToken: string;
  shareUrl: string;
}

/**
 * Enable sharing for a campaign
 */
export async function enableCampaignShare(
  params: EnableShareParams
): Promise<ApiResponse<ShareLinkResponse>> {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return { data: null, error: new Error("Not authenticated") };
    }

    // Verify user owns the campaign
    const { data: campaign, error: campaignError } = await supabase
      .from("campaigns")
      .select("id, user_id")
      .eq("id", params.campaignId)
      .eq("user_id", user.id)
      .single();

    if (campaignError || !campaign) {
      return {
        data: null,
        error: new Error("Campaign not found or access denied"),
      };
    }

    // Generate new token
    const shareToken = generateShareToken();

    // Calculate expiry date if specified
    let shareExpiresAt: string | null = null;
    if (params.expiresInHours !== null && params.expiresInHours !== undefined) {
      const expiresAt = new Date();
      expiresAt.setHours(expiresAt.getHours() + params.expiresInHours);
      shareExpiresAt = expiresAt.toISOString();
    }

    // Hash password if provided
    let passwordHash: string | null = null;
    const isPasswordProtected = !!params.password && params.password.trim().length > 0;
    if (isPasswordProtected) {
      passwordHash = await hashPassword(params.password!);
    }

    // Update campaign with share settings
    const { data: updatedCampaign, error: updateError } = await supabase
      .from("campaigns")
      .update({
        share_enabled: true,
        share_token: shareToken,
        share_created_at: new Date().toISOString(),
        share_expires_at: shareExpiresAt,
        share_allow_export: params.allowExport || false,
        share_password_hash: passwordHash,
        share_password_protected: isPasswordProtected,
      })
      .eq("id", params.campaignId)
      .select("share_token")
      .single();

    if (updateError || !updatedCampaign) {
      return { data: null, error: updateError || new Error("Failed to enable sharing") };
    }

    // Build share URL
    const shareUrl = `${window.location.origin}/share/campaign/${shareToken}`;

    return {
      data: {
        shareToken: updatedCampaign.share_token,
        shareUrl,
      },
      error: null,
    };
  } catch (err) {
    return { data: null, error: err as Error };
  }
}

/**
 * Regenerate share token for a campaign (invalidates old link)
 */
export async function regenerateCampaignShareToken(
  campaignId: string,
  expiresInHours?: number | null // Optional: new expiration (undefined = preserve original duration)
): Promise<ApiResponse<ShareLinkResponse>> {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return { data: null, error: new Error("Not authenticated") };
    }

    // Verify user owns the campaign and sharing is enabled
    const { data: campaign, error: campaignError } = await supabase
      .from("campaigns")
      .select("id, user_id, share_enabled, share_expires_at, share_created_at, share_allow_export")
      .eq("id", campaignId)
      .eq("user_id", user.id)
      .single();

    if (campaignError || !campaign) {
      return {
        data: null,
        error: new Error("Campaign not found or access denied"),
      };
    }

    if (!campaign.share_enabled) {
      return {
        data: null,
        error: new Error("Sharing is not enabled for this campaign"),
      };
    }

    // Generate new token
    const shareToken = generateShareToken();

    // Calculate new expiration
    let newExpiresAt: string | null = null;

    if (expiresInHours !== undefined) {
      // User explicitly chose new expiration (including null for "never")
      if (expiresInHours !== null && expiresInHours > 0) {
        const expiresAt = new Date();
        expiresAt.setHours(expiresAt.getHours() + expiresInHours);
        newExpiresAt = expiresAt.toISOString();
      }
      // else: expiresInHours is null, so link never expires (newExpiresAt stays null)
    } else {
      // No expiration specified - preserve original duration
      if (campaign.share_expires_at && campaign.share_created_at) {
        const originalCreatedAt = new Date(campaign.share_created_at);
        const originalExpiresAt = new Date(campaign.share_expires_at);

        // Calculate the original duration in hours (regardless of whether it's expired)
        const originalDurationHours = (originalExpiresAt.getTime() - originalCreatedAt.getTime()) / (1000 * 60 * 60);

        // Apply same duration to new link (from now)
        if (originalDurationHours > 0) {
          const newExpiresAtDate = new Date();
          newExpiresAtDate.setHours(newExpiresAtDate.getHours() + originalDurationHours);
          newExpiresAt = newExpiresAtDate.toISOString();
        }
      }
      // else: no expiration was set originally, keep it null (never expires)
    }

    // Update campaign with new token (preserve other share settings, but update expiration)
    const { data: updatedCampaign, error: updateError } = await supabase
      .from("campaigns")
      .update({
        share_token: shareToken,
        share_created_at: new Date().toISOString(),
        share_expires_at: newExpiresAt, // Update expiration to be relative to new creation time
      })
      .eq("id", campaignId)
      .select("share_token")
      .single();

    if (updateError || !updatedCampaign) {
      return {
        data: null,
        error: updateError || new Error("Failed to regenerate token"),
      };
    }

    // Build share URL
    const shareUrl = `${window.location.origin}/share/campaign/${shareToken}`;

    return {
      data: {
        shareToken: updatedCampaign.share_token,
        shareUrl,
      },
      error: null,
    };
  } catch (err) {
    return { data: null, error: err as Error };
  }
}

/**
 * Disable sharing for a campaign
 */
export async function disableCampaignShare(
  campaignId: string
): Promise<ApiResponse<void>> {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return { data: null, error: new Error("Not authenticated") };
    }

    // Verify user owns the campaign
    const { data: campaign, error: campaignError } = await supabase
      .from("campaigns")
      .select("id, user_id")
      .eq("id", campaignId)
      .eq("user_id", user.id)
      .single();

    if (campaignError || !campaign) {
      return {
        data: null,
        error: new Error("Campaign not found or access denied"),
      };
    }

    // Disable sharing (clear token and reset flags)
    const { error: updateError } = await supabase
      .from("campaigns")
      .update({
        share_enabled: false,
        share_token: null,
        share_created_at: null,
        share_expires_at: null,
        share_allow_export: false,
        share_password_hash: null,
        share_password_protected: false,
      })
      .eq("id", campaignId);

    if (updateError) {
      return { data: null, error: updateError };
    }

    return { data: undefined, error: null };
  } catch (err) {
    return { data: null, error: err as Error };
  }
}

/**
 * Get share settings for a campaign (for the owner)
 */
export async function getCampaignShareSettings(
  campaignId: string
): Promise<
  ApiResponse<{
    shareEnabled: boolean;
    shareToken: string | null;
    shareCreatedAt: string | null;
    shareExpiresAt: string | null;
    shareAllowExport: boolean;
    sharePasswordProtected: boolean;
    shareUrl: string | null;
  }>
> {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return { data: null, error: new Error("Not authenticated") };
    }

    // Verify user owns the campaign
    const { data: campaign, error: campaignError } = await supabase
      .from("campaigns")
      .select(
        "id, user_id, share_enabled, share_token, share_created_at, share_expires_at, share_allow_export, share_password_protected"
      )
      .eq("id", campaignId)
      .eq("user_id", user.id)
      .single();

    if (campaignError || !campaign) {
      return {
        data: null,
        error: new Error("Campaign not found or access denied"),
      };
    }

    const shareUrl = campaign.share_enabled && campaign.share_token
      ? `${window.location.origin}/share/campaign/${campaign.share_token}`
      : null;

    return {
      data: {
        shareEnabled: campaign.share_enabled || false,
        shareToken: campaign.share_token || null,
        shareCreatedAt: campaign.share_created_at || null,
        shareExpiresAt: campaign.share_expires_at || null,
        shareAllowExport: campaign.share_allow_export || false,
        sharePasswordProtected: campaign.share_password_protected || false,
        shareUrl,
      },
      error: null,
    };
  } catch (err) {
    return { data: null, error: err as Error };
  }
}

/**
 * Fetch shared campaign data (public endpoint via Edge Function)
 */
export async function fetchSharedCampaignData(
  token: string,
  password?: string
): Promise<
  ApiResponse<{
    campaign: {
      id: string;
      name: string;
      brand_name: string | null;
      status: string;
      coverImageUrl: string | null;
      createdAt: string;
    };
    is_parent: boolean;
    subcampaigns: SubcampaignSummary[];
    totals: {
      views: number;
      likes: number;
      comments: number;
      shares: number;
    };
    series: {
      views: Array<{ date: string; value: number }>;
      likes: Array<{ date: string; value: number }>;
      comments: Array<{ date: string; value: number }>;
      shares: Array<{ date: string; value: number }>;
    };
    posts: Array<{
      id: string;
      campaignId: string;
      platform: string;
      postUrl: string;
      status: string;
      views: number;
      likes: number;
      comments: number;
      shares: number;
      engagementRate: number;
      postedDate: string | null;
      createdAt: string;
      creator: {
        id: string;
        name: string;
        handle: string;
      } | null;
    }>;
    share: {
      allowExport: boolean;
    };
  }>
> {
  try {
    const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
    const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
    
    if (!supabaseUrl) {
      return {
        data: null,
        error: new Error("Supabase URL not configured"),
      };
    }

    const edgeFunctionUrl = `${supabaseUrl}/functions/v1/share-campaign?token=${encodeURIComponent(token)}`;

    const headers: Record<string, string> = {
      "Content-Type": "application/json",
    };

    // Edge Functions require both apikey and Authorization headers
    if (supabaseAnonKey) {
      headers.apikey = supabaseAnonKey;
      
    }

    const body =
        typeof password === "string"
          ? JSON.stringify({ password })
          : undefined;

      const response = await fetch(edgeFunctionUrl, {
        method: "POST",
        headers,
        ...(body ? { body } : {}),
      });


    if (!response.ok) {
      let errorMessage = "Failed to fetch shared campaign";
      try {
        const errorData = await response.json();
        errorMessage =
                      errorData?.message ||
                      errorData?.error ||
                      errorMessage;

      } catch {
        // If we can't parse the error, use status text
        errorMessage = response.statusText || errorMessage;
      }

      if (response.status === 404) {
        return {
          data: null,
          error: new Error("Share link not found or expired"),
        };
      }
      if (response.status === 401) {
        // Distinguish between "Password required" and "Incorrect password"
        const isPasswordRequired = errorMessage?.toLowerCase().includes("password required");
        const isIncorrectPassword = errorMessage?.toLowerCase().includes("incorrect password");

        if (isIncorrectPassword) {
          return {
            data: null,
            error: Object.assign(
              new Error("Incorrect password"),
              { code: "INCORRECT_PASSWORD" }
            ),
          };
        }

        // Default to password required for 401
        return {
          data: null,
          error: Object.assign(
            new Error(errorMessage || "Password required"),
            { code: "PASSWORD_REQUIRED" }
          ),
        };
      }

      return {
        data: null,
        error: new Error(errorMessage),
      };
    }

    const data = await response.json();
    return { data, error: null };
  } catch (err) {
    console.error("Error fetching shared campaign data:", err);
    const errorMessage = err instanceof Error ? err.message : "Network error";
    return {
      data: null,
      error: new Error(errorMessage),
    };
  }
}
