import React from 'react';
import { LayoutDashboard, FileText, Megaphone, Users, Settings, Menu, X, Shield, LogOut } from 'lucide-react';
import { cn } from './ui/utils';
import logoImage from '../../assets/fcad7446971be733d3427a6b22f8f64253529daf.png';
import { NotificationsCenter } from './notifications-center';
import { useAuth } from '../../contexts/AuthContext';
import { supabase } from '../../lib/supabase';
import { useWorkspace } from '../../contexts/WorkspaceContext';
import { useWorkspaceAccess } from '../../hooks/useWorkspaceAccess';
import { useBillingSummary } from '../../hooks/useBilling';

interface NavItem {
  name: string;
  href: string;
  icon: React.ReactNode;
  tag?: string;
}

const navItems: NavItem[] = [
  { name: 'Dashboard', href: '/', icon: <LayoutDashboard className="w-5 h-5" /> },
  { name: 'Campaigns', href: '/campaigns', icon: <Megaphone className="w-5 h-5" /> },
  { name: 'Creator Library', href: '/creators', icon: <Users className="w-5 h-5" /> },
  { name: 'Requests', href: '/requests', icon: <FileText className="w-5 h-5" /> },

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
  owner_user_id: string;
};

const getInitial = (name: string | null | undefined, email: string | null | undefined) => {
  if (name) return name.charAt(0).toUpperCase();
  if (email) return email.charAt(0).toUpperCase();
  return 'U'; // Fallback
}; 

export function Sidebar({ currentPath, onNavigate, onOpenCommandPalette, sidebarOpen, setSidebarOpen, onLogout }: SidebarProps) {
  const { user } = useAuth();
  const { data: billing } = useBillingSummary();
  const { activeWorkspaceId } = useWorkspace();
  const access = useWorkspaceAccess();
  const [workspace, setWorkspace] = React.useState<WorkspaceRow | null>(null);
  const [workspaceLoading, setWorkspaceLoading] = React.useState(false);
  const [workspaceError, setWorkspaceError] = React.useState<string | null>(null);
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

  const formatWorkspaceName = (workspaceRow: WorkspaceRow | null) => {
    if (workspaceRow?.name) return workspaceRow.name;
    return `${userName}'s Workspace`;
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

    setWorkspace(data || null);
    setWorkspaceLoading(false);
  };

  React.useEffect(() => {
    setSidebarOpen(false);
  }, [currentPath, setSidebarOpen]);

  React.useEffect(() => {
    loadWorkspace();
  }, [activeWorkspaceId]);

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
            <div className="w-full flex items-center gap-2 px-3 h-9 rounded-md bg-white/[0.03] border border-white/[0.08] text-slate-200">
              <div className="w-6 h-6 rounded-md bg-white/[0.08] flex items-center justify-center text-[11px] text-white">
                {workspace?.name?.charAt(0).toUpperCase() || userInitial}
              </div>
              <span className="text-[13px] font-medium truncate">
                {workspaceLoading ? "Loading..." : formatWorkspaceName(workspace)}
              </span>
            </div>
            {workspaceError && (
              <div className="px-2 pt-2 text-[12px] text-red-400">
                {workspaceError}
              </div>
            )}
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
                    <div className="flex-1 flex items-center justify-between min-w-0">
                      <span>{item.name}</span>
                      {item.tag && (
                        <span className="ml-2 text-[9px] font-semibold uppercase tracking-wider text-cyan-400 bg-cyan-400/10 border border-cyan-400/20 rounded px-1.5 py-0.5 whitespace-nowrap">
                          {item.tag}
                        </span>
                      )}
                    </div>
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
              <p className="text-[11px] text-slate-500 truncate">
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
            className="w-full flex items-center gap-3 px-3 h-9 rounded-md hover:bg-white/[0.04] transition-colors text-slate-400 hover:text-white"
          >
            <LogOut className="w-4 h-4" />
            <span className="text-[13px]">Sign out</span>
          </button>
        </div>
      </aside>

    </>
  );
}
