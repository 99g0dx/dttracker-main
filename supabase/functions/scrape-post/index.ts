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

// ============================================================
// API CONFIGURATION
// ============================================================
// Primary: Apify actors (TikTok, Instagram, YouTube) + RapidAPI (Twitter)
// - APIFY_TOKEN: Your Apify API token (TikTok, Instagram, YouTube)
// - APIFY_YOUTUBE_TOKEN: Optional; if set, used only for YouTube (else APIFY_TOKEN)
// - Actors: clockworks~tiktok-scraper, apify~instagram-scraper, streamers~youtube-scraper
// - RAPIDAPI_KEY: Used for Twitter scraping

// Twitter (RapidAPI)
const TWITTER_API_BASE_URL = "https://twitter241.p.rapidapi.com";
const TWITTER_API_HOST = "twitter241.p.rapidapi.com";
const TWITTER_API_ENDPOINT = "/tweet-v2"; // Uses pid (tweet ID) parameter
// ============================================================

const MAX_SCRAPE_ATTEMPTS = 3;
const RETRY_BACKOFF_BASE_MS = 1500;

/** Retry fetch on 429 (rate limit) and 5xx (server/gateway errors). */
async function fetchWithRetry(
  url: string,
  options: RequestInit,
  label: string
): Promise<Response> {
  let lastError: Error | null = null;
  for (let attempt = 0; attempt < MAX_SCRAPE_ATTEMPTS; attempt++) {
    try {
      const response = await fetch(url, options);
      const retryable =
        response.status === 429 || (response.status >= 500 && response.status < 600);
      if (!retryable) return response;
      if (attempt < MAX_SCRAPE_ATTEMPTS - 1) {
        const backoffMs = RETRY_BACKOFF_BASE_MS * Math.pow(2, attempt);
        console.warn(
          `${label} ${response.status}. Retrying in ${backoffMs}ms (attempt ${attempt + 1}/${MAX_SCRAPE_ATTEMPTS})...`
        );
        await new Promise((r) => setTimeout(r, backoffMs));
        continue;
      }
      return response;
    } catch (err) {
      lastError = err instanceof Error ? err : new Error(String(err));
      if (attempt < MAX_SCRAPE_ATTEMPTS - 1) {
        const backoffMs = RETRY_BACKOFF_BASE_MS * Math.pow(2, attempt);
        console.warn(
          `${label} network error: ${lastError.message}. Retrying in ${backoffMs}ms (attempt ${attempt + 1}/${MAX_SCRAPE_ATTEMPTS})...`
        );
        await new Promise((r) => setTimeout(r, backoffMs));
      } else {
        throw lastError;
      }
    }
  }
  throw lastError ?? new Error(`${label} failed after ${MAX_SCRAPE_ATTEMPTS} attempts`);
}

interface ScrapeRequest {
  postId: string;
  postUrl: string;
  platform: "tiktok" | "instagram" | "youtube" | "twitter" | "facebook";
  isAutoScrape?: boolean; // Flag to indicate auto-scraping vs manual
  /** Optional: requesting user id for agency bypass when called from scrape-all-posts (JWT may not be forwarded) */
  request_user_id?: string | null;
  /** Optional: from scrape-job-worker; run id to update on success/failure */
  run_id?: string | null;
  /** Optional: override Apify actor (primary/fallback from parser_versions) */
  actor_id?: string | null;
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

async function scrapeTikTok(postUrl: string, actorOverride?: string | null): Promise<ScrapedMetrics> {
  try {
    const apifyToken = Deno.env.get("APIFY_TOKEN");
    if (!apifyToken) {
      throw new Error(
        "APIFY_TOKEN not configured. Please set the APIFY_TOKEN secret in Supabase Edge Functions."
      );
    }

    console.log(`[scrapeTikTok] Starting Apify scrape for URL: ${postUrl}`);

    let normalizedUrl = postUrl.trim();
    if (
      !normalizedUrl.startsWith("http://") &&
      !normalizedUrl.startsWith("https://")
    ) {
      normalizedUrl = "https://" + normalizedUrl;
    }

    const actorId = actorOverride ?? "clockworks~tiktok-scraper";
    const apifyUrl =
      "https://api.apify.com/v2/acts/" +
      encodeURIComponent(actorId) +
      "/run-sync-get-dataset-items?token=" +
      encodeURIComponent(apifyToken);

    const input = {
      postURLs: [normalizedUrl],
      resultsPerPage: 1,
      shouldDownloadVideos: false,
      shouldDownloadCovers: false,
      shouldDownloadSubtitles: false,
      shouldDownloadSlideshowImages: false,
    };

    console.log("[scrapeTikTok] Calling Apify actor:", actorId);

    const response = await fetchWithRetry(
      apifyUrl,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(input),
      },
      "[scrapeTikTok] Apify"
    );

    console.log(`[scrapeTikTok] Apify response status: ${response.status}`);

    if (!response.ok) {
      const errorText = await response.text().catch(() => "Unknown error");
      throw new Error(
        `Apify TikTok API error (${response.status}): ${errorText.substring(0, 300)}`
      );
    }

    const rawResponse = await response.json().catch(() => {
      throw new Error("Invalid JSON response from Apify TikTok scraper");
    });

    // #region agent log - Log full Apify response structure
    console.log(
      "[DEBUG] scrapeTikTok: Full Apify response type:",
      typeof rawResponse
    );
    console.log("[DEBUG] scrapeTikTok: Is array?", Array.isArray(rawResponse));
    console.log(
      "[DEBUG] scrapeTikTok: Top-level keys:",
      Object.keys(rawResponse || {})
    );
    console.log(
      "[DEBUG] scrapeTikTok: Full response (first 5000 chars):",
      JSON.stringify(rawResponse, null, 2).substring(0, 5000)
    );

    // Check for Apify error responses
    if (
      rawResponse?.error ||
      rawResponse?.status === "ERROR" ||
      rawResponse?.status === "FAILED"
    ) {
      console.error("[DEBUG] scrapeTikTok: Apify returned error:", rawResponse);
      throw new Error(
        `Apify TikTok scraper error: ${JSON.stringify(rawResponse.error || rawResponse)}`
      );
    }
    // #endregion

    // Apify may return array directly or wrapped in { items }, { data }, or { data: { items } }
    // Also check for { data: [...] } or { results: [...] } structures
    let items: any[] = [];

    if (Array.isArray(rawResponse)) {
      items = rawResponse;
    } else if (rawResponse?.items && Array.isArray(rawResponse.items)) {
      items = rawResponse.items;
    } else if (rawResponse?.data) {
      if (Array.isArray(rawResponse.data)) {
        items = rawResponse.data;
      } else if (
        rawResponse.data?.items &&
        Array.isArray(rawResponse.data.items)
      ) {
        items = rawResponse.data.items;
      } else if (
        rawResponse.data?.data &&
        Array.isArray(rawResponse.data.data)
      ) {
        items = rawResponse.data.data;
      }
    } else if (rawResponse?.results && Array.isArray(rawResponse.results)) {
      items = rawResponse.results;
    } else if (
      rawResponse?.datasetItems &&
      Array.isArray(rawResponse.datasetItems)
    ) {
      items = rawResponse.datasetItems;
    }

    console.log(
      "[DEBUG] scrapeTikTok: Extracted items array length:",
      items.length
    );

    console.log(
      "[scrapeTikTok] Apify returned items:",
      Array.isArray(items) ? items.length : typeof items
    );
    // #region agent log
    console.log("[DEBUG] scrapeTikTok: Items array length:", items.length);
    console.log("[DEBUG] scrapeTikTok: Items type:", typeof items);
    if (items.length > 0) {
      console.log(
        "[DEBUG] scrapeTikTok: First item keys:",
        Object.keys(items[0] || {})
      );
      console.log(
        "[DEBUG] scrapeTikTok: First item preview:",
        JSON.stringify(items[0], null, 2).substring(0, 2000)
      );
    }
    // #endregion

    if (!Array.isArray(items) || items.length === 0) {
      const errorDetails = {
        responseType: typeof rawResponse,
        responseIsArray: Array.isArray(rawResponse),
        topLevelKeys: Object.keys(rawResponse || {}),
        hasItems: !!rawResponse?.items,
        hasData: !!rawResponse?.data,
        hasResults: !!rawResponse?.results,
        fullResponsePreview: JSON.stringify(rawResponse, null, 2).substring(
          0,
          3000
        ),
      };
      console.error("[scrapeTikTok] Unexpected response shape:", errorDetails);
      throw new Error(
        `Apify TikTok scraper returned no results for this URL. ` +
          `Response structure: ${JSON.stringify(errorDetails)}. ` +
          `Full response (first 2000 chars): ${JSON.stringify(rawResponse, null, 2).substring(0, 2000)}`
      );
    }

    const item = items[0];

    // Apify can return { url, error } instead of video data; treat as error and do not parse metrics.
    // Check if Apify returned an error in the item (e.g., "Post not found or private")
    if (item?.error) {
      const errorMessage =
        typeof item.error === "string"
          ? item.error
          : JSON.stringify(item.error);
      console.error(
        "[scrapeTikTok] Apify returned error in item:",
        errorMessage
      );
      throw new Error(
        `TikTok post error: ${errorMessage}. The post may be private, deleted, or unavailable.`
      );
    }

    // Check for error fields in the item structure
    if (
      item?.status === "error" ||
      item?.status === "failed" ||
      item?.status === "ERROR" ||
      item?.status === "FAILED"
    ) {
      const errorMsg =
        item.message || item.error || item.reason || "Unknown error";
      console.error("[scrapeTikTok] Apify item has error status:", errorMsg);
      throw new Error(`TikTok scraping failed: ${errorMsg}`);
    }
    // Resolve nested video object (some Apify outputs wrap video in .video)
    const video = item?.video ?? item;
    const stats =
      video.stats ?? video.statistics ?? item.stats ?? item.statistics ?? {};
    console.log("[scrapeTikTok] Item keys:", Object.keys(item).slice(0, 25));
    console.log("[scrapeTikTok] Video keys:", Object.keys(video).slice(0, 25));
    console.log(
      "[scrapeTikTok] Item preview:",
      JSON.stringify(item).substring(0, 1200)
    );
    // #region agent log - Log item structure for debugging
    console.log(
      "[DEBUG] scrapeTikTok: Full item structure:",
      JSON.stringify(item, null, 2).substring(0, 4000)
    );
    console.log(
      "[DEBUG] scrapeTikTok: Video object:",
      JSON.stringify(video, null, 2).substring(0, 2000)
    );
    console.log(
      "[DEBUG] scrapeTikTok: Stats object:",
      JSON.stringify(stats, null, 2)
    );
    console.log("[DEBUG] scrapeTikTok: item.video exists?", !!item?.video);
    console.log("[DEBUG] scrapeTikTok: video.stats exists?", !!video?.stats);
    console.log(
      "[DEBUG] scrapeTikTok: video.statistics exists?",
      !!video?.statistics
    );
    // #endregion

    /** Parse number from value - handles "1.2K", "10.5M", numeric strings, and nested objects */
    const parseNum = (v: unknown): number => {
      if (v == null || v === "") return 0;
      if (typeof v === "number" && !isNaN(v) && v > 0) return v;
      if (typeof v === "object" && v !== null) {
        // Handle nested objects like { value: 1000 } or { count: "1.2K" }
        const obj = v as Record<string, unknown>;
        for (const key of ["value", "count", "number", "amount", "total"]) {
          if (obj[key] != null) {
            const nested = parseNum(obj[key]);
            if (nested > 0) return nested;
          }
        }
        return 0;
      }
      const s = String(v).trim().replace(/,/g, "");
      const n = Number(s);
      if (!isNaN(n) && n > 0) return n;
      // Handle formats like "1.2K", "10.5M", "1.2k views", "10M likes"
      const match = s.match(/^([\d.]+)\s*([KkMmBb])?/i);
      if (match) {
        let val = parseFloat(match[1]);
        const suffix = (match[2] || "").toUpperCase();
        if (suffix === "K") val *= 1e3;
        else if (suffix === "M") val *= 1e6;
        else if (suffix === "B") val *= 1e9;
        if (val > 0) return Math.round(val);
      }
      return 0;
    };

    /** Extract value from nested object using multiple possible paths */
    const extractValue = (obj: any, paths: string[]): number => {
      for (const path of paths) {
        const parts = path.split(".");
        let current: any = obj;
        for (const part of parts) {
          if (current == null) break;
          current = current[part];
        }
        if (current != null) {
          const val = parseNum(current);
          if (val > 0) return val;
        }
      }
      return 0;
    };

    const num = (...vals: unknown[]) => {
      for (const v of vals) {
        const n = parseNum(v);
        if (n > 0) return n;
      }
      return 0;
    };

    // #region agent log - Log raw values before parsing
    console.log("[DEBUG] scrapeTikTok: Raw view values:", {
      video_playCount: video.playCount,
      video_play_count: video.play_count,
      video_viewCount: video.viewCount,
      video_views: video.views,
      stats_playCount: stats.playCount,
      stats_viewCount: stats.viewCount,
      item_playCount: item.playCount,
      item_viewCount: item.viewCount,
    });
    console.log("[DEBUG] scrapeTikTok: Raw like values:", {
      video_diggCount: video.diggCount,
      video_likeCount: video.likeCount,
      stats_diggCount: stats.diggCount,
      item_diggCount: item.diggCount,
    });
    console.log("[DEBUG] scrapeTikTok: Raw comment values:", {
      video_commentCount: video.commentCount,
      stats_commentCount: stats.commentCount,
      item_commentCount: item.commentCount,
    });
    console.log("[DEBUG] scrapeTikTok: Raw share values:", {
      video_shareCount: video.shareCount,
      stats_shareCount: stats.shareCount,
      item_shareCount: item.shareCount,
    });
    // #endregion

    // Enhanced extraction with more possible field paths
    const views = num(
      // Direct video fields
      video.playCount,
      video.play_count,
      video.viewCount,
      video.views,
      video.view_count,
      // Stats fields
      stats.playCount,
      stats.play_count,
      stats.viewCount,
      stats.views,
      stats.view_count,
      // Item fields
      item.playCount,
      item.play_count,
      item.viewCount,
      item.views,
      item.view_count,
      // Nested meta fields
      item.videoMeta?.playCount,
      video.videoMeta?.playCount,
      item.musicMeta?.playCount,
      video.musicMeta?.playCount,
      // Alternative paths
      extractValue(item, [
        "statistics.playCount",
        "statistics.viewCount",
        "statistics.views",
        "metrics.views",
        "metrics.playCount",
      ]),
      extractValue(video, [
        "statistics.playCount",
        "statistics.viewCount",
        "statistics.views",
        "metrics.views",
        "metrics.playCount",
      ]),
      extractValue(stats, ["playCount", "viewCount", "views"])
    );

    const likes = num(
      // Direct video fields
      video.diggCount,
      video.digg_count,
      video.likeCount,
      video.likes,
      video.like_count,
      // Stats fields
      stats.diggCount,
      stats.digg_count,
      stats.likeCount,
      stats.likes,
      stats.like_count,
      // Item fields
      item.diggCount,
      item.digg_count,
      item.likeCount,
      item.likes,
      item.like_count,
      // Nested meta fields
      item.videoMeta?.diggCount,
      video.videoMeta?.diggCount,
      item.musicMeta?.diggCount,
      video.musicMeta?.diggCount,
      // Alternative paths
      extractValue(item, [
        "statistics.diggCount",
        "statistics.likeCount",
        "statistics.likes",
        "metrics.likes",
        "metrics.diggCount",
      ]),
      extractValue(video, [
        "statistics.diggCount",
        "statistics.likeCount",
        "statistics.likes",
        "metrics.likes",
        "metrics.diggCount",
      ]),
      extractValue(stats, ["diggCount", "likeCount", "likes"])
    );

    const comments = num(
      // Direct video fields
      video.commentCount,
      video.comment_count,
      video.comments,
      // Stats fields
      stats.commentCount,
      stats.comment_count,
      stats.comments,
      // Item fields
      item.commentCount,
      item.comment_count,
      item.comments,
      // Nested meta fields
      item.videoMeta?.commentCount,
      video.videoMeta?.commentCount,
      item.musicMeta?.commentCount,
      video.musicMeta?.commentCount,
      // Alternative paths
      extractValue(item, [
        "statistics.commentCount",
        "statistics.comments",
        "metrics.comments",
        "metrics.commentCount",
      ]),
      extractValue(video, [
        "statistics.commentCount",
        "statistics.comments",
        "metrics.comments",
        "metrics.commentCount",
      ]),
      extractValue(stats, ["commentCount", "comments"])
    );

    const shares = num(
      // Direct video fields
      video.shareCount,
      video.share_count,
      video.shares,
      // Stats fields
      stats.shareCount,
      stats.share_count,
      stats.shares,
      // Item fields
      item.shareCount,
      item.share_count,
      item.shares,
      // Nested meta fields
      item.videoMeta?.shareCount,
      video.videoMeta?.shareCount,
      item.musicMeta?.shareCount,
      video.musicMeta?.shareCount,
      // Alternative paths
      extractValue(item, [
        "statistics.shareCount",
        "statistics.shares",
        "metrics.shares",
        "metrics.shareCount",
      ]),
      extractValue(video, [
        "statistics.shareCount",
        "statistics.shares",
        "metrics.shares",
        "metrics.shareCount",
      ]),
      extractValue(stats, ["shareCount", "shares"])
    );

    // #region agent log - Log parsed metrics
    console.log("[DEBUG] scrapeTikTok: Parsed metrics:", {
      views,
      likes,
      comments,
      shares,
      total: views + likes + comments + shares,
    });
    // #endregion

    const ownerUsername =
      item.authorMeta?.name ??
      item.authorMeta?.nickName ??
      video.authorMeta?.name ??
      video.authorMeta?.nickName ??
      item.author?.nickname ??
      item.author?.uniqueId ??
      video.author?.nickname ??
      video.author?.uniqueId ??
      item.authorName ??
      video.authorName ??
      null;

    const totalMetrics = views + likes + comments + shares;

    console.log("[scrapeTikTok] Extracted metrics:", {
      views,
      likes,
      comments,
      shares,
      totalMetrics,
      ownerUsername,
    });

    // If all metrics are zero, try a deep search through the entire item structure
    if (!totalMetrics) {
      console.warn(
        "[scrapeTikTok] Initial extraction returned zero metrics, attempting deep search..."
      );

      // Deep search function that recursively searches for numeric values
      const deepSearch = (obj: any, depth = 0, maxDepth = 5): number[] => {
        if (depth > maxDepth || obj == null || typeof obj !== "object")
          return [];
        const values: number[] = [];

        for (const key in obj) {
          if (!obj.hasOwnProperty(key)) continue;
          const val = obj[key];

          // Check if key suggests it's a metric field
          const isMetricKey =
            /(view|play|like|digg|comment|share|count|metric)/i.test(key);

          if (isMetricKey && val != null) {
            const parsed = parseNum(val);
            if (parsed > 0) values.push(parsed);
          }

          // Recursively search nested objects
          if (typeof val === "object" && val !== null && !Array.isArray(val)) {
            values.push(...deepSearch(val, depth + 1, maxDepth));
          }
        }

        return values;
      };

      // Try deep search and use the first 4 largest values found
      const foundValues = deepSearch(item).sort((a, b) => b - a);

      if (foundValues.length >= 4) {
        console.log(
          "[scrapeTikTok] Deep search found values:",
          foundValues.slice(0, 4)
        );
        // Use the 4 largest values as views, likes, comments, shares
        const [deepViews, deepLikes, deepComments, deepShares] =
          foundValues.slice(0, 4);
        const deepTotal = deepViews + deepLikes + deepComments + deepShares;

        if (deepTotal > 0) {
          console.log("[scrapeTikTok] Using deep search results:", {
            deepViews,
            deepLikes,
            deepComments,
            deepShares,
          });
          return {
            views: deepViews,
            likes: deepLikes,
            comments: deepComments,
            shares: deepShares,
            engagement_rate: 0,
            owner_username: ownerUsername,
          };
        }
      }

      // If deep search also failed, log EVERYTHING for debugging
      const fullRawResponseStr = JSON.stringify(rawResponse, null, 2);
      const fullItemStr = JSON.stringify(item, null, 2);

      console.error(
        "[scrapeTikTok] ========== ZERO METRICS - FULL DEBUG INFO =========="
      );
      console.error(
        "[scrapeTikTok] Full Apify rawResponse (first 5000 chars):",
        fullRawResponseStr.substring(0, 5000)
      );
      console.error(
        "[scrapeTikTok] Full item (first 5000 chars):",
        fullItemStr.substring(0, 5000)
      );
      console.error(
        "[scrapeTikTok] Video object keys:",
        Object.keys(video || {})
      );
      console.error(
        "[scrapeTikTok] Stats object keys:",
        Object.keys(stats || {})
      );
      console.error(
        "[scrapeTikTok] Item object keys:",
        Object.keys(item || {})
      );
      console.error("[scrapeTikTok] Deep search found values:", foundValues);
      console.error("[scrapeTikTok] ========== END DEBUG INFO ==========");

      // #region agent log - Log all possible metric fields when zero
      console.error(
        "[DEBUG] scrapeTikTok: ZERO METRICS DETECTED. All checked fields:",
        {
          rawResponseType: typeof rawResponse,
          rawResponseIsArray: Array.isArray(rawResponse),
          rawResponseKeys: Object.keys(rawResponse || {}),
          itemsLength: items.length,
          video: Object.keys(video || {}),
          stats: Object.keys(stats || {}),
          item: Object.keys(item || {}),
          videoValues: {
            playCount: video?.playCount,
            play_count: video?.play_count,
            viewCount: video?.viewCount,
            views: video?.views,
            diggCount: video?.diggCount,
            likeCount: video?.likeCount,
            commentCount: video?.commentCount,
            shareCount: video?.shareCount,
          },
          statsValues: {
            playCount: stats?.playCount,
            viewCount: stats?.viewCount,
            diggCount: stats?.diggCount,
            likeCount: stats?.likeCount,
            commentCount: stats?.commentCount,
            shareCount: stats?.shareCount,
          },
          itemValues: {
            playCount: item?.playCount,
            viewCount: item?.viewCount,
            diggCount: item?.diggCount,
            likeCount: item?.likeCount,
            commentCount: item?.commentCount,
            shareCount: item?.shareCount,
          },
          deepSearchFound: foundValues,
          fullRawResponsePreview: fullRawResponseStr.substring(0, 3000),
          fullItemPreview: fullItemStr.substring(0, 3000),
        }
      );
      // #endregion

      // Include the full response in the error message so it's visible in logs
      const errorMsg =
        `Apify TikTok scraper returned zero metrics. Response structure may have changed. ` +
        `Full rawResponse (first 2000 chars): ${fullRawResponseStr.substring(0, 2000)}. ` +
        `Full item (first 2000 chars): ${fullItemStr.substring(0, 2000)}. ` +
        `Check Supabase Edge Function logs (scrape-post) for complete debug info. ` +
        `TikTok may also be blocking the scraper—try again later or use a different post.`;

      throw new Error(errorMsg);
    }

    return {
      views,
      likes,
      comments,
      shares,
      engagement_rate: 0,
      owner_username: ownerUsername,
    };
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
async function scrapeInstagram(postUrl: string, actorOverride?: string | null): Promise<ScrapedMetrics> {
  try {
    const apifyToken = Deno.env.get("APIFY_TOKEN");
    const apifyActorId =
      actorOverride ?? Deno.env.get("APIFY_INSTAGRAM_ACTOR_ID") ?? "apify~instagram-scraper";

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
    console.log("Apify URL:", apifyUrl.replace(/token=[^&]+/, "token=***"));

    const fetchWithRetry = async (attempt: number): Promise<Response> => {
      const response = await fetch(apifyUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(input),
      });

      const retryable =
        response.status === 429 || (response.status >= 500 && response.status < 600);
      if (retryable && attempt < MAX_SCRAPE_ATTEMPTS - 1) {
        const backoffMs = RETRY_BACKOFF_BASE_MS * Math.pow(2, attempt);
        console.warn(
          `Apify Instagram API ${response.status}. Retrying in ${backoffMs}ms (attempt ${attempt + 1}/${MAX_SCRAPE_ATTEMPTS})...`
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
 * Scrape YouTube video metrics using Apify (streamers/youtube-scraper).
 * Token (in order): APIFY_YOUTUBE_TOKEN, APIFY_TOKEN, APIFY_API_TOKEN.
 */
async function scrapeYouTube(postUrl: string, actorOverride?: string | null): Promise<ScrapedMetrics> {
  try {
    const apifyToken =
      Deno.env.get("APIFY_YOUTUBE_TOKEN") ??
      Deno.env.get("APIFY_TOKEN") ??
      Deno.env.get("APIFY_API_TOKEN");

    if (!apifyToken) {
      throw new Error(
        "APIFY_TOKEN (or APIFY_YOUTUBE_TOKEN or APIFY_API_TOKEN) not configured. Set one of these secrets in Supabase Edge Functions for YouTube scraping."
      );
    }

    let normalizedUrl = postUrl.trim();
    if (
      !normalizedUrl.startsWith("http://") &&
      !normalizedUrl.startsWith("https://")
    ) {
      normalizedUrl = "https://" + normalizedUrl;
    }

    const actorId = actorOverride ?? "streamers~youtube-scraper";
    const apifyUrl =
      "https://api.apify.com/v2/acts/" +
      encodeURIComponent(actorId) +
      "/run-sync-get-dataset-items?token=" +
      encodeURIComponent(apifyToken);

    const input = {
      startUrls: [{ url: normalizedUrl }],
    };

    console.log("[scrapeYouTube] Calling Apify actor:", actorId);
    console.log("[scrapeYouTube] Post URL:", normalizedUrl);

    const response = await fetchWithRetry(
      apifyUrl,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(input),
      },
      "[scrapeYouTube] Apify"
    );

    if (!response.ok) {
      const errorText = await response.text().catch(() => "Unknown error");
      console.error("Apify YouTube API error:", response.status, errorText);
      throw new Error(
        `Apify YouTube API error (${response.status}): ${errorText.substring(0, 200)}`
      );
    }

    const rawResponse = await response.json().catch(() => {
      throw new Error("Invalid JSON response from Apify YouTube scraper");
    });

    if (
      rawResponse?.error ||
      rawResponse?.status === "ERROR" ||
      rawResponse?.status === "FAILED"
    ) {
      throw new Error(
        `Apify YouTube scraper error: ${JSON.stringify(rawResponse.error ?? rawResponse)}`
      );
    }

    let items: any[] = [];
    if (Array.isArray(rawResponse)) {
      items = rawResponse;
    } else if (rawResponse?.items && Array.isArray(rawResponse.items)) {
      items = rawResponse.items;
    } else if (rawResponse?.data) {
      if (Array.isArray(rawResponse.data)) {
        items = rawResponse.data;
      } else if (
        rawResponse.data?.items &&
        Array.isArray(rawResponse.data.items)
      ) {
        items = rawResponse.data.items;
      }
    } else if (rawResponse?.results && Array.isArray(rawResponse.results)) {
      items = rawResponse.results;
    } else if (
      rawResponse?.datasetItems &&
      Array.isArray(rawResponse.datasetItems)
    ) {
      items = rawResponse.datasetItems;
    }

    if (!items.length) {
      throw new Error(
        "Apify YouTube scraper returned no results for this URL. Invalid post URL or format."
      );
    }

    const item = items[0];
    const parseNum = (v: unknown): number => {
      if (v == null) return 0;
      if (typeof v === "number" && !Number.isNaN(v)) return Math.floor(v);
      const n = parseInt(String(v).replace(/[^0-9]/g, ""), 10);
      return Number.isNaN(n) ? 0 : n;
    };

    const views = parseNum(
      item.viewCount ??
        item.views ??
        item.statistics?.viewCount ??
        item.statistics?.views
    );
    const likes = parseNum(
      item.likeCount ??
        item.likes ??
        item.statistics?.likeCount ??
        item.statistics?.likes
    );
    const comments = parseNum(
      item.commentCount ??
        item.comments ??
        item.statistics?.commentCount ??
        item.statistics?.comments
    );
    const shares = parseNum(item.shareCount ?? item.shares ?? 0);
    const totalEngagements = likes + comments + shares;
    const engagement_rate = views > 0 ? (totalEngagements / views) * 100 : 0;

    return {
      views,
      likes,
      comments,
      shares,
      engagement_rate,
    };
  } catch (error) {
    console.error("YouTube scraping error:", error);
    throw new Error(
      `Failed to scrape YouTube: ${error instanceof Error ? error.message : String(error)}`
    );
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

    const response = await fetchWithRetry(
      twitterApiUrl,
      {
        method: "GET",
        headers: {
          "X-RapidAPI-Key": rapidApiKey,
          "X-RapidAPI-Host": TWITTER_API_HOST,
        },
      },
      "[scrapeTwitter] RapidAPI"
    );

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
  postUrl: string,
  actorIdOverride?: string | null
): Promise<ScrapedMetrics> {
  switch (platform) {
    case "tiktok":
      return await scrapeTikTok(postUrl, actorIdOverride);
    case "instagram":
      return await scrapeInstagram(postUrl, actorIdOverride);
    case "youtube":
      return await scrapeYouTube(postUrl, actorIdOverride);
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

  console.log(
    `Creating new Instagram creator: @${normalizedHandle} for workspace ${workspaceId}`
  );

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
      // Search globally by platform + normalized handle (not by user_id)
      // Fetch all Instagram creators and filter by normalized handle
      const { data: allCreators } = await supabase
        .from("creators")
        .select("id, handle, name")
        .eq("platform", "instagram");

      const existingCreator = allCreators?.find(
        (c) => normalizeHandle(c.handle) === normalizedHandle
      );

      if (existingCreator) {
        // Ensure they're in workspace_creators
        await supabase.from("workspace_creators").upsert(
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

  console.log(
    `Created new Instagram creator: ${newCreator.id} (@${normalizedHandle})`
  );

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
      return new Response(
        JSON.stringify({
          success: false,
          error:
            "Server configuration error: Missing Supabase credentials. Please check Edge Function secrets.",
        }),
        {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
          status: 500,
        }
      );
    }

    // Get authorization header - Supabase Edge Functions automatically verify JWTs
    // The user is already authenticated if we reach this point
    const authHeader = req.headers.get("Authorization");
    const token = authHeader?.replace("Bearer ", "") ?? null;
    if (!token) {
      console.warn(
        "No authorization token provided; proceeding without user context"
      );
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
    let requestBody: ScrapeRequest;
    try {
      requestBody = await req.json();
    } catch (parseError) {
      console.error("Failed to parse request body:", parseError);
      return new Response(
        JSON.stringify({
          success: false,
          error: "Invalid request body. Expected JSON.",
        }),
        {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
          status: 400,
        }
      );
    }

    const {
      postId,
      postUrl,
      platform,
      isAutoScrape = false,
      request_user_id: bodyRequestUserId,
      run_id: runId,
      actor_id: actorIdOverride,
    } = requestBody;

    if (!postId || !postUrl || !platform) {
      return new Response(
        JSON.stringify({
          success: false,
          error: "Missing required fields: postId, postUrl, platform",
        }),
        {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
          status: 400,
        }
      );
    }

    console.log(
      `${
        isAutoScrape ? "[AUTO]" : "[MANUAL]"
      } Scraping ${platform} post: ${postUrl}`
    );

    // Check if post is currently being scraped (conflict prevention)
    const { data: post, error: postError } = await supabase
      .from("posts")
      .select(
        "status, updated_at, campaign_id, creator_id, views, likes, comments, scrape_count"
      )
      .eq("id", postId)
      .single();

    if (postError) {
      return new Response(
        JSON.stringify({
          success: false,
          error: `Post not found: ${postError.message}`,
        }),
        {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
          status: 404,
        }
      );
    }

    const { data: campaign, error: campaignError } = await supabase
      .from("campaigns")
      .select("workspace_id")
      .eq("id", post.campaign_id)
      .single();

    if (campaignError || !campaign) {
      return new Response(
        JSON.stringify({
          success: false,
          error: "Campaign not found for post",
        }),
        {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
          status: 404,
        }
      );
    }

    // Resolve requesting user id for agency bypass (Edge Function uses service role so auth.uid() is null)
    let requestUserId: string | null = null;
    if (token) {
      const {
        data: { user: requestUser },
      } = await supabase.auth.getUser(token);
      requestUserId = requestUser?.id ?? null;
      console.log(`[DEBUG] scrape-post: got user from token: ${requestUserId}`);
    }
    // Fallback: when called from scrape-all-posts, JWT may not be forwarded; use body request_user_id
    if (requestUserId == null && bodyRequestUserId) {
      requestUserId = bodyRequestUserId;
      console.log(
        `[DEBUG] scrape-post: using body request_user_id: ${requestUserId}`
      );
    }
    // Must pass request_user_id so agency bypass works (auth.uid() is null with service role).
    console.log(
      `[DEBUG] scrape-post: calling can_trigger_scrape with request_user_id=${requestUserId}, workspace_id=${campaign.workspace_id}`
    );

    const { data: scrapeGate, error: gateError } = await supabase.rpc(
      "can_trigger_scrape",
      {
        target_workspace_id: campaign.workspace_id,
        target_campaign_id: post.campaign_id,
        target_platform: platform,
        request_user_id: requestUserId,
      }
    );

    if (gateError) {
      return new Response(
        JSON.stringify({
          success: false,
          error: `Scrape permission check failed: ${gateError.message}`,
        }),
        {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
          status: 500,
        }
      );
    }

    const gate = Array.isArray(scrapeGate) ? scrapeGate[0] : scrapeGate;
    console.log(
      `[DEBUG] scrape-post: can_trigger_scrape returned:`,
      JSON.stringify({
        allowed: gate?.allowed,
        tier: gate?.tier,
        message: gate?.message,
        reason: gate?.reason,
      })
    );
    if (!gate?.allowed) {
      const reason = gate?.reason || "not_allowed";
      const dbMessage = typeof gate?.message === "string" ? gate.message : null;
      console.log(
        `[DEBUG] scrape-post: scrape NOT allowed. reason=${reason}, message=${dbMessage}, request_user_id=${requestUserId}`
      );
      const message =
        reason === "platform_not_allowed"
          ? "Platform not available on your current plan."
          : reason === "scrape_interval_not_met"
            ? "Scrape interval not met. Please wait before scraping again."
            : reason === "subscription_past_due"
              ? "Subscription past due. Update payment to resume scraping."
              : dbMessage || "Scraping not allowed at this time.";

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

    // Per-operator scrape limit (manual scrape only; requestUserId already set above when token present)
    if (!isAutoScrape && requestUserId) {
      const { data: opLimit, error: opLimitError } = await supabase.rpc(
        "check_operator_scrape_limit",
        { p_workspace_id: campaign.workspace_id, p_user_id: requestUserId }
      );
      const opResult = Array.isArray(opLimit) ? opLimit[0] : opLimit;
      if (!opLimitError && opResult && opResult.allowed === false) {
        return new Response(
          JSON.stringify({
            success: false,
            error: "Daily manual scrape limit reached. Try again tomorrow.",
          }),
          {
            headers: { ...corsHeaders, "Content-Type": "application/json" },
            status: 429,
          }
        );
      }
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
    const startTime = Date.now();
    let metrics: ScrapedMetrics;
    try {
      metrics = await scrapePost(platform, postUrl, actorIdOverride ?? undefined);
    } catch (scrapeError) {
      const errorMessage =
        scrapeError instanceof Error
          ? scrapeError.message
          : String(scrapeError);
      console.error("Scraping failed:", errorMessage);

      // Determine error_type from error message
      let errorType: string | null = null;
      const errorLower = errorMessage.toLowerCase();
      if (/blocked|403|forbidden/i.test(errorMessage)) {
        errorType = "blocked";
      } else if (/challenge|captcha/i.test(errorMessage)) {
        errorType = "challenge";
      } else if (/timeout|timed out/i.test(errorMessage)) {
        errorType = "timeout";
      } else {
        errorType = "unknown";
      }

      if (runId) {
        await supabase
          .from("scrape_runs")
          .update({
            status: "failed",
            finished_at: new Date().toISOString(),
            duration_ms: Date.now() - startTime,
            error_raw: errorMessage.substring(0, 2000),
            error_type: errorType,
            is_valid: false,
          })
          .eq("id", runId);
      }

      // Update post's last_attempt tracking and status
      const now = new Date().toISOString();
      await supabase
        .from("posts")
        .update({
          status: "failed",
          last_attempt_at: now,
          last_attempt_status: "failed",
          last_attempt_error: errorMessage.substring(0, 500),
          last_attempt_items_count: 0,
        })
        .eq("id", postId);

      return new Response(
        JSON.stringify({
          success: false,
          error: errorMessage,
        }),
        {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
          status: 200, // Return 200 so frontend can parse the error message
        }
      );
    }

    // Calculate engagement rate
    const totalEngagements = metrics.likes + metrics.comments + metrics.shares;
    const engagementRate =
      metrics.views > 0 ? (totalEngagements / metrics.views) * 100 : 0;

    const scrapedMetrics = {
      ...metrics,
      engagement_rate: Number(engagementRate.toFixed(2)),
    };

    // Determine validity: run is valid if we got real metrics (not all zeros)
    const totalMetrics = scrapedMetrics.views + scrapedMetrics.likes + scrapedMetrics.comments + scrapedMetrics.shares;
    const isRunValid = totalMetrics > 0;
    
    // Determine error_type if invalid
    let errorType: string | null = null;
    if (!isRunValid) {
      // Check if it's a timeout (duration > 60s suggests timeout)
      const duration = Date.now() - startTime;
      if (duration > 60000) {
        errorType = "timeout";
      } else {
        // Likely empty dataset from Apify (soft-block/challenge/geo variance)
        errorType = "empty";
      }
    }

    // Always update scrape_runs with validity and error_type
    if (runId) {
      await supabase
        .from("scrape_runs")
        .update({
          status: "succeeded",
          finished_at: new Date().toISOString(),
          duration_ms: Date.now() - startTime,
          items_count: isRunValid ? 1 : 0,
          error_type: errorType,
          is_valid: isRunValid,
        })
        .eq("id", runId);
    }

    // Update post's last_attempt tracking (always, regardless of validity)
    const now = new Date().toISOString();
    const attemptUpdate: Record<string, unknown> = {
      last_attempt_at: now,
      last_attempt_status: "succeeded",
      last_attempt_items_count: isRunValid ? 1 : 0,
      last_attempt_error: errorType ? `Invalid scrape: ${errorType}` : null,
    };

    // Only update post metrics if run is valid (prevents overwriting with zeros)
    if (isRunValid) {
      // Compute growth since last scrape
      const prevViews = (post as { views?: number }).views ?? 0;
      const prevLikes = (post as { likes?: number }).likes ?? 0;
      const prevComments = (post as { comments?: number }).comments ?? 0;
      const lastViewGrowth = scrapedMetrics.views - prevViews;
      const lastLikeGrowth = scrapedMetrics.likes - prevLikes;
      const lastCommentGrowth = scrapedMetrics.comments - prevComments;

        // Update post in database with valid metrics
      const updatePayload: Record<string, unknown> = {
        views: scrapedMetrics.views,
        likes: scrapedMetrics.likes,
        comments: scrapedMetrics.comments,
        shares: scrapedMetrics.shares,
        engagement_rate: scrapedMetrics.engagement_rate,
        status: "scraped",
        last_scraped_at: now,
        updated_at: now,
        canonical_url: postUrl, // Save the URL used for scraping
        last_view_growth: lastViewGrowth,
        last_like_growth: lastLikeGrowth,
        last_comment_growth: lastCommentGrowth,
        scrape_count: ((post as { scrape_count?: number }).scrape_count ?? 0) + 1,
        // Per-post tracking: mark as successful
        last_success_at: now,
        metrics: {
          views: scrapedMetrics.views,
          likes: scrapedMetrics.likes,
          comments: scrapedMetrics.comments,
          shares: scrapedMetrics.shares,
          engagement_rate: scrapedMetrics.engagement_rate,
        },
        ...attemptUpdate,
      };

      // Add owner_username if available (especially useful for Instagram posts)
      if (scrapedMetrics.owner_username) {
        updatePayload.owner_username = scrapedMetrics.owner_username;
        updatePayload.creator_handle = scrapedMetrics.owner_username;
        console.log(
          `Setting owner_username to: ${scrapedMetrics.owner_username}`
        );
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
          console.log(
            `No existing creator match for @${scrapedMetrics.owner_username}, creating new creator...`
          );
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

          console.log(
            `Creator ${match.created ? "created and " : ""}attached: @${match.creatorHandle} (${match.creatorId})`
          );
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

      // Creator data quality: only on valid success, set last_scraped_at / data_status / last_successful_scrape_at
      const creatorIdToTouch =
        creatorMatch.creatorId ?? (post as { creator_id?: string | null }).creator_id ?? null;
      if (creatorIdToTouch) {
        await supabase
          .from("creators")
          .update({
            last_scraped_at: now,
            data_status: "fresh",
            last_successful_scrape_at: now,
          })
          .eq("id", creatorIdToTouch);
      }

      await supabase.from("campaign_platform_scrapes").upsert(
        {
          campaign_id: post.campaign_id,
          platform,
          last_scraped_at: now,
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
        scraped_at: now,
      });

      if (metricsError) {
        console.error("Failed to save historical metrics:", metricsError);
        // Don't throw - historical metrics are optional
      } else {
        console.log(`✅ Historical metrics snapshot saved for post ${postId}`);
      }

      // Increment per-operator scrape count (manual scrape only)
      if (!isAutoScrape && token) {
        const {
          data: { user: requestUser },
        } = await supabase.auth.getUser(token);
        const uid = requestUser?.id ?? null;
        if (uid) {
          await supabase.rpc("increment_operator_scrapes_today", {
            p_workspace_id: campaign.workspace_id,
            p_user_id: uid,
          });
        }
      }

      if (runId) {
        // Already updated above with validity
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
    } else {
      // Run succeeded but invalid (empty/zero metrics) - don't update post metrics
      console.warn(
        `Scrape succeeded but invalid (${errorType}): post ${postId} metrics not updated`
      );

      // Update post's last_attempt tracking only (no metrics update)
      await supabase
        .from("posts")
        .update(attemptUpdate)
        .eq("id", postId);

      // Return success but indicate invalid
      return new Response(
        JSON.stringify({
          success: true,
          metrics: scrapedMetrics,
          valid: false,
          error_type: errorType,
          message: `Scrape completed but returned no valid metrics (${errorType}). Post metrics not updated.`,
        }),
        {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
          status: 200,
        }
      );
    }
  } catch (error) {
    console.error("Scraping error:", error);
    const errorMessage = error instanceof Error ? error.message : String(error);
    const errorStack = error instanceof Error ? error.stack : undefined;

    // Log full error details for debugging
    console.error("Error details:", {
      message: errorMessage,
      stack: errorStack,
      type: error instanceof Error ? error.constructor.name : typeof error,
    });

    return new Response(
      JSON.stringify({
        success: false,
        error: errorMessage,
        details:
          process.env.DENO_ENV === "development" ? errorStack : undefined,
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200, // Return 200 so frontend can parse the error message
      }
    );
  }
});
