import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import * as postsApi from '../lib/api/posts';
import * as scrapingApi from '../lib/api/scraping';
import type { PostInsert, PostUpdate, PostWithCreator } from '../lib/types/database';
import { toast } from 'sonner';
import { campaignsKeys } from './useCampaigns';
import { useWorkspace } from '../contexts/WorkspaceContext';

// Query keys
export const postsKeys = {
  all: ['posts'] as const,
  lists: () => [...postsKeys.all, 'list'] as const,
  list: (campaignId: string, includeSubcampaigns = false) =>
    [...postsKeys.lists(), campaignId, includeSubcampaigns ? 'hierarchy' : 'direct'] as const,
  metrics: () => [...postsKeys.all, 'metrics'] as const,
  campaignMetrics: (campaignId: string) => [...postsKeys.metrics(), campaignId] as const,
  timeSeries: (campaignId: string) => [...postsKeys.metrics(), 'timeSeries', campaignId] as const,
};

/**
 * Hook to fetch all posts for a campaign
 */
export function usePosts(campaignId: string, includeSubcampaigns = false) {
  return useQuery({
    queryKey: postsKeys.list(campaignId, includeSubcampaigns),
    queryFn: async () => {
      const result = await postsApi.listByCampaignHierarchy(campaignId, includeSubcampaigns);
      if (result.error) {
        throw result.error;
      }
      return result.data || [];
    },
    enabled: !!campaignId,
    staleTime: 2 * 60 * 1000, // 2 minutes
  });
}

/**
 * Hook to fetch campaign metrics
 */
export function useCampaignMetrics(campaignId: string) {
  return useQuery({
    queryKey: postsKeys.campaignMetrics(campaignId),
    queryFn: async () => {
      const result = await postsApi.getCampaignMetrics(campaignId);
      if (result.error) {
        throw result.error;
      }
      return result.data;
    },
    enabled: !!campaignId,
    staleTime: 2 * 60 * 1000, // 2 minutes
  });
}

/**
 * Hook to fetch time-series metrics for charts
 */
export function useCampaignMetricsTimeSeries(campaignId: string) {
  return useQuery({
    queryKey: postsKeys.timeSeries(campaignId),
    queryFn: async () => {
      const result = await postsApi.getCampaignMetricsTimeSeries(campaignId);
      if (result.error) {
        throw result.error;
      }
      return result.data || [];
    },
    enabled: !!campaignId,
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
}

/**
 * Hook to create a single post
 */
export function useCreatePost() {
  const queryClient = useQueryClient();
  const { activeWorkspaceId } = useWorkspace();

  return useMutation({
    mutationFn: async (post: PostInsert) => {
      const result = await postsApi.create(post);
      if (result.error) {
        throw result.error;
      }
      return result.data;
    },
    onMutate: async (post) => {
      await queryClient.cancelQueries({ queryKey: postsKeys.list(post.campaign_id, false) });
      await queryClient.cancelQueries({ queryKey: postsKeys.list(post.campaign_id, true) });

      const nowIso = new Date().toISOString();
      const tempId =
        typeof crypto !== 'undefined' && crypto.randomUUID
          ? crypto.randomUUID()
          : `temp_${Math.random().toString(36).slice(2)}`;

      const optimisticPost: PostWithCreator = {
        id: tempId,
        campaign_id: post.campaign_id,
        creator_id: post.creator_id ?? null,
        platform: post.platform,
        post_url: post.post_url,
        posted_date: post.posted_date ?? null,
        status: post.status ?? 'manual',
        views: post.views ?? 0,
        likes: post.likes ?? 0,
        comments: post.comments ?? 0,
        shares: post.shares ?? 0,
        engagement_rate: post.engagement_rate ?? 0,
        last_scraped_at: null,
        created_at: nowIso,
        updated_at: nowIso,
        external_id: post.external_id ?? null,
        owner_username: post.owner_username ?? null,
        creator: null,
      };

      const applyOptimistic = (key: ReturnType<typeof postsKeys.list>) => {
        const previous = queryClient.getQueryData<PostWithCreator[]>(key) || [];
        queryClient.setQueryData<PostWithCreator[]>(key, [optimisticPost, ...previous]);
        return previous;
      };

      const previousDirect = applyOptimistic(postsKeys.list(post.campaign_id, false));
      const previousHierarchy = applyOptimistic(postsKeys.list(post.campaign_id, true));

      return { previousDirect, previousHierarchy, campaignId: post.campaign_id };
    },
    onSuccess: (data) => {
      if (data) {
        // Invalidate posts list for this campaign
        queryClient.invalidateQueries({ queryKey: postsKeys.lists() });
        // Invalidate metrics
        queryClient.invalidateQueries({ queryKey: postsKeys.metrics() });
        // Invalidate campaigns list (to update stats)
        queryClient.invalidateQueries({ queryKey: campaignsKeys.lists(activeWorkspaceId) });
        toast.success('Post added successfully');
      }
    },
    onError: (error: Error, _post, context) => {
      if (context?.campaignId) {
        queryClient.setQueryData(
          postsKeys.list(context.campaignId, false),
          context.previousDirect || []
        );
        queryClient.setQueryData(
          postsKeys.list(context.campaignId, true),
          context.previousHierarchy || []
        );
      }
      toast.error(`Failed to add post: ${error.message}`);
    },
  });
}

/**
 * Hook to create multiple posts (for CSV import)
 */
export function useCreateManyPosts() {
  const queryClient = useQueryClient();
  const { activeWorkspaceId } = useWorkspace();

  return useMutation({
    mutationFn: async (posts: PostInsert[]) => {
      const result = await postsApi.createMany(posts);
      if (result.error) {
        throw result.error;
      }
      return result.data || [];
    },
    onMutate: async (posts) => {
      if (posts.length === 0) return;
      const campaignId = posts[0].campaign_id;
      await queryClient.cancelQueries({ queryKey: postsKeys.list(campaignId, false) });
      await queryClient.cancelQueries({ queryKey: postsKeys.list(campaignId, true) });

      const nowIso = new Date().toISOString();
      const optimisticPosts: PostWithCreator[] = posts.map((post) => ({
        id:
          typeof crypto !== 'undefined' && crypto.randomUUID
            ? crypto.randomUUID()
            : `temp_${Math.random().toString(36).slice(2)}`,
        campaign_id: post.campaign_id,
        creator_id: post.creator_id ?? null,
        platform: post.platform,
        post_url: post.post_url,
        posted_date: post.posted_date ?? null,
        status: post.status ?? 'manual',
        views: post.views ?? 0,
        likes: post.likes ?? 0,
        comments: post.comments ?? 0,
        shares: post.shares ?? 0,
        engagement_rate: post.engagement_rate ?? 0,
        last_scraped_at: null,
        created_at: nowIso,
        updated_at: nowIso,
        external_id: post.external_id ?? null,
        owner_username: post.owner_username ?? null,
        creator: null,
      }));

      const applyOptimistic = (key: ReturnType<typeof postsKeys.list>) => {
        const previous = queryClient.getQueryData<PostWithCreator[]>(key) || [];
        queryClient.setQueryData<PostWithCreator[]>(key, [
          ...optimisticPosts,
          ...previous,
        ]);
        return previous;
      };

      const previousDirect = applyOptimistic(postsKeys.list(campaignId, false));
      const previousHierarchy = applyOptimistic(postsKeys.list(campaignId, true));

      return { previousDirect, previousHierarchy, campaignId };
    },
    onSuccess: (data, variables) => {
      if (variables.length > 0) {
        const campaignId = variables[0].campaign_id;
        // Invalidate posts list for this campaign
        queryClient.invalidateQueries({ queryKey: postsKeys.lists() });
        // Invalidate metrics
        queryClient.invalidateQueries({ queryKey: postsKeys.metrics() });
        // Invalidate campaigns list
        queryClient.invalidateQueries({ queryKey: campaignsKeys.lists(activeWorkspaceId) });
        toast.success(`${data.length} posts imported successfully`);
      }
    },
    onError: (error: Error, _posts, context) => {
      if (context?.campaignId) {
        queryClient.setQueryData(
          postsKeys.list(context.campaignId, false),
          context.previousDirect || []
        );
        queryClient.setQueryData(
          postsKeys.list(context.campaignId, true),
          context.previousHierarchy || []
        );
      }
      toast.error(`Failed to import posts: ${error.message}`);
    },
  });
}

/**
 * Hook to update a post
 */
export function useUpdatePost() {
  const queryClient = useQueryClient();
  const { activeWorkspaceId } = useWorkspace();

  return useMutation({
    mutationFn: async ({ id, updates, campaignId }: { id: string; updates: PostUpdate; campaignId: string }) => {
      const result = await postsApi.update(id, updates);
      if (result.error) {
        throw result.error;
      }
      return result.data;
    },
    onMutate: async ({ id, updates, campaignId }) => {
      // Cancel outgoing refetches
      await queryClient.cancelQueries({ queryKey: postsKeys.lists() });

      // Snapshot previous value
      const previousPosts = queryClient.getQueryData(postsKeys.list(campaignId, false));

      // Optimistically update posts list
      queryClient.setQueryData(postsKeys.list(campaignId, false), (old: PostWithCreator[] | undefined) => {
        if (!old) return old;
        return old.map(post =>
          post.id === id
            ? { ...post, ...updates, updated_at: new Date().toISOString() }
            : post
        );
      });

      return { previousPosts, campaignId };
    },
    onSuccess: (data) => {
      if (data) {
        // Invalidate posts list
        queryClient.invalidateQueries({ queryKey: postsKeys.lists() });
        // Invalidate metrics
        queryClient.invalidateQueries({ queryKey: postsKeys.metrics() });
        // Invalidate campaigns list
        queryClient.invalidateQueries({ queryKey: campaignsKeys.lists(activeWorkspaceId) });
        toast.success('Post updated successfully');
      }
    },
    onError: (error: Error, _variables, context) => {
      // Rollback optimistic update
      if (context?.previousPosts && context?.campaignId) {
        queryClient.setQueryData(postsKeys.list(context.campaignId, false), context.previousPosts);
      }
      toast.error(`Failed to update post: ${error.message}`);
    },
  });
}

/**
 * Hook to delete a post
 */
export function useDeletePost() {
  const queryClient = useQueryClient();
  const { activeWorkspaceId } = useWorkspace();

  return useMutation({
    mutationFn: async ({ id, campaignId }: { id: string; campaignId: string }) => {
      const result = await postsApi.deletePost(id);
      if (result.error) {
        throw result.error;
      }
      return campaignId;
    },
    onMutate: async ({ id, campaignId }) => {
      // Cancel outgoing refetches
      await queryClient.cancelQueries({ queryKey: postsKeys.lists() });

      // Snapshot previous value
      const previousPosts = queryClient.getQueryData(postsKeys.list(campaignId, false));

      // Optimistically remove from list
      queryClient.setQueryData(postsKeys.list(campaignId, false), (old: PostWithCreator[] | undefined) => {
        if (!old) return old;
        return old.filter(post => post.id !== id);
      });

      return { previousPosts, campaignId };
    },
    onSuccess: (campaignId) => {
      // Invalidate posts list for this campaign
      queryClient.invalidateQueries({ queryKey: postsKeys.lists() });
      // Invalidate metrics
      queryClient.invalidateQueries({ queryKey: postsKeys.metrics() });
      // Invalidate campaigns list
      queryClient.invalidateQueries({ queryKey: campaignsKeys.lists(activeWorkspaceId) });
      toast.success('Post deleted successfully');
    },
    onError: (error: Error, _variables, context) => {
      // Rollback optimistic update
      if (context?.previousPosts && context?.campaignId) {
        queryClient.setQueryData(postsKeys.list(context.campaignId, false), context.previousPosts);
      }
      toast.error(`Failed to delete post: ${error.message}`);
    },
  });
}

/**
 * Hook to delete all posts in a campaign
 */
export function useDeleteAllPosts() {
  const queryClient = useQueryClient();
  const { activeWorkspaceId } = useWorkspace();

  return useMutation({
    mutationFn: async (campaignId: string) => {
      const result = await postsApi.deleteAllInCampaign(campaignId);
      if (result.error) {
        throw result.error;
      }
      return campaignId;
    },
    onSuccess: (campaignId) => {
      // Invalidate posts list for this campaign
      queryClient.invalidateQueries({ queryKey: postsKeys.lists() });
      // Invalidate metrics
      queryClient.invalidateQueries({ queryKey: postsKeys.metrics() });
      // Invalidate campaigns list
      queryClient.invalidateQueries({ queryKey: campaignsKeys.lists(activeWorkspaceId) });
      toast.success('All posts deleted successfully');
    },
    onError: (error: Error) => {
      toast.error(`Failed to delete posts: ${error.message}`);
    },
  });
}

/**
 * Hook to add a post and automatically scrape its metrics
 * This combines post creation with scraping in a single operation
 */
export function useAddPostWithScrape() {
  const queryClient = useQueryClient();
  const { activeWorkspaceId } = useWorkspace();

  return useMutation({
    mutationFn: async (post: PostInsert) => {
      // Step 1: Create the post
      const createResult = await postsApi.create(post);
      if (createResult.error || !createResult.data) {
        throw createResult.error || new Error('Failed to create post');
      }

      const createdPost = createResult.data;

      // Step 2: Auto-scrape the post metrics
      try {
        const scrapeResult = await scrapingApi.scrapePost({
          postId: createdPost.id,
          postUrl: createdPost.post_url,
          platform: createdPost.platform as 'tiktok' | 'instagram' | 'youtube',
        });

        if (scrapeResult.error) {
          // Post was created but scraping failed - return post anyway
          console.warn('Post created but scraping failed:', scrapeResult.error);
          return {
            post: createdPost,
            scraped: false,
            scrapeError: scrapeResult.error.message,
            creatorMatch: null,
          };
        }

        // Scraping succeeded - update post with metrics
        if (scrapeResult.data?.metrics) {
          const metrics = scrapeResult.data.metrics;
          const ownerUsername =
            scrapeResult.data.post?.ownerUsername ??
            scrapeResult.data.metrics?.owner_username ??
            null;
          await postsApi.update(createdPost.id, {
            views: metrics.views,
            likes: metrics.likes,
            comments: metrics.comments,
            shares: metrics.shares,
            engagement_rate: metrics.engagement_rate,
            status: 'scraped',
            ...(ownerUsername && { owner_username: ownerUsername }),
          });
        }

        return {
          post: createdPost,
          scraped: true,
          ownerUsername:
            scrapeResult.data?.post?.ownerUsername ||
            scrapeResult.data?.metrics?.owner_username ||
            null,
          creatorMatch: scrapeResult.data?.creatorMatch || null,
        };
      } catch (scrapeError) {
        // Post was created but scraping failed - return post anyway
        console.warn('Post created but scraping failed:', scrapeError);
        return {
          post: createdPost,
          scraped: false,
          scrapeError: scrapeError instanceof Error ? scrapeError.message : 'Unknown error',
          ownerUsername: null,
          creatorMatch: null,
        };
      }
    },
    onSuccess: (data, variables) => {
      const campaignId = variables.campaign_id;
      
      // Invalidate posts list for this campaign
      queryClient.invalidateQueries({ queryKey: postsKeys.lists() });
      // Invalidate metrics
      queryClient.invalidateQueries({ queryKey: postsKeys.metrics() });
      // Invalidate campaigns list
      queryClient.invalidateQueries({ queryKey: campaignsKeys.lists(activeWorkspaceId) });
      
      if (data.scraped) {
        let message = 'Post added';
        if (data.ownerUsername) {
          message += `: @${data.ownerUsername}`;
        }
        if (data.creatorMatch?.matched) {
          const creatorLabel = data.creatorMatch.creatorName || data.creatorMatch.creatorHandle;
          if (data.creatorMatch.created) {
            message += ` (creator @${creatorLabel} added to campaign)`;
          } else {
            message += ` (matched to ${creatorLabel})`;
          }
        } else if (!data.ownerUsername) {
          message += ' and metrics scraped successfully';
        }
        toast.success(message);
      } else {
        const errorMessage = data.scrapeError || 'Unknown error';
        // Provide more helpful error messages
        if (errorMessage.includes('503') || errorMessage.includes('Service Unavailable')) {
          toast.warning(
            'Post added successfully, but scraping failed temporarily. The TikTok API is currently unavailable. You can retry scraping this post later.'
          );
        } else if (errorMessage.includes('429') || errorMessage.includes('rate limit')) {
          toast.warning(
            'Post added successfully, but scraping failed due to rate limits. Please wait a moment and retry scraping this post.'
          );
        } else if (errorMessage.includes('502') || errorMessage.includes('504')) {
          toast.warning(
            'Post added successfully, but scraping failed temporarily due to network issues. You can retry scraping this post later.'
          );
        } else {
          toast.warning(`Post added but scraping failed: ${errorMessage}`);
        }
      }
    },
    onError: (error: Error) => {
      toast.error(`Failed to add post: ${error.message}`);
    },
  });
}
