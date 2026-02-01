import React, { useState, useMemo } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Card, CardContent } from "./ui/card";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Share2, Lock } from "lucide-react";
import logoImage from "../../assets/fcad7446971be733d3427a6b22f8f64253529daf.png";
import * as sharingApi from "../../lib/api/campaign-sharing-v2";
import { toast } from "sonner";
import type {
  SubcampaignSummary,
  PostWithRankings,
  Platform,
} from "../../lib/types/database";
import type { ChartDataPoint, ChartRange } from "../../lib/types/campaign-view";
import * as csvUtils from "../../lib/utils/csv";

// Import shared components
import { CampaignHeader } from "./campaign-header";
import { CampaignKPICards } from "./campaign-kpi-cards";
import { CampaignPerformanceChart } from "./campaign-performance-chart";
import { CampaignPostsSection } from "./campaign-posts-section";
import { ChartPanelSkeleton, DashboardKpiSkeleton, Skeleton } from "./ui/skeleton";

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

const parseChartDate = (rawDate: string) => {
  if (!rawDate) return null;
  const dateOnly = rawDate.split("T")[0];
  const [year, month, day] = dateOnly.split("-").map(Number);
  if (!year || !month || !day) return null;
  return new Date(Date.UTC(year, month - 1, day));
};

const formatChartDate = (date: Date) =>
  date.toLocaleDateString("en-US", {
    month: "numeric",
    day: "numeric",
    timeZone: "UTC",
  });

function buildSeriesFromPosts(
  posts: Array<{
    id?: string;
    platform: string;
    views: number;
    likes: number;
    comments: number;
    shares: number;
    postedDate: string | null;
    createdAt: string;
  }>,
) {
  const postsByDate = new Map<string, typeof posts>();

  posts.forEach((post) => {
    const rawDate = post.postedDate || post.createdAt;
    if (!rawDate) return;
    const dateStr = rawDate.split("T")[0];
    if (!postsByDate.has(dateStr)) {
      postsByDate.set(dateStr, []);
    }
    postsByDate.get(dateStr)!.push(post);
  });

  const sortedDates = Array.from(postsByDate.keys()).sort((a, b) =>
    a.localeCompare(b),
  );

  const series = {
    views: [] as Array<{ date: string; value: number }>,
    likes: [] as Array<{ date: string; value: number }>,
    comments: [] as Array<{ date: string; value: number }>,
    shares: [] as Array<{ date: string; value: number }>,
  };

  const currentPosts = new Map<string, (typeof posts)[number]>();

  sortedDates.forEach((date) => {
    const dayPosts = postsByDate.get(date) || [];
    dayPosts.forEach((post) => {
      const key = post.id || `${post.platform}-${post.postedDate || post.createdAt}`;
      currentPosts.set(key, post);
    });

    let views = 0;
    let likes = 0;
    let comments = 0;
    let shares = 0;

    currentPosts.forEach((post) => {
      views += post.views || 0;
      likes += post.likes || 0;
      comments += post.comments || 0;
      shares += post.shares || 0;
    });

    series.views.push({ date, value: views });
    series.likes.push({ date, value: likes });
    series.comments.push({ date, value: comments });
    series.shares.push({ date, value: shares });
  });

  return series;
}

// Transform API posts to PostWithRankings format
function transformPostsToRankings(
  posts: SharedCampaignData["posts"],
  campaignId: string,
): PostWithRankings[] {
  return posts.map((post, index) => ({
    id: post.id,
    campaign_id: campaignId,
    creator_id: post.creator?.id || "",
    platform: post.platform as Platform,
    post_url: post.postUrl,
    status: post.status as any,
    views: post.views,
    likes: post.likes,
    comments: post.comments,
    shares: post.shares,
    engagement_rate: post.engagementRate,
    posted_date: post.postedDate,
    last_scraped_at: null,
    created_at: post.createdAt,
    updated_at: post.createdAt,
    creator: post.creator
      ? {
          id: post.creator.id,
          user_id: "",
          name: post.creator.name,
          handle: post.creator.handle,
          platform: post.platform as Platform,
          follower_count: 0,
          avg_engagement: 0,
          email: null,
          phone: null,
          niche: null,
          location: null,
          source_type: null,
          imported_by_user_id: null,
          created_by_workspace_id: null,
          profile_url: null,
          display_name: null,
          country: null,
          state: null,
          city: null,
          contact_email: null,
          whatsapp: null,
          created_at: "",
          updated_at: "",
        }
      : ({} as any),
    rank: index + 1,
  }));
}

export function SharedCampaignDashboard() {
  const { token } = useParams<{ token: string }>();
  const navigate = useNavigate();
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<SharedCampaignData | null>(null);
  const [activeTab, setActiveTab] = useState<string>("all");
  const [password, setPassword] = useState("");
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [requiresPassword, setRequiresPassword] = useState(false);
  const [chartRange, setChartRange] = useState<ChartRange>("30d");

  // Load shared campaign data function
  const loadCampaign = React.useCallback(
    async (providedPassword?: string) => {
      if (!token) return;

      setIsLoading(true);
      setError(null);
      setPasswordError(null);

      try {
        const result = await sharingApi.fetchSharedCampaignData(
          token,
          providedPassword,
        );

        if (result.error) {
          const errorCode = (result.error as any)?.code;

          // Check if error is due to password requirement
          if (errorCode === "PASSWORD_REQUIRED") {
            setRequiresPassword(true);
            setIsLoading(false);
            return;
          }

          // Check if password was incorrect
          if (errorCode === "INCORRECT_PASSWORD") {
            setRequiresPassword(true);
            setPasswordError("Incorrect password. Please try again.");
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
        setError(
          err instanceof Error ? err.message : "Failed to load campaign",
        );
        setIsLoading(false);
      }
    },
    [token],
  );

  // Load shared campaign data on mount
  React.useEffect(() => {
    if (!token) {
      setError("Invalid share link");
      setIsLoading(false);
      return;
    }

    loadCampaign();
  }, [token, loadCampaign]);

  React.useEffect(() => {
    if (!data) return;
    if (
      !data.is_parent ||
      !data.subcampaigns ||
      data.subcampaigns.length === 0
    ) {
      if (activeTab !== "all") {
        setActiveTab("all");
      }
      return;
    }

    const tabExists =
      activeTab === "all" ||
      data.subcampaigns.some((subcampaign) => subcampaign.id === activeTab);
    if (!tabExists) {
      setActiveTab("all");
    }
  }, [data, activeTab]);

  const subcampaignTabs = data?.subcampaigns || [];
  const hasSubcampaigns = Boolean(
    data?.is_parent && subcampaignTabs.length > 0,
  );
  const selectedSubcampaign =
    activeTab === "all"
      ? null
      : subcampaignTabs.find((subcampaign) => subcampaign.id === activeTab) ||
        null;

  const filteredPosts = useMemo(() => {
    if (!data?.posts) return [];
    if (activeTab === "all") return data.posts;
    return data.posts.filter((post) => post.campaignId === activeTab);
  }, [data?.posts, activeTab]);

  const totals = useMemo(() => {
    return {
      views: filteredPosts.reduce((sum, post) => sum + (post.views || 0), 0),
      likes: filteredPosts.reduce((sum, post) => sum + (post.likes || 0), 0),
      comments: filteredPosts.reduce((sum, post) => sum + (post.comments || 0), 0),
      shares: filteredPosts.reduce((sum, post) => sum + (post.shares || 0), 0),
    };
  }, [filteredPosts]);

  const handlePasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!password.trim()) {
      setPasswordError("Please enter a password");
      return;
    }

    await loadCampaign(password);
  };

  // Transform posts to PostWithRankings format
  const postsWithRankings = useMemo(() => {
    if (!data) return [];
    return transformPostsToRankings(filteredPosts, data.campaign.id);
  }, [filteredPosts, data]);

  const handleExportCSV = () => {
    if (!data?.share?.allowExport) return;
    if (!filteredPosts.length) {
      toast.error("No posts to export");
      return;
    }

    const exportRows = filteredPosts.map((post) => ({
      creator: post.creator,
      platform: post.platform,
      post_url: post.postUrl,
      posted_date: post.postedDate || "",
      views: post.views || 0,
      likes: post.likes || 0,
      comments: post.comments || 0,
      shares: post.shares || 0,
    }));

    const csvContent = csvUtils.exportToCSV(exportRows as any);
    const filename = `${data.campaign.name.replace(/[^a-z0-9]/gi, "_")}_posts_${
      new Date().toISOString().split("T")[0]
    }.csv`;
    csvUtils.downloadCSV(csvContent, filename);
    toast.success("CSV exported successfully");
  };

  // Format chart data
  const seriesData = useMemo(() => {
    if (!data) return null;
    if (activeTab === "all") return data.series;
    return buildSeriesFromPosts(filteredPosts);
  }, [data, activeTab, filteredPosts]);

  const formattedChartData = useMemo<ChartDataPoint[]>(() => {
    if (!seriesData?.views) return [];

    const maxLength = Math.max(
      seriesData.views.length,
      seriesData.likes.length,
      seriesData.comments.length,
      seriesData.shares.length,
    );

    return Array.from({ length: maxLength }, (_, i) => {
      const rawDate =
        seriesData.views[i]?.date ||
        seriesData.likes[i]?.date ||
        seriesData.comments[i]?.date ||
        seriesData.shares[i]?.date ||
        "";
      const dateValue = parseChartDate(rawDate);
      if (!dateValue) return null;

      return {
        date: formatChartDate(dateValue),
        dateValue,
        views: seriesData.views[i]?.value || 0,
        likes: seriesData.likes[i]?.value || 0,
        comments: seriesData.comments[i]?.value || 0,
        shares: seriesData.shares[i]?.value || 0,
      };
    }).filter((point): point is ChartDataPoint => Boolean(point));
  }, [seriesData]);

  // Filter chart data by range
  const filteredChartData = useMemo(() => {
    if (chartRange === "all") return formattedChartData;
    const daysMap: Record<string, number> = {
      "7d": 7,
      "14d": 14,
      "30d": 30,
    };
    const days = daysMap[chartRange] || 30;
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - days + 1);
    return formattedChartData.filter((point) => {
      if (!point?.dateValue) return false;
      return point.dateValue >= cutoff;
    });
  }, [formattedChartData, chartRange]);

  // Show loading state (but not if password is required, as that has its own UI)
  if (isLoading && !requiresPassword && !error) {
    return (
      <div className="min-h-screen bg-[#0A0A0A] px-4 sm:px-6 py-6">
        <div className="mx-auto max-w-6xl space-y-6">
          <div className="flex items-center justify-between">
            <Skeleton className="h-8 w-48" />
            <Skeleton className="h-8 w-24" />
          </div>
          <DashboardKpiSkeleton />
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <ChartPanelSkeleton />
            <ChartPanelSkeleton />
          </div>
          <div className="bg-[#0D0D0D] border border-white/[0.08] rounded-lg p-4 space-y-3">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-10 w-full" />
            ))}
          </div>
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
                This shared dashboard is password protected. Please enter the
                password to continue.
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
      {/* View Only Header Banner */}
      <div className="border-b border-white/[0.08] bg-[#0D0D0D]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-2">
                <img
                  src={logoImage}
                  alt="DTTracker"
                  className="w-8 h-8 object-contain"
                />
                <h1 className="text-xl font-semibold text-white">DTTracker</h1>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content - Same layout as internal */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="space-y-5">
          {/* Subcampaign Tabs */}
          {hasSubcampaigns && (
            <div className="flex flex-wrap gap-2">
              <button
                onClick={() => setActiveTab("all")}
                className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-colors ${
                  activeTab === "all"
                    ? "bg-primary text-black border-primary"
                    : "bg-white/[0.03] text-slate-300 border-white/[0.08] hover:bg-white/[0.06]"
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
                      ? "bg-primary text-black border-primary"
                      : "bg-white/[0.03] text-slate-300 border-white/[0.08] hover:bg-white/[0.06]"
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

          {/* Campaign Header - Using shared component */}
          <CampaignHeader
            name={data.campaign.name}
            brandName={data.campaign.brand_name}
            coverImageUrl={data.campaign.coverImageUrl}
            status={data.campaign.status}
            mode="public"
          />

          {/* KPI Cards - Using shared component */}
          <CampaignKPICards
            views={totals.views}
            likes={totals.likes}
            comments={totals.comments}
            shares={totals.shares}
          />

          {/* Performance Charts - Using shared component */}
          <CampaignPerformanceChart
            chartData={filteredChartData}
            chartRange={chartRange}
            onChartRangeChange={setChartRange}
          />

          {/* Posts Section - Using shared component */}
          <CampaignPostsSection
            posts={postsWithRankings}
            mode="public"
            campaignId={data.campaign.id}
            isLoading={false}
            onExportCSV={data.share?.allowExport ? handleExportCSV : undefined}
          />
        </div>
      </div>
    </div>
  );
}
