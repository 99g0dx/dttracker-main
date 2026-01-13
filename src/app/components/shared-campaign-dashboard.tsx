import React, { useState, useMemo, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Card, CardContent } from "./ui/card";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import {
  Eye,
  Heart,
  MessageCircle,
  Share2,
  ExternalLink,
  ArrowUpDown,
  LineChart as LineChartIcon,
  Lock,
} from "lucide-react";
import { PlatformBadge } from "./platform-badge";
import * as sharingApi from "../../lib/api/campaign-sharing-v2";
import { toast } from "sonner";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "./ui/select";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";

type SortBy = "views" | "platform" | "likes" | "comments" | "top-performer";

interface SharedCampaignData {
  campaign: {
    id: string;
    name: string;
    brand_name: string | null;
    status: string;
    coverImageUrl: string | null;
    createdAt: string;
  };
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

export function SharedCampaignDashboard() {
  const { token } = useParams<{ token: string }>();
  const navigate = useNavigate();
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<SharedCampaignData | null>(null);
  const [sortBy, setSortBy] = useState<SortBy>("views");
  const [password, setPassword] = useState("");
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [requiresPassword, setRequiresPassword] = useState(false);

  // Load shared campaign data function
  const loadCampaign = React.useCallback(async (providedPassword?: string) => {
    if (!token) return;

    setIsLoading(true);
    setError(null);
    setPasswordError(null);

    try {
      const result = await sharingApi.fetchSharedCampaignData(token, providedPassword);

      if (result.error) {
        // Check if error is due to password requirement
        if ((result.error as any)?.code === "PASSWORD_REQUIRED") {
          setRequiresPassword(true);
          setIsLoading(false);
          return;
        }

        console.error("Failed to load shared campaign:", result.error);
        setError(result.error.message || "Failed to load campaign");
        setIsLoading(false);
        return;
      }

      if (result.data) {
        setData(result.data);
        setRequiresPassword(false);
        setIsLoading(false);
      }
    } catch (err) {
      console.error("Exception loading shared campaign:", err);
      setError(err instanceof Error ? err.message : "Failed to load campaign");
      setIsLoading(false);
    }
  }, [token]);

  // Load shared campaign data on mount
  React.useEffect(() => {
    if (!token) {
      setError("Invalid share link");
      setIsLoading(false);
      return;
    }

    loadCampaign();
  }, [token, loadCampaign]);

  const handlePasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!password.trim()) {
      setPasswordError("Please enter a password");
      return;
    }

    await loadCampaign(password);
  };

  // Sort posts
  const sortedPosts = useMemo(() => {
    if (!data?.posts) return [];

    const sorted = [...data.posts];

    switch (sortBy) {
      case "views":
        return sorted.sort((a, b) => b.views - a.views);
      case "likes":
        return sorted.sort((a, b) => b.likes - a.likes);
      case "comments":
        return sorted.sort((a, b) => b.comments - a.comments);
      case "platform":
        return sorted.sort((a, b) => a.platform.localeCompare(b.platform));
      case "top-performer":
        return sorted.sort((a, b) => {
          const aEngagement =
            a.views + a.likes + a.comments + a.shares;
          const bEngagement =
            b.views + b.likes + b.comments + b.shares;
          return bEngagement - aEngagement;
        });
      default:
        return sorted;
    }
  }, [data?.posts, sortBy]);

  // Format chart data
  const formattedChartData = useMemo(() => {
    if (!data?.series?.views) return [];

    const maxLength = Math.max(
      data.series.views.length,
      data.series.likes.length,
      data.series.comments.length,
      data.series.shares.length
    );

    return Array.from({ length: maxLength }, (_, i) => {
      const date =
        data.series.views[i]?.date ||
        data.series.likes[i]?.date ||
        data.series.comments[i]?.date ||
        data.series.shares[i]?.date ||
        "";

      return {
        date: new Date(date).toLocaleDateString("en-US", {
          month: "numeric",
          day: "numeric",
        }),
        views: data.series.views[i]?.value || 0,
        likes: data.series.likes[i]?.value || 0,
        comments: data.series.comments[i]?.value || 0,
        shares: data.series.shares[i]?.value || 0,
      };
    });
  }, [data?.series]);

  // Show loading state (but not if password is required, as that has its own UI)
  if (isLoading && !requiresPassword && !error) {
    return (
      <div className="min-h-screen bg-[#0A0A0A] flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 border-2 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-slate-400">Loading campaign...</p>
        </div>
      </div>
    );
  }

  // Password prompt
  if (requiresPassword) {
    return (
      <div className="min-h-screen bg-[#0A0A0A] flex items-center justify-center p-6">
        <Card className="bg-[#0D0D0D] border-white/[0.08] max-w-md w-full">
          <CardContent className="p-6">
            <div className="flex flex-col items-center justify-center mb-6">
              <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center mb-4">
                <Lock className="w-6 h-6 text-primary" />
              </div>
              <h2 className="text-xl font-semibold text-white mb-2">
                Password Required
              </h2>
              <p className="text-slate-400 text-center">
                This shared dashboard is password protected. Please enter the password to continue.
              </p>
            </div>

            <form onSubmit={handlePasswordSubmit} className="space-y-4">
              <div>
                <label className="block text-sm text-slate-300 mb-2">
                  Password
                </label>
                <Input
                  type="password"
                  value={password}
                  onChange={(e) => {
                    setPassword(e.target.value);
                    setPasswordError(null);
                  }}
                  placeholder="Enter password"
                  className="h-11 bg-white/[0.04] border-white/[0.1] text-white placeholder:text-slate-500 focus:border-primary/50"
                  autoFocus
                />
                {passwordError && (
                  <p className="text-sm text-red-400 mt-2">{passwordError}</p>
                )}
              </div>

              <Button
                type="submit"
                disabled={isLoading || !password.trim()}
                className="w-full h-11 bg-primary hover:bg-primary/90 text-black font-medium"
              >
                {isLoading ? "Verifying..." : "Access Dashboard"}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    );
  }

  if ((error || !data) && !requiresPassword) {
    return (
      <div className="min-h-screen bg-[#0A0A0A] flex items-center justify-center p-6">
        <Card className="bg-[#0D0D0D] border-white/[0.08] max-w-md w-full text-center">
          <CardContent className="p-6">
            <div className="w-12 h-12 rounded-full bg-red-500/10 flex items-center justify-center mx-auto mb-4">
              <Share2 className="w-6 h-6 text-red-400" />
            </div>
            <h2 className="text-xl font-semibold text-white mb-2">
              Link Expired or Unavailable
            </h2>
            <p className="text-slate-400 mb-6">
              {error || "This share link is no longer valid."}
            </p>
            <Button
              onClick={() => navigate("/login")}
              className="bg-primary hover:bg-primary/90 text-black"
            >
              Go to DTTracker
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0A0A0A]">
      {/* Minimal Header */}
      <div className="border-b border-white/[0.08] bg-[#0D0D0D]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <h1 className="text-xl font-semibold text-white">DTTracker</h1>
              <div className="flex items-center gap-2 px-3 py-1.5 bg-amber-500/10 border border-amber-500/20 rounded-lg">
                <Eye className="w-4 h-4 text-amber-400" />
                <span className="text-xs font-medium text-amber-400">View Only</span>
              </div>
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

          {/* Cover Image */}
          {data.campaign.coverImageUrl && (
            <div className="relative w-full h-52 md:h-64 rounded-xl overflow-hidden border border-white/[0.08] shadow-lg shadow-black/20">
              <img
                src={data.campaign.coverImageUrl}
                alt={data.campaign.name}
                className="w-full h-full object-cover"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-[#0D0D0D]/90 via-[#0D0D0D]/50 to-transparent" />
            </div>
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
                  {data.totals.views.toLocaleString()}
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
                  {data.totals.likes.toLocaleString()}
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
                  {data.totals.comments.toLocaleString()}
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
                  {data.totals.shares.toLocaleString()}
                </div>
                <p className="text-sm text-slate-400">Total Shares</p>
              </CardContent>
            </Card>
          </div>

          {/* Charts Section */}
          {formattedChartData.length > 0 ? (
            <Card className="bg-[#0D0D0D] border-white/[0.08]">
              <CardContent className="p-6">
                <h3 className="text-lg font-semibold text-white mb-4">
                  Performance Over Time
                </h3>
                <ResponsiveContainer width="100%" height={350}>
                  <LineChart data={formattedChartData}>
                    <CartesianGrid
                      strokeDasharray="3 3"
                      stroke="rgba(148, 163, 184, 0.08)"
                      vertical={false}
                    />
                    <XAxis
                      dataKey="date"
                      stroke="#94a3b8"
                      style={{ fontSize: "12px" }}
                      axisLine={false}
                      tickLine={false}
                    />
                    <YAxis
                      stroke="#94a3b8"
                      style={{ fontSize: "12px" }}
                      axisLine={false}
                      tickLine={false}
                    />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: "rgba(13, 13, 13, 0.95)",
                        border: "1px solid rgba(148, 163, 184, 0.1)",
                        borderRadius: "12px",
                        backdropFilter: "blur(12px)",
                        boxShadow: "0 8px 32px rgba(0, 0, 0, 0.3)",
                      }}
                      labelStyle={{ color: "#f1f5f9", fontWeight: 500 }}
                    />
                    <Legend
                      wrapperStyle={{ paddingTop: "20px" }}
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
                  <h3 className="text-lg font-semibold text-white mb-2">
                    No Historical Data
                  </h3>
                  <p className="text-sm text-slate-400 max-w-md mx-auto">
                    Chart data will appear here once metrics have been tracked over time.
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
                    {sortedPosts.length} post{sortedPosts.length !== 1 ? "s" : ""}
                  </p>
                </div>
                <Select
                  value={sortBy}
                  onValueChange={(value: SortBy) => setSortBy(value)}
                >
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
                            <PlatformBadge platform={post.platform as any} />
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
                                {post.views.toLocaleString()}
                              </div>
                            </div>
                            <div>
                              <div className="text-slate-400 mb-1">Likes</div>
                              <div className="text-white font-medium">
                                {post.likes.toLocaleString()}
                              </div>
                            </div>
                            <div>
                              <div className="text-slate-400 mb-1">Comments</div>
                              <div className="text-white font-medium">
                                {post.comments.toLocaleString()}
                              </div>
                            </div>
                            <div>
                              <div className="text-slate-400 mb-1">Shares</div>
                              <div className="text-white font-medium">
                                {post.shares.toLocaleString()}
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

