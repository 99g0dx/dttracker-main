import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import * as scrapingApi from "../lib/api/scraping";
import { postsKeys } from "./usePosts";
import { campaignsKeys } from "./useCampaigns";
import { addNotification } from "../lib/utils/notifications";
import { subcampaignsKeys } from "./useSubcampaigns";
import { useWorkspace } from "../contexts/WorkspaceContext";

/**
 * Hook to scrape a single post
 */
export function useScrapePost() {
  const queryClient = useQueryClient();
  const { activeWorkspaceId } = useWorkspace();

  return useMutation({
    mutationFn: async (params: {
      postId: string;
      postUrl: string;
      platform: "tiktok" | "instagram" | "youtube" | "twitter" | "facebook";
      campaignId: string;
    }) => {
      const result = await scrapingApi.scrapePost({
        postId: params.postId,
        postUrl: params.postUrl,
        platform: params.platform,
      });

      if (result.error) {
        throw result.error;
      }

      return { ...result.data, campaignId: params.campaignId };
    },
    onSuccess: async (data, variables) => {
      // Refetch related queries to update the UI immediately
      await Promise.all([
        queryClient.refetchQueries({
          queryKey: postsKeys.lists(),
        }),
        queryClient.refetchQueries({
          queryKey: postsKeys.metrics(),
        }),
        queryClient.refetchQueries({ queryKey: subcampaignsKeys.all }),
        queryClient.refetchQueries({
          queryKey: campaignsKeys.lists(activeWorkspaceId),
        }),
      ]);

      toast.success("Post scraped successfully");

      // Add notification for post scraped
      // Try to get post data from cache before invalidation, or use a simple message
      const posts = queryClient.getQueryData(
        postsKeys.list(variables.campaignId, false)
      ) as any[];
      const post = posts?.find((p: any) => p.id === variables.postId);
      const creatorName = post?.creator?.name || "A post";

      addNotification({
        type: "post_scraped",
        title: "Post scraped successfully",
        message: `${creatorName}'s post has been scraped and metrics updated.`,
      });
    },
    onError: (error: Error) => {
      let errorMessage = error.message;

      // Provide more helpful error messages
      if (
        errorMessage.includes("Failed to send a request to the Edge Function")
      ) {
        errorMessage =
          "Cannot reach the scraping service. Check that Edge Functions (scrape-post / scrape-all-posts) are deployed and your Supabase URL is correct.";
      } else if (
        errorMessage.includes("non-2xx") ||
        errorMessage.includes("Edge Function returned")
      ) {
        errorMessage =
          "Scraping service error. The post may be unavailable or the scraping service is temporarily down. Please try again in a moment.";
      } else if (
        errorMessage.includes("API error") ||
        errorMessage.includes("RAPIDAPI_KEY") ||
        errorMessage.includes("APIFY_TOKEN")
      ) {
        errorMessage =
          "Scraping service not configured. Please check if API keys (RAPIDAPI_KEY, APIFY_TOKEN) are set in Supabase Edge Function secrets.";
      } else if (
        errorMessage.includes("Unauthorized") ||
        errorMessage.includes("401") ||
        errorMessage.includes("403")
      ) {
        errorMessage =
          "Authentication failed. Please try logging in again or refresh the page.";
      } else if (
        errorMessage.includes("Invalid") ||
        errorMessage.includes("Unable to extract")
      ) {
        errorMessage =
          "Invalid post URL or format. Please check the URL and try again.";
      } else if (
        errorMessage.includes("Network") ||
        errorMessage.includes("Failed to fetch")
      ) {
        errorMessage =
          "Network error. Please check your connection and try again.";
      } else if (errorMessage.includes("Platform not available")) {
        errorMessage =
          "This platform is not available on your current plan. Please upgrade to scrape this platform.";
      } else if (errorMessage.includes("Scrape interval not met")) {
        errorMessage = "Please wait a moment before scraping this post again.";
      } else if (errorMessage.includes("currently being scraped")) {
        errorMessage =
          "This post is already being scraped. Please wait for it to complete.";
      } else if (errorMessage.includes("Post not found")) {
        errorMessage = "Post not found. The post may have been deleted.";
      } else if (errorMessage.includes("Server configuration error")) {
        errorMessage =
          "Server configuration error. Please contact support if this persists.";
      }

      toast.error(`Failed to scrape post: ${errorMessage}`);
    },
  });
}

/**
 * Hook to scrape all posts in a campaign
 */
export function useScrapeAllPosts() {
  const queryClient = useQueryClient();
  const { activeWorkspaceId } = useWorkspace();

  return useMutation({
    mutationFn: async (campaignId: string) => {
      const result = await scrapingApi.scrapeAllPosts(campaignId);

      if (result.error) {
        throw result.error;
      }

      return { ...result.data, campaignId };
    },
    onSuccess: async (data) => {
      const { success_count, error_count, campaignId } = data;

      // Refetch related queries to update the UI immediately
      await Promise.all([
        queryClient.refetchQueries({ queryKey: postsKeys.lists() }),
        queryClient.refetchQueries({
          queryKey: postsKeys.metrics(),
        }),
        queryClient.refetchQueries({ queryKey: subcampaignsKeys.all }),
        queryClient.refetchQueries({
          queryKey: campaignsKeys.lists(activeWorkspaceId),
        }),
      ]);

      // Get campaign name for notification
      const campaigns = queryClient.getQueryData(
        campaignsKeys.lists(activeWorkspaceId)
      ) as any[];
      const campaign = campaigns?.find((c: any) => c.id === campaignId);
      const campaignName = campaign?.name || "Campaign";

      // Show success/error message with details
      if (error_count === 0) {
        toast.success(
          `Successfully scraped ${success_count} post${
            success_count !== 1 ? "s" : ""
          }`
        );

        // Add notification for bulk scraping complete
        addNotification({
          type: "bulk_scraped",
          title: "All posts scraped",
          message: `All ${success_count} post${
            success_count !== 1 ? "s" : ""
          } in "${campaignName}" have been scraped successfully.`,
        });
      } else if (success_count === 0) {
        const errorDetails =
          data.errors && data.errors.length > 0
            ? `\nFirst error: ${data.errors[0].message}`
            : "";
        toast.error(
          `Failed to scrape all ${error_count} post${
            error_count !== 1 ? "s" : ""
          }${errorDetails}`,
          { duration: 5000 }
        );
      } else {
        const errorDetails =
          data.errors && data.errors.length > 0
            ? `\n${data.errors.length} failed. See console for details.`
            : "";
        toast.warning(
          `Scraped ${success_count} post${
            success_count !== 1 ? "s" : ""
          }, ${error_count} failed${errorDetails}`,
          { duration: 5000 }
        );

        // Add notification for partial success
        addNotification({
          type: "bulk_scraped",
          title: "Bulk scraping completed",
          message: `Scraped ${success_count} post${
            success_count !== 1 ? "s" : ""
          } in "${campaignName}". ${error_count} failed.`,
        });

        // Log detailed errors to console for debugging (dev mode only)
        const isDev =
          typeof window !== "undefined" &&
          (window.location.hostname === "localhost" ||
            window.location.hostname === "127.0.0.1");
        if (isDev && data.errors && data.errors.length > 0) {
          console.group("Scraping Errors:");
          data.errors.forEach((err, index) => {
            console.error(`Post ${index + 1} (${err.postId}):`, err.message);
          });
          console.groupEnd();
        }
      }
    },
    onError: (error: Error) => {
      let errorMessage = error.message;

      // Provide more helpful error messages
      if (
        errorMessage.includes("Failed to send a request to the Edge Function")
      ) {
        errorMessage =
          "Cannot reach the scraping service. Check that Edge Functions (scrape-post / scrape-all-posts) are deployed and your Supabase URL is correct.";
      } else if (errorMessage.includes("API error")) {
        errorMessage =
          "Scraping service error. Please check if API keys are configured.";
      } else if (errorMessage.includes("Unauthorized")) {
        errorMessage = "Authentication failed. Please try logging in again.";
      } else if (errorMessage.includes("Network")) {
        errorMessage =
          "Network error. Please check your connection and try again.";
      }

      toast.error(`Failed to scrape posts: ${errorMessage}`);
    },
  });
}
