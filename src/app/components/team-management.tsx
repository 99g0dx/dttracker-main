import React, { useState, useEffect } from 'react';
import { Card, CardContent } from './ui/card';
import { Button } from './ui/button';
import { Input } from './ui/input';
import {
  Users,
  Plus,
  Mail,
  Crown,
  Shield,
  Eye,
  X,
  MoreVertical,
  Trash2,
  RefreshCw,
  UserPlus,
  CheckCircle2,
  Clock,
  Megaphone,
  UsersRound,
  ArrowLeft,
} from 'lucide-react';
import {
  getTeamMembers,
  getCurrentUser,
  canManageTeam,
  createInvite,
  deleteTeamMember,
  acceptInvite,
  getMemberScopes,
  switchUser,
  addAuditLogEntry,
  addActivityFeedItem,
  type TeamMember,
  type InviteData,
} from '../utils/permissions';
import { BulkInviteModal } from './bulk-invite-modal';

interface TeamManagementProps {
  onNavigate: (path: string) => void;
}

export function TeamManagement({ onNavigate }: TeamManagementProps) {
  const [members, setMembers] = useState<TeamMember[]>([]);
  const [currentUser, setCurrentUser] = useState(getCurrentUser());
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [selectedMember, setSelectedMember] = useState<TeamMember | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState<number | null>(null);
  const [showBulkInviteModal, setShowBulkInviteModal] = useState(false);

  const canManage = canManageTeam(currentUser.id);

  useEffect(() => {
    loadMembers();
  }, []);

  const loadMembers = () => {
    setMembers(getTeamMembers());
  };

  const handleInviteComplete = () => {
    loadMembers();
    setShowInviteModal(false);
  };

  const handleDeleteMember = (memberId: number) => {
    deleteTeamMember(memberId);
    loadMembers();
    setShowDeleteConfirm(null);
  };

  const handleAcceptInvite = (memberId: number) => {
    acceptInvite(memberId);
    loadMembers();
  };

  const getRoleBadge = (role: string) => {
    const badges = {
      owner: { icon: <Crown className="w-3 h-3" />, label: 'Owner', color: 'text-amber-400 bg-amber-400/10 border-amber-400/20' },
      admin: { icon: <Shield className="w-3 h-3" />, label: 'Admin', color: 'text-purple-400 bg-purple-400/10 border-purple-400/20' },
      member: { icon: <Users className="w-3 h-3" />, label: 'Member', color: 'text-primary bg-primary/10 border-primary/20' },
      viewer: { icon: <Eye className="w-3 h-3" />, label: 'Viewer', color: 'text-slate-400 bg-slate-400/10 border-slate-400/20' },
    };
    return badges[role as keyof typeof badges] || badges.viewer;
  };

  const getScopesSummary = (userId: number) => {
    const scopes = getMemberScopes(userId);
    
    if (scopes.length === 0) return 'No access';
    
    const workspaceScope = scopes.find(s => s.scopeType === 'workspace');
    if (workspaceScope) {
      return workspaceScope.scopeValue === 'editor' ? 'Full workspace access' : 'Workspace view access';
    }
    
    const calendarScope = scopes.find(s => s.scopeType === 'calendar');
    const campaignScopes = scopes.filter(s => s.scopeType === 'campaign');
    
    const parts = [];
    if (calendarScope) {
      parts.push(`Calendar ${calendarScope.scopeValue}`);
    }
    if (campaignScopes.length > 0) {
      parts.push(`${campaignScopes.length} campaign${campaignScopes.length !== 1 ? 's' : ''}`);
    }
    
    return parts.join(', ') || 'Custom access';
  };

  const activeMembers = members.filter(m => m.status === 'active');
  const pendingMembers = members.filter(m => m.status === 'pending');

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3 sm:gap-4">
          <button
            onClick={() => onNavigate('/')}
            className="w-9 h-9 flex-shrink-0 rounded-md bg-white/[0.03] hover:bg-white/[0.06] border border-white/[0.08] flex items-center justify-center transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>
          <div className="flex-1 min-w-0">
            <h1 className="text-xl sm:text-2xl font-semibold tracking-tight text-white">Team</h1>
            <p className="text-xs sm:text-sm text-slate-400 mt-1">Manage workspace access and permissions</p>
          </div>
        </div>
        {canManage && (
          <div className="flex flex-wrap gap-2 sm:gap-3 w-full sm:w-auto">
            <Button
              onClick={() => setShowBulkInviteModal(true)}
              variant="outline"
              className="h-9 px-4 flex-1 sm:flex-none bg-white/[0.04] hover:bg-white/[0.08] border-white/[0.1] text-slate-300 hover:text-white"
            >
              <UsersRound className="w-4 h-4 mr-2" />
              Bulk Invite
            </Button>
            <Button
              onClick={() => setShowInviteModal(true)}
              className="h-9 px-4 flex-1 sm:flex-none bg-primary hover:bg-primary/90 text-[rgb(0,0,0)]"
            >
              <UserPlus className="w-4 h-4 mr-2" />
              Invite Member
            </Button>
          </div>
        )}
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card className="bg-[#0D0D0D] border-white/[0.08]">
          <CardContent className="p-4">
            <div className="text-2xl font-semibold text-white">{activeMembers.length}</div>
            <p className="text-sm text-slate-400 mt-1">Active Members</p>
          </CardContent>
        </Card>
        <Card className="bg-[#0D0D0D] border-white/[0.08]">
          <CardContent className="p-4">
            <div className="text-2xl font-semibold text-amber-400">{pendingMembers.length}</div>
            <p className="text-sm text-slate-400 mt-1">Pending Invites</p>
          </CardContent>
        </Card>
        <Card className="bg-[#0D0D0D] border-white/[0.08]">
          <CardContent className="p-4">
            <div className="text-2xl font-semibold text-primary">{members.filter(m => m.role === 'owner' || m.role === 'admin').length}</div>
            <p className="text-sm text-slate-400 mt-1">Admins</p>
          </CardContent>
        </Card>
      </div>

      {/* Active Members */}
      <Card className="bg-[#0D0D0D] border-white/[0.08]">
        <CardContent className="p-0">
          <div className="p-6 border-b border-white/[0.06]">
            <h3 className="font-medium text-white">Active Members</h3>
            <p className="text-sm text-slate-500 mt-1">{activeMembers.length} member{activeMembers.length !== 1 ? 's' : ''} with active access</p>
          </div>
          
          <div className="divide-y divide-white/[0.04]">
            {activeMembers.map(member => {
              const badge = getRoleBadge(member.role);
              const scopesSummary = getScopesSummary(member.userId);
              const isCurrentUser = member.userId === currentUser.id;
              
              return (
                <div key={member.id} className="p-4 hover:bg-white/[0.02] transition-colors">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex items-start gap-3 flex-1">
                      <div className="w-10 h-10 rounded-full bg-gradient-to-br from-primary to-cyan-400 flex items-center justify-center text-white font-semibold flex-shrink-0">
                        {member.name.charAt(0).toUpperCase()}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <h4 className="font-medium text-white">{member.name}</h4>
                          {isCurrentUser && (
                            <span className="text-xs px-2 py-0.5 bg-primary/10 text-primary rounded border border-primary/20">
                              You
                            </span>
                          )}
                        </div>
                        <p className="text-sm text-slate-400 mb-2">{member.email}</p>
                        <div className="flex items-center gap-3 text-xs text-slate-500">
                          <span className={`inline-flex items-center gap-1.5 px-2 py-1 rounded border ${badge.color}`}>
                            {badge.icon}
                            {badge.label}
                          </span>
                          <span>{scopesSummary}</span>
                        </div>
                      </div>
                    </div>
                    
                    {canManage && !isCurrentUser && member.role !== 'owner' && (
                      <div className="relative group">
                        <button className="w-8 h-8 rounded-md hover:bg-white/[0.06] flex items-center justify-center transition-colors">
                          <MoreVertical className="w-4 h-4 text-slate-400" />
                        </button>
                        <div className="absolute right-0 top-full mt-1 bg-[#1A1A1A] border border-white/[0.08] rounded-lg shadow-xl opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all z-10 min-w-[160px]">
                          <button
                            onClick={() => switchUser(member.userId)}
                            className="w-full px-3 py-2 text-left text-sm text-white hover:bg-white/[0.04] flex items-center gap-2 transition-colors"
                          >
                            <RefreshCw className="w-3.5 h-3.5" />
                            Switch to user
                          </button>
                          <button
                            onClick={() => setShowDeleteConfirm(member.id)}
                            className="w-full px-3 py-2 text-left text-sm text-red-400 hover:bg-red-500/10 flex items-center gap-2 transition-colors rounded-b-lg"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                            Remove
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Pending Invites */}
      {pendingMembers.length > 0 && (
        <Card className="bg-[#0D0D0D] border-white/[0.08]">
          <CardContent className="p-0">
            <div className="p-6 border-b border-white/[0.06]">
              <h3 className="font-medium text-white">Pending Invites</h3>
              <p className="text-sm text-slate-500 mt-1">{pendingMembers.length} invitation{pendingMembers.length !== 1 ? 's' : ''} awaiting acceptance</p>
            </div>
            
            <div className="divide-y divide-white/[0.04]">
              {pendingMembers.map(member => {
                const badge = getRoleBadge(member.role);
                const scopesSummary = getScopesSummary(member.userId);
                
                return (
                  <div key={member.id} className="p-4 hover:bg-white/[0.02] transition-colors">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex items-start gap-3 flex-1">
                        <div className="w-10 h-10 rounded-full bg-slate-800 flex items-center justify-center flex-shrink-0">
                          <Mail className="w-5 h-5 text-slate-500" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <h4 className="font-medium text-white">{member.name}</h4>
                            <span className="inline-flex items-center gap-1.5 px-2 py-0.5 bg-amber-400/10 text-amber-400 text-xs rounded border border-amber-400/20">
                              <Clock className="w-3 h-3" />
                              Pending
                            </span>
                          </div>
                          <p className="text-sm text-slate-400 mb-2">{member.email}</p>
                          <div className="flex items-center gap-3 text-xs text-slate-500">
                            <span className={`inline-flex items-center gap-1.5 px-2 py-1 rounded border ${badge.color}`}>
                              {badge.icon}
                              {badge.label}
                            </span>
                            <span>{scopesSummary}</span>
                          </div>
                        </div>
                      </div>
                      
                      {canManage && (
                        <div className="flex items-center gap-2">
                          <Button
                            onClick={() => handleAcceptInvite(member.id)}
                            size="sm"
                            className="h-8 px-3 bg-primary/10 hover:bg-primary/20 text-primary border border-primary/20"
                          >
                            <CheckCircle2 className="w-3.5 h-3.5 mr-1.5" />
                            Accept (Demo)
                          </Button>
                          <button
                            onClick={() => setShowDeleteConfirm(member.id)}
                            className="w-8 h-8 rounded-md hover:bg-red-500/10 flex items-center justify-center transition-colors"
                          >
                            <X className="w-4 h-4 text-red-400" />
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Invite Modal */}
      {showInviteModal && (
        <InviteModal
          onClose={() => setShowInviteModal(false)}
          onComplete={handleInviteComplete}
        />
      )}

      {/* Delete Confirmation */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <Card className="bg-[#0D0D0D] border-white/[0.08] max-w-md w-full">
            <CardContent className="p-6">
              <h3 className="text-lg font-semibold text-white mb-2">Remove Team Member</h3>
              <p className="text-sm text-slate-400 mb-6">
                Are you sure you want to remove this member? They will lose access immediately.
              </p>
              <div className="flex gap-3">
                <Button
                  onClick={() => handleDeleteMember(showDeleteConfirm)}
                  className="flex-1 h-9 bg-red-500 hover:bg-red-500/90 text-white"
                >
                  Remove
                </Button>
                <Button
                  onClick={() => setShowDeleteConfirm(null)}
                  variant="outline"
                  className="flex-1 h-9 bg-white/[0.03] hover:bg-white/[0.06] border-white/[0.08] text-slate-300"
                >
                  Cancel
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Bulk Invite Modal */}
      {showBulkInviteModal && (
        <BulkInviteModal
          onClose={() => setShowBulkInviteModal(false)}
          onComplete={() => {
            loadMembers();
            setShowBulkInviteModal(false);
          }}
        />
      )}
    </div>
  );
}

// Invite Modal Component
function InviteModal({ onClose, onComplete }: { onClose: () => void; onComplete: () => void }) {
  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
  const [rolePreset, setRolePreset] = useState<InviteData['rolePreset']>('workspace_viewer');
  const [selectedCampaigns, setSelectedCampaigns] = useState<number[]>([]);
  const [message, setMessage] = useState('');
  const [campaigns, setCampaigns] = useState<any[]>([]);

  useEffect(() => {
    // Load campaigns for campaign-only access
    if (typeof window !== 'undefined') {
      const stored = localStorage.getItem('dttracker-campaigns');
      if (stored) {
        setCampaigns(JSON.parse(stored));
      }
    }
  }, []);

  const handleSubmit = () => {
    if (!email || !name) {
      alert('Please enter email and name');
      return;
    }

    if ((rolePreset === 'campaign_editor' || rolePreset === 'campaign_viewer') && selectedCampaigns.length === 0) {
      alert('Please select at least one campaign');
      return;
    }

    const inviteData: InviteData = {
      email,
      name,
      rolePreset,
      campaignIds: selectedCampaigns.length > 0 ? selectedCampaigns : undefined,
      message: message || undefined,
    };

    createInvite(inviteData, getCurrentUser().id);
    onComplete();
  };

  const isCampaignOnly = rolePreset === 'campaign_editor' || rolePreset === 'campaign_viewer';

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4" onClick={onClose}>
      <Card className="bg-[#0D0D0D] border-white/[0.08] max-w-2xl w-full max-h-[90vh] overflow-y-auto shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <CardContent className="p-0">
          <div className="sticky top-0 bg-[#0D0D0D]/95 backdrop-blur-xl border-b border-white/[0.08] px-8 py-6 z-10">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-xl font-semibold text-white tracking-tight">Invite Team Member</h2>
                <p className="text-sm text-slate-500 mt-1.5">Add someone to your workspace with specific access</p>
              </div>
              <button
                onClick={onClose}
                className="w-9 h-9 rounded-lg hover:bg-white/[0.08] flex items-center justify-center transition-all duration-200"
              >
                <X className="w-4.5 h-4.5 text-slate-400" />
              </button>
            </div>
          </div>

          <div className="px-8 py-8 space-y-7">
            <div className="grid grid-cols-2 gap-5">
              <div>
                <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-3">
                  Email <span className="text-red-400">*</span>
                </label>
                <Input
                  type="email"
                  placeholder="colleague@company.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="h-12 bg-white/[0.04] border-white/[0.1] text-white placeholder:text-slate-600 focus:bg-white/[0.06] focus:border-primary/50 focus:ring-2 focus:ring-primary/20 transition-all duration-200 rounded-lg"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-3">
                  Name <span className="text-red-400">*</span>
                </label>
                <Input
                  placeholder="John Doe"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="h-12 bg-white/[0.04] border-white/[0.1] text-white placeholder:text-slate-600 focus:bg-white/[0.06] focus:border-primary/50 focus:ring-2 focus:ring-primary/20 transition-all duration-200 rounded-lg"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-3">
                Access Level <span className="text-red-400">*</span>
              </label>
              <div className="relative">
                <select
                  value={rolePreset}
                  onChange={(e) => setRolePreset(e.target.value as InviteData['rolePreset'])}
                  className="w-full h-12 pl-4 pr-12 bg-white/[0.04] border border-white/[0.1] rounded-lg text-white text-sm font-medium focus:bg-white/[0.06] focus:border-primary/50 focus:ring-2 focus:ring-primary/20 transition-all duration-200 appearance-none cursor-pointer [&>option]:bg-[#0D0D0D] [&>option]:text-white [&>optgroup]:bg-[#0D0D0D] [&>optgroup]:text-slate-400 [&>optgroup]:font-semibold"
                >
                  <optgroup label="Workspace Access">
                    <option value="workspace_editor">Overall Tracker Editor - Full access to everything</option>
                    <option value="workspace_viewer">Overall Tracker Viewer - Read-only access to everything</option>
                  </optgroup>
                  <optgroup label="Calendar Access">
                    <option value="calendar_editor">Calendar Editor - Can create and edit activities</option>
                    <option value="calendar_viewer">Calendar Viewer - View-only access to calendar</option>
                  </optgroup>
                  <optgroup label="Campaign Access">
                    <option value="campaign_editor">Campaign Editor - Edit specific campaigns only</option>
                    <option value="campaign_viewer">Campaign Viewer - View specific campaigns only</option>
                  </optgroup>
                </select>
                <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none">
                  <svg width="16" height="16" viewBox="0 0 16 16" fill="none" className="text-slate-400">
                    <path d="M4 6L8 10L12 6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                </div>
              </div>
            </div>

            {isCampaignOnly && (
              <div className="animate-in fade-in duration-300">
                <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-3">
                  Select Campaigns <span className="text-red-400">*</span>
                </label>
                <div className="border border-white/[0.1] rounded-lg p-4 max-h-52 overflow-y-auto space-y-2.5 bg-white/[0.02] scrollbar-thin scrollbar-thumb-white/[0.1] scrollbar-track-transparent">
                  {campaigns.length > 0 ? (
                    campaigns.map(campaign => (
                      <label key={campaign.id} className="flex items-center gap-3.5 p-3 hover:bg-white/[0.04] rounded-lg cursor-pointer transition-all duration-200 group">
                        <input
                          type="checkbox"
                          checked={selectedCampaigns.includes(campaign.id)}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setSelectedCampaigns([...selectedCampaigns, campaign.id]);
                            } else {
                              setSelectedCampaigns(selectedCampaigns.filter(id => id !== campaign.id));
                            }
                          }}
                          className="rounded border-white/[0.2] text-primary focus:ring-primary/30 focus:ring-offset-0 focus:ring-2 transition-all w-4 h-4 cursor-pointer"
                        />
                        <span className="text-sm text-white font-medium group-hover:text-primary transition-colors">{campaign.name}</span>
                      </label>
                    ))
                  ) : (
                    <div className="flex flex-col items-center justify-center py-8">
                      <div className="w-12 h-12 rounded-full bg-slate-800/50 flex items-center justify-center mb-3">
                        <Megaphone className="w-5 h-5 text-slate-500" />
                      </div>
                      <p className="text-sm text-slate-500">No campaigns available</p>
                    </div>
                  )}
                </div>
              </div>
            )}

            <div>
              <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-3">
                Message <span className="text-slate-600 font-normal">(Optional)</span>
              </label>
              <textarea
                placeholder="Add a personal message to the invitation..."
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                rows={3}
                className="w-full px-4 py-3 bg-white/[0.04] border border-white/[0.1] rounded-lg text-white placeholder:text-slate-600 text-sm focus:bg-white/[0.06] focus:border-primary/50 focus:ring-2 focus:ring-primary/20 transition-all duration-200 resize-none"
              />
            </div>
          </div>

          <div className="sticky bottom-0 bg-[#0D0D0D]/95 backdrop-blur-xl border-t border-white/[0.08] px-8 py-5">
            <div className="flex gap-3">
              <Button
                onClick={handleSubmit}
                className="flex-1 h-12 bg-primary hover:bg-primary/90 text-white font-semibold shadow-lg shadow-primary/25 hover:shadow-primary/40 transition-all duration-200 rounded-lg"
              >
                <Mail className="w-4.5 h-4.5 mr-2.5" />
                Send Invitation
              </Button>
              <Button
                onClick={onClose}
                variant="outline"
                className="h-12 px-8 bg-white/[0.04] hover:bg-white/[0.08] border-white/[0.1] hover:border-white/[0.15] text-slate-300 hover:text-white transition-all duration-200 rounded-lg font-medium"
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