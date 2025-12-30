import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import * as sharingApi from "../lib/api/campaign-sharing-v2";
import { toast } from "sonner";

export const campaignSharingKeys = {
  all: ["campaign-sharing"] as const,
  settings: (campaignId: string) =>
    [...campaignSharingKeys.all, "settings", campaignId] as const,
};

/**
 * Hook to get campaign share settings
 */
export function useCampaignShareSettings(campaignId: string) {
  return useQuery({
    queryKey: campaignSharingKeys.settings(campaignId),
    queryFn: async () => {
      const result = await sharingApi.getCampaignShareSettings(campaignId);
      if (result.error) throw result.error;
      return result.data;
    },
    enabled: !!campaignId,
    staleTime: 1000 * 60 * 5, // 5 minutes
  });
}

/**
 * Hook to enable campaign sharing
 */
export function useEnableCampaignShare() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (params: {
      campaignId: string;
      expiresInHours?: number | null;
      allowExport?: boolean;
    }) => {
      const result = await sharingApi.enableCampaignShare(params);
      if (result.error) throw result.error;
      return result.data;
    },
    onSuccess: (data, variables) => {
      queryClient.invalidateQueries({
        queryKey: campaignSharingKeys.settings(variables.campaignId),
      });
      toast.success("View-only link enabled");
    },
    onError: (error: Error) => {
      toast.error(`Failed to enable sharing: ${error.message}`);
    },
  });
}

/**
 * Hook to regenerate campaign share token
 */
export function useRegenerateCampaignShareToken() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (campaignId: string) => {
      const result = await sharingApi.regenerateCampaignShareToken(campaignId);
      if (result.error) throw result.error;
      return result.data;
    },
    onSuccess: (data, campaignId) => {
      queryClient.invalidateQueries({
        queryKey: campaignSharingKeys.settings(campaignId),
      });
      toast.success("Link regenerated. Old link is now invalid.");
    },
    onError: (error: Error) => {
      toast.error(`Failed to regenerate link: ${error.message}`);
    },
  });
}

/**
 * Hook to disable campaign sharing
 */
export function useDisableCampaignShare() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (campaignId: string) => {
      const result = await sharingApi.disableCampaignShare(campaignId);
      if (result.error) throw result.error;
      return result.data;
    },
    onSuccess: (data, campaignId) => {
      queryClient.invalidateQueries({
        queryKey: campaignSharingKeys.settings(campaignId),
      });
      toast.success("View-only link disabled");
    },
    onError: (error: Error) => {
      toast.error(`Failed to disable sharing: ${error.message}`);
    },
  });
}

