import React from 'react';
import { Card, CardContent } from './ui/card';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { 
  X, 
  Link2, 
  Users, 
  Clock, 
  CheckCircle2, 
  ChevronDown,
  Circle,
  AlertCircle,
  Eye,
  EyeOff,
  Lock,
  Zap,
  Calendar,
  FileText,
  Image,
  Bell,
  CheckSquare,
  Target
} from 'lucide-react';

interface ActivityFormDialogProps {
  open: boolean;
  onClose: () => void;
  onSave: () => void;
  formData: any;
  setFormData: (data: any) => void;
  campaigns: any[];
  creators: any[];
  title: string;
  selectedDate: Date | null;
}

const activityTypeIcons: Record<string, React.ReactNode> = {
  post: <Calendar className="w-4 h-4" />,
  brief: <FileText className="w-4 h-4" />,
  asset: <Image className="w-4 h-4" />,
  reminder: <Bell className="w-4 h-4" />,
  review: <CheckSquare className="w-4 h-4" />,
  milestone: <Target className="w-4 h-4" />,
};

const activityTypeLabels: Record<string, string> = {
  post: 'Post',
  brief: 'Brief',
  asset: 'Asset',
  reminder: 'Reminder',
  review: 'Review',
  milestone: 'Milestone',
};

const statusIcons: Record<string, React.ReactNode> = {
  pending: <Circle className="w-4 h-4" />,
  briefed: <Clock className="w-4 h-4" />,
  active: <AlertCircle className="w-4 h-4" />,
  completed: <CheckCircle2 className="w-4 h-4" />,
};

const statusLabels: Record<string, string> = {
  pending: 'Pending',
  briefed: 'Briefed',
  active: 'Active',
  completed: 'Completed',
};

const visibilityIcons: Record<string, React.ReactNode> = {
  workspace: <Eye className="w-4 h-4" />,
  campaign: <Users className="w-4 h-4" />,
  private: <Lock className="w-4 h-4" />,
};

const visibilityLabels: Record<string, string> = {
  workspace: 'Workspace',
  campaign: 'Campaign Viewers',
  private: 'Private',
};

export function ActivityFormDialog({ 
  open, 
  onClose, 
  onSave, 
  formData, 
  setFormData, 
  campaigns, 
  creators, 
  title, 
  selectedDate 
}: ActivityFormDialogProps) {
  const [showCampaignDropdown, setShowCampaignDropdown] = React.useState(false);
  const [showCreatorDropdown, setShowCreatorDropdown] = React.useState(false);
  const campaignDropdownRef = React.useRef<HTMLDivElement>(null);
  const creatorDropdownRef = React.useRef<HTMLDivElement>(null);

  // Close dropdowns on outside click
  React.useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (campaignDropdownRef.current && !campaignDropdownRef.current.contains(event.target as Node)) {
        setShowCampaignDropdown(false);
      }
      if (creatorDropdownRef.current && !creatorDropdownRef.current.contains(event.target as Node)) {
        setShowCreatorDropdown(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  if (!open) return null;

  const toggleCampaign = (campaignId: number) => {
    const current = formData.linkedCampaigns || [];
    if (current.includes(campaignId)) {
      setFormData({ ...formData, linkedCampaigns: current.filter((id: number) => id !== campaignId) });
    } else {
      setFormData({ ...formData, linkedCampaigns: [...current, campaignId] });
    }
  };

  const toggleCreator = (creatorId: number) => {
    const current = formData.linkedCreators || [];
    if (current.includes(creatorId)) {
      setFormData({ ...formData, linkedCreators: current.filter((id: number) => id !== creatorId) });
    } else {
      setFormData({ ...formData, linkedCreators: [...current, creatorId] });
    }
  };

  const removeCampaign = (campaignId: number) => {
    const current = formData.linkedCampaigns || [];
    setFormData({ ...formData, linkedCampaigns: current.filter((id: number) => id !== campaignId) });
  };

  const removeCreator = (creatorId: number) => {
    const current = formData.linkedCreators || [];
    setFormData({ ...formData, linkedCreators: current.filter((id: number) => id !== creatorId) });
  };

  const selectedCampaigns = campaigns.filter((c: any) => (formData.linkedCampaigns || []).includes(c.id));
  const selectedCreatorsList = creators.filter((c: any) => (formData.linkedCreators || []).includes(c.id));

  const getPlatformColor = (platform: string) => {
    const colors: Record<string, string> = {
      tiktok: '#ff0050',
      instagram: '#e4405f',
      youtube: '#ff0000',
      twitter: '#1da1f2',
      facebook: '#1877f2',
    };
    return colors[platform] || '#64748b';
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4" onClick={onClose}>
      <Card className="bg-[#0D0D0D] border-white/[0.08] max-w-3xl w-full max-h-[90vh] overflow-y-auto shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <CardContent className="p-0">
          {/* Header */}
          <div className="sticky top-0 bg-[#0D0D0D] border-b border-white/[0.08] px-6 py-5 z-10">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="font-semibold text-white tracking-tight">{title}</h2>
                <p className="text-xs text-slate-500 mt-1">Schedule and manage campaign activities</p>
              </div>
              <button
                onClick={onClose}
                className="w-8 h-8 rounded-lg hover:bg-white/[0.06] flex items-center justify-center transition-all duration-200"
              >
                <X className="w-4 h-4 text-slate-400" />
              </button>
            </div>
          </div>

          {/* Form Content */}
          <div className="px-6 py-6 space-y-8">
            {/* Basic Details */}
            <div className="space-y-5">
              <div>
                <label className="block text-xs font-medium text-slate-400 uppercase tracking-wide mb-2.5">
                  Activity Title <span className="text-red-400 ml-0.5">*</span>
                </label>
                <Input
                  placeholder="Enter a descriptive title"
                  value={formData.title || ''}
                  onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                  className="h-11 bg-white/[0.03] border-white/[0.08] text-white placeholder:text-slate-600 focus:border-primary/40 focus:ring-1 focus:ring-primary/20 transition-all"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-slate-400 uppercase tracking-wide mb-2.5">
                    Type
                  </label>
                  <select
                    value={formData.activityType || 'post'}
                    onChange={(e) => setFormData({ ...formData, activityType: e.target.value })}
                    className="w-full h-11 pl-3 pr-10 bg-white/[0.03] border border-white/[0.08] rounded-lg text-white text-sm focus:border-primary/40 focus:ring-1 focus:ring-primary/20 transition-all appearance-none cursor-pointer [&>option]:bg-[#0D0D0D] [&>option]:text-white"
                    style={{
                      backgroundImage: `url("data:image/svg+xml,%3Csvg width='12' height='8' viewBox='0 0 12 8' fill='none' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M1 1.5L6 6.5L11 1.5' stroke='%2364748b' stroke-width='1.5' stroke-linecap='round' stroke-linejoin='round'/%3E%3C/svg%3E")`,
                      backgroundRepeat: 'no-repeat',
                      backgroundPosition: 'right 0.75rem center',
                    }}
                  >
                    {Object.entries(activityTypeLabels).map(([value, label]) => (
                      <option key={value} value={value}>{label}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-400 uppercase tracking-wide mb-2.5">
                    Status
                  </label>
                  <select
                    value={formData.status || 'pending'}
                    onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                    className="w-full h-11 pl-3 pr-10 bg-white/[0.03] border border-white/[0.08] rounded-lg text-white text-sm focus:border-primary/40 focus:ring-1 focus:ring-primary/20 transition-all appearance-none cursor-pointer [&>option]:bg-[#0D0D0D] [&>option]:text-white"
                    style={{
                      backgroundImage: `url("data:image/svg+xml,%3Csvg width='12' height='8' viewBox='0 0 12 8' fill='none' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M1 1.5L6 6.5L11 1.5' stroke='%2364748b' stroke-width='1.5' stroke-linecap='round' stroke-linejoin='round'/%3E%3C/svg%3E")`,
                      backgroundRepeat: 'no-repeat',
                      backgroundPosition: 'right 0.75rem center',
                    }}
                  >
                    {Object.entries(statusLabels).map(([value, label]) => (
                      <option key={value} value={value}>{label}</option>
                    ))}
                  </select>
                </div>
              </div>
            </div>

            {/* Divider */}
            <div className="border-t border-white/[0.06]"></div>

            {/* Linked Resources */}
            <div className="space-y-5">
              <div>
                <div className="flex items-center gap-2 mb-2.5">
                  <Link2 className="w-3.5 h-3.5 text-slate-400" />
                  <label className="text-xs font-medium text-slate-400 uppercase tracking-wide">
                    Linked Campaigns
                  </label>
                </div>
                
                {/* Selected Campaigns Tags */}
                {selectedCampaigns.length > 0 && (
                  <div className="flex flex-wrap gap-2 mb-3">
                    {selectedCampaigns.map((campaign: any) => (
                      <div
                        key={campaign.id}
                        className="inline-flex items-center gap-2 px-3 py-1.5 bg-white/[0.04] hover:bg-white/[0.06] border border-white/[0.08] rounded-lg text-sm text-white transition-all group"
                      >
                        <span className="text-xs font-medium">{campaign.name}</span>
                        <button
                          onClick={() => removeCampaign(campaign.id)}
                          className="hover:bg-white/[0.1] rounded p-0.5 transition-colors"
                        >
                          <X className="w-3 h-3 text-slate-400 group-hover:text-white transition-colors" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}

                {/* Dropdown */}
                <div className="relative" ref={campaignDropdownRef}>
                  <button
                    type="button"
                    onClick={() => setShowCampaignDropdown(!showCampaignDropdown)}
                    className="w-full h-11 px-4 bg-white/[0.03] border border-white/[0.08] rounded-lg text-left text-sm text-slate-400 hover:bg-white/[0.05] hover:border-white/[0.12] transition-all duration-200 flex items-center justify-between group"
                  >
                    <span>
                      {selectedCampaigns.length === 0 
                        ? 'Select campaigns' 
                        : `${selectedCampaigns.length} campaign${selectedCampaigns.length !== 1 ? 's' : ''} selected`
                      }
                    </span>
                    <ChevronDown className={`w-4 h-4 text-slate-500 transition-transform duration-200 ${showCampaignDropdown ? 'rotate-180' : ''}`} />
                  </button>

                  {showCampaignDropdown && (
                    <div className="absolute z-20 w-full mt-2 bg-[#0D0D0D] border border-white/[0.08] rounded-lg shadow-2xl max-h-64 overflow-y-auto">
                      {campaigns.length > 0 ? (
                        <div className="p-1">
                          {campaigns.map((campaign: any) => (
                            <label
                              key={campaign.id}
                              className="flex items-center gap-3 px-3 py-2.5 hover:bg-white/[0.04] rounded-md cursor-pointer transition-colors group"
                            >
                              <input
                                type="checkbox"
                                checked={(formData.linkedCampaigns || []).includes(campaign.id)}
                                onChange={() => toggleCampaign(campaign.id)}
                                className="rounded border-white/[0.2] bg-white/[0.03] text-primary focus:ring-primary/20 focus:ring-offset-0 focus:ring-2 transition-all cursor-pointer"
                              />
                              <span className="text-sm text-white font-medium group-hover:text-primary transition-colors">{campaign.name}</span>
                            </label>
                          ))}
                        </div>
                      ) : (
                        <div className="px-4 py-8 text-center text-sm text-slate-500">
                          No campaigns available
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>

              <div>
                <div className="flex items-center gap-2 mb-2.5">
                  <Users className="w-3.5 h-3.5 text-slate-400" />
                  <label className="text-xs font-medium text-slate-400 uppercase tracking-wide">
                    Linked Creators
                  </label>
                </div>
                
                {/* Selected Creators Tags */}
                {selectedCreatorsList.length > 0 && (
                  <div className="flex flex-wrap gap-2 mb-3">
                    {selectedCreatorsList.map((creator: any) => (
                      <div
                        key={creator.id}
                        className="inline-flex items-center gap-2 px-3 py-1.5 bg-white/[0.04] hover:bg-white/[0.06] border border-white/[0.08] rounded-lg transition-all group"
                      >
                        <div className="flex items-center gap-2">
                          <div 
                            className="w-5 h-5 rounded-full flex items-center justify-center text-white text-[10px] font-semibold"
                            style={{ backgroundColor: getPlatformColor(creator.platform) }}
                          >
                            {creator.name.charAt(0).toUpperCase()}
                          </div>
                          <span className="text-xs font-medium text-white">{creator.name}</span>
                        </div>
                        <button
                          onClick={() => removeCreator(creator.id)}
                          className="hover:bg-white/[0.1] rounded p-0.5 transition-colors"
                        >
                          <X className="w-3 h-3 text-slate-400 group-hover:text-white transition-colors" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}

                {/* Dropdown */}
                <div className="relative" ref={creatorDropdownRef}>
                  <button
                    type="button"
                    onClick={() => setShowCreatorDropdown(!showCreatorDropdown)}
                    className="w-full h-11 px-4 bg-white/[0.03] border border-white/[0.08] rounded-lg text-left text-sm text-slate-400 hover:bg-white/[0.05] hover:border-white/[0.12] transition-all duration-200 flex items-center justify-between group"
                  >
                    <span>
                      {selectedCreatorsList.length === 0 
                        ? 'Select creators' 
                        : `${selectedCreatorsList.length} creator${selectedCreatorsList.length !== 1 ? 's' : ''} selected`
                      }
                    </span>
                    <ChevronDown className={`w-4 h-4 text-slate-500 transition-transform duration-200 ${showCreatorDropdown ? 'rotate-180' : ''}`} />
                  </button>

                  {showCreatorDropdown && (
                    <div className="absolute z-20 w-full mt-2 bg-[#0D0D0D] border border-white/[0.08] rounded-lg shadow-2xl max-h-64 overflow-y-auto">
                      {creators.length > 0 ? (
                        <div className="p-1">
                          {creators.map((creator: any) => (
                            <label
                              key={creator.id}
                              className="flex items-center gap-3 px-3 py-2.5 hover:bg-white/[0.04] rounded-md cursor-pointer transition-colors group"
                            >
                              <input
                                type="checkbox"
                                checked={(formData.linkedCreators || []).includes(creator.id)}
                                onChange={() => toggleCreator(creator.id)}
                                className="rounded border-white/[0.2] bg-white/[0.03] text-primary focus:ring-primary/20 focus:ring-offset-0 focus:ring-2 transition-all cursor-pointer"
                              />
                              <div className="flex items-center gap-2.5 flex-1">
                                <div 
                                  className="w-7 h-7 rounded-full flex items-center justify-center text-white text-xs font-semibold flex-shrink-0"
                                  style={{ backgroundColor: getPlatformColor(creator.platform) }}
                                >
                                  {creator.name.charAt(0).toUpperCase()}
                                </div>
                                <div className="flex-1 min-w-0">
                                  <div className="text-sm font-medium text-white group-hover:text-primary transition-colors truncate">{creator.name}</div>
                                  <div className="text-xs text-slate-500 capitalize mt-0.5">{creator.platform}</div>
                                </div>
                              </div>
                            </label>
                          ))}
                        </div>
                      ) : (
                        <div className="px-4 py-8 text-center text-sm text-slate-500">
                          No creators available
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Divider */}
            <div className="border-t border-white/[0.06]"></div>

            {/* Schedule & Settings */}
            <div className="space-y-5">
              <div>
                <label className="block text-xs font-medium text-slate-400 uppercase tracking-wide mb-2.5">
                  Platform
                </label>
                <select
                  value={formData.platform || ''}
                  onChange={(e) => setFormData({ ...formData, platform: e.target.value || undefined })}
                  className="w-full h-11 pl-3 pr-10 bg-white/[0.03] border border-white/[0.08] rounded-lg text-white text-sm focus:border-primary/40 focus:ring-1 focus:ring-primary/20 transition-all appearance-none cursor-pointer [&>option]:bg-[#0D0D0D] [&>option]:text-white"
                  style={{
                    backgroundImage: `url("data:image/svg+xml,%3Csvg width='12' height='8' viewBox='0 0 12 8' fill='none' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M1 1.5L6 6.5L11 1.5' stroke='%2364748b' stroke-width='1.5' stroke-linecap='round' stroke-linejoin='round'/%3E%3C/svg%3E")`,
                    backgroundRepeat: 'no-repeat',
                    backgroundPosition: 'right 0.75rem center',
                  }}
                >
                  <option value="">All platforms</option>
                  <option value="tiktok">TikTok</option>
                  <option value="instagram">Instagram</option>
                  <option value="youtube">YouTube</option>
                  <option value="twitter">Twitter</option>
                  <option value="facebook">Facebook</option>
                </select>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <div className="flex items-center gap-2 mb-2.5">
                    <Clock className="w-3.5 h-3.5 text-slate-400" />
                    <label className="text-xs font-medium text-slate-400 uppercase tracking-wide">
                      Tentative Date
                    </label>
                  </div>
                  <Input
                    type="datetime-local"
                    value={formData.tentativeDate ? formData.tentativeDate.slice(0, 16) : selectedDate ? selectedDate.toISOString().slice(0, 16) : ''}
                    onChange={(e) => setFormData({ ...formData, tentativeDate: e.target.value ? new Date(e.target.value).toISOString() : undefined })}
                    className="h-11 bg-white/[0.03] border-white/[0.08] text-white text-sm focus:border-primary/40 focus:ring-1 focus:ring-primary/20 transition-all"
                  />
                </div>

                <div>
                  <div className="flex items-center gap-2 mb-2.5">
                    <CheckCircle2 className="w-3.5 h-3.5 text-slate-400" />
                    <label className="text-xs font-medium text-slate-400 uppercase tracking-wide">
                      Confirmed Date
                    </label>
                  </div>
                  <Input
                    type="datetime-local"
                    value={formData.confirmedDate ? formData.confirmedDate.slice(0, 16) : ''}
                    onChange={(e) => setFormData({ ...formData, confirmedDate: e.target.value ? new Date(e.target.value).toISOString() : undefined })}
                    className="h-11 bg-white/[0.03] border-white/[0.08] text-white text-sm focus:border-primary/40 focus:ring-1 focus:ring-primary/20 transition-all"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-400 uppercase tracking-wide mb-2.5">
                  Assignees
                </label>
                <Input
                  placeholder="team@company.com, john@company.com"
                  value={(formData.assignees || []).join(', ')}
                  onChange={(e) => setFormData({ ...formData, assignees: e.target.value.split(',').map(s => s.trim()).filter(Boolean) })}
                  className="h-11 bg-white/[0.03] border-white/[0.08] text-white placeholder:text-slate-600 text-sm focus:border-primary/40 focus:ring-1 focus:ring-primary/20 transition-all"
                />
                <p className="text-xs text-slate-500 mt-2">Separate multiple assignees with commas</p>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-slate-400 uppercase tracking-wide mb-2.5">
                    Visibility
                  </label>
                  <select
                    value={formData.visibility || 'workspace'}
                    onChange={(e) => setFormData({ ...formData, visibility: e.target.value })}
                    className="w-full h-11 pl-3 pr-10 bg-white/[0.03] border border-white/[0.08] rounded-lg text-white text-sm focus:border-primary/40 focus:ring-1 focus:ring-primary/20 transition-all appearance-none cursor-pointer [&>option]:bg-[#0D0D0D] [&>option]:text-white"
                    style={{
                      backgroundImage: `url("data:image/svg+xml,%3Csvg width='12' height='8' viewBox='0 0 12 8' fill='none' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M1 1.5L6 6.5L11 1.5' stroke='%2364748b' stroke-width='1.5' stroke-linecap='round' stroke-linejoin='round'/%3E%3C/svg%3E")`,
                      backgroundRepeat: 'no-repeat',
                      backgroundPosition: 'right 0.75rem center',
                    }}
                  >
                    {Object.entries(visibilityLabels).map(([value, label]) => (
                      <option key={value} value={value}>{label}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-400 uppercase tracking-wide mb-2.5">
                    Tracking
                  </label>
                  <label className="flex items-center gap-3 h-11 px-4 rounded-lg bg-white/[0.03] border border-white/[0.08] cursor-pointer hover:bg-white/[0.05] hover:border-white/[0.12] transition-all duration-200 group">
                    <input
                      type="checkbox"
                      checked={formData.autoTracking !== false}
                      onChange={(e) => setFormData({ ...formData, autoTracking: e.target.checked })}
                      className="rounded border-white/[0.2] bg-white/[0.03] text-primary focus:ring-primary/20 focus:ring-offset-0 focus:ring-2 transition-all cursor-pointer"
                    />
                    <div className="flex items-center gap-2 flex-1">
                      <Zap className="w-4 h-4 text-slate-400 group-hover:text-primary transition-colors" />
                      <span className="text-sm font-medium text-white">Auto-track</span>
                    </div>
                  </label>
                </div>
              </div>
            </div>
          </div>

          {/* Footer Actions */}
          <div className="sticky bottom-0 bg-[#0D0D0D] border-t border-white/[0.08] px-6 py-4">
            <div className="flex gap-3">
              <Button 
                onClick={onSave} 
                className="flex-1 h-11 bg-primary hover:bg-primary/90 text-white font-medium shadow-lg shadow-primary/20 transition-all duration-200"
              >
                {title === 'New Activity' ? 'Create Activity' : 'Save Changes'}
              </Button>
              <Button
                onClick={onClose}
                variant="outline"
                className="h-11 px-6 bg-transparent hover:bg-white/[0.04] border-white/[0.08] hover:border-white/[0.12] text-slate-300 hover:text-white transition-all duration-200"
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
