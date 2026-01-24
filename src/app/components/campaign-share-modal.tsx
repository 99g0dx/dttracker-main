import React, { useEffect, useRef, useState } from "react";
import { Card, CardContent } from "./ui/card";
import { Button } from "./ui/button";
import { Switch } from "./ui/switch";
import { Input } from "./ui/input";
import { X, Copy, Link2, Check, RefreshCw, Lock } from "lucide-react";
import { toast } from "sonner";
import * as sharingApi from "../../lib/api/campaign-sharing-v2";
import { useIsParentCampaign, useSubcampaigns } from "../../hooks/useSubcampaigns";
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
type ShareMode = "unified" | "individual";

export function CampaignShareModal({
  campaignId,
  campaignName,
  onClose,
}: CampaignShareModalProps) {
  const { data: isParent } = useIsParentCampaign(campaignId);
  const [shareEnabled, setShareEnabled] = useState(false);
  const [shareUrl, setShareUrl] = useState<string | null>(null);
  const [shareMode, setShareMode] = useState<ShareMode>("unified");
  const [expiryOption, setExpiryOption] = useState<ExpiryOption>("never");
  const [allowExport, setAllowExport] = useState(false);
  const [passwordProtected, setPasswordProtected] = useState(false);
  const [linkHasPassword, setLinkHasPassword] = useState(false);
  const [password, setPassword] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isRegenerating, setIsRegenerating] = useState(false);
  const [copied, setCopied] = useState(false);
  const autoGenerateTimer = useRef<number | null>(null);
  const lastAutoPassword = useRef<string | null>(null);
  const [copiedSubcampaignId, setCopiedSubcampaignId] = useState<string | null>(
    null
  );
  const [subcampaignLinks, setSubcampaignLinks] = useState<
    Record<string, { url: string | null; isLoading: boolean }>
  >({});

  const {
    data: subcampaigns = [],
    isLoading: subcampaignsLoading,
  } = useSubcampaigns(isParent ? campaignId : "");

  // Load current share settings
  useEffect(() => {
    loadShareSettings();
  }, [campaignId]);

  useEffect(() => {
    setSubcampaignLinks({});
    setCopiedSubcampaignId(null);
  }, [campaignId]);

  useEffect(() => {
    return () => {
      if (autoGenerateTimer.current) {
        window.clearTimeout(autoGenerateTimer.current);
      }
    };
  }, []);

  useEffect(() => {
    if (isParent === false && shareMode !== "unified") {
      setShareMode("unified");
    }
  }, [isParent, shareMode]);

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
        setLinkHasPassword(result.data.sharePasswordProtected || false);

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

  const getExpiryHours = () => {
    if (expiryOption === "never") return null;
    if (expiryOption === "24") return 24;
    if (expiryOption === "168") return 168;
    if (expiryOption === "720") return 720;
    if (expiryOption === "1440") return 1440;
    if (expiryOption === "2160") return 2160;
    return null;
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
      const expiresInHours = getExpiryHours();

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
        setLinkHasPassword(Boolean(passwordProtected && password.trim()));
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
        setLinkHasPassword(false);
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
      const expiresInHours = getExpiryHours();

      // Pass expiration to regenerate function
      const result = await sharingApi.regenerateCampaignShareToken(
        campaignId,
        expiresInHours
      );

      if (result.error) {
        toast.error(`Failed to regenerate link: ${result.error.message}`);
      } else if (result.data) {
        setShareUrl(result.data.shareUrl);

        // Show expiration-aware success message
        const expirationMessage =
          expiryOption === "never"
            ? "Link regenerated. Never expires."
            : expiryOption === "24"
            ? "Link regenerated. Expires in 24 hours."
            : expiryOption === "168"
            ? "Link regenerated. Expires in 7 days."
            : expiryOption === "720"
            ? "Link regenerated. Expires in 30 days."
            : expiryOption === "1440"
            ? "Link regenerated. Expires in 60 days."
            : expiryOption === "2160"
            ? "Link regenerated. Expires in 90 days."
            : "Link regenerated.";

        toast.success(expirationMessage);
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

  const updateSubcampaignLink = (
    subcampaignId: string,
    updates: { url?: string | null; isLoading?: boolean }
  ) => {
    setSubcampaignLinks((prev) => ({
      ...prev,
      [subcampaignId]: {
        url: null,
        isLoading: false,
        ...prev[subcampaignId],
        ...updates,
      },
    }));
  };

  const handleGetSubcampaignLink = async (subcampaignId: string) => {
    updateSubcampaignLink(subcampaignId, { isLoading: true });
    try {
      const settings = await sharingApi.getCampaignShareSettings(subcampaignId);
      if (settings.error) {
        toast.error(`Failed to load subcampaign link: ${settings.error.message}`);
        updateSubcampaignLink(subcampaignId, { isLoading: false });
        return;
      }

      if (settings.data?.shareEnabled && settings.data.shareUrl) {
        updateSubcampaignLink(subcampaignId, {
          url: settings.data.shareUrl,
          isLoading: false,
        });
        return;
      }

      const result = await sharingApi.enableCampaignShare({
        campaignId: subcampaignId,
        expiresInHours: getExpiryHours(),
        allowExport,
        password: passwordProtected && password.trim() ? password : null,
      });

      if (result.error) {
        toast.error(`Failed to enable sharing: ${result.error.message}`);
        updateSubcampaignLink(subcampaignId, { isLoading: false });
        return;
      }

      updateSubcampaignLink(subcampaignId, {
        url: result.data?.shareUrl || null,
        isLoading: false,
      });
    } catch (error) {
      toast.error("Failed to generate subcampaign link");
      updateSubcampaignLink(subcampaignId, { isLoading: false });
    }
  };

  const handleCopySubcampaignLink = (subcampaignId: string, url: string) => {
    navigator.clipboard.writeText(url);
    setCopiedSubcampaignId(subcampaignId);
    toast.success("Link copied to clipboard");
    setTimeout(() => setCopiedSubcampaignId(null), 2000);
  };

  const handleUpdateSettings = async (overrides?: {
    passwordProtected?: boolean;
    password?: string;
  }) => {
    if (shareMode !== "unified" || !shareEnabled) return;

    setIsSaving(true);
    try {
      // Disable and re-enable to update settings
      await sharingApi.disableCampaignShare(campaignId);
      const expiresInHours = getExpiryHours();
      const nextPasswordProtected =
        overrides?.passwordProtected ?? passwordProtected;
      const nextPassword = overrides?.password ?? password;

      const result = await sharingApi.enableCampaignShare({
        campaignId,
        expiresInHours,
        allowExport,
        password: nextPasswordProtected && nextPassword.trim() ? nextPassword : null,
      });

      if (result.error) {
        toast.error(`Failed to update settings: ${result.error.message}`);
        lastAutoPassword.current = null;
      } else if (result.data) {
        setShareUrl(result.data.shareUrl);
        setLinkHasPassword(Boolean(nextPasswordProtected && nextPassword.trim()));
        lastAutoPassword.current =
          nextPasswordProtected && nextPassword.trim() ? nextPassword.trim() : null;
        toast.success("Settings updated");
      }
    } catch (error) {
      toast.error("Failed to update settings");
      lastAutoPassword.current = null;
    } finally {
      setIsSaving(false);
    }
  };

  useEffect(() => {
    if (!shareEnabled || !passwordProtected || !password.trim()) {
      lastAutoPassword.current = null;
    }
  }, [shareEnabled, passwordProtected, password]);

  const queuePasswordUpdate = (nextPassword: string) => {
    const trimmedPassword = nextPassword.trim();

    if (
      !shareEnabled ||
      !passwordProtected ||
      !trimmedPassword ||
      isSaving ||
      isRegenerating
    ) {
      return;
    }

    if (lastAutoPassword.current === trimmedPassword) {
      return;
    }

    if (autoGenerateTimer.current) {
      window.clearTimeout(autoGenerateTimer.current);
    }

    autoGenerateTimer.current = window.setTimeout(async () => {
      lastAutoPassword.current = trimmedPassword;

      // If link didn't have password before, regenerate to create new secure link
      if (!linkHasPassword) {
        setIsRegenerating(true);
        try {
          // Disable old link and create new one with password
          await sharingApi.disableCampaignShare(campaignId);
          const expiresInHours = getExpiryHours();
          const result = await sharingApi.enableCampaignShare({
            campaignId,
            expiresInHours,
            allowExport,
            password: trimmedPassword,
          });

          if (result.error) {
            toast.error(`Failed to regenerate link: ${result.error.message}`);
          } else if (result.data) {
            setShareUrl(result.data.shareUrl);
            setLinkHasPassword(true);
            toast.success("New password-protected link generated");
          }
        } catch (error) {
          toast.error("Failed to regenerate link");
        } finally {
          setIsRegenerating(false);
        }
      } else {
        // Link already has password, just update settings
        handleUpdateSettings();
      }
    }, 600);
  };

  const showUnifiedControls = !isParent || shareMode === "unified";
  const showIndividualControls = Boolean(isParent && shareMode === "individual");
  const showSettings = showIndividualControls || shareEnabled;

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
                {isParent && (
                  <div className="p-4 bg-white/[0.02] border border-white/[0.06] rounded-lg space-y-3">
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <div className="text-sm font-medium text-white">
                          Share mode
                        </div>
                        <p className="text-xs text-slate-400 mt-1">
                          Unified link shares the parent and all subcampaigns. Individual links create one link per subcampaign.
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => setShareMode("unified")}
                          className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-colors ${
                            shareMode === "unified"
                              ? "bg-primary text-black border-primary"
                              : "bg-white/[0.03] text-slate-300 border-white/[0.08] hover:bg-white/[0.06]"
                          }`}
                        >
                          Unified Link
                        </button>
                        <button
                          onClick={() => setShareMode("individual")}
                          className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-colors ${
                            shareMode === "individual"
                              ? "bg-primary text-black border-primary"
                              : "bg-white/[0.03] text-slate-300 border-white/[0.08] hover:bg-white/[0.06]"
                          }`}
                        >
                          Individual Links
                        </button>
                      </div>
                    </div>
                  </div>
                )}

                {showUnifiedControls && (
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
                )}

                {showSettings && (
                  <>
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
                      <p className="text-xs text-slate-400 mt-2">
                        This expiration will be applied when regenerating the link
                      </p>
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
                            lastAutoPassword.current = null;
                            handleUpdateSettings({
                              passwordProtected: false,
                              password: "",
                            });
                            return;
                          }
                          if (password.trim()) {
                            queuePasswordUpdate(password);
                          }
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
                          onChange={(e) => {
                            const nextValue = e.target.value;
                            setPassword(nextValue);
                            queuePasswordUpdate(nextValue);
                          }}
                          onBlur={() => handleUpdateSettings()}
                          placeholder="Enter password"
                          className="h-10 bg-white/[0.04] border-white/[0.1] text-white placeholder:text-slate-500"
                        />
                        <p className="text-xs text-slate-400 mt-2">
                          Anyone with the link will need this password to access the dashboard
                        </p>

                        {/* Share Link - shown below password when password protection is enabled */}
                        {showUnifiedControls && shareEnabled && shareUrl && (
                          <div className="mt-4 p-3 bg-white/[0.02] border border-white/[0.06] rounded-lg space-y-2">
                            <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider">
                              Share Link
                            </label>
                            <div className="flex items-center gap-2">
                              <div className="flex-1 p-2 bg-white/[0.02] border border-white/[0.06] rounded font-mono text-xs text-white break-all">
                                {shareUrl}
                              </div>
                              <Button
                                onClick={handleCopyLink}
                                size="sm"
                                variant="outline"
                                className="flex-shrink-0"
                              >
                                {copied ? (
                                  <Check className="w-3 h-3" />
                                ) : (
                                  <Copy className="w-3 h-3" />
                                )}
                              </Button>
                            </div>
                          </div>
                        )}
                      </div>
                    )}

                    {/* Share Link - shown here when password protection is NOT enabled */}
                    {showUnifiedControls && shareEnabled && shareUrl && !passwordProtected && (
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

                {showIndividualControls && (
                  <div className="space-y-3">
                    <div className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
                      Subcampaign Links
                    </div>
                    {subcampaignsLoading ? (
                      <div className="text-sm text-slate-400">Loading subcampaigns...</div>
                    ) : subcampaigns.length === 0 ? (
                      <div className="rounded-lg border border-white/[0.08] bg-white/[0.02] p-4 text-sm text-slate-400">
                        No subcampaigns available yet.
                      </div>
                    ) : (
                      <div className="space-y-3">
                        {subcampaigns.map((subcampaign) => {
                          const linkState = subcampaignLinks[subcampaign.id];
                          const linkUrl = linkState?.url || null;
                          const isLinkLoading = Boolean(linkState?.isLoading);

                          return (
                            <div
                              key={subcampaign.id}
                              className="rounded-lg border border-white/[0.08] bg-white/[0.02] p-4 space-y-3"
                            >
                              <div className="flex items-center justify-between gap-4">
                                <div className="min-w-0">
                                  <p className="text-sm font-medium text-white truncate">
                                    {subcampaign.name}
                                  </p>
                                  <p className="text-xs text-slate-500 mt-1">
                                    Status: {subcampaign.status}
                                  </p>
                                </div>
                                {linkUrl ? (
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={() =>
                                      handleCopySubcampaignLink(subcampaign.id, linkUrl)
                                    }
                                  >
                                    {copiedSubcampaignId === subcampaign.id ? (
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
                                ) : (
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={() => handleGetSubcampaignLink(subcampaign.id)}
                                    disabled={isLinkLoading}
                                  >
                                    {isLinkLoading ? "Generating..." : "Get Link"}
                                  </Button>
                                )}
                              </div>
                              {linkUrl && (
                                <div className="text-xs font-mono text-slate-300 break-all">
                                  {linkUrl}
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
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
