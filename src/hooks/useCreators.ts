import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import * as creatorsApi from '../lib/api/creators';
import type { CreatorInsert, CreatorUpdate } from '../lib/types/database';
import { toast } from 'sonner';
import * as csvUtils from '../lib/utils/csv';

// Query keys
export const creatorsKeys = {
  all: ['creators'] as const,
  lists: () => [...creatorsKeys.all, 'list'] as const,
  list: () => [...creatorsKeys.lists()] as const,
  byCampaign: (campaignId: string) => [...creatorsKeys.all, 'campaign', campaignId] as const,
};

/**
 * Hook to fetch all creators for the current user
 */
export function useCreators() {
  return useQuery({
    queryKey: creatorsKeys.list(),
    queryFn: async () => {
      const result = await creatorsApi.list();
      if (result.error) {
        throw result.error;
      }
      return result.data || [];
    },
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
}

/**
 * Hook to fetch creators for a specific campaign
 */
export function useCreatorsByCampaign(campaignId: string) {
  return useQuery({
    queryKey: creatorsKeys.byCampaign(campaignId),
    queryFn: async () => {
      const result = await creatorsApi.getByCampaign(campaignId);
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
 * Hook to import creators from CSV file
 */
export function useImportCreators() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (file: File) => {
      // Parse CSV
      const parseResult = await csvUtils.parseCreatorHandlesCSV(file);
      
      if (parseResult.creators.length === 0) {
        throw new Error('No valid creators found in CSV file');
      }

      // Create creators in bulk
      const createResult = await creatorsApi.createMany(parseResult.creators);
      
      if (createResult.error) {
        throw createResult.error;
      }

      return {
        parseResult,
        createResult: createResult.data!,
      };
    },
    onSuccess: async (data) => {
      // Invalidate and refetch all creators queries (including network-filtered ones)
      // This ensures both 'my_network' and 'all' filters get updated
      await queryClient.invalidateQueries({
        queryKey: creatorsKeys.all
        // Removed refetchType to invalidate ALL queries, not just active ones
      });

      // Explicitly refetch the creators list to ensure immediate UI update
      await queryClient.refetchQueries({
        queryKey: [...creatorsKeys.list(), 'withStats']
      });

      const successCount = data.createResult.success_count;
      const errorCount = data.createResult.error_count + data.parseResult.error_count;
      
      if (errorCount === 0) {
        toast.success(`Successfully imported ${successCount} creator${successCount !== 1 ? 's' : ''}`);
      } else if (successCount === 0) {
        toast.error(`Failed to import creators. ${errorCount} error${errorCount !== 1 ? 's' : ''}`);
      } else {
        toast.warning(
          `Imported ${successCount} creator${successCount !== 1 ? 's' : ''}, ${errorCount} error${errorCount !== 1 ? 's' : ''}`
        );
      }
    },
    onError: (error: Error) => {
      toast.error(`Failed to import creators: ${error.message}`);
    },
  });
}

/**
 * Hook to create a single creator
 */
export function useCreateCreator() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (creator: Omit<CreatorInsert, 'user_id'>) => {
      // Use getOrCreate which handles the creation
      const result = await creatorsApi.getOrCreate(
        creator.name || null,
        creator.handle,
        creator.platform,
        creator.follower_count,
        creator.email,
        creator.phone,
        creator.niche,
        creator.location,
        creator.source_type || 'manual'
      );
      
      if (result.error) {
        throw result.error;
      }
      
      return result.data!;
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: creatorsKeys.all });
      await queryClient.refetchQueries({ queryKey: creatorsKeys.all });
      toast.success('Creator created successfully');
    },
    onError: (error: Error) => {
      toast.error(`Failed to create creator: ${error.message}`);
    },
  });
}

/**
 * Hook to fetch all creators with stats (campaigns count, total posts)
 */
export function useCreatorsWithStats(
  networkFilter?: 'my_network' | 'all',
  options?: { enabled?: boolean }
) {
  return useQuery({
    queryKey: [...creatorsKeys.list(), 'withStats', networkFilter || 'my_network'],
    queryFn: async () => {
      const result = await creatorsApi.listWithStats(networkFilter);
      if (result.error) {
        throw result.error;
      }
      return result.data || [];
    },
    staleTime: 5 * 60 * 1000, // 5 minutes
    enabled: options?.enabled ?? true,
  });
}

/**
 * Hook to update a creator
 */
export function useUpdateCreator() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, updates }: { id: string; updates: CreatorUpdate }) => {
      const result = await creatorsApi.update(id, updates);
      if (result.error) {
        throw result.error;
      }
      return result.data!;
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: creatorsKeys.all });
      await queryClient.refetchQueries({ queryKey: creatorsKeys.all });
      toast.success('Creator updated successfully');
    },
    onError: (error: Error) => {
      toast.error(`Failed to update creator: ${error.message}`);
    },
  });
}

/**
 * Hook to delete a creator
 */
export function useDeleteCreator() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const result = await creatorsApi.deleteCreator(id);
      if (result.error) {
        throw result.error;
      }
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: creatorsKeys.all });
      await queryClient.refetchQueries({ queryKey: creatorsKeys.all });
      toast.success('Creator deleted successfully');
    },
    onError: (error: Error) => {
      toast.error(`Failed to delete creator: ${error.message}`);
    },
  });
}

/**
 * Hook to add creators to a campaign
 */
export function useAddCreatorsToCampaign() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ campaignId, creatorIds }: { campaignId: string; creatorIds: string[] }) => {
      const result = await creatorsApi.addCreatorsToCampaign(campaignId, creatorIds);
      if (result.error) {
        throw result.error;
      }
      return result.data!;
    },
    onSuccess: async (data, variables) => {
      await queryClient.invalidateQueries({ queryKey: creatorsKeys.all });
      await queryClient.refetchQueries({ queryKey: creatorsKeys.all });
      await queryClient.invalidateQueries({ queryKey: creatorsKeys.byCampaign(variables.campaignId) });
      toast.success(`Added ${data.length} creator${data.length !== 1 ? 's' : ''} to campaign`);
    },
    onError: (error: Error) => {
      toast.error(`Failed to add creators to campaign: ${error.message}`);
    },
  });
}

/**
 * Hook to remove a creator from a campaign
 */
export function useRemoveCreatorFromCampaign() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ campaignId, creatorId }: { campaignId: string; creatorId: string }) => {
      const result = await creatorsApi.removeCreatorFromCampaign(campaignId, creatorId);
      if (result.error) {
        throw result.error;
      }
    },
    onSuccess: async (_, variables) => {
      await queryClient.invalidateQueries({ queryKey: creatorsKeys.all });
      await queryClient.refetchQueries({ queryKey: creatorsKeys.all });
      await queryClient.invalidateQueries({ queryKey: creatorsKeys.byCampaign(variables.campaignId) });
      toast.success('Creator removed from campaign');
    },
    onError: (error: Error) => {
      toast.error(`Failed to remove creator from campaign: ${error.message}`);
    },
  });
}

/**
 * Hook to fetch creators for a specific campaign
 */
export function useCampaignCreators(campaignId: string) {
  return useQuery({
    queryKey: [...creatorsKeys.byCampaign(campaignId), 'campaign-creators'],
    queryFn: async () => {
      const result = await creatorsApi.getCampaignCreators(campaignId);
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
 * Hook to fetch creator IDs for multiple campaigns
 */
export function useCampaignCreatorIds(campaignIds: string[]) {
  const campaignKey = campaignIds.slice().sort().join(',');
  return useQuery({
    queryKey: [...creatorsKeys.all, 'campaign-creator-ids', campaignKey],
    queryFn: async () => {
      const result = await creatorsApi.getCampaignCreatorIds(campaignIds);
      if (result.error) {
        throw result.error;
      }
      return result.data || [];
    },
    enabled: campaignIds.length > 0,
    staleTime: 5 * 60 * 1000,
  });
}

