import React, { useState } from 'react';
import { Card, CardContent } from './ui/card';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Badge } from './ui/badge';
import { Plus, Search, Calendar, FileText, TrendingUp, MoreVertical, Edit2, Trash2, Copy, ArrowLeft, RefreshCw } from 'lucide-react';
import { StatusBadge } from './status-badge';
import { CampaignCardSkeleton } from './ui/skeleton';
import { ResponsiveConfirmDialog } from './ui/responsive-confirm-dialog';
import { useCampaigns, useDeleteCampaign, useDuplicateCampaign, campaignsKeys } from '../../hooks/useCampaigns';
import { useQueryClient } from '@tanstack/react-query';
import { useWorkspace } from '../../contexts/WorkspaceContext';
import { useWorkspaceAccess } from '../../hooks/useWorkspaceAccess';

interface CampaignsProps {
  onNavigate: (path: string) => void;
}

export function Campaigns({ onNavigate }: CampaignsProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);
  const [deleteDialogId, setDeleteDialogId] = useState<string | null>(null);
  const [shouldFetch, setShouldFetch] = useState(false);

  // Fetch campaigns from database
  const { data: campaigns = [], isLoading, error, refetch } = useCampaigns({
    enabled: shouldFetch,
  });
  const queryClient = useQueryClient();
  const { activeWorkspaceId } = useWorkspace();
  const {
    loading: accessLoading,
    canViewWorkspace,
    hasCampaignAccess,
    canViewCampaign,
    canEditCampaign,
    canEditWorkspace,
  } = useWorkspaceAccess();
  const deleteCampaignMutation = useDeleteCampaign();
  const duplicateCampaignMutation = useDuplicateCampaign();
  const isCampaignsLoading = !shouldFetch || isLoading;
  const canCreateCampaign = !activeWorkspaceId || accessLoading || canEditWorkspace;

  React.useEffect(() => {
    const timer = setTimeout(() => setShouldFetch(true), 500);
    return () => clearTimeout(timer);
  }, []);
  
  const handleRetry = () => {
    // Clear the cache and refetch
    queryClient.invalidateQueries({ queryKey: campaignsKeys.lists(activeWorkspaceId) });
    refetch();
  };

  const visibleCampaigns = React.useMemo(() => {
    if (!activeWorkspaceId || accessLoading) return campaigns;
    if (canViewWorkspace) return campaigns;
    if (hasCampaignAccess) {
      return campaigns.filter((campaign) => canViewCampaign(campaign.id));
    }
    return [];
  }, [
    activeWorkspaceId,
    accessLoading,
    canViewWorkspace,
    hasCampaignAccess,
    canViewCampaign,
    campaigns,
  ]);

  const filteredCampaigns = visibleCampaigns.filter(campaign =>
    campaign.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleDeleteCampaign = (id: string) => {
    deleteCampaignMutation.mutate(id);
    setDeleteDialogId(null);
    setOpenMenuId(null);
  };

  const handleMenuClick = (e: React.MouseEvent, campaignId: string) => {
    e.stopPropagation();
    setOpenMenuId(openMenuId === campaignId ? null : campaignId);
  };

  const handleEditClick = (e: React.MouseEvent, campaignId: string) => {
    e.stopPropagation();
    onNavigate(`/campaigns/${campaignId}/edit`);
    setOpenMenuId(null);
  };

  const handleDeleteClick = (e: React.MouseEvent, campaignId: string) => {
    e.stopPropagation();
    setDeleteDialogId(campaignId);
    setOpenMenuId(null);
  };

  const handleDuplicateCampaign = (e: React.MouseEvent, campaignId: string) => {
    e.stopPropagation();
    duplicateCampaignMutation.mutate(campaignId);
    setOpenMenuId(null);
  };

  // Close menu when clicking outside
  React.useEffect(() => {
    const handleClickOutside = () => setOpenMenuId(null);
    if (openMenuId !== null) {
      document.addEventListener('click', handleClickOutside);
      return () => document.removeEventListener('click', handleClickOutside);
    }
  }, [openMenuId]);

  const deleteCandidate = campaigns.find(c => c.id === deleteDialogId);

  // Loading state
  if (isCampaignsLoading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button
              onClick={() => onNavigate('/')}
              className="w-11 h-11 rounded-md bg-white/[0.03] hover:bg-white/[0.06] border border-white/[0.08] flex items-center justify-center transition-colors"
              aria-label="Back to dashboard"
            >
              <ArrowLeft className="w-4 h-4" />
            </button>
            <div>
              <h1 className="text-xl sm:text-2xl font-semibold tracking-tight text-white">Campaigns</h1>
              <p className="text-sm text-slate-400 mt-1">Manage your marketing campaigns</p>
            </div>
          </div>
          <Button
            onClick={() => onNavigate('/campaigns/new')}
            className="bg-primary hover:bg-primary/90 text-black disabled:opacity-60"
            disabled={!canCreateCampaign}
            title={!canCreateCampaign ? 'You do not have permission to create campaigns' : undefined}
          >
            <Plus className="w-4 h-4 mr-2" />
            New Campaign
          </Button>
        </div>
        <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <CampaignCardSkeleton key={i} />
          ))}
        </div>
      </div>
    );
  }

  // Error state
  if (shouldFetch && error) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button
              onClick={() => onNavigate('/')}
              className="w-11 h-11 rounded-md bg-white/[0.03] hover:bg-white/[0.06] border border-white/[0.08] flex items-center justify-center transition-colors"
              aria-label="Back to dashboard"
            >
              <ArrowLeft className="w-4 h-4" />
            </button>
            <div>
              <h1 className="text-xl sm:text-2xl font-semibold tracking-tight text-white">Campaigns</h1>
              <p className="text-sm text-slate-400 mt-1">Manage your marketing campaigns</p>
            </div>
          </div>
          <Button
            onClick={() => onNavigate('/campaigns/new')}
            className="bg-primary hover:bg-primary/90 text-black disabled:opacity-60"
            disabled={!canCreateCampaign}
            title={!canCreateCampaign ? 'You do not have permission to create campaigns' : undefined}
          >
            <Plus className="w-4 h-4 mr-2" />
            New Campaign
          </Button>
        </div>
        <Card className="bg-[#0D0D0D] border-white/[0.08]">
          <CardContent className="flex flex-col items-center justify-center py-16">
            <div className="w-12 h-12 rounded-lg bg-red-500/10 flex items-center justify-center mb-4">
              <FileText className="w-6 h-6 text-red-400" />
            </div>
            <h3 className="text-base font-semibold text-white mb-1">Failed to load campaigns</h3>
            <p className="text-sm text-slate-400 mb-4 text-center max-w-md">{error.message}</p>
            <Button
              onClick={handleRetry}
              className="bg-primary hover:bg-primary/90 text-black"
            >
              <RefreshCw className="w-4 h-4 mr-2" />
              Try Again
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3 sm:gap-4">
            <button
              onClick={() => onNavigate('/')}
              className="w-11 h-11 flex-shrink-0 rounded-md bg-white/[0.03] hover:bg-white/[0.06] border border-white/[0.08] flex items-center justify-center transition-colors"
              aria-label="Back to dashboard"
            >
            <ArrowLeft className="w-4 h-4" />
          </button>
          <div className="flex-1 min-w-0">
            <h1 className="text-xl sm:text-2xl font-semibold tracking-tight text-white">Campaigns</h1>
            <p className="text-xs sm:text-sm text-slate-400 mt-1">Manage your marketing campaigns</p>
          </div>
        </div>
        <Button
          onClick={() => onNavigate('/campaigns/new')}
          className="w-full sm:w-auto bg-primary hover:bg-primary/90 text-black disabled:opacity-60"
          disabled={!canCreateCampaign}
          title={!canCreateCampaign ? 'You do not have permission to create campaigns' : undefined}
        >
          <Plus className="w-4 h-4 mr-2" />
          New Campaign
        </Button>
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
        <Input
          type="search"
          placeholder="Search campaigns..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="pl-9 bg-white/[0.03] border-white/[0.08] text-white placeholder:text-slate-500"
        />
      </div>

      {/* Campaigns Grid */}
      {filteredCampaigns.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
          {filteredCampaigns.map((campaign) => {
            const canEditThisCampaign = canEditCampaign(campaign.id);
            return (
              <Card
                key={campaign.id}
                className="bg-[#0D0D0D] border-white/[0.08] hover:border-white/[0.12] transition-all cursor-pointer group relative overflow-hidden"
                onClick={() => onNavigate(`/campaigns/${campaign.id}`)}
              >
              <CardContent className="p-0">
                {/* Cover Image Header */}
                <div className="relative w-full h-24 sm:h-28 bg-gradient-to-br from-primary to-cyan-400">
                  {campaign.cover_image_url ? (
                    <img
                      src={campaign.cover_image_url}
                      alt={campaign.name}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center">
                      <span className="text-3xl sm:text-4xl font-bold text-white">
                        {campaign.name.charAt(0).toUpperCase()}
                      </span>
                    </div>
                  )}
                  {/* Menu Button Overlay */}
                  <div className="absolute top-2 right-2">
                    <div className="relative">
                      <button
                        onClick={(e) => handleMenuClick(e, campaign.id)}
                        className="w-11 h-11 sm:w-7 sm:h-7 rounded-md bg-black/50 hover:bg-black/70 backdrop-blur-sm flex items-center justify-center transition-colors opacity-100 sm:opacity-0 sm:group-hover:opacity-100"
                        aria-label="Open campaign actions"
                      >
                        <MoreVertical className="w-4 h-4 text-white" />
                      </button>
                      
                      {/* Dropdown Menu */}
                      {openMenuId === campaign.id && (
                        <div className="absolute right-0 top-full mt-1 w-44 sm:w-48 bg-[#1A1A1A] border border-white/[0.08] rounded-lg shadow-xl z-1 overflow-hidden">
                          {canEditThisCampaign ? (
                            <>
                              <button
                                onClick={(e) => handleEditClick(e, campaign.id)}
                                className="w-full flex items-center gap-2 sm:gap-3 px-3 sm:px-4 py-2 sm:py-2.5 text-xs sm:text-sm text-slate-300 hover:bg-white/[0.06] transition-colors text-left"
                              >
                                <Edit2 className="w-3 h-3 sm:w-4 sm:h-4" />
                                Edit Campaign
                              </button>
                              <div className="h-px bg-white/[0.06]" />
                              <button
                                onClick={(e) => handleDeleteClick(e, campaign.id)}
                                className="w-full flex items-center gap-2 sm:gap-3 px-3 sm:px-4 py-2 sm:py-2.5 text-xs sm:text-sm text-red-400 hover:bg-red-500/10 transition-colors text-left"
                              >
                                <Trash2 className="w-3 h-3 sm:w-4 sm:h-4" />
                                Delete Campaign
                              </button>
                              <div className="h-px bg-white/[0.06]" />
                              <button
                                onClick={(e) => handleDuplicateCampaign(e, campaign.id)}
                                className="w-full flex items-center gap-2 sm:gap-3 px-3 sm:px-4 py-2 sm:py-2.5 text-xs sm:text-sm text-slate-300 hover:bg-white/[0.06] transition-colors text-left"
                              >
                                <Copy className="w-3 h-3 sm:w-4 sm:h-4" />
                                Duplicate Campaign
                              </button>
                            </>
                          ) : (
                            <div className="px-3 sm:px-4 py-2 sm:py-2.5 text-xs sm:text-sm text-slate-500">
                              View only access
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                {/* Content Section */}
                <div className="p-3">
                  {/* Header Row: Title, Brand, Status */}
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <div className="flex-1 min-w-0">
                      <h3 className="text-base font-semibold text-white group-hover:text-primary transition-colors leading-snug break-words overflow-hidden [display:-webkit-box] [-webkit-line-clamp:2] [-webkit-box-orient:vertical] min-h-[40px]">
                        {campaign.name}
                      </h3>
                      {campaign.brand_name && (
                        <p className="text-sm text-slate-400 mt-0.5 break-words overflow-hidden [display:-webkit-box] [-webkit-line-clamp:2] [-webkit-box-orient:vertical]">
                          {campaign.brand_name}
                        </p>
                      )}
                    </div>
                    <div className="flex flex-col items-end gap-1">
                      <StatusBadge status={campaign.status} />
                      {campaign.subcampaigns_count > 0 && (
                        <Badge variant="secondary" className="text-[10px] bg-white/[0.06] text-slate-300">
                          🗂️ {campaign.subcampaigns_count} subcampaigns
                        </Badge>
                      )}
                    </div>
                  </div>

                  {/* Metrics Row */}
                  <div className="grid grid-cols-3 gap-0.5">
                    <div className="text-center min-w-0">
                      <div className="text-sm font-semibold text-white leading-tight">{campaign.posts_count}</div>
                      <p className="text-[9px] text-slate-500 mt-0.5 truncate">Posts</p>
                    </div>
                    <div className="text-center min-w-0">
                      <div className="text-sm font-semibold text-white leading-tight">
                        {campaign.total_views >= 1000000
                          ? `${(campaign.total_views / 1000000).toFixed(1)}M`
                          : campaign.total_views >= 1000
                          ? `${(campaign.total_views / 1000).toFixed(1)}K`
                          : campaign.total_views}
                      </div>
                      <p className="text-[9px] text-slate-500 mt-0.5 truncate">Reach</p>
                    </div>
                    <div className="text-center min-w-0">
                      <div className="text-sm font-semibold text-emerald-400 leading-tight">{campaign.avg_engagement_rate.toFixed(1)}%</div>
                      <p className="text-[9px] text-slate-500 mt-0.5 truncate">Engagement</p>
                    </div>
                  </div>

                  {/* Date Range */}
                  {campaign.start_date && campaign.end_date && (
                    <div className="flex items-center gap-1.5 text-[10px] sm:text-xs text-slate-400 mt-2 pt-2 border-t border-white/[0.06]">
                      <Calendar className="w-3.5 h-3.5 flex-shrink-0" />
                      <span className="truncate">
                        {new Date(campaign.start_date).toLocaleDateString()} - {new Date(campaign.end_date).toLocaleDateString()}
                      </span>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
            );
          })}
        </div>
      ) : (
        <Card className="bg-[#0D0D0D] border-white/[0.08]">
          <CardContent className="flex flex-col items-center justify-center py-16">
            <div className="w-12 h-12 rounded-lg bg-white/[0.03] flex items-center justify-center mb-4">
              <Search className="w-6 h-6 text-slate-600" />
            </div>
            <h3 className="text-base font-semibold text-white mb-1">No campaigns found</h3>
            <p className="text-sm text-slate-400 text-center mb-6 max-w-md">
              Try adjusting your search query or create a new campaign to get started
            </p>
          </CardContent>
        </Card>
      )}

      {/* Delete Confirmation Dialog */}
      <ResponsiveConfirmDialog
        open={Boolean(deleteDialogId && deleteCandidate)}
        onOpenChange={(open) => {
          if (!open) setDeleteDialogId(null);
        }}
        title="Delete campaign?"
        description={
          deleteCandidate
            ? `"${deleteCandidate.name}" will be deleted along with all posts and data. This action cannot be undone.`
            : "This campaign will be deleted. This action cannot be undone."
        }
        confirmLabel={
          deleteCampaignMutation.isPending ? "Deleting..." : "Delete campaign"
        }
        confirmDisabled={deleteCampaignMutation.isPending}
        onConfirm={() => deleteDialogId && handleDeleteCampaign(deleteDialogId)}
      />
    </div>
  );
}
