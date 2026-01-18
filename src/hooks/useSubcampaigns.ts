import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import * as subcampaignsApi from "../lib/api/subcampaigns";
import type { CampaignInsert } from "../lib/types/database";
import { campaignsKeys } from "./useCampaigns";
import { postsKeys } from "./usePosts";
import { useWorkspace } from "../contexts/WorkspaceContext";

export const subcampaignsKeys = {
  all: ["subcampaigns"] as const,
  list: (parentId: string) => ["subcampaigns", "list", parentId] as const,
  metrics: (campaignId: string) => ["subcampaigns", "metrics", campaignId] as const,
  isParent: (campaignId: string) => ["subcampaigns", "isParent", campaignId] as const,
};

export function useSubcampaigns(parentCampaignId: string) {
  return useQuery({
    queryKey: subcampaignsKeys.list(parentCampaignId),
    queryFn: async () => {
      const result = await subcampaignsApi.getSubcampaigns(parentCampaignId);
      if (result.error) {
        throw result.error;
      }
      return result.data || [];
    },
    enabled: !!parentCampaignId,
    staleTime: 5 * 60 * 1000,
  });
}

export function useIsParentCampaign(campaignId: string) {
  return useQuery({
    queryKey: subcampaignsKeys.isParent(campaignId),
    queryFn: async () => {
      const result = await subcampaignsApi.isParentCampaign(campaignId);
      if (result.error) {
        throw result.error;
      }
      return result.data || false;
    },
    enabled: !!campaignId,
    staleTime: 5 * 60 * 1000,
  });
}

export function useCampaignHierarchyMetrics(campaignId: string) {
  return useQuery({
    queryKey: subcampaignsKeys.metrics(campaignId),
    queryFn: async () => {
      const result = await subcampaignsApi.getCampaignMetricsWithSubcampaigns(
        campaignId
      );
      if (result.error) {
        throw result.error;
      }
      return result.data;
    },
    enabled: !!campaignId,
    staleTime: 2 * 60 * 1000,
  });
}

export function useCreateSubcampaign(parentCampaignId: string) {
  const queryClient = useQueryClient();
  const { activeWorkspaceId } = useWorkspace();

  return useMutation({
    mutationFn: async (payload: Omit<CampaignInsert, "user_id">) => {
      const result = await subcampaignsApi.createSubcampaign(
        parentCampaignId,
        payload
      );
      if (result.error) {
        throw result.error;
      }
      return result.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: subcampaignsKeys.list(parentCampaignId),
      });
      queryClient.invalidateQueries({
        queryKey: subcampaignsKeys.metrics(parentCampaignId),
      });
      queryClient.invalidateQueries({ queryKey: campaignsKeys.lists(activeWorkspaceId) });
      queryClient.invalidateQueries({ queryKey: campaignsKeys.detail(parentCampaignId) });
      queryClient.invalidateQueries({ queryKey: postsKeys.lists() });
      queryClient.invalidateQueries({ queryKey: postsKeys.metrics() });
      toast.success("Subcampaign created");
    },
    onError: (error: Error) => {
      toast.error(`Failed to create subcampaign: ${error.message}`);
    },
  });
}
