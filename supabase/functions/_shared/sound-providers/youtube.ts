import type {
  SoundProvider,
  ResolvedSound,
  SoundAggregates,
  SoundPostsResponse,
  PostMetrics,
  ProviderError,
} from './base.ts';

export class YouTubeProvider implements SoundProvider {
  private apiKey: string;

  constructor(apiKey: string) {
    this.apiKey = apiKey;
  }

  async resolveSoundFromUrl(url: string): Promise<ResolvedSound> {
    const expandedUrl = await this.expandUrl(url);
    
    // Extract video ID
    const videoIdMatch = expandedUrl.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/shorts\/)([^&?/]+)/);
    if (!videoIdMatch) {
      throw new ProviderError(
        'Could not extract video ID from YouTube URL',
        'YOUTUBE_INVALID_URL',
        false
      );
    }

    const videoId = videoIdMatch[1];

    try {
      // Fetch video details to get audio info
      const videoInfo = await this.fetchVideoInfo(videoId);
      
      // For YouTube, we use the video ID as the sound identifier
      // since YouTube doesn't have separate "sound" pages like TikTok
      return {
        platform: 'youtube',
        soundPlatformId: videoId, // Using video ID as sound identifier
        canonicalSoundUrl: `https://www.youtube.com/watch?v=${videoId}`,
        title: videoInfo.title || undefined,
        artist: videoInfo.channelTitle || undefined,
      };
    } catch (error) {
      throw new ProviderError(
        `Failed to resolve YouTube sound: ${error instanceof Error ? error.message : 'Unknown error'}`,
        'YOUTUBE_RESOLVE_ERROR',
        false
      );
    }
  }

  async getSoundAggregates(soundPlatformId: string): Promise<SoundAggregates> {
    // YouTube doesn't provide aggregate "uses" count for sounds
    // Return placeholder
    return {
      totalUses: 0,
      meta: { note: 'YouTube aggregate data not available via API' },
    };
  }

  async listSoundPosts(
    soundPlatformId: string,
    mode: 'top' | 'recent',
    cursor?: string
  ): Promise<SoundPostsResponse> {
    // YouTube API doesn't support finding videos by "sound"
    // This would require advanced scraping or different approach
    throw new ProviderError(
      'YouTube post listing by sound not available - API limitations',
      'YOUTUBE_API_LIMITED',
      true
    );
  }

  async getPostMetrics(postPlatformId: string): Promise<PostMetrics> {
    try {
      const videoInfo = await this.fetchVideoInfo(postPlatformId);
      
      return {
        views: parseInt(videoInfo.viewCount || '0', 10),
        likes: parseInt(videoInfo.likeCount || '0', 10),
        comments: parseInt(videoInfo.commentCount || '0', 10),
        shares: 0, // YouTube API doesn't provide share count
        meta: {},
      };
    } catch (error) {
      if (error instanceof ProviderError) throw error;
      throw new ProviderError(
        `Failed to get YouTube post metrics: ${error instanceof Error ? error.message : 'Unknown error'}`,
        'YOUTUBE_METRICS_ERROR',
        false
      );
    }
  }

  private async expandUrl(url: string): Promise<string> {
    try {
      const response = await fetch(url, { method: 'HEAD', redirect: 'follow' });
      return response.url || url;
    } catch {
      return url;
    }
  }

  private async fetchVideoInfo(videoId: string): Promise<{
    title?: string;
    channelTitle?: string;
    viewCount?: string;
    likeCount?: string;
    commentCount?: string;
  }> {
    const response = await fetch(
      `https://www.googleapis.com/youtube/v3/videos?id=${videoId}&part=snippet,statistics&key=${this.apiKey}`
    );

    if (!response.ok) {
      if (response.status === 403) {
        throw new ProviderError(
          'YouTube API quota exceeded or blocked',
          'YOUTUBE_API_BLOCKED',
          true
        );
      }
      throw new Error(`YouTube API error: ${response.status}`);
    }

    const data = await response.json();
    if (!data.items || data.items.length === 0) {
      throw new Error('Video not found');
    }

    const item = data.items[0];
    return {
      title: item.snippet?.title,
      channelTitle: item.snippet?.channelTitle,
      viewCount: item.statistics?.viewCount,
      likeCount: item.statistics?.likeCount,
      commentCount: item.statistics?.commentCount,
    };
  }
}
