import React, { createContext, useContext, useEffect, useMemo, useState } from "react";
import { supabase } from "../lib/supabase";
import { useAuth } from "./AuthContext";

type WorkspaceContextValue = {
  activeWorkspaceId: string | null;
  setActiveWorkspaceId: (workspaceId: string | null) => void;
  isSwitching: boolean;
};

const WorkspaceContext = createContext<WorkspaceContextValue | undefined>(
  undefined
);

export function WorkspaceProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const [activeWorkspaceId, setActiveWorkspaceIdState] = useState<string | null>(null);
  const [isSwitching, setIsSwitching] = useState(false);
  const storageKey = user?.id ? `dt_active_workspace_${user.id}` : null;

  useEffect(() => {
    let cancelled = false;

    const resolveWorkspaceId = async () => {
      if (!user?.id) {
        setActiveWorkspaceIdState(null);
        return;
      }

      try {
        const storedWorkspaceId = storageKey
          ? window.localStorage.getItem(storageKey)
          : null;

        if (storedWorkspaceId) {
          const { data: storedMembership } = await supabase
            .from("workspace_members")
            .select("workspace_id")
            .eq("workspace_id", storedWorkspaceId)
            .eq("user_id", user.id)
            .eq("status", "active")
            .maybeSingle();

          if (storedMembership?.workspace_id) {
            if (!cancelled) {
              setActiveWorkspaceIdState(storedWorkspaceId);
            }
            return;
          }
        }

        const { data: memberships } = await supabase
          .from("workspace_members")
          .select("workspace_id, workspaces(owner_user_id)")
          .eq("user_id", user.id)
          .eq("status", "active");

        const list = (memberships || []) as { workspace_id: string; workspaces: { owner_user_id: string } | null }[];
        const owned = list.find((m) => m.workspaces?.owner_user_id === user.id);
        const workspaceId = owned?.workspace_id ?? list[0]?.workspace_id ?? null;
        if (!cancelled) {
          if (!workspaceId) {
            console.error("WorkspaceContext: No workspace found for user", user.id);
          }
          setActiveWorkspaceIdState(workspaceId);
        }
      } catch (err) {
        console.error("WorkspaceContext: Failed to resolve workspace", err);
        if (!cancelled) {
          setActiveWorkspaceIdState(null);
        }
      }
    };

    resolveWorkspaceId();

    return () => {
      cancelled = true;
    };
  }, [user?.id]);

  const setActiveWorkspaceId = (workspaceId: string | null) => {
    setActiveWorkspaceIdState(workspaceId);
    setIsSwitching(true);
    if (storageKey) {
      if (workspaceId) {
        window.localStorage.setItem(storageKey, workspaceId);
      } else {
        window.localStorage.removeItem(storageKey);
      }
    }
    window.setTimeout(() => {
      setIsSwitching(false);
    }, 600);
  };

  const value = useMemo(
    () => ({ activeWorkspaceId, setActiveWorkspaceId, isSwitching }),
    [activeWorkspaceId, setActiveWorkspaceId, isSwitching]
  );

  return (
    <WorkspaceContext.Provider value={value}>
      {children}
    </WorkspaceContext.Provider>
  );
}

export function useWorkspace() {
  const context = useContext(WorkspaceContext);
  if (!context) {
    throw new Error("useWorkspace must be used within a WorkspaceProvider");
  }
  return context;
}
