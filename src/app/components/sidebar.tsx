import React from 'react';
import { Menu, X, LogOut } from 'lucide-react';
import { cn } from './ui/utils';
import logoImage from '../../assets/fcad7446971be733d3427a6b22f8f64253529daf.png';
import { NotificationsCenter } from './notifications-center';
import { ThemeToggle } from './theme-toggle';
import { useAuth } from '../../contexts/AuthContext';
import { supabase } from '../../lib/supabase';
import { useWorkspace } from '../../contexts/WorkspaceContext';
import { useWorkspaceAccess } from '../../hooks/useWorkspaceAccess';
import { useBillingSummary } from '../../hooks/useBilling';
import { useCompanyAdmin } from '../../hooks/useCompanyAdmin';
import {
  DashboardIcon,
  CampaignIcon,
  TrophyIcon,
  PeopleIcon,
  DocumentIcon,
  WalletIcon,
  CrownIcon,
  AdminIcon,
  ShieldIcon,
  SettingsIcon,
} from './ui/custom-icons';

interface NavItem {
  name: string;
  href: string;
  icon: React.ReactNode;
  tag?: string;
  emphasis?: boolean;
}

const navItems: NavItem[] = [
  { name: 'Dashboard', href: '/dashboard', icon: <DashboardIcon className="w-5 h-5" /> },
  { name: 'Campaigns', href: '/campaigns', icon: <CampaignIcon className="w-5 h-5" /> },
  { name: 'Activations', href: '/activations', icon: <TrophyIcon className="w-5 h-5" /> },
  { name: 'Creators', href: '/creators', icon: <PeopleIcon className="w-5 h-5" /> },
  { name: 'Requests', href: '/requests', icon: <DocumentIcon className="w-5 h-5" /> },
  { name: 'Wallet', href: '/wallet', icon: <WalletIcon className="w-5 h-5" /> },
  { name: 'Admin', href: '/admin', icon: <CrownIcon className="w-5 h-5" />, emphasis: true },
  { name: 'Admin Users', href: '/admin/users', icon: <AdminIcon className="w-5 h-5" />, emphasis: true },
  { name: 'Scrape Ops', href: '/admin/scrape-ops', icon: <AdminIcon className="w-5 h-5" />, emphasis: true },

  {
    name: 'Team', 
    href: '/team', 
    icon: <ShieldIcon className="w-5 h-5" />
  },
  { name: 'Settings', href: '/settings', icon: <SettingsIcon className="w-5 h-5" /> },

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
  owner_user_id: string;
  owner_display_name?: string | null;
};
type WorkspaceMembershipRow = {
  workspace_id: string;
  role: string;
  workspaces?: WorkspaceRow | null;
};

const getInitial = (name: string | null | undefined, email: string | null | undefined) => {
  if (name) return name.charAt(0).toUpperCase();
  if (email) return email.charAt(0).toUpperCase();
  return 'U'; // Fallback
}; 

export function Sidebar({ currentPath, onNavigate, onOpenCommandPalette, sidebarOpen, setSidebarOpen, onLogout }: SidebarProps) {
  const { user } = useAuth();
  const { data: billing } = useBillingSummary();
  const { activeWorkspaceId, setActiveWorkspaceId } = useWorkspace();
  const access = useWorkspaceAccess();
  const { isCompanyAdmin } = useCompanyAdmin();
  const [workspace, setWorkspace] = React.useState<WorkspaceRow | null>(null);
  const [workspaceMenuOpen, setWorkspaceMenuOpen] = React.useState(false);
  const [workspaceList, setWorkspaceList] = React.useState<WorkspaceMembershipRow[]>([]);
  const [ownerNameByUserId, setOwnerNameByUserId] = React.useState<Record<string, string>>({});
  const [workspaceLoading, setWorkspaceLoading] = React.useState(false);
  const [workspaceError, setWorkspaceError] = React.useState<string | null>(null);
  const canSeeCampaigns =
    access.canViewWorkspace || access.hasCampaignAccess || !activeWorkspaceId;
  const isViewerOnly =
    activeWorkspaceId &&
    access.canViewWorkspace &&
    !access.hasCampaignAccess &&
    !access.canManageTeam;
  const subscriptionStatus = billing?.subscription?.status || 'active';
  const trialExpired =
    subscriptionStatus === 'trialing' && (billing?.days_until_period_end ?? 0) <= 0;
  const freeBlocked =
    billing?.plan?.tier === 'free' && !billing?.is_paid && !billing?.is_trialing;
  const subscriptionBlocked =
    ['past_due', 'canceled', 'incomplete'].includes(subscriptionStatus) ||
    trialExpired ||
    freeBlocked;
  const filteredNavItems = navItems.filter(item => {
    // Hide coming soon features
    if (item.tag === 'Coming soon') return false;
    if (!activeWorkspaceId || access.loading) return true;
    if (isViewerOnly && subscriptionBlocked) return item.name === 'Dashboard' || item.name === 'Campaigns';
    if (item.name === 'Team') {
      const tier = billing?.plan?.tier;
      const canUseTeam = tier === 'pro' || tier === 'agency' || billing?.agency_role != null;
      return access.canManageTeam && canUseTeam;
    }
    if (item.name === 'Admin' || item.name === 'Admin Users' || item.name === 'Scrape Ops') return isCompanyAdmin;
    if (item.name === 'Creators' || item.name === 'Requests' || item.name === 'Activations' || item.name === 'Wallet') {
      return access.canViewWorkspace;
    }
    if (item.name === 'Campaigns') return canSeeCampaigns;
    return true;
  });
  
  const handleNavigate = (path: string) => {
    if (path === currentPath) {
      setSidebarOpen(false);
      return;
    }
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

  const formatWorkspaceName = (workspaceRow: WorkspaceRow | null, ownerDisplayName?: string | null) => {
    if (workspaceRow?.name?.trim()) return workspaceRow.name;
    if (ownerDisplayName?.trim()) return `${ownerDisplayName.trim()}'s Workspace`;
    return 'Workspace';
  };

  const loadWorkspace = async () => {
    if (!activeWorkspaceId) {
      setWorkspace(null);
      return;
    }
    setWorkspaceLoading(true);
    setWorkspaceError(null);

    const { data, error } = await supabase
      .from('workspaces')
      .select('id, name, owner_user_id')
      .eq('id', activeWorkspaceId)
      .maybeSingle();

    if (error) {
      setWorkspaceError(error.message || 'Unable to load workspace');
      setWorkspace(null);
      setWorkspaceLoading(false);
      return;
    }

    let ownerDisplayName: string | null = null;
    if (data?.owner_user_id) {
      const { data: profile } = await supabase
        .from('profiles')
        .select('full_name')
        .eq('id', data.owner_user_id)
        .maybeSingle();
      ownerDisplayName = profile?.full_name?.trim() ?? null;
    }

    setWorkspace(data ? { ...data, owner_display_name: ownerDisplayName } : null);
    setWorkspaceLoading(false);
  };

  const loadWorkspaceList = async () => {
    if (!user?.id) {
      setWorkspaceList([]);
      setOwnerNameByUserId({});
      return;
    }

    const { data, error } = await supabase
      .from('workspace_members')
      .select('workspace_id, role, workspaces (id, name, owner_user_id)')
      .eq('user_id', user.id)
      .eq('status', 'active');

    if (error) {
      setWorkspaceList([]);
      setOwnerNameByUserId({});
      return;
    }

    const memberships = (data || []) as WorkspaceMembershipRow[];
    setWorkspaceList(memberships);

    const ownerIds = [...new Set(memberships.map((m) => m.workspaces?.owner_user_id).filter(Boolean))] as string[];
    if (ownerIds.length === 0) {
      setOwnerNameByUserId({});
      return;
    }

    const { data: profiles } = await supabase
      .from('profiles')
      .select('id, full_name')
      .in('id', ownerIds);

    const map: Record<string, string> = {};
    (profiles || []).forEach((p) => {
      map[p.id] = p.full_name?.trim() || 'User';
    });
    setOwnerNameByUserId(map);
  };

  React.useEffect(() => {
    setSidebarOpen(false);
  }, [currentPath, setSidebarOpen]);

  React.useEffect(() => {
    loadWorkspace();
  }, [activeWorkspaceId]);

  React.useEffect(() => {
    loadWorkspaceList();
  }, [user?.id]);

  const adminNavItems = filteredNavItems.filter((item) => item.emphasis);
  const primaryNavItems = filteredNavItems.filter((item) => !item.emphasis);

  return (
    <>
      {/* Mobile Header */}
      <div className="lg:hidden fixed top-0 left-0 right-0 h-14 bg-sidebar border-b border-sidebar-border flex items-center px-2 z-40">
        <div className="grid grid-cols-[auto_1fr_auto] items-center w-full gap-1.5">
          <div className="flex items-center gap-2 min-w-0">
            <button
              onClick={() => setSidebarOpen(!sidebarOpen)}
              className="w-9 h-9 min-h-[36px] rounded-lg bg-sidebar-accent/70 hover:bg-sidebar-accent active:bg-sidebar-accent border border-sidebar-border flex items-center justify-center transition-all duration-150"
              aria-label={sidebarOpen ? "Close navigation" : "Open navigation"}
            >
              {sidebarOpen ? (
                <X className="w-5 h-5 text-sidebar-foreground" />
              ) : (
                <Menu className="w-5 h-5 text-sidebar-foreground" />
              )}
            </button>
            <button
              onClick={handleLogoClick}
              className="h-9 min-h-[36px] flex items-center gap-2 rounded-lg px-2 text-sidebar-foreground hover:bg-sidebar-accent active:bg-sidebar-accent transition-all duration-150"
              aria-label="Go to dashboard"
            >
              <img src={logoImage} alt="DTTracker" className="w-6 h-6 object-contain" />
              <span className="text-sm font-semibold tracking-tight truncate max-w-[96px]">
                DTTracker
              </span>
            </button>
          </div>
          <div className="flex items-center justify-end">
          <div className="w-9 h-9 min-h-[36px] flex items-center justify-center">
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
          "fixed top-0 h-[100dvh] w-64 bg-sidebar border-r border-sidebar-border flex flex-col z-50 transition-transform duration-300 ease-in-out",
          "lg:translate-x-0",
          sidebarOpen ? "translate-x-0  lg:mt-0" : "-translate-x-full"
        )}
        aria-label="Main navigation"
      >
        {/* Logo - Hidden on mobile, visible on desktop */}
        <button
          onClick={handleLogoClick}
          className="hidden lg:flex h-16 px-6 items-center gap-3 border-b border-sidebar-border cursor-pointer hover:opacity-80 transition-opacity"
        >
          <img src={logoImage} alt="DTTracker" className="w-8 h-8 object-contain" />
          <h1 className="text-[15px] font-semibold tracking-tight text-sidebar-foreground">
            DTTracker
          </h1>
        </button>
        
        {/* Command Palette */}
        <div className="px-3 pt-4 pb-2">
        </div>
        
        {/* Navigation */}
        <nav className="flex-1 px-3 pt-2 overflow-y-auto custom-scrollbar">
          {billing?.plan?.tier !== 'starter' && (
            <>
              {/* Workspace Switcher */}
              <div className="mb-4">
                <div className="text-[11px] uppercase tracking-wide text-muted-foreground px-2 mb-2">
                  Workspace
                </div>
                <div className="relative">
                  <button
                    onClick={() => setWorkspaceMenuOpen((open) => !open)}
                    className="w-full flex items-center gap-2 px-3 h-9 rounded-md bg-sidebar-accent/70 hover:bg-sidebar-accent border border-sidebar-border text-sidebar-foreground"
                  >
                    <div className="w-6 h-6 rounded-md bg-sidebar-accent flex items-center justify-center text-[11px] text-sidebar-foreground">
                      {workspace?.name?.charAt(0).toUpperCase() || userInitial}
                    </div>
                    <span className="text-[13px] font-medium truncate flex-1 text-left">
                      {workspaceLoading ? "Loading..." : formatWorkspaceName(workspace, workspace?.owner_display_name?.trim() || (workspace?.owner_user_id === user?.id ? userName : undefined))}
                    </span>
                    <span className="text-[11px] text-muted-foreground">Switch</span>
                  </button>
                  {workspaceMenuOpen && (
                    <div className="absolute left-0 right-0 mt-2 bg-popover text-popover-foreground border border-border rounded-md shadow-xl z-50">
                      <button
                        onClick={() => {
                          setActiveWorkspaceId(user?.id || null);
                          setWorkspaceMenuOpen(false);
                        }}
                        className="w-full text-left px-3 py-2 text-sm hover:bg-accent"
                      >
                        {userName}'s Workspace
                      </button>
                      {workspaceList.map((membership) => {
                        const ownerId = membership.workspaces?.owner_user_id;
                        const ownerName = ownerId ? ownerNameByUserId[ownerId] : undefined;
                        return (
                          <button
                            key={membership.workspace_id}
                            onClick={() => {
                              setActiveWorkspaceId(membership.workspace_id);
                              setWorkspaceMenuOpen(false);
                            }}
                            className="w-full text-left px-3 py-2 text-sm hover:bg-accent"
                          >
                            {formatWorkspaceName(membership.workspaces ?? null, ownerName)}
                          </button>
                        );
                      })}
                      {workspaceList.length === 0 && (
                        <div className="px-3 py-2 text-xs text-muted-foreground">
                          No shared workspaces yet.
                        </div>
                      )}
                    </div>
                  )}
                </div>
                {workspaceError && (
                  <div className="px-2 pt-2 text-[12px] text-red-400">
                    {workspaceError}
                  </div>
                )}
              </div>
            </>
          )}

          <ul className="space-y-1">
            {primaryNavItems.map((item) => {
              const isActive = currentPath === item.href;
              return (
                <li key={item.href}>
                  <button
                    onClick={() => handleNavigate(item.href)}
                    className={cn(
                      'w-full flex items-center gap-3 px-3 h-11 min-h-[44px] rounded-lg transition-all duration-150 text-sm font-medium',
                      isActive
                        ? 'bg-sidebar-accent text-sidebar-foreground shadow-sm'
                        : item.emphasis
                        ? 'text-amber-600 hover:text-amber-700 active:bg-amber-500/10 dark:text-amber-300 dark:hover:text-amber-200'
                        : 'text-muted-foreground hover:text-sidebar-foreground active:bg-sidebar-accent/80'
                    )}
                  >
                    <span className={cn(
                      'transition-colors duration-150',
                      isActive ? 'text-sidebar-primary dark:text-red-500' : item.emphasis ? 'text-amber-500' : 'text-muted-foreground dark:text-white'
                    )}>
                      {item.icon}
                    </span>
                    <div className="flex-1 flex items-center justify-between min-w-0">
                      <span>{item.name}</span>
                      {item.tag && (
                        <span className="ml-2 text-[9px] font-semibold uppercase tracking-wider text-red-600 dark:text-cyan-300 bg-red-100/70 dark:bg-cyan-500/10 border border-red-200 dark:border-cyan-500/20 rounded px-1.5 py-0.5 whitespace-nowrap">
                          {item.tag}
                        </span>
                      )}
                    </div>
                  </button>
                </li>
              );
            })}
          </ul>

          {adminNavItems.length > 0 && (
            <div className="mt-6">
              <div className="px-3 text-[10px] uppercase tracking-[0.2em] text-amber-700/70 dark:text-amber-300/70 mb-2">
                Company
              </div>
              <ul className="space-y-1">
                {adminNavItems.map((item) => {
                  const isActive = currentPath === item.href;
                  return (
                    <li key={item.href}>
                      <button
                        onClick={() => handleNavigate(item.href)}
                        className={cn(
                          'w-full flex items-center gap-3 px-3 h-11 min-h-[44px] rounded-lg transition-all duration-150 text-sm font-medium',
                          isActive
                            ? 'bg-amber-500/20 text-amber-800 dark:text-amber-100 shadow-sm'
                            : 'text-amber-600 hover:text-amber-700 active:bg-amber-500/10 dark:text-amber-300 dark:hover:text-amber-200'
                        )}
                      >
                        <span className={cn(
                          'transition-colors duration-150',
                          isActive ? 'text-amber-600 dark:text-amber-300' : 'text-amber-500'
                        )}>
                          {item.icon}
                        </span>
                        <div className="flex-1 flex items-center justify-between min-w-0">
                          <span>{item.name}</span>
                        </div>
                      </button>
                    </li>
                  );
                })}
              </ul>
            </div>
          )}
          
        </nav>

        {/* Theme Toggle */}
        <div className="px-3 pb-2">
          <ThemeToggle />
        </div>

        {/* User */}
        <div className="p-3 border-t border-sidebar-border">
          <div 
            onClick={() => handleNavigate('/subscription')}
            className="flex items-center gap-3 px-3 h-11 min-h-[44px] rounded-lg hover:bg-sidebar-accent active:bg-sidebar-accent transition-all duration-150 cursor-pointer mb-1"
          >
            <div className="w-7 h-7 rounded-full bg-gradient-to-br from-red-500 to-orange-400 dark:from-primary dark:to-cyan-400 flex items-center justify-center text-white dark:text-foreground text-[13px] font-medium">
              {userInitial}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-[13px] font-medium text-sidebar-foreground truncate">{userName}</p>
              <p className="text-[11px] text-muted-foreground truncate">
                {billing?.agency_role === 'agency' || billing?.agency_role === 'super_agency'
                  ? 'Agency'
                  : billing?.plan?.tier
                    ? `${billing.plan.tier.charAt(0).toUpperCase() + billing.plan.tier.slice(1)} Plan`
                    : 'Free Plan'}
              </p>
            </div>
          </div>
          <button 
            onClick={onLogout}
            className="w-full flex items-center gap-3 px-3 h-11 min-h-[44px] rounded-lg hover:bg-sidebar-accent active:bg-sidebar-accent transition-all duration-150 text-muted-foreground hover:text-sidebar-foreground"
          >
            <LogOut className="w-4 h-4" />
            <span className="text-sm">Sign out</span>
          </button>
        </div>
      </aside>

    </>
  );
}
