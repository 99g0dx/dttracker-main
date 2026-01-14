import React, { useState, useMemo, useEffect } from 'react';
import { Card, CardContent } from './ui/card';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Search, Plus, Check, X } from 'lucide-react';
import {
  PlatformIcon,
  normalizePlatform,
  getPlatformLabel,
} from './ui/PlatformIcon';
import { useQueryClient } from '@tanstack/react-query';
import { useCreatorsWithStats, creatorsKeys } from '../../hooks/useCreators';
import { useCampaigns } from '../../hooks/useCampaigns';
import { useCampaignCreatorIds } from '../../hooks/useCreators';
import * as creatorsApi from '../../lib/api/creators';
import { toast } from 'sonner';
import type { CreatorWithStats } from '../../lib/types/database';
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
  PaginationEllipsis,
} from './ui/pagination';

interface CampaignCreatorSelectorProps {
  onNavigate?: (path: string) => void;
}

export function CampaignCreatorSelector({ onNavigate }: CampaignCreatorSelectorProps) {
  const queryClient = useQueryClient();
  const { data: creators = [], isLoading } = useCreatorsWithStats();
  const { data: campaigns = [] } = useCampaigns();

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCampaignIds, setSelectedCampaignIds] = useState<string[]>([]);
  const [selectedCreatorIds, setSelectedCreatorIds] = useState<Set<string>>(new Set());
  const [isAdding, setIsAdding] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 18;

  const { data: campaignCreatorIds = [] } = useCampaignCreatorIds(selectedCampaignIds);

  const campaignCreatorIdSet = useMemo(() => {
    return new Set(campaignCreatorIds);
  }, [campaignCreatorIds]);

  const filteredCreators = useMemo(() => {
    return creators.filter(creator =>
      creator.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      creator.handle.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (creator.niche && creator.niche.toLowerCase().includes(searchQuery.toLowerCase()))
    );
  }, [creators, searchQuery]);

  const availableCreators = useMemo(() => {
    if (selectedCampaignIds.length === 0) {
      return filteredCreators;
    }

    return filteredCreators.filter((creator) => !campaignCreatorIdSet.has(creator.id));
  }, [filteredCreators, selectedCampaignIds.length, campaignCreatorIdSet]);

  const totalPages = Math.ceil(availableCreators.length / itemsPerPage) || 1;
  const safeCurrentPage = Math.min(currentPage, totalPages);
  const startIndex = (safeCurrentPage - 1) * itemsPerPage;
  const endIndex = Math.min(startIndex + itemsPerPage, availableCreators.length);
  const pagedCreators = useMemo(() => {
    return availableCreators.slice(startIndex, startIndex + itemsPerPage);
  }, [availableCreators, startIndex, itemsPerPage]);

  useEffect(() => {
    if (currentPage !== safeCurrentPage) {
      setCurrentPage(safeCurrentPage);
    }
  }, [currentPage, safeCurrentPage]);

  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, selectedCampaignIds.join(','), creators.length]);

  const handleToggleCreator = (creatorId: string) => {
    setSelectedCreatorIds(prev => {
      const newSet = new Set(prev);
      if (newSet.has(creatorId)) {
        newSet.delete(creatorId);
      } else {
        newSet.add(creatorId);
      }
      return newSet;
    });
  };

  const handleSelectAll = () => {
    if (selectedCreatorIds.size === availableCreators.length) {
      setSelectedCreatorIds(new Set());
    } else {
      setSelectedCreatorIds(new Set(availableCreators.map(c => c.id)));
    }
  };

  const handleAddToCampaigns = async () => {
    if (selectedCampaignIds.length === 0) {
      toast.error('Please select at least one campaign');
      return;
    }

    if (selectedCreatorIds.size === 0) {
      toast.error('Please select at least one creator');
      return;
    }

    setIsAdding(true);
    try {
      const result = await creatorsApi.addCreatorsToMultipleCampaigns(
        selectedCampaignIds,
        Array.from(selectedCreatorIds)
      );

      if (result.error) {
        toast.error(result.error.message || 'Failed to add creators to campaigns');
      } else {
        toast.success(`Added ${selectedCreatorIds.size} creator${selectedCreatorIds.size !== 1 ? 's' : ''} to ${selectedCampaignIds.length} campaign${selectedCampaignIds.length !== 1 ? 's' : ''}`);
        setSelectedCreatorIds(new Set());
        await queryClient.invalidateQueries({ queryKey: creatorsKeys.all });
        await queryClient.refetchQueries({ queryKey: creatorsKeys.all });
        await Promise.all(
          selectedCampaignIds.map((campaignId) =>
            queryClient.invalidateQueries({ queryKey: creatorsKeys.byCampaign(campaignId) })
          )
        );
      }
    } catch (error: any) {
      toast.error(error.message || 'Failed to add creators to campaigns');
    } finally {
      setIsAdding(false);
    }
  };

  if (isLoading) {
    return (
      <Card className="bg-[#0D0D0D] border-white/[0.08]">
        <CardContent className="flex flex-col items-center justify-center py-16">
          <p className="text-sm text-slate-400">Loading creators...</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {/* Campaign Selector */}
      <Card className="bg-[#0D0D0D] border-white/[0.08]">
        <CardContent className="p-4">
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-white mb-2">Select Campaign(s)</label>
              <div className="space-y-2 max-h-40 overflow-y-auto">
                {campaigns.map((campaign) => {
                  const isSelected = selectedCampaignIds.includes(campaign.id);
                  return (
                    <div key={campaign.id} className="flex items-center gap-2">
                      <button
                        onClick={() => {
                          if (isSelected) {
                            setSelectedCampaignIds(prev => prev.filter(id => id !== campaign.id));
                          } else {
                            setSelectedCampaignIds(prev => [...prev, campaign.id]);
                          }
                          setSelectedCreatorIds(new Set());
                        }}
                        className={`w-5 h-5 rounded border-2 flex items-center justify-center flex-shrink-0 ${
                          isSelected
                            ? 'bg-primary border-primary'
                            : 'border-white/[0.2]'
                        }`}
                      >
                        {isSelected && <Check className="w-3 h-3 text-black" />}
                      </button>
                      <span className="text-sm text-white">{campaign.name}</span>
                    </div>
                  );
                })}
                {campaigns.length === 0 && (
                  <p className="text-sm text-slate-400">No campaigns available</p>
                )}
              </div>
            </div>
            {selectedCampaignIds.length > 0 && (
              <div className="flex items-center gap-2">
                <Button
                  onClick={handleAddToCampaigns}
                  disabled={selectedCreatorIds.size === 0 || isAdding}
                  className="h-10 bg-primary hover:bg-primary/90 text-black w-full sm:w-auto"
                  style={{ backgroundClip: 'unset', WebkitBackgroundClip: 'unset' }}
                >
                  <Plus className="w-4 h-4 mr-2" />
                  <span className="sm:hidden">
                    {isAdding ? 'Adding...' : `Add ${selectedCreatorIds.size || ''} Creator${selectedCreatorIds.size !== 1 ? 's' : ''}`}
                  </span>
                  <span className="hidden sm:inline">
                    {isAdding ? 'Adding...' : `Add ${selectedCreatorIds.size > 0 ? `${selectedCreatorIds.size} ` : ''}Creator${selectedCreatorIds.size !== 1 ? 's' : ''} to ${selectedCampaignIds.length} Campaign${selectedCampaignIds.length !== 1 ? 's' : ''}`}
                  </span>
                </Button>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
        <Input
          placeholder="Search creators by name, handle, or niche..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="pl-9 h-10 bg-white/[0.03] border-white/[0.08] text-white placeholder:text-slate-500"
        />
      </div>

      {/* Select All */}
      {availableCreators.length > 0 && selectedCampaignIds.length > 0 && (
        <div className="flex items-center justify-between">
          <button
            onClick={handleSelectAll}
            className="text-sm text-primary hover:text-primary/80 flex items-center gap-2"
          >
            <div className={`w-4 h-4 rounded border-2 flex items-center justify-center ${
              selectedCreatorIds.size === availableCreators.length
                ? 'bg-primary border-primary'
                : 'border-white/[0.2]'
            }`}>
              {selectedCreatorIds.size === availableCreators.length && (
                <Check className="w-3 h-3 text-black" />
              )}
            </div>
            {selectedCreatorIds.size === availableCreators.length ? 'Deselect All' : 'Select All'}
          </button>
          <p className="text-sm text-slate-400">
            {selectedCreatorIds.size} of {availableCreators.length} selected
          </p>
        </div>
      )}

      {/* Creators Grid */}
      {availableCreators.length === 0 ? (
        <Card className="bg-[#0D0D0D] border-white/[0.08]">
          <CardContent className="flex flex-col items-center justify-center py-16">
            <p className="text-sm text-slate-400">
              {selectedCampaignIds.length > 0
                ? 'All available creators are already in the selected campaign(s)'
                : (searchQuery ? 'No creators match your search' : 'No creators found')}
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {pagedCreators.map((creator) => {
            const isSelected = selectedCreatorIds.has(creator.id);

            return (
              <Card
                key={creator.id}
                className={`bg-[#0D0D0D] border-white/[0.08] hover:border-white/[0.12] transition-all ${
                  isSelected ? 'ring-2 ring-primary' : ''
                }`}
              >
                <CardContent className="p-4">
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex items-center gap-2 flex-1 min-w-0">
                      {selectedCampaignIds.length > 0 && (
                        <button
                          onClick={() => handleToggleCreator(creator.id)}
                          className={`flex-shrink-0 w-5 h-5 rounded border-2 flex items-center justify-center mt-0.5 ${
                            isSelected
                              ? 'bg-primary border-primary'
                              : 'border-white/[0.2]'
                          }`}
                        >
                          {isSelected && <Check className="w-3 h-3 text-black" />}
                        </button>
                      )}
                      <div className="flex-1 min-w-0">
                        <div className="font-medium text-white text-sm truncate">{creator.name}</div>
                        <div className="text-xs text-slate-500 truncate">@{creator.handle}</div>
                      </div>
                    </div>
                    {(() => {
                      const platformIcon = normalizePlatform(creator.platform);
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

                  <div className="space-y-2">
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-slate-400">Followers</span>
                      <span className="text-white font-medium">
                        {(creator.follower_count / 1000).toFixed(0)}K
                      </span>
                    </div>
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-slate-400">Engagement</span>
                      <span className="text-emerald-400 font-medium">{creator.avg_engagement}%</span>
                    </div>
                    {creator.niche && (
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-slate-400">Niche</span>
                        <span className="text-white">{creator.niche}</span>
                      </div>
                    )}
                    {creator.location && (
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-slate-400">Location</span>
                        <span className="text-white">{creator.location}</span>
                      </div>
                    )}
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-slate-400">Campaigns</span>
                      <span className="text-white">{creator.campaigns}</span>
                    </div>
                  </div>

                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {availableCreators.length > 0 && totalPages > 1 && (
        <Card className="bg-[#0D0D0D] border-white/[0.08]">
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-2">
              <p className="text-sm text-slate-400">
                Showing {startIndex + 1}-{endIndex} of {availableCreators.length} creators
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
                      safeCurrentPage === 1
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
                      (page >= safeCurrentPage - 1 && page <= safeCurrentPage + 1)
                    ) {
                      return (
                        <PaginationItem key={page}>
                          <PaginationLink
                            href="#"
                            onClick={(e) => {
                              e.preventDefault();
                              setCurrentPage(page);
                            }}
                            isActive={safeCurrentPage === page}
                            className="cursor-pointer"
                          >
                            {page}
                          </PaginationLink>
                        </PaginationItem>
                      );
                    } else if (
                      page === safeCurrentPage - 2 ||
                      page === safeCurrentPage + 2
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
                      safeCurrentPage === totalPages
                        ? "pointer-events-none opacity-50"
                        : "cursor-pointer"
                    }
                  />
                </PaginationItem>
              </PaginationContent>
            </Pagination>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
