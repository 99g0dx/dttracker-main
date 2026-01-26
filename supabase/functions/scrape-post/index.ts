import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.38.4";
import {
  extractApifyItems,
  pickFirstInstagramItem,
  normalizeInstagramScrapeItem,
  getInstagramViewDebug,
} from "../_shared/apify-instagram.ts";
import { handlesMatch, normalizeHandle } from "../_shared/handle-utils.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

function extractTikTokVideoId(url: string): string | null {
  try {
    let normalizedUrl = url.trim();
    normalizedUrl = normalizedUrl.replace(/^["'<>]+|["'<>]+$/g, '');
    if (!normalizedUrl.startsWith('http://') && !normalizedUrl.startsWith('https://')) {
      normalizedUrl = `https://${normalizedUrl}`;
    }
    const urlObj = new URL(normalizedUrl);
    const pathname = urlObj.pathname;
    const videoMatch = pathname.match(/\/video\/(\d+)/) || pathname.match(/\/v\/(\d+)/);
    if (videoMatch) {
      return videoMatch[1];
    }
    const fallbackMatch = normalizedUrl.match(/\/(\d+)(?:\?|$)/);
    return fallbackMatch ? fallbackMatch[1] : null;
  } catch {
    return null;
  }
}

// ============================================================
// API CONFIGURATION
// ============================================================
// Primary: RapidAPI (TikTok) + Apify actors (Instagram)
// - RAPIDAPI_KEY: Your RapidAPI key used for TikTok video info
// - APIFY_TOKEN: Your Apify API token
// - Actors: apify~instagram-scraper

// Twitter (RapidAPI)
// - RAPIDAPI_KEY: (also used above)
const TWITTER_API_BASE_URL = "https://twitter241.p.rapidapi.com";
const TWITTER_API_HOST = "twitter241.p.rapidapi.com";
const TWITTER_API_ENDPOINT = "/tweet-v2"; // Uses pid (tweet ID) parameter
// ============================================================

interface ScrapeRequest {
  postId: string;
  postUrl: string;
  platform: "tiktok" | "instagram" | "youtube" | "twitter" | "facebook";
  isAutoScrape?: boolean; // Flag to indicate auto-scraping vs manual
}

interface ScrapedMetrics {
  views: number;
  likes: number;
  comments: number;
  shares: number;
  engagement_rate: number;
  /** Username of the post owner (extracted from scraper response) */
  owner_username?: string | null;
}

/**
 * Scrape TikTok post metrics using RapidAPI video info endpoint
 */

async function scrapeTikTok(postUrl: string): Promise<ScrapedMetrics> {
  try {
    const rapidApiKey = Deno.env.get("RAPIDAPI_KEY");
    if (!rapidApiKey) {
      throw new Error(
        "RAPIDAPI_KEY not configured. Please set the RAPIDAPI_KEY secret in Supabase Edge Functions."
      );
    }

    const videoId = extractTikTokVideoId(postUrl);
    if (!videoId) {
      throw new Error("Unable to extract TikTok video ID from the URL.");
    }

    const apiUrl = `https://tiktok-data-api.p.rapidapi.com/video/info?video_id=${videoId}`;
    const response = await fetch(apiUrl, {
      headers: {
        "X-RapidAPI-Key": rapidApiKey,
        "X-RapidAPI-Host": "tiktok-data-api.p.rapidapi.com",
      },
    });

    if (!response.ok) {
      const text = await response.text().catch(() => "Unknown error");
      throw new Error(
        `RapidAPI TikTok request failed (${response.status}): ${text.substring(
          0,
          200
        )}`
      );
    }

    const payload = await response.json().catch((err) => {
      console.error("Failed to parse RapidAPI TikTok response:", err);
      throw new Error("Invalid response from RapidAPI TikTok video info");
    });

    const item =
      payload.aweme_detail ||
      payload.itemInfo?.itemStruct ||
      payload.data?.itemStruct ||
      payload.data ||
      payload;

    const stats =
      item.stats ||
      item.statistics ||
      item.itemStruct?.stats ||
      item.videoStats ||
      item.video_meta?.stats ||
      item;

    const views =
      Number(
        stats.playCount ??
          stats.viewCount ??
          stats.views ??
          item.playCount ??
          item.viewCount ??
          item.views ??
          0
      ) || 0;
    const likes =
      Number(
        stats.diggCount ??
          stats.likeCount ??
          stats.likes ??
          item.diggCount ??
          item.likeCount ??
          item.likes ??
          0
      ) || 0;
    const comments =
      Number(
        stats.commentCount ??
          stats.comments ??
          item.commentCount ??
          item.comments ??
          0
      ) || 0;
    const shares =
      Number(
        stats.shareCount ??
          stats.shares ??
          item.shareCount ??
          item.shares ??
          0
      ) || 0;

    const ownerUsername =
      item.authorMeta?.name ??
      item.author?.nickname ??
      item.author?.uniqueId ??
      item.author_unique_id ??
      null;

    const totalMetrics = views + likes + comments + shares;
    if (!totalMetrics) {
      throw new Error(
        "RapidAPI TikTok scraper returned zero metrics. The result structure may differ."
      );
    }

    const metrics: ScrapedMetrics = {
      views,
      likes,
      comments,
      shares,
      engagement_rate: 0,
      owner_username: ownerUsername,
    };

    return metrics;
  } catch (error) {
    console.error("TikTok scraping error:", error);
    const errorMessage = error instanceof Error ? error.message : String(error);
    throw new Error("Failed to scrape TikTok: " + errorMessage);
  }
}

/**
 * Scrape Instagram post metrics using Apify
 * Actor: apify/instagram-scraper
 */
async function scrapeInstagram(postUrl: string): Promise<ScrapedMetrics> {
  try {
    const apifyToken = Deno.env.get("APIFY_TOKEN");
    const apifyActorId =
      Deno.env.get("APIFY_INSTAGRAM_ACTOR_ID") ?? "apify~instagram-scraper";

    console.log("=== Instagram Scraping (Apify) ===");
    console.log("Post URL:", postUrl);
    console.log("Apify token present:", !!apifyToken);
    console.log("Apify actor:", apifyActorId);

    if (!apifyToken) {
      throw new Error(
        "APIFY_TOKEN not configured. Please set the APIFY_TOKEN secret in Supabase Edge Functions."
      );
    }

    let normalizedUrl = postUrl.trim();
    if (
      !normalizedUrl.startsWith("http://") &&
      !normalizedUrl.startsWith("https://")
    ) {
      normalizedUrl = "https://" + normalizedUrl;
    }

    const apifyUrl =
      "https://api.apify.com/v2/acts/" +
      encodeURIComponent(apifyActorId) +
      "/run-sync-get-dataset-items?token=" +
      encodeURIComponent(apifyToken);

    const input = {
      directUrls: [normalizedUrl],
      resultsType: "posts",
      resultsLimit: 1,
      addParentData: false,
    };

    console.log("Calling Apify Instagram API...");

    const fetchWithRetry = async (attempt: number): Promise<Response> => {
      const response = await fetch(instagramApiUrl, {
        method: "GET",
        headers: {
          "X-RapidAPI-Key": rapidApiKey,
          "X-RapidAPI-Host": INSTAGRAM_API_HOST,
        },
      });

      if (response.status === 429 && attempt < 3) {
        const backoffMs = 1500 * Math.pow(2, attempt);
        console.warn(
          `Instagram API rate limited (429). Retrying in ${backoffMs}ms (attempt ${
            attempt + 1
          }/3)...`
        );
        await new Promise((resolve) => setTimeout(resolve, backoffMs));
        return fetchWithRetry(attempt + 1);
      }

      return response;
    };

    const response = await fetchWithRetry(0);

    console.log(
      "Instagram API Response Status:",
      response.status,
      response.statusText
    );

    if (!response.ok) {
      const errorText = await response.text().catch(() => "Unknown error");
      throw new Error(
        "Apify Instagram API error (" +
          response.status +
          "): " +
          errorText.substring(0, 200)
      );
    }

    const payload = await response.json().catch((err) => {
      console.error("Failed to parse Apify response:", err);
      throw new Error("Invalid response from Apify Instagram scraper");
    });

    const items = extractApifyItems(payload);
    if (!items.length) {
      throw new Error("Apify Instagram scraper returned no results.");
    }

    const item = pickFirstInstagramItem(items);
    if (!item) {
      throw new Error("Apify Instagram scraper returned empty items.");
    }

    console.log(
      "Instagram API Response Data:",
      JSON.stringify(item).substring(0, 500)
    );

    const normalized = normalizeInstagramScrapeItem(item, normalizedUrl);
    console.log("Instagram view fields:", getInstagramViewDebug(item));
    console.log("Instagram views resolved:", normalized.metrics.views);

    if (!normalized.ownerUsername) {
      const itemKeys =
        typeof item === "object" && item !== null ? Object.keys(item) : [];
      console.warn("Instagram owner username missing", {
        platform: "instagram",
        shortcode: normalized.shortcode,
        itemKeys,
      });
    }

    const metrics: ScrapedMetrics = {
      ...normalized.metrics,
      owner_username: normalized.ownerUsername,
    };

    const totalMetrics =
      normalized.metrics.views +
      normalized.metrics.likes +
      normalized.metrics.comments;
    if (totalMetrics === 0) {
      throw new Error(
        "Apify Instagram scraper returned zero metrics. The result structure may differ."
      );
    }

    console.log("Instagram Metrics Extracted:", metrics);
    return metrics;
  } catch (error) {
    console.error("Instagram scraping error:", error);
    const errorMessage = error instanceof Error ? error.message : String(error);
    throw new Error("Failed to scrape Instagram: " + errorMessage);
  }
}

/**
 * Scrape YouTube video metrics using YouTube Data API v3
 * This is Google's official API (free tier: 10k requests/day)
 */
async function scrapeYouTube(postUrl: string): Promise<ScrapedMetrics> {
  try {
    const youtubeApiKey = Deno.env.get("YOUTUBE_API_KEY");

    if (!youtubeApiKey) {
      throw new Error(
        "YOUTUBE_API_KEY not configured. Please set the YOUTUBE_API_KEY secret in Supabase Edge Functions."
      );
    }

    // Extract video ID from URL
    const videoIdMatch = postUrl.match(
      /(?:youtube\.com\/watch\?v=|youtu\.be\/)([^&?]+)/
    );

    if (!videoIdMatch) {
      throw new Error("Invalid YouTube URL");
    }

    const videoId = videoIdMatch[1];

    // YouTube Data API v3
    const response = await fetch(
      `https://www.googleapis.com/youtube/v3/videos?part=statistics&id=${videoId}&key=${youtubeApiKey}`
    );

    if (!response.ok) {
      const errorText = await response.text().catch(() => "Unknown error");
      console.error("YouTube API error:", response.status, errorText);

      // Handle temporary errors - throw proper errors instead of fake data
      if (response.status === 503 || response.status === 429 || response.status === 502 || response.status === 504) {
        throw new Error(
          `YouTube API temporarily unavailable (${response.status}). Please try again later.`
        );
      }

      throw new Error(`YouTube API error: ${response.status} ${errorText.substring(0, 200)}`);
    }

    const data = await response.json();

    if (!data.items || data.items.length === 0) {
      throw new Error("Video not found");
    }

    const stats = data.items[0].statistics;

    return {
      views: parseInt(stats.viewCount) || 0,
      likes: parseInt(stats.likeCount) || 0,
      comments: parseInt(stats.commentCount) || 0,
      shares: 0, // YouTube API doesn't provide share count
      engagement_rate: 0, // Will be calculated later
    };
  } catch (error) {
    console.error("YouTube scraping error:", error);
    throw new Error(`Failed to scrape YouTube: ${error.message}`);
  }
}

/**
 * Scrape Twitter/X post metrics using RapidAPI
 * API: "Twttr API"
 */
async function scrapeTwitter(postUrl: string): Promise<ScrapedMetrics> {
  try {
    const rapidApiKey = Deno.env.get("RAPIDAPI_KEY");

    console.log("=== Twitter/X Scraping ===");
    console.log("Post URL:", postUrl);
    console.log("RapidAPI Key present:", !!rapidApiKey);
    console.log("RapidAPI Key length:", rapidApiKey?.length || 0);

    if (!rapidApiKey) {
      throw new Error(
        "RAPIDAPI_KEY not configured. Please set the RAPIDAPI_KEY secret in Supabase Edge Functions."
      );
    }

    // Twttr API (RapidAPI) - "Twttr API"
    console.log("Calling Twitter API...");

    // Extract tweet ID (pid) from Twitter/X URL
    // Twitter URLs: https://x.com/user/status/1234567890 or https://twitter.com/user/status/1234567890
    const tweetIdMatch =
      postUrl.match(/\/status\/(\d+)/) ||
      postUrl.match(/twitter\.com\/.*\/status\/(\d+)/) ||
      postUrl.match(/x\.com\/.*\/status\/(\d+)/);

    if (!tweetIdMatch || !tweetIdMatch[1]) {
      throw new Error(
        "Could not extract tweet ID (pid) from Twitter URL. Please use a full Twitter/X post URL with status ID."
      );
    }

    const tweetId = tweetIdMatch[1];
    const twitterApiUrl = `${TWITTER_API_BASE_URL}${TWITTER_API_ENDPOINT}?pid=${tweetId}`;
    console.log("Twitter API URL:", twitterApiUrl);
    console.log("Extracted tweet ID (pid):", tweetId);

    const response = await fetch(twitterApiUrl, {
      method: "GET",
      headers: {
        "X-RapidAPI-Key": rapidApiKey,
        "X-RapidAPI-Host": TWITTER_API_HOST,
      },
    });

    console.log(
      "Twitter API Response Status:",
      response.status,
      response.statusText
    );

    if (!response.ok) {
      const errorText = await response.text().catch(() => "Unknown error");
      console.error("Twitter API error:", response.status, errorText);
      console.error("Full error response:", errorText);

      // Handle specific error cases - throw errors instead of returning fake data
      if (response.status === 403) {
        throw new Error(
          "Twitter API subscription issue (403). Please check your RapidAPI subscription."
        );
      }

      if (response.status === 503) {
        throw new Error(
          "Twitter API temporarily unavailable (503). Please try again later."
        );
      }

      if (response.status === 429) {
        throw new Error(
          "Twitter API rate limit exceeded (429). Please wait before trying again."
        );
      }

      if (response.status === 502 || response.status === 504) {
        throw new Error(
          `Twitter API gateway error (${response.status}). Please try again later.`
        );
      }

      throw new Error(
        `Twitter API error (${response.status}): ${errorText.substring(0, 200)}`
      );
    }

    const data = await response.json().catch((err) => {
      console.error("Failed to parse Twitter API response:", err);
      throw new Error("Invalid response from Twitter API");
    });

    // Log the full response for debugging
    console.log("=== TWITTER API RESPONSE ===");
    console.log(
      "Full Response (first 2000 chars):",
      JSON.stringify(data, null, 2).substring(0, 2000)
    );
    console.log("Response Type:", typeof data);
    console.log("Is Array:", Array.isArray(data));
    console.log("Top Level Keys:", Object.keys(data || {}));

    // Extract metrics from Twitter API response
    // Twttr API structure may vary - check logs to see actual structure
    const tweetData =
      data?.data || data?.tweet || data?.result || data?.tweetData || data;

    if (!tweetData) {
      console.error("Twitter API response missing data:", JSON.stringify(data));
      throw new Error("Twitter API response missing tweet data");
    }

    console.log("=== TWITTER RESPONSE STRUCTURE ===");
    console.log("Has data.data:", !!data?.data);
    console.log("Has data.tweet:", !!data?.tweet);
    console.log("Has data.result:", !!data?.result);
    console.log("TweetData Keys:", Object.keys(tweetData || {}));
    console.log(
      "TweetData Sample:",
      JSON.stringify(tweetData, null, 2).substring(0, 1000)
    );

    // Try multiple possible field names for metrics
    // Twttr API might use different field names - check logs to see actual structure
    const publicMetrics =
      tweetData?.public_metrics || tweetData?.publicMetrics || {};
    const metrics = tweetData?.metrics || {};

    console.log("=== STATISTICS OBJECT ===");
    console.log("Has public_metrics:", !!tweetData?.public_metrics);
    console.log("Has publicMetrics:", !!tweetData?.publicMetrics);
    console.log("Has metrics:", !!tweetData?.metrics);
    console.log("Public Metrics keys:", Object.keys(publicMetrics || {}));
    console.log("Metrics keys:", Object.keys(metrics || {}));
    console.log("Full public_metrics:", JSON.stringify(publicMetrics, null, 2));
    console.log("Full metrics:", JSON.stringify(metrics, null, 2));

    // Helper function to safely extract number values
    const getNumber = (
      ...values: (number | string | undefined | null)[]
    ): number => {
      for (const value of values) {
        if (value !== undefined && value !== null && value !== "") {
          const num = Number(value);
          if (!isNaN(num) && num >= 0) {
            return num;
          }
        }
      }
      return 0;
    };

    const extractedMetrics = {
      views: getNumber(
        publicMetrics?.impression_count,
        publicMetrics?.impressionCount,
        metrics?.impression_count,
        metrics?.impressionCount,
        tweetData?.views,
        tweetData?.view_count
      ),
      likes: getNumber(
        publicMetrics?.like_count,
        publicMetrics?.likeCount,
        metrics?.like_count,
        metrics?.likeCount,
        tweetData?.likes,
        tweetData?.like_count,
        tweetData?.favorite_count,
        tweetData?.favoriteCount
      ),
      comments: getNumber(
        publicMetrics?.reply_count,
        publicMetrics?.replyCount,
        metrics?.reply_count,
        metrics?.replyCount,
        tweetData?.comments,
        tweetData?.comment_count,
        tweetData?.reply_count,
        tweetData?.replyCount
      ),
      shares: getNumber(
        publicMetrics?.retweet_count,
        publicMetrics?.retweetCount,
        metrics?.retweet_count,
        metrics?.retweetCount,
        tweetData?.shares,
        tweetData?.share_count,
        tweetData?.retweets,
        tweetData?.retweet_count,
        tweetData?.retweetCount
      ),
      engagement_rate: 0, // Will be calculated later
    };

    console.log("=== TWITTER METRICS EXTRACTED ===");
    console.log("Views:", extractedMetrics.views);
    console.log("Likes:", extractedMetrics.likes);
    console.log("Comments:", extractedMetrics.comments);
    console.log("Shares:", extractedMetrics.shares);
    console.log(
      "Full Metrics Object:",
      JSON.stringify(extractedMetrics, null, 2)
    );
    return extractedMetrics;
  } catch (error) {
    console.error("Twitter scraping error:", error);
    const errorMessage = error instanceof Error ? error.message : String(error);
    throw new Error(`Failed to scrape Twitter: ${errorMessage}`);
  }
}

/**
 * Main scraping function that routes to platform-specific scrapers
 */
async function scrapePost(
  platform: string,
  postUrl: string
): Promise<ScrapedMetrics> {
  switch (platform) {
    case "tiktok":
      return await scrapeTikTok(postUrl);
    case "instagram":
      return await scrapeInstagram(postUrl);
    case "youtube":
      return await scrapeYouTube(postUrl);
    case "twitter":
      return await scrapeTwitter(postUrl);
    case "facebook":
      console.warn("Facebook scraping not yet implemented");
      return {
        views: 0,
        likes: 0,
        comments: 0,
        shares: 0,
        engagement_rate: 0,
      };
    default:
      throw new Error(`Unsupported platform: ${platform}`);
  }
}

interface CreatorMatchResult {
  creatorId: string;
  creatorHandle: string;
  creatorName: string | null;
  created: boolean;
}

async function findInstagramCreatorMatch(
  supabase: ReturnType<typeof createClient>,
  workspaceId: string,
  ownerUsername: string
): Promise<CreatorMatchResult | null> {
  if (!normalizeHandle(ownerUsername)) return null;

  const { data, error } = await supabase
    .from("workspace_creators")
    .select("creator_id, creator:creators(id, handle, platform, name)")
    .eq("workspace_id", workspaceId);

  if (error || !data) {
    console.warn("Failed to fetch workspace creators for match:", error);
    return null;
  }

  const match = data.find((entry) => {
    const creator = entry.creator;
    if (!creator || creator.platform !== "instagram") return false;
    return handlesMatch(creator.handle, ownerUsername);
  });

  if (!match?.creator) return null;

  return {
    creatorId: match.creator.id,
    creatorHandle: match.creator.handle,
    creatorName: match.creator.name ?? null,
    created: false,
  };
}

/**
 * Create a new Instagram creator from scraped owner username
 * and add them to the workspace
 */
async function createInstagramCreator(
  supabase: ReturnType<typeof createClient>,
  workspaceId: string,
  ownerUsername: string
): Promise<CreatorMatchResult | null> {
  const normalizedHandle = normalizeHandle(ownerUsername);
  if (!normalizedHandle) return null;

  console.log(`Creating new Instagram creator: @${normalizedHandle} for workspace ${workspaceId}`);

  // Create the creator record
  const { data: newCreator, error: createError } = await supabase
    .from("creators")
    .insert({
      user_id: workspaceId,
      name: normalizedHandle,
      handle: normalizedHandle,
      platform: "instagram",
      source_type: "scraper_extraction",
      created_by_workspace_id: workspaceId,
    })
    .select("id, handle, name")
    .single();

  if (createError) {
    // Check if it's a unique constraint violation (creator already exists)
    if (createError.code === "23505") {
      console.log("Creator already exists, fetching existing record...");
      const { data: existingCreator } = await supabase
        .from("creators")
        .select("id, handle, name")
        .eq("user_id", workspaceId)
        .eq("handle", normalizedHandle)
        .eq("platform", "instagram")
        .single();

      if (existingCreator) {
        // Ensure they're in workspace_creators
        await supabase
          .from("workspace_creators")
          .upsert(
            {
              workspace_id: workspaceId,
              creator_id: existingCreator.id,
              source: "scraper",
            },
            { onConflict: "workspace_id,creator_id" }
          );

        return {
          creatorId: existingCreator.id,
          creatorHandle: existingCreator.handle,
          creatorName: existingCreator.name ?? null,
          created: false,
        };
      }
    }
    console.error("Failed to create Instagram creator:", createError);
    return null;
  }

  // Add creator to workspace_creators
  const { error: workspaceError } = await supabase
    .from("workspace_creators")
    .insert({
      workspace_id: workspaceId,
      creator_id: newCreator.id,
      source: "scraper",
    });

  if (workspaceError && workspaceError.code !== "23505") {
    console.warn("Failed to add creator to workspace:", workspaceError);
  }

  console.log(`Created new Instagram creator: ${newCreator.id} (@${normalizedHandle})`);

  return {
    creatorId: newCreator.id,
    creatorHandle: newCreator.handle,
    creatorName: newCreator.name ?? null,
    created: true,
  };
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    console.log("=== Scrape Request Received ===");
    console.log("Method:", req.method);
    console.log("URL:", req.url);
    console.log("Headers:", {
      authorization: req.headers.get("Authorization") ? "Present" : "Missing",
      apikey: req.headers.get("apikey") ? "Present" : "Missing",
    });

    // Get Supabase configuration
    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

    console.log("Environment check:", {
      hasUrl: !!supabaseUrl,
      hasServiceKey: !!supabaseServiceKey,
      urlLength: supabaseUrl.length,
      serviceKeyLength: supabaseServiceKey.length,
    });

    if (!supabaseUrl || !supabaseServiceKey) {
      console.error("Missing Supabase configuration:", {
        hasUrl: !!supabaseUrl,
        hasServiceKey: !!supabaseServiceKey,
      });
      throw new Error(
        "Server configuration error: Missing Supabase credentials. Please check Edge Function secrets."
      );
    }

    // Get authorization header - Supabase Edge Functions automatically verify JWTs
    // The user is already authenticated if we reach this point
    const authHeader = req.headers.get("Authorization");
    const token = authHeader?.replace("Bearer ", "") ?? null;
    if (!token) {
      console.warn("No authorization token provided; proceeding without user context");
    } else {
      console.log("Token received, length:", token.length);
    }

    // Create service role client for database operations
    // Note: Supabase Edge Functions automatically verify the JWT before our code runs
    // If we reach here, the JWT is valid
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Get user info from the token (for logging)
    if (token) {
      try {
        const {
          data: { user },
          error: userError,
        } = await supabase.auth.getUser(token);

        if (userError) {
          console.warn("Could not get user from token:", userError.message);
          // Continue anyway - Supabase already verified the JWT
        } else if (user) {
          console.log(`Authenticated user: ${user.id}`);
        }
      } catch (err) {
        console.warn("User verification warning:", err);
        // Continue anyway - Supabase already verified the JWT
      }
    }

    // Parse request body
    const {
      postId,
      postUrl,
      platform,
      isAutoScrape = false,
    }: ScrapeRequest = await req.json();

    if (!postId || !postUrl || !platform) {
      throw new Error("Missing required fields: postId, postUrl, platform");
    }

    console.log(
      `${
        isAutoScrape ? "[AUTO]" : "[MANUAL]"
      } Scraping ${platform} post: ${postUrl}`
    );

    // Check if post is currently being scraped (conflict prevention)
    const { data: post, error: postError } = await supabase
      .from("posts")
      .select("status, updated_at, campaign_id, creator_id")
      .eq("id", postId)
      .single();

    if (postError) {
      throw new Error(`Post not found: ${postError.message}`);
    }

    const { data: campaign, error: campaignError } = await supabase
      .from("campaigns")
      .select("workspace_id")
      .eq("id", post.campaign_id)
      .single();

    if (campaignError || !campaign) {
      throw new Error("Campaign not found for post");
    }

    const { data: scrapeGate, error: gateError } = await supabase.rpc(
      "can_trigger_scrape",
      {
        target_workspace_id: campaign.workspace_id,
        target_campaign_id: post.campaign_id,
        target_platform: platform,
      }
    );

    if (gateError) {
      throw new Error(`Scrape permission check failed: ${gateError.message}`);
    }

    const gate = Array.isArray(scrapeGate) ? scrapeGate[0] : scrapeGate;
    if (!gate?.allowed) {
      const reason = gate?.reason || "not_allowed";
      const message =
        reason === "platform_not_allowed"
          ? "Platform not available on your current plan."
          : reason === "scrape_interval_not_met"
          ? "Scrape interval not met. Please wait before scraping again."
          : reason === "subscription_past_due"
          ? "Subscription past due. Update payment to resume scraping."
          : "Scraping not allowed at this time.";

      return new Response(
        JSON.stringify({
          success: false,
          error: message,
        }),
        {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
          status: 200,
        }
      );
    }

    // If post is being scraped and this is a manual request, check if we should wait
    if (post.status === "scraping" && !isAutoScrape) {
      const updatedAt = new Date(post.updated_at);
      const now = new Date();
      const minutesSinceUpdate =
        (now.getTime() - updatedAt.getTime()) / 1000 / 60;

      // If scraping started less than 5 minutes ago, prevent manual override
      if (minutesSinceUpdate < 5) {
        console.log(
          `Post ${postId} is currently being scraped (${minutesSinceUpdate.toFixed(
            1
          )} minutes ago). Manual scrape blocked.`
        );
        return new Response(
          JSON.stringify({
            success: false,
            error: "Post is currently being scraped. Please wait a moment.",
          }),
          {
            headers: { ...corsHeaders, "Content-Type": "application/json" },
            status: 200,
          }
        );
      } else {
        // Post has been scraping for more than 5 minutes, likely stuck - allow override
        console.log(
          `Post ${postId} has been scraping for ${minutesSinceUpdate.toFixed(
            1
          )} minutes. Allowing manual override.`
        );
      }
    }

    // Scrape the post
    const metrics = await scrapePost(platform, postUrl);

    // Calculate engagement rate
    const totalEngagements = metrics.likes + metrics.comments + metrics.shares;
    const engagementRate =
      metrics.views > 0 ? (totalEngagements / metrics.views) * 100 : 0;

    const scrapedMetrics = {
      ...metrics,
      engagement_rate: Number(engagementRate.toFixed(2)),
    };

    // Update post in database
    const updatePayload: Record<string, unknown> = {
      views: scrapedMetrics.views,
      likes: scrapedMetrics.likes,
      comments: scrapedMetrics.comments,
      shares: scrapedMetrics.shares,
      engagement_rate: scrapedMetrics.engagement_rate,
      status: "scraped",
      last_scraped_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      canonical_url: postUrl, // Save the URL used for scraping
    };

    // Add owner_username if available (especially useful for Instagram posts)
    if (scrapedMetrics.owner_username) {
      updatePayload.owner_username = scrapedMetrics.owner_username;
      updatePayload.creator_handle = scrapedMetrics.owner_username;
      console.log(`Setting owner_username to: ${scrapedMetrics.owner_username}`);
    }

    let creatorMatch: {
      matched: boolean;
      created: boolean;
      creatorId?: string;
      creatorHandle?: string;
      creatorName?: string | null;
    } = { matched: false, created: false };

    if (
      !post.creator_id &&
      platform === "instagram" &&
      scrapedMetrics.owner_username
    ) {
      // First try to find an existing creator match
      let match = await findInstagramCreatorMatch(
        supabase,
        campaign.workspace_id,
        scrapedMetrics.owner_username
      );

      // If no match found, auto-create the creator
      if (!match) {
        console.log(`No existing creator match for @${scrapedMetrics.owner_username}, creating new creator...`);
        match = await createInstagramCreator(
          supabase,
          campaign.workspace_id,
          scrapedMetrics.owner_username
        );
      }

      if (match) {
        updatePayload.creator_id = match.creatorId;
        creatorMatch = {
          matched: true,
          created: match.created,
          creatorId: match.creatorId,
          creatorHandle: match.creatorHandle,
          creatorName: match.creatorName,
        };

        // Add creator to campaign
        const { error: campaignCreatorError } = await supabase
          .from("campaign_creators")
          .upsert(
            { campaign_id: post.campaign_id, creator_id: match.creatorId },
            { onConflict: "campaign_id,creator_id" }
          );

        if (campaignCreatorError) {
          console.warn(
            "Failed to attach creator to campaign:",
            campaignCreatorError
          );
        }

        console.log(`Creator ${match.created ? "created and " : ""}attached: @${match.creatorHandle} (${match.creatorId})`);
      }
    }

    const { data: updatedPost, error: updateError } = await supabase
      .from("posts")
      .update(updatePayload)
      .eq("id", postId)
      .select(
        "id, platform, external_id, post_url, owner_username, creator_id, status"
      )
      .single();

    if (updateError) {
      throw updateError;
    }

    await supabase
      .from("campaign_platform_scrapes")
      .upsert(
        {
          campaign_id: post.campaign_id,
          platform,
          last_scraped_at: new Date().toISOString(),
        },
        { onConflict: "campaign_id,platform" }
      );

    // Save historical metrics snapshot
    const { error: metricsError } = await supabase.from("post_metrics").insert({
      post_id: postId,
      views: scrapedMetrics.views,
      likes: scrapedMetrics.likes,
      comments: scrapedMetrics.comments,
      shares: scrapedMetrics.shares,
      engagement_rate: scrapedMetrics.engagement_rate,
      scraped_at: new Date().toISOString(),
    });

    if (metricsError) {
      console.error("Failed to save historical metrics:", metricsError);
      // Don't throw - historical metrics are optional
    } else {
      console.log(`✅ Historical metrics snapshot saved for post ${postId}`);
    }

    return new Response(
      JSON.stringify({
        success: true,
        metrics: scrapedMetrics,
        post: updatedPost
          ? {
              id: updatedPost.id,
              platform: updatedPost.platform,
              externalId: updatedPost.external_id,
              sourceUrl: updatedPost.post_url,
              ownerUsername: updatedPost.owner_username ?? null,
              creatorId: updatedPost.creator_id ?? null,
              status: updatedPost.status,
            }
          : null,
        creatorMatch,
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      }
    );
  } catch (error) {
    console.error("Scraping error:", error);

    return new Response(
      JSON.stringify({
        success: false,
        error: error.message,
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      }
    );
  }
});
