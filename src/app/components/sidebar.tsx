import React from 'react';
import { LayoutDashboard, FileText, Megaphone, Users, Settings, Command, Crown, Menu, X, Link2, FolderOpen, Calendar, Shield, LogOut, ChevronDown, Plus, Trash2, Loader2 } from 'lucide-react';
import { cn } from './ui/utils';
import logoImage from '../../assets/fcad7446971be733d3427a6b22f8f64253529daf.png';
import { NotificationsCenter } from './notifications-center';
import { useAuth } from '../../contexts/AuthContext';
import { supabase } from '../../lib/supabase';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { useWorkspace } from '../../contexts/WorkspaceContext';
import { useWorkspaceAccess } from '../../hooks/useWorkspaceAccess';

interface NavItem {
  name: string;
  href: string;
  icon: React.ReactNode;
}

const navItems: NavItem[] = [
  { name: 'Dashboard', href: '/', icon: <LayoutDashboard className="w-5 h-5" /> },
  { name: 'Campaigns', href: '/campaigns', icon: <Megaphone className="w-5 h-5" /> },
  { name: 'Creator Library', href: '/creators', icon: <Users className="w-5 h-5" /> },
  { name: 'Requests', href: '/requests', icon: <FileText className="w-5 h-5" /> },
  { 
    name: 'Calendar', 
    href: '/calendar', 
    icon: <Calendar className="w-5 h-5" />,
  },

  //add teams once rls works
  { 
    name: 'Team', 
    href: '/team', 
    icon: <Shield className="w-5 h-5" />,
  },
  { name: 'Settings', href: '/settings', icon: <Settings className="w-5 h-5" /> },
  
];

interface SidebarProps {
  currentPath: string;
  onNavigate: (path: string) => void;
  onOpenCommandPalette: () => void;
  sidebarOpen: boolean;
  setSidebarOpen: (open: boolean) => void;
  onLogout: () => void;
}

type WorkspaceRow = {
  id: string;
  name: string;
  type: string;
  owner_user_id: string;
};

type WorkspaceMembershipRow = {
  workspace_id: string;
  user_id: string;
  role: string;
  status: string;
  workspace: WorkspaceRow | null;
};

const getInitial = (name: string | null | undefined, email: string | null | undefined) => {
  if (name) return name.charAt(0).toUpperCase();
  if (email) return email.charAt(0).toUpperCase();
  return 'U'; // Fallback
}; 

export function Sidebar({ currentPath, onNavigate, onOpenCommandPalette, sidebarOpen, setSidebarOpen, onLogout }: SidebarProps) {
  const { user } = useAuth();
  const { activeWorkspaceId, setActiveWorkspaceId } = useWorkspace();
  const access = useWorkspaceAccess();
  const [workspaces, setWorkspaces] = React.useState<WorkspaceRow[]>([]);
  const [workspaceLoading, setWorkspaceLoading] = React.useState(false);
  const [workspaceError, setWorkspaceError] = React.useState<string | null>(null);
  const [showCreateWorkspace, setShowCreateWorkspace] = React.useState(false);
  const [newWorkspaceName, setNewWorkspaceName] = React.useState('');
  const [creatingWorkspace, setCreatingWorkspace] = React.useState(false);
  const [workspaceToDelete, setWorkspaceToDelete] = React.useState<WorkspaceRow | null>(null);
  const [deletingWorkspace, setDeletingWorkspace] = React.useState(false);
  const [ownedWorkspaceIds, setOwnedWorkspaceIds] = React.useState<string[]>([]);
  const [memberWorkspaceIds, setMemberWorkspaceIds] = React.useState<string[]>([]);
  const [switchingWorkspaceId, setSwitchingWorkspaceId] = React.useState<string | null>(null);
  const [workspaceMenuOpen, setWorkspaceMenuOpen] = React.useState(false);
  const canSeeCampaigns =
    access.canViewWorkspace || access.hasCampaignAccess || !activeWorkspaceId;
  const isViewerOnly =
    activeWorkspaceId &&
    access.canViewWorkspace &&
    !access.canEditWorkspace &&
    !access.canManageTeam;
  const filteredNavItems = navItems.filter(item => {
    if (!activeWorkspaceId || access.loading) return true;
    if (isViewerOnly) return item.name === 'Dashboard' || item.name === 'Campaigns';
    if (item.name === 'Calendar') return access.canViewCalendar;
    if (item.name === 'Team') return access.canManageTeam;
    if (item.name === 'Creator Library' || item.name === 'Requests') {
      return access.canViewWorkspace;
    }
    if (item.name === 'Campaigns') return canSeeCampaigns;
    return true;
  });
  
  const handleNavigate = (path: string) => {
    onNavigate(path);
    setSidebarOpen(false);
  };

  const handleLogoClick = () => {
    if (user) {
      onNavigate('/');
    } else {
      onNavigate('/home');
    }
  };

  const userName = user?.user_metadata?.full_name || user?.email?.split('@')[0] || "User";
  const userInitial = getInitial(user?.user_metadata?.full_name, user?.email);

  const activeWorkspace = workspaces.find((workspace) => workspace.id === activeWorkspaceId) || null;
  const ownedWorkspaces = workspaces.filter((workspace) =>
    ownedWorkspaceIds.includes(workspace.id)
  );
  const joinedWorkspaces = workspaces.filter((workspace) =>
    memberWorkspaceIds.includes(workspace.id)
  );
  const formatWorkspaceName = (workspace: WorkspaceRow | null) => {
    if (!workspace) return "Select workspace";
    if (workspace.type === "personal") {
      return `${userName}'s Workspace`;
    }
    return workspace.name || "Workspace";
  };

  const loadWorkspaces = async () => {
    if (!user?.id) return;
    setWorkspaceLoading(true);
    setWorkspaceError(null);

    const { data: memberRows, error: memberError } = await supabase
      .from('workspace_members')
      .select('workspace_id, user_id, role, status, workspace:workspaces ( id, name, type, owner_user_id )')
      .eq('user_id', user.id)
      .eq('status', 'active');

    let resolvedWorkspaces: WorkspaceRow[] = [];
    let ownerWorkspaceIds: string[] = [];
    let memberWorkspaceIds: string[] = [];

    if (!memberError && memberRows) {
      const unique = new Map<string, WorkspaceRow>();
      (memberRows as WorkspaceMembershipRow[]).forEach((row) => {
        if (row.workspace) {
          unique.set(row.workspace.id, row.workspace);
          if (row.workspace.owner_user_id === user.id) {
            ownerWorkspaceIds.push(row.workspace.id);
          } else {
            memberWorkspaceIds.push(row.workspace.id);
          }
        }
      });
      resolvedWorkspaces = Array.from(unique.values());
    } else {
      const { data: memberships, error: fallbackError } = await supabase
        .from('workspace_members')
        .select('workspace_id, user_id, role, status')
        .eq('user_id', user.id)
        .eq('status', 'active');

      if (fallbackError) {
        setWorkspaceError(fallbackError.message || 'Unable to load workspaces');
        setWorkspaceLoading(false);
        return;
      }

      const workspaceIds = (memberships || []).map((row) => row.workspace_id);
      if (workspaceIds.length > 0) {
        const { data: workspaceRows, error: workspaceError } = await supabase
          .from('workspaces')
          .select('id, name, type, owner_user_id')
          .in('id', workspaceIds);

        if (workspaceError) {
          setWorkspaceError(workspaceError.message || 'Unable to load workspaces');
          setWorkspaceLoading(false);
          return;
        }

        resolvedWorkspaces = workspaceRows || [];
        ownerWorkspaceIds = (workspaceRows || [])
          .filter((workspace) => workspace.owner_user_id === user.id)
          .map((workspace) => workspace.id);
        memberWorkspaceIds = (workspaceRows || [])
          .filter((workspace) => workspace.owner_user_id !== user.id)
          .map((workspace) => workspace.id);
      }
    }

    setWorkspaces(resolvedWorkspaces);
    setOwnedWorkspaceIds(ownerWorkspaceIds);
    setMemberWorkspaceIds(memberWorkspaceIds);
    const nextWorkspaceId =
      activeWorkspaceId &&
      resolvedWorkspaces.some((workspace) => workspace.id === activeWorkspaceId)
        ? activeWorkspaceId
        : resolvedWorkspaces[0]?.id || null;

    if (nextWorkspaceId !== activeWorkspaceId) {
      setActiveWorkspaceId(nextWorkspaceId);
    }
    setWorkspaceLoading(false);
  };

  const handleSelectWorkspace = (workspaceId: string) => {
    setSwitchingWorkspaceId(workspaceId);
    setActiveWorkspaceId(workspaceId);
    setWorkspaceMenuOpen(false);
    window.setTimeout(() => {
      setSwitchingWorkspaceId(null);
    }, 600);
  };

  const handleCreateWorkspace = async () => {
    if (!user?.id || !newWorkspaceName.trim()) {
      return;
    }

    setWorkspaceError(null);
    setCreatingWorkspace(true);

    const workspaceType = workspaces.length === 0 ? 'personal' : 'team';

    const { data: workspace, error: workspaceError } = await supabase
      .from('workspaces')
      .insert({
        name: newWorkspaceName.trim(),
        type: workspaceType,
        owner_user_id: user.id,
      })
      .select()
      .single();

    if (workspaceError || !workspace) {
      setWorkspaceError(workspaceError?.message || 'Unable to create workspace');
      setCreatingWorkspace(false);
      return;
    }

    const { error: memberError } = await supabase
      .from('workspace_members')
      .insert({
        workspace_id: workspace.id,
        user_id: user.id,
        role: 'owner',
        status: 'active',
        invited_by: user.id,
      });

    if (memberError) {
      setWorkspaceError(memberError.message || 'Unable to add workspace member');
      setCreatingWorkspace(false);
      return;
    }

    setNewWorkspaceName('');
    setShowCreateWorkspace(false);
    await loadWorkspaces();
    setActiveWorkspaceId(workspace.id);
    setCreatingWorkspace(false);
  };

  const handleDeleteWorkspace = async () => {
    if (!workspaceToDelete) return;
    const deletingId = workspaceToDelete.id;
    const nextWorkspaceId = workspaces.find((workspace) => workspace.id !== deletingId)?.id || null;
    setDeletingWorkspace(true);
    setWorkspaceError(null);

    const { error } = await supabase
      .from('workspaces')
      .delete()
      .eq('id', deletingId);

    if (error) {
      setWorkspaceError(error.message || 'Unable to delete workspace');
      setDeletingWorkspace(false);
      return;
    }

    const deletingActive = deletingId === activeWorkspaceId;
    setWorkspaceToDelete(null);
    await loadWorkspaces();

    if (deletingActive) {
      setActiveWorkspaceId(nextWorkspaceId);
    }

    setDeletingWorkspace(false);
  };

  React.useEffect(() => {
    setSidebarOpen(false);
  }, [currentPath, setSidebarOpen]);

  React.useEffect(() => {
    loadWorkspaces();
  }, [user?.id]);

  React.useEffect(() => {
    if (!showCreateWorkspace || !userName) return;
    if (newWorkspaceName.trim().length > 0) return;
    if (workspaces.length > 0) return;
    setNewWorkspaceName(`${userName}'s Workspace`);
  }, [showCreateWorkspace, userName, workspaces.length, newWorkspaceName]);

  return (
    <>
      {/* Mobile Header */}
      <div className="lg:hidden fixed top-0 left-0 right-0 h-14 bg-[#0A0A0A] border-b border-white/[0.08] flex items-center px-4 z-40">
        <div className="grid grid-cols-[auto_1fr_auto] items-center w-full gap-2">
          <div className="flex items-center gap-2 min-w-0">
            <button
              onClick={() => setSidebarOpen(!sidebarOpen)}
              className="w-11 h-11 rounded-md bg-white/[0.03] hover:bg-white/[0.06] border border-white/[0.08] flex items-center justify-center transition-colors"
              aria-label={sidebarOpen ? "Close navigation" : "Open navigation"}
            >
              {sidebarOpen ? (
                <X className="w-5 h-5 text-slate-300" />
              ) : (
                <Menu className="w-5 h-5 text-slate-300" />
              )}
            </button>
            <button
              onClick={handleLogoClick}
              className="h-11 min-h-[44px] flex items-center gap-2 rounded-md px-2 text-white hover:bg-white/[0.04] transition-colors"
              aria-label="Go to dashboard"
            >
              <img src={logoImage} alt="DTTracker" className="w-6 h-6 object-contain" />
              <span className="text-[13px] font-semibold tracking-tight truncate max-w-[96px]">
                DTTracker
              </span>
            </button>
          </div>
          <div className="flex items-center justify-end">
            <div className="w-11 h-11 flex items-center justify-center">
              <NotificationsCenter />
            </div>
          </div>
        </div>
      </div>

      {/* Mobile Overlay */}
      {sidebarOpen && (
        <div
          className="lg:hidden fixed inset-0 bg-black/60 backdrop-blur-sm z-40"
          onClick={() => setSidebarOpen(false)}
          aria-label="Close menu overlay"
        />
      )}

      {/* Sidebar */}
      <aside
        className={cn(
          "fixed top-0 h-[100dvh] w-64 bg-[#0A0A0A] border-r border-white/[0.08] flex flex-col z-50 transition-transform duration-300 ease-in-out",
          "lg:translate-x-0",
          sidebarOpen ? "translate-x-0  lg:mt-0" : "-translate-x-full"
        )}
        aria-label="Main navigation"
      >
        {/* Logo - Hidden on mobile, visible on desktop */}
        <button
          onClick={handleLogoClick}
          className="hidden lg:flex h-16 px-6 items-center gap-3 border-b border-white/[0.08] cursor-pointer hover:opacity-80 transition-opacity"
        >
          <img src={logoImage} alt="DTTracker" className="w-8 h-8 object-contain" />
          <h1 className="text-[15px] font-semibold tracking-tight text-white">
            DTTracker
          </h1>
        </button>
        
        {/* Command Palette */}
        <div className="px-3 pt-4 pb-2">
        </div>
        
        {/* Navigation */}
        <nav className="flex-1 px-3 pt-2 overflow-y-auto custom-scrollbar">
          {/* Workspace Switcher */}
          <div className="mb-4">
            <div className="text-[11px] uppercase tracking-wide text-slate-500 px-2 mb-2">
              Workspace
            </div>
            <details
              className="group"
              open={workspaceMenuOpen}
              onToggle={(event) => setWorkspaceMenuOpen(event.currentTarget.open)}
            >
              <summary className="list-none cursor-pointer">
                <div className="w-full flex items-center justify-between gap-2 px-3 h-9 rounded-md bg-white/[0.03] border border-white/[0.08] text-slate-200 hover:bg-white/[0.05] transition-colors">
                  <div className="flex items-center gap-2 min-w-0">
                    <div className="w-6 h-6 rounded-md bg-white/[0.08] flex items-center justify-center text-[11px] text-white">
                      {activeWorkspace?.name?.charAt(0).toUpperCase() || 'W'}
                    </div>
                    <span className="text-[13px] font-medium truncate">
                      {workspaceLoading ? "Loading..." : formatWorkspaceName(activeWorkspace)}
                    </span>
                    {switchingWorkspaceId && (
                      <span className="ml-2 inline-flex items-center gap-1 text-[10px] text-slate-400">
                        <Loader2 className="w-3 h-3 animate-spin" />
                        Switching
                      </span>
                    )}
                  </div>
                  <ChevronDown className="w-4 h-4 text-slate-500 transition-transform group-open:rotate-180" />
                </div>
              </summary>
              <div className="mt-2 p-1 rounded-md border border-white/[0.08] bg-[#0D0D0D] shadow-lg">
                {workspaceError && (
                  <div className="px-3 py-2 text-[12px] text-red-400">
                    {workspaceError}
                  </div>
                )}
                {!workspaceLoading && workspaces.length === 0 && !workspaceError && (
                  <div className="px-3 py-2 text-[12px] text-slate-500">
                    No workspaces yet
                  </div>
                )}
                {ownedWorkspaces.length > 0 && (
                  <div className="px-3 pt-2 pb-1 text-[10px] uppercase tracking-[0.2em] text-slate-600">
                    Your Workspaces
                  </div>
                )}
                {ownedWorkspaces.map((workspace) => (
                  <div
                    key={`owned-${workspace.id}`}
                    role="button"
                    tabIndex={0}
                    onClick={() => handleSelectWorkspace(workspace.id)}
                    onKeyDown={(event) => {
                      if (event.key === "Enter" || event.key === " ") {
                        event.preventDefault();
                        handleSelectWorkspace(workspace.id);
                      }
                    }}
                    className={cn(
                      "w-full flex items-center gap-2 px-3 h-8 rounded-md text-[12px] transition-colors",
                      workspace.id === activeWorkspaceId
                        ? "bg-white/[0.08] text-white"
                        : "text-slate-300 hover:bg-white/[0.06]"
                    )}
                  >
                    <button
                      type="button"
                      onClick={(event) => {
                        event.stopPropagation();
                        setWorkspaceToDelete(workspace);
                      }}
                      disabled={workspace.type === 'personal'}
                      className={cn(
                        "w-5 h-5 rounded flex items-center justify-center transition-colors",
                        workspace.type === 'personal'
                          ? "bg-white/[0.04] text-slate-600 cursor-not-allowed"
                          : "bg-white/[0.06] text-red-400 hover:bg-red-500/10 hover:text-red-300"
                      )}
                      aria-label="Delete workspace"
                      title={
                        workspace.type === 'personal'
                          ? 'Personal workspaces cannot be deleted'
                          : 'Delete workspace'
                      }
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                    <div className="w-5 h-5 rounded bg-white/[0.08] flex items-center justify-center text-[10px] text-white">
                      {workspace.name.charAt(0).toUpperCase()}
                    </div>
                    <span className="truncate">{formatWorkspaceName(workspace)}</span>
                    {switchingWorkspaceId === workspace.id && (
                      <Loader2 className="w-3.5 h-3.5 text-slate-500 animate-spin ml-auto" />
                    )}
                  </div>
                ))}
                {joinedWorkspaces.length > 0 && (
                  <div className="px-3 pt-3 pb-1 text-[10px] uppercase tracking-[0.2em] text-slate-600">
                    Joined Workspaces
                  </div>
                )}
                {joinedWorkspaces.map((workspace) => (
                  <div
                    key={`member-${workspace.id}`}
                    role="button"
                    tabIndex={0}
                    onClick={() => handleSelectWorkspace(workspace.id)}
                    onKeyDown={(event) => {
                      if (event.key === "Enter" || event.key === " ") {
                        event.preventDefault();
                        handleSelectWorkspace(workspace.id);
                      }
                    }}
                    className={cn(
                      "w-full flex items-center gap-2 px-3 h-8 rounded-md text-[12px] transition-colors",
                      workspace.id === activeWorkspaceId
                        ? "bg-white/[0.08] text-white"
                        : "text-slate-300 hover:bg-white/[0.06]"
                    )}
                  >
                    <div
                      className="w-5 h-5 rounded flex items-center justify-center bg-white/[0.04] text-slate-600"
                      aria-label="Delete workspace"
                      title="Only workspace owners can delete"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </div>
                    <div className="w-5 h-5 rounded bg-white/[0.08] flex items-center justify-center text-[10px] text-white">
                      {workspace.name.charAt(0).toUpperCase()}
                    </div>
                    <span className="truncate">{formatWorkspaceName(workspace)}</span>
                    {switchingWorkspaceId === workspace.id && (
                      <Loader2 className="w-3.5 h-3.5 text-slate-500 animate-spin ml-auto" />
                    )}
                  </div>
                ))}
                <div className="h-px bg-white/[0.06] my-1" />
                <button
                  type="button"
                  onClick={() => {
                    setWorkspaceError(null);
                    setShowCreateWorkspace(true);
                  }}
                  className="w-full flex items-center gap-2 px-3 h-8 rounded-md text-[12px] text-slate-300 hover:bg-white/[0.06] transition-colors"
                >
                  <Plus className="w-4 h-4 text-slate-400" />
                  <span>Create workspace</span>
                </button>
              </div>
            </details>
          </div>

          <ul className="space-y-0.5">
            {filteredNavItems.map((item) => {
              const isActive = currentPath === item.href;
              return (
                <li key={item.href}>
                  <button
                    onClick={() => handleNavigate(item.href)}
                    className={cn(
                      'w-full flex items-center gap-3 px-3 h-9 rounded-md transition-all text-[13px] font-medium',
                      isActive
                        ? 'bg-white/[0.08] text-white'
                        : 'text-slate-400 hover:text-slate-200 hover:bg-white/[0.04]'
                    )}
                  >
                    <span className={cn(
                      'transition-colors',
                      isActive ? 'text-primary' : 'text-slate-500'
                    )}>
                      {item.icon}
                    </span>
                    <span>{item.name}</span>
                  </button>
                </li>
              );
            })}
            <li>
              
            </li>
          </ul>
          
        </nav>

        {/* User */}
        <div className="p-3 border-t border-white/[0.08]">
          <div 
            onClick={() => handleNavigate('/subscription')}
            className="flex items-center gap-3 px-3 h-11 rounded-md hover:bg-white/[0.04] transition-colors cursor-pointer mb-1"
          >
            <div className="w-7 h-7 rounded-full bg-gradient-to-br from-primary to-cyan-400 flex items-center justify-center text-white text-[13px] font-medium">
              {userInitial}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-[13px] font-medium text-white truncate">{userName}</p>
              <p className="text-[11px] text-slate-500 truncate">Free Plan</p>
            </div>
          </div>
          <button 
            onClick={onLogout}
            className="w-full flex items-center gap-3 px-3 h-9 rounded-md hover:bg-white/[0.04] transition-colors text-slate-400 hover:text-white"
          >
            <LogOut className="w-4 h-4" />
            <span className="text-[13px]">Sign out</span>
          </button>
        </div>
      </aside>

      {showCreateWorkspace && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="w-full max-w-sm rounded-lg border border-white/[0.08] bg-[#0D0D0D] shadow-xl">
            <div className="px-5 py-4 border-b border-white/[0.08]">
              <h3 className="text-sm font-semibold text-white">Create workspace</h3>
              <p className="text-xs text-slate-500 mt-1">Give your workspace a name.</p>
            </div>
            <div className="px-5 py-4 space-y-4">
              <div>
                <label className="block text-xs text-slate-400 mb-2">Workspace name</label>
                <Input
                  value={newWorkspaceName}
                  onChange={(e) => setNewWorkspaceName(e.target.value)}
                  placeholder="Acme Studio"
                  className="h-10 bg-white/[0.04] border-white/[0.1] text-white placeholder:text-slate-600 focus:bg-white/[0.06] focus:border-white/[0.2]"
                />
              </div>
              {workspaceError && (
                <div className="text-xs text-red-400">{workspaceError}</div>
              )}
            </div>
            <div className="px-5 py-4 border-t border-white/[0.08] flex gap-2 justify-end">
              <Button
                variant="outline"
                onClick={() => {
                  setShowCreateWorkspace(false);
                  setWorkspaceError(null);
                }}
                className="h-9 bg-transparent border-white/[0.1] text-white hover:bg-white/[0.04]"
              >
                Cancel
              </Button>
              <Button
                onClick={handleCreateWorkspace}
                disabled={creatingWorkspace || !newWorkspaceName.trim()}
                className="h-9 bg-white text-black hover:bg-white/90 disabled:opacity-50"
              >
                {creatingWorkspace ? 'Creating...' : 'Create'}
              </Button>
            </div>
          </div>
        </div>
      )}

      {workspaceToDelete && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="w-full max-w-sm rounded-lg border border-red-500/20 bg-[#0D0D0D] shadow-xl">
            <div className="px-5 py-4 border-b border-white/[0.08]">
              <h3 className="text-sm font-semibold text-white">Delete workspace?</h3>
              <p className="text-xs text-slate-500 mt-1">
                This action cannot be undone.
              </p>
            </div>
            <div className="px-5 py-4 space-y-3">
              <div className="rounded-md border border-red-500/20 bg-red-500/10 px-3 py-2 text-xs text-red-300">
                You will lose access to all campaigns, creators, and data in{" "}
                <span className="font-semibold text-red-200">
                  {formatWorkspaceName(workspaceToDelete)}
                </span>
                .
              </div>
              {workspaceError && (
                <div className="text-xs text-red-400">{workspaceError}</div>
              )}
            </div>
            <div className="px-5 py-4 border-t border-white/[0.08] flex items-center justify-between">
              <Button
                onClick={handleDeleteWorkspace}
                disabled={deletingWorkspace}
                className="h-9 bg-red-500/90 hover:bg-red-500 text-white"
              >
                {deletingWorkspace ? "Deleting..." : "Delete workspace"}
              </Button>
              <Button
                variant="outline"
                onClick={() => {
                  setWorkspaceToDelete(null);
                  setWorkspaceError(null);
                }}
                className="h-9 bg-transparent border-white/[0.1] text-white hover:bg-white/[0.04]"
              >
                Cancel
              </Button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
