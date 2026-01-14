import React, { useState } from 'react';
import { Card, CardContent } from './ui/card';
import { Button } from './ui/button';
import { X, Users, CheckCircle2, Clock, AlertCircle, Link2, TrendingUp } from 'lucide-react';
import {
  PlatformIcon,
  normalizePlatform,
  getPlatformLabel,
} from './ui/PlatformIcon';
import { toast } from 'sonner';

interface CreatorCompliancePanelProps {
  open: boolean;
  onClose: () => void;
  campaigns: any[];
  creators: any[];
  activities: any[];
}

export function CreatorCompliancePanel({
  open,
  onClose,
  campaigns,
  creators,
  activities,
}: CreatorCompliancePanelProps) {
  const [selectedCampaign, setSelectedCampaign] = useState<number | null>(null);

  if (!open) return null;

  const getCreatorStatus = (campaignId: number, creatorId: number) => {
    const campaign = campaigns.find(c => c.id === campaignId);
    const creator = creators.find(c => c.id === creatorId);
    
    if (!campaign || !creator) return 'pending';

    // Check if there's a post from this creator
    if (campaign.posts) {
      const post = campaign.posts.find((p: any) => p.creatorName === creator.name);
      if (post) {
        if (post.status === 'live') return 'live';
        if (post.url) return 'link-added';
      }
    }

    // Check if there's an activity for this creator
    const activity = activities.find(a => 
      a.linkedCampaigns.includes(campaignId) && 
      a.linkedCreators.includes(creatorId)
    );

    if (activity) {
      if (activity.status === 'briefed') return 'briefed';
    }

    return 'pending';
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'live': return '#10b981';
      case 'link-added': return '#0ea5e9';
      case 'briefed': return '#f59e0b';
      case 'pending': return '#64748b';
      default: return '#64748b';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'live': return <CheckCircle2 className="w-4 h-4" />;
      case 'link-added': return <Link2 className="w-4 h-4" />;
      case 'briefed': return <Clock className="w-4 h-4" />;
      case 'pending': return <AlertCircle className="w-4 h-4" />;
      default: return <AlertCircle className="w-4 h-4" />;
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'live': return 'Live';
      case 'link-added': return 'Link Added';
      case 'briefed': return 'Briefed';
      case 'pending': return 'Pending';
      default: return 'Unknown';
    }
  };

  // Get creators for selected campaign
  const campaignCreators = selectedCampaign
    ? activities
        .filter(a => a.linkedCampaigns.includes(selectedCampaign))
        .flatMap(a => a.linkedCreators)
        .filter((value, index, self) => self.indexOf(value) === index)
        .map(id => creators.find(c => c.id === id))
        .filter(Boolean)
    : [];

  const stats = selectedCampaign ? {
    total: campaignCreators.length,
    live: campaignCreators.filter(c => getCreatorStatus(selectedCampaign, c.id) === 'live').length,
    linkAdded: campaignCreators.filter(c => getCreatorStatus(selectedCampaign, c.id) === 'link-added').length,
    briefed: campaignCreators.filter(c => getCreatorStatus(selectedCampaign, c.id) === 'briefed').length,
    pending: campaignCreators.filter(c => getCreatorStatus(selectedCampaign, c.id) === 'pending').length,
  } : { total: 0, live: 0, linkAdded: 0, briefed: 0, pending: 0 };

  const complianceRate = stats.total > 0 ? ((stats.live / stats.total) * 100).toFixed(0) : 0;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <Card className="bg-[#1A1A1A] border-white/[0.08] max-w-3xl w-full max-h-[90vh] overflow-y-auto">
        <CardContent className="p-6">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-emerald-500/10 flex items-center justify-center">
                <TrendingUp className="w-5 h-5 text-emerald-400" />
              </div>
              <div>
                <h3 className="text-lg font-semibold text-white">Creator Compliance</h3>
                <p className="text-sm text-slate-400">Track creator posting status by campaign</p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="w-8 h-8 rounded-md hover:bg-white/[0.06] flex items-center justify-center transition-colors"
            >
              <X className="w-4 h-4 text-slate-400" />
            </button>
          </div>

          {/* Campaign Selection */}
          <div className="mb-6">
            <label className="block text-sm font-medium text-white mb-2">Select Campaign</label>
            <select
              value={selectedCampaign || ''}
              onChange={(e) => setSelectedCampaign(parseInt(e.target.value) || null)}
              className="w-full h-10 px-3 bg-white/[0.03] border border-white/[0.08] rounded-md text-white [&>option]:bg-[#1A1A1A] [&>option]:text-white"
            >
              <option value="">Choose a campaign...</option>
              {campaigns.map(campaign => (
                <option key={campaign.id} value={campaign.id}>{campaign.name}</option>
              ))}
            </select>
          </div>

          {selectedCampaign ? (
            <>
              {/* Stats Overview */}
              <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 mb-6">
                <div className="p-3 rounded-lg bg-white/[0.03] border border-white/[0.06]">
                  <div className="text-2xl font-semibold text-white">{stats.total}</div>
                  <div className="text-xs text-slate-500">Total</div>
                </div>
                <div className="p-3 rounded-lg bg-emerald-500/5 border border-emerald-500/20">
                  <div className="text-2xl font-semibold text-emerald-400">{stats.live}</div>
                  <div className="text-xs text-slate-500">Live</div>
                </div>
                <div className="p-3 rounded-lg bg-primary/5 border border-primary/20">
                  <div className="text-2xl font-semibold text-primary">{stats.linkAdded}</div>
                  <div className="text-xs text-slate-500">Link Added</div>
                </div>
                <div className="p-3 rounded-lg bg-amber-500/5 border border-amber-500/20">
                  <div className="text-2xl font-semibold text-amber-400">{stats.briefed}</div>
                  <div className="text-xs text-slate-500">Briefed</div>
                </div>
                <div className="p-3 rounded-lg bg-white/[0.03] border border-white/[0.06]">
                  <div className="text-2xl font-semibold text-slate-400">{stats.pending}</div>
                  <div className="text-xs text-slate-500">Pending</div>
                </div>
              </div>

              {/* Compliance Rate */}
              <div className="p-4 rounded-lg bg-white/[0.03] border border-white/[0.06] mb-6">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-sm font-medium text-white">Compliance Rate</span>
                  <span className="text-2xl font-semibold text-emerald-400">{complianceRate}%</span>
                </div>
                <div className="h-2 bg-white/[0.05] rounded-full overflow-hidden">
                  <div 
                    className="h-full bg-emerald-400 rounded-full transition-all"
                    style={{ width: `${complianceRate}%` }}
                  />
                </div>
                <div className="mt-2 text-xs text-slate-500">
                  {stats.live} of {stats.total} creators have posted live content
                </div>
              </div>

              {/* Creators List */}
              <div>
                <h4 className="text-sm font-medium text-white mb-3">
                  <Users className="w-4 h-4 inline mr-1" />
                  Creator Status ({campaignCreators.length})
                </h4>
                {campaignCreators.length > 0 ? (
                  <div className="space-y-2 max-h-96 overflow-y-auto">
                    {campaignCreators.map(creator => {
                      const status = getCreatorStatus(selectedCampaign, creator.id);
                      return (
                        <div
                          key={creator.id}
                          className="flex items-center justify-between p-3 rounded-lg bg-white/[0.03] border border-white/[0.06] hover:border-white/[0.08] transition-colors"
                        >
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-primary to-cyan-400 flex items-center justify-center text-white font-semibold">
                              {creator.name.charAt(0)}
                            </div>
                            <div>
                              <div className="text-sm font-medium text-white">{creator.name}</div>
                              <div className="text-xs text-slate-500 flex items-center gap-2">
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
                          </div>
                          <div 
                            className="flex items-center gap-2 px-3 py-1.5 rounded-md text-sm font-medium"
                            style={{ 
                              backgroundColor: `${getStatusColor(status)}15`,
                              color: getStatusColor(status),
                              border: `1px solid ${getStatusColor(status)}40`
                            }}
                          >
                            {getStatusIcon(status)}
                            {getStatusLabel(status)}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div className="text-center py-12">
                    <div className="w-12 h-12 rounded-lg bg-white/[0.03] flex items-center justify-center mx-auto mb-3">
                      <Users className="w-6 h-6 text-slate-600" />
                    </div>
                    <p className="text-sm text-slate-500">No creators assigned to this campaign</p>
                    <p className="text-xs text-slate-600 mt-1">Create activities and link creators to track compliance</p>
                  </div>
                )}
              </div>

              {/* Actions */}
              {campaignCreators.length > 0 && (
                <div className="mt-6 pt-4 border-t border-white/[0.06] flex gap-3">
                  <Button
                    onClick={() => toast.info('Reminder feature coming soon!')}
                    variant="outline"
                    className="flex-1 h-9 bg-white/[0.03] hover:bg-white/[0.06] border-white/[0.08] text-slate-300"
                  >
                    Send Reminders
                  </Button>
                  <Button
                    onClick={() => {
                      const csv = [
                        ['Creator', 'Platform', 'Status'],
                        ...campaignCreators.map(c => [
                          c.name,
                          c.platform,
                          getStatusLabel(getCreatorStatus(selectedCampaign, c.id))
                        ])
                      ].map(row => row.join(',')).join('\n');
                      
                      const blob = new Blob([csv], { type: 'text/csv' });
                      const url = window.URL.createObjectURL(blob);
                      const a = document.createElement('a');
                      a.href = url;
                      a.download = `compliance-report-${selectedCampaign}.csv`;
                      a.click();
                    }}
                    variant="outline"
                    className="flex-1 h-9 bg-white/[0.03] hover:bg-white/[0.06] border-white/[0.08] text-slate-300"
                  >
                    Export Report
                  </Button>
                </div>
              )}
            </>
          ) : (
            <div className="text-center py-16">
              <div className="w-12 h-12 rounded-lg bg-white/[0.03] flex items-center justify-center mx-auto mb-3">
                <TrendingUp className="w-6 h-6 text-slate-600" />
              </div>
              <p className="text-sm text-slate-500">Select a campaign to view compliance</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
