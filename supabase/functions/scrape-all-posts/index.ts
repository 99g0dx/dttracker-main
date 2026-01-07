import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.38.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

interface ScrapeAllRequest {
  campaignId: string;
}

interface ScrapeAllResult {
  success_count: number;
  error_count: number;
  errors: Array<{ postId: string; message: string }>;
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    // Get authentication token from request
    const authHeader = req.headers.get("authorization");
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: "Missing authorization header" }),
        {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
          status: 401,
        }
      );
    }

    // Parse request body
    const body: ScrapeAllRequest = await req.json();
    const { campaignId } = body;

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
    const token = authHeader.replace("Bearer ", "");
    if (!token) {
      console.error("Missing authentication token");
      throw new Error("Missing authentication token");
    }

    // Create service role client for database operations
    // Note: Supabase Edge Functions automatically verify the JWT before our code runs
    // If we reach here, the JWT is valid
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Get user info from the token (for logging and RLS check)
    let user;
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

    console.log("=== Scrape All Posts Started ===");
    console.log("Campaign ID:", campaignId);
    if (user) {
      console.log("User ID:", user.id);
    }
    console.log("Timestamp:", new Date().toISOString());

    // Verify the campaign belongs to the user (using RLS with user token check)
    // First, create a user-scoped client to check ownership
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
      .in("status", ["pending", "scraped", "failed", "scraping"]);

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
        .in("status", ["pending", "scraped", "failed", "scraping"]);

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

    // Update status to 'scraping' for posts we'll scrape
    const postIdsToScrape = postsToScrape.map((p) => p.id);
    await supabase
      .from("posts")
      .update({ status: "scraping" })
      .in("id", postIdsToScrape);

    const result: ScrapeAllResult = {
      success_count: 0,
      error_count: 0,
      errors: [],
    };

    // Get the scrape-post function URL for internal calls
    const scrapePostUrl = `${supabaseUrl}/functions/v1/scrape-post`;

    // Scrape each post with rate limiting
    // Note: Edge functions have execution time limits (60s free, 300s pro)
    // For large batches, consider processing in chunks or using background jobs
    const startTime = Date.now();
    const MAX_EXECUTION_TIME = 250000; // 250 seconds (leave buffer for cleanup)
    const SAFE_EXECUTION_TIME = MAX_EXECUTION_TIME * 0.85; // Use 85% as safe limit (212.5 seconds)

    console.log(
      `🚀 Starting to scrape ${postsToScrape.length} posts (max time: ${
        MAX_EXECUTION_TIME / 1000
      }s, safe limit: ${SAFE_EXECUTION_TIME / 1000}s)`
    );

    for (let i = 0; i < postsToScrape.length; i++) {
      const post = postsToScrape[i];
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
        const remainingCount = postsToScrape.length - i;
        console.warn(
          `⏱️ Approaching execution time limit. ` +
            `Elapsed: ${(elapsedTime / 1000).toFixed(1)}s, ` +
            `Remaining: ${(timeRemaining / 1000).toFixed(1)}s, ` +
            `Processed: ${processedCount}/${postsToScrape.length} posts, ` +
            `Remaining: ${remainingCount} posts`
        );

        // Reset remaining posts back to "pending" so they can be scraped later
        const remainingPostIds = postsToScrape.slice(i).map((p) => p.id);
        if (remainingPostIds.length > 0) {
          await supabase
            .from("posts")
            .update({ status: "pending" })
            .in("id", remainingPostIds);

          console.log(
            `📋 Reset ${remainingPostIds.length} remaining posts to pending status`
          );
        }

        result.errors.push({
          postId: "timeout",
          message: `Processing stopped early due to execution time limit. ${processedCount} posts processed, ${remainingPostIds.length} posts reset to pending and will be scraped next time.`,
        });
        break;
      }

      try {
        const progressPercent = (
          ((i + 1) / postsToScrape.length) *
          100
        ).toFixed(1);
        const elapsedSeconds = (elapsedTime / 1000).toFixed(1);
        const avgTimePerPost =
          i > 0 ? (elapsedTime / i / 1000).toFixed(1) : "0";
        const estimatedRemaining =
          i > 0
            ? (((elapsedTime / i) * (postsToScrape.length - i)) / 1000).toFixed(
                0
              )
            : "?";

        console.log(
          `[${i + 1}/${postsToScrape.length}] (${progressPercent}%) ` +
            `Scraping post ${post.id} (${post.platform}) ` +
            `| Elapsed: ${elapsedSeconds}s | Avg: ${avgTimePerPost}s/post | Est. remaining: ${estimatedRemaining}s`
        );

        // Call scrape-post function internally
        // Pass isAutoScrape flag to indicate this is a bulk operation
        // Use service role key for internal function calls (similar to scrape-all-scheduled)
        const scrapeResponse = await fetch(scrapePostUrl, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${supabaseServiceKey}`,
            apikey: supabaseServiceKey,
          },
          body: JSON.stringify({
            postId: post.id,
            postUrl: post.post_url,
            platform: post.platform,
            isAutoScrape: true,
          }),
        });

        if (!scrapeResponse.ok) {
          const errorText = await scrapeResponse.text();
          throw new Error(`HTTP ${scrapeResponse.status}: ${errorText}`);
        }

        const scrapeResult = await scrapeResponse.json();

        if (scrapeResult.success) {
          result.success_count++;
          console.log(`✅ Post ${post.id} scraped successfully`);
        } else {
          result.error_count++;
          const errorMessage = scrapeResult.error || "Unknown scraping error";
          result.errors.push({
            postId: post.id,
            message: errorMessage,
          });
          console.error(`❌ Failed to scrape post ${post.id}:`, errorMessage);

          // Mark post as failed
          await supabase
            .from("posts")
            .update({ status: "failed" })
            .eq("id", post.id);
        }
      } catch (error) {
        result.error_count++;
        const errorMessage =
          error instanceof Error ? error.message : String(error);
        result.errors.push({
          postId: post.id,
          message: errorMessage,
        });
        console.error(`❌ Failed to scrape post ${post.id}:`, errorMessage);

        // Mark post as failed
        await supabase
          .from("posts")
          .update({ status: "failed" })
          .eq("id", post.id);
      }

      // Adaptive rate limiting: adjust delay based on time remaining
      // This helps maximize the number of posts scraped before timeout
      const currentTime = Date.now();
      const elapsedTimeAfterPost = currentTime - startTime;
      const timeRemainingAfterPost = MAX_EXECUTION_TIME - elapsedTimeAfterPost;
      const postsRemaining = postsToScrape.length - (i + 1);

      // Calculate adaptive delay
      let delay = 2000; // Default 2 seconds

      if (postsRemaining > 0) {
        // If we have very little time left, reduce delay significantly
        if (timeRemainingAfterPost < 10000) {
          delay = 500; // 0.5 seconds if less than 10s remaining
        } else if (timeRemainingAfterPost < 30000) {
          delay = 1000; // 1 second if less than 30s remaining
        } else if (timeRemainingAfterPost < 60000) {
          delay = 1500; // 1.5 seconds if less than 60s remaining
        }

        // Ensure we have enough time for remaining posts
        const estimatedTimeForRemaining = postsRemaining * (delay + 3000); // delay + ~3s per post
        if (estimatedTimeForRemaining > timeRemainingAfterPost) {
          // Reduce delay to fit remaining posts
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

    const totalTime = Date.now() - startTime;
    const avgTimePerPost =
      postsToScrape.length > 0
        ? (totalTime / postsToScrape.length / 1000).toFixed(2)
        : "0";

    console.log(`=== Scrape All Posts Complete ===`);
    console.log(
      `✅ Success: ${result.success_count}, ❌ Errors: ${
        result.error_count
      }, ⏱️ Total time: ${(totalTime / 1000).toFixed(
        1
      )}s, 📊 Avg: ${avgTimePerPost}s/post`
    );

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
