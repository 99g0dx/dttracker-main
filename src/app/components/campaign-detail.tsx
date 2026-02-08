import React, { useState, useEffect, useRef } from "react";
import { useParams } from "react-router-dom";
import { Card, CardContent } from "./ui/card";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import {
  ArrowLeft,
  Plus,
  Search,
  Filter,
  Trash2,
  RefreshCw,
  Download,
  Upload,
  Edit2,
  MoreHorizontal,
  ExternalLink,
  Link as LinkIcon,
  ChevronLeft,
  ChevronRight,
  Eye,
  Heart,
  MessageCircle,
  Share2,
  Users,
  X,
} from "lucide-react";
import { StatusBadge } from "./status-badge";
import {
  PlatformIcon,
  normalizePlatform,
  getPlatformLabel,
} from "./ui/PlatformIcon";
import { CampaignHeaderSkeleton, PostRowSkeleton } from "./ui/skeleton";
import { cn } from "./ui/utils";
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
} from "recharts";
import {
  campaignsKeys,
  useCampaign,
  useDeleteCampaign,
} from "../../hooks/useCampaigns";
import { useWorkspace } from "../../contexts/WorkspaceContext";
import {
  usePosts,
  useCampaignMetricsTimeSeries,
  useDeletePost,
  useDeleteAllPosts,
  useCreateManyPosts,
  postsKeys,
} from "../../hooks/usePosts";
import {
  useCampaignHierarchyMetrics,
  useIsParentCampaign,
  subcampaignsKeys,
} from "../../hooks/useSubcampaigns";
import { useScrapeAllPosts, useScrapePost } from "../../hooks/useScraping";
import { addNotification } from "../../lib/utils/notifications";
import {
  useCreatorsByCampaign,
  useRemoveCreatorFromCampaign,
} from "../../hooks/useCreators";
import * as csvUtils from "../../lib/utils/csv";
import { formatWithGrowth } from "../../lib/utils/format";
import { getCampaignCoverGradient } from "../../lib/utils/campaign-gradients";
import type { CSVImportResult } from "../../lib/types/database";
import { toast } from "sonner";
import { AddPostDialog } from "./add-post-dialog";
import { ImportCreatorsDialog } from "./import-creators-dialog";
import { CampaignShareModal } from "./campaign-share-modal";
import { SubcampaignSection } from "./subcampaign-section";
import { CampaignSoundSection } from "./campaign-sound-section";
import { SoundIngest } from "./sound-ingest";
import { useQueryClient } from "@tanstack/react-query";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "./ui/dialog";
import { ResponsiveConfirmDialog } from "./ui/responsive-confirm-dialog";
import { supabase } from "../../lib/supabase";
import * as campaignsApi from "../../lib/api/campaigns";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "./ui/tabs";
import { useMediaQuery } from "../../hooks/useMediaQuery";
import { PostCard } from "./post-card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "./ui/dropdown-menu";
import {
  useSound,
  useSoundVideos,
  useLinkSoundToCampaign,
  useUnlinkSoundFromCampaign,
  useRefreshSound,
} from "../../hooks/useSounds";
import type { Creator } from "../../lib/types/database";
import { useWorkspaceAccess } from "../../hooks/useWorkspaceAccess";

interface CampaignDetailProps {
  onNavigate: (path: string) => void;
}

export function CampaignDetail({ onNavigate }: CampaignDetailProps) {
  const { id } = useParams<{ id: string }>();
  const [searchQuery, setSearchQuery] = useState("");
  const [creatorSearchQuery, setCreatorSearchQuery] = useState("");
  const [selectedPlatform, setSelectedPlatform] = useState<string>("all");
  const [sortBy, setSortBy] = useState<
    "score" | "views" | "engagement" | "latest"
  >("score");
  const [showTopPerformers, setShowTopPerformers] = useState(false);
  const [showImportCreatorsDialog, setShowImportCreatorsDialog] =
    useState(false);
  const [showImportPostsDialog, setShowImportPostsDialog] = useState(false);
  const [showAddPostDialog, setShowAddPostDialog] = useState(false);
  const [showScrapeAllDialog, setShowScrapeAllDialog] = useState(false);
  const [showDeleteAllDialog, setShowDeleteAllDialog] = useState(false);
  const [showDeletePostDialog, setShowDeletePostDialog] = useState<
    string | null
  >(null);
  const [showDeleteCampaignDialog, setShowDeleteCampaignDialog] =
    useState(false);
  const [showShareLinkModal, setShowShareLinkModal] = useState(false);
  const [showAddSoundDialog, setShowAddSoundDialog] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [isImporting, setIsImporting] = useState(false);
  const [importResult, setImportResult] = useState<CSVImportResult | null>(
    null
  );
  const [renderError, setRenderError] = useState<Error | null>(null);
  const [activeMetric, setActiveMetric] = useState<
    "views" | "likes" | "comments" | "shares"
  >("views");
  const isMobile = useMediaQuery("(max-width: 640px)");
  const isCompactMobile = useMediaQuery("(max-width: 479px)");
  const { canEditCampaign, canDeleteCampaign } = useWorkspaceAccess();
  const canEditThisCampaign = id ? canEditCampaign(id) : false;
  const [chartRange, setChartRange] = useState<"7d" | "14d" | "30d" | "all">(
    "14d"
  );
  const [chartPlatformFilter, setChartPlatformFilter] = useState<string>("all");
  const [chartsReady, setChartsReady] = useState(false);
  const [postFiltersOpen, setPostFiltersOpen] = useState(false);
  const [postPlatformFilter, setPostPlatformFilter] = useState("all");
  const [postStatusFilter, setPostStatusFilter] = useState("all");
  const [postCreatorFilter, setPostCreatorFilter] = useState("all");
  const [postDateFilter, setPostDateFilter] = useState("all");
  const [activeCreator, setActiveCreator] = useState<Creator | null>(null);
  const [creatorDrawerOpen, setCreatorDrawerOpen] = useState(false);
  const [creatorToRemove, setCreatorToRemove] = useState<{
    id: string;
    name: string;
  } | null>(null);
  const removeCreatorMutation = useRemoveCreatorFromCampaign();
  const [expandedPlatforms, setExpandedPlatforms] = useState<
    Record<string, boolean>
  >({});
  const postsPerPage = 10;

  React.useEffect(() => {
    setChartRange(isMobile ? "14d" : "30d");
  }, [isMobile]);

  React.useEffect(() => {
    if (chartsReady) return;
    if (typeof window === "undefined") return;
    const idleCallback =
      "requestIdleCallback" in window
        ? (window.requestIdleCallback as (cb: () => void) => number)
        : null;
    const timeoutId = idleCallback
      ? idleCallback(() => setChartsReady(true))
      : window.setTimeout(() => setChartsReady(true), 1);
    return () => {
      if (idleCallback) {
        (
          window as typeof window & {
            cancelIdleCallback?: (id: number) => void;
          }
        ).cancelIdleCallback?.(timeoutId);
        return;
      }
      window.clearTimeout(timeoutId);
    };
  }, [chartsReady]);

  // Validate ID
  if (!id) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-4">
          <button
            onClick={() => onNavigate("/campaigns")}
            className="w-11 h-11 rounded-md bg-muted/60 hover:bg-muted/80 border border-border flex items-center justify-center transition-colors"
            aria-label="Back to campaigns"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">
            Invalid Campaign
          </h1>
        </div>
        <Card className="bg-card border-border">
          <CardContent className="p-6">
            <p className="text-muted-foreground">No campaign ID provided.</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Error boundary for component
  if (renderError) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-4">
          <button
            onClick={() => onNavigate("/campaigns")}
            className="w-11 h-11 rounded-md bg-muted/60 hover:bg-muted/80 border border-border flex items-center justify-center transition-colors"
            aria-label="Back to campaigns"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">
            Error Loading Campaign
          </h1>
        </div>
        <Card className="bg-card border-border">
          <CardContent className="p-6">
            <p className="text-red-600 dark:text-red-400 mb-2">
              An error occurred while loading the campaign:
            </p>
            <p className="text-muted-foreground text-sm">{renderError.message}</p>
            <button
              onClick={() => {
                setRenderError(null);
                window.location.reload();
              }}
              className="mt-4 h-9 px-4 rounded-md bg-primary hover:bg-primary/90 text-primary-foreground text-sm font-medium"
            >
              Reload Page
            </button>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Fetch campaign data - hooks must be called unconditionally
  const queryClient = useQueryClient();
  const { activeWorkspaceId } = useWorkspace();
  const {
    data: campaign,
    isLoading: campaignLoading,
    error: campaignError,
  } = useCampaign(id);
  const { data: isParent } = useIsParentCampaign(id || "");
  const {
    data: posts = [],
    isLoading: postsLoading,
    refetch: refetchPosts,
  } = usePosts(id, Boolean(isParent));
  const { data: hierarchyMetrics } = useCampaignHierarchyMetrics(id || "");
  const { data: chartData = [] } = useCampaignMetricsTimeSeries(
    id,
    chartPlatformFilter === "all" ? undefined : chartPlatformFilter
  );
  const { data: campaignCreators = [] } = useCreatorsByCampaign(id || "");
  const coverGradient = React.useMemo(
    () =>
      getCampaignCoverGradient(
        campaign?.id || campaign?.name || id || "campaign"
      ),
    [campaign?.id, campaign?.name, id]
  );

  // Sound tracking hooks
  const {
    data: linkedSound,
    isLoading: soundLoading,
    error: soundError,
  } = useSound(campaign?.sound_id);
  const { data: soundVideos = [], isLoading: videosLoading } = useSoundVideos(
    campaign?.sound_id,
    "views"
  );
  const linkSoundMutation = useLinkSoundToCampaign();
  const unlinkSoundMutation = useUnlinkSoundFromCampaign();
  const refreshSoundMutation = useRefreshSound();

  const derivedCampaignStatus = React.useMemo(() => {
    if (!campaign) return null;
    if (campaign.status === "archived") return campaign.status;
    if (campaign.end_date) {
      const endDate = new Date(campaign.end_date);
      if (!Number.isNaN(endDate.getTime()) && new Date() > endDate) {
        return "completed";
      }
    }
    return campaign.status;
  }, [campaign]);

  const lastStatusUpdateRef = useRef<string | null>(null);

  useEffect(() => {
    if (!campaign || !id || !derivedCampaignStatus) return;
    if (derivedCampaignStatus === campaign.status) return;
    if (lastStatusUpdateRef.current === derivedCampaignStatus) return;

    lastStatusUpdateRef.current = derivedCampaignStatus;

    const updateStatus = async () => {
      const result = await campaignsApi.update(campaign.id, {
        status: derivedCampaignStatus,
      });

      if (result.error) {
        if (import.meta.env.DEV) {
          console.error("Failed to auto-update campaign status:", result.error);
        }
        lastStatusUpdateRef.current = null;
        return;
      }

      queryClient.setQueryData(
        campaignsKeys.detail(campaign.id),
        (old: any) => {
          if (!old) return old;
          return {
            ...old,
            status: derivedCampaignStatus,
            updated_at: new Date().toISOString(),
          };
        }
      );
      queryClient.invalidateQueries({
        queryKey: campaignsKeys.lists(activeWorkspaceId),
      });
    };

    updateStatus();
  }, [campaign, derivedCampaignStatus, id, queryClient]);

  // Calculate metrics for KPI cards (all platforms) with fallback to RPC when posts are unavailable
  const metrics = React.useMemo(() => {
    if (posts && posts.length > 0) {
      const calculated = {
        total_posts: posts.length,
        total_views: posts.reduce((sum, p) => sum + (Number(p.views) || 0), 0),
        total_likes: posts.reduce((sum, p) => sum + (Number(p.likes) || 0), 0),
        total_comments: posts.reduce(
          (sum, p) => sum + (Number(p.comments) || 0),
          0
        ),
        total_shares: posts.reduce(
          (sum, p) => sum + (Number(p.shares) || 0),
          0
        ),
        avg_engagement_rate:
          posts.length > 0
            ? posts.reduce(
                (sum, p) => sum + (Number(p.engagement_rate) || 0),
                0
              ) / posts.length
            : 0,
        total_reach: posts.reduce((sum, p) => sum + (Number(p.views) || 0), 0),
      };

      return calculated;
    }

    const rpcMetrics = hierarchyMetrics?.aggregated_metrics;

    // Return RPC metrics if posts are not available
    return (
      rpcMetrics || {
        total_posts: 0,
        total_views: 0,
        total_likes: 0,
        total_comments: 0,
        total_shares: 0,
        avg_engagement_rate: 0,
        total_reach: 0,
      }
    );
  }, [hierarchyMetrics, posts]);

  const deletePostMutation = useDeletePost();
  const deleteAllPostsMutation = useDeleteAllPosts();
  const deleteCampaignMutation = useDeleteCampaign();
  const createManyPostsMutation = useCreateManyPosts();
  const scrapeAllPostsMutation = useScrapeAllPosts();
  const scrapePostMutation = useScrapePost();
  const activeScrapePostId = scrapePostMutation.isPending
    ? (scrapePostMutation.variables?.postId ?? null)
    : null;
  const isScrapeAllPending = scrapeAllPostsMutation.isPending;

  // 3-tier smart polling system for auto-refresh
  const lastMutationTimeRef = useRef<number>(0);

  useEffect(() => {
    if (!id) return;

    const refetch = () => {
      queryClient.refetchQueries({
        queryKey: postsKeys.list(id, Boolean(isParent)),
      });
      queryClient.refetchQueries({ queryKey: subcampaignsKeys.metrics(id) });
    };

    // Track when mutations occur
    const isMutationPending =
      scrapeAllPostsMutation.isPending || scrapePostMutation.isPending;
    if (isMutationPending) {
      lastMutationTimeRef.current = Date.now();
    }

    // Tier 1: Active scraping - check if ANY posts are currently being scraped
    const hasScrapingPosts = posts?.some((p) => p.status === "scraping");

    if (hasScrapingPosts || isMutationPending) {
      // Fast polling during active scraping (every 2 seconds)
      // console.log("🔄 Tier 1: Active scraping detected, polling every 2s");
      const intervalId = setInterval(refetch, 2000);
      return () => clearInterval(intervalId);
    }

    // Tier 2: Recent activity - poll for 60 seconds after last mutation
    const timeSinceLastMutation = Date.now() - lastMutationTimeRef.current;
    if (timeSinceLastMutation < 60000) {
      // 1 minute
      // console.log("🔄 Tier 2: Recent activity, polling every 5s");
      const intervalId = setInterval(refetch, 5000);
      return () => clearInterval(intervalId);
    }

    // Tier 3: Idle monitoring - always poll to catch background scrapes & stuck posts
    // console.log("🔄 Tier 3: Idle monitoring, polling every 30s");
    const intervalId = setInterval(refetch, 30000);
    return () => clearInterval(intervalId);
  }, [
    scrapeAllPostsMutation.isPending,
    scrapePostMutation.isPending,
    id,
    queryClient,
    posts,
  ]);

  // Auto-reset stuck posts (posts in "scraping" status for >10 minutes)
  useEffect(() => {
    if (!posts || !id) return;

    // Find posts stuck in "scraping" status for >10 minutes
    const stuckPosts = posts.filter((post) => {
      if (post.status !== "scraping") return false;

      const updatedAt = new Date(post.updated_at).getTime();
      const now = Date.now();
      const minutesStuck = (now - updatedAt) / (1000 * 60);

      return minutesStuck > 10;
    });

    if (stuckPosts.length > 0) {
      if (import.meta.env.DEV) {
        console.warn(
          `⚠️ Found ${stuckPosts.length} stuck posts, resetting to pending...`
        );
      }

      // Reset stuck posts to "pending" status
      stuckPosts.forEach(async (post) => {
        try {
          await supabase
            .from("posts")
            .update({ status: "pending" })
            .eq("id", post.id);
        } catch (error) {
          if (import.meta.env.DEV) {
            console.error(`❌ Failed to reset post ${post.id}:`, error);
          }
        }
      });

      // Refetch after reset
      setTimeout(() => {
        queryClient.refetchQueries({ queryKey: postsKeys.lists() });
      }, 1000);
    }
  }, [posts, id, queryClient]);

  const platformOrder: Array<
    "tiktok" | "instagram" | "youtube" | "twitter" | "facebook"
  > = ["tiktok", "instagram", "youtube", "twitter", "facebook"];

  // Helper functions for scoring and KPI filtering
  // Updated to return true for all platforms (previously filtered to TikTok/Instagram only)
  const isKpiPlatform = (platform?: string | null) => {
    // Now includes all platforms in KPIs and charts
    return true;
  };

  const calculatePostScore = (post: PostWithCreator): number => {
    const views = Number(post.views || 0);
    const likes = Number(post.likes || 0);
    const comments = Number(post.comments || 0);
    const shares = Number(post.shares || 0);
    return views + likes * 8 + comments * 20 + shares * 25;
  };

  // Calculate KPI metrics from all posts (all platforms) to match displayed KPI cards
  const kpiMetrics = React.useMemo(() => {
    if (!posts || posts.length === 0) {
      return {
        total_views: 0,
        total_likes: 0,
        total_comments: 0,
        total_shares: 0,
      };
    }

    // Include all platforms to match chart data
    return {
      total_views: posts.reduce((sum, p) => sum + (Number(p.views) || 0), 0),
      total_likes: posts.reduce((sum, p) => sum + (Number(p.likes) || 0), 0),
      total_comments: posts.reduce(
        (sum, p) => sum + (Number(p.comments) || 0),
        0
      ),
      total_shares: posts.reduce((sum, p) => sum + (Number(p.shares) || 0), 0),
    };
  }, [posts]);

  // Format chart data for recharts with error handling
  const formattedChartData = React.useMemo(() => {
    if (!Array.isArray(chartData) || chartData.length === 0) {
      return [];
    }
    try {
      const formatted = chartData
        .map((point) => {
          if (!point || typeof point !== "object") return null;
          try {
            const date = point.date ? new Date(point.date) : new Date();
            const dateValue = isNaN(date.getTime()) ? null : date;
            return {
              date: isNaN(date.getTime())
                ? "Invalid Date"
                : date.toLocaleDateString("en-US", {
                    month: "numeric",
                    day: "numeric",
                  }),
              dateValue,
              views: Number(point.views) || 0,
              likes: Number(point.likes) || 0,
              comments: Number(point.comments) || 0,
              shares: Number(point.shares) || 0,
            };
          } catch (e) {
            if (import.meta.env.DEV) {
              console.error("Error formatting chart data point:", e, point);
            }
            return null;
          }
        })
        .filter(Boolean);

      // Dev-only: Verify latest chart point matches KPI card totals
      if (process.env.NODE_ENV === "development") {
        const latestPoint = formatted.reduce(
          (latest, point) => {
            if (!point?.dateValue) return latest;
            if (!latest?.dateValue || point.dateValue > latest.dateValue) {
              return point;
            }
            return latest;
          },
          null as (typeof formatted)[number] | null
        );
        const chartLatestViews = latestPoint?.views ?? 0;
        const chartLatestLikes = latestPoint?.likes ?? 0;
        const chartLatestComments = latestPoint?.comments ?? 0;
        const chartLatestShares = latestPoint?.shares ?? 0;

        // Chart data now includes all platforms, so compare against KPI totals
        const viewsMatch =
          Math.abs(chartLatestViews - kpiMetrics.total_views) < 1;
        const likesMatch =
          Math.abs(chartLatestLikes - kpiMetrics.total_likes) < 1;
        const commentsMatch =
          Math.abs(chartLatestComments - kpiMetrics.total_comments) < 1;
        const sharesMatch =
          Math.abs(chartLatestShares - kpiMetrics.total_shares) < 1;

        // Warn if there's a mismatch (dev mode only)
        if (import.meta.env.DEV && (!viewsMatch || !likesMatch || !commentsMatch || !sharesMatch)) {
          console.warn(
            "[Graph Alignment Warning]",
            "Chart totals do not match KPI card totals. This may indicate a data inconsistency."
          );
        }
      }

      return formatted;
    } catch (e) {
      if (import.meta.env.DEV) {
        console.error("Error formatting chart data:", e);
      }
      return [];
    }
  }, [chartData, kpiMetrics]);

  const chartRangeLabel = React.useMemo(() => {
    switch (chartRange) {
      case "7d":
        return "Last 7 days";
      case "14d":
        return "Last 14 days";
      case "30d":
        return "Last 30 days";
      default:
        return "All time";
    }
  }, [chartRange]);

  const filteredChartData = React.useMemo(() => {
    if (chartRange === "all") return formattedChartData;
    const daysMap: Record<string, number> = {
      "7d": 7,
      "14d": 14,
      "30d": 30,
    };
    const days = daysMap[chartRange] || 14;
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - days + 1);
    return formattedChartData.filter((point) => {
      if (!point?.dateValue) return false;
      return point.dateValue >= cutoff;
    });
  }, [formattedChartData, chartRange]);

  // Calculate metrics from the latest chart point in the selected range
  const filteredMetrics = React.useMemo(() => {
    const fallback = {
      total_views: kpiMetrics.total_views ?? 0,
      total_likes: kpiMetrics.total_likes ?? 0,
      total_comments: kpiMetrics.total_comments ?? 0,
      total_shares: kpiMetrics.total_shares ?? 0,
    };

    if (!filteredChartData || filteredChartData.length === 0) {
      return fallback;
    }

    const latestPoint = filteredChartData.reduce(
      (latest, point) => {
        if (!point?.dateValue) return latest;
        if (!latest?.dateValue || point.dateValue > latest.dateValue) {
          return point;
        }
        return latest;
      },
      null as (typeof filteredChartData)[number] | null
    );

    if (!latestPoint) {
      return fallback;
    }

    const totals = {
      total_views: Number(latestPoint.views) || 0,
      total_likes: Number(latestPoint.likes) || 0,
      total_comments: Number(latestPoint.comments) || 0,
      total_shares: Number(latestPoint.shares) || 0,
    };

    // Debug logging removed for production

    return totals;
  }, [filteredChartData, kpiMetrics, chartRange]);

  React.useEffect(() => {
    if (!campaign || !activeWorkspaceId) return;
    if (campaign.workspace_id && campaign.workspace_id !== activeWorkspaceId) {
      toast.info("Workspace changed. Returning to campaigns.");
      onNavigate("/campaigns");
    }
  }, [campaign, activeWorkspaceId, onNavigate]);

  const chartXAxisProps = React.useMemo(
    () => ({
      stroke: "var(--muted-foreground)",
      fontSize: 11,
      tickLine: false,
      axisLine: { stroke: "var(--border)" },
      minTickGap: isMobile ? 18 : 8,
      interval: isMobile ? "preserveStartEnd" : "preserveEnd",
    }),
    [isMobile]
  );

  const formatChartTick = React.useCallback((value: number) => {
    const numericValue = Number(value) || 0;
    if (numericValue >= 1_000_000) {
      const formatted = (numericValue / 1_000_000).toFixed(
        numericValue % 1_000_000 === 0 ? 0 : 1
      );
      return `${formatted}M`;
    }
    if (numericValue >= 1_000) {
      const formatted = (numericValue / 1_000).toFixed(
        numericValue % 1_000 === 0 ? 0 : 1
      );
      return `${formatted}K`;
    }
    return numericValue.toString();
  }, []);

  const chartTooltipFormatter = React.useCallback((value: number | string) => {
    const numericValue = Number(value);
    if (Number.isNaN(numericValue)) {
      return value;
    }
    return numericValue.toLocaleString();
  }, []);

  const chartTooltipStyle = React.useMemo(
    () => ({
      backgroundColor: "var(--popover)",
      color: "var(--popover-foreground)",
      border: "1px solid var(--border)",
      borderRadius: "12px",
      fontSize: "12px",
      padding: "10px 12px",
    }),
    []
  );

  // Filter, score, and sort posts
  const filteredPosts = React.useMemo(() => {
    if (!Array.isArray(posts)) return [];
    try {
      // Step 1: Apply search filter
      let filtered = posts.filter((post) => {
        if (!post) return false;
        const searchLower = searchQuery.trim().toLowerCase();
        if (!searchLower) return true;
        const name = post.creator?.name?.toLowerCase() || "";
        const handle = (
          post.creator?.handle ||
          post.owner_username ||
          ""
        ).toLowerCase();
        const postUrl = post.post_url?.toLowerCase() || "";
        const platform = post.platform?.toLowerCase() || "";
        const status = post.status?.toLowerCase() || "";
        return (
          name.includes(searchLower) ||
          handle.includes(searchLower) ||
          postUrl.includes(searchLower) ||
          platform.includes(searchLower) ||
          status.includes(searchLower)
        );
      });

      // Step 2: Apply filters
      if (postPlatformFilter !== "all") {
        filtered = filtered.filter(
          (post) => post.platform === postPlatformFilter
        );
      }

      if (postStatusFilter !== "all") {
        filtered = filtered.filter((post) => post.status === postStatusFilter);
      }

      if (postCreatorFilter !== "all") {
        filtered = filtered.filter(
          (post) => post.creator_id === postCreatorFilter
        );
      }

      if (postDateFilter !== "all") {
        const daysMap: Record<string, number> = {
          "7d": 7,
          "30d": 30,
          "90d": 90,
        };
        const days = daysMap[postDateFilter];
        if (days) {
          const cutoff = new Date();
          cutoff.setDate(cutoff.getDate() - days);
          filtered = filtered.filter((post) => {
            const rawDate =
              post.posted_date || post.updated_at || post.created_at || "";
            if (!rawDate) return false;
            return new Date(rawDate) >= cutoff;
          });
        }
      }

      // Step 3: Add scores to posts
      const postsWithScores = filtered.map((post) => ({
        ...post,
        score: calculatePostScore(post),
      }));

      // Step 4: Apply Top Performers filter if enabled
      if (showTopPerformers) {
        const kpiPosts = postsWithScores.filter((post) =>
          isKpiPlatform(post.platform)
        );
        // Sort by score desc and limit to top 15
        const sorted = [...kpiPosts].sort((a, b) => b.score - a.score);
        return sorted.slice(0, 15);
      }

      // Step 5: Sort by selected method
      const sorted = [...postsWithScores].sort((a, b) => {
        switch (sortBy) {
          case "score":
            return b.score - a.score;
          case "views":
            return (b.views || 0) - (a.views || 0);
          case "engagement":
            return (b.engagement_rate || 0) - (a.engagement_rate || 0);
          case "latest":
            const aDate =
              a.posted_date ||
              a.last_scraped_at ||
              a.updated_at ||
              a.created_at ||
              "";
            const bDate =
              b.posted_date ||
              b.last_scraped_at ||
              b.updated_at ||
              b.created_at ||
              "";
            return new Date(bDate).getTime() - new Date(aDate).getTime();
          default:
            return 0;
        }
      });

      return sorted;
    } catch (e) {
      if (import.meta.env.DEV) {
        console.error("Error filtering posts:", e);
      }
      return posts;
    }
  }, [
    posts,
    searchQuery,
    sortBy,
    showTopPerformers,
    postPlatformFilter,
    postStatusFilter,
    postCreatorFilter,
    postDateFilter,
  ]);

  // Deduplicate campaign creators by creator_id to ensure uniqueness
  const uniqueRosterCreators = React.useMemo(() => {
    if (!Array.isArray(campaignCreators)) return [];
    const uniqueMap = new Map<string, (typeof campaignCreators)[0]>();
    campaignCreators.forEach((creator) => {
      if (creator.id && !uniqueMap.has(creator.id)) {
        uniqueMap.set(creator.id, creator);
      }
    });
    return Array.from(uniqueMap.values());
  }, [campaignCreators]);

  const filteredCreators = React.useMemo(() => {
    if (!Array.isArray(uniqueRosterCreators)) return [];

    let filtered = uniqueRosterCreators;

    // Search filter
    const searchLower = creatorSearchQuery.trim().toLowerCase();
    if (searchLower) {
      filtered = filtered.filter((creator) => {
        const name = creator.name?.toLowerCase() || "";
        const handle = creator.handle?.toLowerCase() || "";
        return name.includes(searchLower) || handle.includes(searchLower);
      });
    }

    // Platform filter
    if (selectedPlatform !== "all") {
      filtered = filtered.filter(
        (creator) => creator.platform === selectedPlatform
      );
    }

    // Ensure no duplicates in filtered results
    const filteredMap = new Map<string, (typeof uniqueRosterCreators)[0]>();
    filtered.forEach((creator) => {
      if (creator.id && !filteredMap.has(creator.id)) {
        filteredMap.set(creator.id, creator);
      }
    });
    return Array.from(filteredMap.values());
  }, [uniqueRosterCreators, creatorSearchQuery, selectedPlatform]);

  const creatorPlatformCounts = React.useMemo(() => {
    const counts: Record<string, number> = {
      all: uniqueRosterCreators.length,
      tiktok: 0,
      instagram: 0,
      youtube: 0,
      twitter: 0,
      facebook: 0,
    };
    // Count unique creators by platform
    const platformSet = new Map<string, Set<string>>();
    uniqueRosterCreators.forEach((creator) => {
      if (creator.id) {
        if (!platformSet.has(creator.platform)) {
          platformSet.set(creator.platform, new Set());
        }
        platformSet.get(creator.platform)?.add(creator.id);
      }
    });
    platformSet.forEach((ids, platform) => {
      counts[platform] = ids.size;
    });
    return counts;
  }, [uniqueRosterCreators]);

  const postCreatorOptions = React.useMemo(() => {
    const map = new Map<string, string>();
    posts.forEach((post) => {
      if (post.creator_id && post.creator?.name) {
        map.set(post.creator_id, post.creator.name);
      }
    });
    return Array.from(map.entries()).map(([id, name]) => ({ id, name }));
  }, [posts]);

  const activeCreatorPosts = React.useMemo(() => {
    if (!activeCreator) return [];
    return posts.filter((post) => post.creator_id === activeCreator.id);
  }, [activeCreator, posts]);

  const activePostFilterCount = React.useMemo(() => {
    return [
      postPlatformFilter,
      postStatusFilter,
      postCreatorFilter,
      postDateFilter,
    ].filter((value) => value !== "all").length;
  }, [postPlatformFilter, postStatusFilter, postCreatorFilter, postDateFilter]);

  const hasPostRefinements = React.useMemo(
    () => searchQuery.trim().length > 0 || activePostFilterCount > 0,
    [searchQuery, activePostFilterCount]
  );

  const activePostFilters = React.useMemo(() => {
    const filters: Array<{ key: string; label: string; onClear: () => void }> =
      [];
    const formatLabel = (value: string) =>
      value.replace(/_/g, " ").replace(/\b\w/g, (char) => char.toUpperCase());

    if (postPlatformFilter !== "all") {
      filters.push({
        key: "platform",
        label: `Platform: ${formatLabel(postPlatformFilter)}`,
        onClear: () => setPostPlatformFilter("all"),
      });
    }

    if (postStatusFilter !== "all") {
      const statusDisplayMap: Record<string, string> = {
        pending: "Pending",
        scraping: "Scraping",
        complete: "Complete",
        failed: "Update delayed",
      };
      filters.push({
        key: "status",
        label: `Status: ${statusDisplayMap[postStatusFilter] ?? formatLabel(postStatusFilter)}`,
        onClear: () => setPostStatusFilter("all"),
      });
    }

    if (postCreatorFilter !== "all") {
      const creatorName =
        postCreatorOptions.find((creator) => creator.id === postCreatorFilter)
          ?.name || "Creator";
      filters.push({
        key: "creator",
        label: `Creator: ${creatorName}`,
        onClear: () => setPostCreatorFilter("all"),
      });
    }

    if (postDateFilter !== "all") {
      const rangeLabelMap: Record<string, string> = {
        "7d": "Last 7 days",
        "30d": "Last 30 days",
        "90d": "Last 90 days",
      };
      filters.push({
        key: "date",
        label: `Date: ${rangeLabelMap[postDateFilter] || postDateFilter}`,
        onClear: () => setPostDateFilter("all"),
      });
    }

    return filters;
  }, [
    postPlatformFilter,
    postStatusFilter,
    postCreatorFilter,
    postDateFilter,
    postCreatorOptions,
  ]);

  const groupedCreators = React.useMemo(() => {
    const groups = new Map<string, typeof filteredCreators>();
    platformOrder.forEach((platform) => groups.set(platform, []));

    // Deduplicate while grouping by platform
    const creatorIdsInGroup = new Map<string, Set<string>>();
    filteredCreators.forEach((creator) => {
      if (creator.id) {
        const platform = creator.platform;
        if (!creatorIdsInGroup.has(platform)) {
          creatorIdsInGroup.set(platform, new Set());
        }

        // Only add if not already in group
        if (!creatorIdsInGroup.get(platform)?.has(creator.id)) {
          const existing = groups.get(platform) || [];
          existing.push(creator);
          groups.set(platform, existing);
          creatorIdsInGroup.get(platform)?.add(creator.id);
        }
      }
    });

    return platformOrder
      .map((platform) => {
        const creators = (groups.get(platform) || [])
          .slice()
          .sort((a, b) => a.name.localeCompare(b.name));
        return { platform, creators };
      })
      .filter((group) => group.creators.length > 0);
  }, [filteredCreators, platformOrder]);

  // Calculate rankings and badges
  const postsWithRankings = React.useMemo(() => {
    if (!Array.isArray(filteredPosts)) return [];

    // Filter posts that are eligible for badges:
    // 1. Must be KPI platform (TikTok or Instagram) - exclude X/Twitter
    // 2. Must have actual metrics (at least one metric > 0)
    const eligiblePosts = filteredPosts.filter((post) => {
      if (!isKpiPlatform(post.platform)) return false; // Exclude X/Twitter

      // Check if post has any metrics
      const hasMetrics =
        (post.views && post.views > 0) ||
        (post.likes && post.likes > 0) ||
        (post.comments && post.comments > 0) ||
        (post.shares && post.shares > 0);

      return hasMetrics;
    });

    // Calculate rankings based on score (only for eligible posts)
    const sortedByScore = [...eligiblePosts].sort(
      (a, b) => (b.score || 0) - (a.score || 0)
    );
    const totalEligiblePosts = sortedByScore.length;
    const top20PercentThreshold = Math.ceil(totalEligiblePosts * 0.2);

    // Check for trending posts (scraped within 24h and in top 20%)
    const now = new Date().getTime();
    const twentyFourHoursAgo = now - 24 * 60 * 60 * 1000;

    // Get position emoji for top 5
    const getPositionEmoji = (rank: number): string | null => {
      switch (rank) {
        case 1:
          return "🥇";
        case 2:
          return "🥈";
        case 3:
          return "🥉";
        case 4:
          return "🏅";
        case 5:
          return "🎖️";
        default:
          return null;
      }
    };

    return filteredPosts.map((post) => {
      // Check if this post is eligible for badges
      const isEligible =
        isKpiPlatform(post.platform) &&
        ((post.views && post.views > 0) ||
          (post.likes && post.likes > 0) ||
          (post.comments && post.comments > 0) ||
          (post.shares && post.shares > 0));

      if (!isEligible) {
        return {
          ...post,
          rank: null,
          positionEmoji: null,
          badges: {
            trending: false,
          },
        };
      }

      // Find rank among eligible posts only
      const scoreRank = sortedByScore.findIndex((p) => p.id === post.id) + 1;
      const isTop20Percent = scoreRank <= top20PercentThreshold;

      // Check if trending (recent scrape + top 20%)
      const lastScraped = post.last_scraped_at
        ? new Date(post.last_scraped_at).getTime()
        : 0;
      const isRecentScrape = lastScraped > twentyFourHoursAgo;
      const isTrending = isRecentScrape && isTop20Percent;

      return {
        ...post,
        rank: scoreRank,
        positionEmoji: getPositionEmoji(scoreRank),
        badges: {
          trending: isTrending && scoreRank > 5, // Only show trending if not in top 5
        },
      };
    });
  }, [filteredPosts]);

  // Calculate top 5 posts, respecting search/filters when active
  const topPosts = React.useMemo(() => {
    const sourcePosts = hasPostRefinements ? filteredPosts : posts;
    if (!Array.isArray(sourcePosts)) return [];

    // Calculate scores for source posts
    const allPostsWithScores = sourcePosts
      .filter((post) => post && post.creator && isKpiPlatform(post.platform))
      .map((post) => ({
        ...post,
        score: calculatePostScore(post),
      }));

    // Sort by score descending and take top 5 globally
    const sortedByScore = [...allPostsWithScores].sort(
      (a, b) => (b.score || 0) - (a.score || 0)
    );
    return sortedByScore.slice(0, 5);
  }, [posts, filteredPosts, hasPostRefinements]);

  const shouldHighlightTopPosts = sortBy === "score";
  const highlightedTopPosts = React.useMemo(
    () => (shouldHighlightTopPosts ? topPosts : []),
    [shouldHighlightTopPosts, topPosts]
  );

  React.useEffect(() => {
    if (!shouldHighlightTopPosts && showTopPerformers) {
      setShowTopPerformers(false);
    }
  }, [shouldHighlightTopPosts, showTopPerformers]);

  const remainingPosts = React.useMemo(() => {
    const topPostIds = new Set(highlightedTopPosts.map((p) => p.id));
    return postsWithRankings.filter((p) => !topPostIds.has(p.id));
  }, [postsWithRankings, highlightedTopPosts]);

  // Track top performers and send notifications
  React.useEffect(() => {
    if (!postsWithRankings.length || !id) return;

    // Get previously notified posts from localStorage
    const notifiedKey = `top-performers-${id}`;
    const previouslyNotified = JSON.parse(
      localStorage.getItem(notifiedKey) || "[]"
    ) as string[];

    // Check for new top 5 posts
    const top5PostIds = topPosts
      .filter((post) => post.positionEmoji && isKpiPlatform(post.platform))
      .map((post) => post.id);

    // Find newly entered top 5 posts
    const newTopPerformers = top5PostIds.filter(
      (postId) => !previouslyNotified.includes(postId)
    );

    // Send notifications for new top performers
    newTopPerformers.forEach((postId) => {
      const post = postsWithRankings.find((p) => p.id === postId);
      if (post && post.creator) {
        addNotification({
          type: "top_performer",
          title: "Post performing really well! 🎉",
          message: `${post.creator.name}'s post is now in the top 5 performers!`,
        });
      }
    });

    // Update localStorage with all top 5 post IDs
    if (newTopPerformers.length > 0) {
      localStorage.setItem(notifiedKey, JSON.stringify(top5PostIds));
    }
  }, [topPosts, postsWithRankings, id]);

  // Safe pagination calculations
  const totalPages = Math.max(
    1,
    Math.ceil((remainingPosts?.length || 0) / postsPerPage)
  );
  const safeCurrentPage = Math.min(Math.max(1, currentPage), totalPages);
  const startIndex = (safeCurrentPage - 1) * postsPerPage;
  const paginatedRemainingPosts = (remainingPosts || []).slice(
    startIndex,
    startIndex + postsPerPage
  );
  const visibleRemainingPosts = paginatedRemainingPosts;

  const mobilePaginationPages = React.useMemo(() => {
    if (totalPages <= 4) {
      return Array.from({ length: totalPages }, (_, index) => index + 1);
    }
    const pages = new Set<number>([1, totalPages, safeCurrentPage]);
    if (safeCurrentPage - 1 > 1) pages.add(safeCurrentPage - 1);
    if (safeCurrentPage + 1 < totalPages) pages.add(safeCurrentPage + 1);
    return Array.from(pages).sort((a, b) => a - b);
  }, [totalPages, safeCurrentPage]);

  const mobileTotalPages = React.useMemo(() => {
    if (!showTopPerformers) return totalPages;
    return Math.max(
      1,
      Math.ceil((postsWithRankings?.length || 0) / postsPerPage)
    );
  }, [showTopPerformers, postsWithRankings, postsPerPage, totalPages]);

  const mobileSafeCurrentPage = Math.min(
    Math.max(1, currentPage),
    mobileTotalPages
  );
  const mobileStartIndex = (mobileSafeCurrentPage - 1) * postsPerPage;
  const mobilePaginatedPosts = showTopPerformers
    ? (postsWithRankings || []).slice(
        mobileStartIndex,
        mobileStartIndex + postsPerPage
      )
    : visibleRemainingPosts;

  const mobileAllPaginationPages = React.useMemo(() => {
    if (mobileTotalPages <= 4) {
      return Array.from({ length: mobileTotalPages }, (_, index) => index + 1);
    }
    const pages = new Set<number>([1, mobileTotalPages, mobileSafeCurrentPage]);
    if (mobileSafeCurrentPage - 1 > 1) pages.add(mobileSafeCurrentPage - 1);
    if (mobileSafeCurrentPage + 1 < mobileTotalPages)
      pages.add(mobileSafeCurrentPage + 1);
    return Array.from(pages).sort((a, b) => a - b);
  }, [mobileTotalPages, mobileSafeCurrentPage]);

  // Sync currentPage if it's out of bounds
  useEffect(() => {
    if (totalPages > 0 && currentPage > totalPages) {
      setCurrentPage(totalPages);
    } else if (currentPage < 1) {
      setCurrentPage(1);
    }
  }, [totalPages]); // Only depend on totalPages to avoid infinite loops

  const ensureCanEdit = (message?: string) => {
    if (canEditThisCampaign) return true;
    toast.error(message || "Read-only access: editing is disabled.");
    return false;
  };

  const handleImportCreators = () => {
    if (!ensureCanEdit()) return;
    setShowImportCreatorsDialog(true);
  };

  const handleImportPosts = () => {
    if (!ensureCanEdit()) return;
    setShowImportPostsDialog(true);
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!ensureCanEdit()) return;
    const file = e.target.files?.[0];
    if (!file || !id) return;

    setIsImporting(true);
    setImportResult(null);

    try {
      // Parse CSV and create posts
      const result = await csvUtils.parseCSV(file, id);

      if (result.posts.length > 0) {
        // Import posts using mutation
        await createManyPostsMutation.mutateAsync(result.posts);
      }

      setImportResult({
        success_count: result.success_count,
        error_count: result.error_count,
        errors: result.errors,
      });

      // Close dialog after 3 seconds if successful
      if (result.error_count === 0) {
        setTimeout(() => {
          setShowImportDialog(false);
          setImportResult(null);
        }, 3000);
      }
    } catch (error) {
      toast.error("Failed to import CSV");
      if (import.meta.env.DEV) {
        console.error(error);
      }
    } finally {
      setIsImporting(false);
      // Reset file input
      e.target.value = "";
    }
  };

  const handleScrapeAll = () => {
    if (!id) return;
    if (!ensureCanEdit()) return;
    scrapeAllPostsMutation.mutate(id);
    setShowScrapeAllDialog(false);
  };

  const handleDeleteAll = () => {
    if (!id) return;
    if (!ensureCanEdit()) return;
    deleteAllPostsMutation.mutate(id);
    setShowDeleteAllDialog(false);
  };

  const handleDeletePost = (postId: string) => {
    if (!id) return;
    if (!ensureCanEdit()) return;
    deletePostMutation.mutate({ id: postId, campaignId: id });
    setShowDeletePostDialog(null);
  };

  const handleDeleteCampaign = () => {
    if (!campaign?.id) return;
    deleteCampaignMutation.mutate(campaign.id);
    setShowDeleteCampaignDialog(false);
    onNavigate("/campaigns");
  };

  const handleScrapePost = (postId: string) => {
    if (!id) return;
    if (!ensureCanEdit()) return;

    // Find the post in the posts array
    const post = posts?.find((p) => p.id === postId);
    if (!post || !post.post_url) {
      toast.error("Post not found or missing URL");
      return;
    }

    scrapePostMutation.mutate({
      postId: post.id,
      postUrl: post.post_url,
      platform: post.platform as
        | "tiktok"
        | "instagram"
        | "youtube"
        | "twitter"
        | "facebook",
      campaignId: id,
    });
  };

  const handleExportCSV = async () => {
    if (!campaign || posts.length === 0) return;
    if (!activeWorkspaceId) return;

    const { data: exportGate, error: exportGateError } = await supabase.rpc(
      "record_export_and_check_limit",
      { p_workspace_id: activeWorkspaceId }
    );
    const result = Array.isArray(exportGate) ? exportGate[0] : exportGate;
    if (exportGateError || !result?.allowed) {
      toast.error("Export limit reached for today. Try again tomorrow.");
      return;
    }

    const csvContent = csvUtils.exportToCSV(posts);
    const filename = `${campaign.name.replace(/[^a-z0-9]/gi, "_")}_posts_${
      new Date().toISOString().split("T")[0]
    }.csv`;
    csvUtils.downloadCSV(csvContent, filename);

    toast.success("CSV exported successfully");
  };

  const handleDownloadTemplate = () => {
    const template = `creator_name,creator_handle,platform,post_url,posted_date,views,likes,comments,shares
John Doe,@johndoe,tiktok,https://tiktok.com/@johndoe/video/123,2024-01-15,10000,500,50,20
Jane Smith,@janesmith,instagram,https://instagram.com/p/abc123,2024-01-16,5000,300,25,10`;

    csvUtils.downloadCSV(template, "campaign_posts_template.csv");
    toast.success("Template downloaded");
  };

  // Show loading only if campaign is loading (posts can load separately)
  if (campaignLoading) {
    return (
      <div className="space-y-6">
        <CampaignHeaderSkeleton />
      </div>
    );
  }

  // Error state - only show if campaign failed to load and we're not still loading
  if (campaignError && !campaignLoading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-4">
          <button
            onClick={() => onNavigate("/campaigns")}
            className="w-11 h-11 rounded-md bg-muted/60 hover:bg-muted/80 border border-border flex items-center justify-center transition-colors"
            aria-label="Back to campaigns"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">
            Campaign not found
          </h1>
        </div>
        <Card className="bg-card border-border">
          <CardContent className="p-6">
            <p className="text-muted-foreground">
              {campaignError?.message ||
                "The campaign you are looking for does not exist."}
            </p>
            {id && (
              <p className="text-xs text-muted-foreground mt-2">Campaign ID: {id}</p>
            )}
          </CardContent>
        </Card>
      </div>
    );
  }

  // If no campaign data after loading, show error
  if (!campaign && !campaignLoading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-4">
          <button
            onClick={() => onNavigate("/campaigns")}
            className="w-11 h-11 rounded-md bg-muted/60 hover:bg-muted/80 border border-border flex items-center justify-center transition-colors"
            aria-label="Back to campaigns"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">
            Campaign not found
          </h1>
        </div>
        <Card className="bg-card border-border">
          <CardContent className="p-6">
            <p className="text-muted-foreground">
              The campaign you are looking for does not exist.
            </p>
            {id && (
              <p className="text-xs text-muted-foreground mt-2">Campaign ID: {id}</p>
            )}
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-5 pt-0 sm:pt-0 lg:pt-0">
      {campaign?.parent_campaign_id && (
        <button
          onClick={() =>
            onNavigate(`/campaigns/${campaign.parent_campaign_id}`)
          }
          className="text-sm text-muted-foreground hover:text-foreground transition-colors flex items-center gap-2"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Parent Campaign
        </button>
      )}
      {/* Header */}
      <div className="flex flex-col gap-3 sm:gap-4 mt-2 sm:mt-0">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex items-start gap-3">
            <button
              onClick={() => onNavigate("/campaigns")}
              className="w-11 h-11 flex-shrink-0 rounded-md bg-muted/60 hover:bg-muted/80 border border-border flex items-center justify-center transition-colors"
              aria-label="Back to campaigns"
            >
              <ArrowLeft className="w-4 h-4" />
            </button>
            <div className="min-w-0">
              <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3">
                <div className="min-w-0">
                  <h1 className="text-xl sm:text-2xl font-semibold tracking-tight text-foreground break-words overflow-hidden [display:-webkit-box] [-webkit-line-clamp:2] [-webkit-box-orient:vertical] sm:[-webkit-line-clamp:1]">
                    {campaign.name}
                  </h1>
                  {campaign.brand_name && (
                    <p className="text-sm text-muted-foreground mt-1 break-words">
                      {campaign.brand_name}
                    </p>
                  )}
                </div>
                <StatusBadge
                  status={derivedCampaignStatus || campaign.status}
                  className="flex-shrink-0"
                />
              </div>
            </div>
          </div>
          {campaign && (
            <div className="grid grid-cols-1 min-[360px]:grid-cols-2 gap-2 w-full sm:flex sm:gap-2 sm:w-auto">
              <button
                onClick={() => {
                  if (
                    !ensureCanEdit(
                      "You do not have permission to share campaigns."
                    )
                  )
                    return;
                  setShowShareLinkModal(true);
                }}
                disabled={!canEditThisCampaign}
                className="h-11 px-3 rounded-md bg-primary hover:bg-primary/90 text-primary-foreground text-sm font-medium flex items-center justify-center gap-2 transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
                aria-label="Share campaign link"
              >
                <Share2 className="w-4 h-4" />
                <span className="hidden sm:inline">Share Link</span>
                <span className="sm:hidden">Share</span>
              </button>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button
                    type="button"
                    className="h-11 px-3 rounded-md bg-muted/60 hover:bg-muted/80 border border-border text-sm text-foreground flex items-center justify-center gap-2 transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
                    aria-label="Campaign actions"
                    disabled={!canEditThisCampaign}
                  >
                    <MoreHorizontal className="w-4 h-4" />
                    <span>Action</span>
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent
                  align="end"
                  className="w-52 bg-popover text-popover-foreground border-border"
                >
                  <DropdownMenuItem
                    onSelect={() => {
                      if (
                        !ensureCanEdit(
                          "You do not have permission to edit campaigns."
                        )
                      )
                        return;
                      onNavigate(`/campaigns/${campaign.id}/edit`);
                    }}
                    disabled={!canEditThisCampaign}
                    className="text-foreground [&_svg]:text-foreground"
                  >
                    <Edit2 className="w-4 h-4" />
                    Edit Campaign
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    variant="destructive"
                    onSelect={() => {
                      if (!canDeleteCampaign) {
                        toast.error(
                          "You do not have permission to delete campaigns."
                        );
                        return;
                      }
                      setShowDeleteCampaignDialog(true);
                    }}
                    disabled={
                      !canDeleteCampaign || deleteCampaignMutation.isPending
                    }
                  >
                    <Trash2 className="w-4 h-4" />
                    Delete Campaign
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          )}
        </div>
      </div>

      {/* Cover Image Hero Section */}
      {campaign && (
        <div className="relative w-full aspect-[16/9] sm:aspect-[21/9] lg:aspect-[24/9] max-h-[240px] sm:max-h-[300px] rounded-xl overflow-hidden border border-border shadow-lg shadow-black/20">
          {campaign.cover_image_url ? (
            <>
              <img
                src={campaign.cover_image_url}
                alt={campaign.name}
                className="w-full h-full object-cover transition-opacity duration-300"
                onError={(e) => {
                  // Fallback to gradient if image fails to load
                  const target = e.target as HTMLImageElement;
                  target.style.display = "none";
                  const parent = target.parentElement;
                  if (parent) {
                    const fallback = parent.querySelector(
                      ".gradient-fallback"
                    ) as HTMLElement;
                    if (fallback) fallback.style.display = "flex";
                  }
                }}
              />
              <div
                className={`gradient-fallback hidden w-full h-full ${coverGradient} items-center justify-center`}
              >
                <h2 className="text-3xl sm:text-5xl font-bold text-foreground/90">
                  {campaign.name.charAt(0).toUpperCase()}
                </h2>
              </div>
            </>
          ) : (
            <div
              className={`w-full h-full ${coverGradient} flex items-center justify-center relative overflow-hidden`}
            >
              {/* Subtle pattern overlay */}
              <div
                className="absolute inset-0 opacity-10"
                style={{
                  backgroundImage:
                    "radial-gradient(circle at 2px 2px, white 1px, transparent 0)",
                  backgroundSize: "24px 24px",
                }}
              />
              <h2 className="text-3xl sm:text-5xl font-bold text-foreground/90 relative z-10">
                {campaign.name.charAt(0).toUpperCase()}
              </h2>
            </div>
          )}
          {/* Enhanced gradient overlay for better text readability */}
          <div className="absolute inset-0 bg-gradient-to-t from-[#0D0D0D]/90 via-[#0D0D0D]/50 to-transparent" />
          {/* Text content with improved spacing and typography */}
          <div className="absolute bottom-6 left-6 right-6">
            <h2 className="text-xl sm:text-3xl font-bold text-foreground mb-2 drop-shadow-lg">
              {campaign.name}
            </h2>
            {campaign.brand_name && (
              <p className="text-sm sm:text-lg text-foreground font-semibold drop-shadow-md">
                {campaign.brand_name}
              </p>
            )}
          </div>
        </div>
      )}

      {/* KPI Cards - Performance Metrics */}
      <div className="grid grid-cols-1 min-[360px]:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <Card className="bg-card border-border">
          <CardContent className="p-3 sm:p-5">
            <div className="flex items-start justify-between mb-2 sm:mb-3">
              <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                <Eye className="w-4 h-4 sm:w-5 sm:h-5 text-primary" />
              </div>
            </div>
            <div className="text-lg sm:text-2xl font-semibold text-foreground mb-1">
              {(filteredMetrics.total_views ?? 0).toLocaleString()}
            </div>
            <p className="text-xs sm:text-sm text-muted-foreground">Total Views</p>
          </CardContent>
        </Card>

        <Card className="bg-card border-border">
          <CardContent className="p-3 sm:p-5">
            <div className="flex items-start justify-between mb-2 sm:mb-3">
              <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-lg bg-pink-500/10 flex items-center justify-center">
                <Heart className="w-4 h-4 sm:w-5 sm:h-5 text-pink-400" />
              </div>
            </div>
            <div className="text-lg sm:text-2xl font-semibold text-foreground mb-1">
              {(filteredMetrics.total_likes ?? 0).toLocaleString()}
            </div>
            <p className="text-xs sm:text-sm text-muted-foreground">Total Likes</p>
          </CardContent>
        </Card>

        <Card className="bg-card border-border">
          <CardContent className="p-3 sm:p-5">
            <div className="flex items-start justify-between mb-2 sm:mb-3">
              <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-lg bg-red-100/70 dark:bg-cyan-500/10 flex items-center justify-center">
                <MessageCircle className="w-4 h-4 sm:w-5 sm:h-5 text-red-600 dark:text-cyan-400" />
              </div>
            </div>
            <div className="text-lg sm:text-2xl font-semibold text-foreground mb-1">
              {(filteredMetrics.total_comments ?? 0).toLocaleString()}
            </div>
            <p className="text-xs sm:text-sm text-muted-foreground">Total Comments</p>
          </CardContent>
        </Card>

        <Card className="bg-card border-border">
          <CardContent className="p-3 sm:p-5">
            <div className="flex items-start justify-between mb-2 sm:mb-3">
              <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-lg bg-purple-500/10 flex items-center justify-center">
                <Share2 className="w-4 h-4 sm:w-5 sm:h-5 text-purple-400" />
              </div>
            </div>
            <div className="text-lg sm:text-2xl font-semibold text-foreground mb-1">
              {(filteredMetrics.total_shares ?? 0).toLocaleString()}
            </div>
            <p className="text-xs sm:text-sm text-muted-foreground">Total Shares</p>
          </CardContent>
        </Card>
      </div>

      {/* Chart Range and Platform Filters */}
      <div className="flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-6">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
            Timeframe
          </span>
          <div className="flex flex-wrap gap-2">
            {[
              { value: "7d", label: "7D" },
              { value: "14d", label: "14D" },
              { value: "30d", label: "30D" },
              { value: "all", label: "All" },
            ].map((range) => (
              <button
                key={range.value}
                onClick={() =>
                  setChartRange(range.value as "7d" | "14d" | "30d" | "all")
                }
                aria-pressed={chartRange === range.value}
                className={`h-10 px-3 rounded-full border text-xs font-semibold tracking-wide transition-colors ${
                  chartRange === range.value
                    ? "bg-primary text-primary-foreground border-primary"
                    : "bg-muted/60 border-border text-foreground hover:bg-muted/80"
                }`}
              >
                {range.label}
              </button>
            ))}
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
            Platform
          </span>
          <div className="flex flex-wrap gap-2">
            {[
              { value: "all", label: "All" },
              { value: "tiktok", label: "TikTok" },
              { value: "instagram", label: "Instagram" },
              { value: "youtube", label: "YouTube" },
            ].map((platform) => (
              <button
                key={platform.value}
                onClick={() => setChartPlatformFilter(platform.value)}
                aria-pressed={chartPlatformFilter === platform.value}
                className={`h-10 px-3 rounded-full border text-xs font-semibold tracking-wide transition-colors ${
                  chartPlatformFilter === platform.value
                    ? "bg-primary text-primary-foreground border-primary"
                    : "bg-muted/60 border-border text-foreground hover:bg-muted/80"
                }`}
              >
                {platform.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {chartsReady ? (
        <>
          {/* Performance Charts */}
          {/* Mobile: Tabbed Interface */}
          <Tabs
            value={activeMetric}
            onValueChange={(value) =>
              setActiveMetric(value as typeof activeMetric)
            }
            className="lg:hidden"
          >
            <TabsList className="grid w-full max-w-[360px] sm:max-w-none grid-cols-4 gap-1 h-11 bg-muted/60 border border-border p-1 mx-auto sm:mx-0 overflow-y-hidden">
              <TabsTrigger
                value="views"
                className="flex items-center gap-1.5 data-[state=active]:bg-muted/80 h-10 text-xs sm:text-sm px-3 whitespace-nowrap"
              >
                <Eye className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Views</span>
              </TabsTrigger>
              <TabsTrigger
                value="likes"
                className="flex items-center gap-1.5 data-[state=active]:bg-muted/80 h-10 text-xs sm:text-sm px-3 whitespace-nowrap"
              >
                <Heart className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Likes</span>
              </TabsTrigger>
              <TabsTrigger
                value="comments"
                className="flex items-center gap-1.5 data-[state=active]:bg-muted/80 h-10 text-xs sm:text-sm px-3 whitespace-nowrap"
              >
                <MessageCircle className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Comments</span>
              </TabsTrigger>
              <TabsTrigger
                value="shares"
                className="flex items-center gap-1.5 data-[state=active]:bg-muted/80 h-10 text-xs sm:text-sm px-3 whitespace-nowrap"
              >
                <Share2 className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Shares</span>
              </TabsTrigger>
            </TabsList>

            <TabsContent
              value="views"
              className="mt-4 animate-in fade-in-50 duration-200"
            >
              <Card className="bg-card border-border">
                <CardContent className="p-4 sm:p-6">
                  <div className="mb-4">
                    <h3 className="text-base font-semibold text-foreground flex items-center gap-2">
                      <Eye className="w-4 h-4 text-primary" />
                      Views Over Time
                    </h3>
                    <p className="text-sm text-muted-foreground mt-0.5">
                      {chartRangeLabel}
                    </p>
                  </div>
                  <ResponsiveContainer width="100%" height={280}>
                    <LineChart data={filteredChartData}>
                      <CartesianGrid
                        strokeDasharray="3 3"
                        stroke="var(--border)"
                        vertical={false}
                      />
                      <XAxis dataKey="date" {...chartXAxisProps} />
                      <YAxis
                        stroke="var(--muted-foreground)"
                        fontSize={11}
                        tickLine={false}
                        axisLine={false}
                        tickFormatter={formatChartTick}
                      />
                      <Tooltip
                        contentStyle={chartTooltipStyle}
                        formatter={chartTooltipFormatter}
                      />
                      <Line
                        type="monotone"
                        dataKey="views"
                        stroke="var(--chart-1)"
                        strokeWidth={2}
                        dot={false}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent
              value="likes"
              className="mt-4 animate-in fade-in-50 duration-200"
            >
              <Card className="bg-card border-border">
                <CardContent className="p-4 sm:p-6">
                  <div className="mb-4">
                    <h3 className="text-base font-semibold text-foreground flex items-center gap-2">
                      <Heart className="w-4 h-4 text-pink-400" />
                      Likes Over Time
                    </h3>
                    <p className="text-sm text-muted-foreground mt-0.5">
                      {chartRangeLabel}
                    </p>
                  </div>
                  <ResponsiveContainer width="100%" height={280}>
                    <LineChart data={filteredChartData}>
                      <CartesianGrid
                        strokeDasharray="3 3"
                        stroke="var(--border)"
                        vertical={false}
                      />
                      <XAxis dataKey="date" {...chartXAxisProps} />
                      <YAxis
                        stroke="var(--muted-foreground)"
                        fontSize={11}
                        tickLine={false}
                        axisLine={false}
                        tickFormatter={formatChartTick}
                      />
                      <Tooltip
                        contentStyle={chartTooltipStyle}
                        formatter={chartTooltipFormatter}
                      />
                      <Line
                        type="monotone"
                        dataKey="likes"
                        stroke="var(--chart-5)"
                        strokeWidth={2}
                        dot={false}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent
              value="comments"
              className="mt-4 animate-in fade-in-50 duration-200"
            >
              <Card className="bg-card border-border">
                <CardContent className="p-4 sm:p-6">
                  <div className="mb-4">
                    <h3 className="text-base font-semibold text-foreground flex items-center gap-2">
                      <MessageCircle className="w-4 h-4 text-red-600 dark:text-cyan-400" />
                      Comments Over Time
                    </h3>
                    <p className="text-sm text-muted-foreground mt-0.5">
                      {chartRangeLabel}
                    </p>
                  </div>
                  <ResponsiveContainer width="100%" height={280}>
                    <LineChart data={filteredChartData}>
                      <CartesianGrid
                        strokeDasharray="3 3"
                        stroke="var(--border)"
                        vertical={false}
                      />
                      <XAxis dataKey="date" {...chartXAxisProps} />
                      <YAxis
                        stroke="var(--muted-foreground)"
                        fontSize={11}
                        tickLine={false}
                        axisLine={false}
                        tickFormatter={formatChartTick}
                      />
                      <Tooltip
                        contentStyle={chartTooltipStyle}
                        formatter={chartTooltipFormatter}
                      />
                      <Line
                        type="monotone"
                        dataKey="comments"
                        stroke="var(--chart-3)"
                        strokeWidth={2}
                        dot={false}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent
              value="shares"
              className="mt-4 animate-in fade-in-50 duration-200"
            >
              <Card className="bg-card border-border">
                <CardContent className="p-4 sm:p-6">
                  <div className="mb-4">
                    <h3 className="text-base font-semibold text-foreground flex items-center gap-2">
                      <Share2 className="w-4 h-4 text-purple-400" />
                      Shares Over Time
                    </h3>
                    <p className="text-sm text-muted-foreground mt-0.5">
                      {chartRangeLabel}
                    </p>
                  </div>
                  <ResponsiveContainer width="100%" height={280}>
                    <LineChart data={filteredChartData}>
                      <CartesianGrid
                        strokeDasharray="3 3"
                        stroke="var(--border)"
                        vertical={false}
                      />
                      <XAxis dataKey="date" {...chartXAxisProps} />
                      <YAxis
                        stroke="var(--muted-foreground)"
                        fontSize={11}
                        tickLine={false}
                        axisLine={false}
                        tickFormatter={formatChartTick}
                      />
                      <Tooltip
                        contentStyle={chartTooltipStyle}
                        formatter={chartTooltipFormatter}
                      />
                      <Line
                        type="monotone"
                        dataKey="shares"
                        stroke="var(--chart-2)"
                        strokeWidth={2}
                        dot={false}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>

          {/* Desktop: Keep existing 2x2 grid */}
          <div className="hidden lg:grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* Views Over Time */}
            <Card className="bg-card border-border">
              <CardContent className="p-6">
                <div className="mb-4">
                  <h3 className="text-base font-semibold text-foreground">
                    Views Over Time
                  </h3>
                  <p className="text-sm text-muted-foreground mt-0.5">
                    {chartRangeLabel}
                  </p>
                </div>
                <ResponsiveContainer width="100%" height={220}>
                  <LineChart data={filteredChartData}>
                    <CartesianGrid
                      strokeDasharray="3 3"
                      stroke="var(--border)"
                      vertical={false}
                    />
                    <XAxis dataKey="date" {...chartXAxisProps} />
                    <YAxis
                      stroke="var(--muted-foreground)"
                      fontSize={11}
                      tickLine={false}
                      axisLine={false}
                      tickFormatter={formatChartTick}
                    />
                    <Tooltip
                      contentStyle={chartTooltipStyle}
                      formatter={chartTooltipFormatter}
                    />
                    <Line
                      type="monotone"
                      dataKey="views"
                      stroke="var(--chart-1)"
                      strokeWidth={2}
                      dot={false}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            {/* Likes Over Time */}
            <Card className="bg-card border-border">
              <CardContent className="p-6">
                <div className="mb-4">
                  <h3 className="text-base font-semibold text-foreground">
                    Likes Over Time
                  </h3>
                  <p className="text-sm text-muted-foreground mt-0.5">
                    {chartRangeLabel}
                  </p>
                </div>
                <ResponsiveContainer width="100%" height={220}>
                  <LineChart data={filteredChartData}>
                    <CartesianGrid
                      strokeDasharray="3 3"
                      stroke="var(--border)"
                      vertical={false}
                    />
                    <XAxis dataKey="date" {...chartXAxisProps} />
                    <YAxis
                      stroke="var(--muted-foreground)"
                      fontSize={11}
                      tickLine={false}
                      axisLine={false}
                      tickFormatter={formatChartTick}
                    />
                    <Tooltip
                      contentStyle={chartTooltipStyle}
                      formatter={chartTooltipFormatter}
                    />
                    <Line
                      type="monotone"
                      dataKey="likes"
                      stroke="var(--chart-5)"
                      strokeWidth={2}
                      dot={false}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            {/* Comments Over Time */}
            <Card className="bg-card border-border">
              <CardContent className="p-6">
                <div className="mb-4">
                  <h3 className="text-base font-semibold text-foreground">
                    Comments Over Time
                  </h3>
                  <p className="text-sm text-muted-foreground mt-0.5">
                    {chartRangeLabel}
                  </p>
                </div>
                <ResponsiveContainer width="100%" height={220}>
                  <LineChart data={filteredChartData}>
                    <CartesianGrid
                      strokeDasharray="3 3"
                      stroke="var(--border)"
                      vertical={false}
                    />
                    <XAxis dataKey="date" {...chartXAxisProps} />
                    <YAxis
                      stroke="var(--muted-foreground)"
                      fontSize={11}
                      tickLine={false}
                      axisLine={false}
                      tickFormatter={formatChartTick}
                    />
                    <Tooltip
                      contentStyle={chartTooltipStyle}
                      formatter={chartTooltipFormatter}
                    />
                    <Line
                      type="monotone"
                      dataKey="comments"
                      stroke="var(--chart-3)"
                      strokeWidth={2}
                      dot={false}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            {/* Shares Over Time */}
            <Card className="bg-card border-border">
              <CardContent className="p-6">
                <div className="mb-4">
                  <h3 className="text-base font-semibold text-foreground">
                    Shares Over Time
                  </h3>
                  <p className="text-sm text-muted-foreground mt-0.5">
                    {chartRangeLabel}
                  </p>
                </div>
                <ResponsiveContainer width="100%" height={220}>
                  <LineChart data={filteredChartData}>
                    <CartesianGrid
                      strokeDasharray="3 3"
                      stroke="var(--border)"
                      vertical={false}
                    />
                    <XAxis dataKey="date" {...chartXAxisProps} />
                    <YAxis
                      stroke="var(--muted-foreground)"
                      fontSize={11}
                      tickLine={false}
                      axisLine={false}
                      tickFormatter={formatChartTick}
                    />
                    <Tooltip
                      contentStyle={chartTooltipStyle}
                      formatter={chartTooltipFormatter}
                    />
                    <Line
                      type="monotone"
                      dataKey="shares"
                      stroke="var(--chart-2)"
                      strokeWidth={2}
                      dot={false}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </div>
        </>
      ) : (
        <Card className="bg-card border-border">
          <CardContent className="p-6">
            <div className="text-sm text-muted-foreground">Loading charts...</div>
          </CardContent>
        </Card>
      )}

      {isParent && campaign && (
        <SubcampaignSection
          parentCampaignId={campaign.id}
          parentCampaignName={campaign.name}
          parentBrandName={campaign.brand_name || null}
        />
      )}

      {/* Sound Tracking Section */}
      {campaign && (
        <>
          <CampaignSoundSection
            campaignId={campaign.id}
            sound={linkedSound || null}
            soundVideos={soundVideos}
            loading={
              refreshSoundMutation.isPending || soundLoading || videosLoading
            }
            onAddSound={() => setShowAddSoundDialog(true)}
            onRemoveSound={() => {
              if (confirm("Remove sound from this campaign?")) {
                unlinkSoundMutation.mutate(campaign.id);
              }
            }}
            onRefreshSound={() => {
              if (linkedSound?.id) {
                refreshSoundMutation.mutate(linkedSound.id);
              } else if (campaign?.sound_id) {
                // If sound_id exists but sound data isn't loaded, try to refresh
                refreshSoundMutation.mutate(campaign.sound_id);
              }
            }}
          />

          {/* Add Sound Dialog */}
          <Dialog
            open={showAddSoundDialog}
            onOpenChange={setShowAddSoundDialog}
          >
            <DialogContent className="max-w-2xl">
              <DialogHeader>
                <DialogTitle>Link Sound to Campaign</DialogTitle>
                <DialogDescription>
                  Paste a TikTok or Instagram link to start tracking the sound
                  used in that post.
                </DialogDescription>
              </DialogHeader>
              <SoundIngest
                campaignId={campaign.id}
                onSuccess={() => {
                  setShowAddSoundDialog(false);
                  // Refresh campaign data to show linked sound
                  queryClient.invalidateQueries({
                    queryKey: campaignsKeys.detail(campaign.id),
                  });
                  // Also invalidate sound queries
                  queryClient.invalidateQueries({
                    queryKey: ["sounds"],
                  });
                }}
                onSoundDetected={async (sound) => {
                  // The sound-tracking function should have already linked it,
                  // but link it again as a fallback to ensure it's linked
                  if (campaign?.id && sound.id) {
                    try {
                      await linkSoundMutation.mutateAsync({
                        campaignId: campaign.id,
                        soundId: sound.id,
                        soundUrl: sound.sound_page_url || undefined,
                      });
                    } catch (error) {
                      // If linking fails, it might already be linked, which is fine
                      if (import.meta.env.DEV) {
                        console.log("Sound may already be linked:", error);
                      }
                    }
                  }
                }}
              />
            </DialogContent>
          </Dialog>
        </>
      )}

      {/* Creators Section */}
      {campaignCreators.length > 0 && (
        <Card className="bg-card border-border/60 shadow-2xl">
          <CardContent className="p-5 md:p-6">
            {/* Header Section */}
            <div className="flex flex-col gap-4 mb-6">
              <div>
                <h3 className="text-base sm:text-lg font-bold text-foreground tracking-tight">
                  Campaign Roster
                </h3>
                <p className="text-xs text-muted-foreground mt-1 uppercase tracking-wider font-semibold">
                  {creatorSearchQuery || selectedPlatform !== "all"
                    ? `Showing ${filteredCreators.length} of ${uniqueRosterCreators.length} Active Participants`
                    : `${uniqueRosterCreators.length} of ${uniqueRosterCreators.length} Active Participants`}
                </p>
              </div>

              {/* Optimized Filters */}
              <div className="flex flex-col gap-3">
                <div className="relative w-full group">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground group-focus-within:text-primary transition-colors" />
                  <Input
                    type="search"
                    value={creatorSearchQuery}
                    onChange={(e) => setCreatorSearchQuery(e.target.value)}
                    placeholder="Search creators..."
                    className="pl-9 bg-muted/70 border-border/60 text-foreground rounded-xl focus:ring-primary/20"
                  />
                </div>
                <div className="flex flex-wrap gap-2">
                  {[
                    { value: "all", label: "All" },
                    { value: "tiktok", label: "TikTok" },
                    { value: "instagram", label: "Instagram" },
                    { value: "youtube", label: "YouTube" },
                  ].map((platform) => (
                    <button
                      key={platform.value}
                      onClick={() => setSelectedPlatform(platform.value)}
                      className={`h-10 px-3 rounded-full border text-xs font-semibold tracking-wider transition-colors flex items-center gap-2 ${
                        selectedPlatform === platform.value
                          ? "bg-primary text-primary-foreground border-primary"
                          : "bg-muted/60 border-border text-foreground hover:bg-muted/80"
                      }`}
                    >
                      {platform.value === "all" ? (
                        <span className="uppercase">All</span>
                      ) : (
                        (() => {
                          const platformIcon = normalizePlatform(
                            platform.value
                          );
                          if (!platformIcon) return null;
                          return (
                            <>
                              <PlatformIcon
                                platform={platformIcon}
                                size="sm"
                                className="sm:hidden"
                                aria-label={`${getPlatformLabel(platformIcon)} creators`}
                              />
                              <PlatformIcon
                                platform={platformIcon}
                                size="md"
                                className="hidden sm:flex"
                                aria-label={`${getPlatformLabel(platformIcon)} creators`}
                              />
                            </>
                          );
                        })()
                      )}
                      <span className="text-[10px] font-semibold text-muted-foreground">
                        {creatorPlatformCounts[platform.value] ?? 0}
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {groupedCreators.length > 0 ? (
              <div className="space-y-8">
                {groupedCreators.map((group) => {
                  // Count unique creators in this group
                  const uniqueCreatorIds = new Set<string>();
                  group.creators.forEach((creator) => {
                    if (creator.id) {
                      uniqueCreatorIds.add(creator.id);
                    }
                  });
                  const uniqueCreatorCount = uniqueCreatorIds.size;

                  // Count posts for creators in this group
                  const platformPosts = posts.filter(
                    (p) => p.creator_id && uniqueCreatorIds.has(p.creator_id)
                  ).length;

                  return (
                    <div
                      key={group.platform}
                      className="animate-in fade-in slide-in-from-bottom-2 duration-300"
                    >
                      {/* Platform Section Header */}
                      <div className="flex items-center gap-3 mb-4">
                        {(() => {
                          const platformIcon = normalizePlatform(
                            group.platform
                          );
                          if (!platformIcon) return null;
                          return (
                            <>
                              <PlatformIcon
                                platform={platformIcon}
                                size="sm"
                                className="sm:hidden"
                                aria-label={`${getPlatformLabel(platformIcon)} creators`}
                              />
                              <PlatformIcon
                                platform={platformIcon}
                                size="md"
                                className="hidden sm:flex"
                                aria-label={`${getPlatformLabel(platformIcon)} creators`}
                              />
                            </>
                          );
                        })()}
                        <div className="h-px flex-1 bg-border/60" />
                        <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">
                          {uniqueCreatorCount} Creators • {platformPosts} Total
                          Posts
                        </span>
                      </div>

                      {/* Creator Cards */}
                      <div className="grid grid-cols-1 min-[360px]:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
                        {(isMobile && !expandedPlatforms[group.platform]
                          ? group.creators.slice(0, 8)
                          : group.creators
                        ).map((creator) => {
                          const creatorPosts = posts.filter(
                            (p) => p.creator_id === creator.id
                          );
                          const hasPosts = creatorPosts.length > 0;

                          return (
                            <div
                              key={creator.id}
                              className={cn(
                                "group relative p-3 rounded-xl border text-left transition-all hover:scale-[1.01]",
                                hasPosts
                                  ? "bg-emerald-500/[0.02] border-emerald-500/10 hover:border-emerald-500/40"
                                  : "bg-muted/60 border-border/60 hover:border-border/80"
                              )}
                            >
                              {/* Remove Button */}
                              {canEditThisCampaign && (
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setCreatorToRemove({
                                      id: creator.id,
                                      name: creator.name,
                                    });
                                  }}
                                  className="absolute top-1.5 right-1.5 w-6 h-6 rounded-md bg-red-500/10 hover:bg-red-500/20 border border-red-500/30 text-red-600 hover:text-red-500 dark:text-red-400 dark:hover:text-red-300 flex items-center justify-center transition-all opacity-0 group-hover:opacity-100 z-10"
                                  aria-label={`Remove ${creator.name} from campaign`}
                                  title="Remove from campaign"
                                >
                                  <X className="w-3 h-3" />
                                </button>
                              )}

                              <button
                                onClick={() => {
                                  setActiveCreator(creator);
                                  setCreatorDrawerOpen(true);
                                }}
                                className="w-full text-left"
                                aria-label={`View ${creator.name}`}
                              >
                                <div className="flex items-center gap-3">
                                  {/* Avatar with Status Pip */}
                                  <div className="relative shrink-0">
                                    <div className="w-10 h-10 rounded-full bg-gradient-to-br from-muted/80 to-muted flex items-center justify-center text-muted-foreground font-bold text-sm border border-border/70 group-hover:border-primary/50 transition-colors">
                                      {creator.name.charAt(0).toUpperCase()}
                                    </div>
                                    {hasPosts && (
                                      <span className="absolute -top-0.5 -right-0.5 w-3 h-3 bg-emerald-500 border-2 border-card rounded-full" />
                                    )}
                                  </div>

                                  <div className="flex-1 min-w-0">
                                    <div className="text-sm font-bold text-foreground truncate leading-tight group-hover:text-primary transition-colors">
                                      {creator.name}
                                    </div>
                                    <div className="text-xs text-muted-foreground truncate font-medium">
                                      @{creator.handle}
                                    </div>
                                  </div>
                                </div>

                                {/* Post Counter Badge */}
                                <div className="mt-3 flex items-center justify-between border-t border-border/60 pt-2">
                                  <span
                                    className={`text-[10px] font-bold uppercase ${
                                      hasPosts
                                        ? "text-emerald-500/80"
                                        : "text-muted-foreground"
                                    }`}
                                  >
                                    {hasPosts ? "Active" : "No Posts"}
                                  </span>
                                  <span className="text-[10px] font-mono text-muted-foreground">
                                    {creatorPosts.length}{" "}
                                    {creatorPosts.length === 1
                                      ? "POST"
                                      : "POSTS"}
                                  </span>
                                </div>
                              </button>
                            </div>
                          );
                        })}
                      </div>

                      {isMobile &&
                        group.creators.length > 8 &&
                        !expandedPlatforms[group.platform] && (
                          <button
                            onClick={() =>
                              setExpandedPlatforms((prev) => ({
                                ...prev,
                                [group.platform]: true,
                              }))
                            }
                            className="mt-4 w-full h-11 rounded-md bg-muted/60 hover:bg-muted/80 border border-border text-sm text-foreground transition-colors"
                          >
                            Show more creators
                          </button>
                        )}
                    </div>
                  );
                })}
              </div>
            ) : (
              <EmptyState
                searchQuery={creatorSearchQuery}
                selectedPlatform={selectedPlatform}
              />
            )}
          </CardContent>
        </Card>
      )}

      {/* Posts Table */}
      <Card
        id="campaign-posts"
        className="relative overflow-hidden bg-card border-border shadow-[0_12px_40px_-20px_rgba(0,0,0,0.8)]"
      >
        <CardContent className="relative p-0">
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_20%_20%,rgba(56,189,248,0.08),transparent_45%),radial-gradient(circle_at_80%_0%,rgba(16,185,129,0.08),transparent_40%)]" />
          <div className="relative p-4 sm:p-6 border-b border-border bg-muted/40 backdrop-blur-xl">
            <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between mb-4 sm:mb-5">
              <div>
                <h3 className="text-lg sm:text-xl font-semibold text-foreground tracking-tight">
                  Posts
                </h3>
                <p className="text-sm text-muted-foreground mt-1">
                  {posts.length} posts
                  {highlightedTopPosts.length > 0
                    ? ` · ${highlightedTopPosts.length} top`
                    : ""}
                </p>
              </div>
              <div className="flex flex-col gap-2 w-full sm:flex-row sm:items-center sm:justify-end sm:gap-3 md:w-auto">
                <button
                  onClick={() => {
                    if (!ensureCanEdit()) return;
                    setShowAddPostDialog(true);
                  }}
                  disabled={!canEditThisCampaign}
                  className="h-11 px-4 bg-primary hover:bg-primary/90 text-primary-foreground text-xs font-semibold flex items-center justify-center gap-1.5 rounded-lg transition-colors w-full sm:w-auto shadow-[0_8px_20px_-12px_rgba(34,197,94,0.8)] disabled:opacity-60 disabled:cursor-not-allowed"
                >
                  <Plus className="w-4 h-4" />
                  Add Post
                </button>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <button
                      type="button"
                      className="h-11 px-3 rounded-lg bg-muted/40 hover:bg-muted/80 border border-border text-xs text-foreground flex items-center justify-center gap-1.5 transition-colors w-full sm:w-auto"
                      aria-label="Post actions"
                    >
                      <MoreHorizontal className="w-4 h-4" />
                      Actions
                    </button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-56">
                    <DropdownMenuItem
                      onSelect={() => {
                        if (!ensureCanEdit()) return;
                        setShowScrapeAllDialog(true);
                      }}
                      disabled={posts.length === 0 || !canEditThisCampaign}
                    >
                      <RefreshCw className="w-4 h-4" />
                      Scrape all posts
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      onSelect={handleExportCSV}
                      disabled={posts.length === 0}
                    >
                      <Download className="w-4 h-4" />
                      Export CSV
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem
                      onSelect={handleImportCreators}
                      disabled={!canEditThisCampaign}
                    >
                      <Upload className="w-4 h-4" />
                      Import creators
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      onSelect={handleImportPosts}
                      disabled={!canEditThisCampaign}
                    >
                      <Upload className="w-4 h-4" />
                      Import posts CSV
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem
                      variant="destructive"
                      onSelect={() => {
                        if (!ensureCanEdit()) return;
                        setShowDeleteAllDialog(true);
                      }}
                      disabled={posts.length === 0 || !canEditThisCampaign}
                    >
                      <Trash2 className="w-4 h-4" />
                      Delete all posts
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <div className="hidden md:block w-full md:w-auto">
                <Select
                  value={sortBy}
                  onValueChange={(
                    value: "score" | "views" | "engagement" | "latest"
                  ) => setSortBy(value)}
                >
                  <SelectTrigger className="h-9 w-fit md:w-[170px] bg-muted/40 border-border text-foreground text-xs">
                    <SelectValue placeholder="Sort by" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="score">Sort by: Score</SelectItem>
                    <SelectItem value="views">Sort by: Views</SelectItem>
                    <SelectItem value="engagement">
                      Sort by: Engagement
                    </SelectItem>
                    <SelectItem value="latest">Sort by: Latest</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <button
                onClick={() => setPostFiltersOpen(true)}
                className="h-11 min-h-[44px] px-3 rounded-lg bg-muted/40 hover:bg-muted/80 border border-border text-sm text-foreground flex items-center justify-center gap-2 transition-colors"
              >
                <Filter className="w-4 h-4" />
                Filters
                {activePostFilterCount > 0 && (
                  <span className="ml-1 w-5 h-5 rounded-full bg-primary text-primary-foreground text-xs flex items-center justify-center font-semibold">
                    {activePostFilterCount}
                  </span>
                )}
              </button>
            </div>
          </div>

          {postsLoading ? (
            <div className="space-y-0">
              {Array.from({ length: 5 }).map((_, i) => (
                <PostRowSkeleton key={i} />
              ))}
            </div>
          ) : highlightedTopPosts.length > 0 ||
            visibleRemainingPosts.length > 0 ? (
            <>
              {/* Search, Sort, and Filters */}
              <div className="px-4 sm:px-6 pb-4">
                <div className="space-y-3">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <input
                      type="search"
                      placeholder="Search posts..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="h-11 w-full pl-9 pr-3 bg-muted/50 border border-border rounded-lg text-base text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/40"
                    />
                  </div>
                  {activePostFilters.length > 0 && (
                    <div className="flex items-center gap-2 overflow-x-auto pb-1">
                      {activePostFilters.map((filter) => (
                        <button
                          key={filter.key}
                          onClick={filter.onClear}
                          className="min-h-[44px] px-3 rounded-full border border-border bg-muted/70 text-xs text-foreground flex items-center gap-1 transition-colors hover:bg-muted/80"
                          aria-label={`Remove ${filter.label}`}
                        >
                          <span className="max-w-[180px] truncate">
                            {filter.label}
                          </span>
                          <X className="w-3.5 h-3.5" />
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {/* Mobile: Card Layout */}
              <div className="lg:hidden px-4 sm:px-6 space-y-2 pb-4">
                {/* Top Performers Toggle and Filter Button */}
                {highlightedTopPosts.length > 0 && (
                  <div className="flex items-center gap-2 pb-2">
                    <button
                      onClick={() => setShowTopPerformers(!showTopPerformers)}
                      className={`h-11 min-h-[44px] px-3 rounded-md border text-sm font-medium flex items-center justify-center gap-1.5 transition-colors ${
                        showTopPerformers
                          ? "bg-primary/20 border-primary/30 text-primary"
                          : "bg-muted/60 border-border text-foreground hover:bg-muted/80"
                      }`}
                    >
                      {showTopPerformers ? "All Posts" : "Top Performers"}
                    </button>
                  </div>
                )}

                {/* Top Performing Cards */}
                {highlightedTopPosts.length > 0 && !showTopPerformers && (
                  <>
                    <div className="flex items-center gap-2 pb-1">
                      <span className="text-xs font-semibold text-primary">
                        Top Performing
                      </span>
                      <div className="flex-1 h-px bg-primary/20"></div>
                    </div>
                    <div className="grid grid-cols-1 min-[430px]:grid-cols-2 gap-2 min-[430px]:gap-3">
                      {highlightedTopPosts.map((post) => (
                        <PostCard
                          key={post.id}
                          post={post}
                          onScrape={
                            canEditThisCampaign ? handleScrapePost : undefined
                          }
                          onDelete={
                            canEditThisCampaign
                              ? setShowDeletePostDialog
                              : undefined
                          }
                          isScraping={
                            isScrapeAllPending ||
                            post.status === "scraping" ||
                            (scrapePostMutation.isPending &&
                              activeScrapePostId === post.id)
                          }
                        />
                      ))}
                    </div>
                  </>
                )}

                {/* Remaining Posts Cards */}
                {visibleRemainingPosts.length > 0 && !showTopPerformers && (
                  <>
                    <div className="flex items-center gap-2 pb-1 pt-2">
                      <span className="text-xs font-semibold text-muted-foreground">
                        Other Posts
                      </span>
                      <div className="flex-1 h-px bg-border/80"></div>
                    </div>
                    <div className="grid grid-cols-1 min-[430px]:grid-cols-2 gap-2 min-[430px]:gap-3">
                      {visibleRemainingPosts.map((post) => (
                        <PostCard
                          key={post.id}
                          post={post}
                          onScrape={
                            canEditThisCampaign ? handleScrapePost : undefined
                          }
                          onDelete={
                            canEditThisCampaign
                              ? setShowDeletePostDialog
                              : undefined
                          }
                          isScraping={
                            isScrapeAllPending ||
                            post.status === "scraping" ||
                            (scrapePostMutation.isPending &&
                              activeScrapePostId === post.id)
                          }
                        />
                      ))}
                    </div>
                  </>
                )}

                {/* All Posts when Top Performers is toggled */}
                {showTopPerformers && (
                  <div className="grid grid-cols-1 min-[430px]:grid-cols-2 gap-2 min-[430px]:gap-3">
                    {mobilePaginatedPosts.map((post) => (
                      <PostCard
                        key={post.id}
                        post={post}
                        onScrape={
                          canEditThisCampaign ? handleScrapePost : undefined
                        }
                        onDelete={
                          canEditThisCampaign
                            ? setShowDeletePostDialog
                            : undefined
                        }
                        isScraping={
                          isScrapeAllPending ||
                          post.status === "scraping" ||
                          (scrapePostMutation.isPending &&
                            activeScrapePostId === post.id)
                        }
                      />
                    ))}
                  </div>
                )}
              </div>

              {/* Desktop: Table Layout */}
              <div className="hidden lg:block overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-border bg-muted/40">
                      <th className="text-left text-[11px] font-medium uppercase tracking-[0.12em] text-muted-foreground px-6 py-3">
                        Creator
                      </th>
                      <th className="text-left text-[11px] font-medium uppercase tracking-[0.12em] text-muted-foreground px-6 py-3">
                        Platform
                      </th>
                      <th className="text-left text-[11px] font-medium uppercase tracking-[0.12em] text-muted-foreground px-6 py-3">
                        Post URL
                      </th>
                      <th className="text-left text-[11px] font-medium uppercase tracking-[0.12em] text-muted-foreground px-6 py-3">
                        Status
                      </th>
                      <th className="text-right text-[11px] font-medium uppercase tracking-[0.12em] text-muted-foreground px-6 py-3">
                        Views
                      </th>
                      <th className="text-right text-[11px] font-medium uppercase tracking-[0.12em] text-muted-foreground px-6 py-3">
                        Likes
                      </th>
                      <th className="hidden xl:table-cell text-right text-[11px] font-medium uppercase tracking-[0.12em] text-muted-foreground px-6 py-3">
                        Comments
                      </th>
                      <th className="hidden 2xl:table-cell text-right text-[11px] font-medium uppercase tracking-[0.12em] text-muted-foreground px-6 py-3">
                        Engagement
                      </th>
                      <th className="text-right text-[11px] font-medium uppercase tracking-[0.12em] text-muted-foreground px-6 py-3"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {/* Top 5 Posts Section */}
                    {highlightedTopPosts.length > 0 && !showTopPerformers && (
                      <>
                        <tr>
                          <td
                            colSpan={9}
                            className="px-6 py-3 bg-gradient-to-r from-primary/10 via-muted/40 to-transparent border-b border-primary/20"
                          >
                            <div className="flex items-center gap-2">
                              <span className="text-xs font-semibold text-primary">
                                Top Performing
                              </span>
                              <div className="flex-1 h-px bg-primary/20"></div>
                            </div>
                          </td>
                        </tr>
                        {/* Top Performers Button - Below Top Performing */}
                        <tr>
                          <td colSpan={9} className="px-6 py-2">
                            <div className="flex items-center gap-2 flex-nowrap">
                              <button
                                onClick={() =>
                                  setShowTopPerformers(!showTopPerformers)
                                }
                                className={`h-8 px-2 rounded-md border text-[11px] sm:text-xs font-medium flex flex-wrap items-center justify-center gap-1.5 transition-colors w-fit shrink-0 ${
                                  showTopPerformers
                                    ? "bg-primary/20 border-primary/30 text-primary"
                                    : "bg-muted/60 border-border text-foreground hover:bg-muted/80"
                                }`}
                              >
                                {showTopPerformers
                                  ? "All Posts"
                                  : "Top Performers"}
                              </button>
                              <div className="w-[160px] md:hidden shrink-0">
                                <Select
                                  value={sortBy}
                                  onValueChange={(
                                    value:
                                      | "score"
                                      | "views"
                                      | "engagement"
                                      | "latest"
                                  ) => setSortBy(value)}
                                >
                                  <SelectTrigger className="h-8 w-fit bg-muted/60 border-border text-foreground text-[11px] sm:text-xs">
                                    <SelectValue placeholder="Sort by" />
                                  </SelectTrigger>
                                  <SelectContent>
                                    <SelectItem value="score">
                                      Sort by: Score
                                    </SelectItem>
                                    <SelectItem value="views">
                                      Sort by: Views
                                    </SelectItem>
                                    <SelectItem value="engagement">
                                      Sort by: Engagement
                                    </SelectItem>
                                    <SelectItem value="latest">
                                      Sort by: Latest
                                    </SelectItem>
                                  </SelectContent>
                                </Select>
                              </div>
                            </div>
                          </td>
                        </tr>
                        {highlightedTopPosts.map((post) => {
                          const isTop3 = post.rank <= 3;
                          const isTop5 = post.rank <= 5;
                          const platformIcon = normalizePlatform(post.platform);
                          const isScrapingPost =
                            isScrapeAllPending ||
                            post.status === "scraping" ||
                            (scrapePostMutation.isPending &&
                              activeScrapePostId === post.id);
                          return (
                            <tr
                              key={post.id}
                              className={`border-b border-border/60 transition-colors group ${
                                isTop3
                                  ? "bg-primary/5 hover:bg-primary/10"
                                  : isTop5
                                    ? "bg-primary/2 hover:bg-primary/5"
                                    : "hover:bg-muted/40"
                              } ${
                                isTop5 ? "border-l-2 border-l-primary/30" : ""
                              }`}
                            >
                              <td className="px-6 py-4">
                                <div>
                                  <div className="font-medium text-sm text-foreground">
                                    {post.creator?.name || "Unknown"}
                                  </div>
                                  <div className="text-xs text-muted-foreground">
                                    @
                                    {post.creator?.handle ||
                                      post.owner_username ||
                                      "unknown"}
                                  </div>
                                </div>
                              </td>
                              <td className="px-6 py-4">
                                <div className="flex items-center gap-2">
                                  {platformIcon && (
                                    <PlatformIcon
                                      platform={platformIcon}
                                      size="md"
                                      aria-label={`${getPlatformLabel(platformIcon)} post`}
                                    />
                                  )}
                                  {!isKpiPlatform(post.platform) && (
                                    <span className="text-xs px-1.5 py-0.5 rounded bg-muted/70 text-muted-foreground border border-border">
                                      Not counted in KPIs
                                    </span>
                                  )}
                                </div>
                              </td>
                              <td className="px-6 py-4">
                                {post.post_url ? (
                                  <a
                                    href={post.post_url}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="flex items-center gap-2 text-sm text-primary hover:text-primary/80"
                                  >
                                    <ExternalLink className="w-3 h-3" />
                                    View Post
                                  </a>
                                ) : (
                                  <button className="text-xs text-muted-foreground hover:text-primary flex items-center gap-1">
                                    <LinkIcon className="w-3 h-3" />
                                    Add Link
                                  </button>
                                )}
                              </td>
                              <td className="px-6 py-4">
                                <div className="flex items-center gap-2">
                                  <StatusBadge status={post.status} />
                                  {post.positionEmoji && (
                                    <span className="text-base">
                                      {post.positionEmoji}
                                    </span>
                                  )}
                                  {post.badges?.trending && (
                                    <span className="text-base">🔥</span>
                                  )}
                                </div>
                              </td>
                              <td className="px-6 py-4 text-right text-sm text-foreground">
                                {(() => {
                                  const formatted = formatWithGrowth(
                                    post.views,
                                    (post as { last_view_growth?: number })
                                      .last_view_growth
                                  );
                                  return (
                                    <>
                                      {formatted.value}
                                      {formatted.growth && (
                                        <span className="text-xs text-muted-foreground ml-1">
                                          ({formatted.growth})
                                        </span>
                                      )}
                                    </>
                                  );
                                })()}
                              </td>
                              <td className="px-6 py-4 text-right text-sm text-foreground">
                                {(() => {
                                  const formatted = formatWithGrowth(
                                    post.likes,
                                    (post as { last_like_growth?: number })
                                      .last_like_growth
                                  );
                                  return (
                                    <>
                                      {formatted.value}
                                      {formatted.growth && (
                                        <span className="text-xs text-muted-foreground ml-1">
                                          ({formatted.growth})
                                        </span>
                                      )}
                                    </>
                                  );
                                })()}
                              </td>
                              <td className="hidden xl:table-cell px-6 py-4 text-right text-sm text-foreground">
                                {(() => {
                                  const formatted = formatWithGrowth(
                                    post.comments,
                                    (post as { last_comment_growth?: number })
                                      .last_comment_growth
                                  );
                                  return (
                                    <>
                                      {formatted.value}
                                      {formatted.growth && (
                                        <span className="text-xs text-muted-foreground ml-1">
                                          ({formatted.growth})
                                        </span>
                                      )}
                                    </>
                                  );
                                })()}
                              </td>
                              <td className="hidden 2xl:table-cell px-6 py-4 text-right">
                                {post.engagement_rate &&
                                post.engagement_rate > 0 ? (
                                  <span className="text-sm text-emerald-600 dark:text-emerald-400 font-medium">
                                    {post.engagement_rate}%
                                  </span>
                                ) : (
                                  <span className="text-sm text-muted-foreground">
                                    -
                                  </span>
                                )}
                              </td>
                              <td className="px-6 py-4 text-right">
                                <div className="flex items-center justify-end gap-1">
                                  {post.post_url && (
                                    <button
                                      onClick={() => {
                                        if (!ensureCanEdit()) return;
                                        if (!id) return;
                                        scrapePostMutation.mutate({
                                          postId: post.id,
                                          postUrl: post.post_url,
                                          platform: post.platform,
                                          campaignId: id,
                                        });
                                      }}
                                      disabled={
                                        isScrapingPost || !canEditThisCampaign
                                      }
                                      className="w-8 h-8 rounded-md hover:bg-primary/20 flex items-center justify-center transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                                      title={
                                        isScrapingPost
                                          ? "Scraping..."
                                          : "Scrape this post"
                                      }
                                    >
                                      {isScrapingPost ? (
                                        <RefreshCw className="w-4 h-4 text-primary animate-spin" />
                                      ) : (
                                        <RefreshCw className="w-4 h-4 text-primary" />
                                      )}
                                    </button>
                                  )}
                                  {canEditThisCampaign && (
                                    <button
                                      onClick={() =>
                                        setShowDeletePostDialog(post.id)
                                      }
                                      className="w-8 h-8 rounded-md hover:bg-red-500/20 flex items-center justify-center transition-colors opacity-0 group-hover:opacity-100"
                                      title="Delete this post"
                                    >
                                      <Trash2 className="w-4 h-4 text-red-600 dark:text-red-400" />
                                    </button>
                                  )}
                                </div>
                              </td>
                            </tr>
                          );
                        })}
                        {paginatedRemainingPosts.length > 0 && (
                          <tr>
                            <td
                              colSpan={9}
                              className="px-6 py-2 border-b border-border"
                            >
                              <div className="h-px"></div>
                            </td>
                          </tr>
                        )}
                      </>
                    )}
                    {/* Remaining Posts */}
                    {paginatedRemainingPosts.map((post) => {
                      const isTop3 = post.rank <= 3;
                      const platformIcon = normalizePlatform(post.platform);
                      const isScrapingPost =
                        isScrapeAllPending ||
                        post.status === "scraping" ||
                        (scrapePostMutation.isPending &&
                          activeScrapePostId === post.id);
                      return (
                        <tr
                          key={post.id}
                          className={`border-b border-border/60 transition-colors group ${
                            isTop3
                              ? "bg-primary/5 hover:bg-primary/10"
                              : "hover:bg-muted/40"
                          }`}
                        >
                          <td className="px-6 py-4">
                            <div>
                              <div className="font-medium text-sm text-foreground">
                                {post.creator?.name || "Unknown"}
                              </div>
                              <div className="text-xs text-muted-foreground">
                                @
                                {post.creator?.handle ||
                                  post.owner_username ||
                                  "unknown"}
                              </div>
                            </div>
                          </td>
                          <td className="px-6 py-4">
                            <div className="flex items-center gap-2">
                              {platformIcon && (
                                <PlatformIcon
                                  platform={platformIcon}
                                  size="md"
                                  aria-label={`${getPlatformLabel(platformIcon)} post`}
                                />
                              )}
                              {!isKpiPlatform(post.platform) && (
                                <span className="text-xs px-1.5 py-0.5 rounded bg-muted/70 text-muted-foreground border border-border">
                                  Not counted in KPIs
                                </span>
                              )}
                            </div>
                          </td>
                          <td className="px-6 py-4">
                            {post.post_url ? (
                              <a
                                href={post.post_url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="flex items-center gap-2 text-sm text-primary hover:text-primary/80"
                              >
                                <ExternalLink className="w-3 h-3" />
                                View Post
                              </a>
                            ) : (
                              <button className="text-xs text-muted-foreground hover:text-primary flex items-center gap-1">
                                <LinkIcon className="w-3 h-3" />
                                Add Link
                              </button>
                            )}
                          </td>
                          <td className="px-6 py-4">
                            <div className="flex items-center gap-2">
                              <StatusBadge status={post.status} />
                              {post.positionEmoji && (
                                <span className="text-base">
                                  {post.positionEmoji}
                                </span>
                              )}
                              {post.badges?.trending && (
                                <span className="text-base">🔥</span>
                              )}
                            </div>
                          </td>
                          <td className="px-6 py-4 text-right text-sm text-foreground">
                            {(() => {
                              const formatted = formatWithGrowth(
                                post.views,
                                (post as { last_view_growth?: number })
                                  .last_view_growth
                              );
                              return (
                                <>
                                  {formatted.value}
                                  {formatted.growth && (
                                    <span className="text-xs text-muted-foreground ml-1">
                                      ({formatted.growth})
                                    </span>
                                  )}
                                </>
                              );
                            })()}
                          </td>
                          <td className="px-6 py-4 text-right text-sm text-foreground">
                            {(() => {
                              const formatted = formatWithGrowth(
                                post.likes,
                                (post as { last_like_growth?: number })
                                  .last_like_growth
                              );
                              return (
                                <>
                                  {formatted.value}
                                  {formatted.growth && (
                                    <span className="text-xs text-muted-foreground ml-1">
                                      ({formatted.growth})
                                    </span>
                                  )}
                                </>
                              );
                            })()}
                          </td>
                          <td className="hidden xl:table-cell px-6 py-4 text-right text-sm text-foreground">
                            {(() => {
                              const formatted = formatWithGrowth(
                                post.comments,
                                (post as { last_comment_growth?: number })
                                  .last_comment_growth
                              );
                              return (
                                <>
                                  {formatted.value}
                                  {formatted.growth && (
                                    <span className="text-xs text-muted-foreground ml-1">
                                      ({formatted.growth})
                                    </span>
                                  )}
                                </>
                              );
                            })()}
                          </td>
                          <td className="hidden 2xl:table-cell px-6 py-4 text-right">
                            {post.engagement_rate &&
                            post.engagement_rate > 0 ? (
                              <span className="text-sm text-emerald-600 dark:text-emerald-400 font-medium">
                                {post.engagement_rate}%
                              </span>
                            ) : (
                              <span className="text-sm text-muted-foreground">-</span>
                            )}
                          </td>
                          <td className="px-6 py-4 text-right">
                            <div className="flex items-center justify-end gap-1">
                              {post.post_url && (
                                <button
                                  onClick={() => {
                                    if (!ensureCanEdit()) return;
                                    if (!id) return;
                                    scrapePostMutation.mutate({
                                      postId: post.id,
                                      postUrl: post.post_url,
                                      platform: post.platform,
                                      campaignId: id,
                                    });
                                  }}
                                  disabled={
                                    isScrapingPost || !canEditThisCampaign
                                  }
                                  className="w-8 h-8 rounded-md hover:bg-primary/20 flex items-center justify-center transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                                  aria-label="Refresh metrics"
                                  title={
                                    isScrapingPost
                                      ? "Scraping..."
                                      : "Scrape this post"
                                  }
                                >
                                  {isScrapingPost ? (
                                    <RefreshCw className="w-4 h-4 text-primary animate-spin" />
                                  ) : (
                                    <RefreshCw className="w-4 h-4 text-primary" />
                                  )}
                                </button>
                              )}
                              {canEditThisCampaign && (
                                <button
                                  onClick={() =>
                                    setShowDeletePostDialog(post.id)
                                  }
                                  className="w-8 h-8 rounded-md hover:bg-red-500/20 flex items-center justify-center transition-colors opacity-0 group-hover:opacity-100"
                                  aria-label="Delete post"
                                  title="Delete this post"
                                >
                                  <Trash2 className="w-4 h-4 text-red-600 dark:text-red-400" />
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* Mobile Pagination */}
              {mobileTotalPages > 1 && (
                <div className="lg:hidden px-4 sm:px-6 pb-4 space-y-3">
                  <p className="text-xs text-muted-foreground">
                    Showing {mobileStartIndex + 1} to{" "}
                    {Math.min(
                      mobileStartIndex + postsPerPage,
                      showTopPerformers
                        ? postsWithRankings.length
                        : remainingPosts.length
                    )}{" "}
                    of{" "}
                    {showTopPerformers
                      ? postsWithRankings.length
                      : remainingPosts.length}{" "}
                    posts
                  </p>
                  <div className="flex items-center justify-between gap-2">
                    <button
                      onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                      disabled={mobileSafeCurrentPage === 1}
                      className="h-9 w-9 rounded-md bg-muted/60 hover:bg-muted/80 border border-border text-foreground disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center"
                    >
                      <ChevronLeft className="w-4 h-4" />
                      <span className="sr-only">Previous page</span>
                    </button>
                    <div className="flex items-center gap-1">
                      <div className="min-[360px]:hidden text-xs text-muted-foreground">
                        Page {mobileSafeCurrentPage} / {mobileTotalPages}
                      </div>
                      <div className="hidden min-[360px]:flex items-center gap-1">
                        {(showTopPerformers
                          ? mobileAllPaginationPages
                          : mobilePaginationPages
                        ).map((page, index) => {
                          const pages = showTopPerformers
                            ? mobileAllPaginationPages
                            : mobilePaginationPages;
                          const prevPage = pages[index - 1];
                          const showEllipsis = prevPage && page - prevPage > 1;
                          return (
                            <React.Fragment key={page}>
                              {showEllipsis && (
                                <span className="px-1 text-muted-foreground text-xs">
                                  ...
                                </span>
                              )}
                              <button
                                onClick={() => setCurrentPage(page)}
                                className={`h-9 w-9 rounded-md text-xs transition-colors ${
                                  mobileSafeCurrentPage === page
                                    ? "bg-primary text-primary-foreground"
                                    : "bg-muted/60 hover:bg-muted/80 border border-border text-foreground"
                                }`}
                              >
                                {page}
                              </button>
                            </React.Fragment>
                          );
                        })}
                      </div>
                    </div>
                    <button
                      onClick={() =>
                        setCurrentPage((p) => Math.min(mobileTotalPages, p + 1))
                      }
                      disabled={mobileSafeCurrentPage === mobileTotalPages}
                      className="h-9 w-9 rounded-md bg-muted/60 hover:bg-muted/80 border border-border text-foreground disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center"
                    >
                      <ChevronRight className="w-4 h-4" />
                      <span className="sr-only">Next page</span>
                    </button>
                  </div>
                </div>
              )}

              {/* Desktop Pagination */}
              {totalPages > 1 && (
                <div className="hidden lg:flex p-4 border-t border-border items-center justify-between">
                  <p className="text-sm text-muted-foreground">
                    {highlightedTopPosts.length > 0 && !showTopPerformers
                      ? `${highlightedTopPosts.length} top posts + `
                      : ""}
                    Showing {startIndex + 1} to{" "}
                    {Math.min(startIndex + postsPerPage, remainingPosts.length)}{" "}
                    of {remainingPosts.length} remaining posts
                    {highlightedTopPosts.length > 0 &&
                      !showTopPerformers &&
                      ` (${highlightedTopPosts.length + remainingPosts.length} total)`}
                  </p>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                      disabled={currentPage === 1}
                      className="h-8 px-3 rounded-md bg-muted/60 hover:bg-muted/80 border border-border text-sm text-foreground disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                    >
                      Previous
                    </button>
                    <div className="flex items-center gap-1">
                      {Array.from({ length: totalPages }, (_, i) => i + 1).map(
                        (page) => (
                          <button
                            key={page}
                            onClick={() => setCurrentPage(page)}
                            className={`w-8 h-8 rounded-md text-sm transition-colors ${
                              currentPage === page
                                ? "bg-primary text-primary-foreground"
                                : "bg-muted/60 hover:bg-muted/80 border border-border text-foreground"
                            }`}
                          >
                            {page}
                          </button>
                        )
                      )}
                    </div>
                    <button
                      onClick={() =>
                        setCurrentPage((p) => Math.min(totalPages, p + 1))
                      }
                      disabled={currentPage === totalPages}
                      className="h-8 px-3 rounded-md bg-muted/60 hover:bg-muted/80 border border-border text-sm text-foreground disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                    >
                      Next
                    </button>
                  </div>
                </div>
              )}
            </>
          ) : (
            <div className="flex flex-col items-center justify-center py-16">
              <div className="w-12 h-12 rounded-lg bg-muted/60 flex items-center justify-center mb-4">
                <Search className="w-6 h-6 text-muted-foreground" />
              </div>
              <h3 className="text-base font-semibold text-foreground mb-1">
                No posts found
              </h3>
              <p className="text-sm text-muted-foreground text-center mb-6 max-w-md">
                {searchQuery
                  ? "Try adjusting your search query"
                  : "Get started by adding posts manually or importing from CSV"}
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Import Creators Dialog */}
      <Dialog open={postFiltersOpen} onOpenChange={setPostFiltersOpen}>
        <DialogContent className="bg-card border-border">
          <DialogHeader>
            <DialogTitle className="text-lg font-semibold text-foreground">
              Filters
            </DialogTitle>
            <DialogDescription className="text-sm text-muted-foreground">
              Refine posts by platform, status, and creator.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                Platform
              </p>
              <div className="flex flex-wrap gap-2">
                {[
                  "all",
                  "tiktok",
                  "instagram",
                  "youtube",
                  "twitter",
                  "facebook",
                ].map((platform) => (
                  <button
                    key={platform}
                    onClick={() => setPostPlatformFilter(platform)}
                    className={`h-11 min-h-[44px] px-3 rounded-full border text-xs font-semibold uppercase tracking-wider transition-colors ${
                      postPlatformFilter === platform
                        ? "bg-primary text-primary-foreground border-primary"
                        : "bg-muted/60 border-border text-foreground hover:bg-muted/80"
                    }`}
                  >
                    {platform === "all" ? "All" : platform}
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-2">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                Status
              </p>
              <div className="flex flex-wrap gap-2">
                {["all", "pending", "scraping", "complete", "failed"].map(
                  (status) => (
                    <button
                      key={status}
                      onClick={() => setPostStatusFilter(status)}
                      className={`h-11 min-h-[44px] px-3 rounded-full border text-xs font-semibold uppercase tracking-wider transition-colors ${
                        postStatusFilter === status
                          ? "bg-primary text-primary-foreground border-primary"
                          : "bg-muted/60 border-border text-foreground hover:bg-muted/80"
                      }`}
                    >
                      {status === "all"
                        ? "All"
                        : status === "failed"
                          ? "Update delayed"
                          : status}
                    </button>
                  )
                )}
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                Creator
              </label>
              <select
                value={postCreatorFilter}
                onChange={(e) => setPostCreatorFilter(e.target.value)}
                className="h-11 w-full rounded-md bg-muted/60 border border-border px-3 text-base text-foreground"
              >
                <option value="all">All creators</option>
                {postCreatorOptions.map((creator) => (
                  <option key={creator.id} value={creator.id}>
                    {creator.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-2">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                Date Range
              </p>
              <div className="flex flex-wrap gap-2">
                {[
                  { value: "all", label: "All" },
                  { value: "7d", label: "7D" },
                  { value: "30d", label: "30D" },
                  { value: "90d", label: "90D" },
                ].map((range) => (
                  <button
                    key={range.value}
                    onClick={() => setPostDateFilter(range.value)}
                    className={`h-11 min-h-[44px] px-3 rounded-full border text-xs font-semibold uppercase tracking-wider transition-colors ${
                      postDateFilter === range.value
                        ? "bg-primary text-primary-foreground border-primary"
                        : "bg-muted/60 border-border text-foreground hover:bg-muted/80"
                    }`}
                  >
                    {range.label}
                  </button>
                ))}
              </div>
            </div>
          </div>
          <DialogFooter className="flex gap-2 pt-4">
            <Button
              variant="outline"
              onClick={() => {
                setPostPlatformFilter("all");
                setPostStatusFilter("all");
                setPostCreatorFilter("all");
                setPostDateFilter("all");
              }}
            >
              Clear
            </Button>
            <Button onClick={() => setPostFiltersOpen(false)}>Apply</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={creatorDrawerOpen} onOpenChange={setCreatorDrawerOpen}>
        <DialogContent className="bg-card border-border">
          <DialogHeader>
            <DialogTitle className="text-lg font-semibold text-foreground">
              Creator Details
            </DialogTitle>
            <DialogDescription className="text-sm text-muted-foreground">
              Quick stats and actions for this creator.
            </DialogDescription>
          </DialogHeader>
          {activeCreator && (
            <div className="space-y-4">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-full bg-gradient-to-br from-muted/80 to-muted flex items-center justify-center text-foreground font-bold text-base border border-border/70">
                  {activeCreator.name.charAt(0).toUpperCase()}
                </div>
                <div className="min-w-0">
                  <p className="text-base font-semibold text-foreground truncate">
                    {activeCreator.name}
                  </p>
                  <p className="text-sm text-muted-foreground truncate">
                    @{activeCreator.handle}
                  </p>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="rounded-lg border border-border bg-muted/40 p-3">
                  <p className="text-xs text-muted-foreground uppercase tracking-wider">
                    Platform
                  </p>
                  {(() => {
                    const platformIcon = normalizePlatform(
                      activeCreator.platform
                    );
                    if (!platformIcon) {
                      return (
                        <p className="text-sm text-foreground mt-1">
                          {activeCreator.platform}
                        </p>
                      );
                    }
                    return (
                      <div className="mt-2">
                        <PlatformIcon
                          platform={platformIcon}
                          size="sm"
                          className="sm:hidden"
                          aria-label={`${getPlatformLabel(platformIcon)} creator`}
                        />
                        <PlatformIcon
                          platform={platformIcon}
                          size="md"
                          className="hidden sm:flex"
                          aria-label={`${getPlatformLabel(platformIcon)} creator`}
                        />
                      </div>
                    );
                  })()}
                </div>
                <div className="rounded-lg border border-border bg-muted/40 p-3">
                  <p className="text-xs text-muted-foreground uppercase tracking-wider">
                    Posts
                  </p>
                  <p className="text-sm text-foreground mt-1">
                    {activeCreatorPosts.length}
                  </p>
                </div>
              </div>
              <div className="flex flex-col gap-2 sm:flex-row">
                <Button
                  onClick={() => {
                    setPostCreatorFilter(activeCreator.id);
                    setCreatorDrawerOpen(false);
                    const postsSection =
                      document.getElementById("campaign-posts");
                    postsSection?.scrollIntoView({ behavior: "smooth" });
                  }}
                  className="w-full sm:w-auto"
                >
                  Filter Posts
                </Button>
                <Button
                  variant="outline"
                  onClick={() => setCreatorDrawerOpen(false)}
                  className="w-full sm:w-auto"
                >
                  Close
                </Button>
                <Button
                  variant="destructive"
                  onClick={() =>
                    setCreatorToRemove({
                      id: activeCreator.id,
                      name: activeCreator.name,
                    })
                  }
                  className="w-full sm:w-auto"
                >
                  Delete Creator
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <ImportCreatorsDialog
        open={showImportCreatorsDialog}
        onClose={() => setShowImportCreatorsDialog(false)}
      />

      {/* Import Posts Dialog */}
      {showImportPostsDialog && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50">
          <Card className="bg-card border-border w-full max-w-md">
            <CardContent className="p-6">
              <h3 className="text-lg font-semibold text-foreground mb-4">
                Import Posts from CSV
              </h3>

              {!isImporting && !importResult && (
                <>
                  <div className="border-2 border-dashed border-border rounded-lg p-8 text-center hover:border-primary/50 transition-colors cursor-pointer mb-4">
                    <input
                      type="file"
                      accept=".csv"
                      onChange={handleFileUpload}
                      className="hidden"
                      id="csv-upload"
                      disabled={isImporting}
                    />
                    <label htmlFor="csv-upload" className="cursor-pointer">
                      <Upload className="w-12 h-12 mx-auto mb-3 text-muted-foreground" />
                      <p className="text-sm text-foreground mb-1">
                        Upload CSV file
                      </p>
                      <p className="text-xs text-muted-foreground mb-3">
                        Required: creator_name, creator_handle, platform,
                        post_url
                      </p>
                      <p className="text-xs text-muted-foreground">
                        Optional: posted_date, views, likes, comments, shares
                      </p>
                    </label>
                  </div>
                  <button
                    onClick={handleDownloadTemplate}
                    className="w-full h-9 mb-3 rounded-md bg-muted/60 hover:bg-muted/80 border border-border text-sm text-foreground flex items-center justify-center gap-2 transition-colors"
                  >
                    <Download className="w-4 h-4" />
                    Download CSV Template
                  </button>
                  <div className="flex gap-3">
                    <button
                      onClick={() => setShowImportPostsDialog(false)}
                      className="flex-1 h-9 rounded-md bg-muted/60 hover:bg-muted/80 border border-border text-sm text-foreground transition-colors"
                    >
                      Cancel
                    </button>
                  </div>
                </>
              )}

              {isImporting && (
                <div className="py-8 text-center">
                  <div className="w-12 h-12 mx-auto mb-4 border-4 border-primary/20 border-t-primary rounded-full animate-spin"></div>
                  <p className="text-sm text-foreground">Importing posts...</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    This may take a moment
                  </p>
                </div>
              )}

              {importResult && (
                <div className="space-y-4">
                  <div className="p-4 rounded-lg bg-emerald-500/10 border border-emerald-500/20">
                    <p className="text-sm text-emerald-600 dark:text-emerald-400 font-medium mb-1">
                      ✓ {importResult.success_count} post
                      {importResult.success_count !== 1 ? "s" : ""} imported
                      successfully
                    </p>
                  </div>

                  {importResult.error_count > 0 && (
                    <div className="p-4 rounded-lg bg-red-500/10 border border-red-500/20">
                      <p className="text-sm text-red-600 dark:text-red-400 font-medium mb-2">
                        {importResult.error_count} error
                        {importResult.error_count !== 1 ? "s" : ""}
                      </p>
                      <div className="space-y-1 max-h-32 overflow-y-auto">
                        {importResult.errors.map((error, idx) => (
                          <p key={idx} className="text-xs text-red-500 dark:text-red-300">
                            Row {error.row}: {error.message}
                          </p>
                        ))}
                      </div>
                    </div>
                  )}

                  <button
                    onClick={() => {
                      setShowImportPostsDialog(false);
                      setImportResult(null);
                    }}
                    className="w-full h-9 rounded-md bg-muted/60 hover:bg-muted/80 border border-border text-sm text-foreground transition-colors"
                  >
                    {importResult.error_count === 0 ? "Done" : "Close"}
                  </button>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      {/* Scrape All Confirmation Dialog */}
      {showScrapeAllDialog && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50">
          <Card className="bg-card border-border w-full max-w-md">
            <CardContent className="p-6">
              <h3 className="text-lg font-semibold text-foreground mb-2">
                Scrape All Posts?
              </h3>
              <p className="text-sm text-muted-foreground mb-6">
                This will scrape metrics for all posts with URLs in this
                campaign. Posts without URLs will be skipped.
              </p>
              <div className="flex gap-3">
                <button
                  onClick={() => setShowScrapeAllDialog(false)}
                  className="flex-1 h-9 rounded-md bg-muted/60 hover:bg-muted/80 border border-border text-sm text-foreground transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleScrapeAll}
                  className="flex-1 h-9 rounded-md bg-secondary hover:bg-secondary/80 text-secondary-foreground text-sm font-medium transition-colors"
                >
                  Start Scraping
                </button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Delete Campaign Confirmation Dialog */}
      <ResponsiveConfirmDialog
        open={showDeleteCampaignDialog}
        onOpenChange={setShowDeleteCampaignDialog}
        title="Delete campaign?"
        description={
          campaign?.name
            ? `"${campaign.name}" will be deleted along with all posts and data. This action cannot be undone.`
            : "This campaign will be deleted. This action cannot be undone."
        }
        confirmLabel={
          deleteCampaignMutation.isPending ? "Deleting..." : "Delete campaign"
        }
        confirmDisabled={deleteCampaignMutation.isPending}
        onConfirm={handleDeleteCampaign}
      />

      {/* Delete All Posts Confirmation Dialog */}
      <ResponsiveConfirmDialog
        open={showDeleteAllDialog}
        onOpenChange={setShowDeleteAllDialog}
        title="Delete all posts?"
        description="This removes all posts in this campaign. This cannot be undone."
        confirmLabel={
          deleteAllPostsMutation.isPending ? "Deleting..." : "Delete all"
        }
        confirmDisabled={deleteAllPostsMutation.isPending}
        onConfirm={() => {
          if (!ensureCanEdit()) return;
          handleDeleteAll();
        }}
      />

      <ResponsiveConfirmDialog
        open={Boolean(showDeletePostDialog)}
        onOpenChange={(open) => {
          if (!open) setShowDeletePostDialog(null);
        }}
        title="Delete this post?"
        description="This will permanently delete this post from the campaign. This cannot be undone."
        confirmLabel={
          deletePostMutation.isPending ? "Deleting..." : "Delete post"
        }
        confirmDisabled={deletePostMutation.isPending}
        onConfirm={() => {
          if (!ensureCanEdit()) return;
          if (showDeletePostDialog) {
            handleDeletePost(showDeletePostDialog);
          }
        }}
      />

      {/* Remove Creator Confirmation Dialog */}
      <ResponsiveConfirmDialog
        open={Boolean(creatorToRemove)}
        onOpenChange={(open) => {
          if (!open) setCreatorToRemove(null);
        }}
        title="Remove creator?"
        description={
          creatorToRemove?.name
            ? `${creatorToRemove.name} will be removed from this campaign. Their posts stay, but they will no longer be in the roster.`
            : "This creator will be removed from this campaign."
        }
        confirmLabel={
          removeCreatorMutation.isPending ? "Removing..." : "Remove creator"
        }
        confirmDisabled={removeCreatorMutation.isPending}
        onConfirm={async () => {
          if (!ensureCanEdit()) return;
          if (creatorToRemove && id) {
            try {
              await removeCreatorMutation.mutateAsync({
                campaignId: id,
                creatorId: creatorToRemove.id,
              });
              setCreatorToRemove(null);
              // Close creator drawer if the removed creator was being viewed
              if (activeCreator?.id === creatorToRemove.id) {
                setCreatorDrawerOpen(false);
                setActiveCreator(null);
              }
            } catch (error) {
              // Error toast is handled by the mutation
            }
          }
        }}
      />

      {/* Share Modal */}
      {showShareLinkModal && campaign && (
        <CampaignShareModal
          campaignId={campaign.id}
          campaignName={campaign.name}
          onClose={() => setShowShareLinkModal(false)}
        />
      )}

      {/* Add Post Dialog */}
      {id && (
        <AddPostDialog
          open={showAddPostDialog}
          onClose={() => setShowAddPostDialog(false)}
          campaignId={id}
          campaignCreators={campaignCreators}
        />
      )}
    </div>
  );
}

type EmptyStateProps = {
  searchQuery?: string;
  selectedPlatform?: string;
};

const EmptyState = ({ searchQuery, selectedPlatform }: EmptyStateProps) => {
  const trimmedQuery = searchQuery?.trim() || "";
  const hasQuery = trimmedQuery.length > 0;
  const platformLabels: Record<string, string> = {
    tiktok: "TikTok",
    instagram: "Instagram",
    youtube: "YouTube",
    twitter: "X",
    facebook: "Facebook",
  };
  const platformLabel =
    selectedPlatform && selectedPlatform !== "all"
      ? platformLabels[selectedPlatform] || selectedPlatform
      : null;

  const title = hasQuery
    ? "No creators found"
    : platformLabel
      ? `No ${platformLabel} creators yet`
      : "No creators yet";
  const description = hasQuery
    ? "Try adjusting your search or filters."
    : platformLabel
      ? "Add creators or import a roster to get started."
      : "Add creators or import a roster to get started.";

  return (
    <div className="flex flex-col items-center justify-center py-12 text-center">
      <div className="w-12 h-12 rounded-lg bg-muted/60 flex items-center justify-center mb-4">
        <Search className="w-6 h-6 text-muted-foreground" />
      </div>
      <h3 className="text-base font-semibold text-foreground mb-1">{title}</h3>
      <p className="text-sm text-muted-foreground max-w-md">{description}</p>
    </div>
  );
};
