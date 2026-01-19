import { useQuery } from '@tanstack/react-query';
import { useAuth } from '../contexts/AuthContext';
import { useWorkspace } from '../contexts/WorkspaceContext';
import { supabase } from '../lib/supabase';
import type { MemberScope, TeamMember, TeamRole } from '../lib/types/database';

type CampaignAccess = {
  campaignId: string;
  access: 'editor' | 'viewer';
};

type WorkspaceAccessData = {
  member: TeamMember | null;
  scopes: MemberScope[];
};

const accessKeys = {
  all: ['workspace-access'] as const,
  byWorkspace: (workspaceId?: string, userId?: string) =>
    [...accessKeys.all, workspaceId, userId] as const,
};

const parseCampaignScope = (scopeValue: string): CampaignAccess => {
  const [campaignId, access] = scopeValue.split(':');
  return {
    campaignId,
    access: (access as 'editor' | 'viewer') || 'viewer',
  };
};

export function useWorkspaceAccess() {
  const { user } = useAuth();
  const { activeWorkspaceId } = useWorkspace();

  const { data, isLoading } = useQuery<WorkspaceAccessData>({
    queryKey: accessKeys.byWorkspace(activeWorkspaceId, user?.id),
    enabled: Boolean(activeWorkspaceId && user?.id),
    queryFn: async () => {
      if (!activeWorkspaceId || !user?.id) {
        return { member: null, scopes: [] };
      }

      const { data: member } = await supabase
        .from('workspace_members')
        .select('*')
        .eq('workspace_id', activeWorkspaceId)
        .eq('user_id', user.id)
        .maybeSingle();

      if (!member || member.status !== 'active') {
        return { member: null, scopes: [] };
      }

      const { data: scopes } = await supabase
        .from('member_scopes')
        .select('*')
        .eq('team_member_id', member.id);

      return { member, scopes: (scopes || []) as MemberScope[] };
    },
  });

  const member = data?.member || null;
  const scopes = data?.scopes || [];

  const role = member?.role || null;
  const isOwnerOrAdmin = role === 'owner' || role === 'admin';
  const isEditor = role === 'editor';
  const campaignAccess = scopes
    .filter((scope) => scope.scope_type === 'campaign')
    .map((scope) => parseCampaignScope(scope.scope_value));

  const hasWorkspaceViewer = Boolean(role);
  const hasWorkspaceEditor = isOwnerOrAdmin || isEditor;

  const canViewCalendar = hasWorkspaceViewer;
  const canEditCalendar = hasWorkspaceEditor;

  const canViewCampaign = (_campaignId: string) => hasWorkspaceViewer;
  const canEditCampaign = (_campaignId: string) => hasWorkspaceEditor;

  return {
    loading: isLoading,
    member,
    scopes,
    role: role as TeamRole | null,
    canManageTeam: isOwnerOrAdmin,
    canViewWorkspace: hasWorkspaceViewer,
    canEditWorkspace: hasWorkspaceEditor,
    canViewCalendar,
    canEditCalendar,
    canViewCampaign,
    canEditCampaign,
    campaignAccess,
    hasCampaignAccess: campaignAccess.length > 0,
  };
}
