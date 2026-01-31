import React, { useState, useMemo, useEffect, useRef } from 'react';
import { Card, CardContent } from './ui/card';
import { Button } from './ui/button';
import {
  Download,
  TrendingUp,
  TrendingDown,
  Eye,
  Heart,
  Users,
  FileText,
  MessageCircle,
  Share2,
  MoreVertical,
  ArrowUpRight,
  Search,
  Filter,
  Calendar,
  ChevronDown
} from 'lucide-react';
import { NotificationsCenter } from './notifications-center';
import { StatusBadge } from './status-badge';
import { useCampaigns } from '../../hooks/useCampaigns';
import { useMediaQuery } from '../../hooks/useMediaQuery';
import { supabase } from '../../lib/supabase';
import { useWorkspace } from '../../contexts/WorkspaceContext';
import { useWorkspaceAccess } from '../../hooks/useWorkspaceAccess';
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationLink,
  PaginationPrevious,
  PaginationNext,
  PaginationEllipsis,
} from './ui/pagination';
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Legend,
} from 'recharts';
import { format } from 'date-fns';
import { subDays, startOfMonth } from 'date-fns';
import { cn } from './ui/utils';


type DateRange = {
  start: Date;
  end: Date;
  label: string;
};

const DATE_RANGE_STORAGE_KEY = 'dashboard_date_range';


interface DashboardProps {
  onNavigate: (path: string) => void;
}


const getDateRangePresets = (): DateRange[] => ([
  {
    label: 'Last 24 hours',
    start: subDays(new Date(), 1),
    end: new Date(),
  },
  {
    label: 'Last 48 hours',
    start: subDays(new Date(), 2),
    end: new Date(),
  },
  {
    label: 'Last 3 days',
    start: subDays(new Date(), 3),
    end: new Date(),
  },
  {
    label: 'Last 7 days',
    start: subDays(new Date(), 7),
    end: new Date(),
  },
  {
    label: 'Last 30 days',
    start: subDays(new Date(), 30),
    end: new Date(),
  },
  {
    label: 'This month',
    start: startOfMonth(new Date()),
    end: new Date(),
  },
]);


function formatDateRange(dateRange: { start: Date; end: Date }) {
  return `${format(dateRange.start, 'MMM d')} – ${format(dateRange.end, 'MMM d')}`;
}
function formatReach(value: number): string {
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M`;
  if (value >= 1_000) return `${(value / 1_000).toFixed(1)}K`;
  return value.toString();
}

function buildTimeSeriesFromMetricsHistory(
  history: any[],
  range: DateRange
): { date: string; reach: number; engagement: number }[] {
  if (!history.length) return [];

  const metricsByDate = new Map<string, any[]>();

  history.forEach((metric) => {
    const dateStr = metric.scraped_at ? metric.scraped_at.split('T')[0] : null;
    if (!dateStr) return;
    if (!metricsByDate.has(dateStr)) {
      metricsByDate.set(dateStr, []);
    }
    metricsByDate.get(dateStr)!.push(metric);
  });

  const sortedDates = Array.from(metricsByDate.keys()).sort();
  const currentPostMetrics = new Map<string, any>();
  const series = sortedDates.map((date) => {
    const dailyMetrics = metricsByDate.get(date) || [];
    dailyMetrics.forEach((m) => currentPostMetrics.set(m.post_id, m));

    let views = 0;
    let likes = 0;
    let comments = 0;
    let shares = 0;

    currentPostMetrics.forEach((m) => {
      views += Number(m.views || 0);
      likes += Number(m.likes || 0);
      comments += Number(m.comments || 0);
      shares += Number(m.shares || 0);
    });

    return {
      dateValue: date,
      reach: views,
      engagement: likes + comments + shares,
    };
  });

  return series
    .filter((point) => {
      const time = new Date(point.dateValue).getTime();
      return (
        time >= range.start.getTime() && time <= range.end.getTime()
      );
    })
    .map((point) => ({
      date: format(new Date(point.dateValue), 'MMM d'),
      reach: point.reach,
      engagement: point.engagement,
    }));
}

function getPostTimestamp(post: any): number | null {
  const date = post.posted_date || post.last_scraped_at || post.created_at || post.updated_at;
  if (!date) return null;
  const time = new Date(date).getTime();
  return Number.isNaN(time) ? null : time;
}

function isPostInRange(post: any, range: DateRange): boolean {
  const time = getPostTimestamp(post);
  if (time === null) return false;
  return time >= range.start.getTime() && time <= range.end.getTime();
}

function getPostDateKey(post: any): string | null {
  const time = getPostTimestamp(post);
  if (time === null) return null;
  return new Date(time).toISOString().split('T')[0];
}


export function Dashboard({ onNavigate }: DashboardProps) {
  const [dateRange, setDateRange] = useState<DateRange>(() => {
    const presets = getDateRangePresets();
    if (typeof window === 'undefined') return presets[3];
    const savedLabel = window.localStorage.getItem(DATE_RANGE_STORAGE_KEY);
    const matched = presets.find((preset) => preset.label === savedLabel);
    return matched || presets[3];
  }); // Last 7 days
  const [isDateDropdownOpen, setIsDateDropdownOpen] = useState(false);
  const [isFilterOpen, setIsFilterOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [campaignPage, setCampaignPage] = useState(1);
  const [filters, setFilters] = useState({
    status: [] as string[],
    budgetRange: [] as string[],
    performance: [] as string[],
  });
  const [timeSeriesData, setTimeSeriesData] = useState<{
    date: string;
    reach: number;
    engagement: number;
  }[]>([]);
  const [allPosts, setAllPosts] = useState<any[]>([]);
  const [metricsHistory, setMetricsHistory] = useState<any[]>([]);
  const isMobileCampaigns = useMediaQuery('(max-width: 1023px)');
  const { activeWorkspaceId } = useWorkspace();
  const {
    loading: accessLoading,
    canViewWorkspace,
    hasCampaignAccess,
    canViewCampaign,
  } = useWorkspaceAccess();
  const dateDropdownRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      window.localStorage.setItem(DATE_RANGE_STORAGE_KEY, dateRange.label);
    }

    if (!isDateDropdownOpen) {
      return;
    }

    const handlePointerDown = (event: MouseEvent | TouchEvent) => {
      const target = event.target as Node;
      if (dateDropdownRef.current && !dateDropdownRef.current.contains(target)) {
        setIsDateDropdownOpen(false);
      }
    };

    document.addEventListener('mousedown', handlePointerDown);
    document.addEventListener('touchstart', handlePointerDown);

    return () => {
      document.removeEventListener('mousedown', handlePointerDown);
      document.removeEventListener('touchstart', handlePointerDown);
    };
  }, [isDateDropdownOpen]);


  // Fetch real campaign data
  const { data: campaigns = [], isLoading: campaignsLoading } = useCampaigns();
  const isCampaignsLoading = campaignsLoading || (!!activeWorkspaceId && accessLoading);

  // Filter options
  const filterOptions = {
    status: ['active', 'completed', 'paused'],
    budgetRange: [
      { label: '$0 - $10K', min: 0, max: 10000 },
      { label: '$10K - $25K', min: 10000, max: 25000 },
      { label: '$25K - $50K', min: 25000, max: 50000 },
    ],
    performance: [
      { label: 'High (80%+)', min: 80, max: 100 },
      { label: 'Medium (60-79%)', min: 60, max: 79 },
      { label: 'Low (<60%)', min: 0, max: 59 },
    ],
  };

  const toggleFilter = (category: keyof typeof filters, value: string) => {
    setFilters(prev => ({
      ...prev,
      [category]: prev[category].includes(value)
        ? prev[category].filter(v => v !== value)
        : [...prev[category], value]
    }));
  };

  const clearFilters = () => {
    setFilters({
      status: [],
      budgetRange: [],
      performance: [],
    });
  };

  const activeFilterCount = filters.status.length + filters.budgetRange.length + filters.performance.length;
  

  // Calculate real KPI metrics from campaigns



  const accessibleCampaigns = useMemo(() => {
    if (!activeWorkspaceId) return campaigns;
    if (accessLoading) return [];
    if (canViewWorkspace) return campaigns;
    if (hasCampaignAccess) {
      return campaigns.filter((campaign) => canViewCampaign(campaign.id));
    }
    return [];
  }, [
    activeWorkspaceId,
    accessLoading,
    canViewWorkspace,
    hasCampaignAccess,
    canViewCampaign,
    campaigns,
  ]);

  // Apply filters and search to campaigns
  const filteredCampaigns = useMemo(() => {
    return accessibleCampaigns.filter(campaign => {
      // Search filter
      if (searchQuery && !campaign.name.toLowerCase().includes(searchQuery.toLowerCase())) {
        return false;
      }

    // Status filter
    if (filters.status.length > 0 && !filters.status.includes(campaign.status)) {
      return false;
    }

      // Budget range filter (if we had budget data)
      // For now, skip this as campaigns don't have budget in the schema

      // Performance filter (based on engagement rate)
    if (filters.performance.length > 0) {
        const engagementRate = campaign.avg_engagement_rate || 0;
      const matchesPerformance = filters.performance.some(perf => {
        const option = filterOptions.performance.find(o => o.label === perf);
          if (!option) return false;
          return engagementRate >= option.min && engagementRate <= option.max;
      });
      if (!matchesPerformance) return false;
    }

    return true;
  });
  }, [accessibleCampaigns, searchQuery, filters]);

  useEffect(() => {
    setCampaignPage(1);
  }, [searchQuery, filters]);

  const campaignsPerPage = isMobileCampaigns ? 12 : 15;
  const totalCampaignPages = Math.max(
    1,
    Math.ceil(filteredCampaigns.length / campaignsPerPage)
  );
  const safeCampaignPage = Math.min(campaignPage, totalCampaignPages);
  const campaignStartIndex = (safeCampaignPage - 1) * campaignsPerPage;
  const campaignEndIndex = Math.min(
    campaignStartIndex + campaignsPerPage,
    filteredCampaigns.length
  );

  useEffect(() => {
    if (campaignPage !== safeCampaignPage) {
      setCampaignPage(safeCampaignPage);
    }
  }, [campaignPage, safeCampaignPage]);

  const pagedCampaigns = useMemo(() => {
    return filteredCampaigns.slice(
      campaignStartIndex,
      campaignStartIndex + campaignsPerPage
    );
  }, [filteredCampaigns, campaignStartIndex, campaignsPerPage]);

  const paginationPages = useMemo(() => {
    if (totalCampaignPages <= 5) {
      return Array.from({ length: totalCampaignPages }, (_, i) => i + 1);
    }
    const pages = new Set<number>();
    pages.add(1);
    pages.add(totalCampaignPages);
    pages.add(safeCampaignPage);
    pages.add(safeCampaignPage - 1);
    pages.add(safeCampaignPage + 1);
    return Array.from(pages)
      .filter((page) => page >= 1 && page <= totalCampaignPages)
      .sort((a, b) => a - b);
  }, [safeCampaignPage, totalCampaignPages]);

  // Fetch all posts across all campaigns for platform breakdown
  const [postsLoading, setPostsLoading] = useState(true);

  interface KpiMetrics {
  totalReach: string;
  totalReachValue: number;
  engagementRate: string;
  engagementRateValue: number;
  activeCreators: number;
  totalPosts: number;
}

  const [kpiMetrics, setKpiMetrics] = useState<KpiMetrics>({
  totalReach: '0',
  totalReachValue: 0,
  engagementRate: '0.0',
  engagementRateValue: 0,
  activeCreators: 0,
  totalPosts: 0,
});
  
  const postsInRange = useMemo(() => {
  return allPosts.filter(post => isPostInRange(post, dateRange));
}, [allPosts, dateRange]);

  // Filter posts to only include those with valid dates (for consistent KPI and chart calculations)
  // This ensures that posts counted in the KPI are also included in the chart, and vice versa
  // The sum of all daily reach values in the chart should equal the total reach KPI
  const postsInRangeWithDates = useMemo(() => {
    return postsInRange.filter(post => {
      const dateStr = getPostDateKey(post);
      return dateStr !== null;
    });
  }, [postsInRange]);

 // Remove the useMemo for kpiMetrics entirely
// Instead, just use state that gets set by your useEffect
const campaignIds = useMemo(
  () => accessibleCampaigns.map(c => c.id).sort().join(','),
  [accessibleCampaigns]
);

useEffect(() => {
  const fetchAllPosts = async () => {
    if (campaigns.length === 0) {
      setAllPosts([]);
      setMetricsHistory([]);
      setPostsLoading(false);
      return;
    }

    try {
      setPostsLoading(true);
      const campaignIds = campaigns.map(c => c.id);
      const { data, error } = await supabase
        .from('posts')
        .select('campaign_id, platform, views, likes, comments, shares, creator_id, posted_date, last_scraped_at, created_at, updated_at')
        .in('campaign_id', campaignIds);

      if (error) {
        setAllPosts([]);
        setMetricsHistory([]);
        setKpiMetrics({
          totalReach: '0',
          totalReachValue: 0,
          engagementRate: '0.0',
          engagementRateValue: 0,
          activeCreators: 0,
          totalPosts: 0,
        });
      } else {
        setAllPosts(data || []);

        const { data: history, error: historyError } = await supabase
          .from('post_metrics')
          .select('post_id, views, likes, comments, shares, scraped_at, posts!inner(campaign_id)')
          .in('posts.campaign_id', campaignIds)
          .order('scraped_at', { ascending: true });

        if (historyError) {
          setMetricsHistory([]);
        } else {
          setMetricsHistory(history || []);
        }

      }
    } catch (err) {
      setAllPosts([]);
      setMetricsHistory([]);
    } finally {
      setPostsLoading(false);
    }
  };

  fetchAllPosts();
}, [campaignIds]);

useEffect(() => {
  if (!postsInRangeWithDates.length && timeSeriesData.length === 0) {
    setKpiMetrics({
      totalReach: '0',
      totalReachValue: 0,
      engagementRate: '0.0',
      engagementRateValue: 0,
      activeCreators: 0,
      totalPosts: 0,
    });
    return;
  }

  const reachFromPosts = postsInRangeWithDates.reduce((sum, p) => sum + Number(p.views || 0), 0);
  const reachFromHistory = timeSeriesData.length > 0 ? timeSeriesData[timeSeriesData.length - 1].reach : 0;
  const totalReachValue = reachFromPosts > 0 ? reachFromPosts : reachFromHistory;

  const totalEngagementValue = postsInRangeWithDates.reduce(
    (sum, p) => sum + Number(p.likes || 0) + Number(p.comments || 0) + Number(p.shares || 0),
    0
  );
  const engagementRateValue = totalReachValue > 0 ? (totalEngagementValue / totalReachValue) * 100 : 0;
  const activeCreators = new Set(postsInRangeWithDates.map(p => p.creator_id)).size;

  setKpiMetrics({
    totalReach: formatReach(totalReachValue),
    totalReachValue,
    engagementRate: engagementRateValue.toFixed(1),
    engagementRateValue,
    activeCreators,
    totalPosts: postsInRangeWithDates.length,
  });
}, [postsInRangeWithDates, timeSeriesData]);



  // Generate platform breakdown from real post data
  const platformData = useMemo(() => {
    const postsForBreakdown = postsInRangeWithDates;
    const platformCounts: Record<string, number> = {
      tiktok: 0,
      instagram: 0,
      youtube: 0,
    };

    // Count posts by platform
    postsForBreakdown.forEach(post => {
      const platform = post.platform?.toLowerCase();
      if (platform && platformCounts.hasOwnProperty(platform)) {
        platformCounts[platform]++;
      }
    });

    const totalPosts = postsForBreakdown.length;

    // Platform colors and display names
    const platformConfig = [
       { key: 'tiktok', name: 'TikTok', color: '#7a54a0' },
      { key: 'instagram', name: 'Instagram', color: '#E4405F' },
      { key: 'youtube', name: 'YouTube', color: '#FF0000' },
    ];

    // Calculate percentages and filter out platforms with 0 posts
    const result = platformConfig
      .map(platform => {
        const count = platformCounts[platform.key] || 0;
        const percentage = totalPosts > 0 ? (count / totalPosts) * 100 : 0;
        return {
          name: platform.name,
          value: Math.round(percentage * 10) / 10, // Round to 1 decimal
          count: count,
          color: platform.color,
        };
      })
      .filter(p => p.count > 0) // Only show platforms with posts
      .sort((a, b) => b.value - a.value); // Sort by percentage descending

    // Verify percentages sum to ~100% (within rounding tolerance)
    const totalPercentage = result.reduce((sum, p) => sum + p.value, 0);
    
    // Data consistency check for platform breakdown
    if (process.env.NODE_ENV === 'development' && totalPosts > 0) {
      const percentageValid = totalPercentage >= 99.5 && totalPercentage <= 100.5;
      // console.log('[Platform Breakdown Consistency]', {
      //   totalPosts,
      //   platformCounts,
      //   percentages: result.map(p => `${p.name}: ${p.count} posts (${p.value}%)`),
      //   totalPercentage: `${totalPercentage.toFixed(1)}%`,
      //   status: percentageValid ? '✓ Sums to 100%' : '⚠ Percentage mismatch',
      //   'KPI Total Posts': kpiMetrics.totalPosts,
      //   'Platform Posts Match': Math.abs(totalPosts - kpiMetrics.totalPosts) < 1 ? '✓ Aligned' : '⚠ Mismatch',
      // });
      
      if (!percentageValid) {
        console.warn('[Platform Breakdown Warning]', 'Percentages do not sum to 100%. This may indicate a calculation error.');
      }
      if (Math.abs(totalPosts - kpiMetrics.totalPosts) >= 1) {
        console.warn('[Platform Breakdown Warning]', 'Platform breakdown post count does not match KPI total posts.');
      }
    }

    return result.length > 0 ? result : [
      { name: 'TikTok', value: 0, count: 0, color: '#7a54a0' },
      { name: 'Instagram', value: 0, count: 0, color: '#E4405F' },
    ];
  }, [postsInRange, kpiMetrics.totalPosts]);

  // Time-series data derived from posts in the selected range
  const [timeSeriesLoading, setTimeSeriesLoading] = useState(true);

  useEffect(() => {
    if (postsLoading) {
      setTimeSeriesLoading(true);
      return;
    }

    if (metricsHistory.length > 0) {
      const series = buildTimeSeriesFromMetricsHistory(metricsHistory, dateRange);
      setTimeSeriesData(series);
      setTimeSeriesLoading(false);
      return;
    }

    if (postsInRangeWithDates.length === 0) {
      setTimeSeriesData([]);
      setTimeSeriesLoading(false);
      return;
    }

    const grouped: Record<string, { reach: number; engagement: number }> = {};

    // Use postsInRangeWithDates to ensure consistency with KPI calculations
    postsInRangeWithDates.forEach((post: any) => {
      const dateStr = getPostDateKey(post);
      // This should never be null since we filtered, but keep as safety check
      if (!dateStr) return;

      if (!grouped[dateStr]) {
        grouped[dateStr] = { reach: 0, engagement: 0 };
      }

      const views = Number(post.views || 0);
      const likes = Number(post.likes || 0);
      const comments = Number(post.comments || 0);
      const shares = Number(post.shares || 0);

      grouped[dateStr].reach += views;
      grouped[dateStr].engagement += likes + comments + shares;
    });

    const sorted = Object.entries(grouped)
      .map(([date, metrics]) => ({
        date,
        reach: metrics.reach,
        engagement: metrics.engagement,
      }))
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

    const formatted = sorted.map((point) => ({
      date: new Date(point.date).toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
      }),
      reach: point.reach,
      engagement: point.engagement,
    }));

    setTimeSeriesData(formatted);
    setTimeSeriesLoading(false);
  }, [
    metricsHistory,
    postsInRangeWithDates,
    postsLoading,
    dateRange.start,
    dateRange.end,
  ]);
  
  const handleExportCSV = () => {
      const rows: string[][] = [];

      // 1️⃣ Date range row
      rows.push([
        "Date Range",
        `${dateRange.start.toLocaleDateString()} – ${dateRange.end.toLocaleDateString()}`
      ]);

      // 2️⃣ KPI summary
      rows.push(["Metric", "Value"]);
      rows.push(["Total Reach", kpiMetrics.totalReach]);
      rows.push(["Total Posts", kpiMetrics.totalPosts.toString()]);
      rows.push(["Active Creators", kpiMetrics.activeCreators.toString()]);
      rows.push(["Engagement Rate", `${kpiMetrics.engagementRate}%`]);
      rows.push([]); // empty row for spacing

      // 3️⃣ Daily time series
      if (timeSeriesData.length > 0) {
        rows.push(["Date", "Reach", "Engagement"]);
        timeSeriesData.forEach(point => {
          rows.push([
            point.date,
            point.reach.toString(),
            point.engagement.toString()
          ]);
        });
        rows.push([]);
      }

      // 4️⃣ Platform split
      if (platformData.length > 0) {
        rows.push(["Platform", "Posts Count", "Percentage"]);
        platformData.forEach(platform => {
          rows.push([
            platform.name,
            platform.count.toString(),
            `${platform.value}%`
          ]);
        });
      }

      // 5️⃣ Combine all rows into CSV
      const csvContent = rows.map(r => r.join(",")).join("\n");

      // 6️⃣ Create Blob and trigger download
      const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");

      link.setAttribute("href", url);
      link.setAttribute(
        "download",
        `analytics_export_${new Date().toISOString().split("T")[0]}.csv`
      );
      link.style.visibility = "hidden";

      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    };


  // Generate performance chart data from aggregated time series
  const performanceData = useMemo(() => {
    if (timeSeriesData.length === 0) {
      return [
        { date: 'No data', reach: 0, engagement: 0 },
      ];
    }
    return timeSeriesData;
  }, [timeSeriesData]);

  // Verify chart data matches KPI (for debugging)
  const chartTotalReach = useMemo(() => {
    if (timeSeriesData.length === 0) return 0;
    return timeSeriesData[timeSeriesData.length - 1]?.reach || 0;
  }, [timeSeriesData]);

  // Log verification in development
  useEffect(() => {
    if (chartTotalReach > 0 && kpiMetrics.totalReachValue > 0) {
      if (chartTotalReach !== kpiMetrics.totalReachValue) {
        console.warn(
          '[Dashboard Data Mismatch]',
          `Chart total reach (${chartTotalReach}) does not match KPI total reach (${kpiMetrics.totalReachValue})`
        );
      } else {
        console.log(
          '[Dashboard Data Verified]',
          `Chart and KPI match: ${chartTotalReach} total reach`
        );
      }
      // Log chart data points for debugging
      console.log('[Performance Overview Chart Data]', {
        dataPoints: timeSeriesData.length,
        firstPoint: timeSeriesData[0],
        lastPoint: timeSeriesData[timeSeriesData.length - 1],
        sampleData: timeSeriesData.slice(0, 3),
        totalReach: chartTotalReach,
        kpiReach: kpiMetrics.totalReachValue
      });
    }
    if (process.env.NODE_ENV === 'development' && postsInRangeWithDates.length > 0) {
      const campaignBreakdown = postsInRangeWithDates.reduce(
        (acc: Record<string, { posts: number; reach: number }>, post: any) => {
          const campaignId = post.campaign_id || 'unknown';
          if (!acc[campaignId]) {
            acc[campaignId] = { posts: 0, reach: 0 };
          }
          acc[campaignId].posts += 1;
          acc[campaignId].reach += Number(post.views || 0);
          return acc;
        },
        {}
      );
      console.log('[Dashboard Campaign Reach Breakdown]', campaignBreakdown);
    }
  }, [chartTotalReach, kpiMetrics.totalReachValue, timeSeriesData, postsInRangeWithDates]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-semibold tracking-tight text-white">Dashboard</h1>
          <p className="text-sm text-slate-400 mt-1">Track your campaign performance</p>
        </div>
        
        <div className="flex flex-wrap items-center gap-3">
          <div className="hidden lg:block">
            <NotificationsCenter /> 
          </div>
          <div className="relative" ref={dateDropdownRef}>
            <button 
              onClick={() => setIsDateDropdownOpen(!isDateDropdownOpen)}
              className="h-11 sm:h-10 px-3 rounded-md bg-white/[0.03] hover:bg-white/[0.06] border border-white/[0.08] text-sm text-slate-300 flex items-center gap-2 transition-colors"
            >
              <Calendar className="w-4 h-4" />
              <span className="hidden sm:inline">{formatDateRange(dateRange)}</span>
              <span className="sm:hidden">{format(dateRange.start, 'MMM d')}</span>
              <ChevronDown className="w-4 h-4" />
            </button>
            
            {isDateDropdownOpen && (
              <div
                className={cn(
                  "fixed inset-x-4 top-1/2 -translate-y-1/2 mx-auto w-auto max-w-[280px] origin-top",
                  "md:absolute md:fixed-none md:inset-auto md:right-0 md:top-full md:mt-2 md:w-48 md:translate-y-0",
                  "bg-[#0D0D0D] border border-white/[0.08] rounded-lg shadow-xl z-[100] py-1 animate-in fade-in zoom-in-95 duration-200"
                )}
              >
                {getDateRangePresets().map((option) => (
                  <button
                    key={option.label}
                    onClick={() => {
                      const nextPreset = getDateRangePresets().find((preset) => preset.label === option.label);
                      setDateRange(nextPreset || option);
                      setIsDateDropdownOpen(false);
                    }}
                    className={`w-full text-left px-4 py-3 lg:py-2 text-sm transition-colors ${
                      dateRange.label === option.label
                        ? 'bg-primary/10 text-primary font-medium'
                        : 'text-slate-300 hover:bg-white/[0.06]'
                    }`}
                  >
                    {option.label}
                  </button>
                ))}
              </div>
            )}
          </div>
          <button
            onClick={handleExportCSV}
            className="h-11 min-h-[44px] min-w-[44px] px-2.5 sm:px-3 rounded-md bg-primary hover:bg-primary/90 text-black text-sm font-medium flex items-center justify-center gap-2 transition-colors"
            aria-label="Export analytics"
          >
            <Download className="w-4 h-4" />
            <span className="hidden sm:inline">Export</span>
          </button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 min-[480px]:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-4">
        <Card className="bg-[#0D0D0D] border-white/[0.08] hover:border-white/[0.12] transition-all duration-300 group">
          <CardContent className="p-3 sm:p-4">
            <div className="flex items-start justify-between mb-2">
              <div className="w-8 h-8 rounded-lg bg-[#0ea5e9]/10 flex items-center justify-center">
                <Eye className="w-4 h-4 text-[#0ea5e9]" />
              </div>
              <div className="flex items-center gap-1 text-xs text-slate-500">
                {/* <span className="font-medium">{formatDateRange(dateRange)}</span> */}
                <span className="font-medium">Total</span>
              </div>
            </div>
            <div className="text-2xl font-semibold text-white mb-1">
              {kpiMetrics.totalReach}
            </div>
            <p className="text-sm text-slate-400">Total Reach</p>
          </CardContent>
        </Card>

        <Card className="bg-[#0D0D0D] border-white/[0.08] hover:border-white/[0.12] transition-all duration-300 group">
          <CardContent className="p-3 sm:p-4">
            <div className="flex items-start justify-between mb-2">
              <div className="w-8 h-8 rounded-lg bg-purple-500/10 flex items-center justify-center group-hover:bg-purple-500/20 transition-colors">
                <Heart className="w-4 h-4 text-purple-400" />
              </div>
              <div className="flex items-center gap-1 text-xs text-slate-500">
                <span className="font-medium">Average</span>
              </div>
            </div>
            <div className="text-2xl font-semibold text-white mb-1">
              {kpiMetrics.engagementRate}%
            </div>
            <p className="text-sm text-slate-400">Engagement Rate</p>
          </CardContent>
        </Card>

        <Card className="bg-[#0D0D0D] border-white/[0.08] hover:border-white/[0.12] transition-all duration-300 group">
          <CardContent className="p-3 sm:p-4">
            <div className="flex items-start justify-between mb-2">
              <div className="w-8 h-8 rounded-lg bg-cyan-500/10 flex items-center justify-center group-hover:bg-cyan-500/20 transition-colors">
                <Users className="w-4 h-4 text-cyan-400" />
              </div>
              <div className="flex items-center gap-1 text-xs text-slate-500">
                <span className="font-medium">Total</span>
              </div>
            </div>
            <div className="text-2xl font-semibold text-white mb-1">
              {kpiMetrics.activeCreators}
            </div>
            <p className="text-sm text-slate-400">Active Creators</p>
          </CardContent>
        </Card>

        <Card className="bg-[#0D0D0D] border-white/[0.08] hover:border-white/[0.12] transition-all duration-300 group">
          <CardContent className="p-3 sm:p-4">
            <div className="flex items-start justify-between mb-2">
              <div className="w-8 h-8 rounded-lg bg-amber-500/10 flex items-center justify-center group-hover:bg-amber-500/20 transition-colors">
                <FileText className="w-4 h-4 text-amber-400" />
              </div>
              <div className="flex items-center gap-1 text-xs text-slate-500">
                <span className="font-medium">All campaigns</span>
              </div>
            </div>
            <div className="text-2xl font-semibold text-white mb-1">
              {kpiMetrics.totalPosts}
            </div>
            <p className="text-sm text-slate-400">Total Posts</p>
          </CardContent>
        </Card>
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 animate-in fade-in duration-700">
        {/* Performance Chart */}
        <Card className="lg:col-span-2 bg-[#0D0D0D] border-white/[0.08] hover:border-white/[0.12] transition-all duration-300">
          <CardContent className="p-4 sm:p-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-6 gap-3">
              <div>
                <h3 className="text-base font-semibold text-white">Performance Overview</h3>
                <p className="text-sm text-slate-400 mt-0.5">Reach and engagement trends</p>
              </div>
              <div className="flex gap-4 text-sm">
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-[#0ea5e9]"></div>
                  <span className="text-slate-400">Reach</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-purple-400"></div>
                  <span className="text-slate-400">Engagement</span>
                </div>
              </div>
            </div>
            {timeSeriesLoading ? (
              <div className="h-[280px] flex items-center justify-center">
                <div className="text-slate-400 text-sm">Loading chart data...</div>
              </div>
            ) : performanceData.length === 0 || (performanceData.length === 1 && performanceData[0].date === 'No data') ? (
              <div className="h-[280px] flex items-center justify-center">
                <div className="text-center">
                  <div className="text-slate-400 text-sm mb-1">No performance data available</div>
                  <div className="text-slate-500 text-xs">Data will appear as posts are scraped</div>
                </div>
              </div>
            ) : (
              <ResponsiveContainer width="100%" height={280}>
                <LineChart data={performanceData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#ffffff08" vertical={false} />
                  <XAxis 
                    dataKey="date" 
                    stroke="#64748b"
                    fontSize={12}
                    tickLine={false}
                    axisLine={{ stroke: '#ffffff08' }}
                  />
                  <YAxis 
                    stroke="#64748b"
                    fontSize={12}
                    tickLine={false}
                    axisLine={false}
                    tickFormatter={(value) => {
                      if (value >= 1000000) return `${(value / 1000000).toFixed(1)}M`;
                      if (value >= 1000) return `${(value / 1000).toFixed(0)}K`;
                      return value.toString();
                    }}
                  />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: '#18181B',
                      border: '1px solid rgba(255,255,255,0.08)',
                      borderRadius: '8px',
                      fontSize: '12px',
                    }}
                    formatter={(value: any) => {
                      if (typeof value === 'number') {
                        return value.toLocaleString();
                      }
                      return value;
                    }}
                  />
                  <Line
                    type="monotone"
                    dataKey="reach"
                    stroke="#0ea5e9"
                    strokeWidth={2.5}
                    dot={false}
                    animationDuration={750}
                  />
                  <Line
                    type="monotone"
                    dataKey="engagement"
                    stroke="#a855f7"
                    strokeWidth={2.5}
                    dot={false}
                    animationDuration={750}
                  />
                </LineChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        {/* Platform Breakdown */}
        <Card className="bg-[#0D0D0D] border-white/[0.08] hover:border-white/[0.12] transition-all duration-300">
          <CardContent className="p-4 sm:p-6">
            <h3 className="text-base font-semibold text-white mb-1">Platform Split</h3>
            <p className="text-sm text-slate-400 mb-6">Content distribution</p>
            
            {postsLoading ? (
              <div className="space-y-3">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="animate-pulse">
                    <div className="flex items-center justify-between mb-1.5">
                      <div className="h-4 w-20 bg-white/[0.06] rounded" />
                      <div className="h-4 w-12 bg-white/[0.06] rounded" />
                    </div>
                    <div className="h-1.5 bg-white/[0.06] rounded-full" />
                  </div>
                ))}
              </div>
            ) : platformData.length === 0 ? (
              <div className="text-center py-8 text-slate-400 text-sm">No platform data available</div>
            ) : (
              <div className="space-y-3">
                {platformData.map((platform) => (
                  <div key={platform.name} className="group">
                    <div className="flex items-center justify-between mb-1.5">
                      <div className="flex items-center gap-2">
                        <div 
                          className="w-2 h-2 rounded-full transition-all group-hover:scale-125"
                          style={{ backgroundColor: platform.color }}
                        />
                        <span className="text-sm text-slate-300 font-medium">{platform.name}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-slate-500">({platform.count})</span>
                        <span className="text-sm font-semibold text-white">{platform.value}%</span>
                      </div>
                    </div>
                    <div className="h-1.5 bg-white/[0.06] rounded-full overflow-hidden">
                      <div 
                        className="h-full rounded-full transition-all duration-500 ease-out"
                        style={{ 
                          width: `${platform.value}%`,
                          backgroundColor: platform.color,
                        }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Campaigns Table */}
      <Card className="bg-[#0D0D0D] border-white/[0.08] animate-in fade-in duration-500">
        <CardContent className="p-0">
          <div className="p-4 sm:p-6 border-b border-white/[0.08]">
          <div>
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h3 className="text-base font-semibold text-white">Active Campaigns</h3>
              <p className="text-sm text-slate-400 mt-0.5">
                Manage and monitor your campaigns
              </p>
            </div>

            <div className="flex flex-col sm:flex-row sm:items-center gap-2 w-full sm:w-auto">
              {/* Filters Button */}
              <button
                onClick={() => setIsFilterOpen(!isFilterOpen)}
                className="h-11 sm:h-10 px-3 rounded-md bg-white/[0.03] hover:bg-white/[0.06] border border-white/[0.08] text-sm text-slate-300 flex flex-wrap items-center gap-2 transition-colors w-fit"
              >
                <Filter className="w-4 h-4" />
                <span className="hidden sm:inline">Filters</span>
                {activeFilterCount > 0 && (
                  <span className="w-5 h-5 rounded-full bg-[#0ea5e9] text-white text-xs flex items-center justify-center font-medium">
                    {activeFilterCount}
                  </span>
                )}
              </button>

              {/* Search Input */}
              <div className="relative w-full sm:w-64">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                <input
                  type="search"
                  placeholder="Search campaigns..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="h-11 sm:h-10 pl-9 pr-3 bg-white/[0.03] border border-white/[0.08] rounded-md text-base text-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-primary/50 w-full"
                />
              </div>
            </div>
          </div>

          </div>
            
          </div>

          <div className="lg:hidden px-4 sm:px-6 pb-4 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
            {isCampaignsLoading ? (
              <div className="text-sm text-slate-400 col-span-full">Loading campaigns...</div>
            ) : filteredCampaigns.length === 0 ? (
              <div className="text-sm text-slate-400 col-span-full">No campaigns found</div>
            ) : (
              pagedCampaigns.map((campaign) => {
                const formattedViews =
                  campaign.total_views >= 1000000
                    ? `${(campaign.total_views / 1000000).toFixed(1)}M`
                    : campaign.total_views >= 1000
                    ? `${(campaign.total_views / 1000).toFixed(1)}K`
                    : campaign.total_views.toString();
                return (
                  <Card
                    key={campaign.id}
                    className="bg-[#0D0D0D] border-white/[0.08] hover:border-white/[0.12] transition-all cursor-pointer"
                    onClick={() => onNavigate(`/campaigns/${campaign.id}`)}
                  >
                    <CardContent className="p-3 space-y-2">
                      {campaign.cover_image_url ? (
                        <div className="h-24 sm:h-28 rounded-md overflow-hidden border border-white/[0.06] bg-white/[0.02]">
                          <img
                            src={campaign.cover_image_url}
                            alt={`${campaign.name} cover`}
                            className="h-full w-full object-cover"
                            loading="lazy"
                          />
                        </div>
                      ) : (
                        <div className="h-24 sm:h-28 rounded-md border border-white/[0.06] bg-white/[0.02]" />
                      )}
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <p className="text-sm sm:text-base font-semibold text-white truncate">
                            {campaign.name}
                          </p>
                          <p className="text-xs text-slate-400 mt-1 truncate">
                            {campaign.brand_name || 'Active campaign'}
                          </p>
                        </div>
                        <StatusBadge status={campaign.status} />
                      </div>
                      <div className="grid grid-cols-3 gap-0.5">
                        <div className="min-w-0">
                          <p className="text-[9px] text-slate-500 truncate">
                            Posts
                          </p>
                          <p className="text-sm text-white mt-1">
                            {campaign.posts_count || 0}
                          </p>
                        </div>
                        <div className="min-w-0">
                          <p className="text-[9px] text-slate-500 truncate">
                            Reach
                          </p>
                          <p className="text-sm text-white mt-1">
                            {formattedViews}
                          </p>
                        </div>
                        <div className="min-w-0">
                          <p className="text-[9px] text-slate-500 truncate">
                            Engagement
                          </p>
                          <p className="text-sm text-emerald-400 mt-1">
                            {campaign.avg_engagement_rate?.toFixed(1) || "0.0"}%
                          </p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                );
              })
            )}
          </div>

          {filteredCampaigns.length > 0 && !isCampaignsLoading && (
            <div className="lg:hidden px-4 sm:px-6 pb-6 space-y-3">
              <p className="text-xs text-slate-400">
                Showing {campaignStartIndex + 1} to {campaignEndIndex} of{" "}
                {filteredCampaigns.length} campaigns
              </p>
              {totalCampaignPages > 1 && (
                <Pagination>
                  <PaginationContent>
                    <PaginationItem>
                      <PaginationPrevious
                        href="#"
                        onClick={(event) => {
                          event.preventDefault();
                          if (safeCampaignPage === 1) return;
                          setCampaignPage((prev) => Math.max(1, prev - 1));
                        }}
                        className="min-h-[44px] bg-white/[0.03] border border-white/[0.08] text-slate-300"
                        aria-disabled={safeCampaignPage === 1}
                      />
                    </PaginationItem>
                    {paginationPages.map((page, index) => {
                      const prevPage = paginationPages[index - 1];
                      const showEllipsis = prevPage && page - prevPage > 1;
                      return (
                        <React.Fragment key={page}>
                          {showEllipsis && (
                            <PaginationItem>
                              <PaginationEllipsis className="text-slate-500" />
                            </PaginationItem>
                          )}
                          <PaginationItem>
                            <PaginationLink
                              href="#"
                              isActive={page === safeCampaignPage}
                              onClick={(event) => {
                                event.preventDefault();
                                setCampaignPage(page);
                              }}
                              className={cn(
                                "min-h-[44px]",
                                page === safeCampaignPage
                                  ? "bg-primary text-black"
                                  : "bg-white/[0.03] border border-white/[0.08] text-slate-300 hover:bg-white/[0.06]"
                              )}
                            >
                              {page}
                            </PaginationLink>
                          </PaginationItem>
                        </React.Fragment>
                      );
                    })}
                    <PaginationItem>
                      <PaginationNext
                        href="#"
                        onClick={(event) => {
                          event.preventDefault();
                          if (safeCampaignPage === totalCampaignPages) return;
                          setCampaignPage((prev) =>
                            Math.min(totalCampaignPages, prev + 1)
                          );
                        }}
                        className="min-h-[44px] bg-white/[0.03] border border-white/[0.08] text-slate-300"
                        aria-disabled={safeCampaignPage === totalCampaignPages}
                      />
                    </PaginationItem>
                  </PaginationContent>
                </Pagination>
              )}
            </div>
          )}

          <div className="hidden lg:block overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-white/[0.08]">
                  <th className="text-left text-xs font-medium text-slate-400 px-4 sm:px-6 py-3">Campaign</th>
                  <th className="text-left text-xs font-medium text-slate-400 px-4 sm:px-6 py-3 hidden sm:table-cell">Status</th>
                  <th className="text-left text-xs font-medium text-slate-400 px-4 sm:px-6 py-3 hidden md:table-cell">Posts</th>
                  <th className="text-left text-xs font-medium text-slate-400 px-4 sm:px-6 py-3">Reach</th>
                  <th className="text-left text-xs font-medium text-slate-400 px-4 sm:px-6 py-3 hidden lg:table-cell">Engagement</th>
                  <th className="text-left text-xs font-medium text-slate-400 px-4 sm:px-6 py-3 hidden lg:table-cell">Performance</th>
                  <th className="text-right text-xs font-medium text-slate-400 px-4 sm:px-6 py-3"></th>
                </tr>
              </thead>
              <tbody>
                {isCampaignsLoading ? (
                  <tr>
                    <td colSpan={9} className="px-6 py-8 text-center text-slate-400">
                      Loading campaigns...
                    </td>
                  </tr>
                ) : filteredCampaigns.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="px-6 py-8 text-center text-slate-400">
                      No campaigns found
                    </td>
                  </tr>
                ) : (
                  pagedCampaigns.map((campaign) => {
                    // Format views
                    const formattedViews = campaign.total_views >= 1000000
                      ? `${(campaign.total_views / 1000000).toFixed(1)}M`
                      : campaign.total_views >= 1000
                      ? `${(campaign.total_views / 1000).toFixed(1)}K`
                      : campaign.total_views.toString();

                    // Calculate performance based on engagement rate (0-100 scale)
                    const performance = Math.min(100, Math.max(0, (campaign.avg_engagement_rate || 0) * 10));

                    return (
                  <tr 
                    key={campaign.id}
                        onClick={() => onNavigate(`/campaigns/${campaign.id}`)}
                        className="border-b border-white/[0.04] hover:bg-white/[0.02] transition-colors group cursor-pointer"
                  >
                    <td className="px-4 sm:px-6 py-4">
                      <div className="font-medium text-sm text-white">{campaign.name}</div>
                      <div className="text-xs text-slate-400 mt-1 sm:hidden">
                        <StatusBadge status={campaign.status} />
                      </div>
                    </td>
                    <td className="px-4 sm:px-6 py-4 hidden sm:table-cell">
                      <StatusBadge status={campaign.status} />
                    </td>
                    <td className="px-4 sm:px-6 py-4 hidden md:table-cell">
                          <div className="text-sm text-slate-300">{campaign.posts_count || 0}</div>
                    </td>
                    <td className="px-4 sm:px-6 py-4">
                          <div className="text-sm text-slate-300">{formattedViews}</div>
                    </td>
                    <td className="px-4 sm:px-6 py-4 hidden lg:table-cell">
                          <div className="text-sm text-emerald-400 font-medium">
                            {campaign.avg_engagement_rate?.toFixed(1) || '0.0'}%
                          </div>
                    </td>
                    <td className="px-4 sm:px-6 py-4 hidden lg:table-cell">
                      <div className="flex items-center gap-2">
                        <div className="flex-1 h-1.5 bg-white/[0.06] rounded-full overflow-hidden max-w-[80px]">
                          <div 
                            className="h-full bg-primary rounded-full"
                                style={{ width: `${performance}%` }}
                          />
                        </div>
                            <span className="text-xs text-slate-400 font-medium min-w-[32px]">{performance.toFixed(0)}%</span>
                      </div>
                    </td>
                  </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
          {filteredCampaigns.length > 0 && !isCampaignsLoading && (
            <div className="hidden lg:flex items-center justify-between px-6 py-4 border-t border-white/[0.08]">
              <p className="text-sm text-slate-400">
                Showing {campaignStartIndex + 1} to {campaignEndIndex} of{" "}
                {filteredCampaigns.length} campaigns
              </p>
              {totalCampaignPages > 1 && (
                <Pagination className="mx-0">
                  <PaginationContent>
                    <PaginationItem>
                      <PaginationPrevious
                        href="#"
                        onClick={(event) => {
                          event.preventDefault();
                          if (safeCampaignPage === 1) return;
                          setCampaignPage((prev) => Math.max(1, prev - 1));
                        }}
                        className="bg-white/[0.03] border border-white/[0.08] text-slate-300"
                        aria-disabled={safeCampaignPage === 1}
                      />
                    </PaginationItem>
                    {paginationPages.map((page, index) => {
                      const prevPage = paginationPages[index - 1];
                      const showEllipsis = prevPage && page - prevPage > 1;
                      return (
                        <React.Fragment key={page}>
                          {showEllipsis && (
                            <PaginationItem>
                              <PaginationEllipsis className="text-slate-500" />
                            </PaginationItem>
                          )}
                          <PaginationItem>
                            <PaginationLink
                              href="#"
                              isActive={page === safeCampaignPage}
                              onClick={(event) => {
                                event.preventDefault();
                                setCampaignPage(page);
                              }}
                              className={cn(
                                page === safeCampaignPage
                                  ? "bg-primary text-black"
                                  : "bg-white/[0.03] border border-white/[0.08] text-slate-300 hover:bg-white/[0.06]"
                              )}
                            >
                              {page}
                            </PaginationLink>
                          </PaginationItem>
                        </React.Fragment>
                      );
                    })}
                    <PaginationItem>
                      <PaginationNext
                        href="#"
                        onClick={(event) => {
                          event.preventDefault();
                          if (safeCampaignPage === totalCampaignPages) return;
                          setCampaignPage((prev) =>
                            Math.min(totalCampaignPages, prev + 1)
                          );
                        }}
                        className="bg-white/[0.03] border border-white/[0.08] text-slate-300"
                        aria-disabled={safeCampaignPage === totalCampaignPages}
                      />
                    </PaginationItem>
                  </PaginationContent>
                </Pagination>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Filter Modal */}
      {isFilterOpen && (
        <div className="fixed inset-0 bg-black/[0.5] z-50 p-4 flex items-end sm:items-center justify-center">
          <div className="w-full max-w-md bg-[#0D0D0D] border border-white/[0.08] rounded-t-2xl sm:rounded-lg shadow-xl max-h-[90dvh] overflow-y-auto">
            <div className="p-6">
              <h3 className="text-base font-semibold text-white mb-4">Filters</h3>

              {/* Status Filter */}
              <div className="mb-4">
                <h4 className="text-sm font-medium text-slate-400 mb-2">Status</h4>
                <div className="space-y-2">
                  {filterOptions.status.map(status => (
                    <div key={status} className="flex items-center">
                      <input
                        type="checkbox"
                        checked={filters.status.includes(status)}
                        onChange={() => toggleFilter('status', status)}
                        className="h-4 w-4 text-primary bg-white/[0.03] border border-white/[0.08] rounded focus:ring-primary/50"
                      />
                      <label className="ml-2 text-sm text-slate-300">{status}</label>
                    </div>
                  ))}
                </div>
              </div>

              {/* Budget Range Filter */}
              <div className="mb-4">
                <h4 className="text-sm font-medium text-slate-400 mb-2">Budget Range</h4>
                <div className="space-y-2">
                  {filterOptions.budgetRange.map(range => (
                    <div key={range.label} className="flex items-center">
                      <input
                        type="checkbox"
                        checked={filters.budgetRange.includes(range.label)}
                        onChange={() => toggleFilter('budgetRange', range.label)}
                        className="h-4 w-4 text-primary bg-white/[0.03] border border-white/[0.08] rounded focus:ring-primary/50"
                      />
                      <label className="ml-2 text-sm text-slate-300">{range.label}</label>
                    </div>
                  ))}
                </div>
              </div>

              {/* Performance Filter */}
              <div className="mb-4">
                <h4 className="text-sm font-medium text-slate-400 mb-2">Performance</h4>
                <div className="space-y-2">
                  {filterOptions.performance.map(perf => (
                    <div key={perf.label} className="flex items-center">
                      <input
                        type="checkbox"
                        checked={filters.performance.includes(perf.label)}
                        onChange={() => toggleFilter('performance', perf.label)}
                        className="h-4 w-4 text-primary bg-white/[0.03] border border-white/[0.08] rounded focus:ring-primary/50"
                      />
                      <label className="ml-2 text-sm text-slate-300">{perf.label}</label>
                    </div>
                  ))}
                </div>
              </div>

              {/* Actions */}
              <div className="flex justify-between">
                <button
                  onClick={clearFilters}
                  className="text-sm text-slate-400 hover:text-slate-300"
                >
                  Clear Filters
                </button>
                <div className="flex gap-2">
                  <button
                    onClick={() => setIsFilterOpen(false)}
                    className="h-9 px-3 rounded-md bg-white/[0.03] hover:bg-white/[0.06] border border-white/[0.08] text-sm text-slate-300 transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={() => setIsFilterOpen(false)}
                    className="h-9 px-3 rounded-md bg-primary hover:bg-primary/90 text-black text-sm font-medium flex items-center gap-2 transition-colors"
                  >
                    Apply
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
