import React from "react";
import { Toaster } from "./ui/sonner";

export function ToastProvider({ children }: { children: React.ReactNode }) {
  return (
    <>
      {children}
      <Toaster
        position="top-right"
      toastOptions={{
        style: {
          background: "var(--popover)",
          backdropFilter: "blur(12px)",
          border: "1px solid var(--border)",
          borderRadius: "12px",
          boxShadow: "0 8px 32px rgba(0, 0, 0, 0.3)",
          color: "var(--popover-foreground)",
          width: "auto",
          maxWidth: "min(92vw, 20rem)",
        },
      }}
      />
    </>
  );
}
