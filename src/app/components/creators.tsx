import React, { useState, useMemo, useEffect } from "react";
import { Card, CardContent } from "./ui/card";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "./ui/dialog";
import { ResponsiveConfirmDialog } from "./ui/responsive-confirm-dialog";
import { CreatorHandleLink } from "./ui/creator-handle-link";
import {
  Plus,
  Search,
  Filter,
  Users as UsersIcon,
  Sparkles,
  X,
  Edit2,
  Trash2,
  Eye,
  MoreHorizontal,
  Download,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  ArrowLeft,
  Upload,
  Check,
  Loader2,
} from "lucide-react";
import {
  PlatformIcon,
  normalizePlatform,
  getPlatformLabel,
} from "./ui/PlatformIcon";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "./ui/table";
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationLink,
  PaginationPrevious,
  PaginationNext,
  PaginationEllipsis,
} from "./ui/pagination";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "./ui/dropdown-menu";
import {
  useCreatorsWithStats,
  useCreateCreator,
  useUpdateCreator,
  useDeleteCreator,
  useMyNetworkCreators,
  useDiscoverCreators,
  useFavoritesCreators,
  useToggleFavorite,
  useCreatorProfile,
  useSendOfferToActivation,
  useAddCreatorManually,
} from "../../hooks/useCreators";
import { ImportCreatorsDialog } from "./import-creators-dialog";
import { supabase } from "../../lib/supabase";
import * as csvUtils from "../../lib/utils/csv";
import { toast } from "sonner";
import type {
  CreatorWithStats,
  CreatorWithSocialAndStats,
  Platform,
} from "../../lib/types/database";
import { CreatorCard } from "./creators/creator-card";
import { SendOfferModal } from "./creators/send-offer-modal";
import { CreatorProfileModal } from "./creators/creator-profile-modal";
import { useCart } from "../../contexts/CartContext";
import { ReviewRequestModal } from "./review-request-modal";
import { CreatorRequestChatbot } from "./creator-request-chatbot";
import { CreatorRequestForm } from "./activations/creator-request-form";
import { useWorkspace } from "../../contexts/WorkspaceContext";
import { useWorkspaceAccess } from "../../hooks/useWorkspaceAccess";
import { useWalletBalance } from "../../hooks/useWallet";
import { formatNumber } from "../../lib/utils/format";

interface CreatorsProps {
  onNavigate?: (path: string) => void;
}

function PlatformSelect({
  selected,
  onChange,
}: {
  selected: Platform[];
  onChange: (platforms: Platform[]) => void;
}) {
  const platforms: Platform[] = [
    "tiktok",
    "instagram",
    "youtube",
    "twitter",
    "facebook",
  ];

  const selectedValue = selected[0] ?? "all";

  return (
    <select
      value={selectedValue}
      onChange={(e) => {
        const value = e.target.value as Platform | "all";
        onChange(value === "all" ? [] : [value]);
      }}
      className="h-9 px-3 pr-8 bg-white/[0.04] border border-white/[0.1] rounded-lg text-sm text-white appearance-none cursor-pointer hover:bg-white/[0.06] focus:bg-white/[0.06] focus:border-primary/50 transition-all"
    >
      <option value="all">All Platforms</option>
      {platforms.map((platform) => (
        <option key={platform} value={platform}>
          {platform.charAt(0).toUpperCase() + platform.slice(1)}
        </option>
      ))}
    </select>
  );
}

export function Creators({ onNavigate }: CreatorsProps) {
  const formatFollowers = (count: number) => {
    if (count === 0) return "0";
    if (count >= 1_000_000) {
      const value = count / 1_000_000;
      const precision = count % 1_000_000 === 0 ? 0 : 1;
      return `${value.toFixed(precision)}M`;
    }
    if (count >= 1_000) {
      return `${Math.round(count / 1_000)}K`;
    }
    return count.toLocaleString();
  };

  const [activeCreatorTab, setActiveCreatorTab] = useState<
    "my_network" | "discover" | "favorites"
  >("my_network");
  const [shouldFetch, setShouldFetch] = useState(false);
  // Use legacy list API until creators_page_schema migration is applied
  const { data: myNetworkData = [], isLoading: myNetworkLoading } =
    useCreatorsWithStats("my_network", { enabled: shouldFetch });
  const { data: discoverData = [], isLoading: discoverLoading } =
    useCreatorsWithStats("all", {
      enabled: shouldFetch && activeCreatorTab === "discover",
    });
  const { data: favoritesData = [], isLoading: favoritesLoading } =
    useFavoritesCreators();
  const favoriteIds = useMemo(
    () => new Set((favoritesData || []).map((c) => c.id)),
    [favoritesData]
  );
  const toggleFavorite = useToggleFavorite();
  const sendOffer = useSendOfferToActivation();
  const addCreatorManually = useAddCreatorManually();

  const creators =
    activeCreatorTab === "my_network"
      ? myNetworkData
      : activeCreatorTab === "discover"
        ? discoverData
        : favoritesData || [];
  const isLoading =
    activeCreatorTab === "my_network"
      ? myNetworkLoading
      : activeCreatorTab === "discover"
        ? discoverLoading
        : favoritesLoading;
  const createCreatorMutation = useCreateCreator();
  const updateCreatorMutation = useUpdateCreator();
  const deleteCreatorMutation = useDeleteCreator();
  const { activeWorkspaceId } = useWorkspace();
  const { data: wallet } = useWalletBalance(activeWorkspaceId);
  const {
    loading: accessLoading,
    canViewWorkspace,
    canManageCreators,
  } = useWorkspaceAccess();
  const canViewCreators = accessLoading || canViewWorkspace;
  const canEditCreators = accessLoading || canManageCreators;

  // Cart/Request state for "All Creators" tab
  const { cart, addCreator, removeCreator, clearCart, isInCart, totalItems } =
    useCart();
  const [showReviewRequestModal, setShowReviewRequestModal] = useState(false);
  const [showChatbotModal, setShowChatbotModal] = useState(false);
  const [showSingleCreatorRequestModal, setShowSingleCreatorRequestModal] =
    useState(false);
  const [requestCreatorId, setRequestCreatorId] = useState<string | null>(null);

  const [searchQuery, setSearchQuery] = useState("");
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [selectedPlatforms, setSelectedPlatforms] = useState<Platform[]>([]);
  const [selectedNiche, setSelectedNiche] = useState<string>("all");
  const [selectedLocation, setSelectedLocation] = useState<string>("all");
  const [followerRange, setFollowerRange] = useState<{
    min: string;
    max: string;
  }>({ min: "", max: "" });
  const [postsRange, setPostsRange] = useState<{ min: string; max: string }>({
    min: "",
    max: "",
  });
  const [isPaidUser] = useState(false);
  const [isSavingCreator, setIsSavingCreator] = useState(false);
  const [deletingCreatorId, setDeletingCreatorId] = useState<string | null>(
    null
  );
  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [viewDialogOpen, setViewDialogOpen] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
  const [selectedCreator, setSelectedCreator] =
    useState<CreatorWithStats | null>(null);
  const [showImportDialog, setShowImportDialog] = useState(false);
  const [showSendOfferModal, setShowSendOfferModal] = useState(false);
  const [showProfileModal, setShowProfileModal] = useState(false);
  const [selectedCreatorIds, setSelectedCreatorIds] = useState<Set<string>>(
    new Set()
  );
  const isCreatorsLoading = !shouldFetch || isLoading;

  // All hooks must be called before any conditional return (Rules of Hooks)
  const [sortField, setSortField] = useState<
    "platform" | "follower_count" | "niche" | "location" | null
  >(null);
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("asc");
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 18;

  const uniqueNiches = useMemo(() => {
    const niches = creators
      .map((c) => c.niche)
      .filter((niche): niche is string => !!niche && niche.trim() !== "");
    return ["all", ...Array.from(new Set(niches)).sort()];
  }, [creators]);

  const uniqueLocations = useMemo(() => {
    const locations = creators
      .map((c) => c.location)
      .filter(
        (location): location is string => !!location && location.trim() !== ""
      );
    return ["all", ...Array.from(new Set(locations)).sort()];
  }, [creators]);

  // Form state
  const [formData, setFormData] = useState<{
    name: string;
    handle: string;
    email: string;
    phone: string;
    platform: "tiktok" | "instagram" | "youtube" | "twitter" | "facebook";
    follower_count: number;
    avg_engagement: number;
    niche: string;
    location: string;
  }>({
    name: "",
    handle: "",
    email: "",
    phone: "",
    platform: "instagram",
    follower_count: 0,
    avg_engagement: 0,
    niche: "",
    location: "",
  });

  useEffect(() => {
    const timer = setTimeout(() => setShouldFetch(true), 500);
    return () => clearTimeout(timer);
  }, []);

  // Filter and sort creators
  const filteredAndSortedCreators = useMemo(() => {
    let filtered = creators;

    // Platform filter (multi-select)
    if (selectedPlatforms.length > 0) {
      filtered = filtered.filter((creator) =>
        selectedPlatforms.includes(creator.platform)
      );
    }

    // Niche filter
    if (selectedNiche !== "all") {
      filtered = filtered.filter((creator) => creator.niche === selectedNiche);
    }

    // Location filter
    if (selectedLocation !== "all") {
      filtered = filtered.filter(
        (creator) => creator.location === selectedLocation
      );
    }

    // Followers range filter
    if (followerRange.min || followerRange.max) {
      filtered = filtered.filter((creator) => {
        const followers = creator.follower_count || 0;
        const min = followerRange.min ? parseInt(followerRange.min) : 0;
        const max = followerRange.max ? parseInt(followerRange.max) : Infinity;
        return followers >= min && followers <= max;
      });
    }

    // Posts range filter (campaigns_completed from creator_stats)
    if (postsRange.min || postsRange.max) {
      filtered = filtered.filter((creator) => {
        const campaignsCount =
          (creator as any).totalPosts ??
          (creator as any).creator_stats?.campaigns_completed ??
          0;
        const min = postsRange.min ? parseInt(postsRange.min) : 0;
        const max = postsRange.max ? parseInt(postsRange.max) : Infinity;
        return campaignsCount >= min && campaignsCount <= max;
      });
    }

    // Text search (existing)
    if (searchQuery) {
      filtered = filtered.filter(
        (creator) =>
          creator.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
          creator.handle.toLowerCase().includes(searchQuery.toLowerCase()) ||
          (creator.email &&
            creator.email.toLowerCase().includes(searchQuery.toLowerCase())) ||
          (creator.location &&
            creator.location.toLowerCase().includes(searchQuery.toLowerCase()))
      );
    }

    // Apply sorting
    if (sortField) {
      filtered = [...filtered].sort((a, b) => {
        let aValue: string | number;
        let bValue: string | number;

        switch (sortField) {
          case "platform":
            aValue = a.platform;
            bValue = b.platform;
            break;
          case "follower_count":
            aValue = a.follower_count;
            bValue = b.follower_count;
            break;
          case "niche":
            aValue = a.niche || "";
            bValue = b.niche || "";
            break;
          case "location":
            aValue = a.location || "";
            bValue = b.location || "";
            break;
          default:
            return 0;
        }

        if (aValue < bValue) return sortDirection === "asc" ? -1 : 1;
        if (aValue > bValue) return sortDirection === "asc" ? 1 : -1;
        return 0;
      });
    }

    return filtered;
  }, [
    creators,
    selectedPlatforms,
    selectedNiche,
    selectedLocation,
    followerRange,
    postsRange,
    searchQuery,
    sortField,
    sortDirection,
  ]);

  const activeCreatorFilterCount = useMemo(() => {
    let count = 0;
    if (selectedPlatforms.length > 0) count += 1;
    if (selectedNiche !== "all") count += 1;
    if (selectedLocation !== "all") count += 1;
    if (followerRange.min || followerRange.max) count += 1;
    if (postsRange.min || postsRange.max) count += 1;
    return count;
  }, [
    selectedPlatforms,
    selectedNiche,
    selectedLocation,
    followerRange,
    postsRange,
  ]);

  // Paginate creators
  const totalPages = Math.ceil(filteredAndSortedCreators.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const paginatedCreators = filteredAndSortedCreators.slice(
    startIndex,
    endIndex
  );

  // Reset to page 1 when search or sort changes
  React.useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, sortField, sortDirection]);

  // Clear all filters
  const clearAllFilters = () => {
    setSelectedPlatforms([]);
    setSelectedNiche("all");
    setSelectedLocation("all");
    setFollowerRange({ min: "", max: "" });
    setPostsRange({ min: "", max: "" });
    setSearchQuery("");
  };

  const handleSort = (
    field: "platform" | "follower_count" | "niche" | "location"
  ) => {
    if (sortField === field) {
      setSortDirection(sortDirection === "asc" ? "desc" : "asc");
    } else {
      setSortField(field);
      setSortDirection("asc");
    }
  };

  const handleAdd = async () => {
    if (!canEditCreators) {
      toast.error("You don't have permission to add creators.");
      return;
    }
    if (!formData.name || !formData.handle || !formData.platform) {
      toast.error("Please fill in name, handle, and platform");
      return;
    }

    try {
      setIsSavingCreator(true);
      await createCreatorMutation.mutateAsync({
        name: formData.name,
        handle: formData.handle,
        platform: formData.platform,
        follower_count: formData.follower_count || 0,
        avg_engagement: formData.avg_engagement || 0,
        email: formData.email || null,
        phone: formData.phone || null,
        niche: formData.niche || null,
        location: formData.location || null,
      });

      setAddDialogOpen(false);
      setFormData({
        name: "",
        handle: "",
        email: "",
        phone: "",
        platform: "instagram",
        follower_count: 0,
        avg_engagement: 0,
        niche: "",
        location: "",
      });
    } catch (error: any) {
      // Error toast is handled by the mutation
    } finally {
      setIsSavingCreator(false);
    }
  };

  const handleEdit = async () => {
    if (!canEditCreators) {
      toast.error("You don't have permission to edit creators.");
      return;
    }
    if (
      !selectedCreator ||
      !formData.name ||
      !formData.handle ||
      !formData.platform
    ) {
      toast.error("Please fill in name, handle, and platform");
      return;
    }

    try {
      await updateCreatorMutation.mutateAsync({
        id: selectedCreator.id,
        updates: {
          name: formData.name,
          handle: formData.handle,
          platform: formData.platform,
          follower_count: formData.follower_count || 0,
          avg_engagement: formData.avg_engagement || 0,
          email: formData.email || null,
          phone: formData.phone || null,
          niche: formData.niche || null,
          location: formData.location || null,
        },
      });

      setEditDialogOpen(false);
      setSelectedCreator(null);
      setFormData({
        name: "",
        handle: "",
        email: "",
        phone: "",
        platform: "instagram",
        follower_count: 0,
        avg_engagement: 0,
        niche: "",
        location: "",
      });
    } catch (error: any) {
      // Error toast is handled by the mutation
    }
  };

  const handleDelete = async (id: string) => {
    if (!canEditCreators) {
      toast.error("You don't have permission to delete creators.");
      return;
    }
    try {
      setDeletingCreatorId(id);
      await deleteCreatorMutation.mutateAsync(id);
      setDeleteConfirm(null);
    } catch (error: any) {
      // Error toast is handled by the mutation
    } finally {
      setDeletingCreatorId(null);
    }
  };

  const handleDeleteRequest = (creator: CreatorWithStats) => {
    if (!canEditCreators) {
      toast.error("You don't have permission to delete creators.");
      return;
    }
    console.log("[Delete Request]", {
      creatorId: creator.id,
      creatorName: creator.name,
    });
    if (!creator?.id) {
      toast.error("Creator not found");
      return;
    }
    setSelectedCreator(creator);
    setDeleteConfirm(creator.id);
  };

  const openEditDialog = (creator: CreatorWithStats) => {
    if (!canEditCreators) {
      toast.error("You don't have permission to edit creators.");
      return;
    }
    setSelectedCreator(creator);
    setFormData({
      name: creator.name,
      handle: creator.handle,
      email: creator.email || "",
      phone: creator.phone || "",
      platform: creator.platform,
      follower_count: creator.follower_count,
      avg_engagement: creator.avg_engagement,
      niche: creator.niche || "",
      location: creator.location || "",
    });
    setEditDialogOpen(true);
  };

  const openViewDialog = (creator: CreatorWithStats) => {
    setSelectedCreator(creator);
    setViewDialogOpen(true);
  };

  const handleOpenAddDialog = () => {
    if (!canEditCreators) {
      toast.error("You don't have permission to add creators.");
      return;
    }
    setAddDialogOpen(true);
  };

  const handleOpenImportDialog = () => {
    if (!canEditCreators) {
      toast.error("You don't have permission to import creators.");
      return;
    }
    setShowImportDialog(true);
  };

  const handleExportCSV = async () => {
    if (creators.length === 0) {
      toast.error("No creators to export");
      return;
    }
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

    const csvContent = csvUtils.exportCreatorsToCSV(creators);
    const filename = `creators_export_${
      new Date().toISOString().split("T")[0]
    }.csv`;
    csvUtils.downloadCSV(csvContent, filename);
    toast.success("Creators exported successfully");
  };

  if (!canViewCreators && !accessLoading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-4">
          <button
            onClick={() => onNavigate?.("/")}
            className="w-11 h-11 rounded-md bg-white/[0.03] hover:bg-white/[0.06] border border-white/[0.08] flex items-center justify-center transition-colors"
            aria-label="Back to dashboard"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>
          <div>
            <h1 className="text-xl sm:text-2xl font-semibold tracking-tight text-white">
              Creator Library
            </h1>
            <p className="text-sm text-slate-400 mt-1">
              Access restricted for your current role.
            </p>
          </div>
        </div>
        <Card className="bg-[#0D0D0D] border-white/[0.08]">
          <CardContent className="flex flex-col items-center justify-center py-16">
            <div className="w-12 h-12 rounded-lg bg-white/[0.06] flex items-center justify-center mb-4">
              <Eye className="w-6 h-6 text-slate-400" />
            </div>
            <h3 className="text-base font-semibold text-white mb-1">
              No access
            </h3>
            <p className="text-sm text-slate-400 mb-4 text-center max-w-md">
              You need workspace access to view the creator library.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6 sm:space-y-8 pb-6 sm:pb-8">
      <div className="flex flex-col gap-3 sm:gap-6">
        <div className="flex items-center gap-2.5 sm:gap-5">
          <button
            onClick={() => onNavigate?.("/")}
            className="w-10 h-10 sm:w-11 sm:h-11 min-h-[44px] min-w-[44px] flex-shrink-0 rounded-lg bg-white/[0.03] hover:bg-white/[0.06] active:bg-white/[0.08] border border-white/[0.08] flex items-center justify-center transition-all duration-150"
            style={{ boxShadow: "var(--shadow-card)" }}
            aria-label="Back to dashboard"
          >
            <ArrowLeft className="w-4 h-4 text-white" />
          </button>
          <div className="flex items-center gap-2.5 sm:gap-4 flex-1 min-w-0">
            <div className="w-10 h-10 sm:w-12 sm:h-12 flex-shrink-0 rounded-xl bg-white/[0.06] flex items-center justify-center">
              <UsersIcon className="w-5 h-5 sm:w-6 sm:h-6 text-white" />
            </div>
            <div className="flex-1 min-w-0">
              <h1 className="text-lg sm:text-2xl font-bold text-white tracking-tight leading-tight">
                Creator Library
              </h1>
              <p className="text-xs sm:text-sm text-slate-400 mt-0.5 sm:mt-1 line-clamp-1">
                Manage your creator network and contacts
              </p>
            </div>
          </div>
        </div>
      </div>

      <div className="w-full">
        <div className="flex flex-col gap-2.5 sm:gap-4 sm:flex-row sm:items-center sm:justify-end sm:justify-between">
          <div className="flex flex-col gap-2 w-full sm:flex-row sm:items-center sm:justify-end sm:gap-3">
            <button
              onClick={handleOpenAddDialog}
              className="h-11 min-h-[44px] px-4 sm:px-5 bg-white hover:bg-white/95 active:bg-white/90 text-black text-sm font-medium flex items-center justify-center gap-2 rounded-lg transition-all duration-150 w-full sm:w-auto disabled:opacity-50 disabled:cursor-not-allowed"
              disabled={!canEditCreators}
              title={
                !canEditCreators
                  ? "You don't have permission to add creators"
                  : undefined
              }
            >
              <Plus className="w-4 h-4" />
              Add Creator
            </button>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  type="button"
                  className="relative h-11 min-h-[44px] px-3 rounded-lg bg-white/[0.02] hover:bg-white/[0.06] border border-white/[0.08] text-sm text-slate-300 flex items-center justify-center gap-2 transition-colors w-full sm:w-auto"
                  aria-label="Creator actions"
                >
                  <MoreHorizontal className="w-4 h-4" />
                  {activeCreatorTab === "discover" && totalItems > 0
                    ? "Requests"
                    : "Actions"}
                  {activeCreatorTab === "discover" && totalItems > 0 && (
                    <span className="ml-1 min-w-[20px] h-5 px-1.5 rounded-full bg-white text-black text-xs font-semibold flex items-center justify-center">
                      {totalItems}
                    </span>
                  )}
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                {activeCreatorTab === "discover" && totalItems > 0 && (
                  <>
                    <DropdownMenuItem
                      onSelect={() => setShowReviewRequestModal(true)}
                    >
                      <Check className="w-4 h-4" />
                      Review request ({totalItems})
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                  </>
                )}
                <DropdownMenuItem
                  onSelect={() => onNavigate?.("/creators/scraper")}
                >
                  <Sparkles className="w-4 h-4" />
                  Creator scraper
                </DropdownMenuItem>
                <DropdownMenuItem
                  onSelect={handleOpenImportDialog}
                  disabled={!canEditCreators}
                >
                  <Upload className="w-4 h-4" />
                  Import CSV
                </DropdownMenuItem>
                {activeCreatorTab === "my_network" && (
                  <DropdownMenuItem
                    onSelect={handleExportCSV}
                    disabled={creators.length === 0 || isCreatorsLoading}
                  >
                    <Download className="w-4 h-4" />
                    Export CSV
                  </DropdownMenuItem>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>

        <div className="space-y-3 sm:space-y-5 mt-3 sm:mt-5">
          {/* Network Filter Tabs: My Network | Discover | Favorites */}
          <div className="flex gap-2 overflow-x-auto pb-1 -mx-1 px-1 scrollbar-hide">
            <button
              onClick={() => setActiveCreatorTab("my_network")}
              className={`px-3.5 py-2 sm:px-5 sm:py-2.5 min-h-[44px] rounded-lg text-xs sm:text-sm font-medium whitespace-nowrap transition-all duration-150 ${
                activeCreatorTab === "my_network"
                  ? "bg-white text-black shadow-sm"
                  : "bg-white/[0.02] hover:bg-white/[0.04] active:bg-white/[0.06] border border-white/[0.06] text-slate-300 hover:border-white/[0.1]"
              }`}
            >
              My Network
            </button>
            <button
              onClick={() => setActiveCreatorTab("discover")}
              className={`px-3.5 py-2 sm:px-5 sm:py-2.5 min-h-[44px] rounded-lg text-xs sm:text-sm font-medium whitespace-nowrap transition-all duration-150 ${
                activeCreatorTab === "discover"
                  ? "bg-white text-black shadow-sm"
                  : "bg-white/[0.02] hover:bg-white/[0.04] active:bg-white/[0.06] border border-white/[0.06] text-slate-300 hover:border-white/[0.1]"
              }`}
            >
              Discover
            </button>
            <button
              onClick={() => setActiveCreatorTab("favorites")}
              className={`px-3.5 py-2 sm:px-5 sm:py-2.5 min-h-[44px] rounded-lg text-xs sm:text-sm font-medium whitespace-nowrap transition-all duration-150 ${
                activeCreatorTab === "favorites"
                  ? "bg-white text-black shadow-sm"
                  : "bg-white/[0.02] hover:bg-white/[0.04] active:bg-white/[0.06] border border-white/[0.06] text-slate-300 hover:border-white/[0.1]"
              }`}
            >
              Favorites
            </button>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-2 gap-3 sm:gap-5">
            <Card
              className="bg-[#0D0D0D] border-white/[0.08] transition-all duration-150 active:border-white/[0.12]"
              style={{ boxShadow: "var(--shadow-stat)" }}
            >
              <CardContent className="p-3.5 sm:p-6">
                <div
                  className="text-2xl sm:text-4xl font-semibold text-white tracking-tight"
                  style={{ letterSpacing: "var(--letter-spacing-tight)" }}
                >
                  {creators.length}
                </div>
                <p className="text-[11px] sm:text-sm text-slate-400 mt-1 sm:mt-2 font-medium">
                  Total Creators
                </p>
              </CardContent>
            </Card>

            <Card
              className="bg-[#0D0D0D] border-white/[0.08] transition-all duration-150 active:border-white/[0.12]"
              style={{ boxShadow: "var(--shadow-stat)" }}
            >
              <CardContent className="p-3.5 sm:p-6">
                <div
                  className="text-2xl sm:text-4xl font-semibold text-purple-400 tracking-tight"
                  style={{ letterSpacing: "var(--letter-spacing-tight)" }}
                >
                  {creators.reduce((sum, c) => sum + c.totalPosts, 0)}
                </div>
                <p className="text-[11px] sm:text-sm text-slate-400 mt-1 sm:mt-2 font-medium">
                  Total Posts
                </p>
              </CardContent>
            </Card>
          </div>

          {/* Search, Filters, and Sort */}
          <div className="flex flex-col gap-3">
            <div className="flex flex-col gap-2.5 sm:flex-row sm:items-center sm:gap-3">
              <div className="relative flex-1">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500 pointer-events-none" />
                <Input
                  type="search"
                  placeholder="Search creators by name, handle, email, or location..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="h-11 sm:h-12 pl-11 pr-4"
                />
              </div>
              <button
                onClick={() => setFiltersOpen(true)}
                className="h-11 sm:h-12 min-h-[44px] px-4 rounded-lg bg-white/[0.02] hover:bg-white/[0.04] active:bg-white/[0.06] border border-white/[0.06] hover:border-white/[0.1] text-sm text-slate-300 flex items-center justify-center gap-2 transition-all duration-150 w-full sm:w-auto"
              >
                <Filter className="w-4 h-4" />
                <span className="hidden xs:inline">Filters</span>
                {activeCreatorFilterCount > 0 && (
                  <span className="w-5 h-5 rounded-full bg-white text-black text-xs flex items-center justify-center font-semibold">
                    {activeCreatorFilterCount}
                  </span>
                )}
              </button>
              <div className="flex w-full sm:w-auto items-center gap-2 sm:gap-3">
                <select
                  value={sortField ?? "none"}
                  onChange={(e) => {
                    const value = e.target.value;
                    if (value === "none") {
                      setSortField(null);
                      return;
                    }
                    if (sortField !== value) {
                      setSortDirection("asc");
                    }
                    setSortField(
                      value as
                        | "platform"
                        | "follower_count"
                        | "niche"
                        | "location"
                    );
                  }}
                  className="h-11 sm:h-12 w-full sm:w-[220px] px-3 sm:px-4 pr-8 bg-white/[0.04] border border-white/[0.1] rounded-lg text-sm text-white appearance-none cursor-pointer hover:bg-white/[0.06] active:bg-white/[0.08] focus:bg-white/[0.06] focus:border-primary/50 transition-all duration-150"
                  style={{ boxShadow: "var(--shadow-card)" }}
                >
                  <option value="none">Sort: Default</option>
                  <option value="platform">Sort: Platform</option>
                  <option value="follower_count">Sort: Followers</option>
                  <option value="niche">Sort: Niche</option>
                  <option value="location">Sort: Location</option>
                </select>
                <button
                  onClick={() =>
                    setSortDirection(sortDirection === "asc" ? "desc" : "asc")
                  }
                  disabled={!sortField}
                  className="h-11 sm:h-12 w-11 sm:w-12 rounded-lg bg-white/[0.02] hover:bg-white/[0.06] active:bg-white/[0.08] border border-white/[0.08] text-slate-300 flex items-center justify-center transition-all duration-150 disabled:opacity-50 disabled:cursor-not-allowed"
                  style={{ boxShadow: "var(--shadow-card)" }}
                  aria-label="Toggle sort direction"
                >
                  <ArrowUpDown className="w-4 h-4" />
                </button>
              </div>
            </div>

            {(selectedPlatforms.length > 0 ||
              selectedNiche !== "all" ||
              selectedLocation !== "all" ||
              followerRange.min ||
              followerRange.max ||
              postsRange.min ||
              postsRange.max ||
              searchQuery) && (
              <div className="flex flex-wrap items-center gap-2 text-xs text-slate-400">
                <span>
                  Showing {filteredAndSortedCreators.length} of{" "}
                  {creators.length}
                </span>
                <span className="text-slate-500">•</span>
                {selectedPlatforms.length > 0 && (
                  <span>{selectedPlatforms.length} platform(s)</span>
                )}
                {selectedNiche !== "all" && <span>{selectedNiche}</span>}
                {selectedLocation !== "all" && <span>{selectedLocation}</span>}
                {(followerRange.min || followerRange.max) && (
                  <span>
                    Followers: {formatNumber(parseInt(followerRange.min) || 0)}-
                    {followerRange.max
                      ? formatNumber(parseInt(followerRange.max))
                      : "∞"}
                  </span>
                )}
                {(postsRange.min || postsRange.max) && (
                  <span>
                    Posts: {postsRange.min || "0"}-{postsRange.max || "∞"}
                  </span>
                )}
                <button
                  onClick={clearAllFilters}
                  className="ml-auto h-8 px-3 rounded-full bg-white/[0.04] hover:bg-white/[0.08] border border-white/[0.1] text-xs text-slate-300 hover:text-white transition-all"
                >
                  Clear all
                </button>
              </div>
            )}
          </div>
          {isCreatorsLoading ? (
            <Card className="bg-[#0D0D0D] border-white/[0.08]">
              <CardContent className="flex flex-col items-center justify-center py-16">
                <div className="w-12 h-12 rounded-lg bg-white/[0.03] flex items-center justify-center mb-4">
                  <UsersIcon className="w-6 h-6 text-slate-600 animate-pulse" />
                </div>
                <p className="text-sm text-slate-400">Loading creators...</p>
              </CardContent>
            </Card>
          ) : filteredAndSortedCreators.length > 0 ? (
            <Card
              className="bg-[#0D0D0D] border-white/[0.08]"
              style={{ boxShadow: "var(--shadow-card)" }}
            >
              <CardContent className="p-3 sm:p-5">
                {selectedCreatorIds.size > 0 && (
                  <div
                    className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 sm:gap-4 mb-4 sm:mb-5 p-3 sm:p-4 rounded-lg bg-white/[0.03] border border-white/[0.08]"
                    style={{ boxShadow: "var(--shadow-card)" }}
                  >
                    <span className="text-sm text-slate-400 font-medium">
                      {selectedCreatorIds.size} selected
                    </span>
                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          clearCart();
                          paginatedCreators
                            .filter((c) => selectedCreatorIds.has(c.id))
                            .forEach((c) => addCreator(c as CreatorWithStats));
                          setSelectedCreatorIds(new Set());
                          setShowChatbotModal(true);
                        }}
                        className="border-white/[0.08]"
                      >
                        Create Request
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          if (selectedCreatorIds.size > 0) {
                            const first = Array.from(selectedCreatorIds)[0];
                            const c = paginatedCreators.find(
                              (x) => x.id === first
                            );
                            if (c) {
                              setSelectedCreator(c as CreatorWithStats);
                              setShowSendOfferModal(true);
                            }
                          }
                        }}
                        className="border-white/[0.08]"
                      >
                        Add to Activation
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={handleExportCSV}
                        className="border-white/[0.08]"
                      >
                        Export
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setSelectedCreatorIds(new Set())}
                        className="border-white/[0.08]"
                      >
                        Deselect All
                      </Button>
                    </div>
                  </div>
                )}
                <div className="grid grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4 lg:gap-5">
                  {paginatedCreators.map((creator) => (
                    <CreatorCard
                      key={creator.id}
                      creator={creator as CreatorWithSocialAndStats}
                      source={activeCreatorTab}
                      isFavorite={favoriteIds.has(creator.id)}
                      onToggleFavorite={(id) => {
                        if (!id.startsWith("manual-"))
                          toggleFavorite.mutate(id);
                      }}
                      onViewProfile={(c) => {
                        setSelectedCreator(c as CreatorWithStats);
                        setShowProfileModal(true);
                      }}
                      onRequest={(c) => {
                        setRequestCreatorId(c.id);
                        setShowSingleCreatorRequestModal(true);
                      }}
                      onAddToActivation={
                        activeCreatorTab !== "favorites"
                          ? (c) => {
                              setSelectedCreator(c as CreatorWithStats);
                              setShowSendOfferModal(true);
                            }
                          : undefined
                      }
                      isManual={creator.id.startsWith("manual-")}
                      selectable={activeCreatorTab !== "favorites"}
                      selected={selectedCreatorIds.has(creator.id)}
                      onSelect={(id, checked) => {
                        setSelectedCreatorIds((prev) => {
                          const next = new Set(prev);
                          if (checked) next.add(id);
                          else next.delete(id);
                          return next;
                        });
                      }}
                    />
                  ))}
                </div>
                <div className="mt-4 flex justify-center">
                  <Pagination>
                    <PaginationContent>
                      <PaginationItem>
                        <PaginationPrevious
                          onClick={() =>
                            setCurrentPage((p) => Math.max(1, p - 1))
                          }
                          className={
                            currentPage <= 1
                              ? "pointer-events-none opacity-50"
                              : "cursor-pointer"
                          }
                        />
                      </PaginationItem>
                      {Array.from(
                        { length: Math.min(5, totalPages) },
                        (_, i) => {
                          const page = i + 1;
                          return (
                            <PaginationItem key={page}>
                              <PaginationLink
                                onClick={() => setCurrentPage(page)}
                                isActive={currentPage === page}
                                className="cursor-pointer"
                              >
                                {page}
                              </PaginationLink>
                            </PaginationItem>
                          );
                        }
                      )}
                      <PaginationItem>
                        <PaginationNext
                          onClick={() =>
                            setCurrentPage((p) => Math.min(totalPages, p + 1))
                          }
                          className={
                            currentPage >= totalPages
                              ? "pointer-events-none opacity-50"
                              : "cursor-pointer"
                          }
                        />
                      </PaginationItem>
                    </PaginationContent>
                  </Pagination>
                </div>
              </CardContent>
            </Card>
          ) : (
            <Card className="bg-[#0D0D0D] border-white/[0.08]">
              <CardContent className="flex flex-col items-center justify-center py-16">
                <UsersIcon className="w-12 h-12 text-slate-600 mb-4" />
                <p className="text-slate-400">
                  {activeCreatorTab === "my_network"
                    ? "No creators in your network yet"
                    : activeCreatorTab === "discover"
                      ? "No creators to discover"
                      : "No favorites yet"}
                </p>
                {activeCreatorTab === "my_network" && (
                  <Button onClick={handleOpenAddDialog} className="mt-4">
                    <Plus className="w-4 h-4 mr-2" />
                    Add Creator
                  </Button>
                )}
              </CardContent>
            </Card>
          )}
          {false &&
            (filteredAndSortedCreators.length > 0 ? (
              <Card className="hidden">
                <CardContent className="p-0">
                  <div className="lg:hidden p-4 grid grid-cols-1 min-[430px]:grid-cols-2 gap-3">
                    {paginatedCreators.map((creator) => (
                      <Card
                        key={creator.id}
                        className="bg-[#0D0D0D] border-white/[0.08] hover:border-white/[0.12] transition-colors"
                      >
                        <CardContent className="p-3 space-y-2">
                          <div className="flex items-start justify-between gap-2">
                            <div className="flex items-center gap-2 min-w-0">
                              <div className="w-8 h-8 rounded-full bg-gradient-to-br from-primary/20 to-cyan-400/20 border border-primary/30 flex items-center justify-center text-xs font-semibold text-primary">
                                {creator.name?.charAt(0).toUpperCase()}
                              </div>
                              <div className="min-w-0">
                                <p className="text-sm font-medium text-white truncate">
                                  {creator.name}
                                </p>
                                <CreatorHandleLink
                                  handle={creator.handle}
                                  platform={creator.platform}
                                  className="truncate block"
                                />
                              </div>
                            </div>
                            {(() => {
                              const platformIcon = normalizePlatform(
                                creator.platform
                              );
                              if (!platformIcon) return null;
                              return (
                                <PlatformIcon
                                  platform={platformIcon}
                                  size="sm"
                                  aria-label={`${getPlatformLabel(platformIcon)} creator`}
                                />
                              );
                            })()}
                          </div>
                          <div className="grid grid-cols-2 gap-2">
                            <div className="rounded-md border border-white/[0.08] bg-white/[0.02] px-2 py-1.5">
                              <p className="text-[11px] uppercase tracking-wide text-muted-foreground">
                                Followers
                              </p>
                              <p className="text-sm text-white mt-0.5">
                                {formatFollowers(creator.follower_count)}
                              </p>
                            </div>
                            <div className="rounded-md border border-white/[0.08] bg-white/[0.02] px-2 py-1.5">
                              <p className="text-[11px] uppercase tracking-wide text-muted-foreground">
                                Engagement
                              </p>
                              <p className="text-sm text-emerald-400 mt-0.5">
                                {creator.avg_engagement}%
                              </p>
                            </div>
                          </div>
                          <div className="flex flex-col gap-2">
                            {activeCreatorTab === "discover" && (
                              <button
                                onClick={() => {
                                  setRequestCreatorId(creator.id);
                                  setShowSingleCreatorRequestModal(true);
                                }}
                                className="w-full h-9 rounded-md bg-primary hover:bg-primary/90 text-black text-xs font-medium transition-colors"
                              >
                                Request Creator
                              </button>
                            )}
                            <div className="flex items-center gap-2">
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => openViewDialog(creator)}
                                className="min-h-[44px] flex-1 border-white/[0.08] bg-white/[0.03] hover:bg-white/[0.06] text-slate-300"
                              >
                                <Eye className="w-4 h-4" />
                                View
                              </Button>
                              {activeCreatorTab === "my_network" && (
                                <>
                                  <button
                                    onClick={() => openEditDialog(creator)}
                                    className="h-11 w-11 min-h-[44px] min-w-[44px] rounded-md bg-white/[0.03] hover:bg-white/[0.06] border border-white/[0.08] text-slate-300 flex items-center justify-center transition-colors"
                                    aria-label="Edit creator"
                                  >
                                    <Edit2 className="w-4 h-4" />
                                  </button>
                                  <button
                                    type="button"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      e.preventDefault();
                                      handleDeleteRequest(creator);
                                    }}
                                    disabled={false}
                                    className="h-11 w-11 min-h-[44px] min-w-[44px] rounded-md bg-red-500/20 hover:bg-red-500/30 border border-red-500/50 text-red-400 flex items-center justify-center transition-colors"
                                    aria-label="Delete creator"
                                  >
                                    <Trash2 className="w-4 h-4" />
                                  </button>
                                </>
                              )}
                              {activeCreatorTab === "discover" &&
                                (isInCart(creator.id) ? (
                                  <button
                                    onClick={() => removeCreator(creator.id)}
                                    className="h-11 w-11 min-h-[44px] min-w-[44px] rounded-md bg-primary/20 hover:bg-primary/30 border border-primary/50 text-primary flex items-center justify-center transition-colors"
                                    aria-label="Remove creator"
                                  >
                                    <Check className="w-4 h-4" />
                                  </button>
                                ) : (
                                  <button
                                    onClick={() => addCreator(creator)}
                                    className="h-11 w-11 min-h-[44px] min-w-[44px] rounded-md bg-white/[0.03] hover:bg-white/[0.06] border border-white/[0.08] text-slate-300 flex items-center justify-center transition-colors"
                                    aria-label="Add creator"
                                  >
                                    <Plus className="w-4 h-4" />
                                  </button>
                                ))}
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>

                  <div className="hidden lg:block overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow className="border-white/[0.08] hover:bg-transparent">
                          {activeCreatorTab === "discover" && (
                            <TableHead className="text-slate-400 font-medium w-12">
                              <input
                                type="checkbox"
                                checked={
                                  paginatedCreators.length > 0 &&
                                  paginatedCreators.every((c) => isInCart(c.id))
                                }
                                onChange={(e) => {
                                  if (e.target.checked) {
                                    paginatedCreators.forEach((creator) =>
                                      addCreator(creator)
                                    );
                                  } else {
                                    paginatedCreators.forEach((creator) =>
                                      removeCreator(creator.id)
                                    );
                                  }
                                }}
                                className="w-4 h-4 rounded border-white/[0.2] bg-white/[0.03] checked:bg-primary checked:border-primary cursor-pointer"
                              />
                            </TableHead>
                          )}
                          <TableHead className="text-slate-400 font-medium">
                            Creator
                          </TableHead>
                          {activeCreatorTab === "my_network" && (
                            <TableHead className="text-slate-400 font-medium">
                              Contact
                            </TableHead>
                          )}
                          <TableHead className="text-slate-400 font-medium">
                            Platform
                          </TableHead>
                          <TableHead className="text-slate-400 font-medium">
                            Niche
                          </TableHead>
                          <TableHead className="text-slate-400 font-medium text-right">
                            Followers
                          </TableHead>
                          <TableHead className="text-slate-400 font-medium text-right">
                            Campaigns
                          </TableHead>
                          <TableHead className="text-slate-400 font-medium text-right">
                            Posts
                          </TableHead>
                          <TableHead className="text-slate-400 font-medium text-right">
                            Engagement
                          </TableHead>
                          {activeCreatorTab === "my_network" && (
                            <TableHead className="text-slate-400 font-medium text-center">
                              Actions
                            </TableHead>
                          )}
                          {activeCreatorTab === "discover" && (
                            <>
                              <TableHead className="text-slate-400 font-medium text-right">
                                Actions
                              </TableHead>
                              <TableHead className="text-slate-400 font-medium text-right w-20">
                                Add
                              </TableHead>
                            </>
                          )}
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {paginatedCreators.map((creator) => (
                          <TableRow
                            key={creator.id}
                            className="border-white/[0.04] hover:bg-white/[0.02] transition-colors"
                          >
                            {activeCreatorTab === "discover" && (
                              <TableCell>
                                <input
                                  type="checkbox"
                                  checked={isInCart(creator.id)}
                                  onChange={(e) => {
                                    if (e.target.checked) {
                                      addCreator(creator);
                                    } else {
                                      removeCreator(creator.id);
                                    }
                                  }}
                                  className="w-4 h-4 rounded border-white/[0.2] bg-white/[0.03] checked:bg-primary checked:border-primary cursor-pointer"
                                />
                              </TableCell>
                            )}
                            <TableCell>
                              <div className="font-medium text-white text-sm">
                                {creator.name}
                              </div>
                              <CreatorHandleLink
                                handle={creator.handle}
                                platform={creator.platform}
                                className="mt-0.5 block"
                              />
                            </TableCell>
                            {activeCreatorTab === "my_network" && (
                              <TableCell>
                                <div className="space-y-1.5 min-w-[180px]">
                                  {creator.email && (
                                    <div className="text-sm text-white">
                                      {creator.email}
                                    </div>
                                  )}
                                  {creator.phone && (
                                    <div className="text-sm text-white">
                                      {creator.phone}
                                    </div>
                                  )}
                                  {!creator.email && !creator.phone && (
                                    <span className="text-xs text-slate-500">
                                      No contact info
                                    </span>
                                  )}
                                </div>
                              </TableCell>
                            )}
                            <TableCell>
                              {(() => {
                                const platformIcon = normalizePlatform(
                                  creator.platform
                                );
                                if (!platformIcon) return null;
                                return (
                                  <PlatformIcon
                                    platform={platformIcon}
                                    size="md"
                                    aria-label={`${getPlatformLabel(platformIcon)} creator`}
                                  />
                                );
                              })()}
                            </TableCell>
                            <TableCell>
                              <span className="text-sm text-slate-300">
                                {creator.niche || "-"}
                              </span>
                            </TableCell>
                            <TableCell className="text-right">
                              <span className="text-white font-medium text-sm">
                                {formatFollowers(creator.follower_count)}
                              </span>
                            </TableCell>
                            <TableCell className="text-right text-slate-300">
                              <span className="text-sm">
                                {creator.campaigns}
                              </span>
                            </TableCell>
                            <TableCell className="text-right text-slate-300">
                              <span className="text-sm">
                                {creator.totalPosts}
                              </span>
                            </TableCell>
                            <TableCell className="text-right">
                              <span className="text-emerald-400 font-medium text-sm">
                                {creator.avg_engagement}%
                              </span>
                            </TableCell>
                            {activeCreatorTab === "my_network" && (
                              <TableCell className="text-center">
                                <div className="flex items-center justify-center gap-2">
                                  <button
                                    onClick={() => openViewDialog(creator)}
                                    className="w-11 h-11 min-w-[44px] min-h-[44px] rounded-md hover:bg-white/[0.06] flex items-center justify-center transition-colors"
                                    aria-label="View creator"
                                  >
                                    <Eye className="w-5 h-5 text-slate-400" />
                                  </button>
                                  <button
                                    onClick={() => openEditDialog(creator)}
                                    className="w-11 h-11 min-w-[44px] min-h-[44px] rounded-md hover:bg-white/[0.06] flex items-center justify-center transition-colors"
                                    aria-label="Edit creator"
                                  >
                                    <Edit2 className="w-5 h-5 text-slate-400" />
                                  </button>
                                  <button
                                    type="button"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      e.preventDefault();
                                      handleDeleteRequest(creator);
                                    }}
                                    disabled={false}
                                    className="w-11 h-11 min-w-[44px] min-h-[44px] rounded-md bg-red-500/20 hover:bg-red-500/30 border border-red-500/50 text-red-400 flex items-center justify-center transition-colors"
                                    aria-label="Delete creator"
                                  >
                                    <Trash2 className="w-5 h-5" />
                                  </button>
                                </div>
                              </TableCell>
                            )}
                            {activeCreatorTab === "discover" && (
                              <>
                                <TableCell className="text-right">
                                  <button
                                    onClick={() => {
                                      setRequestCreatorId(creator.id);
                                      setShowSingleCreatorRequestModal(true);
                                    }}
                                    className="h-7 px-3 rounded-md bg-primary hover:bg-primary/90 text-black text-xs font-medium transition-colors"
                                  >
                                    Request Creator
                                  </button>
                                </TableCell>
                                <TableCell className="text-right">
                                  {isInCart(creator.id) ? (
                                    <button
                                      onClick={() => removeCreator(creator.id)}
                                      className="h-7 px-3 rounded-md bg-primary/20 hover:bg-primary/30 border border-primary/50 text-primary text-xs font-medium flex items-center gap-1.5 transition-colors"
                                    >
                                      <Check className="w-3 h-3" />
                                      Added
                                    </button>
                                  ) : (
                                    <button
                                      onClick={() => addCreator(creator)}
                                      className="h-7 px-3 rounded-md bg-white/[0.03] hover:bg-white/[0.06] border border-white/[0.08] text-slate-300 text-xs font-medium transition-colors"
                                    >
                                      Add
                                    </button>
                                  )}
                                </TableCell>
                              </>
                            )}
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </CardContent>
                {/* Pagination */}
                {totalPages > 1 && (
                  <div className="p-4 border-t border-white/[0.08]">
                    <div className="flex items-center justify-between mb-2">
                      <p className="text-sm text-slate-400">
                        Showing {startIndex + 1}-
                        {Math.min(endIndex, filteredAndSortedCreators.length)}{" "}
                        of {filteredAndSortedCreators.length} creators
                      </p>
                    </div>
                    <Pagination>
                      <PaginationContent>
                        <PaginationItem>
                          <PaginationPrevious
                            href="#"
                            onClick={(e) => {
                              e.preventDefault();
                              setCurrentPage((p) => Math.max(1, p - 1));
                            }}
                            className={
                              currentPage === 1
                                ? "pointer-events-none opacity-50"
                                : "cursor-pointer"
                            }
                          />
                        </PaginationItem>
                        {Array.from(
                          { length: totalPages },
                          (_, i) => i + 1
                        ).map((page) => {
                          if (
                            page === 1 ||
                            page === totalPages ||
                            (page >= currentPage - 1 && page <= currentPage + 1)
                          ) {
                            return (
                              <PaginationItem key={page}>
                                <PaginationLink
                                  href="#"
                                  onClick={(e) => {
                                    e.preventDefault();
                                    setCurrentPage(page);
                                  }}
                                  isActive={currentPage === page}
                                  className="cursor-pointer"
                                >
                                  {page}
                                </PaginationLink>
                              </PaginationItem>
                            );
                          } else if (
                            page === currentPage - 2 ||
                            page === currentPage + 2
                          ) {
                            return (
                              <PaginationItem key={page}>
                                <PaginationEllipsis />
                              </PaginationItem>
                            );
                          }
                          return null;
                        })}
                        <PaginationItem>
                          <PaginationNext
                            href="#"
                            onClick={(e) => {
                              e.preventDefault();
                              setCurrentPage((p) =>
                                Math.min(totalPages, p + 1)
                              );
                            }}
                            className={
                              currentPage === totalPages
                                ? "pointer-events-none opacity-50"
                                : "cursor-pointer"
                            }
                          />
                        </PaginationItem>
                      </PaginationContent>
                    </Pagination>
                  </div>
                )}
              </Card>
            ) : null)}
        </div>
      </div>

      <Dialog open={filtersOpen} onOpenChange={setFiltersOpen}>
        <DialogContent className="bg-[#0D0D0D] border-white/[0.08] w-[92vw] max-w-md p-4 sm:p-6">
          <DialogHeader>
            <DialogTitle className="text-base sm:text-lg font-semibold text-white">
              Filters
            </DialogTitle>
            <DialogDescription className="text-xs sm:text-sm text-slate-400">
              Filter creators by platform, niche, location, and followers.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 sm:space-y-4 max-h-[60vh] overflow-y-auto">
            <div className="space-y-2">
              <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
                Platform
              </p>
              <PlatformSelect
                selected={selectedPlatforms}
                onChange={setSelectedPlatforms}
              />
            </div>
            <div className="space-y-2">
              <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
                Niche
              </label>
              <select
                value={selectedNiche}
                onChange={(e) => setSelectedNiche(e.target.value)}
                className="h-10 sm:h-11 w-full rounded-md bg-white/[0.03] border border-white/[0.08] px-3 text-sm sm:text-base text-white"
              >
                <option value="all">All Niches</option>
                {uniqueNiches
                  .filter((n) => n !== "all")
                  .map((niche) => (
                    <option key={niche} value={niche}>
                      {niche}
                    </option>
                  ))}
              </select>
            </div>
            <div className="space-y-2">
              <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
                Location
              </label>
              <select
                value={selectedLocation}
                onChange={(e) => setSelectedLocation(e.target.value)}
                className="h-10 sm:h-11 w-full rounded-md bg-white/[0.03] border border-white/[0.08] px-3 text-sm sm:text-base text-white"
              >
                <option value="all">All Locations</option>
                {uniqueLocations
                  .filter((l) => l !== "all")
                  .map((location) => (
                    <option key={location} value={location}>
                      {location}
                    </option>
                  ))}
              </select>
            </div>
            <div className="space-y-2">
              <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
                Followers
              </label>
              <div className="flex flex-wrap gap-2">
                <div className="flex-1 min-w-[120px]">
                  <Input
                    type="text"
                    inputMode="numeric"
                    placeholder="Min"
                    value={
                      followerRange.min
                        ? formatNumber(parseInt(followerRange.min) || 0)
                        : ""
                    }
                    onChange={(e) => {
                      const raw = e.target.value.replace(/,/g, "");
                      const val = raw === "" ? "" : String(parseInt(raw) || 0);
                      setFollowerRange({ ...followerRange, min: val });
                    }}
                    className="h-10 sm:h-11 w-full rounded-md bg-white/[0.03] border border-white/[0.08] px-3 text-sm sm:text-base text-white"
                  />
                </div>
                <div className="flex-1 min-w-[120px]">
                  <Input
                    type="text"
                    inputMode="numeric"
                    placeholder="Max"
                    value={
                      followerRange.max
                        ? formatNumber(parseInt(followerRange.max) || 0)
                        : ""
                    }
                    onChange={(e) => {
                      const raw = e.target.value.replace(/,/g, "");
                      const val = raw === "" ? "" : String(parseInt(raw) || 0);
                      setFollowerRange({ ...followerRange, max: val });
                    }}
                    className="h-10 sm:h-11 w-full rounded-md bg-white/[0.03] border border-white/[0.08] px-3 text-sm sm:text-base text-white"
                  />
                </div>
              </div>
            </div>
            <div className="space-y-2">
              <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
                Posts
              </label>
              <div className="flex flex-wrap gap-2">
                <div className="flex-1 min-w-[120px]">
                  <Input
                    type="number"
                    placeholder="Min"
                    value={postsRange.min}
                    onChange={(e) =>
                      setPostsRange({ ...postsRange, min: e.target.value })
                    }
                    className="h-10 sm:h-11 w-full rounded-md bg-white/[0.03] border border-white/[0.08] px-3 text-sm sm:text-base text-white"
                  />
                </div>
                <div className="flex-1 min-w-[120px]">
                  <Input
                    type="number"
                    placeholder="Max"
                    value={postsRange.max}
                    onChange={(e) =>
                      setPostsRange({ ...postsRange, max: e.target.value })
                    }
                    className="h-10 sm:h-11 w-full rounded-md bg-white/[0.03] border border-white/[0.08] px-3 text-sm sm:text-base text-white"
                  />
                </div>
              </div>
            </div>
          </div>
          <DialogFooter className="flex flex-wrap gap-2 pt-3 sm:pt-4">
            <Button
              variant="outline"
              onClick={clearAllFilters}
              className="flex-1 sm:flex-initial"
            >
              Clear
            </Button>
            <Button
              onClick={() => setFiltersOpen(false)}
              className="flex-1 sm:flex-initial"
            >
              Apply
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Add/Edit Dialog */}
      {(addDialogOpen || editDialogOpen) && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <Card className="bg-[#1A1A1A] border-white/[0.08] max-w-md w-full max-h-[90vh] overflow-y-auto">
            <CardContent className="p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-white">
                  {addDialogOpen ? "Add Creator" : "Edit Creator"}
                </h3>
                <button
                  onClick={() => {
                    setAddDialogOpen(false);
                    setEditDialogOpen(false);
                    setFormData({
                      name: "",
                      handle: "",
                      email: "",
                      phone: "",
                      platform: "instagram",
                      follower_count: 0,
                      avg_engagement: 0,
                      niche: "",
                      location: "",
                    });
                  }}
                  className="w-8 h-8 rounded-md hover:bg-white/[0.06] flex items-center justify-center transition-colors"
                >
                  <X className="w-4 h-4 text-slate-400" />
                </button>
              </div>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-white mb-2">
                    Name *
                  </label>
                  <Input
                    placeholder="Creator name"
                    value={formData.name}
                    onChange={(e) =>
                      setFormData({ ...formData, name: e.target.value })
                    }
                    className="h-10 bg-white/[0.03] border-white/[0.08] text-white"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-white mb-2">
                    Handle/Username *
                  </label>
                  <Input
                    placeholder="@username"
                    value={formData.handle}
                    onChange={(e) =>
                      setFormData({ ...formData, handle: e.target.value })
                    }
                    className="h-10 bg-white/[0.03] border-white/[0.08] text-white"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-white mb-2">
                    Email
                  </label>
                  <Input
                    type="email"
                    placeholder="email@example.com"
                    value={formData.email}
                    onChange={(e) =>
                      setFormData({ ...formData, email: e.target.value })
                    }
                    className="h-10 bg-white/[0.03] border-white/[0.08] text-white"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-white mb-2">
                    Phone
                  </label>
                  <Input
                    placeholder="+1 (555) 123-4567"
                    value={formData.phone}
                    onChange={(e) =>
                      setFormData({ ...formData, phone: e.target.value })
                    }
                    className="h-10 bg-white/[0.03] border-white/[0.08] text-white"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-white mb-2">
                    Platform
                  </label>
                  <select
                    value={formData.platform}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        platform: e.target.value as any,
                      })
                    }
                    className="w-full h-10 px-3 bg-white/[0.03] border border-white/[0.08] rounded-md text-white"
                  >
                    <option value="instagram">Instagram</option>
                    <option value="tiktok">TikTok</option>
                    <option value="youtube">YouTube</option>
                    <option value="twitter">Twitter/X</option>
                    <option value="facebook">Facebook</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-white mb-2">
                    Followers
                  </label>
                  <Input
                    type="text"
                    inputMode="numeric"
                    placeholder="250,000"
                    value={
                      formData.follower_count
                        ? formatNumber(formData.follower_count)
                        : ""
                    }
                    onChange={(e) => {
                      const raw = e.target.value.replace(/,/g, "");
                      const num = parseInt(raw) || 0;
                      setFormData({ ...formData, follower_count: num });
                    }}
                    className="h-10 bg-white/[0.03] border-white/[0.08] text-white"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-white mb-2">
                    Avg. Engagement (%)
                  </label>
                  <Input
                    type="number"
                    step="0.1"
                    placeholder="4.5"
                    value={formData.avg_engagement || ""}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        avg_engagement: parseFloat(e.target.value) || 0,
                      })
                    }
                    className="h-10 bg-white/[0.03] border-white/[0.08] text-white"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-white mb-2">
                    Niche
                  </label>
                  <Input
                    placeholder="Fashion, Tech, Gaming, etc."
                    value={formData.niche}
                    onChange={(e) =>
                      setFormData({ ...formData, niche: e.target.value })
                    }
                    className="h-10 bg-white/[0.03] border-white/[0.08] text-white"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-white mb-2">
                    Location
                  </label>
                  <Input
                    placeholder="City, Country"
                    value={formData.location}
                    onChange={(e) =>
                      setFormData({ ...formData, location: e.target.value })
                    }
                    className="h-10 bg-white/[0.03] border-white/[0.08] text-white"
                  />
                </div>
                <div className="flex gap-3 pt-2">
                  <Button
                    onClick={addDialogOpen ? handleAdd : handleEdit}
                    disabled={addDialogOpen && isSavingCreator}
                    className="flex-1 h-9 bg-primary hover:bg-primary/90 text-[rgba(10,10,10,1)] flex items-center justify-center gap-2 disabled:opacity-70"
                    style={{
                      backgroundClip: "unset",
                      WebkitBackgroundClip: "unset",
                    }}
                  >
                    {addDialogOpen && isSavingCreator && (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    )}
                    {addDialogOpen
                      ? isSavingCreator
                        ? "Adding..."
                        : "Add Creator"
                      : "Save Changes"}
                  </Button>
                  <Button
                    onClick={() => {
                      setAddDialogOpen(false);
                      setEditDialogOpen(false);
                    }}
                    variant="outline"
                    className="h-9 px-4 bg-white/[0.03] hover:bg-white/[0.06] border-white/[0.08] text-slate-300"
                  >
                    Cancel
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* View Dialog */}
      {viewDialogOpen && selectedCreator && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <Card className="bg-[#1A1A1A] border-white/[0.08] max-w-md w-full">
            <CardContent className="p-6">
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-lg font-semibold text-white">
                  Creator Profile
                </h3>
                <button
                  onClick={() => {
                    setViewDialogOpen(false);
                    setSelectedCreator(null);
                  }}
                  className="w-8 h-8 rounded-md hover:bg-white/[0.06] flex items-center justify-center transition-colors"
                >
                  <X className="w-4 h-4 text-slate-400" />
                </button>
              </div>
              <div className="space-y-4">
                <div className="flex items-center gap-4 pb-4 border-b border-white/[0.08]">
                  <div className="w-16 h-16 rounded-full bg-gradient-to-br from-primary to-cyan-400 flex items-center justify-center text-white font-semibold text-xl">
                    {selectedCreator.name.charAt(0)}
                  </div>
                  <div>
                    <h4 className="font-semibold text-white text-lg">
                      {selectedCreator.name}
                    </h4>
                    {(() => {
                      const platformIcon = normalizePlatform(
                        selectedCreator.platform
                      );
                      if (!platformIcon) return null;
                      return (
                        <>
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
                        </>
                      );
                    })()}
                  </div>
                </div>

                <div className="grid grid-cols-4 gap-3">
                  <div className="col-span-2 p-3 rounded-lg bg-white/[0.03]">
                    <div className="text-2xl font-semibold text-white">
                      {formatFollowers(selectedCreator.follower_count)}
                    </div>
                    <p className="text-xs text-slate-500">Followers</p>
                  </div>
                  <div className="col-span-2 p-3 rounded-lg bg-white/[0.03]">
                    <div className="text-2xl font-semibold text-emerald-400">
                      {selectedCreator.avg_engagement}%
                    </div>
                    <p className="text-xs text-slate-500">Engagement</p>
                  </div>
                  <div className="col-span-1 p-3 rounded-lg bg-white/[0.03]">
                    <div className="text-2xl font-semibold text-white">
                      {selectedCreator.campaigns}
                    </div>
                    <p className="text-xs text-slate-500">Campaigns</p>
                  </div>
                  <div className="col-span-1 p-3 rounded-lg bg-white/[0.03]">
                    <div className="text-2xl font-semibold text-white">
                      {selectedCreator.totalPosts}
                    </div>
                    <p className="text-xs text-slate-500">Posts</p>
                  </div>
                  <div className="col-span-2 p-3 rounded-lg bg-white/[0.03]">
                    <div className="text-sm font-semibold text-white truncate">
                      {selectedCreator.niche || "—"}
                    </div>
                    <p className="text-xs text-slate-500">Niche</p>
                  </div>
                </div>

                <div className="space-y-3 pt-2">
                  <div>
                    <label className="text-xs text-slate-500">Handle </label>
                    <CreatorHandleLink
                      handle={selectedCreator.handle}
                      platform={selectedCreator.platform}
                      className="mt-1 inline-block text-sm"
                    />
                  </div>
                  {activeCreatorTab === "my_network" && (
                    <>
                      {selectedCreator.email && (
                        <div>
                          <label className="text-xs text-slate-500">
                            Email
                          </label>
                          <div className="text-sm text-white mt-1">
                            {selectedCreator.email}
                          </div>
                        </div>
                      )}
                      {selectedCreator.phone && (
                        <div>
                          <label className="text-xs text-slate-500">
                            Phone
                          </label>
                          <div className="text-sm text-white mt-1">
                            {selectedCreator.phone}
                          </div>
                        </div>
                      )}
                    </>
                  )}
                </div>

                {/* Request Creator CTA - Show for All Creators */}
                {activeCreatorTab === "discover" && (
                  <div className="mt-6 pt-6 border-t border-white/[0.08]">
                    <h4 className="text-base font-semibold text-white mb-2">
                      Want to work with this creator?
                    </h4>
                    <p className="text-sm text-slate-400 mb-4">
                      Submit a request and our team will reach out and confirm
                      availability, pricing, and delivery timeline.
                    </p>
                    <button
                      onClick={() => {
                        setRequestCreatorId(selectedCreator.id);
                        setShowSingleCreatorRequestModal(true);
                        setViewDialogOpen(false);
                      }}
                      className="w-full h-9 rounded-md bg-primary hover:bg-primary/90 text-black text-sm font-medium flex items-center justify-center gap-2 transition-colors"
                    >
                      Request this creator
                    </button>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Delete Confirmation */}
      <ResponsiveConfirmDialog
        open={Boolean(deleteConfirm)}
        onOpenChange={(open) => {
          if (!open) setDeleteConfirm(null);
        }}
        title="Delete creator?"
        description="This creator will be deleted. This action cannot be undone."
        confirmLabel="Delete creator"
        confirmLoading={Boolean(deletingCreatorId)}
        onConfirm={() => {
          deleteConfirm && handleDelete(deleteConfirm);
        }}
      />

      {/* Import Creators Dialog */}
      <ImportCreatorsDialog
        open={showImportDialog}
        onClose={() => setShowImportDialog(false)}
      />

      {/* Creator Profile Modal */}
      <CreatorProfileModal
        open={showProfileModal}
        onOpenChange={setShowProfileModal}
        creator={selectedCreator as CreatorWithSocialAndStats | null}
        isFavorite={
          selectedCreator ? favoriteIds.has(selectedCreator.id) : false
        }
        onToggleFavorite={(id) => toggleFavorite.mutate(id)}
        onRequest={(c) => {
          setShowProfileModal(false);
          setRequestCreatorId(c.id);
          setShowSingleCreatorRequestModal(true);
        }}
        onAddToActivation={(c) => {
          setShowProfileModal(false);
          setSelectedCreator(c as CreatorWithStats);
          setShowSendOfferModal(true);
        }}
        onEdit={(c) => {
          setShowProfileModal(false);
          openEditDialog(c as CreatorWithStats);
        }}
        onRemove={(c) => {
          setShowProfileModal(false);
          handleDeleteRequest(c as CreatorWithStats);
        }}
        inMyNetwork={
          !!(selectedCreator && (selectedCreator as any).in_my_network)
        }
      />

      {/* Send Offer Modal */}
      <SendOfferModal
        open={showSendOfferModal}
        onOpenChange={setShowSendOfferModal}
        creator={selectedCreator as CreatorWithSocialAndStats | null}
      />

      {/* Review Request Modal */}
      <ReviewRequestModal
        open={showReviewRequestModal}
        onOpenChange={setShowReviewRequestModal}
        onContinue={() => {
          setShowReviewRequestModal(false);
          setShowChatbotModal(true);
        }}
      />

      {/* Creator Request Chatbot Modal */}
      <CreatorRequestChatbot
        open={showChatbotModal}
        onOpenChange={setShowChatbotModal}
        onComplete={() => {
          onNavigate?.("/requests");
        }}
      />

      {/* Creator Request (activation) Modal – wallet structure + form */}
      <Dialog
        open={showSingleCreatorRequestModal}
        onOpenChange={(open) => {
          setShowSingleCreatorRequestModal(open);
          if (!open) setRequestCreatorId(null);
        }}
      >
        <DialogContent className="bg-[#0D0D0D] border-white/[0.08] max-w-2xl max-h-[90vh] overflow-y-auto text-base">
          <DialogHeader>
            <DialogTitle className="text-white text-base font-semibold">
              Creator Request
            </DialogTitle>
            <DialogDescription className="text-slate-400 text-xs">
              Request creators at quoted rates. Funds lock when they accept.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-3">
            <Card className="bg-white/[0.04] border-white/[0.08]">
              <CardContent className="p-3 flex items-center justify-between">
                <div>
                  <p className="text-xs text-slate-400">Available balance</p>
                  <p className="text-base font-semibold text-white">
                    {new Intl.NumberFormat("en-NG", {
                      style: "currency",
                      currency: "NGN",
                      minimumFractionDigits: 0,
                      maximumFractionDigits: 0,
                    }).format(wallet?.balance ?? 0)}
                  </p>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setShowSingleCreatorRequestModal(false);
                    onNavigate?.("/wallet");
                  }}
                  className="border-white/[0.08] text-xs"
                >
                  Fund Wallet
                </Button>
              </CardContent>
            </Card>
            <CreatorRequestForm
              workspaceId={activeWorkspaceId}
              onSuccess={(activationId) => {
                setShowSingleCreatorRequestModal(false);
                setRequestCreatorId(null);
                onNavigate?.(`/activations/${activationId}`);
              }}
              onNavigate={(path) => {
                setShowSingleCreatorRequestModal(false);
                onNavigate?.(path);
              }}
              onBack={() => {
                setShowSingleCreatorRequestModal(false);
                setRequestCreatorId(null);
              }}
              initialCreatorIds={
                requestCreatorId ? [requestCreatorId] : undefined
              }
            />
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
