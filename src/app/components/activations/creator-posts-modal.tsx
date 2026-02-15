import React from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '../ui/dialog';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import {
  ExternalLink,
  RefreshCw,
  Eye,
  Heart,
  MessageCircle,
  Trophy,
} from 'lucide-react';
import {
  PlatformIcon,
  getPlatformLabel,
  type PlatformIconName,
} from '../ui/PlatformIcon';
import type { Activation } from '../../../lib/types/database';
import { format } from 'date-fns';
import { calculatePerformanceScore } from '../../../lib/utils/contest-prizes';
import { formatCompactNumber } from '../../../lib/utils/format';

interface CreatorPostsModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  creatorHandle: string;
  creatorId: string | null;
  submissions: Array<{
    id: string;
    content_url: string | null;
    performance_metrics: Record<string, unknown> | null;
    performance_score: number | null;
    submitted_at: string;
  }>;
  activation: Activation;
  onScrape: (submissionId: string) => void;
  isScraping: boolean;
}

function parseMetrics(metrics: Record<string, unknown> | null) {
  if (!metrics) return { views: 0, likes: 0, comments: 0 };
  return {
    views: Number(metrics.views) || 0,
    likes: Number(metrics.likes) || 0,
    comments: Number(metrics.comments) || 0,
  };
}

function detectPlatform(url: string | null): PlatformIconName | null {
  if (!url) return null;
  if (url.includes('tiktok')) return 'tiktok';
  if (url.includes('instagram')) return 'instagram';
  if (url.includes('youtube') || url.includes('youtu.be')) return 'youtube';
  if (url.includes('twitter') || url.includes('x.com')) return 'x';
  if (url.includes('facebook')) return 'facebook';
  return null;
}

export function CreatorPostsModal({
  open,
  onOpenChange,
  creatorHandle,
  submissions,
  onScrape,
  isScraping,
}: CreatorPostsModalProps) {
  const totalViews = submissions.reduce(
    (s, sub) => s + parseMetrics(sub.performance_metrics).views,
    0
  );
  const totalLikes = submissions.reduce(
    (s, sub) => s + parseMetrics(sub.performance_metrics).likes,
    0
  );
  const totalComments = submissions.reduce(
    (s, sub) => s + parseMetrics(sub.performance_metrics).comments,
    0
  );
  const totalScore = calculatePerformanceScore(
    totalViews,
    totalLikes,
    totalComments
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-[#0D0D0D] border-white/[0.08] max-w-lg max-h-[85dvh] flex flex-col gap-0 p-0">
        {/* Header */}
        <DialogHeader className="p-4 sm:p-5 pb-3 sm:pb-4 border-b border-white/[0.08]">
          <DialogTitle className="text-foreground">
            @{creatorHandle}
          </DialogTitle>
          <DialogDescription>
            {submissions.length} submission
            {submissions.length !== 1 ? 's' : ''} in this activation
          </DialogDescription>
        </DialogHeader>

        {/* Scrollable body */}
        <div className="overflow-y-auto flex-1 p-4 sm:p-5 space-y-3">
          {submissions.map((sub, idx) => {
            const metrics = parseMetrics(sub.performance_metrics);
            const score =
              sub.performance_score ??
              calculatePerformanceScore(
                metrics.views,
                metrics.likes,
                metrics.comments
              );
            const platform = detectPlatform(sub.content_url);
            const platformLabel = platform
              ? getPlatformLabel(platform)
              : 'Post';

            return (
              <div
                key={sub.id}
                className="rounded-xl bg-white/[0.03] border border-white/[0.06] p-4 space-y-3"
              >
                {/* Top row: platform + date | score badge */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    {platform && (
                      <PlatformIcon platform={platform} size="sm" />
                    )}
                    <span className="text-sm text-muted-foreground">
                      {platformLabel} {idx + 1}
                    </span>
                    <span className="text-xs text-slate-500">
                      {format(new Date(sub.submitted_at), 'MMM d, yyyy')}
                    </span>
                  </div>
                  <Badge
                    variant="secondary"
                    className="bg-amber-500/10 text-amber-400 border-0 text-xs font-semibold"
                  >
                    <Trophy className="w-3 h-3" />
                    {formatCompactNumber(score)}
                  </Badge>
                </div>

                {/* Metrics row */}
                <div className="flex flex-wrap gap-2">
                  <div className="flex items-center gap-1.5 rounded-md bg-primary/10 px-2.5 py-1">
                    <Eye className="w-3.5 h-3.5 text-primary" />
                    <span className="text-xs font-medium text-primary">
                      {formatCompactNumber(metrics.views)}
                    </span>
                  </div>
                  <div className="flex items-center gap-1.5 rounded-md bg-pink-500/10 px-2.5 py-1">
                    <Heart className="w-3.5 h-3.5 text-pink-400" />
                    <span className="text-xs font-medium text-pink-400">
                      {formatCompactNumber(metrics.likes)}
                    </span>
                  </div>
                  <div className="flex items-center gap-1.5 rounded-md bg-cyan-500/10 px-2.5 py-1">
                    <MessageCircle className="w-3.5 h-3.5 text-cyan-400" />
                    <span className="text-xs font-medium text-cyan-400">
                      {formatCompactNumber(metrics.comments)}
                    </span>
                  </div>
                </div>

                {/* Actions row */}
                <div className="flex items-center justify-between pt-1">
                  {sub.content_url ? (
                    <a
                      href={sub.content_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 text-sm text-primary hover:text-primary/80 transition-colors"
                    >
                      <ExternalLink className="w-3.5 h-3.5" />
                      View Post
                    </a>
                  ) : (
                    <span className="text-xs text-slate-500">No URL</span>
                  )}
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => onScrape(sub.id)}
                    disabled={isScraping}
                    className="h-7 text-xs text-muted-foreground hover:text-foreground"
                  >
                    <RefreshCw
                      className={`w-3 h-3 mr-1 ${isScraping ? 'animate-spin' : ''}`}
                    />
                    Scrape
                  </Button>
                </div>
              </div>
            );
          })}
        </div>

        {/* Footer */}
        <div className="border-t border-white/[0.08] p-4 sm:p-5 space-y-4">
          {/* Summary metrics grid */}
          <div className="grid grid-cols-3 gap-2">
            <div className="rounded-lg bg-primary/5 border border-primary/10 p-2.5 text-center">
              <Eye className="w-4 h-4 text-primary mx-auto mb-1" />
              <p className="text-sm font-semibold text-foreground">
                {formatCompactNumber(totalViews)}
              </p>
              <p className="text-[10px] text-muted-foreground">Views</p>
            </div>
            <div className="rounded-lg bg-pink-500/5 border border-pink-500/10 p-2.5 text-center">
              <Heart className="w-4 h-4 text-pink-400 mx-auto mb-1" />
              <p className="text-sm font-semibold text-foreground">
                {formatCompactNumber(totalLikes)}
              </p>
              <p className="text-[10px] text-muted-foreground">Likes</p>
            </div>
            <div className="rounded-lg bg-cyan-500/5 border border-cyan-500/10 p-2.5 text-center">
              <MessageCircle className="w-4 h-4 text-cyan-400 mx-auto mb-1" />
              <p className="text-sm font-semibold text-foreground">
                {formatCompactNumber(totalComments)}
              </p>
              <p className="text-[10px] text-muted-foreground">Comments</p>
            </div>
          </div>

          {/* Total score */}
          <div className="flex items-center justify-center gap-2 text-sm">
            <Trophy className="w-4 h-4 text-amber-400" />
            <span className="text-muted-foreground">Total Score:</span>
            <span className="font-bold text-amber-400">
              {totalScore.toLocaleString()}
            </span>
          </div>

          {/* Scrape All button */}
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              for (const s of submissions) {
                onScrape(s.id);
              }
            }}
            disabled={isScraping}
            className="w-full border-white/[0.08] hover:bg-white/[0.04]"
          >
            <RefreshCw
              className={`w-4 h-4 mr-2 ${isScraping ? 'animate-spin' : ''}`}
            />
            Scrape All Posts
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
