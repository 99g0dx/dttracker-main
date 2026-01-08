import React, { useState, useMemo, useEffect } from "react";
import { Card, CardContent } from "./ui/card";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import {
  Plus,
  Search,
  Users as UsersIcon,
  Lock,
  Sparkles,
  X,
  Edit2,
  Trash2,
  Eye,
  Download,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  ArrowLeft,
  Upload,
} from "lucide-react";
import { PlatformBadge } from "./platform-badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "./ui/table";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "./ui/tabs";
import { Checkbox } from "./ui/checkbox"
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
  useCreatorsWithStats,
  useCreateCreator,
  useUpdateCreator,
  useDeleteCreator,
} from "../../hooks/useCreators";
import { CampaignCreatorSelector } from "./campaign-creator-selector";
import { ImportCreatorsDialog } from "./import-creators-dialog";
import { supabase } from "../../lib/supabase";
import * as csvUtils from "../../lib/utils/csv";
import { toast } from "sonner";
import type { CreatorWithStats, Platform } from "../../lib/types/database";
import { useCart } from "../../contexts/CartContext";

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
  const [networkFilter, setNetworkFilter] = useState<"my_network" | "all">(
    "my_network"
  );
  const { data: creators = [], isLoading } =
    useCreatorsWithStats(networkFilter);
  const createCreatorMutation = useCreateCreator();
  const updateCreatorMutation = useUpdateCreator();
  const deleteCreatorMutation = useDeleteCreator();

  const [searchQuery, setSearchQuery] = useState("");
  const [selectedPlatforms, setSelectedPlatforms] = useState<Platform[]>([]);
  const [selectedNiche, setSelectedNiche] = useState<string>("all");
  const [selectedLocation, setSelectedLocation] = useState<string>("all");
  const [isPaidUser] = useState(false);
  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [viewDialogOpen, setViewDialogOpen] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
  const [selectedCreator, setSelectedCreator] =
    useState<CreatorWithStats | null>(null);
  const [showImportDialog, setShowImportDialog] = useState(false);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);



  const { cart, toggleRow, toggleAll } = useCart(); 


// Helper to toggle the current page
  // Sorting state
  const [sortField, setSortField] = useState<
    "platform" | "follower_count" | "niche" | "location" | null
  >(null);
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("asc");

  // Extract unique niches and locations for dropdown options
  const uniqueNiches = useMemo(() => {
    const niches = creators
      .map((c) => c.niche)
      .filter((niche): niche is string => !!niche && niche.trim() !== "");
    return ["all", ...Array.from(new Set(niches)).sort()];
  }, [creators]);

  const uniqueLocations = useMemo(() => {
    const locations = creators
      .map((c) => c.location)
      .filter((location): location is string => !!location && location.trim() !== "");
    return ["all", ...Array.from(new Set(locations)).sort()];
  }, [creators]);

  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 18; // 15-20 per page, using 18

  // Tab state
  const [activeTab, setActiveTab] = useState("library");

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

  // Get current user ID on mount
  useEffect(() => {
    const getCurrentUser = async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (user) {
        setCurrentUserId(user.id);
      }
    };
    getCurrentUser();
  }, []);

  // Helper function to check if user can view contact details
  const canViewContact = (creator: CreatorWithStats): boolean => {
    if (!currentUserId) return false;

    // In "My Network", show full contacts if imported by current user
    if (networkFilter === "my_network") {
      return creator.imported_by_user_id === currentUserId;
    }

    // In "All Creators", lock if not imported by current user or null
    return creator.imported_by_user_id === currentUserId;
  };

  const maskEmail = (email: string) => {
    const [username, domain] = email.split("@");
    const maskedUsername = username.charAt(0) + "****";
    return `${maskedUsername}@${domain}`;
  };

  const maskPhone = (phone: string) => {
    const cleanPhone = phone.replace(/\D/g, "");
    const visibleStart = phone.substring(0, 4);
    const visibleEnd = cleanPhone.slice(-4);
    return `${visibleStart} *** *** ${visibleEnd}`;
  };

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
    searchQuery,
    sortField,
    sortDirection,
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

  const handleUnlockContact = () => {
    alert("Upgrade to Pro to unlock full contact details");
  };

  const handleAdd = async () => {
    if (!formData.name || !formData.handle || !formData.platform) {
      toast.error("Please fill in name, handle, and platform");
      return;
    }

    try {
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
    }
  };

  const handleEdit = async () => {
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
    try {
      await deleteCreatorMutation.mutateAsync(id);
      setDeleteConfirm(null);
    } catch (error: any) {
      // Error toast is handled by the mutation
    }
  };

  const openEditDialog = (creator: CreatorWithStats) => {
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

  const handleExportCSV = () => {
    if (creators.length === 0) {
      toast.error("No creators to export");
      return;
    }

    const csvContent = csvUtils.exportCreatorsToCSV(creators);
    const filename = `creators_export_${
      new Date().toISOString().split("T")[0]
    }.csv`;
    csvUtils.downloadCSV(csvContent, filename);
    toast.success("Creators exported successfully");
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4">
        <div className="flex items-center gap-3 sm:gap-4">
          <button
            onClick={() => onNavigate?.("/")}
            className="w-9 h-9 flex-shrink-0 rounded-md bg-white/[0.03] hover:bg-white/[0.06] border border-white/[0.08] flex items-center justify-center transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>
          <div className="flex-1 min-w-0">
            <h1 className="text-xl sm:text-2xl font-semibold tracking-tight text-white">
              Creator Library
            </h1>
            <p className="text-xs sm:text-sm text-slate-400 mt-1">
              Manage your creator network and contacts
            </p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2 sm:gap-3">
          <button
            onClick={() => onNavigate?.("/creators/scraper")}
            className="flex-1 sm:flex-none min-w-[140px] h-9 px-3 rounded-md bg-white/[0.03] hover:bg-white/[0.06] border border-white/[0.08] text-sm text-slate-300 flex items-center gap-2 transition-colors justify-center"
          >
            <Sparkles className="w-4 h-4" />
            Creator Scraper
          </button>
          <button
            onClick={() => setShowImportDialog(true)}
            className="flex-1 sm:flex-none min-w-[140px] h-9 px-3 rounded-md bg-white/[0.03] hover:bg-white/[0.06] border border-white/[0.08] text-sm text-slate-300 flex items-center gap-2 transition-colors justify-center"
          >
            <Upload className="w-4 h-4" />
            Import CSV
          </button>
          <button
            onClick={handleExportCSV}
            disabled={creators.length === 0 || isLoading}
            className="flex-1 sm:flex-none min-w-[120px] h-9 px-3 rounded-md bg-white/[0.03] hover:bg-white/[0.06] border border-white/[0.08] text-sm text-slate-300 flex items-center gap-2 transition-colors justify-center disabled:opacity-50"
          >
            <Download className="w-4 h-4" />
            Export CSV
          </button>
          <button
            onClick={() => setAddDialogOpen(true)}
            className="flex-1 sm:flex-none min-w-[140px] h-9 px-4 bg-primary hover:bg-primary/90 text-[rgb(0,0,0)] text-sm font-medium flex items-center gap-2 rounded-md transition-colors justify-center"
          >
            <Plus className="w-4 h-4" />
            Add Creator
          </button>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="bg-white/[0.03] border border-white/[0.08]">
          <TabsTrigger
            value="library"
            className="data-[state=active]:bg-white/[0.06] data-[state=active]:text-white text-slate-400"
          >
            Creator Library
          </TabsTrigger>
          <TabsTrigger
            value="campaign"
            className="data-[state=active]:bg-white/[0.06] data-[state=active]:text-white text-slate-400"
          >
            Add to Campaign
          </TabsTrigger>
        </TabsList>

        <TabsContent value="library" className="space-y-4 mt-4">
          {/* Network Filter Tabs */}
          <div className="flex gap-2">
            <button
              onClick={() => setNetworkFilter("my_network")}
              className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                networkFilter === "my_network"
                  ? "bg-primary text-black"
                  : "bg-white/[0.03] hover:bg-white/[0.06] border border-white/[0.08] text-slate-300"
              }`}
            >
              My Network
            </button>
            <button
              onClick={() => setNetworkFilter("all")}
              className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                networkFilter === "all"
                  ? "bg-primary text-black"
                  : "bg-white/[0.03] hover:bg-white/[0.06] border border-white/[0.08] text-slate-300"
              }`}
            >
              All Creators
            </button>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <Card className="bg-[#0D0D0D] border-white/[0.08]">
              <CardContent className="p-4">
                <div className="text-2xl font-semibold text-white">
                  {creators.length}
                </div>
                <p className="text-sm text-slate-400 mt-1">Total Creators</p>
              </CardContent>
            </Card>
            <Card className="bg-[#0D0D0D] border-white/[0.08]">
              <CardContent className="p-4">
                <div className="text-2xl font-semibold text-primary">
                  {(
                    creators.reduce((sum, c) => sum + c.follower_count, 0) /
                    1000000
                  ).toFixed(1)}
                  M
                </div>
                <p className="text-sm text-slate-400 mt-1">Total Reach</p>
              </CardContent>
            </Card>
            <Card className="bg-[#0D0D0D] border-white/[0.08]">
              <CardContent className="p-4">
                <div className="text-2xl font-semibold text-emerald-400">
                  {creators.length > 0
                    ? (
                        creators.reduce((sum, c) => sum + c.avg_engagement, 0) /
                        creators.length
                      ).toFixed(1)
                    : 0}
                  %
                </div>
                <p className="text-sm text-slate-400 mt-1">Avg. Engagement</p>
              </CardContent>
            </Card>
            <Card className="bg-[#0D0D0D] border-white/[0.08]">
              <CardContent className="p-4">
                <div className="text-2xl font-semibold text-purple-400">
                  {creators.reduce((sum, c) => sum + c.totalPosts, 0)}
                </div>
                <p className="text-sm text-slate-400 mt-1">Total Posts</p>
              </CardContent>
            </Card>
          </div>

          {/* Search and Filters */}
          <div className="flex flex-col gap-4">
            {/* Search Box */}
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
              <Input
                placeholder="Search creators by name, handle, email, or location..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9 h-10 bg-white/[0.03] border-white/[0.08] text-white placeholder:text-slate-500"
              />
            </div>

            {/* Filters Row */}
            <div className="flex flex-wrap items-center gap-3">
              {/* Platform Multi-Select */}
              <div className="flex items-center gap-2">
                <span className="text-xs font-medium text-slate-400 uppercase tracking-wider">
                  Platform:
                </span>
                <PlatformSelect
                  selected={selectedPlatforms}
                  onChange={setSelectedPlatforms}
                />
              </div>

              {/* Niche Dropdown */}
              <div className="flex items-center gap-2">
                <span className="text-xs font-medium text-slate-400 uppercase tracking-wider">
                  Niche:
                </span>
                <select
                  value={selectedNiche}
                  onChange={(e) => setSelectedNiche(e.target.value)}
                  className="h-9 px-3 pr-8 bg-white/[0.04] border border-white/[0.1] rounded-lg text-sm text-white appearance-none cursor-pointer hover:bg-white/[0.06] focus:bg-white/[0.06] focus:border-primary/50 transition-all"
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

              {/* Location Dropdown */}
              <div className="flex items-center gap-2">
                <span className="text-xs font-medium text-slate-400 uppercase tracking-wider">
                  Location:
                </span>
                <select
                  value={selectedLocation}
                  onChange={(e) => setSelectedLocation(e.target.value)}
                  className="h-9 px-3 pr-8 bg-white/[0.04] border border-white/[0.1] rounded-lg text-sm text-white appearance-none cursor-pointer hover:bg-white/[0.06] focus:bg-white/[0.06] focus:border-primary/50 transition-all"
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

              {/* Clear Filters Button */}
              {(selectedPlatforms.length > 0 ||
                selectedNiche !== "all" ||
                selectedLocation !== "all" ||
                searchQuery) && (
                <button
                  onClick={clearAllFilters}
                  className="ml-auto h-9 px-4 bg-white/[0.04] hover:bg-white/[0.08] border border-white/[0.1] rounded-lg text-sm text-slate-400 hover:text-white transition-all"
                >
                  Clear Filters
                </button>
              )}
            </div>

            {/* Active Filters Count */}
            {(selectedPlatforms.length > 0 ||
              selectedNiche !== "all" ||
              selectedLocation !== "all") && (
              <div className="text-sm text-slate-400">
                Showing {filteredAndSortedCreators.length} of {creators.length}{" "}
                creators
                {selectedPlatforms.length > 0 &&
                  ` • ${selectedPlatforms.length} platform${
                    selectedPlatforms.length > 1 ? "s" : ""
                  }`}
                {selectedNiche !== "all" && ` • ${selectedNiche}`}
                {selectedLocation !== "all" && ` • ${selectedLocation}`}
              </div>
            )}

            {/* Sort By Row */}
            <div className="flex flex-col sm:flex-row items-start sm:items-center gap-2 sm:gap-3">
              <span className="text-sm text-slate-400 whitespace-nowrap">
                Sort by:
              </span>
              <div className="flex flex-wrap gap-1 w-full sm:w-auto">
                <button
                  onClick={() => handleSort("platform")}
                  className={`h-9 px-3 rounded-md text-sm flex items-center gap-1 transition-colors flex-shrink-0 ${
                    sortField === "platform"
                      ? "bg-primary text-black"
                      : "bg-white/[0.03] hover:bg-white/[0.06] border border-white/[0.08] text-slate-300"
                  }`}
                >
                  Platform
                  {sortField === "platform" &&
                    (sortDirection === "asc" ? (
                      <ArrowUp className="w-3 h-3" />
                    ) : (
                      <ArrowDown className="w-3 h-3" />
                    ))}
                </button>
                <button
                  onClick={() => handleSort("follower_count")}
                  className={`h-9 px-3 rounded-md text-sm flex items-center gap-1 transition-colors flex-shrink-0 ${
                    sortField === "follower_count"
                      ? "bg-primary text-black"
                      : "bg-white/[0.03] hover:bg-white/[0.06] border border-white/[0.08] text-slate-300"
                  }`}
                >
                  Followers
                  {sortField === "follower_count" &&
                    (sortDirection === "asc" ? (
                      <ArrowUp className="w-3 h-3" />
                    ) : (
                      <ArrowDown className="w-3 h-3" />
                    ))}
                </button>
                <button
                  onClick={() => handleSort("niche")}
                  className={`h-9 px-3 rounded-md text-sm flex items-center gap-1 transition-colors flex-shrink-0 ${
                    sortField === "niche"
                      ? "bg-primary text-black"
                      : "bg-white/[0.03] hover:bg-white/[0.06] border border-white/[0.08] text-slate-300"
                  }`}
                >
                  Niche
                  {sortField === "niche" &&
                    (sortDirection === "asc" ? (
                      <ArrowUp className="w-3 h-3" />
                    ) : (
                      <ArrowDown className="w-3 h-3" />
                    ))}
                </button>
                <button
                  onClick={() => handleSort("location")}
                  className={`h-9 px-3 rounded-md text-sm flex items-center gap-1 transition-colors flex-shrink-0 ${
                    sortField === "location"
                      ? "bg-primary text-black"
                      : "bg-white/[0.03] hover:bg-white/[0.06] border border-white/[0.08] text-slate-300"
                  }`}
                >
                  Location
                  {sortField === "location" &&
                    (sortDirection === "asc" ? (
                      <ArrowUp className="w-3 h-3" />
                    ) : (
                      <ArrowDown className="w-3 h-3" />
                    ))}
                </button>
              </div>
            </div>
          </div>
          {isLoading ? (
            <Card className="bg-[#0D0D0D] border-white/[0.08]">
              <CardContent className="flex flex-col items-center justify-center py-16">
                <div className="w-12 h-12 rounded-lg bg-white/[0.03] flex items-center justify-center mb-4">
                  <UsersIcon className="w-6 h-6 text-slate-600 animate-pulse" />
                </div>
                <p className="text-sm text-slate-400">Loading creators...</p>
              </CardContent>
            </Card>
          ) : filteredAndSortedCreators.length > 0 ? (
            <Card className="bg-[#0D0D0D] border-white/[0.08]">
              <CardContent className="p-0">
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow className="border-white/[0.08] hover:bg-transparent">
                      {networkFilter==="all"?
                        <TableHead className="w-[40px]">
                          <Checkbox 
                            checked={selectedIds.length === paginatedCreators.length && paginatedCreators.length > 0}
                            onCheckedChange={() => toggleAll(paginatedCreators)}
                            className="border-white/20 data-[state=checked]:bg-primary"
                          />
                        </TableHead>:""
      }
                        <TableHead className="text-slate-400 font-medium">
                          Creator
                        </TableHead>
                        <TableHead className="text-slate-400 font-medium">
                          Contact
                        </TableHead>
                        <TableHead className="text-slate-400 font-medium">
                          Platform
                        </TableHead>
                        <TableHead className="text-slate-400 font-medium">
                          Location
                        </TableHead>
                        {/* <TableHead className="text-slate-400 font-medium">
                          Agency
                        </TableHead> */}
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
                        <TableHead className="text-slate-400 font-medium text-right">
                          Actions
                        </TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {paginatedCreators.map((creator) => {
                       const isSelected = cart.some((item) => String(item.id) === String(creator.id));
                      // console.log(`Creator ID: ${creator.id} | In Cart: ${cart.map(i => i.id)} | Match: ${isSelected}`);
                       return(
                        <TableRow
                          key={creator.id}
                          className="border-white/[0.04] hover:bg-white/[0.02] transition-colors"
                        >
                        {networkFilter==="all"?  
                          <TableCell>
                            <Checkbox 
                              checked={isSelected}
                              onCheckedChange={() => toggleRow(creator)}
                              className="border-white/20 data-[state=checked]:bg-primary"
                            />
                          </TableCell>:""}
                          <TableCell>
                            <div className="font-medium text-white text-sm">
                              {creator.name}
                            </div>
                            <div className="text-xs text-slate-500 mt-0.5">
                              @{creator.handle}
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="space-y-1.5 min-w-[180px]">
                              {creator.email && (
                                <div className="flex items-center gap-2">
                                  <span
                                    className={`text-sm ${
                                      canViewContact(creator)
                                        ? "text-white"
                                        : "text-slate-400"
                                    }`}
                                  >
                                    {canViewContact(creator)
                                      ? creator.email
                                      : maskEmail(creator.email)}
                                  </span>
                                  {!canViewContact(creator) && (
                                    <Lock className="w-3.5 h-3.5 text-slate-500 flex-shrink-0" />
                                  )}
                                </div>
                              )}
                              {creator.phone && (
                                <div className="flex items-center gap-2">
                                  <span
                                    className={`text-sm ${
                                      canViewContact(creator)
                                        ? "text-white"
                                        : "text-slate-400"
                                    }`}
                                  >
                                    {canViewContact(creator)
                                      ? creator.phone
                                      : maskPhone(creator.phone)}
                                  </span>
                                  {!canViewContact(creator) && (
                                    <Lock className="w-3.5 h-3.5 text-slate-500 flex-shrink-0" />
                                  )}
                                </div>
                              )}
                              {!canViewContact(creator) &&
                                (creator.email || creator.phone) && (
                                  <button
                                    onClick={handleUnlockContact}
                                    className="text-xs text-primary hover:text-primary/80 flex items-center gap-1 mt-1.5"
                                  >
                                    <Lock className="w-3 h-3" />
                                    Unlock Contact
                                  </button>
                                )}
                              {!creator.email && !creator.phone && (
                                <span className="text-xs text-slate-500">
                                  No contact info
                                </span>
                              )}
                            </div>
                          </TableCell>
                          <TableCell>
                            <PlatformBadge platform={creator.platform} />
                          </TableCell>
                          <TableCell>
                            <span className="text-sm text-slate-300">
                              {creator.location || "-"}
                            </span>
                          </TableCell>
                          {/* <TableCell>
                            <div className="text-xs text-slate-400">
                              {creator.source_type === "scraper_extraction" &&
                                "AI Scraper"}
                              {creator.source_type === "csv_import" &&
                                "CSV Import"}
                              {creator.source_type === "manual" && "Manual"}
                              {!creator.source_type && "Manual"}
                            </div>
                          </TableCell> */}
                          <TableCell className="text-right">
                            <span className="text-white font-medium text-sm">
                              {(creator.follower_count / 1000).toFixed(0)}K
                            </span>
                          </TableCell>
                          <TableCell className="text-right text-slate-300">
                            <span className="text-sm">{creator.campaigns}</span>
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
                          <TableCell className="text-right">
                            <div className="flex items-center justify-end gap-2">
                              <button
                                onClick={() => openViewDialog(creator)}
                                className="w-8 h-8 rounded-md hover:bg-white/[0.06] flex items-center justify-center transition-colors"
                              >
                                <Eye className="w-4 h-4 text-slate-400" />
                              </button>
                              <button
                                onClick={() => openEditDialog(creator)}
                                className="w-8 h-8 rounded-md hover:bg-white/[0.06] flex items-center justify-center transition-colors"
                              >
                                <Edit2 className="w-4 h-4 text-slate-400" />
                              </button>
                              <button
                                onClick={() => setDeleteConfirm(creator.id)}
                                className="w-8 h-8 rounded-md hover:bg-red-500/10 flex items-center justify-center transition-colors"
                              >
                                <Trash2 className="w-4 h-4 text-red-400" />
                              </button>
                            </div>
                          </TableCell>
                        </TableRow>
    )})}
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
                      {Math.min(endIndex, filteredAndSortedCreators.length)} of{" "}
                      {filteredAndSortedCreators.length} creators
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
                      {Array.from({ length: totalPages }, (_, i) => i + 1).map(
                        (page) => {
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
                        }
                      )}
                      <PaginationItem>
                        <PaginationNext
                          href="#"
                          onClick={(e) => {
                            e.preventDefault();
                            setCurrentPage((p) => Math.min(totalPages, p + 1));
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
          ) : (
            <Card className="bg-[#0D0D0D] border-white/[0.08]">
              <CardContent className="flex flex-col items-center justify-center py-16">
                <div className="w-12 h-12 rounded-lg bg-white/[0.03] flex items-center justify-center mb-4">
                  <UsersIcon className="w-6 h-6 text-slate-600" />
                </div>
                <h3 className="text-base font-semibold text-white mb-1">
                  No creators found
                </h3>
                <p className="text-sm text-slate-400 text-center mb-6 max-w-md">
                  {searchQuery
                    ? "Try adjusting your search query"
                    : "Get started by adding your first creator"}
                </p>
                <div className="flex gap-3 flex-col sm:flex-row">
                  <button
                    onClick={() => onNavigate?.("/creators/scraper")}
                    className="h-9 px-3 rounded-md bg-white/[0.03] hover:bg-white/[0.06] border border-white/[0.08] text-sm text-slate-300 flex items-center gap-2 transition-colors"
                  >
                    <Sparkles className="w-4 h-4" />
                    AI Scraper
                  </button>
                  <button
                    onClick={() => setAddDialogOpen(true)}
                    className="h-9 px-4 bg-primary hover:bg-primary/90 text-black text-sm font-medium flex items-center gap-2 rounded-md transition-colors"
                    style={{
                      backgroundClip: "unset",
                      WebkitBackgroundClip: "unset",
                    }}
                  >
                    <Plus className="w-4 h-4" />
                    Add Creator
                  </button>
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="campaign" className="space-y-4 mt-4">
          <CampaignCreatorSelector onNavigate={onNavigate} />
        </TabsContent>
      </Tabs>

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
                    type="number"
                    placeholder="250000"
                    value={formData.follower_count || ""}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        follower_count: parseInt(e.target.value) || 0,
                      })
                    }
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
                    className="flex-1 h-9 bg-primary hover:bg-primary/90 text-[rgba(10,10,10,1)]"
                    style={{
                      backgroundClip: "unset",
                      WebkitBackgroundClip: "unset",
                    }}
                  >
                    {addDialogOpen ? "Add Creator" : "Save Changes"}
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
                    <PlatformBadge platform={selectedCreator.platform} />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="p-3 rounded-lg bg-white/[0.03]">
                    <div className="text-2xl font-semibold text-white">
                      {(selectedCreator.follower_count / 1000).toFixed(0)}K
                    </div>
                    <p className="text-xs text-slate-500">Followers</p>
                  </div>
                  <div className="p-3 rounded-lg bg-white/[0.03]">
                    <div className="text-2xl font-semibold text-emerald-400">
                      {selectedCreator.avg_engagement}%
                    </div>
                    <p className="text-xs text-slate-500">Engagement</p>
                  </div>
                  <div className="p-3 rounded-lg bg-white/[0.03]">
                    <div className="text-2xl font-semibold text-white">
                      {selectedCreator.campaigns}
                    </div>
                    <p className="text-xs text-slate-500">Campaigns</p>
                  </div>
                  <div className="p-3 rounded-lg bg-white/[0.03]">
                    <div className="text-2xl font-semibold text-white">
                      {selectedCreator.totalPosts}
                    </div>
                    <p className="text-xs text-slate-500">Posts</p>
                  </div>
                </div>

                <div className="space-y-3 pt-2">
                  <div>
                    <label className="text-xs text-slate-500">Handle</label>
                    <div className="text-sm text-white mt-1">
                      @{selectedCreator.handle}
                    </div>
                  </div>
                  {selectedCreator.email && (
                    <div>
                      <label className="text-xs text-slate-500">Email</label>
                      <div className="text-sm text-white mt-1 flex items-center gap-2">
                        {canViewContact(selectedCreator)
                          ? selectedCreator.email
                          : maskEmail(selectedCreator.email)}
                        {!canViewContact(selectedCreator) && (
                          <Lock className="w-3.5 h-3.5 text-slate-500" />
                        )}
                      </div>
                    </div>
                  )}
                  {selectedCreator.phone && (
                    <div>
                      <label className="text-xs text-slate-500">Phone</label>
                      <div className="text-sm text-white mt-1 flex items-center gap-2">
                        {canViewContact(selectedCreator)
                          ? selectedCreator.phone
                          : maskPhone(selectedCreator.phone)}
                        {!canViewContact(selectedCreator) && (
                          <Lock className="w-3.5 h-3.5 text-slate-500" />
                        )}
                      </div>
                    </div>
                  )}
                  {!canViewContact(selectedCreator) &&
                    (selectedCreator.email || selectedCreator.phone) && (
                      <button
                        onClick={handleUnlockContact}
                        className="w-full h-9 rounded-md bg-primary hover:bg-primary/90 text-white text-sm font-medium flex items-center justify-center gap-2 transition-colors"
                      >
                        <Lock className="w-4 h-4" />
                        Unlock Full Contact Info
                      </button>
                    )}
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Delete Confirmation */}
      {deleteConfirm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <Card className="bg-[#1A1A1A] border-white/[0.08] max-w-md w-full">
            <CardContent className="p-6">
              <h3 className="text-lg font-semibold text-white mb-2">
                Delete Creator
              </h3>
              <p className="text-sm text-slate-400 mb-6">
                Are you sure you want to delete this creator? This action cannot
                be undone.
              </p>
              <div className="flex gap-3">
                <Button
                  onClick={() => deleteConfirm && handleDelete(deleteConfirm)}
                  className="flex-1 h-9 bg-red-500 hover:bg-red-500/90 text-white"
                >
                  Delete
                </Button>
                <Button
                  onClick={() => setDeleteConfirm(null)}
                  variant="outline"
                  className="flex-1 h-9 bg-white/[0.03] hover:bg-white/[0.06] border-white/[0.08] text-slate-300"
                >
                  Cancel
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Import Creators Dialog */}
      <ImportCreatorsDialog
        open={showImportDialog}
        onClose={() => setShowImportDialog(false)}
      />
    </div>
  );
}
