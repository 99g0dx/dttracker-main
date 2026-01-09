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

interface DashboardProps {
  onNavigate: (path: string) => void;
}

export function Dashboard({ onNavigate }: DashboardProps) {
  const [dateRange, setDateRange] = useState('Last 30 days');
  const [isDateDropdownOpen, setIsDateDropdownOpen] = useState(false);
  const [isFilterOpen, setIsFilterOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [filters, setFilters] = useState({
    status: [] as string[],
    budgetRange: [] as string[],
    performance: [] as string[],
  });

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
  const kpiMetrics = useMemo(() => {
    // Total reach (views) - sum from all campaigns (KPI platforms only, already filtered in API)
    const totalReach = campaigns.reduce((sum, c) => sum + (c.total_views || 0), 0);
    
    // Total posts - sum from all campaigns
    const totalPosts = campaigns.reduce((sum, c) => sum + (c.posts_count || 0), 0);
    
    // Weighted average engagement rate
    const totalEngagementWeighted = campaigns.reduce((sum, c) => {
      return sum + ((c.avg_engagement_rate || 0) * (c.posts_count || 0));
    }, 0);
    const engagementRate = totalPosts > 0 ? totalEngagementWeighted / totalPosts : 0;
    
    // Count unique creators across all campaigns
    // Get all campaign IDs and count unique creators
    const campaignIds = campaigns.map(c => c.id);
    const uniqueCreators = new Set<string>();
    // For now, we'll use all creators count as active creators
    // In a real scenario, you'd filter by campaigns
    const activeCreators = allCreators.length;

    // Format reach
    const formatReach = (value: number): string => {
      if (value >= 1000000) return `${(value / 1000000).toFixed(1)}M`;
      if (value >= 1000) return `${(value / 1000).toFixed(1)}K`;
      return value.toString();
    };

    return {
      totalReach: formatReach(totalReach),
      totalReachValue: totalReach,
      engagementRate: engagementRate.toFixed(1),
      engagementRateValue: engagementRate,
      activeCreators,
      totalPosts,
    };
  }, [campaigns, allCreators]);

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
  }, [campaigns, searchQuery, filters]);

  // Fetch all posts across all campaigns for platform breakdown
  const [allPosts, setAllPosts] = useState<any[]>([]);
  const [postsLoading, setPostsLoading] = useState(true);

  useEffect(() => {
    const fetchAllPosts = async () => {
      if (campaigns.length === 0) {
        setAllPosts([]);
        setPostsLoading(false);
        return;
      }

      try {
        setPostsLoading(true);
        const campaignIds = campaigns.map(c => c.id);
        
        const { data, error } = await supabase
          .from('posts')
          .select('platform, campaign_id')
          .in('campaign_id', campaignIds);

        if (error) {
          console.error('Error fetching posts for platform breakdown:', error);
          setAllPosts([]);
        } else {
          setAllPosts(data || []);
        }
      } catch (err) {
        console.error('Error fetching posts:', err);
        setAllPosts([]);
      } finally {
        setPostsLoading(false);
      }
    };

    fetchAllPosts();
  }, [campaigns]);

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
      { key: 'tiktok', name: 'TikTok', color: '#000000' },
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
      console.log('[Platform Breakdown Consistency]', {
        totalPosts,
        platformCounts,
        percentages: result.map(p => `${p.name}: ${p.count} posts (${p.value}%)`),
        totalPercentage: `${totalPercentage.toFixed(1)}%`,
        status: percentageValid ? '✓ Sums to 100%' : '⚠ Percentage mismatch',
        'KPI Total Posts': kpiMetrics.totalPosts,
        'Platform Posts Match': Math.abs(totalPosts - kpiMetrics.totalPosts) < 1 ? '✓ Aligned' : '⚠ Mismatch',
      });
      
      if (!percentageValid) {
        console.warn('[Platform Breakdown Warning]', 'Percentages do not sum to 100%. This may indicate a calculation error.');
      }
      if (Math.abs(totalPosts - kpiMetrics.totalPosts) >= 1) {
        console.warn('[Platform Breakdown Warning]', 'Platform breakdown post count does not match KPI total posts.');
      }
    }

    return result.length > 0 ? result : [
      { name: 'TikTok', value: 0, count: 0, color: '#000000' },
      { name: 'Instagram', value: 0, count: 0, color: '#E4405F' },
    ];
  }, [allPosts]);

  // Fetch time-series data for all campaigns
  const [timeSeriesData, setTimeSeriesData] = useState<any[]>([]);
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
        
        // Fetch time series for all campaigns at once
        const { data, error } = await supabase
          .from('posts')
          .select('views, likes, comments, shares, last_scraped_at, created_at, updated_at, campaign_id')
          .in('campaign_id', campaignIds)
          .in('platform', ['tiktok', 'instagram']);

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
          .slice(-7); // Last 7 data points

        // Format dates for display
        const formattedData = sortedData.map(point => ({
          date: new Date(point.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
          reach: point.reach,
          engagement: point.engagement,
        }));

        // Verify totals match KPI metrics
        const chartTotalReach = formattedData.reduce((sum, p) => sum + p.reach, 0);
        const chartTotalEngagement = formattedData.reduce((sum, p) => sum + p.engagement, 0);
        
        // Data consistency check
        if (process.env.NODE_ENV === 'development') {
          const reachMatch = Math.abs(chartTotalReach - kpiMetrics.totalReachValue) < 1;
          console.log('[Dashboard Data Consistency Check]', {
            'KPI Metrics': {
              totalReach: kpiMetrics.totalReachValue,
              totalPosts: kpiMetrics.totalPosts,
              engagementRate: kpiMetrics.engagementRateValue,
            },
            'Chart Totals': {
              totalReach: chartTotalReach,
              totalEngagement: chartTotalEngagement,
              dataPoints: formattedData.length,
            },
            'Alignment Status': {
              reach: reachMatch ? '✓ Aligned' : '⚠ Mismatch',
            },
          });

          // Warn if there are inconsistencies
          if (!reachMatch) {
            console.warn('[Dashboard Warning]', 'Chart reach total does not match KPI card total. This may indicate a data inconsistency.');
          }
        }

        setTimeSeriesData(formattedData);
      } catch (err) {
        console.error('Error fetching time series data:', err);
        setTimeSeriesData([]);
      } finally {
        setTimeSeriesLoading(false);
      }
    };

    fetchAllTimeSeries();
  }, [campaigns, kpiMetrics.totalReachValue]);

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
          <div className="relative">
            <button 
              onClick={() => setIsDateDropdownOpen(!isDateDropdownOpen)}
              className="h-9 px-3 rounded-md bg-white/[0.03] hover:bg-white/[0.06] border border-white/[0.08] text-sm text-slate-300 flex items-center gap-2 transition-colors"
            >
              <Calendar className="w-4 h-4" />
              <span className="hidden sm:inline">{dateRange}</span>
              <span className="sm:hidden">{dateRange.replace('Last ', '')}</span>
              <ChevronDown className="w-4 h-4" />
            </button>
            
            {/* Dropdown Menu */}
            {isDateDropdownOpen && (
              <div className="absolute right-0 top-full mt-2 w-48 bg-[#0D0D0D] border border-white/[0.08] rounded-lg shadow-xl z-50 py-1">
                {dateRangeOptions.map((option) => (
                  <button
                    key={option}
                    onClick={() => {
                      setDateRange(option);
                      setIsDateDropdownOpen(false);
                    }}
                    className={`w-full text-left px-3 py-2 text-sm transition-colors ${
                      dateRange === option
                        ? 'bg-primary/10 text-primary'
                        : 'text-slate-300 hover:bg-white/[0.06]'
                    }`}
                  >
                    {option}
                  </button>
                ))}
              </div>
            )}
          </div>
          <NotificationsCenter />
          <button className="h-9 px-3 rounded-md bg-primary hover:bg-primary/90 text-black text-sm font-medium flex items-center gap-2 transition-colors">
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
                <span className="font-medium">All time</span>
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
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <h3 className="text-base font-semibold text-white">Active Campaigns</h3>
                <p className="text-sm text-slate-400 mt-0.5">Manage and monitor your campaigns</p>
              </div>
              <div className="relative w-full sm:w-auto sm:min-w-[200px]">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                <input
                  type="text"
                  placeholder="Search campaigns..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="h-9 pl-9 pr-3 bg-white/[0.03] border border-white/[0.08] rounded-md text-sm text-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-primary/50 w-full sm:w-64"
                />
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