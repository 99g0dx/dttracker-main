"use client";

import { useTheme } from "next-themes";
import { Toaster as Sonner, ToasterProps } from "sonner";

const Toaster = ({ ...props }: ToasterProps) => {
  const { theme = "system" } = useTheme();

  return (
    <Sonner
      theme={theme as ToasterProps["theme"]}
      className="toaster group"
      position="top-center"
      closeButton
      closeButtonAriaLabel="Dismiss notification"
      offset={{ top: "calc(env(safe-area-inset-top) + 8px)" }}
      mobileOffset={{
        top: "calc(env(safe-area-inset-top) + 8px)",
        left: "4vw",
        right: "4vw",
      }}
      toastOptions={{
        classNames: {
          toast: "text-sm px-4 py-3 max-w-sm",
          title: "text-sm",
          description: "text-sm",
          closeButton:
            "h-11 w-11 rounded-full flex items-center justify-center",
        },
      }}
      style={
        {
          "--normal-bg": "var(--popover)",
          "--normal-text": "var(--popover-foreground)",
          "--normal-border": "var(--border)",
          "--width": "min(92vw, 24rem)",
        } as React.CSSProperties
      }
      {...props}
    />
  );
};

export { Toaster };
