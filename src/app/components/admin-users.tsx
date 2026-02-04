import React, { useEffect, useMemo, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Search,
  ShieldAlert,
  ShieldCheck,
  RefreshCcw,
  Trash2,
  Pencil,
  Users,
} from "lucide-react";
import { toast } from "sonner";
import { supabase } from "../../lib/supabase";
import { AdminReauth, ensureAdminReauth } from "./admin-reauth";
import { useCompanyAdmin } from "../../hooks/useCompanyAdmin";
import { Button } from "./ui/button";
import { Card, CardContent } from "./ui/card";
import { Input } from "./ui/input";
import { cn } from "./ui/utils";
import { TableRowSkeleton } from "./ui/skeleton";

type AdminUserRow = {
  user_id: string;
  email: string | null;
  full_name: string | null;
  phone: string | null;
  created_at: string | null;
  last_sign_in_at: string | null;
  banned_until: string | null;
  is_banned: boolean | null;
  require_password_change?: boolean | null;
  workspace_id: string | null;
  workspace_name: string | null;
  plan_slug: string | null;
  subscription_status: string | null;
  billing_email: string | null;
  total_seats: number | null;
  trial_end_at: string | null;
};

type PlanRow = {
  slug: string;
  name: string | null;
  tier: string | null;
  billing_cycle: string | null;
};

interface AdminUsersProps {
  onNavigate: (path: string) => void;
}

type AdminUserStats = {
  total_campaigns: number;
  total_requests: number;
  total_creators: number;
  total_posts: number;
  total_views: number;
};

const adminUsersKeys = {
  list: (
    search: string,
    statusFilter: string,
    planFilter: string,
    cursor?: { created_at: string; user_id: string } | null,
    pageSize?: number
  ) =>
    [
      "admin_users",
      search || "",
      statusFilter || "all",
      planFilter || "all",
      cursor?.created_at || "start",
      cursor?.user_id || "start",
      pageSize || 25,
    ] as const,
  stats: (userId: string) => ["admin_user_stats", userId] as const,
};

const formatDate = (value?: string | null) => {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleDateString();
};

const toTitle = (value?: string | null) => {
  if (!value) return "—";
  return value.replace(/_/g, " ");
};

export function AdminUsers({ onNavigate }: AdminUsersProps) {
  const { isCompanyAdmin, loading: accessLoading } = useCompanyAdmin();
  const queryClient = useQueryClient();
  const [users, setUsers] = useState<AdminUserRow[]>([]);
  const [plans, setPlans] = useState<PlanRow[]>([]);
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<
    "all" | "active" | "banned" | "expired"
  >("all");
  const [planFilter, setPlanFilter] = useState<"all" | string>("all");
  const [page, setPage] = useState(0);
  const [cursorStack, setCursorStack] = useState<
    Array<{ created_at: string; user_id: string }>
  >([]);
  const [hasNext, setHasNext] = useState(false);
  const [workingId, setWorkingId] = useState<string | null>(null);
  const [editUser, setEditUser] = useState<AdminUserRow | null>(null);
  const [planSlug, setPlanSlug] = useState("");
  const [planStatus, setPlanStatus] = useState("active");
  const [seatOverride, setSeatOverride] = useState("");
  const [statsUser, setStatsUser] = useState<AdminUserRow | null>(null);
  const [stats, setStats] = useState<AdminUserStats | null>(null);
  const [statsLoading, setStatsLoading] = useState(false);
  const [openMenuKey, setOpenMenuKey] = useState<string | null>(null);
  const [reauthOpen, setReauthOpen] = useState(false);
  const [reauthAction, setReauthAction] = useState<
    null | (() => Promise<void>)
  >(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkEditOpen, setBulkEditOpen] = useState(false);
  const [bulkPlanSlug, setBulkPlanSlug] = useState("");
  const [bulkPlanStatus, setBulkPlanStatus] = useState("active");
  const [bulkSeatOverride, setBulkSeatOverride] = useState("");
  const [bulkResultOpen, setBulkResultOpen] = useState(false);
  const [bulkResult, setBulkResult] = useState<{
    title: string;
    message: string;
    tone: "success" | "warning" | "error";
  } | null>(null);
  const [actionResultOpen, setActionResultOpen] = useState(false);
  const [actionResult, setActionResult] = useState<{
    title: string;
    message: string;
    tone: "success" | "warning" | "error";
  } | null>(null);

  const pageSize = 25;
  const cursor = cursorStack[cursorStack.length - 1] || null;
  const listRef = useRef<HTMLDivElement | null>(null);
  const [listHeight, setListHeight] = useState(0);
  const [listScrollTop, setListScrollTop] = useState(0);
  const rowHeight = 96;
  const virtualizationEnabled =
    typeof window !== "undefined"
      ? localStorage.getItem("disable_virtualization") !== "1"
      : true;

  const usersQuery = useQuery({
    queryKey: adminUsersKeys.list(
      debouncedSearch,
      statusFilter,
      planFilter,
      cursor,
      pageSize
    ),
    queryFn: async () => {
      const listResult = await supabase.rpc("get_company_admin_users_page", {
        search: debouncedSearch || null,
        status_filter: statusFilter === "all" ? null : statusFilter,
        plan_filter: planFilter === "all" ? null : planFilter,
        page_limit: pageSize,
        cursor_created_at: cursor?.created_at || null,
        cursor_user_id: cursor?.user_id || null,
      });
      if (listResult.error) {
        throw listResult.error;
      }
      return (listResult.data || []) as AdminUserRow[];
    },
    enabled: isCompanyAdmin && !accessLoading,
    staleTime: 60 * 1000,
    gcTime: 10 * 60 * 1000,
    keepPreviousData: true,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
  });
  const loading = usersQuery.isLoading || usersQuery.isFetching;

  useEffect(() => {
    if (usersQuery.error) {
      toast.error(usersQuery.error.message || "Failed to load users");
      setUsers([]);
      setHasNext(false);
      return;
    }
    const rows = usersQuery.data || [];
    setUsers(rows);
    setHasNext(rows.length === pageSize);
  }, [usersQuery.data, usersQuery.error, pageSize]);

  const logAdminAction = async (
    action: string,
    targetUserId: string | null,
    metadata?: Record<string, unknown>
  ) => {
    const { error } = await supabase.rpc("log_company_admin_action", {
      target_user_id: targetUserId,
      action,
      metadata: metadata || {},
    });
    if (error) {
      console.warn("[Admin Users] Failed to log action", action, error);
    }
  };

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(search.trim()), 250);
    return () => clearTimeout(timer);
  }, [search]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Node;
      const menu = document.querySelector('[data-admin-user-menu="open"]');
      if (menu && !menu.contains(target)) {
        setOpenMenuKey(null);
      }
    };
    if (openMenuKey) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [openMenuKey]);

  const loadUsers = async () => {
    if (!isCompanyAdmin) return;
    await usersQuery.refetch();
  };

  const toggleSelect = (userId: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(userId)) {
        next.delete(userId);
      } else {
        next.add(userId);
      }
      return next;
    });
  };

  const selectAllVisible = (checked: boolean) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (checked) {
        visibleUsers.forEach((user) => next.add(user.user_id));
      } else {
        visibleUsers.forEach((user) => next.delete(user.user_id));
      }
      return next;
    });
  };

  const bulkBan = async (days: number | null) => {
    const ids = Array.from(selectedIds);
    if (!ids.length) {
      toast.error("Select at least one user.");
      return;
    }
    await ensureAdminReauth(openReauthModal, async () => {
      setWorkingId("bulk-ban");
      const until = days
        ? new Date(Date.now() + days * 24 * 60 * 60 * 1000).toISOString()
        : null;
      const results = await Promise.all(
        ids.map((id) =>
          supabase.rpc("company_admin_set_ban", {
            target_user_id: id,
            ban_until: until,
          })
        )
      );
      setWorkingId(null);
      const hasError = results.some((r) => r.error);
      if (hasError) {
        setBulkResult({
          title: "Bulk ban results",
          message: "One or more updates failed. Please review and retry.",
          tone: "error",
        });
        setBulkResultOpen(true);
        return;
      }
      setBulkResult({
        title: days ? "Users suspended" : "Users unbanned",
        message: `${ids.length} user${ids.length === 1 ? "" : "s"} updated successfully.`,
        tone: "success",
      });
      await logAdminAction(days ? "bulk_ban" : "bulk_unban", null, {
        count: ids.length,
        days,
        ban_until: until,
      });
      setBulkResultOpen(true);
      setSelectedIds(new Set());
      loadUsers();
    });
  };

  const forceLogout = async (user: AdminUserRow) => {
    setWorkingId(user.user_id);
    const { data, error } = await supabase.functions.invoke(
      "admin-force-logout",
      {
        body: { user_id: user.user_id },
      }
    );
    setWorkingId(null);
    if (error) {
      toast.error(error.message || "Failed to force logout");
      setActionResult({
        title: "Force logout failed",
        message: error.message || "Failed to force logout.",
        tone: "error",
      });
      setActionResultOpen(true);
      return;
    }
    if (data?.error) {
      setActionResult({
        title: "Force logout failed",
        message: data.error || "Failed to force logout.",
        tone: "error",
      });
      setActionResultOpen(true);
      return;
    }
    toast.success("User logged out");
    setActionResult({
      title: "User logged out",
      message: `${user.email || "User"} has been logged out.`,
      tone: "warning",
    });
    setActionResultOpen(true);
  };

  const setPasswordResetRequired = async (
    user: AdminUserRow,
    required: boolean
  ) => {
    setWorkingId(user.user_id);
    const { error } = await supabase.rpc(
      "company_admin_set_password_reset_required",
      {
        target_user_id: user.user_id,
        required,
      }
    );
    setWorkingId(null);
    if (error) {
      toast.error(error.message || "Failed to update password policy");
      setActionResult({
        title: "Password policy update failed",
        message: error.message || "Failed to update password policy.",
        tone: "error",
      });
      setActionResultOpen(true);
      return;
    }
    if (required) {
      if (user.email) {
        await supabase.auth.resetPasswordForEmail(user.email, {
          redirectTo: `${window.location.origin}/reset-password`,
        });
      }
      await supabase.functions.invoke("admin-force-logout", {
        body: { user_id: user.user_id },
      });
    }

    await logAdminAction(
      required ? "require_password_change" : "clear_password_change",
      user.user_id,
      {
        email: user.email,
      }
    );
    toast.success(
      required ? "Password reset required" : "Password reset cleared"
    );
    setActionResult({
      title: required ? "Password reset required" : "Password reset cleared",
      message: `${user.email || "User"} updated successfully.`,
      tone: required ? "warning" : "success",
    });
    setActionResultOpen(true);
    loadUsers();
  };

  const bulkForceLogout = async () => {
    const ids = Array.from(selectedIds);
    if (!ids.length) {
      toast.error("Select at least one user.");
      return;
    }
    await ensureAdminReauth(openReauthModal, async () => {
      setWorkingId("bulk-logout");
      const results = await Promise.all(
        ids.map((id) =>
          supabase.functions.invoke("admin-force-logout", {
            body: { user_id: id },
          })
        )
      );
      setWorkingId(null);
      const hasError = results.some((r) => r.error || (r.data && r.data.error));
      if (hasError) {
        setBulkResult({
          title: "Force logout errors",
          message: "One or more logouts failed.",
          tone: "error",
        });
        setBulkResultOpen(true);
        return;
      }
      setBulkResult({
        title: "Users logged out",
        message: `${ids.length} user${ids.length === 1 ? "" : "s"} logged out.`,
        tone: "warning",
      });
      await logAdminAction("bulk_force_logout", null, {
        count: ids.length,
      });
      setBulkResultOpen(true);
      setSelectedIds(new Set());
    });
  };

  const bulkPasswordResetRequired = async (required: boolean) => {
    const ids = Array.from(selectedIds);
    if (!ids.length) {
      toast.error("Select at least one user.");
      return;
    }
    await ensureAdminReauth(openReauthModal, async () => {
      setWorkingId("bulk-password");
      const results = await Promise.all(
        ids.map((id) =>
          supabase.rpc("company_admin_set_password_reset_required", {
            target_user_id: id,
            required,
          })
        )
      );
      if (required) {
        const targets = users.filter(
          (user) => ids.includes(user.user_id) && user.email
        );
        await Promise.all(
          targets.map((user) =>
            supabase.auth.resetPasswordForEmail(user.email as string, {
              redirectTo: `${window.location.origin}/reset-password`,
            })
          )
        );
        await Promise.all(
          ids.map((id) =>
            supabase.functions.invoke("admin-force-logout", {
              body: { user_id: id },
            })
          )
        );
      }
      setWorkingId(null);
      const hasError = results.some((r) => r.error);
      if (hasError) {
        setBulkResult({
          title: "Password policy update errors",
          message: "One or more updates failed.",
          tone: "error",
        });
        setBulkResultOpen(true);
        return;
      }
      setBulkResult({
        title: required ? "Password reset required" : "Password reset cleared",
        message: `${ids.length} user${ids.length === 1 ? "" : "s"} updated.`,
        tone: required ? "warning" : "success",
      });
      await logAdminAction(
        required
          ? "bulk_require_password_change"
          : "bulk_clear_password_change",
        null,
        {
          count: ids.length,
        }
      );
      setBulkResultOpen(true);
      setSelectedIds(new Set());
      loadUsers();
    });
  };

  const bulkResetPasswords = async () => {
    const ids = Array.from(selectedIds);
    if (!ids.length) {
      toast.error("Select at least one user.");
      return;
    }
    await ensureAdminReauth(openReauthModal, async () => {
      setWorkingId("bulk-reset");
      const targets = users.filter(
        (user) => ids.includes(user.user_id) && user.email
      );
      const results = await Promise.all(
        targets.map((user) =>
          supabase.auth.resetPasswordForEmail(user.email as string, {
            redirectTo: `${window.location.origin}/reset-password`,
          })
        )
      );
      setWorkingId(null);
      const hasError = results.some((r) => r.error);
      if (hasError) {
        setBulkResult({
          title: "Password reset errors",
          message: "One or more reset emails failed to send.",
          tone: "error",
        });
        setBulkResultOpen(true);
        return;
      }
      setBulkResult({
        title: "Password reset emails sent",
        message: `Sent ${targets.length} reset email${targets.length === 1 ? "" : "s"}.`,
        tone: "success",
      });
      await logAdminAction("bulk_reset_passwords", null, {
        count: targets.length,
      });
      setBulkResultOpen(true);
      setSelectedIds(new Set());
    });
  };

  const bulkDeleteUsers = async () => {
    const ids = Array.from(selectedIds);
    if (!ids.length) {
      toast.error("Select at least one user.");
      return;
    }
    if (!confirm(`Delete ${ids.length} users? This cannot be undone.`)) return;
    await ensureAdminReauth(openReauthModal, async () => {
      setWorkingId("bulk-delete");
      const results = await Promise.all(
        ids.map((id) =>
          supabase.rpc("company_admin_delete_user", {
            target_user_id: id,
          })
        )
      );
      setWorkingId(null);
      const hasError = results.some((r) => r.error);
      if (hasError) {
        setBulkResult({
          title: "Deletion errors",
          message: "One or more deletions failed. Please retry.",
          tone: "error",
        });
        setBulkResultOpen(true);
        return;
      }
      setBulkResult({
        title: "Users deleted",
        message: `${ids.length} user${ids.length === 1 ? "" : "s"} deleted.`,
        tone: "warning",
      });
      await logAdminAction("bulk_delete_users", null, {
        count: ids.length,
      });
      setBulkResultOpen(true);
      setSelectedIds(new Set());
      loadUsers();
    });
  };

  const applyBulkUpdate = async () => {
    const ids = Array.from(selectedIds);
    if (!ids.length) {
      toast.error("Select at least one user.");
      return;
    }
    const seatsValue = bulkSeatOverride.trim();
    const seats = seatsValue ? Number(seatsValue) : null;
    await ensureAdminReauth(openReauthModal, async () => {
      setWorkingId("bulk-update");
      const results = await Promise.all(
        ids.map((id) =>
          supabase.rpc("company_admin_set_user_subscription", {
            target_user_id: id,
            p_plan_slug: bulkPlanSlug || null,
            p_status: bulkPlanStatus || null,
            p_total_seats: Number.isFinite(seats) ? seats : null,
          })
        )
      );
      setWorkingId(null);
      const hasError = results.some((r) => r.error);
      if (hasError) {
        setBulkResult({
          title: "Bulk update failed",
          message: "One or more updates failed. Please review and retry.",
          tone: "error",
        });
        setBulkResultOpen(true);
        return;
      }
      setBulkResult({
        title: "Subscriptions updated",
        message: `${ids.length} subscription${ids.length === 1 ? "" : "s"} updated.`,
        tone: "success",
      });
      await logAdminAction("bulk_update_subscriptions", null, {
        count: ids.length,
        plan_slug: bulkPlanSlug || null,
        status: bulkPlanStatus || null,
        total_seats: Number.isFinite(seats) ? seats : null,
      });
      setBulkResultOpen(true);
      setSelectedIds(new Set());
      setBulkEditOpen(false);
      setBulkPlanSlug("");
      setBulkPlanStatus("active");
      setBulkSeatOverride("");
      loadUsers();
    });
  };

  const loadPlans = async () => {
    const { data, error } = await supabase
      .from("plan_catalog")
      .select("slug, name, tier, billing_cycle")
      .eq("is_active", true)
      .order("tier", { ascending: true })
      .order("billing_cycle", { ascending: true });

    if (!error) {
      const rows = (data || []) as PlanRow[];
      setPlans(rows);
    }
  };

  useEffect(() => {
    if (!isCompanyAdmin || accessLoading) return;
    loadPlans();
  }, [isCompanyAdmin, accessLoading]);

  const planOptions = useMemo(() => {
    const seen = new Set<string>();
    const unique: PlanRow[] = [];
    for (const plan of plans) {
      if (!plan.tier || seen.has(plan.tier)) continue;
      seen.add(plan.tier);
      unique.push(plan);
    }
    return unique;
  }, [plans]);

  const visibleUsers = useMemo(() => {
    return users;
  }, [users, statusFilter]);

  const shouldVirtualize = virtualizationEnabled && visibleUsers.length > 200;
  useEffect(() => {
    if (!shouldVirtualize || !listRef.current) return;
    const node = listRef.current;
    const updateHeight = () => setListHeight(node.clientHeight);
    updateHeight();
    const observer = new ResizeObserver(updateHeight);
    observer.observe(node);
    return () => observer.disconnect();
  }, [shouldVirtualize, visibleUsers.length]);

  useEffect(() => {
    if (!shouldVirtualize) return;
    setListScrollTop(0);
    listRef.current?.scrollTo({ top: 0 });
  }, [shouldVirtualize, debouncedSearch, statusFilter, planFilter, page]);

  const virtualWindow = useMemo(() => {
    if (!shouldVirtualize) {
      return {
        items: visibleUsers,
        paddingTop: 0,
        paddingBottom: 0,
        startIndex: 0,
      };
    }
    const total = visibleUsers.length;
    const visibleCount = Math.ceil(listHeight / rowHeight) + 6;
    const startIndex = Math.max(0, Math.floor(listScrollTop / rowHeight) - 3);
    const endIndex = Math.min(total, startIndex + visibleCount);
    return {
      items: visibleUsers.slice(startIndex, endIndex),
      paddingTop: startIndex * rowHeight,
      paddingBottom: Math.max(0, total * rowHeight - endIndex * rowHeight),
      startIndex,
    };
  }, [shouldVirtualize, visibleUsers, listHeight, listScrollTop]);

  const openEdit = (user: AdminUserRow) => {
    setStatsUser(null);
    setReauthOpen(false);
    setEditUser(user);
    setPlanSlug(user.plan_slug || "");
    setPlanStatus(user.subscription_status || "active");
    setSeatOverride(user.total_seats?.toString() || "");
  };

  const closeEdit = () => {
    setEditUser(null);
    setPlanSlug("");
    setPlanStatus("active");
    setSeatOverride("");
  };

  const updateSubscription = async () => {
    if (!editUser) return;
    setWorkingId(editUser.user_id);
    const seatsValue = seatOverride.trim();
    const seats = seatsValue ? Number(seatsValue) : null;
    const { error } = await supabase.rpc(
      "company_admin_set_user_subscription",
      {
        target_user_id: editUser.user_id,
        p_plan_slug: planSlug || null,
        p_status: planStatus || null,
        p_total_seats: Number.isFinite(seats) ? seats : null,
      }
    );
    setWorkingId(null);

    if (error) {
      toast.error(error.message || "Unable to update subscription");
      setActionResult({
        title: "Subscription update failed",
        message: error.message || "Unable to update subscription.",
        tone: "error",
      });
      setActionResultOpen(true);
      return;
    }

    toast.success("Subscription updated");
    setActionResult({
      title: "Subscription updated",
      message: `Subscription updated for ${editUser.email || "this user"}.`,
      tone: "success",
    });
    await logAdminAction("update_subscription", editUser.user_id, {
      plan_slug: planSlug || null,
      status: planStatus || null,
      total_seats: Number.isFinite(seats) ? seats : null,
    });
    setActionResultOpen(true);
    closeEdit();
    loadUsers();
  };

  const openReauthModal = (action: () => Promise<void>) => {
    setReauthAction(() => action);
    setReauthOpen(true);
  };

  const handleReauthVerified = async () => {
    setReauthOpen(false);
    if (reauthAction) {
      await reauthAction();
    }
  };

  const banUser = async (user: AdminUserRow, days: number | null) => {
    setWorkingId(user.user_id);
    const until = days
      ? new Date(Date.now() + days * 24 * 60 * 60 * 1000).toISOString()
      : null;
    const { error } = await supabase.rpc("company_admin_set_ban", {
      target_user_id: user.user_id,
      ban_until: until,
    });
    setWorkingId(null);

    if (error) {
      toast.error(error.message || "Failed to update ban status");
      setActionResult({
        title: "Ban update failed",
        message: error.message || "Failed to update ban status.",
        tone: "error",
      });
      setActionResultOpen(true);
      return;
    }
    toast.success(days ? "User suspended" : "User unbanned");
    setActionResult({
      title: days ? "User suspended" : "User unbanned",
      message: `${user.email || "User"} ${days ? "suspended" : "unbanned"}.`,
      tone: days ? "warning" : "success",
    });
    await logAdminAction(days ? "ban_user" : "unban_user", user.user_id, {
      email: user.email,
      days,
      ban_until: until,
    });
    setActionResultOpen(true);
    loadUsers();
  };

  const resetPassword = async (user: AdminUserRow) => {
    if (!user.email) {
      toast.error("User email is missing");
      return;
    }
    setWorkingId(user.user_id);
    const { error } = await supabase.auth.resetPasswordForEmail(user.email, {
      redirectTo: `${window.location.origin}/reset-password`,
    });
    setWorkingId(null);
    if (error) {
      toast.error(error.message || "Failed to send reset email");
      setActionResult({
        title: "Reset failed",
        message: error.message || "Failed to send reset email.",
        tone: "error",
      });
      setActionResultOpen(true);
      return;
    }
    toast.success("Password reset email sent");
    setActionResult({
      title: "Reset email sent",
      message: `Reset email sent to ${user.email}.`,
      tone: "success",
    });
    await logAdminAction("reset_password_email", user.user_id, {
      email: user.email,
    });
    setActionResultOpen(true);
  };

  const deleteUser = async (user: AdminUserRow) => {
    if (!confirm(`Delete ${user.email || "this user"}? This cannot be undone.`))
      return;
    setWorkingId(user.user_id);
    const { error } = await supabase.rpc("company_admin_delete_user", {
      target_user_id: user.user_id,
    });
    setWorkingId(null);
    if (error) {
      toast.error(error.message || "Failed to delete user");
      setActionResult({
        title: "Deletion failed",
        message: error.message || "Failed to delete user.",
        tone: "error",
      });
      setActionResultOpen(true);
      return;
    }
    toast.success("User deleted");
    setActionResult({
      title: "User deleted",
      message: `${user.email || "User"} deleted.`,
      tone: "warning",
    });
    await logAdminAction("delete_user", user.user_id, {
      email: user.email,
    });
    setActionResultOpen(true);
    loadUsers();
  };

  const prefetchStats = (userId: string) => {
    queryClient.prefetchQuery({
      queryKey: adminUsersKeys.stats(userId),
      queryFn: async () => {
        const { data, error } = await supabase.rpc(
          "get_company_admin_user_stats",
          {
            target_user_id: userId,
          }
        );
        if (error) throw error;
        const row = Array.isArray(data) ? data[0] : data;
        return (row || null) as AdminUserStats | null;
      },
      staleTime: 60 * 1000,
      gcTime: 10 * 60 * 1000,
    });
  };

  const openStats = async (user: AdminUserRow) => {
    setEditUser(null);
    setReauthOpen(false);
    setStatsUser(user);
    setStatsLoading(true);
    try {
      const cached = queryClient.getQueryData<AdminUserStats | null>(
        adminUsersKeys.stats(user.user_id)
      );
      if (cached !== undefined) {
        setStats(cached);
        setStatsLoading(false);
        return;
      }
      const data = await queryClient.fetchQuery({
        queryKey: adminUsersKeys.stats(user.user_id),
        queryFn: async () => {
          const { data, error } = await supabase.rpc(
            "get_company_admin_user_stats",
            {
              target_user_id: user.user_id,
            }
          );
          if (error) throw error;
          const row = Array.isArray(data) ? data[0] : data;
          return (row || null) as AdminUserStats | null;
        },
        staleTime: 60 * 1000,
        gcTime: 10 * 60 * 1000,
      });
      setStats(data || null);
    } catch (error: any) {
      toast.error(error.message || "Failed to load user stats");
      setStats(null);
    } finally {
      setStatsLoading(false);
    }
  };

  if (accessLoading) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center text-slate-400">
        Checking access...
      </div>
    );
  }

  if (!isCompanyAdmin) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center text-slate-400">
        You do not have access to this page.
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0A0A0A] px-4 sm:px-6 py-6">
      <div className="mx-auto max-w-6xl space-y-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-semibold text-white">Admin Users</h1>
            <p className="text-sm text-slate-400">
              Search, manage access, and update subscriptions.
            </p>
          </div>
          <Button variant="outline" onClick={() => onNavigate("/admin")}>
            Back to Admin
          </Button>
        </div>

        <Card className="bg-[#0D0D0D] border-white/[0.08]">
          <CardContent className="p-4">
            <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
              <div className="flex flex-1 items-center gap-2 rounded-md border border-white/[0.08] bg-white/[0.03] px-3 py-2">
                <Search className="h-4 w-4 text-slate-500" />
                <Input
                  value={search}
                  onChange={(e) => {
                    setSearch(e.target.value);
                    setPage(0);
                    setCursorStack([]);
                  }}
                  placeholder="Search name or email"
                  className="h-8 border-0 bg-transparent text-sm text-white placeholder:text-slate-500 focus-visible:ring-0 focus-visible:ring-offset-0"
                />
              </div>
              <div className="flex items-center gap-2">
                {["all", "active", "banned", "expired"].map((status) => (
                  <button
                    key={status}
                    onClick={() => setStatusFilter(status as any)}
                    className={cn(
                      "rounded-md border px-3 py-1 text-xs font-medium",
                      statusFilter === status
                        ? "border-primary/40 bg-primary/10 text-primary"
                        : "border-white/[0.08] text-slate-400 hover:text-slate-200"
                    )}
                  >
                    {status === "all"
                      ? "All"
                      : status === "active"
                        ? "Active"
                        : status === "banned"
                          ? "Banned"
                          : "Expired"}
                  </button>
                ))}
                <select
                  value={planFilter}
                  onChange={(e) => {
                    setPlanFilter(e.target.value);
                    setPage(0);
                    setCursorStack([]);
                  }}
                  className="rounded-md border border-white/[0.08] bg-[#0A0A0A] px-3 py-1 text-xs text-slate-300"
                >
                  <option value="all">All Plans</option>
                  {planOptions.map((plan) => (
                    <option
                      key={plan.tier || plan.slug}
                      value={plan.tier || plan.slug}
                    >
                      {plan.name || plan.tier}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-[#0D0D0D] border-white/[0.08]">
          <CardContent className="p-0">
            <div className="hidden md:grid grid-cols-[0.2fr_1.2fr_1.2fr_1fr_1fr_0.9fr_1.1fr] gap-4 px-4 py-3 text-xs uppercase tracking-wide text-slate-500 border-b border-white/[0.08]">
              <div className="flex items-center">
                <input
                  type="checkbox"
                  checked={
                    visibleUsers.length > 0 &&
                    visibleUsers.every((user) => selectedIds.has(user.user_id))
                  }
                  onChange={(event) => selectAllVisible(event.target.checked)}
                  className="h-4 w-4 rounded border-white/[0.2] bg-white/[0.03]"
                />
              </div>
              <span>User</span>
              <span>Email</span>
              <span>Workspace</span>
              <span>Plan</span>
              <span>Status</span>
              <span className="text-right">Actions</span>
            </div>

            {loading ? (
              <div className="p-4">
                {Array.from({ length: 8 }).map((_, i) => (
                  <TableRowSkeleton key={i} />
                ))}
              </div>
            ) : visibleUsers.length === 0 ? (
              <div className="p-6 text-center text-sm text-slate-400">
                No users found.
              </div>
            ) : (
              <div
                ref={listRef}
                onScroll={(event) => {
                  if (!shouldVirtualize) return;
                  setListScrollTop(event.currentTarget.scrollTop);
                }}
                className={cn(
                  "divide-y divide-white/[0.06]",
                  shouldVirtualize && "max-h-[70vh] overflow-auto"
                )}
              >
                {virtualWindow.paddingTop > 0 && (
                  <div style={{ height: virtualWindow.paddingTop }} />
                )}
                {virtualWindow.items.map((user, index) => {
                  const rowIndex = virtualWindow.startIndex + index;
                  const rowKey = `${user.user_id}-${rowIndex}`;
                  return (
                    <div
                      key={rowKey}
                      className="grid md:grid-cols-[0.2fr_1.2fr_1.2fr_1fr_1fr_0.9fr_1.1fr] gap-4 px-4 py-4 text-sm text-slate-200"
                      onMouseEnter={() => prefetchStats(user.user_id)}
                    >
                      <div className="flex items-center">
                        <input
                          type="checkbox"
                          checked={selectedIds.has(user.user_id)}
                          onChange={() => toggleSelect(user.user_id)}
                          className="h-4 w-4 rounded border-white/[0.2] bg-white/[0.03]"
                        />
                      </div>
                      <div className="flex items-center gap-3">
                        <div className="h-10 w-10 rounded-full bg-white/[0.05] flex items-center justify-center text-xs text-slate-400">
                          <Users className="h-4 w-4" />
                        </div>
                        <div>
                          <div className="font-medium text-white">
                            {user.full_name || "Unnamed User"}
                          </div>
                          <div className="text-xs text-slate-500">
                            Joined {formatDate(user.created_at)}
                          </div>
                        </div>
                      </div>
                      <div className="flex flex-col justify-center gap-1 text-xs text-slate-400">
                        <span className="text-sm text-slate-200">
                          {user.email || "—"}
                        </span>
                        <span>
                          Last sign-in {formatDate(user.last_sign_in_at)}
                        </span>
                      </div>
                      <div className="flex flex-col justify-center gap-1 text-xs text-slate-400">
                        <span className="text-sm text-slate-200">
                          {user.workspace_name || "—"}
                        </span>
                        <span>
                          {user.workspace_id
                            ? user.workspace_id.slice(0, 8)
                            : "No workspace"}
                        </span>
                      </div>
                      <div className="flex flex-col justify-center gap-1 text-xs text-slate-400">
                        <span className="text-sm text-slate-200">
                          {user.plan_slug || "—"}
                        </span>
                        <span>{toTitle(user.subscription_status)}</span>
                      </div>
                      <div className="flex flex-col justify-center gap-1 text-xs text-slate-400">
                        <span
                          className={cn(
                            "inline-flex w-fit items-center rounded-full px-2 py-0.5 text-xs",
                            user.is_banned
                              ? "bg-red-500/10 text-red-300"
                              : "bg-emerald-500/10 text-emerald-300"
                          )}
                        >
                          {user.is_banned ? "Banned" : "Active"}
                        </span>
                        {user.is_banned && (
                          <span className="text-xs text-red-300">
                            Until {formatDate(user.banned_until)}
                          </span>
                        )}
                      </div>
                      <div className="flex items-center justify-end relative">
                        <Button
                          variant="outline"
                          size="sm"
                          onMouseEnter={() => prefetchStats(user.user_id)}
                          onClick={() =>
                            setOpenMenuKey((prev) =>
                              prev === rowKey ? null : rowKey
                            )
                          }
                        >
                          Manage
                        </Button>
                        {openMenuKey === rowKey && (
                          <div
                            data-admin-user-menu="open"
                            className="absolute right-0 mt-2 mb-2 w-60 min-h-[261px] rounded-lg border border-white/[0.1] bg-[#0A0A0A] shadow-xl z-10 p-0"
                          >
                            <button
                              onClick={() => {
                                openStats(user);
                                setOpenMenuKey(null);
                              }}
                              className="flex w-full items-center gap-2 px-3 py-2 text-sm text-slate-200 hover:bg-white/[0.06]"
                            >
                              <Users className="h-4 w-4" />
                              View Stats
                            </button>
                            <button
                              onClick={() => {
                                openEdit(user);
                                setOpenMenuKey(null);
                              }}
                              className="flex w-full items-center gap-2 px-3 py-2 text-sm text-slate-200 hover:bg-white/[0.06]"
                            >
                              <Pencil className="h-4 w-4" />
                              Edit Subscription
                            </button>
                            <button
                              onClick={() => {
                                ensureAdminReauth(openReauthModal, () =>
                                  forceLogout(user)
                                );
                                setOpenMenuKey(null);
                              }}
                              disabled={workingId === user.user_id}
                              className="flex w-full items-center gap-2 px-3 py-2 text-sm text-amber-300 hover:bg-amber-500/10 disabled:opacity-50"
                            >
                              <ShieldAlert className="h-4 w-4" />
                              {workingId === user.user_id
                                ? "Logging out..."
                                : "Force Logout"}
                            </button>
                            <button
                              onClick={() => {
                                ensureAdminReauth(openReauthModal, () =>
                                  setPasswordResetRequired(
                                    user,
                                    !user.require_password_change
                                  )
                                );
                                setOpenMenuKey(null);
                              }}
                              disabled={workingId === user.user_id}
                              className="flex w-full items-center gap-2 px-3 py-2 text-sm text-purple-300 hover:bg-purple-500/10 disabled:opacity-50"
                            >
                              <ShieldCheck className="h-4 w-4" />
                              {workingId === user.user_id
                                ? "Updating..."
                                : user.require_password_change
                                  ? "Clear Password Reset"
                                  : "Require Password Change"}
                            </button>
                            <button
                              onClick={() => {
                                ensureAdminReauth(openReauthModal, () =>
                                  resetPassword(user)
                                );
                                setOpenMenuKey(null);
                              }}
                              disabled={workingId === user.user_id}
                              className="flex w-full items-center gap-2 px-3 py-2 text-sm text-sky-300 hover:bg-sky-500/10 disabled:opacity-50"
                            >
                              <RefreshCcw className="h-4 w-4" />
                              {workingId === user.user_id
                                ? "Sending..."
                                : "Reset Password"}
                            </button>
                            <div className="h-px bg-white/[0.08]" />
                            {user.is_banned ? (
                              <button
                                onClick={() => {
                                  ensureAdminReauth(openReauthModal, () =>
                                    banUser(user, null)
                                  );
                                  setOpenMenuKey(null);
                                }}
                                disabled={workingId === user.user_id}
                                className="flex w-full items-center gap-2 px-3 py-2 text-sm text-emerald-300 hover:bg-emerald-500/10 disabled:opacity-50"
                              >
                                <ShieldCheck className="h-4 w-4" />
                                {workingId === user.user_id
                                  ? "Unbanning..."
                                  : "Unban User"}
                              </button>
                            ) : (
                              <button
                                onClick={() => {
                                  ensureAdminReauth(openReauthModal, () =>
                                    banUser(user, 7)
                                  );
                                  setOpenMenuKey(null);
                                }}
                                disabled={workingId === user.user_id}
                                className="flex w-full items-center gap-2 px-3 py-2 text-sm text-amber-300 hover:bg-amber-500/10 disabled:opacity-50"
                              >
                                <ShieldAlert className="h-4 w-4" />
                                {workingId === user.user_id
                                  ? "Banning..."
                                  : "Ban 7 Days"}
                              </button>
                            )}
                            <button
                              onClick={() => {
                                ensureAdminReauth(openReauthModal, () =>
                                  deleteUser(user)
                                );
                                setOpenMenuKey(null);
                              }}
                              disabled={workingId === user.user_id}
                              className="flex w-full items-center gap-2 px-3 py-2 text-sm text-red-300 hover:bg-red-500/10 disabled:opacity-50"
                            >
                              <Trash2 className="h-4 w-4" />
                              {workingId === user.user_id
                                ? "Deleting..."
                                : "Delete User"}
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
                {virtualWindow.paddingBottom > 0 && (
                  <div style={{ height: virtualWindow.paddingBottom }} />
                )}
              </div>
            )}
          </CardContent>
        </Card>

        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 text-xs text-slate-500">
          <span>Showing {visibleUsers.length} users on this page</span>
          <div className="flex w-full flex-wrap items-center gap-2 sm:w-auto">
            {selectedIds.size > 0 && (
              <div className="w-full sm:w-auto">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-xs text-slate-400">
                    {selectedIds.size} selected
                  </span>
                  <div className="flex flex-wrap items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => bulkBan(7)}
                      disabled={workingId === "bulk-ban"}
                      className="border-amber-500/30 text-amber-300 hover:bg-amber-500/10"
                    >
                      {workingId === "bulk-ban" ? "Banning..." : "Ban 7 Days"}
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={bulkForceLogout}
                      disabled={workingId === "bulk-logout"}
                      className="border-amber-500/30 text-amber-300 hover:bg-amber-500/10"
                    >
                      {workingId === "bulk-logout"
                        ? "Logging out..."
                        : "Force Logout"}
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={bulkDeleteUsers}
                      disabled={workingId === "bulk-delete"}
                      className="border-red-500/40 text-red-300 hover:bg-red-500/10"
                    >
                      {workingId === "bulk-delete"
                        ? "Deleting..."
                        : "Delete Users"}
                    </Button>
                  </div>
                  <div className="relative">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() =>
                        setOpenMenuKey(
                          openMenuKey === "bulk-actions" ? null : "bulk-actions"
                        )
                      }
                      className="border-white/[0.2] text-slate-200 hover:bg-white/[0.06]"
                    >
                      Bulk Actions
                    </Button>
                    {openMenuKey === "bulk-actions" && (
                      <div
                        data-admin-user-menu="open"
                        className="absolute right-0 z-30 mt-2 w-64 overflow-hidden rounded-xl border border-white/[0.12] bg-[#0D0D0D] shadow-xl"
                      >
                        <div className="px-3 pt-3 pb-2 text-[11px] uppercase tracking-[0.2em] text-slate-500">
                          Account access
                        </div>
                        <button
                          onClick={() => {
                            bulkBan(7);
                            setOpenMenuKey(null);
                          }}
                          disabled={workingId === "bulk-ban"}
                          className="flex w-full items-center gap-2 px-3 py-2 text-sm text-amber-300 hover:bg-amber-500/10 disabled:opacity-50"
                        >
                          {workingId === "bulk-ban"
                            ? "Banning..."
                            : "Ban 7 Days"}
                        </button>
                        <button
                          onClick={() => {
                            bulkBan(null);
                            setOpenMenuKey(null);
                          }}
                          disabled={workingId === "bulk-ban"}
                          className="flex w-full items-center gap-2 px-3 py-2 text-sm text-emerald-300 hover:bg-emerald-500/10 disabled:opacity-50"
                        >
                          {workingId === "bulk-ban" ? "Unbanning..." : "Unban"}
                        </button>
                        <button
                          onClick={() => {
                            bulkForceLogout();
                            setOpenMenuKey(null);
                          }}
                          disabled={workingId === "bulk-logout"}
                          className="flex w-full items-center gap-2 px-3 py-2 text-sm text-amber-300 hover:bg-amber-500/10 disabled:opacity-50"
                        >
                          {workingId === "bulk-logout"
                            ? "Logging out..."
                            : "Force Logout"}
                        </button>

                        <div className="px-3 pt-3 pb-2 text-[11px] uppercase tracking-[0.2em] text-slate-500">
                          Passwords
                        </div>
                        <button
                          onClick={() => {
                            bulkResetPasswords();
                            setOpenMenuKey(null);
                          }}
                          disabled={workingId === "bulk-reset"}
                          className="flex w-full items-center gap-2 px-3 py-2 text-sm text-sky-300 hover:bg-sky-500/10 disabled:opacity-50"
                        >
                          {workingId === "bulk-reset"
                            ? "Sending..."
                            : "Reset Passwords"}
                        </button>
                        <button
                          onClick={() => {
                            bulkPasswordResetRequired(true);
                            setOpenMenuKey(null);
                          }}
                          disabled={workingId === "bulk-password"}
                          className="flex w-full items-center gap-2 px-3 py-2 text-sm text-purple-300 hover:bg-purple-500/10 disabled:opacity-50"
                        >
                          {workingId === "bulk-password"
                            ? "Updating..."
                            : "Require Password Change"}
                        </button>
                        <button
                          onClick={() => {
                            bulkPasswordResetRequired(false);
                            setOpenMenuKey(null);
                          }}
                          disabled={workingId === "bulk-password"}
                          className="flex w-full items-center gap-2 px-3 py-2 text-sm text-emerald-300 hover:bg-emerald-500/10 disabled:opacity-50"
                        >
                          {workingId === "bulk-password"
                            ? "Updating..."
                            : "Clear Password Reset"}
                        </button>

                        <div className="px-3 pt-3 pb-2 text-[11px] uppercase tracking-[0.2em] text-slate-500">
                          Subscription
                        </div>
                        <button
                          onClick={() => {
                            setBulkEditOpen(true);
                            setOpenMenuKey(null);
                          }}
                          disabled={workingId === "bulk-update"}
                          className="flex w-full items-center gap-2 px-3 py-2 text-sm text-slate-200 hover:bg-white/[0.06] disabled:opacity-50"
                        >
                          {workingId === "bulk-update"
                            ? "Updating..."
                            : "Bulk Update"}
                        </button>

                        <div className="px-3 pt-3 pb-2 text-[11px] uppercase tracking-[0.2em] text-slate-500">
                          Destructive
                        </div>
                        <button
                          onClick={() => {
                            bulkDeleteUsers();
                            setOpenMenuKey(null);
                          }}
                          disabled={workingId === "bulk-delete"}
                          className="flex w-full items-center gap-2 px-3 py-2 text-sm text-red-300 hover:bg-red-500/10 disabled:opacity-50"
                        >
                          {workingId === "bulk-delete"
                            ? "Deleting..."
                            : "Delete Users"}
                        </button>
                        <div className="px-3 py-2 text-[11px] text-slate-500">
                          Actions apply to all selected users.
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                if (cursorStack.length === 0) return;
                const nextStack = [...cursorStack];
                nextStack.pop();
                setCursorStack(nextStack);
                setPage((prev) => Math.max(0, prev - 1));
              }}
              disabled={cursorStack.length === 0}
            >
              Prev
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                const last = users[users.length - 1];
                if (!last || !last.created_at) return;
                setCursorStack((prev) => [
                  ...prev,
                  {
                    created_at: last.created_at as string,
                    user_id: last.user_id,
                  },
                ]);
                setPage((prev) => prev + 1);
              }}
              disabled={!hasNext || users.length === 0}
            >
              Next
            </Button>
          </div>
        </div>
      </div>

      {editUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-4">
          <div className="w-full max-w-lg rounded-xl border border-white/[0.1] bg-[#0D0D0D] p-6">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-lg font-semibold text-white">Edit User</h2>
                <p className="text-xs text-slate-400">{editUser.email}</p>
              </div>
              <button
                onClick={closeEdit}
                className="text-slate-500 hover:text-white"
              >
                ✕
              </button>
            </div>

            <div className="mt-4 space-y-3 text-sm text-slate-300">
              <div>
                <label className="block text-xs text-slate-500 mb-1">
                  Plan
                </label>
                <select
                  value={planSlug}
                  onChange={(e) => setPlanSlug(e.target.value)}
                  className="w-full rounded-md border border-white/[0.08] bg-[#0A0A0A] px-3 py-2 text-sm text-white"
                >
                  <option value="">No change</option>
                  {plans.map((plan) => (
                    <option key={plan.slug} value={plan.slug}>
                      {plan.name || plan.slug} ({plan.billing_cycle})
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs text-slate-500 mb-1">
                  Status
                </label>
                <select
                  value={planStatus}
                  onChange={(e) => setPlanStatus(e.target.value)}
                  className="w-full rounded-md border border-white/[0.08] bg-[#0A0A0A] px-3 py-2 text-sm text-white"
                >
                  {[
                    "active",
                    "trialing",
                    "past_due",
                    "canceled",
                    "incomplete",
                    "free",
                  ].map((status) => (
                    <option key={status} value={status}>
                      {toTitle(status)}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs text-slate-500 mb-1">
                  Total Seats (optional)
                </label>
                <Input
                  value={seatOverride}
                  onChange={(e) => setSeatOverride(e.target.value)}
                  placeholder="e.g. 5"
                  className="h-10 bg-white/[0.03] border-white/[0.08] text-white"
                />
              </div>
            </div>

            <div className="mt-6 flex items-center justify-end gap-2">
              <Button variant="outline" onClick={closeEdit}>
                Cancel
              </Button>
              <Button
                onClick={() =>
                  ensureAdminReauth(openReauthModal, updateSubscription)
                }
                disabled={workingId === editUser.user_id}
              >
                Save Changes
              </Button>
            </div>
          </div>
        </div>
      )}

      {statsUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-4">
          <div className="w-full max-w-lg rounded-xl border border-white/[0.1] bg-[#0D0D0D] p-6">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-lg font-semibold text-white">
                  Account Stats
                </h2>
                <p className="text-xs text-slate-400">{statsUser.email}</p>
              </div>
              <button
                onClick={() => setStatsUser(null)}
                className="text-slate-500 hover:text-white"
              >
                ✕
              </button>
            </div>
            {statsLoading ? (
              <div className="py-6 text-center text-sm text-slate-400">
                Loading stats...
              </div>
            ) : (
              <div className="mt-4 grid grid-cols-2 gap-4 text-sm text-slate-200">
                <div className="rounded-lg border border-white/[0.08] p-3">
                  <div className="text-xs text-slate-500">Campaigns</div>
                  <div className="text-lg font-semibold text-white">
                    {stats?.total_campaigns ?? 0}
                  </div>
                </div>
                <div className="rounded-lg border border-white/[0.08] p-3">
                  <div className="text-xs text-slate-500">Requests</div>
                  <div className="text-lg font-semibold text-white">
                    {stats?.total_requests ?? 0}
                  </div>
                </div>
                <div className="rounded-lg border border-white/[0.08] p-3">
                  <div className="text-xs text-slate-500">Creators</div>
                  <div className="text-lg font-semibold text-white">
                    {stats?.total_creators ?? 0}
                  </div>
                </div>
                <div className="rounded-lg border border-white/[0.08] p-3">
                  <div className="text-xs text-slate-500">Posts</div>
                  <div className="text-lg font-semibold text-white">
                    {stats?.total_posts ?? 0}
                  </div>
                </div>
                <div className="rounded-lg border border-white/[0.08] p-3 col-span-2">
                  <div className="text-xs text-slate-500">Total Views</div>
                  <div className="text-lg font-semibold text-white">
                    {stats?.total_views ?? 0}
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {bulkEditOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-4">
          <div className="w-full max-w-lg rounded-xl border border-white/[0.1] bg-[#0D0D0D] p-6">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-lg font-semibold text-white">
                  Bulk Update Subscriptions
                </h2>
                <p className="text-xs text-slate-400">
                  Applying to {selectedIds.size} selected users.
                </p>
              </div>
              <button
                onClick={() => setBulkEditOpen(false)}
                className="text-slate-500 hover:text-white"
              >
                ✕
              </button>
            </div>

            <div className="mt-4 space-y-3 text-sm text-slate-300">
              <div>
                <label className="block text-xs text-slate-500 mb-1">
                  Plan
                </label>
                <select
                  value={bulkPlanSlug}
                  onChange={(e) => setBulkPlanSlug(e.target.value)}
                  className="w-full rounded-md border border-white/[0.08] bg-[#0A0A0A] px-3 py-2 text-sm text-white"
                >
                  <option value="">No change</option>
                  {plans.map((plan) => (
                    <option key={plan.slug} value={plan.slug}>
                      {plan.name || plan.slug} ({plan.billing_cycle})
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs text-slate-500 mb-1">
                  Status
                </label>
                <select
                  value={bulkPlanStatus}
                  onChange={(e) => setBulkPlanStatus(e.target.value)}
                  className="w-full rounded-md border border-white/[0.08] bg-[#0A0A0A] px-3 py-2 text-sm text-white"
                >
                  {[
                    "active",
                    "trialing",
                    "past_due",
                    "canceled",
                    "incomplete",
                    "free",
                  ].map((status) => (
                    <option key={status} value={status}>
                      {toTitle(status)}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs text-slate-500 mb-1">
                  Total Seats (optional)
                </label>
                <Input
                  value={bulkSeatOverride}
                  onChange={(e) => setBulkSeatOverride(e.target.value)}
                  placeholder="e.g. 5"
                  className="h-10 bg-white/[0.03] border-white/[0.08] text-white"
                />
              </div>
            </div>

            <div className="mt-6 flex items-center justify-end gap-2">
              <Button variant="outline" onClick={() => setBulkEditOpen(false)}>
                Cancel
              </Button>
              <Button
                onClick={applyBulkUpdate}
                disabled={workingId === "bulk-update"}
              >
                {workingId === "bulk-update" ? "Applying..." : "Apply Updates"}
              </Button>
            </div>
          </div>
        </div>
      )}

      {bulkResultOpen && bulkResult && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-4">
          <div className="w-full max-w-md rounded-xl border border-white/[0.1] bg-[#0D0D0D] p-6">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-lg font-semibold text-white">
                  {bulkResult.title}
                </h2>
                <p
                  className={cn(
                    "mt-2 text-sm",
                    bulkResult.tone === "success" && "text-emerald-300",
                    bulkResult.tone === "warning" && "text-amber-300",
                    bulkResult.tone === "error" && "text-red-300"
                  )}
                >
                  {bulkResult.message}
                </p>
              </div>
              <button
                onClick={() => setBulkResultOpen(false)}
                className="text-slate-500 hover:text-white"
              >
                ✕
              </button>
            </div>
            <div className="mt-6 flex justify-end">
              <Button onClick={() => setBulkResultOpen(false)}>Close</Button>
            </div>
          </div>
        </div>
      )}

      {actionResultOpen && actionResult && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-4">
          <div className="w-full max-w-md rounded-xl border border-white/[0.1] bg-[#0D0D0D] p-6">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-lg font-semibold text-white">
                  {actionResult.title}
                </h2>
                <p
                  className={cn(
                    "mt-2 text-sm",
                    actionResult.tone === "success" && "text-emerald-300",
                    actionResult.tone === "warning" && "text-amber-300",
                    actionResult.tone === "error" && "text-red-300"
                  )}
                >
                  {actionResult.message}
                </p>
              </div>
              <button
                onClick={() => setActionResultOpen(false)}
                className="text-slate-500 hover:text-white"
              >
                ✕
              </button>
            </div>
            <div className="mt-6 flex justify-end">
              <Button onClick={() => setActionResultOpen(false)}>Close</Button>
            </div>
          </div>
        </div>
      )}

      <AdminReauth
        open={reauthOpen}
        onClose={() => setReauthOpen(false)}
        onVerified={handleReauthVerified}
      />
    </div>
  );
}
