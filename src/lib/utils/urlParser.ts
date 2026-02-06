import type { Platform } from "../types/database";

export interface ParsedURL {
  platform: Platform | null;
  handle: string | null;
  isValid: boolean;
  /** For Instagram posts/reels: the shortcode extracted from the URL */
  shortcode?: string;
  /** For Instagram: the type of content (p = post, reel, tv) */
  instagramType?: "p" | "reel" | "tv";
  /** For TikTok: the video ID extracted from the URL */
  videoId?: string;
  /** Error message if URL is invalid or unsupported */
  error?: string;
  /** Whether this is a profile URL (not a post URL) */
  isProfileUrl?: boolean;
}

/**
 * Normalize a URL: trim whitespace, ensure https scheme, strip surrounding punctuation
 */
export function normalizeUrl(input: string): string {
  if (!input || typeof input !== "string") return "";

  let url = input.trim();

  // Strip surrounding quotes or punctuation
  url = url.replace(/^["'<>]+|["'<>]+$/g, "");

  // Add https:// if missing
  if (!url.startsWith("http://") && !url.startsWith("https://")) {
    url = `https://${url}`;
  }

  return url;
}

/**
 * Detect platform from URL hostname
 */
export function detectPlatform(url: string): Platform | "unknown" {
  try {
    const normalizedUrl = normalizeUrl(url);
    const urlObj = new URL(normalizedUrl);
    const hostname = urlObj.hostname.toLowerCase();

    if (hostname.includes("tiktok.com")) return "tiktok";
    if (hostname.includes("instagram.com")) return "instagram";
    if (hostname.includes("youtube.com") || hostname.includes("youtu.be"))
      return "youtube";
    if (hostname.includes("twitter.com") || hostname.includes("x.com"))
      return "twitter";
    if (hostname.includes("facebook.com") || hostname.includes("fb.com"))
      return "facebook";

    return "unknown";
  } catch {
    return "unknown";
  }
}

/**
 * Parse TikTok URL to extract video ID and username
 */
export function parseTikTokUrl(url: string): {
  videoId: string | null;
  username: string | null;
} {
  try {
    const normalizedUrl = normalizeUrl(url);
    const urlObj = new URL(normalizedUrl);
    const pathname = urlObj.pathname;

    // Extract username from @username pattern
    const usernameMatch = pathname.match(/@([^/]+)/);
    const username = usernameMatch ? usernameMatch[1] : null;

    // Extract video ID from /video/1234567890 pattern
    const videoIdMatch = pathname.match(/\/video\/(\d+)/);
    const videoId = videoIdMatch ? videoIdMatch[1] : null;

    return { videoId, username };
  } catch {
    return { videoId: null, username: null };
  }
}

/**
 * Parse Instagram URL to extract shortcode and content type
 * Supports:
 * - https://www.instagram.com/p/<shortcode>/
 * - https://www.instagram.com/reel/<shortcode>/
 * - https://www.instagram.com/tv/<shortcode>/
 * - URLs with query params like ?igsh=...
 */
export function parseInstagramUrl(url: string): {
  shortcode: string | null;
  type: "p" | "reel" | "tv" | null;
  isProfileUrl: boolean;
  username: string | null;
} {
  try {
    const normalizedUrl = normalizeUrl(url);
    const urlObj = new URL(normalizedUrl);
    const pathname = urlObj.pathname;

    // Check for post/reel/tv patterns: /p/ABC123/, /reel/ABC123/, /tv/ABC123/
    const postMatch = pathname.match(/^\/(p|reel|tv)\/([A-Za-z0-9_-]+)/);
    if (postMatch) {
      return {
        shortcode: postMatch[2],
        type: postMatch[1] as "p" | "reel" | "tv",
        isProfileUrl: false,
        username: null,
      };
    }

    // Check for profile URL: /username/ (but not reserved paths)
    const reservedPaths = [
      "p",
      "reel",
      "reels",
      "tv",
      "stories",
      "story",
      "share",
      "explore",
      "direct",
      "accounts",
      "about",
      "legal",
      "privacy",
      "terms",
    ];
    const profileMatch = pathname.match(/^\/([A-Za-z0-9._]+)\/?$/);
    if (
      profileMatch &&
      !reservedPaths.includes(profileMatch[1].toLowerCase())
    ) {
      return {
        shortcode: null,
        type: null,
        isProfileUrl: true,
        username: profileMatch[1],
      };
    }

    // Check for username/p/shortcode pattern (from profile page link)
    const profilePostMatch = pathname.match(
      /^\/([A-Za-z0-9._]+)\/(p|reel|tv)\/([A-Za-z0-9_-]+)/
    );
    if (profilePostMatch) {
      return {
        shortcode: profilePostMatch[3],
        type: profilePostMatch[2] as "p" | "reel" | "tv",
        isProfileUrl: false,
        username: profilePostMatch[1],
      };
    }

    return { shortcode: null, type: null, isProfileUrl: false, username: null };
  } catch {
    return { shortcode: null, type: null, isProfileUrl: false, username: null };
  }
}

/**
 * Extract platform and handle from a social media post URL
 * Supports TikTok, Instagram, YouTube, Twitter/X, and Facebook
 */
export function parsePostURL(url: string): ParsedURL {
  if (!url || typeof url !== "string") {
    return {
      platform: null,
      handle: null,
      isValid: false,
      error: "No URL provided",
    };
  }

  try {
    const normalizedUrl = normalizeUrl(url);
    const urlObj = new URL(normalizedUrl);
    const hostname = urlObj.hostname.toLowerCase();
    const pathname = urlObj.pathname;

    // TikTok patterns
    if (hostname.includes("tiktok.com")) {
      const { videoId, username } = parseTikTokUrl(normalizedUrl);

      return {
        platform: "tiktok",
        handle: username,
        isValid: true,
        videoId: videoId || undefined,
      };
    }

    // Instagram patterns
    if (hostname.includes("instagram.com")) {
      const igResult = parseInstagramUrl(normalizedUrl);

      // If it's a profile URL, return error
      if (igResult.isProfileUrl) {
        return {
          platform: "instagram",
          handle: igResult.username,
          isValid: false,
          isProfileUrl: true,
          error:
            "This looks like a profile link. Paste a specific post or reel link instead.",
        };
      }

      // If we found a shortcode, it's a valid post/reel URL
      if (igResult.shortcode) {
        return {
          platform: "instagram",
          handle: igResult.username,
          isValid: true,
          shortcode: igResult.shortcode,
          instagramType: igResult.type || undefined,
        };
      }

      // Instagram URL but couldn't parse - might be invalid format
      return {
        platform: "instagram",
        handle: null,
        isValid: false,
        error: "Paste a valid Instagram post or reel link.",
      };
    }

    // YouTube patterns
    if (hostname.includes("youtube.com") || hostname.includes("youtu.be")) {
      const searchParams = urlObj.searchParams;
      // Pattern: youtube.com/watch?v=ABC123
      const watchVideoId = searchParams.get("v");
      // Pattern: youtu.be/ABC123
      const shortVideoId = hostname.includes("youtu.be")
        ? (pathname.match(/^\/([^/?#]+)/)?.[1] ?? null)
        : null;
      // Pattern: youtube.com/shorts/ABC123, /embed/ABC123, /v/ABC123
      const shortsMatch = pathname.match(
        /^\/shorts\/([A-Za-z0-9_-]{11})(?:[/?]|$)/
      );
      const embedMatch = pathname.match(
        /^\/embed\/([A-Za-z0-9_-]{11})(?:[/?]|$)/
      );
      const vPathMatch = pathname.match(/^\/v\/([A-Za-z0-9_-]{11})(?:[/?]|$)/);
      const videoId =
        watchVideoId ||
        shortVideoId ||
        shortsMatch?.[1] ||
        embedMatch?.[1] ||
        vPathMatch?.[1] ||
        null;

      // Pattern: youtube.com/@channelname/videos
      const handleMatch = pathname.match(/@([^/]+)/);
      if (handleMatch) {
        return {
          platform: "youtube",
          handle: handleMatch[1],
          isValid: true,
          videoId: videoId || undefined,
        };
      }
      // For video URLs (watch?v= or youtu.be), we can't extract handle from URL alone
      return {
        platform: "youtube",
        handle: null,
        isValid: true,
        videoId: videoId || undefined,
      };
    }

    // Twitter/X patterns
    if (hostname.includes("twitter.com") || hostname.includes("x.com")) {
      // Pattern: twitter.com/username/status/1234567890
      // Pattern: x.com/username/status/1234567890
      const handleMatch = pathname.match(/^\/([^/]+)\//);
      if (
        handleMatch &&
        handleMatch[1] !== "status" &&
        handleMatch[1] !== "i"
      ) {
        return {
          platform: "twitter",
          handle: handleMatch[1],
          isValid: true,
        };
      }
      return {
        platform: "twitter",
        handle: null,
        isValid: true,
      };
    }

    // Facebook patterns
    if (hostname.includes("facebook.com") || hostname.includes("fb.com")) {
      // Pattern: facebook.com/username/posts/1234567890
      // Pattern: facebook.com/username
      const handleMatch = pathname.match(/^\/([^/]+)/);
      if (
        handleMatch &&
        !["watch", "groups", "pages", "events"].includes(handleMatch[1])
      ) {
        return {
          platform: "facebook",
          handle: handleMatch[1],
          isValid: true,
        };
      }
      return {
        platform: "facebook",
        handle: null,
        isValid: true,
      };
    }

    return {
      platform: null,
      handle: null,
      isValid: false,
      error: "Unsupported link. Paste a TikTok or Instagram post link.",
    };
  } catch (error) {
    // Invalid URL format
    return {
      platform: null,
      handle: null,
      isValid: false,
      error: "Invalid URL format",
    };
  }
}

/**
 * Detect platform from handle format
 * This is a fallback when platform is not specified
 */
export function detectPlatformFromHandle(handle: string): Platform | null {
  if (!handle) return null;

  // Can't reliably detect platform from handle alone
  return null;
}

/**
 * Normalize handle (remove @, lowercase, etc.)
 */
export function normalizeHandle(handle: string): string {
  if (!handle) return "";
  return handle.trim().replace(/^@+/, "").toLowerCase();
}

/**
 * Get external ID for a post based on platform
 * - TikTok: video ID
 * - Instagram: shortcode
 * - YouTube: video ID
 * - Twitter: tweet ID
 * - Facebook: post ID
 */
export function getExternalIdFromUrl(
  url: string,
  platform: Platform
): string | null {
  try {
    const normalizedUrl = normalizeUrl(url);
    const urlObj = new URL(normalizedUrl);
    const pathname = urlObj.pathname;

    switch (platform) {
      case "tiktok": {
        const { videoId } = parseTikTokUrl(normalizedUrl);
        return videoId;
      }
      case "instagram": {
        const { shortcode } = parseInstagramUrl(normalizedUrl);
        return shortcode;
      }
      case "youtube": {
        // youtube.com/watch?v=VIDEO_ID, youtu.be/VIDEO_ID, youtube.com/shorts/VIDEO_ID, embed, v/
        const searchParams = urlObj.searchParams;
        if (searchParams.has("v")) {
          return searchParams.get("v");
        }
        if (urlObj.hostname.includes("youtu.be")) {
          const match = pathname.match(/^\/([^/?#]+)/);
          return match ? match[1] : null;
        }
        const shortsMatch = pathname.match(
          /^\/shorts\/([A-Za-z0-9_-]{11})(?:[/?]|$)/
        );
        if (shortsMatch) return shortsMatch[1];
        const embedMatch = pathname.match(
          /^\/embed\/([A-Za-z0-9_-]{11})(?:[/?]|$)/
        );
        if (embedMatch) return embedMatch[1];
        const vMatch = pathname.match(/^\/v\/([A-Za-z0-9_-]{11})(?:[/?]|$)/);
        if (vMatch) return vMatch[1];
        return null;
      }
      case "twitter": {
        // twitter.com/username/status/TWEET_ID
        const match = pathname.match(/\/status\/(\d+)/);
        return match ? match[1] : null;
      }
      case "facebook": {
        // Various Facebook URL patterns
        const postMatch = pathname.match(/\/posts\/(\d+)/);
        if (postMatch) return postMatch[1];
        const photoMatch = pathname.match(/\/photo(?:\.php)?\?.*fbid=(\d+)/);
        if (photoMatch) return photoMatch[1];
        return null;
      }
      default:
        return null;
    }
  } catch {
    return null;
  }
}
