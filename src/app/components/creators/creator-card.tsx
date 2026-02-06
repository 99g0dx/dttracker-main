import React from 'react';
import { Card, CardContent } from '../ui/card';
import { Button } from '../ui/button';
import { Heart, ExternalLink } from 'lucide-react';
import { PlatformIcon, getPlatformLabel } from '../ui/PlatformIcon';
import { CreatorHandleLink } from '../ui/creator-handle-link';
import { FollowersIcon, LocationIcon, EngagementIcon } from '../ui/platform-custom-icons';
import type { CreatorWithSocialAndStats } from '../../../lib/types/database';

interface CreatorCardProps {
  creator: CreatorWithSocialAndStats;
  source: 'my_network' | 'discover' | 'favorites';
  isFavorite?: boolean;
  onToggleFavorite?: (creatorId: string) => void;
  onViewProfile?: (creator: CreatorWithSocialAndStats) => void;
  onRequest?: (creator: CreatorWithSocialAndStats) => void;
  onAddToActivation?: (creator: CreatorWithSocialAndStats) => void;
  isManual?: boolean;
  selectable?: boolean;
  selected?: boolean;
  onSelect?: (creatorId: string, selected: boolean) => void;
}

function formatFollowers(count: number): string {
  if (count >= 1_000_000) return `${(count / 1_000_000).toFixed(1)}M`;
  if (count >= 1_000) return `${Math.round(count / 1_000)}K`;
  return count.toLocaleString();
}

export function CreatorCard({
  creator,
  source,
  isFavorite = false,
  onToggleFavorite,
  onViewProfile,
  onRequest,
  onAddToActivation,
  isManual = false,
  selectable = false,
  selected = false,
  onSelect,
}: CreatorCardProps) {
  const photo =
    (creator as any).profile_photo || (creator as any).profile_url || null;
  const primaryAccount =
    (creator as any).creator_social_accounts?.[0] || creator;
  const handle = primaryAccount?.handle || creator.handle;
  const followers =
    primaryAccount?.followers ?? creator.follower_count ?? 0;
  const stats = (creator as any).creator_stats;
  const campaignsCompleted = stats?.campaigns_completed ?? 0;
  const avgEngagement =
    stats?.avg_engagement_rate ?? creator.avg_engagement ?? 0;
  const creatorId = creator.id.startsWith('manual-')
    ? creator._workspace_creator_id || creator.id
    : creator.id;
  const canFavorite = !isManual && creatorId && !creator.id.startsWith('manual-');

  return (
    <Card
      className={`bg-[#0D0D0D] border-white/[0.08] active:border-white/[0.12] transition-all duration-150 overflow-hidden rounded-xl ${
        selected ? 'ring-2 ring-primary' : ''
      }`}
      style={{ boxShadow: 'var(--shadow-card)' }}
      onClick={
        selectable && onSelect
          ? () => onSelect(creator.id, !selected)
          : undefined
      }
    >
      <CardContent className="p-3 min-[400px]:p-3.5 sm:p-4 lg:p-5">
        <div className="flex items-start justify-between gap-1.5 sm:gap-2 mb-2.5 sm:mb-3 lg:mb-4">
          <div className="flex items-center gap-1.5 sm:gap-2 min-w-0">
            {selectable && onSelect && (
              <input
                type="checkbox"
                checked={selected}
                onChange={(e) => {
                  e.stopPropagation();
                  onSelect(creator.id, e.target.checked);
                }}
                onClick={(e) => e.stopPropagation()}
                className="w-3.5 h-3.5 sm:w-4 sm:h-4 rounded border-white/[0.2] bg-white/[0.03] flex-shrink-0"
              />
            )}
            <span className="text-[9px] min-[400px]:text-[10px] sm:text-xs text-slate-500 capitalize truncate">
              {source === 'my_network' ? 'My Network' : source}
            </span>
          </div>
          {canFavorite && onToggleFavorite && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                onToggleFavorite(creator.id);
              }}
              className="p-1 rounded hover:bg-white/[0.06] transition-colors"
              aria-label={isFavorite ? 'Remove from favorites' : 'Add to favorites'}
            >
              <Heart
                className={`w-4 h-4 ${
                  isFavorite ? 'fill-rose-500 text-rose-500' : 'text-slate-500'
                }`}
              />
            </button>
          )}
        </div>

        <div className="flex gap-2.5 sm:gap-3 lg:gap-4 mb-3 sm:mb-4 lg:mb-5">
          <div className="w-12 h-12 min-[400px]:w-14 min-[400px]:h-14 sm:w-16 sm:h-16 rounded-xl bg-gradient-to-br from-white/[0.08] to-white/[0.04] flex-shrink-0 overflow-hidden border border-white/[0.06]">
            {photo ? (
              <img
                src={photo}
                alt=""
                className="w-full h-full object-cover"
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-lg min-[400px]:text-xl sm:text-2xl font-bold text-slate-400">
                {(creator.name || handle || '?').charAt(0).toUpperCase()}
              </div>
            )}
          </div>
          <div className="min-w-0 flex-1">
            <CreatorHandleLink
              handle={handle || creator.handle}
              platform={creator.platform}
              className="font-semibold text-white truncate block hover:underline text-xs min-[400px]:text-sm mb-0.5"
            />
            <p className="text-[10px] min-[400px]:text-xs sm:text-sm text-slate-400 truncate">
              {creator.name || creator.display_name || 'Creator'}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-1.5 sm:gap-2 text-[9px] min-[400px]:text-[10px] sm:text-xs text-slate-400 mb-2 sm:mb-2.5 lg:mb-3">
          <PlatformIcon platform={creator.platform} size="sm" />
          <span className="font-medium truncate">{getPlatformLabel(creator.platform)}</span>
          {creator.niche && (
            <>
              <span className="hidden lg:inline">•</span>
              <span className="hidden lg:inline truncate">{creator.niche}</span>
            </>
          )}
        </div>

        <div className="space-y-1 sm:space-y-1.5 lg:space-y-2 mb-2.5 sm:mb-3 lg:mb-4">
          <div className="flex items-center gap-1.5 sm:gap-2 text-[10px] min-[400px]:text-xs sm:text-sm text-slate-300">
            <FollowersIcon className="w-3 h-3 min-[400px]:w-3.5 min-[400px]:h-3.5 sm:w-4 sm:h-4 text-slate-500 flex-shrink-0" />
            <span className="font-medium">{formatFollowers(followers)}</span>
            <span className="text-slate-500 text-[9px] min-[400px]:text-[10px] sm:text-xs">followers</span>
          </div>
          {creator.location && (
            <div className="flex items-center gap-1.5 sm:gap-2 text-[10px] min-[400px]:text-xs sm:text-sm text-slate-400">
              <LocationIcon className="w-3 h-3 min-[400px]:w-3.5 min-[400px]:h-3.5 sm:w-4 sm:h-4 text-slate-500 flex-shrink-0" />
              <span className="truncate">{creator.location}</span>
            </div>
          )}
          {(campaignsCompleted > 0 || avgEngagement > 0) && (
            <div className="flex items-center gap-1.5 sm:gap-2 text-[10px] min-[400px]:text-xs sm:text-sm text-slate-400">
              <EngagementIcon className="w-3 h-3 min-[400px]:w-3.5 min-[400px]:h-3.5 sm:w-4 sm:h-4 text-slate-500 flex-shrink-0" />
              <span className="truncate">
                {avgEngagement > 0 ? `${avgEngagement}%` : ''}
                {campaignsCompleted > 0 && avgEngagement > 0 ? ' • ' : ''}
                {campaignsCompleted > 0 ? `${campaignsCompleted} campaigns` : ''}
              </span>
            </div>
          )}
        </div>

        <div className="flex flex-col sm:flex-row flex-wrap gap-1.5 sm:gap-2 pt-2 sm:pt-2.5 lg:pt-3 border-t border-white/[0.06]">
          {onViewProfile && !isManual && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => onViewProfile(creator)}
              className="border-white/[0.08] text-[10px] min-[400px]:text-xs h-9 sm:h-8 hover:bg-white/[0.06] active:bg-white/[0.08] transition-all duration-150"
            >
              View Profile
            </Button>
          )}
          {onRequest && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => onRequest(creator)}
              className="border-white/[0.08] text-[10px] min-[400px]:text-xs h-9 sm:h-8 hover:bg-white/[0.06] active:bg-white/[0.08] transition-all duration-150"
            >
              Request
            </Button>
          )}
          {onAddToActivation && !isManual && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => onAddToActivation(creator)}
              className="border-white/[0.08] text-[10px] min-[400px]:text-xs h-9 sm:h-8 hover:bg-white/[0.06] active:bg-white/[0.08] transition-all duration-150"
            >
              Add to Activation
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
