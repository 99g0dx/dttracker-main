"use client";

import { useTheme } from "next-themes";
import { Toaster as Sonner, ToasterProps } from "sonner";

const Toaster = ({ ...props }: ToasterProps) => {
  const { theme = "system" } = useTheme();

  return (
    <Sonner
      theme={theme as ToasterProps["theme"]}
      className="toaster group"
      closeButton
      closeButtonAriaLabel="Dismiss notification"
      {...props}
      offset={{ top: "calc(env(safe-area-inset-top) + 60px)" }}
      mobileOffset={{
        top: "calc(env(safe-area-inset-top) + 60px)",
        right: "4vw",
      }}
      toastOptions={{
        ...props.toastOptions,
        classNames: {
          toast: "text-sm px-3 py-3 max-w-xs md:max-w-md",
          title: "text-sm",
          description: "text-sm",
          closeButton: "h-4 w-4 rounded-full flex items-center justify-center",
          ...props.toastOptions?.classNames,
        },
      }}
      style={
        {
          "--normal-bg": "var(--popover)",
          "--normal-text": "var(--popover-foreground)",
          "--normal-border": "var(--border)",
          "--width": "auto",
        } as React.CSSProperties
      }
    />
  );
};

export { Toaster };
