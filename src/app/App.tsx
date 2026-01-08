import React, { useState } from "react";
import {
  Routes,
  Route,
  Navigate,
  useLocation,
  useNavigate,
} from "react-router-dom";
import { Sidebar } from "./components/sidebar";
import { Dashboard } from "./components/dashboard";
import { Campaigns } from "./components/campaigns";
import { CampaignDetail } from "./components/campaign-detail";
import { CampaignCreate } from "./components/campaign-create";
import { CampaignEdit } from "./components/campaign-edit";
import { Creators } from "./components/creators";
import { CreatorScraper } from "./components/creator-scraper";
import { Settings } from "./components/settings";
import { TeamManagement } from "./components/team-management";
import { Subscription } from "./components/subscription";
import { Payment } from "./components/payment";
import { CommandPalette } from "./components/command-palette";
import { ToastProvider } from "./components/toast-provider";
import { ActivityScheduler } from "./components/activity-scheduler";
import { Home } from "./components/home";
import { Login } from "./components/login";
import { Signup } from "./components/signup";
import { Verification } from "./components/verification";
import { Onboarding } from "./components/onboarding";
import { SharedCampaignDashboard } from "./components/shared-campaign-dashboard";
import { TeamInviteAccept } from "./components/team-invite-accept";
import { ProtectedRoute } from "./components/ProtectedRoute";
import { ErrorBoundary } from "./components/ErrorBoundary";
import { useAuth } from "../contexts/AuthContext";

function AppRoutes() {
  const location = useLocation();
  const navigate = useNavigate();
  const { signOut } = useAuth();
  const [commandPaletteOpen, setCommandPaletteOpen] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const handleLogout = async () => {
    await signOut();
    navigate("/login");
  };

  // Keyboard shortcut to open command palette
  React.useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.key === "k" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setCommandPaletteOpen((open ) => !open);
      }
    };

    document.addEventListener("keydown", down);
    return () => document.removeEventListener("keydown", down);
  }, []);

  const isPublicRoute =
    ["/home", "/login", "/signup", "/verification", "/onboarding"].includes(
      location.pathname
    ) ||
    location.pathname.startsWith("/share/") ||
    location.pathname.startsWith("/team/invite/");

  return (
    <ToastProvider>
      <div className="dark min-h-screen bg-background text-foreground">
        {!isPublicRoute && (
          <>
            <Sidebar
              currentPath={location.pathname}
              onNavigate={(path) => navigate(path)}
              onOpenCommandPalette={() => setCommandPaletteOpen(true)}
              sidebarOpen={sidebarOpen}
              setSidebarOpen={setSidebarOpen}
              onLogout={handleLogout}
            />
          </>
        )}

        <main className={isPublicRoute ? "" : "lg:ml-64 p-4 sm:p-6 lg:p-8 pt-16 lg:pt-8 md:pt-18 sm:pt-20"}>
          <div className={isPublicRoute ? "" : "max-w-7xl mx-auto"}>
            <Routes>
              {/* Public routes */}
              <Route
                path="/home"
                element={<Home onNavigate={(path) => navigate(path)} />}
              />
              <Route
                path="/login"
                element={<Login onNavigate={(path) => navigate(path)} />}
              />
              <Route
                path="/signup"
                element={<Signup onNavigate={(path) => navigate(path)} />}
              />
              <Route
                path="/verification"
                element={<Verification onNavigate={(path) => navigate(path)} />}
              />
              <Route
                path="/onboarding"
                element={<Onboarding onNavigate={(path) => navigate(path)} />}
              />
              <Route
                path="/share/campaign/:token"
                element={<SharedCampaignDashboard />}
              />
              <Route
                path="/team/invite/:token"
                element={<TeamInviteAccept />}
              />

              {/* Root redirect - check auth and redirect appropriately */}
              <Route
                path="/"
                element={
                  <ProtectedRoute>
                    <Dashboard onNavigate={(path) => navigate(path)} />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/campaigns"
                element={
                  <ProtectedRoute>
                    <Campaigns onNavigate={(path) => navigate(path)} />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/campaigns/new"
                element={
                  <ProtectedRoute>
                    <CampaignCreate onNavigate={(path) => navigate(path)} />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/campaigns/:id/edit"
                element={
                  <ProtectedRoute>
                    <CampaignEdit onNavigate={(path) => navigate(path)} />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/campaigns/:id"
                element={
                  <ProtectedRoute>
                    <ErrorBoundary>
                      <CampaignDetail onNavigate={(path) => navigate(path)} />
                    </ErrorBoundary>
                  </ProtectedRoute>
                }
              />
              <Route
                path="/creators"
                element={
                  <ProtectedRoute>
                    <Creators onNavigate={(path) => navigate(path)} />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/creators/scraper"
                element={
                  <ProtectedRoute>
                    <CreatorScraper onNavigate={(path) => navigate(path)} />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/calendar"
                element={
                  <ProtectedRoute>
                    <ActivityScheduler onNavigate={(path) => navigate(path)} />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/settings"
                element={
                  <ProtectedRoute>
                    <Settings onNavigate={(path) => navigate(path)} />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/team"
                element={
                  <ProtectedRoute>
                    <TeamManagement onNavigate={(path) => navigate(path)} />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/subscription"
                element={
                  <ProtectedRoute>
                    <Subscription onNavigate={(path) => navigate(path)} />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/payment"
                element={
                  <ProtectedRoute>
                    <Payment onNavigate={(path) => navigate(path)} />
                  </ProtectedRoute>
                }
              />

              {/* Default redirect */}
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </div>
        </main>

        {!isPublicRoute && (
          <CommandPalette
            open={commandPaletteOpen}
            onClose={() => setCommandPaletteOpen(false)}
            onNavigate={(path) => navigate(path)}
          />
        )}
      </div>
    </ToastProvider>
  );
}

export default AppRoutes;
