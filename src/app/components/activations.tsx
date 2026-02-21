import React, { useState, useEffect, useMemo } from "react";
import { Card, CardContent } from "./ui/card";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import {
  ArrowLeft,
  Plus,
  Search,
  Trophy,
  ThumbsUp,
  Calendar,
  Loader2,
  Users,
  Globe,
  Edit2,
  Trash2,
  XCircle,
} from "lucide-react";
import { useWorkspace } from "../../contexts/WorkspaceContext";
import {
  useActivations,
  useDeleteActivation,
  useCloseActivation,
} from "../../hooks/useActivations";
import { useCanWrite } from "../../hooks/useBilling";
import { ResponsiveConfirmDialog } from "./ui/responsive-confirm-dialog";
import { Checkbox } from "./ui/checkbox";
import type { ActivationWithSubmissionCount } from "../../lib/api/activations";
import type {
  ActivationStatus,
  ActivationType,
} from "../../lib/types/database";
import { format } from "date-fns";
import { PlatformIcon } from "./ui/PlatformIcon";
import { formatNumber } from "../../lib/utils/format";
import { getCampaignCoverGradient } from "../../lib/utils/campaign-gradients";

const ACTIVATIONS_PER_PAGE = 10;

interface ActivationsProps {
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

function formatReach(v: number): string {
  if (v >= 1_000_000) return `${(v / 1_000_000).toFixed(1)}M`;
  if (v >= 1_000) return `${(v / 1_000).toFixed(1)}K`;
  return String(v);
}

function StatusBadge({ status }: { status: ActivationStatus }) {
  const config: Record<ActivationStatus, { label: string; className: string }> =
    {
      draft: {
        label: "Draft",
        className: "bg-muted/60 text-muted-foreground border-border",
      },
      live: {
        label: "Live",
        className:
          "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/30",
      },
      completed: {
        label: "Completed",
        className:
          "bg-red-100/70 dark:bg-blue-500/15 text-red-700 dark:text-blue-400 border-red-200 dark:border-blue-500/30",
      },
      cancelled: {
        label: "Cancelled",
        className:
          "bg-rose-500/15 text-rose-600 dark:text-rose-400 border-rose-500/30",
      },
    };
  const c = config[status] ?? config.draft;
  return (
    <span
      className={`text-xs font-medium px-2 py-0.5 rounded border ${c.className}`}
    >
      {c.label}
    </span>
  );
}

export function Activations({ onNavigate }: ActivationsProps) {
  const { activeWorkspaceId } = useWorkspace();
  const { canWrite } = useCanWrite();
  const [typeFilter, setTypeFilter] = useState<ActivationType | "all">("all");
  const [statusFilter, setStatusFilter] = useState<ActivationStatus | "all">(
    "all",
  );
  const [visibilityFilter, setVisibilityFilter] = useState<
    "all" | "public" | "community"
  >("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [shouldFetch, setShouldFetch] = useState(false);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [bulkActionIds, setBulkActionIds] = useState<string[] | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [currentPage, setCurrentPage] = useState(1);
  const deleteActivation = useDeleteActivation();
  const closeActivation = useCloseActivation();

  const filters = {
    type: typeFilter === "all" ? undefined : typeFilter,
    status: statusFilter === "all" ? undefined : statusFilter,
    visibility: visibilityFilter === "all" ? undefined : visibilityFilter,
  };

  const {
    data: activationsData,
    isLoading,
    error,
  } = useActivations(activeWorkspaceId, filters, {
    enabled: shouldFetch && !!activeWorkspaceId,
  });

  const activations = Array.isArray(activationsData) ? activationsData : [];

  useEffect(() => {
    const t = setTimeout(() => setShouldFetch(true), 300);
    return () => clearTimeout(t);
  }, []);

  useEffect(() => {
    setCurrentPage(1);
  }, [typeFilter, statusFilter, visibilityFilter, searchQuery]);

  const filtered = activations.filter((a) =>
    searchQuery
      ? a.title.toLowerCase().includes(searchQuery.toLowerCase())
      : true,
  );

  const totalPages = Math.max(
    1,
    Math.ceil(filtered.length / ACTIVATIONS_PER_PAGE),
  );
  const safeCurrentPage = Math.min(Math.max(1, currentPage), totalPages);
  const paginatedActivations = useMemo(() => {
    const start = (safeCurrentPage - 1) * ACTIVATIONS_PER_PAGE;
    return filtered.slice(start, start + ACTIVATIONS_PER_PAGE);
  }, [filtered, safeCurrentPage]);

  const canActOnActivation = (a: ActivationWithSubmissionCount) =>
    a.status === "draft" || a.status === "live" || a.status === "cancelled";

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleSelectAllOnPage = () => {
    const actableOnPage = paginatedActivations.filter(canActOnActivation);
    const allSelected = actableOnPage.every((a) => selectedIds.has(a.id));
    if (allSelected) {
      setSelectedIds((prev) => {
        const next = new Set(prev);
        actableOnPage.forEach((a) => next.delete(a.id));
        return next;
      });
    } else {
      setSelectedIds((prev) => {
        const next = new Set(prev);
        actableOnPage.forEach((a) => next.add(a.id));
        return next;
      });
    }
  };

  const handleBulkAction = () => {
    const toAct = Array.from(selectedIds).filter((id) => {
      const a = filtered.find((x) => x.id === id);
      return a && canActOnActivation(a);
    });
    if (toAct.length === 0) return;
    setBulkActionIds(toAct);
  };

  const confirmBulkAction = async () => {
    if (!bulkActionIds || bulkActionIds.length === 0) return;
    try {
      for (const id of bulkActionIds) {
        const a = filtered.find((x) => x.id === id);
        if (!a || !canActOnActivation(a)) continue;
        if (a.status === "live") {
          await closeActivation.mutateAsync(id);
        } else {
          await deleteActivation.mutateAsync(id);
        }
      }
      setSelectedIds(new Set());
      setBulkActionIds(null);
    } catch {
      // toast handled by mutations
    }
  };

  const bulkSummary = bulkActionIds
    ? bulkActionIds.reduce(
        (acc, id) => {
          const a = filtered.find((x) => x.id === id);
          if (a?.status === "draft") acc.draft++;
          else if (a?.status === "live") acc.live++;
          else if (a?.status === "cancelled") acc.cancelled++;
          return acc;
        },
        { draft: 0, live: 0, cancelled: 0 },
      )
    : { draft: 0, live: 0, cancelled: 0 };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3 sm:gap-4">
          <button
            onClick={() => onNavigate("/dashboard")}
            className="w-11 h-11 flex-shrink-0 rounded-md bg-muted/60 hover:bg-muted/80 border border-border flex items-center justify-center transition-colors"
            aria-label="Back"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>
          <div className="flex-1 min-w-0">
            <h1 className="text-xl sm:text-2xl font-semibold tracking-tight text-foreground">
              Activations
            </h1>
            <p className="text-xs sm:text-sm text-muted-foreground mt-1">
              Contests and SM panels
            </p>
          </div>
        </div>
        <Button
          onClick={() => onNavigate("/activations/create")}
          className="bg-primary hover:bg-primary/90 text-primary-foreground gap-1.5"
          disabled={!activeWorkspaceId || !canWrite}
        >
          <Plus className="w-4 h-4" />
          Create
        </Button>
      </div>

      {/* Visibility Tabs */}
      <div className="flex gap-2 border-b border-border">
        <button
          onClick={() => setVisibilityFilter("all")}
          className={`px-4 py-2 text-sm font-medium transition-colors border-b-2 ${
            visibilityFilter === "all"
              ? "border-primary text-foreground"
              : "border-transparent text-muted-foreground hover:text-foreground"
          }`}
        >
          All Activations
        </button>
        <button
          onClick={() => setVisibilityFilter("public")}
          className={`px-4 py-2 text-sm font-medium transition-colors border-b-2 flex items-center gap-1.5 ${
            visibilityFilter === "public"
              ? "border-primary text-foreground"
              : "border-transparent text-muted-foreground hover:text-foreground"
          }`}
        >
          <Globe className="w-4 h-4" />
          Public
        </button>
        <button
          onClick={() => setVisibilityFilter("community")}
          className={`px-4 py-2 text-sm font-medium transition-colors border-b-2 flex items-center gap-1.5 ${
            visibilityFilter === "community"
              ? "border-primary text-foreground"
              : "border-transparent text-muted-foreground hover:text-foreground"
          }`}
        >
          <Users className="w-4 h-4" />
          Community
        </button>
      </div>

      <div className="flex flex-wrap gap-2">
        <select
          value={typeFilter}
          onChange={(e) =>
            setTypeFilter(e.target.value as ActivationType | "all")
          }
          className="h-8 px-2 text-xs sm:h-9 sm:px-3 sm:text-sm rounded-lg bg-muted/70 border border-border text-foreground"
        >
          <option value="all">All Types</option>
          <option value="contest">Contest</option>
          <option value="sm_panel">SM Panel</option>
        </select>
        <select
          value={statusFilter}
          onChange={(e) =>
            setStatusFilter(e.target.value as ActivationStatus | "all")
          }
          className="h-8 px-2 text-xs sm:h-9 sm:px-3 sm:text-sm rounded-lg bg-muted/70 border border-border text-foreground"
        >
          <option value="all">All Status</option>
          <option value="draft">Draft</option>
          <option value="live">Live</option>
          <option value="completed">Completed</option>
          <option value="cancelled">Cancelled</option>
        </select>
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Search activations..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="h-8 sm:h-9 w-full pl-8 sm:pl-9 text-xs sm:text-sm bg-muted/70 border-border"
          />
        </div>
      </div>

      {!activeWorkspaceId ? (
        <div className="flex items-center justify-center py-16 text-muted-foreground">
          <Loader2 className="w-8 h-8 animate-spin mr-2" />
          Loading workspace...
        </div>
      ) : isLoading && !activations.length ? (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <Card key={i} className="bg-card border-border animate-pulse">
              <CardContent className="p-6">
                <div className="h-5 bg-muted/80 rounded w-3/4 mb-4" />
                <div className="h-4 bg-muted/70 rounded w-1/2" />
              </CardContent>
            </Card>
          ))}
        </div>
      ) : error ? (
        <Card className="bg-card border-border">
          <CardContent className="py-12 text-center">
            <p className="text-muted-foreground">{error.message}</p>
          </CardContent>
        </Card>
      ) : filtered.length === 0 ? (
        <Card className="bg-card border-border">
          <CardContent className="py-16 text-center">
            <Trophy className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
            <h3 className="text-lg font-medium text-foreground mb-2">
              {visibilityFilter === "all"
                ? "No activations yet"
                : visibilityFilter === "public"
                  ? "No public activations"
                  : "No community activations"}
            </h3>
            <p className="text-muted-foreground text-sm mb-4 max-w-md mx-auto">
              {visibilityFilter === "all"
                ? "Create a contest or SM panel to engage creators and run performance-based campaigns."
                : visibilityFilter === "public"
                  ? "No public activations found. Try changing filters or create a new activation."
                  : "No community-only activations found. Import fans and create community activations to target specific audiences."}
            </p>
            {canWrite && (
              <Button
                onClick={() => onNavigate("/activations/create")}
                className="bg-primary hover:bg-primary/90 text-primary-foreground gap-1.5"
              >
                <Plus className="w-4 h-4" />
                Create Activation
              </Button>
            )}
          </CardContent>
        </Card>
      ) : (
        <>
          {selectedIds.size > 0 && (
            <div className="flex items-center justify-between gap-3 p-3 rounded-lg bg-muted/60 border border-border">
              <span className="text-sm text-foreground">
                {selectedIds.size} selected
              </span>
              <Button
                variant="destructive"
                size="sm"
                onClick={handleBulkAction}
                disabled={
                  deleteActivation.isPending || closeActivation.isPending
                }
              >
                <Trash2 className="w-4 h-4" />
                Delete/Close selected
              </Button>
            </div>
          )}
          <div className="flex items-center justify-between gap-2 mb-2">
            {paginatedActivations.some(canActOnActivation) && (
              <label className="flex items-center gap-2 cursor-pointer text-sm text-foreground">
                <Checkbox
                  checked={
                    paginatedActivations.filter(canActOnActivation).length >
                      0 &&
                    paginatedActivations
                      .filter(canActOnActivation)
                      .every((a) => selectedIds.has(a.id))
                  }
                  onCheckedChange={toggleSelectAllOnPage}
                  aria-label="Select all on page"
                  className="size-6 shrink-0 rounded-md border-2 border-muted-foreground bg-muted/80"
                />
                <span>
                  {paginatedActivations
                    .filter(canActOnActivation)
                    .every((a) => selectedIds.has(a.id))
                    ? "Deselect all on page"
                    : "Select all on page"}
                </span>
              </label>
            )}
            <div className="ml-auto flex items-center gap-2 text-sm text-muted-foreground">
              <span>
                Page {safeCurrentPage} of {totalPages}
              </span>
              <div className="flex gap-1">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={safeCurrentPage <= 1}
                  onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                >
                  Previous
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={safeCurrentPage >= totalPages}
                  onClick={() =>
                    setCurrentPage((p) => Math.min(totalPages, p + 1))
                  }
                >
                  Next
                </Button>
              </div>
            </div>
          </div>
          <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3 sm:gap-4 lg:gap-5">
            {paginatedActivations.map((a: ActivationWithSubmissionCount) => {
              const coverGradient = getCampaignCoverGradient(a.id || a.title);
              return (
                <Card
                  key={a.id}
                  className="w-full bg-card border-border active:border-border/80 rounded-xl transition-all cursor-pointer group relative overflow-hidden"
                  onClick={() => onNavigate(`/activations/${a.id}`)}
                >
                  <CardContent className="!p-0">
                    {/* Cover Image Header */}
                    <div
                      className={`w-full relative h-24 sm:h-28 ${coverGradient}`}
                    >
                      {a.image_url ? (
                        <img
                          src={a.image_url}
                          alt={a.title}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center">
                          <span className="text-3xl sm:text-4xl font-bold text-white">
                            {a.title.charAt(0).toUpperCase()}
                          </span>
                        </div>
                      )}
                      {/* Checkbox overlay */}
                      {canActOnActivation(a) && (
                        <div
                          className="absolute top-2 left-2"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <Checkbox
                            checked={selectedIds.has(a.id)}
                            onCheckedChange={() => toggleSelect(a.id)}
                            aria-label="Select activation"
                            className="size-7 shrink-0 rounded-md border-2 border-white/60 bg-black/40 backdrop-blur-sm"
                          />
                        </div>
                      )}
                    </div>

                    {/* Content Section */}
                    <div className="p-3 min-[400px]:p-3.5 sm:p-4">
                      {/* Header Row: Type + Title | Badges */}
                      <div className="flex items-start justify-between gap-2 mb-2 sm:mb-3">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-1.5 mb-1">
                            {a.type === "contest" ? (
                              <Trophy className="w-4 h-4 flex-shrink-0 text-amber-400" />
                            ) : (
                              <ThumbsUp className="w-4 h-4 flex-shrink-0 text-red-600 dark:text-cyan-400" />
                            )}
                            <span className="text-[10px] text-muted-foreground capitalize">
                              {a.type === "sm_panel" ? "SM Panel" : a.type}
                            </span>
                          </div>
                          <h3 className="text-sm min-[400px]:text-base font-semibold text-foreground group-hover:text-primary transition-colors leading-snug break-words overflow-hidden [display:-webkit-box] [-webkit-line-clamp:2] [-webkit-box-orient:vertical] uppercase">
                            {a.title}
                          </h3>
                        </div>
                        <div className="flex flex-col items-end gap-1">
                          <StatusBadge status={a.status} />
                          {a.visibility === "community" && (
                            <span className="text-[10px] font-medium px-1.5 py-0.5 rounded border bg-purple-500/20 text-purple-600 dark:text-purple-400 border-purple-500/30 flex items-center gap-1">
                              <Users className="w-3 h-3" />
                              Community
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Stats Section */}
                      {a.type === "contest" ? (
                        <div className="grid grid-cols-3 gap-1 sm:gap-2">
                          <div className="text-center min-w-0">
                            <div className="text-xs min-[400px]:text-sm font-semibold text-foreground leading-tight">
                              {a.submissions_count ?? 0}
                            </div>
                            <p className="text-[9px] min-[400px]:text-[10px] text-muted-foreground mt-0.5 truncate">
                              Submissions
                            </p>
                          </div>
                          <div className="text-center min-w-0">
                            <div className="text-xs min-[400px]:text-sm font-semibold text-foreground leading-tight">
                              {formatReach(a.total_views ?? 0)}
                            </div>
                            <p className="text-[9px] min-[400px]:text-[10px] text-muted-foreground mt-0.5 truncate">
                              Reach
                            </p>
                          </div>
                          <div className="text-center min-w-0">
                            <div className="text-xs min-[400px]:text-sm font-semibold text-primary leading-tight">
                              {formatAmount(a.total_budget)}
                            </div>
                            <p className="text-[9px] min-[400px]:text-[10px] text-muted-foreground mt-0.5 truncate">
                              Prize Pool
                            </p>
                          </div>
                        </div>
                      ) : (
                        <div className="space-y-2">
                          <div className="flex items-center gap-1.5">
                            <span className="text-[10px] font-medium px-1.5 py-0.5 rounded bg-cyan-500/10 text-cyan-400 border border-cyan-500/20 capitalize">
                              {a.task_type
                                ? a.task_type.replace("_", " ")
                                : "Task"}
                            </span>
                          </div>
                          <div>
                            <div className="flex items-center justify-between mb-1">
                              <span className="text-[10px] text-muted-foreground">
                                Progress
                              </span>
                              <span className="text-[10px] font-medium text-foreground">
                                {a.approved_count ?? 0}/
                                {a.max_participants ?? "∞"}
                              </span>
                            </div>
                            <div className="h-2 rounded-full bg-white/[0.06] overflow-hidden">
                              <div
                                className="h-full rounded-full bg-primary transition-all"
                                style={{
                                  width: `${a.max_participants ? Math.min(((a.approved_count ?? 0) / a.max_participants) * 100, 100) : 0}%`,
                                }}
                              />
                            </div>
                          </div>
                          <div className="text-center">
                            <span className="text-xs font-semibold text-primary">
                              {formatAmount(a.total_budget)}
                            </span>
                            <span className="text-[10px] text-muted-foreground ml-1">
                              Budget
                            </span>
                          </div>
                        </div>
                      )}

                      {/* Deadline + Platforms */}
                      <div className="flex items-center gap-1.5 text-[10px] sm:text-xs text-muted-foreground mt-2 pt-2 border-t border-border">
                        <Calendar className="w-3.5 h-3.5 flex-shrink-0" />
                        <span>
                          {format(new Date(a.deadline), "MMM d, yyyy")}
                        </span>
                        {a.platforms && a.platforms.length > 0 && (
                          <div className="flex items-center gap-1 ml-auto">
                            {a.platforms.map((p) => (
                              <PlatformIcon
                                key={p}
                                platform={
                                  p as
                                    | "tiktok"
                                    | "instagram"
                                    | "youtube"
                                    | "x"
                                    | "facebook"
                                }
                                size="sm"
                              />
                            ))}
                          </div>
                        )}
                      </div>

                      {/* Action buttons */}
                      {(a.status === "draft" ||
                        a.status === "live" ||
                        a.status === "cancelled") && (
                        <div
                          className="flex gap-2 mt-3 pt-3 border-t border-border"
                          onClick={(e) => e.stopPropagation()}
                        >
                          {a.status === "draft" && (
                            <>
                              <Button
                                size="sm"
                                variant="outline"
                                className="flex-1 border-border bg-muted/60 hover:bg-muted/80 text-foreground hover:text-foreground"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  onNavigate(`/activations/${a.id}/edit`);
                                }}
                              >
                                <Edit2 className="w-4 h-4 mr-1.5" />
                                Edit
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                className="flex-1 border-red-500/30 bg-red-500/10 hover:bg-red-500/20 text-red-400 hover:text-red-300"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setDeleteConfirmId(a.id);
                                }}
                              >
                                <Trash2 className="w-4 h-4 mr-1.5" />
                                Delete
                              </Button>
                            </>
                          )}
                          {a.status === "live" && (
                            <>
                              <Button
                                size="sm"
                                variant="outline"
                                className="flex-1 border-border bg-muted/60 hover:bg-muted/80 text-foreground hover:text-foreground"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  onNavigate(`/activations/${a.id}`);
                                }}
                              >
                                <Edit2 className="w-4 h-4 mr-1.5" />
                                Edit
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                className="flex-1 border-amber-500/30 bg-amber-500/10 hover:bg-amber-500/20 text-amber-600 hover:text-amber-500 dark:text-amber-400 dark:hover:text-amber-300"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  closeActivation.mutate(a.id);
                                }}
                                disabled={closeActivation.isPending}
                              >
                                <XCircle className="w-4 h-4 mr-1.5" />
                                Close
                              </Button>
                            </>
                          )}
                          {a.status === "cancelled" && (
                            <Button
                              size="sm"
                              variant="outline"
                              className="flex-1 border-red-500/30 bg-red-500/10 hover:bg-red-500/20 text-red-400 hover:text-red-300"
                              onClick={(e) => {
                                e.stopPropagation();
                                setDeleteConfirmId(a.id);
                              }}
                            >
                              <Trash2 className="w-4 h-4 mr-1.5" />
                              Delete
                            </Button>
                          )}
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </>
      )}

      <ResponsiveConfirmDialog
        open={deleteConfirmId !== null}
        onOpenChange={(open) => !open && setDeleteConfirmId(null)}
        title="Delete Activation"
        description="Are you sure you want to delete this activation? This action cannot be undone."
        confirmLabel="Delete"
        cancelLabel="Cancel"
        confirmVariant="destructive"
        confirmLoading={deleteActivation.isPending}
        onConfirm={async () => {
          if (deleteConfirmId) {
            try {
              await deleteActivation.mutateAsync(deleteConfirmId);
              setDeleteConfirmId(null);
            } catch {
              // Error handled by mutation toast
            }
          }
        }}
      />

      <ResponsiveConfirmDialog
        open={Boolean(bulkActionIds && bulkActionIds.length > 0)}
        onOpenChange={(open) => !open && setBulkActionIds(null)}
        title="Delete / Close selected"
        description={[
          (bulkSummary.draft > 0 || bulkSummary.cancelled > 0) &&
            `${bulkSummary.draft + bulkSummary.cancelled} draft/cancelled activation(s) will be deleted. This cannot be undone.`,
          bulkSummary.live > 0 &&
            `${bulkSummary.live} live activation(s) will be closed.`,
        ]
          .filter(Boolean)
          .join(" ")}
        confirmLabel={
          bulkSummary.live > 0
            ? `Close ${bulkSummary.live}${bulkSummary.draft + bulkSummary.cancelled > 0 ? ` & Delete ${bulkSummary.draft + bulkSummary.cancelled}` : ""}`
            : `Delete ${bulkSummary.draft + bulkSummary.cancelled}`
        }
        cancelLabel="Cancel"
        confirmVariant="destructive"
        confirmLoading={deleteActivation.isPending || closeActivation.isPending}
        onConfirm={confirmBulkAction}
      />
    </div>
  );
}
