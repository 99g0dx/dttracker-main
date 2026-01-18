import React, { createContext, useContext, useMemo, useState } from "react";

type WorkspaceContextValue = {
  activeWorkspaceId: string | null;
  setActiveWorkspaceId: (workspaceId: string | null) => void;
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

  const setActiveWorkspaceId = (workspaceId: string | null) => {
    setActiveWorkspaceIdState(workspaceId);
    if (typeof window === "undefined") return;
    if (workspaceId) {
      localStorage.setItem("dttracker-active-workspace", workspaceId);
    } else {
      localStorage.removeItem("dttracker-active-workspace");
    }
  };

  const value = useMemo(
    () => ({ activeWorkspaceId, setActiveWorkspaceId }),
    [activeWorkspaceId, setActiveWorkspaceId]
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
