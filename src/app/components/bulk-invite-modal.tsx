import React, { useState, useEffect } from 'react';
import { Card, CardContent } from './ui/card';
import { Button } from './ui/button';
import { Input } from './ui/input';
import {
  X,
  Plus,
  Trash2,
  Mail,
  Upload,
  Download,
  AlertCircle,
} from 'lucide-react';
import {
  createBulkInvites,
  getCurrentUser,
  type InviteData,
} from '../utils/permissions';

interface BulkInviteModalProps {
  onClose: () => void;
  onComplete: () => void;
}

interface InviteRow extends InviteData {
  tempId: number;
}

export function BulkInviteModal({ onClose, onComplete }: BulkInviteModalProps) {
  const [invites, setInvites] = useState<InviteRow[]>([
    {
      tempId: 1,
      email: '',
      name: '',
      rolePreset: 'workspace_viewer',
      campaignIds: [],
    },
  ]);
  const [campaigns, setCampaigns] = useState<any[]>([]);
  const [errors, setErrors] = useState<Record<number, string>>({});
  const currentUser = getCurrentUser();

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const stored = localStorage.getItem('dttracker-campaigns');
      if (stored) {
        setCampaigns(JSON.parse(stored));
      }
    }
  }, []);

  const addInviteRow = () => {
    const newId = Math.max(...invites.map(i => i.tempId)) + 1;
    setInvites([...invites, {
      tempId: newId,
      email: '',
      name: '',
      rolePreset: 'workspace_viewer',
      campaignIds: [],
    }]);
  };

  const removeInviteRow = (tempId: number) => {
    setInvites(invites.filter(i => i.tempId !== tempId));
    const newErrors = { ...errors };
    delete newErrors[tempId];
    setErrors(newErrors);
  };

  const updateInvite = (tempId: number, field: keyof InviteData, value: any) => {
    setInvites(invites.map(i => 
      i.tempId === tempId ? { ...i, [field]: value } : i
    ));
    // Clear error for this row
    const newErrors = { ...errors };
    delete newErrors[tempId];
    setErrors(newErrors);
  };

  const validateInvites = (): boolean => {
    const newErrors: Record<number, string> = {};
    let isValid = true;

    invites.forEach(invite => {
      if (!invite.email || !invite.name) {
        newErrors[invite.tempId] = 'Email and name are required';
        isValid = false;
      } else if (!invite.email.includes('@')) {
        newErrors[invite.tempId] = 'Invalid email address';
        isValid = false;
      } else if ((invite.rolePreset === 'campaign_editor' || invite.rolePreset === 'campaign_viewer') && (!invite.campaignIds || invite.campaignIds.length === 0)) {
        newErrors[invite.tempId] = 'Select at least one campaign';
        isValid = false;
      }
    });

    setErrors(newErrors);
    return isValid;
  };

  const handleSubmit = () => {
    if (!validateInvites()) {
      return;
    }

    const inviteData = invites.map(({ tempId, ...rest }) => rest);
    createBulkInvites({ invites: inviteData }, currentUser.id);
    onComplete();
  };

  const downloadTemplate = () => {
    const csv = 'Email,Name,Access Level\nexample1@company.com,John Doe,workspace_viewer\nexample2@company.com,Jane Smith,workspace_editor';
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'bulk-invite-template.csv';
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4" onClick={onClose}>
      <Card className="bg-[#0D0D0D] border-white/[0.08] max-w-5xl w-full max-h-[90vh] overflow-hidden shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <CardContent className="p-0">
          {/* Header */}
          <div className="sticky top-0 bg-[#0D0D0D]/95 backdrop-blur-xl border-b border-white/[0.08] px-8 py-6 z-10">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-xl font-semibold text-white tracking-tight">Bulk Invite Team Members</h2>
                <p className="text-sm text-slate-500 mt-1.5">Invite multiple people at once with specific access levels</p>
              </div>
              <div className="flex items-center gap-3">
                <button
                  onClick={downloadTemplate}
                  className="h-9 px-4 rounded-lg bg-white/[0.04] hover:bg-white/[0.08] border border-white/[0.1] text-slate-300 hover:text-white text-sm font-medium transition-all duration-200 flex items-center gap-2"
                >
                  <Download className="w-4 h-4" />
                  Template
                </button>
                <button
                  onClick={onClose}
                  className="w-9 h-9 rounded-lg hover:bg-white/[0.08] flex items-center justify-center transition-all duration-200"
                >
                  <X className="w-4.5 h-4.5 text-slate-400" />
                </button>
              </div>
            </div>
          </div>

          {/* Content */}
          <div className="px-8 py-6 max-h-[calc(90vh-220px)] overflow-y-auto">
            <div className="space-y-3">
              {invites.map((invite, index) => (
                <div key={invite.tempId}>
                  <div className="flex items-start gap-3 p-5 bg-white/[0.03] border border-white/[0.08] rounded-lg hover:bg-white/[0.04] transition-all duration-200">
                    <div className="w-8 h-8 rounded-full bg-primary/10 border border-primary/20 flex items-center justify-center flex-shrink-0 mt-1">
                      <span className="text-xs font-semibold text-primary">{index + 1}</span>
                    </div>
                    
                    <div className="flex-1 grid grid-cols-3 gap-4">
                      <div>
                        <label className="block text-xs font-medium text-slate-400 mb-2">
                          Email <span className="text-red-400">*</span>
                        </label>
                        <Input
                          type="email"
                          placeholder="colleague@company.com"
                          value={invite.email}
                          onChange={(e) => updateInvite(invite.tempId, 'email', e.target.value)}
                          className="h-10 bg-white/[0.04] border-white/[0.1] text-white placeholder:text-slate-600 text-sm"
                        />
                      </div>

                      <div>
                        <label className="block text-xs font-medium text-slate-400 mb-2">
                          Name <span className="text-red-400">*</span>
                        </label>
                        <Input
                          placeholder="John Doe"
                          value={invite.name}
                          onChange={(e) => updateInvite(invite.tempId, 'name', e.target.value)}
                          className="h-10 bg-white/[0.04] border-white/[0.1] text-white placeholder:text-slate-600 text-sm"
                        />
                      </div>

                      <div>
                        <label className="block text-xs font-medium text-slate-400 mb-2">
                          Access Level <span className="text-red-400">*</span>
                        </label>
                        <div className="relative">
                          <select
                            value={invite.rolePreset}
                            onChange={(e) => updateInvite(invite.tempId, 'rolePreset', e.target.value)}
                            className="w-full h-10 pl-3 pr-8 bg-white/[0.04] border border-white/[0.1] rounded-lg text-white text-sm focus:border-primary/50 focus:ring-2 focus:ring-primary/20 transition-all appearance-none cursor-pointer [&>option]:bg-[#0D0D0D] [&>option]:text-white"
                          >
                            <option value="workspace_editor">Workspace Editor</option>
                            <option value="workspace_viewer">Workspace Viewer</option>
                            <option value="calendar_editor">Calendar Editor</option>
                            <option value="calendar_viewer">Calendar Viewer</option>
                            <option value="campaign_editor">Campaign Editor</option>
                            <option value="campaign_viewer">Campaign Viewer</option>
                          </select>
                          <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none">
                            <svg width="12" height="12" viewBox="0 0 16 16" fill="none" className="text-slate-400">
                              <path d="M4 6L8 10L12 6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                            </svg>
                          </div>
                        </div>
                      </div>

                      {(invite.rolePreset === 'campaign_editor' || invite.rolePreset === 'campaign_viewer') && (
                        <div className="col-span-3">
                          <label className="block text-xs font-medium text-slate-400 mb-2">
                            Select Campaigns <span className="text-red-400">*</span>
                          </label>
                          <div className="flex flex-wrap gap-2 p-3 bg-white/[0.02] border border-white/[0.06] rounded-lg max-h-32 overflow-y-auto">
                            {campaigns.length > 0 ? (
                              campaigns.map(campaign => (
                                <label key={campaign.id} className="inline-flex items-center gap-2 px-3 py-1.5 bg-white/[0.04] hover:bg-white/[0.06] border border-white/[0.08] rounded-md cursor-pointer transition-all">
                                  <input
                                    type="checkbox"
                                    checked={(invite.campaignIds || []).includes(campaign.id)}
                                    onChange={(e) => {
                                      const currentIds = invite.campaignIds || [];
                                      const newIds = e.target.checked
                                        ? [...currentIds, campaign.id]
                                        : currentIds.filter(id => id !== campaign.id);
                                      updateInvite(invite.tempId, 'campaignIds', newIds);
                                    }}
                                    className="rounded border-white/[0.2] text-primary focus:ring-primary/30 focus:ring-offset-0 w-3.5 h-3.5"
                                  />
                                  <span className="text-xs text-white">{campaign.name}</span>
                                </label>
                              ))
                            ) : (
                              <p className="text-xs text-slate-500">No campaigns available</p>
                            )}
                          </div>
                        </div>
                      )}
                    </div>

                    {invites.length > 1 && (
                      <button
                        onClick={() => removeInviteRow(invite.tempId)}
                        className="w-8 h-8 rounded-lg hover:bg-red-500/10 flex items-center justify-center transition-all duration-200 group flex-shrink-0 mt-6"
                      >
                        <Trash2 className="w-4 h-4 text-slate-400 group-hover:text-red-400" />
                      </button>
                    )}
                  </div>

                  {errors[invite.tempId] && (
                    <div className="flex items-center gap-2 mt-2 px-3 py-2 bg-red-500/10 border border-red-500/20 rounded-lg">
                      <AlertCircle className="w-4 h-4 text-red-400 flex-shrink-0" />
                      <p className="text-sm text-red-400">{errors[invite.tempId]}</p>
                    </div>
                  )}
                </div>
              ))}
            </div>

            <Button
              onClick={addInviteRow}
              variant="outline"
              className="w-full mt-4 h-11 bg-white/[0.02] hover:bg-white/[0.04] border-white/[0.08] hover:border-white/[0.12] border-dashed text-slate-400 hover:text-white transition-all duration-200"
            >
              <Plus className="w-4 h-4 mr-2" />
              Add Another Person
            </Button>
          </div>

          {/* Footer */}
          <div className="sticky bottom-0 bg-[#0D0D0D]/95 backdrop-blur-xl border-t border-white/[0.08] px-8 py-5">
            <div className="flex items-center justify-between">
              <p className="text-sm text-slate-500">
                Sending {invites.length} invitation{invites.length !== 1 ? 's' : ''}
              </p>
              <div className="flex gap-3">
                <Button
                  onClick={onClose}
                  variant="outline"
                  className="h-11 px-6 bg-white/[0.04] hover:bg-white/[0.08] border-white/[0.1] text-slate-300 hover:text-white"
                >
                  Cancel
                </Button>
                <Button
                  onClick={handleSubmit}
                  className="h-11 px-6 bg-primary hover:bg-primary/90 text-white font-semibold shadow-lg shadow-primary/25 hover:shadow-primary/40 transition-all duration-200"
                >
                  <Mail className="w-4 h-4 mr-2" />
                  Send Invitations
                </Button>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
