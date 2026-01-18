import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.38.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const HOURS_IN_MS = 1000 * 60 * 60;
    const RECENT_WINDOW_HOURS = 72;
    const MID_WINDOW_DAYS = 14;
    const RECENT_INTERVAL_HOURS = 12;
    const MID_INTERVAL_HOURS = 24;
    const LATE_INTERVAL_HOURS = 24 * 7;
    const MAX_BATCH_SIZE = 30;

    // Get environment variables
    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
    const triggerToken = Deno.env.get("SCRAPE_TRIGGER_TOKEN") ?? "";

    if (!supabaseUrl || !supabaseServiceKey) {
      throw new Error("Missing Supabase configuration");
    }

    if (triggerToken) {
      const headerToken = req.headers.get("x-scrape-trigger-token") ?? "";
      const authHeader = req.headers.get("Authorization") ?? "";
      const bearerToken = authHeader.replace("Bearer ", "");
      const isAuthorized =
        headerToken === triggerToken || bearerToken === supabaseServiceKey;

      if (!isAuthorized) {
        return new Response(
          JSON.stringify({
            success: false,
            error: "Unauthorized",
          }),
          {
            headers: { ...corsHeaders, "Content-Type": "application/json" },
            status: 401,
          }
        );
      }
    }

    // Create service role client (bypasses RLS)
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    console.log("=== Scheduled Auto-Scraping Started ===");
    console.log("Timestamp:", new Date().toISOString());

    // Fetch all active posts from active campaigns
    const { data: posts, error: fetchError } = await supabase
      .from("posts")
      .select(`
        id,
        post_url,
        platform,
        campaign_id,
        posted_date,
        last_scraped_at,
        created_at,
        campaigns!inner(status)
      `)
      .eq("campaigns.status", "active")
      .not("post_url", "is", null)
      .in("status", ["pending", "scraped", "failed", "manual"]); // Skip posts currently being scraped

    if (fetchError) {
      console.error("Error fetching posts:", fetchError);
      throw fetchError;
    }

    if (!posts || posts.length === 0) {
      console.log("No posts to scrape");
      return new Response(
        JSON.stringify({
          success: true,
          message: "No posts to scrape",
          scraped_count: 0,
        }),
        {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
          status: 200,
        }
      );
    }

    const now = new Date();
    const isPostDue = (post: typeof posts[number]) => {
      const postedDate = post.posted_date ? new Date(post.posted_date) : null;
      const createdDate = post.created_at ? new Date(post.created_at) : null;
      const baseDate = postedDate && !Number.isNaN(postedDate.getTime())
        ? postedDate
        : createdDate && !Number.isNaN(createdDate.getTime())
          ? createdDate
          : now;
      const ageHours = (now.getTime() - baseDate.getTime()) / HOURS_IN_MS;
      const minIntervalHours =
        ageHours <= RECENT_WINDOW_HOURS
          ? RECENT_INTERVAL_HOURS
          : ageHours <= MID_WINDOW_DAYS * 24
            ? MID_INTERVAL_HOURS
            : LATE_INTERVAL_HOURS;
      if (!post.last_scraped_at) {
        return true;
      }
      const lastScraped = new Date(post.last_scraped_at);
      if (Number.isNaN(lastScraped.getTime())) {
        return true;
      }
      const hoursSinceLast = (now.getTime() - lastScraped.getTime()) / HOURS_IN_MS;
      return hoursSinceLast >= minIntervalHours;
    };

    const duePosts = posts.filter(isPostDue);
    if (duePosts.length === 0) {
      console.log("No posts are due for scraping");
      return new Response(
        JSON.stringify({
          success: true,
          message: "No posts are due for scraping",
          scraped_count: 0,
          total_posts: posts.length,
        }),
        {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
          status: 200,
        }
      );
    }

    const sortedDuePosts = duePosts.sort((a, b) => {
      const aTime = new Date(a.last_scraped_at ?? a.created_at).getTime();
      const bTime = new Date(b.last_scraped_at ?? b.created_at).getTime();
      return aTime - bTime;
    });
    const postsToScrape = sortedDuePosts.slice(0, MAX_BATCH_SIZE);

    console.log(
      `Found ${posts.length} posts; ${duePosts.length} due; scraping ${postsToScrape.length}`
    );

    // Get RapidAPI key
    const rapidApiKey = Deno.env.get("RAPIDAPI_KEY");
    if (!rapidApiKey) {
      throw new Error("RAPIDAPI_KEY not configured");
    }

    // Call the scrape-post function internally
    const scrapePostUrl = `${supabaseUrl}/functions/v1/scrape-post`;
    const serviceRoleHeaders = {
      "Content-Type": "application/json",
      Authorization: `Bearer ${supabaseServiceKey}`,
      apikey: supabaseServiceKey,
    };

    let successCount = 0;
    let errorCount = 0;
    const errors: Array<{ postId: string; message: string }> = [];

    // Scrape each post with rate limiting
    for (let i = 0; i < postsToScrape.length; i++) {
      const post = postsToScrape[i];
      
      try {
        console.log(`[${i + 1}/${postsToScrape.length}] Scraping post ${post.id} (${post.platform})`);

        // Mark as scraping
        await supabase
          .from("posts")
          .update({ status: "scraping" })
          .eq("id", post.id);

        // Call scrape-post function
        const scrapeResponse = await fetch(scrapePostUrl, {
          method: "POST",
          headers: serviceRoleHeaders,
          body: JSON.stringify({
            postId: post.id,
            postUrl: post.post_url,
            platform: post.platform,
            isAutoScrape: true, // Flag to indicate auto-scraping
          }),
        });

        if (!scrapeResponse.ok) {
          const errorText = await scrapeResponse.text();
          throw new Error(`HTTP ${scrapeResponse.status}: ${errorText}`);
        }

        const scrapeResult = await scrapeResponse.json();
        
        if (scrapeResult.success) {
          successCount++;
          console.log(`✅ Post ${post.id} scraped successfully`);
        } else {
          errorCount++;
          errors.push({
            postId: post.id,
            message: scrapeResult.error || "Unknown error",
          });
          // Mark as failed
          await supabase
            .from("posts")
            .update({ status: "failed" })
            .eq("id", post.id);
        }
      } catch (error) {
        errorCount++;
        const errorMessage = error instanceof Error ? error.message : String(error);
        errors.push({
          postId: post.id,
          message: errorMessage,
        });
        console.error(`❌ Failed to scrape post ${post.id}:`, errorMessage);
        
        // Mark as failed
        await supabase
          .from("posts")
          .update({ status: "failed" })
          .eq("id", post.id);
      }

      // Rate limiting: wait 2 seconds between requests (except for the last one)
      if (i < posts.length - 1) {
        await new Promise((resolve) => setTimeout(resolve, 2000));
      }
    }

    console.log(`=== Auto-Scraping Complete ===`);
    console.log(`Success: ${successCount}, Errors: ${errorCount}`);

    return new Response(
      JSON.stringify({
        success: true,
        scraped_count: successCount,
        error_count: errorCount,
        total_posts: postsToScrape.length,
        errors: errors.slice(0, 10), // Limit error details
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      }
    );
  } catch (error) {
    console.error("Scheduled scraping error:", error);
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


