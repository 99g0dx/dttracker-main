// Provider abstraction for sound tracking across platforms
export type Platform = 'tiktok' | 'instagram' | 'youtube';

export interface ResolvedSound {
  platform: Platform;
  soundPlatformId: string;
  canonicalSoundUrl: string;
  title?: string;
  artist?: string;
  thumbnailUrl?: string;
}

export interface SoundAggregates {
  totalUses: number;
  meta: Record<string, any>;
}

export interface SoundPost {
  postPlatformId: string;
  postUrl: string;
  creatorHandle?: string;
  creatorPlatformId?: string;
  createdAtPlatform?: string;
  metrics?: {
    views?: number;
    likes?: number;
    comments?: number;
    shares?: number;
  };
}

export interface SoundPostsResponse {
  posts: SoundPost[];
  nextCursor?: string;
}

export interface PostMetrics {
  views?: number;
  likes?: number;
  comments?: number;
  shares?: number;
  meta: Record<string, any>;
}

export interface SoundProvider {
  /**
   * Resolve a URL to a canonical sound identifier
   */
  resolveSoundFromUrl(url: string): Promise<ResolvedSound>;

  /**
   * Get aggregate statistics for a sound
   */
  getSoundAggregates(soundPlatformId: string): Promise<SoundAggregates>;

  /**
   * List posts using a sound
   * @param mode 'top' for top posts, 'recent' for recent posts
   */
  listSoundPosts(
    soundPlatformId: string,
    mode: 'top' | 'recent',
    cursor?: string
  ): Promise<SoundPostsResponse>;

  /**
   * Get metrics for a specific post
   */
  getPostMetrics(postPlatformId: string): Promise<PostMetrics>;
}

export class ProviderError extends Error {
  constructor(
    message: string,
    public code: string,
    public isBlocked: boolean = false
  ) {
    super(message);
    this.name = 'ProviderError';
  }
}
