import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.38.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

interface ScrapeAllRequest {
  campaignId: string;
  chainDepth?: number; // 0 = user-initiated, 1+ = chained from previous run
}

interface ScrapeAllResult {
  success_count: number;
  error_count: number;
  errors: Array<{ postId: string; message: string; post_url?: string; platform?: string }>;
}

const BATCH_SIZE = 6; // Process at most 6 posts per run to stay within time limit
const MAX_CHAIN_DEPTH = 5; // Max auto-chained runs per user action

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    // Get authentication token from request (optional when verify_jwt is disabled)
    const authHeader =
      req.headers.get("authorization") ?? req.headers.get("Authorization");
    if (!authHeader) {
      console.warn(
        "No authorization header provided; proceeding without user context"
      );
    }

    // Parse request body
    const body: ScrapeAllRequest = await req.json();
    const { campaignId, chainDepth = 0 } = body;

    if (!campaignId) {
      return new Response(
        JSON.stringify({ error: "Missing campaignId in request body" }),
        {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
          status: 400,
        }
      );
    }

    // Get environment variables
    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY") ?? "";

    if (!supabaseUrl || !supabaseServiceKey) {
      throw new Error("Missing Supabase configuration");
    }

    // Extract token to get user info
    const token = authHeader ? authHeader.replace("Bearer ", "") : null;
    if (!token && authHeader) {
      console.error("Missing authentication token");
      throw new Error("Missing authentication token");
    }

    // Create service role client for database operations
    // Note: Supabase Edge Functions automatically verify the JWT before our code runs
    // If we reach here, the JWT is valid
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Get user info from the token (for logging and RLS check)
    let user;
    if (token) {
      try {
        const {
          data: { user: userData },
          error: userError,
        } = await supabase.auth.getUser(token);

        if (userError) {
          console.warn("Could not get user from token:", userError.message);
          // Continue anyway - Supabase already verified the JWT
        } else if (userData) {
          user = userData;
          console.log(`Authenticated user: ${user.id}`);
        }
      } catch (err) {
        console.warn("User verification warning:", err);
        // Continue anyway - Supabase already verified the JWT
      }
    }

    console.log("=== Scrape All Posts Started ===");
    console.log("Campaign ID:", campaignId, "| Chain depth:", chainDepth);
    if (user) {
      console.log("User ID:", user.id);
    }
    console.log("Timestamp:", new Date().toISOString());

    // Verify campaign ownership only for user-initiated requests (chainDepth 0)
    // Chained runs use service key and skip this check (first run already verified)
    if (authHeader && chainDepth === 0) {
      const userClient = createClient(supabaseUrl, supabaseAnonKey, {
        global: {
          headers: { Authorization: authHeader },
        },
      });

      const { data: campaign, error: campaignError } = await userClient
        .from("campaigns")
        .select("id")
        .eq("id", campaignId)
        .single();

      if (campaignError || !campaign) {
        return new Response(
          JSON.stringify({
            success: false,
            error: "Campaign not found or access denied",
          }),
          {
            headers: { ...corsHeaders, "Content-Type": "application/json" },
            status: 403,
          }
        );
      }
    }

    // Fetch all posts for the campaign using service role client
    // Include posts that are pending, scraped, failed, or scraping (we'll filter stuck ones)
    // Note: last_scraped_at may not exist in older databases, so we'll handle it gracefully
    let posts: any[] | null = null;
    let fetchError: any = null;

    // Try to fetch with last_scraped_at first
    const postsResult = await supabase
      .from("posts")
      .select("id, post_url, platform, status, updated_at, last_scraped_at")
      .eq("campaign_id", campaignId)
      .not("post_url", "is", null)
      .in("status", ["pending", "scraped", "failed", "scraping", "manual"]);

    posts = postsResult.data;
    fetchError = postsResult.error;

    // If the query fails due to missing column, retry without last_scraped_at
    if (
      fetchError &&
      fetchError.message &&
      fetchError.message.includes("last_scraped_at")
    ) {
      console.warn(
        "last_scraped_at column not found, falling back to updated_at only"
      );
      const retryResult = await supabase
        .from("posts")
        .select("id, post_url, platform, status, updated_at")
        .eq("campaign_id", campaignId)
        .not("post_url", "is", null)
        .in("status", ["pending", "scraped", "failed", "scraping", "manual"]);

      if (retryResult.error) {
        console.error("Error fetching posts (retry):", retryResult.error);
        return new Response(
          JSON.stringify({
            success: false,
            error: retryResult.error.message,
          }),
          {
            headers: { ...corsHeaders, "Content-Type": "application/json" },
            status: 500,
          }
        );
      }

      posts = retryResult.data;
      fetchError = null;
    } else if (fetchError) {
      console.error("Error fetching posts:", fetchError);
      return new Response(
        JSON.stringify({
          success: false,
          error: fetchError.message,
        }),
        {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
          status: 500,
        }
      );
    }

    if (!posts || posts.length === 0) {
      return new Response(
        JSON.stringify({
          success: true,
          data: {
            success_count: 0,
            error_count: 0,
            errors: [],
          },
        }),
        {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
          status: 200,
        }
      );
    }

    console.log(`Found ${posts.length} posts to scrape`);

    // Filter posts that need scraping
    // Consider posts "stuck" if they've been scraping for more than 5 minutes
    const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);
    // Prevent re-scraping posts that were recently scraped (within last hour)
    const MIN_RESCrape_INTERVAL = 60 * 60 * 1000; // 1 hour in milliseconds
    const oneHourAgo = new Date(Date.now() - MIN_RESCrape_INTERVAL);

    const filteredPosts = posts.filter((post) => {
      // Skip posts currently being scraped (unless stuck for >5 minutes)
      if (post.status === "scraping") {
        const updatedAt = new Date(post.updated_at);
        return updatedAt < fiveMinutesAgo; // Only scrape if stuck >5 min
      }

      // Skip recently scraped posts (unless they failed)
      if (post.status === "scraped") {
        // Check last_scraped_at if available, otherwise fall back to updated_at
        // This makes the code backward compatible if the column doesn't exist yet
        const lastScrapedAt = (post as any).last_scraped_at
          ? new Date((post as any).last_scraped_at)
          : new Date(post.updated_at);
        return lastScrapedAt < oneHourAgo; // Only re-scrape if >1 hour old
      }

      // Always scrape pending and failed posts
      return true;
    });

    // Sort posts by priority: pending/failed first, then scraped
    // This ensures new posts are scraped before re-scraping old ones
    const postsToScrape = filteredPosts.sort((a, b) => {
      // Priority 1: pending and failed posts (never successfully scraped)
      const aIsNew = a.status === "pending" || a.status === "failed";
      const bIsNew = b.status === "pending" || b.status === "failed";

      if (aIsNew && !bIsNew) return -1; // a comes first
      if (!aIsNew && bIsNew) return 1; // b comes first

      // If both are same priority, maintain original order
      return 0;
    });

    // Count posts by status for logging
    const pendingCount = postsToScrape.filter(
      (p) => p.status === "pending"
    ).length;
    const failedCount = postsToScrape.filter(
      (p) => p.status === "failed"
    ).length;
    const scrapedCount = postsToScrape.filter(
      (p) => p.status === "scraped"
    ).length;
    const scrapingCount = postsToScrape.filter(
      (p) => p.status === "scraping"
    ).length;

    console.log(
      `Filtered to ${postsToScrape.length} posts that need scraping ` +
        `(Pending: ${pendingCount}, Failed: ${failedCount}, Scraped: ${scrapedCount}, Stuck scraping: ${scrapingCount})`
    );

    if (postsToScrape.length === 0) {
      return new Response(
        JSON.stringify({
          success: true,
          data: {
            success_count: 0,
            error_count: 0,
            errors: [],
          },
        }),
        {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
          status: 200,
        }
      );
    }

    // Take only a batch of posts to process this run
    const batch = postsToScrape.slice(0, BATCH_SIZE);
    const batchIds = batch.map((p) => p.id);

    // Mark only this batch as 'scraping' (not all posts)
    await supabase
      .from("posts")
      .update({ status: "scraping" })
      .in("id", batchIds);

    const result: ScrapeAllResult = {
      success_count: 0,
      error_count: 0,
      errors: [],
    };

    // Get the scrape-post function URL for internal calls
    const scrapePostUrl = `${supabaseUrl}/functions/v1/scrape-all-posts`;
    const scrapePostFnUrl = `${supabaseUrl}/functions/v1/scrape-post`;

    // Scrape each post with rate limiting
    const startTime = Date.now();
    const MAX_EXECUTION_TIME = 250000; // 250 seconds (leave buffer for cleanup)
    const SAFE_EXECUTION_TIME = MAX_EXECUTION_TIME * 0.85; // Use 85% as safe limit (212.5 seconds)

    console.log(
      `🚀 Processing batch of ${batch.length} posts (${postsToScrape.length} total need scraping, max time: ${
        MAX_EXECUTION_TIME / 1000
      }s, safe limit: ${SAFE_EXECUTION_TIME / 1000}s)`
    );

    for (let i = 0; i < batch.length; i++) {
      const post = batch[i];
      const elapsedTime = Date.now() - startTime;
      const timeRemaining = MAX_EXECUTION_TIME - elapsedTime;

      // Check if we're approaching the execution time limit (use safe limit for better predictability)
      // Estimate time needed for next post: ~3-5 seconds (API call + rate limit)
      const estimatedTimeForNextPost = 4000; // 4 seconds estimate

      if (
        elapsedTime > SAFE_EXECUTION_TIME ||
        timeRemaining < estimatedTimeForNextPost
      ) {
        const processedCount = i;
        const remainingInBatch = batch.slice(i).map((p) => p.id);
        console.warn(
          `⏱️ Approaching execution time limit. ` +
            `Elapsed: ${(elapsedTime / 1000).toFixed(1)}s, ` +
            `Remaining: ${(timeRemaining / 1000).toFixed(1)}s, ` +
            `Processed: ${processedCount}/${batch.length} in batch, ` +
            `Reset: ${remainingInBatch.length} posts to pending`
        );

        if (remainingInBatch.length > 0) {
          await supabase
            .from("posts")
            .update({ status: "pending" })
            .in("id", remainingInBatch);

          console.log(
            `📋 Reset ${remainingInBatch.length} posts to pending status`
          );

          // Chain: fire another run to process the next batch (if under limit)
          if (chainDepth < MAX_CHAIN_DEPTH) {
            console.log(
              `🔗 Chaining run (depth ${chainDepth + 1}/${MAX_CHAIN_DEPTH})`
            );
            fetch(scrapePostUrl, {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                Authorization: authHeader
                  ? authHeader
                  : `Bearer ${supabaseServiceKey}`,
                apikey: supabaseServiceKey,
              },
              body: JSON.stringify({
                campaignId,
                chainDepth: chainDepth + 1,
              }),
            }).catch((err) =>
              console.error("Chained scrape-all-posts request failed:", err)
            );
          }
        }

        result.errors.push({
          postId: "timeout",
          message: `Processing stopped early due to execution time limit. ${processedCount} posts processed, ${remainingInBatch.length} reset to pending${chainDepth < MAX_CHAIN_DEPTH ? ", next batch chained." : "."}`,
        });
        break;
      }

      let postFailed = false;

      try {
        const progressPercent = (
          ((i + 1) / batch.length) *
          100
        ).toFixed(1);
        const elapsedSeconds = (elapsedTime / 1000).toFixed(1);
        const avgTimePerPost =
          i > 0 ? (elapsedTime / i / 1000).toFixed(1) : "0";
        const estimatedRemaining =
          i > 0
            ? (((elapsedTime / i) * (batch.length - i)) / 1000).toFixed(0)
            : "?";

        console.log(
          `[${i + 1}/${batch.length}] (${progressPercent}%) ` +
            `Scraping post ${post.id} (${post.platform}) ` +
            `| Elapsed: ${elapsedSeconds}s | Avg: ${avgTimePerPost}s/post | Est. remaining: ${estimatedRemaining}s`
        );

        const POST_SCRAPE_RETRIES = 2; // initial + 1 retry (reduced from 3 to save time)
        const SCRAPE_TIMEOUT_MS = 90000; // 90 second timeout per request (Apify actors typically take 30-90s)
        let lastError: string = "";
        let succeeded = false;

        for (let attempt = 0; attempt < POST_SCRAPE_RETRIES && !succeeded; attempt++) {
          if (attempt > 0) {
            const retryDelayMs = 1000 * attempt; // reduced from 2000 * attempt
            console.log(`Retrying post ${post.id} in ${retryDelayMs}ms (attempt ${attempt + 1}/${POST_SCRAPE_RETRIES})...`);
            await new Promise((r) => setTimeout(r, retryDelayMs));
          }

          try {
            // Add per-request timeout with AbortController
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), SCRAPE_TIMEOUT_MS);

            try {
              // Call scrape-post function internally
              const scrapeResponse = await fetch(scrapePostFnUrl, {
                method: "POST",
                headers: {
                  "Content-Type": "application/json",
                  Authorization: authHeader ?? `Bearer ${supabaseServiceKey}`,
                  apikey: supabaseServiceKey,
                },
                body: JSON.stringify({
                  postId: post.id,
                  postUrl: post.post_url,
                  platform: post.platform,
                  isAutoScrape: true,
                  request_user_id: user?.id ?? null,
                }),
                signal: controller.signal,
              });
              clearTimeout(timeoutId);

              if (!scrapeResponse.ok) {
                const errorText = await scrapeResponse.text();
                lastError = `HTTP ${scrapeResponse.status}: ${errorText}`;
                continue;
              }

              const scrapeResult = await scrapeResponse.json();
              if (scrapeResult.success) {
                result.success_count++;
                console.log(`✅ Post ${post.id} scraped successfully`);
                succeeded = true;
              } else {
                lastError = scrapeResult.error || "Unknown scraping error";
              }
            } catch (err) {
              clearTimeout(timeoutId);
              if (err instanceof DOMException && err.name === 'AbortError') {
                lastError = `Scrape request timed out after ${SCRAPE_TIMEOUT_MS / 1000} seconds`;
                console.warn(`⏱️ Post ${post.id} timed out on attempt ${attempt + 1}`);
              } else {
                lastError = err instanceof Error ? err.message : String(err);
              }
            }
          } catch (err) {
            lastError = err instanceof Error ? err.message : String(err);
          }
        }

        if (!succeeded) {
          postFailed = true;
          result.error_count++;
          result.errors.push({
            postId: post.id,
            message: lastError,
            post_url: post.post_url,
            platform: post.platform,
          });
          console.error(
            `[FAIL] post=${post.id} platform=${post.platform} url=${(post.post_url || "").slice(0, 50)}... error=${lastError}`
          );
          const now = new Date().toISOString();
          await supabase
            .from("posts")
            .update({
              status: "failed",
              last_attempt_at: now,
              last_attempt_status: "failed",
              last_attempt_error: lastError.substring(0, 500),
            })
            .eq("id", post.id);
        }
      } catch (error) {
        postFailed = true;
        result.error_count++;
        const errorMessage =
          error instanceof Error ? error.message : String(error);
        result.errors.push({
          postId: post.id,
          message: errorMessage,
          post_url: post.post_url,
          platform: post.platform,
        });
        console.error(
          `[FAIL] post=${post.id} platform=${post.platform} url=${(post.post_url || "").slice(0, 50)}... error=${errorMessage}`
        );

        const now = new Date().toISOString();
        await supabase
          .from("posts")
          .update({
            status: "failed",
            last_attempt_at: now,
            last_attempt_status: "failed",
            last_attempt_error: errorMessage.substring(0, 500),
          })
          .eq("id", post.id);
      }

      // Adaptive rate limiting: adjust delay based on time remaining
      // Skip most of the delay after failures to move on quickly
      if (postFailed) {
        // Minimal delay after failure — just move on
        if (i < postsToScrape.length - 1) {
          await new Promise((resolve) => setTimeout(resolve, 500));
        }
      } else {
        const currentTime = Date.now();
        const elapsedTimeAfterPost = currentTime - startTime;
        const timeRemainingAfterPost = MAX_EXECUTION_TIME - elapsedTimeAfterPost;
        const postsRemaining = batch.length - (i + 1);

        // Calculate adaptive delay
        let delay = 2000; // Default 2 seconds

        if (postsRemaining > 0) {
          if (timeRemainingAfterPost < 10000) {
            delay = 500;
          } else if (timeRemainingAfterPost < 30000) {
            delay = 1000;
          } else if (timeRemainingAfterPost < 60000) {
            delay = 1500;
          }

          const estimatedTimeForRemaining = postsRemaining * (delay + 3000);
          if (estimatedTimeForRemaining > timeRemainingAfterPost) {
            const maxDelay = Math.max(
              500,
              timeRemainingAfterPost / postsRemaining - 3000
            );
            delay = Math.min(delay, maxDelay);
          }
        }

        if (i < postsToScrape.length - 1) {
          await new Promise((resolve) => setTimeout(resolve, delay));
        }
      }
    }

    const totalTime = Date.now() - startTime;
    const avgTimePerPost =
      batch.length > 0
        ? (totalTime / batch.length / 1000).toFixed(2)
        : "0";

    console.log(`=== Scrape All Posts Complete (batch) ===`);
    console.log(
      `✅ Success: ${result.success_count}, ❌ Errors: ${result.error_count}, ` +
        `⏱️ Total time: ${(totalTime / 1000).toFixed(1)}s, 📊 Avg: ${avgTimePerPost}s/post`
    );
    if (result.errors.length > 0) {
      console.log(
        "Failed posts:",
        result.errors
          .filter((e) => e.postId !== "timeout")
          .map((e) => `${e.postId} (${e.platform}): ${(e.message || "").slice(0, 80)}...`)
      );
    }

    return new Response(
      JSON.stringify({
        success: true,
        data: result,
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      }
    );
  } catch (error) {
    console.error("Scrape all posts error:", error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : String(error),
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 500,
      }
    );
  }
});
