import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import type { Profile } from '../lib/types/database';
import { toast } from 'sonner';
import { useAuth } from '../contexts/AuthContext';

// Query keys
export const onboardingKeys = {
  all: ['onboarding'] as const,
  profile: (userId: string) => [...onboardingKeys.all, 'profile', userId] as const,
};

/**
 * Hook to fetch user profile including onboarding status
 */
export function useUserProfile() {
  const { user } = useAuth();
  
  return useQuery({
    queryKey: onboardingKeys.profile(user?.id || ''),
    queryFn: async (): Promise<Profile | null> => {
      if (!user?.id) return null;
      
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .single();
      
      if (error) {
        console.error('Error fetching profile:', error);
        throw error;
      }
      
      return data as Profile;
    },
    enabled: !!user?.id,
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
}

/**
 * Hook to check if user needs onboarding
 */
export function useCheckOnboarding() {
  const { data: profile, isLoading } = useUserProfile();
  
  return {
    needsOnboarding: profile ? !profile.onboarding_completed : false,
    isLoading,
    profile,
  };
}

/**
 * Hook to complete onboarding
 */
export function useCompleteOnboarding() {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  
  return useMutation({
    mutationFn: async (data?: { full_name?: string; company?: string }) => {
      if (!user?.id) {
        throw new Error('User not authenticated');
      }
      
      // Update profile with onboarding completion and optional data
      const updateData: any = {
        onboarding_completed: true,
      };
      
      if (data?.full_name) {
        updateData.full_name = data.full_name;
      }
      
      const { data: updatedProfile, error } = await supabase
        .from('profiles')
        .update(updateData)
        .eq('id', user.id)
        .select()
        .single();
      
      if (error) {
        console.error('Error completing onboarding:', error);
        throw error;
      }
      
      return updatedProfile as Profile;
    },
    onSuccess: (data) => {
      // Invalidate profile query to refetch
      queryClient.invalidateQueries({ queryKey: onboardingKeys.profile(user?.id || '') });
      queryClient.setQueryData(onboardingKeys.profile(user?.id || ''), data);
      toast.success('Welcome to DTTracker!');
    },
    onError: (error: Error) => {
      toast.error(`Failed to complete onboarding: ${error.message}`);
    },
  });
}

