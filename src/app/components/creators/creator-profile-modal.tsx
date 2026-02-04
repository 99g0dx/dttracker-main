import React from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '../ui/dialog';
import { Button } from '../ui/button';
import { Heart, ExternalLink } from 'lucide-react';
import { PlatformIcon, getPlatformLabel } from '../ui/PlatformIcon';
import type { CreatorWithSocialAndStats } from '../../../lib/types/database';

interface CreatorProfileModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  creator: CreatorWithSocialAndStats | null;
  isFavorite?: boolean;
  onToggleFavorite?: (creatorId: string) => void;
  onRequest?: (creator: CreatorWithSocialAndStats) => void;
  onAddToActivation?: (creator: CreatorWithSocialAndStats) => void;
  onEdit?: (creator: CreatorWithSocialAndStats) => void;
  onRemove?: (creator: CreatorWithSocialAndStats) => void;
  inMyNetwork?: boolean;
}

function formatFollowers(count: number): string {
  if (count >= 1_000_000) return `${(count / 1_000_000).toFixed(1)}M`;
  if (count >= 1_000) return `${Math.round(count / 1_000)}K`;
  return count.toLocaleString();
}

export function CreatorProfileModal({
  open,
  onOpenChange,
  creator,
  isFavorite = false,
  onToggleFavorite,
  onRequest,
  onAddToActivation,
  onEdit,
  onRemove,
  inMyNetwork = false,
}: CreatorProfileModalProps) {
  if (!creator) return null;

  const photo = (creator as any).profile_photo || (creator as any).profile_url;
  const accounts = (creator as any).creator_social_accounts || [];
  const stats = (creator as any).creator_stats;
  const handle = creator.handle;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-[#0D0D0D] border-white/[0.08] max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-start gap-4">
            <div className="w-20 h-20 rounded-full bg-white/[0.06] flex-shrink-0 overflow-hidden">
              {photo ? (
                <img src={photo} alt="" className="w-full h-full object-cover" />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-3xl font-bold text-slate-500">
                  {(creator.name || handle || '?').charAt(0).toUpperCase()}
                </div>
              )}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <DialogTitle className="text-white truncate">
                  {handle || creator.handle}
                </DialogTitle>
                {onToggleFavorite && !creator.id.startsWith('manual-') && (
                  <button
                    onClick={() => onToggleFavorite(creator.id)}
                    aria-label={isFavorite ? 'Remove from favorites' : 'Add to favorites'}
                    className="p-1 rounded hover:bg-white/[0.06]"
                  >
                    <Heart
                      className={`w-5 h-5 ${
                        isFavorite ? 'fill-rose-500 text-rose-500' : 'text-slate-500'
                      }`}
                    />
                  </button>
                )}
              </div>
              <p className="text-sm text-slate-400 mt-1">
                {creator.name || creator.display_name || 'Creator'}
              </p>
              {inMyNetwork && (
                <span className="inline-block mt-2 text-xs px-2 py-0.5 rounded bg-primary/20 text-primary">
                  In My Network
                </span>
              )}
            </div>
          </div>
        </DialogHeader>

        <div className="space-y-4 mt-4">
          {accounts.length > 0 && (
            <div>
              <h4 className="text-sm font-medium text-slate-400 mb-2">
                Social Accounts
              </h4>
              <div className="space-y-2">
                {accounts.map((acc: any) => (
                  <div
                    key={acc.id}
                    className="flex items-center justify-between py-2 border-b border-white/[0.06]"
                  >
                    <div className="flex items-center gap-2">
                      <PlatformIcon platform={acc.platform} size="sm" />
                      <span className="text-white">{acc.handle}</span>
                    </div>
                    <span className="text-slate-500 text-sm">
                      {formatFollowers(acc.followers || 0)} followers
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {stats && (stats.avg_engagement_rate > 0 || stats.campaigns_completed > 0) && (
            <div>
              <h4 className="text-sm font-medium text-slate-400 mb-2">
                Performance
              </h4>
              <div className="grid grid-cols-2 gap-3">
                {stats.avg_engagement_rate > 0 && (
                  <div className="p-3 rounded-lg bg-white/[0.03]">
                    <p className="text-xs text-slate-500">Avg Engagement</p>
                    <p className="text-lg font-semibold text-emerald-400">
                      {stats.avg_engagement_rate}%
                    </p>
                  </div>
                )}
                {stats.campaigns_completed > 0 && (
                  <div className="p-3 rounded-lg bg-white/[0.03]">
                    <p className="text-xs text-slate-500">Campaigns Completed</p>
                    <p className="text-lg font-semibold text-white">
                      {stats.campaigns_completed}
                    </p>
                  </div>
                )}
                {stats.total_reach > 0 && (
                  <div className="p-3 rounded-lg bg-white/[0.03] col-span-2">
                    <p className="text-xs text-slate-500">Total Reach</p>
                    <p className="text-lg font-semibold text-white">
                      {formatFollowers(stats.total_reach)}
                    </p>
                  </div>
                )}
              </div>
            </div>
          )}

          {(creator.location || creator.niche) && (
            <div>
              <h4 className="text-sm font-medium text-slate-400 mb-2">Details</h4>
              <div className="space-y-1 text-sm text-white">
                {creator.location && (
                  <p>Location: {creator.location}</p>
                )}
                {creator.niche && <p>Niche: {creator.niche}</p>}
              </div>
            </div>
          )}

          {inMyNetwork && (creator.email || creator.phone) && (
            <div>
              <h4 className="text-sm font-medium text-slate-400 mb-2">Contact</h4>
              <div className="space-y-1 text-sm text-white">
                {creator.email && <p>Email: {creator.email}</p>}
                {creator.phone && <p>Phone: {creator.phone}</p>}
              </div>
            </div>
          )}

          {(creator as any).bio && (
            <div>
              <h4 className="text-sm font-medium text-slate-400 mb-2">Bio</h4>
              <p className="text-sm text-slate-300 whitespace-pre-wrap">
                {(creator as any).bio}
              </p>
            </div>
          )}

          <div className="flex flex-wrap gap-2 pt-4 border-t border-white/[0.08]">
            {onRequest && (
              <Button
                onClick={() => onRequest(creator)}
                className="bg-primary text-black hover:bg-primary/90"
              >
                Request Creator
              </Button>
            )}
            {onAddToActivation && !creator.id.startsWith('manual-') && (
              <Button
                variant="outline"
                onClick={() => onAddToActivation(creator)}
                className="border-white/[0.08]"
              >
                Add to Activation
              </Button>
            )}
            {onEdit && inMyNetwork && (
              <Button
                variant="outline"
                onClick={() => onEdit(creator)}
                className="border-white/[0.08]"
              >
                Edit
              </Button>
            )}
            {onRemove && inMyNetwork && (
              <Button
                variant="outline"
                onClick={() => onRemove(creator)}
                className="border-red-500/30 text-red-400 hover:bg-red-500/10"
              >
                Remove
              </Button>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
