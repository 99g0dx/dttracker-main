import { useQuery } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import type { CampaignSoundPerformance } from '../lib/types/database';

export function useCampaignSoundPerformance(campaignId: string | null) {
  return useQuery<CampaignSoundPerformance[]>({
    queryKey: ['campaign-sound-performance', campaignId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('campaign_sound_performance')
        .select('*')
        .eq('campaign_id', campaignId!)
        .order('post_count', { ascending: false });
      if (error) throw error;
      return (data as CampaignSoundPerformance[]) || [];
    },
    enabled: !!campaignId,
    staleTime: 1000 * 60 * 5,
  });
}
