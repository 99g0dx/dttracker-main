import { supabase } from "../supabase";
import type { ApiResponse } from "../types/database";

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
    console.log("=== Starting scrape request ===");
    console.log("Request:", request);

    // Always refresh the session to ensure we have a valid token
    // This is critical because getSession() returns cached data that may be stale
    console.log("Refreshing session to ensure fresh token...");
    const {
      data: { session: refreshedSession },
      error: refreshError,
    } = await supabase.auth.refreshSession();

    // Use the refreshed session directly instead of calling getSession() again
    // getSession() may return cached/stale data even after refresh
    let currentSession = refreshedSession;

    if (refreshError || !refreshedSession) {
      console.warn("Session refresh failed, falling back to current session:", refreshError);
      // Fall back to getting current session if refresh fails
      const {
        data: { session: fallbackSession },
        error: sessionError,
      } = await supabase.auth.getSession();

      if (sessionError || !fallbackSession) {
        console.error("Session error:", sessionError);
        return {
          data: null,
          error: new Error("Session expired. Please log in again."),
        };
      }
      currentSession = fallbackSession;
    }

    if (!currentSession) {
      console.error("No session found");
      return { data: null, error: new Error("Not authenticated") };
    }

    // Check if token is expired (shouldn't happen after refresh, but safety check)
    if (currentSession.expires_at) {
      const expiresIn =
        currentSession.expires_at - Math.floor(Date.now() / 1000);
      if (expiresIn <= 0) {
        console.error("Token has expired");
        return {
          data: null,
          error: new Error("Session expired. Please log in again."),
        };
      }
      console.log(`Token expires in ${expiresIn} seconds`);
    }

    console.log("Session found, user:", currentSession.user?.id);
    console.log(
      "Access token length:",
      currentSession.access_token?.length || 0
    );

    // Use direct fetch to get better error details
    const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
    if (!supabaseUrl) {
      return {
        data: null,
        error: new Error('Missing Supabase URL configuration'),
      };
    }

    const invokeScrape = async (accessToken?: string) => {
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
      };
      if (accessToken) {
        headers.Authorization = `Bearer ${accessToken}`;
      }
      const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
      if (anonKey) {
        headers.apikey = anonKey;
      }

      const response = await fetch(`${supabaseUrl}/functions/v1/scrape-post`, {
        method: 'POST',
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
          error: new Error(`Invalid response from scrape-post: ${response.status} ${response.statusText}`),
          status: response.status,
          responseText: responseText.substring(0, 500),
        };
      }

      if (!response.ok) {
        const errorMessage = responseData?.error || responseData?.message || `HTTP ${response.status}: ${response.statusText}`;
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

    console.log("Invoking edge function scrape-post...");
    let result = await invokeScrape(currentSession.access_token);
    let { data, error } = result as any;

    if (error) {
      const errorMessage = error.message || "";
      const errorStatus = (error as any)?.status || result?.status;
      const isAuthError =
        errorStatus === 401 || errorMessage.includes("JWT") || errorMessage.includes("Unauthorized");

      if (isAuthError) {
        console.warn("Scrape-post auth error, refreshing session and retrying...");
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
      console.error("Scraping failed:", error, result);
      const errorMessage = error?.message || result?.responseText || "Failed to scrape post";
      return {
        data: null,
        error: new Error(errorMessage),
      };
    }

    if (!data.success) {
      const errorMessage =
        (typeof data.error === "string" && data.error) ||
        (typeof data.error === "object" && data.error !== null
          ? (data.error as any).message || JSON.stringify(data.error)
          : "Failed to scrape post");

      console.error("Scraping failed:", errorMessage);
      console.error("Full error response:", data);
      return {
        data: null,
        error: new Error(errorMessage),
      };
    }

    console.log("✅ Scraping successful!");
    console.log("Scraped metrics:", data.metrics);
    return { data, error: null };
  } catch (err) {
    const error = err as Error;
    console.error("Scraping request error:", error);

    // Provide more specific error messages for common issues
    let errorMessage = error.message || "Network error while scraping post";

    // Check if it's a non-2xx status code error
    if (errorMessage.includes("non-2xx") || errorMessage.includes("Edge Function returned")) {
      errorMessage = "Scraping service error. The post may be unavailable or the scraping service is temporarily down. Please try again in a moment.";
    } else if (
      errorMessage.includes("Failed to fetch") ||
      errorMessage.includes("NetworkError") ||
      errorMessage.includes("Network request failed")
    ) {
      errorMessage =
        'Cannot reach scraping service. The Edge Function "scrape-post" may not be deployed. Please check:\n' +
        "1. The Edge Function is deployed in Supabase (Edge Functions → Functions)\n" +
        "2. Your Supabase URL is correct in .env file\n" +
        "3. Your internet connection is working";
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

/**
 * Scrape metrics for all posts in a campaign
 * Uses server-side edge function to avoid client-side timeouts
 */
export async function scrapeAllPosts(
  campaignId: string
): Promise<ApiResponse<ScrapeAllResult>> {
  try {
    console.log("=== Starting scrape all posts request ===");
    console.log("Campaign ID:", campaignId);

    // Always refresh the session to ensure we have a valid token
    // This is critical because getSession() returns cached data that may be stale
    console.log("Refreshing session to ensure fresh token...");
    const {
      data: { session: refreshedSession },
      error: refreshError,
    } = await supabase.auth.refreshSession();

    // Use the refreshed session directly instead of calling getSession() again
    // getSession() may return cached/stale data even after refresh
    let currentSession = refreshedSession;

    if (refreshError || !refreshedSession) {
      console.warn("Session refresh failed, falling back to current session:", refreshError);
      // Fall back to getting current session if refresh fails
      const {
        data: { session: fallbackSession },
        error: sessionError,
      } = await supabase.auth.getSession();

      if (sessionError || !fallbackSession) {
        console.error("Session error:", sessionError);
        return {
          data: null,
          error: new Error("Session expired. Please log in again."),
        };
      }
      currentSession = fallbackSession;
    }

    if (!currentSession) {
      console.error("No session found");
      return { data: null, error: new Error("Not authenticated") };
    }

    // Check if token is expired (shouldn't happen after refresh, but safety check)
    if (currentSession.expires_at) {
      const expiresIn =
        currentSession.expires_at - Math.floor(Date.now() / 1000);
      if (expiresIn <= 0) {
        console.error("Token has expired");
        return {
          data: null,
          error: new Error("Session expired. Please log in again."),
        };
      }
      console.log(`Token expires in ${expiresIn} seconds`);
    }

    console.log("Session found, user:", currentSession.user?.id);

    const invokeScrapeAll = async (accessToken?: string) => {
      const headers: Record<string, string> = {};
      if (accessToken) {
        headers.Authorization = `Bearer ${accessToken}`;
      }
      return supabase.functions.invoke<{ success: boolean; data?: ScrapeAllResult; error?: string }>(
        "scrape-all-posts",
        {
          body: { campaignId },
          headers,
        }
      );
    };

    console.log("Invoking edge function scrape-all-posts...");
    // #region agent log
    fetch('http://127.0.0.1:7242/ingest/1c4fc1e3-c4d5-4e26-91bc-35bf48274c5b',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'scraping.ts:330',message:'Calling scrape-all-posts',data:{userId:currentSession.user?.id,hasToken:!!currentSession.access_token},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'C'})}).catch(()=>{});
    // #endregion
    let { data, error } = await invokeScrapeAll(currentSession.access_token);

    if (error) {
      const errorMessage = error.message || "";
      const errorStatus = (error as any)?.status || (error as any)?.context?.status;
      const isAuthError =
        errorStatus === 401 || errorMessage.includes("JWT") || errorMessage.includes("Unauthorized");

      if (isAuthError) {
        console.warn("Scrape-all-posts auth error, refreshing session and retrying...");
        const { error: refreshError } = await supabase.auth.refreshSession();
        if (!refreshError) {
          const {
            data: { session: refreshedSession },
          } = await supabase.auth.getSession();
          if (refreshedSession?.access_token) {
            ({ data, error } = await invokeScrapeAll(refreshedSession.access_token));
          }
        }
      }
    }

    if (error || !data) {
      console.error("Scraping failed:", error);
      // #region agent log
      fetch('http://127.0.0.1:7242/ingest/1c4fc1e3-c4d5-4e26-91bc-35bf48274c5b',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'scraping.ts:353',message:'scrape-all-posts returned error',data:{error:error?.message,errorStatus:(error as any)?.status,hasData:!!data},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'A'})}).catch(()=>{});
      // #endregion
      return {
        data: null,
        error: new Error(error?.message || "Failed to scrape all posts"),
      };
    }

    if (!data.success) {
      const errorMessage = data.error || "Failed to scrape all posts";
      console.error("Scraping failed:", errorMessage);
      // #region agent log
      fetch('http://127.0.0.1:7242/ingest/1c4fc1e3-c4d5-4e26-91bc-35bf48274c5b',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'scraping.ts:361',message:'scrape-all-posts returned success=false',data:{errorMessage,errorCount:data.data?.error_count,successCount:data.data?.success_count,firstError:data.data?.errors?.[0]?.message},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'A'})}).catch(()=>{});
      // #endregion
      return {
        data: null,
        error: new Error(errorMessage),
      };
    }

    if (!data.data) {
      return {
        data: null,
        error: new Error("No data returned from scraping service"),
      };
    }

    console.log("✅ Scrape all posts successful!");
    console.log("Results:", data.data);
    return { data: data.data, error: null };
  } catch (err) {
    const error = err as Error;
    console.error("Scrape all posts request error:", error);

    // Provide more specific error messages for common issues
    let errorMessage = error.message || "Network error while scraping posts";

    if (errorMessage.includes("Failed to send a request to the Edge Function")) {
      errorMessage =
        "Cannot reach the scraping service. Check that Edge Functions (scrape-post / scrape-all-posts) are deployed and your Supabase URL is correct.";
    } else if (
      errorMessage.includes("Failed to fetch") ||
      errorMessage.includes("NetworkError") ||
      errorMessage.includes("Network request failed")
    ) {
      errorMessage =
        'Cannot reach scraping service. The Edge Function "scrape-all-posts" may not be deployed. Please check:\n' +
        "1. The Edge Function is deployed in Supabase (Edge Functions → Functions)\n" +
        "2. Your Supabase URL is correct in .env file\n" +
        "3. Your internet connection is working";
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
