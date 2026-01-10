import React, { useState, useEffect, useRef } from "react";
import { useParams } from "react-router-dom";
import { Card, CardContent } from "./ui/card";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import {
  ArrowLeft,
  Plus,
  Search,
  Trash2,
  RefreshCw,
  Download,
  Upload,
  Edit2,
  MoreVertical,
  ExternalLink,
  Link as LinkIcon,
  Eye,
  Heart,
  MessageCircle,
  Share2,
  Users,
} from "lucide-react";
import { StatusBadge } from "./status-badge";
import { PlatformBadge } from "./platform-badge";
import { CampaignHeaderSkeleton, PostRowSkeleton } from "./ui/skeleton";
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
import { useCampaign } from "../../hooks/useCampaigns";
import {
  usePosts,
  useCampaignMetrics,
  useCampaignMetricsTimeSeries,
  useDeletePost,
  useDeleteAllPosts,
  useCreateManyPosts,
  postsKeys,
} from "../../hooks/usePosts";
import { useScrapeAllPosts, useScrapePost } from "../../hooks/useScraping";
import { addNotification } from "../../lib/utils/notifications";
import { useCreatorsByCampaign } from "../../hooks/useCreators";
import * as csvUtils from "../../lib/utils/csv";
import type { CSVImportResult } from "../../lib/types/database";
import { toast } from "sonner";
import { AddPostDialog } from "./add-post-dialog";
import { ImportCreatorsDialog } from "./import-creators-dialog";
import { CampaignShareModal } from "./campaign-share-modal";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "../../lib/supabase";
import { DropdownMenuItem, DropdownMenu, DropdownMenuContent, DropdownMenuTrigger, DropdownMenuSeparator } from "./ui/dropdown-menu";
import { Skeleton } from "./ui/skeleton";
import { MoreHorizontal } from "lucide-react";
import { cn } from "./ui/utils";


const { data: { user } } = await supabase.auth.getUser();
console.log('USER:', user);

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
  const [showShareLinkModal, setShowShareLinkModal] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [isImporting, setIsImporting] = useState(false);
  const [importResult, setImportResult] = useState<CSVImportResult | null>(
    null
  );
  const [renderError, setRenderError] = useState<Error | null>(null);
  const postsPerPage = 10;

  const EmptyState = ({ searchQuery }: { searchQuery: string }) => (
  <div className="flex flex-col items-center justify-center py-20 px-4">
    <div className="w-16 h-16 rounded-2xl bg-zinc-900 border border-white/5 flex items-center justify-center mb-4 shadow-inner">
      <Search className="w-8 h-8 text-zinc-700" />
    </div>
    <h3 className="text-lg font-bold text-white mb-1">
      {searchQuery ? "No matches found" : "No posts yet"}
    </h3>
    <p className="text-sm text-zinc-500 text-center max-w-[280px] leading-relaxed">
      {searchQuery 
        ? `We couldn't find anything matching "${searchQuery}". Try a different search term.` 
        : "Start tracking performance by adding your first social media post to this campaign."
      }
    </p>
    {!searchQuery && (
      <button
        onClick={() => setShowAddPostDialog(true)}
        className="mt-6 h-9 px-4 bg-white text-black hover:bg-zinc-200 text-sm font-bold rounded-lg transition-colors"
      >
        Add First Post
      </button>
    )}
  </div>
);
  // Validate ID
  if (!id) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-4">
          <button
            onClick={() => onNavigate("/campaigns")}
            className="w-9 h-9 rounded-md bg-white/[0.03] hover:bg-white/[0.06] border border-white/[0.08] flex items-center justify-center transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>
          <h1 className="text-2xl font-semibold tracking-tight text-white">
            Invalid Campaign
          </h1>
        </div>
        <Card className="bg-[#0D0D0D] border-white/[0.08]">
          <CardContent className="p-6">
            <p className="text-slate-400">No campaign ID provided.</p>
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
            className="w-9 h-9 rounded-md bg-white/[0.03] hover:bg-white/[0.06] border border-white/[0.08] flex items-center justify-center transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>
          <h1 className="text-2xl font-semibold tracking-tight text-white">
            Error Loading Campaign
          </h1>
        </div>
        <Card className="bg-[#0D0D0D] border-white/[0.08]">
          <CardContent className="p-6">
            <p className="text-red-400 mb-2">
              An error occurred while loading the campaign:
            </p>
            <p className="text-slate-400 text-sm">{renderError.message}</p>
            <button
              onClick={() => {
                setRenderError(null);
                window.location.reload();
              }}
              className="mt-4 h-9 px-4 rounded-md bg-primary hover:bg-primary/90 text-black text-sm font-medium"
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
  const {
    data: campaign,
    isLoading: campaignLoading,
    error: campaignError,
  } = useCampaign(id);
  const {
    data: posts = [],
    isLoading: postsLoading,
    refetch: refetchPosts,
  } = usePosts(id);
  const { data: metrics, refetch: refetchMetrics } = useCampaignMetrics(id);
  const { data: chartData = [] } = useCampaignMetricsTimeSeries(id);
  const { data: campaignCreators = [] } = useCreatorsByCampaign(id || "");

  const deletePostMutation = useDeletePost();
  const deleteAllPostsMutation = useDeleteAllPosts();
  const createManyPostsMutation = useCreateManyPosts();
  const scrapeAllPostsMutation = useScrapeAllPosts();
  const scrapePostMutation = useScrapePost();

  // 3-tier smart polling system for auto-refresh
  const lastMutationTimeRef = useRef<number>(0);

  useEffect(() => {
    if (!id) return;

    const refetch = () => {
      queryClient.refetchQueries({ queryKey: postsKeys.list(id) });
      queryClient.refetchQueries({ queryKey: postsKeys.campaignMetrics(id) });
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
      console.warn(
        `⚠️ Found ${stuckPosts.length} stuck posts, resetting to pending...`
      );

      // Reset stuck posts to "pending" status
      stuckPosts.forEach(async (post) => {
        try {
          await supabase
            .from("posts")
            .update({ status: "pending" })
            .eq("id", post.id);

          console.log(`✅ Reset stuck post ${post.id} to pending`);
        } catch (error) {
          console.error(`❌ Failed to reset post ${post.id}:`, error);
        }
      });

      // Refetch after reset
      setTimeout(() => {
        queryClient.refetchQueries({ queryKey: postsKeys.list(id) });
      }, 1000);
    }
  }, [posts, id, queryClient]);

  const platformOrder: Array<
    "tiktok" | "instagram" | "youtube" | "twitter" | "facebook"
  > = ["tiktok", "instagram", "youtube", "twitter", "facebook"];

  // Helper functions for scoring and KPI filtering
  const calculatePostScore = (post: PostWithCreator): number => {
    const views = Number(post.views || 0);
    const likes = Number(post.likes || 0);
    const comments = Number(post.comments || 0);
    const shares = Number(post.shares || 0);
    return views + likes * 8 + comments * 20 + shares * 25;
  };

  const isKpiPlatform = (platform: string): boolean => {
    return ["tiktok", "instagram"].includes(platform);
  };

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
            return {
              date: isNaN(date.getTime())
                ? "Invalid Date"
                : date.toLocaleDateString("en-US", {
                    month: "numeric",
                    day: "numeric",
                  }),
              views: Number(point.views) || 0,
              likes: Number(point.likes) || 0,
              comments: Number(point.comments) || 0,
              shares: Number(point.shares) || 0,
            };
          } catch (e) {
            console.error("Error formatting chart data point:", e, point);
            return null;
          }
        })
        .filter(Boolean);

      // Dev-only: Verify graph totals match KPI card totals
      if (process.env.NODE_ENV === "development" && metrics) {
        const chartTotalViews = formatted.reduce(
          (sum, p) => sum + (p?.views || 0),
          0
        );
        const chartTotalLikes = formatted.reduce(
          (sum, p) => sum + (p?.likes || 0),
          0
        );
        const chartTotalComments = formatted.reduce(
          (sum, p) => sum + (p?.comments || 0),
          0
        );
        const chartTotalShares = formatted.reduce(
          (sum, p) => sum + (p?.shares || 0),
          0
        );

        // Both now use the same data source (posts table), so totals should match
        const viewsMatch = Math.abs(chartTotalViews - metrics.total_views) < 1;
        const likesMatch = Math.abs(chartTotalLikes - metrics.total_likes) < 1;
        const commentsMatch =
          Math.abs(chartTotalComments - metrics.total_comments) < 1;
        const sharesMatch =
          Math.abs(chartTotalShares - metrics.total_shares) < 1;

        console.log("[Graph Alignment Check]", {
          "KPI Card Totals": {
            views: metrics.total_views,
            likes: metrics.total_likes,
            comments: metrics.total_comments,
            shares: metrics.total_shares,
          },
          "Chart Series Totals (sum of all dates)": {
            views: chartTotalViews,
            likes: chartTotalLikes,
            comments: chartTotalComments,
            shares: chartTotalShares,
          },
          "Alignment Status": {
            views: viewsMatch ? "✓ Aligned" : "✗ Mismatch",
            likes: likesMatch ? "✓ Aligned" : "✗ Mismatch",
            comments: commentsMatch ? "✓ Aligned" : "✗ Mismatch",
            shares: sharesMatch ? "✓ Aligned" : "✗ Mismatch",
          },
          Note: "Both use posts table with KPI platform filtering (TikTok + Instagram). Totals should match.",
        });

        // Warn if there's a mismatch
        if (!viewsMatch || !likesMatch || !commentsMatch || !sharesMatch) {
          console.warn(
            "[Graph Alignment Warning]",
            "Chart totals do not match KPI card totals. This may indicate a data inconsistency."
          );
        }
      }

      return formatted;
    } catch (e) {
      console.error("Error formatting chart data:", e);
      return [];
    }
  }, [chartData, metrics]);

  // Filter, score, and sort posts
  const filteredPosts = React.useMemo(() => {
    if (!Array.isArray(posts)) return [];
    try {
      // Step 1: Apply search filter
      let filtered = posts.filter((post) => {
        if (!post) return false;
        const creator = post.creator;
        if (!creator) return false;
        const searchLower = searchQuery.toLowerCase();
        const name = creator.name?.toLowerCase() || "";
        const handle = creator.handle?.toLowerCase() || "";
        return name.includes(searchLower) || handle.includes(searchLower);
      });

      // Step 2: Add scores to posts
      const postsWithScores = filtered.map((post) => ({
        ...post,
        score: calculatePostScore(post),
      }));

      // Step 3: Apply Top Performers filter if enabled
      if (showTopPerformers) {
        const kpiPosts = postsWithScores.filter((post) =>
          isKpiPlatform(post.platform)
        );
        // Sort by score desc and limit to top 15
        const sorted = [...kpiPosts].sort((a, b) => b.score - a.score);
        return sorted.slice(0, 15);
      }

      // Step 4: Sort by selected method
      const sorted = [...postsWithScores].sort((a, b) => {
        switch (sortBy) {
          case "score":
            return b.score - a.score;
          case "views":
            return (b.views || 0) - (a.views || 0);
          case "engagement":
            return (b.engagement_rate || 0) - (a.engagement_rate || 0);
          case "latest":
            const aDate = a.last_scraped_at || a.updated_at || "";
            const bDate = b.last_scraped_at || b.updated_at || "";
            return new Date(bDate).getTime() - new Date(aDate).getTime();
          default:
            return 0;
        }
      });

      return sorted;
    } catch (e) {
      console.error("Error filtering posts:", e);
      return posts;
    }
  }, [posts, searchQuery, sortBy, showTopPerformers]);

  const filteredCreators = React.useMemo(() => {
    if (!Array.isArray(campaignCreators)) return [];

    let filtered = campaignCreators;

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

    return filtered;
  }, [campaignCreators, creatorSearchQuery, selectedPlatform]);

  const groupedCreators = React.useMemo(() => {
    const groups = new Map<string, typeof campaignCreators>();
    platformOrder.forEach((platform) => groups.set(platform, []));
    filteredCreators.forEach((creator) => {
      const existing = groups.get(creator.platform) || [];
      existing.push(creator);
      groups.set(creator.platform, existing);
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

  // Calculate global top 5 posts from ALL posts (not filtered)
  // This ensures top 5 is consistent regardless of search/filters/pagination
  const topPosts = React.useMemo(() => {
    if (!Array.isArray(posts)) return [];

    // Calculate scores for ALL posts (before any filtering)
    const allPostsWithScores = posts
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
  }, [posts]); // Depend on raw posts, not filtered posts

  const remainingPosts = React.useMemo(() => {
    const topPostIds = new Set(topPosts.map((p) => p.id));
    return postsWithRankings.filter((p) => !topPostIds.has(p.id));
  }, [postsWithRankings, topPosts]);

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

  // Sync currentPage if it's out of bounds
  useEffect(() => {
    if (totalPages > 0 && currentPage > totalPages) {
      setCurrentPage(totalPages);
    } else if (currentPage < 1) {
      setCurrentPage(1);
    }
  }, [totalPages]); // Only depend on totalPages to avoid infinite loops

  const handleImportCreators = () => {
    setShowImportCreatorsDialog(true);
  };

  const handleImportPosts = () => {
    setShowImportPostsDialog(true);
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
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
          setShowImportPostsDialog(false);
          setImportResult(null);
        }, 3000);
      }
    } catch (error) {
      toast.error("Failed to import CSV");
      console.error(error);
    } finally {
      setIsImporting(false);
      // Reset file input
      e.target.value = "";
    }
  };

  const handleScrapeAll = () => {
    if (!id) return;
    scrapeAllPostsMutation.mutate(id);
    setShowScrapeAllDialog(false);
  };

  const handleDeleteAll = () => {
    if (!id) return;
    deleteAllPostsMutation.mutate(id);
    setShowDeleteAllDialog(false);
  };

  const handleDeletePost = (postId: string) => {
    if (!id) return;
    deletePostMutation.mutate({ id: postId, campaignId: id });
    setShowDeletePostDialog(null);
  };

  const handleExportCSV = () => {
    if (!campaign || posts.length === 0) return;

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
            className="w-9 h-9 rounded-md bg-white/[0.03] hover:bg-white/[0.06] border border-white/[0.08] flex items-center justify-center transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>
          <h1 className="text-2xl font-semibold tracking-tight text-white">
            Campaign not found
          </h1>
        </div>
        <Card className="bg-[#0D0D0D] border-white/[0.08]">
          <CardContent className="p-6">
            <p className="text-slate-400">
              {campaignError?.message ||
                "The campaign you are looking for does not exist."}
            </p>
            {id && (
              <p className="text-xs text-slate-500 mt-2">Campaign ID: {id}</p>
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
            className="w-9 h-9 rounded-md bg-white/[0.03] hover:bg-white/[0.06] border border-white/[0.08] flex items-center justify-center transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>
          <h1 className="text-2xl font-semibold tracking-tight text-white">
            Campaign not found
          </h1>
        </div>
        <Card className="bg-[#0D0D0D] border-white/[0.08]">
          <CardContent className="p-6">
            <p className="text-slate-400">
              The campaign you are looking for does not exist.
            </p>
            {id && (
              <p className="text-xs text-slate-500 mt-2">Campaign ID: {id}</p>
            )}
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3 sm:gap-4">
        <div className="flex items-center gap-3 sm:gap-4 w-full sm:w-auto">
          <button
            onClick={() => onNavigate("/campaigns")}
            className="w-9 h-9 flex-shrink-0 rounded-md bg-white/[0.03] hover:bg-white/[0.06] border border-white/[0.08] flex items-center justify-center transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>
          <div className="flex-1 min-w-0">
            <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3">
              <div>
                <h1 className="text-xl sm:text-2xl font-semibold tracking-tight text-white truncate">
                  {campaign.name}
                </h1>
                {campaign.brand_name && (
                  <p className="text-sm text-slate-400 mt-1">
                    {campaign.brand_name}
                  </p>
                )}
              </div>
              <StatusBadge status={campaign.status} />
            </div>
          </div>
        </div>
        {campaign && (
          <div className="flex items-center gap-2 w-full sm:w-auto">
            <button
              onClick={() => setShowShareLinkModal(true)}
              className="h-9 px-3 w-full sm:w-auto rounded-md bg-white/[0.03] hover:bg-white/[0.06] border border-white/[0.08] text-sm text-slate-300 flex items-center justify-center gap-2 transition-colors"
            >
              <Share2 className="w-4 h-4" />
              <span className="hidden sm:inline">Share Link</span>
              <span className="sm:hidden">Share</span>
            </button>
            <button
              onClick={() => onNavigate(`/campaigns/${campaign.id}/edit`)}
              className="h-9 px-3 w-full sm:w-auto rounded-md bg-white/[0.03] hover:bg-white/[0.06] border border-white/[0.08] text-sm text-slate-300 flex items-center justify-center gap-2 transition-colors"
            >
              <Edit2 className="w-4 h-4" />
              <span className="hidden sm:inline">Edit Campaign</span>
              <span className="sm:hidden">Edit</span>
            </button>
          </div>
        )}
      </div>

      {/* Cover Image Hero Section */}
      {campaign && (
        <div className="relative w-full h-52 md:h-64 rounded-xl overflow-hidden border border-white/[0.08] shadow-lg shadow-black/20">
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
              <div className="gradient-fallback hidden w-full h-full bg-gradient-to-br from-primary via-primary/80 to-cyan-400 items-center justify-center">
                <h2 className="text-5xl md:text-6xl font-bold text-white/90">
                  {campaign.name.charAt(0).toUpperCase()}
                </h2>
              </div>
            </>
          ) : (
            <div className="w-full h-full bg-gradient-to-br from-primary via-primary/80 to-cyan-400 flex items-center justify-center relative overflow-hidden">
              {/* Subtle pattern overlay */}
              <div
                className="absolute inset-0 opacity-10"
                style={{
                  backgroundImage:
                    "radial-gradient(circle at 2px 2px, white 1px, transparent 0)",
                  backgroundSize: "24px 24px",
                }}
              />
              <h2 className="text-5xl md:text-6xl font-bold text-white/90 relative z-10">
                {campaign.name.charAt(0).toUpperCase()}
              </h2>
            </div>
          )}
          {/* Enhanced gradient overlay for better text readability */}
          <div className="absolute inset-0 bg-gradient-to-t from-[#0D0D0D]/90 via-[#0D0D0D]/50 to-transparent" />
          {/* Text content with improved spacing and typography */}
          <div className="absolute bottom-6 left-6 right-6">
            <h2 className="text-3xl md:text-4xl font-bold text-white mb-2 drop-shadow-lg">
              {campaign.name}
            </h2>
            {campaign.brand_name && (
              <p className="text-lg md:text-xl text-white font-semibold drop-shadow-md">
                {campaign.brand_name}
              </p>
            )}
          </div>
        </div>
      )}

      {/* KPI Cards - Performance Metrics */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="bg-[#0D0D0D] border-white/[0.08]">
          <CardContent className="p-5">
            <div className="flex items-start justify-between mb-3">
              <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                <Eye className="w-5 h-5 text-primary" />
              </div>
            </div>
            <div className="text-2xl font-semibold text-white mb-1">
              {(metrics?.total_views ?? 0).toLocaleString()}
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
              {(metrics?.total_likes ?? 0).toLocaleString()}
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
              {(metrics?.total_comments ?? 0).toLocaleString()}
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
              {(metrics?.total_shares ?? 0).toLocaleString()}
            </div>
            <p className="text-sm text-slate-400">Total Shares</p>
          </CardContent>
        </Card>
      </div>

      {/* Performance Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Views Over Time */}
        <Card className="bg-[#0D0D0D] border-white/[0.08]">
          <CardContent className="p-6">
            <div className="mb-4">
              <h3 className="text-base font-semibold text-white">
                Views Over Time
              </h3>
              <p className="text-sm text-slate-400 mt-0.5">Historical data</p>
            </div>
            <ResponsiveContainer width="100%" height={220}>
              <LineChart data={formattedChartData}>
                <CartesianGrid
                  strokeDasharray="3 3"
                  stroke="#ffffff08"
                  vertical={false}
                />
                <XAxis
                  dataKey="date"
                  stroke="#64748b"
                  fontSize={11}
                  tickLine={false}
                  axisLine={{ stroke: "#ffffff08" }}
                />
                <YAxis
                  stroke="#64748b"
                  fontSize={11}
                  tickLine={false}
                  axisLine={false}
                  tickFormatter={(value) =>
                    value >= 1000 ? `${value / 1000}K` : value
                  }
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: "#0D0D0D",
                    border: "1px solid rgba(255,255,255,0.08)",
                    borderRadius: "8px",
                    fontSize: "12px",
                  }}
                />
                <Line
                  type="monotone"
                  dataKey="views"
                  stroke="#0ea5e9"
                  strokeWidth={2}
                  dot={false}
                />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Likes Over Time */}
        <Card className="bg-[#0D0D0D] border-white/[0.08]">
          <CardContent className="p-6">
            <div className="mb-4">
              <h3 className="text-base font-semibold text-white">
                Likes Over Time
              </h3>
              <p className="text-sm text-slate-400 mt-0.5">Historical data</p>
            </div>
            <ResponsiveContainer width="100%" height={220}>
              <LineChart data={formattedChartData}>
                <CartesianGrid
                  strokeDasharray="3 3"
                  stroke="#ffffff08"
                  vertical={false}
                />
                <XAxis
                  dataKey="date"
                  stroke="#64748b"
                  fontSize={11}
                  tickLine={false}
                  axisLine={{ stroke: "#ffffff08" }}
                />
                <YAxis
                  stroke="#64748b"
                  fontSize={11}
                  tickLine={false}
                  axisLine={false}
                  tickFormatter={(value) =>
                    value >= 1000 ? `${value / 1000}K` : value
                  }
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: "#0D0D0D",
                    border: "1px solid rgba(255,255,255,0.08)",
                    borderRadius: "8px",
                    fontSize: "12px",
                  }}
                />
                <Line
                  type="monotone"
                  dataKey="likes"
                  stroke="#ec4899"
                  strokeWidth={2}
                  dot={false}
                />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Comments Over Time */}
        <Card className="bg-[#0D0D0D] border-white/[0.08]">
          <CardContent className="p-6">
            <div className="mb-4">
              <h3 className="text-base font-semibold text-white">
                Comments Over Time
              </h3>
              <p className="text-sm text-slate-400 mt-0.5">Last 14 days</p>
            </div>
            <ResponsiveContainer width="100%" height={220}>
              <LineChart data={formattedChartData}>
                <CartesianGrid
                  strokeDasharray="3 3"
                  stroke="#ffffff08"
                  vertical={false}
                />
                <XAxis
                  dataKey="date"
                  stroke="#64748b"
                  fontSize={11}
                  tickLine={false}
                  axisLine={{ stroke: "#ffffff08" }}
                />
                <YAxis
                  stroke="#64748b"
                  fontSize={11}
                  tickLine={false}
                  axisLine={false}
                  tickFormatter={(value) =>
                    value >= 1000 ? `${value / 1000}K` : value
                  }
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: "#0D0D0D",
                    border: "1px solid rgba(255,255,255,0.08)",
                    borderRadius: "8px",
                    fontSize: "12px",
                  }}
                />
                <Line
                  type="monotone"
                  dataKey="comments"
                  stroke="#06b6d4"
                  strokeWidth={2}
                  dot={false}
                />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Shares Over Time */}
        <Card className="bg-[#0D0D0D] border-white/[0.08]">
          <CardContent className="p-6">
            <div className="mb-4">
              <h3 className="text-base font-semibold text-white">
                Shares Over Time
              </h3>
              <p className="text-sm text-slate-400 mt-0.5">Last 14 days</p>
            </div>
            <ResponsiveContainer width="100%" height={220}>
              <LineChart data={formattedChartData}>
                <CartesianGrid
                  strokeDasharray="3 3"
                  stroke="#ffffff08"
                  vertical={false}
                />
                <XAxis
                  dataKey="date"
                  stroke="#64748b"
                  fontSize={11}
                  tickLine={false}
                  axisLine={{ stroke: "#ffffff08" }}
                />
                <YAxis
                  stroke="#64748b"
                  fontSize={11}
                  tickLine={false}
                  axisLine={false}
                  tickFormatter={(value) =>
                    value >= 1000 ? `${value / 1000}K` : value
                  }
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: "#0D0D0D",
                    border: "1px solid rgba(255,255,255,0.08)",
                    borderRadius: "8px",
                    fontSize: "12px",
                  }}
                />
                <Line
                  type="monotone"
                  dataKey="shares"
                  stroke="#a855f7"
                  strokeWidth={2}
                  dot={false}
                />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      {/* Creators Section */}
          {campaignCreators.length > 0 && (
      <Card className="bg-[#09090b] border-white/[0.04] shadow-2xl">
        <CardContent className="p-5 md:p-6">
          {/* Header Section */}
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
            <div>
              <h3 className="text-lg font-bold text-white tracking-tight">Campaign Roster</h3>
              <p className="text-xs text-zinc-500 mt-1 uppercase tracking-wider font-semibold">
                {filteredCreators.length} of {campaignCreators.length} Active Participants
              </p>
            </div>

            {/* Optimized Filters */}
            <div className="flex items-center gap-2">
              <div className="relative flex-1 md:w-64 group">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500 group-focus-within:text-primary transition-colors" />
                <Input
                  value={creatorSearchQuery}
                  onChange={(e) => setCreatorSearchQuery(e.target.value)}
                  placeholder="Quick search..."
                  className="h-10 pl-9 bg-zinc-950 border-white/5 text-zinc-300 rounded-xl focus:ring-primary/20"
                />
              </div>
              <select
                value={selectedPlatform}
                onChange={(e) => setSelectedPlatform(e.target.value)}
                className="h-10 px-3 rounded-xl bg-zinc-950 border border-white/5 text-zinc-400 text-xs font-bold uppercase tracking-wider focus:ring-1 focus:ring-primary/50 appearance-none cursor-pointer"
              >
                <option value="all">All</option>
                <option value="tiktok">TikTok</option>
                <option value="instagram">Instagram</option>
                <option value="youtube">YouTube</option>
              </select>
            </div>
          </div>

          {groupedCreators.length > 0 ? (
            <div className="space-y-8 max-h-[600px] overflow-y-auto pr-2 custom-scrollbar">
              {groupedCreators.map((group) => {
                const platformPosts = group.creators.reduce((total, creator) => {
                  return total + posts.filter((p) => p.creator_id === creator.id).length;
                }, 0);

                return (
                  <div key={group.platform} className="animate-in fade-in slide-in-from-bottom-2 duration-300">
                    {/* Platform Section Header */}
                    <div className="flex items-center gap-3 mb-4">
                      <PlatformBadge platform={group.platform} />
                      <div className="h-px flex-1 bg-white/5" />
                      <span className="text-[10px] font-bold text-zinc-600 uppercase tracking-widest">
                        {group.creators.length} Creators • {platformPosts} Total Posts
                      </span>
                    </div>

                    {/* Optimized Grid Layout */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
                      {group.creators.map((creator) => {
                        const creatorPosts = posts.filter((p) => p.creator_id === creator.id);
                        const hasPosts = creatorPosts.length > 0;

                        return (
                          <div
                            key={creator.id}
                            className={cn(
                              "group relative p-3 rounded-xl border transition-all hover:scale-[1.02] cursor-pointer",
                              hasPosts
                                ? "bg-emerald-500/[0.02] border-emerald-500/10 hover:border-emerald-500/40"
                                : "bg-zinc-900/40 border-white/5 hover:border-white/20"
                            )}
                          >
                            <div className="flex items-center gap-3">
                              {/* Avatar with Status Pip */}
                              <div className="relative shrink-0">
                                <div className="w-10 h-10 rounded-full bg-gradient-to-br from-zinc-800 to-zinc-900 flex items-center justify-center text-zinc-400 font-bold text-sm border border-white/10 group-hover:border-primary/50 transition-colors">
                                  {creator.name.charAt(0).toUpperCase()}
                                </div>
                                {hasPosts && (
                                  <span className="absolute -top-0.5 -right-0.5 w-3 h-3 bg-emerald-500 border-2 border-[#0D0D0D] rounded-full" />
                                )}
                              </div>

                              <div className="flex-1 min-w-0">
                                <div className="text-sm font-bold text-white truncate leading-tight group-hover:text-primary transition-colors">
                                  {creator.name}
                                </div>
                                <div className="text-[11px] text-zinc-500 truncate font-medium">
                                  @{creator.handle}
                                </div>
                              </div>
                            </div>

                            {/* Post Counter Badge */}
                            {hasPosts && (
                              <div className="mt-3 flex items-center justify-between border-t border-white/[0.04] pt-2">
                                <span className="text-[10px] font-bold text-emerald-500/80 uppercase">Active</span>
                                <span className="text-[10px] font-mono text-zinc-400">
                                  {creatorPosts.length} {creatorPosts.length === 1 ? 'POST' : 'POSTS'}
                                </span>
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <EmptyState searchQuery={creatorSearchQuery} />
          )}
        </CardContent>
      </Card>
    )}

      {/* Posts Table */}


      /* Posts Table Section - Fixed Version */

      <Card className="bg-[#0A0A0A] border-white/[0.08] overflow-hidden">
        <CardContent className="p-0">
          {/* Header Section - Same as before */}
          <div className="p-6 border-b border-white/[0.08]">
            {/* ... header content stays the same ... */}
          </div>

          {/* Table Content */}
          <div className="overflow-x-auto">
            {postsLoading ? (
              <div className="p-6 space-y-3">
                {Array.from({ length: 5 }).map((_, i) => (
                  <PostRowSkeleton key={i} />
                ))}
              </div>
            ) : topPosts.length > 0 || paginatedRemainingPosts.length > 0 ? (
              <>
                <table className="w-full">
                  <thead className="bg-white/[0.02] border-b border-white/[0.08]">
                    <tr>
                      <th className="text-center px-4 py-3 text-xs font-semibold text-slate-400 uppercase tracking-wider w-16">
                        Rank
                      </th>
                      <th className="text-left px-6 py-3 text-xs font-semibold text-slate-400 uppercase tracking-wider">
                        Creator
                      </th>
                      <th className="text-left px-6 py-3 text-xs font-semibold text-slate-400 uppercase tracking-wider">
                        Platform
                      </th>
                      <th className="text-right px-6 py-3 text-xs font-semibold text-slate-400 uppercase tracking-wider">
                        Views
                      </th>
                      <th className="text-right px-6 py-3 text-xs font-semibold text-slate-400 uppercase tracking-wider hidden md:table-cell">
                        Engagement
                      </th>
                      <th className="text-right px-6 py-3 text-xs font-semibold text-slate-400 uppercase tracking-wider">
                        Rate
                      </th>
                      <th className="text-center px-6 py-3 text-xs font-semibold text-slate-400 uppercase tracking-wider hidden lg:table-cell">
                        Status
                      </th>
                      <th className="px-4 py-3 w-20"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/[0.04]">
                    {/* Top 5 Posts Section */}
                    {topPosts.length > 0 && (
                      <>
                        {topPosts.map((post, index) => {
                          const postWithRanking = postsWithRankings.find(p => p.id === post.id);
                          return (
                            <tr 
                              key={post.id} 
                              className="group hover:bg-white/[0.02] transition-colors"
                            >
                              {/* Rank Column */}
                              <td className="px-4 py-4 text-center">
                                {postWithRanking?.positionEmoji && (
                                  <span className="text-2xl">{postWithRanking.positionEmoji}</span>
                                )}
                              </td>
                              
                              {/* Creator Column */}
                              <td className="px-6 py-4">
                                <div className="flex flex-col min-w-0">
                                  <span className="text-sm font-medium text-white truncate">
                                    {post.creator?.name || 'Unknown'}
                                  </span>
                                  <span className="text-xs text-slate-500">
                                    @{post.creator?.handle || 'unknown'}
                                  </span>
                                </div>
                              </td>
                              
                              <td className="px-6 py-4">
                                <PlatformBadge platform={post.platform} />
                              </td>
                              <td className="px-6 py-4 text-right">
                                <span className="text-sm font-mono text-white">
                                  {(post.views || 0).toLocaleString()}
                                </span>
                              </td>
                              <td className="px-6 py-4 text-right hidden md:table-cell">
                                <div className="flex flex-col items-end gap-0.5">
                                  <div className="flex items-center gap-2 text-xs text-slate-400">
                                    <Heart className="w-3 h-3" />
                                    <span>{(post.likes || 0).toLocaleString()}</span>
                                  </div>
                                  <div className="flex items-center gap-2 text-xs text-slate-400">
                                    <MessageCircle className="w-3 h-3" />
                                    <span>{(post.comments || 0).toLocaleString()}</span>
                                  </div>
                                </div>
                              </td>
                              <td className="px-6 py-4 text-right">
                                <span className="text-sm font-semibold text-emerald-400">
                                  {(post.engagement_rate || 0).toFixed(1)}%
                                </span>
                              </td>
                              <td className="px-6 py-4 text-center hidden lg:table-cell">
                                <StatusBadge status={post.status} />
                              </td>
                              <td className="px-4 py-4">
                                <div className="flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                  {post.post_url && (
                                    <button
                                      onClick={() => window.open(post.post_url, '_blank')}
                                      className="p-2 hover:bg-white/[0.06] rounded-md text-slate-400 hover:text-white transition-colors"
                                      title="View Post"
                                    >
                                      <ExternalLink className="w-4 h-4" />
                                    </button>
                                  )}
                                  <button
                                    onClick={() => {
                                      if (post.post_url && id) {
                                        scrapePostMutation.mutate({ postId: post.id, campaignId: id });
                                      }
                                    }}
                                    disabled={!post.post_url || post.status === 'scraping'}
                                    className="p-2 hover:bg-white/[0.06] rounded-md text-slate-400 hover:text-primary transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                                    title="Refresh Metrics"
                                  >
                                    <RefreshCw className={cn(
                                      "w-4 h-4",
                                      post.status === 'scraping' && "animate-spin"
                                    )} />
                                  </button>
                                  <button
                                    onClick={() => setShowDeletePostDialog(post.id)}
                                    className="p-2 hover:bg-red-500/10 rounded-md text-slate-400 hover:text-red-400 transition-colors"
                                    title="Delete Post"
                                  >
                                    <Trash2 className="w-4 h-4" />
                                  </button>
                                </div>
                              </td>
                            </tr>
                          );
                        })}
                        {paginatedRemainingPosts.length > 0 && (
                          <tr>
                            <td colSpan={8} className="px-6 py-2">
                              <div className="flex items-center gap-2">
                                <div className="flex-1 h-px bg-white/[0.08]" />
                                <span className="text-xs font-medium text-slate-500 uppercase tracking-wider">
                                  Other Posts
                                </span>
                                <div className="flex-1 h-px bg-white/[0.08]" />
                              </div>
                            </td>
                          </tr>
                        )}
                      </>
                    )}

                    {/* Remaining Posts */}
                    {paginatedRemainingPosts.map((post) => (
                      <tr 
                        key={post.id} 
                        className="group hover:bg-white/[0.02] transition-colors"
                      >
                        {/* Rank Column - Trending Badge */}
                        <td className="px-4 py-4 text-center">
                          {post.badges?.trending && (
                            <div className="inline-flex items-center justify-center w-12 h-6 rounded-full bg-orange-500/10 border border-orange-500/20">
                              <span className="text-[10px] font-bold text-orange-400">🔥</span>
                            </div>
                          )}
                        </td>
                        
                        {/* Creator Column */}
                        <td className="px-6 py-4">
                          <div className="flex flex-col min-w-0">
                            <span className="text-sm font-medium text-white truncate">
                              {post.creator?.name || 'Unknown'}
                            </span>
                            <span className="text-xs text-slate-500">
                              @{post.creator?.handle || 'unknown'}
                            </span>
                          </div>
                        </td>
                        
                        <td className="px-6 py-4">
                          <PlatformBadge platform={post.platform} />
                        </td>
                        <td className="px-6 py-4 text-right">
                          <span className="text-sm font-mono text-white">
                            {(post.views || 0).toLocaleString()}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-right hidden md:table-cell">
                          <div className="flex flex-col items-end gap-0.5">
                            <div className="flex items-center gap-2 text-xs text-slate-400">
                              <Heart className="w-3 h-3" />
                              <span>{(post.likes || 0).toLocaleString()}</span>
                            </div>
                            <div className="flex items-center gap-2 text-xs text-slate-400">
                              <MessageCircle className="w-3 h-3" />
                              <span>{(post.comments || 0).toLocaleString()}</span>
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-4 text-right">
                          <span className="text-sm font-semibold text-emerald-400">
                            {(post.engagement_rate || 0).toFixed(1)}%
                          </span>
                        </td>
                        <td className="px-6 py-4 text-center hidden lg:table-cell">
                          <StatusBadge status={post.status} />
                        </td>
                        <td className="px-4 py-4">
                          <div className="flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                            {post.post_url && (
                              <button
                                onClick={() => window.open(post.post_url, '_blank')}
                                className="p-2 hover:bg-white/[0.06] rounded-md text-slate-400 hover:text-white transition-colors"
                                title="View Post"
                              >
                                <ExternalLink className="w-4 h-4" />
                              </button>
                            )}
                            <button
                              onClick={() => {
                                if (post.post_url && id) {
                                  scrapePostMutation.mutate({ postId: post.id, campaignId: id });
                                }
                              }}
                              disabled={!post.post_url || post.status === 'scraping'}
                              className="p-2 hover:bg-white/[0.06] rounded-md text-slate-400 hover:text-primary transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                              title="Refresh Metrics"
                            >
                              <RefreshCw className={cn(
                                "w-4 h-4",
                                post.status === 'scraping' && "animate-spin"
                              )} />
                            </button>
                            <button
                              onClick={() => setShowDeletePostDialog(post.id)}
                              className="p-2 hover:bg-red-500/10 rounded-md text-slate-400 hover:text-red-400 transition-colors"
                              title="Delete Post"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>

                {/* Pagination - Same as before */}
                {totalPages > 1 && (
                  <div className="px-6 py-4 border-t border-white/[0.08] bg-white/[0.01]">
                    <div className="flex items-center justify-between">
                      <p className="text-sm text-slate-400">
                        Showing {startIndex + 1} to {Math.min(startIndex + postsPerPage, remainingPosts.length)} of {remainingPosts.length} posts
                      </p>
                      
                      <div className="flex items-center gap-2">
                        <Button
                          onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
                          disabled={currentPage === 1}
                          variant="outline"
                          className="h-9 px-3"
                        >
                          Previous
                        </Button>
                        
                        <div className="flex items-center gap-1">
                          {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                            let pageNum;
                            if (totalPages <= 5) {
                              pageNum = i + 1;
                            } else if (currentPage <= 3) {
                              pageNum = i + 1;
                            } else if (currentPage >= totalPages - 2) {
                              pageNum = totalPages - 4 + i;
                            } else {
                              pageNum = currentPage - 2 + i;
                            }
                            
                            return (
                              <Button
                                key={i}
                                onClick={() => setCurrentPage(pageNum)}
                                variant={currentPage === pageNum ? "default" : "outline"}
                                className="h-9 w-9 p-0"
                              >
                                {pageNum}
                              </Button>
                            );
                          })}
                        </div>
                        
                        <Button
                          onClick={() => setCurrentPage(Math.min(totalPages, currentPage + 1))}
                          disabled={currentPage === totalPages}
                          variant="outline"
                          className="h-9 px-3"
                        >
                          Next
                        </Button>
                      </div>
                    </div>
                  </div>
                )}
              </>
            ) : (
              <EmptyState searchQuery={searchQuery} />
            )}
          </div>
        </CardContent>
      </Card>
      {/* Import Creators Dialog */}
      <ImportCreatorsDialog
        open={showImportCreatorsDialog}
        onClose={() => setShowImportCreatorsDialog(false)}
      />

      {/* Import Posts Dialog */}
      {showImportPostsDialog && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50">
          <Card className="bg-[#0D0D0D] border-white/[0.08] w-full max-w-md">
            <CardContent className="p-6">
              <h3 className="text-lg font-semibold text-white mb-4">
                Import Posts from CSV
              </h3>

              {!isImporting && !importResult && (
                <>
                  <div className="border-2 border-dashed border-white/[0.08] rounded-lg p-8 text-center hover:border-primary/50 transition-colors cursor-pointer mb-4">
                    <input
                      type="file"
                      accept=".csv"
                      onChange={handleFileUpload}
                      className="hidden"
                      id="csv-upload"
                      disabled={isImporting}
                    />
                    <label htmlFor="csv-upload" className="cursor-pointer">
                      <Upload className="w-12 h-12 mx-auto mb-3 text-slate-500" />
                      <p className="text-sm text-slate-300 mb-1">
                        Upload CSV file
                      </p>
                      <p className="text-xs text-slate-500 mb-3">
                        Required: creator_name, creator_handle, platform,
                        post_url
                      </p>
                      <p className="text-xs text-slate-400">
                        Optional: posted_date, views, likes, comments, shares
                      </p>
                    </label>
                  </div>
                  <button
                    onClick={handleDownloadTemplate}
                    className="w-full h-9 mb-3 rounded-md bg-white/[0.03] hover:bg-white/[0.06] border border-white/[0.08] text-sm text-slate-300 flex items-center justify-center gap-2 transition-colors"
                  >
                    <Download className="w-4 h-4" />
                    Download CSV Template
                  </button>
                  <div className="flex gap-3">
                    <button
                      onClick={() => setShowImportPostsDialog(false)}
                      className="flex-1 h-9 rounded-md bg-white/[0.03] hover:bg-white/[0.06] border border-white/[0.08] text-sm text-slate-300 transition-colors"
                    >
                      Cancel
                    </button>
                  </div>
                </>
              )}

              {isImporting && (
                <div className="py-8 text-center">
                  <div className="w-12 h-12 mx-auto mb-4 border-4 border-primary/20 border-t-primary rounded-full animate-spin"></div>
                  <p className="text-sm text-slate-300">Importing posts...</p>
                  <p className="text-xs text-slate-500 mt-1">
                    This may take a moment
                  </p>
                </div>
              )}

              {importResult && (
                <div className="space-y-4">
                  <div className="p-4 rounded-lg bg-emerald-500/10 border border-emerald-500/20">
                    <p className="text-sm text-emerald-400 font-medium mb-1">
                      ✓ {importResult.success_count} post
                      {importResult.success_count !== 1 ? "s" : ""} imported
                      successfully
                    </p>
                  </div>

                  {importResult.error_count > 0 && (
                    <div className="p-4 rounded-lg bg-red-500/10 border border-red-500/20">
                      <p className="text-sm text-red-400 font-medium mb-2">
                        {importResult.error_count} error
                        {importResult.error_count !== 1 ? "s" : ""}
                      </p>
                      <div className="space-y-1 max-h-32 overflow-y-auto">
                        {importResult.errors.map((error, idx) => (
                          <p key={idx} className="text-xs text-red-300">
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
                    className="w-full h-9 rounded-md bg-white/[0.03] hover:bg-white/[0.06] border border-white/[0.08] text-sm text-slate-300 transition-colors"
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
          <Card className="bg-[#0D0D0D] border-white/[0.08] w-full max-w-md">
            <CardContent className="p-6">
              <h3 className="text-lg font-semibold text-white mb-2">
                Scrape All Posts?
              </h3>
              <p className="text-sm text-slate-400 mb-6">
                This will scrape metrics for all posts with URLs in this
                campaign. Posts without URLs will be skipped.
              </p>
              <div className="flex gap-3">
                <button
                  onClick={() => setShowScrapeAllDialog(false)}
                  className="flex-1 h-9 rounded-md bg-white/[0.03] hover:bg-white/[0.06] border border-white/[0.08] text-sm text-slate-300 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleScrapeAll}
                  className="flex-1 h-9 rounded-md bg-[rgba(89,104,120,1)] hover:bg-[rgba(89,104,120,0.9)] text-[var(--accent-foreground)] text-sm font-medium transition-colors"
                >
                  Start Scraping
                </button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Delete All Confirmation Dialog */}
      {showDeleteAllDialog && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50">
          <Card className="bg-[#0D0D0D] border-white/[0.08] w-full max-w-md">
            <CardContent className="p-6">
              <h3 className="text-lg font-semibold text-white mb-2">
                Delete all posts?
              </h3>
              <p className="text-sm text-slate-400 mb-6">
                This removes all posts in this campaign. This cannot be undone.
              </p>
              <div className="flex gap-3">
                <button
                  onClick={() => setShowDeleteAllDialog(false)}
                  className="flex-1 h-9 rounded-md bg-white/[0.03] hover:bg-white/[0.06] border border-white/[0.08] text-sm text-slate-300 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleDeleteAll}
                  className="flex-1 h-9 rounded-md bg-red-500 hover:bg-red-600 text-white text-sm font-medium transition-colors"
                >
                  Delete
                </button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Delete Post Confirmation Dialog */}
      {showDeletePostDialog && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50">
          <Card className="bg-[#0D0D0D] border-white/[0.08] w-full max-w-md">
            <CardContent className="p-6">
              <h3 className="text-lg font-semibold text-white mb-2">
                Delete this post?
              </h3>
              <p className="text-sm text-slate-400 mb-6">
                This will permanently delete this post from the campaign. This
                cannot be undone.
              </p>
              <div className="flex gap-3">
                <button
                  onClick={() => setShowDeletePostDialog(null)}
                  className="flex-1 h-9 rounded-md bg-white/[0.03] hover:bg-white/[0.06] border border-white/[0.08] text-sm text-slate-300 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={() => handleDeletePost(showDeletePostDialog)}
                  className="flex-1 h-9 rounded-md bg-red-500 hover:bg-red-600 text-white text-sm font-medium transition-colors"
                >
                  Delete
                </button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

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
