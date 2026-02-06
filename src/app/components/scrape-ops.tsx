import React, { useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, RefreshCcw, Loader2, Filter } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "../../lib/supabase";
import { Button } from "./ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";
import { cn } from "./ui/utils";

interface ScrapeOpsProps {
  onNavigate: (path: string) => void;
}

type RunRow = {
  id: string;
  job_id: string;
  actor_id: string;
  status: string;
  started_at: string;
  finished_at: string | null;
  duration_ms: number | null;
  items_count: number | null;
  error_raw: string | null;
  scrape_jobs: { platform: string } | null;
};

type JobRow = {
  id: string;
  platform: string;
  reference_type: string;
  reference_id: string;
  status: string;
  attempts: number;
  max_attempts: number;
  last_error: string | null;
  next_retry_at: string | null;
  scheduled_for: string;
  created_at: string;
};

const truncate = (s: string | null | undefined, len: number) =>
  s && s.length > len ? `${s.slice(0, len)}…` : s ?? "";

const formatDate = (s: string | null | undefined) =>
  s ? new Date(s).toLocaleString() : "—";

export function ScrapeOps({ onNavigate }: ScrapeOpsProps) {
  const queryClient = useQueryClient();
  const [runsPlatform, setRunsPlatform] = useState<string>("all");
  const [runsStatus, setRunsStatus] = useState<string>("all");
  const [runsRange, setRunsRange] = useState<"24h" | "7d">("24h");
  const [jobsStatus, setJobsStatus] = useState<string>("all");
  const [selectedJobIds, setSelectedJobIds] = useState<Set<string>>(new Set());

  const since =
    runsRange === "24h"
      ? new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()
      : new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();

  const { data: runs = [], isLoading: runsLoading } = useQuery({
    queryKey: ["scrape_runs", runsPlatform, runsStatus, runsRange],
    queryFn: async () => {
      let q = supabase
        .from("scrape_runs")
        .select("id, job_id, actor_id, status, started_at, finished_at, duration_ms, items_count, error_raw, scrape_jobs(platform)")
        .gte("started_at", since)
        .order("started_at", { ascending: false })
        .limit(200);
      if (runsStatus !== "all") q = q.eq("status", runsStatus);
      const { data, error } = await q;
      if (error) throw error;
      const rows = (data ?? []) as RunRow[];
      if (runsPlatform !== "all") {
        return rows.filter((r) => (r.scrape_jobs?.platform ?? "") === runsPlatform);
      }
      return rows;
    },
  });

  const { data: jobs = [], isLoading: jobsLoading } = useQuery({
    queryKey: ["scrape_jobs", jobsStatus],
    queryFn: async () => {
      let q = supabase
        .from("scrape_jobs")
        .select("id, platform, reference_type, reference_id, status, attempts, max_attempts, last_error, next_retry_at, scheduled_for, created_at")
        .order("scheduled_for", { ascending: true })
        .limit(300);
      if (jobsStatus !== "all") q = q.eq("status", jobsStatus);
      const { data, error } = await q;
      if (error) throw error;
      return (data ?? []) as JobRow[];
    },
  });

  const summary = useMemo(() => {
    const cutoff24h = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const inRange = (runs as RunRow[]).filter((r) => r.started_at >= cutoff24h);
    const total = inRange.length;
    const succeeded = inRange.filter((r) => r.status === "succeeded").length;
    const byPlatform: Record<string, { total: number; succeeded: number }> = {};
    const byActor: Record<string, { total: number; succeeded: number }> = {};
    for (const r of inRange) {
      const platform = (r.scrape_jobs?.platform ?? "unknown") as string;
      byPlatform[platform] = byPlatform[platform] ?? { total: 0, succeeded: 0 };
      byPlatform[platform].total += 1;
      if (r.status === "succeeded") byPlatform[platform].succeeded += 1;
      const actor = r.actor_id ?? "unknown";
      byActor[actor] = byActor[actor] ?? { total: 0, succeeded: 0 };
      byActor[actor].total += 1;
      if (r.status === "succeeded") byActor[actor].succeeded += 1;
    }
    return { total, succeeded, byPlatform, byActor };
  }, [runs]);

  const retryMutation = useMutation({
    mutationFn: async (jobIds: string[]) => {
      const { data, error } = await supabase.rpc("retry_failed_scrape_jobs", {
        p_job_ids: jobIds,
      });
      if (error) throw error;
      return data as number;
    },
    onSuccess: (count) => {
      toast.success(`Retried ${count} job(s).`);
      setSelectedJobIds(new Set());
      queryClient.invalidateQueries({ queryKey: ["scrape_jobs"] });
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const failedJobs = useMemo(
    () => (jobs as JobRow[]).filter((j) => j.status === "failed"),
    [jobs]
  );
  const selectedFailed = useMemo(
    () => failedJobs.filter((j) => selectedJobIds.has(j.id)),
    [failedJobs, selectedJobIds]
  );

  const toggleJobSelection = (id: string) => {
    setSelectedJobIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const selectAllFailed = () => {
    if (selectedJobIds.size === failedJobs.length) setSelectedJobIds(new Set());
    else setSelectedJobIds(new Set(failedJobs.map((j) => j.id)));
  };

  return (
    <div className="min-h-screen bg-[#0f0f0f] text-white p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        <div className="flex items-center gap-4">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => onNavigate("/admin")}
            className="text-slate-400 hover:text-white"
          >
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <h1 className="text-2xl font-semibold">Scrape Ops</h1>
        </div>

        {/* Summary (last 24h) */}
        <Card className="bg-slate-900/50 border-slate-700">
          <CardHeader>
            <CardTitle className="text-lg">Last 24h summary</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            <div>
              <p className="text-slate-400 text-sm">Runs</p>
              <p className="text-xl font-medium">{summary.total}</p>
            </div>
            <div>
              <p className="text-slate-400 text-sm">Succeeded</p>
              <p className="text-xl font-medium text-emerald-400">{summary.succeeded}</p>
            </div>
            <div>
              <p className="text-slate-400 text-sm">Success rate</p>
              <p className="text-xl font-medium">
                {summary.total ? `${((100 * summary.succeeded) / summary.total).toFixed(1)}%` : "—"}
              </p>
            </div>
            <div className="space-y-2">
              <p className="text-slate-400 text-sm">By platform</p>
              <div className="flex flex-wrap gap-2">
                {Object.entries(summary.byPlatform).map(([platform, v]) => (
                  <span
                    key={platform}
                    className="rounded bg-slate-800 px-2 py-0.5 text-sm"
                    title={`${v.succeeded}/${v.total}`}
                  >
                    {platform} {v.succeeded}/{v.total}
                  </span>
                ))}
                {Object.keys(summary.byPlatform).length === 0 && (
                  <span className="text-slate-500 text-sm">—</span>
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Recent runs */}
        <Card className="bg-slate-900/50 border-slate-700">
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-lg">Recent runs</CardTitle>
            <div className="flex items-center gap-2 flex-wrap">
              <Filter className="w-4 h-4 text-slate-400" />
              <select
                value={runsRange}
                onChange={(e) => setRunsRange(e.target.value as "24h" | "7d")}
                className="bg-slate-800 border border-slate-600 rounded px-2 py-1 text-sm"
              >
                <option value="24h">Last 24h</option>
                <option value="7d">Last 7d</option>
              </select>
              <select
                value={runsPlatform}
                onChange={(e) => setRunsPlatform(e.target.value)}
                className="bg-slate-800 border border-slate-600 rounded px-2 py-1 text-sm"
              >
                <option value="all">All platforms</option>
                <option value="tiktok">TikTok</option>
                <option value="instagram">Instagram</option>
                <option value="youtube">YouTube</option>
                <option value="twitter">Twitter</option>
              </select>
              <select
                value={runsStatus}
                onChange={(e) => setRunsStatus(e.target.value)}
                className="bg-slate-800 border border-slate-600 rounded px-2 py-1 text-sm"
              >
                <option value="all">All statuses</option>
                <option value="started">Started</option>
                <option value="succeeded">Succeeded</option>
                <option value="failed">Failed</option>
                <option value="timed_out">Timed out</option>
              </select>
            </div>
          </CardHeader>
          <CardContent>
            {runsLoading ? (
              <div className="flex items-center justify-center py-8 text-slate-400">
                <Loader2 className="w-6 h-6 animate-spin" />
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-slate-400 border-b border-slate-700">
                      <th className="py-2 pr-2">Job ID</th>
                      <th className="py-2 pr-2">Platform</th>
                      <th className="py-2 pr-2">Actor</th>
                      <th className="py-2 pr-2">Status</th>
                      <th className="py-2 pr-2">Duration</th>
                      <th className="py-2 pr-2">Items</th>
                      <th className="py-2 pr-2">Started</th>
                      <th className="py-2 pr-2">Error</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(runs as RunRow[]).map((r) => (
                      <tr key={r.id} className="border-b border-slate-800">
                        <td className="py-2 pr-2 font-mono text-xs">{r.job_id?.slice(0, 8)}…</td>
                        <td className="py-2 pr-2">{r.scrape_jobs?.platform ?? "—"}</td>
                        <td className="py-2 pr-2 text-slate-300">{truncate(r.actor_id, 24)}</td>
                        <td className="py-2 pr-2">
                          <span
                            className={cn(
                              r.status === "succeeded" && "text-emerald-400",
                              r.status === "failed" && "text-red-400",
                              r.status === "started" && "text-amber-400"
                            )}
                          >
                            {r.status}
                          </span>
                        </td>
                        <td className="py-2 pr-2">{r.duration_ms != null ? `${r.duration_ms}ms` : "—"}</td>
                        <td className="py-2 pr-2">{r.items_count ?? "—"}</td>
                        <td className="py-2 pr-2">{formatDate(r.started_at)}</td>
                        <td className="py-2 pr-2 max-w-[200px]" title={r.error_raw ?? undefined}>
                          {truncate(r.error_raw, 60)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {(runs as RunRow[]).length === 0 && (
                  <p className="py-6 text-center text-slate-500">No runs in this range.</p>
                )}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Job queue */}
        <Card className="bg-slate-900/50 border-slate-700">
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-lg">Job queue</CardTitle>
            <div className="flex items-center gap-2 flex-wrap">
              <select
                value={jobsStatus}
                onChange={(e) => setJobsStatus(e.target.value)}
                className="bg-slate-800 border border-slate-600 rounded px-2 py-1 text-sm"
              >
                <option value="all">All statuses</option>
                <option value="queued">Queued</option>
                <option value="running">Running</option>
                <option value="cooldown">Cooldown</option>
                <option value="success">Success</option>
                <option value="failed">Failed</option>
              </select>
              {failedJobs.length > 0 && (
                <>
                  <Button
                    size="sm"
                    variant="outline"
                    className="border-slate-600"
                    onClick={selectAllFailed}
                  >
                    {selectedJobIds.size === failedJobs.length ? "Deselect all" : "Select all failed"}
                  </Button>
                  <Button
                    size="sm"
                    disabled={selectedFailed.length === 0 || retryMutation.isPending}
                    onClick={() => retryMutation.mutate(selectedFailed.map((j) => j.id))}
                    className="bg-amber-600 hover:bg-amber-700"
                  >
                    {retryMutation.isPending ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <RefreshCcw className="w-4 h-4 mr-1" />
                    )}
                    Retry failed ({selectedFailed.length})
                  </Button>
                </>
              )}
            </div>
          </CardHeader>
          <CardContent>
            {jobsLoading ? (
              <div className="flex items-center justify-center py-8 text-slate-400">
                <Loader2 className="w-6 h-6 animate-spin" />
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-slate-400 border-b border-slate-700">
                      {jobsStatus === "failed" && (
                        <th className="py-2 pr-2 w-10">
                          <input
                            type="checkbox"
                            checked={failedJobs.length > 0 && selectedJobIds.size === failedJobs.length}
                            onChange={selectAllFailed}
                            className="rounded border-slate-600 bg-slate-800"
                          />
                        </th>
                      )}
                      <th className="py-2 pr-2">ID</th>
                      <th className="py-2 pr-2">Platform</th>
                      <th className="py-2 pr-2">Ref type</th>
                      <th className="py-2 pr-2">Ref ID</th>
                      <th className="py-2 pr-2">Status</th>
                      <th className="py-2 pr-2">Attempts</th>
                      <th className="py-2 pr-2">Scheduled</th>
                      <th className="py-2 pr-2">Next retry</th>
                      <th className="py-2 pr-2">Last error</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(jobs as JobRow[]).map((j) => (
                      <tr key={j.id} className="border-b border-slate-800">
                        {jobsStatus === "failed" && (
                          <td className="py-2 pr-2">
                            <input
                              type="checkbox"
                              checked={selectedJobIds.has(j.id)}
                              onChange={() => toggleJobSelection(j.id)}
                              className="rounded border-slate-600 bg-slate-800"
                            />
                          </td>
                        )}
                        <td className="py-2 pr-2 font-mono text-xs">{j.id.slice(0, 8)}…</td>
                        <td className="py-2 pr-2">{j.platform}</td>
                        <td className="py-2 pr-2">{j.reference_type}</td>
                        <td className="py-2 pr-2 font-mono text-xs">{j.reference_id.slice(0, 8)}…</td>
                        <td className="py-2 pr-2">
                          <span
                            className={cn(
                              j.status === "success" && "text-emerald-400",
                              j.status === "failed" && "text-red-400",
                              j.status === "running" && "text-amber-400",
                              j.status === "cooldown" && "text-slate-400"
                            )}
                          >
                            {j.status}
                          </span>
                        </td>
                        <td className="py-2 pr-2">
                          {j.attempts} / {j.max_attempts}
                        </td>
                        <td className="py-2 pr-2">{formatDate(j.scheduled_for)}</td>
                        <td className="py-2 pr-2">{formatDate(j.next_retry_at)}</td>
                        <td className="py-2 pr-2 max-w-[200px]" title={j.last_error ?? undefined}>
                          {truncate(j.last_error, 60)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {(jobs as JobRow[]).length === 0 && (
                  <p className="py-6 text-center text-slate-500">No jobs.</p>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
