import React, { useState, useEffect } from "react";
import { Bell, Check, TrendingUp, Users, Megaphone, X } from "lucide-react";
import { Card, CardContent } from "./ui/card";
import { cn } from "./ui/utils";

interface Notification {
  id: number;
  type:
    | "campaign"
    | "performance"
    | "team"
    | "post_scraped"
    | "top_performer"
    | "bulk_scraped";
  title: string;
  message: string;
  time: string;
  read: boolean;
}

const defaultNotifications: Notification[] = [
  {
    id: 1,
    type: "campaign",
    title: "Welcome to DTTracker",
    message: "Get started by creating your first campaign",
    time: "Just now",
    read: false,
  },
];

export function NotificationsCenter() {
  const [isOpen, setIsOpen] = useState(false);
  const [notifications, setNotifications] = useState<Notification[]>(() => {
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem("dttracker-notifications");
      if (saved) {
        try {
          return JSON.parse(saved);
        } catch (e) {
          return defaultNotifications;
        }
      }
    }
    return defaultNotifications;
  });

  // Listen for notification updates
  useEffect(() => {
    const handleUpdate = () => {
      if (typeof window !== "undefined") {
        const saved = localStorage.getItem("dttracker-notifications");
        if (saved) {
          try {
            setNotifications(JSON.parse(saved));
          } catch (e) {
            // Ignore parse errors
          }
        }
      }
    };

    window.addEventListener("notifications-updated", handleUpdate);
    return () =>
      window.removeEventListener("notifications-updated", handleUpdate);
  }, []);

  // Save to localStorage whenever notifications change
  useEffect(() => {
    if (typeof window !== "undefined") {
      localStorage.setItem(
        "dttracker-notifications",
        JSON.stringify(notifications)
      );
    }
  }, [notifications]);

  const unreadCount = notifications.filter((n) => !n.read).length;

  const markAsRead = (id: number) => {
    setNotifications(
      notifications.map((n) => (n.id === id ? { ...n, read: true } : n))
    );
  };

  const markAllAsRead = () => {
    setNotifications(notifications.map((n) => ({ ...n, read: true })));
  };

  const removeNotification = (id: number) => {
    setNotifications(notifications.filter((n) => n.id !== id));
  };

  const clearAll = () => {
    if (confirm("Are you sure you want to clear all notifications?")) {
      setNotifications([]);
    }
  };

  const getIcon = (type: string) => {
    switch (type) {
      case "campaign":
        return <Megaphone className="w-4 h-4 text-primary" />;
      case "performance":
        return <TrendingUp className="w-4 h-4 text-emerald-400" />;
      case "team":
        return <Users className="w-4 h-4 text-purple-400" />;
      case "post_scraped":
        return <Check className="w-4 h-4 text-cyan-400" />;
      case "top_performer":
        return <TrendingUp className="w-4 h-4 text-yellow-400" />;
      case "bulk_scraped":
        return <Megaphone className="w-4 h-4 text-primary" />;
      default:
        return <Bell className="w-4 h-4 text-slate-400" />;
    }
  };

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (!target.closest(".notifications-dropdown")) {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener("click", handleClickOutside);
      return () => document.removeEventListener("click", handleClickOutside);
    }
  }, [isOpen]);

  // Update time dynamically
  const getRelativeTime = (timeStr: string) => {
    if (timeStr === "Just now") return timeStr;

    // Try to parse the time if it's in a specific format
    const match = timeStr.match(
      /(\d+)\s+(second|minute|hour|day|week|month)s?\s+ago/
    );
    if (match) {
      return timeStr;
    }

    return timeStr;
  };

  return (
    <div className="relative notifications-dropdown">
      {/* Bell Icon Button */}
      <button
        onClick={(e) => {
          e.stopPropagation();
          setIsOpen(!isOpen);
        }}
        className="relative w-8 h-8 rounded-md bg-white/[0.03] hover:bg-white/[0.06] border border-white/[0.08] flex items-center justify-center transition-colors"
      >
        <Bell className="w-5 h-5 text-slate-300" />
        {unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 w-5 h-5 bg-primary text-black text-xs font-semibold rounded-full flex items-center justify-center">
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        )}
      </button>

      {/* Dropdown */}
      {isOpen && (
        <div
          className={cn(
            /* Mobile: Fixed at top with margins to prevent clipping */
            "fixed inset-x-4 top-16 mx-auto w-auto max-w-[calc(100vw-32px)]",
            /* Desktop: Absolute positioning relative to the bell icon */
            "lg:absolute lg:inset-auto lg:right-0 lg:top-full lg:mt-2 lg:w-80 md:w-72 md:inset-auto md:right-18",
            "bg-[#1A1A1A] border border-white/[0.08] rounded-xl shadow-2xl z-50 overflow-hidden animate-in fade-in zoom-in-95 duration-200"
          )}
        >
          {/* Header*/}
          <div className="p-3 border-b border-white/[0.08]">
            <div className="flex items-center justify-between mb-1.5">
              <h3 className="font-semibold text-white">Notifications</h3>
              <div className="flex items-center gap-2">
                {unreadCount > 0 && (
                  <button
                    onClick={markAllAsRead}
                    className="text-xs text-primary hover:text-primary/80 transition-colors"
                  >
                    Mark all read
                  </button>
                )}
                {notifications.length > 0 && (
                  <button
                    onClick={clearAll}
                    className="text-xs text-red-400 hover:text-red-400/80 transition-colors"
                  >
                    Clear all
                  </button>
                )}
              </div>
            </div>
            <p className="text-xs text-slate-500">
              {unreadCount > 0
                ? `You have ${unreadCount} unread notification${unreadCount !== 1 ? "s" : ""}`
                : "All caught up!"}
            </p>
          </div>

          {/* Notifications List */}
          <div className="max-h-80 overflow-y-auto">
            {notifications.length > 0 ? (
              <div className="divide-y divide-white/[0.06]">
                {notifications.map((notification) => (
                  <div
                    key={notification.id}
                    className={`p-3 hover:bg-white/[0.03] transition-colors group relative ${
                      !notification.read ? "bg-white/[0.02]" : ""
                    }`}
                  >
                    <div className="flex gap-2.5">
                      <div className="w-6 h-6 rounded-lg bg-white/[0.03] flex items-center justify-center flex-shrink-0">
                        {getIcon(notification.type)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-2 mb-0.5">
                          <h4 className="text-sm font-medium text-white">
                            {notification.title}
                          </h4>
                          <button
                            onClick={() => removeNotification(notification.id)}
                            className="opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0"
                          >
                            <X className="w-4 h-4 text-slate-500 hover:text-slate-300" />
                          </button>
                        </div>
                        <p className="text-sm text-slate-400 mb-1.5">
                          {notification.message}
                        </p>
                        <div className="flex items-center justify-between">
                          <span className="text-xs text-slate-500">
                            {getRelativeTime(notification.time)}
                          </span>
                          {!notification.read && (
                            <button
                              onClick={() => markAsRead(notification.id)}
                              className="text-xs text-primary hover:text-primary/80 transition-colors flex items-center gap-1"
                            >
                              <Check className="w-3 h-3" />
                              Mark read
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                    {!notification.read && (
                      <div className="absolute left-2 top-1/2 -translate-y-1/2 w-2 h-2 rounded-full bg-primary" />
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <div className="py-8 text-center">
                <div className="w-12 h-12 rounded-lg bg-white/[0.03] flex items-center justify-center mx-auto mb-3">
                  <Bell className="w-6 h-6 text-slate-600" />
                </div>
                <p className="text-sm text-slate-500">No notifications</p>
                <p className="text-xs text-slate-600 mt-1">
                  We'll notify you when something happens
                </p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
