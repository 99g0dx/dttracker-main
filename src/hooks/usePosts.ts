import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import * as postsApi from "../lib/api/posts";
import * as scrapingApi from "../lib/api/scraping";
import type {
  PostInsert,
  PostUpdate,
  PostWithCreator,
} from "../lib/types/database";
import { toast } from "sonner";
import { campaignsKeys } from "./useCampaigns";
import { useWorkspace } from "../contexts/WorkspaceContext";

// Query keys
export const postsKeys = {
  all: ["posts"] as const,
  lists: () => [...postsKeys.all, "list"] as const,
  list: (campaignId: string, includeSubcampaigns = false) =>
    [
      ...postsKeys.lists(),
      campaignId,
      includeSubcampaigns ? "hierarchy" : "direct",
    ] as const,
  metrics: () => [...postsKeys.all, "metrics"] as const,
  campaignMetrics: (campaignId: string) =>
    [...postsKeys.metrics(), campaignId] as const,
  timeSeries: (campaignId: string, platform?: string) =>
    [
      ...postsKeys.metrics(),
      "timeSeries",
      campaignId,
      platform ?? "all",
    ] as const,
};

/**
 * Hook to fetch all posts for a campaign
 */
export function usePosts(campaignId: string, includeSubcampaigns = false) {
  return useQuery({
    queryKey: postsKeys.list(campaignId, includeSubcampaigns),
    queryFn: async () => {
      const result = await postsApi.listByCampaignHierarchy(
        campaignId,
        includeSubcampaigns
      );
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
 * @param platform - optional platform to filter by (e.g. 'tiktok', 'instagram'); when omitted, aggregates all platforms
 */
export function useCampaignMetricsTimeSeries(
  campaignId: string,
  platform?: string
) {
  return useQuery({
    queryKey: postsKeys.timeSeries(campaignId, platform),
    queryFn: async () => {
      const result = await postsApi.getCampaignMetricsTimeSeries(
        campaignId,
        platform
      );
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
    onSuccess: (data) => {
      if (data) {
        // Invalidate posts list for this campaign
        queryClient.invalidateQueries({ queryKey: postsKeys.lists() });
        // Invalidate metrics
        queryClient.invalidateQueries({ queryKey: postsKeys.metrics() });
        // Invalidate campaigns list (to update stats)
        queryClient.invalidateQueries({
          queryKey: campaignsKeys.lists(activeWorkspaceId),
        });
        toast.success("Post added successfully");
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
  const { activeWorkspaceId } = useWorkspace();

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
        queryClient.invalidateQueries({ queryKey: postsKeys.lists() });
        // Invalidate metrics
        queryClient.invalidateQueries({ queryKey: postsKeys.metrics() });
        // Invalidate campaigns list
        queryClient.invalidateQueries({
          queryKey: campaignsKeys.lists(activeWorkspaceId),
        });
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
  const { activeWorkspaceId } = useWorkspace();

  return useMutation({
    mutationFn: async ({
      id,
      updates,
      campaignId,
    }: {
      id: string;
      updates: PostUpdate;
      campaignId: string;
    }) => {
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
      const previousPosts = queryClient.getQueryData(
        postsKeys.list(campaignId, false)
      );

      // Optimistically update posts list
      queryClient.setQueryData(
        postsKeys.list(campaignId, false),
        (old: PostWithCreator[] | undefined) => {
          if (!old) return old;
          return old.map((post) =>
            post.id === id
              ? { ...post, ...updates, updated_at: new Date().toISOString() }
              : post
          );
        }
      );

      return { previousPosts, campaignId };
    },
    onSuccess: (data) => {
      if (data) {
        // Invalidate posts list
        queryClient.invalidateQueries({ queryKey: postsKeys.lists() });
        // Invalidate metrics
        queryClient.invalidateQueries({ queryKey: postsKeys.metrics() });
        // Invalidate campaigns list
        queryClient.invalidateQueries({
          queryKey: campaignsKeys.lists(activeWorkspaceId),
        });
        toast.success("Post updated successfully");
      }
    },
    onError: (error: Error, _variables, context) => {
      // Rollback optimistic update
      if (context?.previousPosts && context?.campaignId) {
        queryClient.setQueryData(
          postsKeys.list(context.campaignId, false),
          context.previousPosts
        );
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
    mutationFn: async ({
      id,
      campaignId,
    }: {
      id: string;
      campaignId: string;
    }) => {
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
      const previousPosts = queryClient.getQueryData(
        postsKeys.list(campaignId, false)
      );

      // Optimistically remove from list
      queryClient.setQueryData(
        postsKeys.list(campaignId, false),
        (old: PostWithCreator[] | undefined) => {
          if (!old) return old;
          return old.filter((post) => post.id !== id);
        }
      );

      return { previousPosts, campaignId };
    },
    onSuccess: (campaignId) => {
      // Invalidate posts list for this campaign
      queryClient.invalidateQueries({ queryKey: postsKeys.lists() });
      // Invalidate metrics
      queryClient.invalidateQueries({ queryKey: postsKeys.metrics() });
      // Invalidate campaigns list
      queryClient.invalidateQueries({
        queryKey: campaignsKeys.lists(activeWorkspaceId),
      });
      toast.success("Post deleted successfully");
    },
    onError: (error: Error, _variables, context) => {
      // Rollback optimistic update
      if (context?.previousPosts && context?.campaignId) {
        queryClient.setQueryData(
          postsKeys.list(context.campaignId, false),
          context.previousPosts
        );
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
      queryClient.invalidateQueries({
        queryKey: campaignsKeys.lists(activeWorkspaceId),
      });
      toast.success("All posts deleted successfully");
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
        throw createResult.error || new Error("Failed to create post");
      }

      const createdPost = createResult.data;

      // Step 2: Auto-scrape the post metrics
      try {
        const scrapeResult = await scrapingApi.scrapePost({
          postId: createdPost.id,
          postUrl: createdPost.post_url,
          platform: createdPost.platform as
            | "tiktok"
            | "instagram"
            | "youtube"
            | "twitter"
            | "facebook",
        });

        if (scrapeResult.error) {
          // Post was created but scraping failed - mark for retry by scheduler
          console.warn("Post created but scraping failed:", scrapeResult.error);
          const errMsg = scrapeResult.error.message;
          await postsApi.update(createdPost.id, {
            initial_scrape_attempted: true,
            initial_scrape_failed: true,
            scrape_errors: [
              {
                timestamp: new Date().toISOString(),
                error: errMsg,
                type: "initial_scrape",
              },
            ],
          });
          return {
            post: createdPost,
            scraped: false,
            scrapeError: errMsg,
            creatorMatch: null,
          };
        }

        // Scraping succeeded - update post with metrics and initial scrape flags
        if (scrapeResult.data?.metrics) {
          const metrics = scrapeResult.data.metrics;
          const ownerUsername =
            scrapeResult.data.post?.ownerUsername ??
            scrapeResult.data.metrics?.owner_username ??
            null;
          const now = new Date().toISOString();
          await postsApi.update(createdPost.id, {
            views: metrics.views,
            likes: metrics.likes,
            comments: metrics.comments,
            shares: metrics.shares,
            engagement_rate: metrics.engagement_rate,
            status: "scraped",
            initial_scrape_attempted: true,
            initial_scrape_completed: true,
            initial_scraped_at: now,
            scrape_count: 1,
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
        // Post was created but scraping failed - mark for retry by scheduler
        console.warn("Post created but scraping failed:", scrapeError);
        const errMsg =
          scrapeError instanceof Error ? scrapeError.message : "Unknown error";
        await postsApi.update(createdPost.id, {
          initial_scrape_attempted: true,
          initial_scrape_failed: true,
          scrape_errors: [
            {
              timestamp: new Date().toISOString(),
              error: errMsg,
              type: "initial_scrape",
            },
          ],
        });
        return {
          post: createdPost,
          scraped: false,
          scrapeError: errMsg,
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
      queryClient.invalidateQueries({
        queryKey: campaignsKeys.lists(activeWorkspaceId),
      });

      if (data.scraped) {
        let message = "Post added";
        if (data.ownerUsername) {
          message += `: @${data.ownerUsername}`;
        }
        if (data.creatorMatch?.matched) {
          const creatorLabel =
            data.creatorMatch.creatorName || data.creatorMatch.creatorHandle;
          if (data.creatorMatch.created) {
            message += ` (creator @${creatorLabel} added to campaign)`;
          } else {
            message += ` (matched to ${creatorLabel})`;
          }
        } else if (!data.ownerUsername) {
          message += " and metrics scraped successfully";
        }
        toast.success(message);
      } else {
        const errorMessage = data.scrapeError || "Unknown error";
        // Provide more helpful error messages
        if (
          errorMessage.includes("503") ||
          errorMessage.includes("Service Unavailable")
        ) {
          toast.warning(
            "Post added successfully, but scraping failed temporarily. The TikTok API is currently unavailable. You can retry scraping this post later."
          );
        } else if (
          errorMessage.includes("429") ||
          errorMessage.includes("rate limit")
        ) {
          toast.warning(
            "Post added successfully, but scraping failed due to rate limits. Please wait a moment and retry scraping this post."
          );
        } else if (
          errorMessage.includes("502") ||
          errorMessage.includes("504")
        ) {
          toast.warning(
            "Post added successfully, but scraping failed temporarily due to network issues. You can retry scraping this post later."
          );
        } else if (
          (errorMessage.toLowerCase().includes("apify") ||
            errorMessage.toLowerCase().includes("rapidapi")) &&
          (errorMessage.includes("403") || errorMessage.includes("401"))
        ) {
          toast.warning(
            "Post added successfully, but scraping failed. Check your APIFY_TOKEN in Supabase Edge Function secrets and your Apify account access (paid plan may be required)."
          );
        } else if (
          errorMessage.includes("Unauthorized") ||
          errorMessage.includes("401") ||
          errorMessage.includes("403") ||
          errorMessage.includes("Authentication failed")
        ) {
          // Likely Apify/API 403 misreported as auth - show API config hint
          toast.warning(
            "Post added successfully, but scraping failed. Check your APIFY_TOKEN in Supabase Edge Function secrets and your Apify account access."
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
