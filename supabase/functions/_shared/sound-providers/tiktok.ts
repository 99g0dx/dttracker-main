import type {
  SoundProvider,
  ResolvedSound,
  SoundAggregates,
  SoundPostsResponse,
  PostMetrics,
} from './base.ts';
import { ProviderError } from './base.ts';

export class TikTokProvider implements SoundProvider {
  private apifyToken: string;
  private rapidApiKey?: string;

  constructor(apifyToken: string, rapidApiKey?: string) {
    this.apifyToken = apifyToken;
    this.rapidApiKey = rapidApiKey;
  }

  async resolveSoundFromUrl(url: string): Promise<ResolvedSound> {
    // Extract music ID from URL
    let musicId = '';
    
    if (url.includes('/video/') || url.includes('/v/')) {
      // Video URL - would need to fetch video info to get music_id
      // For now, throw error - this should be handled by sound-tracking function
      throw new ProviderError(
        'TikTok video URLs must be resolved via sound-tracking function first',
        'TIKTOK_VIDEO_URL_NOT_SUPPORTED',
        false
      );
    } else {
      // Direct music URL
      const match = url.match(/music\/[^/]+-(\d+)/) || url.match(/music\/(\d+)/);
      musicId = match ? match[1] : '';
    }

    if (!musicId) {
      throw new ProviderError(
        'Could not extract music ID from TikTok URL',
        'TIKTOK_INVALID_URL',
        false
      );
    }

    return {
      platform: 'tiktok',
      soundPlatformId: musicId,
      canonicalSoundUrl: url,
    };
  }

  async getSoundAggregates(soundPlatformId: string): Promise<SoundAggregates> {
    // For TikTok, we can't easily get aggregate stats without scraping
    // Return placeholder - actual scraping happens via Apify webhook
    return {
      totalUses: 0,
      meta: {
        note: 'TikTok aggregate data is collected via Apify scraping, not real-time API',
        soundId: soundPlatformId,
      },
    };
  }

  async listSoundPosts(
    soundPlatformId: string,
    mode: 'top' | 'recent',
    cursor?: string
  ): Promise<SoundPostsResponse> {
    // TikTok post listing is handled via Apify scraping
    throw new ProviderError(
      'TikTok post listing is handled via Apify scraping, not direct API',
      'TIKTOK_SCRAPING_REQUIRED',
      true
    );
  }

  async getPostMetrics(postPlatformId: string): Promise<PostMetrics> {
    // Would need RapidAPI or Apify to get post metrics
    if (!this.rapidApiKey) {
      throw new ProviderError(
        'RAPIDAPI_KEY required for TikTok post metrics',
        'TIKTOK_API_KEY_MISSING',
        false
      );
    }

    // This would call RapidAPI to get video metrics
    // For now, return placeholder
    return {
      views: 0,
      likes: 0,
      comments: 0,
      shares: 0,
      meta: { note: 'Post metrics require RapidAPI integration' },
    };
  }
}
