import React from 'react';
import { Card, CardContent } from '../ui/card';
import { ArrowLeft, ThumbsUp, Calendar, ExternalLink } from 'lucide-react';
import { useActivationSubmissions } from '../../../hooks/useActivations';
import type { Activation } from '../../../lib/types/database';
import { format } from 'date-fns';
import { PlatformIcon } from '../ui/PlatformIcon';
import { formatNumber } from '../../../lib/utils/format';

interface ActivationDetailSMPanelProps {
  activation: Activation;
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

export function ActivationDetailSMPanel({
  activation,
  onNavigate,
}: ActivationDetailSMPanelProps) {
  const { data: submissions = [] } = useActivationSubmissions(activation.id);

  const approvedSubmissions = submissions.filter((s) => s.status === 'approved');
  const approvedCount = approvedSubmissions.length;
  const spentAmount = approvedSubmissions.reduce(
    (sum, s) => sum + (s.payment_amount != null ? Number(s.payment_amount) : 0),
    0
  );
  const baseRateLabel =
    activation.base_rate != null ? 'Base Rate (Nano)' : 'Per Action';
  const progress =
    activation.max_participants && activation.max_participants > 0
      ? (approvedCount / activation.max_participants) * 100
      : 0;

  const statusConfig: Record<string, string> = {
    draft: 'Draft',
    live: 'Live',
    completed: 'Completed',
    cancelled: 'Cancelled',
  };
  const statusLabel = statusConfig[activation.status] ?? activation.status;

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <button
          onClick={() => onNavigate('/activations')}
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
              : ''}{' '}
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
                      p as 'tiktok' | 'instagram' | 'youtube' | 'x' | 'facebook'
                    }
                    size="sm"
                  />
                  <span className="text-xs text-muted-foreground capitalize">{p}</span>
                </div>
              ))}
            </div>
          )}
        </div>
        <span
          className={`text-xs font-medium px-2 py-1 rounded border ${
            activation.status === 'live'
              ? 'bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 border-emerald-500/30'
              : activation.status === 'completed'
              ? 'bg-red-100/70 dark:bg-blue-500/20 text-red-700 dark:text-blue-400 border-red-200 dark:border-blue-500/30'
              : 'bg-slate-500/20 text-muted-foreground border-slate-500/30'
          }`}
        >
          {statusLabel}
        </span>
      </div>

      <div className="grid gap-4 md:grid-cols-4">
        <Card className="bg-card border-border">
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground">Deadline</p>
            <p className="font-medium text-foreground flex items-center gap-2 mt-1">
              <Calendar className="w-4 h-4" />
              {format(new Date(activation.deadline), 'MMM d')}
            </p>
          </CardContent>
        </Card>
        <Card className="bg-card border-border">
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground">Task</p>
            <p className="font-medium text-foreground capitalize mt-1">
              {activation.task_type ?? '-'}
            </p>
          </CardContent>
        </Card>
        <Card className="bg-card border-border">
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground">Spent</p>
            <p className="font-medium text-foreground mt-1">
              {formatAmount(spentAmount)} / {formatAmount(activation.total_budget)}
            </p>
          </CardContent>
        </Card>
        <Card className="bg-card border-border">
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground">{baseRateLabel}</p>
            <p className="font-medium text-foreground mt-1">
              {formatAmount(
                Number(activation.base_rate ?? activation.payment_per_action ?? 0)
              )}
            </p>
          </CardContent>
        </Card>
      </div>

      <div>
        <div className="flex justify-between text-sm mb-2">
          <span className="text-muted-foreground">Progress</span>
          <span className="text-foreground">
            {approvedCount}
            {activation.max_participants
              ? ` / ${activation.max_participants}`
              : ''}
          </span>
        </div>
        <div className="h-2 bg-muted/80 rounded-full overflow-hidden">
          <div
            className="h-full bg-primary transition-all"
            style={{ width: `${Math.min(progress, 100)}%` }}
          />
        </div>
      </div>

      {activation.brief && (
        <Card className="bg-card border-border">
          <CardContent className="p-6">
            <h3 className="text-sm font-medium text-muted-foreground mb-2">Brief</h3>
            <p className="text-foreground whitespace-pre-wrap">{activation.brief}</p>
          </CardContent>
        </Card>
      )}

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
            <div className="space-y-3">
              {submissions.map((s) => (
                <div
                  key={s.id}
                  className="flex items-center justify-between p-4 rounded-lg bg-muted/60 border border-border/60"
                >
                  <div>
                    <p className="font-medium text-foreground">
                      @{s.creator_handle ?? 'Unknown'}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {format(new Date(s.submitted_at), 'MMM d, HH:mm')} •{' '}
                      {s.status}
                      {s.tier && (
                        <>
                          {' • '}
                          <span className="text-muted-foreground">{s.tier}</span>
                        </>
                      )}
                      {s.creator_followers != null && (
                        <>
                          {' • '}
                          <span className="text-muted-foreground">
                            {formatNumber(s.creator_followers)} followers
                          </span>
                        </>
                      )}
                    </p>
                    {s.proof_comment_text && (
                      <p className="text-xs text-muted-foreground mt-1 italic max-w-md truncate">
                        "{s.proof_comment_text}"
                      </p>
                    )}
                  </div>
                  <div className="flex items-center gap-4">
                    {s.payment_amount != null && (
                      <span className="text-primary font-medium">
                        {formatAmount(s.payment_amount)}
                      </span>
                    )}
                    {s.proof_url && (
                      <a
                        href={s.proof_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-primary hover:underline flex items-center gap-1 text-sm"
                      >
                        View Proof <ExternalLink className="w-3 h-3" />
                      </a>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
