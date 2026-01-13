import type { Platform } from '../types/database';

/**
 * Generates a social media profile URL for a creator based on their handle and platform
 * @param handle - The creator's handle (with or without @ prefix)
 * @param platform - The social media platform
 * @returns The profile URL, or null if the handle is invalid
 */
export function getCreatorProfileUrl(
  handle: string | null | undefined,
  platform: Platform
): string | null {
  // Return null for invalid handles
  if (!handle || typeof handle !== 'string') {
    return null;
  }

  // Sanitize the handle
  const sanitized = handle
    .trim()
    .replace(/^@+/, '') // Remove leading @ symbols
    .trim();

  // Return null if handle is empty after sanitization
  if (!sanitized) {
    return null;
  }

  // URL encode the handle to handle special characters
  const encoded = encodeURIComponent(sanitized);

  // Generate platform-specific URLs
  const platformUrls: Record<Platform, string> = {
    tiktok: `https://www.tiktok.com/@${encoded}`,
    instagram: `https://www.instagram.com/${encoded}`,
    youtube: `https://www.youtube.com/@${encoded}`,
    twitter: `https://twitter.com/${encoded}`,
    facebook: `https://www.facebook.com/${encoded}`,
  };

  return platformUrls[platform] || null;
}
