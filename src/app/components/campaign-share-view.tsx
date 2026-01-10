import React, { useState, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Card, CardContent } from './ui/card';
import { Button } from './ui/button';
import { Input } from './ui/input';
import {
  Eye,
  Heart,
  MessageCircle,
  Share2,
  ExternalLink,
  ArrowUpDown,
  Lock,
  LineChart as LineChartIcon,
} from 'lucide-react';
import { PlatformBadge } from './platform-badge';
import * as sharingApi from '../../lib/api/campaign-sharing-v2';
import type { SubcampaignSummary } from '../../lib/types/database';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from './ui/select';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from 'recharts';

type SortBy = 'views' | 'platform' | 'likes' | 'comments' | 'top-performer';

interface SharedCampaignData {
  campaign: {
    id: string;
    name: string;
    brand_name: string | null;
    status: string;
    coverImageUrl: string | null;
    createdAt: string;
  };
  is_parent?: boolean;
  subcampaigns?: SubcampaignSummary[];
  totals: {
    views: number;
    likes: number;
    comments: number;
    shares: number;
  };
  series: {
    views: Array<{ date: string; value: number }>;
    likes: Array<{ date: string; value: number }>;
    comments: Array<{ date: string; value: number }>;
    shares: Array<{ date: string; value: number }>;
  };
  posts: Array<{
    id: string;
    campaignId: string;
    platform: string;
    postUrl: string;
    status: string;
    views: number;
    likes: number;
    comments: number;
    shares: number;
    engagementRate: number;
    postedDate: string | null;
    createdAt: string;
    creator: {
      id: string;
      name: string;
      handle: string;
    } | null;
  }>;
  share: {
    allowExport: boolean;
  };
}

const kpiPlatforms = new Set(['tiktok', 'instagram']);

function buildSeriesFromPosts(
  posts: Array<{
    platform: string;
    views: number;
    likes: number;
    comments: number;
    shares: number;
    postedDate: string | null;
    createdAt: string;
  }>
) {
  const metricsByDate = new Map<
    string,
    { views: number; likes: number; comments: number; shares: number }
  >();

  posts.forEach((post) => {
    if (!kpiPlatforms.has(post.platform)) return;
    const rawDate = post.postedDate || post.createdAt;
    if (!rawDate) return;
    const dateStr = rawDate.split('T')[0];

    if (!metricsByDate.has(dateStr)) {
      metricsByDate.set(dateStr, {
        views: 0,
        likes: 0,
        comments: 0,
        shares: 0,
      });
    }

    const point = metricsByDate.get(dateStr)!;
    point.views += post.views || 0;
    point.likes += post.likes || 0;
    point.comments += post.comments || 0;
    point.shares += post.shares || 0;
  });

  const sortedDates = Array.from(metricsByDate.keys()).sort((a, b) =>
    a.localeCompare(b)
  );

  const series = {
    views: [] as Array<{ date: string; value: number }>,
    likes: [] as Array<{ date: string; value: number }>,
    comments: [] as Array<{ date: string; value: number }>,
    shares: [] as Array<{ date: string; value: number }>,
  };

  sortedDates.forEach((date) => {
    const values = metricsByDate.get(date)!;
    series.views.push({ date, value: values.views });
    series.likes.push({ date, value: values.likes });
    series.comments.push({ date, value: values.comments });
    series.shares.push({ date, value: values.shares });
  });

  return series;
}

export function CampaignShareView() {
  const { token } = useParams<{ token: string }>();
  const navigate = useNavigate();
  const [password, setPassword] = useState('');
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<SharedCampaignData | null>(null);
  const [sortBy, setSortBy] = useState<SortBy>('views');
  const [activeTab, setActiveTab] = useState<string>('all');
  const [isSubmittingPassword, setIsSubmittingPassword] = useState(false);

  // Check if password is required
  React.useEffect(() => {
    if (!token) {
      setError('Invalid share link');
      setIsLoading(false);
      return;
    }

    // Try to load campaign without password first
    loadCampaign();
  }, [token]);

  const loadCampaign = async (passwordValue?: string) => {
    if (!token) return;

    setIsLoading(true);
    setError(null);
    setPasswordError(null);

    try {
      const result = await sharingApi.fetchSharedCampaignData(token, passwordValue);

      if (result.error) {
        const errorMessage = result.error.message?.toLowerCase() || '';
        if (errorMessage.includes('password') || errorMessage.includes('required')) {
          setIsAuthenticated(false);
          setPasswordError(null);
          setIsLoading(false);
          return;
        }
        if (errorMessage.includes('incorrect') || errorMessage.includes('wrong')) {
          setIsAuthenticated(false);
          setPasswordError('Incorrect password. Please try again.');
          setIsLoading(false);
          return;
        }
        setError(result.error.message);
        setIsLoading(false);
        return;
      }

      if (result.data) {
        setData(result.data);
        setPasswordError(null);
        setIsAuthenticated(true);
        setIsLoading(false);
      }
    } catch (err) {
      setError('Failed to load campaign');
      setIsLoading(false);
    }
  };

  const handlePasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!password.trim()) {
      setPasswordError('Please enter a password');
      return;
    }

    setIsSubmittingPassword(true);
    setPasswordError(null);
    await loadCampaign(password);
    setIsSubmittingPassword(false);
  };

  React.useEffect(() => {
    if (!data) return;
    if (!data.is_parent || !data.subcampaigns || data.subcampaigns.length === 0) {
      if (activeTab !== 'all') {
        setActiveTab('all');
      }
      return;
    }

    const tabExists =
      activeTab === 'all' ||
      data.subcampaigns.some((subcampaign) => subcampaign.id === activeTab);
    if (!tabExists) {
      setActiveTab('all');
    }
  }, [data, activeTab]);

  const subcampaignTabs = data?.subcampaigns || [];
  const hasSubcampaigns = Boolean(data?.is_parent && subcampaignTabs.length > 0);
  const selectedSubcampaign =
    activeTab === 'all'
      ? null
      : subcampaignTabs.find((subcampaign) => subcampaign.id === activeTab) || null;

  const filteredPosts = useMemo(() => {
    if (!data?.posts) return [];
    if (activeTab === 'all') return data.posts;
    return data.posts.filter((post) => post.campaignId === activeTab);
  }, [data?.posts, activeTab]);

  const totals = useMemo(() => {
    const kpiPosts = filteredPosts.filter((post) =>
      kpiPlatforms.has(post.platform)
    );
    return {
      views: kpiPosts.reduce((sum, post) => sum + (post.views || 0), 0),
      likes: kpiPosts.reduce((sum, post) => sum + (post.likes || 0), 0),
      comments: kpiPosts.reduce((sum, post) => sum + (post.comments || 0), 0),
      shares: kpiPosts.reduce((sum, post) => sum + (post.shares || 0), 0),
    };
  }, [filteredPosts]);

  const seriesData = useMemo(() => {
    if (!data) return null;
    if (activeTab === 'all') return data.series;
    return buildSeriesFromPosts(filteredPosts);
  }, [data, activeTab, filteredPosts]);

  const formattedChartData = useMemo(() => {
    if (!seriesData?.views) return [];

    const maxLength = Math.max(
      seriesData.views.length,
      seriesData.likes.length,
      seriesData.comments.length,
      seriesData.shares.length
    );

    return Array.from({ length: maxLength }, (_, i) => {
      const date =
        seriesData.views[i]?.date ||
        seriesData.likes[i]?.date ||
        seriesData.comments[i]?.date ||
        seriesData.shares[i]?.date ||
        '';

      return {
        date: new Date(date).toLocaleDateString('en-US', {
          month: 'numeric',
          day: 'numeric',
        }),
        views: seriesData.views[i]?.value || 0,
        likes: seriesData.likes[i]?.value || 0,
        comments: seriesData.comments[i]?.value || 0,
        shares: seriesData.shares[i]?.value || 0,
      };
    });
  }, [seriesData]);

  // Sort posts
  const sortedPosts = useMemo(() => {
    const sorted = [...filteredPosts];

    switch (sortBy) {
      case 'views':
        return sorted.sort((a, b) => (b.views || 0) - (a.views || 0));
      case 'likes':
        return sorted.sort((a, b) => (b.likes || 0) - (a.likes || 0));
      case 'comments':
        return sorted.sort((a, b) => (b.comments || 0) - (a.comments || 0));
      case 'platform':
        return sorted.sort((a, b) => a.platform.localeCompare(b.platform));
      case 'top-performer':
        return sorted.sort((a, b) => {
          const aEngagement =
            (a.views || 0) + (a.likes || 0) + (a.comments || 0) + (a.shares || 0);
          const bEngagement =
            (b.views || 0) + (b.likes || 0) + (b.comments || 0) + (b.shares || 0);
          return bEngagement - aEngagement;
        });
      default:
        return sorted;
    }
  }, [filteredPosts, sortBy]);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-[#0A0A0A] flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 border-2 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-slate-400">Loading campaign...</p>
        </div>
      </div>
    );
  }

  if (error && !isAuthenticated) {
    return (
      <div className="min-h-screen bg-[#0A0A0A] flex items-center justify-center p-6">
        <Card className="bg-[#0D0D0D] border-white/[0.08] max-w-md w-full">
          <CardContent className="p-6 text-center">
            <div className="w-12 h-12 rounded-full bg-red-500/10 flex items-center justify-center mx-auto mb-4">
              <Lock className="w-6 h-6 text-red-400" />
            </div>
            <h2 className="text-xl font-semibold text-white mb-2">Access Denied</h2>
            <p className="text-slate-400 mb-6">{error}</p>
            <Button
              onClick={() => navigate('/home')}
              className="bg-primary hover:bg-primary/90 text-black"
            >
              Go to Home
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Password entry form
  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-[#0A0A0A] flex items-center justify-center p-6">
        <Card className="bg-[#0D0D0D] border-white/[0.08] max-w-md w-full">
          <CardContent className="p-6">
            <div className="text-center mb-6">
              <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-4">
                <Lock className="w-6 h-6 text-primary" />
              </div>
              <h2 className="text-xl font-semibold text-white mb-2">Password Protected</h2>
              <p className="text-slate-400">This campaign requires a password to view</p>
            </div>
            <form onSubmit={handlePasswordSubmit} className="space-y-4">
              <Input
                type="password"
                placeholder="Enter password"
                value={password}
                onChange={(e) => {
                  setPassword(e.target.value);
                  setPasswordError(null);
                }}
                className="h-11 bg-white/[0.04] border-white/[0.1] text-white placeholder:text-slate-600 focus:bg-white/[0.06] focus:border-primary/50 focus:ring-2 focus:ring-primary/20"
                autoFocus
              />
              {passwordError && (
                <p className="text-sm text-red-400">{passwordError}</p>
              )}
              <Button
                type="submit"
                disabled={isSubmittingPassword}
                className="w-full h-11 bg-primary hover:bg-primary/90 text-black font-medium"
              >
                {isSubmittingPassword ? 'Verifying...' : 'Access Campaign'}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!data) {
    return null;
  }

  return (
    <div className="min-h-screen bg-[#0A0A0A]">
      {/* Minimal Header */}
      <div className="border-b border-white/[0.08] bg-[#0D0D0D]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-xl font-semibold text-white">Campaign Share</h1>
              <p className="text-sm text-slate-400 mt-0.5">View-only access</p>
            </div>
            <div className="flex items-center gap-2 px-3 py-1.5 bg-amber-500/10 border border-amber-500/20 rounded-lg">
              <Eye className="w-4 h-4 text-amber-400" />
              <span className="text-xs font-medium text-amber-400">View Only</span>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="space-y-6">
          {/* Campaign Header */}
          <div>
            <h2 className="text-3xl font-bold text-white mb-2">{data.campaign.name}</h2>
            {data.campaign.brand_name && (
              <p className="text-lg text-slate-300">{data.campaign.brand_name}</p>
            )}
          </div>

          {/* Subcampaign Tabs */}
          {hasSubcampaigns && (
            <div className="flex flex-wrap gap-2">
              <button
                onClick={() => setActiveTab('all')}
                className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-colors ${
                  activeTab === 'all'
                    ? 'bg-primary text-black border-primary'
                    : 'bg-white/[0.03] text-slate-300 border-white/[0.08] hover:bg-white/[0.06]'
                }`}
              >
                All Campaigns
              </button>
              {subcampaignTabs.map((subcampaign) => (
                <button
                  key={subcampaign.id}
                  onClick={() => setActiveTab(subcampaign.id)}
                  className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-colors ${
                    activeTab === subcampaign.id
                      ? 'bg-primary text-black border-primary'
                      : 'bg-white/[0.03] text-slate-300 border-white/[0.08] hover:bg-white/[0.06]'
                  }`}
                >
                  {subcampaign.name}
                </button>
              ))}
            </div>
          )}

          {selectedSubcampaign && (
            <p className="text-xs text-slate-500">
              Showing {selectedSubcampaign.name} posts and metrics.
            </p>
          )}

          {/* KPI Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <Card className="bg-[#0D0D0D] border-white/[0.08]">
              <CardContent className="p-5">
                <div className="flex items-start justify-between mb-3">
                  <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                    <Eye className="w-5 h-5 text-primary" />
                  </div>
                </div>
                <div className="text-2xl font-semibold text-white mb-1">
                  {totals.views.toLocaleString()}
                </div>
                <p className="text-sm text-slate-400">Total Views</p>
              </CardContent>
            </Card>

            <Card className="bg-[#0D0D0D] border-white/[0.08]">
              <CardContent className="p-5">
                <div className="flex items-start justify-between mb-3">
                  <div className="w-10 h-10 rounded-lg bg-pink-500/10 flex items-center justify-center">
                    <Heart className="w-5 h-5 text-pink-400" />
                  </div>
                </div>
                <div className="text-2xl font-semibold text-white mb-1">
                  {totals.likes.toLocaleString()}
                </div>
                <p className="text-sm text-slate-400">Total Likes</p>
              </CardContent>
            </Card>

            <Card className="bg-[#0D0D0D] border-white/[0.08]">
              <CardContent className="p-5">
                <div className="flex items-start justify-between mb-3">
                  <div className="w-10 h-10 rounded-lg bg-cyan-500/10 flex items-center justify-center">
                    <MessageCircle className="w-5 h-5 text-cyan-400" />
                  </div>
                </div>
                <div className="text-2xl font-semibold text-white mb-1">
                  {totals.comments.toLocaleString()}
                </div>
                <p className="text-sm text-slate-400">Total Comments</p>
              </CardContent>
            </Card>

            <Card className="bg-[#0D0D0D] border-white/[0.08]">
              <CardContent className="p-5">
                <div className="flex items-start justify-between mb-3">
                  <div className="w-10 h-10 rounded-lg bg-purple-500/10 flex items-center justify-center">
                    <Share2 className="w-5 h-5 text-purple-400" />
                  </div>
                </div>
                <div className="text-2xl font-semibold text-white mb-1">
                  {totals.shares.toLocaleString()}
                </div>
                <p className="text-sm text-slate-400">Total Shares</p>
              </CardContent>
            </Card>
          </div>

          {/* Charts Section */}
          {formattedChartData.length > 0 ? (
            <Card className="bg-[#0D0D0D] border-white/[0.08]">
              <CardContent className="p-6">
                <h3 className="text-lg font-semibold text-white mb-4">Performance Over Time</h3>
                <ResponsiveContainer width="100%" height={350}>
                  <LineChart data={formattedChartData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(148, 163, 184, 0.08)" vertical={false} />
                    <XAxis
                      dataKey="date"
                      stroke="#94a3b8"
                      style={{ fontSize: '12px' }}
                      axisLine={false}
                      tickLine={false}
                    />
                    <YAxis
                      stroke="#94a3b8"
                      style={{ fontSize: '12px' }}
                      axisLine={false}
                      tickLine={false}
                    />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: 'rgba(13, 13, 13, 0.95)',
                        border: '1px solid rgba(148, 163, 184, 0.1)',
                        borderRadius: '12px',
                        backdropFilter: 'blur(12px)',
                        boxShadow: '0 8px 32px rgba(0, 0, 0, 0.3)',
                      }}
                      labelStyle={{ color: '#f1f5f9', fontWeight: 500 }}
                    />
                    <Legend
                      wrapperStyle={{ paddingTop: '20px' }}
                      iconType="circle"
                    />
                    <Line
                      type="monotone"
                      dataKey="views"
                      stroke="#0ea5e9"
                      strokeWidth={2}
                      dot={false}
                      name="Views"
                    />
                    <Line
                      type="monotone"
                      dataKey="likes"
                      stroke="#ec4899"
                      strokeWidth={2}
                      dot={false}
                      name="Likes"
                    />
                    <Line
                      type="monotone"
                      dataKey="comments"
                      stroke="#06b6d4"
                      strokeWidth={2}
                      dot={false}
                      name="Comments"
                    />
                    <Line
                      type="monotone"
                      dataKey="shares"
                      stroke="#8b5cf6"
                      strokeWidth={2}
                      dot={false}
                      name="Shares"
                    />
                  </LineChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          ) : (
            <Card className="bg-[#0D0D0D] border-white/[0.08]">
              <CardContent className="p-6">
                <div className="text-center py-12">
                  <div className="w-12 h-12 rounded-full bg-slate-500/10 flex items-center justify-center mx-auto mb-4">
                    <LineChartIcon className="w-6 h-6 text-slate-400" />
                  </div>
                  <h3 className="text-lg font-semibold text-white mb-2">No Historical Data</h3>
                  <p className="text-sm text-slate-400 max-w-md mx-auto">
                    Chart data will appear here once metrics have been tracked over time.
                    Check browser console for detailed error information if you expect data to be available.
                  </p>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Posts Section */}
          <Card className="bg-[#0D0D0D] border-white/[0.08]">
            <CardContent className="p-6">
              <div className="flex items-center justify-between mb-6">
                <div>
                  <h3 className="text-lg font-semibold text-white">Posts</h3>
                  <p className="text-sm text-slate-400 mt-0.5">
                    {sortedPosts.length} post{sortedPosts.length !== 1 ? 's' : ''}
                  </p>
                </div>
                <Select value={sortBy} onValueChange={(value: SortBy) => setSortBy(value)}>
                  <SelectTrigger className="h-9 w-[180px] bg-white/[0.03] border-white/[0.08] text-slate-300 text-sm">
                    <ArrowUpDown className="w-4 h-4 mr-2" />
                    <SelectValue placeholder="Sort by" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="views">Sort by: Views</SelectItem>
                    <SelectItem value="likes">Sort by: Likes</SelectItem>
                    <SelectItem value="comments">Sort by: Comments</SelectItem>
                    <SelectItem value="platform">Sort by: Platform</SelectItem>
                    <SelectItem value="top-performer">Sort by: Top Performer</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {sortedPosts.length === 0 ? (
                <div className="text-center py-12">
                  <p className="text-slate-400">No posts available</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {sortedPosts.map((post) => (
                    <div
                      key={post.id}
                      className="p-4 bg-white/[0.02] border border-white/[0.06] rounded-lg hover:bg-white/[0.04] transition-colors"
                    >
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-3 mb-2">
                            <PlatformBadge platform={post.platform} />
                            {/* Status badge removed - not relevant for public viewers */}
                            {post.creator && (
                              <span className="text-sm text-slate-300">
                                {post.creator.name} ({post.creator.handle})
                              </span>
                            )}
                          </div>
                          <a
                            href={post.postUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-sm text-primary hover:text-primary/80 flex items-center gap-1.5 mb-3"
                          >
                            View Post <ExternalLink className="w-3.5 h-3.5" />
                          </a>
                          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-sm">
                            <div>
                              <div className="text-slate-400 mb-1">Views</div>
                              <div className="text-white font-medium">
                                {(post.views || 0).toLocaleString()}
                              </div>
                            </div>
                            <div>
                              <div className="text-slate-400 mb-1">Likes</div>
                              <div className="text-white font-medium">
                                {(post.likes || 0).toLocaleString()}
                              </div>
                            </div>
                            <div>
                              <div className="text-slate-400 mb-1">Comments</div>
                              <div className="text-white font-medium">
                                {(post.comments || 0).toLocaleString()}
                              </div>
                            </div>
                            <div>
                              <div className="text-slate-400 mb-1">Shares</div>
                              <div className="text-white font-medium">
                                {(post.shares || 0).toLocaleString()}
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
