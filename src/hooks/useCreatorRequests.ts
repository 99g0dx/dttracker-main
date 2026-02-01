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
import { useWorkspace } from '../contexts/WorkspaceContext';
import { useWorkspaceAccess } from './useWorkspaceAccess';

// Query keys
export const creatorRequestsKeys = {
  all: ['creator_requests'] as const,
  lists: () => [...creatorRequestsKeys.all, 'list'] as const,
  list: (scope: 'user' | 'workspace', workspaceId?: string | null) =>
    [...creatorRequestsKeys.lists(), scope, workspaceId || 'none'] as const,
  details: () => [...creatorRequestsKeys.all, 'detail'] as const,
  detail: (id: string) => [...creatorRequestsKeys.details(), id] as const,
  detailWithCreators: (id: string) => [...creatorRequestsKeys.detail(id), 'with-creators'] as const,
  detailWithItems: (id: string) => [...creatorRequestsKeys.detail(id), 'with-items'] as const,
};

/**
 * Hook to fetch all creator requests for the current user
 */
export function useCreatorRequests(options?: { scope?: 'auto' | 'user' | 'workspace' }) {
  const { activeWorkspaceId } = useWorkspace();
  const { isOwner, loading: accessLoading } = useWorkspaceAccess();
  const scopeOption = options?.scope ?? 'auto';
  const resolvedScope =
    scopeOption === 'auto' ? (isOwner ? 'workspace' : 'user') : scopeOption;

  return useQuery({
    queryKey: creatorRequestsKeys.list(resolvedScope, activeWorkspaceId),
    queryFn: async () => {
      const result = await creatorRequestsApi.getRequests({
        scope: resolvedScope,
        workspaceId: activeWorkspaceId,
      });
      if (result.error) {
        throw result.error;
      }
      return result.data || [];
    },
    enabled:
      !accessLoading &&
      (resolvedScope !== 'workspace' || Boolean(activeWorkspaceId)),
    staleTime: 5 * 60 * 1000, // 5 minutes
    gcTime: 15 * 60 * 1000, // 15 minutes
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
    gcTime: 15 * 60 * 1000, // 15 minutes
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
    gcTime: 15 * 60 * 1000, // 15 minutes
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
    gcTime: 15 * 60 * 1000, // 15 minutes
  });
}

/**
 * Hook to create a new creator request
 */
export function useCreateCreatorRequest() {
  const queryClient = useQueryClient();
  const { activeWorkspaceId } = useWorkspace();
  const { isOwner } = useWorkspaceAccess();
  const scope = isOwner ? 'workspace' : 'user';

  return useMutation({
    mutationFn: async (request: CreatorRequestInsert) => {
      const result = await creatorRequestsApi.createRequest(request);
      if (result.error) {
        throw result.error;
      }
      return result.data;
    },
    onMutate: async (request) => {
      await queryClient.cancelQueries({
        queryKey: creatorRequestsKeys.list(scope, activeWorkspaceId),
      });
      const tempId =
        typeof crypto !== 'undefined' && crypto.randomUUID
          ? crypto.randomUUID()
          : `temp_${Math.random().toString(36).slice(2)}`;
      const nowIso = new Date().toISOString();
      const optimisticRequest = {
        id: tempId,
        user_id: request.user_id,
        campaign_id: request.campaign_id ?? null,
        status: request.status ?? 'suggested',
        submission_type: request.submission_type ?? 'suggestion',
        campaign_type: request.campaign_type ?? null,
        campaign_brief: request.campaign_brief ?? null,
        deadline: request.deadline ?? null,
        contact_person_name: request.contact_person_name ?? null,
        contact_person_email: request.contact_person_email ?? null,
        contact_person_phone: request.contact_person_phone ?? null,
        created_at: nowIso,
        updated_at: nowIso,
        deliverables: request.deliverables ?? [],
        posts_per_creator: request.posts_per_creator ?? null,
        usage_rights: request.usage_rights ?? null,
        urgency: request.urgency ?? null,
      } as any;

      const key = creatorRequestsKeys.list(scope, activeWorkspaceId);
      const previous = queryClient.getQueryData<any[]>(key) || [];
      queryClient.setQueryData<any[]>(key, [optimisticRequest, ...previous]);
      return { previous, key };
    },
    onSuccess: (data) => {
      // Invalidate requests list to refetch
      queryClient.invalidateQueries({
        queryKey: creatorRequestsKeys.list(scope, activeWorkspaceId),
      });
      // Set the new request in the detail query cache
      if (data) {
        queryClient.setQueryData(creatorRequestsKeys.detail(data.id), data);
        queryClient.setQueryData(creatorRequestsKeys.detailWithCreators(data.id), data);
      }
      toast.success(
        data?.submission_type === 'suggestion'
          ? 'Suggestion sent to owner'
          : 'Creator request submitted successfully'
      );
    },
    onError: (error: Error, _request, context) => {
      if (context?.key) {
        queryClient.setQueryData(context.key, context.previous || []);
      }
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
 * Company admin: quote per-creator items
 */
export function useQuoteCreatorRequestItems() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      requestId,
      items,
    }: {
      requestId: string;
      items: Array<{
        creator_id: string;
        quoted_amount_cents: number;
        quoted_currency?: string | null;
        quote_notes?: string | null;
      }>;
    }) => {
      const result = await creatorRequestsApi.quoteCreatorRequestItems(requestId, items);
      if (result.error) {
        throw result.error;
      }
      return result.data;
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: creatorRequestsKeys.detail(variables.requestId) });
      queryClient.invalidateQueries({ queryKey: creatorRequestsKeys.detailWithCreators(variables.requestId) });
      queryClient.invalidateQueries({ queryKey: creatorRequestsKeys.detailWithItems(variables.requestId) });
      queryClient.invalidateQueries({ queryKey: creatorRequestsKeys.lists() });
      toast.success('Quotes sent to requester');
    },
    onError: (error: Error) => {
      toast.error(`Failed to send quotes: ${error.message}`);
    },
  });
}

/**
 * User: approve or reject a quoted creator
 */
export function useRespondToCreatorQuote() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      requestId,
      creatorId,
      decision,
    }: {
      requestId: string;
      creatorId: string;
      decision: 'approved' | 'rejected';
    }) => {
      const result = await creatorRequestsApi.respondToCreatorQuote(requestId, creatorId, decision);
      if (result.error) {
        throw result.error;
      }
      return result.data;
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: creatorRequestsKeys.detail(variables.requestId) });
      queryClient.invalidateQueries({ queryKey: creatorRequestsKeys.detailWithCreators(variables.requestId) });
      queryClient.invalidateQueries({ queryKey: creatorRequestsKeys.detailWithItems(variables.requestId) });
      queryClient.invalidateQueries({ queryKey: creatorRequestsKeys.lists() });
      toast.success(`Creator ${variables.decision === 'approved' ? 'approved' : 'rejected'}`);
    },
    onError: (error: Error) => {
      toast.error(`Failed to respond: ${error.message}`);
    },
  });
}

/**
 * Hook to submit an operator suggestion as a real request (owner only)
 */
export function useSubmitCreatorRequestSuggestion() {
  const queryClient = useQueryClient();
  const { activeWorkspaceId } = useWorkspace();

  return useMutation({
    mutationFn: async (id: string) => {
      const result = await creatorRequestsApi.submitSuggestion(id);
      if (result.error) {
        throw result.error;
      }
      return result.data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({
        queryKey: creatorRequestsKeys.list('workspace', activeWorkspaceId),
      });
      if (data?.id) {
        queryClient.invalidateQueries({
          queryKey: creatorRequestsKeys.detail(data.id),
        });
      }
      toast.success('Request submitted to agency');
    },
    onError: (error: Error) => {
      toast.error(`Failed to submit request: ${error.message}`);
    },
  });
}

/**
 * Hook to update a suggestion and submit as a request (owner flow)
 */
export function useUpdateSuggestionAndSubmit() {
  const queryClient = useQueryClient();
  const { activeWorkspaceId } = useWorkspace();

  return useMutation({
    mutationFn: async ({
      requestId,
      request,
    }: {
      requestId: string;
      request: CreatorRequestInsert;
    }) => {
      const result = await creatorRequestsApi.updateSuggestionAndSubmit(
        requestId,
        request
      );
      if (result.error) {
        throw result.error;
      }
      return result.data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({
        queryKey: creatorRequestsKeys.list('workspace', activeWorkspaceId),
      });
      if (data?.id) {
        queryClient.invalidateQueries({
          queryKey: creatorRequestsKeys.detail(data.id),
        });
      }
      toast.success('Request submitted successfully');
    },
    onError: (error: Error) => {
      toast.error(`Failed to submit request: ${error.message}`);
    },
  });
}

/**
 * Hook to delete a creator request
 */
export function useDeleteCreatorRequest() {
  const queryClient = useQueryClient();
  const { activeWorkspaceId } = useWorkspace();
  const { isOwner } = useWorkspaceAccess();
  const scope = isOwner ? 'workspace' : 'user';

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
      const previousRequests = queryClient.getQueryData(
        creatorRequestsKeys.list(scope, activeWorkspaceId)
      );

      // Optimistically remove from list
      queryClient.setQueryData(
        creatorRequestsKeys.list(scope, activeWorkspaceId),
        (old: CreatorRequest[] | undefined) => {
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
        queryClient.setQueryData(
          creatorRequestsKeys.list(scope, activeWorkspaceId),
          context.previousRequests
        );
      }
      toast.error(`Failed to delete request: ${error.message}`);
    },
  });
}
