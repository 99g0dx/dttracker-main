import React from "react";
import {
  ArrowLeft,
  Share2,
  Edit2,
  Trash2,
  MoreHorizontal,
} from "lucide-react";
import { StatusBadge } from "./status-badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "./ui/dropdown-menu";
import { getCampaignCoverGradient } from "../../lib/utils/campaign-gradients";

export interface CampaignHeaderProps {
  name: string;
  brandName?: string | null;
  coverImageUrl?: string | null;
  status?: string;
  mode: "internal" | "public";
  parentCampaignId?: string | null;
  onBack?: () => void;
  onBackToParent?: () => void;
  onShare?: () => void;
  onEdit?: () => void;
  onDelete?: () => void;
  isDeleting?: boolean;
}

export function CampaignHeader({
  name,
  brandName,
  coverImageUrl,
  status,
  mode,
  parentCampaignId,
  onBack,
  onBackToParent,
  onShare,
  onEdit,
  onDelete,
  isDeleting = false,
}: CampaignHeaderProps) {
  const isInternal = mode === "internal";
  const coverGradient = React.useMemo(
    () => getCampaignCoverGradient(name),
    [name]
  );

  return (
    <div className="space-y-5">
      {/* Back to Parent Campaign Link */}
      {isInternal && parentCampaignId && onBackToParent && (
        <button
          onClick={onBackToParent}
          className="text-sm text-muted-foreground hover:text-foreground transition-colors flex items-center gap-2"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Parent Campaign
        </button>
      )}

      {/* Header */}
      <div className="flex flex-col gap-3 sm:gap-4 mt-2 sm:mt-0">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex items-start gap-3">
            {isInternal && onBack && (
              <button
                onClick={onBack}
                className="w-11 h-11 flex-shrink-0 rounded-md bg-muted/40 hover:bg-muted/60 border border-border flex items-center justify-center transition-colors"
                aria-label="Back to campaigns"
              >
                <ArrowLeft className="w-4 h-4" />
              </button>
            )}
            <div className="min-w-0">
              <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3">
                <div className="min-w-0">
                  <h1 className="text-xl sm:text-2xl font-semibold tracking-tight text-foreground break-words overflow-hidden [display:-webkit-box] [-webkit-line-clamp:2] [-webkit-box-orient:vertical] sm:[-webkit-line-clamp:1] uppercase">
                    {name}
                  </h1>
                  {brandName && (
                    <p className="text-sm text-muted-foreground mt-1 break-words">
                      {brandName}
                    </p>
                  )}
                </div>
                {status && (
                  <StatusBadge status={status} className="flex-shrink-0" />
                )}
              </div>
            </div>
          </div>
          {isInternal && (
            <div className="grid grid-cols-1 min-[360px]:grid-cols-2 gap-2 w-full sm:flex sm:gap-2 sm:w-auto">
              {onShare && (
                <button
                  onClick={onShare}
                  className="h-11 px-3 rounded-md bg-primary hover:bg-primary/90 text-black text-sm font-medium flex items-center justify-center gap-2 transition-colors"
                  aria-label="Share campaign link"
                >
                  <Share2 className="w-4 h-4" />
                  <span className="hidden sm:inline">Share Link</span>
                  <span className="sm:hidden">Share</span>
                </button>
              )}
              {(onEdit || onDelete) && (
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <button
                      type="button"
                      className="h-11 px-3 rounded-md bg-muted/40 hover:bg-muted/60 border border-border text-sm text-foreground flex items-center justify-center gap-2 transition-colors"
                      aria-label="Campaign actions"
                    >
                      <MoreHorizontal className="w-4 h-4" />
                      <span>Action</span>
                    </button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent
                    align="end"
                    className="w-52 bg-card text-foreground border-border"
                  >
                    {onEdit && (
                      <DropdownMenuItem
                        onSelect={onEdit}
                        className="text-foreground [&_svg]:text-foreground"
                      >
                        <Edit2 className="w-4 h-4" />
                        Edit Campaign
                      </DropdownMenuItem>
                    )}
                    {onDelete && (
                      <DropdownMenuItem
                        variant="destructive"
                        onSelect={onDelete}
                        disabled={isDeleting}
                      >
                        <Trash2 className="w-4 h-4" />
                        Delete Campaign
                      </DropdownMenuItem>
                    )}
                  </DropdownMenuContent>
                </DropdownMenu>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Cover Image Hero Section */}
      <div className="relative w-full aspect-[16/9] sm:aspect-[21/9] lg:aspect-[24/9] max-h-[240px] sm:max-h-[300px] rounded-xl overflow-hidden border border-border shadow-lg">
        {coverImageUrl ? (
          <>
            <img
              src={coverImageUrl}
              alt={name}
              className="w-full h-full object-cover transition-opacity duration-300"
              onError={(e) => {
                // Fallback to gradient if image fails to load
                const target = e.target as HTMLImageElement;
                target.style.display = "none";
                const parent = target.parentElement;
                if (parent) {
                  const fallback = parent.querySelector(
                    ".gradient-fallback"
                  ) as HTMLElement;
                  if (fallback) fallback.style.display = "flex";
                }
              }}
            />
            <div
              className={`gradient-fallback hidden w-full h-full ${coverGradient} items-center justify-center`}
            >
              <h2 className="text-3xl sm:text-5xl font-bold text-white/90">
                {name.charAt(0).toUpperCase()}
              </h2>
            </div>
          </>
        ) : (
          <div
            className={`w-full h-full ${coverGradient} flex items-center justify-center relative overflow-hidden`}
          >
            {/* Subtle pattern overlay */}
            <div
              className="absolute inset-0 opacity-10"
              style={{
                backgroundImage:
                  "radial-gradient(circle at 2px 2px, white 1px, transparent 0)",
                backgroundSize: "24px 24px",
              }}
            />
            <h2 className="text-3xl sm:text-5xl font-bold text-white/90 relative z-10">
              {name.charAt(0).toUpperCase()}
            </h2>
          </div>
        )}
        {/* Enhanced gradient overlay for better text readability */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/50 to-transparent" />
        {/* Text content with improved spacing and typography */}
        <div className="absolute bottom-6 left-6 right-6">
          <h2 className="text-xl sm:text-3xl font-bold text-white mb-2 drop-shadow-lg uppercase">
            {name}
          </h2>
          {brandName && (
            <p className="text-sm sm:text-lg text-white font-semibold drop-shadow-md">
              {brandName}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
