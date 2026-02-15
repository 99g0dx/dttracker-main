import React, { useEffect, useState } from "react";
import { Card, CardContent } from "../ui/card";
import { Button } from "../ui/button";
import { Switch } from "../ui/switch";
import { Input } from "../ui/input";
import { X, Copy, Link2, Check, RefreshCw, Lock } from "lucide-react";
import { toast } from "sonner";
import * as sharingApi from "../../../lib/api/activation-sharing";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../ui/select";

interface ActivationShareModalProps {
  activationId: string;
  activationTitle: string;
  onClose: () => void;
}

type ExpiryOption = "never" | "24" | "168" | "720";

export function ActivationShareModal({
  activationId,
  activationTitle,
  onClose,
}: ActivationShareModalProps) {
  const [shareEnabled, setShareEnabled] = useState(false);
  const [shareUrl, setShareUrl] = useState<string | null>(null);
  const [expiryOption, setExpiryOption] = useState<ExpiryOption>("never");
  const [passwordProtected, setPasswordProtected] = useState(false);
  const [password, setPassword] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isRegenerating, setIsRegenerating] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    loadShareSettings();
  }, [activationId]);

  const loadShareSettings = async () => {
    setIsLoading(true);
    try {
      const result = await sharingApi.getActivationShareSettings(activationId);
      if (result.error) {
        toast.error(`Failed to load share settings: ${result.error.message}`);
      } else if (result.data) {
        setShareEnabled(result.data.shareEnabled);
        setShareUrl(result.data.shareUrl);
        setPasswordProtected(result.data.sharePasswordProtected || false);
        if (!result.data.shareExpiresAt) {
          setExpiryOption("never");
        } else {
          const expiresAt = new Date(result.data.shareExpiresAt);
          const now = new Date();
          const hours =
            (expiresAt.getTime() - now.getTime()) / (1000 * 60 * 60);
          if (hours <= 24) setExpiryOption("24");
          else if (hours <= 168) setExpiryOption("168");
          else if (hours <= 720) setExpiryOption("720");
          else setExpiryOption("never");
        }
      }
    } catch {
      toast.error("Failed to load share settings");
    } finally {
      setIsLoading(false);
    }
  };

  const getExpiryHours = (): number | null => {
    if (expiryOption === "never") return null;
    if (expiryOption === "24") return 24;
    if (expiryOption === "168") return 168;
    if (expiryOption === "720") return 720;
    return null;
  };

  const handleToggleShare = async (enabled: boolean) => {
    if (enabled) {
      setIsSaving(true);
      try {
        const result = await sharingApi.enableActivationShare({
          activationId,
          expiresInHours: getExpiryHours(),
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
      } catch {
        toast.error("Failed to enable sharing");
        setShareEnabled(false);
      } finally {
        setIsSaving(false);
      }
    } else {
      setIsSaving(true);
      try {
        const result = await sharingApi.disableActivationShare(activationId);
        if (result.error) {
          toast.error(`Failed to disable sharing: ${result.error.message}`);
          setShareEnabled(true);
        } else {
          setShareEnabled(false);
          setShareUrl(null);
          toast.success("View-only link disabled");
        }
      } catch {
        toast.error("Failed to disable sharing");
        setShareEnabled(true);
      } finally {
        setIsSaving(false);
      }
    }
  };

  const handleRegenerate = async () => {
    setIsRegenerating(true);
    try {
      const result = await sharingApi.regenerateActivationShareToken(
        activationId,
        getExpiryHours(),
      );
      if (result.error) {
        toast.error(`Failed to regenerate link: ${result.error.message}`);
      } else if (result.data) {
        setShareUrl(result.data.shareUrl);
        toast.success("Link regenerated");
      }
    } catch {
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

  const handleUpdatePassword = async () => {
    if (!shareEnabled) return;
    setIsSaving(true);
    try {
      await sharingApi.disableActivationShare(activationId);
      const result = await sharingApi.enableActivationShare({
        activationId,
        expiresInHours: getExpiryHours(),
        password: passwordProtected && password.trim() ? password : null,
      });
      if (result.error) {
        toast.error(`Failed to update settings: ${result.error.message}`);
      } else if (result.data) {
        setShareUrl(result.data.shareUrl);
        toast.success("Settings updated");
      }
    } catch {
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
        className="bg-card border-border max-w-lg w-full max-h-[90vh] overflow-hidden shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <CardContent className="p-0">
          <div className="sticky top-0 bg-card border-b border-border px-6 py-4 z-10">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-lg font-semibold text-foreground">
                  Share activation
                </h2>
                <p className="text-sm text-muted-foreground mt-0.5 truncate max-w-[280px]">
                  {activationTitle}
                </p>
              </div>
              <button
                onClick={onClose}
                className="w-9 h-9 rounded-lg hover:bg-muted flex items-center justify-center transition-colors"
                aria-label="Close"
              >
                <X className="w-4 h-4 text-muted-foreground" />
              </button>
            </div>
          </div>

          <div className="px-6 py-4 max-h-[calc(90vh-140px)] overflow-y-auto space-y-4">
            {isLoading ? (
              <div className="flex flex-col items-center justify-center py-10">
                <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin mb-3" />
                <p className="text-sm text-muted-foreground">
                  Loading share settings...
                </p>
              </div>
            ) : (
              <>
                <div className="flex items-center justify-between p-4 rounded-lg bg-muted/50 border border-border">
                  <div className="flex items-center gap-3">
                    <Link2 className="w-5 h-5 text-primary flex-shrink-0" />
                    <div>
                      <div className="font-medium text-foreground text-sm">
                        Enable view-only link
                      </div>
                      <div className="text-xs text-muted-foreground mt-0.5">
                        Anyone with the link can view contest progress
                      </div>
                    </div>
                  </div>
                  <Switch
                    checked={shareEnabled}
                    onCheckedChange={handleToggleShare}
                    disabled={isSaving}
                  />
                </div>

                {shareEnabled && (
                  <>
                    <div>
                      <label className="block text-xs font-medium text-muted-foreground mb-1.5">
                        Link expires
                      </label>
                      <Select
                        value={expiryOption}
                        onValueChange={(v: ExpiryOption) => setExpiryOption(v)}
                        disabled={isSaving}
                      >
                        <SelectTrigger className="h-9 bg-muted/50 border-border">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="never">Never</SelectItem>
                          <SelectItem value="24">24 hours</SelectItem>
                          <SelectItem value="168">7 days</SelectItem>
                          <SelectItem value="720">30 days</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="flex items-center justify-between p-4 rounded-lg bg-muted/50 border border-border">
                      <div className="flex items-center gap-3">
                        <Lock className="w-5 h-5 text-primary flex-shrink-0" />
                        <div>
                          <div className="font-medium text-foreground text-sm">
                            Password protection
                          </div>
                          <div className="text-xs text-muted-foreground mt-0.5">
                            Require a password to view
                          </div>
                        </div>
                      </div>
                      <Switch
                        checked={passwordProtected}
                        onCheckedChange={(checked) => {
                          setPasswordProtected(checked);
                          if (!checked) setPassword("");
                        }}
                        disabled={isSaving}
                      />
                    </div>

                    {passwordProtected && (
                      <div>
                        <label className="block text-xs font-medium text-muted-foreground mb-1.5">
                          Password
                        </label>
                        <div className="flex gap-2">
                          <Input
                            type="password"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            placeholder="Enter password"
                            className="h-9 bg-muted/50 border-border"
                          />
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={handleUpdatePassword}
                            disabled={isSaving}
                          >
                            Save
                          </Button>
                        </div>
                      </div>
                    )}

                    {shareUrl && (
                      <div className="p-4 rounded-lg bg-muted/50 border border-border space-y-2">
                        <label className="block text-xs font-medium text-muted-foreground">
                          Share link
                        </label>
                        <div className="flex items-center gap-2">
                          <div className="flex-1 min-w-0 p-2 rounded bg-background border border-border font-mono text-xs text-foreground truncate">
                            {shareUrl}
                          </div>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={handleCopyLink}
                            className="flex-shrink-0"
                          >
                            {copied ? (
                              <Check className="w-4 h-4 text-green-500" />
                            ) : (
                              <Copy className="w-4 h-4" />
                            )}
                          </Button>
                        </div>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={handleRegenerate}
                          disabled={isRegenerating}
                          className="gap-1.5 text-muted-foreground"
                        >
                          <RefreshCw
                            className={`w-4 h-4 ${isRegenerating ? "animate-spin" : ""}`}
                          />
                          {isRegenerating
                            ? "Regenerating..."
                            : "Regenerate link"}
                        </Button>
                      </div>
                    )}
                  </>
                )}
              </>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
