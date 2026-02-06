import React, { useState, useMemo } from "react";
import { Card, CardContent } from "./ui/card";
import {
  Search,
  Filter,
  Trash2,
  RefreshCw,
  Download,
  Plus,
  MoreHorizontal,
  ExternalLink,
  Link as LinkIcon,
  ChevronLeft,
  ChevronRight,
  X,
} from "lucide-react";
import { StatusBadge } from "./status-badge";
import {
  PlatformIcon,
  normalizePlatform,
  getPlatformLabel,
} from "./ui/PlatformIcon";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "./ui/select";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "./ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "./ui/dialog";
import { Button } from "./ui/button";
import { PostCard } from "./post-card";
import { PostRowSkeleton } from "./ui/skeleton";
import { formatWithGrowth } from "../../lib/utils/format";
import type { PostWithRankings } from "../../lib/types/database";

// Check if platform is included in KPI calculations
const isKpiPlatform = (platform: string): boolean => {
  const kpiPlatforms = [
    "tiktok",
    "instagram",
    "youtube",
    "twitter",
    "facebook",
  ];
  return kpiPlatforms.includes(platform?.toLowerCase());
};

// Calculate post score for ranking
const calculatePostScore = (post: {
  views?: number;
  likes?: number;
  comments?: number;
  shares?: number;
  engagement_rate?: number;
}): number => {
  const views = post.views || 0;
  const likes = post.likes || 0;
  const comments = post.comments || 0;
  const shares = post.shares || 0;
  const engagementRate = post.engagement_rate || 0;

  // Weighted score: views (1x) + likes (2x) + comments (3x) + shares (4x) + engagement (100x)
  return views + likes * 2 + comments * 3 + shares * 4 + engagementRate * 100;
};

export interface CampaignPostsSectionProps {
  posts: PostWithRankings[];
  mode: "internal" | "public";
  campaignId: string;
  isLoading?: boolean;
  // Internal-only callbacks (optional)
  onAddPost?: () => void;
  onDeletePost?: (postId: string) => void;
  onScrapePost?: (postId: string) => void;
  onScrapeAll?: () => void;
  onExportCSV?: () => void;
  onImportCreators?: () => void;
  onImportPosts?: () => void;
  onDeleteAllPosts?: () => void;
  isScraping?: boolean;
  scrapingPostId?: string | null;
}

type SortOption = "score" | "views" | "engagement" | "latest";

export function CampaignPostsSection({
  posts,
  mode,
  campaignId,
  isLoading = false,
  onAddPost,
  onDeletePost,
  onScrapePost,
  onScrapeAll,
  onExportCSV,
  onImportCreators,
  onImportPosts,
  onDeleteAllPosts,
  isScraping = false,
  scrapingPostId = null,
}: CampaignPostsSectionProps) {
  const isInternal = mode === "internal";
  const postsPerPage = 10;

  // State
  const [searchQuery, setSearchQuery] = useState("");
  const [sortBy, setSortBy] = useState<SortOption>("score");
  const [currentPage, setCurrentPage] = useState(1);
  const [showTopPerformers, setShowTopPerformers] = useState(false);
  const [postFiltersOpen, setPostFiltersOpen] = useState(false);
  const [postPlatformFilter, setPostPlatformFilter] = useState("all");
  const [postStatusFilter, setPostStatusFilter] = useState("all");
  const [postCreatorFilter, setPostCreatorFilter] = useState("all");
  const [postDateFilter, setPostDateFilter] = useState("all");

  // Check if mobile (simplified, using CSS classes for actual responsive behavior)
  const isMobile = typeof window !== "undefined" && window.innerWidth < 1024;

  // Get unique creators for filter dropdown
  const postCreatorOptions = useMemo(() => {
    const map = new Map<string, string>();
    posts.forEach((post) => {
      if (post.creator_id && post.creator?.name) {
        map.set(post.creator_id, post.creator.name);
      }
    });
    return Array.from(map.entries()).map(([id, name]) => ({ id, name }));
  }, [posts]);

  // Active filter count
  const activePostFilterCount = useMemo(() => {
    return [
      postPlatformFilter,
      postStatusFilter,
      postCreatorFilter,
      postDateFilter,
    ].filter((value) => value !== "all").length;
  }, [postPlatformFilter, postStatusFilter, postCreatorFilter, postDateFilter]);

  // Active post filters for display
  const activePostFilters = useMemo(() => {
    const filters: { key: string; label: string; onClear: () => void }[] = [];
    if (postPlatformFilter !== "all") {
      filters.push({
        key: "platform",
        label: `Platform: ${postPlatformFilter}`,
        onClear: () => setPostPlatformFilter("all"),
      });
    }
    if (postStatusFilter !== "all") {
      filters.push({
        key: "status",
        label: `Status: ${postStatusFilter}`,
        onClear: () => setPostStatusFilter("all"),
      });
    }
    if (postCreatorFilter !== "all") {
      const creator = postCreatorOptions.find(
        (c) => c.id === postCreatorFilter
      );
      filters.push({
        key: "creator",
        label: `Creator: ${creator?.name || "Unknown"}`,
        onClear: () => setPostCreatorFilter("all"),
      });
    }
    if (postDateFilter !== "all") {
      const labels: Record<string, string> = {
        "7d": "Last 7 days",
        "30d": "Last 30 days",
        "90d": "Last 90 days",
      };
      filters.push({
        key: "date",
        label: labels[postDateFilter] || postDateFilter,
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

  // Filter and sort posts
  const filteredPosts = useMemo(() => {
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
      console.error("Error filtering posts:", e);
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

  // Posts with rankings
  const postsWithRankings = useMemo(() => {
    return filteredPosts.map((post, index) => ({
      ...post,
      rank: index + 1,
      positionEmoji:
        index === 0
          ? "🥇"
          : index === 1
            ? "🥈"
            : index === 2
              ? "🥉"
              : undefined,
    }));
  }, [filteredPosts]);

  // Top 5 highlighted posts
  const highlightedTopPosts = useMemo(() => {
    if (showTopPerformers) return [];
    return postsWithRankings.slice(0, 5);
  }, [postsWithRankings, showTopPerformers]);

  // Remaining posts (after top 5)
  const remainingPosts = useMemo(() => {
    if (showTopPerformers) return postsWithRankings;
    return postsWithRankings.slice(5);
  }, [postsWithRankings, showTopPerformers]);

  // Pagination
  const totalPages = Math.max(
    1,
    Math.ceil(remainingPosts.length / postsPerPage)
  );
  const safeCurrentPage = Math.min(currentPage, totalPages);
  const startIndex = (safeCurrentPage - 1) * postsPerPage;
  const paginatedRemainingPosts = remainingPosts.slice(
    startIndex,
    startIndex + postsPerPage
  );

  // Mobile pagination
  const mobileTotalPages = Math.max(
    1,
    Math.ceil(
      (showTopPerformers ? postsWithRankings.length : remainingPosts.length) /
        postsPerPage
    )
  );
  const mobileSafeCurrentPage = Math.min(currentPage, mobileTotalPages);
  const mobileStartIndex = (mobileSafeCurrentPage - 1) * postsPerPage;
  const mobilePaginatedPosts = showTopPerformers
    ? postsWithRankings.slice(mobileStartIndex, mobileStartIndex + postsPerPage)
    : remainingPosts.slice(mobileStartIndex, mobileStartIndex + postsPerPage);
  const visibleRemainingPosts = remainingPosts.slice(0, postsPerPage);

  // Handle scrape post
  const handleScrapePost = (postId: string) => {
    if (onScrapePost) {
      onScrapePost(postId);
    }
  };

  // Handle delete post
  const handleDeletePost = (postId: string) => {
    if (onDeletePost) {
      onDeletePost(postId);
    }
  };

  // Generate pagination pages
  const generatePaginationPages = (total: number, current: number) => {
    const pages: number[] = [];
    if (total <= 5) {
      for (let i = 1; i <= total; i++) pages.push(i);
    } else {
      pages.push(1);
      if (current > 3) pages.push(-1); // ellipsis placeholder
      for (
        let i = Math.max(2, current - 1);
        i <= Math.min(total - 1, current + 1);
        i++
      ) {
        if (!pages.includes(i)) pages.push(i);
      }
      if (current < total - 2) pages.push(-1);
      if (!pages.includes(total)) pages.push(total);
    }
    return pages.filter((p, i, arr) => p !== -1 || arr[i - 1] !== -1);
  };

  const mobilePaginationPages = generatePaginationPages(
    mobileTotalPages,
    mobileSafeCurrentPage
  ).filter((p) => p > 0);

  const mobileAllPaginationPages = generatePaginationPages(
    Math.ceil(postsWithRankings.length / postsPerPage),
    mobileSafeCurrentPage
  ).filter((p) => p > 0);

  return (
    <>
      <Card
        id="campaign-posts"
        className="relative overflow-hidden bg-[#0B0C10] border-white/[0.08] shadow-[0_12px_40px_-20px_rgba(0,0,0,0.8)]"
      >
        <CardContent className="relative p-0">
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_20%_20%,rgba(56,189,248,0.08),transparent_45%),radial-gradient(circle_at_80%_0%,rgba(16,185,129,0.08),transparent_40%)]" />
          <div className="relative p-4 sm:p-6 border-b border-white/[0.08] bg-white/[0.02] backdrop-blur-xl">
            <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between mb-4 sm:mb-5">
              <div>
                <h3 className="text-lg sm:text-xl font-semibold text-white tracking-tight">
                  Posts
                </h3>
                <p className="text-sm text-slate-400 mt-1">
                  {posts.length} posts
                  {highlightedTopPosts.length > 0
                    ? ` · ${highlightedTopPosts.length} top`
                    : ""}
                </p>
              </div>
              {isInternal && (
                <div className="flex flex-col gap-2 w-full sm:flex-row sm:items-center sm:justify-end sm:gap-3 md:w-auto">
                  <button
                    onClick={onAddPost}
                    className="h-11 px-4 bg-primary hover:bg-primary/90 text-[rgb(0,0,0)] text-xs font-semibold flex items-center justify-center gap-1.5 rounded-lg transition-colors w-full sm:w-auto shadow-[0_8px_20px_-12px_rgba(34,197,94,0.8)]"
                  >
                    <Plus className="w-4 h-4" />
                    Add Post
                  </button>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <button
                        type="button"
                        className="h-11 px-3 rounded-lg bg-white/[0.02] hover:bg-white/[0.06] border border-white/[0.08] text-xs text-slate-300 flex items-center justify-center gap-1.5 transition-colors w-full sm:w-auto"
                        aria-label="Post actions"
                      >
                        <MoreHorizontal className="w-4 h-4" />
                        Actions
                      </button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-56">
                      <DropdownMenuItem
                        onSelect={onScrapeAll}
                        disabled={posts.length === 0}
                      >
                        <RefreshCw className="w-4 h-4" />
                        Scrape all posts
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        onSelect={onExportCSV}
                        disabled={posts.length === 0}
                      >
                        <Download className="w-4 h-4" />
                        Export CSV
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                      {onImportCreators && (
                        <DropdownMenuItem onSelect={onImportCreators}>
                          <Plus className="w-4 h-4" />
                          Import creators
                        </DropdownMenuItem>
                      )}
                      {onImportPosts && (
                        <DropdownMenuItem onSelect={onImportPosts}>
                          <Plus className="w-4 h-4" />
                          Import posts CSV
                        </DropdownMenuItem>
                      )}
                      {(onImportCreators || onImportPosts) &&
                        onDeleteAllPosts && <DropdownMenuSeparator />}
                      {onDeleteAllPosts && (
                        <DropdownMenuItem
                          variant="destructive"
                          onSelect={onDeleteAllPosts}
                          disabled={posts.length === 0}
                        >
                          <Trash2 className="w-4 h-4" />
                          Delete all posts
                        </DropdownMenuItem>
                      )}
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              )}
              {!isInternal && onExportCSV && (
                <button
                  onClick={onExportCSV}
                  disabled={posts.length === 0}
                  className="h-11 px-4 bg-white/[0.02] hover:bg-white/[0.06] border border-white/[0.08] text-xs text-slate-300 font-semibold flex items-center justify-center gap-1.5 rounded-lg transition-colors disabled:opacity-50"
                >
                  <Download className="w-4 h-4" />
                  Export CSV
                </button>
              )}
            </div>
            <div className="flex items-center gap-3">
              <div className="hidden md:block w-full md:w-auto">
                <Select
                  value={sortBy}
                  onValueChange={(value: SortOption) => setSortBy(value)}
                >
                  <SelectTrigger className="h-9 w-fit md:w-[170px] bg-white/[0.02] border-white/[0.08] text-slate-300 text-xs">
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
                className="h-11 min-h-[44px] px-3 rounded-lg bg-white/[0.02] hover:bg-white/[0.06] border border-white/[0.08] text-sm text-slate-300 flex items-center justify-center gap-2 transition-colors"
              >
                <Filter className="w-4 h-4" />
                Filters
                {activePostFilterCount > 0 && (
                  <span className="ml-1 w-5 h-5 rounded-full bg-primary text-black text-xs flex items-center justify-center font-semibold">
                    {activePostFilterCount}
                  </span>
                )}
              </button>
            </div>
          </div>

          {isLoading ? (
            <div className="space-y-0">
              {Array.from({ length: 5 }).map((_, i) => (
                <PostRowSkeleton key={i} />
              ))}
            </div>
          ) : highlightedTopPosts.length > 0 ||
            visibleRemainingPosts.length > 0 ? (
            <>
              {/* Search and Active Filters */}
              <div className="px-4 sm:px-6 pb-4">
                <div className="space-y-3">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                    <input
                      type="search"
                      placeholder="Search posts..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="h-11 w-full pl-9 pr-3 bg-slate-950/40 border border-white/[0.08] rounded-lg text-base text-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-primary/40"
                    />
                  </div>
                  {activePostFilters.length > 0 && (
                    <div className="flex items-center gap-2 overflow-x-auto pb-1">
                      {activePostFilters.map((filter) => (
                        <button
                          key={filter.key}
                          onClick={filter.onClear}
                          className="min-h-[44px] px-3 rounded-full border border-white/[0.08] bg-white/[0.04] text-xs text-slate-300 flex items-center gap-1 transition-colors hover:bg-white/[0.07]"
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
                {/* Top Performers Toggle */}
                {highlightedTopPosts.length > 0 && (
                  <div className="flex items-center gap-2 pb-2">
                    <button
                      onClick={() => setShowTopPerformers(!showTopPerformers)}
                      className={`h-11 min-h-[44px] px-3 rounded-md border text-sm font-medium flex items-center justify-center gap-1.5 transition-colors ${
                        showTopPerformers
                          ? "bg-primary/20 border-primary/30 text-primary"
                          : "bg-white/[0.03] border-white/[0.08] text-slate-300 hover:bg-white/[0.06]"
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
                          onScrape={isInternal ? handleScrapePost : () => {}}
                          onDelete={isInternal ? handleDeletePost : () => {}}
                          isScraping={
                            isScraping ||
                            post.status === "scraping" ||
                            scrapingPostId === post.id
                          }
                          readOnly={!isInternal}
                          showStatusBadge={isInternal}
                        />
                      ))}
                    </div>
                  </>
                )}

                {/* Remaining Posts Cards */}
                {visibleRemainingPosts.length > 0 && !showTopPerformers && (
                  <>
                    <div className="flex items-center gap-2 pb-1 pt-2">
                      <span className="text-xs font-semibold text-slate-400">
                        Other Posts
                      </span>
                      <div className="flex-1 h-px bg-white/[0.08]"></div>
                    </div>
                    <div className="grid grid-cols-1 min-[430px]:grid-cols-2 gap-2 min-[430px]:gap-3">
                      {visibleRemainingPosts.map((post) => (
                        <PostCard
                          key={post.id}
                          post={post}
                          onScrape={isInternal ? handleScrapePost : () => {}}
                          onDelete={isInternal ? handleDeletePost : () => {}}
                          isScraping={
                            isScraping ||
                            post.status === "scraping" ||
                            scrapingPostId === post.id
                          }
                          readOnly={!isInternal}
                          showStatusBadge={isInternal}
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
                        onScrape={isInternal ? handleScrapePost : () => {}}
                        onDelete={isInternal ? handleDeletePost : () => {}}
                        isScraping={
                          isScraping ||
                          post.status === "scraping" ||
                          scrapingPostId === post.id
                        }
                        readOnly={!isInternal}
                        showStatusBadge={isInternal}
                      />
                    ))}
                  </div>
                )}
              </div>

              {/* Desktop: Table Layout */}
              <div className="hidden lg:block overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-white/[0.08] bg-white/[0.02]">
                      <th className="text-left text-[11px] font-medium uppercase tracking-[0.12em] text-slate-400 px-6 py-3">
                        Creator
                      </th>
                      <th className="text-left text-[11px] font-medium uppercase tracking-[0.12em] text-slate-400 px-6 py-3">
                        Platform
                      </th>
                      <th className="text-left text-[11px] font-medium uppercase tracking-[0.12em] text-slate-400 px-6 py-3">
                        Post URL
                      </th>
                      <th className="text-left text-[11px] font-medium uppercase tracking-[0.12em] text-slate-400 px-6 py-3">
                        Status
                      </th>
                      <th className="text-right text-[11px] font-medium uppercase tracking-[0.12em] text-slate-400 px-6 py-3">
                        Views
                      </th>
                      <th className="text-right text-[11px] font-medium uppercase tracking-[0.12em] text-slate-400 px-6 py-3">
                        Likes
                      </th>
                      <th className="hidden xl:table-cell text-right text-[11px] font-medium uppercase tracking-[0.12em] text-slate-400 px-6 py-3">
                        Comments
                      </th>
                      <th className="hidden 2xl:table-cell text-right text-[11px] font-medium uppercase tracking-[0.12em] text-slate-400 px-6 py-3">
                        Engagement
                      </th>
                      {isInternal && (
                        <th className="text-right text-[11px] font-medium uppercase tracking-[0.12em] text-slate-400 px-6 py-3"></th>
                      )}
                    </tr>
                  </thead>
                  <tbody>
                    {/* Top 5 Posts Section */}
                    {highlightedTopPosts.length > 0 && !showTopPerformers && (
                      <>
                        <tr>
                          <td
                            colSpan={isInternal ? 9 : 8}
                            className="px-6 py-3 bg-gradient-to-r from-primary/10 via-white/[0.02] to-transparent border-b border-primary/20"
                          >
                            <div className="flex items-center gap-2">
                              <span className="text-xs font-semibold text-primary">
                                Top Performing
                              </span>
                              <div className="flex-1 h-px bg-primary/20"></div>
                            </div>
                          </td>
                        </tr>
                        <tr>
                          <td
                            colSpan={isInternal ? 9 : 8}
                            className="px-6 py-2"
                          >
                            <div className="flex items-center gap-2 flex-nowrap">
                              <button
                                onClick={() =>
                                  setShowTopPerformers(!showTopPerformers)
                                }
                                className={`h-8 px-2 rounded-md border text-[11px] sm:text-xs font-medium flex flex-wrap items-center justify-center gap-1.5 transition-colors w-fit shrink-0 ${
                                  showTopPerformers
                                    ? "bg-primary/20 border-primary/30 text-primary"
                                    : "bg-white/[0.03] border-white/[0.08] text-slate-300 hover:bg-white/[0.06]"
                                }`}
                              >
                                {showTopPerformers
                                  ? "All Posts"
                                  : "Top Performers"}
                              </button>
                              <div className="w-[160px] md:hidden shrink-0">
                                <Select
                                  value={sortBy}
                                  onValueChange={(value: SortOption) =>
                                    setSortBy(value)
                                  }
                                >
                                  <SelectTrigger className="h-8 w-fit bg-white/[0.03] border-white/[0.08] text-slate-300 text-[11px] sm:text-xs">
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
                            isScraping ||
                            post.status === "scraping" ||
                            scrapingPostId === post.id;
                          return (
                            <tr
                              key={post.id}
                              className={`border-b border-white/[0.04] transition-colors group ${
                                isTop3
                                  ? "bg-primary/5 hover:bg-primary/10"
                                  : isTop5
                                    ? "bg-primary/2 hover:bg-primary/5"
                                    : "hover:bg-white/[0.02]"
                              } ${isTop5 ? "border-l-2 border-l-primary/30" : ""}`}
                            >
                              <td className="px-6 py-4">
                                <div>
                                  <div className="font-medium text-sm text-white">
                                    {post.creator?.name || "Unknown"}
                                  </div>
                                  <div className="text-xs text-slate-500">
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
                                    <span className="text-xs px-1.5 py-0.5 rounded bg-slate-700/50 text-slate-400 border border-slate-600/50">
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
                                  <span className="text-xs text-slate-400 flex items-center gap-1">
                                    <LinkIcon className="w-3 h-3" />
                                    No Link
                                  </span>
                                )}
                              </td>
                              <td className="px-6 py-4">
                                <div className="flex items-center gap-2">
                                  {isInternal && (
                                    <StatusBadge status={post.status} />
                                  )}
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
                              <td className="px-6 py-4 text-right text-sm text-slate-300">
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
                                        <span className="text-xs text-slate-400 ml-1">
                                          ({formatted.growth})
                                        </span>
                                      )}
                                    </>
                                  );
                                })()}
                              </td>
                              <td className="px-6 py-4 text-right text-sm text-slate-300">
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
                                        <span className="text-xs text-slate-400 ml-1">
                                          ({formatted.growth})
                                        </span>
                                      )}
                                    </>
                                  );
                                })()}
                              </td>
                              <td className="hidden xl:table-cell px-6 py-4 text-right text-sm text-slate-300">
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
                                        <span className="text-xs text-slate-400 ml-1">
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
                                  <span className="text-sm text-emerald-400 font-medium">
                                    {post.engagement_rate}%
                                  </span>
                                ) : (
                                  <span className="text-sm text-slate-500">
                                    -
                                  </span>
                                )}
                              </td>
                              {isInternal && (
                                <td className="px-6 py-4 text-right">
                                  <div className="flex items-center justify-end gap-1">
                                    {post.post_url && onScrapePost && (
                                      <button
                                        onClick={() => onScrapePost(post.id)}
                                        disabled={isScrapingPost}
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
                                    {onDeletePost && (
                                      <button
                                        onClick={() => onDeletePost(post.id)}
                                        className="w-8 h-8 rounded-md hover:bg-red-500/20 flex items-center justify-center transition-colors opacity-0 group-hover:opacity-100"
                                        title="Delete this post"
                                      >
                                        <Trash2 className="w-4 h-4 text-red-400" />
                                      </button>
                                    )}
                                  </div>
                                </td>
                              )}
                            </tr>
                          );
                        })}
                        {paginatedRemainingPosts.length > 0 && (
                          <tr>
                            <td
                              colSpan={isInternal ? 9 : 8}
                              className="px-6 py-2 border-b border-white/[0.08]"
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
                        isScraping ||
                        post.status === "scraping" ||
                        scrapingPostId === post.id;
                      return (
                        <tr
                          key={post.id}
                          className={`border-b border-white/[0.04] transition-colors group ${
                            isTop3
                              ? "bg-primary/5 hover:bg-primary/10"
                              : "hover:bg-white/[0.02]"
                          }`}
                        >
                          <td className="px-6 py-4">
                            <div>
                              <div className="font-medium text-sm text-white">
                                {post.creator?.name || "Unknown"}
                              </div>
                              <div className="text-xs text-slate-500">
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
                                <span className="text-xs px-1.5 py-0.5 rounded bg-slate-700/50 text-slate-400 border border-slate-600/50">
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
                              <span className="text-xs text-slate-400 flex items-center gap-1">
                                <LinkIcon className="w-3 h-3" />
                                No Link
                              </span>
                            )}
                          </td>
                          <td className="px-6 py-4">
                            <div className="flex items-center gap-2">
                              {isInternal && (
                                <StatusBadge status={post.status} />
                              )}
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
                          <td className="px-6 py-4 text-right text-sm text-slate-300">
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
                                    <span className="text-xs text-slate-400 ml-1">
                                      ({formatted.growth})
                                    </span>
                                  )}
                                </>
                              );
                            })()}
                          </td>
                          <td className="px-6 py-4 text-right text-sm text-slate-300">
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
                                    <span className="text-xs text-slate-400 ml-1">
                                      ({formatted.growth})
                                    </span>
                                  )}
                                </>
                              );
                            })()}
                          </td>
                          <td className="hidden xl:table-cell px-6 py-4 text-right text-sm text-slate-300">
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
                                    <span className="text-xs text-slate-400 ml-1">
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
                              <span className="text-sm text-emerald-400 font-medium">
                                {post.engagement_rate}%
                              </span>
                            ) : (
                              <span className="text-sm text-slate-500">-</span>
                            )}
                          </td>
                          {isInternal && (
                            <td className="px-6 py-4 text-right">
                              <div className="flex items-center justify-end gap-1">
                                {post.post_url && onScrapePost && (
                                  <button
                                    onClick={() => onScrapePost(post.id)}
                                    disabled={isScrapingPost}
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
                                {onDeletePost && (
                                  <button
                                    onClick={() => onDeletePost(post.id)}
                                    className="w-8 h-8 rounded-md hover:bg-red-500/20 flex items-center justify-center transition-colors opacity-0 group-hover:opacity-100"
                                    aria-label="Delete post"
                                    title="Delete this post"
                                  >
                                    <Trash2 className="w-4 h-4 text-red-400" />
                                  </button>
                                )}
                              </div>
                            </td>
                          )}
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* Mobile Pagination */}
              {mobileTotalPages > 1 && (
                <div className="lg:hidden px-4 sm:px-6 pb-4 space-y-3">
                  <p className="text-xs text-slate-400">
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
                      className="h-9 w-9 rounded-md bg-white/[0.03] hover:bg-white/[0.06] border border-white/[0.08] text-slate-300 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center"
                    >
                      <ChevronLeft className="w-4 h-4" />
                      <span className="sr-only">Previous page</span>
                    </button>
                    <div className="flex items-center gap-1">
                      <div className="min-[360px]:hidden text-xs text-slate-400">
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
                                <span className="px-1 text-slate-500 text-xs">
                                  ...
                                </span>
                              )}
                              <button
                                onClick={() => setCurrentPage(page)}
                                className={`h-9 w-9 rounded-md text-xs transition-colors ${
                                  mobileSafeCurrentPage === page
                                    ? "bg-primary text-black"
                                    : "bg-white/[0.03] hover:bg-white/[0.06] border border-white/[0.08] text-slate-300"
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
                      className="h-9 w-9 rounded-md bg-white/[0.03] hover:bg-white/[0.06] border border-white/[0.08] text-slate-300 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center"
                    >
                      <ChevronRight className="w-4 h-4" />
                      <span className="sr-only">Next page</span>
                    </button>
                  </div>
                </div>
              )}

              {/* Desktop Pagination */}
              {totalPages > 1 && (
                <div className="hidden lg:flex p-4 border-t border-white/[0.08] items-center justify-between">
                  <p className="text-sm text-slate-400">
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
                      className="h-8 px-3 rounded-md bg-white/[0.03] hover:bg-white/[0.06] border border-white/[0.08] text-sm text-slate-300 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
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
                                ? "bg-primary text-black"
                                : "bg-white/[0.03] hover:bg-white/[0.06] border border-white/[0.08] text-slate-300"
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
                      className="h-8 px-3 rounded-md bg-white/[0.03] hover:bg-white/[0.06] border border-white/[0.08] text-sm text-slate-300 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                    >
                      Next
                    </button>
                  </div>
                </div>
              )}
            </>
          ) : (
            <div className="flex flex-col items-center justify-center py-16">
              <div className="w-12 h-12 rounded-lg bg-white/[0.03] flex items-center justify-center mb-4">
                <Search className="w-6 h-6 text-slate-600" />
              </div>
              <h3 className="text-base font-semibold text-white mb-1">
                No posts found
              </h3>
              <p className="text-sm text-slate-400 text-center mb-6 max-w-md">
                {searchQuery
                  ? "Try adjusting your search query"
                  : isInternal
                    ? "Get started by adding posts manually or importing from CSV"
                    : "No posts have been added to this campaign yet"}
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Filters Dialog */}
      <Dialog open={postFiltersOpen} onOpenChange={setPostFiltersOpen}>
        <DialogContent className="bg-[#0D0D0D] border-white/[0.08]">
          <DialogHeader>
            <DialogTitle className="text-lg font-semibold text-white">
              Filters
            </DialogTitle>
            <DialogDescription className="text-sm text-slate-400">
              Refine posts by platform, status, and creator.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
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
                        ? "bg-primary text-black border-primary"
                        : "bg-white/[0.03] border-white/[0.08] text-slate-300 hover:bg-white/[0.06]"
                    }`}
                  >
                    {platform === "all" ? "All" : platform}
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-2">
              <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
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
                          ? "bg-primary text-black border-primary"
                          : "bg-white/[0.03] border-white/[0.08] text-slate-300 hover:bg-white/[0.06]"
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
              <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
                Creator
              </label>
              <select
                value={postCreatorFilter}
                onChange={(e) => setPostCreatorFilter(e.target.value)}
                className="h-11 w-full rounded-md bg-white/[0.03] border border-white/[0.08] px-3 text-base text-white"
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
              <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
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
                        ? "bg-primary text-black border-primary"
                        : "bg-white/[0.03] border-white/[0.08] text-slate-300 hover:bg-white/[0.06]"
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
              className="flex-1"
            >
              Clear All
            </Button>
            <Button
              onClick={() => setPostFiltersOpen(false)}
              className="flex-1"
            >
              Apply
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
