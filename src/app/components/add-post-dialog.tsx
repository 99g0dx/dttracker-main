import React, { useState, useEffect } from 'react';
import { Card, CardContent } from './ui/card';
import { Button } from './ui/button';
import { Input } from './ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from './ui/select';
import { X, Link as LinkIcon, CheckCircle, AlertCircle, Loader2 } from 'lucide-react';
import { PlatformBadge } from './platform-badge';
import { parsePostURL, normalizeHandle } from '../../lib/utils/urlParser';
import { useAddPostWithScrape } from '../../hooks/usePosts';
import type { Creator, Platform } from '../../lib/types/database';

interface AddPostDialogProps {
  open: boolean;
  onClose: () => void;
  campaignId: string;
  campaignCreators: Creator[];
}

export function AddPostDialog({
  open,
  onClose,
  campaignId,
  campaignCreators,
}: AddPostDialogProps) {
  const [postUrl, setPostUrl] = useState('');
  const [parsedUrl, setParsedUrl] = useState<{
    platform: Platform | null;
    handle: string | null;
    isValid: boolean;
  } | null>(null);
  const [matchedCreator, setMatchedCreator] = useState<Creator | null>(null);
  const [selectedCreatorId, setSelectedCreatorId] = useState<string>('');
  const [error, setError] = useState<string | null>(null);

  const addPostMutation = useAddPostWithScrape();

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
      setSelectedCreatorId(''); // Reset selection when URL changes

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
        setSelectedCreatorId('');
      }
    } else {
      setParsedUrl(null);
      setMatchedCreator(null);
      setSelectedCreatorId('');
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
      setPostUrl('');
      setParsedUrl(null);
      setMatchedCreator(null);
      setSelectedCreatorId('');
      setError(null);
    }
  }, [open]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!parsedUrl?.isValid || !parsedUrl.platform) {
      setError('Please enter a valid post URL');
      return;
    }

    if (!matchedCreator) {
      setError('Please select a creator for this post.');
      return;
    }

    if (availableCreators.length === 0) {
      setError(`No creators found for ${parsedUrl.platform}. Please import creators first.`);
      return;
    }

    try {
      await addPostMutation.mutateAsync({
        campaign_id: campaignId,
        creator_id: matchedCreator.id,
        platform: parsedUrl.platform,
        post_url: postUrl.trim(),
        status: 'pending',
        views: 0,
        likes: 0,
        comments: 0,
        shares: 0,
        engagement_rate: 0,
      });

      // Close dialog on success
      onClose();
    } catch (err) {
      // Error is handled by the mutation's onError
      console.error('Failed to add post:', err);
    }
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
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
                  placeholder="https://tiktok.com/@username/video/123..."
                  className="pl-9 bg-white/[0.03] border-white/[0.08] text-white"
                  disabled={addPostMutation.isPending}
                />
              </div>
              <p className="text-xs text-slate-400 mt-1.5">
                Paste the link to the post. The system will detect the platform; if no handle is present, pick a creator.
              </p>
            </div>

            {/* Detection Results */}
            {parsedUrl && (
              <div className="space-y-3 p-4 rounded-lg bg-white/[0.03] border border-white/[0.08]">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-slate-400">Platform:</span>
                  {parsedUrl.platform ? (
                    <PlatformBadge platform={parsedUrl.platform} />
                  ) : (
                    <span className="text-sm text-slate-500">Not detected</span>
                  )}
                </div>

                {parsedUrl.handle && (
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-slate-400">Handle detected:</span>
                    <span className="text-sm text-white font-mono">@{parsedUrl.handle}</span>
                  </div>
                )}
              </div>
            )}

            {/* Creator Selection */}
            {parsedUrl?.platform && (
              <div>
                <label className="block text-sm font-medium text-white mb-2">
                  Select Creator {parsedUrl.handle && matchedCreator ? '(auto-matched)' : ''}
                </label>
                <Select
                  value={selectedCreatorId}
                  onValueChange={setSelectedCreatorId}
                  disabled={addPostMutation.isPending}
                >
                  <SelectTrigger className="bg-white/[0.03] border-white/[0.08] text-white">
                    <SelectValue placeholder="Choose a creator..." />
                  </SelectTrigger>
                  <SelectContent>
                    {availableCreators.length > 0 ? (
                      availableCreators.map((creator) => (
                        <SelectItem key={creator.id} value={creator.id}>
                          <div className="flex items-center gap-2">
                            <span>{creator.name}</span>
                            <span className="text-xs text-slate-400">(@{creator.handle})</span>
                          </div>
                        </SelectItem>
                      ))
                    ) : (
                      <SelectItem value="" disabled>
                        No creators available for {parsedUrl.platform}
                      </SelectItem>
                    )}
                  </SelectContent>
                </Select>
                {parsedUrl.handle && !matchedCreator && (
                  <p className="text-xs text-slate-400 mt-1.5">
                    Handle "@{parsedUrl.handle}" not found. Please select a creator manually.
                  </p>
                )}
                {!parsedUrl.handle && (
                  <p className="text-xs text-slate-400 mt-1.5">
                    Could not extract handle from URL. Please select the creator manually.
                  </p>
                )}
              </div>
            )}

            {/* Matched Creator Display */}
            {matchedCreator && (
              <div className="p-3 rounded-lg bg-emerald-500/10 border border-emerald-500/20">
                <div className="flex items-center gap-2">
                  <CheckCircle className="w-4 h-4 text-emerald-400" />
                  <span className="text-sm text-emerald-400">
                    Post will be added for: <strong>{matchedCreator.name}</strong> (@{matchedCreator.handle})
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
            {parsedUrl && !parsedUrl.platform && parsedUrl.isValid && (
              <div className="p-3 rounded-lg bg-yellow-500/10 border border-yellow-500/20">
                <p className="text-sm text-yellow-400">
                  Could not detect platform. Please ensure the URL is from a supported platform (TikTok, Instagram, YouTube, Twitter/X, Facebook).
                </p>
              </div>
            )}

            {/* Actions */}
            <div className="flex gap-3 pt-2">
              <button
                type="button"
                onClick={onClose}
                disabled={addPostMutation.isPending}
                className="flex-1 h-10 rounded-md bg-white/[0.03] hover:bg-white/[0.06] border border-white/[0.08] text-sm text-slate-300 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Cancel
              </button>
              <Button
                type="submit"
                disabled={
                  !parsedUrl?.isValid ||
                  !parsedUrl?.platform ||
                  !matchedCreator ||
                  addPostMutation.isPending ||
                  availableCreators.length === 0
                }
                className="flex-1 h-10 bg-primary hover:bg-primary/90 text-black text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {addPostMutation.isPending ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Adding & Scraping...
                  </>
                ) : (
                  'Add & Scrape'
                )}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
