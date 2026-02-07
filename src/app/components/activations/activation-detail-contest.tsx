import React, { useState, useMemo } from 'react';
import { Card, CardContent } from '../ui/card';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import {
  ArrowLeft,
  Trophy,
  Calendar,
  ExternalLink,
  RefreshCw,
  Search,
  Download,
} from 'lucide-react';
import {
  useContestLeaderboard,
  useScrapeSubmission,
} from '../../../hooks/useActivations';
import { CreatorPostsModal } from './creator-posts-modal';
import type { Activation, LeaderboardEntry } from '../../../lib/types/database';
import { format } from 'date-fns';
import { formatCompactNumber } from '../../../lib/utils/format';
import { PlatformIcon } from '../ui/PlatformIcon';

interface ActivationDetailContestProps {
  activation: Activation;
  onNavigate: (path: string) => void;
}

function formatAmount(amount: number): string {
  return new Intl.NumberFormat('en-NG', {
    style: 'currency',
    currency: 'NGN',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
}

function rankEmoji(rank: number): string {
  if (rank === 1) return '🥇';
  if (rank === 2) return '🥈';
  if (rank === 3) return '🥉';
  return String(rank);
}

export function ActivationDetailContest({
  activation,
  onNavigate,
}: ActivationDetailContestProps) {
  const { data: leaderboardData, isLoading } =
    useContestLeaderboard(activation.id);
  const scrapeSubmission = useScrapeSubmission(activation.id);

  const [searchQuery, setSearchQuery] = useState('');
  const [viewPostsEntry, setViewPostsEntry] =
    useState<LeaderboardEntry | null>(null);

  const leaderboard = leaderboardData?.leaderboard ?? [];
  const totalEntries = leaderboard.reduce((s, e) => s + e.total_posts, 0);

  const filteredLeaderboard = useMemo(() => {
    if (!searchQuery.trim()) return leaderboard;
    const q = searchQuery.toLowerCase().trim();
    return leaderboard.filter((e) =>
      (e.creator_handle ?? '').toLowerCase().includes(q)
    );
  }, [leaderboard, searchQuery]);

  const statusConfig: Record<string, string> = {
    draft: 'Draft',
    live: 'Live',
    completed: 'Completed',
    cancelled: 'Cancelled',
  };
  const statusLabel = statusConfig[activation.status] ?? activation.status;

  const handleExportCSV = () => {
    const headers = [
      'Rank',
      'Creator',
      'Posts',
      'Views',
      'Likes',
      'Comments',
      'Score',
      'Prize',
      'Is Winner',
    ];
    const rows = leaderboard.map((e) => [
      e.current_rank,
      `@${e.creator_handle ?? 'Unknown'}`,
      e.total_posts,
      e.total_views,
      e.total_likes,
      e.total_comments,
      e.cumulative_score,
      e.is_winner ? formatAmount(e.prize_amount) : '-',
      e.is_winner ? 'Yes' : 'No',
    ]);
    const csv =
      [headers.join(','), ...rows.map((r) => r.join(','))].join('\n') + '\n';
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${activation.title.replace(/\s+/g, '-')}-leaderboard.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleRefreshAll = async () => {
    const ids = leaderboard.flatMap((e) => e.submissionIds);
    for (const id of ids) {
      await scrapeSubmission.mutateAsync(id).catch(() => {});
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <button
          onClick={() => onNavigate('/activations')}
          className="w-11 h-11 rounded-md bg-muted/60 hover:bg-muted/80 border border-border flex items-center justify-center"
        >
          <ArrowLeft className="w-4 h-4" />
        </button>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <Trophy className="w-5 h-5 text-amber-500 dark:text-amber-400 flex-shrink-0" />
            <span className="text-xs text-muted-foreground">Contest</span>
          </div>
          <h1 className="text-xl font-semibold text-foreground truncate">
            {activation.title}
          </h1>
          <p className="text-sm text-muted-foreground">
            {totalEntries} total entries • {activation.winner_count ?? 20} winners
          </p>
          {activation.platforms && activation.platforms.length > 0 && (
            <div className="flex flex-wrap gap-1.5 mt-2">
              {activation.platforms.map((p) => (
                <div
                  key={p}
                  className="flex items-center gap-1 rounded-md bg-muted/80 px-2 py-0.5"
                >
                  <PlatformIcon
                    platform={
                      p as 'tiktok' | 'instagram' | 'youtube' | 'x' | 'facebook'
                    }
                    size="sm"
                  />
                  <span className="text-xs text-muted-foreground capitalize">{p}</span>
                </div>
              ))}
            </div>
          )}
        </div>
        <span
          className={`text-xs font-medium px-2 py-1 rounded border ${
            activation.status === 'live'
              ? 'bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 border-emerald-500/30'
              : activation.status === 'completed'
                ? 'bg-red-100/70 dark:bg-blue-500/20 text-red-700 dark:text-blue-400 border-red-200 dark:border-blue-500/30'
                : 'bg-slate-500/20 text-muted-foreground border-slate-500/30'
          }`}
        >
          {statusLabel}
        </span>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Card className="bg-card border-border">
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground">Deadline</p>
            <p className="font-medium text-foreground flex items-center gap-2 mt-1">
              <Calendar className="w-4 h-4" />
              {format(new Date(activation.deadline), 'MMM d, yyyy')}
            </p>
          </CardContent>
        </Card>
        <Card className="bg-card border-border">
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground">Prize Pool</p>
            <p className="font-medium text-foreground mt-1">
              {formatAmount(activation.total_budget)}
            </p>
          </CardContent>
        </Card>
        <Card className="bg-card border-border">
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground">Winners</p>
            <p className="font-medium text-foreground mt-1">
              {activation.winner_count ?? 20}
            </p>
          </CardContent>
        </Card>
      </div>

      {activation.brief && (
        <Card className="bg-card border-border">
          <CardContent className="p-6">
            <h3 className="text-sm font-medium text-muted-foreground mb-2">Brief</h3>
            <p className="text-foreground whitespace-pre-wrap">{activation.brief}</p>
          </CardContent>
        </Card>
      )}

      <Card className="bg-card border-border">
        <CardContent className="p-6">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-4">
            <p className="text-sm text-muted-foreground">
              Top 20 Win Prizes • {totalEntries} Total Entries
            </p>
            <div className="flex flex-wrap gap-2">
              <div className="relative flex-1 sm:flex-initial sm:w-48">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search creator..."
                  className="pl-9 h-9 bg-muted/70 border-border text-foreground"
                />
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={handleRefreshAll}
                disabled={scrapeSubmission.isPending}
                className="border-border"
              >
                {scrapeSubmission.isPending ? (
                  <RefreshCw className="w-4 h-4 animate-spin mr-2" />
                ) : (
                  <RefreshCw className="w-4 h-4 mr-2" />
                )}
                Refresh
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={handleExportCSV}
                disabled={leaderboard.length === 0}
                className="border-border"
              >
                <Download className="w-4 h-4 mr-2" />
                Export
              </Button>
            </div>
          </div>

          {isLoading ? (
            <div className="py-12 text-center">
              <p className="text-muted-foreground">Loading leaderboard...</p>
            </div>
          ) : filteredLeaderboard.length === 0 ? (
            <div className="py-12 text-center">
              <p className="text-muted-foreground">No submissions yet</p>
              <p className="text-muted-foreground text-sm mt-1">
                Submissions will appear when creators submit from Dobble Tap
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border">
                    <th className="text-left py-3 px-2 text-muted-foreground font-medium">
                      Rank
                    </th>
                    <th className="text-left py-3 px-2 text-muted-foreground font-medium">
                      Creator
                    </th>
                    <th className="text-right py-3 px-2 text-muted-foreground font-medium">
                      Posts
                    </th>
                    <th className="text-right py-3 px-2 text-muted-foreground font-medium">
                      Views
                    </th>
                    <th className="text-right py-3 px-2 text-muted-foreground font-medium">
                      Likes
                    </th>
                    <th className="text-right py-3 px-2 text-muted-foreground font-medium">
                      Comments
                    </th>
                    <th className="text-right py-3 px-2 text-muted-foreground font-medium">
                      Score
                    </th>
                    <th className="text-right py-3 px-2 text-muted-foreground font-medium">
                      Prize
                    </th>
                    <th className="text-right py-3 px-2 text-muted-foreground font-medium">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {filteredLeaderboard.map((entry) => (
                    <tr
                      key={
                        entry.creator_id ??
                        `${entry.creator_handle}:${entry.creator_platform}`
                      }
                      className={`border-b border-border/60 ${
                        entry.is_winner ? 'bg-emerald-500/5' : ''
                      }`}
                    >
                      <td className="py-3 px-2">
                        <span className="font-medium text-foreground">
                          {rankEmoji(entry.current_rank)}
                        </span>
                      </td>
                      <td className="py-3 px-2 font-medium text-foreground">
                        @{entry.creator_handle ?? 'Unknown'}
                      </td>
                      <td className="py-3 px-2 text-right text-foreground">
                        {entry.total_posts}
                      </td>
                      <td className="py-3 px-2 text-right text-foreground">
                        {formatCompactNumber(entry.total_views)}
                      </td>
                      <td className="py-3 px-2 text-right text-foreground">
                        {formatCompactNumber(entry.total_likes)}
                      </td>
                      <td className="py-3 px-2 text-right text-foreground">
                        {formatCompactNumber(entry.total_comments)}
                      </td>
                      <td className="py-3 px-2 text-right text-foreground">
                        {entry.cumulative_score.toLocaleString()}
                      </td>
                      <td className="py-3 px-2 text-right">
                        {entry.is_winner ? (
                          <span className="text-emerald-600 dark:text-emerald-400 font-medium">
                            {formatAmount(entry.prize_amount)}
                          </span>
                        ) : (
                          <span className="text-muted-foreground">–</span>
                        )}
                      </td>
                      <td className="py-3 px-2 text-right">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setViewPostsEntry(entry)}
                          className="h-7 text-xs text-primary hover:text-primary/80"
                        >
                          View Posts
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {viewPostsEntry && (
        <CreatorPostsModal
          creatorHandle={viewPostsEntry.creator_handle ?? 'Unknown'}
          creatorId={viewPostsEntry.creator_id}
          submissions={viewPostsEntry.submissions}
          activation={activation}
          onClose={() => setViewPostsEntry(null)}
          onScrape={(id) => scrapeSubmission.mutate(id)}
          isScraping={scrapeSubmission.isPending}
        />
      )}
    </div>
  );
}
