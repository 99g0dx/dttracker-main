import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import * as campaignsApi from '../lib/api/campaigns';
import type { CampaignInsert, CampaignUpdate, CampaignWithStats } from '../lib/types/database';
import { toast } from 'sonner';

// Query keys
export const campaignsKeys = {
  all: ['campaigns'] as const,
  lists: () => [...campaignsKeys.all, 'list'] as const,
  list: (filters: string) => [...campaignsKeys.lists(), filters] as const,
  details: () => [...campaignsKeys.all, 'detail'] as const,
  detail: (id: string) => [...campaignsKeys.details(), id] as const,
};

/**
 * Hook to fetch all campaigns with stats
 */
export function useCampaigns() {
  return useQuery({
    queryKey: campaignsKeys.lists(),
    queryFn: async () => {
      const result = await campaignsApi.list();
      if (result.error) {
        throw result.error;
      }
      return result.data || [];
    },
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
}

/**
 * Hook to fetch a single campaign by ID
 */
export function useCampaign(id: string) {
  return useQuery({
    queryKey: campaignsKeys.detail(id),
    queryFn: async () => {
      const result = await campaignsApi.getById(id);
      if (result.error) {
        throw result.error;
      }
      return result.data;
    },
    enabled: !!id,
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
}

/**
 * Hook to create a new campaign
 */
export function useCreateCampaign() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (campaign: CampaignInsert) => {
      const result = await campaignsApi.create(campaign);
      if (result.error) {
        throw result.error;
      }
      return result.data;
    },
    onSuccess: (data) => {
      // Set the new campaign in the detail query cache
      if (data) {
        queryClient.setQueryData(campaignsKeys.detail(data.id), data);
      }
      // Invalidate campaigns list to refetch
      queryClient.invalidateQueries({ queryKey: campaignsKeys.lists() });
      toast.success('Campaign created successfully');
    },
    onError: (error: Error) => {
      toast.error(`Failed to create campaign: ${error.message}`);
    },
  });
}

/**
 * Hook to update a campaign
 */
export function useUpdateCampaign() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, updates }: { id: string; updates: CampaignUpdate }) => {
      const result = await campaignsApi.update(id, updates);
      if (result.error) {
        throw result.error;
      }
      return result.data;
    },
    onMutate: async ({ id, updates }) => {
      // Cancel outgoing refetches
      await queryClient.cancelQueries({ queryKey: campaignsKeys.detail(id) });
      await queryClient.cancelQueries({ queryKey: campaignsKeys.lists() });

      // Snapshot previous values
      const previousCampaign = queryClient.getQueryData(campaignsKeys.detail(id));
      const previousCampaigns = queryClient.getQueryData(campaignsKeys.lists());

      // Optimistically update detail query
      queryClient.setQueryData(campaignsKeys.detail(id), (old: any) => {
        if (!old) return old;
        return { ...old, ...updates, updated_at: new Date().toISOString() };
      });

      // Optimistically update list query
      queryClient.setQueryData(campaignsKeys.lists(), (old: CampaignWithStats[] | undefined) => {
        if (!old) return old;
        return old.map(campaign =>
          campaign.id === id
            ? { ...campaign, ...updates, updated_at: new Date().toISOString() }
            : campaign
        );
      });

      return { previousCampaign, previousCampaigns };
    },
    onSuccess: (data) => {
      // Invalidate both list and detail queries
      queryClient.invalidateQueries({ queryKey: campaignsKeys.lists() });
      if (data) {
        queryClient.invalidateQueries({ queryKey: campaignsKeys.detail(data.id) });
      }
      toast.success('Campaign updated successfully');
    },
    onError: (error: Error, variables, context) => {
      // Rollback optimistic updates
      if (context?.previousCampaign) {
        queryClient.setQueryData(campaignsKeys.detail(variables.id), context.previousCampaign);
      }
      if (context?.previousCampaigns) {
        queryClient.setQueryData(campaignsKeys.lists(), context.previousCampaigns);
      }
      toast.error(`Failed to update campaign: ${error.message}`);
    },
  });
}

/**
 * Hook to delete a campaign
 */
export function useDeleteCampaign() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const result = await campaignsApi.deleteCampaign(id);
      if (result.error) {
        throw result.error;
      }
      return id;
    },
    onMutate: async (id) => {
      // Cancel outgoing refetches
      await queryClient.cancelQueries({ queryKey: campaignsKeys.lists() });
      await queryClient.cancelQueries({ queryKey: campaignsKeys.detail(id) });

      // Snapshot previous values
      const previousCampaigns = queryClient.getQueryData(campaignsKeys.lists());

      // Optimistically remove from list
      queryClient.setQueryData(campaignsKeys.lists(), (old: CampaignWithStats[] | undefined) => {
        if (!old) return old;
        return old.filter(campaign => campaign.id !== id);
      });

      return { previousCampaigns };
    },
    onSuccess: () => {
      // Invalidate campaigns list
      queryClient.invalidateQueries({ queryKey: campaignsKeys.lists() });
      toast.success('Campaign deleted successfully');
    },
    onError: (error: Error, _id, context) => {
      // Rollback optimistic update
      if (context?.previousCampaigns) {
        queryClient.setQueryData(campaignsKeys.lists(), context.previousCampaigns);
      }
      toast.error(`Failed to delete campaign: ${error.message}`);
    },
  });
}

/**
 * Hook to duplicate a campaign
 */
export function useDuplicateCampaign() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const result = await campaignsApi.duplicate(id);
      if (result.error) {
        throw result.error;
      }
      return result.data;
    },
    onSuccess: () => {
      // Invalidate campaigns list to show the new copy
      queryClient.invalidateQueries({ queryKey: campaignsKeys.lists() });
      toast.success('Campaign duplicated successfully');
    },
    onError: (error: Error) => {
      toast.error(`Failed to duplicate campaign: ${error.message}`);
    },
  });
}
