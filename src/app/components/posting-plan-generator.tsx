import React, { useState } from 'react';
import { Card, CardContent } from './ui/card';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { X, Sparkles, Calendar, Users } from 'lucide-react';
import {
  PlatformIcon,
  normalizePlatform,
  getPlatformLabel,
} from './ui/PlatformIcon';
import { addDays, format } from 'date-fns';
import { toast } from 'sonner';

interface PostingPlanGeneratorProps {
  open: boolean;
  onClose: () => void;
  campaigns: any[];
  creators: any[];
  onGenerate: (activities: any[]) => void;
}

export function PostingPlanGenerator({
  open,
  onClose,
  campaigns,
  creators,
  onGenerate,
}: PostingPlanGeneratorProps) {
  const [selectedCampaign, setSelectedCampaign] = useState<number | null>(null);
  const [selectedCreators, setSelectedCreators] = useState<number[]>([]);
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [cadence, setCadence] = useState<'daily' | '3x-weekly' | 'weekends'>('daily');
  const [activityType, setActivityType] = useState<'post' | 'brief' | 'review'>('post');

  if (!open) return null;

  const handleGenerate = () => {
    if (!selectedCampaign || selectedCreators.length === 0 || !startDate || !endDate) {
      toast.error('Please fill in all fields');
      return;
    }

    const start = new Date(startDate);
    const end = new Date(endDate);
    const activities: any[] = [];

    selectedCreators.forEach(creatorId => {
      const creator = creators.find(c => c.id === creatorId);
      if (!creator) return;

      let currentDate = new Date(start);
      let activityCount = 0;

      while (currentDate <= end) {
        let shouldAddActivity = false;

        switch (cadence) {
          case 'daily':
            shouldAddActivity = true;
            break;
          case '3x-weekly':
            // Monday, Wednesday, Friday
            shouldAddActivity = [1, 3, 5].includes(currentDate.getDay());
            break;
          case 'weekends':
            // Saturday, Sunday
            shouldAddActivity = [0, 6].includes(currentDate.getDay());
            break;
        }

        if (shouldAddActivity) {
          activities.push({
            id: Date.now() + activityCount++,
            title: `${creator.name} - ${activityType.charAt(0).toUpperCase() + activityType.slice(1)}`,
            linkedCampaigns: [selectedCampaign],
            linkedCreators: [creatorId],
            platform: creator.platform,
            status: 'pending',
            tentativeDate: currentDate.toISOString(),
            notes: [],
            owner: 'You',
            assignees: [],
            visibility: 'campaign',
            autoTracking: true,
            activityType,
          });
        }

        currentDate = addDays(currentDate, 1);
      }
    });

    onGenerate(activities);
  };

  const toggleCreator = (creatorId: number) => {
    if (selectedCreators.includes(creatorId)) {
      setSelectedCreators(selectedCreators.filter(id => id !== creatorId));
    } else {
      setSelectedCreators([...selectedCreators, creatorId]);
    }
  };

  const estimatedActivities = () => {
    if (!startDate || !endDate || selectedCreators.length === 0) return 0;

    const start = new Date(startDate);
    const end = new Date(endDate);
    const days = Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1;

    let activitiesPerCreator = 0;
    switch (cadence) {
      case 'daily':
        activitiesPerCreator = days;
        break;
      case '3x-weekly':
        activitiesPerCreator = Math.floor(days / 7) * 3;
        break;
      case 'weekends':
        activitiesPerCreator = Math.floor(days / 7) * 2;
        break;
    }

    return activitiesPerCreator * selectedCreators.length;
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <Card className="bg-[#1A1A1A] border-white/[0.08] max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        <CardContent className="p-6">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                <Sparkles className="w-5 h-5 text-primary" />
              </div>
              <div>
                <h3 className="text-lg font-semibold text-white">Posting Plan Generator</h3>
                <p className="text-sm text-slate-400">Auto-generate scheduled activities for your campaign</p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="w-8 h-8 rounded-md hover:bg-white/[0.06] flex items-center justify-center transition-colors"
            >
              <X className="w-4 h-4 text-slate-400" />
            </button>
          </div>

          <div className="space-y-6">
            {/* Campaign Selection */}
            <div>
              <label className="block text-sm font-medium text-white mb-2">
                <Calendar className="w-4 h-4 inline mr-1" />
                Select Campaign *
              </label>
              <select
                value={selectedCampaign || ''}
                onChange={(e) => setSelectedCampaign(parseInt(e.target.value))}
                className="w-full h-10 px-3 bg-white/[0.03] border border-white/[0.08] rounded-md text-white [&>option]:bg-[#1A1A1A] [&>option]:text-white"
              >
                <option value="">Choose a campaign...</option>
                {campaigns.map(campaign => (
                  <option key={campaign.id} value={campaign.id}>{campaign.name}</option>
                ))}
              </select>
            </div>

            {/* Creator Selection */}
            <div>
              <label className="block text-sm font-medium text-white mb-2">
                <Users className="w-4 h-4 inline mr-1" />
                Select Creators * ({selectedCreators.length} selected)
              </label>
              <div className="max-h-48 overflow-y-auto p-3 bg-white/[0.03] border border-white/[0.08] rounded-md space-y-2">
                {creators.length > 0 ? (
                  creators.map(creator => (
                    <label
                      key={creator.id}
                      className="flex items-center gap-3 p-2 rounded-md hover:bg-white/[0.03] cursor-pointer transition-colors"
                    >
                      <input
                        type="checkbox"
                        checked={selectedCreators.includes(creator.id)}
                        onChange={() => toggleCreator(creator.id)}
                        className="rounded border-white/[0.08]"
                      />
                      <div className="flex items-center gap-2 flex-1">
                        <div className="w-8 h-8 rounded-full bg-gradient-to-br from-primary to-cyan-400 flex items-center justify-center text-white text-xs font-semibold">
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
                    </label>
                  ))
                ) : (
                  <div className="text-center py-4 text-sm text-slate-500">No creators available</div>
                )}
              </div>
            </div>

            {/* Date Range */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-white mb-2">Start Date *</label>
                <Input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="h-10 bg-white/[0.03] border-white/[0.08] text-white"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-white mb-2">End Date *</label>
                <Input
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  className="h-10 bg-white/[0.03] border-white/[0.08] text-white"
                />
              </div>
            </div>

            {/* Cadence */}
            <div>
              <label className="block text-sm font-medium text-white mb-2">Posting Cadence</label>
              <div className="grid grid-cols-3 gap-3">
                <button
                  onClick={() => setCadence('daily')}
                  className={`p-3 rounded-lg border transition-all ${
                    cadence === 'daily'
                      ? 'bg-primary/10 border-primary/20 text-primary'
                      : 'bg-white/[0.03] border-white/[0.08] text-slate-400 hover:border-white/[0.12]'
                  }`}
                >
                  <div className="font-medium text-sm">Daily</div>
                  <div className="text-xs mt-1 opacity-80">Every day</div>
                </button>
                <button
                  onClick={() => setCadence('3x-weekly')}
                  className={`p-3 rounded-lg border transition-all ${
                    cadence === '3x-weekly'
                      ? 'bg-primary/10 border-primary/20 text-primary'
                      : 'bg-white/[0.03] border-white/[0.08] text-slate-400 hover:border-white/[0.12]'
                  }`}
                >
                  <div className="font-medium text-sm">3x Weekly</div>
                  <div className="text-xs mt-1 opacity-80">Mon, Wed, Fri</div>
                </button>
                <button
                  onClick={() => setCadence('weekends')}
                  className={`p-3 rounded-lg border transition-all ${
                    cadence === 'weekends'
                      ? 'bg-primary/10 border-primary/20 text-primary'
                      : 'bg-white/[0.03] border-white/[0.08] text-slate-400 hover:border-white/[0.12]'
                  }`}
                >
                  <div className="font-medium text-sm">Weekends</div>
                  <div className="text-xs mt-1 opacity-80">Sat, Sun</div>
                </button>
              </div>
            </div>

            {/* Activity Type */}
            <div>
              <label className="block text-sm font-medium text-white mb-2">Activity Type</label>
              <select
                value={activityType}
                onChange={(e) => setActivityType(e.target.value as any)}
                className="w-full h-10 px-3 bg-white/[0.03] border border-white/[0.08] rounded-md text-white [&>option]:bg-[#1A1A1A] [&>option]:text-white"
              >
                <option value="post">Post</option>
                <option value="brief">Brief</option>
                <option value="review">Review</option>
              </select>
            </div>

            {/* Preview */}
            {estimatedActivities() > 0 && (
              <div className="p-4 rounded-lg bg-primary/5 border border-primary/20">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-sm font-medium text-white mb-1">Estimated Activities</div>
                    <div className="text-xs text-slate-400">
                      {selectedCreators.length} creator{selectedCreators.length !== 1 ? 's' : ''} × {cadence} cadence
                    </div>
                  </div>
                  <div className="text-3xl font-semibold text-primary">{estimatedActivities()}</div>
                </div>
              </div>
            )}

            {/* Actions */}
            <div className="flex gap-3 pt-4">
              <Button
                onClick={handleGenerate}
                disabled={!selectedCampaign || selectedCreators.length === 0 || !startDate || !endDate}
                className="flex-1 h-10 bg-primary hover:bg-primary/90 text-white disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Sparkles className="w-4 h-4 mr-2" />
                Generate Plan
              </Button>
              <Button
                onClick={onClose}
                variant="outline"
                className="h-10 px-4 bg-white/[0.03] hover:bg-white/[0.06] border-white/[0.08] text-slate-300"
              >
                Cancel
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
