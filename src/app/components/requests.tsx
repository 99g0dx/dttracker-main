"use client";

import React, { useState, useMemo, useEffect, useRef } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Card, CardContent } from "./ui/card";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { RequestRowSkeleton, Skeleton } from "./ui/skeleton";
import {
  Search,
  Filter,
  ArrowLeft,
  Eye,
  Calendar,
  Users,
  CheckCircle2,
  Clock,
  FileText,
  DollarSign,
  Trash2,
} from "lucide-react";
import {
  PlatformIcon,
  normalizePlatform,
  getPlatformLabel,
} from "./ui/PlatformIcon";
import {
  useCreatorRequests,
  useCreatorRequestWithItems,
  useDeleteCreatorRequest,
  useRespondToCreatorQuote,
  creatorRequestsKeys,
} from "../../hooks/useCreatorRequests";
import { useCampaigns } from "../../hooks/useCampaigns";
import type {
  CreatorRequest,
  CreatorRequestInsert,
  CreatorRequestStatus,
} from "../../lib/types/database";
import { format, parseISO } from "date-fns";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "./ui/dialog";
import { ResponsiveConfirmDialog } from "./ui/responsive-confirm-dialog";
import { useWorkspaceAccess } from "../../hooks/useWorkspaceAccess";
import { supabase } from "../../lib/supabase";
import { useAuth } from "../../contexts/AuthContext";
import { CreatorRequestChatbot } from "./creator-request-chatbot";
import * as creatorRequestsApi from "../../lib/api/creator-requests";

interface RequestsProps {
  onNavigate?: (path: string) => void;
}

const statusConfig: Record<
  CreatorRequestStatus,
  { label: string; color: string; bgColor: string; icon: React.ReactNode }
> = {
  suggested: {
    label: "Owner Approval Pending",
    color: "text-amber-700 dark:text-amber-400",
    bgColor:
      "bg-amber-100/70 dark:bg-amber-400/10 border-amber-200 dark:border-amber-400/20",
    icon: <FileText className="w-4 h-4" />,
  },
  submitted: {
    label: "Submitted",
    color: "text-red-700 dark:text-blue-400",
    bgColor:
      "bg-red-100/70 dark:bg-blue-400/10 border-red-200 dark:border-blue-400/20",
    icon: <FileText className="w-4 h-4" />,
  },
  reviewing: {
    label: "Reviewing",
    color: "text-yellow-700 dark:text-yellow-400",
    bgColor:
      "bg-yellow-100/70 dark:bg-yellow-400/10 border-yellow-200 dark:border-yellow-400/20",
    icon: <Clock className="w-4 h-4" />,
  },
  quoted: {
    label: "Quoted",
    color: "text-purple-700 dark:text-purple-400",
    bgColor:
      "bg-purple-100/70 dark:bg-purple-400/10 border-purple-200 dark:border-purple-400/20",
    icon: <DollarSign className="w-4 h-4" />,
  },
  approved: {
    label: "Approved",
    color: "text-green-700 dark:text-green-400",
    bgColor:
      "bg-green-100/70 dark:bg-green-400/10 border-green-200 dark:border-green-400/20",
    icon: <CheckCircle2 className="w-4 h-4" />,
  },
  in_fulfillment: {
    label: "In Fulfillment",
    color: "text-indigo-700 dark:text-indigo-400",
    bgColor:
      "bg-indigo-100/70 dark:bg-indigo-400/10 border-indigo-200 dark:border-indigo-400/20",
    icon: <Clock className="w-4 h-4" />,
  },
  delivered: {
    label: "Delivered",
    color: "text-emerald-700 dark:text-emerald-400",
    bgColor:
      "bg-emerald-100/70 dark:bg-emerald-400/10 border-emerald-200 dark:border-emerald-400/20",
    icon: <CheckCircle2 className="w-4 h-4" />,
  },
};

function formatQuoteAmount(
  cents: number | null | undefined,
  currency: string | null | undefined
): string | null {
  if (cents === null || cents === undefined) return null;
  const amount = cents / 100;
  const code = (currency || "NGN").toUpperCase();
  const locale = code === "NGN" ? "en-NG" : "en-US";
  const maxFraction = code === "NGN" ? 0 : 2;

  try {
    return new Intl.NumberFormat(locale, {
      style: "currency",
      currency: code,
      maximumFractionDigits: maxFraction,
    }).format(amount);
  } catch {
    return `${code} ${amount.toFixed(2)}`;
  }
}

export function Requests({ onNavigate }: RequestsProps) {
  const queryClient = useQueryClient();
  const { data: requests = [], isLoading, isFetching } = useCreatorRequests();
  const deleteRequestMutation = useDeleteCreatorRequest();
  const { isOwner } = useWorkspaceAccess();
  const { user } = useAuth();
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<
    CreatorRequestStatus | "all"
  >("all");
  const [selectedRequest, setSelectedRequest] = useState<CreatorRequest | null>(
    null
  );
  const [viewDialogOpen, setViewDialogOpen] = useState(false);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [campaignName, setCampaignName] = useState<string | null>(null);
  const [campaignNames, setCampaignNames] = useState<Record<string, string>>(
    {}
  );
  const [requesterNames, setRequesterNames] = useState<Record<string, string>>(
    {}
  );
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [editRequestId, setEditRequestId] = useState<string | null>(null);
  const [editInitialCreators, setEditInitialCreators] = useState<string[]>([]);
  const [editInitialForm, setEditInitialForm] = useState<
    Partial<CreatorRequestInsert> | undefined
  >(undefined);
  const desktopTableRef = useRef<HTMLDivElement | null>(null);
  const [desktopTableHeight, setDesktopTableHeight] = useState(0);
  const [desktopTableScrollTop, setDesktopTableScrollTop] = useState(0);
  const desktopRowHeight = 60;
  const mobileListRef = useRef<HTMLDivElement | null>(null);
  const [mobileListHeight, setMobileListHeight] = useState(0);
  const [mobileListScrollTop, setMobileListScrollTop] = useState(0);
  const mobileRowHeight = 180;
  const virtualizationEnabled =
    typeof window !== "undefined"
      ? localStorage.getItem("disable_virtualization") !== "1"
      : true;
  const { data: campaigns = [] } = useCampaigns();
  const campaignsById = useMemo(
    () =>
      campaigns.reduce<Record<string, string>>((acc, campaign) => {
        acc[campaign.id] = campaign.name;
        return acc;
      }, {}),
    [campaigns]
  );

  const { data: requestDetails } = useCreatorRequestWithItems(
    selectedRequest?.id || ""
  );
  const respondToQuoteMutation = useRespondToCreatorQuote();

  const prefetchRequestDetail = (requestId: string) => {
    queryClient.prefetchQuery({
      queryKey: creatorRequestsKeys.detailWithItems(requestId),
      queryFn: async () => {
        const result = await creatorRequestsApi.getRequestWithItems(requestId);
        if (result.error) {
          throw result.error;
        }
        return result.data;
      },
      staleTime: 60 * 1000,
      gcTime: 10 * 60 * 1000,
    });
  };

  useEffect(() => {
    setCampaignNames(campaignsById);
  }, [campaignsById]);

  useEffect(() => {
    const loadRequesters = async () => {
      const userIds = Array.from(
        new Set(requests.map((request) => request.user_id).filter(Boolean))
      );
      if (userIds.length === 0) {
        setRequesterNames({});
        return;
      }

      const { data, error } = await supabase
        .from("profiles")
        .select("id, full_name, email")
        .in("id", userIds);

      if (error || !data) {
        setRequesterNames({});
        return;
      }

      const map = data.reduce<Record<string, string>>((acc, profile) => {
        acc[profile.id] = profile.full_name || profile.email || "Unknown";
        return acc;
      }, {});
      setRequesterNames(map);
    };

    loadRequesters();
  }, [requests]);

  useEffect(() => {
    if (viewDialogOpen) {
      if (!requestDetails?.campaign_id) {
        setCampaignName(null);
      } else {
        setCampaignName(
          campaignsById[requestDetails.campaign_id] ||
            requestDetails.campaign_id
        );
      }
    }
  }, [viewDialogOpen, requestDetails?.campaign_id, campaignsById]);

  const indexedRequests = useMemo(() => {
    return requests.map((req) => {
      const searchText = [
        req.campaign_type,
        req.campaign_brief,
        req.contact_person_name,
        req.contact_person_email,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return {
        req,
        searchText,
        createdAtValue: parseISO(req.created_at).getTime(),
      };
    });
  }, [requests]);

  // Filter and sort requests
  const filteredRequests = useMemo(() => {
    let filtered = indexedRequests;
    const query = searchQuery.trim().toLowerCase();

    if (query) {
      filtered = filtered.filter((entry) => entry.searchText.includes(query));
    }

    if (statusFilter !== "all") {
      filtered = filtered.filter((entry) => entry.req.status === statusFilter);
    }

    return filtered
      .sort((a, b) => b.createdAtValue - a.createdAtValue)
      .map((entry) => entry.req);
  }, [indexedRequests, searchQuery, statusFilter]);

  const shouldVirtualizeTable =
    virtualizationEnabled && filteredRequests.length > 300;
  const shouldVirtualizeMobile =
    virtualizationEnabled && filteredRequests.length > 300;
  const showRefreshShimmer = isFetching && !isLoading;

  useEffect(() => {
    if (!shouldVirtualizeTable || !desktopTableRef.current) return;
    const node = desktopTableRef.current;
    const updateHeight = () => setDesktopTableHeight(node.clientHeight);
    updateHeight();
    const observer = new ResizeObserver(updateHeight);
    observer.observe(node);
    return () => observer.disconnect();
  }, [shouldVirtualizeTable, filteredRequests.length]);

  useEffect(() => {
    if (!shouldVirtualizeMobile || !mobileListRef.current) return;
    const node = mobileListRef.current;
    const updateHeight = () => setMobileListHeight(node.clientHeight);
    updateHeight();
    const observer = new ResizeObserver(updateHeight);
    observer.observe(node);
    return () => observer.disconnect();
  }, [shouldVirtualizeMobile, filteredRequests.length]);

  useEffect(() => {
    if (!shouldVirtualizeTable) return;
    setDesktopTableScrollTop(0);
    desktopTableRef.current?.scrollTo({ top: 0 });
  }, [shouldVirtualizeTable, searchQuery, statusFilter]);

  useEffect(() => {
    if (!shouldVirtualizeMobile) return;
    setMobileListScrollTop(0);
    mobileListRef.current?.scrollTo({ top: 0 });
  }, [shouldVirtualizeMobile, searchQuery, statusFilter]);

  const desktopVirtualWindow = useMemo(() => {
    if (!shouldVirtualizeTable) {
      return {
        items: filteredRequests,
        paddingTop: 0,
        paddingBottom: 0,
        startIndex: 0,
      };
    }
    const total = filteredRequests.length;
    const visibleCount = Math.ceil(desktopTableHeight / desktopRowHeight) + 8;
    const startIndex = Math.max(
      0,
      Math.floor(desktopTableScrollTop / desktopRowHeight) - 4
    );
    const endIndex = Math.min(total, startIndex + visibleCount);
    return {
      items: filteredRequests.slice(startIndex, endIndex),
      paddingTop: startIndex * desktopRowHeight,
      paddingBottom: Math.max(
        0,
        total * desktopRowHeight - endIndex * desktopRowHeight
      ),
      startIndex,
    };
  }, [
    shouldVirtualizeTable,
    filteredRequests,
    desktopTableHeight,
    desktopTableScrollTop,
  ]);

  const mobileVirtualWindow = useMemo(() => {
    if (!shouldVirtualizeMobile) {
      return {
        items: filteredRequests,
        paddingTop: 0,
        paddingBottom: 0,
        startIndex: 0,
      };
    }
    const total = filteredRequests.length;
    const visibleCount = Math.ceil(mobileListHeight / mobileRowHeight) + 6;
    const startIndex = Math.max(
      0,
      Math.floor(mobileListScrollTop / mobileRowHeight) - 3
    );
    const endIndex = Math.min(total, startIndex + visibleCount);
    return {
      items: filteredRequests.slice(startIndex, endIndex),
      paddingTop: startIndex * mobileRowHeight,
      paddingBottom: Math.max(
        0,
        total * mobileRowHeight - endIndex * mobileRowHeight
      ),
      startIndex,
    };
  }, [
    shouldVirtualizeMobile,
    filteredRequests,
    mobileListHeight,
    mobileListScrollTop,
  ]);

  const openViewDialog = (request: CreatorRequest) => {
    setSelectedRequest(request);
    setViewDialogOpen(true);
  };

  const openEditSuggestion = async (requestId: string) => {
    setViewDialogOpen(false);
    const { data, error } = await supabase
      .from("creator_requests")
      .select(
        `
        id,
        campaign_id,
        campaign_type,
        campaign_brief,
        song_asset_links,
        deliverables,
        posts_per_creator,
        usage_rights,
        deadline,
        urgency,
        contact_person_name,
        contact_person_email,
        contact_person_phone,
        suggestion_reason,
        creator_request_items(creator_id)
      `
      )
      .eq("id", requestId)
      .single();

    if (error || !data) return;

    setEditRequestId(requestId);
    setEditInitialCreators(
      (data.creator_request_items || [])
        .map((item: any) => item.creator_id)
        .filter(Boolean)
    );
    setEditInitialForm({
      campaign_id: data.campaign_id,
      campaign_type: data.campaign_type,
      campaign_brief: data.campaign_brief,
      song_asset_links: data.song_asset_links,
      deliverables: data.deliverables,
      posts_per_creator: data.posts_per_creator,
      usage_rights: data.usage_rights,
      deadline: data.deadline,
      urgency: data.urgency,
      contact_person_name: data.contact_person_name,
      contact_person_email: data.contact_person_email,
      contact_person_phone: data.contact_person_phone,
      suggestion_reason: data.suggestion_reason,
    });
    setEditDialogOpen(true);
  };

  const handleDeleteRequest = async (id: string) => {
    try {
      await deleteRequestMutation.mutateAsync(id);
      setDeleteConfirmId(null);
      // Close view dialog if the deleted request was being viewed
      if (selectedRequest?.id === id) {
        setViewDialogOpen(false);
        setSelectedRequest(null);
      }
    } catch (error) {
      // Error toast is handled by the mutation
    }
  };

  const statusCounts = useMemo(() => {
    const counts: Record<CreatorRequestStatus, number> = {
      suggested: 0,
      submitted: 0,
      reviewing: 0,
      quoted: 0,
      approved: 0,
      in_fulfillment: 0,
      delivered: 0,
    };
    requests.forEach((req) => {
      counts[req.status]++;
    });
    return counts;
  }, [requests]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 sm:gap-6">
        <div className="flex items-center gap-3 sm:gap-4">
          <button
            onClick={() => onNavigate?.("/")}
            className="w-11 h-11 min-h-[44px] flex-shrink-0 rounded-md bg-muted/60 hover:bg-muted active:bg-muted border border-border flex items-center justify-center transition-colors"
            aria-label="Back to dashboard"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>
          <div>
            <h1 className="text-2xl sm:text-3xl lg:text-4xl font-semibold tracking-tight text-foreground">
              Creator Requests
            </h1>
            <p className="text-sm sm:text-base text-muted-foreground mt-1 sm:mt-2">
              Track your creator requests and their status
            </p>
          </div>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:gap-5 sm:grid-cols-3 lg:grid-cols-6">
        {Object.entries(statusConfig).map(([status, config]) => (
          <Card
            key={status}
            className="bg-card border-border rounded-xl overflow-hidden cursor-pointer active:bg-muted/70 transition-colors"
            style={{ boxShadow: "var(--shadow-card)" }}
            onClick={() =>
              setStatusFilter(
                statusFilter === status
                  ? "all"
                  : (status as CreatorRequestStatus)
              )
            }
          >
            <CardContent className="p-3 min-[400px]:p-4">
              <div className="flex flex-wrap items-center gap-2 sm:gap-3">
                <div
                  className={`w-[34px] h-9 sm:w-10 sm:h-10 rounded-lg ${config.bgColor} border flex items-center justify-center ${config.color}`}
                >
                  {config.icon}
                </div>
                <div>
                  <p className="text-xl sm:text-2xl font-semibold tracking-tight text-foreground">
                    {statusCounts[status as CreatorRequestStatus]}
                  </p>
                  <p className="text-[10px] min-[400px]:text-xs text-muted-foreground truncate">
                    {config.label}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Filters */}
      <Card
        className="bg-card border-border rounded-xl overflow-hidden"
        style={{ boxShadow: "var(--shadow-card)" }}
      >
        <CardContent className="p-4 sm:p-5">
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                type="search"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search requests..."
                className="pl-9 h-10 sm:h-9 bg-muted/60 border-border text-foreground placeholder:text-muted-foreground"
              />
            </div>
            <div className="flex items-center gap-2">
              <Filter className="w-4 h-4 text-muted-foreground" />
              <select
                value={statusFilter}
                onChange={(e) =>
                  setStatusFilter(
                    e.target.value as CreatorRequestStatus | "all"
                  )
                }
                className="flex flex-wrap w-[117px] h-10 sm:h-9 px-3 pr-8 bg-muted/60 border border-border rounded-lg text-[10px] text-foreground appearance-none cursor-pointer hover:bg-muted focus:bg-muted focus:border-primary/50 transition-all"
              >
                <option value="all">All Status</option>
                {Object.entries(statusConfig).map(([status, config]) => (
                  <option key={status} value={status}>
                    {config.label}
                  </option>
                ))}
              </select>
            </div>
            <div className="hidden sm:flex items-center gap-2 text-xs text-muted-foreground">
              <span className="rounded-full border border-border px-2 py-1">
                Owner Approval
              </span>
              <span className="w-[139px] h-[35px]">
                Pending suggestions require approval.
              </span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Requests List */}
      {isLoading ? (
        <Card className="bg-card border-border">
          <CardContent className="p-4 space-y-4">
            <div className="flex items-center justify-between">
              <Skeleton className="h-4 w-28" />
              <Skeleton className="h-4 w-20" />
            </div>
            <div className="space-y-3">
              {Array.from({ length: 5 }).map((_, i) => (
                <RequestRowSkeleton key={i} />
              ))}
            </div>
          </CardContent>
        </Card>
      ) : filteredRequests.length === 0 ? (
        <Card className="bg-card border-border">
          <CardContent className="p-8 text-center">
            <p className="text-muted-foreground">
              {searchQuery || statusFilter !== "all"
                ? "No requests found matching your filters."
                : "No requests yet. Create your first request from the Creator Library."}
            </p>
          </CardContent>
        </Card>
      ) : (
        <>
          <div
            ref={mobileListRef}
            onScroll={(event) => {
              if (!shouldVirtualizeMobile) return;
              setMobileListScrollTop(event.currentTarget.scrollTop);
            }}
            className={`lg:hidden space-y-4 ${
              shouldVirtualizeMobile
                ? "max-h-[70vh] overflow-auto space-y-0"
                : ""
            }`}
          >
            {showRefreshShimmer && (
              <div className="sticky top-0 z-10">
                <Skeleton className="h-1 w-full rounded-none bg-muted" />
              </div>
            )}
            {mobileVirtualWindow.paddingTop > 0 && (
              <div style={{ height: mobileVirtualWindow.paddingTop }} />
            )}
            {mobileVirtualWindow.items.map((request, index) => {
              const status = statusConfig[request.status];
              const requesterLabel =
                requesterNames[request.user_id] || "Unknown";
              const ownerApproval =
                request.submission_type === "suggestion" &&
                request.status === "suggested"
                  ? "Pending"
                  : "Approved";
              const ownerApprovalTone =
                ownerApproval === "Pending"
                  ? "bg-amber-100/70 dark:bg-amber-400/10 text-amber-700 dark:text-amber-400 border-amber-200 dark:border-amber-400/20"
                  : "bg-emerald-100/70 dark:bg-emerald-400/10 text-emerald-700 dark:text-emerald-400 border-emerald-200 dark:border-emerald-400/20";
              const canDelete =
                isOwner ||
                (request.user_id === user?.id &&
                  request.submission_type === "suggestion" &&
                  request.status === "suggested");
              return (
                <Card
                  key={
                    shouldVirtualizeMobile
                      ? `${request.id}-${mobileVirtualWindow.startIndex + index}`
                      : request.id
                  }
                  className="bg-card border-border rounded-xl overflow-hidden active:bg-muted/70 transition-colors cursor-pointer"
                  style={{ boxShadow: "var(--shadow-card)" }}
                  onMouseEnter={() => prefetchRequestDetail(request.id)}
                  onClick={() => openViewDialog(request)}
                >
                  <CardContent className="p-4 min-[400px]:p-5 space-y-3">
                    <div className="flex items-center gap-2 flex-wrap">
                      <div
                        className={`px-3 py-1 rounded-full border ${status.bgColor} ${status.color} flex items-center gap-1.5 text-xs font-medium`}
                      >
                        {status.icon}
                        {status.label}
                      </div>
                      <span className="text-xs text-muted-foreground capitalize">
                        {request.campaign_type?.replace("_", " ") || "N/A"}
                      </span>
                      <span
                        className={`ml-auto inline-flex items-center rounded-full border px-2.5 py-0.5 text-[11px] font-medium ${ownerApprovalTone}`}
                      >
                        Owner approval {ownerApproval.toLowerCase()}
                      </span>
                    </div>
                    {request.campaign_brief && (
                      <p className="text-sm text-foreground line-clamp-3 break-words">
                        {request.campaign_brief}
                      </p>
                    )}
                    <div className="flex flex-wrap gap-3 text-xs text-muted-foreground">
                      <span className="flex items-center gap-1.5">
                        <Calendar className="w-3.5 h-3.5" />
                        {format(parseISO(request.created_at), "MMM d, yyyy")}
                      </span>
                      <span className="flex items-center gap-1.5">
                        <Users className="w-3.5 h-3.5" />
                        {requesterLabel}
                      </span>
                      {request.campaign_id && (
                        <span className="flex items-center gap-1.5">
                          <FileText className="w-3.5 h-3.5" />
                          {campaignNames[request.campaign_id] || "Campaign"}
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      {isOwner && request.status === "suggested" && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={async (e) => {
                            e.stopPropagation();
                            await openEditSuggestion(request.id);
                          }}
                          className="border-emerald-200 dark:border-emerald-400/30 bg-emerald-100/70 dark:bg-emerald-500/10 hover:bg-emerald-200/80 dark:hover:bg-emerald-500/20 text-emerald-700 dark:text-emerald-400"
                        >
                          Edit &amp; Send
                        </Button>
                      )}
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={(e) => {
                          e.stopPropagation();
                          openViewDialog(request);
                        }}
                        className="border-border bg-muted/60 hover:bg-muted text-foreground"
                      >
                        View
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={(e) => {
                          e.stopPropagation();
                          if (canDelete) {
                            setDeleteConfirmId(request.id);
                          }
                        }}
                        className={`border-red-200 dark:border-red-500/30 bg-red-100/70 dark:bg-red-500/10 text-red-700 dark:text-red-400 ${
                          canDelete
                            ? "hover:bg-red-200/80 dark:hover:bg-red-500/20"
                            : "opacity-40 cursor-not-allowed"
                        }`}
                        disabled={deleteRequestMutation.isPending || !canDelete}
                        aria-label="Delete request"
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
            {mobileVirtualWindow.paddingBottom > 0 && (
              <div style={{ height: mobileVirtualWindow.paddingBottom }} />
            )}
          </div>
          <Card className="hidden lg:block bg-card border-border">
            <CardContent className="p-0">
              <div
                ref={desktopTableRef}
                onScroll={(event) => {
                  if (!shouldVirtualizeTable) return;
                  setDesktopTableScrollTop(event.currentTarget.scrollTop);
                }}
                className="max-h-[560px] overflow-auto"
              >
                {showRefreshShimmer && (
                  <div className="sticky top-0 z-10">
                    <Skeleton className="h-1 w-full rounded-none bg-muted" />
                  </div>
                )}
                <table className="min-w-[860px] w-full text-sm">
                  <thead className="sticky top-0 z-10 bg-muted/60 text-muted-foreground">
                    <tr>
                      <th className="text-left px-4 py-3 font-medium">
                        Status
                      </th>
                      <th className="text-left px-4 py-3 font-medium">
                        Campaign
                      </th>
                      <th className="text-left px-4 py-3 font-medium">
                        Requester
                      </th>
                      <th className="text-left px-4 py-3 font-medium">
                        Owner Approval
                      </th>
                      <th className="text-left px-4 py-3 font-medium">
                        Created
                      </th>
                      <th className="text-right px-4 py-3 font-medium">
                        Actions
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {desktopVirtualWindow.paddingTop > 0 && (
                      <tr>
                        <td
                          colSpan={6}
                          style={{ height: desktopVirtualWindow.paddingTop }}
                        />
                      </tr>
                    )}
                    {desktopVirtualWindow.items.map((request, index) => {
                      const status = statusConfig[request.status];
                      const requesterLabel =
                        requesterNames[request.user_id] || "Unknown";
                      const ownerApproval =
                        request.submission_type === "suggestion" &&
                        request.status === "suggested"
                          ? "Pending"
                          : "Approved";
                      const ownerApprovalTone =
                        ownerApproval === "Pending"
                          ? "bg-amber-100/70 dark:bg-amber-400/10 text-amber-700 dark:text-amber-400 border-amber-200 dark:border-amber-400/20"
                          : "bg-emerald-100/70 dark:bg-emerald-400/10 text-emerald-700 dark:text-emerald-400 border-emerald-200 dark:border-emerald-400/20";
                      const canDelete =
                        isOwner ||
                        (request.user_id === user?.id &&
                          request.submission_type === "suggestion" &&
                          request.status === "suggested");
                      const rowKey = shouldVirtualizeTable
                        ? `${request.id}-${desktopVirtualWindow.startIndex + index}`
                        : request.id;
                      return (
                        <tr
                          key={rowKey}
                          className="border-t border-border hover:bg-muted/60 cursor-pointer"
                          onMouseEnter={() => prefetchRequestDetail(request.id)}
                          onClick={() => openViewDialog(request)}
                        >
                          <td className="px-4 py-3">
                            <div
                              className={`inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-medium ${status.bgColor} ${status.color}`}
                            >
                              {status.label}
                            </div>
                          </td>
                          <td className="px-4 py-3">
                            <div className="text-foreground">
                              {campaignNames[request.campaign_id || ""] ||
                                "Campaign"}
                            </div>
                            <div className="text-xs text-muted-foreground capitalize">
                              {request.campaign_type?.replace("_", " ") ||
                                "N/A"}
                            </div>
                          </td>
                          <td className="px-4 py-3 text-foreground">
                            {requesterLabel}
                          </td>
                          <td className="px-4 py-3">
                            <span
                              className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium ${ownerApprovalTone}`}
                            >
                              {ownerApproval}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-muted-foreground">
                            {format(
                              parseISO(request.created_at),
                              "MMM d, yyyy"
                            )}
                          </td>
                          <td className="px-4 py-3">
                            <div className="flex items-center justify-end gap-2">
                              {isOwner && request.status === "suggested" && (
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={async (e) => {
                                    e.stopPropagation();
                                    await openEditSuggestion(request.id);
                                  }}
                                  className="border-emerald-200 dark:border-emerald-400/30 bg-emerald-100/70 dark:bg-emerald-500/10 hover:bg-emerald-200/80 dark:hover:bg-emerald-500/20 text-emerald-700 dark:text-emerald-400"
                                >
                                  Edit &amp; Send
                                </Button>
                              )}
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  openViewDialog(request);
                                }}
                                className="border-border bg-muted/60 hover:bg-muted text-foreground"
                              >
                                View
                              </Button>
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  if (canDelete) {
                                    setDeleteConfirmId(request.id);
                                  }
                                }}
                                className={`border-red-200 dark:border-red-500/30 bg-red-100/70 dark:bg-red-500/10 text-red-700 dark:text-red-400 ${
                                  canDelete
                                    ? "hover:bg-red-200/80 dark:hover:bg-red-500/20"
                                    : "opacity-40 cursor-not-allowed"
                                }`}
                                disabled={
                                  deleteRequestMutation.isPending || !canDelete
                                }
                                aria-label="Delete request"
                              >
                                <Trash2 className="w-4 h-4" />
                              </Button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                    {desktopVirtualWindow.paddingBottom > 0 && (
                      <tr>
                        <td
                          colSpan={6}
                          style={{ height: desktopVirtualWindow.paddingBottom }}
                        />
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </>
      )}

      {/* Request Detail Dialog */}
      <Dialog open={viewDialogOpen} onOpenChange={setViewDialogOpen}>
        <DialogContent className="w-[92vw] max-w-3xl max-h-[85vh] overflow-hidden flex flex-col bg-card border-border rounded-xl top-[50%] left-[50%] right-auto bottom-auto translate-x-[-50%] translate-y-[-50%] p-5 sm:p-6">
          <DialogHeader>
            <div className="flex items-start justify-between gap-4">
              <div className="flex-1 min-w-0">
                <DialogTitle className="text-xl sm:text-2xl font-semibold text-foreground">
                  Request Details
                </DialogTitle>
                <DialogDescription className="text-sm text-muted-foreground mt-1">
                  {selectedRequest && (
                    <>
                      Status:{" "}
                      <span
                        className={`${statusConfig[selectedRequest.status].color} font-medium`}
                      >
                        {statusConfig[selectedRequest.status].label}
                      </span>
                    </>
                  )}
                </DialogDescription>
              </div>
              {selectedRequest && (
                <div className="flex items-center gap-2 mr-10 sm:mr-12 flex-shrink-0">
                  {isOwner && selectedRequest.status === "suggested" && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={async () => {
                        await openEditSuggestion(selectedRequest.id);
                      }}
                      className="h-9 sm:h-10 min-h-[36px] px-3 sm:px-4 border-emerald-200 dark:border-emerald-400/30 bg-emerald-100/70 dark:bg-emerald-500/10 hover:bg-emerald-200/80 dark:hover:bg-emerald-500/20 text-emerald-700 dark:text-emerald-400 flex items-center gap-2"
                    >
                      <CheckCircle2 className="w-4 h-4" />
                      <span className="hidden sm:inline">Edit & Send</span>
                    </Button>
                  )}
                  {(() => {
                    const canDeleteSelected =
                      isOwner ||
                      (selectedRequest.user_id === user?.id &&
                        selectedRequest.submission_type === "suggestion" &&
                        selectedRequest.status === "suggested");
                    return (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          if (!canDeleteSelected) return;
                          setViewDialogOpen(false);
                          setDeleteConfirmId(selectedRequest.id);
                        }}
                        className={`h-9 sm:h-10 min-h-[36px] px-3 sm:px-4 border-red-200 dark:border-red-500/30 bg-red-100/70 dark:bg-red-500/10 text-red-700 dark:text-red-400 flex items-center gap-2 ${
                          canDeleteSelected
                            ? "hover:bg-red-200/80 dark:hover:bg-red-500/20"
                            : "opacity-40 cursor-not-allowed"
                        }`}
                        disabled={
                          deleteRequestMutation.isPending || !canDeleteSelected
                        }
                      >
                        <Trash2 className="w-4 h-4" />
                        <span className="hidden sm:inline">Delete</span>
                      </Button>
                    );
                  })()}
                </div>
              )}
            </div>
          </DialogHeader>

          {requestDetails && (
            <div className="flex-1 overflow-y-auto space-y-4 sm:space-y-6 py-4 px-1 sm:px-0">
              {/* Campaign Information */}
              <section className="space-y-3">
                <h3 className="text-base sm:text-lg font-semibold text-foreground">
                  Campaign Information
                </h3>
                <div
                  className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4 p-4 sm:p-5 rounded-xl bg-card border border-border"
                  style={{ boxShadow: "inset 0 1px 2px rgba(0, 0, 0, 0.1)" }}
                >
                  <div>
                    <p className="text-xs text-muted-foreground mb-1.5">
                      Campaign Type
                    </p>
                    <p className="text-sm text-foreground capitalize font-medium">
                      {requestDetails.campaign_type?.replace("_", " ") || "N/A"}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground mb-1.5">
                      Linked Campaign
                    </p>
                    <p className="text-sm text-foreground font-medium">
                      {campaignName || "Not linked"}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground mb-1.5">
                      Owner Approval
                    </p>
                    <p className="text-sm text-foreground font-medium">
                      {requestDetails.submission_type === "suggestion" &&
                      requestDetails.status === "suggested"
                        ? "Pending"
                        : "Approved"}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground mb-1.5">
                      Requested By
                    </p>
                    <p className="text-sm text-foreground font-medium">
                      {requesterNames[requestDetails.user_id] || "Unknown"}
                    </p>
                  </div>
                  {requestDetails.deadline && (
                    <div>
                      <p className="text-xs text-muted-foreground mb-1.5">Deadline</p>
                      <p className="text-sm text-foreground font-medium">
                        {format(
                          parseISO(requestDetails.deadline),
                          "MMM d, yyyy"
                        )}
                      </p>
                    </div>
                  )}
                  {requestDetails.urgency && (
                    <div>
                      <p className="text-xs text-muted-foreground mb-1.5">Urgency</p>
                      <p className="text-sm text-foreground capitalize font-medium">
                        {requestDetails.urgency.replace("_", " ")}
                      </p>
                    </div>
                  )}
                  {requestDetails.posts_per_creator && (
                    <div>
                      <p className="text-xs text-muted-foreground mb-1.5">
                        Posts per Creator
                      </p>
                      <p className="text-sm text-foreground font-medium">
                        {requestDetails.posts_per_creator}
                      </p>
                    </div>
                  )}
                </div>
              </section>

              {/* Campaign Brief */}
              {requestDetails.campaign_brief && (
                <section className="space-y-3">
                  <h3 className="text-base sm:text-lg font-semibold text-foreground">
                    Campaign Brief
                  </h3>
                  <div
                    className="p-4 sm:p-5 rounded-xl bg-card border border-border"
                    style={{ boxShadow: "inset 0 1px 2px rgba(0, 0, 0, 0.1)" }}
                  >
                    <p className="text-sm text-foreground whitespace-pre-wrap leading-relaxed">
                      {requestDetails.campaign_brief}
                    </p>
                  </div>
                </section>
              )}

              {/* Operator Briefing */}
              {requestDetails.suggestion_reason && (
                <section className="space-y-3">
                  <h3 className="text-base sm:text-lg font-semibold text-foreground">
                    Operator Briefing
                  </h3>
                  <div
                    className="p-4 sm:p-5 rounded-xl bg-card border border-border"
                    style={{ boxShadow: "inset 0 1px 2px rgba(0, 0, 0, 0.1)" }}
                  >
                    <p className="text-sm text-foreground whitespace-pre-wrap leading-relaxed">
                      {requestDetails.suggestion_reason}
                    </p>
                  </div>
                </section>
              )}

              {/* Deliverables */}
              {requestDetails.deliverables?.length > 0 && (
                <section className="space-y-3">
                  <h3 className="text-base sm:text-lg font-semibold text-foreground">
                    Deliverables
                  </h3>
                  <div className="flex flex-wrap gap-2">
                    {requestDetails.deliverables.map((deliverable, index) => (
                      <span
                        key={index}
                        className="px-3 py-1.5 rounded-lg bg-muted border border-border text-foreground text-xs font-medium capitalize"
                      >
                        {deliverable.replace("_", " ")}
                      </span>
                    ))}
                  </div>
                </section>
              )}

              {/* Usage Rights */}
              {requestDetails.usage_rights && (
                <section className="space-y-3">
                  <h3 className="text-base sm:text-lg font-semibold text-foreground">
                    Usage Rights
                  </h3>
                  <div
                    className="p-4 rounded-lg bg-card border border-border"
                    style={{ boxShadow: "inset 0 1px 2px rgba(0, 0, 0, 0.1)" }}
                  >
                    <p className="text-sm text-foreground capitalize font-medium">
                      {requestDetails.usage_rights.replace("_", " ")}
                    </p>
                  </div>
                </section>
              )}

              {/* Requested Creators + Quotes */}
              {requestDetails.items?.length > 0 && (
                <section className="space-y-3">
                  <h3 className="text-base sm:text-lg font-semibold text-foreground">
                    Requested Creators ({requestDetails.items.length})
                  </h3>
                  <div className="space-y-3 max-h-72 overflow-y-auto pr-1">
                    {requestDetails.items.map((item) => {
                      const creator = item.creator;
                      const canRespond =
                        requestDetails.user_id === user?.id &&
                        item.status === "quoted";
                      const quoteLabel =
                        formatQuoteAmount(
                          item.quoted_amount_cents,
                          item.quoted_currency
                        ) || "Awaiting quote";
                      const quotedAtLabel = item.quoted_at
                        ? format(parseISO(item.quoted_at), "MMM d, yyyy")
                        : null;
                      return (
                        <div
                          key={item.id}
                          className="p-4 rounded-xl bg-card border border-border space-y-3"
                          style={{
                            boxShadow: "inset 0 1px 2px rgba(0, 0, 0, 0.1)",
                          }}
                        >
                          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium text-foreground">
                                {creator.name}
                              </p>
                              <div className="flex items-center gap-2 text-xs text-muted-foreground mt-1">
                                <span>@{creator.handle}</span>
                                {(() => {
                                  const platformIcon = normalizePlatform(
                                    creator.platform
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
                            <div className="px-2.5 py-1 rounded-md bg-muted border border-border text-xs text-foreground capitalize font-medium flex-shrink-0">
                              {item.status || "pending"}
                            </div>
                          </div>

                          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                            <div className="space-y-1">
                              <p className="text-xs text-muted-foreground">Quote</p>
                              <p className="text-sm text-foreground font-medium">
                                {quoteLabel}
                              </p>
                              {quotedAtLabel && (
                                <p className="text-xs text-muted-foreground">
                                  Received {quotedAtLabel}
                                </p>
                              )}
                            </div>
                            {canRespond && (
                              <div className="flex items-center gap-2">
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() =>
                                    respondToQuoteMutation.mutate({
                                      requestId: requestDetails.id,
                                      creatorId: creator.id,
                                      decision: "approved",
                                    })
                                  }
                                  className="h-9 min-h-[36px] border-emerald-200 dark:border-emerald-400/30 bg-emerald-100/70 dark:bg-emerald-500/10 hover:bg-emerald-200/80 dark:hover:bg-emerald-500/20 text-emerald-700 dark:text-emerald-400"
                                  disabled={respondToQuoteMutation.isPending}
                                >
                                  Accept
                                </Button>
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() =>
                                    respondToQuoteMutation.mutate({
                                      requestId: requestDetails.id,
                                      creatorId: creator.id,
                                      decision: "rejected",
                                    })
                                  }
                                  className="h-9 min-h-[36px] border-red-200 dark:border-red-500/30 bg-red-100/70 dark:bg-red-500/10 text-red-700 dark:text-red-400 hover:bg-red-200/80 dark:hover:bg-red-500/20"
                                  disabled={respondToQuoteMutation.isPending}
                                >
                                  Reject
                                </Button>
                              </div>
                            )}
                          </div>

                          {item.quote_notes && (
                            <div className="p-3 rounded-lg bg-muted/40 border border-border">
                              <p className="text-xs text-muted-foreground mb-1">
                                Creator Message
                              </p>
                              <p className="text-sm text-foreground leading-relaxed whitespace-pre-wrap">
                                {item.quote_notes}
                              </p>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </section>
              )}

              {/* Contact Information */}
              {(requestDetails.contact_person_name ||
                requestDetails.contact_person_email ||
                requestDetails.contact_person_phone) && (
                <section className="space-y-3">
                  <h3 className="text-base sm:text-lg font-semibold text-foreground">
                    Contact Information
                  </h3>
                  <div
                    className="p-4 sm:p-5 rounded-xl bg-card border border-border space-y-3"
                    style={{ boxShadow: "inset 0 1px 2px rgba(0, 0, 0, 0.1)" }}
                  >
                    {requestDetails.contact_person_name && (
                      <div>
                        <p className="text-xs text-muted-foreground mb-1">Name</p>
                        <p className="text-sm text-foreground font-medium">
                          {requestDetails.contact_person_name}
                        </p>
                      </div>
                    )}
                    {requestDetails.contact_person_email && (
                      <div>
                        <p className="text-xs text-muted-foreground mb-1">Email</p>
                        <p className="text-sm text-foreground font-medium break-all">
                          {requestDetails.contact_person_email}
                        </p>
                      </div>
                    )}
                    {requestDetails.contact_person_phone && (
                      <div>
                        <p className="text-xs text-muted-foreground mb-1">Phone</p>
                        <p className="text-sm text-foreground font-medium">
                          {requestDetails.contact_person_phone}
                        </p>
                      </div>
                    )}
                  </div>
                </section>
              )}

              {/* Quote Information */}
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <ResponsiveConfirmDialog
        open={Boolean(deleteConfirmId)}
        onOpenChange={(open) => {
          if (!open) setDeleteConfirmId(null);
        }}
        title="Delete request?"
        description="This request will be deleted and cannot be recovered. The agency will be notified."
        confirmLabel={
          deleteRequestMutation.isPending ? "Deleting..." : "Delete request"
        }
        confirmDisabled={deleteRequestMutation.isPending}
        onConfirm={() =>
          deleteConfirmId && handleDeleteRequest(deleteConfirmId)
        }
      />

      <CreatorRequestChatbot
        open={editDialogOpen}
        onOpenChange={(open) => {
          setEditDialogOpen(open);
          if (!open) {
            setEditRequestId(null);
            setEditInitialForm(undefined);
            setEditInitialCreators([]);
          }
        }}
        onComplete={() => {
          setEditDialogOpen(false);
          setEditRequestId(null);
          setEditInitialForm(undefined);
          setEditInitialCreators([]);
        }}
        editRequestId={editRequestId || undefined}
        initialCreatorIds={editInitialCreators}
        allowCreatorEdits
        initialFormValues={editInitialForm}
        submitLabel="Send Request"
      />
    </div>
  );
}
