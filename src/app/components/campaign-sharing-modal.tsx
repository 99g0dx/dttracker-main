import React, { useState } from 'react';
import { Card, CardContent } from './ui/card';
import { Button } from './ui/button';
import { Input } from './ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from './ui/select';
import {
  X,
  Users,
  Search,
  Shield,
  Trash2,
  Mail,
} from 'lucide-react';
import { toast } from 'sonner';
import {
  useTeamMembers,
  useCampaignMembersWithEmails,
  useAddCampaignMember,
  useAddCampaignMemberByEmail,
  useUpdateCampaignMemberRole,
  useRemoveCampaignMember,
  useUsersSubscriptionStatus,
} from '../../hooks/useCampaignMembers';
import { useAuth } from '../../contexts/AuthContext';
import { supabase } from '../../lib/supabase';

interface CampaignSharingModalProps {
  campaignId: string;
  campaignName: string;
  onClose: () => void;
}

function getCampaignUrl(campaignId: string): string {
  if (typeof window === 'undefined') return '';
  return `${window.location.origin}/campaigns/${campaignId}`;
}

export function CampaignSharingModal({ campaignId, campaignName, onClose }: CampaignSharingModalProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [emailInput, setEmailInput] = useState('');
  const [emailRole, setEmailRole] = useState<'editor' | 'viewer'>('editor');
  const { user } = useAuth();

  const { data: teamMembers = [], isLoading: teamLoading } = useTeamMembers();
  const { data: membersWithEmails = [], isLoading: membersWithEmailsLoading } = useCampaignMembersWithEmails(campaignId);
  const addMemberMutation = useAddCampaignMember();
  const addByEmailMutation = useAddCampaignMemberByEmail();
  const updateRoleMutation = useUpdateCampaignMemberRole();
  const removeMemberMutation = useRemoveCampaignMember();

  const memberIdsWithAccess = membersWithEmails.map(m => m.user_id);
  const filteredTeamMembers = teamMembers.filter(m =>
    (m.full_name?.toLowerCase().includes(searchQuery.toLowerCase()) ?? false) ||
    m.email.toLowerCase().includes(searchQuery.toLowerCase())
  );
  const membersWithoutAccess = filteredTeamMembers.filter(m => !memberIdsWithAccess.includes(m.id));
  const memberIdsWithoutAccess = membersWithoutAccess.map(m => m.id);
  const { data: subscriptionStatusMap = {}, isLoading: subscriptionLoading } = useUsersSubscriptionStatus(memberIdsWithoutAccess);

  const handleAddMember = async (userId: string, role: 'editor' | 'viewer', memberEmail: string) => {
    try {
      await addMemberMutation.mutateAsync({
        campaign_id: campaignId,
        user_id: userId,
        role,
      });
      const url = getCampaignUrl(campaignId);
      if (url && memberEmail) {
        try {
          await supabase.functions.invoke('send-campaign-added-email', {
            body: { email: memberEmail, campaignName, campaignUrl: url, role },
          });
        } catch {
          // ignore
        }
      }
    } catch {
      // toast from mutation
    }
  };

  const handleRemoveMember = (userId: string) => {
    removeMemberMutation.mutate({ campaignId, userId });
  };

  const handleUpdateRole = (userId: string, role: 'editor' | 'viewer') => {
    updateRoleMutation.mutate({ campaignId, userId, role });
  };

  const [sendingEmailTo, setSendingEmailTo] = useState<string | null>(null);

  const handleResendInvite = async (email: string, role: string) => {
    setSendingEmailTo(email);
    try {
      const { data: emailData, error: emailError } = await supabase.functions.invoke('send-campaign-added-email', {
        body: { email, campaignName, campaignUrl: getCampaignUrl(campaignId), role },
      });
      if (emailError) {
        toast.error(`Failed to send email: ${emailError.message}`);
      } else if (emailData && !emailData.success) {
        toast.error(`Failed to send email: ${emailData.error || 'Unknown error'}`);
      } else {
        toast.success(`Invite email sent to ${email}`);
      }
    } catch {
      toast.error('Failed to send invite email');
    } finally {
      setSendingEmailTo(null);
    }
  };

  const handleAddByEmail = () => {
    const email = emailInput.trim();
    if (!email) return;
    addByEmailMutation.mutate({
      params: { campaignId, email, role: emailRole, campaignName },
      campaignUrl: getCampaignUrl(campaignId),
    });
    setEmailInput('');
  };

  const isLoading = teamLoading || membersWithEmailsLoading;

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4" onClick={onClose}>
      <Card className="bg-[#0D0D0D] border-white/[0.08] max-w-2xl w-full max-h-[85vh] overflow-hidden shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <CardContent className="p-0">
          {/* Header */}
          <div className="sticky top-0 bg-[#0D0D0D]/95 backdrop-blur-xl border-b border-white/[0.08] px-8 py-6 z-10">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-xl font-semibold text-white tracking-tight">Share Campaign</h2>
                <p className="text-sm text-slate-500 mt-1.5">{campaignName}</p>
              </div>
              <button
                onClick={onClose}
                className="w-9 h-9 rounded-lg hover:bg-white/[0.08] flex items-center justify-center transition-all duration-200"
              >
                <X className="w-4.5 h-4.5 text-slate-400" />
              </button>
            </div>

            {/* Search */}
            <div className="mt-5 relative">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
              <Input
                placeholder="Search team members..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="h-11 pl-11 bg-white/[0.04] border-white/[0.1] text-white placeholder:text-slate-600 focus:bg-white/[0.06] focus:border-primary/50 focus:ring-2 focus:ring-primary/20 transition-all duration-200"
              />
            </div>
          </div>

          {/* Content */}
          <div className="px-8 py-6 max-h-[calc(85vh-200px)] overflow-y-auto">
            {isLoading && (
              <div className="flex flex-col items-center justify-center py-12">
                <div className="w-16 h-16 rounded-full bg-slate-800/50 flex items-center justify-center mb-4">
                  <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin"></div>
                </div>
                <p className="text-slate-400 text-sm">Loading members...</p>
              </div>
            )}

            {!isLoading && (
              <>
                {/* Add by email */}
                <div className="mb-8">
                  <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">
                    Add by email
                  </h3>
                  <div className="flex flex-wrap items-end gap-2">
                    <Input
                      type="email"
                      placeholder="Email address"
                      value={emailInput}
                      onChange={(e) => setEmailInput(e.target.value)}
                      className="flex-1 min-w-[180px] h-11 bg-white/[0.04] border-white/[0.1] text-white placeholder:text-slate-600"
                    />
                    <Select value={emailRole} onValueChange={(v) => setEmailRole(v as 'editor' | 'viewer')}>
                      <SelectTrigger className="w-[120px] h-11 bg-white/[0.04] border-white/[0.1] text-white">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="editor">Can edit</SelectItem>
                        <SelectItem value="viewer">View only</SelectItem>
                      </SelectContent>
                    </Select>
                    <Button
                      onClick={handleAddByEmail}
                      disabled={!emailInput.trim() || addByEmailMutation.isPending}
                      size="sm"
                      className="h-11 px-4 bg-primary/10 hover:bg-primary/20 border border-primary/20 text-primary"
                    >
                      {addByEmailMutation.isPending ? 'Adding...' : 'Add'}
                    </Button>
                  </div>
                </div>

                {/* Has Access */}
                {membersWithEmails.length > 0 && (
                  <div className="mb-8">
                    <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-4">
                      Has Access ({membersWithEmails.length})
                    </h3>
                    <div className="space-y-2">
                      {membersWithEmails.map((member) => {
                        const displayName = member.full_name || member.email?.split('@')[0] || member.user_id.slice(0, 8);
                        const displayEmail = member.email || `ID: ${member.user_id.slice(0, 12)}…`;
                        const roleLabel = member.role === 'viewer' ? 'View only' : 'Can edit';
                        return (
                          <div key={member.user_id} className="flex items-center justify-between p-4 bg-white/[0.03] hover:bg-white/[0.05] border border-white/[0.08] rounded-lg transition-all duration-200">
                            <div className="flex items-center gap-3">
                              <div className="w-10 h-10 rounded-full bg-gradient-to-br from-primary to-red-400 dark:to-cyan-400 flex items-center justify-center text-white font-semibold flex-shrink-0">
                                {displayName.charAt(0).toUpperCase()}
                              </div>
                              <div>
                                <div className="flex items-center gap-2">
                                  <h4 className="font-medium text-white text-sm">{displayName}</h4>
                                  {member.user_id === user?.id && (
                                    <span className="text-xs px-2 py-0.5 bg-primary/10 text-primary rounded border border-primary/20">
                                      You
                                    </span>
                                  )}
                                </div>
                                <p className="text-xs text-slate-500">{displayEmail}</p>
                              </div>
                            </div>
                            <div className="flex items-center gap-2">
                              <Select
                                value={member.role}
                                onValueChange={(v) => handleUpdateRole(member.user_id, v as 'editor' | 'viewer')}
                              >
                                <SelectTrigger className="w-[120px] h-9 bg-white/[0.04] border-white/[0.1] text-white text-sm">
                                  <SelectValue>{roleLabel}</SelectValue>
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="editor">Can edit</SelectItem>
                                  <SelectItem value="viewer">View only</SelectItem>
                                </SelectContent>
                              </Select>
                              {member.user_id !== user?.id && (
                                <>
                                  <button
                                    onClick={() => handleResendInvite(member.email, member.role)}
                                    disabled={sendingEmailTo === member.email}
                                    title="Resend invite email"
                                    className="w-9 h-9 rounded-lg hover:bg-primary/10 flex items-center justify-center transition-all duration-200 group disabled:opacity-50"
                                  >
                                    <Mail className="w-4 h-4 text-slate-400 group-hover:text-primary" />
                                  </button>
                                  <button
                                    onClick={() => handleRemoveMember(member.user_id)}
                                    disabled={removeMemberMutation.isPending}
                                    className="w-9 h-9 rounded-lg hover:bg-red-500/10 flex items-center justify-center transition-all duration-200 group disabled:opacity-50"
                                  >
                                    <Trash2 className="w-4 h-4 text-slate-400 group-hover:text-red-400" />
                                  </button>
                                </>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* Add Members (team list) */}
                {membersWithoutAccess.length > 0 && (
              <div>
                <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-4">
                  Add Members ({membersWithoutAccess.length})
                </h3>
                <div className="space-y-2">
                  {membersWithoutAccess.map(member => {
                    const displayName = member.full_name || member.email.split('@')[0];
                    const notSubscribed = !subscriptionLoading && subscriptionStatusMap[member.id] === false;
                    return (
                      <div key={member.id} className="flex items-center justify-between p-4 bg-white/[0.02] hover:bg-white/[0.04] border border-white/[0.06] rounded-lg transition-all duration-200">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-full bg-slate-800 flex items-center justify-center text-slate-400 font-semibold flex-shrink-0">
                            {displayName.charAt(0).toUpperCase()}
                          </div>
                          <div>
                            <div className="flex items-center gap-2">
                              <h4 className="font-medium text-white text-sm">{displayName}</h4>
                              {member.id === user?.id && (
                                <span className="text-xs px-2 py-0.5 bg-primary/10 text-primary rounded border border-primary/20">
                                  You
                                </span>
                              )}
                            </div>
                            <p className="text-xs text-slate-500">{member.email}</p>
                            {notSubscribed && (
                              <p className="text-xs text-amber-500 mt-1">
                                Only subscribed users can be added. Ask them to subscribe first.
                              </p>
                            )}
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <Button
                            onClick={() => handleAddMember(member.id, 'editor', member.email)}
                            size="sm"
                            className="h-9 px-3 bg-primary/10 hover:bg-primary/20 border border-primary/20 text-primary text-sm"
                            disabled={addMemberMutation.isPending || notSubscribed}
                            title={notSubscribed ? 'Only subscribed users can be added' : undefined}
                          >
                            <Shield className="w-3.5 h-3.5 mr-1.5" />
                            Add member
                          </Button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
                )}

                {filteredTeamMembers.length === 0 && (
                  <div className="flex flex-col items-center justify-center py-12">
                    <div className="w-16 h-16 rounded-full bg-slate-800/50 flex items-center justify-center mb-4">
                      <Users className="w-7 h-7 text-slate-500" />
                    </div>
                    <p className="text-slate-400 text-sm">No team members found</p>
                  </div>
                )}
              </>
            )}
          </div>

          {/* Footer */}
          <div className="sticky bottom-0 bg-[#0D0D0D]/95 backdrop-blur-xl border-t border-white/[0.08] px-8 py-5">
            <Button
              onClick={onClose}
              className="w-full h-11 bg-white/[0.04] hover:bg-white/[0.08] border border-white/[0.1] hover:border-white/[0.15] text-white transition-all duration-200 rounded-lg font-medium"
            >
              Done
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
