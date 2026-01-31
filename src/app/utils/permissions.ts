// Permission and access control utilities for DTTracker

export type WorkspaceRole = 'brand_owner' | 'agency_admin' | 'brand_member' | 'agency_ops';
export type MemberStatus = 'active' | 'pending';
export type ScopeType = 'workspace' | 'campaign' | 'calendar';
export type AccessLevel = 'editor' | 'viewer';

export interface TeamMember {
  id: number;
  workspaceId: number;
  userId: number;
  email: string;
  name: string;
  role: WorkspaceRole;
  status: MemberStatus;
  invitedAt: string;
  joinedAt?: string;
}

export interface MemberScope {
  id: number;
  workspaceId: number;
  userId: number;
  scopeType: ScopeType;
  scopeValue: string; // 'editor', 'viewer', or campaign ID
  createdAt: string;
}

export interface CampaignMember {
  id: number;
  campaignId: number;
  userId: number;
  access: AccessLevel;
  addedAt: string;
}

export interface CurrentUser {
  id: number;
  email: string;
  name: string;
  workspaceId: number;
}

export interface AuditLogEntry {
  id: number;
  workspaceId: number;
  userId: number;
  userName: string;
  action: 'invite_sent' | 'invite_accepted' | 'member_removed' | 'role_changed' | 'scope_added' | 'scope_removed' | 'campaign_shared' | 'campaign_access_removed';
  targetUserId?: number;
  targetUserName?: string;
  resourceType?: 'campaign' | 'calendar' | 'workspace';
  resourceId?: number;
  resourceName?: string;
  details?: string;
  timestamp: string;
}

export interface ActivityFeedItem {
  id: number;
  userId: number;
  userName: string;
  userAvatar?: string;
  action: 'invited_member' | 'accepted_invite' | 'removed_member' | 'updated_permissions' | 'shared_campaign' | 'created_activity' | 'completed_activity' | 'updated_campaign';
  targetName?: string;
  resourceType?: 'campaign' | 'activity' | 'member';
  resourceId?: number;
  timestamp: string;
}

// Storage keys
const TEAM_MEMBERS_KEY = 'dttracker-team-members';
const MEMBER_SCOPES_KEY = 'dttracker-member-scopes';
const CAMPAIGN_MEMBERS_KEY = 'dttracker-campaign-members';
const CURRENT_USER_KEY = 'dttracker-current-user';
const AUDIT_LOG_KEY = 'dttracker-audit-log';
const ACTIVITY_FEED_KEY = 'dttracker-activity-feed';

// Initialize default owner user
export function initializeCurrentUser(): CurrentUser {
  if (typeof window === 'undefined') return { id: 1, email: 'you@company.com', name: 'You', workspaceId: 1 };
  
  const stored = localStorage.getItem(CURRENT_USER_KEY);
  if (stored) {
    try {
      return JSON.parse(stored);
    } catch (e) {
      // fallback
    }
  }
  
  const defaultUser: CurrentUser = {
    id: 1,
    email: 'you@company.com',
    name: 'You',
    workspaceId: 1,
  };
  
  localStorage.setItem(CURRENT_USER_KEY, JSON.stringify(defaultUser));
  
  // Ensure owner exists in team members
  const members = getTeamMembers();
  if (!members.find(m => m.userId === 1)) {
    const ownerMember: TeamMember = {
      id: 1,
      workspaceId: 1,
      userId: 1,
      email: defaultUser.email,
      name: defaultUser.name,
      role: 'brand_owner',
      status: 'active',
      invitedAt: new Date().toISOString(),
      joinedAt: new Date().toISOString(),
    };
    saveTeamMember(ownerMember);
  }
  
  return defaultUser;
}

export function getCurrentUser(): CurrentUser {
  return initializeCurrentUser();
}

export function switchUser(userId: number): void {
  if (typeof window === 'undefined') return;
  
  const members = getTeamMembers();
  const member = members.find(m => m.userId === userId && m.status === 'active');
  
  if (member) {
    const user: CurrentUser = {
      id: member.userId,
      email: member.email,
      name: member.name,
      workspaceId: member.workspaceId,
    };
    localStorage.setItem(CURRENT_USER_KEY, JSON.stringify(user));
    window.location.reload(); // Reload to apply new permissions
  }
}

// Team Members CRUD
export function getTeamMembers(): TeamMember[] {
  if (typeof window === 'undefined') return [];
  const stored = localStorage.getItem(TEAM_MEMBERS_KEY);
  return stored ? JSON.parse(stored) : [];
}

export function saveTeamMember(member: TeamMember): void {
  if (typeof window === 'undefined') return;
  const members = getTeamMembers();
  const index = members.findIndex(m => m.id === member.id);
  if (index >= 0) {
    members[index] = member;
  } else {
    members.push(member);
  }
  localStorage.setItem(TEAM_MEMBERS_KEY, JSON.stringify(members));
}

export function deleteTeamMember(memberId: number): void {
  if (typeof window === 'undefined') return;
  const members = getTeamMembers().filter(m => m.id !== memberId);
  localStorage.setItem(TEAM_MEMBERS_KEY, JSON.stringify(members));
  
  // Also delete associated scopes
  const scopes = getMemberScopes().filter(s => s.userId !== memberId);
  localStorage.setItem(MEMBER_SCOPES_KEY, JSON.stringify(scopes));
}

// Member Scopes CRUD
export function getMemberScopes(userId?: number): MemberScope[] {
  if (typeof window === 'undefined') return [];
  const stored = localStorage.getItem(MEMBER_SCOPES_KEY);
  const scopes: MemberScope[] = stored ? JSON.parse(stored) : [];
  return userId ? scopes.filter(s => s.userId === userId) : scopes;
}

export function saveMemberScope(scope: MemberScope): void {
  if (typeof window === 'undefined') return;
  const scopes = getMemberScopes();
  const index = scopes.findIndex(s => s.id === scope.id);
  if (index >= 0) {
    scopes[index] = scope;
  } else {
    scopes.push(scope);
  }
  localStorage.setItem(MEMBER_SCOPES_KEY, JSON.stringify(scopes));
}

export function deleteMemberScope(scopeId: number): void {
  if (typeof window === 'undefined') return;
  const scopes = getMemberScopes().filter(s => s.id !== scopeId);
  localStorage.setItem(MEMBER_SCOPES_KEY, JSON.stringify(scopes));
}

// Campaign Members CRUD
export function getCampaignMembers(campaignId?: number): CampaignMember[] {
  if (typeof window === 'undefined') return [];
  const stored = localStorage.getItem(CAMPAIGN_MEMBERS_KEY);
  const members: CampaignMember[] = stored ? JSON.parse(stored) : [];
  return campaignId ? members.filter(m => m.campaignId === campaignId) : members;
}

export function saveCampaignMember(member: CampaignMember): void {
  if (typeof window === 'undefined') return;
  const members = getCampaignMembers();
  const index = members.findIndex(m => m.id === member.id);
  if (index >= 0) {
    members[index] = member;
  } else {
    members.push(member);
  }
  localStorage.setItem(CAMPAIGN_MEMBERS_KEY, JSON.stringify(members));
}

export function deleteCampaignMember(id: number): void {
  if (typeof window === 'undefined') return;
  const members = getCampaignMembers().filter(m => m.id !== id);
  localStorage.setItem(CAMPAIGN_MEMBERS_KEY, JSON.stringify(members));
}

// Permission checking functions
export function hasWorkspaceScope(userId: number, access: AccessLevel): boolean {
  const scopes = getMemberScopes(userId);
  return scopes.some(s => s.scopeType === 'workspace' && s.scopeValue === access);
}

export function hasCalendarScope(userId: number, access: AccessLevel): boolean {
  const scopes = getMemberScopes(userId);
  return scopes.some(s => s.scopeType === 'calendar' && s.scopeValue === access);
}

export function hasCampaignScope(userId: number, campaignId: number, access: AccessLevel): boolean {
  const scopes = getMemberScopes(userId);
  return scopes.some(s => 
    s.scopeType === 'campaign' && 
    s.scopeValue === `${campaignId}:${access}`
  );
}

export function canAccessCampaign(userId: number, campaignId: number): boolean {
  // Workspace viewer or editor can access all campaigns
  if (hasWorkspaceScope(userId, 'viewer') || hasWorkspaceScope(userId, 'editor')) {
    return true;
  }
  
  // Check campaign-specific scopes
  return hasCampaignScope(userId, campaignId, 'viewer') || hasCampaignScope(userId, campaignId, 'editor');
}

export function canEditCampaign(userId: number, campaignId: number): boolean {
  // Workspace editor can edit all campaigns
  if (hasWorkspaceScope(userId, 'editor')) {
    return true;
  }
  
  // Check campaign-specific editor scope
  return hasCampaignScope(userId, campaignId, 'editor');
}

export function canAccessCalendar(userId: number): boolean {
  // Workspace access grants calendar access
  if (hasWorkspaceScope(userId, 'viewer') || hasWorkspaceScope(userId, 'editor')) {
    return true;
  }
  
  // Check calendar-specific scopes
  return hasCalendarScope(userId, 'viewer') || hasCalendarScope(userId, 'editor');
}

export function canEditCalendar(userId: number): boolean {
  // Workspace editor can edit calendar
  if (hasWorkspaceScope(userId, 'editor')) {
    return true;
  }
  
  // Check calendar-specific editor scope
  return hasCalendarScope(userId, 'editor');
}

export function getAccessibleCampaigns(userId: number, allCampaigns: any[]): any[] {
  // Workspace scope grants access to all
  if (hasWorkspaceScope(userId, 'viewer') || hasWorkspaceScope(userId, 'editor')) {
    return allCampaigns;
  }
  
  // Filter to only campaigns user has access to
  const scopes = getMemberScopes(userId);
  const campaignScopes = scopes.filter(s => s.scopeType === 'campaign');
  const accessibleCampaignIds = campaignScopes.map(s => {
    const match = s.scopeValue.match(/^(\d+):/);
    return match ? parseInt(match[1]) : null;
  }).filter(Boolean);
  
  return allCampaigns.filter(c => accessibleCampaignIds.includes(c.id));
}

export function canAccessActivity(userId: number, activity: any, allCampaigns: any[]): boolean {
  // Workspace or calendar scope grants access
  if (hasWorkspaceScope(userId, 'viewer') || hasWorkspaceScope(userId, 'editor')) {
    return true;
  }
  
  if (hasCalendarScope(userId, 'viewer') || hasCalendarScope(userId, 'editor')) {
    // If activity is linked to campaigns, check campaign access
    if (activity.linkedCampaigns && activity.linkedCampaigns.length > 0) {
      return activity.linkedCampaigns.some((campaignId: number) => canAccessCampaign(userId, campaignId));
    }
    return true;
  }
  
  // If no calendar scope, check if linked campaigns are accessible
  if (activity.linkedCampaigns && activity.linkedCampaigns.length > 0) {
    return activity.linkedCampaigns.some((campaignId: number) => canAccessCampaign(userId, campaignId));
  }
  
  return false;
}

export function getUserRole(userId: number): WorkspaceRole | null {
  const members = getTeamMembers();
  const member = members.find(m => m.userId === userId && m.status === 'active');
  return member?.role || null;
}

export function isOwnerOrAdmin(userId: number): boolean {
  const role = getUserRole(userId);
  return role === 'brand_owner' || role === 'agency_admin';
}

export function canManageTeam(userId: number): boolean {
  return isOwnerOrAdmin(userId);
}

export function canManageBilling(userId: number): boolean {
  const role = getUserRole(userId);
  return role === 'brand_owner';
}

// Invite creation helper
export interface InviteData {
  email: string;
  name: string;
  rolePreset: 'admin' | 'editor' | 'viewer';
  message?: string;
}

export function createInvite(data: InviteData, invitedBy: number): TeamMember {
  const newUserId = Date.now();
  const newMemberId = Date.now() + 1;
  
  // Determine role based on preset
  const role: WorkspaceRole =
    data.rolePreset === 'admin'
      ? 'agency_admin'
      : data.rolePreset === 'editor'
        ? 'brand_member'
        : 'agency_ops';
  
  const member: TeamMember = {
    id: newMemberId,
    workspaceId: 1,
    userId: newUserId,
    email: data.email,
    name: data.name,
    role,
    status: 'pending',
    invitedAt: new Date().toISOString(),
  };
  
  saveTeamMember(member);
  
  // Create scopes based on preset
  const timestamp = new Date().toISOString();
  let scopeId = Date.now() + 100;
  
  if (data.rolePreset === 'admin' || data.rolePreset === 'editor') {
    saveMemberScope({
      id: scopeId++,
      workspaceId: 1,
      userId: newUserId,
      scopeType: 'workspace',
      scopeValue: 'editor',
      createdAt: timestamp,
    });
  } else if (data.rolePreset === 'viewer') {
    saveMemberScope({
      id: scopeId++,
      workspaceId: 1,
      userId: newUserId,
      scopeType: 'workspace',
      scopeValue: 'viewer',
      createdAt: timestamp,
    });
  }
  
  return member;
}

// Accept invite helper
export function acceptInvite(memberId: number): void {
  const members = getTeamMembers();
  const member = members.find(m => m.id === memberId);
  if (member && member.status === 'pending') {
    member.status = 'active';
    member.joinedAt = new Date().toISOString();
    saveTeamMember(member);
  }
}

// Add campaign access to existing user
export function addCampaignAccess(userId: number, campaignId: number, access: AccessLevel): void {
  const scopeId = Date.now();
  const timestamp = new Date().toISOString();
  
  saveMemberScope({
    id: scopeId,
    workspaceId: 1,
    userId,
    scopeType: 'campaign',
    scopeValue: `${campaignId}:${access}`,
    createdAt: timestamp,
  });
  
  saveCampaignMember({
    id: scopeId + 1,
    campaignId,
    userId,
    access,
    addedAt: timestamp,
  });
}

// Remove campaign access from user
export function removeCampaignAccess(userId: number, campaignId: number): void {
  // Remove scopes
  const scopes = getMemberScopes(userId);
  const scopesToRemove = scopes.filter(s => 
    s.scopeType === 'campaign' && s.scopeValue.startsWith(`${campaignId}:`)
  );
  scopesToRemove.forEach(s => deleteMemberScope(s.id));
  
  // Remove campaign member entries
  const campaignMembers = getCampaignMembers(campaignId);
  const memberToRemove = campaignMembers.find(m => m.userId === userId);
  if (memberToRemove) {
    deleteCampaignMember(memberToRemove.id);
  }
}

// Audit Log Functions
export function getAuditLog(limit?: number): AuditLogEntry[] {
  if (typeof window === 'undefined') return [];
  const stored = localStorage.getItem(AUDIT_LOG_KEY);
  const log: AuditLogEntry[] = stored ? JSON.parse(stored) : [];
  return limit ? log.slice(0, limit) : log;
}

export function addAuditLogEntry(entry: Omit<AuditLogEntry, 'id' | 'timestamp'>): void {
  if (typeof window === 'undefined') return;
  const log = getAuditLog();
  const newEntry: AuditLogEntry = {
    ...entry,
    id: Date.now(),
    timestamp: new Date().toISOString(),
  };
  log.unshift(newEntry); // Add to beginning
  // Keep only last 500 entries
  const trimmedLog = log.slice(0, 500);
  localStorage.setItem(AUDIT_LOG_KEY, JSON.stringify(trimmedLog));
}

// Activity Feed Functions
export function getActivityFeed(limit?: number): ActivityFeedItem[] {
  if (typeof window === 'undefined') return [];
  const stored = localStorage.getItem(ACTIVITY_FEED_KEY);
  const feed: ActivityFeedItem[] = stored ? JSON.parse(stored) : [];
  return limit ? feed.slice(0, limit) : feed;
}

export function addActivityFeedItem(item: Omit<ActivityFeedItem, 'id' | 'timestamp'>): void {
  if (typeof window === 'undefined') return;
  const feed = getActivityFeed();
  const newItem: ActivityFeedItem = {
    ...item,
    id: Date.now(),
    timestamp: new Date().toISOString(),
  };
  feed.unshift(newItem); // Add to beginning
  // Keep only last 200 items
  const trimmedFeed = feed.slice(0, 200);
  localStorage.setItem(ACTIVITY_FEED_KEY, JSON.stringify(trimmedFeed));
}

// Bulk Invite Interface
export interface BulkInviteData {
  invites: InviteData[];
}

export function createBulkInvites(data: BulkInviteData, invitedBy: number): TeamMember[] {
  const currentUser = getCurrentUser();
  const members: TeamMember[] = [];
  
  data.invites.forEach(inviteData => {
    const member = createInvite(inviteData, invitedBy);
    members.push(member);
    
    // Add audit log
    addAuditLogEntry({
      workspaceId: 1,
      userId: invitedBy,
      userName: currentUser.name,
      action: 'invite_sent',
      targetUserId: member.userId,
      targetUserName: member.name,
      details: `Invited as ${inviteData.rolePreset}`,
    });
    
    // Add activity feed
    addActivityFeedItem({
      userId: invitedBy,
      userName: currentUser.name,
      action: 'invited_member',
      targetName: member.name,
      resourceType: 'member',
    });
  });
  
  return members;
}
