import React, { useState, useMemo, useEffect } from 'react';
import { Card, CardContent } from './ui/card';
import { Button } from './ui/button';
import {
  Calendar,
  Download,
  ChevronDown,
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
  Filter
} from 'lucide-react';
import { NotificationsCenter } from './notifications-center';
import { PlatformBadge } from './platform-badge';
import { StatusBadge } from './status-badge';
import { useCampaigns } from '../../hooks/useCampaigns';
import { usePosts } from '../../hooks/usePosts';
import { useCreators } from '../../hooks/useCreators';
import { supabase } from '../../lib/supabase';
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


interface DashboardProps {
  onNavigate: (path: string) => void;
}


export const DATE_RANGE_PRESETS: DateRange[] = [
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
];


function formatDateRange(dateRange: { start: Date; end: Date }) {
  return `${format(dateRange.start, 'MMM d')} – ${format(dateRange.end, 'MMM d')}`;
}
function formatReach(value: number): string {
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M`;
  if (value >= 1_000) return `${(value / 1_000).toFixed(1)}K`;
  return value.toString();
}


export function Dashboard({ onNavigate }: DashboardProps) {
  const [dateRange, setDateRange] = useState<DateRange>(DATE_RANGE_PRESETS[3]); // Last 7 days
  const [isDateDropdownOpen, setIsDateDropdownOpen] = useState(false);
  const [isFilterOpen, setIsFilterOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
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


  // Fetch real campaign data
  const { data: campaigns = [], isLoading: campaignsLoading } = useCampaigns();
  const { data: allCreators = [] } = useCreators();
  

  const dateRangeOptions = [
    'Last 24 hours',
    'Last 48 hours',
    'Last 3 days',
    'Last 7 days',
    'Last 30 days',
  ];

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



  // Apply filters and search to campaigns
  const filteredCampaigns = useMemo(() => {
    return campaigns.filter(campaign => {
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
  }, [campaigns, dateRange,searchQuery, filters]);

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
  return allPosts.filter(post => {
    const date = post.last_scraped_at || post.created_at || post.updated_at;
    if (!date) return false;
    const postTime = new Date(date).getTime();
    return postTime >= dateRange.start.getTime() && postTime <= dateRange.end.getTime();
  });
}, [allPosts, dateRange]);

 // Remove the useMemo for kpiMetrics entirely
// Instead, just use state that gets set by your useEffect
const campaignIds = useMemo(
  () => campaigns.map(c => c.id).sort().join(','),
  [campaigns]
);

useEffect(() => {
  const fetchAllPosts = async (dateRange: DateRange) => {
    if (campaigns.length === 0) {
      setAllPosts([]);
      setKpiMetrics({
        totalReach: '0',
        totalReachValue: 0,
        engagementRate: '0.0',
        engagementRateValue: 0,
        activeCreators: 0,
        totalPosts: 0,
      });
      setPostsLoading(false);
      return;
    }

    try {
      setPostsLoading(true);
      const campaignIds = campaigns.map(c => c.id);
      const { data, error } = await supabase
        .from('posts')
        .select('platform, views, likes, comments, shares, creator_id, last_scraped_at, created_at, updated_at')
        .in('campaign_id', campaignIds)
        .gte('last_scraped_at', dateRange.start.toISOString())
        .lte('last_scraped_at', dateRange.end.toISOString());

      if (error) {
        setAllPosts([]);
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

        const postsInRange = (data || []).filter(post => {
          const date = post.last_scraped_at || post.created_at || post.updated_at;
          if (!date) return false;
          const postTime = new Date(date).getTime();
          return postTime >= dateRange.start.getTime() && postTime <= dateRange.end.getTime();
        });

        const totalReachValue = postsInRange.reduce((sum, p) => sum + Number(p.views || 0), 0);
        const totalEngagementValue = postsInRange.reduce((sum, p) =>
          sum + Number(p.likes || 0) + Number(p.comments || 0) + Number(p.shares || 0), 0
        );
        const engagementRateValue = totalReachValue > 0 ? (totalEngagementValue / totalReachValue) * 100 : 0;
        const activeCreators = new Set(postsInRange.map(p => p.creator_id)).size;

        setKpiMetrics({
          totalReach: formatReach(totalReachValue),
          totalReachValue,
          engagementRate: engagementRateValue.toFixed(1),
          engagementRateValue,
          activeCreators,
          totalPosts: postsInRange.length,
        });
      }
    } catch (err) {
      setAllPosts([]);
      setKpiMetrics({
        totalReach: '0',
        totalReachValue: 0,
        engagementRate: '0.0',
        engagementRateValue: 0,
        activeCreators: 0,
        totalPosts: 0,
      });
    } finally {
      setPostsLoading(false);
    }
  };

  fetchAllPosts(dateRange);
}, [campaignIds, dateRange.start, dateRange.end]);



  // Generate platform breakdown from real post data
  const platformData = useMemo(() => {
    const platformCounts: Record<string, number> = {
      tiktok: 0,
      instagram: 0,
      youtube: 0,
      twitter: 0,
      facebook: 0,
    };

    // Count posts by platform
    allPosts.forEach(post => {
      const platform = post.platform?.toLowerCase();
      if (platform && platformCounts.hasOwnProperty(platform)) {
        platformCounts[platform]++;
      }
    });

    const totalPosts = allPosts.length;

    // Platform colors and display names
    const platformConfig = [
      { key: 'tiktok', name: 'TikTok', color: '#7a54a0' },
      { key: 'instagram', name: 'Instagram', color: '#E4405F' },
      { key: 'youtube', name: 'YouTube', color: '#FF0000' },
      { key: 'twitter', name: 'Twitter', color: '#1DA1F2' },
      { key: 'facebook', name: 'Facebook', color: '#1877F2' },
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
  }, [allPosts]);

  // Fetch time-series data for all campaigns
  
  const [timeSeriesLoading, setTimeSeriesLoading] = useState(true);
  

  useEffect(() => {
  const fetchAllTimeSeries = async () => {
    if (campaigns.length === 0) {
      setTimeSeriesData([]);
      setTimeSeriesLoading(false);
      return;
    }

    try {
      setTimeSeriesLoading(true);
      const campaignIds = campaigns.map(c => c.id);
      
      const { data, error } = await supabase
        .from('posts')
        .select('views, likes, comments, shares, last_scraped_at, created_at, updated_at, campaign_id')
        .in('campaign_id', campaignIds)
        .in('platform', ['tiktok', 'instagram'])
        .gte('last_scraped_at', dateRange.start.toISOString())
        .lte('last_scraped_at', dateRange.end.toISOString());

      if (error) {
        console.error('Error fetching time series data:', error);
        setTimeSeriesData([]);
        return;
      }

      if (!data || data.length === 0) {
        setTimeSeriesData([]);
        return;
      }

      // Group metrics by date across all campaigns
      const allTimeSeries: Record<string, { views: number; engagement: number }> = {};

      data.forEach((post: any) => {
        let dateStr: string;
        if (post.last_scraped_at) {
          dateStr = post.last_scraped_at.split('T')[0];
        } else if (post.created_at) {
          dateStr = post.created_at.split('T')[0];
        } else if (post.updated_at) {
          dateStr = post.updated_at.split('T')[0];
        } else {
          dateStr = new Date().toISOString().split('T')[0];
        }

        if (!allTimeSeries[dateStr]) {
          allTimeSeries[dateStr] = { views: 0, engagement: 0 };
        }

        const views = Number(post.views || 0);
        const likes = Number(post.likes || 0);
        const comments = Number(post.comments || 0);
        const shares = Number(post.shares || 0);
        const engagement = likes + comments + shares;

        allTimeSeries[dateStr].views += views;
        allTimeSeries[dateStr].engagement += engagement;
      });

      // Convert to array and sort by date
      const sortedData = Object.entries(allTimeSeries)
        .map(([date, metrics]) => ({
          date,
          reach: metrics.views,
          engagement: metrics.engagement,
        }))
        .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
        .slice(-7);

      // Format dates for display
      const formattedData = sortedData.map(point => ({
        date: new Date(point.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
        reach: point.reach,
        engagement: point.engagement,
      }));

      setTimeSeriesData(formattedData);
    } catch (err) {
      console.error('Error fetching time series data:', err);
      setTimeSeriesData([]);
    } finally {
      setTimeSeriesLoading(false);
    }
  };

  fetchAllTimeSeries();
}, [campaignIds, dateRange.start, dateRange.end]);
  
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

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-white">Dashboard</h1>
          <p className="text-sm text-slate-400 mt-1">Track your campaign performance</p>
        </div>
        
        <div className="flex flex-wrap items-center gap-3">
          
          <div className="relative">
            <button 
              onClick={() => setIsDateDropdownOpen(!isDateDropdownOpen)}
              className="h-9 px-3 rounded-md bg-white/[0.03] hover:bg-white/[0.06] border border-white/[0.08] text-sm text-slate-300 flex items-center gap-2 transition-colors"
            >
              <Calendar className="w-4 h-4" />
              <span className="hidden sm:inline">{formatDateRange(dateRange)}</span>
              <span className="sm:hidden">{format(dateRange.start, 'MMM d')}</span>
              <ChevronDown className="w-4 h-4" />
            </button>
            
            {/* Dropdown Menu */}
            {isDateDropdownOpen && (
            <div className={cn(
              /* Mobile: Fixed at center of screen */
              "fixed inset-x-4 top-50 mx-auto w-auto max-w-[280px] origin-top",
              /* Desktop: Reset to absolute positioning near the button */
              "md:absolute md:fixed-none md:inset-auto md:right-0 md:top-full sm:left-0 md:mt-2 md:w-48 md:translate-y-0",
              "bg-[#0D0D0D] border border-white/[0.08] rounded-lg shadow-xl z-[100] py-1 animate-in fade-in zoom-in-95 duration-200"
            )}>
              {DATE_RANGE_PRESETS.map((option) => (
                <button
                  key={option.label}
                  onClick={() => {
                    setDateRange(option);
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
          <div className="hidden lg:block">
            <NotificationsCenter /> 
          </div>
          
          <button onClick={handleExportCSV} className="h-9 px-3 rounded-md bg-primary hover:bg-primary/90 text-black text-sm font-medium flex items-center gap-2 transition-colors">
            <Download className="w-4 h-4" />
            <span className="hidden sm:inline">Export</span>
          </button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="bg-[#0D0D0D] border-white/[0.08] hover:border-white/[0.12] transition-all duration-300 group">
          <CardContent className="p-5">
            <div className="flex items-start justify-between mb-4">
              <div className="w-10 h-10 rounded-lg bg-[#0ea5e9]/10 flex items-center justify-center">
                <Eye className="w-5 h-5 text-[#0ea5e9]" />
              </div>
              <div className="flex items-center gap-1 text-sm text-slate-500">
                <span className="font-medium">{formatDateRange(dateRange)}</span>
              </div>
            </div>
            <div className="text-[28px] font-semibold text-white mb-1">{kpiMetrics.totalReach}</div>
            <p className="text-sm text-slate-400">Total Reach</p>
          </CardContent>
        </Card>

        <Card className="bg-[#0D0D0D] border-white/[0.08] hover:border-white/[0.12] transition-all duration-300 group">
          <CardContent className="p-5">
            <div className="flex items-start justify-between mb-4">
              <div className="w-10 h-10 rounded-lg bg-purple-500/10 flex items-center justify-center group-hover:bg-purple-500/20 transition-colors">
                <Heart className="w-5 h-5 text-purple-400" />
              </div>
              <div className="flex items-center gap-1 text-sm text-slate-500">
                <span className="font-medium">Average</span>
              </div>
            </div>
            <div className="text-[28px] font-semibold text-white mb-1">{kpiMetrics.engagementRate}%</div>
            <p className="text-sm text-slate-400">Engagement Rate</p>
          </CardContent>
        </Card>

        <Card className="bg-[#0D0D0D] border-white/[0.08] hover:border-white/[0.12] transition-all duration-300 group">
          <CardContent className="p-5">
            <div className="flex items-start justify-between mb-4">
              <div className="w-10 h-10 rounded-lg bg-cyan-500/10 flex items-center justify-center group-hover:bg-cyan-500/20 transition-colors">
                <Users className="w-5 h-5 text-cyan-400" />
              </div>
              <div className="flex items-center gap-1 text-sm text-slate-500">
                <span className="font-medium">Total</span>
              </div>
            </div>
            <div className="text-[28px] font-semibold text-white mb-1">{kpiMetrics.activeCreators}</div>
            <p className="text-sm text-slate-400">Active Creators</p>
          </CardContent>
        </Card>

        <Card className="bg-[#0D0D0D] border-white/[0.08] hover:border-white/[0.12] transition-all duration-300 group">
          <CardContent className="p-5">
            <div className="flex items-start justify-between mb-4">
              <div className="w-10 h-10 rounded-lg bg-amber-500/10 flex items-center justify-center group-hover:bg-amber-500/20 transition-colors">
                <FileText className="w-5 h-5 text-amber-400" />
              </div>
              <div className="flex items-center gap-1 text-sm text-slate-500">
                <span className="font-medium">All campaigns</span>
              </div>
            </div>
            <div className="text-[28px] font-semibold text-white mb-1">{kpiMetrics.totalPosts}</div>
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
                className="h-9 px-3 rounded-md bg-white/[0.03] hover:bg-white/[0.06] border border-white/[0.08] text-sm text-slate-300 flex items-center gap-2 transition-colors"
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
                  type="text"
                  placeholder="Search campaigns..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="h-9 pl-9 pr-3 bg-white/[0.03] border border-white/[0.08] rounded-md text-sm text-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-primary/50 w-full"
                />
              </div>
            </div>
          </div>

          </div>
            
          </div>

          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-white/[0.08]">
                  <th className="text-left text-xs font-medium text-slate-400 px-4 sm:px-6 py-3">Campaign</th>
                  <th className="text-left text-xs font-medium text-slate-400 px-4 sm:px-6 py-3 hidden sm:table-cell">Status</th>
                  <th className="text-left text-xs font-medium text-slate-400 px-4 sm:px-6 py-3 hidden lg:table-cell">Budget</th>
                  <th className="text-left text-xs font-medium text-slate-400 px-4 sm:px-6 py-3 hidden md:table-cell">Creators</th>
                  <th className="text-left text-xs font-medium text-slate-400 px-4 sm:px-6 py-3 hidden md:table-cell">Posts</th>
                  <th className="text-left text-xs font-medium text-slate-400 px-4 sm:px-6 py-3">Reach</th>
                  <th className="text-left text-xs font-medium text-slate-400 px-4 sm:px-6 py-3 hidden lg:table-cell">Engagement</th>
                  <th className="text-left text-xs font-medium text-slate-400 px-4 sm:px-6 py-3 hidden lg:table-cell">Performance</th>
                  <th className="text-right text-xs font-medium text-slate-400 px-4 sm:px-6 py-3"></th>
                </tr>
              </thead>
              <tbody>
                {campaignsLoading ? (
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
                  filteredCampaigns.map((campaign) => {
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
                    <td className="px-4 sm:px-6 py-4 hidden lg:table-cell">
                          <div className="text-sm text-slate-300">-</div>
                          <div className="text-xs text-slate-500">No budget data</div>
                    </td>
                    <td className="px-4 sm:px-6 py-4 hidden md:table-cell">
                          <div className="text-sm text-slate-300">-</div>
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
                    <td className="px-4 sm:px-6 py-4 text-right">
                          <button 
                            onClick={(e) => {
                              e.stopPropagation();
                            }}
                            className="w-8 h-8 rounded-md hover:bg-white/[0.06] flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                          >
                        <MoreVertical className="w-4 h-4 text-slate-400" />
                      </button>
                    </td>
                  </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Filter Modal */}
      {isFilterOpen && (
        <div className="fixed inset-0 bg-black/[0.5] z-50 p-4">
          <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 bg-[#0D0D0D] border border-white/[0.08] rounded-lg shadow-xl w-full max-w-md max-h-[90vh] overflow-y-auto">
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