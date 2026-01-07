import type { Platform } from '../types/database';

export interface ParsedURL {
  platform: Platform | null;
  handle: string | null;
  isValid: boolean;
}

/**
 * Extract platform and handle from a social media post URL
 * Supports TikTok, Instagram, YouTube, Twitter/X, and Facebook
 */
export function parsePostURL(url: string): ParsedURL {
  if (!url || typeof url !== 'string') {
    return { platform: null, handle: null, isValid: false };
  }

  try {
    // Normalize URL - add https:// if missing
    let normalizedUrl = url.trim();
    if (!normalizedUrl.startsWith('http://') && !normalizedUrl.startsWith('https://')) {
      normalizedUrl = `https://${normalizedUrl}`;
    }

    const urlObj = new URL(normalizedUrl);
    const hostname = urlObj.hostname.toLowerCase();
    const pathname = urlObj.pathname;

    // TikTok patterns
    if (hostname.includes('tiktok.com')) {
      // Pattern: tiktok.com/@username/video/1234567890
      // Pattern: vm.tiktok.com/ABC123/
      const handleMatch = pathname.match(/@([^/]+)/);
      if (handleMatch) {
        return {
          platform: 'tiktok',
          handle: handleMatch[1],
          isValid: true,
        };
      }
      // For short/share TikTok URLs, we can't extract handle from URL alone
      return {
        platform: 'tiktok',
        handle: null,
        isValid: true,
      };
    }

    // Instagram patterns
    if (hostname.includes('instagram.com')) {
      // Pattern: instagram.com/p/ABC123/ (post)
      // Pattern: instagram.com/reel/ABC123/ (reel)
      // Pattern: instagram.com/username/ (profile)
      // Pattern: instagram.com/username/p/ABC123/ (post from profile)
      const handleMatch = pathname.match(/^\/([^/]+)\//);
      const reservedSegments = ['p', 'reel', 'reels', 'tv', 'stories', 'story', 'share'];
      if (handleMatch && !reservedSegments.includes(handleMatch[1])) {
        return {
          platform: 'instagram',
          handle: handleMatch[1],
          isValid: true,
        };
      }
      // If it's a post URL, we can't extract handle from URL alone
      return {
        platform: 'instagram',
        handle: null,
        isValid: true,
      };
    }

    // YouTube patterns
    if (hostname.includes('youtube.com') || hostname.includes('youtu.be')) {
      // Pattern: youtube.com/watch?v=ABC123
      // Pattern: youtube.com/@channelname/videos
      // Pattern: youtu.be/ABC123
      const handleMatch = pathname.match(/@([^/]+)/);
      if (handleMatch) {
        return {
          platform: 'youtube',
          handle: handleMatch[1],
          isValid: true,
        };
      }
      // For video URLs, we can't extract handle from URL alone
      return {
        platform: 'youtube',
        handle: null,
        isValid: true,
      };
    }

    // Twitter/X patterns
    if (hostname.includes('twitter.com') || hostname.includes('x.com')) {
      // Pattern: twitter.com/username/status/1234567890
      // Pattern: x.com/username/status/1234567890
      const handleMatch = pathname.match(/^\/([^/]+)\//);
      if (handleMatch && handleMatch[1] !== 'status' && handleMatch[1] !== 'i') {
        return {
          platform: 'twitter',
          handle: handleMatch[1],
          isValid: true,
        };
      }
      return {
        platform: 'twitter',
        handle: null,
        isValid: true,
      };
    }

    // Facebook patterns
    if (hostname.includes('facebook.com') || hostname.includes('fb.com')) {
      // Pattern: facebook.com/username/posts/1234567890
      // Pattern: facebook.com/username
      const handleMatch = pathname.match(/^\/([^/]+)/);
      if (handleMatch && !['watch', 'groups', 'pages', 'events'].includes(handleMatch[1])) {
        return {
          platform: 'facebook',
          handle: handleMatch[1],
          isValid: true,
        };
      }
      return {
        platform: 'facebook',
        handle: null,
        isValid: true,
      };
    }

    return { platform: null, handle: null, isValid: false };
  } catch (error) {
    // Invalid URL format
    return { platform: null, handle: null, isValid: false };
  }
}

/**
 * Detect platform from handle format
 * This is a fallback when platform is not specified
 */
export function detectPlatformFromHandle(handle: string): Platform | null {
  if (!handle) return null;

  const normalizedHandle = handle.trim().toLowerCase();

  // TikTok handles often start with @
  if (normalizedHandle.startsWith('@')) {
    // Could be TikTok, but not definitive
    return null; // Require explicit platform
  }

  // YouTube handles start with @
  if (normalizedHandle.startsWith('@')) {
    return 'youtube';
  }

  // Can't reliably detect platform from handle alone
  return null;
}

/**
 * Normalize handle (remove @, lowercase, etc.)
 */
export function normalizeHandle(handle: string): string {
  if (!handle) return '';
  return handle.trim().replace(/^@+/, '').toLowerCase();
}





