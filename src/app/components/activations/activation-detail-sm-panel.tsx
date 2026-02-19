import React from "react";
import { Card, CardContent } from "../ui/card";
import { ArrowLeft, ThumbsUp, Calendar, ExternalLink, Upload, Loader2, RefreshCw, Heart, Share2 } from "lucide-react";
import { CommunityDeliveryCard } from "./community-delivery-card";
import { useActivationSubmissions, useSyncActivationToDobbleTap } from "../../../hooks/useActivations";
import type { Activation } from "../../../lib/types/database";
import { format } from "date-fns";
import { PlatformIcon } from "../ui/PlatformIcon";
import { formatNumber } from "../../../lib/utils/format";
import { Button } from "../ui/button";
import { Progress } from "../ui/progress";

interface ActivationDetailSMPanelProps {
  activation: Activation;
  onNavigate: (path: string) => void;
}

function formatAmount(amount: number): string {
  return new Intl.NumberFormat("en-NG", {
    style: "currency",
    currency: "NGN",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
}

function isImageProofUrl(url: string): boolean {
  if (!url) return false;
  const u = url.toLowerCase();
  return (
    /\.(jpg|jpeg|png|gif|webp)(\?|$)/i.test(u) ||
    u.includes("image") ||
    u.includes("img.")
  );
}

export function ActivationDetailSMPanel({
  activation,
  onNavigate,
}: ActivationDetailSMPanelProps) {
  const { data: submissions = [], refetch: refetchSubmissions, isFetching: isRefetchingSubmissions } = useActivationSubmissions(activation.id);
  const syncToDobbleTap = useSyncActivationToDobbleTap();

  // Auto-sync to Dobble Tap when activation is live but not yet synced
  const autoSyncAttempted = React.useRef(false);
  React.useEffect(() => {
    if (
      activation.status === "live" &&
      !activation.synced_to_dobble_tap &&
      !syncToDobbleTap.isPending &&
      !autoSyncAttempted.current
    ) {
      autoSyncAttempted.current = true;
      syncToDobbleTap.mutate(activation.id);
    }
  }, [activation.id, activation.status, activation.synced_to_dobble_tap, syncToDobbleTap]);

  const approvedSubmissions = submissions.filter(
    (s) => s.status === "approved",
  );
  const approvedCount = approvedSubmissions.length;
  const spentAmount = approvedSubmissions.reduce(
    (sum, s) => sum + (s.payment_amount != null ? Number(s.payment_amount) : 0),
    0,
  );
  const baseRateLabel =
    activation.base_rate != null ? "Base Rate (Nano)" : "Per Action";
  const progress =
    activation.max_participants && activation.max_participants > 0
      ? (approvedCount / activation.max_participants) * 100
      : 0;

  const statusConfig: Record<string, string> = {
    draft: "Draft",
    live: "Live",
    completed: "Completed",
    cancelled: "Cancelled",
  };
  const statusLabel = statusConfig[activation.status] ?? activation.status;

  const COMPLETION_PAGE_SIZE = 15;
  const [completionPage, setCompletionPage] = React.useState(1);
  const totalCompletionPages = Math.max(
    1,
    Math.ceil(submissions.length / COMPLETION_PAGE_SIZE),
  );
  React.useEffect(() => {
    if (completionPage > totalCompletionPages && totalCompletionPages >= 1) {
      setCompletionPage(1);
    }
  }, [submissions.length, totalCompletionPages, completionPage]);
  const paginatedSubmissions = submissions.slice(
    (completionPage - 1) * COMPLETION_PAGE_SIZE,
    completionPage * COMPLETION_PAGE_SIZE,
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <button
          onClick={() => onNavigate("/activations")}
          className="w-11 h-11 rounded-md bg-muted/60 hover:bg-muted/80 border border-border flex items-center justify-center"
        >
          <ArrowLeft className="w-4 h-4" />
        </button>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <ThumbsUp className="w-5 h-5 text-red-600 dark:text-cyan-400 flex-shrink-0" />
            <span className="text-xs text-muted-foreground">SM Panel</span>
          </div>
          <h1 className="text-xl font-semibold text-foreground truncate">
            {activation.title}
          </h1>
          <p className="text-sm text-muted-foreground">
            {approvedCount}
            {activation.max_participants
              ? `/${formatNumber(activation.max_participants)}`
              : ""}{" "}
            completed
          </p>
          {activation.platforms && activation.platforms.length > 0 && (
            <div className="flex flex-wrap gap-1.5 mt-2">
              {activation.platforms.map((p) => (
                <div
                  key={p}
                  className="flex items-center gap-1 rounded-md bg-muted/80 px-2 py-0.5"
                >
                  <PlatformIcon
                    platform={
                      p as "tiktok" | "instagram" | "youtube" | "x" | "facebook"
                    }
                    size="sm"
                  />
                  <span className="text-xs text-muted-foreground capitalize">
                    {p}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
        <span
          className={`text-xs font-medium px-2 py-1 rounded border ${
            activation.status === "live"
              ? "bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 border-emerald-500/30"
              : activation.status === "completed"
                ? "bg-red-100/70 dark:bg-blue-500/20 text-red-700 dark:text-blue-400 border-red-200 dark:border-blue-500/30"
                : "bg-slate-500/20 text-muted-foreground border-slate-500/30"
          }`}
        >
          {statusLabel}
        </span>
      </div>

      {activation.status === "live" && !activation.synced_to_dobble_tap && (
        <Card className="bg-amber-500/10 dark:bg-amber-500/10 border-amber-500/30">
          <CardContent className="p-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <p className="text-sm text-amber-800 dark:text-amber-200">
              {syncToDobbleTap.isPending
                ? "Syncing to Dobble Tap..."
                : "This activation was not synced to Dobble Tap. Retrying..."}
            </p>
            <Button
              size="sm"
              variant="secondary"
              onClick={() => syncToDobbleTap.mutate(activation.id)}
              disabled={syncToDobbleTap.isPending}
              className="shrink-0"
            >
              {syncToDobbleTap.isPending ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <>
                  <RefreshCw className="w-4 h-4 mr-1.5 shrink-0" />
                  Retry Sync
                </>
              )}
            </Button>
          </CardContent>
        </Card>
      )}

      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <Card className="bg-card border-border">
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground">Deadline</p>
            <p className="font-medium text-foreground flex items-center gap-2 mt-1">
              <Calendar className="w-4 h-4" />
              {format(new Date(activation.deadline), "MMM d")}
            </p>
          </CardContent>
        </Card>
        <Card className="bg-card border-border">
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground">Task</p>
            <p className="font-medium text-foreground capitalize mt-1">
              {activation.task_type ?? "-"}
            </p>
          </CardContent>
        </Card>
        <Card className="bg-card border-border">
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground">Spent</p>
            <p className="font-medium text-foreground mt-1">
              {formatAmount(spentAmount)} /{" "}
              {formatAmount(activation.total_budget)}
            </p>
          </CardContent>
        </Card>
        <Card className="bg-card border-border">
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground">{baseRateLabel}</p>
            <p className="font-medium text-foreground mt-1">
              {formatAmount(
                Number(
                  activation.base_rate ?? activation.payment_per_action ?? 0,
                ),
              )}
            </p>
          </CardContent>
        </Card>
      </div>

      {activation.target_url && (
        <Card className="bg-card border-border">
          <CardContent className="p-4">
            <a
              href={activation.target_url}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 text-sm font-medium text-primary hover:underline focus:outline-none focus:ring-2 focus:ring-primary/20 rounded"
            >
              <ExternalLink className="w-4 h-4 shrink-0" />
              View Target Post
            </a>
          </CardContent>
        </Card>
      )}

      <Card className="bg-card border-border">
        <CardContent className="p-5">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-medium text-muted-foreground">
              Participants
            </h3>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => refetchSubmissions()}
              disabled={isRefetchingSubmissions}
              className="text-muted-foreground hover:text-foreground"
              title="Refresh completions (e.g. after approval on Dobble Tap)"
            >
              {isRefetchingSubmissions ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <RefreshCw className="w-4 h-4" />
              )}
            </Button>
          </div>
          <div className="flex justify-between text-sm mb-2">
            <span className="text-muted-foreground">Completed</span>
            <span className="font-semibold text-foreground">
              {approvedCount}
              {activation.max_participants
                ? ` / ${formatNumber(activation.max_participants)}`
                : ""}
            </span>
          </div>
          <Progress
            value={Math.min(progress, 100)}
            className="h-3"
          />
          <p className="text-xs text-muted-foreground mt-3">
            DTTracker (activation ID: {activation.id}). Approved entries will
            sync to sm panel.
          </p>
        </CardContent>
      </Card>

      {activation.brief && (
        <Card className="bg-card border-border">
          <CardContent className="p-6">
            <h3 className="text-sm font-medium text-muted-foreground mb-2">
              Brief
            </h3>
            <p className="text-foreground whitespace-pre-wrap">
              {activation.brief}
            </p>
          </CardContent>
        </Card>
      )}

      <CommunityDeliveryCard activation={activation} />

      {false && (
      <Card className="bg-card border-border">
        <CardContent className="p-6">
          <h3 className="text-sm font-medium text-muted-foreground mb-4">
            Completions
          </h3>
          {submissions.length === 0 ? (
            <div className="py-12 text-center">
              <p className="text-muted-foreground">No completions yet</p>
              <p className="text-muted-foreground text-sm mt-1">
                Completions will appear when creators submit from Dobble Tap
              </p>
            </div>
          ) : (
            <>
              <div className="grid grid-cols-2 lg:grid-cols-3 gap-2">
                {paginatedSubmissions.map((s) => (
                  <div
                    key={s.id}
                    className="flex flex-col gap-1.5 p-2.5 rounded-md bg-muted/60 border border-border/60 min-w-0"
                  >
                    <p className="font-medium text-foreground truncate text-sm">
                      @{s.creator_handle || s.display_handle || "Unknown"}
                    </p>
                    <p className="text-[11px] text-muted-foreground">
                      {format(new Date(s.submitted_at), "MMM d, HH:mm")} •{" "}
                      {s.status}
                      {s.tier && (
                        <>
                          {" • "}
                          <span className="text-muted-foreground">
                            {s.tier}
                          </span>
                        </>
                      )}
                      {s.creator_followers != null && (
                        <>
                          {" • "}
                          <span className="text-muted-foreground">
                            {formatNumber(s.creator_followers)} followers
                          </span>
                        </>
                      )}
                    </p>
                    {activation.task_type === "comment" && s.proof_comment_text && (
                      <p className="text-xs text-muted-foreground italic truncate">
                        &ldquo;{s.proof_comment_text}&rdquo;
                      </p>
                    )}
                    {activation.task_type === "like" && (
                      <span className="inline-flex items-center gap-1 text-xs text-emerald-400">
                        <Heart className="w-3 h-3 shrink-0" /> Liked
                      </span>
                    )}
                    {activation.task_type === "repost" && (
                      <span className="inline-flex items-center gap-1 text-xs text-purple-400">
                        <Share2 className="w-3 h-3 shrink-0" /> Reposted
                      </span>
                    )}
                    <div className="flex items-center gap-2 mt-auto flex-wrap">
                      {s.payment_amount != null && (
                        <span className="text-primary font-medium text-xs">
                          {formatAmount(s.payment_amount)}
                        </span>
                      )}
                      {s.proof_url && (
                        <>
                          {isImageProofUrl(s.proof_url) ? (
                            <a
                              href={s.proof_url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="shrink-0 rounded border border-border overflow-hidden bg-muted/40 hover:opacity-90 transition-opacity"
                            >
                              <img
                                src={s.proof_url}
                                alt="Proof"
                                className="w-8 h-8 object-cover"
                              />
                            </a>
                          ) : null}
                          <a
                            href={s.proof_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-primary hover:underline text-xs flex items-center gap-1"
                          >
                            View Proof <ExternalLink className="w-3 h-3 shrink-0" />
                          </a>
                        </>
                      )}
                    </div>
                  </div>
                ))}
              </div>
              {submissions.length > COMPLETION_PAGE_SIZE && (
                <div className="flex items-center justify-center gap-4 mt-4 pt-4 border-t border-border">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setCompletionPage((p) => Math.max(1, p - 1))}
                    disabled={completionPage <= 1}
                  >
                    Previous
                  </Button>
                  <span className="text-sm text-muted-foreground">
                    Page {completionPage} of {totalCompletionPages}
                  </span>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() =>
                      setCompletionPage((p) =>
                        Math.min(totalCompletionPages, p + 1),
                      )
                    }
                    disabled={completionPage >= totalCompletionPages}
                  >
                    Next
                  </Button>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>
      )}
    </div>
  );
}
