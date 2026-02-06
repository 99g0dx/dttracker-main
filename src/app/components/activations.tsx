import React, { useState, useEffect } from 'react';
import { Card, CardContent } from './ui/card';
import { Button } from './ui/button';
import { Input } from './ui/input';
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
} from 'lucide-react';
import { useWorkspace } from '../../contexts/WorkspaceContext';
import { useActivations, useDeleteActivation } from '../../hooks/useActivations';
import { ResponsiveConfirmDialog } from './ui/responsive-confirm-dialog';
import type { ActivationWithSubmissionCount } from '../../lib/api/activations';
import type { ActivationStatus, ActivationType } from '../../lib/types/database';
import { format } from 'date-fns';
import { PlatformIcon } from './ui/PlatformIcon';
import { formatNumber } from '../../lib/utils/format';

interface ActivationsProps {
  onNavigate: (path: string) => void;
}

function formatAmount(amount: number): string {
  return new Intl.NumberFormat('en-NG', {
    style: 'currency',
    currency: 'NGN',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
}

function StatusBadge({ status }: { status: ActivationStatus }) {
  const config: Record<
    ActivationStatus,
    { label: string; className: string }
  > = {
    draft: { label: 'Draft', className: 'bg-slate-500/20 text-slate-400 border-slate-500/30' },
    live: { label: 'Live', className: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30' },
    completed: {
      label: 'Completed',
      className: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
    },
    cancelled: {
      label: 'Cancelled',
      className: 'bg-rose-500/20 text-rose-400 border-rose-500/30',
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
  const [typeFilter, setTypeFilter] = useState<ActivationType | 'all'>('all');
  const [statusFilter, setStatusFilter] = useState<ActivationStatus | 'all'>('all');
  const [visibilityFilter, setVisibilityFilter] = useState<'all' | 'public' | 'community'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [shouldFetch, setShouldFetch] = useState(false);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const deleteActivation = useDeleteActivation();

  const filters = {
    type: typeFilter === 'all' ? undefined : typeFilter,
    status: statusFilter === 'all' ? undefined : statusFilter,
    visibility: visibilityFilter === 'all' ? undefined : visibilityFilter,
  };

  const {
    data: activationsData,
    isLoading,
    error,
  } = useActivations(activeWorkspaceId, filters, { enabled: shouldFetch && !!activeWorkspaceId });

  const activations = Array.isArray(activationsData) ? activationsData : [];

  useEffect(() => {
    const t = setTimeout(() => setShouldFetch(true), 300);
    return () => clearTimeout(t);
  }, []);

  const filtered = activations.filter((a) =>
    searchQuery
      ? a.title.toLowerCase().includes(searchQuery.toLowerCase())
      : true
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3 sm:gap-4">
          <button
            onClick={() => onNavigate('/dashboard')}
            className="w-11 h-11 flex-shrink-0 rounded-md bg-white/[0.03] hover:bg-white/[0.06] border border-white/[0.08] flex items-center justify-center transition-colors"
            aria-label="Back"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>
          <div className="flex-1 min-w-0">
            <h1 className="text-xl sm:text-2xl font-semibold tracking-tight text-white">
              Activations
            </h1>
            <p className="text-xs sm:text-sm text-slate-400 mt-1">
              Contests and SM panels
            </p>
          </div>
        </div>
        <Button
          onClick={() => onNavigate('/activations/create')}
          className="bg-primary hover:bg-primary/90 text-black"
          disabled={!activeWorkspaceId}
        >
          <Plus className="w-4 h-4 mr-2" />
          Create
        </Button>
      </div>

      {/* Visibility Tabs */}
      <div className="flex gap-2 border-b border-white/[0.08]">
        <button
          onClick={() => setVisibilityFilter('all')}
          className={`px-4 py-2 text-sm font-medium transition-colors border-b-2 ${
            visibilityFilter === 'all'
              ? 'border-primary text-white'
              : 'border-transparent text-slate-400 hover:text-white'
          }`}
        >
          All Activations
        </button>
        <button
          onClick={() => setVisibilityFilter('public')}
          className={`px-4 py-2 text-sm font-medium transition-colors border-b-2 flex items-center gap-1.5 ${
            visibilityFilter === 'public'
              ? 'border-primary text-white'
              : 'border-transparent text-slate-400 hover:text-white'
          }`}
        >
          <Globe className="w-4 h-4" />
          Public
        </button>
        <button
          onClick={() => setVisibilityFilter('community')}
          className={`px-4 py-2 text-sm font-medium transition-colors border-b-2 flex items-center gap-1.5 ${
            visibilityFilter === 'community'
              ? 'border-primary text-white'
              : 'border-transparent text-slate-400 hover:text-white'
          }`}
        >
          <Users className="w-4 h-4" />
          Community
        </button>
      </div>

      <div className="flex flex-wrap gap-2">
        <select
          value={typeFilter}
          onChange={(e) => setTypeFilter(e.target.value as ActivationType | 'all')}
          className="h-8 px-2 text-xs sm:h-9 sm:px-3 sm:text-sm rounded-lg bg-white/[0.04] border border-white/[0.08] text-white"
        >
          <option value="all">All Types</option>
          <option value="contest">Contest</option>
          <option value="sm_panel">SM Panel</option>
        </select>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value as ActivationStatus | 'all')}
          className="h-8 px-2 text-xs sm:h-9 sm:px-3 sm:text-sm rounded-lg bg-white/[0.04] border border-white/[0.08] text-white"
        >
          <option value="all">All Status</option>
          <option value="draft">Draft</option>
          <option value="live">Live</option>
          <option value="completed">Completed</option>
          <option value="cancelled">Cancelled</option>
        </select>
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
          <Input
            placeholder="Search activations..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="h-8 sm:h-9 w-full pl-8 sm:pl-9 text-xs sm:text-sm bg-white/[0.04] border-white/[0.08]"
          />
        </div>
      </div>

      {!activeWorkspaceId ? (
        <div className="flex items-center justify-center py-16 text-slate-400">
          <Loader2 className="w-8 h-8 animate-spin mr-2" />
          Loading workspace...
        </div>
      ) : isLoading && !activations.length ? (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <Card
              key={i}
              className="bg-[#0D0D0D] border-white/[0.08] animate-pulse"
            >
              <CardContent className="p-6">
                <div className="h-5 bg-white/[0.06] rounded w-3/4 mb-4" />
                <div className="h-4 bg-white/[0.04] rounded w-1/2" />
              </CardContent>
            </Card>
          ))}
        </div>
      ) : error ? (
        <Card className="bg-[#0D0D0D] border-white/[0.08]">
          <CardContent className="py-12 text-center">
            <p className="text-slate-400">{error.message}</p>
          </CardContent>
        </Card>
      ) : filtered.length === 0 ? (
        <Card className="bg-[#0D0D0D] border-white/[0.08]">
          <CardContent className="py-16 text-center">
            <Trophy className="w-12 h-12 mx-auto text-slate-600 mb-4" />
            <h3 className="text-lg font-medium text-white mb-2">
              {visibilityFilter === 'all' 
                ? 'No activations yet'
                : visibilityFilter === 'public'
                ? 'No public activations'
                : 'No community activations'}
            </h3>
            <p className="text-slate-400 text-sm mb-4 max-w-md mx-auto">
              {visibilityFilter === 'all'
                ? 'Create a contest or SM panel to engage creators and run performance-based campaigns.'
                : visibilityFilter === 'public'
                ? 'No public activations found. Try changing filters or create a new activation.'
                : 'No community-only activations found. Import fans and create community activations to target specific audiences.'}
            </p>
            <Button
              onClick={() => onNavigate('/activations/create')}
              className="bg-primary hover:bg-primary/90 text-black"
            >
              <Plus className="w-4 h-4 mr-2" />
              Create Activation
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {filtered.map((a: ActivationWithSubmissionCount) => (
            <Card
              key={a.id}
              className="bg-[#0D0D0D] border-white/[0.08] hover:border-white/[0.12] transition-colors cursor-pointer relative"
              onClick={() => onNavigate(`/activations/${a.id}`)}
            >
              <CardContent className="p-6">
                <div className="flex items-start justify-between gap-2 mb-3">
                  <div className="flex items-center gap-2 min-w-0">
                    {a.type === 'contest' ? (
                      <Trophy className="w-5 h-5 flex-shrink-0 text-amber-400" />
                    ) : (
                      <ThumbsUp className="w-5 h-5 flex-shrink-0 text-cyan-400" />
                    )}
                    <span className="text-xs text-slate-500 capitalize">
                      {a.type === 'sm_panel' ? 'SM Panel' : a.type}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    {a.visibility === 'community' && (
                      <span className="text-xs font-medium px-2 py-0.5 rounded border bg-purple-500/20 text-purple-400 border-purple-500/30 flex items-center gap-1">
                        <Users className="w-3 h-3" />
                        Community
                      </span>
                    )}
                    {(!a.visibility || a.visibility === 'public') && (
                      <span className="text-xs font-medium px-2 py-0.5 rounded border bg-blue-500/20 text-blue-400 border-blue-500/30 flex items-center gap-1">
                        <Globe className="w-3 h-3" />
                        Public
                      </span>
                    )}
                    <StatusBadge status={a.status} />
                  </div>
                </div>
                <h3 className="font-semibold text-white truncate mb-2">
                  {a.title}
                </h3>
                {a.platforms && a.platforms.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 mb-2">
                    {a.platforms.map((p) => (
                      <div
                        key={p}
                        className="flex items-center gap-1 rounded-md bg-white/[0.06] px-2 py-0.5"
                      >
                        <PlatformIcon
                          platform={
                            p as 'tiktok' | 'instagram' | 'youtube' | 'x' | 'facebook'
                          }
                          size="sm"
                        />
                        <span className="text-xs text-slate-400 capitalize">
                          {p}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
                <div className="flex items-center gap-2 text-sm text-slate-400 mb-2">
                  <Calendar className="w-4 h-4 flex-shrink-0" />
                  <span>
                    {format(new Date(a.deadline), 'MMM d, yyyy')}
                  </span>
                </div>
                <p className="text-sm font-medium text-primary">
                  {formatAmount(a.total_budget)}
                </p>
                {a.type === 'contest' && (
                  <p className="text-xs text-slate-500 mt-1">
                    {a.submissions_count ?? 0} submissions
                    {a.winner_count ? ` • ${a.winner_count} winners` : ''}
                  </p>
                )}
                {a.type === 'sm_panel' && (
                  <p className="text-xs text-slate-500 mt-1">
                    {a.submissions_count ?? 0} completed
                    {a.payment_per_action
                      ? ` • ₦${formatNumber(Number(a.payment_per_action))}/action`
                      : ''}
                  </p>
                )}
                {a.status === 'draft' && (
                  <div className="flex gap-2 mt-4 pt-4 border-t border-white/[0.08]" onClick={(e) => e.stopPropagation()}>
                    <Button
                      size="sm"
                      variant="outline"
                      className="flex-1 border-white/[0.08] bg-white/[0.03] hover:bg-white/[0.06] text-slate-300 hover:text-white"
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
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <ResponsiveConfirmDialog
        open={deleteConfirmId !== null}
        onOpenChange={(open) => !open && setDeleteConfirmId(null)}
        title="Delete Activation"
        description="Are you sure you want to delete this draft activation? This action cannot be undone."
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
    </div>
  );
}
