import { useQuery } from "@tanstack/react-query";
import { useAuth } from "../contexts/AuthContext";
import { useWorkspace } from "../contexts/WorkspaceContext";
import { supabase } from "../lib/supabase";
import type { MemberScope, TeamMember, TeamRole } from "../lib/types/database";
import { isWorkspaceOwner } from "../lib/roles";

type CampaignAccess = {
  campaignId: string;
  access: "editor" | "viewer";
};

type WorkspaceAccessData = {
  member: TeamMember | null;
  scopes: MemberScope[];
};

const accessKeys = {
  all: ["workspace-access"] as const,
  byWorkspace: (workspaceId?: string, userId?: string) =>
    [...accessKeys.all, workspaceId, userId] as const,
};

const parseCampaignScope = (scopeValue: string): CampaignAccess => {
  const [campaignId, access] = scopeValue.split(":");
  return {
    campaignId,
    access: (access as "editor" | "viewer") || "viewer",
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

      let { data: member } = await supabase
        .from("workspace_members")
        .select("*")
        .eq("workspace_id", activeWorkspaceId)
        .eq("user_id", user.id)
        .maybeSingle();

      // Self-heal: if workspace owner lacks brand_owner row, upsert it
      if (!member || member.status !== "active" || member.role !== "brand_owner") {
        const { data: ws } = await supabase
          .from("workspaces")
          .select("owner_user_id")
          .eq("id", activeWorkspaceId)
          .maybeSingle();

        if (ws?.owner_user_id === user.id) {
          const { data: upserted } = await supabase
            .from("workspace_members")
            .upsert(
              {
                workspace_id: activeWorkspaceId,
                user_id: user.id,
                role: "brand_owner" as const,
                status: "active" as const,
              },
              { onConflict: "workspace_id,user_id" }
            )
            .select("*")
            .single();

          if (upserted) {
            member = upserted;
          }
        }
      }

      if (!member || member.status !== "active") {
        return { member: null, scopes: [] };
      }

      const { data: scopes } = await supabase
        .from("member_scopes")
        .select("*")
        .eq("team_member_id", member.id);

      return { member, scopes: (scopes || []) as MemberScope[] };
    },
  });

  const member = data?.member || null;
  const scopes = data?.scopes || [];

  const hasAccess = Boolean(member);
  const campaignAccess = scopes
    .filter((scope) => scope.scope_type === "campaign")
    .map((scope) => parseCampaignScope(scope.scope_value));

  const isOwner = isWorkspaceOwner(member?.role);

  const canViewWorkspace = hasAccess;
  const canViewCalendar = hasAccess;
  const canEditCalendar = hasAccess;
  const canViewCampaign = (_campaignId: string) => hasAccess;
  const canEditCampaign = (_campaignId: string) => hasAccess;

  return {
    loading: isLoading,
    member,
    scopes,
    role: (member?.role || null) as TeamRole | null,
    isOwner,
    canManageTeam: isOwner,
    canDeleteCampaign: isOwner,
    canExportData: hasAccess,
    canTriggerScrape: hasAccess,
    canManageCreators: hasAccess,
    canViewWorkspace,
    canEditWorkspace: isOwner,
    canViewCalendar,
    canEditCalendar,
    canViewCampaign,
    canEditCampaign,
    campaignAccess,
    hasCampaignAccess: hasAccess,
  };
}
