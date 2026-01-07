import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import * as postsApi from '../lib/api/posts';
import * as scrapingApi from '../lib/api/scraping';
import type { PostInsert, PostUpdate, PostWithCreator } from '../lib/types/database';
import { toast } from 'sonner';
import { campaignsKeys } from './useCampaigns';

// Query keys
export const postsKeys = {
  all: ['posts'] as const,
  lists: () => [...postsKeys.all, 'list'] as const,
  list: (campaignId: string) => [...postsKeys.lists(), campaignId] as const,
  metrics: () => [...postsKeys.all, 'metrics'] as const,
  campaignMetrics: (campaignId: string) => [...postsKeys.metrics(), campaignId] as const,
  timeSeries: (campaignId: string) => [...postsKeys.metrics(), 'timeSeries', campaignId] as const,
};

/**
 * Hook to fetch all posts for a campaign
 */
export function usePosts(campaignId: string) {
  return useQuery({
    queryKey: postsKeys.list(campaignId),
    queryFn: async () => {
      const result = await postsApi.listByCampaign(campaignId);
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

  return useMutation({
    mutationFn: async (post: PostInsert) => {
      const result = await postsApi.create(post);
      if (result.error) {
        throw result.error;
      }
      return result.data;
    },
    onSuccess: (data) => {
      if (data) {
        // Invalidate posts list for this campaign
        queryClient.invalidateQueries({ queryKey: postsKeys.list(data.campaign_id) });
        // Invalidate metrics
        queryClient.invalidateQueries({ queryKey: postsKeys.campaignMetrics(data.campaign_id) });
        // Invalidate campaigns list (to update stats)
        queryClient.invalidateQueries({ queryKey: campaignsKeys.lists() });
        toast.success('Post added successfully');
      }
    },
    onError: (error: Error) => {
      toast.error(`Failed to add post: ${error.message}`);
    },
  });
}

/**
 * Hook to create multiple posts (for CSV import)
 */
export function useCreateManyPosts() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (posts: PostInsert[]) => {
      const result = await postsApi.createMany(posts);
      if (result.error) {
        throw result.error;
      }
      return result.data || [];
    },
    onSuccess: (data, variables) => {
      if (variables.length > 0) {
        const campaignId = variables[0].campaign_id;
        // Invalidate posts list for this campaign
        queryClient.invalidateQueries({ queryKey: postsKeys.list(campaignId) });
        // Invalidate metrics
        queryClient.invalidateQueries({ queryKey: postsKeys.campaignMetrics(campaignId) });
        // Invalidate campaigns list
        queryClient.invalidateQueries({ queryKey: campaignsKeys.lists() });
        toast.success(`${data.length} posts imported successfully`);
      }
    },
    onError: (error: Error) => {
      toast.error(`Failed to import posts: ${error.message}`);
    },
  });
}

/**
 * Hook to update a post
 */
export function useUpdatePost() {
  const queryClient = useQueryClient();

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
      await queryClient.cancelQueries({ queryKey: postsKeys.list(campaignId) });

      // Snapshot previous value
      const previousPosts = queryClient.getQueryData(postsKeys.list(campaignId));

      // Optimistically update posts list
      queryClient.setQueryData(postsKeys.list(campaignId), (old: PostWithCreator[] | undefined) => {
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
        // Invalidate posts list for this campaign
        queryClient.invalidateQueries({ queryKey: postsKeys.list(data.campaign_id) });
        // Invalidate metrics
        queryClient.invalidateQueries({ queryKey: postsKeys.campaignMetrics(data.campaign_id) });
        // Invalidate campaigns list
        queryClient.invalidateQueries({ queryKey: campaignsKeys.lists() });
        toast.success('Post updated successfully');
      }
    },
    onError: (error: Error, _variables, context) => {
      // Rollback optimistic update
      if (context?.previousPosts && context?.campaignId) {
        queryClient.setQueryData(postsKeys.list(context.campaignId), context.previousPosts);
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
      await queryClient.cancelQueries({ queryKey: postsKeys.list(campaignId) });

      // Snapshot previous value
      const previousPosts = queryClient.getQueryData(postsKeys.list(campaignId));

      // Optimistically remove from list
      queryClient.setQueryData(postsKeys.list(campaignId), (old: PostWithCreator[] | undefined) => {
        if (!old) return old;
        return old.filter(post => post.id !== id);
      });

      return { previousPosts, campaignId };
    },
    onSuccess: (campaignId) => {
      // Invalidate posts list for this campaign
      queryClient.invalidateQueries({ queryKey: postsKeys.list(campaignId) });
      // Invalidate metrics
      queryClient.invalidateQueries({ queryKey: postsKeys.campaignMetrics(campaignId) });
      // Invalidate campaigns list
      queryClient.invalidateQueries({ queryKey: campaignsKeys.lists() });
      toast.success('Post deleted successfully');
    },
    onError: (error: Error, _variables, context) => {
      // Rollback optimistic update
      if (context?.previousPosts && context?.campaignId) {
        queryClient.setQueryData(postsKeys.list(context.campaignId), context.previousPosts);
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
      queryClient.invalidateQueries({ queryKey: postsKeys.list(campaignId) });
      // Invalidate metrics
      queryClient.invalidateQueries({ queryKey: postsKeys.campaignMetrics(campaignId) });
      // Invalidate campaigns list
      queryClient.invalidateQueries({ queryKey: campaignsKeys.lists() });
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
          platform: createdPost.platform as 'tiktok' | 'instagram' | 'youtube' | 'twitter' | 'facebook',
        });

        if (scrapeResult.error) {
          // Post was created but scraping failed - return post anyway
          console.warn('Post created but scraping failed:', scrapeResult.error);
          return {
            post: createdPost,
            scraped: false,
            scrapeError: scrapeResult.error.message,
          };
        }

        // Scraping succeeded - update post with metrics
        if (scrapeResult.data?.metrics) {
          const metrics = scrapeResult.data.metrics;
          await postsApi.update(createdPost.id, {
            views: metrics.views,
            likes: metrics.likes,
            comments: metrics.comments,
            shares: metrics.shares,
            engagement_rate: metrics.engagement_rate,
            status: 'scraped',
          });
        }

        return {
          post: createdPost,
          scraped: true,
        };
      } catch (scrapeError) {
        // Post was created but scraping failed - return post anyway
        console.warn('Post created but scraping failed:', scrapeError);
        return {
          post: createdPost,
          scraped: false,
          scrapeError: scrapeError instanceof Error ? scrapeError.message : 'Unknown error',
        };
      }
    },
    onSuccess: (data, variables) => {
      const campaignId = variables.campaign_id;
      
      // Invalidate posts list for this campaign
      queryClient.invalidateQueries({ queryKey: postsKeys.list(campaignId) });
      // Invalidate metrics
      queryClient.invalidateQueries({ queryKey: postsKeys.campaignMetrics(campaignId) });
      // Invalidate campaigns list
      queryClient.invalidateQueries({ queryKey: campaignsKeys.lists() });
      
      if (data.scraped) {
        toast.success('Post added and metrics scraped successfully');
      } else {
        toast.warning(`Post added but scraping failed: ${data.scrapeError || 'Unknown error'}`);
      }
    },
    onError: (error: Error) => {
      toast.error(`Failed to add post: ${error.message}`);
    },
  });
}
