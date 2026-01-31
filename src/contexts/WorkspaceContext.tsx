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

        const { data } = await supabase
          .from("workspace_members")
          .select("workspace_id")
          .eq("user_id", user.id)
          .eq("status", "active")
          .limit(1)
          .maybeSingle();

        const workspaceId = data?.workspace_id || user.id;
        if (!cancelled) {
          setActiveWorkspaceIdState(workspaceId);
        }
      } catch {
        if (!cancelled) {
          setActiveWorkspaceIdState(user.id);
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
