import React from 'react';
import { Card, CardContent } from '../ui/card';
import { Button } from '../ui/button';
import { Heart, ExternalLink } from 'lucide-react';
import { PlatformIcon, getPlatformLabel } from '../ui/PlatformIcon';
import { CreatorHandleLink } from '../ui/creator-handle-link';
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
      className={`bg-[#0D0D0D] border-white/[0.08] hover:border-white/[0.12] transition-colors overflow-hidden ${
        selected ? 'ring-2 ring-primary' : ''
      }`}
      onClick={
        selectable && onSelect
          ? () => onSelect(creator.id, !selected)
          : undefined
      }
    >
      <CardContent className="p-4">
        <div className="flex items-start justify-between gap-2 mb-3">
          <div className="flex items-center gap-2">
            {selectable && onSelect && (
              <input
                type="checkbox"
                checked={selected}
                onChange={(e) => {
                  e.stopPropagation();
                  onSelect(creator.id, e.target.checked);
                }}
                onClick={(e) => e.stopPropagation()}
                className="w-4 h-4 rounded border-white/[0.2] bg-white/[0.03]"
              />
            )}
            <span className="text-xs text-slate-500 capitalize">
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

        <div className="flex gap-4 mb-4">
          <div className="w-16 h-16 rounded-full bg-white/[0.06] flex-shrink-0 overflow-hidden">
            {photo ? (
              <img
                src={photo}
                alt=""
                className="w-full h-full object-cover"
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-2xl font-bold text-slate-500">
                {(creator.name || handle || '?').charAt(0).toUpperCase()}
              </div>
            )}
          </div>
          <div className="min-w-0 flex-1">
            <CreatorHandleLink
              handle={handle || creator.handle}
              platform={creator.platform}
              className="font-semibold text-white truncate block hover:underline text-sm"
            />
            <p className="text-sm text-slate-400 truncate">
              {creator.name || creator.display_name || 'Creator'}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 text-sm text-slate-400 mb-2">
          <PlatformIcon platform={creator.platform} size="sm" />
          <span>{getPlatformLabel(creator.platform)}</span>
          {creator.niche && (
            <>
              <span>•</span>
              <span>{creator.niche}</span>
            </>
          )}
        </div>

        <div className="flex items-center gap-2 text-sm text-slate-500 mb-3">
          <span>👥 {formatFollowers(followers)} followers</span>
          {creator.location && (
            <>
              <span>•</span>
              <span>📍 {creator.location}</span>
            </>
          )}
        </div>

        {(campaignsCompleted > 0 || avgEngagement > 0) && (
          <p className="text-xs text-slate-500 mb-3">
            📊 {avgEngagement > 0 ? `${avgEngagement}% avg engagement` : ''}
            {campaignsCompleted > 0
              ? ` • ${campaignsCompleted} campaigns completed`
              : ''}
          </p>
        )}

        <div className="flex flex-wrap gap-2">
          {onViewProfile && !isManual && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => onViewProfile(creator)}
              className="border-white/[0.08] text-xs"
            >
              View Profile
            </Button>
          )}
          {onRequest && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => onRequest(creator)}
              className="border-white/[0.08] text-xs"
            >
              Request
            </Button>
          )}
          {onAddToActivation && !isManual && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => onAddToActivation(creator)}
              className="border-white/[0.08] text-xs"
            >
              Add to Activation
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
