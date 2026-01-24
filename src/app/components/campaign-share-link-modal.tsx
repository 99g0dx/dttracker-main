import React, { useEffect, useRef, useState } from "react";
import { Card, CardContent } from "./ui/card";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Switch } from "./ui/switch";
import {
  X,
  Copy,
  Link2,
  Lock,
  Trash2,
  Check,
  Calendar,
  Clock,
} from "lucide-react";
import { toast } from "sonner";
import * as sharingApi from "../../lib/api/campaign-sharing";
import type { CampaignShareLink } from "../../lib/types/database";

interface CampaignShareLinkModalProps {
  campaignId: string;
  campaignName: string;
  onClose: () => void;
}

export function CampaignShareLinkModal({
  campaignId,
  campaignName,
  onClose,
}: CampaignShareLinkModalProps) {
  const [isPasswordProtected, setIsPasswordProtected] = useState(false);
  const [password, setPassword] = useState("");
  const [expiresAt, setExpiresAt] = useState("");
  const [shareLinks, setShareLinks] = useState<CampaignShareLink[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [copiedToken, setCopiedToken] = useState<string | null>(null);
  const autoGenerateTimer = useRef<number | null>(null);
  const lastAutoPassword = useRef<string | null>(null);

  // Load existing share links
  useEffect(() => {
    loadShareLinks();
  }, [campaignId]);

  const loadShareLinks = async () => {
    setIsLoading(true);
    try {
      const result = await sharingApi.getShareLinksForCampaign(campaignId);
      if (result.error) {
        toast.error(`Failed to load share links: ${result.error.message}`);
      } else {
        setShareLinks(result.data || []);
      }
    } catch (error) {
      toast.error("Failed to load share links");
    } finally {
      setIsLoading(false);
    }
  };

  const handleGenerateLink = async (options?: { preserveForm?: boolean }) => {
    if (isPasswordProtected && !password.trim()) {
      toast.error("Please enter a password");
      return;
    }

    setIsGenerating(true);
    try {
      const result = await sharingApi.generateShareLink(
        campaignId,
        isPasswordProtected,
        isPasswordProtected ? password : undefined,
        expiresAt || undefined
      );

      if (result.error) {
        toast.error(`Failed to create share link: ${result.error.message}`);
      } else {
        toast.success("Share link created successfully");
        if (result.data) {
          setShareLinks([result.data]);
        }
        if (!options?.preserveForm) {
          // Reset form after manual generation
          setIsPasswordProtected(false);
          setPassword("");
          setExpiresAt("");
        }
        // Reload share links
        loadShareLinks();
      }
    } catch (error) {
      toast.error("Failed to create share link");
    } finally {
      setIsGenerating(false);
    }
  };

  useEffect(() => {
    const currentLink = shareLinks[0];
    const trimmedPassword = password.trim();

    if (
      !currentLink ||
      currentLink.is_password_protected ||
      !isPasswordProtected ||
      !trimmedPassword ||
      isGenerating ||
      lastAutoPassword.current === trimmedPassword
    ) {
      return;
    }

    if (autoGenerateTimer.current) {
      window.clearTimeout(autoGenerateTimer.current);
    }

    autoGenerateTimer.current = window.setTimeout(() => {
      lastAutoPassword.current = trimmedPassword;
      handleGenerateLink({ preserveForm: true });
    }, 600);

    return () => {
      if (autoGenerateTimer.current) {
        window.clearTimeout(autoGenerateTimer.current);
      }
    };
  }, [shareLinks, isPasswordProtected, password, isGenerating, expiresAt]);

  const handleCopyLink = (token: string) => {
    const shareUrl = `${window.location.origin}/share/campaign/${token}`;
    navigator.clipboard.writeText(shareUrl);
    setCopiedToken(token);
    toast.success("Share link copied to clipboard");
    setTimeout(() => setCopiedToken(null), 2000);
  };

  const handleDeleteLink = async (token: string) => {
    if (!confirm("Are you sure you want to revoke this share link?")) {
      return;
    }

    try {
      const result = await sharingApi.deleteShareLink(token);
      if (result.error) {
        toast.error(`Failed to revoke share link: ${result.error.message}`);
      } else {
        toast.success("Share link revoked successfully");
        loadShareLinks();
      }
    } catch (error) {
      toast.error("Failed to revoke share link");
    }
  };

  const getShareUrl = (token: string) => {
    return `${window.location.origin}/share/campaign/${token}`;
  };

  const isExpired = (link: CampaignShareLink) => {
    if (!link.expires_at) return false;
    return new Date(link.expires_at) < new Date();
  };

  const formatDate = (dateString: string | null) => {
    if (!dateString) return "Never";
    return new Date(dateString).toLocaleDateString();
  };

  return (
    <div
      className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4"
      onClick={onClose}
    >
      <Card
        className="bg-[#0D0D0D] border-white/[0.08] max-w-3xl w-full max-h-[90vh] overflow-hidden shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <CardContent className="p-0">
          {/* Header */}
          <div className="sticky top-0 bg-[#0D0D0D]/95 backdrop-blur-xl border-b border-white/[0.08] px-8 py-6 z-10">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-xl font-semibold text-white tracking-tight">
                  Share Campaign Link
                </h2>
                <p className="text-sm text-slate-500 mt-1.5">
                  Create a view-only link for {campaignName}
                </p>
              </div>
              <button
                onClick={onClose}
                className="w-9 h-9 rounded-lg hover:bg-white/[0.08] flex items-center justify-center transition-all duration-200"
              >
                <X className="w-4.5 h-4.5 text-slate-400" />
              </button>
            </div>
          </div>

          {/* Content */}
          <div className="px-8 py-6 max-h-[calc(90vh-200px)] overflow-y-auto">
            {/* Generate New Link Section */}
            <div className="mb-8">
              <h3 className="text-sm font-semibold text-white mb-4">
                Create New Share Link
              </h3>
              <div className="space-y-4 bg-white/[0.02] border border-white/[0.06] rounded-lg p-5">
                {/* Password Protection Toggle */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <Lock className="w-4 h-4 text-slate-400" />
                    <div>
                      <div className="font-medium text-white text-sm">
                        Password Protection
                      </div>
                      <div className="text-xs text-slate-400">
                        Require a password to view the campaign
                      </div>
                    </div>
                  </div>
                  <Switch
                    checked={isPasswordProtected}
                    onCheckedChange={setIsPasswordProtected}
                  />
                </div>

                {/* Password Input */}
                {isPasswordProtected && (
                  <div className="animate-in fade-in duration-200">
                    <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2">
                      Password
                    </label>
                    <Input
                      type="password"
                      placeholder="Enter password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="h-10 bg-white/[0.04] border-white/[0.1] text-white placeholder:text-slate-600 focus:bg-white/[0.06] focus:border-primary/50 focus:ring-2 focus:ring-primary/20 transition-all duration-200"
                    />
                  </div>
                )}

                {/* Expiry Date */}
                <div>
                  <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2">
                    Expires At (Optional)
                  </label>
                  <Input
                    type="datetime-local"
                    value={expiresAt}
                    onChange={(e) => setExpiresAt(e.target.value)}
                    className="h-10 bg-white/[0.04] border-white/[0.1] text-white focus:bg-white/[0.06] focus:border-primary/50 focus:ring-2 focus:ring-primary/20 transition-all duration-200"
                  />
                  <p className="text-xs text-slate-500 mt-1.5">
                    Leave empty for no expiration
                  </p>
                </div>

                {/* Current Share Link */}
                <div className="border-t border-white/[0.08] pt-4">
                  <h4 className="text-xs font-semibold text-slate-300 uppercase tracking-wider mb-3">
                    {shareLinks.length > 0
                      ? "Current Share Link"
                      : "No Share Link Yet"}
                  </h4>
                  {isLoading ? (
                    <div className="flex flex-col items-center justify-center py-6">
                      <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin mb-3"></div>
                      <p className="text-slate-400 text-sm">
                        Loading share links...
                      </p>
                    </div>
                  ) : shareLinks.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-6 bg-white/[0.02] border border-white/[0.06] rounded-lg">
                      <Link2 className="w-10 h-10 text-slate-500 mb-2" />
                      <p className="text-slate-400 text-sm">
                        No share links created yet
                      </p>
                      <p className="text-slate-500 text-xs mt-1">
                        Create a share link below to get started
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {shareLinks.map((link) => {
                        const expired = isExpired(link);
                        const shareUrl = getShareUrl(link.share_token);
                        const isCopied = copiedToken === link.share_token;

                        return (
                          <div
                            key={link.id}
                            className={`p-4 bg-white/[0.02] border rounded-lg transition-all duration-200 ${
                              expired
                                ? "border-amber-500/30 bg-amber-500/5"
                                : "border-white/[0.06] hover:bg-white/[0.04]"
                            }`}
                          >
                            <div className="flex items-start justify-between gap-4">
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2 mb-2">
                                  {link.is_password_protected && (
                                    <Lock className="w-4 h-4 text-slate-400 flex-shrink-0" />
                                  )}
                                  <div className="flex-1 min-w-0">
                                    <div className="font-mono text-sm text-white break-all">
                                      {shareUrl}
                                    </div>
                                  </div>
                                </div>
                                <div className="flex items-center gap-4 text-xs text-slate-500 mt-2">
                                  <div className="flex items-center gap-1.5">
                                    <Calendar className="w-3.5 h-3.5" />
                                    <span>
                                      Created: {formatDate(link.created_at)}
                                    </span>
                                  </div>
                                  {link.expires_at && (
                                    <div
                                      className={`flex items-center gap-1.5 ${
                                        expired ? "text-amber-400" : ""
                                      }`}
                                    >
                                      <Clock className="w-3.5 h-3.5" />
                                      <span>
                                        {expired ? "Expired: " : "Expires: "}
                                        {formatDate(link.expires_at)}
                                      </span>
                                    </div>
                                  )}
                                  {link.last_accessed_at && (
                                    <div className="flex items-center gap-1.5">
                                      <span>
                                        Last accessed:{" "}
                                        {formatDate(link.last_accessed_at)}
                                      </span>
                                    </div>
                                  )}
                                </div>
                                {expired && (
                                  <div className="mt-2 text-xs text-amber-400">
                                    This link has expired
                                  </div>
                                )}
                              </div>
                              <div className="flex items-center gap-2 flex-shrink-0">
                                <Button
                                  onClick={() => handleCopyLink(link.share_token)}
                                  size="sm"
                                  variant="outline"
                                  className="h-8 px-3 bg-white/[0.04] hover:bg-white/[0.08] border-white/[0.1] text-slate-300 hover:text-white"
                                >
                                  {isCopied ? (
                                    <>
                                      <Check className="w-3.5 h-3.5 mr-1.5" />
                                      Copied
                                    </>
                                  ) : (
                                    <>
                                      <Copy className="w-3.5 h-3.5 mr-1.5" />
                                      Copy
                                    </>
                                  )}
                                </Button>
                                <Button
                                  onClick={() => handleDeleteLink(link.share_token)}
                                  size="sm"
                                  variant="outline"
                                  className="h-8 px-3 bg-red-500/10 hover:bg-red-500/20 border-red-500/30 text-red-400 hover:text-red-300"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </Button>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>

                {/* Generate Button */}
                <Button
                  onClick={() => handleGenerateLink()}
                  disabled={isGenerating}
                  className="w-full h-10 bg-primary hover:bg-primary/90 text-black font-medium"
                >
                  <Link2
                    className={`w-4 h-4 mr-2 ${isGenerating ? "animate-spin" : ""}`}
                  />
                  {isGenerating
                    ? "Creating..."
                    : shareLinks.length > 0
                    ? "Update Share Link"
                    : "Create Share Link"}
                </Button>
              </div>
            </div>
          </div>

          {/* Footer */}
          <div className="sticky bottom-0 bg-[#0D0D0D]/95 backdrop-blur-xl border-t border-white/[0.08] px-8 py-5">
            <Button
              onClick={onClose}
              className="w-full h-11 bg-white/[0.04] hover:bg-white/[0.08] border border-white/[0.1] hover:border-white/[0.15] text-white transition-all duration-200 rounded-lg font-medium"
            >
              Done
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
