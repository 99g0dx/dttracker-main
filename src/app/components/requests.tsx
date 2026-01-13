"use client";

import React, { useState, useMemo } from "react";
import { Card, CardContent } from "./ui/card";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
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
  useCreatorRequestWithCreators,
  useDeleteCreatorRequest,
} from "../../hooks/useCreatorRequests";
import type { CreatorRequest, CreatorRequestStatus } from "../../lib/types/database";
import { format, parseISO } from "date-fns";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "./ui/dialog";
import { ResponsiveConfirmDialog } from "./ui/responsive-confirm-dialog";

interface RequestsProps {
  onNavigate?: (path: string) => void;
}

const statusConfig: Record<
  CreatorRequestStatus,
  { label: string; color: string; bgColor: string; icon: React.ReactNode }
> = {
  submitted: {
    label: "Submitted",
    color: "text-blue-400",
    bgColor: "bg-blue-400/10 border-blue-400/20",
    icon: <FileText className="w-4 h-4" />,
  },
  reviewing: {
    label: "Reviewing",
    color: "text-yellow-400",
    bgColor: "bg-yellow-400/10 border-yellow-400/20",
    icon: <Clock className="w-4 h-4" />,
  },
  quoted: {
    label: "Quoted",
    color: "text-purple-400",
    bgColor: "bg-purple-400/10 border-purple-400/20",
    icon: <DollarSign className="w-4 h-4" />,
  },
  approved: {
    label: "Approved",
    color: "text-green-400",
    bgColor: "bg-green-400/10 border-green-400/20",
    icon: <CheckCircle2 className="w-4 h-4" />,
  },
  in_fulfillment: {
    label: "In Fulfillment",
    color: "text-indigo-400",
    bgColor: "bg-indigo-400/10 border-indigo-400/20",
    icon: <Clock className="w-4 h-4" />,
  },
  delivered: {
    label: "Delivered",
    color: "text-emerald-400",
    bgColor: "bg-emerald-400/10 border-emerald-400/20",
    icon: <CheckCircle2 className="w-4 h-4" />,
  },
};

export function Requests({ onNavigate }: RequestsProps) {
  const { data: requests = [], isLoading } = useCreatorRequests();
  const deleteRequestMutation = useDeleteCreatorRequest();
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<CreatorRequestStatus | "all">("all");
  const [selectedRequest, setSelectedRequest] = useState<CreatorRequest | null>(null);
  const [viewDialogOpen, setViewDialogOpen] = useState(false);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);

  const { data: requestDetails } = useCreatorRequestWithCreators(
    selectedRequest?.id || ""
  );

  // Filter and sort requests
  const filteredRequests = useMemo(() => {
    let filtered = requests;

    // Filter by search query
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(
        (req) =>
          req.campaign_type?.toLowerCase().includes(query) ||
          req.campaign_brief?.toLowerCase().includes(query) ||
          req.contact_person_name?.toLowerCase().includes(query) ||
          req.contact_person_email?.toLowerCase().includes(query)
      );
    }

    // Filter by status
    if (statusFilter !== "all") {
      filtered = filtered.filter((req) => req.status === statusFilter);
    }

    // Sort by created_at (newest first)
    return filtered.sort((a, b) => {
      const dateA = parseISO(a.created_at);
      const dateB = parseISO(b.created_at);
      return dateB.getTime() - dateA.getTime();
    });
  }, [requests, searchQuery, statusFilter]);

  const openViewDialog = (request: CreatorRequest) => {
    setSelectedRequest(request);
    setViewDialogOpen(true);
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
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <button
            onClick={() => onNavigate?.("/")}
            className="w-11 h-11 flex-shrink-0 rounded-md bg-white/[0.03] hover:bg-white/[0.06] border border-white/[0.08] flex items-center justify-center transition-colors"
            aria-label="Back to dashboard"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>
          <div>
            <h1 className="text-xl sm:text-2xl font-semibold tracking-tight text-white">
              Creator Requests
            </h1>
            <p className="text-xs sm:text-sm text-slate-400 mt-1">
              Track your creator requests and their status
            </p>
          </div>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        {Object.entries(statusConfig).map(([status, config]) => (
          <Card
            key={status}
            className="bg-white/[0.02] border-white/[0.08] cursor-pointer hover:bg-white/[0.04] transition-colors"
            onClick={() =>
              setStatusFilter(
                statusFilter === status ? "all" : (status as CreatorRequestStatus)
              )
            }
          >
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div
                  className={`w-10 h-10 rounded-lg ${config.bgColor} border flex items-center justify-center ${config.color}`}
                >
                  {config.icon}
                </div>
                <div>
                  <p className="text-2xl font-semibold text-white">
                    {statusCounts[status as CreatorRequestStatus]}
                  </p>
                  <p className="text-xs text-slate-400">{config.label}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Filters */}
      <Card className="bg-white/[0.02] border-white/[0.08]">
        <CardContent className="p-4">
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <Input
                type="search"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search requests..."
                className="pl-9 bg-white/[0.03] border-white/[0.08] text-white placeholder:text-slate-500"
              />
            </div>
            <div className="flex items-center gap-2">
              <Filter className="w-4 h-4 text-slate-400" />
              <select
                value={statusFilter}
                onChange={(e) =>
                  setStatusFilter(e.target.value as CreatorRequestStatus | "all")
                }
                className="h-11 sm:h-10 px-3 pr-8 bg-white/[0.03] border border-white/[0.08] rounded-lg text-sm text-white appearance-none cursor-pointer hover:bg-white/[0.06] focus:bg-white/[0.06] focus:border-primary/50 transition-all"
              >
                <option value="all">All Status</option>
                {Object.entries(statusConfig).map(([status, config]) => (
                  <option key={status} value={status}>
                    {config.label}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Requests List */}
      {isLoading ? (
        <Card className="bg-white/[0.02] border-white/[0.08]">
          <CardContent className="p-8 text-center">
            <p className="text-slate-400">Loading requests...</p>
          </CardContent>
        </Card>
      ) : filteredRequests.length === 0 ? (
        <Card className="bg-white/[0.02] border-white/[0.08]">
          <CardContent className="p-8 text-center">
            <p className="text-slate-400">
              {searchQuery || statusFilter !== "all"
                ? "No requests found matching your filters."
                : "No requests yet. Create your first request from the Creator Library."}
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {filteredRequests.map((request) => {
            const status = statusConfig[request.status];
            return (
              <Card
                key={request.id}
                className="bg-white/[0.02] border-white/[0.08] hover:bg-white/[0.04] transition-colors cursor-pointer"
                onClick={() => openViewDialog(request)}
              >
                <CardContent className="p-6">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-3 mb-2">
                        <div
                          className={`px-3 py-1 rounded-full border ${status.bgColor} ${status.color} flex items-center gap-1.5 text-xs font-medium`}
                        >
                          {status.icon}
                          {status.label}
                        </div>
                        <span className="text-xs text-slate-500 capitalize">
                          {request.campaign_type?.replace("_", " ") || "N/A"}
                        </span>
                      </div>
                      {request.campaign_brief && (
                        <p className="text-sm text-slate-300 line-clamp-2 mt-2">
                          {request.campaign_brief}
                        </p>
                      )}
                      <div className="flex items-center gap-4 mt-3 text-xs text-slate-500">
                        <div className="flex items-center gap-1.5">
                          <Calendar className="w-3.5 h-3.5" />
                          {format(parseISO(request.created_at), "MMM d, yyyy")}
                        </div>
                        {request.deadline && (
                          <div className="flex items-center gap-1.5">
                            <Clock className="w-3.5 h-3.5" />
                            Deadline: {format(parseISO(request.deadline), "MMM d, yyyy")}
                          </div>
                        )}
                        {request.contact_person_name && (
                          <div className="flex items-center gap-1.5">
                            <Users className="w-3.5 h-3.5" />
                            {request.contact_person_name}
                          </div>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={(e) => {
                          e.stopPropagation();
                          openViewDialog(request);
                        }}
                        className="border-white/[0.08] bg-white/[0.03] hover:bg-white/[0.06] text-slate-300 min-h-[44px]"
                      >
                        <Eye className="w-4 h-4 mr-2" />
                        View Details
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={(e) => {
                          e.stopPropagation();
                          setDeleteConfirmId(request.id);
                        }}
                        className="border-red-500/20 bg-red-500/10 hover:bg-red-500/20 text-red-400 hover:text-red-300 min-h-[44px] min-w-[44px]"
                        disabled={deleteRequestMutation.isPending}
                        aria-label="Delete request"
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Request Detail Dialog */}
      <Dialog open={viewDialogOpen} onOpenChange={setViewDialogOpen}>
        <DialogContent className="w-[92vw] max-w-3xl max-h-[85vh] overflow-hidden flex flex-col bg-gray-900 rounded-lg shadow-lg top-[50%] left-[50%] right-auto bottom-auto translate-x-[-50%] translate-y-[-50%] p-4 sm:p-6">
          <DialogHeader>
            <div className="flex items-start justify-between">
              <div>
                <DialogTitle className="text-2xl font-semibold text-white">
                  Request Details
                </DialogTitle>
                <DialogDescription className="text-slate-400 mt-1">
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
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setViewDialogOpen(false);
                    setDeleteConfirmId(selectedRequest.id);
                  }}
                  className="border-red-600 bg-red-600/10 hover:bg-red-600/20 text-red-500 hover:text-red-400 flex flex-wrap items-center gap-2 h-9 px-3 mr-12"
                  disabled={deleteRequestMutation.isPending}
                >
                  <Trash2 className="w-4 h-4" />
                  Delete
                </Button>
              )}
            </div>
          </DialogHeader>

          {requestDetails && (
            <div className="flex-1 overflow-y-auto space-y-6 py-4 px-2 sm:px-0">
              {/* Campaign Information */}
              <section className="space-y-3">
                <h3 className="text-lg font-semibold text-white border-b border-white/[0.1] pb-2">
                  Campaign Information
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 p-4 rounded-lg bg-gray-800 border border-white/[0.08]">
                  <div>
                    <p className="text-xs text-slate-400 mb-1">
                      Campaign Type
                    </p>
                    <p className="text-sm text-white capitalize">
                      {requestDetails.campaign_type?.replace("_", " ") || "N/A"}
                    </p>
                  </div>
                  {requestDetails.deadline && (
                    <div>
                      <p className="text-xs text-slate-400 mb-1">Deadline</p>
                      <p className="text-sm text-white">
                        {format(parseISO(requestDetails.deadline), "MMM d, yyyy")}
                      </p>
                    </div>
                  )}
                  {requestDetails.urgency && (
                    <div>
                      <p className="text-xs text-slate-400 mb-1">Urgency</p>
                      <p className="text-sm text-white capitalize">
                        {requestDetails.urgency.replace("_", " ")}
                      </p>
                    </div>
                  )}
                  {requestDetails.posts_per_creator && (
                    <div>
                      <p className="text-xs text-slate-400 mb-1">
                        Posts per Creator
                      </p>
                      <p className="text-sm text-white">
                        {requestDetails.posts_per_creator}
                      </p>
                    </div>
                  )}
                </div>
              </section>

              {/* Campaign Brief */}
              {requestDetails.campaign_brief && (
                <section className="space-y-2">
                  <h3 className="text-lg font-semibold text-white border-b border-white/[0.1] pb-2">
                    Campaign Brief
                  </h3>
                  <p className="text-sm text-slate-300 p-4 rounded-lg bg-gray-800 border border-white/[0.08] whitespace-pre-wrap">
                    {requestDetails.campaign_brief}
                  </p>
                </section>
              )}

              {/* Deliverables */}
              {requestDetails.deliverables?.length > 0 && (
                <section className="space-y-2">
                  <h3 className="text-lg font-semibold text-white border-b border-white/[0.1] pb-2">
                    Deliverables
                  </h3>
                  <div className="flex flex-wrap gap-2">
                    {requestDetails.deliverables.map((deliverable, index) => (
                      <span
                        key={index}
                        className="px-3 py-1 rounded-full bg-primary/20 border border-primary/30 text-primary text-xs font-medium capitalize"
                      >
                        {deliverable.replace("_", " ")}
                      </span>
                    ))}
                  </div>
                </section>
              )}

              {/* Usage Rights */}
              {requestDetails.usage_rights && (
                <section className="space-y-2">
                  <h3 className="text-lg font-semibold text-white border-b border-white/[0.1] pb-2">
                    Usage Rights
                  </h3>
                  <p className="text-sm text-slate-300 capitalize">
                    {requestDetails.usage_rights.replace("_", " ")}
                  </p>
                </section>
              )}

              {/* Selected Creators */}
              {requestDetails.creators?.length > 0 && (
                <section className="space-y-2">
                  <h3 className="text-lg font-semibold text-white border-b border-white/[0.1] pb-2">
                    Selected Creators ({requestDetails.creators.length})
                  </h3>
                  <div className="space-y-2 max-h-60 overflow-y-auto">
                    {requestDetails.creators.map((creator) => (
                      <div
                        key={creator.id}
                        className="p-3 rounded-lg bg-gray-800 border border-white/[0.08] flex flex-col sm:flex-row sm:justify-between sm:items-center"
                      >
                        <p className="text-sm font-medium text-white">
                          {creator.name}
                        </p>
                        <div className="flex items-center gap-2 text-xs text-slate-400">
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
                    ))}
                  </div>
                </section>
              )}

              {/* Contact Information */}
              {(requestDetails.contact_person_name ||
                requestDetails.contact_person_email ||
                requestDetails.contact_person_phone) && (
                <section className="space-y-2">
                  <h3 className="text-lg font-semibold text-white border-b border-white/[0.1] pb-2">
                    Contact Information
                  </h3>
                  <div className="p-4 rounded-lg bg-gray-800 border border-white/[0.08] space-y-2">
                    {requestDetails.contact_person_name && (
                      <p className="text-sm text-white">
                        <span className="text-slate-400">Name: </span>
                        {requestDetails.contact_person_name}
                      </p>
                    )}
                    {requestDetails.contact_person_email && (
                      <p className="text-sm text-white">
                        <span className="text-slate-400">Email: </span>
                        {requestDetails.contact_person_email}
                      </p>
                    )}
                    {requestDetails.contact_person_phone && (
                      <p className="text-sm text-white">
                        <span className="text-slate-400">Phone: </span>
                        {requestDetails.contact_person_phone}
                      </p>
                    )}
                  </div>
                </section>
              )}

              {/* Quote Information */}
              {requestDetails.quote_amount && (
                <section className="space-y-2">
                  <h3 className="text-lg font-semibold text-white border-b border-white/[0.1] pb-2">
                    Quote
                  </h3>
                  <div className="p-4 rounded-lg bg-gray-800 border border-white/[0.08]">
                    <p className="text-xl font-semibold text-white">
                      ${requestDetails.quote_amount.toFixed(2)}
                    </p>
                    {requestDetails.quote_details && (
                      <p className="text-sm text-slate-300 mt-2 whitespace-pre-wrap">
                        {JSON.stringify(requestDetails.quote_details, null, 2)}
                      </p>
                    )}
                  </div>
                </section>
              )}
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

    </div>
  );
}
