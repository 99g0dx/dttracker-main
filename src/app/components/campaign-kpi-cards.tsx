import React from "react";
import { Card, CardContent } from "./ui/card";
import { Eye, Heart, MessageCircle, Share2 } from "lucide-react";

export interface CampaignKPICardsProps {
  views: number;
  likes: number;
  comments: number;
  shares: number;
}

export function CampaignKPICards({
  views,
  likes,
  comments,
  shares,
}: CampaignKPICardsProps) {
  return (
    <div className="grid grid-cols-1 min-[360px]:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
      <Card className="bg-[#0D0D0D] border-white/[0.08]">
        <CardContent className="p-3 sm:p-5">
          <div className="flex items-start justify-between mb-2 sm:mb-3">
            <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-lg bg-primary/10 flex items-center justify-center">
              <Eye className="w-4 h-4 sm:w-5 sm:h-5 text-primary" />
            </div>
          </div>
          <div className="text-lg sm:text-2xl font-semibold text-white mb-1">
            {views.toLocaleString()}
          </div>
          <p className="text-xs sm:text-sm text-slate-400">Total Views</p>
        </CardContent>
      </Card>

      <Card className="bg-[#0D0D0D] border-white/[0.08]">
        <CardContent className="p-3 sm:p-5">
          <div className="flex items-start justify-between mb-2 sm:mb-3">
            <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-lg bg-pink-500/10 flex items-center justify-center">
              <Heart className="w-4 h-4 sm:w-5 sm:h-5 text-pink-400" />
            </div>
          </div>
          <div className="text-lg sm:text-2xl font-semibold text-white mb-1">
            {likes.toLocaleString()}
          </div>
          <p className="text-xs sm:text-sm text-slate-400">Total Likes</p>
        </CardContent>
      </Card>

      <Card className="bg-[#0D0D0D] border-white/[0.08]">
        <CardContent className="p-3 sm:p-5">
          <div className="flex items-start justify-between mb-2 sm:mb-3">
            <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-lg bg-cyan-500/10 flex items-center justify-center">
              <MessageCircle className="w-4 h-4 sm:w-5 sm:h-5 text-cyan-400" />
            </div>
          </div>
          <div className="text-lg sm:text-2xl font-semibold text-white mb-1">
            {comments.toLocaleString()}
          </div>
          <p className="text-xs sm:text-sm text-slate-400">Total Comments</p>
        </CardContent>
      </Card>

      <Card className="bg-[#0D0D0D] border-white/[0.08]">
        <CardContent className="p-3 sm:p-5">
          <div className="flex items-start justify-between mb-2 sm:mb-3">
            <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-lg bg-purple-500/10 flex items-center justify-center">
              <Share2 className="w-4 h-4 sm:w-5 sm:h-5 text-purple-400" />
            </div>
          </div>
          <div className="text-lg sm:text-2xl font-semibold text-white mb-1">
            {shares.toLocaleString()}
          </div>
          <p className="text-xs sm:text-sm text-slate-400">Total Shares</p>
        </CardContent>
      </Card>
    </div>
  );
}
