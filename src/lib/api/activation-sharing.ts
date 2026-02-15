import { supabase } from "../supabase";
import type { ApiResponse } from "../types/database";

function generateShareToken(): string {
  const array = new Uint8Array(6);
  crypto.getRandomValues(array);
  return Array.from(array, (byte) => byte.toString(16).padStart(2, "0")).join(
    "",
  );
}

async function hashPassword(password: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(password);
  const hash = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(hash))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

interface EnableActivationShareParams {
  activationId: string;
  expiresInHours?: number | null;
  password?: string | null;
}

interface ShareLinkResponse {
  shareToken: string;
  shareUrl: string;
}

export async function enableActivationShare(
  params: EnableActivationShareParams,
): Promise<ApiResponse<ShareLinkResponse>> {
  try {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      return { data: null, error: new Error("Not authenticated") };
    }

    const { data: activation, error: actError } = await supabase
      .from("activations")
      .select("id")
      .eq("id", params.activationId)
      .single();

    if (actError || !activation) {
      return {
        data: null,
        error: new Error("Activation not found or access denied"),
      };
    }

    const shareToken = generateShareToken();

    let shareExpiresAt: string | null = null;
    if (params.expiresInHours != null && params.expiresInHours > 0) {
      const expiresAt = new Date();
      expiresAt.setHours(expiresAt.getHours() + params.expiresInHours);
      shareExpiresAt = expiresAt.toISOString();
    }

    let passwordHash: string | null = null;
    const isPasswordProtected =
      !!params.password && params.password.trim().length > 0;
    if (isPasswordProtected) {
      passwordHash = await hashPassword(params.password!);
    }

    const { data: updated, error: updateError } = await supabase
      .from("activations")
      .update({
        share_enabled: true,
        share_token: shareToken,
        share_created_at: new Date().toISOString(),
        share_expires_at: shareExpiresAt,
        share_password_hash: passwordHash,
        share_password_protected: isPasswordProtected,
      })
      .eq("id", params.activationId)
      .select("share_token")
      .single();

    if (updateError || !updated) {
      return {
        data: null,
        error: updateError || new Error("Failed to enable sharing"),
      };
    }

    const shareUrl = `${window.location.origin}/share/activation/${updated.share_token}`;
    return {
      data: { shareToken: updated.share_token, shareUrl },
      error: null,
    };
  } catch (err) {
    return { data: null, error: err as Error };
  }
}

export async function disableActivationShare(
  activationId: string,
): Promise<ApiResponse<void>> {
  try {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      return { data: null, error: new Error("Not authenticated") };
    }

    const { data: activation, error: actError } = await supabase
      .from("activations")
      .select("id")
      .eq("id", activationId)
      .single();

    if (actError || !activation) {
      return {
        data: null,
        error: new Error("Activation not found or access denied"),
      };
    }

    const { error: updateError } = await supabase
      .from("activations")
      .update({
        share_enabled: false,
        share_token: null,
        share_created_at: null,
        share_expires_at: null,
        share_password_hash: null,
        share_password_protected: false,
      })
      .eq("id", activationId);

    if (updateError) return { data: null, error: updateError };
    return { data: undefined, error: null };
  } catch (err) {
    return { data: null, error: err as Error };
  }
}

export async function getActivationShareSettings(activationId: string): Promise<
  ApiResponse<{
    shareEnabled: boolean;
    shareToken: string | null;
    shareCreatedAt: string | null;
    shareExpiresAt: string | null;
    sharePasswordProtected: boolean;
    shareUrl: string | null;
  }>
> {
  try {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      return { data: null, error: new Error("Not authenticated") };
    }

    const { data: activation, error: actError } = await supabase
      .from("activations")
      .select(
        "id, share_enabled, share_token, share_created_at, share_expires_at, share_password_protected",
      )
      .eq("id", activationId)
      .single();

    if (actError || !activation) {
      return {
        data: null,
        error: new Error("Activation not found or access denied"),
      };
    }

    const shareUrl =
      activation.share_enabled && activation.share_token
        ? `${window.location.origin}/share/activation/${activation.share_token}`
        : null;

    return {
      data: {
        shareEnabled: !!activation.share_enabled,
        shareToken: activation.share_token ?? null,
        shareCreatedAt: activation.share_created_at ?? null,
        shareExpiresAt: activation.share_expires_at ?? null,
        sharePasswordProtected: !!activation.share_password_protected,
        shareUrl,
      },
      error: null,
    };
  } catch (err) {
    return { data: null, error: err as Error };
  }
}

export async function regenerateActivationShareToken(
  activationId: string,
  expiresInHours?: number | null,
): Promise<ApiResponse<ShareLinkResponse>> {
  try {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      return { data: null, error: new Error("Not authenticated") };
    }

    const { data: activation, error: actError } = await supabase
      .from("activations")
      .select("id, share_enabled, share_expires_at, share_created_at")
      .eq("id", activationId)
      .single();

    if (actError || !activation) {
      return {
        data: null,
        error: new Error("Activation not found or access denied"),
      };
    }

    if (!activation.share_enabled) {
      return {
        data: null,
        error: new Error("Sharing is not enabled for this activation"),
      };
    }

    const shareToken = generateShareToken();

    let newExpiresAt: string | null = null;
    if (expiresInHours !== undefined) {
      if (expiresInHours != null && expiresInHours > 0) {
        const expiresAt = new Date();
        expiresAt.setHours(expiresAt.getHours() + expiresInHours);
        newExpiresAt = expiresAt.toISOString();
      }
    } else if (activation.share_expires_at && activation.share_created_at) {
      const created = new Date(activation.share_created_at);
      const expires = new Date(activation.share_expires_at);
      const hours = (expires.getTime() - created.getTime()) / (1000 * 60 * 60);
      if (hours > 0) {
        const expiresAt = new Date();
        expiresAt.setHours(expiresAt.getHours() + hours);
        newExpiresAt = expiresAt.toISOString();
      }
    }

    const { data: updated, error: updateError } = await supabase
      .from("activations")
      .update({
        share_token: shareToken,
        share_created_at: new Date().toISOString(),
        share_expires_at: newExpiresAt,
      })
      .eq("id", activationId)
      .select("share_token")
      .single();

    if (updateError || !updated) {
      return {
        data: null,
        error: updateError || new Error("Failed to regenerate token"),
      };
    }

    const shareUrl = `${window.location.origin}/share/activation/${updated.share_token}`;
    return {
      data: { shareToken: updated.share_token, shareUrl },
      error: null,
    };
  } catch (err) {
    return { data: null, error: err as Error };
  }
}

export interface SharedActivationData {
  activation: {
    id: string;
    title: string;
    brief: string | null;
    image_url: string | null;
    deadline: string;
    status: string;
    type: string;
    total_budget: number;
    winner_count: number | null;
    platforms: string[] | null;
  };
  leaderboard: Array<{
    creator_handle: string | null;
    total_posts: number;
    total_views: number;
    total_likes: number;
    total_comments: number;
    cumulative_score: number;
    current_rank: number;
    prize_amount: number;
    is_winner: boolean;
    submissions?: Array<{
      content_url: string | null;
      post_url: string | null;
      views: number;
      likes: number;
      comments: number;
      submitted_at: string;
    }>;
  }>;
  totals: {
    views: number;
    likes: number;
    comments: number;
    entries: number;
  };
}

export async function fetchSharedActivationData(
  token: string,
  password?: string,
): Promise<ApiResponse<SharedActivationData>> {
  try {
    const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
    const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

    if (!supabaseUrl) {
      return {
        data: null,
        error: new Error("Supabase URL not configured"),
      };
    }

    const url = `${supabaseUrl}/functions/v1/share_activation?token=${encodeURIComponent(token)}`;
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
    };
    if (supabaseAnonKey) {
      headers.apikey = supabaseAnonKey;
      headers.Authorization = `Bearer ${supabaseAnonKey}`;
    }

    const body =
      typeof password === "string" ? JSON.stringify({ password }) : undefined;

    const response = await fetch(url, {
      method: "POST",
      headers,
      ...(body ? { body } : {}),
    });

    if (!response.ok) {
      let errorMessage = "Failed to fetch shared activation";
      try {
        const errorData = await response.json();
        errorMessage = errorData?.message ?? errorData?.error ?? errorMessage;
      } catch {
        errorMessage = response.statusText;
      }

      if (response.status === 404) {
        return {
          data: null,
          error: new Error("Share link not found or expired"),
        };
      }
      if (response.status === 401) {
        const msg = (errorMessage || "").toLowerCase();
        if (msg.includes("incorrect password")) {
          return {
            data: null,
            error: Object.assign(new Error("Incorrect password"), {
              code: "INCORRECT_PASSWORD",
            }),
          };
        }
        return {
          data: null,
          error: Object.assign(new Error(errorMessage || "Password required"), {
            code: "PASSWORD_REQUIRED",
          }),
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
    const message = err instanceof Error ? err.message : "Network error";
    return {
      data: null,
      error: new Error(message),
    };
  }
}
