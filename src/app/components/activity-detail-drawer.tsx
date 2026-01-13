import React, { useState } from 'react';
import { Card, CardContent } from './ui/card';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { X, Edit2, Trash2, MessageSquare, Clock, Link2, Users, CheckCircle2 } from 'lucide-react';
import {
  PlatformIcon,
  normalizePlatform,
  getPlatformLabel,
} from './ui/PlatformIcon';
import { format, parseISO } from 'date-fns';

interface ActivityDetailDrawerProps {
  open: boolean;
  onClose: () => void;
  activity: any;
  onEdit: () => void;
  onDelete: () => void;
  onAddNote: (text: string, isInternal: boolean) => void;
  formData: any;
  setFormData: (data: any) => void;
  campaigns: any[];
  creators: any[];
  getStatusColor: (status: string) => string;
  getStatusIcon: (status: string) => JSX.Element;
  getActivityProgress: (activity: any) => { completed: number; total: number } | null;
}

export function ActivityDetailDrawer({
  open,
  onClose,
  activity,
  onEdit,
  onDelete,
  onAddNote,
  formData,
  setFormData,
  campaigns,
  creators,
  getStatusColor,
  getStatusIcon,
  getActivityProgress,
}: ActivityDetailDrawerProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [noteText, setNoteText] = useState('');
  const [isInternalNote, setIsInternalNote] = useState(false);

  if (!open || !activity) return null;

  const progress = getActivityProgress(activity);
  const linkedCampaignObjects = campaigns.filter(c => activity.linkedCampaigns.includes(c.id));
  const linkedCreatorObjects = creators.filter(c => activity.linkedCreators.includes(c.id));

  const handleSaveNote = () => {
    if (!noteText.trim()) return;
    onAddNote(noteText, isInternalNote);
    setNoteText('');
    setIsInternalNote(false);
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-end sm:items-center justify-end z-50">
      <div 
        className="w-full sm:w-[500px] h-full sm:h-[90vh] bg-[#1A1A1A] border-l border-white/[0.08] overflow-y-auto animate-in slide-in-from-right"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="sticky top-0 bg-[#1A1A1A] border-b border-white/[0.08] p-6 z-10">
          <div className="flex items-start justify-between mb-4">
            <div className="flex items-center gap-3 flex-1">
              <div style={{ color: getStatusColor(activity.status) }}>
                {getStatusIcon(activity.status)}
              </div>
              {isEditing ? (
                <Input
                  value={formData.title || ''}
                  onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                  className="h-9 bg-white/[0.03] border-white/[0.08] text-white font-semibold"
                />
              ) : (
                <h2 className="text-lg font-semibold text-white">{activity.title}</h2>
              )}
            </div>
            <button
              onClick={onClose}
              className="w-8 h-8 rounded-md hover:bg-white/[0.06] flex items-center justify-center transition-colors flex-shrink-0 ml-2"
            >
              <X className="w-4 h-4 text-slate-400" />
            </button>
          </div>

          <div className="flex items-center gap-2">
            {isEditing ? (
              <>
                <Button onClick={() => { onEdit(); setIsEditing(false); }} className="h-8 px-3 bg-primary hover:bg-primary/90 text-white text-sm">
                  Save
                </Button>
                <Button onClick={() => setIsEditing(false)} variant="outline" className="h-8 px-3 bg-white/[0.03] hover:bg-white/[0.06] border-white/[0.08] text-slate-300 text-sm">
                  Cancel
                </Button>
              </>
            ) : (
              <>
                <Button onClick={() => setIsEditing(true)} variant="outline" className="h-8 px-3 bg-white/[0.03] hover:bg-white/[0.06] border-white/[0.08] text-slate-300 text-sm">
                  <Edit2 className="w-3 h-3 mr-2" />
                  Edit
                </Button>
                <Button onClick={onDelete} variant="outline" className="h-8 px-3 bg-red-500/10 hover:bg-red-500/20 border-red-500/20 text-red-400 text-sm">
                  <Trash2 className="w-3 h-3 mr-2" />
                  Delete
                </Button>
              </>
            )}
          </div>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6">
          {/* Status & Progress */}
          <div className="space-y-3">
            <div>
              <label className="block text-xs font-medium text-slate-500 mb-2">Status</label>
              {isEditing ? (
                <select
                  value={formData.status || 'pending'}
                  onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                  className="w-full h-9 px-3 bg-white/[0.03] border border-white/[0.08] rounded-md text-white text-sm [&>option]:bg-[#1A1A1A] [&>option]:text-white"
                >
                  <option value="pending">Pending</option>
                  <option value="briefed">Briefed</option>
                  <option value="active">Active</option>
                  <option value="completed">Completed</option>
                </select>
              ) : (
                <div 
                  className="inline-flex items-center gap-2 px-3 py-1.5 rounded-md text-sm font-medium"
                  style={{ 
                    backgroundColor: `${getStatusColor(activity.status)}20`,
                    color: getStatusColor(activity.status),
                    border: `1px solid ${getStatusColor(activity.status)}40`
                  }}
                >
                  {getStatusIcon(activity.status)}
                  {activity.status.charAt(0).toUpperCase() + activity.status.slice(1)}
                </div>
              )}
            </div>

            {progress && (
              <div className="p-3 rounded-lg bg-white/[0.03] border border-white/[0.06]">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium text-white">Creator Progress</span>
                  <span className="text-sm font-semibold text-emerald-400">
                    {progress.completed}/{progress.total} live
                  </span>
                </div>
                <div className="h-2 bg-white/[0.05] rounded-full overflow-hidden">
                  <div 
                    className="h-full bg-emerald-400 rounded-full transition-all"
                    style={{ width: `${(progress.completed / progress.total) * 100}%` }}
                  />
                </div>
              </div>
            )}
          </div>

          {/* Dates */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-slate-500 mb-2">Tentative Date</label>
              {isEditing ? (
                <Input
                  type="datetime-local"
                  value={formData.tentativeDate ? formData.tentativeDate.slice(0, 16) : ''}
                  onChange={(e) => setFormData({ ...formData, tentativeDate: e.target.value ? new Date(e.target.value).toISOString() : undefined })}
                  className="h-9 bg-white/[0.03] border-white/[0.08] text-white text-sm"
                />
              ) : (
                <div className="text-sm text-white">
                  {activity.tentativeDate ? format(parseISO(activity.tentativeDate), 'MMM d, yyyy HH:mm') : 'Not set'}
                </div>
              )}
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-500 mb-2">Confirmed Date</label>
              {isEditing ? (
                <Input
                  type="datetime-local"
                  value={formData.confirmedDate ? formData.confirmedDate.slice(0, 16) : ''}
                  onChange={(e) => setFormData({ ...formData, confirmedDate: e.target.value ? new Date(e.target.value).toISOString() : undefined })}
                  className="h-9 bg-white/[0.03] border-white/[0.08] text-white text-sm"
                />
              ) : (
                <div className="text-sm text-white">
                  {activity.confirmedDate ? format(parseISO(activity.confirmedDate), 'MMM d, yyyy HH:mm') : 'Not set'}
                </div>
              )}
            </div>
          </div>

          {/* Activity Type */}
          <div>
            <label className="block text-xs font-medium text-slate-500 mb-2">Activity Type</label>
            {isEditing ? (
              <select
                value={formData.activityType || 'post'}
                onChange={(e) => setFormData({ ...formData, activityType: e.target.value })}
                className="w-full h-9 px-3 bg-white/[0.03] border border-white/[0.08] rounded-md text-white text-sm [&>option]:bg-[#1A1A1A] [&>option]:text-white"
              >
                <option value="post">Post</option>
                <option value="brief">Brief</option>
                <option value="asset">Asset</option>
                <option value="reminder">Reminder</option>
                <option value="review">Review</option>
                <option value="milestone">Milestone</option>
              </select>
            ) : (
              <div className="text-sm text-white capitalize">{activity.activityType}</div>
            )}
          </div>

          {/* Linked Campaigns */}
          {linkedCampaignObjects.length > 0 && (
            <div>
              <label className="block text-xs font-medium text-slate-500 mb-2">
                <Link2 className="w-3 h-3 inline mr-1" />
                Linked Campaigns
              </label>
              <div className="space-y-2">
                {linkedCampaignObjects.map(campaign => (
                  <div key={campaign.id} className="p-2 rounded-md bg-white/[0.03] border border-white/[0.06]">
                    <div className="text-sm font-medium text-white">{campaign.name}</div>
                    <div className="text-xs text-slate-500">{campaign.posts || 0} posts</div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Linked Creators */}
          {linkedCreatorObjects.length > 0 && (
            <div>
              <label className="block text-xs font-medium text-slate-500 mb-2">
                <Users className="w-3 h-3 inline mr-1" />
                Linked Creators ({linkedCreatorObjects.length})
              </label>
              <div className="space-y-2">
                {linkedCreatorObjects.map(creator => {
                  // Check if creator has posted
                  let hasPosted = false;
                  activity.linkedCampaigns.forEach((campaignId: number) => {
                    const campaign = campaigns.find(c => c.id === campaignId);
                    if (campaign && campaign.posts) {
                      const post = campaign.posts.find((p: any) => p.creatorName === creator.name && p.status === 'live');
                      if (post) hasPosted = true;
                    }
                  });

                  return (
                    <div key={creator.id} className="flex items-center justify-between p-2 rounded-md bg-white/[0.03] border border-white/[0.06]">
                      <div className="flex items-center gap-2">
                        <div className="w-8 h-8 rounded-full bg-gradient-to-br from-primary to-cyan-400 flex items-center justify-center text-white text-xs font-semibold">
                          {creator.name.charAt(0)}
                        </div>
                        <div>
                          <div className="text-sm font-medium text-white">{creator.name}</div>
                          <div className="text-xs text-slate-500 flex items-center gap-2">
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
                        </div>
                      </div>
                      {hasPosted && (
                        <div className="flex items-center gap-1 text-xs text-emerald-400">
                          <CheckCircle2 className="w-3 h-3" />
                          Live
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Assignees */}
          <div>
            <label className="block text-xs font-medium text-slate-500 mb-2">Assignees</label>
            {isEditing ? (
              <Input
                placeholder="John Doe, Jane Smith"
                value={(formData.assignees || []).join(', ')}
                onChange={(e) => setFormData({ ...formData, assignees: e.target.value.split(',').map(s => s.trim()).filter(Boolean) })}
                className="h-9 bg-white/[0.03] border-white/[0.08] text-white text-sm"
              />
            ) : (
              <div className="flex flex-wrap gap-2">
                {activity.assignees.length > 0 ? (
                  activity.assignees.map((assignee: string, index: number) => (
                    <div key={index} className="px-2 py-1 bg-white/[0.05] rounded text-xs text-slate-300">
                      {assignee}
                    </div>
                  ))
                ) : (
                  <div className="text-sm text-slate-500">No assignees</div>
                )}
              </div>
            )}
          </div>

          {/* Auto Tracking */}
          <div className="flex items-center justify-between p-3 rounded-lg bg-white/[0.03] border border-white/[0.06]">
            <div>
              <div className="text-sm font-medium text-white">Auto-tracking</div>
              <div className="text-xs text-slate-500">Automatically update from campaign posts</div>
            </div>
            {isEditing ? (
              <label className="relative inline-flex items-center cursor-pointer">
                <input 
                  type="checkbox" 
                  className="sr-only peer" 
                  checked={formData.autoTracking !== false}
                  onChange={(e) => setFormData({ ...formData, autoTracking: e.target.checked })}
                />
                <div className="w-11 h-6 bg-white/[0.08] peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary" style={{ color: 'rgba(76, 72, 72, 1)', backgroundColor: 'var(--color-slate-800)' }}></div>
              </label>
            ) : (
              <div className={`text-sm font-medium ${activity.autoTracking ? 'text-emerald-400' : 'text-slate-500'}`}>
                {activity.autoTracking ? 'Enabled' : 'Disabled'}
              </div>
            )}
          </div>

          {/* Notes Section */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <label className="text-xs font-medium text-slate-500">
                <MessageSquare className="w-3 h-3 inline mr-1" />
                Notes ({activity.notes.length})
              </label>
            </div>

            {/* Add Note */}
            <div className="mb-4">
              <textarea
                placeholder="Add a note..."
                value={noteText}
                onChange={(e) => setNoteText(e.target.value)}
                className="w-full h-20 px-3 py-2 bg-white/[0.03] border border-white/[0.08] rounded-md text-white text-sm resize-none"
              />
              <div className="flex items-center justify-between mt-2">
                <label className="flex items-center gap-2 text-xs text-slate-400 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={isInternalNote}
                    onChange={(e) => setIsInternalNote(e.target.checked)}
                    className="rounded border-white/[0.08]"
                  />
                  Internal note (editors only)
                </label>
                <Button onClick={handleSaveNote} disabled={!noteText.trim()} className="h-8 px-3 bg-primary hover:bg-primary/90 text-white text-sm">
                  Add Note
                </Button>
              </div>
            </div>

            {/* Notes List */}
            <div className="space-y-3">
              {activity.notes.length > 0 ? (
                activity.notes.map((note: any) => (
                  <div key={note.id} className={`p-3 rounded-lg ${note.isInternal ? 'bg-amber-500/5 border border-amber-500/20' : 'bg-white/[0.03] border border-white/[0.06]'}`}>
                    <div className="flex items-start justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium text-white">{note.author}</span>
                        {note.isInternal && (
                          <span className="text-xs px-1.5 py-0.5 bg-amber-500/20 text-amber-400 rounded">Internal</span>
                        )}
                      </div>
                      <span className="text-xs text-slate-500">{format(parseISO(note.timestamp), 'MMM d, HH:mm')}</span>
                    </div>
                    <p className="text-sm text-slate-300">{note.text}</p>
                  </div>
                ))
              ) : (
                <div className="text-center py-6 text-sm text-slate-500">No notes yet</div>
              )}
            </div>
          </div>

          {/* Metadata */}
          <div className="pt-4 border-t border-white/[0.06]">
            <div className="space-y-2 text-xs text-slate-500">
              <div className="flex items-center justify-between">
                <span>Created by</span>
                <span className="text-slate-300">{activity.owner}</span>
              </div>
              <div className="flex items-center justify-between">
                <span>Visibility</span>
                <span className="text-slate-300 capitalize">{activity.visibility}</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
