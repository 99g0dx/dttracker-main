import React from "react";
import { Card, CardContent } from "./ui/card";
import {
  Eye,
  Heart,
  MessageCircle,
  ExternalLink,
  RefreshCw,
  Trash2,
  TrendingUp,
  Share2,
} from "lucide-react";
import { PlatformBadge } from "./platform-badge";
import { StatusBadge } from "./status-badge";
import type { PostWithRankings } from "../../lib/types/database";

interface PostCardProps {
  post: PostWithRankings;
  onScrape: (postId: string) => void;
  onDelete: (postId: string) => void;
  isScraping: boolean;
}

export const PostCard = React.memo(
  ({ post, onScrape, onDelete, isScraping }: PostCardProps) => {
    return (
      <Card className="bg-[#0D0D0D] border-white/[0.08] hover:border-white/[0.12] hover:shadow-xl transition-all">
        <CardContent className="p-4">
          {/* Creator Header */}
          <div className="flex items-start justify-between mb-3">
            <div className="flex items-center gap-3 flex-1 min-w-0">
              <div className="w-10 h-10 rounded-full bg-gradient-to-br from-primary/20 to-cyan-400/20 border border-primary/30 flex items-center justify-center flex-shrink-0">
                <span className="text-sm font-bold text-primary">
                  {post.creator?.name?.[0]?.toUpperCase() || "?"}
                </span>
              </div>
              <div className="flex-1 min-w-0">
                <div className="font-medium text-sm text-white truncate">
                  {post.creator?.name || "Unknown"}
                </div>
                <div className="text-xs text-slate-500 truncate">
                  @{post.creator?.handle || "unknown"}
                </div>
              </div>
            </div>
            <PlatformBadge platform={post.platform} />
          </div>

          {/* Status Badges */}
          <div className="flex items-center gap-2 mb-3">
            <StatusBadge status={post.status} />
            {post.positionEmoji && (
              <span className="text-base">{post.positionEmoji}</span>
            )}
          </div>

          {/* Metrics Grid */}
          <div className="grid grid-cols-2 gap-2 mb-3">
            <div className="bg-white/[0.02] border border-white/[0.05] rounded-lg p-2.5">
              <div className="flex items-center gap-1.5 mb-1">
                <Eye className="w-3.5 h-3.5 text-primary" />
                <span className="text-[10px] text-slate-500 uppercase font-semibold">
                  Views
                </span>
              </div>
              <div className="text-sm font-bold text-white">
                {post.views > 0 ? post.views.toLocaleString() : "-"}
              </div>
            </div>

            <div className="bg-white/[0.02] border border-white/[0.05] rounded-lg p-2.5">
              <div className="flex items-center gap-1.5 mb-1">
                <Heart className="w-3.5 h-3.5 text-pink-400" />
                <span className="text-[10px] text-slate-500 uppercase font-semibold">
                  Likes
                </span>
              </div>
              <div className="text-sm font-bold text-white">
                {post.likes > 0 ? post.likes.toLocaleString() : "-"}
              </div>
            </div>

            <div className="bg-white/[0.02] border border-white/[0.05] rounded-lg p-2.5">
              <div className="flex items-center gap-1.5 mb-1">
                <MessageCircle className="w-3.5 h-3.5 text-cyan-400" />
                <span className="text-[10px] text-slate-500 uppercase font-semibold">
                  Comments
                </span>
              </div>
              <div className="text-sm font-bold text-white">
                {post.comments > 0 ? post.comments.toLocaleString() : "-"}
              </div>
            </div>

            <div className="bg-white/[0.02] border border-white/[0.05] rounded-lg p-2.5">
              <div className="flex items-center gap-1.5 mb-1">
                <Share2 className="w-3.5 h-3.5 text-purple-400" />
                <span className="text-[10px] text-slate-500 uppercase font-semibold">
                  Shares
                </span>
              </div>
              <div className="text-sm font-bold text-white">
                {post.shares > 0 ? post.shares.toLocaleString() : "-"}
              </div>
            </div>
          </div>

          {/* Engagement Rate */}
          <div className="bg-emerald-500/[0.05] border border-emerald-500/20 rounded-lg p-2.5 mb-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5">
                <TrendingUp className="w-3.5 h-3.5 text-emerald-400" />
                <span className="text-[10px] text-slate-500 uppercase font-semibold">
                  Engagement Rate
                </span>
              </div>
              <div className="text-sm font-bold text-emerald-400">
                {post.engagement_rate > 0
                  ? `${post.engagement_rate.toFixed(2)}%`
                  : "-"}
              </div>
            </div>
          </div>

          {/* Post URL */}
          {post.post_url && (
            <a
              href={post.post_url}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 text-xs text-primary hover:text-primary/80 mb-3 truncate transition-colors"
            >
              <ExternalLink className="w-3 h-3 flex-shrink-0" />
              <span className="truncate">{post.post_url}</span>
            </a>
          )}

          {/* Action Buttons - 44px tall for touch targets */}
          <div className="flex gap-2 pt-3 border-t border-white/[0.05]">
            {post.post_url && (
              <button
                onClick={() => onScrape(post.id)}
                disabled={isScraping}
                className="flex-1 h-11 rounded-lg bg-primary/10 hover:bg-primary/20 border border-primary/20 text-primary text-sm font-medium flex items-center justify-center gap-2 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <RefreshCw
                  className={`w-4 h-4 ${isScraping ? "animate-spin" : ""}`}
                />
                <span>Scrape</span>
              </button>
            )}
            <button
              onClick={() => onDelete(post.id)}
              className="h-11 px-4 rounded-lg bg-red-500/10 hover:bg-red-500/20 border border-red-500/20 text-red-400 text-sm font-medium flex items-center justify-center gap-2 transition-colors"
            >
              <Trash2 className="w-4 h-4" />
              <span className="hidden sm:inline">Delete</span>
            </button>
          </div>
        </CardContent>
      </Card>
    );
  }
);

PostCard.displayName = "PostCard";
