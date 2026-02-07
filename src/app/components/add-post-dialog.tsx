import React, { useState, useEffect } from "react";
import { Card, CardContent } from "./ui/card";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "./ui/select";
import {
  X,
  Link as LinkIcon,
  CheckCircle,
  AlertCircle,
  Loader2,
  User,
} from "lucide-react";
import { UpgradeModal } from "./upgrade-modal";
import {
  PlatformIcon,
  normalizePlatform,
  getPlatformLabel,
} from "./ui/PlatformIcon";
import {
  parsePostURL,
  normalizeHandle,
  getExternalIdFromUrl,
} from "../../lib/utils/urlParser";
import { useAddPostWithScrape } from "../../hooks/usePosts";
import { useIsParentCampaign } from "../../hooks/useSubcampaigns";
import { useQueryClient } from "@tanstack/react-query";
import * as creatorsApi from "../../lib/api/creators";
import { creatorsKeys } from "../../hooks/useCreators";
import * as postsApi from "../../lib/api/posts";
import type { Creator, Platform } from "../../lib/types/database";

interface AddPostDialogProps {
  open: boolean;
  onClose: () => void;
  campaignId: string;
  campaignCreators: Creator[];
}

interface ExtendedParsedUrl {
  platform: Platform | null;
  handle: string | null;
  isValid: boolean;
  shortcode?: string;
  instagramType?: "p" | "reel" | "tv";
  videoId?: string;
  error?: string;
  isProfileUrl?: boolean;
}

export function AddPostDialog({
  open,
  onClose,
  campaignId,
  campaignCreators,
}: AddPostDialogProps) {
  const [postUrl, setPostUrl] = useState("");
  const [parsedUrl, setParsedUrl] = useState<ExtendedParsedUrl | null>(null);
  const [matchedCreator, setMatchedCreator] = useState<Creator | null>(null);
  const [selectedCreatorId, setSelectedCreatorId] = useState<string>("");
  const [manualCreatorHandle, setManualCreatorHandle] = useState<string>("");
  const [error, setError] = useState<string | null>(null);
  const [isCreatingCreator, setIsCreatingCreator] = useState(false);
  const [upgradeOpen, setUpgradeOpen] = useState(false);
  const [upgradeMessage, setUpgradeMessage] = useState("");

  const queryClient = useQueryClient();
  const addPostMutation = useAddPostWithScrape();
  const { data: isParent } = useIsParentCampaign(campaignId);

  // Filter creators by detected platform
  const availableCreators = parsedUrl?.platform
    ? campaignCreators.filter((c) => c.platform === parsedUrl.platform)
    : campaignCreators;

  // Parse URL when it changes
  useEffect(() => {
    if (postUrl.trim()) {
      const parsed = parsePostURL(postUrl);
      setParsedUrl(parsed);
      setError(null);
      setSelectedCreatorId(""); // Reset selection when URL changes
      setManualCreatorHandle(""); // Reset manual handle when URL changes

      // Try to match creator if handle is extracted
      if (parsed.handle && parsed.platform) {
        const normalizedHandle = normalizeHandle(parsed.handle);
        const creator = campaignCreators.find(
          (c) =>
            normalizeHandle(c.handle) === normalizedHandle &&
            c.platform === parsed.platform
        );
        setMatchedCreator(creator || null);

        if (creator) {
          setSelectedCreatorId(creator.id);
        } else {
          // Handle extracted but creator not found - user can still select manually
          setMatchedCreator(null);
        }
      } else {
        // No handle extracted - user must select creator manually
        setMatchedCreator(null);
        setSelectedCreatorId("");
      }
    } else {
      setParsedUrl(null);
      setMatchedCreator(null);
      setSelectedCreatorId("");
      setManualCreatorHandle("");
      setError(null);
    }
  }, [postUrl, campaignCreators]);

  // Update matched creator when manual selection changes
  useEffect(() => {
    if (selectedCreatorId) {
      const creator = campaignCreators.find((c) => c.id === selectedCreatorId);
      setMatchedCreator(creator || null);
    } else {
      setMatchedCreator(null);
    }
  }, [selectedCreatorId, campaignCreators]);

  // Reset form when dialog closes
  useEffect(() => {
    if (!open) {
      setPostUrl("");
      setParsedUrl(null);
      setMatchedCreator(null);
      setSelectedCreatorId("");
      setManualCreatorHandle("");
      setError(null);
    }
  }, [open]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!parsedUrl?.isValid || !parsedUrl.platform) {
      setError(parsedUrl?.error || "Please enter a valid post URL");
      return;
    }

    if (isParent) {
      setError(
        "Parent campaigns cannot have posts. Please select a subcampaign."
      );
      return;
    }

    // Get external_id for deduplication
    const externalId = getExternalIdFromUrl(postUrl, parsedUrl.platform);

    // Check for duplicate if we have an external_id
    if (externalId) {
      try {
        const dupeCheck = await postsApi.checkDuplicate(
          campaignId,
          parsedUrl.platform,
          externalId
        );
        if (dupeCheck.data) {
          setError(
            `This ${parsedUrl.platform === "instagram" ? "Instagram" : parsedUrl.platform === "youtube" ? "YouTube" : parsedUrl.platform === "tiktok" ? "TikTok" : parsedUrl.platform} post is already added to this campaign.`
          );
          return;
        }
      } catch (err) {
        if (import.meta.env.DEV) {
          console.warn("Duplicate check failed, proceeding anyway:", err);
        }
      }
    }

    let creatorToUse = matchedCreator;

    // Determine which handle to use: parsed from URL, or manually entered
    const handleToUse =
      parsedUrl.handle ||
      (manualCreatorHandle.trim()
        ? normalizeHandle(manualCreatorHandle.trim())
        : null);

    // Auto-create creator if handle was extracted or manually entered but no match found
    if (!creatorToUse && handleToUse) {
      setIsCreatingCreator(true);
      try {
        // #region agent log
        fetch('http://127.0.0.1:7242/ingest/1c4fc1e3-c4d5-4e26-91bc-35bf48274c5b',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'add-post-dialog.tsx:193',message:'calling getOrCreate',data:{handleToUse,platform:parsedUrl.platform},timestamp:Date.now(),runId:'run1',hypothesisId:'A'})}).catch(()=>{});
        // #endregion
        // 1. Create or get existing creator
        const creatorResult = await creatorsApi.getOrCreate(
          handleToUse, // Use handle as name
          handleToUse,
          parsedUrl.platform,
          undefined, // followerCount
          undefined, // email
          undefined, // phone
          undefined, // niche
          undefined, // location
          "manual" // sourceType
        );

        // #region agent log
        fetch('http://127.0.0.1:7242/ingest/1c4fc1e3-c4d5-4e26-91bc-35bf48274c5b',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'add-post-dialog.tsx:208',message:'getOrCreate result',data:{success:!!creatorResult.data,error:creatorResult.error?.message,creatorId:creatorResult.data?.id},timestamp:Date.now(),runId:'run1',hypothesisId:'A'})}).catch(()=>{});
        // #endregion

        if (creatorResult.error || !creatorResult.data) {
          // #region agent log
          fetch('http://127.0.0.1:7242/ingest/1c4fc1e3-c4d5-4e26-91bc-35bf48274c5b',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'add-post-dialog.tsx:210',message:'getOrCreate failed',data:{error:creatorResult.error?.message,errorStack:creatorResult.error?.stack},timestamp:Date.now(),runId:'run1',hypothesisId:'A'})}).catch(()=>{});
          // #endregion
          setError(
            `Failed to create creator: ${creatorResult.error?.message || "Unknown error"}`
          );
          setIsCreatingCreator(false);
          return;
        }

        // 2. Add creator to campaign
        const addResult = await creatorsApi.addCreatorsToCampaign(campaignId, [
          creatorResult.data.id,
        ]);

        if (addResult.error) {
          if (
            addResult.error.message.includes(
              "UPGRADE_REQUIRED:creator_limit_reached"
            )
          ) {
            setUpgradeMessage("Upgrade to add more creators to this campaign.");
            setUpgradeOpen(true);
            setIsCreatingCreator(false);
            return;
          }
          setError(
            `Failed to add creator to campaign: ${addResult.error.message}`
          );
          setIsCreatingCreator(false);
          return;
        }

        // 3. Invalidate queries to refresh campaign creators list
        await queryClient.invalidateQueries({
          queryKey: creatorsKeys.byCampaign(campaignId),
        });

        creatorToUse = creatorResult.data;
      } catch (err) {
        setError(
          `Failed to create creator: ${err instanceof Error ? err.message : "Unknown error"}`
        );
        setIsCreatingCreator(false);
        return;
      }
      setIsCreatingCreator(false);
    }

    // If still no creator (no handle extracted and none selected)
    if (!creatorToUse && parsedUrl.platform !== "instagram") {
      setError("Please select a creator for this post.");
      return;
    }

    try {
      const result = await addPostMutation.mutateAsync({
        campaign_id: campaignId,
        creator_id: creatorToUse?.id ?? null,
        platform: parsedUrl.platform,
        post_url: postUrl.trim(),
        status: "pending",
        views: 0,
        likes: 0,
        comments: 0,
        shares: 0,
        engagement_rate: 0,
        external_id: externalId || null,
      });

      // Close dialog on success
      onClose();
    } catch (err) {
      // Error is handled by the mutation's onError
      if (import.meta.env.DEV) {
        console.error("Failed to add post:", err);
      }
    }
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
      <UpgradeModal
        open={upgradeOpen}
        title="Upgrade Required"
        message={upgradeMessage || "Upgrade your plan to add more creators."}
        onClose={() => setUpgradeOpen(false)}
        onUpgrade={() => (window.location.href = "/subscription")}
      />
      <Card className="bg-[#0D0D0D] border-white/[0.08] w-full max-w-md">
        <CardContent className="p-6">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-lg font-semibold text-white">Add Post</h3>
            <button
              onClick={onClose}
              className="w-8 h-8 rounded-md bg-white/[0.03] hover:bg-white/[0.06] border border-white/[0.08] flex items-center justify-center transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* URL Input */}
            <div>
              <label className="block text-sm font-medium text-white mb-2">
                Post URL
              </label>
              <div className="relative">
                <LinkIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                <Input
                  type="url"
                  value={postUrl}
                  onChange={(e) => setPostUrl(e.target.value)}
                  placeholder="Paste a TikTok, Instagram, or YouTube post link"
                  className="pl-9 bg-white/[0.03] border-white/[0.08] text-white"
                  disabled={addPostMutation.isPending}
                />
              </div>
              <p className="text-xs text-slate-400 mt-1.5">
                Paste the link to a TikTok, Instagram, or YouTube post. We
                detect the platform. If the link does not include a handle,
                enter it or choose a creator.
              </p>
            </div>

            {/* Detection Results */}
            {parsedUrl && (
              <div className="space-y-3 p-4 rounded-lg bg-white/[0.03] border border-white/[0.08]">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-slate-400">Platform:</span>
                  {parsedUrl.platform ? (
                    <div className="flex items-center gap-2">
                      {(() => {
                        const platformIcon = normalizePlatform(
                          parsedUrl.platform
                        );
                        if (!platformIcon) return null;
                        return (
                          <PlatformIcon
                            platform={platformIcon}
                            size="sm"
                            aria-label={`${getPlatformLabel(platformIcon)} post`}
                          />
                        );
                      })()}
                      <span className="text-xs px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400">
                        {parsedUrl.platform === "tiktok"
                          ? "TikTok"
                          : parsedUrl.platform === "instagram"
                            ? "Instagram"
                            : parsedUrl.platform === "youtube"
                              ? "YouTube"
                              : parsedUrl.platform === "twitter"
                                ? "Twitter/X"
                                : parsedUrl.platform === "facebook"
                                  ? "Facebook"
                                  : "Unknown"}{" "}
                        detected
                      </span>
                    </div>
                  ) : (
                    <span className="text-sm text-slate-500">Not detected</span>
                  )}
                </div>

                {parsedUrl.handle && (
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-slate-400">
                      Handle detected:
                    </span>
                    <span className="text-sm text-white font-mono">
                      @{parsedUrl.handle}
                    </span>
                  </div>
                )}

                {/* Instagram shortcode display */}
                {parsedUrl.platform === "instagram" && parsedUrl.shortcode && (
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-slate-400">
                      Instagram shortcode:
                    </span>
                    <span className="text-sm text-cyan-400 font-mono">
                      {parsedUrl.shortcode}
                    </span>
                  </div>
                )}

                {/* TikTok video ID display */}
                {parsedUrl.platform === "tiktok" && parsedUrl.videoId && (
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-slate-400">Video ID:</span>
                    <span className="text-sm text-cyan-400 font-mono text-xs">
                      {parsedUrl.videoId}
                    </span>
                  </div>
                )}

                {/* YouTube video ID display */}
                {parsedUrl.platform === "youtube" && parsedUrl.videoId && (
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-slate-400">Video ID:</span>
                    <span className="text-sm text-cyan-400 font-mono text-xs">
                      {parsedUrl.videoId}
                    </span>
                  </div>
                )}
              </div>
            )}

            {/* Instagram profile URL warning */}
            {parsedUrl?.isProfileUrl && parsedUrl.platform === "instagram" && (
              <div className="p-3 rounded-lg bg-amber-500/10 border border-amber-500/20">
                <div className="flex items-start gap-2">
                  <AlertCircle className="w-4 h-4 text-amber-400 mt-0.5 flex-shrink-0" />
                  <p className="text-sm text-amber-400">
                    This looks like a profile link. Paste a specific post or
                    reel link instead.
                  </p>
                </div>
              </div>
            )}

            {/* URL parsing error */}
            {parsedUrl?.error && !parsedUrl.isProfileUrl && (
              <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/20">
                <div className="flex items-start gap-2">
                  <AlertCircle className="w-4 h-4 text-red-400 mt-0.5 flex-shrink-0" />
                  <p className="text-sm text-red-400">{parsedUrl.error}</p>
                </div>
              </div>
            )}

            {/* Manual Creator Handle Input - shown for Instagram/YouTube when no handle in URL and no creator selected */}
            {(parsedUrl?.platform === "instagram" ||
              parsedUrl?.platform === "youtube") &&
              parsedUrl.isValid &&
              !parsedUrl.handle &&
              !selectedCreatorId && (
                <div>
                  <label className="block text-sm font-medium text-white mb-2">
                    Creator Handle
                  </label>
                  <div className="relative">
                    <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                    <Input
                      type="text"
                      value={manualCreatorHandle}
                      onChange={(e) => setManualCreatorHandle(e.target.value)}
                      placeholder={
                        parsedUrl.platform === "youtube"
                          ? "Enter YouTube channel (e.g. @channel_name)"
                          : "Enter Instagram username (e.g. @creator_name)"
                      }
                      className="pl-9 bg-white/[0.03] border-white/[0.08] text-white"
                      disabled={addPostMutation.isPending}
                    />
                  </div>
                  <p className="text-xs text-slate-400 mt-1.5">
                    {parsedUrl.platform === "youtube"
                      ? "Enter the creator's YouTube handle. We'll create the creator and attach this post."
                      : "Enter the creator's Instagram handle. We'll create the creator and attach this post."}
                  </p>
                </div>
              )}

            {/* Creator Selection */}
            {parsedUrl?.platform && parsedUrl.isValid && (
              <div>
                <label className="block text-sm font-medium text-white mb-2">
                  {parsedUrl.handle && matchedCreator
                    ? "Creator (auto-matched)"
                    : (parsedUrl.platform === "instagram" ||
                          parsedUrl.platform === "youtube") &&
                        !parsedUrl.handle &&
                        !manualCreatorHandle.trim()
                      ? "Or Select Existing Creator (optional)"
                      : (parsedUrl.platform === "instagram" ||
                            parsedUrl.platform === "youtube") &&
                          !parsedUrl.handle
                        ? "Or Select Existing Creator"
                        : "Select Creator"}
                </label>
                <Select
                  value={selectedCreatorId}
                  onValueChange={(value) => {
                    setSelectedCreatorId(value);
                    if (value) setManualCreatorHandle(""); // Clear manual handle when selecting existing creator
                  }}
                  disabled={addPostMutation.isPending}
                >
                  <SelectTrigger className="bg-white/[0.03] border-white/[0.08] text-white">
                    <SelectValue placeholder="Choose a creator..." />
                  </SelectTrigger>
                  <SelectContent>
                    {availableCreators.map((creator) => (
                      <SelectItem key={creator.id} value={creator.id}>
                        <div className="flex items-center gap-2">
                          <span>{creator.name}</span>
                          <span className="text-xs text-slate-400">
                            (@{creator.handle})
                          </span>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {availableCreators.length === 0 && parsedUrl.handle && (
                  <p className="text-xs text-emerald-400 mt-1.5">
                    Creator "@{parsedUrl.handle}" will be automatically created
                    and added to this campaign.
                  </p>
                )}
                {availableCreators.length === 0 &&
                  !parsedUrl.handle &&
                  !manualCreatorHandle.trim() && (
                    <p className="text-xs text-amber-400 mt-1.5">
                      No{" "}
                      {parsedUrl.platform === "instagram"
                        ? "Instagram"
                        : parsedUrl.platform === "youtube"
                          ? "YouTube"
                          : parsedUrl.platform === "tiktok"
                            ? "TikTok"
                            : parsedUrl.platform}{" "}
                      creators in this campaign yet.
                    </p>
                  )}
                {availableCreators.length > 0 &&
                  parsedUrl.handle &&
                  !matchedCreator && (
                    <p className="text-xs text-slate-400 mt-1.5">
                      Handle "@{parsedUrl.handle}" not found in campaign. Select
                      a creator or submit to auto-create.
                    </p>
                  )}
                {availableCreators.length > 0 &&
                  !parsedUrl.handle &&
                  parsedUrl.platform !== "instagram" &&
                  parsedUrl.platform !== "youtube" && (
                    <p className="text-xs text-slate-400 mt-1.5">
                      Could not extract handle from URL. Please select the
                      creator manually.
                    </p>
                  )}
              </div>
            )}

            {/* Manual Creator Handle Confirmation */}
            {manualCreatorHandle.trim() &&
              !selectedCreatorId &&
              (parsedUrl?.platform === "instagram" ||
                parsedUrl?.platform === "youtube") && (
                <div className="p-3 rounded-lg bg-emerald-500/10 border border-emerald-500/20">
                  <div className="flex items-center gap-2">
                    <CheckCircle className="w-4 h-4 text-emerald-400" />
                    <span className="text-sm text-emerald-400">
                      Creator "@{normalizeHandle(manualCreatorHandle.trim())}"
                      will be created and attached to this post.
                    </span>
                  </div>
                </div>
              )}

            {/* Matched Creator Display */}
            {matchedCreator && (
              <div className="p-3 rounded-lg bg-emerald-500/10 border border-emerald-500/20">
                <div className="flex items-center gap-2">
                  <CheckCircle className="w-4 h-4 text-emerald-400" />
                  <span className="text-sm text-emerald-400">
                    Post will be added for:{" "}
                    <strong>{matchedCreator.name}</strong> (@
                    {matchedCreator.handle})
                  </span>
                </div>
              </div>
            )}

            {/* Error Message */}
            {error && (
              <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/20">
                <p className="text-sm text-red-400">{error}</p>
              </div>
            )}

            {/* Info when no platform detected */}
            {parsedUrl && !parsedUrl.platform && (
              <div className="p-3 rounded-lg bg-yellow-500/10 border border-yellow-500/20">
                <p className="text-sm text-yellow-400">
                  Unsupported link. Paste a TikTok, Instagram, or YouTube post
                  link.
                </p>
              </div>
            )}

            {/* Actions */}
            <div className="flex gap-3 pt-2">
              <button
                type="button"
                onClick={onClose}
                disabled={addPostMutation.isPending || isCreatingCreator}
                className="flex-1 h-10 rounded-md bg-white/[0.03] hover:bg-white/[0.06] border border-white/[0.08] text-sm text-slate-300 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Cancel
              </button>
              <Button
                type="submit"
                disabled={
                  !parsedUrl?.isValid ||
                  !parsedUrl?.platform ||
                  (!matchedCreator &&
                    !parsedUrl?.handle &&
                    !manualCreatorHandle.trim() &&
                    parsedUrl?.platform !== "instagram" &&
                    parsedUrl?.platform !== "youtube") ||
                  addPostMutation.isPending ||
                  isCreatingCreator
                }
                className="flex-1 h-10 bg-primary hover:bg-primary/90 text-black text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {addPostMutation.isPending || isCreatingCreator ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    {isCreatingCreator
                      ? "Creating creator..."
                      : "Adding post & fetching metrics..."}
                  </>
                ) : (
                  "Add & Scrape"
                )}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
