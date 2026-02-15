/**
 * Shared URL scraping logic for metrics.
 * Used by scrape-post and scrape-activation-submission.
 */

export interface ScrapedMetrics {
  views: number;
  likes: number;
  comments: number;
  shares: number;
  engagement_rate: number;
}

function parseNum(v: unknown): number {
  if (v == null || v === "") return 0;
  if (typeof v === "number" && !isNaN(v) && v > 0) return v;
  const s = String(v).trim().replace(/,/g, "");
  const n = Number(s);
  if (!isNaN(n) && n > 0) return n;
  const match = s.match(/^([\d.]+)\s*([KkMmBb])?$/);
  if (match) {
    let val = parseFloat(match[1]);
    const suffix = (match[2] || "").toUpperCase();
    if (suffix === "K") val *= 1e3;
    else if (suffix === "M") val *= 1e6;
    else if (suffix === "B") val *= 1e9;
    if (val > 0) return Math.round(val);
  }
  return 0;
}

function num(...vals: unknown[]): number {
  for (const v of vals) {
    const n = parseNum(v);
    if (n > 0) return n;
  }
  return 0;
}

function normalizeUrl(postUrl: string): string {
  let url = postUrl.trim();
  if (!url.startsWith("http://") && !url.startsWith("https://")) {
    url = "https://" + url;
  }
  return url;
}

function extractApifyItems(payload: unknown): unknown[] {
  if (Array.isArray(payload)) return payload;
  if (!payload || typeof payload !== "object") return [];
  const record = payload as Record<string, unknown>;
  const items =
    record.items ?? record.data ?? record.datasetItems ?? record.results;
  if (Array.isArray(items)) return items;
  if (
    record.data &&
    typeof record.data === "object" &&
    !Array.isArray(record.data)
  ) {
    const nested = (record.data as Record<string, unknown>).items;
    if (Array.isArray(nested)) return nested;
  }
  return [];
}

// ============================================================
// TikTok
// ============================================================

export async function scrapeTikTokUrl(
  postUrl: string,
): Promise<ScrapedMetrics> {
  const apifyToken = Deno.env.get("APIFY_TOKEN");
  if (!apifyToken) {
    throw new Error("APIFY_TOKEN not configured");
  }

  const normalizedUrl = normalizeUrl(postUrl);

  const actorId = "clockworks~tiktok-scraper";
  const apifyUrl =
    "https://api.apify.com/v2/acts/" +
    encodeURIComponent(actorId) +
    "/run-sync-get-dataset-items?token=" +
    encodeURIComponent(apifyToken);

  const response = await fetch(apifyUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      postURLs: [normalizedUrl],
      resultsPerPage: 1,
      shouldDownloadVideos: false,
      shouldDownloadCovers: false,
      shouldDownloadSubtitles: false,
      shouldDownloadSlideshowImages: false,
    }),
  });

  if (!response.ok) {
    const err = await response.text().catch(() => "Unknown error");
    throw new Error(
      `Apify TikTok error (${response.status}): ${err.substring(0, 200)}`,
    );
  }

  const rawResponse = await response.json().catch(() => null);
  const items = extractApifyItems(rawResponse);

  if (!items.length) {
    throw new Error("Apify TikTok scraper returned no results");
  }

  const item = items[0] as Record<string, any>;
  const video = item?.video ?? item;
  const stats =
    video.stats ?? video.statistics ?? item.stats ?? item.statistics ?? {};

  const views = num(
    video.playCount,
    video.play_count,
    video.viewCount,
    video.views,
    stats.playCount,
    stats.play_count,
    stats.viewCount,
    stats.views,
    item.playCount,
    item.play_count,
    item.viewCount,
    item.views,
  );
  const likes = num(
    video.diggCount,
    video.digg_count,
    video.likeCount,
    video.likes,
    stats.diggCount,
    stats.digg_count,
    stats.likeCount,
    stats.likes,
    item.diggCount,
    item.digg_count,
    item.likeCount,
    item.likes,
  );
  const comments = num(
    video.commentCount,
    video.comment_count,
    video.comments,
    stats.commentCount,
    stats.comment_count,
    stats.comments,
    item.commentCount,
    item.comment_count,
    item.comments,
  );
  const shares = num(
    video.shareCount,
    video.share_count,
    video.shares,
    stats.shareCount,
    stats.share_count,
    stats.shares,
    item.shareCount,
    item.share_count,
    item.shares,
  );

  const totalEngagements = likes + comments + shares;
  const engagement_rate = views > 0 ? (totalEngagements / views) * 100 : 0;

  return {
    views,
    likes,
    comments,
    shares,
    engagement_rate: Number(engagement_rate.toFixed(2)),
  };
}

// ============================================================
// Instagram
// ============================================================

export async function scrapeInstagramUrl(
  postUrl: string,
): Promise<ScrapedMetrics> {
  const apifyToken = Deno.env.get("APIFY_TOKEN");
  if (!apifyToken) {
    throw new Error("APIFY_TOKEN not configured");
  }

  const normalizedUrl = normalizeUrl(postUrl);

  const actorId =
    Deno.env.get("APIFY_INSTAGRAM_ACTOR_ID") ?? "apify~instagram-scraper";
  const apifyUrl =
    "https://api.apify.com/v2/acts/" +
    encodeURIComponent(actorId) +
    "/run-sync-get-dataset-items?token=" +
    encodeURIComponent(apifyToken);

  const response = await fetch(apifyUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      directUrls: [normalizedUrl],
      resultsType: "posts",
      resultsLimit: 1,
      addParentData: false,
    }),
  });

  if (!response.ok) {
    const err = await response.text().catch(() => "Unknown error");
    throw new Error(
      `Apify Instagram error (${response.status}): ${err.substring(0, 200)}`,
    );
  }

  const rawResponse = await response.json().catch(() => {
    throw new Error("Invalid response from Apify Instagram scraper");
  });

  const items = extractApifyItems(rawResponse);

  if (!items.length) {
    throw new Error("Apify Instagram scraper returned no results");
  }

  const item = items[0] as Record<string, any>;

  // Instagram metrics can appear in many field name variants
  const viewCandidates = [
    item.videoViewCount,
    item.video_view_count,
    item.videoPlayCount,
    item.video_play_count,
    item.reelPlayCount,
    item.reel_play_count,
    item.playCount,
    item.plays,
    item.viewCount,
    item.views,
    item.view_count,
  ]
    .map((v) => parseNum(v))
    .filter((v) => v > 0);

  const views = viewCandidates.length > 0 ? Math.max(...viewCandidates) : 0;
  const likes = num(item.likesCount, item.like_count, item.likes);
  const comments = num(item.commentsCount, item.comment_count, item.comments);
  const shares = 0; // Instagram API doesn't expose shares

  const totalEngagements = likes + comments + shares;
  const engagement_rate = views > 0 ? (totalEngagements / views) * 100 : 0;

  return {
    views,
    likes,
    comments,
    shares,
    engagement_rate: Number(engagement_rate.toFixed(2)),
  };
}

// ============================================================
// YouTube
// ============================================================

export async function scrapeYouTubeUrl(
  postUrl: string,
): Promise<ScrapedMetrics> {
  const apifyToken =
    Deno.env.get("APIFY_YOUTUBE_TOKEN") ??
    Deno.env.get("APIFY_TOKEN") ??
    Deno.env.get("APIFY_API_TOKEN");

  if (!apifyToken) {
    throw new Error("APIFY_TOKEN not configured for YouTube scraping");
  }

  const normalizedUrl = normalizeUrl(postUrl);

  const actorId = "streamers~youtube-scraper";
  const apifyUrl =
    "https://api.apify.com/v2/acts/" +
    encodeURIComponent(actorId) +
    "/run-sync-get-dataset-items?token=" +
    encodeURIComponent(apifyToken);

  const response = await fetch(apifyUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      startUrls: [{ url: normalizedUrl }],
    }),
  });

  if (!response.ok) {
    const err = await response.text().catch(() => "Unknown error");
    throw new Error(
      `Apify YouTube error (${response.status}): ${err.substring(0, 200)}`,
    );
  }

  const rawResponse = await response.json().catch(() => {
    throw new Error("Invalid response from Apify YouTube scraper");
  });

  const items = extractApifyItems(rawResponse);

  if (!items.length) {
    throw new Error("Apify YouTube scraper returned no results");
  }

  const item = items[0] as Record<string, any>;
  const statistics = item.statistics ?? {};

  const views = num(
    item.viewCount,
    item.views,
    statistics.viewCount,
    statistics.views,
  );
  const likes = num(
    item.likeCount,
    item.likes,
    statistics.likeCount,
    statistics.likes,
  );
  const comments = num(
    item.commentCount,
    item.comments,
    statistics.commentCount,
    statistics.comments,
  );
  const shares = num(item.shareCount, item.shares);

  const totalEngagements = likes + comments + shares;
  const engagement_rate = views > 0 ? (totalEngagements / views) * 100 : 0;

  return {
    views,
    likes,
    comments,
    shares,
    engagement_rate: Number(engagement_rate.toFixed(2)),
  };
}

// ============================================================
// Twitter / X
// ============================================================

const TWITTER_APIFY_ACTOR =
  "kaitoeasyapi~twitter-x-data-tweet-scraper-pay-per-result-cheapest";

export async function scrapeTwitterUrl(
  postUrl: string,
): Promise<ScrapedMetrics> {
  const apifyToken = Deno.env.get("APIFY_TOKEN");
  if (!apifyToken) {
    throw new Error("APIFY_TOKEN not configured");
  }

  // Extract tweet ID from URL
  const tweetIdMatch =
    postUrl.match(/\/status\/(\d+)/) ||
    postUrl.match(/twitter\.com\/.*\/status\/(\d+)/) ||
    postUrl.match(/x\.com\/.*\/status\/(\d+)/);

  if (!tweetIdMatch || !tweetIdMatch[1]) {
    throw new Error(
      "Could not extract tweet ID from Twitter URL. Please use a full Twitter/X post URL.",
    );
  }

  const tweetId = tweetIdMatch[1];
  const apifyUrl =
    "https://api.apify.com/v2/acts/" +
    encodeURIComponent(TWITTER_APIFY_ACTOR) +
    "/run-sync-get-dataset-items?token=" +
    encodeURIComponent(apifyToken);

  const response = await fetch(apifyUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      tweetIDs: [tweetId],
      maxItems: 1,
    }),
  });

  if (!response.ok) {
    const err = await response.text().catch(() => "Unknown error");
    throw new Error(
      `Apify Twitter error (${response.status}): ${err.substring(0, 200)}`,
    );
  }

  const rawResponse = await response.json().catch(() => {
    throw new Error("Invalid response from Apify Twitter scraper");
  });

  const items = extractApifyItems(rawResponse);

  if (!items.length) {
    throw new Error("Apify Twitter scraper returned no results");
  }

  const item = items[0] as Record<string, any>;
  const publicMetrics = item.public_metrics ?? item.publicMetrics ?? {};
  const metrics = item.metrics ?? {};

  const views = num(
    item.viewCount,
    publicMetrics.impression_count,
    publicMetrics.impressionCount,
    metrics.impression_count,
    item.views,
    item.view_count,
  );
  const likes = num(
    item.likeCount,
    publicMetrics.like_count,
    publicMetrics.likeCount,
    metrics.like_count,
    item.likes,
    item.like_count,
    item.favorite_count,
    item.favoriteCount,
  );
  const comments = num(
    item.replyCount,
    publicMetrics.reply_count,
    publicMetrics.replyCount,
    metrics.reply_count,
    item.reply_count,
    item.comments,
    item.comment_count,
  );
  const shares = num(
    item.retweetCount,
    publicMetrics.retweet_count,
    publicMetrics.retweetCount,
    metrics.retweet_count,
    item.retweet_count,
    item.retweets,
  );

  const totalEngagements = likes + comments + shares;
  const engagement_rate = views > 0 ? (totalEngagements / views) * 100 : 0;

  return {
    views,
    likes,
    comments,
    shares,
    engagement_rate: Number(engagement_rate.toFixed(2)),
  };
}

// ============================================================
// Platform detection & generic dispatcher
// ============================================================

export function detectPlatformFromUrl(url: string): string {
  const u = url.toLowerCase();
  if (u.includes("tiktok.com")) return "tiktok";
  if (u.includes("instagram.com")) return "instagram";
  if (u.includes("youtube.com") || u.includes("youtu.be")) return "youtube";
  if (u.includes("twitter.com") || u.includes("x.com")) return "twitter";
  if (u.includes("facebook.com") || u.includes("fb.com")) return "facebook";
  return "unknown";
}

/**
 * Scrape metrics for any supported platform URL.
 * Routes to the appropriate platform-specific scraper.
 */
export async function scrapeUrl(
  postUrl: string,
  platform?: string,
): Promise<ScrapedMetrics> {
  const detectedPlatform = platform || detectPlatformFromUrl(postUrl);

  switch (detectedPlatform) {
    case "tiktok":
      return scrapeTikTokUrl(postUrl);
    case "instagram":
      return scrapeInstagramUrl(postUrl);
    case "youtube":
      return scrapeYouTubeUrl(postUrl);
    case "twitter":
      return scrapeTwitterUrl(postUrl);
    case "facebook":
      throw new Error("Facebook scraping is not yet supported");
    default:
      throw new Error(`Unsupported platform: ${detectedPlatform}`);
  }
}
