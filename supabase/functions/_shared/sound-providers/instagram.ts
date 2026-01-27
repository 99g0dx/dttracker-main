import type {
  SoundProvider,
  ResolvedSound,
  SoundAggregates,
  SoundPostsResponse,
  PostMetrics,
} from './base.ts';
import { ProviderError } from './base.ts';

export class InstagramProvider implements SoundProvider {
  private rapidApiKey?: string;

  constructor(rapidApiKey?: string) {
    this.rapidApiKey = rapidApiKey;
  }

  async resolveSoundFromUrl(url: string): Promise<ResolvedSound> {
    // Extract audio ID from Instagram Reel URL
    // This is complex and usually requires scraping
    throw new ProviderError(
      'Instagram sound resolution requires scraping - use sound-tracking function',
      'INSTAGRAM_SCRAPING_REQUIRED',
      false
    );
  }

  async getSoundAggregates(soundPlatformId: string): Promise<SoundAggregates> {
    // Instagram doesn't provide aggregate stats via API
    // Return placeholder - actual data comes from scraping
    return {
      totalUses: 0,
      meta: {
        note: 'Instagram aggregate data is collected via scraping, not real-time API',
        audioId: soundPlatformId,
      },
    };
  }

  async listSoundPosts(
    soundPlatformId: string,
    mode: 'top' | 'recent',
    cursor?: string
  ): Promise<SoundPostsResponse> {
    // Instagram post listing requires scraping
    throw new ProviderError(
      'Instagram post listing requires scraping',
      'INSTAGRAM_SCRAPING_REQUIRED',
      true
    );
  }

  async getPostMetrics(postPlatformId: string): Promise<PostMetrics> {
    // Would need RapidAPI to get Instagram post metrics
    if (!this.rapidApiKey) {
      throw new ProviderError(
        'RAPIDAPI_KEY required for Instagram post metrics',
        'INSTAGRAM_API_KEY_MISSING',
        false
      );
    }

    return {
      views: 0,
      likes: 0,
      comments: 0,
      shares: 0,
      meta: { note: 'Post metrics require RapidAPI integration' },
    };
  }
}
