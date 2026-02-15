import React from "react";
import { Card, CardContent } from "./ui/card";
import { Button } from "./ui/button";
import {
  Eye,
  Heart,
  MessageCircle,
  ExternalLink,
  RefreshCw,
  Trash2,
  Share2,
  MoreHorizontal,
} from "lucide-react";
import {
  PlatformIcon,
  normalizePlatform,
  getPlatformLabel,
} from "./ui/PlatformIcon";
import { formatWithGrowth, formatRelativeTime } from "../../lib/utils/format";
import { StatusBadge } from "./status-badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "./ui/dropdown-menu";
import type { PostWithRankings } from "../../lib/types/database";

interface PostCardProps {
  post: PostWithRankings;
  onScrape?: (postId: string) => void;
  onDelete?: (postId: string) => void;
  isScraping: boolean;
  readOnly?: boolean;
  showStatusBadge?: boolean;
  compact?: boolean;
}

export const PostCard = React.memo(
  ({
    post,
    onScrape,
    onDelete,
    isScraping,
    readOnly = false,
    showStatusBadge = true,
    compact = false,
  }: PostCardProps) => {
    const hasPostUrl = Boolean(post.post_url);
    const postWithGrowth = post as {
      last_view_growth?: number | null;
      last_like_growth?: number | null;
      last_comment_growth?: number | null;
    };
    const viewsFormatted = formatWithGrowth(
      post.views,
      postWithGrowth.last_view_growth
    );
    const likesFormatted = formatWithGrowth(
      post.likes,
      postWithGrowth.last_like_growth
    );
    const commentsFormatted = formatWithGrowth(
      post.comments,
      postWithGrowth.last_comment_growth
    );
    const sharesValue = post.shares > 0 ? post.shares.toLocaleString() : "-";
    const rateValue =
      post.engagement_rate > 0 ? `${post.engagement_rate.toFixed(2)}%` : "-";
    const creatorName = post.creator?.name || "Unknown";
    const creatorHandle =
      post.creator?.handle || post.owner_username || "unknown";
    const platformIcon = normalizePlatform(post.platform);

    if (compact) {
      return (
        <Card className="bg-card border-border hover:border-border/80 transition-colors">
          <CardContent className="p-2.5">
            {/* Compact header: inline name + platform icon */}
            <div className="flex items-center justify-between gap-1">
              <div className="min-w-0 flex-1">
                <span className="text-xs font-medium text-foreground truncate block">
                  {creatorName}
                </span>
                <span className="text-[10px] text-muted-foreground truncate block">
                  @{creatorHandle}
                </span>
              </div>
              <div className="flex items-center gap-1">
                {platformIcon && (
                  <PlatformIcon platform={platformIcon} size="sm" />
                )}
                {post.rank && (
                  <span className="text-[9px] font-semibold text-primary bg-primary/10 border border-primary/20 rounded-full px-1.5 py-0.5">
                    #{post.rank}
                  </span>
                )}
              </div>
            </div>

            {/* Compact metrics */}
            <div className="mt-1.5">
              <div className="flex items-center gap-1 text-[10px] text-muted-foreground">
                <Eye className="w-3 h-3 text-primary" />
                Views
              </div>
              <div className="text-lg font-semibold text-foreground leading-tight">
                {viewsFormatted.value}
              </div>
            </div>
            <div className="flex flex-wrap gap-1 mt-1">
              <span className="inline-flex items-center gap-0.5 rounded-full bg-muted/60 border border-border px-1.5 py-0.5 text-[10px] text-foreground">
                <Heart className="w-3 h-3 text-pink-400" />
                {likesFormatted.value}
              </span>
              <span className="inline-flex items-center gap-0.5 rounded-full bg-muted/60 border border-border px-1.5 py-0.5 text-[10px] text-foreground">
                <MessageCircle className="w-3 h-3 text-red-600 dark:text-cyan-400" />
                {commentsFormatted.value}
              </span>
            </div>

            {/* Compact actions: icon-only */}
            <div className="mt-1.5 flex items-center gap-1">
              {hasPostUrl ? (
                <Button
                  size="sm"
                  variant="outline"
                  className="h-8 w-8 p-0 border-border bg-muted/60 hover:bg-muted text-foreground"
                  asChild
                >
                  <a
                    href={post.post_url}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    <ExternalLink className="w-3.5 h-3.5" />
                  </a>
                </Button>
              ) : (
                <Button
                  size="sm"
                  variant="outline"
                  className="h-8 w-8 p-0 border-border bg-muted/60 text-muted-foreground"
                  disabled
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                </Button>
              )}
              {!readOnly && onScrape && (
                <>
                  <Button
                    size="sm"
                    onClick={() => onScrape(post.id)}
                    disabled={!hasPostUrl || isScraping}
                    className={`h-8 w-8 p-0 ${
                      post.status === "failed" || post.status === "pending"
                        ? "bg-amber-500/15 hover:bg-amber-500/25 text-amber-400 border border-amber-500/20"
                        : "bg-primary/15 hover:bg-primary/25 text-primary border border-primary/20"
                    }`}
                  >
                    <RefreshCw
                      className={`w-3.5 h-3.5 ${isScraping ? "animate-spin" : ""}`}
                    />
                  </Button>
                  {onDelete && (
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <button
                          type="button"
                          className="h-8 w-8 rounded-md border border-border bg-muted/60 text-foreground hover:bg-muted flex items-center justify-center transition-colors"
                          aria-label="More actions"
                        >
                          <MoreHorizontal className="w-3.5 h-3.5" />
                        </button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="w-40">
                        <DropdownMenuItem
                          variant="destructive"
                          onSelect={(event) => {
                            event.preventDefault();
                            onDelete(post.id);
                          }}
                        >
                          <Trash2 className="w-4 h-4" />
                          Delete
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  )}
                </>
              )}
            </div>
          </CardContent>
        </Card>
      );
    }

    return (
      <Card className="bg-card border-border hover:border-border/80 transition-colors">
        <CardContent className="p-3">
          <div className="flex items-start justify-between gap-2">
            <div className="flex items-center gap-2 min-w-0">
              {post.rank && (
                <span className="text-[10px] font-semibold text-primary bg-primary/10 border border-primary/20 rounded-full px-2 py-0.5">
                  #{post.rank}
                </span>
              )}
              <div className="w-8 h-8 rounded-full bg-gradient-to-br from-primary/20 to-red-400/20 dark:to-cyan-400/20 border border-primary/30 flex items-center justify-center flex-shrink-0">
                <span className="text-xs font-semibold text-primary">
                  {creatorName.charAt(0).toUpperCase()}
                </span>
              </div>
              <div className="min-w-0">
                <div className="text-sm font-medium text-foreground truncate">
                  {creatorName}
                </div>
                <div className="text-xs text-muted-foreground truncate">
                  @{creatorHandle}
                </div>
              </div>
            </div>
            <div className="flex items-center gap-1.5">
              {platformIcon && (
                <PlatformIcon
                  platform={platformIcon}
                  size="sm"
                  aria-label={`${getPlatformLabel(platformIcon)} post`}
                />
              )}
              {showStatusBadge && <StatusBadge status={post.status} />}
            </div>
          </div>

          <div className="mt-2 flex items-end justify-between gap-2">
            <div>
              <div className="flex items-center gap-1 text-[11px] text-muted-foreground uppercase tracking-wide">
                <Eye className="w-3.5 h-3.5 text-primary" />
                Views
              </div>
              <div className="text-xl font-semibold text-foreground leading-tight">
                {viewsFormatted.value}
                {viewsFormatted.growth && (
                  <span className="text-sm font-normal text-muted-foreground ml-1">
                    ({viewsFormatted.growth})
                  </span>
                )}
              </div>
            </div>
            <div className="flex flex-wrap items-center justify-end gap-1.5">
              <span className="inline-flex items-center gap-1 rounded-full bg-muted/60 border border-border px-2 py-0.5 text-xs text-foreground">
                <Heart className="w-3.5 h-3.5 text-pink-400" />
                {likesFormatted.value}
                {likesFormatted.growth && (
                  <span className="text-[10px] font-normal text-muted-foreground">
                    ({likesFormatted.growth})
                  </span>
                )}
              </span>
              <span className="inline-flex items-center gap-1 rounded-full bg-muted/60 border border-border px-2 py-0.5 text-xs text-foreground">
                <MessageCircle className="w-3.5 h-3.5 text-red-600 dark:text-cyan-400" />
                {commentsFormatted.value}
                {commentsFormatted.growth && (
                  <span className="text-[10px] font-normal text-muted-foreground">
                    ({commentsFormatted.growth})
                  </span>
                )}
              </span>
              <span className="inline-flex items-center gap-1 rounded-full bg-muted/60 border border-border px-2 py-0.5 text-xs text-foreground">
                <Share2 className="w-3.5 h-3.5 text-purple-400" />
                {sharesValue}
              </span>
            </div>
          </div>

          <div className="mt-2 flex items-center justify-between text-xs">
            <span className="text-[11px] uppercase tracking-wide text-muted-foreground">
              Rate
            </span>
            <span className="text-sm font-semibold text-emerald-600 dark:text-emerald-400">
              {rateValue}
            </span>
          </div>
          {post.last_scraped_at && (
            <div className="mt-1 text-[10px] text-muted-foreground">
              Last updated {formatRelativeTime(post.last_scraped_at)}
            </div>
          )}

          <div className="mt-2 flex items-center gap-2">
            {hasPostUrl ? (
              <Button
                size="sm"
                variant="outline"
                className="min-h-[44px] flex-1 border-border bg-muted/60 hover:bg-muted text-foreground"
                asChild
              >
                <a
                  href={post.post_url}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <ExternalLink className="w-4 h-4" />
                  View
                </a>
              </Button>
            ) : (
              <Button
                size="sm"
                variant="outline"
                className="min-h-[44px] flex-1 border-border bg-muted/60 text-muted-foreground"
                disabled
              >
                <ExternalLink className="w-4 h-4" />
                View
              </Button>
            )}
            {!readOnly && onScrape && (
              <>
                <Button
                  size="sm"
                  onClick={() => onScrape(post.id)}
                  disabled={!hasPostUrl || isScraping}
                  className={`min-h-[44px] flex-1 ${
                    post.status === "failed" || post.status === "pending"
                      ? "bg-amber-500/15 hover:bg-amber-500/25 text-amber-400 border border-amber-500/20"
                      : "bg-primary/15 hover:bg-primary/25 text-primary border border-primary/20"
                  }`}
                >
                  <RefreshCw
                    className={`w-4 h-4 ${isScraping ? "animate-spin" : ""}`}
                  />
                  Refresh
                </Button>
                {onDelete && (
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <button
                        type="button"
                        className="h-11 w-11 min-h-[44px] min-w-[44px] rounded-md border border-border bg-muted/60 text-foreground hover:bg-muted flex items-center justify-center transition-colors"
                        aria-label="More actions"
                      >
                        <MoreHorizontal className="w-4 h-4" />
                      </button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-40">
                      <DropdownMenuItem
                        variant="destructive"
                        onSelect={(event) => {
                          event.preventDefault();
                          onDelete(post.id);
                        }}
                      >
                        <Trash2 className="w-4 h-4" />
                        Delete
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                )}
              </>
            )}
          </div>
        </CardContent>
      </Card>
    );
  }
);

PostCard.displayName = "PostCard";
