import React, { useCallback, useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { Card, CardContent } from "./ui/card";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "./ui/dialog";
import { Badge } from "./ui/badge";
import {
  Trophy,
  Calendar,
  Eye,
  Heart,
  MessageCircle,
  Users,
  Lock,
  ExternalLink,
  List,
} from "lucide-react";
import {
  PlatformIcon,
  getPlatformLabel,
  type PlatformIconName,
} from "./ui/PlatformIcon";
import { calculatePerformanceScore } from "../../lib/utils/contest-prizes";
import * as sharingApi from "../../lib/api/activation-sharing";
import type { SharedActivationData } from "../../lib/api/activation-sharing";
import { format } from "date-fns";
import { formatCompactNumber } from "../../lib/utils/format";

type LeaderboardEntry = SharedActivationData["leaderboard"][number];

function detectPlatformFromUrl(url: string | null): PlatformIconName | null {
  if (!url) return null;
  const u = url.toLowerCase();
  if (u.includes("tiktok")) return "tiktok";
  if (u.includes("instagram")) return "instagram";
  if (u.includes("youtube") || u.includes("youtu.be")) return "youtube";
  if (u.includes("twitter") || u.includes("x.com")) return "x";
  if (u.includes("facebook")) return "facebook";
  return null;
}

function formatAmount(amount: number): string {
  return new Intl.NumberFormat("en-NG", {
    style: "currency",
    currency: "NGN",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
}

function rankEmoji(rank: number): string {
  if (rank === 1) return "🥇";
  if (rank === 2) return "🥈";
  if (rank === 3) return "🥉";
  return String(rank);
}

export function SharedActivationView() {
  const { token } = useParams<{ token: string }>();
  const [data, setData] = useState<SharedActivationData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [password, setPassword] = useState("");
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [requiresPassword, setRequiresPassword] = useState(false);
  const [postsModalEntry, setPostsModalEntry] =
    useState<LeaderboardEntry | null>(null);

  const loadData = useCallback(
    async (providedPassword?: string) => {
      if (!token) return;
      setIsLoading(true);
      setError(null);
      setPasswordError(null);

      try {
        const result = await sharingApi.fetchSharedActivationData(
          token,
          providedPassword,
        );

        if (result.error) {
          const err = result.error as Error & { code?: string };
          if (err.code === "PASSWORD_REQUIRED") {
            setRequiresPassword(true);
            setIsLoading(false);
            return;
          }
          if (err.code === "INCORRECT_PASSWORD") {
            setRequiresPassword(true);
            setPasswordError("Incorrect password. Please try again.");
            setIsLoading(false);
            return;
          }
          setError(result.error.message || "Failed to load activation");
          setIsLoading(false);
          return;
        }

        if (result.data) {
          setData(result.data);
          setRequiresPassword(false);
        }
      } catch (e) {
        setError(e instanceof Error ? e.message : "Failed to load");
      } finally {
        setIsLoading(false);
      }
    },
    [token],
  );

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handlePasswordSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setPasswordError(null);
    loadData(password);
  };

  if (isLoading && !data) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-6">
        <div className="flex flex-col items-center gap-3">
          <div className="w-10 h-10 border-2 border-primary border-t-transparent rounded-full animate-spin" />
          <p className="text-sm text-muted-foreground">Loading...</p>
        </div>
      </div>
    );
  }

  if (requiresPassword && !data) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-6">
        <Card className="w-full max-w-md bg-card border-border">
          <CardContent className="p-6 space-y-4">
            <div className="flex items-center gap-2 text-foreground">
              <Lock className="w-5 h-5 text-primary" />
              <h1 className="text-lg font-semibold">Password required</h1>
            </div>
            <p className="text-sm text-muted-foreground">
              This shared link is protected. Enter the password to view the
              contest.
            </p>
            <form onSubmit={handlePasswordSubmit} className="space-y-3">
              <Input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Password"
                className="bg-muted/50 border-border"
                autoFocus
              />
              {passwordError && (
                <p className="text-sm text-destructive">{passwordError}</p>
              )}
              <Button type="submit" className="w-full">
                View contest
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (error && !data) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-6">
        <Card className="w-full max-w-md bg-card border-border">
          <CardContent className="p-6 text-center space-y-3">
            <h1 className="text-lg font-semibold text-foreground">
              Link not found or expired
            </h1>
            <p className="text-sm text-muted-foreground">{error}</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!data) return null;

  const { activation, leaderboard, totals } = data;
  const statusConfig: Record<string, string> = {
    draft: "Draft",
    live: "Live",
    completed: "Completed",
    cancelled: "Cancelled",
  };
  const statusLabel = statusConfig[activation.status] ?? activation.status;

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-4xl mx-auto p-4 sm:p-6 space-y-6">
        <div className="flex items-center gap-2 text-muted-foreground">
          <Trophy className="w-5 h-5 text-amber-500 dark:text-amber-400" />
          <span className="text-xs uppercase tracking-wider">Contest</span>
        </div>

        <h1 className="text-2xl font-semibold text-foreground uppercase">
          {activation.title}
        </h1>

        {activation.image_url && (
          <div className="rounded-xl overflow-hidden border border-border">
            <img
              src={activation.image_url}
              alt={activation.title}
              className="w-full max-h-[280px] object-cover"
            />
          </div>
        )}

        <div className="flex flex-wrap items-center gap-2">
          <span
            className={`text-xs font-medium px-2 py-1 rounded border ${
              activation.status === "live"
                ? "bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 border-emerald-500/30"
                : activation.status === "completed"
                  ? "bg-blue-500/20 text-blue-600 dark:text-blue-400 border-blue-500/30"
                  : "bg-muted text-muted-foreground border-border"
            }`}
          >
            {statusLabel}
          </span>
          {activation.platforms &&
            activation.platforms.length > 0 &&
            activation.platforms.map((p) => (
              <div
                key={p}
                className="flex items-center gap-1 rounded-md bg-muted/80 px-2 py-0.5"
              >
                <PlatformIcon
                  platform={
                    p as "tiktok" | "instagram" | "youtube" | "x" | "facebook"
                  }
                  size="sm"
                />
                <span className="text-xs text-muted-foreground capitalize">
                  {p}
                </span>
              </div>
            ))}
        </div>

        <div className="grid gap-4 md:grid-cols-3">
          <Card className="bg-card border-border">
            <CardContent className="p-4">
              <p className="text-xs text-muted-foreground">Deadline</p>
              <p className="font-medium text-foreground flex items-center gap-2 mt-1">
                <Calendar className="w-4 h-4" />
                {format(new Date(activation.deadline), "MMM d, yyyy")}
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

        <div className="grid grid-cols-1 min-[360px]:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
          <Card className="bg-card border-border">
            <CardContent className="p-3 sm:p-5">
              <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-lg bg-primary/10 flex items-center justify-center mb-2 sm:mb-3">
                <Eye className="w-4 h-4 sm:w-5 sm:h-5 text-primary" />
              </div>
              <div className="text-lg sm:text-2xl font-semibold text-foreground mb-1">
                {formatCompactNumber(totals.views)}
              </div>
              <p className="text-xs sm:text-sm text-muted-foreground">
                Total Views
              </p>
            </CardContent>
          </Card>
          <Card className="bg-card border-border">
            <CardContent className="p-3 sm:p-5">
              <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-lg bg-pink-500/10 flex items-center justify-center mb-2 sm:mb-3">
                <Heart className="w-4 h-4 sm:w-5 sm:h-5 text-pink-400" />
              </div>
              <div className="text-lg sm:text-2xl font-semibold text-foreground mb-1">
                {formatCompactNumber(totals.likes)}
              </div>
              <p className="text-xs sm:text-sm text-muted-foreground">
                Total Likes
              </p>
            </CardContent>
          </Card>
          <Card className="bg-card border-border">
            <CardContent className="p-3 sm:p-5">
              <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-lg bg-cyan-500/10 flex items-center justify-center mb-2 sm:mb-3">
                <MessageCircle className="w-4 h-4 sm:w-5 sm:h-5 text-cyan-400" />
              </div>
              <div className="text-lg sm:text-2xl font-semibold text-foreground mb-1">
                {formatCompactNumber(totals.comments)}
              </div>
              <p className="text-xs sm:text-sm text-muted-foreground">
                Total Comments
              </p>
            </CardContent>
          </Card>
          <Card className="bg-card border-border">
            <CardContent className="p-3 sm:p-5">
              <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-lg bg-purple-500/10 flex items-center justify-center mb-2 sm:mb-3">
                <Users className="w-4 h-4 sm:w-5 sm:h-5 text-purple-400" />
              </div>
              <div className="text-lg sm:text-2xl font-semibold text-foreground mb-1">
                {formatCompactNumber(totals.entries)}
              </div>
              <p className="text-xs sm:text-sm text-muted-foreground">
                Total Entries
              </p>
            </CardContent>
          </Card>
        </div>

        {activation.brief && (
          <Card className="bg-card border-border">
            <CardContent className="p-4">
              <p className="text-xs text-muted-foreground mb-2">Brief</p>
              <p className="text-sm text-foreground whitespace-pre-wrap">
                {activation.brief}
              </p>
            </CardContent>
          </Card>
        )}

        <Card className="bg-card border-border">
          <CardContent className="p-0">
            <div className="px-4 py-3 border-b border-border">
              <h2 className="text-sm font-semibold text-foreground">
                Leaderboard
              </h2>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border">
                    <th className="text-left py-3 px-2 font-medium text-muted-foreground">
                      Rank
                    </th>
                    <th className="text-left py-3 px-2 font-medium text-muted-foreground">
                      Creator
                    </th>
                    <th className="text-right py-3 px-2 font-medium text-muted-foreground">
                      Posts
                    </th>
                    <th className="text-right py-3 px-2 font-medium text-muted-foreground">
                      Views
                    </th>
                    <th className="text-right py-3 px-2 font-medium text-muted-foreground">
                      Likes
                    </th>
                    <th className="text-right py-3 px-2 font-medium text-muted-foreground">
                      Comments
                    </th>
                    <th className="text-right py-3 px-2 font-medium text-muted-foreground">
                      Score
                    </th>
                    <th className="text-right py-3 px-2 font-medium text-muted-foreground">
                      Prize
                    </th>
                    <th className="text-right py-3 px-2 font-medium text-muted-foreground">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {leaderboard.map((entry) => (
                    <tr
                      key={`${entry.creator_handle}-${entry.current_rank}`}
                      className={`border-b border-border last:border-0 ${
                        entry.is_winner ? "bg-emerald-500/5" : ""
                      }`}
                    >
                      <td className="py-3 px-2 font-medium text-foreground">
                        {rankEmoji(entry.current_rank)}
                      </td>
                      <td className="py-3 px-2 font-medium text-foreground">
                        @{entry.creator_handle ?? "Unknown"}
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
                          className="h-8 text-xs text-muted-foreground hover:text-foreground"
                          onClick={() => setPostsModalEntry(entry)}
                        >
                          <List className="w-3.5 h-3.5 mr-1.5" />
                          View posts
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {leaderboard.length === 0 && (
              <div className="py-8 text-center text-muted-foreground text-sm">
                No entries yet
              </div>
            )}
          </CardContent>
        </Card>

        {/* View posts modal – DTTracker design language */}
        {(() => {
          const modalEntry =
            (postsModalEntry &&
              data?.leaderboard?.find(
                (l) =>
                  l.creator_handle === postsModalEntry.creator_handle &&
                  l.current_rank === postsModalEntry.current_rank,
              )) ??
            postsModalEntry;
          const submissions = modalEntry?.submissions ?? [];
          const totalViews = submissions.reduce((s, sub) => s + sub.views, 0);
          const totalLikes = submissions.reduce((s, sub) => s + sub.likes, 0);
          const totalComments = submissions.reduce(
            (s, sub) => s + sub.comments,
            0,
          );
          const totalScore = calculatePerformanceScore(
            totalViews,
            totalLikes,
            totalComments,
          );
          return (
            <Dialog
              open={!!postsModalEntry}
              onOpenChange={(open) => !open && setPostsModalEntry(null)}
            >
              <DialogContent className="bg-[#0D0D0D] border-white/[0.08] max-w-lg max-h-[85dvh] flex flex-col gap-0 p-0 shadow-xl">
                <DialogHeader className="p-4 sm:p-5 pb-3 sm:pb-4 border-b border-white/[0.08]">
                  <DialogTitle className="text-foreground text-lg font-semibold">
                    @{modalEntry?.creator_handle ?? "Unknown"}
                  </DialogTitle>
                  <DialogDescription className="text-muted-foreground text-sm mt-0.5">
                    {submissions.length} post
                    {submissions.length !== 1 ? "s" : ""} in this contest
                  </DialogDescription>
                </DialogHeader>
                <div className="overflow-y-auto flex-1 p-4 sm:p-5 space-y-4 min-h-0">
                  {submissions.length ? (
                    submissions.map((sub, idx) => {
                      const platform = detectPlatformFromUrl(
                        sub.content_url ?? sub.post_url,
                      );
                      const platformLabel = platform
                        ? getPlatformLabel(platform)
                        : "Post";
                      const score = calculatePerformanceScore(
                        sub.views,
                        sub.likes,
                        sub.comments,
                      );
                      return (
                        <div
                          key={idx}
                          className="rounded-xl bg-white/[0.03] border border-white/[0.06] p-4 space-y-3"
                        >
                          <div className="flex items-center justify-between gap-2">
                            <div className="flex items-center gap-2 min-w-0">
                              {platform && (
                                <PlatformIcon
                                  platform={platform}
                                  size="sm"
                                  className="flex-shrink-0"
                                />
                              )}
                              <span className="text-sm text-muted-foreground truncate">
                                {platformLabel} {idx + 1}
                              </span>
                              <span className="text-xs text-slate-500 flex-shrink-0">
                                {format(
                                  new Date(sub.submitted_at),
                                  "MMM d, yyyy",
                                )}
                              </span>
                            </div>
                            <Badge
                              variant="secondary"
                              className="bg-amber-500/10 text-amber-400 border-0 text-xs font-semibold flex-shrink-0"
                            >
                              <Trophy className="w-3 h-3 mr-0.5" />
                              {formatCompactNumber(score)}
                            </Badge>
                          </div>
                          <div className="flex flex-wrap gap-2">
                            <div className="flex items-center gap-1.5 rounded-md bg-primary/10 px-2.5 py-1">
                              <Eye className="w-3.5 h-3.5 text-primary" />
                              <span className="text-xs font-medium text-foreground">
                                {formatCompactNumber(sub.views)}
                              </span>
                            </div>
                            <div className="flex items-center gap-1.5 rounded-md bg-pink-500/10 px-2.5 py-1">
                              <Heart className="w-3.5 h-3.5 text-pink-400" />
                              <span className="text-xs font-medium text-pink-400">
                                {formatCompactNumber(sub.likes)}
                              </span>
                            </div>
                            <div className="flex items-center gap-1.5 rounded-md bg-cyan-500/10 px-2.5 py-1">
                              <MessageCircle className="w-3.5 h-3.5 text-cyan-400" />
                              <span className="text-xs font-medium text-cyan-400">
                                {formatCompactNumber(sub.comments)}
                              </span>
                            </div>
                          </div>
                          {sub.post_url || sub.content_url ? (
                            <a
                              href={sub.post_url || sub.content_url || "#"}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-1.5 text-sm font-medium text-primary hover:text-primary/80 transition-colors"
                            >
                              <ExternalLink className="w-3.5 h-3.5" />
                              View post
                            </a>
                          ) : (
                            <span className="text-xs text-slate-500">
                              No link
                            </span>
                          )}
                        </div>
                      );
                    })
                  ) : (
                    <div className="rounded-xl bg-white/[0.03] border border-white/[0.06] p-6 text-center">
                      <p className="text-sm text-muted-foreground">
                        Post links and metrics aren&apos;t available for this
                        shared link. The contest owner may need to update the
                        share link, or submissions may not have been loaded yet.
                      </p>
                    </div>
                  )}
                </div>
                {submissions.length > 0 && (
                  <div className="border-t border-white/[0.08] p-4 sm:p-5 space-y-3 flex-shrink-0">
                    <div className="grid grid-cols-3 gap-2">
                      <div className="rounded-lg bg-primary/5 border border-primary/10 p-2.5 text-center">
                        <Eye className="w-4 h-4 text-primary mx-auto mb-1" />
                        <p className="text-sm font-semibold text-foreground">
                          {formatCompactNumber(totalViews)}
                        </p>
                        <p className="text-[10px] text-muted-foreground">
                          Views
                        </p>
                      </div>
                      <div className="rounded-lg bg-pink-500/5 border border-pink-500/10 p-2.5 text-center">
                        <Heart className="w-4 h-4 text-pink-400 mx-auto mb-1" />
                        <p className="text-sm font-semibold text-foreground">
                          {formatCompactNumber(totalLikes)}
                        </p>
                        <p className="text-[10px] text-muted-foreground">
                          Likes
                        </p>
                      </div>
                      <div className="rounded-lg bg-cyan-500/5 border border-cyan-500/10 p-2.5 text-center">
                        <MessageCircle className="w-4 h-4 text-cyan-400 mx-auto mb-1" />
                        <p className="text-sm font-semibold text-foreground">
                          {formatCompactNumber(totalComments)}
                        </p>
                        <p className="text-[10px] text-muted-foreground">
                          Comments
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center justify-center gap-2 text-sm">
                      <Trophy className="w-4 h-4 text-amber-400" />
                      <span className="text-muted-foreground">Total score</span>
                      <span className="font-bold text-amber-400">
                        {totalScore.toLocaleString()}
                      </span>
                    </div>
                  </div>
                )}
              </DialogContent>
            </Dialog>
          );
        })()}
      </div>
    </div>
  );
}
