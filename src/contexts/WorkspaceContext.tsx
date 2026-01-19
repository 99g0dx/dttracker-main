import React, { createContext, useContext, useMemo, useState } from "react";

type WorkspaceContextValue = {
  activeWorkspaceId: string | null;
  setActiveWorkspaceId: (workspaceId: string | null) => void;
  isSwitching: boolean;
};

const WorkspaceContext = createContext<WorkspaceContextValue | undefined>(
  undefined
);

export function WorkspaceProvider({ children }: { children: React.ReactNode }) {
  const [activeWorkspaceId, setActiveWorkspaceIdState] = useState<string | null>(
    () => {
      if (typeof window === "undefined") return null;
      return localStorage.getItem("dttracker-active-workspace");
    }
  );
  const [isSwitching, setIsSwitching] = useState(false);

  const setActiveWorkspaceId = (workspaceId: string | null) => {
    setActiveWorkspaceIdState(workspaceId);
    setIsSwitching(true);
    if (typeof window === "undefined") return;
    if (workspaceId) {
      localStorage.setItem("dttracker-active-workspace", workspaceId);
    } else {
      localStorage.removeItem("dttracker-active-workspace");
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
