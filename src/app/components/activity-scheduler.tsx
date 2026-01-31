import React, { useState, useEffect } from 'react';
import { Card, CardContent } from './ui/card';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { ResponsiveConfirmDialog } from './ui/responsive-confirm-dialog';
import {
  ChevronLeft,
  ChevronRight,
  Calendar as CalendarIcon,
  Plus,
  Filter,
  List,
  Grid3x3,
  X,
  Edit2,
  Trash2,
  Users,
  Link2,
  Clock,
  CheckCircle2,
  Circle,
  AlertCircle,
  MessageSquare,
  Sparkles,
  GripVertical,
  TrendingUp,
  ArrowLeft,
} from 'lucide-react';
import {
  format,
  startOfWeek,
  endOfWeek,
  addWeeks,
  subWeeks,
  eachDayOfInterval,
  isSameDay,
  parseISO,
  addDays,
  startOfMonth,
  endOfMonth,
  isSameMonth,
} from 'date-fns';
import { ActivityDetailDrawer } from './activity-detail-drawer';
import { PostingPlanGenerator } from './posting-plan-generator';
import { CreatorCompliancePanel } from './creator-compliance-panel';
import { ActivityFormDialog } from './activity-form-dialog';
import { toast } from 'sonner';

interface Activity {
  id: number;
  title: string;
  linkedCampaigns: number[];
  linkedCreators: number[];
  platform?: 'tiktok' | 'instagram' | 'youtube';
  status: 'pending' | 'briefed' | 'active' | 'completed';
  tentativeDate?: string;
  confirmedDate?: string;
  notes: Note[];
  owner: string;
  assignees: string[];
  visibility: 'workspace' | 'campaign' | 'private';
  autoTracking: boolean;
  activityType: 'post' | 'brief' | 'asset' | 'reminder' | 'review' | 'milestone';
}

interface Note {
  id: number;
  text: string;
  author: string;
  timestamp: string;
  isInternal: boolean;
}

interface ActivitySchedulerProps {
  onNavigate: (path: string) => void;
}

type ViewMode = 'week' | 'month' | 'agenda';

const weekDays = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

export function ActivityScheduler({ onNavigate }: ActivitySchedulerProps) {
  const [viewMode, setViewMode] = useState<ViewMode>('week');
  const [currentDate, setCurrentDate] = useState(new Date());
  const [activities, setActivities] = useState<Activity[]>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('dttracker-activities');
      if (saved) {
        try {
          return JSON.parse(saved);
        } catch (e) {
          return [];
        }
      }
    }
    return [];
  });

  const [campaigns, setCampaigns] = useState<any[]>([]);
  const [creators, setCreators] = useState<any[]>([]);
  const [selectedActivity, setSelectedActivity] = useState<Activity | null>(null);
  const [detailDrawerOpen, setDetailDrawerOpen] = useState(false);
  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<number | null>(null);
  const [planGeneratorOpen, setPlanGeneratorOpen] = useState(false);
  const [compliancePanelOpen, setCompliancePanelOpen] = useState(false);
  const [selectedCampaignId, setSelectedCampaignId] = useState<number | null>(null);

  // Filters
  const [filters, setFilters] = useState({
    campaigns: [] as number[],
    statuses: [] as string[],
    assignees: [] as string[],
    platforms: [] as string[],
    activityTypes: [] as string[],
  });
  const [showFilters, setShowFilters] = useState(false);

  // Form state
  const [formData, setFormData] = useState<Partial<Activity>>({
    title: '',
    linkedCampaigns: [],
    linkedCreators: [],
    status: 'pending',
    assignees: [],
    visibility: 'workspace',
    autoTracking: true,
    activityType: 'post',
    notes: [],
  });

  // Drag state
  const [draggedActivity, setDraggedActivity] = useState<Activity | null>(null);

  // Load campaigns and creators
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const savedCampaigns = localStorage.getItem('dttracker-campaigns');
      const savedCreators = localStorage.getItem('dttracker-creators');
      if (savedCampaigns) {
        try {
          setCampaigns(JSON.parse(savedCampaigns));
        } catch (e) {}
      }
      if (savedCreators) {
        try {
          setCreators(JSON.parse(savedCreators));
        } catch (e) {}
      }
    }
  }, []);

  // Save activities
  useEffect(() => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('dttracker-activities', JSON.stringify(activities));
    }
  }, [activities]);

  // Auto-update activity status based on campaign posts
  useEffect(() => {
    const updatedActivities = activities.map(activity => {
      if (!activity.autoTracking || activity.linkedCampaigns.length === 0) {
        return activity;
      }

      // Check linked campaigns for post status
      let totalCreators = activity.linkedCreators.length;
      let completedCreators = 0;

      activity.linkedCampaigns.forEach(campaignId => {
        const campaign = campaigns.find(c => c.id === campaignId);
        if (campaign && campaign.posts) {
          activity.linkedCreators.forEach(creatorId => {
            const creator = creators.find(c => c.id === creatorId);
            if (creator) {
              // Check if post exists for this creator
              const post = campaign.posts?.find((p: any) => p.creatorName === creator.name);
              if (post && post.status === 'live') {
                completedCreators++;
              }
            }
          });
        }
      });

      // Auto-update status based on progress
      if (totalCreators > 0 && completedCreators === totalCreators) {
        return { ...activity, status: 'completed' as const };
      } else if (completedCreators > 0) {
        return { ...activity, status: 'active' as const };
      }

      return activity;
    });

    // Only update if there are actual changes
    if (JSON.stringify(updatedActivities) !== JSON.stringify(activities)) {
      setActivities(updatedActivities);
    }
  }, [campaigns, creators]);

  const weekStart = startOfWeek(currentDate, { weekStartsOn: 1 });
  const weekEnd = endOfWeek(currentDate, { weekStartsOn: 1 });
  const weekDates = eachDayOfInterval({ start: weekStart, end: weekEnd });

  const monthStart = startOfMonth(currentDate);
  const monthEnd = endOfMonth(currentDate);
  const calendarStart = startOfWeek(monthStart, { weekStartsOn: 1 });
  const calendarEnd = endOfWeek(monthEnd, { weekStartsOn: 1 });
  const monthDates = eachDayOfInterval({ start: calendarStart, end: calendarEnd });

  const getActivitiesForDate = (date: Date) => {
    return activities.filter(activity => {
      const activityDate = activity.confirmedDate || activity.tentativeDate;
      if (!activityDate) return false;
      
      try {
        return isSameDay(parseISO(activityDate), date);
      } catch (e) {
        return false;
      }
    }).filter(activity => {
      // Apply filters
      if (filters.campaigns.length > 0 && !activity.linkedCampaigns.some(c => filters.campaigns.includes(c))) {
        return false;
      }
      if (filters.statuses.length > 0 && !filters.statuses.includes(activity.status)) {
        return false;
      }
      if (filters.assignees.length > 0 && !activity.assignees.some(a => filters.assignees.includes(a))) {
        return false;
      }
      if (filters.platforms.length > 0 && activity.platform && !filters.platforms.includes(activity.platform)) {
        return false;
      }
      if (filters.activityTypes.length > 0 && !filters.activityTypes.includes(activity.activityType)) {
        return false;
      }
      return true;
    });
  };

  const getStatusColor = (status: Activity['status']) => {
    switch (status) {
      case 'pending': return '#64748b';
      case 'briefed': return '#f59e0b';
      case 'active': return '#0ea5e9';
      case 'completed': return '#10b981';
      default: return '#64748b';
    }
  };

  const getStatusIcon = (status: Activity['status']) => {
    switch (status) {
      case 'pending': return <Circle className="w-3 h-3" />;
      case 'briefed': return <Clock className="w-3 h-3" />;
      case 'active': return <AlertCircle className="w-3 h-3" />;
      case 'completed': return <CheckCircle2 className="w-3 h-3" />;
      default: return <Circle className="w-3 h-3" />;
    }
  };

  const getActivityProgress = (activity: Activity) => {
    if (activity.linkedCreators.length === 0) return null;

    let completed = 0;
    activity.linkedCampaigns.forEach(campaignId => {
      const campaign = campaigns.find(c => c.id === campaignId);
      if (campaign && campaign.posts) {
        activity.linkedCreators.forEach(creatorId => {
          const creator = creators.find(c => c.id === creatorId);
          if (creator) {
            const post = campaign.posts?.find((p: any) => p.creatorName === creator.name && p.status === 'live');
            if (post) completed++;
          }
        });
      }
    });

    return { completed, total: activity.linkedCreators.length };
  };

  const handlePreviousPeriod = () => {
    if (viewMode === 'week') {
      setCurrentDate(subWeeks(currentDate, 1));
    } else {
      setCurrentDate(addDays(currentDate, -30));
    }
  };

  const handleNextPeriod = () => {
    if (viewMode === 'week') {
      setCurrentDate(addWeeks(currentDate, 1));
    } else {
      setCurrentDate(addDays(currentDate, 30));
    }
  };

  const handleToday = () => {
    setCurrentDate(new Date());
  };

  const handleAddActivity = () => {
    if (!formData.title) {
      toast.error('Please enter an activity title');
      return;
    }

    const newActivity: Activity = {
      id: Date.now(),
      title: formData.title,
      linkedCampaigns: formData.linkedCampaigns || [],
      linkedCreators: formData.linkedCreators || [],
      platform: formData.platform,
      status: formData.status || 'pending',
      tentativeDate: selectedDate ? selectedDate.toISOString() : formData.tentativeDate,
      confirmedDate: formData.confirmedDate,
      notes: [],
      owner: 'You',
      assignees: formData.assignees || [],
      visibility: formData.visibility || 'workspace',
      autoTracking: formData.autoTracking !== false,
      activityType: formData.activityType || 'post',
    };

    setActivities([...activities, newActivity]);
    setAddDialogOpen(false);
    setSelectedDate(null);
    resetForm();

    addNotification({
      type: 'campaign',
      title: 'Activity Created',
      message: `${newActivity.title} has been added to the schedule`,
    });
  };

  const handleEditActivity = () => {
    if (!selectedActivity || !formData.title) return;

    setActivities(activities.map(a =>
      a.id === selectedActivity.id ? { ...a, ...formData } as Activity : a
    ));

    setDetailDrawerOpen(false);
    setSelectedActivity(null);
    resetForm();

    addNotification({
      type: 'campaign',
      title: 'Activity Updated',
      message: `${formData.title} has been updated`,
    });
  };

  const handleDeleteActivity = (id: number) => {
    const activity = activities.find(a => a.id === id);
    setActivities(activities.filter(a => a.id !== id));
    setDeleteConfirm(null);
    setDetailDrawerOpen(false);

    if (activity) {
      addNotification({
        type: 'campaign',
        title: 'Activity Deleted',
        message: `${activity.title} has been removed`,
      });
    }
  };

  const handleDragStart = (activity: Activity) => {
    setDraggedActivity(activity);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const handleDrop = (date: Date) => {
    if (!draggedActivity) return;

    setActivities(activities.map(a =>
      a.id === draggedActivity.id
        ? { ...a, tentativeDate: date.toISOString() }
        : a
    ));

    setDraggedActivity(null);

    addNotification({
      type: 'campaign',
      title: 'Activity Rescheduled',
      message: `${draggedActivity.title} moved to ${format(date, 'MMM d')}`,
    });
  };

  const handleAddNote = (text: string, isInternal: boolean) => {
    if (!selectedActivity || !text.trim()) return;

    const newNote: Note = {
      id: Date.now(),
      text: text.trim(),
      author: 'You',
      timestamp: new Date().toISOString(),
      isInternal,
    };

    setActivities(activities.map(a =>
      a.id === selectedActivity.id
        ? { ...a, notes: [...a.notes, newNote] }
        : a
    ));

    setSelectedActivity({ ...selectedActivity, notes: [...selectedActivity.notes, newNote] });
  };

  const openActivityDetail = (activity: Activity) => {
    setSelectedActivity(activity);
    setFormData(activity);
    setDetailDrawerOpen(true);
  };

  const openQuickAdd = (date: Date) => {
    setSelectedDate(date);
    setAddDialogOpen(true);
    resetForm();
  };

  const resetForm = () => {
    setFormData({
      title: '',
      linkedCampaigns: [],
      linkedCreators: [],
      status: 'pending',
      assignees: [],
      visibility: 'workspace',
      autoTracking: true,
      activityType: 'post',
      notes: [],
    });
  };

  const addNotification = (notification: any) => {
    if (typeof window !== 'undefined') {
      const notifications = JSON.parse(localStorage.getItem('dttracker-notifications') || '[]');
      const newNotification = {
        id: Date.now(),
        ...notification,
        time: 'Just now',
        read: false,
      };
      localStorage.setItem('dttracker-notifications', JSON.stringify([newNotification, ...notifications]));
      window.dispatchEvent(new Event('notifications-updated'));
    }
  };

  const activeFiltersCount = 
    filters.campaigns.length + 
    filters.statuses.length + 
    filters.assignees.length + 
    filters.platforms.length + 
    filters.activityTypes.length;

  const stats = {
    total: activities.length,
    pending: activities.filter(a => a.status === 'pending').length,
    active: activities.filter(a => a.status === 'active').length,
    completed: activities.filter(a => a.status === 'completed').length,
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-col sm:flex-row gap-4">
        <div className="flex items-center gap-4">
          <button
            onClick={() => onNavigate('/')}
            className="w-9 h-9 rounded-md bg-white/[0.03] hover:bg-white/[0.06] border border-white/[0.08] flex items-center justify-center transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>
          <div>
            <h1 className="text-2xl font-semibold tracking-tight text-white">Activity Scheduler</h1>
            <p className="text-sm text-slate-400 mt-1">Campaign operations board - your Google Sheets replacement</p>
          </div>
        </div>
        <div className="flex items-center gap-3 w-full sm:w-auto">
          <Button
            onClick={() => setPlanGeneratorOpen(true)}
            variant="outline"
            className="flex-1 sm:flex-none h-9 px-4 bg-white/[0.03] hover:bg-white/[0.06] border-white/[0.08] text-slate-300"
          >
            <Sparkles className="w-4 h-4 mr-2" />
            Posting Plan
          </Button>
          <Button onClick={() => setAddDialogOpen(true)} className="flex-1 sm:flex-none h-9 px-4 bg-primary hover:bg-primary/90 text-white">
            <Plus className="w-4 h-4 mr-2" />
            New Activity
          </Button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <Card className="bg-[#0D0D0D] border-white/[0.08]">
          <CardContent className="p-4">
            <div className="text-2xl font-semibold text-white">{stats.total}</div>
            <p className="text-sm text-slate-400 mt-1">Total Activities</p>
          </CardContent>
        </Card>
        <Card className="bg-[#0D0D0D] border-white/[0.08]">
          <CardContent className="p-4">
            <div className="text-2xl font-semibold text-slate-400">{stats.pending}</div>
            <p className="text-sm text-slate-400 mt-1">Pending</p>
          </CardContent>
        </Card>
        <Card className="bg-[#0D0D0D] border-white/[0.08]">
          <CardContent className="p-4">
            <div className="text-2xl font-semibold text-primary">{stats.active}</div>
            <p className="text-sm text-slate-400 mt-1">Active</p>
          </CardContent>
        </Card>
        <Card className="bg-[#0D0D0D] border-white/[0.08]">
          <CardContent className="p-4">
            <div className="text-2xl font-semibold text-emerald-400">{stats.completed}</div>
            <p className="text-sm text-slate-400 mt-1">Completed</p>
          </CardContent>
        </Card>
      </div>

      {/* View Controls */}
      <div className="flex flex-col gap-4">
        <div className="flex items-center gap-2 w-full">
          <button
            onClick={handlePreviousPeriod}
            className="w-9 h-9 flex-shrink-0 rounded-md bg-white/[0.03] hover:bg-white/[0.06] border border-white/[0.08] flex items-center justify-center transition-colors"
          >
            <ChevronLeft className="w-4 h-4 text-slate-300" />
          </button>
          <div className="flex-1 text-center min-w-0">
            <h2 className="font-semibold text-white text-sm sm:text-base truncate">
              {viewMode === 'week' 
                ? `${format(weekStart, 'MMM d')} - ${format(weekEnd, 'MMM d, yyyy')}`
                : format(currentDate, 'MMMM yyyy')}
            </h2>
          </div>
          <button
            onClick={handleNextPeriod}
            className="w-9 h-9 flex-shrink-0 rounded-md bg-white/[0.03] hover:bg-white/[0.06] border border-white/[0.08] flex items-center justify-center transition-colors"
          >
            <ChevronRight className="w-4 h-4 text-slate-300" />
          </button>
          <Button onClick={handleToday} variant="outline" className="h-9 px-3 flex-shrink-0 bg-white/[0.03] hover:bg-white/[0.06] border-white/[0.08] text-slate-300">
            Today
          </Button>
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto">
          <div className="flex rounded-md border border-white/[0.08] overflow-hidden">
            <button
              onClick={() => setViewMode('week')}
              className={`px-3 h-9 text-sm font-medium transition-colors ${
                viewMode === 'week' ? 'bg-primary text-black' : 'bg-white/[0.03] text-slate-400 hover:text-slate-200'
              }`}
            >
              <List className="w-4 h-4" />
            </button>
            <button
              onClick={() => setViewMode('month')}
              className={`px-3 h-9 text-sm font-medium transition-colors border-l border-white/[0.08] ${
                viewMode === 'month' ? 'bg-primary text-black' : 'bg-white/[0.03] text-slate-400 hover:text-slate-200'
              }`}
            >
              <Grid3x3 className="w-4 h-4" />
            </button>
            <button
              onClick={() => setViewMode('agenda')}
              className={`px-3 h-9 text-sm font-medium transition-colors border-l border-white/[0.08] ${
                viewMode === 'agenda' ? 'bg-primary text-black' : 'bg-white/[0.03] text-slate-400 hover:text-slate-200'
              }`}
            >
              <CalendarIcon className="w-4 h-4" />
            </button>
          </div>
          
          <Button
            onClick={() => setShowFilters(!showFilters)}
            variant="outline"
            className={`h-9 px-3 ${activeFiltersCount > 0 ? 'bg-primary/10 border-primary/20 text-primary' : 'bg-white/[0.03] border-white/[0.08] text-slate-300'}`}
          >
            <Filter className="w-4 h-4 mr-2" />
            Filters {activeFiltersCount > 0 && `(${activeFiltersCount})`}
          </Button>
        </div>
      </div>

      {/* Filters Panel */}
      {showFilters && (
        <Card className="bg-[#0D0D0D] border-white/[0.08]">
          <CardContent className="p-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
              <div>
                <label className="block text-xs font-medium text-slate-400 mb-2">Campaigns</label>
                <select
                  multiple
                  value={filters.campaigns.map(String)}
                  onChange={(e) => {
                    const values = Array.from(e.target.selectedOptions, option => parseInt(option.value));
                    setFilters({ ...filters, campaigns: values });
                  }}
                  className="w-full h-24 px-2 py-1 bg-white/[0.03] border border-white/[0.08] rounded-md text-white text-sm"
                >
                  {campaigns.map(c => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-400 mb-2">Status</label>
                <div className="space-y-2">
                  {['pending', 'briefed', 'active', 'completed'].map(status => (
                    <label key={status} className="flex items-center gap-2 text-sm text-slate-300">
                      <input
                        type="checkbox"
                        checked={filters.statuses.includes(status)}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setFilters({ ...filters, statuses: [...filters.statuses, status] });
                          } else {
                            setFilters({ ...filters, statuses: filters.statuses.filter(s => s !== status) });
                          }
                        }}
                        className="rounded border-white/[0.08]"
                      />
                      {status.charAt(0).toUpperCase() + status.slice(1)}
                    </label>
                  ))}
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-400 mb-2">Platform</label>
                <div className="space-y-2">
                  {['tiktok', 'instagram', 'youtube'].map(platform => (
                    <label key={platform} className="flex items-center gap-2 text-sm text-slate-300">
                      <input
                        type="checkbox"
                        checked={filters.platforms.includes(platform)}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setFilters({ ...filters, platforms: [...filters.platforms, platform] });
                          } else {
                            setFilters({ ...filters, platforms: filters.platforms.filter(p => p !== platform) });
                          }
                        }}
                        className="rounded border-white/[0.08]"
                      />
                      {platform.charAt(0).toUpperCase() + platform.slice(1)}
                    </label>
                  ))}
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-400 mb-2">Activity Type</label>
                <div className="space-y-2">
                  {['post', 'brief', 'asset', 'reminder', 'review', 'milestone'].map(type => (
                    <label key={type} className="flex items-center gap-2 text-sm text-slate-300">
                      <input
                        type="checkbox"
                        checked={filters.activityTypes.includes(type)}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setFilters({ ...filters, activityTypes: [...filters.activityTypes, type] });
                          } else {
                            setFilters({ ...filters, activityTypes: filters.activityTypes.filter(t => t !== type) });
                          }
                        }}
                        className="rounded border-white/[0.08]"
                      />
                      {type.charAt(0).toUpperCase() + type.slice(1)}
                    </label>
                  ))}
                </div>
              </div>
              <div className="flex items-end">
                <Button
                  onClick={() => setFilters({ campaigns: [], statuses: [], assignees: [], platforms: [], activityTypes: [] })}
                  variant="outline"
                  className="w-full h-9 bg-white/[0.03] hover:bg-white/[0.06] border-white/[0.08] text-slate-300"
                >
                  Clear All
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Week View */}
      {viewMode === 'week' && (
        <Card className="bg-[#0D0D0D] border-white/[0.08]">
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <div className="min-w-[800px]">
                {/* Header */}
                <div className="grid grid-cols-7 border-b border-white/[0.08]">
                  {weekDates.map((date, index) => (
                    <div
                      key={index}
                      className={`p-4 text-center border-r border-white/[0.04] last:border-r-0 ${
                        isSameDay(date, new Date()) ? 'bg-primary/5' : ''
                      }`}
                    >
                      <div className="text-xs font-medium text-slate-500">{weekDays[index]}</div>
                      <div className={`text-lg font-semibold mt-1 ${
                        isSameDay(date, new Date()) ? 'text-primary' : 'text-white'
                      }`}>
                        {format(date, 'd')}
                      </div>
                    </div>
                  ))}
                </div>

                {/* Grid */}
                <div className="grid grid-cols-7">
                  {weekDates.map((date, index) => {
                    const dayActivities = getActivitiesForDate(date);
                    return (
                      <div
                        key={index}
                        className={`min-h-[400px] p-2 border-r border-white/[0.04] last:border-r-0 ${
                          isSameDay(date, new Date()) ? 'bg-white/[0.01]' : ''
                        }`}
                        onDragOver={handleDragOver}
                        onDrop={() => handleDrop(date)}
                      >
                        <div className="space-y-2">
                          {dayActivities.map(activity => {
                            const progress = getActivityProgress(activity);
                            return (
                              <div
                                key={activity.id}
                                draggable
                                onDragStart={() => handleDragStart(activity)}
                                onClick={() => openActivityDetail(activity)}
                                className="p-2 rounded-md border transition-all cursor-move hover:shadow-lg group"
                                style={{
                                  backgroundColor: `${getStatusColor(activity.status)}15`,
                                  borderColor: `${getStatusColor(activity.status)}40`,
                                }}
                              >
                                <div className="flex items-start gap-2">
                                  <div className="mt-0.5" style={{ color: getStatusColor(activity.status) }}>
                                    {getStatusIcon(activity.status)}
                                  </div>
                                  <div className="flex-1 min-w-0">
                                    <div className="text-xs font-medium text-white truncate">{activity.title}</div>
                                    {progress && (
                                      <div className="text-[10px] text-slate-400 mt-1">
                                        {progress.completed}/{progress.total} creators
                                      </div>
                                    )}
                                    {!activity.confirmedDate && activity.tentativeDate && (
                                      <div className="text-[10px] text-amber-400 mt-1">Tentative</div>
                                    )}
                                  </div>
                                  <GripVertical className="w-3 h-3 text-slate-600 opacity-0 group-hover:opacity-100" />
                                </div>
                              </div>
                            );
                          })}
                          <button
                            onClick={() => openQuickAdd(date)}
                            className="w-full p-2 rounded-md border border-dashed border-white/[0.08] text-slate-500 hover:text-slate-300 hover:border-white/[0.12] transition-colors text-xs"
                          >
                            + Add activity
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Month View */}
      {viewMode === 'month' && (
        <Card className="bg-[#0D0D0D] border-white/[0.08]">
          <CardContent className="p-6">
            <div className="grid grid-cols-7 gap-2 mb-2">
              {weekDays.map(day => (
                <div key={day} className="text-center text-xs font-medium text-slate-500 py-2">
                  {day}
                </div>
              ))}
            </div>
            <div className="grid grid-cols-7 gap-2">
              {monthDates.map((date, index) => {
                const isCurrentMonth = isSameMonth(date, currentDate);
                const isToday = isSameDay(date, new Date());
                const dayActivities = getActivitiesForDate(date);

                return (
                  <button
                    key={index}
                    onClick={() => {
                      setSelectedDate(date);
                      if (dayActivities.length > 0) {
                        openActivityDetail(dayActivities[0]);
                      } else {
                        openQuickAdd(date);
                      }
                    }}
                    className={`
                      aspect-square p-2 rounded-lg border transition-all text-left relative
                      ${isCurrentMonth ? 'bg-white/[0.02] border-white/[0.06]' : 'bg-transparent border-transparent'}
                      ${isToday ? 'border-primary' : ''}
                      ${isCurrentMonth ? 'hover:bg-white/[0.04] hover:border-white/[0.08]' : ''}
                    `}
                  >
                    <div className={`text-sm font-medium mb-1 ${
                      isCurrentMonth ? 'text-white' : 'text-slate-600'
                    }`}>
                      {format(date, 'd')}
                    </div>
                    {isCurrentMonth && dayActivities.length > 0 && (
                      <div className="space-y-1">
                        {dayActivities.slice(0, 2).map(activity => (
                          <div
                            key={activity.id}
                            className="h-1 rounded-full"
                            style={{ backgroundColor: getStatusColor(activity.status) }}
                          />
                        ))}
                        {dayActivities.length > 2 && (
                          <div className="text-[10px] text-slate-400">+{dayActivities.length - 2}</div>
                        )}
                      </div>
                    )}
                  </button>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Agenda View */}
      {viewMode === 'agenda' && (
        <Card className="bg-[#0D0D0D] border-white/[0.08]">
          <CardContent className="p-0">
            <div className="divide-y divide-white/[0.04]">
              {activities
                .filter(activity => {
                  // Apply filters
                  if (filters.campaigns.length > 0 && !activity.linkedCampaigns.some(c => filters.campaigns.includes(c))) {
                    return false;
                  }
                  if (filters.statuses.length > 0 && !filters.statuses.includes(activity.status)) {
                    return false;
                  }
                  if (filters.platforms.length > 0 && activity.platform && !filters.platforms.includes(activity.platform)) {
                    return false;
                  }
                  if (filters.activityTypes.length > 0 && !filters.activityTypes.includes(activity.activityType)) {
                    return false;
                  }
                  return true;
                })
                .sort((a, b) => {
                  const dateA = a.confirmedDate || a.tentativeDate || '';
                  const dateB = b.confirmedDate || b.tentativeDate || '';
                  return dateA.localeCompare(dateB);
                })
                .map(activity => {
                  const progress = getActivityProgress(activity);
                  const activityDate = activity.confirmedDate || activity.tentativeDate;
                  
                  return (
                    <div
                      key={activity.id}
                      onClick={() => openActivityDetail(activity)}
                      className="p-4 hover:bg-white/[0.02] transition-colors cursor-pointer"
                    >
                      <div className="flex items-start gap-4">
                        <div className="w-20 flex-shrink-0">
                          {activityDate && (
                            <div className="text-sm font-medium text-white">
                              {format(parseISO(activityDate), 'MMM d')}
                            </div>
                          )}
                          <div className="text-xs text-slate-500">
                            {activityDate ? format(parseISO(activityDate), 'yyyy') : 'No date'}
                          </div>
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-3 mb-2">
                            <div style={{ color: getStatusColor(activity.status) }}>
                              {getStatusIcon(activity.status)}
                            </div>
                            <h4 className="font-medium text-white">{activity.title}</h4>
                            {!activity.confirmedDate && activity.tentativeDate && (
                              <span className="text-xs px-2 py-0.5 bg-amber-500/10 text-amber-400 rounded border border-amber-500/20">
                                Tentative
                              </span>
                            )}
                          </div>
                          <div className="flex items-center gap-4 text-xs text-slate-400">
                            {activity.linkedCampaigns.length > 0 && (
                              <div className="flex items-center gap-1">
                                <Link2 className="w-3 h-3" />
                                {activity.linkedCampaigns.length} campaign{activity.linkedCampaigns.length !== 1 ? 's' : ''}
                              </div>
                            )}
                            {activity.linkedCreators.length > 0 && (
                              <div className="flex items-center gap-1">
                                <Users className="w-3 h-3" />
                                {activity.linkedCreators.length} creator{activity.linkedCreators.length !== 1 ? 's' : ''}
                              </div>
                            )}
                            {progress && (
                              <div className="flex items-center gap-1 text-emerald-400">
                                <CheckCircle2 className="w-3 h-3" />
                                {progress.completed}/{progress.total} live
                              </div>
                            )}
                            {activity.notes.length > 0 && (
                              <div className="flex items-center gap-1">
                                <MessageSquare className="w-3 h-3" />
                                {activity.notes.length} note{activity.notes.length !== 1 ? 's' : ''}
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              {activities.length === 0 && (
                <div className="py-16 text-center">
                  <div className="w-12 h-12 rounded-lg bg-white/[0.03] flex items-center justify-center mx-auto mb-3">
                    <CalendarIcon className="w-6 h-6 text-slate-600" />
                  </div>
                  <p className="text-sm text-slate-500">No activities scheduled</p>
                  <Button onClick={() => setAddDialogOpen(true)} className="mt-4 h-9 px-4 bg-primary hover:bg-primary/90 text-white">
                    <Plus className="w-4 h-4 mr-2" />
                    Create Activity
                  </Button>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Add/Edit Activity Dialog - Part 1 will be in next message due to length */}
      <ActivityFormDialog
        open={addDialogOpen}
        onClose={() => {
          setAddDialogOpen(false);
          setSelectedDate(null);
          resetForm();
        }}
        onSave={handleAddActivity}
        formData={formData}
        setFormData={setFormData}
        campaigns={campaigns}
        creators={creators}
        title="New Activity"
        selectedDate={selectedDate}
      />

      {/* Activity Detail Drawer */}
      <ActivityDetailDrawer
        open={detailDrawerOpen}
        onClose={() => {
          setDetailDrawerOpen(false);
          setSelectedActivity(null);
        }}
        activity={selectedActivity}
        onEdit={handleEditActivity}
        onDelete={() => selectedActivity && setDeleteConfirm(selectedActivity.id)}
        onAddNote={handleAddNote}
        formData={formData}
        setFormData={setFormData}
        campaigns={campaigns}
        creators={creators}
        getStatusColor={getStatusColor}
        getStatusIcon={getStatusIcon}
        getActivityProgress={getActivityProgress}
      />

      {/* Posting Plan Generator */}
      <PostingPlanGenerator
        open={planGeneratorOpen}
        onClose={() => setPlanGeneratorOpen(false)}
        campaigns={campaigns}
        creators={creators}
        onGenerate={(newActivities: Activity[]) => {
          setActivities([...activities, ...newActivities]);
          setPlanGeneratorOpen(false);
          addNotification({
            type: 'campaign',
            title: 'Posting Plan Generated',
            message: `${newActivities.length} activities have been created`,
          });
        }}
      />

      {/* Creator Compliance Panel */}
      <CreatorCompliancePanel
        open={compliancePanelOpen}
        onClose={() => setCompliancePanelOpen(false)}
        campaigns={campaigns}
        creators={creators}
        activities={activities}
      />

      {/* Delete Confirmation */}
      <ResponsiveConfirmDialog
        open={Boolean(deleteConfirm)}
        onOpenChange={(open) => {
          if (!open) setDeleteConfirm(null);
        }}
        title="Delete activity?"
        description="This activity will be deleted. This action cannot be undone."
        confirmLabel="Delete activity"
        onConfirm={() => deleteConfirm && handleDeleteActivity(deleteConfirm)}
      />
    </div>
  );
}
