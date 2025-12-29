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

    // Get current session and refresh if needed
    const {
      data: { session },
      error: sessionError,
    } = await supabase.auth.getSession();

    if (sessionError) {
      console.error("Session error:", sessionError);
      return {
        data: null,
        error: new Error("Session error: " + sessionError.message),
      };
    }

    if (!session) {
      console.error("No session found");
      return { data: null, error: new Error("Not authenticated") };
    }

    // Refresh the session if it's close to expiring
    const expiresAt = session.expires_at;
    if (expiresAt) {
      const expiresIn = expiresAt - Math.floor(Date.now() / 1000);
      if (expiresIn < 60) {
        // Token expires in less than 1 minute, refresh it
        console.log("Token expiring soon, refreshing...");
        const {
          data: { session: refreshedSession },
          error: refreshError,
        } = await supabase.auth.refreshSession();
        if (refreshError) {
          console.error("Failed to refresh session:", refreshError);
          return {
            data: null,
            error: new Error("Session expired. Please log in again."),
          };
        }
        if (refreshedSession) {
          console.log("Session refreshed successfully");
        }
      }
    }

    // Get the latest session after potential refresh
    const {
      data: { session: currentSession },
      error: finalSessionError,
    } = await supabase.auth.getSession();

    if (finalSessionError) {
      console.error("Final session error:", finalSessionError);
      return {
        data: null,
        error: new Error("Session error: " + finalSessionError.message),
      };
    }

    if (!currentSession) {
      console.error("No session after refresh");
      return { data: null, error: new Error("Not authenticated") };
    }

    // Check if token is expired
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

    // Get Supabase URL from environment variable
    const supabaseUrl = (import.meta as any).env?.VITE_SUPABASE_URL || "";
    const supabaseAnonKey =
      (import.meta as any).env?.VITE_SUPABASE_ANON_KEY || "";
    if (!supabaseUrl) {
      console.error("Supabase URL not configured");
      return { data: null, error: new Error("Supabase URL not configured") };
    }
    const functionUrl = `${supabaseUrl}/functions/v1/scrape-post`;
    console.log("Function URL:", functionUrl);

    // Call Edge Function
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      Authorization: `Bearer ${currentSession.access_token}`,
    };
    if (supabaseAnonKey) {
      headers.apikey = supabaseAnonKey;
    }
    console.log("Request headers:", {
      ...headers,
      Authorization: "Bearer [REDACTED]",
    });

    console.log("Sending fetch request...");
    const response = await fetch(functionUrl, {
      method: "POST",
      headers,
      body: JSON.stringify(request),
    });
    console.log("Response received:", {
      status: response.status,
      statusText: response.statusText,
      ok: response.ok,
    });

    let data: ScrapePostResponse;
    try {
      const responseText = await response.text();
      console.log(
        "Response text (first 500 chars):",
        responseText.substring(0, 500)
      );
      data = JSON.parse(responseText);
      console.log("Parsed response data:", data);
    } catch (parseError) {
      console.error("Failed to parse scraping response:", parseError);
      const errorText = await response
        .text()
        .catch(() => "Failed to get response text");
      console.error("Raw response text:", errorText);
      return {
        data: null,
        error: new Error(
          `Invalid response from scraping service: ${errorText.substring(
            0,
            200
          )}`
        ),
      };
    }

    if (!response.ok || !data.success) {
      // Extract error message safely - handle both string and object errors
      let errorMessage = `HTTP ${response.status}: Failed to scrape post`;
      if (data.error) {
        if (typeof data.error === "string") {
          errorMessage = data.error;
        } else if (typeof data.error === "object" && data.error !== null) {
          // If error is an object, try to extract message or stringify it
          errorMessage =
            (data.error as any).message || JSON.stringify(data.error);
        }
      }

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

    if (
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

    // Get current session and refresh if needed
    const {
      data: { session },
      error: sessionError,
    } = await supabase.auth.getSession();

    if (sessionError) {
      console.error("Session error:", sessionError);
      return {
        data: null,
        error: new Error("Session error: " + sessionError.message),
      };
    }

    if (!session) {
      console.error("No session found");
      return { data: null, error: new Error("Not authenticated") };
    }

    // Refresh the session if it's close to expiring
    const expiresAt = session.expires_at;
    if (expiresAt) {
      const expiresIn = expiresAt - Math.floor(Date.now() / 1000);
      if (expiresIn < 60) {
        console.log("Token expiring soon, refreshing...");
        const {
          data: { session: refreshedSession },
          error: refreshError,
        } = await supabase.auth.refreshSession();
        if (refreshError) {
          console.error("Failed to refresh session:", refreshError);
          return {
            data: null,
            error: new Error("Session expired. Please log in again."),
          };
        }
        if (refreshedSession) {
          console.log("Session refreshed successfully");
        }
      }
    }

    // Get the latest session after potential refresh
    const {
      data: { session: currentSession },
      error: finalSessionError,
    } = await supabase.auth.getSession();

    if (finalSessionError) {
      console.error("Final session error:", finalSessionError);
      return {
        data: null,
        error: new Error("Session error: " + finalSessionError.message),
      };
    }

    if (!currentSession) {
      console.error("No session after refresh");
      return { data: null, error: new Error("Not authenticated") };
    }

    // Check if token is expired
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

    // Get Supabase URL from environment variable
    const supabaseUrl = (import.meta as any).env?.VITE_SUPABASE_URL || "";
    const supabaseAnonKey =
      (import.meta as any).env?.VITE_SUPABASE_ANON_KEY || "";
    if (!supabaseUrl) {
      console.error("Supabase URL not configured");
      return { data: null, error: new Error("Supabase URL not configured") };
    }
    const functionUrl = `${supabaseUrl}/functions/v1/scrape-all-posts`;
    console.log("Function URL:", functionUrl);

    // Call Edge Function
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      Authorization: `Bearer ${currentSession.access_token}`,
    };
    if (supabaseAnonKey) {
      headers.apikey = supabaseAnonKey;
    }

    console.log("Sending fetch request to edge function...");
    const response = await fetch(functionUrl, {
      method: "POST",
      headers,
      body: JSON.stringify({ campaignId }),
    });

    console.log("Response received:", {
      status: response.status,
      statusText: response.statusText,
      ok: response.ok,
    });

    let data: { success: boolean; data?: ScrapeAllResult; error?: string };
    try {
      const responseText = await response.text();
      console.log(
        "Response text (first 500 chars):",
        responseText.substring(0, 500)
      );
      data = JSON.parse(responseText);
      console.log("Parsed response data:", data);
    } catch (parseError) {
      console.error("Failed to parse scraping response:", parseError);
      const errorText = await response.text().catch(() => "Failed to get response text");
      console.error("Raw response text:", errorText);
      return {
        data: null,
        error: new Error(
          `Invalid response from scraping service: ${errorText.substring(
            0,
            200
          )}`
        ),
      };
    }

    if (!response.ok || !data.success) {
      const errorMessage = data.error || `HTTP ${response.status}: Failed to scrape all posts`;
      console.error("Scraping failed:", errorMessage);
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

    if (
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
