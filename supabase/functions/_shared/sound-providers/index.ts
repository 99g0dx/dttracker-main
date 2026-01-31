import type { SoundProvider, Platform } from './base.ts';
import { TikTokProvider } from './tiktok.ts';
import { InstagramProvider } from './instagram.ts';
import { YouTubeProvider } from './youtube.ts';

/**
 * Factory function to create the appropriate sound provider for a platform
 */
export function createProvider(platform: Platform): SoundProvider {
  const apifyToken = Deno.env.get('APIFY_API_TOKEN') || '';
  const rapidApiKey = Deno.env.get('RAPIDAPI_KEY') || undefined;
  const youtubeApiKey = Deno.env.get('YOUTUBE_API_KEY') || '';

  switch (platform) {
    case 'tiktok':
      if (!apifyToken) {
        throw new Error('APIFY_API_TOKEN is required for TikTok provider');
      }
      return new TikTokProvider(apifyToken, rapidApiKey);
    
    case 'instagram':
      return new InstagramProvider(rapidApiKey);
    
    case 'youtube':
      if (!youtubeApiKey) {
        throw new Error('YOUTUBE_API_KEY is required for YouTube provider');
      }
      return new YouTubeProvider(youtubeApiKey);
    
    default:
      throw new Error(`Unsupported platform: ${platform}`);
  }
}

// Re-export types and classes for convenience
export { ProviderError } from './base.ts';
export type { SoundProvider, ResolvedSound, SoundAggregates, SoundPostsResponse, PostMetrics } from './base.ts';
