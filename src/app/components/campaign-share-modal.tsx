import React, { useState, useEffect } from "react";
import { Card, CardContent } from "./ui/card";
import { Button } from "./ui/button";
import { Switch } from "./ui/switch";
import { Input } from "./ui/input";
import { X, Copy, Link2, Check, RefreshCw, Lock } from "lucide-react";
import { toast } from "sonner";
import * as sharingApi from "../../lib/api/campaign-sharing-v2";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "./ui/select";

interface CampaignShareModalProps {
  campaignId: string;
  campaignName: string;
  onClose: () => void;
}

type ExpiryOption = "never" | "24" | "168" | "720" | "1440" | "2160"; // 24 hours, 168 hours (7 days), 720 hours (30 days), 1440 hours (60 days), 2160 hours (90 days)

export function CampaignShareModal({
  campaignId,
  campaignName,
  onClose,
}: CampaignShareModalProps) {
  const [shareEnabled, setShareEnabled] = useState(false);
  const [shareUrl, setShareUrl] = useState<string | null>(null);
  const [expiryOption, setExpiryOption] = useState<ExpiryOption>("never");
  const [allowExport, setAllowExport] = useState(false);
  const [passwordProtected, setPasswordProtected] = useState(false);
  const [password, setPassword] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isRegenerating, setIsRegenerating] = useState(false);
  const [copied, setCopied] = useState(false);

  // Load current share settings
  useEffect(() => {
    loadShareSettings();
  }, [campaignId]);

  const loadShareSettings = async () => {
    setIsLoading(true);
    try {
      const result = await sharingApi.getCampaignShareSettings(campaignId);
      if (result.error) {
        toast.error(`Failed to load share settings: ${result.error.message}`);
      } else if (result.data) {
        setShareEnabled(result.data.shareEnabled);
        setShareUrl(result.data.shareUrl);
        setAllowExport(result.data.shareAllowExport);
        setPasswordProtected(result.data.sharePasswordProtected || false);

        // Determine expiry option from expiresAt
        if (!result.data.shareExpiresAt) {
          setExpiryOption("never");
        } else {
          const expiresAt = new Date(result.data.shareExpiresAt);
          const now = new Date();
          const hoursUntilExpiry = (expiresAt.getTime() - now.getTime()) / (1000 * 60 * 60);
          if (hoursUntilExpiry <= 24) {
            setExpiryOption("24");
          } else if (hoursUntilExpiry <= 168) {
            setExpiryOption("168");
          } else if (hoursUntilExpiry <= 720) {
            setExpiryOption("720");
          } else if (hoursUntilExpiry <= 1440) {
            setExpiryOption("1440");
          } else if (hoursUntilExpiry <= 2160) {
            setExpiryOption("2160");
          } else {
            setExpiryOption("never");
          }
        }
      }
    } catch (error) {
      toast.error("Failed to load share settings");
    } finally {
      setIsLoading(false);
    }
  };

  const handleToggleShare = async (enabled: boolean) => {
    if (enabled) {
      // Enable sharing
      await handleEnableShare();
    } else {
      // Disable sharing
      await handleDisableShare();
    }
  };

  const handleEnableShare = async () => {
    setIsSaving(true);
    try {
      const expiresInHours =
        expiryOption === "never"
          ? null
          : expiryOption === "24"
          ? 24
          : expiryOption === "168"
          ? 168
          : expiryOption === "720"
          ? 720
          : expiryOption === "1440"
          ? 1440
          : expiryOption === "2160"
          ? 2160
          : null;

      const result = await sharingApi.enableCampaignShare({
        campaignId,
        expiresInHours,
        allowExport,
        password: passwordProtected && password.trim() ? password : null,
      });

      if (result.error) {
        toast.error(`Failed to enable sharing: ${result.error.message}`);
        setShareEnabled(false);
      } else if (result.data) {
        setShareEnabled(true);
        setShareUrl(result.data.shareUrl);
        toast.success("View-only link enabled");
      }
    } catch (error) {
      toast.error("Failed to enable sharing");
      setShareEnabled(false);
    } finally {
      setIsSaving(false);
    }
  };

  const handleDisableShare = async () => {
    setIsSaving(true);
    try {
      const result = await sharingApi.disableCampaignShare(campaignId);

      if (result.error) {
        toast.error(`Failed to disable sharing: ${result.error.message}`);
        setShareEnabled(true);
      } else {
        setShareEnabled(false);
        setShareUrl(null);
        toast.success("View-only link disabled");
      }
    } catch (error) {
      toast.error("Failed to disable sharing");
      setShareEnabled(true);
    } finally {
      setIsSaving(false);
    }
  };

  const handleRegenerate = async () => {
    setIsRegenerating(true);
    try {
      const result = await sharingApi.regenerateCampaignShareToken(campaignId);

      if (result.error) {
        toast.error(`Failed to regenerate link: ${result.error.message}`);
      } else if (result.data) {
        setShareUrl(result.data.shareUrl);
        toast.success("Link regenerated. Old link is now invalid.");
      }
    } catch (error) {
      toast.error("Failed to regenerate link");
    } finally {
      setIsRegenerating(false);
    }
  };

  const handleCopyLink = () => {
    if (!shareUrl) return;
    navigator.clipboard.writeText(shareUrl);
    setCopied(true);
    toast.success("Link copied to clipboard");
    setTimeout(() => setCopied(false), 2000);
  };

  const handleUpdateSettings = async () => {
    if (!shareEnabled) return;

    setIsSaving(true);
    try {
      // Disable and re-enable to update settings
      await sharingApi.disableCampaignShare(campaignId);
      const expiresInHours =
        expiryOption === "never"
          ? null
          : expiryOption === "24"
          ? 24
          : expiryOption === "168"
          ? 168
          : expiryOption === "720"
          ? 720
          : expiryOption === "1440"
          ? 1440
          : expiryOption === "2160"
          ? 2160
          : null;

      const result = await sharingApi.enableCampaignShare({
        campaignId,
        expiresInHours,
        allowExport,
        password: passwordProtected && password.trim() ? password : null,
      });

      if (result.error) {
        toast.error(`Failed to update settings: ${result.error.message}`);
      } else if (result.data) {
        setShareUrl(result.data.shareUrl);
        toast.success("Settings updated");
      }
    } catch (error) {
      toast.error("Failed to update settings");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div
      className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4"
      onClick={onClose}
    >
      <Card
        className="bg-[#0D0D0D] border-white/[0.08] max-w-2xl w-full max-h-[90vh] overflow-hidden shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <CardContent className="p-0">
          {/* Header */}
          <div className="sticky top-0 bg-[#0D0D0D]/95 backdrop-blur-xl border-b border-white/[0.08] px-8 py-6 z-10">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-xl font-semibold text-white tracking-tight">
                  Share Campaign
                </h2>
                <p className="text-sm text-slate-500 mt-1.5">{campaignName}</p>
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
          <div className="px-8 py-6 max-h-[calc(90vh-200px)] overflow-y-auto space-y-6">
            {isLoading ? (
              <div className="flex flex-col items-center justify-center py-12">
                <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin mb-4"></div>
                <p className="text-slate-400 text-sm">Loading share settings...</p>
              </div>
            ) : (
              <>
                {/* Enable/Disable Toggle */}
                <div className="flex items-center justify-between p-4 bg-white/[0.02] border border-white/[0.06] rounded-lg">
                  <div className="flex items-center gap-3">
                    <Link2 className="w-5 h-5 text-primary" />
                    <div>
                      <div className="font-medium text-white text-sm">
                        Enable view-only link
                      </div>
                      <div className="text-xs text-slate-400 mt-0.5">
                        Allow anyone with the link to view this campaign dashboard
                      </div>
                    </div>
                  </div>
                  <Switch
                    checked={shareEnabled}
                    onCheckedChange={handleToggleShare}
                    disabled={isSaving}
                  />
                </div>

                {/* Share Settings (only show when enabled) */}
                {shareEnabled && (
                  <>
                    {/* Share URL */}
                    {shareUrl && (
                      <div className="space-y-3">
                        <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider">
                          Share Link
                        </label>
                        <div className="flex items-center gap-2">
                          <div className="flex-1 p-3 bg-white/[0.02] border border-white/[0.06] rounded-lg font-mono text-sm text-white break-all">
                            {shareUrl}
                          </div>
                          <Button
                            onClick={handleCopyLink}
                            size="sm"
                            variant="outline"
                            className="flex-shrink-0"
                          >
                            {copied ? (
                              <>
                                <Check className="w-4 h-4 mr-2" />
                                Copied
                              </>
                            ) : (
                              <>
                                <Copy className="w-4 h-4 mr-2" />
                                Copy
                              </>
                            )}
                          </Button>
                        </div>
                        <Button
                          onClick={handleRegenerate}
                          disabled={isRegenerating}
                          variant="outline"
                          size="sm"
                          className="w-full"
                        >
                          <RefreshCw
                            className={`w-4 h-4 mr-2 ${isRegenerating ? "animate-spin" : ""}`}
                          />
                          {isRegenerating ? "Regenerating..." : "Regenerate Link"}
                        </Button>
                      </div>
                    )}

                    {/* Expiry Setting */}
                    <div>
                      <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2">
                        Link Expires
                      </label>
                      <Select
                        value={expiryOption}
                        onValueChange={(value: ExpiryOption) => {
                          setExpiryOption(value);
                          handleUpdateSettings();
                        }}
                        disabled={isSaving}
                      >
                        <SelectTrigger className="h-10 bg-white/[0.04] border-white/[0.1] text-white">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="never">Never</SelectItem>
                          <SelectItem value="24">24 hours</SelectItem>
                          <SelectItem value="168">7 days</SelectItem>
                          <SelectItem value="720">30 days</SelectItem>
                          <SelectItem value="1440">60 days</SelectItem>
                          <SelectItem value="2160">90 days</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    {/* Password Protection Toggle */}
                    <div className="flex items-center justify-between p-4 bg-white/[0.02] border border-white/[0.06] rounded-lg">
                      <div className="flex items-center gap-3">
                        <Lock className="w-5 h-5 text-primary" />
                        <div>
                          <div className="font-medium text-white text-sm">
                            Password Protection
                          </div>
                          <div className="text-xs text-slate-400 mt-0.5">
                            Require a password to view this shared dashboard
                          </div>
                        </div>
                      </div>
                      <Switch
                        checked={passwordProtected}
                        onCheckedChange={(checked) => {
                          setPasswordProtected(checked);
                          if (!checked) {
                            setPassword("");
                          }
                          handleUpdateSettings();
                        }}
                        disabled={isSaving}
                      />
                    </div>

                    {/* Password Input (show when password protection is enabled) */}
                    {passwordProtected && (
                      <div>
                        <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2">
                          Password
                        </label>
                        <Input
                          type="password"
                          value={password}
                          onChange={(e) => setPassword(e.target.value)}
                          onBlur={handleUpdateSettings}
                          placeholder="Enter password"
                          className="h-10 bg-white/[0.04] border-white/[0.1] text-white placeholder:text-slate-500"
                        />
                        <p className="text-xs text-slate-400 mt-2">
                          Anyone with the link will need this password to access the dashboard
                        </p>
                      </div>
                    )}

                    {/* Allow Export Toggle */}
                    <div className="flex items-center justify-between p-4 bg-white/[0.02] border border-white/[0.06] rounded-lg">
                      <div>
                        <div className="font-medium text-white text-sm">
                          Allow Export
                        </div>
                        <div className="text-xs text-slate-400 mt-0.5">
                          Enable CSV export in the shared view
                        </div>
                      </div>
                      <Switch
                        checked={allowExport}
                        onCheckedChange={(checked) => {
                          setAllowExport(checked);
                          handleUpdateSettings();
                        }}
                        disabled={isSaving}
                      />
                    </div>
                  </>
                )}
              </>
            )}
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

