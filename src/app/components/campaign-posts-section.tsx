import React, { useState, useMemo } from "react";
import { Card, CardContent } from "./ui/card";
import {
  Search,
  Filter,
  Trash2,
  RefreshCw,
  Download,
  Plus,
  Upload,
  MoreHorizontal,
  ExternalLink,

  ChevronLeft,
  ChevronRight,
  X,
  Info,
  FileText,
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
        className="relative overflow-hidden bg-card border-border shadow-lg dark:shadow-[0_12px_40px_-20px_rgba(0,0,0,0.8)]"
      >
        <CardContent className="relative p-0">
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_20%_20%,rgba(56,189,248,0.08),transparent_45%),radial-gradient(circle_at_80%_0%,rgba(16,185,129,0.08),transparent_40%)]" />
          <div className="relative p-4 sm:p-6 border-b border-border bg-muted/30 backdrop-blur-xl">
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
              {isInternal && (
                <div className="flex flex-col gap-2 w-full sm:flex-row sm:items-center sm:justify-end sm:gap-3 md:w-auto">
                  {!localStorage.getItem("dttracker-posts-guide-dismissed") && (
                    <div className="order-last sm:order-none w-full sm:w-auto">
                      <div
                        id="posts-guide-banner-shared"
                        className="group relative w-full text-left p-3 rounded-lg border border-primary/20 bg-primary/5 hover:bg-primary/10 transition-colors"
                      >
                        <button
                          className="absolute top-2 right-2 p-0.5 rounded hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
                          onClick={() => {
                            localStorage.setItem("dttracker-posts-guide-dismissed", "true");
                            const el = document.getElementById("posts-guide-banner-shared");
                            if (el) el.style.display = "none";
                          }}
                          aria-label="Dismiss guide"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                        <div className="flex items-start gap-2.5 pr-5">
                          <Info className="w-4 h-4 text-primary mt-0.5 shrink-0" />
                          <div className="space-y-1 text-xs">
                            <p className="font-medium text-foreground">How to add posts</p>
                            <p className="text-muted-foreground"><strong className="text-foreground">1–2 posts:</strong> Click <strong className="text-primary">+ Add Post</strong> and paste the URL.</p>
                            <p className="text-muted-foreground"><strong className="text-foreground">3–6 posts:</strong> Go to <strong className="text-primary">Actions → Import posts CSV</strong> to bulk upload (max 6 posts).</p>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
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
                        className="h-11 px-3 rounded-lg bg-muted/30 hover:bg-muted/60 border border-border text-xs text-foreground flex items-center justify-center gap-1.5 transition-colors w-full sm:w-auto"
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
                  className="h-11 px-4 bg-muted/30 hover:bg-muted/60 border border-border text-xs text-foreground font-semibold flex items-center justify-center gap-1.5 rounded-lg transition-colors disabled:opacity-50"
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
                  <SelectTrigger className="h-9 w-fit md:w-[170px] bg-muted/30 border-border text-foreground text-xs">
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
                className="h-11 min-h-[44px] px-3 rounded-lg bg-muted/30 hover:bg-muted/60 border border-border text-sm text-foreground flex items-center justify-center gap-2 transition-colors"
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
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <input
                      type="search"
                      placeholder="Search posts..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="h-11 w-full pl-9 pr-3 bg-muted/40 border border-border rounded-lg text-base text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/40"
                    />
                  </div>
                  {activePostFilters.length > 0 && (
                    <div className="flex items-center gap-2 overflow-x-auto pb-1">
                      {activePostFilters.map((filter) => (
                        <button
                          key={filter.key}
                          onClick={filter.onClear}
                          className="min-h-[44px] px-3 rounded-full border border-border bg-muted/50 text-xs text-foreground flex items-center gap-1 transition-colors hover:bg-muted/70"
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
                {/* Top 5 Performers - sticky so they stay on first page when scrolling */}
                {highlightedTopPosts.length > 0 && (
                  <div className="sticky top-0 z-10 -mx-4 sm:-mx-6 px-4 sm:px-6 pt-2 pb-3 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80">
                    {/* Top Performers Toggle */}
                    <div className="flex items-center gap-2 pb-2">
                      <button
                        onClick={() => setShowTopPerformers(!showTopPerformers)}
                        className={`h-11 min-h-[44px] px-3 rounded-md border text-sm font-medium flex items-center justify-center gap-1.5 transition-colors ${
                          showTopPerformers
                            ? "bg-primary/20 border-primary/30 text-primary"
                            : "bg-muted/40 border-border text-foreground hover:bg-muted/60"
                        }`}
                      >
                        {showTopPerformers ? "All Posts" : "Top Performers"}
                      </button>
                    </div>

                    {/* Top Performing Cards */}
                    {!showTopPerformers && (
                      <>
                        <div className="flex items-center gap-2 pb-1">
                          <span className="text-xs font-semibold text-primary">
                            Top Performing
                          </span>
                          <div className="flex-1 h-px bg-primary/20"></div>
                        </div>
                        <div className="grid grid-cols-2 gap-2 sm:gap-3">
                          {highlightedTopPosts.map((post) => (
                            <PostCard
                              key={post.id}
                              post={post}
                              onScrape={isInternal ? handleScrapePost : undefined}
                              onDelete={isInternal ? handleDeletePost : undefined}
                              isScraping={
                                isScraping ||
                                post.status === "scraping" ||
                                scrapingPostId === post.id
                              }
                              readOnly={!isInternal}
                              showStatusBadge={isInternal}
                              compact
                            />
                          ))}
                        </div>
                      </>
                    )}
                  </div>
                )}

                {/* Remaining Posts Cards */}
                {visibleRemainingPosts.length > 0 && !showTopPerformers && (
                  <>
                    <div className="flex items-center gap-2 pb-1 pt-2">
                      <span className="text-xs font-semibold text-muted-foreground">
                        Other Posts
                      </span>
                      <div className="flex-1 h-px bg-border"></div>
                    </div>
                    <div className="grid grid-cols-2 gap-2 sm:gap-3">
                      {visibleRemainingPosts.map((post) => (
                        <PostCard
                          key={post.id}
                          post={post}
                          onScrape={isInternal ? handleScrapePost : undefined}
                          onDelete={isInternal ? handleDeletePost : undefined}
                          isScraping={
                            isScraping ||
                            post.status === "scraping" ||
                            scrapingPostId === post.id
                          }
                          readOnly={!isInternal}
                          showStatusBadge={isInternal}
                          compact
                        />
                      ))}
                    </div>
                  </>
                )}

                {/* All Posts when Top Performers is toggled */}
                {showTopPerformers && (
                  <div className="grid grid-cols-2 gap-2 sm:gap-3">
                    {mobilePaginatedPosts.map((post) => (
                      <PostCard
                        key={post.id}
                        post={post}
                        onScrape={isInternal ? handleScrapePost : undefined}
                        onDelete={isInternal ? handleDeletePost : undefined}
                        isScraping={
                          isScraping ||
                          post.status === "scraping" ||
                          scrapingPostId === post.id
                        }
                        readOnly={!isInternal}
                        showStatusBadge={isInternal}
                        compact
                      />
                    ))}
                  </div>
                )}
              </div>

              {/* Desktop: Table Layout */}
              <div className="hidden lg:block overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-border bg-muted/30">
                      <th className="text-left text-[11px] font-medium uppercase tracking-[0.12em] text-muted-foreground px-4 py-3">
                        Creator
                      </th>
                      <th className="text-center text-[11px] font-medium uppercase tracking-[0.12em] text-muted-foreground px-3 py-3">
                        Status
                      </th>
                      <th className="text-right text-[11px] font-medium uppercase tracking-[0.12em] text-muted-foreground px-4 py-3">
                        Views
                      </th>
                      <th className="text-right text-[11px] font-medium uppercase tracking-[0.12em] text-muted-foreground px-4 py-3">
                        Likes
                      </th>
                      <th className="text-right text-[11px] font-medium uppercase tracking-[0.12em] text-muted-foreground px-4 py-3">
                        Comments
                      </th>
                      <th className="hidden xl:table-cell text-right text-[11px] font-medium uppercase tracking-[0.12em] text-muted-foreground px-4 py-3">
                        Engagement
                      </th>
                      {isInternal && (
                        <th className="text-right text-[11px] font-medium uppercase tracking-[0.12em] text-muted-foreground px-4 py-3 w-20"></th>
                      )}
                    </tr>
                  </thead>
                  <tbody>
                    {/* Top 5 Posts Section */}
                    {highlightedTopPosts.length > 0 && !showTopPerformers && (
                      <>
                        <tr>
                          <td
                            colSpan={isInternal ? 7 : 6}
                            className="px-6 py-3 bg-gradient-to-r from-primary/10 via-muted/30 to-transparent border-b border-primary/20"
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
                            colSpan={isInternal ? 7 : 6}
                            className="px-4 py-2"
                          >
                            <div className="flex items-center gap-2 flex-nowrap">
                              <button
                                onClick={() =>
                                  setShowTopPerformers(!showTopPerformers)
                                }
                                className={`h-8 px-2 rounded-md border text-[11px] sm:text-xs font-medium flex flex-wrap items-center justify-center gap-1.5 transition-colors w-fit shrink-0 ${
                                  showTopPerformers
                                    ? "bg-primary/20 border-primary/30 text-primary"
                                    : "bg-muted/40 border-border text-foreground hover:bg-muted/60"
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
                                  <SelectTrigger className="h-8 w-fit bg-muted/40 border-border text-foreground text-[11px] sm:text-xs">
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
                              className={`border-b border-border/50 transition-colors group ${
                                isTop3
                                  ? "bg-primary/5 hover:bg-primary/10"
                                  : isTop5
                                    ? "bg-primary/2 hover:bg-primary/5"
                                    : "hover:bg-muted/30"
                              } ${isTop5 ? "border-l-2 border-l-primary/30" : ""}`}
                            >
                              <td className="px-4 py-3">
                                <div className="flex items-center gap-2.5">
                                  {post.rank && (
                                    <span className="text-[10px] font-semibold text-primary bg-primary/10 border border-primary/20 rounded-full w-6 h-6 flex items-center justify-center shrink-0">
                                      #{post.rank}
                                    </span>
                                  )}
                                  {platformIcon && (
                                    <PlatformIcon
                                      platform={platformIcon}
                                      size="sm"
                                      aria-label={`${getPlatformLabel(platformIcon)} post`}
                                    />
                                  )}
                                  <div className="min-w-0">
                                    <div className="flex items-center gap-1.5">
                                      <span className="font-medium text-sm text-foreground truncate">
                                        {post.creator?.name || "Unknown"}
                                      </span>
                                      {post.post_url && (
                                        <a
                                          href={post.post_url}
                                          target="_blank"
                                          rel="noopener noreferrer"
                                          className="text-muted-foreground hover:text-primary transition-colors shrink-0"
                                        >
                                          <ExternalLink className="w-3 h-3" />
                                        </a>
                                      )}
                                      {!isKpiPlatform(post.platform) && (
                                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-muted text-muted-foreground border border-border shrink-0">
                                          Not in KPIs
                                        </span>
                                      )}
                                    </div>
                                    <div className="text-xs text-muted-foreground truncate">
                                      @{post.creator?.handle || post.owner_username || "unknown"}
                                    </div>
                                  </div>
                                </div>
                              </td>
                              <td className="px-3 py-3 text-center">
                                <div className="flex items-center justify-center gap-1.5">
                                  {isInternal && (
                                    <StatusBadge status={post.status} />
                                  )}
                                  {post.positionEmoji && (
                                    <span className="text-sm">{post.positionEmoji}</span>
                                  )}
                                  {post.badges?.trending && (
                                    <span className="text-sm">🔥</span>
                                  )}
                                </div>
                              </td>
                              <td className="px-4 py-3 text-right">
                                <div className="text-sm font-medium text-foreground tabular-nums">
                                  {(() => {
                                    const formatted = formatWithGrowth(
                                      post.views,
                                      (post as { last_view_growth?: number }).last_view_growth
                                    );
                                    return (
                                      <>
                                        {formatted.value}
                                        {formatted.growth && (
                                          <div className="text-[10px] font-normal text-muted-foreground">
                                            {formatted.growth}
                                          </div>
                                        )}
                                      </>
                                    );
                                  })()}
                                </div>
                              </td>
                              <td className="px-4 py-3 text-right">
                                <div className="text-sm text-foreground tabular-nums">
                                  {(() => {
                                    const formatted = formatWithGrowth(
                                      post.likes,
                                      (post as { last_like_growth?: number }).last_like_growth
                                    );
                                    return (
                                      <>
                                        {formatted.value}
                                        {formatted.growth && (
                                          <div className="text-[10px] font-normal text-muted-foreground">
                                            {formatted.growth}
                                          </div>
                                        )}
                                      </>
                                    );
                                  })()}
                                </div>
                              </td>
                              <td className="px-4 py-3 text-right">
                                <div className="text-sm text-foreground tabular-nums">
                                  {(() => {
                                    const formatted = formatWithGrowth(
                                      post.comments,
                                      (post as { last_comment_growth?: number }).last_comment_growth
                                    );
                                    return (
                                      <>
                                        {formatted.value}
                                        {formatted.growth && (
                                          <div className="text-[10px] font-normal text-muted-foreground">
                                            {formatted.growth}
                                          </div>
                                        )}
                                      </>
                                    );
                                  })()}
                                </div>
                              </td>
                              <td className="hidden xl:table-cell px-4 py-3 text-right">
                                {post.engagement_rate && post.engagement_rate > 0 ? (
                                  <span className="text-sm text-emerald-600 dark:text-emerald-400 font-medium tabular-nums">
                                    {post.engagement_rate}%
                                  </span>
                                ) : (
                                  <span className="text-sm text-muted-foreground">-</span>
                                )}
                              </td>
                              {isInternal && (
                                <td className="px-4 py-3 text-right">
                                  <div className="flex items-center justify-end gap-1">
                                    {post.post_url && onScrapePost && (
                                      <button
                                        onClick={() => onScrapePost(post.id)}
                                        disabled={isScrapingPost}
                                        className="w-7 h-7 rounded-md hover:bg-primary/20 flex items-center justify-center transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                                        title={isScrapingPost ? "Scraping..." : "Scrape this post"}
                                      >
                                        <RefreshCw className={`w-3.5 h-3.5 text-primary ${isScrapingPost ? "animate-spin" : ""}`} />
                                      </button>
                                    )}
                                    {onDeletePost && (
                                      <button
                                        onClick={() => onDeletePost(post.id)}
                                        className="w-7 h-7 rounded-md hover:bg-red-500/20 flex items-center justify-center transition-colors opacity-0 group-hover:opacity-100"
                                        title="Delete this post"
                                      >
                                        <Trash2 className="w-3.5 h-3.5 text-red-400" />
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
                              colSpan={isInternal ? 7 : 6}
                              className="px-4 py-2 border-b border-border"
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
                          className={`border-b border-border/50 transition-colors group ${
                            isTop3
                              ? "bg-primary/5 hover:bg-primary/10"
                              : "hover:bg-muted/30"
                          }`}
                        >
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-2.5">
                              {post.rank && (
                                <span className="text-[10px] font-semibold text-muted-foreground w-5 text-center shrink-0">
                                  #{post.rank}
                                </span>
                              )}
                              {platformIcon && (
                                <PlatformIcon
                                  platform={platformIcon}
                                  size="sm"
                                  aria-label={`${getPlatformLabel(platformIcon)} post`}
                                />
                              )}
                              <div className="min-w-0">
                                <div className="flex items-center gap-1.5">
                                  <span className="font-medium text-sm text-foreground truncate">
                                    {post.creator?.name || "Unknown"}
                                  </span>
                                  {post.post_url && (
                                    <a
                                      href={post.post_url}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      className="text-muted-foreground hover:text-primary transition-colors shrink-0"
                                    >
                                      <ExternalLink className="w-3 h-3" />
                                    </a>
                                  )}
                                  {!isKpiPlatform(post.platform) && (
                                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-muted text-muted-foreground border border-border shrink-0">
                                      Not in KPIs
                                    </span>
                                  )}
                                </div>
                                <div className="text-xs text-muted-foreground truncate">
                                  @{post.creator?.handle || post.owner_username || "unknown"}
                                </div>
                              </div>
                            </div>
                          </td>
                          <td className="px-3 py-3 text-center">
                            <div className="flex items-center justify-center gap-1.5">
                              {isInternal && (
                                <StatusBadge status={post.status} />
                              )}
                              {post.positionEmoji && (
                                <span className="text-sm">{post.positionEmoji}</span>
                              )}
                              {post.badges?.trending && (
                                <span className="text-sm">🔥</span>
                              )}
                            </div>
                          </td>
                          <td className="px-4 py-3 text-right">
                            <div className="text-sm font-medium text-foreground tabular-nums">
                              {(() => {
                                const formatted = formatWithGrowth(
                                  post.views,
                                  (post as { last_view_growth?: number }).last_view_growth
                                );
                                return (
                                  <>
                                    {formatted.value}
                                    {formatted.growth && (
                                      <div className="text-[10px] font-normal text-muted-foreground">
                                        {formatted.growth}
                                      </div>
                                    )}
                                  </>
                                );
                              })()}
                            </div>
                          </td>
                          <td className="px-4 py-3 text-right">
                            <div className="text-sm text-foreground tabular-nums">
                              {(() => {
                                const formatted = formatWithGrowth(
                                  post.likes,
                                  (post as { last_like_growth?: number }).last_like_growth
                                );
                                return (
                                  <>
                                    {formatted.value}
                                    {formatted.growth && (
                                      <div className="text-[10px] font-normal text-muted-foreground">
                                        {formatted.growth}
                                      </div>
                                    )}
                                  </>
                                );
                              })()}
                            </div>
                          </td>
                          <td className="px-4 py-3 text-right">
                            <div className="text-sm text-foreground tabular-nums">
                              {(() => {
                                const formatted = formatWithGrowth(
                                  post.comments,
                                  (post as { last_comment_growth?: number }).last_comment_growth
                                );
                                return (
                                  <>
                                    {formatted.value}
                                    {formatted.growth && (
                                      <div className="text-[10px] font-normal text-muted-foreground">
                                        {formatted.growth}
                                      </div>
                                    )}
                                  </>
                                );
                              })()}
                            </div>
                          </td>
                          <td className="hidden xl:table-cell px-4 py-3 text-right">
                            {post.engagement_rate && post.engagement_rate > 0 ? (
                              <span className="text-sm text-emerald-600 dark:text-emerald-400 font-medium tabular-nums">
                                {post.engagement_rate}%
                              </span>
                            ) : (
                              <span className="text-sm text-muted-foreground">-</span>
                            )}
                          </td>
                          {isInternal && (
                            <td className="px-4 py-3 text-right">
                              <div className="flex items-center justify-end gap-1">
                                {post.post_url && onScrapePost && (
                                  <button
                                    onClick={() => onScrapePost(post.id)}
                                    disabled={isScrapingPost}
                                    className="w-7 h-7 rounded-md hover:bg-primary/20 flex items-center justify-center transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                                    aria-label="Refresh metrics"
                                    title={isScrapingPost ? "Scraping..." : "Scrape this post"}
                                  >
                                    <RefreshCw className={`w-3.5 h-3.5 text-primary ${isScrapingPost ? "animate-spin" : ""}`} />
                                  </button>
                                )}
                                {onDeletePost && (
                                  <button
                                    onClick={() => onDeletePost(post.id)}
                                    className="w-7 h-7 rounded-md hover:bg-red-500/20 flex items-center justify-center transition-colors opacity-0 group-hover:opacity-100"
                                    aria-label="Delete post"
                                    title="Delete this post"
                                  >
                                    <Trash2 className="w-3.5 h-3.5 text-red-400" />
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
                      className="h-9 w-9 rounded-md bg-muted/40 hover:bg-muted/60 border border-border text-foreground disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center"
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
                                    ? "bg-primary text-black"
                                    : "bg-muted/40 hover:bg-muted/60 border border-border text-foreground"
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
                      className="h-9 w-9 rounded-md bg-muted/40 hover:bg-muted/60 border border-border text-foreground disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center"
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
                      className="h-8 px-3 rounded-md bg-muted/40 hover:bg-muted/60 border border-border text-sm text-foreground disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
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
                                : "bg-muted/40 hover:bg-muted/60 border border-border text-foreground"
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
                      className="h-8 px-3 rounded-md bg-muted/40 hover:bg-muted/60 border border-border text-sm text-foreground disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                    >
                      Next
                    </button>
                  </div>
                </div>
              )}
            </>
          ) : (
            <div className="flex flex-col items-center justify-center py-12 px-4">
              {searchQuery ? (
                <>
                  <div className="w-12 h-12 rounded-lg bg-muted/40 flex items-center justify-center mb-4">
                    <Search className="w-6 h-6 text-muted-foreground" />
                  </div>
                  <h3 className="text-base font-semibold text-foreground mb-1">
                    No posts found
                  </h3>
                  <p className="text-sm text-muted-foreground text-center mb-6 max-w-md">
                    Try adjusting your search query
                  </p>
                </>
              ) : isInternal ? (
                <>
                  <div className="w-12 h-12 rounded-lg bg-muted/40 flex items-center justify-center mb-4">
                    <FileText className="w-6 h-6 text-muted-foreground" />
                  </div>
                  <h3 className="text-base font-semibold text-foreground mb-1">
                    No posts yet
                  </h3>
                  <p className="text-sm text-muted-foreground text-center mb-6 max-w-md">
                    Add posts to track their performance and engagement metrics.
                  </p>
                  <div className="grid gap-3 sm:grid-cols-2 max-w-lg w-full">
                    {onAddPost && (
                      <button
                        onClick={onAddPost}
                        className="p-4 rounded-lg border border-border bg-muted/30 hover:bg-muted/60 text-left transition-colors"
                      >
                        <Plus className="w-5 h-5 text-primary mb-2" />
                        <p className="text-sm font-medium text-foreground">Add Post</p>
                        <p className="text-xs text-muted-foreground mt-1">
                          Best for 1–2 posts. Paste the post URL and we&apos;ll scrape the data.
                        </p>
                      </button>
                    )}
                    {onImportPosts && (
                      <button
                        onClick={onImportPosts}
                        className="p-4 rounded-lg border border-border bg-muted/30 hover:bg-muted/60 text-left transition-colors"
                      >
                        <Upload className="w-5 h-5 text-primary mb-2" />
                        <p className="text-sm font-medium text-foreground">Import CSV</p>
                        <p className="text-xs text-muted-foreground mt-1">
                          Best for 3–6 posts. Upload a CSV file with up to 6 post URLs at once.
                        </p>
                      </button>
                    )}
                  </div>
                </>
              ) : (
                <>
                  <div className="w-12 h-12 rounded-lg bg-muted/40 flex items-center justify-center mb-4">
                    <FileText className="w-6 h-6 text-muted-foreground" />
                  </div>
                  <h3 className="text-base font-semibold text-foreground mb-1">
                    No posts yet
                  </h3>
                  <p className="text-sm text-muted-foreground text-center mb-6 max-w-md">
                    No posts have been added to this campaign yet.
                  </p>
                </>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Filters Dialog */}
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
                        ? "bg-primary text-black border-primary"
                        : "bg-muted/40 border-border text-foreground hover:bg-muted/60"
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
                          ? "bg-primary text-black border-primary"
                          : "bg-muted/40 border-border text-foreground hover:bg-muted/60"
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
                className="h-11 w-full rounded-md bg-muted/40 border border-border px-3 text-base text-foreground"
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
                        ? "bg-primary text-black border-primary"
                        : "bg-muted/40 border-border text-foreground hover:bg-muted/60"
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
