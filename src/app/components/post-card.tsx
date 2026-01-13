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
  onScrape: (postId: string) => void;
  onDelete: (postId: string) => void;
  isScraping: boolean;
}

export const PostCard = React.memo(
  ({ post, onScrape, onDelete, isScraping }: PostCardProps) => {
    const hasPostUrl = Boolean(post.post_url);
    const viewsValue = post.views > 0 ? post.views.toLocaleString() : "-";
    const likesValue = post.likes > 0 ? post.likes.toLocaleString() : "-";
    const commentsValue =
      post.comments > 0 ? post.comments.toLocaleString() : "-";
    const sharesValue = post.shares > 0 ? post.shares.toLocaleString() : "-";
    const rateValue =
      post.engagement_rate > 0 ? `${post.engagement_rate.toFixed(2)}%` : "-";
    const creatorName = post.creator?.name || "Unknown";
    const creatorHandle = post.creator?.handle || "unknown";
    const platformIcon = normalizePlatform(post.platform);

    return (
      <Card className="bg-[#0D0D0D] border-white/[0.08] hover:border-white/[0.12] transition-colors">
        <CardContent className="p-3">
          <div className="flex items-start justify-between gap-2">
            <div className="flex items-center gap-2 min-w-0">
              {post.rank && (
                <span className="text-[10px] font-semibold text-primary bg-primary/10 border border-primary/20 rounded-full px-2 py-0.5">
                  #{post.rank}
                </span>
              )}
              <div className="w-8 h-8 rounded-full bg-gradient-to-br from-primary/20 to-cyan-400/20 border border-primary/30 flex items-center justify-center flex-shrink-0">
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
              <StatusBadge status={post.status} />
            </div>
          </div>

          <div className="mt-2 flex items-end justify-between gap-2">
            <div>
              <div className="flex items-center gap-1 text-[11px] text-muted-foreground uppercase tracking-wide">
                <Eye className="w-3.5 h-3.5 text-primary" />
                Views
              </div>
              <div className="text-xl font-semibold text-foreground leading-tight">
                {viewsValue}
              </div>
            </div>
            <div className="flex flex-wrap items-center justify-end gap-1.5">
              <span className="inline-flex items-center gap-1 rounded-full bg-white/[0.03] border border-white/[0.08] px-2 py-0.5 text-xs text-slate-300">
                <Heart className="w-3.5 h-3.5 text-pink-400" />
                {likesValue}
              </span>
              <span className="inline-flex items-center gap-1 rounded-full bg-white/[0.03] border border-white/[0.08] px-2 py-0.5 text-xs text-slate-300">
                <MessageCircle className="w-3.5 h-3.5 text-cyan-400" />
                {commentsValue}
              </span>
              <span className="inline-flex items-center gap-1 rounded-full bg-white/[0.03] border border-white/[0.08] px-2 py-0.5 text-xs text-slate-300">
                <Share2 className="w-3.5 h-3.5 text-purple-400" />
                {sharesValue}
              </span>
            </div>
          </div>

          <div className="mt-2 flex items-center justify-between text-xs">
            <span className="text-[11px] uppercase tracking-wide text-muted-foreground">
              Rate
            </span>
            <span className="text-sm font-semibold text-emerald-400">
              {rateValue}
            </span>
          </div>

          <div className="mt-2 flex items-center gap-2">
            {hasPostUrl ? (
              <Button
                size="sm"
                variant="outline"
                className="min-h-[44px] flex-1 border-white/[0.08] bg-white/[0.03] hover:bg-white/[0.06] text-slate-300"
                asChild
              >
                <a href={post.post_url} target="_blank" rel="noopener noreferrer">
                  <ExternalLink className="w-4 h-4" />
                  View
                </a>
              </Button>
            ) : (
              <Button
                size="sm"
                variant="outline"
                className="min-h-[44px] flex-1 border-white/[0.08] bg-white/[0.03] text-slate-500"
                disabled
              >
                <ExternalLink className="w-4 h-4" />
                View
              </Button>
            )}
            <Button
              size="sm"
              onClick={() => onScrape(post.id)}
              disabled={!hasPostUrl || isScraping}
              className="min-h-[44px] flex-1 bg-primary/15 hover:bg-primary/25 text-primary border border-primary/20"
            >
              <RefreshCw
                className={`w-4 h-4 ${isScraping ? "animate-spin" : ""}`}
              />
              Refresh
            </Button>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  type="button"
                  className="h-11 w-11 min-h-[44px] min-w-[44px] rounded-md border border-white/[0.08] bg-white/[0.03] text-slate-300 hover:bg-white/[0.06] flex items-center justify-center transition-colors"
                  aria-label="More actions"
                >
                  <MoreHorizontal className="w-4 h-4" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-40">
                <DropdownMenuItem
                  variant="destructive"
                  onSelect={() => onDelete(post.id)}
                >
                  <Trash2 className="w-4 h-4" />
                  Delete
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </CardContent>
      </Card>
    );
  }
);

PostCard.displayName = "PostCard";