import React, { useEffect, useMemo, useState } from 'react';
import { Card, CardContent } from './ui/card';
import { Button } from './ui/button';
import { ArrowLeft, FileText, Clock, CheckCircle2, Loader2, Users, Megaphone, Eye, X } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useCompanyAdmin } from '../../hooks/useCompanyAdmin';

interface AdminDashboardProps {
  onNavigate: (path: string) => void;
}

type CreatorRequestRow = {
  id: string;
  status: string;
  campaign_type: string | null;
  created_at: string;
  contact_person_name: string | null;
  contact_person_email: string | null;
};

type CreatorRequestDetail = CreatorRequestRow & {
  contact_person_phone?: string | null;
  campaign_brief?: string | null;
  deadline?: string | null;
  creator_request_items?: Array<{
    creators: {
      id: string;
      name: string | null;
      handle: string | null;
      platform: string | null;
      follower_count: number | null;
    } | null;
  }>;
  creator_request_targets?: Array<{
    id: string;
    platform: string | null;
    quantity: number;
    follower_min: number | null;
    follower_max: number | null;
    geo: string | null;
    budget_min: number | null;
    budget_max: number | null;
    content_types: string[] | null;
    notes: string | null;
  }>;
};

export function AdminDashboard({ onNavigate }: AdminDashboardProps) {
  const { isCompanyAdmin, loading: accessLoading } = useCompanyAdmin();
  const [requests, setRequests] = useState<CreatorRequestRow[]>([]);
  const [selectedRequest, setSelectedRequest] = useState<CreatorRequestDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [statusUpdating, setStatusUpdating] = useState(false);
  const [detailError, setDetailError] = useState<string | null>(null);
  const [accountCount, setAccountCount] = useState(0);
  const [newUsers7d, setNewUsers7d] = useState(0);
  const [newUsers30d, setNewUsers30d] = useState(0);
  const [workspaceCount, setWorkspaceCount] = useState(0);
  const [campaignCount, setCampaignCount] = useState(0);
  const [activeCampaignCount, setActiveCampaignCount] = useState(0);
  const [creatorCount, setCreatorCount] = useState(0);
  const [totalViews, setTotalViews] = useState(0);
  const [engagementRate, setEngagementRate] = useState(0);
  const [requests7d, setRequests7d] = useState(0);
  const [requests30d, setRequests30d] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const load = async () => {
      if (!isCompanyAdmin) {
        setLoading(false);
        return;
      }
      setLoading(true);
      setError(null);

      const [metricsResult, requestsResult] = await Promise.all([
        supabase.rpc('get_company_admin_metrics'),
        supabase
          .from('creator_requests')
          .select('id, status, campaign_type, created_at, contact_person_name, contact_person_email')
          .order('created_at', { ascending: false })
          .limit(50),
      ]);

      if (metricsResult.error || requestsResult.error) {
        setError((metricsResult.error || requestsResult.error)?.message || 'Failed to load admin metrics');
        setRequests([]);
        setLoading(false);
        return;
      }

      setRequests((requestsResult.data || []) as CreatorRequestRow[]);
      const metrics = metricsResult.data as any;
      setAccountCount(metrics.total_users || 0);
      setNewUsers7d(metrics.new_users_7d || 0);
      setNewUsers30d(metrics.new_users_30d || 0);
      setWorkspaceCount(metrics.total_workspaces || 0);
      setCampaignCount(metrics.total_campaigns || 0);
      setActiveCampaignCount(metrics.active_campaigns || 0);
      setCreatorCount(metrics.total_creators || 0);
      setTotalViews(metrics.total_views || 0);
      setEngagementRate(metrics.engagement_rate || 0);
      setRequests7d(metrics.requests_7d || 0);
      setRequests30d(metrics.requests_30d || 0);
      setLoading(false);
    };

    load();
  }, [isCompanyAdmin]);

  const metrics = useMemo(() => {
    const statusCounts = requests.reduce<Record<string, number>>((acc, r) => {
      acc[r.status] = (acc[r.status] || 0) + 1;
      return acc;
    }, {});

    return {
      total: requests.length,
      last7: requests7d,
      last30: requests30d,
      statusCounts,
    };
  }, [requests, requests7d, requests30d]);

  const statusOptions = [
    'submitted',
    'reviewing',
    'quoted',
    'approved',
    'in_fulfillment',
    'delivered',
  ];

  const openRequest = async (requestId: string) => {
    setDetailLoading(true);
    setDetailError(null);
    const { data, error: fetchError } = await supabase
      .from('creator_requests')
      .select(`
        id,
        status,
        campaign_type,
        created_at,
        contact_person_name,
        contact_person_email,
        contact_person_phone,
        campaign_brief,
        deadline,
        creator_request_items (
          creators (
            id,
            name,
            handle,
            platform,
            follower_count
          )
        ),
        creator_request_targets (
          id,
          platform,
          quantity,
          follower_min,
          follower_max,
          geo,
          budget_min,
          budget_max,
          content_types,
          notes
        )
      `)
      .eq('id', requestId)
      .single();

    if (fetchError || !data) {
      setDetailError(fetchError?.message || 'Failed to load request details');
      setDetailLoading(false);
      return;
    }

    setSelectedRequest(data as CreatorRequestDetail);
    setDetailLoading(false);
  };

  const updateRequestStatus = async (nextStatus: string) => {
    if (!selectedRequest) return;
    setStatusUpdating(true);
    const { error: updateError } = await supabase
      .from('creator_requests')
      .update({ status: nextStatus })
      .eq('id', selectedRequest.id);

    if (updateError) {
      setDetailError(updateError.message || 'Failed to update status');
      setStatusUpdating(false);
      return;
    }

    setSelectedRequest({ ...selectedRequest, status: nextStatus });
    setRequests((prev) =>
      prev.map((r) => (r.id === selectedRequest.id ? { ...r, status: nextStatus } : r))
    );
    setStatusUpdating(false);
  };

  if (accessLoading || loading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-3">
          <Button
            variant="outline"
            onClick={() => onNavigate('/')}
            className="h-9 px-3 bg-white/[0.04] hover:bg-white/[0.08] border-white/[0.1] text-slate-300"
          >
            <ArrowLeft className="w-4 h-4 mr-1" />
            Back
          </Button>
          <h1 className="text-xl font-semibold text-white">Admin Dashboard</h1>
        </div>
        <div className="flex items-center gap-2 text-slate-400">
          <Loader2 className="w-4 h-4 animate-spin" />
          Loading admin metrics...
        </div>
      </div>
    );
  }

  if (!isCompanyAdmin) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-3">
          <Button
            variant="outline"
            onClick={() => onNavigate('/')}
            className="h-9 px-3 bg-white/[0.04] hover:bg-white/[0.08] border-white/[0.1] text-slate-300"
          >
            <ArrowLeft className="w-4 h-4 mr-1" />
            Back
          </Button>
          <h1 className="text-xl font-semibold text-white">Admin Dashboard</h1>
        </div>
        <Card className="bg-[#0D0D0D] border-white/[0.08]">
          <CardContent className="p-6">
            <p className="text-slate-300">You don’t have access to the admin dashboard.</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-semibold tracking-tight text-white">Admin Dashboard</h1>
          <p className="text-sm text-slate-400 mt-1">Company‑wide creator request metrics</p>
        </div>
        <Button
          variant="outline"
          onClick={() => onNavigate('/')}
          className="h-10 px-4 bg-white/[0.04] hover:bg-white/[0.08] border-white/[0.1] text-slate-300"
        >
          <ArrowLeft className="w-4 h-4 mr-2" />
          Back to App
        </Button>
      </div>

      {error && (
        <Card className="bg-red-500/10 border-red-500/20">
          <CardContent className="p-4 text-sm text-red-400">{error}</CardContent>
        </Card>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
        <Card className="bg-[#0D0D0D] border-white/[0.08]">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-xs text-slate-500">Total Requests</div>
                <div className="text-2xl font-semibold text-white">{metrics.total}</div>
              </div>
              <FileText className="w-5 h-5 text-primary" />
            </div>
          </CardContent>
        </Card>
        <Card className="bg-[#0D0D0D] border-white/[0.08]">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-xs text-slate-500">Total Accounts</div>
                <div className="text-2xl font-semibold text-white">{accountCount}</div>
              </div>
              <Users className="w-5 h-5 text-indigo-400" />
            </div>
          </CardContent>
        </Card>
        <Card className="bg-[#0D0D0D] border-white/[0.08]">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-xs text-slate-500">New Users (7d)</div>
                <div className="text-2xl font-semibold text-white">{newUsers7d}</div>
              </div>
              <Users className="w-5 h-5 text-emerald-400" />
            </div>
          </CardContent>
        </Card>
        <Card className="bg-[#0D0D0D] border-white/[0.08]">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-xs text-slate-500">Total Campaigns</div>
                <div className="text-2xl font-semibold text-white">{campaignCount}</div>
              </div>
              <Megaphone className="w-5 h-5 text-emerald-400" />
            </div>
          </CardContent>
        </Card>
        <Card className="bg-[#0D0D0D] border-white/[0.08]">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-xs text-slate-500">Active Campaigns</div>
                <div className="text-2xl font-semibold text-white">{activeCampaignCount}</div>
              </div>
              <Megaphone className="w-5 h-5 text-cyan-400" />
            </div>
          </CardContent>
        </Card>
        <Card className="bg-[#0D0D0D] border-white/[0.08]">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-xs text-slate-500">Total Creators</div>
                <div className="text-2xl font-semibold text-white">{creatorCount}</div>
              </div>
              <Users className="w-5 h-5 text-amber-400" />
            </div>
          </CardContent>
        </Card>
        <Card className="bg-[#0D0D0D] border-white/[0.08]">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-xs text-slate-500">Last 7 Days</div>
                <div className="text-2xl font-semibold text-white">{metrics.last7}</div>
              </div>
              <Clock className="w-5 h-5 text-cyan-400" />
            </div>
          </CardContent>
        </Card>
        <Card className="bg-[#0D0D0D] border-white/[0.08]">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-xs text-slate-500">Last 30 Days</div>
                <div className="text-2xl font-semibold text-white">{metrics.last30}</div>
              </div>
              <CheckCircle2 className="w-5 h-5 text-emerald-400" />
            </div>
          </CardContent>
        </Card>
        <Card className="bg-[#0D0D0D] border-white/[0.08]">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-xs text-slate-500">Total Workspaces</div>
                <div className="text-2xl font-semibold text-white">{workspaceCount}</div>
              </div>
              <Users className="w-5 h-5 text-purple-400" />
            </div>
          </CardContent>
        </Card>
        <Card className="bg-[#0D0D0D] border-white/[0.08]">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-xs text-slate-500">Total Views</div>
                <div className="text-2xl font-semibold text-white">
                  {totalViews.toLocaleString()}
                </div>
              </div>
              <Eye className="w-5 h-5 text-sky-400" />
            </div>
          </CardContent>
        </Card>
        <Card className="bg-[#0D0D0D] border-white/[0.08]">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-xs text-slate-500">Avg Engagement</div>
                <div className="text-2xl font-semibold text-white">
                  {engagementRate.toFixed(1)}%
                </div>
              </div>
              <Users className="w-5 h-5 text-pink-400" />
            </div>
          </CardContent>
        </Card>
      </div>

      <Card className="bg-[#0D0D0D] border-white/[0.08]">
        <CardContent className="p-4">
          <div className="text-sm font-semibold text-white mb-3">Requests by Status</div>
          <div className="flex flex-wrap gap-2 text-sm text-slate-300">
            {Object.entries(metrics.statusCounts).map(([status, count]) => (
              <span key={status} className="px-2 py-1 rounded-md bg-white/[0.06] border border-white/[0.08]">
                {status}: {count}
              </span>
            ))}
            {Object.keys(metrics.statusCounts).length === 0 && (
              <span className="text-slate-500">No requests yet.</span>
            )}
          </div>
        </CardContent>
      </Card>

      <Card className="bg-[#0D0D0D] border-white/[0.08]">
        <CardContent className="p-4">
          <div className="text-sm font-semibold text-white mb-3">Recent Requests</div>
          <div className="space-y-3">
            {requests.slice(0, 10).map((request) => (
              <div
                key={request.id}
                className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border border-white/[0.06] rounded-md p-3 bg-white/[0.02] cursor-pointer hover:bg-white/[0.04] transition-colors"
                onClick={() => openRequest(request.id)}
              >
                <div className="text-sm text-slate-200">
                  {request.contact_person_name || request.contact_person_email || 'Unknown requester'}
                </div>
                <div className="text-xs text-slate-500">
                  {request.campaign_type || 'Unknown type'} • {new Date(request.created_at).toLocaleDateString()}
                </div>
                <div className="text-xs text-slate-400">{request.status}</div>
              </div>
            ))}
            {requests.length === 0 && (
              <div className="text-sm text-slate-500">No requests found.</div>
            )}
          </div>
        </CardContent>
      </Card>

      {selectedRequest && (
        <div className="fixed inset-0 z-[200] bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <Card className="bg-[#0D0D0D] border-white/[0.08] w-full max-w-2xl max-h-[90vh] overflow-hidden">
            <CardContent className="p-0">
              <div className="flex items-center justify-between px-6 py-4 border-b border-white/[0.08]">
                <div>
                  <div className="text-sm text-slate-400">Request Details</div>
                  <div className="text-lg font-semibold text-white">
                    {selectedRequest.contact_person_name || selectedRequest.contact_person_email || 'Unknown requester'}
                  </div>
                </div>
                <button
                  onClick={() => setSelectedRequest(null)}
                  className="w-9 h-9 rounded-lg hover:bg-white/[0.06] flex items-center justify-center"
                >
                  <X className="w-4 h-4 text-slate-400" />
                </button>
              </div>

              <div className="px-6 py-5 space-y-4 overflow-y-auto max-h-[70vh]">
                {detailLoading && (
                  <div className="text-sm text-slate-400 flex items-center gap-2">
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Loading request...
                  </div>
                )}
                {detailError && (
                  <div className="text-sm text-red-400">{detailError}</div>
                )}

                {!detailLoading && (
                  <>
                    <div className="grid sm:grid-cols-2 gap-4 text-sm text-slate-300">
                      <div>
                        <div className="text-xs text-slate-500">Campaign Type</div>
                        <div>{selectedRequest.campaign_type || 'Unknown'}</div>
                      </div>
                      <div>
                        <div className="text-xs text-slate-500">Requested</div>
                        <div>{new Date(selectedRequest.created_at).toLocaleString()}</div>
                      </div>
                      <div>
                        <div className="text-xs text-slate-500">Contact Email</div>
                        <div>{selectedRequest.contact_person_email || 'N/A'}</div>
                      </div>
                      <div>
                        <div className="text-xs text-slate-500">Contact Phone</div>
                        <div>{selectedRequest.contact_person_phone || 'N/A'}</div>
                      </div>
                      <div>
                        <div className="text-xs text-slate-500">Deadline</div>
                        <div>{selectedRequest.deadline ? new Date(selectedRequest.deadline).toLocaleDateString() : 'N/A'}</div>
                      </div>
                    </div>

                  <div>
                      <div className="text-xs text-slate-500 mb-2">Campaign Brief</div>
                      <div className="text-sm text-slate-300 whitespace-pre-wrap bg-white/[0.03] border border-white/[0.06] rounded-md p-3">
                        {selectedRequest.campaign_brief || 'No brief provided.'}
                      </div>
                    </div>

                    <div>
                      <div className="text-xs text-slate-500 mb-2">Requested Creators</div>
                      <div className="space-y-2">
                        {(selectedRequest.creator_request_items || [])
                          .map((item) => item.creators)
                          .filter(Boolean)
                          .map((creator) => (
                            <div
                              key={creator!.id}
                              className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border border-white/[0.06] rounded-md p-3 bg-white/[0.02]"
                            >
                              <div className="text-sm text-slate-200">
                                {creator!.name || 'Unknown creator'}
                              </div>
                              <div className="text-xs text-slate-500">
                                @{creator!.handle || 'N/A'} • {creator!.platform || 'N/A'}
                              </div>
                              <div className="text-xs text-slate-400">
                                {creator!.follower_count ? creator!.follower_count.toLocaleString() : '—'} followers
                              </div>
                            </div>
                          ))}
                        {(!selectedRequest.creator_request_items ||
                          selectedRequest.creator_request_items.length === 0) && (
                          <div className="text-sm text-slate-500">No creators selected.</div>
                        )}
                      </div>
                    </div>

                    <div>
                      <div className="text-xs text-slate-500 mb-2">Bulk Targets</div>
                      <div className="space-y-2">
                        {(selectedRequest.creator_request_targets || []).map((target) => (
                          <div
                            key={target.id}
                            className="border border-white/[0.06] rounded-md p-3 bg-white/[0.02] text-sm text-slate-300"
                          >
                            <div className="flex flex-wrap items-center gap-2">
                              <span className="text-slate-200">
                                {target.quantity} creators
                              </span>
                              {target.platform && (
                                <span className="text-slate-500">• {target.platform}</span>
                              )}
                              {(target.follower_min || target.follower_max) && (
                                <span className="text-slate-500">
                                  • {target.follower_min ?? 0}–{target.follower_max ?? '∞'} followers
                                </span>
                              )}
                              {(target.budget_min || target.budget_max) && (
                                <span className="text-slate-500">
                                  • ${target.budget_min ?? 0}–${target.budget_max ?? '∞'} budget
                                </span>
                              )}
                              {target.geo && <span className="text-slate-500">• {target.geo}</span>}
                            </div>
                            {target.content_types && target.content_types.length > 0 && (
                              <div className="text-xs text-slate-500 mt-1">
                                Content: {target.content_types.join(', ')}
                              </div>
                            )}
                            {target.notes && (
                              <div className="text-xs text-slate-500 mt-1">{target.notes}</div>
                            )}
                          </div>
                        ))}
                        {(!selectedRequest.creator_request_targets ||
                          selectedRequest.creator_request_targets.length === 0) && (
                          <div className="text-sm text-slate-500">No bulk targets.</div>
                        )}
                      </div>
                    </div>

                    <div>
                      <div className="text-xs text-slate-500 mb-2">Internal Status</div>
                      <div className="flex flex-wrap gap-2">
                        {statusOptions.map((status) => (
                          <button
                            key={status}
                            onClick={() => updateRequestStatus(status)}
                            disabled={statusUpdating}
                            className={`px-3 py-1 rounded-md text-xs border transition-colors ${
                              selectedRequest.status === status
                                ? 'bg-primary/10 text-primary border-primary/30'
                                : 'bg-white/[0.04] text-slate-300 border-white/[0.08] hover:bg-white/[0.08]'
                            }`}
                          >
                            {status.replace('_', ' ')}
                          </button>
                        ))}
                      </div>
                    </div>
                  </>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
