import { supabase } from "../supabase";
import type { ApiResponse } from "../types/database";
import { formatError, createError, isNetworkError, isAuthError } from "../utils/errorMessages";

interface ScrapePostRequest {
  postId: string;
  postUrl: string;
  platform: "tiktok" | "instagram" | "youtube" | "twitter" | "facebook";
}

interface ScrapePostResponse {
  success: boolean;
  metrics?: {
    views: number;
    likes: number;
    comments: number;
    shares: number;
    engagement_rate: number;
    owner_username?: string | null;
  };
  post?: {
    id: string;
    platform: "tiktok" | "instagram" | "youtube" | "twitter" | "facebook";
    externalId: string | null;
    sourceUrl: string;
    ownerUsername: string | null;
    creatorId: string | null;
    status: string;
  } | null;
  creatorMatch?: {
    matched: boolean;
    created?: boolean;
    creatorId?: string;
    creatorHandle?: string;
    creatorName?: string | null;
  };
  error?: string;
}

interface ScrapeAllResult {
  success_count: number;
  error_count: number;
  errors: Array<{ postId: string; message: string }>;
}

/**
 * Scrape metrics for a single post using Supabase Edge Function
 */
export async function scrapePost(
  request: ScrapePostRequest
): Promise<ApiResponse<ScrapePostResponse>> {
  try {
    // Always refresh the session to ensure we have a valid token
    // This is critical because getSession() returns cached data that may be stale
    const {
      data: { session: refreshedSession },
      error: refreshError,
    } = await supabase.auth.refreshSession();

    // Use the refreshed session directly instead of calling getSession() again
    // getSession() may return cached/stale data even after refresh
    let currentSession = refreshedSession;

    if (refreshError || !refreshedSession) {
      if (import.meta.env.DEV) {
        console.warn(
          "Session refresh failed, falling back to current session:",
          refreshError
        );
      }
      // Fall back to getting current session if refresh fails
      const {
        data: { session: fallbackSession },
        error: sessionError,
      } = await supabase.auth.getSession();

      if (sessionError || !fallbackSession) {
        if (import.meta.env.DEV) {
          console.error("Session error:", sessionError);
        }
        return {
          data: null,
          error: new Error("Session expired. Please log in again."),
        };
      }
      currentSession = fallbackSession;
    }

    if (!currentSession) {
      if (import.meta.env.DEV) {
        console.error("No session found");
      }
      return { data: null, error: new Error("Not authenticated") };
    }

    // Check if token is expired (shouldn't happen after refresh, but safety check)
    if (currentSession.expires_at) {
      const expiresIn =
        currentSession.expires_at - Math.floor(Date.now() / 1000);
      if (expiresIn <= 0) {
        if (import.meta.env.DEV) {
          console.error("Token has expired");
        }
        return {
          data: null,
          error: new Error("Session expired. Please log in again."),
        };
      }
    }

    // Use direct fetch to get better error details
    const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
    if (!supabaseUrl) {
    return {
      data: null,
      error: createError("Missing Supabase URL configuration", { operation: "scrape post" }),
    };
    }

    const invokeScrape = async (accessToken?: string) => {
      const headers: Record<string, string> = {
        "Content-Type": "application/json",
      };
      if (accessToken) {
        headers.Authorization = `Bearer ${accessToken}`;
      }
      const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
      if (anonKey) {
        headers.apikey = anonKey;
      }

      const response = await fetch(`${supabaseUrl}/functions/v1/scrape-post`, {
        method: "POST",
        headers,
        body: JSON.stringify(request),
      });

      const responseText = await response.text();
      let responseData: any = null;

      try {
        responseData = JSON.parse(responseText);
      } catch (parseError) {
        // Non-JSON response - return error with response text
        return {
          data: null,
          error: new Error(
            `Invalid response from scrape-post: ${response.status} ${response.statusText}`
          ),
          status: response.status,
          responseText: responseText.substring(0, 500),
        };
      }

      if (!response.ok) {
        const errorMessage =
          responseData?.error ||
          responseData?.message ||
          `HTTP ${response.status}: ${response.statusText}`;
        return {
          data: null,
          error: new Error(errorMessage),
          status: response.status,
        };
      }

      return {
        data: responseData,
        error: null,
      };
    };

    let result = await invokeScrape(currentSession.access_token);
    let { data, error } = result as any;

    if (error) {
      const errorMessage = error.message || "";
      const errorStatus = (error as any)?.status || result?.status;
      const isAuthError =
        errorStatus === 401 ||
        errorMessage.includes("JWT") ||
        errorMessage.includes("Unauthorized");

      if (isAuthError) {
        if (import.meta.env.DEV) {
          console.warn(
            "Scrape-post auth error, refreshing session and retrying..."
          );
        }
        const { error: refreshError } = await supabase.auth.refreshSession();
        if (!refreshError) {
          const {
            data: { session: refreshedSession },
          } = await supabase.auth.getSession();
          if (refreshedSession?.access_token) {
            result = await invokeScrape(refreshedSession.access_token);
            ({ data, error } = result as any);
          }
        }
      }
    }

    if (error || !data) {
      if (import.meta.env.DEV) {
        console.error("Scraping failed:", error, result);
      }
      const errorMessage =
        error?.message || result?.responseText || "Failed to scrape post";
      return {
        data: null,
        error: createError(errorMessage, { operation: "scrape post", resource: "post" }),
      };
    }

    if (!data.success) {
      const errorMessage =
        (typeof data.error === "string" && data.error) ||
        (typeof data.error === "object" && data.error !== null
          ? (data.error as any).message || JSON.stringify(data.error)
          : "Failed to scrape post");

      if (import.meta.env.DEV) {
        console.error("Scraping failed:", errorMessage);
        console.error("Full error response:", data);
      }
      return {
        data: null,
        error: createError(errorMessage, { operation: "scrape post", resource: "post" }),
      };
    }

    return { data, error: null };
  } catch (err) {
    const error = err as Error;
    if (import.meta.env.DEV) {
      console.error("Scraping request error:", error);
    }

    // Use standardized error formatting
    let errorMessage = formatError(error, { operation: "scrape post", resource: "post" });
    
    // Add specific hints for network errors
    if (isNetworkError(error)) {
      errorMessage = 'Cannot reach scraping service. The Edge Function "scrape-post" may not be deployed. Please check:\n' +
        "1. The Edge Function is deployed in Supabase (Edge Functions → Functions)\n" +
        "2. Your Supabase URL is correct in .env file\n" +
        "3. Your internet connection is working";
    }

    return {
      data: null,
      error: createError(errorMessage, { operation: "scrape post", resource: "post" }),
    };
  }
}

/**
 * Helper to get a valid session, refreshing if needed
 */
async function getValidSession() {
  const {
    data: { session: refreshedSession },
    error: refreshError,
  } = await supabase.auth.refreshSession();

  let currentSession = refreshedSession;

  if (refreshError || !refreshedSession) {
    const {
      data: { session: fallbackSession },
      error: sessionError,
    } = await supabase.auth.getSession();

    if (sessionError || !fallbackSession) {
      return null;
    }
    currentSession = fallbackSession;
  }

  if (!currentSession) return null;

  if (currentSession.expires_at) {
    const expiresIn = currentSession.expires_at - Math.floor(Date.now() / 1000);
    if (expiresIn <= 0) return null;
  }

  return currentSession;
}

/**
 * Start scraping all posts in a campaign.
 * Returns a promise that keeps the connection alive while the Edge Function processes.
 * Use pollScrapeProgress() in parallel for UI progress updates.
 */
export async function startScrapeAllPosts(
  campaignId: string
): Promise<ApiResponse<{ started: boolean; result?: any }>> {
  try {
    const session = await getValidSession();
    if (!session) {
      return { data: null, error: new Error("Session expired. Please log in again.") };
    }

    const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
    const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      Authorization: `Bearer ${session.access_token}`,
    };
    if (anonKey) {
      headers.apikey = anonKey;
    }

    // Use a 5-minute timeout — the edge function can take a while for large campaigns
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5 * 60 * 1000);

    try {
      const response = await fetch(`${supabaseUrl}/functions/v1/scrape-all-posts`, {
        method: "POST",
        headers,
        body: JSON.stringify({ campaignId }),
        signal: controller.signal,
      });
      clearTimeout(timeoutId);

      const responseData = await response.json().catch(() => null);

      if (!response.ok) {
        const errorMessage = responseData?.error || `HTTP ${response.status}`;
        if (import.meta.env.DEV) {
          console.error("scrape-all-posts error:", errorMessage);
        }
        // Still return started: true — the function may have partially completed
        return { data: { started: true, result: responseData }, error: null };
      }

      return { data: { started: true, result: responseData }, error: null };
    } catch (fetchErr) {
      clearTimeout(timeoutId);
      const isAbort = fetchErr instanceof DOMException && fetchErr.name === "AbortError";
      if (isAbort) {
        // Timeout — the function is probably still running server-side
        if (import.meta.env.DEV) {
          console.warn("scrape-all-posts client timeout (function may still be running)");
        }
        return { data: { started: true }, error: null };
      }
      throw fetchErr;
    }
  } catch (err) {
    const error = err as Error;
    return { data: null, error: new Error(error.message || "Failed to start scraping") };
  }
}

/**
 * Poll scrape progress by checking post statuses directly.
 * No extra DB table needed — we just count posts by status.
 */
export async function pollScrapeProgress(
  campaignId: string
): Promise<ApiResponse<{
  total: number;
  scraped: number;
  failed: number;
  pending: number;
  scraping: number;
  done: boolean;
}>> {
  try {
    // Use the existing supabase client (already authenticated)
    const { data: posts, error } = await supabase
      .from("posts")
      .select("status")
      .eq("campaign_id", campaignId);

    if (error) {
      return { data: null, error: new Error(error.message) };
    }

    const total = posts?.length ?? 0;
    const scraped = posts?.filter((p) => p.status === "scraped").length ?? 0;
    const failed = posts?.filter((p) => p.status === "failed").length ?? 0;
    const pending = posts?.filter((p) => p.status === "pending" || p.status === "manual").length ?? 0;
    const scraping = posts?.filter((p) => p.status === "scraping").length ?? 0;

    // Done when nothing is actively "scraping" AND no posts are waiting to be scraped
    // Previously this was just `scraping === 0`, which would immediately return done=true
    // before the edge function had a chance to mark posts as "scraping"
    const done = scraping === 0 && pending === 0;

    return {
      data: { total, scraped, failed, pending, scraping, done },
      error: null,
    };
  } catch (err) {
    const error = err as Error;
    return { data: null, error: new Error(error.message || "Failed to poll progress") };
  }
}

/**
 * Reset posts stuck in "scraping" status (updated_at older than 5 minutes) back to "pending".
 * Use when the Edge Function dies before cleanup, leaving posts stuck.
 */
export async function resetStuckScrapingPosts(
  campaignId: string
): Promise<ApiResponse<{ count: number }>> {
  try {
    const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString();
    const { data, error } = await supabase
      .from("posts")
      .update({ status: "pending" })
      .eq("campaign_id", campaignId)
      .eq("status", "scraping")
      .lt("updated_at", fiveMinutesAgo)
      .select("id");

    if (error) {
      return { data: null, error: new Error(error.message) };
    }

    const count = data?.length ?? 0;
    return { data: { count }, error: null };
  } catch (err) {
    const error = err as Error;
    return { data: null, error: new Error(error.message || "Failed to reset stuck posts") };
  }
}

/**
 * Scrape metrics for all posts in a campaign
 * Uses server-side edge function to avoid client-side timeouts
 */
export async function scrapeAllPosts(
  campaignId: string
): Promise<ApiResponse<ScrapeAllResult>> {
  try {
    const currentSession = await getValidSession();
    if (!currentSession) {
      return { data: null, error: new Error("Session expired. Please log in again.") };
    }

    const invokeScrapeAll = async (accessToken?: string) => {
      const headers: Record<string, string> = {};
      if (accessToken) {
        headers.Authorization = `Bearer ${accessToken}`;
      }
      return supabase.functions.invoke<{
        success: boolean;
        data?: ScrapeAllResult;
        error?: string;
      }>("scrape-all-posts", {
        body: { campaignId },
        headers,
      });
    };

    let { data, error } = await invokeScrapeAll(currentSession.access_token);

    if (error) {
      const errorMessage = error.message || "";
      const errorStatus =
        (error as any)?.status || (error as any)?.context?.status;
      const isAuthErr =
        errorStatus === 401 ||
        errorMessage.includes("JWT") ||
        errorMessage.includes("Unauthorized");

      if (isAuthErr) {
        const { error: refreshError } = await supabase.auth.refreshSession();
        if (!refreshError) {
          const {
            data: { session: refreshedSession },
          } = await supabase.auth.getSession();
          if (refreshedSession?.access_token) {
            ({ data, error } = await invokeScrapeAll(
              refreshedSession.access_token
            ));
          }
        }
      }
    }

    if (error || !data) {
      return {
        data: null,
        error: new Error(error?.message || "Failed to scrape all posts"),
      };
    }

    if (!data.success) {
      return {
        data: null,
        error: new Error(data.error || "Failed to scrape all posts"),
      };
    }

    if (!data.data) {
      return {
        data: null,
        error: new Error("No data returned from scraping service"),
      };
    }

    return { data: data.data, error: null };
  } catch (err) {
    const error = err as Error;
    let errorMessage = error.message || "Network error while scraping posts";

    if (
      errorMessage.includes("Failed to send a request to the Edge Function")
    ) {
      errorMessage =
        "Cannot reach the scraping service. Check that Edge Functions are deployed and your Supabase URL is correct.";
    } else if (
      errorMessage.includes("Failed to fetch") ||
      errorMessage.includes("NetworkError") ||
      errorMessage.includes("Network request failed")
    ) {
      errorMessage =
        'Cannot reach scraping service. The Edge Function "scrape-all-posts" may not be deployed.';
    } else if (errorMessage.includes("CORS")) {
      errorMessage =
        "CORS error. The Edge Function may not be properly configured.";
    } else if (errorMessage.includes("timeout")) {
      errorMessage =
        "Request timed out. The scraping service may be slow or unavailable.";
    }

    return {
      data: null,
      error: new Error(errorMessage),
    };
  }
}
