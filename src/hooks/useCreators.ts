import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import * as creatorsApi from "../lib/api/creators";
import type { CreatorInsert, CreatorUpdate } from "../lib/types/database";
import { toast } from "sonner";
import * as csvUtils from "../lib/utils/csv";
import { useWorkspace } from "../contexts/WorkspaceContext";

// Query keys
export const creatorsKeys = {
  all: ["creators"] as const,
  lists: (workspaceId?: string | null) =>
    [...creatorsKeys.all, "list", workspaceId || "default"] as const,
  list: (workspaceId?: string | null) =>
    [...creatorsKeys.lists(workspaceId)] as const,
  byCampaign: (campaignId: string) =>
    [...creatorsKeys.all, "campaign", campaignId] as const,
  myNetwork: (workspaceId: string | null) =>
    [...creatorsKeys.all, "myNetwork", workspaceId] as const,
  discover: (workspaceId: string | null, filters?: object) =>
    [...creatorsKeys.all, "discover", workspaceId, filters ?? {}] as const,
  favorites: () => [...creatorsKeys.all, "favorites"] as const,
  profile: (creatorId: string | null) =>
    [...creatorsKeys.all, "profile", creatorId] as const,
};

/**
 * Hook to fetch all creators for the current user
 */
export function useCreators() {
  const { activeWorkspaceId } = useWorkspace();
  return useQuery({
    queryKey: creatorsKeys.list(activeWorkspaceId),
    queryFn: async () => {
      const result = await creatorsApi.list("my_network", activeWorkspaceId);
      if (result.error) {
        throw result.error;
      }
      return result.data || [];
    },
    staleTime: 10 * 60 * 1000, // 10 minutes
    gcTime: 30 * 60 * 1000, // 30 minutes
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
  });
}

/**
 * Hook to fetch creators for a specific campaign
 */
export function useCreatorsByCampaign(campaignId: string) {
  const { activeWorkspaceId } = useWorkspace();
  return useQuery({
    queryKey: creatorsKeys.byCampaign(campaignId),
    queryFn: async () => {
      const result = await creatorsApi.getByCampaign(
        campaignId,
        activeWorkspaceId
      );
      if (result.error) {
        throw result.error;
      }
      return result.data || [];
    },
    enabled: !!campaignId,
    staleTime: 10 * 60 * 1000, // 10 minutes
    gcTime: 30 * 60 * 1000, // 30 minutes
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
  });
}

/**
 * Hook to import creators from CSV file
 */
export function useImportCreators() {
  const queryClient = useQueryClient();
  const { activeWorkspaceId } = useWorkspace();

  return useMutation({
    mutationFn: async (file: File) => {
      // Parse CSV
      const parseResult = await csvUtils.parseCreatorHandlesCSV(file);

      if (parseResult.creators.length === 0) {
        throw new Error("No valid creators found in CSV file");
      }

      // Create creators in bulk
      const createResult = await creatorsApi.createMany(
        parseResult.creators,
        activeWorkspaceId
      );

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
        queryKey: creatorsKeys.all,
        // Removed refetchType to invalidate ALL queries, not just active ones
      });

      // Explicitly refetch the creators list to ensure immediate UI update
      await queryClient.refetchQueries({
        queryKey: [...creatorsKeys.list(activeWorkspaceId), "withStats"],
      });

      const successCount = data.createResult.success_count;
      const errorCount =
        data.createResult.error_count + data.parseResult.error_count;

      if (errorCount === 0) {
        toast.success(
          `Successfully imported ${successCount} creator${successCount !== 1 ? "s" : ""}`
        );
      } else if (successCount === 0) {
        toast.error(
          `Failed to import creators. ${errorCount} error${errorCount !== 1 ? "s" : ""}`
        );
      } else {
        toast.warning(
          `Imported ${successCount} creator${successCount !== 1 ? "s" : ""}, ${errorCount} error${errorCount !== 1 ? "s" : ""}`
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
  const { activeWorkspaceId } = useWorkspace();

  return useMutation({
    mutationFn: async (creator: Omit<CreatorInsert, "user_id">) => {
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
        creator.source_type || "manual",
        activeWorkspaceId
      );

      if (result.error) {
        throw result.error;
      }

      return result.data!;
    },
    onMutate: async (creator) => {
      await queryClient.cancelQueries({
        queryKey: creatorsKeys.list(activeWorkspaceId),
      });
      const tempId =
        typeof crypto !== "undefined" && crypto.randomUUID
          ? crypto.randomUUID()
          : `temp_${Math.random().toString(36).slice(2)}`;
      const nowIso = new Date().toISOString();
      const optimisticCreator = {
        id: tempId,
        user_id: "pending",
        name: creator.name || creator.handle,
        handle: creator.handle,
        platform: creator.platform,
        follower_count: creator.follower_count || 0,
        avg_engagement: 0,
        email: creator.email || null,
        phone: creator.phone || null,
        niche: creator.niche || null,
        location: creator.location || null,
        source_type: creator.source_type || "manual",
        imported_by_user_id: "pending",
        created_by_workspace_id: activeWorkspaceId || null,
        profile_url: null,
        display_name: creator.name || creator.handle,
        country: null,
        state: null,
        city: null,
        contact_email: null,
        whatsapp: null,
        created_at: nowIso,
        updated_at: nowIso,
      } as any;

      const key = creatorsKeys.list(activeWorkspaceId);
      const previous = queryClient.getQueryData<any[]>(key) || [];
      queryClient.setQueryData<any[]>(key, [optimisticCreator, ...previous]);

      const withStatsKey = [
        ...creatorsKeys.list(activeWorkspaceId),
        "withStats",
        "my_network",
      ];
      const previousWithStats =
        queryClient.getQueryData<any[]>(withStatsKey) || [];
      queryClient.setQueryData<any[]>(withStatsKey, [
        { ...optimisticCreator, campaigns: 0, totalPosts: 0 },
        ...previousWithStats,
      ]);

      return { previous, previousWithStats, key, withStatsKey };
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: creatorsKeys.all });
      await queryClient.refetchQueries({ queryKey: creatorsKeys.all });
      toast.success("Creator created successfully");
    },
    onError: (error: Error, _creator, context) => {
      if (context?.key) {
        queryClient.setQueryData(context.key, context.previous || []);
      }
      if (context?.withStatsKey) {
        queryClient.setQueryData(
          context.withStatsKey,
          context.previousWithStats || []
        );
      }
      toast.error(`Failed to create creator: ${error.message}`);
    },
  });
}

/**
 * Hook to fetch all creators with stats (campaigns count, total posts)
 */
export function useCreatorsWithStats(
  networkFilter?: "my_network" | "all",
  options?: { enabled?: boolean }
) {
  const { activeWorkspaceId } = useWorkspace();
  return useQuery({
    queryKey: [
      ...creatorsKeys.list(activeWorkspaceId),
      "withStats",
      networkFilter || "my_network",
    ],
    queryFn: async () => {
      const result = await creatorsApi.listWithStats(
        networkFilter,
        activeWorkspaceId
      );
      if (result.error) {
        throw result.error;
      }
      return result.data || [];
    },
    staleTime: 10 * 60 * 1000, // 10 minutes
    gcTime: 30 * 60 * 1000, // 30 minutes
    enabled: options?.enabled ?? true,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
  });
}

/**
 * Hook to update a creator
 */
export function useUpdateCreator() {
  const queryClient = useQueryClient();
  const { activeWorkspaceId } = useWorkspace();

  return useMutation({
    mutationFn: async ({
      id,
      updates,
    }: {
      id: string;
      updates: CreatorUpdate;
    }) => {
      const result = await creatorsApi.update(id, updates, activeWorkspaceId);
      if (result.error) {
        throw result.error;
      }
      return result.data!;
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: creatorsKeys.all });
      await queryClient.refetchQueries({ queryKey: creatorsKeys.all });
      toast.success("Creator updated successfully");
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
  const { activeWorkspaceId } = useWorkspace();

  return useMutation({
    mutationFn: async (id: string) => {
      const result = await creatorsApi.deleteCreator(id, activeWorkspaceId);
      if (result.error) {
        throw result.error;
      }
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: creatorsKeys.all });
      await queryClient.refetchQueries({ queryKey: creatorsKeys.all });
      toast.success("Creator deleted successfully");
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
  const { activeWorkspaceId } = useWorkspace();

  return useMutation({
    mutationFn: async ({
      campaignId,
      creatorIds,
    }: {
      campaignId: string;
      creatorIds: string[];
    }) => {
      const result = await creatorsApi.addCreatorsToCampaign(
        campaignId,
        creatorIds,
        activeWorkspaceId
      );
      if (result.error) {
        throw result.error;
      }
      return result.data!;
    },
    onSuccess: async (data, variables) => {
      await queryClient.invalidateQueries({ queryKey: creatorsKeys.all });
      await queryClient.refetchQueries({ queryKey: creatorsKeys.all });
      await queryClient.invalidateQueries({
        queryKey: creatorsKeys.byCampaign(variables.campaignId),
      });
      toast.success(
        `Added ${data.length} creator${data.length !== 1 ? "s" : ""} to campaign`
      );
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
  const { activeWorkspaceId } = useWorkspace();

  return useMutation({
    mutationFn: async ({
      campaignId,
      creatorId,
    }: {
      campaignId: string;
      creatorId: string;
    }) => {
      const result = await creatorsApi.removeCreatorFromCampaign(
        campaignId,
        creatorId,
        activeWorkspaceId
      );
      if (result.error) {
        throw result.error;
      }
    },
    onSuccess: async (_, variables) => {
      await queryClient.invalidateQueries({ queryKey: creatorsKeys.all });
      await queryClient.refetchQueries({ queryKey: creatorsKeys.all });
      await queryClient.invalidateQueries({
        queryKey: creatorsKeys.byCampaign(variables.campaignId),
      });
      toast.success("Creator removed from campaign");
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
  const { activeWorkspaceId } = useWorkspace();
  return useQuery({
    queryKey: [...creatorsKeys.byCampaign(campaignId), "campaign-creators"],
    queryFn: async () => {
      const result = await creatorsApi.getCampaignCreators(
        campaignId,
        activeWorkspaceId
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
 * Hook to fetch creator IDs for multiple campaigns
 */
export function useCampaignCreatorIds(campaignIds: string[]) {
  const campaignKey = campaignIds.slice().sort().join(",");
  return useQuery({
    queryKey: [...creatorsKeys.all, "campaign-creator-ids", campaignKey],
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

// Creators Page - My Network, Discover, Favorites
export function useMyNetworkCreators(workspaceId: string | null) {
  return useQuery({
    queryKey: creatorsKeys.myNetwork(workspaceId),
    queryFn: async () => {
      const result = await creatorsApi.listMyNetwork(workspaceId);
      if (result.error) throw result.error;
      return result.data || [];
    },
    enabled: !!workspaceId,
  });
}

export function useDiscoverCreators(
  workspaceId: string | null,
  filters?: creatorsApi.CreatorFilters,
  options?: { enabled?: boolean }
) {
  return useQuery({
    queryKey: creatorsKeys.discover(workspaceId, filters),
    queryFn: async () => {
      const result = await creatorsApi.listDiscover(workspaceId, filters);
      if (result.error) throw result.error;
      return result.data || [];
    },
    enabled: (options?.enabled ?? true) && !!workspaceId,
  });
}

export function useFavoritesCreators() {
  return useQuery({
    queryKey: creatorsKeys.favorites(),
    queryFn: async () => {
      try {
        const result = await creatorsApi.listFavorites();
        if (result.error) throw result.error;
        return result.data || [];
      } catch {
        // creator_favorites table may not exist yet (migration pending)
        return [];
      }
    },
  });
}

export function useToggleFavorite() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: creatorsApi.toggleFavorite,
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: creatorsKeys.favorites() });
      queryClient.invalidateQueries({ queryKey: creatorsKeys.all });
      toast.success(
        data?.data?.is_favorite
          ? "Added to favorites"
          : "Removed from favorites"
      );
    },
    onError: (err: Error) => {
      toast.error(
        err.message ||
          "Favorites unavailable. Run database migrations to enable."
      );
    },
  });
}

export function useCreatorProfile(creatorId: string | null) {
  return useQuery({
    queryKey: creatorsKeys.profile(creatorId),
    queryFn: async () => {
      if (!creatorId) return null;
      const result = await creatorsApi.getCreatorProfile(creatorId);
      if (result.error) throw result.error;
      return result.data;
    },
    enabled: !!creatorId && !creatorId.startsWith("manual-"),
  });
}

export function useAddCreatorManually() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      workspaceId,
      data,
    }: {
      workspaceId: string;
      data: Parameters<typeof creatorsApi.addCreatorManually>[1];
    }) => creatorsApi.addCreatorManually(workspaceId, data),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({
        queryKey: creatorsKeys.myNetwork(variables.workspaceId),
      });
      queryClient.invalidateQueries({ queryKey: creatorsKeys.all });
      toast.success("Creator added");
    },
    onError: (err: Error) => toast.error(err.message),
  });
}

export function useSendOfferToActivation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      creatorId,
      activationId,
      amount,
      message,
    }: {
      creatorId: string;
      activationId: string;
      amount: number;
      message?: string;
    }) =>
      creatorsApi.sendOfferToActivation(
        creatorId,
        activationId,
        amount,
        message
      ),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: creatorsKeys.all });
    },
    onError: (err: Error) => toast.error(err.message),
  });
}
