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

export async function scrapeTikTokUrl(postUrl: string): Promise<ScrapedMetrics> {
  const apifyToken = Deno.env.get("APIFY_TOKEN");
  if (!apifyToken) {
    throw new Error("APIFY_TOKEN not configured");
  }

  let normalizedUrl = postUrl.trim();
  if (!normalizedUrl.startsWith("http")) {
    normalizedUrl = "https://" + normalizedUrl;
  }

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
    throw new Error(`Apify error (${response.status}): ${err.substring(0, 200)}`);
  }

  const rawResponse = await response.json().catch(() => null);
  const items = Array.isArray(rawResponse)
    ? rawResponse
    : rawResponse?.items
    ?? (Array.isArray(rawResponse?.data) ? rawResponse.data : rawResponse?.data?.items)
    ?? rawResponse?.results ?? [];

  if (!Array.isArray(items) || items.length === 0) {
    throw new Error("Apify returned no results");
  }

  const item = items[0];
  const video = item?.video ?? item;
  const stats = video.stats ?? video.statistics ?? item.stats ?? item.statistics ?? {};

  const views = num(
    video.playCount, video.play_count, video.viewCount, video.views,
    stats.playCount, stats.play_count, stats.viewCount, stats.views,
    item.playCount, item.play_count, item.viewCount, item.views,
  );
  const likes = num(
    video.diggCount, video.digg_count, video.likeCount, video.likes,
    stats.diggCount, stats.digg_count, stats.likeCount, stats.likes,
    item.diggCount, item.digg_count, item.likeCount, item.likes,
  );
  const comments = num(
    video.commentCount, video.comment_count, video.comments,
    stats.commentCount, stats.comment_count, stats.comments,
    item.commentCount, item.comment_count, item.comments,
  );
  const shares = num(
    video.shareCount, video.share_count, video.shares,
    stats.shareCount, stats.share_count, stats.shares,
    item.shareCount, item.share_count, item.shares,
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

export function detectPlatformFromUrl(url: string): string {
  const u = url.toLowerCase();
  if (u.includes("tiktok.com")) return "tiktok";
  if (u.includes("instagram.com")) return "instagram";
  if (u.includes("youtube.com") || u.includes("youtu.be")) return "youtube";
  if (u.includes("twitter.com") || u.includes("x.com")) return "twitter";
  if (u.includes("facebook.com") || u.includes("fb.com")) return "facebook";
  return "unknown";
}
