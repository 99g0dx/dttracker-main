import React, { useState, Suspense } from "react";
import {
  Routes,
  Route,
  Navigate,
  useLocation,
  useNavigate,
} from "react-router-dom";
import { Sidebar } from "./components/sidebar";
import { CommandPalette } from "./components/command-palette";
import { ToastProvider } from "./components/toast-provider";
import { ProtectedRoute } from "./components/ProtectedRoute";
import { ErrorBoundary } from "./components/ErrorBoundary";
import { useAuth } from "../contexts/AuthContext";
import { cn } from "./components/ui/utils";
import { Requests } from "./components/requests";

const Dashboard = React.lazy(() =>
  import("./components/dashboard").then((module) => ({
    default: module.Dashboard,
  }))
);
const Campaigns = React.lazy(() =>
  import("./components/campaigns").then((module) => ({
    default: module.Campaigns,
  }))
);
const CampaignDetail = React.lazy(() =>
  import("./components/campaign-detail").then((module) => ({
    default: module.CampaignDetail,
  }))
);
const CampaignCreate = React.lazy(() =>
  import("./components/campaign-create").then((module) => ({
    default: module.CampaignCreate,
  }))
);
const CampaignEdit = React.lazy(() =>
  import("./components/campaign-edit").then((module) => ({
    default: module.CampaignEdit,
  }))
);
const Creators = React.lazy(() =>
  import("./components/creators").then((module) => ({
    default: module.Creators,
  }))
);
const CreatorScraper = React.lazy(() =>
  import("./components/creator-scraper").then((module) => ({
    default: module.CreatorScraper,
  }))
);
const Settings = React.lazy(() =>
  import("./components/settings").then((module) => ({
    default: module.Settings,
  }))
);
const TeamManagement = React.lazy(() =>
  import("./components/team-management").then((module) => ({
    default: module.TeamManagement,
  }))
);
const Subscription = React.lazy(() =>
  import("./components/subscription").then((module) => ({
    default: module.Subscription,
  }))
);
const Payment = React.lazy(() =>
  import("./components/payment").then((module) => ({
    default: module.Payment,
  }))
);
const ActivityScheduler = React.lazy(() =>
  import("./components/activity-scheduler").then((module) => ({
    default: module.ActivityScheduler,
  }))
);
const Home = React.lazy(() =>
  import("./components/home").then((module) => ({
    default: module.Home,
  }))
);
const Login = React.lazy(() =>
  import("./components/login").then((module) => ({
    default: module.Login,
  }))
);
const Signup = React.lazy(() =>
  import("./components/signup").then((module) => ({
    default: module.Signup,
  }))
);
const Verification = React.lazy(() =>
  import("./components/verification").then((module) => ({
    default: module.Verification,
  }))
);
const ResetPassword = React.lazy(() =>
  import("./components/reset-password").then((module) => ({
    default: module.ResetPassword,
  }))
);
const Onboarding = React.lazy(() =>
  import("./components/onboarding").then((module) => ({
    default: module.Onboarding,
  }))
);
const SharedCampaignDashboard = React.lazy(() =>
  import("./components/shared-campaign-dashboard").then((module) => ({
    default: module.SharedCampaignDashboard,
  }))
);
const TeamInviteAccept = React.lazy(() =>
  import("./components/team-invite-accept").then((module) => ({
    default: module.TeamInviteAccept,
  }))
);


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
    [
      "/home",
      "/login",
      "/signup",
      "/verification",
      "/onboarding",
      "/reset-password",
    ].includes(location.pathname) ||
    location.pathname.startsWith("/share/") ||
    location.pathname.startsWith("/team/invite/");

  const loadingFallback = (
    <div className="flex h-full min-h-[50vh] items-center justify-center text-sm text-slate-400">
      Loading...
    </div>
  );

  return (
    <ToastProvider>
      <div className="dark min-h-[100dvh] w-full overflow-hidden bg-[#0A0A0A] text-foreground flex flex-col">
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

        <main
          className={cn(
            "flex-1 min-h-0 overflow-y-auto overflow-x-hidden",
            isPublicRoute
              ? "px-0 py-0"
              : "lg:ml-64 px-4 sm:px-5 lg:px-8 pt-[max(5rem,env(safe-area-inset-top,5rem))] lg:pt-8 pb-8"
          )}
        >
          <div className={isPublicRoute ? "" : "max-w-7xl mx-auto"}>
            <Suspense fallback={loadingFallback}>
              <Routes>
                <Route
                  path="/requests"
                  element={
                    <ProtectedRoute>
                      <Requests onNavigate={(path) => navigate(path)} />
                    </ProtectedRoute>
                  }
                />

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
                <Route path="/reset-password" element={<ResetPassword />} />
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
                  path="/dashboard"
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
            </Suspense>
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
