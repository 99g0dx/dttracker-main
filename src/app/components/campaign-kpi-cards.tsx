import React from "react";
import { Card, CardContent } from "./ui/card";
import { Eye, Heart, MessageCircle, Share2 } from "lucide-react";
import { formatWithGrowth } from "../../lib/utils/format";

export interface CampaignKPICardsProps {
  views: number;
  likes: number;
  comments: number;
  shares: number;
  viewsGrowth?: number | null;
  likesGrowth?: number | null;
  commentsGrowth?: number | null;
  sharesGrowth?: number | null;
}

export function CampaignKPICards({
  views,
  likes,
  comments,
  shares,
  viewsGrowth,
  likesGrowth,
  commentsGrowth,
  sharesGrowth,
}: CampaignKPICardsProps) {
  const viewsFormatted = formatWithGrowth(views, viewsGrowth);
  const likesFormatted = formatWithGrowth(likes, likesGrowth);
  const commentsFormatted = formatWithGrowth(comments, commentsGrowth);
  const sharesFormatted = formatWithGrowth(shares, sharesGrowth);

  return (
    <div className="grid grid-cols-1 min-[360px]:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
      <Card className="bg-card border-border">
        <CardContent className="p-3 sm:p-5">
          <div className="flex items-start justify-between mb-2 sm:mb-3">
            <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-lg bg-primary/10 flex items-center justify-center">
              <Eye className="w-4 h-4 sm:w-5 sm:h-5 text-primary" />
            </div>
          </div>
          <div className="text-lg sm:text-2xl font-semibold text-foreground mb-1">
            {viewsFormatted.value}
            {viewsFormatted.growth && (
              <span className="text-xs font-normal text-muted-foreground ml-1.5">
                ({viewsFormatted.growth})
              </span>
            )}
          </div>
          <p className="text-xs sm:text-sm text-muted-foreground">Total Views</p>
        </CardContent>
      </Card>

      <Card className="bg-card border-border">
        <CardContent className="p-3 sm:p-5">
          <div className="flex items-start justify-between mb-2 sm:mb-3">
            <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-lg bg-pink-500/10 flex items-center justify-center">
              <Heart className="w-4 h-4 sm:w-5 sm:h-5 text-pink-400" />
            </div>
          </div>
          <div className="text-lg sm:text-2xl font-semibold text-foreground mb-1">
            {likesFormatted.value}
            {likesFormatted.growth && (
              <span className="text-xs font-normal text-muted-foreground ml-1.5">
                ({likesFormatted.growth})
              </span>
            )}
          </div>
          <p className="text-xs sm:text-sm text-muted-foreground">Total Likes</p>
        </CardContent>
      </Card>

      <Card className="bg-card border-border">
        <CardContent className="p-3 sm:p-5">
          <div className="flex items-start justify-between mb-2 sm:mb-3">
            <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-lg bg-red-100/70 dark:bg-cyan-500/10 flex items-center justify-center">
              <MessageCircle className="w-4 h-4 sm:w-5 sm:h-5 text-red-600 dark:text-cyan-400" />
            </div>
          </div>
          <div className="text-lg sm:text-2xl font-semibold text-foreground mb-1">
            {commentsFormatted.value}
            {commentsFormatted.growth && (
              <span className="text-xs font-normal text-muted-foreground ml-1.5">
                ({commentsFormatted.growth})
              </span>
            )}
          </div>
          <p className="text-xs sm:text-sm text-muted-foreground">Total Comments</p>
        </CardContent>
      </Card>

      <Card className="bg-card border-border">
        <CardContent className="p-3 sm:p-5">
          <div className="flex items-start justify-between mb-2 sm:mb-3">
            <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-lg bg-purple-500/10 flex items-center justify-center">
              <Share2 className="w-4 h-4 sm:w-5 sm:h-5 text-purple-400" />
            </div>
          </div>
          <div className="text-lg sm:text-2xl font-semibold text-foreground mb-1">
            {sharesFormatted.value}
            {sharesFormatted.growth && (
              <span className="text-xs font-normal text-muted-foreground ml-1.5">
                ({sharesFormatted.growth})
              </span>
            )}
          </div>
          <p className="text-xs sm:text-sm text-muted-foreground">Total Shares</p>
        </CardContent>
      </Card>
    </div>
  );
}
