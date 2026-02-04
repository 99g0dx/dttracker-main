import React from 'react';
import { Card } from '../ui/card';
import { Button } from '../ui/button';
import { X, ExternalLink, RefreshCw } from 'lucide-react';
import type { Activation } from '../../../lib/types/database';
import { format } from 'date-fns';
import { calculatePerformanceScore } from '../../../lib/utils/contest-prizes';
import { formatCompactNumber } from '../../../lib/utils/format';

interface CreatorPostsModalProps {
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
  onClose: () => void;
  onScrape: (submissionId: string) => void;
  isScraping: boolean;
}

function formatAmount(amount: number): string {
  return new Intl.NumberFormat('en-NG', {
    style: 'currency',
    currency: 'NGN',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
}

export function CreatorPostsModal({
  creatorHandle,
  submissions,
  activation,
  onClose,
  onScrape,
  isScraping,
}: CreatorPostsModalProps) {
  const m = (metrics: Record<string, unknown> | null) => {
    if (!metrics) return { views: 0, likes: 0, comments: 0 };
    return {
      views: Number(metrics.views) || 0,
      likes: Number(metrics.likes) || 0,
      comments: Number(metrics.comments) || 0,
    };
  };

  const totalViews = submissions.reduce(
    (s, sub) => s + m(sub.performance_metrics).views,
    0
  );
  const totalLikes = submissions.reduce(
    (s, sub) => s + m(sub.performance_metrics).likes,
    0
  );
  const totalComments = submissions.reduce(
    (s, sub) => s + m(sub.performance_metrics).comments,
    0
  );
  const totalScore = calculatePerformanceScore(
    totalViews,
    totalLikes,
    totalComments
  );

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
      <Card className="bg-[#0D0D0D] border-white/[0.08] w-full max-w-lg max-h-[90vh] overflow-hidden flex flex-col">
        <div className="flex items-center justify-between p-4 border-b border-white/[0.08]">
          <h3 className="text-lg font-semibold text-white">
            @{creatorHandle} – All Submissions
          </h3>
          <button
            onClick={onClose}
            className="p-2 rounded-md hover:bg-white/[0.06] text-slate-400"
            aria-label="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="overflow-y-auto flex-1 p-4 space-y-4">
          {submissions.map((sub, idx) => {
            const metrics = m(sub.performance_metrics);
            const score =
              sub.performance_score ??
              calculatePerformanceScore(
                metrics.views,
                metrics.likes,
                metrics.comments
              );
            const platform =
              (sub.content_url?.includes('tiktok') && 'TikTok') ||
              (sub.content_url?.includes('instagram') && 'Instagram') ||
              (sub.content_url?.includes('youtube') && 'YouTube') ||
              'Social';
            return (
              <div
                key={sub.id}
                className="rounded-lg bg-white/[0.03] border border-white/[0.06] p-4"
              >
                <p className="text-xs text-slate-500 mb-2">
                  Post {idx + 1}/{submissions.length} • {platform}
                </p>
                {sub.content_url && (
                  <a
                    href={sub.content_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-primary hover:underline text-sm break-all"
                  >
                    {sub.content_url}
                  </a>
                )}
                <p className="text-xs text-slate-500 mt-1">
                  Posted: {format(new Date(sub.submitted_at), 'MMM d, yyyy')}
                </p>
                <div className="flex flex-wrap gap-4 mt-3 text-sm text-slate-400">
                  <span>👁 {formatCompactNumber(metrics.views)} views</span>
                  <span>❤️ {formatCompactNumber(metrics.likes)} likes</span>
                  <span>💬 {formatCompactNumber(metrics.comments)} comments</span>
                </div>
                <p className="text-xs text-slate-500 mt-1">
                  Score contribution: {score.toLocaleString()}
                </p>
                <div className="flex gap-2 mt-3">
                  {sub.content_url && (
                    <a
                      href={sub.content_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 text-sm text-primary hover:underline"
                    >
                      View Post <ExternalLink className="w-3 h-3" />
                    </a>
                  )}
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => onScrape(sub.id)}
                    disabled={isScraping}
                    className="h-7 text-xs"
                  >
                    {isScraping ? (
                      <RefreshCw className="w-3 h-3 animate-spin mr-1" />
                    ) : (
                      <RefreshCw className="w-3 h-3 mr-1" />
                    )}
                    Scrape Now
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
        <div className="p-4 border-t border-white/[0.08] flex flex-col gap-3">
          <p className="text-sm text-slate-400">
            Total Performance: 👁 {formatCompactNumber(totalViews)} views • ❤️{' '}
            {formatCompactNumber(totalLikes)} likes • 💬{' '}
            {formatCompactNumber(totalComments)} comments
          </p>
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              for (const s of submissions) {
                onScrape(s.id);
              }
            }}
            disabled={isScraping}
            className="w-full border-white/[0.08]"
          >
            {isScraping ? (
              <RefreshCw className="w-4 h-4 animate-spin mr-2" />
            ) : (
              <RefreshCw className="w-4 h-4 mr-2" />
            )}
            Scrape All Posts
          </Button>
        </div>
      </Card>
    </div>
  );
}
