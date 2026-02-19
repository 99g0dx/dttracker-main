import { useState } from "react";
import { Link2, Copy, Check, RefreshCw, X, Users } from "lucide-react";
import { Card, CardContent } from "./ui/card";
import { Button } from "./ui/button";
import {
  useCommunityInviteLink,
  useGenerateInviteLink,
  useRevokeInviteLink,
} from "../../hooks/useCommunityInvite";

export function CommunityInviteLinkCard() {
  const { data: inviteLink, isLoading } = useCommunityInviteLink();
  const generateMutation = useGenerateInviteLink();
  const revokeMutation = useRevokeInviteLink();
  const [copied, setCopied] = useState(false);
  const [showRevokeConfirm, setShowRevokeConfirm] = useState(false);

  const inviteUrl = inviteLink?.token
    ? `${window.location.origin}/community/join/${inviteLink.token}`
    : null;

  const handleCopy = async () => {
    if (!inviteUrl) return;
    try {
      await navigator.clipboard.writeText(inviteUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback for older browsers
      const textArea = document.createElement("textarea");
      textArea.value = inviteUrl;
      document.body.appendChild(textArea);
      textArea.select();
      document.execCommand("copy");
      document.body.removeChild(textArea);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  if (isLoading) {
    return (
      <Card className="bg-card border-border/60">
        <CardContent className="p-4">
          <div className="h-12 animate-pulse rounded-lg bg-muted/40" />
        </CardContent>
      </Card>
    );
  }

  // No active link
  if (!inviteLink) {
    return (
      <Card className="bg-card border-border/60">
        <CardContent className="p-4">
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-3 min-w-0">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10">
                <Link2 className="h-4 w-4 text-primary" />
              </div>
              <div>
                <p className="text-sm font-medium text-foreground">
                  Community Invite Link
                </p>
                <p className="text-xs text-muted-foreground">
                  Generate a link to let fans join your community
                </p>
              </div>
            </div>
            <Button
              onClick={() => generateMutation.mutate()}
              disabled={generateMutation.isPending}
              size="sm"
            >
              {generateMutation.isPending ? (
                <RefreshCw className="h-3.5 w-3.5 animate-spin mr-1.5" />
              ) : (
                <Link2 className="h-3.5 w-3.5 mr-1.5" />
              )}
              Generate Link
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  // Active link
  return (
    <Card className="bg-card border-border/60">
      <CardContent className="p-4 space-y-3">
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 min-w-0">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10">
              <Link2 className="h-4 w-4 text-primary" />
            </div>
            <div>
              <p className="text-sm font-medium text-foreground">
                Community Invite Link
              </p>
              <p className="text-xs text-muted-foreground">
                Share this link to let fans join your community
              </p>
            </div>
          </div>
          {inviteLink.join_count > 0 && (
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <Users className="h-3.5 w-3.5" />
              {inviteLink.join_count} joined
            </div>
          )}
        </div>

        {/* URL display + actions */}
        <div className="flex items-center gap-2">
          <div className="flex-1 min-w-0 rounded-lg border border-border bg-muted/30 px-3 py-2">
            <p className="text-xs text-foreground truncate font-mono">
              {inviteUrl}
            </p>
          </div>
          <Button
            onClick={handleCopy}
            variant="outline"
            size="sm"
            className="flex-shrink-0"
          >
            {copied ? (
              <Check className="h-3.5 w-3.5 text-emerald-500" />
            ) : (
              <Copy className="h-3.5 w-3.5" />
            )}
          </Button>
        </div>

        {/* Management actions */}
        <div className="flex items-center gap-2 pt-1">
          <Button
            onClick={() => generateMutation.mutate()}
            disabled={generateMutation.isPending}
            variant="outline"
            size="sm"
            className="text-xs"
          >
            <RefreshCw
              className={`h-3 w-3 mr-1.5 ${generateMutation.isPending ? "animate-spin" : ""}`}
            />
            Regenerate
          </Button>

          {showRevokeConfirm ? (
            <div className="flex items-center gap-1.5">
              <span className="text-xs text-muted-foreground">Revoke link?</span>
              <Button
                onClick={() => {
                  revokeMutation.mutate();
                  setShowRevokeConfirm(false);
                }}
                disabled={revokeMutation.isPending}
                variant="destructive"
                size="sm"
                className="text-xs h-7 px-2"
              >
                Yes
              </Button>
              <Button
                onClick={() => setShowRevokeConfirm(false)}
                variant="ghost"
                size="sm"
                className="text-xs h-7 px-2"
              >
                <X className="h-3 w-3" />
              </Button>
            </div>
          ) : (
            <Button
              onClick={() => setShowRevokeConfirm(true)}
              variant="ghost"
              size="sm"
              className="text-xs text-muted-foreground hover:text-destructive"
            >
              Revoke
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
