import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent } from './ui/card';
import { Button } from './ui/button';
import { ArrowLeft, FileText, Loader2, Users, Megaphone, Eye, X, BarChart3 } from 'lucide-react';
import { ChartPanelSkeleton, DashboardKpiSkeleton, Skeleton, TableRowSkeleton } from './ui/skeleton';
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
} from 'recharts';
import { supabase } from '../../lib/supabase';
import { useCompanyAdmin } from '../../hooks/useCompanyAdmin';
import { cn } from './ui/utils';

interface AdminDashboardProps {
  onNavigate: (path: string) => void;
}

type CreatorRequestRow = {
  id: string;
  status: string;
  campaign_type: string | null;
  campaign_id?: string | null;
  user_id?: string | null;
  created_at: string;
  deadline?: string | null;
  contact_person_name: string | null;
  contact_person_email: string | null;
};

type CreatorRequestDetail = CreatorRequestRow & {
  contact_person_phone?: string | null;
  campaign_brief?: string | null;
  deadline?: string | null;
  creator_request_items?: Array<{
    id?: string;
    creator_id?: string;
    status?: string | null;
    quoted_amount_cents?: number | null;
    quoted_currency?: string | null;
    quote_notes?: string | null;
    quoted_by?: string | null;
    quoted_at?: string | null;
    creators: {
      id: string;
      name: string | null;
      handle: string | null;
      platform: string | null;
      follower_count: number | null;
    } | null;
  }>;
};

type AdminAuditLogEntry = {
  id: string;
  actor_user_id: string;
  target_user_id: string | null;
  action: string;
  metadata: Record<string, any>;
  created_at: string;
};

type AdminProfileMap = Record<string, { full_name: string | null; email: string | null }>;

export function AdminDashboard({ onNavigate }: AdminDashboardProps) {
  const { isCompanyAdmin, loading: accessLoading } = useCompanyAdmin();
  const queryClient = useQueryClient();
  const [requests, setRequests] = useState<CreatorRequestRow[]>([]);
  const [selectedRequest, setSelectedRequest] = useState<CreatorRequestDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [statusUpdating, setStatusUpdating] = useState(false);
  const [quoteSubmitting, setQuoteSubmitting] = useState(false);
  const [detailError, setDetailError] = useState<string | null>(null);
  const [campaignName, setCampaignName] = useState<string | null>(null);
  const [quoteDrafts, setQuoteDrafts] = useState<Record<string, { amount: string; currency: string; notes: string }>>({});
  const [auditLogs, setAuditLogs] = useState<AdminAuditLogEntry[]>([]);
  const [auditLoading, setAuditLoading] = useState(false);
  const [auditLimit, setAuditLimit] = useState(50);
  const [auditCursor, setAuditCursor] = useState<{ createdAt: string; id: string } | null>(null);
  const [auditHasMore, setAuditHasMore] = useState(true);
  const [auditProfiles, setAuditProfiles] = useState<AdminProfileMap>({});
  const [auditActionFilter, setAuditActionFilter] = useState<string>('all');
  const [auditActorFilter, setAuditActorFilter] = useState('');
  const [auditDateFilter, setAuditDateFilter] = useState<'all' | '24h' | '7d' | '30d'>('30d');
  const [accountCount, setAccountCount] = useState(0);
  const [workspaceCount, setWorkspaceCount] = useState(0);
  const [campaignCount, setCampaignCount] = useState(0);
  const [activeCampaignCount, setActiveCampaignCount] = useState(0);
  const [creatorCount, setCreatorCount] = useState(0);
  const [totalViews, setTotalViews] = useState(0);
  const [engagementRate, setEngagementRate] = useState(0);
  const [timeSeries, setTimeSeries] = useState<Array<{
    day: string;
    requests_count: number;
    users_count: number;
    workspaces_count: number;
    campaigns_count: number;
    creators_count: number;
    views_count: number;
    engagement_sum: number;
    posts_count: number;
  }>>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [metricView, setMetricView] = useState<'requests' | 'accounts'>('requests');
  const [activeMetricKey, setActiveMetricKey] = useState<string>('total_requests');
  const [chartRange, setChartRange] = useState<'7d' | '30d' | '90d' | 'all'>('30d');
  const [adminSearchQuery, setAdminSearchQuery] = useState('');
  const [adminStatusFilter, setAdminStatusFilter] = useState<'all' | string>('all');
  const [adminUrgencyFilter, setAdminUrgencyFilter] = useState<'all' | 'urgent' | 'soon' | 'safe'>('all');
  const [adminPage, setAdminPage] = useState(1);
  const pageSize = 10;
  const requestListRef = useRef<HTMLDivElement | null>(null);
  const [requestListHeight, setRequestListHeight] = useState(0);
  const [requestListScrollTop, setRequestListScrollTop] = useState(0);
  const requestRowHeight = 72;
  const virtualizationEnabled =
    typeof window !== 'undefined'
      ? localStorage.getItem('disable_virtualization') !== '1'
      : true;

  const metricsQuery = useQuery({
    queryKey: ['admin_metrics'],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('get_company_admin_metrics');
      if (error) throw error;
      return data as any;
    },
    enabled: isCompanyAdmin,
    staleTime: 60 * 1000,
    gcTime: 10 * 60 * 1000,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
  });

  const timeSeriesQuery = useQuery({
    queryKey: ['admin_timeseries'],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('get_company_admin_timeseries');
      if (error) throw error;
      return (data || []) as any[];
    },
    enabled: isCompanyAdmin,
    staleTime: 2 * 60 * 1000,
    gcTime: 15 * 60 * 1000,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
  });

  const requestsQuery = useQuery({
    queryKey: ['admin_requests', { limit: 50 }],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('creator_requests')
        .select('id, status, campaign_type, campaign_id, user_id, created_at, deadline, contact_person_name, contact_person_email')
        .order('created_at', { ascending: false })
        .limit(50);
      if (error) throw error;
      return (data || []) as CreatorRequestRow[];
    },
    enabled: isCompanyAdmin,
    staleTime: 60 * 1000,
    gcTime: 10 * 60 * 1000,
    keepPreviousData: true,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
  });
  const requestsRefreshing = requestsQuery.isFetching && !requestsQuery.isLoading;

  useEffect(() => {
    if (!isCompanyAdmin) {
      setLoading(false);
      return;
    }
    if (metricsQuery.error || timeSeriesQuery.error || requestsQuery.error) {
      setError(
        (metricsQuery.error ||
          timeSeriesQuery.error ||
          requestsQuery.error)?.message || 'Failed to load admin metrics'
      );
      setRequests([]);
      setLoading(false);
      return;
    }

    const metrics = metricsQuery.data;
    if (metrics) {
      setAccountCount(metrics.total_users || 0);
      setWorkspaceCount(metrics.total_workspaces || 0);
      setCampaignCount(metrics.total_campaigns || 0);
      setActiveCampaignCount(metrics.active_campaigns || 0);
      setCreatorCount(metrics.total_creators || 0);
      setTotalViews(metrics.total_views || 0);
      setEngagementRate(metrics.engagement_rate || 0);
    }
    if (timeSeriesQuery.data) {
      setTimeSeries(timeSeriesQuery.data);
    }
    if (requestsQuery.data) {
      setRequests(requestsQuery.data);
    }
    setLoading(metricsQuery.isLoading || timeSeriesQuery.isLoading || requestsQuery.isLoading);
  }, [
    isCompanyAdmin,
    metricsQuery.data,
    metricsQuery.error,
    metricsQuery.isLoading,
    timeSeriesQuery.data,
    timeSeriesQuery.error,
    timeSeriesQuery.isLoading,
    requestsQuery.data,
    requestsQuery.error,
    requestsQuery.isLoading,
  ]);

  useEffect(() => {
    if (!isCompanyAdmin) return;
    const fetchAuditLogs = async () => {
      setAuditLoading(true);
      const { data, error: logsError } = await supabase.rpc('get_company_admin_audit_logs_page', {
        action_filter: auditActionFilter === 'all' ? null : auditActionFilter,
        actor_filter: auditActorFilter || null,
        date_filter: auditDateFilter,
        page_limit: auditLimit,
        cursor_created_at: auditCursor?.createdAt || null,
        cursor_log_id: auditCursor?.id || null,
      });

      if (!logsError && data) {
        const logs = data as AdminAuditLogEntry[];
        setAuditLogs(logs);
        setAuditHasMore(logs.length >= auditLimit);
        if (logs.length) {
          const last = logs[logs.length - 1];
          setAuditCursor({ createdAt: last.created_at, id: last.id });
        } else {
          setAuditCursor(null);
        }

        const userIds = new Set<string>();
        logs.forEach((log) => {
          userIds.add(log.actor_user_id);
          if (log.target_user_id) userIds.add(log.target_user_id);
        });
        const ids = Array.from(userIds);
        if (ids.length) {
          const { data: profiles } = await supabase
            .from('profiles')
            .select('id, full_name, email')
            .in('id', ids);
          const map: AdminProfileMap = {};
          (profiles || []).forEach((profile: any) => {
            map[profile.id] = {
              full_name: profile.full_name || null,
              email: profile.email || null,
            };
          });
          setAuditProfiles(map);
        }
      }
      setAuditLoading(false);
    };

    fetchAuditLogs();
  }, [isCompanyAdmin, auditLimit, auditActionFilter, auditActorFilter, auditDateFilter]);

  const auditActionOptions = useMemo(() => {
    const unique = new Set(auditLogs.map((log) => log.action));
    return Array.from(unique).sort();
  }, [auditLogs]);

  const exportAuditCsv = () => {
    const rows = auditLogs.map((log) => {
      const actorProfile = auditProfiles[log.actor_user_id];
      const targetProfile = log.target_user_id ? auditProfiles[log.target_user_id] : null;
      return {
        created_at: log.created_at,
        action: log.action,
        actor_id: log.actor_user_id,
        actor_name: actorProfile?.full_name || '',
        actor_email: actorProfile?.email || '',
        target_id: log.target_user_id || '',
        target_name: targetProfile?.full_name || '',
        target_email: targetProfile?.email || '',
        metadata: JSON.stringify(log.metadata || {}),
      };
    });

    const header = [
      'created_at',
      'action',
      'actor_id',
      'actor_name',
      'actor_email',
      'target_id',
      'target_name',
      'target_email',
      'metadata',
    ];
    const csv = [
      header.join(','),
      ...rows.map((row) =>
        header
          .map((key) => `"${String((row as any)[key] ?? '').replace(/"/g, '""')}"`)
          .join(',')
      ),
    ].join('\n');

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `admin-audit-log-${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const metrics = useMemo(() => {
    const statusCounts = requests.reduce<Record<string, number>>((acc, r) => {
      acc[r.status] = (acc[r.status] || 0) + 1;
      return acc;
    }, {});

    return {
      total: requests.length,
      statusCounts,
    };
  }, [requests]);

  const seriesTotals = useMemo(() => {
    if (timeSeries.length === 0) return null;
    return timeSeries.reduce(
      (acc, row) => {
        acc.users += row.users_count || 0;
        acc.engagementSum += row.engagement_sum || 0;
        acc.posts += row.posts_count || 0;
        return acc;
      },
      { users: 0, engagementSum: 0, posts: 0 }
    );
  }, [timeSeries]);

  const displayAccountCount = seriesTotals?.users ?? accountCount;
  const displayEngagementRate = seriesTotals
    ? seriesTotals.posts
      ? seriesTotals.engagementSum / seriesTotals.posts
      : 0
    : engagementRate;

  const statusOptions = [
    'suggested',
    'submitted',
    'reviewing',
    'quoted',
    'approved',
    'in_fulfillment',
    'delivered',
  ];

  const indexedRequests = useMemo(() => {
    const now = new Date();
    return requests.map((request) => {
      const name = request.contact_person_name?.toLowerCase() || '';
      const email = request.contact_person_email?.toLowerCase() || '';
      const type = request.campaign_type?.toLowerCase() || '';
      const searchText = `${name} ${email} ${type}`.trim();
      let diffDays: number | null = null;
      if (request.deadline) {
        const deadline = new Date(request.deadline);
        if (!Number.isNaN(deadline.getTime())) {
          diffDays = Math.ceil((deadline.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
        }
      }
      return { request, searchText, diffDays };
    });
  }, [requests]);

  const requestsByStatus = useMemo(() => {
    const map = new Map<string, typeof indexedRequests>();
    statusOptions.forEach((status) => map.set(status, []));
    indexedRequests.forEach((entry) => {
      const bucket = map.get(entry.request.status) || [];
      bucket.push(entry);
      map.set(entry.request.status, bucket);
    });
    return map;
  }, [indexedRequests, statusOptions]);

  const requestsByUrgency = useMemo(() => {
    const buckets = {
      urgent: [] as typeof indexedRequests,
      soon: [] as typeof indexedRequests,
      safe: [] as typeof indexedRequests,
    };
    indexedRequests.forEach((entry) => {
      if (entry.diffDays === null) return;
      if (entry.diffDays <= 3) {
        buckets.urgent.push(entry);
      } else if (entry.diffDays <= 7) {
        buckets.soon.push(entry);
      } else {
        buckets.safe.push(entry);
      }
    });
    return buckets;
  }, [indexedRequests]);

  const filteredAdminRequests = useMemo(() => {
    const query = adminSearchQuery.trim().toLowerCase();
    let filtered = indexedRequests;

    if (query) {
      filtered = filtered.filter((entry) => entry.searchText.includes(query));
    }

    if (adminStatusFilter !== 'all') {
      if (!query && adminUrgencyFilter === 'all') {
        filtered = requestsByStatus.get(adminStatusFilter) || [];
      } else {
        filtered = filtered.filter((entry) => entry.request.status === adminStatusFilter);
      }
    }

    if (adminUrgencyFilter !== 'all') {
      if (!query && adminStatusFilter === 'all') {
        filtered = requestsByUrgency[adminUrgencyFilter] || [];
      } else {
        filtered = filtered.filter((entry) => {
          if (entry.diffDays === null) return false;
          if (adminUrgencyFilter === 'urgent') return entry.diffDays <= 3;
          if (adminUrgencyFilter === 'soon') return entry.diffDays > 3 && entry.diffDays <= 7;
          return entry.diffDays > 7;
        });
      }
    }

    return filtered;
  }, [
    indexedRequests,
    adminSearchQuery,
    adminStatusFilter,
    adminUrgencyFilter,
    requestsByStatus,
    requestsByUrgency,
  ]);

  const totalAdminPages = Math.max(1, Math.ceil(filteredAdminRequests.length / pageSize));
  const currentAdminPage = Math.min(adminPage, totalAdminPages);
  const adminPageSlice = filteredAdminRequests.slice(
    (currentAdminPage - 1) * pageSize,
    currentAdminPage * pageSize
  );
  const shouldVirtualizeRequests =
    virtualizationEnabled && filteredAdminRequests.length > 120;
  const displayRequests = shouldVirtualizeRequests ? filteredAdminRequests : adminPageSlice;

  useEffect(() => {
    if (adminPage > totalAdminPages) {
      setAdminPage(totalAdminPages);
    }
  }, [adminPage, totalAdminPages]);

  useEffect(() => {
    if (!shouldVirtualizeRequests || !requestListRef.current) return;
    const node = requestListRef.current;
    const updateHeight = () => setRequestListHeight(node.clientHeight);
    updateHeight();
    const observer = new ResizeObserver(updateHeight);
    observer.observe(node);
    return () => observer.disconnect();
  }, [shouldVirtualizeRequests, displayRequests.length]);

  useEffect(() => {
    if (!shouldVirtualizeRequests) return;
    setRequestListScrollTop(0);
    requestListRef.current?.scrollTo({ top: 0 });
  }, [shouldVirtualizeRequests, adminSearchQuery, adminStatusFilter, adminUrgencyFilter]);

  const requestVirtualWindow = useMemo(() => {
    if (!shouldVirtualizeRequests) {
      return {
        items: displayRequests,
        paddingTop: 0,
        paddingBottom: 0,
        startIndex: 0,
      };
    }
    const total = displayRequests.length;
    const visibleCount = Math.ceil(requestListHeight / requestRowHeight) + 6;
    const startIndex = Math.max(0, Math.floor(requestListScrollTop / requestRowHeight) - 3);
    const endIndex = Math.min(total, startIndex + visibleCount);
    return {
      items: displayRequests.slice(startIndex, endIndex),
      paddingTop: startIndex * requestRowHeight,
      paddingBottom: Math.max(0, total * requestRowHeight - endIndex * requestRowHeight),
      startIndex,
    };
  }, [shouldVirtualizeRequests, displayRequests, requestListHeight, requestListScrollTop]);

  const metricRows = useMemo(() => {
    if (metricView === 'requests') {
      return [
        { key: 'total_requests', label: 'Total Requests', value: metrics.total.toLocaleString(), icon: <FileText className="w-4 h-4 text-primary" /> },
      ];
    }
    return [
      { key: 'total_accounts', label: 'Total Accounts', value: displayAccountCount.toLocaleString(), icon: <Users className="w-4 h-4 text-red-600 dark:text-indigo-400" /> },
      { key: 'total_workspaces', label: 'Total Workspaces', value: workspaceCount.toLocaleString(), icon: <Users className="w-4 h-4 text-purple-400" /> },
      { key: 'total_campaigns', label: 'Total Campaigns', value: campaignCount.toLocaleString(), icon: <Megaphone className="w-4 h-4 text-emerald-400" /> },
      { key: 'total_creators', label: 'Total Creators', value: creatorCount.toLocaleString(), icon: <Users className="w-4 h-4 text-amber-400" /> },
      { key: 'total_views', label: 'Total Views', value: totalViews.toLocaleString(), icon: <Eye className="w-4 h-4 text-red-600 dark:text-sky-400" /> },
      { key: 'avg_engagement', label: 'Avg Engagement', value: `${displayEngagementRate.toFixed(1)}%`, icon: <Users className="w-4 h-4 text-pink-400" /> },
    ];
  }, [
    metricView,
    metrics,
    workspaceCount,
    campaignCount,
    activeCampaignCount,
    creatorCount,
    totalViews,
    displayAccountCount,
    displayEngagementRate,
  ]);

  useEffect(() => {
    if (metricView === 'requests') {
      setActiveMetricKey('total_requests');
    } else {
      setActiveMetricKey('total_accounts');
    }
  }, [metricView]);

  const chartData = useMemo(() => {
    if (timeSeries.length === 0) {
      return [];
    }
    const base = timeSeries.map((row) => ({
      label: new Date(row.day).toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
      }),
      requests: row.requests_count,
      users: row.users_count,
      workspaces: row.workspaces_count,
      campaigns: row.campaigns_count,
      creators: row.creators_count,
      views: row.views_count,
      engagementSum: row.engagement_sum,
      postsCount: row.posts_count,
    }));

    // Build cumulative series for totals
    let usersCum = 0;
    let workspacesCum = 0;
    let campaignsCum = 0;
    let creatorsCum = 0;
    let viewsCum = 0;
    let engagementSumCum = 0;
    let postsCum = 0;
    const cumulative = base.map((row) => {
      usersCum += row.users;
      workspacesCum += row.workspaces;
      campaignsCum += row.campaigns;
      creatorsCum += row.creators;
      viewsCum += row.views;
      engagementSumCum += row.engagementSum;
      postsCum += row.postsCount;
      return {
        ...row,
        usersCum,
        workspacesCum,
        campaignsCum,
        creatorsCum,
        viewsCum,
        engagementSumCum,
        postsCum,
      };
    });

    const rangeMap: Record<typeof chartRange, number | null> = {
      '7d': 7,
      '30d': 30,
      '90d': 90,
      all: null,
    };
    const limit = rangeMap[chartRange];
    const rangedBase = limit ? cumulative.slice(-limit) : cumulative;

    let requestsCum = 0;
    const cumulativeRange = rangedBase.map((row) => {
      requestsCum += row.requests;
      return {
        ...row,
        requestsCum,
      };
    });

    switch (activeMetricKey) {
      case 'total_requests':
        return cumulativeRange.map((row) => ({ label: row.label, value: row.requestsCum }));
      case 'total_accounts':
        return cumulativeRange.map((row) => ({ label: row.label, value: row.usersCum }));
      case 'total_workspaces':
        return cumulativeRange.map((row) => ({ label: row.label, value: row.workspacesCum }));
      case 'total_campaigns':
      case 'active_campaigns':
        return cumulativeRange.map((row) => ({ label: row.label, value: row.campaignsCum }));
      case 'total_creators':
        return cumulativeRange.map((row) => ({ label: row.label, value: row.creatorsCum }));
      case 'total_views':
        return cumulativeRange.map((row) => ({ label: row.label, value: row.viewsCum }));
      case 'avg_engagement':
        return cumulativeRange.map((row) => ({
          label: row.label,
          value: row.postsCum ? Number((row.engagementSumCum / row.postsCum).toFixed(2)) : 0,
        }));
      default:
        return cumulativeRange.map((row) => ({ label: row.label, value: row.requestsCum }));
    }
  }, [activeMetricKey, timeSeries, chartRange]);

  const formatAxisValue = (value: number) => {
    if (value >= 1_000_000) {
      const formatted = (value / 1_000_000).toFixed(value % 1_000_000 === 0 ? 0 : 1);
      return `${formatted}M`;
    }
    if (value >= 1_000) {
      const formatted = (value / 1_000).toFixed(value % 1_000 === 0 ? 0 : 1);
      return `${formatted}K`;
    }
    return `${value}`;
  };

  // Debug logging removed for production readiness

  const requestDetailKey = (requestId: string) => ['admin_request_detail', requestId] as const;

  const prefetchRequestDetail = (requestId: string) => {
    queryClient.prefetchQuery({
      queryKey: requestDetailKey(requestId),
      queryFn: async () => {
        const { data, error: fetchError } = await supabase
          .from('creator_requests')
          .select(`
            id,
            status,
            campaign_type,
            campaign_id,
            user_id,
            created_at,
            contact_person_name,
            contact_person_email,
            contact_person_phone,
            campaign_brief,
            deadline,
            creator_request_items (
              id,
              creator_id,
              status,
              quoted_amount_cents,
              quoted_currency,
              quote_notes,
              quoted_by,
              quoted_at,
              creators (
                id,
                name,
                handle,
                platform,
                follower_count
              )
            )
          `)
          .eq('id', requestId)
          .single();
        if (fetchError) throw fetchError;
        return data as CreatorRequestDetail;
      },
      staleTime: 60 * 1000,
      gcTime: 10 * 60 * 1000,
    });
  };

  const openRequest = async (requestId: string) => {
    setDetailLoading(true);
    setDetailError(null);
    try {
      const data = await queryClient.fetchQuery({
        queryKey: requestDetailKey(requestId),
        queryFn: async () => {
          const { data, error: fetchError } = await supabase
            .from('creator_requests')
            .select(`
              id,
              status,
              campaign_type,
              campaign_id,
              user_id,
              created_at,
              contact_person_name,
              contact_person_email,
              contact_person_phone,
              campaign_brief,
              deadline,
            creator_request_items (
              id,
              creator_id,
              status,
              quoted_amount_cents,
              quoted_currency,
              quote_notes,
              quoted_by,
              quoted_at,
              creators (
                id,
                name,
                handle,
                platform,
                follower_count
              )
            )
          `)
            .eq('id', requestId)
            .single();
          if (fetchError) throw fetchError;
          return data as CreatorRequestDetail;
        },
        staleTime: 60 * 1000,
        gcTime: 10 * 60 * 1000,
      });

      setSelectedRequest(data as CreatorRequestDetail);
      const drafts: Record<string, { amount: string; currency: string; notes: string }> = {};
      (data?.creator_request_items || []).forEach((item) => {
        const creatorId = item.creator_id || item.creators?.id;
        if (!creatorId) return;
        drafts[creatorId] = {
          amount:
            item.quoted_amount_cents !== null && item.quoted_amount_cents !== undefined
              ? (item.quoted_amount_cents / 100).toString()
              : '',
          currency: item.quoted_currency || 'USD',
          notes: item.quote_notes || '',
        };
      });
      setQuoteDrafts(drafts);
      if (data?.campaign_id) {
        const { data: campaign } = await supabase
          .from('campaigns')
          .select('name')
          .eq('id', data.campaign_id)
          .maybeSingle();
        setCampaignName(campaign?.name || data.campaign_id || null);
      } else {
        setCampaignName(null);
      }
      setDetailLoading(false);
    } catch (fetchError: any) {
      setDetailError(fetchError?.message || 'Failed to load request details');
      setDetailLoading(false);
    }
  };
        
  const updateRequestStatus = async (nextStatus: string) => {
    if (!selectedRequest) return;
    setStatusUpdating(true);
    if (nextStatus === 'approved' && selectedRequest.campaign_id) {
      const { error: approveError } = await supabase.rpc('approve_creator_request', {
        request_id: selectedRequest.id,
      });
      if (approveError) {
        setDetailError(approveError.message || 'Failed to approve request');
        setStatusUpdating(false);
        return;
      }
    } else {
      const { error: updateError } = await supabase
        .from('creator_requests')
        .update({ status: nextStatus })
        .eq('id', selectedRequest.id);

      if (updateError) {
        setDetailError(updateError.message || 'Failed to update status');
        setStatusUpdating(false);
        return;
      }
    }

    if (isCompanyAdmin) {
      await supabase.rpc('log_company_admin_action', {
        target_user_id: selectedRequest.user_id || null,
        action: 'request_status_updated',
        metadata: {
          request_id: selectedRequest.id,
          status: nextStatus,
        },
      });
    }

    setSelectedRequest({ ...selectedRequest, status: nextStatus });
    setRequests((prev) =>
      prev.map((r) => (r.id === selectedRequest.id ? { ...r, status: nextStatus } : r))
    );
    setStatusUpdating(false);
  };

  const sendQuotes = async () => {
    if (!selectedRequest) return;
    setDetailError(null);
    setQuoteSubmitting(true);

    const items = (selectedRequest.creator_request_items || [])
      .map((item) => {
        const creatorId = item.creator_id || item.creators?.id;
        if (!creatorId) return null;
        const draft = quoteDrafts[creatorId];
        if (!draft || !draft.amount) return null;
        const amount = Math.round(parseFloat(draft.amount) * 100);
        if (!Number.isFinite(amount) || amount <= 0) return null;
        return {
          creator_id: creatorId,
          quoted_amount_cents: amount,
          quoted_currency: draft.currency || 'USD',
          quote_notes: draft.notes || null,
        };
      })
      .filter(Boolean) as Array<{
        creator_id: string;
        quoted_amount_cents: number;
        quoted_currency?: string | null;
        quote_notes?: string | null;
      }>;

    if (items.length === 0) {
      setDetailError('Add quote amounts before sending.');
      setQuoteSubmitting(false);
      return;
    }

    const { error: quoteError } = await supabase.rpc('company_admin_quote_creator_request', {
      target_request_id: selectedRequest.id,
      items,
    });

    if (quoteError) {
      setDetailError(quoteError.message || 'Failed to send quotes');
      setQuoteSubmitting(false);
      return;
    }

    setSelectedRequest({
      ...selectedRequest,
      status: 'quoted',
      creator_request_items: (selectedRequest.creator_request_items || []).map((item) => {
        const creatorId = item.creator_id || item.creators?.id;
        const draft = creatorId ? quoteDrafts[creatorId] : null;
        if (!creatorId || !draft || !draft.amount) return item;
        return {
          ...item,
          status: 'quoted',
          quoted_amount_cents: Math.round(parseFloat(draft.amount) * 100),
          quoted_currency: draft.currency || 'USD',
          quote_notes: draft.notes || null,
          quoted_at: new Date().toISOString(),
        };
      }),
    });
    setQuoteSubmitting(false);
  };

  if (accessLoading || loading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-3">
          <Button
            variant="outline"
            onClick={() => onNavigate('/')}
            className="h-9 px-3 bg-muted/50 hover:bg-muted/70 border-border/70 text-muted-foreground"
          >
          <ArrowLeft className="w-4 h-4 mr-1" />
            Back
          </Button>
          <h1 className="text-xl font-semibold text-foreground">Admin Dashboard</h1>
        </div>
        <div className="flex items-center gap-2">
          <Skeleton className="h-4 w-32" />
          <Skeleton className="h-4 w-24" />
        </div>
        <DashboardKpiSkeleton />
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <ChartPanelSkeleton />
          <ChartPanelSkeleton />
        </div>
        <Card className="bg-card border-border">
          <CardContent className="p-0">
            {Array.from({ length: 5 }).map((_, i) => (
              <TableRowSkeleton key={i} />
            ))}
          </CardContent>
        </Card>
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
            className="h-9 px-3 bg-muted/50 hover:bg-muted/70 border-border/70 text-muted-foreground"
          >
            <ArrowLeft className="w-4 h-4 mr-1" />
            Back
          </Button>
          <h1 className="text-xl font-semibold text-foreground">Admin Dashboard</h1>
        </div>
        <Card className="bg-card border-border">
          <CardContent className="p-6">
            <p className="text-muted-foreground">You don’t have access to the admin dashboard.</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-semibold tracking-tight text-foreground">Admin Dashboard</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Company‑wide health, requests, and activity.
          </p>
        </div>
        <Button
          variant="outline"
          onClick={() => onNavigate('/')}
          className="h-10 px-4 bg-muted/50 hover:bg-muted/70 border-border/70 text-muted-foreground"
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

      <div className="grid grid-cols-1 xl:grid-cols-[1.3fr_1fr] gap-4">
        <Card className="bg-card border-border">
          <CardContent className="p-4 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <div className="text-sm font-semibold text-foreground">Company Metrics</div>
                <p className="text-xs text-muted-foreground">Switch between requests and account health.</p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setMetricView('requests')}
                  className={`h-9 px-3 rounded-md border text-xs font-semibold transition-colors ${
                    metricView === 'requests'
                      ? 'bg-primary text-primary-foreground border-primary'
                      : 'bg-muted/40 border-border text-muted-foreground hover:bg-muted/60'
                  }`}
                >
                  Requests
                </button>
                <button
                  onClick={() => setMetricView('accounts')}
                  className={`h-9 px-3 rounded-md border text-xs font-semibold transition-colors ${
                    metricView === 'accounts'
                      ? 'bg-primary text-primary-foreground border-primary'
                      : 'bg-muted/40 border-border text-muted-foreground hover:bg-muted/60'
                  }`}
                >
                  Accounts
                </button>
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="min-w-[520px] w-full text-sm">
                <thead className="text-muted-foreground uppercase text-[11px]">
                  <tr>
                    <th className="text-left py-2">Metric</th>
                    <th className="text-left py-2">Value</th>
                    <th className="text-left py-2">Indicator</th>
                  </tr>
                </thead>
                <tbody>
                  {metricRows.map((row) => (
                    <tr
                      key={row.label}
                      className={`border-t border-border/60 cursor-pointer transition-colors ${
                        activeMetricKey === row.key
                          ? 'bg-muted/50'
                          : 'hover:bg-muted/40'
                      }`}
                      onClick={() => setActiveMetricKey(row.key)}
                    >
                      <td className="py-3 text-foreground">{row.label}</td>
                      <td className="py-3 text-foreground font-semibold">{row.value}</td>
                      <td className="py-3">{row.icon}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="rounded-lg border border-border bg-muted/30 p-4">
              <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground mb-3">
                <div className="flex items-center gap-2">
                  <BarChart3 className="w-4 h-4 text-muted-foreground" />
                  <span>Metric trend</span>
                </div>
                <div className="flex items-center gap-2">
                  {(['7d', '30d', '90d', 'all'] as const).map((range) => (
                    <button
                      key={range}
                      onClick={() => setChartRange(range)}
                      className={`px-2.5 py-1 rounded-md border text-[11px] font-semibold transition-colors ${
                        chartRange === range
                          ? 'bg-primary text-primary-foreground border-primary'
                          : 'bg-muted/40 border-border text-muted-foreground hover:bg-muted/60'
                      }`}
                    >
                      {range.toUpperCase()}
                    </button>
                  ))}
                </div>
              </div>
              <div className="h-52">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={chartData}>
                    <defs>
                      <linearGradient id="metricFill" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#22d3ee" stopOpacity={0.35} />
                        <stop offset="95%" stopColor="#22d3ee" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <XAxis dataKey="label" stroke="#475569" fontSize={11} tickLine={false} axisLine={false} />
                    <YAxis
                      stroke="#475569"
                      fontSize={11}
                      tickLine={false}
                      axisLine={false}
                      tickFormatter={(value: number) => formatAxisValue(value)}
                    />
                    <Tooltip
                      contentStyle={{
                        background: '#0D0D0D',
                        border: '1px solid rgba(255,255,255,0.08)',
                        borderRadius: '8px',
                        fontSize: '12px',
                      }}
                      formatter={(value: number) => formatAxisValue(value)}
                    />
                    <Area
                      type="monotone"
                      dataKey="value"
                      stroke="#22d3ee"
                      strokeWidth={2}
                      fill="url(#metricFill)"
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-card border-border">
          <CardContent className="p-4 space-y-3">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <div className="text-sm font-semibold text-foreground">Requests by Status</div>
              <div className="text-xs text-muted-foreground">
                {metrics.total.toLocaleString()} total requests
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              {statusOptions.map((status) => {
                const count = metrics.statusCounts[status] || 0;
                return (
                  <span
                    key={status}
                    className="px-3 py-1 rounded-full border border-border bg-muted/40 text-xs text-muted-foreground"
                    onMouseEnter={() => {
                      requestsByStatus.get(status);
                    }}
                  >
                    {status.replace("_", " ")} · {count}
                  </span>
                );
              })}
            </div>
            <div className="overflow-x-auto">
              <table className="min-w-[420px] w-full text-sm">
                <thead className="text-muted-foreground uppercase text-[11px]">
                  <tr>
                    <th className="text-left py-2">Status</th>
                    <th className="text-left py-2">Count</th>
                    <th className="text-left py-2">Share</th>
                  </tr>
                </thead>
                <tbody>
                  {statusOptions.map((status) => {
                    const count = metrics.statusCounts[status] || 0;
                    const share = metrics.total ? Math.round((count / metrics.total) * 100) : 0;
                    return (
                      <tr key={status} className="border-t border-border/60">
                        <td className="py-3 text-foreground capitalize">
                          {status.replace("_", " ")}
                        </td>
                        <td className="py-3 text-foreground font-semibold">{count}</td>
                        <td className="py-3 text-muted-foreground">{share}%</td>
                      </tr>
                    );
                  })}
                  {metrics.total === 0 && (
                    <tr>
                      <td colSpan={3} className="py-4 text-muted-foreground">
                        No requests yet.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card className="bg-card border-border">
        <CardContent className="p-4 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <div className="text-sm font-semibold text-foreground">Recent Requests</div>
              <p className="text-xs text-muted-foreground">Browse the latest requests across the platform.</p>
            </div>
            <div className="flex flex-wrap gap-2">
              <input
                value={adminSearchQuery}
                onChange={(event) => setAdminSearchQuery(event.target.value)}
                placeholder="Search requests..."
                className="h-9 w-full sm:w-56 rounded-md bg-muted/40 border border-border text-xs text-foreground px-3"
              />
              <select
                value={adminStatusFilter}
                onChange={(event) => setAdminStatusFilter(event.target.value)}
                className="h-9 rounded-md bg-muted/40 border border-border text-xs text-foreground px-3"
              >
                <option value="all">All statuses</option>
                {statusOptions.map((status) => (
                  <option key={status} value={status}>
                    {status.replace('_', ' ')}
                  </option>
                ))}
              </select>
              <select
                value={adminUrgencyFilter}
                onChange={(event) => setAdminUrgencyFilter(event.target.value as any)}
                className="h-9 rounded-md bg-muted/40 border border-border text-xs text-foreground px-3"
              >
                <option value="all">All deadlines</option>
                <option value="urgent">Urgent &lt; 3 days</option>
                <option value="soon">Due &lt; 7 days</option>
                <option value="safe">Due 7+ days</option>
              </select>
            </div>
          </div>
          <div
            ref={requestListRef}
            onScroll={(event) => {
              if (!shouldVirtualizeRequests) return;
              setRequestListScrollTop(event.currentTarget.scrollTop);
            }}
            className={cn(
              "max-h-[420px] overflow-auto space-y-3 pr-1",
              shouldVirtualizeRequests && "space-y-0"
            )}
          >
            {requestsRefreshing && (
              <div className="sticky top-0 z-10">
                <Skeleton className="h-1 w-full rounded-none bg-muted/70" />
              </div>
            )}
            {requestVirtualWindow.paddingTop > 0 && (
              <div style={{ height: requestVirtualWindow.paddingTop }} />
            )}
            {requestVirtualWindow.items.map((entry, index) => {
              const request = entry.request;
              const diffDays = entry.diffDays;
              const deadlineBadge =
                diffDays === null
                  ? null
                  : diffDays <= 3
                  ? { label: `Due in ${diffDays}d`, className: 'text-red-300 bg-red-500/10 border-red-500/30' }
                  : diffDays <= 7
                  ? { label: `Due in ${diffDays}d`, className: 'text-amber-300 bg-amber-500/10 border-amber-500/30' }
                  : { label: `Due in ${diffDays}d`, className: 'text-emerald-300 bg-emerald-500/10 border-emerald-500/30' };
              const rowKey = shouldVirtualizeRequests
                ? `${request.id}-${requestVirtualWindow.startIndex + index}`
                : request.id;
              return (
                <div
                  key={rowKey}
                  className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border border-border/60 rounded-md p-3 bg-muted/30 cursor-pointer hover:bg-muted/50 transition-colors"
                  onMouseEnter={() => prefetchRequestDetail(request.id)}
                  onClick={() => openRequest(request.id)}
                >
                  <div className="text-sm text-foreground">
                    {request.contact_person_name || request.contact_person_email || 'Unknown requester'}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {request.campaign_type || 'Unknown type'} • {new Date(request.created_at).toLocaleDateString()}
                  </div>
                  <div className="flex items-center gap-2">
                    {deadlineBadge && (
                      <span className={`text-[11px] px-2 py-0.5 rounded-full border ${deadlineBadge.className}`}>
                        {deadlineBadge.label}
                      </span>
                    )}
                    <span className="text-xs text-muted-foreground capitalize">{request.status.replace('_', ' ')}</span>
                  </div>
                </div>
              );
            })}
            {requestVirtualWindow.paddingBottom > 0 && (
              <div style={{ height: requestVirtualWindow.paddingBottom }} />
            )}
            {displayRequests.length === 0 && (
              <div className="text-sm text-muted-foreground">No requests found.</div>
            )}
          </div>
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>
              Page {currentAdminPage} of {totalAdminPages}
            </span>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setAdminPage((prev) => Math.max(1, prev - 1))}
                className="px-2 py-1 rounded border border-border/70 hover:bg-muted/60"
                disabled={currentAdminPage === 1}
              >
                Prev
              </button>
              <button
                onClick={() => setAdminPage((prev) => Math.min(totalAdminPages, prev + 1))}
                className="px-2 py-1 rounded border border-border/70 hover:bg-muted/60"
                disabled={currentAdminPage === totalAdminPages}
              >
                Next
              </button>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className="bg-card border-border">
        <CardContent className="p-4 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <div className="text-sm font-semibold text-foreground">Admin Audit Log</div>
              <p className="text-xs text-muted-foreground">Security-sensitive actions across the company account.</p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button
                variant="outline"
                className="h-9 px-3 bg-muted/50 hover:bg-muted/70 border-border/70 text-muted-foreground"
                onClick={exportAuditCsv}
                disabled={auditLogs.length === 0}
              >
                Export CSV
              </Button>
              <Button
                variant="outline"
                className="h-9 px-3 bg-muted/50 hover:bg-muted/70 border-border/70 text-muted-foreground"
                onClick={() => setAuditLimit((prev) => Math.min(prev + 50, 500))}
                disabled={auditLoading || !auditHasMore}
              >
                Load more
              </Button>
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            <input
              value={auditActorFilter}
              onChange={(event) => {
                setAuditActorFilter(event.target.value);
                setAuditCursor(null);
              }}
              placeholder="Search actor / target..."
              className="h-9 w-full sm:w-56 rounded-md bg-muted/40 border border-border text-xs text-foreground px-3"
            />
            <select
              value={auditActionFilter}
              onChange={(event) => {
                setAuditActionFilter(event.target.value);
                setAuditCursor(null);
              }}
              className="h-9 rounded-md bg-muted/40 border border-border text-xs text-foreground px-3"
            >
              <option value="all">All actions</option>
              {auditActionOptions.map((action) => (
                <option key={action} value={action}>
                  {action.replace(/_/g, ' ')}
                </option>
              ))}
            </select>
            <select
              value={auditDateFilter}
              onChange={(event) => {
                setAuditDateFilter(event.target.value as any);
                setAuditCursor(null);
              }}
              className="h-9 rounded-md bg-muted/40 border border-border text-xs text-foreground px-3"
            >
              <option value="all">All time</option>
              <option value="24h">Last 24 hours</option>
              <option value="7d">Last 7 days</option>
              <option value="30d">Last 30 days</option>
            </select>
          </div>

          <div className="max-h-[420px] overflow-auto space-y-2 pr-1">
            {auditLoading && (
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                Loading audit logs...
              </div>
            )}
            {!auditLoading && auditLogs.length === 0 && (
              <div className="text-sm text-muted-foreground">No admin actions logged yet.</div>
            )}
            {auditLogs.map((log) => {
              const actorProfile = auditProfiles[log.actor_user_id];
              const targetProfile = log.target_user_id ? auditProfiles[log.target_user_id] : null;
              const actorLabel = actorProfile?.full_name || actorProfile?.email || log.actor_user_id.slice(0, 8);
              const targetLabel =
                targetProfile?.full_name ||
                targetProfile?.email ||
                (log.target_user_id ? log.target_user_id.slice(0, 8) : '—');
              return (
              <div
                key={log.id}
                className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border border-border/60 rounded-md p-3 bg-muted/30"
              >
                <div className="space-y-1">
                  <div className="text-sm text-foreground capitalize">
                    {log.action.replace(/_/g, ' ')}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    Actor: {actorLabel} • Target: {targetLabel}
                  </div>
                </div>
                <div className="text-xs text-muted-foreground">
                  {new Date(log.created_at).toLocaleString()}
                </div>
              </div>
            );
            })}
          </div>
        </CardContent>
      </Card>

      {selectedRequest && (
        <div className="fixed inset-0 z-[200] bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <Card className="bg-card border-border w-full max-w-2xl max-h-[90vh] overflow-hidden">
            <CardContent className="p-0">
              <div className="flex items-center justify-between px-6 py-4 border-b border-border">
                <div>
                  <div className="text-sm text-muted-foreground">Request Details</div>
                  <div className="text-lg font-semibold text-foreground">
                    {selectedRequest.contact_person_name || selectedRequest.contact_person_email || 'Unknown requester'}
                  </div>
                </div>
                <button
                  onClick={() => setSelectedRequest(null)}
                  className="w-9 h-9 rounded-lg hover:bg-muted/60 flex items-center justify-center"
                >
                  <X className="w-4 h-4 text-muted-foreground" />
                </button>
              </div>

              <div className="px-6 py-5 space-y-4 overflow-y-auto max-h-[70vh]">
                {detailLoading && (
                  <div className="text-sm text-muted-foreground flex items-center gap-2">
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Loading request...
                  </div>
                )}
                {detailError && (
                  <div className="text-sm text-red-400">{detailError}</div>
                )}

                {!detailLoading && (
                  <>
                    <div className="grid sm:grid-cols-2 gap-4 text-sm text-muted-foreground">
                      <div>
                        <div className="text-xs text-muted-foreground">Campaign Type</div>
                        <div>{selectedRequest.campaign_type || 'Unknown'}</div>
                      </div>
                      <div>
                        <div className="text-xs text-muted-foreground">Linked Campaign</div>
                        <div>{campaignName || 'Not linked'}</div>
                      </div>
                      <div>
                        <div className="text-xs text-muted-foreground">Requested</div>
                        <div>{new Date(selectedRequest.created_at).toLocaleString()}</div>
                      </div>
                      <div>
                        <div className="text-xs text-muted-foreground">Contact Email</div>
                        <div>{selectedRequest.contact_person_email || 'N/A'}</div>
                      </div>
                      <div>
                        <div className="text-xs text-muted-foreground">Contact Phone</div>
                        <div>{selectedRequest.contact_person_phone || 'N/A'}</div>
                      </div>
                      <div>
                        <div className="text-xs text-muted-foreground">Deadline</div>
                        <div>{selectedRequest.deadline ? new Date(selectedRequest.deadline).toLocaleDateString() : 'N/A'}</div>
                      </div>
                    </div>

                  <div>
                      <div className="text-xs text-muted-foreground mb-2">Campaign Brief</div>
                      <div className="text-sm text-muted-foreground whitespace-pre-wrap bg-muted/40 border border-border/60 rounded-md p-3">
                        {selectedRequest.campaign_brief || 'No brief provided.'}
                      </div>
                    </div>

                    <div>
                      <div className="text-xs text-muted-foreground mb-2">Requested Creators</div>
                      <div className="space-y-2">
                        {(selectedRequest.creator_request_items || []).map((item) => {
                          const creator = item.creators;
                          if (!creator) return null;
                          const creatorId = item.creator_id || creator.id;
                          const draft = quoteDrafts[creatorId] || {
                            amount: '',
                            currency: item.quoted_currency || 'USD',
                            notes: item.quote_notes || '',
                          };
                          return (
                            <div
                              key={creator.id}
                              className="border border-border/60 rounded-md p-3 bg-muted/30 space-y-3"
                            >
                              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                                <div>
                                  <div className="text-sm text-foreground">
                                    {creator.name || 'Unknown creator'}
                                  </div>
                                  <div className="text-xs text-muted-foreground">
                                    @{creator.handle || 'N/A'} • {creator.platform || 'N/A'}
                                  </div>
                                </div>
                                <div className="text-xs text-muted-foreground">
                                  {creator.follower_count ? creator.follower_count.toLocaleString() : '—'} followers
                                </div>
                                <span className="text-[11px] px-2 py-0.5 rounded-full border border-border/70 text-muted-foreground capitalize">
                                  {item.status || 'pending'}
                                </span>
                              </div>

                              <div className="grid grid-cols-1 sm:grid-cols-[160px_110px_1fr] gap-2">
                                <input
                                  type="number"
                                  min="0"
                                  step="0.01"
                                  placeholder="Quote amount"
                                  value={draft.amount}
                                  onChange={(event) => {
                                    const value = event.target.value;
                                    setQuoteDrafts((prev) => ({
                                      ...prev,
                                      [creatorId]: {
                                        ...draft,
                                        amount: value,
                                      },
                                    }));
                                  }}
                                  className="h-9 rounded-md bg-muted/50 border border-border/70 text-sm text-foreground px-3"
                                />
                                <select
                                  value={draft.currency}
                                  onChange={(event) => {
                                    setQuoteDrafts((prev) => ({
                                      ...prev,
                                      [creatorId]: {
                                        ...draft,
                                        currency: event.target.value,
                                      },
                                    }));
                                  }}
                                  className="h-9 rounded-md bg-muted/50 border border-border/70 text-sm text-foreground px-2"
                                >
                                  <option value="USD">USD</option>
                                  <option value="GBP">GBP</option>
                                  <option value="EUR">EUR</option>
                                  <option value="NGN">NGN</option>
                                </select>
                                <input
                                  type="text"
                                  placeholder="Quote notes (optional)"
                                  value={draft.notes}
                                  onChange={(event) => {
                                    setQuoteDrafts((prev) => ({
                                      ...prev,
                                      [creatorId]: {
                                        ...draft,
                                        notes: event.target.value,
                                      },
                                    }));
                                  }}
                                  className="h-9 rounded-md bg-muted/50 border border-border/70 text-sm text-foreground px-3"
                                />
                              </div>
                            </div>
                          );
                        })}
                        {(!selectedRequest.creator_request_items ||
                          selectedRequest.creator_request_items.length === 0) && (
                          <div className="text-sm text-muted-foreground">No creators selected.</div>
                        )}
                      </div>
                    </div>

                    <div className="space-y-3">
                      <div className="text-xs text-muted-foreground">Internal Status</div>
                      <div className="flex flex-wrap gap-2">
                        {statusOptions.map((status) => (
                          <button
                            key={status}
                            onClick={() => updateRequestStatus(status)}
                            disabled={statusUpdating}
                            className={`px-3 py-1 rounded-md text-xs border transition-colors ${
                              selectedRequest.status === status
                                ? 'bg-primary/10 text-primary border-primary/30'
                                : 'bg-muted/50 text-muted-foreground border-border hover:bg-muted/70'
                            }`}
                          >
                            {status.replace('_', ' ')}
                          </button>
                        ))}
                      </div>
                      <div className="flex items-center gap-2">
                        <Button
                          variant="outline"
                          onClick={sendQuotes}
                          disabled={quoteSubmitting}
                          className="h-9 px-3 bg-emerald-500/10 border-emerald-500/30 text-emerald-300 hover:bg-emerald-500/20"
                        >
                          {quoteSubmitting ? 'Sending...' : 'Send Quotes'}
                        </Button>
                        <span className="text-xs text-muted-foreground">
                          Sends per‑creator pricing to the requester.
                        </span>
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
