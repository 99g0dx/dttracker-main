import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import * as creatorRequestsApi from '../lib/api/creator-requests';
import type {
  CreatorRequest,
  CreatorRequestInsert,
  CreatorRequestUpdate,
  CreatorRequestWithCreators,
  CreatorRequestWithItems,
  CreatorRequestStatus,
} from '../lib/types/database';
import { toast } from 'sonner';

// Query keys
export const creatorRequestsKeys = {
  all: ['creator_requests'] as const,
  lists: () => [...creatorRequestsKeys.all, 'list'] as const,
  list: () => [...creatorRequestsKeys.lists()] as const,
  details: () => [...creatorRequestsKeys.all, 'detail'] as const,
  detail: (id: string) => [...creatorRequestsKeys.details(), id] as const,
  detailWithCreators: (id: string) => [...creatorRequestsKeys.detail(id), 'with-creators'] as const,
  detailWithItems: (id: string) => [...creatorRequestsKeys.detail(id), 'with-items'] as const,
};

/**
 * Hook to fetch all creator requests for the current user
 */
export function useCreatorRequests() {
  return useQuery({
    queryKey: creatorRequestsKeys.list(),
    queryFn: async () => {
      const result = await creatorRequestsApi.getRequests();
      if (result.error) {
        throw result.error;
      }
      return result.data || [];
    },
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
}

/**
 * Hook to fetch a single creator request by ID
 */
export function useCreatorRequest(id: string) {
  return useQuery({
    queryKey: creatorRequestsKeys.detail(id),
    queryFn: async () => {
      const result = await creatorRequestsApi.getRequestById(id);
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
 * Hook to fetch a creator request with associated creators
 */
export function useCreatorRequestWithCreators(id: string) {
  return useQuery({
    queryKey: creatorRequestsKeys.detailWithCreators(id),
    queryFn: async () => {
      const result = await creatorRequestsApi.getRequestWithCreators(id);
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
 * Hook to fetch a creator request with full items details
 */
export function useCreatorRequestWithItems(id: string) {
  return useQuery({
    queryKey: creatorRequestsKeys.detailWithItems(id),
    queryFn: async () => {
      const result = await creatorRequestsApi.getRequestWithItems(id);
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
 * Hook to create a new creator request
 */
export function useCreateCreatorRequest() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (request: CreatorRequestInsert) => {
      const result = await creatorRequestsApi.createRequest(request);
      if (result.error) {
        throw result.error;
      }
      return result.data;
    },
    onSuccess: (data) => {
      // Invalidate requests list to refetch
      queryClient.invalidateQueries({ queryKey: creatorRequestsKeys.lists() });
      // Set the new request in the detail query cache
      if (data) {
        queryClient.setQueryData(creatorRequestsKeys.detail(data.id), data);
        queryClient.setQueryData(creatorRequestsKeys.detailWithCreators(data.id), data);
      }
      toast.success('Creator request submitted successfully');
    },
    onError: (error: Error) => {
      toast.error(`Failed to submit request: ${error.message}`);
    },
  });
}

/**
 * Hook to update a creator request
 */
export function useUpdateCreatorRequest() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, updates }: { id: string; updates: CreatorRequestUpdate }) => {
      const result = await creatorRequestsApi.updateRequest(id, updates);
      if (result.error) {
        throw result.error;
      }
      return result.data;
    },
    onSuccess: (data, variables) => {
      // Invalidate requests list
      queryClient.invalidateQueries({ queryKey: creatorRequestsKeys.lists() });
      // Invalidate and refetch detail queries
      if (data) {
        queryClient.invalidateQueries({ queryKey: creatorRequestsKeys.detail(variables.id) });
      }
      toast.success('Request updated successfully');
    },
    onError: (error: Error) => {
      toast.error(`Failed to update request: ${error.message}`);
    },
  });
}

/**
 * Hook to update request status (typically used by admin/service role)
 */
export function useUpdateRequestStatus() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      id,
      status,
      quoteAmount,
      quoteDetails,
    }: {
      id: string;
      status: CreatorRequestStatus;
      quoteAmount?: number;
      quoteDetails?: Record<string, any>;
    }) => {
      const result = await creatorRequestsApi.updateRequestStatus(id, status, quoteAmount, quoteDetails);
      if (result.error) {
        throw result.error;
      }
      return result.data;
    },
    onSuccess: (data, variables) => {
      // Invalidate requests list
      queryClient.invalidateQueries({ queryKey: creatorRequestsKeys.lists() });
      // Invalidate and refetch detail queries
      queryClient.invalidateQueries({ queryKey: creatorRequestsKeys.detail(variables.id) });
      toast.success('Request status updated successfully');
    },
    onError: (error: Error) => {
      toast.error(`Failed to update request status: ${error.message}`);
    },
  });
}

/**
 * Hook to delete a creator request
 */
export function useDeleteCreatorRequest() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const result = await creatorRequestsApi.deleteRequest(id);
      if (result.error) {
        throw result.error;
      }
      return id;
    },
    onMutate: async (id) => {
      // Cancel outgoing refetches
      await queryClient.cancelQueries({ queryKey: creatorRequestsKeys.lists() });
      await queryClient.cancelQueries({ queryKey: creatorRequestsKeys.detail(id) });

      // Snapshot previous value
      const previousRequests = queryClient.getQueryData(creatorRequestsKeys.list());

      // Optimistically remove from list
      queryClient.setQueryData(creatorRequestsKeys.list(), (old: CreatorRequest[] | undefined) => {
        if (!old) return old;
        return old.filter((request) => request.id !== id);
      });

      return { previousRequests };
    },
    onSuccess: () => {
      // Invalidate requests list
      queryClient.invalidateQueries({ queryKey: creatorRequestsKeys.lists() });
      toast.success('Request deleted successfully');
    },
    onError: (error: Error, _id, context) => {
      // Rollback optimistic update
      if (context?.previousRequests) {
        queryClient.setQueryData(creatorRequestsKeys.list(), context.previousRequests);
      }
      toast.error(`Failed to delete request: ${error.message}`);
    },
  });
}
