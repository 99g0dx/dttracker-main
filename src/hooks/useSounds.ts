import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import * as soundsApi from '../lib/api/sounds'
import { toast } from 'sonner'
import type { Sound, SoundVideo, SoundWithVideos } from '../lib/types/database'

// Query keys
export const soundsKeys = {
  all: ['sounds'] as const,
  lists: () => [...soundsKeys.all, 'list'] as const,
  list: () => [...soundsKeys.lists()] as const,
  details: () => [...soundsKeys.all, 'detail'] as const,
  detail: (id: string) => [...soundsKeys.details(), id] as const,
  videos: (id: string) => [...soundsKeys.all, 'videos', id] as const,
}

/**
 * Hook to fetch all sounds for current user
 */
export function useSounds() {
  return useQuery({
    queryKey: soundsKeys.list(),
    queryFn: async () => {
      const result = await soundsApi.list()
      if (result.error) throw result.error
      return result.data || []
    },
    staleTime: 1000 * 60 * 5, // 5 minutes
  })
}

/**
 * Hook to fetch a single sound
 */
export function useSound(soundId: string | null | undefined) {
  return useQuery({
    queryKey: soundsKeys.detail(soundId || ''),
    queryFn: async () => {
      if (!soundId) return null
      const result = await soundsApi.getById(soundId)
      if (result.error) throw result.error
      return result.data
    },
    enabled: !!soundId,
    staleTime: 1000 * 60 * 5, // 5 minutes
  })
}

/**
 * Hook to fetch sound videos with sorting
 */
export function useSoundVideos(
  soundId: string | null | undefined,
  sortBy: 'views' | 'engagement' | 'recent' = 'views'
) {
  return useQuery({
    queryKey: [...soundsKeys.videos(soundId || ''), sortBy],
    queryFn: async () => {
      if (!soundId) return []
      const result = await soundsApi.getVideos(soundId, sortBy)
      if (result.error) throw result.error
      return result.data || []
    },
    enabled: !!soundId,
    staleTime: 1000 * 60 * 5, // 5 minutes
  })
}

/**
 * Hook to delete a sound
 */
export function useDeleteSound() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (soundId: string) => {
      const result = await soundsApi.deleteSound(soundId)
      if (result.error) throw result.error
      return soundId
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: soundsKeys.lists() })
      toast.success('Sound deleted successfully')
    },
    onError: (error: Error) => {
      toast.error(`Failed to delete sound: ${error.message}`)
    },
  })
}

/**
 * Hook to link a sound to a campaign
 */
export function useLinkSoundToCampaign() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({
      campaignId,
      soundId,
      soundUrl,
    }: {
      campaignId: string
      soundId: string
      soundUrl?: string
    }) => {
      const result = await soundsApi.linkToCampaign(campaignId, soundId, soundUrl)
      if (result.error) throw result.error
      return { campaignId, soundId }
    },
    onSuccess: ({ campaignId }) => {
      queryClient.invalidateQueries({
        queryKey: ['campaigns', 'detail', campaignId],
      })
      toast.success('Sound linked to campaign successfully')
    },
    onError: (error: Error) => {
      toast.error(`Failed to link sound: ${error.message}`)
    },
  })
}

/**
 * Hook to unlink a sound from a campaign
 */
export function useUnlinkSoundFromCampaign() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (campaignId: string) => {
      const result = await soundsApi.unlinkFromCampaign(campaignId)
      if (result.error) throw result.error
      return campaignId
    },
    onSuccess: (campaignId) => {
      queryClient.invalidateQueries({
        queryKey: ['campaigns', 'detail', campaignId],
      })
      toast.success('Sound unlinked from campaign')
    },
    onError: (error: Error) => {
      toast.error(`Failed to unlink sound: ${error.message}`)
    },
  })
}

/**
 * Hook to refresh sound indexing
 */
export function useRefreshSound() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (soundId: string) => {
      const result = await soundsApi.refreshSound(soundId)
      if (result.error) throw result.error
      return soundId
    },
    onSuccess: (soundId) => {
      queryClient.invalidateQueries({ queryKey: soundsKeys.detail(soundId) })
      queryClient.invalidateQueries({ queryKey: soundsKeys.videos(soundId) })
      toast.success('Sound refresh started')
    },
    onError: (error: Error) => {
      toast.error(`Failed to refresh sound: ${error.message}`)
    },
  })
}
