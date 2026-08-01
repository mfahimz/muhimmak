"use client";

import { useEffect, useState, useCallback } from "react";
import { BellIcon, CheckCheckIcon, BellOffIcon } from "lucide-react";
import { useTranslations } from "next-intl";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { cn } from "@/lib/utils";

interface NotificationItem {
  id: string;
  type: string;
  title: string;
  message: string;
  is_read: boolean;
  created_at: string;
  metadata?: Record<string, any>;
}

function formatRelativeTime(
  dateString: string,
  t: (key: string, values?: Record<string, any>) => string
): string {
  const now = new Date();
  const past = new Date(dateString);
  const diffInSeconds = Math.floor((now.getTime() - past.getTime()) / 1000);

  if (isNaN(past.getTime())) return "";
  if (diffInSeconds < 60) return t("justNow");
  const diffInMinutes = Math.floor(diffInSeconds / 60);
  if (diffInMinutes < 60) return t("minutesAgo", { count: diffInMinutes });
  const diffInHours = Math.floor(diffInMinutes / 60);
  if (diffInHours < 24) return t("hoursAgo", { count: diffInHours });
  const diffInDays = Math.floor(diffInHours / 24);
  if (diffInDays < 30) return t("daysAgo", { count: diffInDays });
  return past.toLocaleDateString();
}

export function NotificationBell() {
  const t = useTranslations("Notifications");
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [unreadCount, setUnreadCount] = useState<number>(0);
  const [loading, setLoading] = useState<boolean>(false);
  const [open, setOpen] = useState<boolean>(false);

  const fetchNotifications = useCallback(async () => {
    try {
      setLoading(true);
      const res = await fetch("/api/v1/notifications-center");
      if (res.ok) {
        const data = await res.json();
        setNotifications(data.notifications || []);
        setUnreadCount(data.unreadCount || 0);
      }
    } catch (err) {
      console.error("Failed to fetch notifications:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchNotifications();
  }, [fetchNotifications]);

  const handleOpenChange = (isOpen: boolean) => {
    setOpen(isOpen);
    if (isOpen) {
      fetchNotifications();
    }
  };

  const handleMarkRead = async (notificationId: string, currentReadState: boolean) => {
    if (currentReadState) return;

    // Optimistic update
    setNotifications((prev) =>
      prev.map((n) => (n.id === notificationId ? { ...n, is_read: true } : n))
    );
    setUnreadCount((prev) => Math.max(0, prev - 1));

    try {
      await fetch("/api/v1/notifications-center/read", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ notificationId }),
      });
    } catch (err) {
      console.error("Failed to mark notification as read:", err);
    }
  };

  const handleMarkAllRead = async () => {
    if (unreadCount === 0) return;

    // Optimistic update
    setNotifications((prev) => prev.map((n) => ({ ...n, is_read: true })));
    setUnreadCount(0);

    try {
      await fetch("/api/v1/notifications-center/read-all", {
        method: "PATCH",
      });
    } catch (err) {
      console.error("Failed to mark all as read:", err);
    }
  };

  return (
    <DropdownMenu open={open} onOpenChange={handleOpenChange}>
      <DropdownMenuTrigger
        render={
          <button
            type="button"
            className="relative inline-flex items-center justify-center rounded-lg p-2 text-slate-500 hover:bg-slate-100 hover:text-slate-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring transition-colors"
            aria-label={t("title")}
          >
            <BellIcon className="size-5" />
            {unreadCount > 0 && (
              <span className="absolute top-1.5 right-1.5 flex size-2.5 items-center justify-center rounded-full bg-red-500 ring-2 ring-white animate-pulse" />
            )}
          </button>
        }
      />
      <DropdownMenuContent
        align="end"
        sideOffset={8}
        className="w-80 sm:w-96 p-0 max-h-[480px] flex flex-col rounded-xl shadow-xl border border-slate-200 bg-white"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100 bg-slate-50/50 rounded-t-xl">
          <div className="flex items-center gap-2">
            <span className="font-semibold text-slate-900 text-sm">{t("title")}</span>
            {unreadCount > 0 && (
              <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-700">
                {unreadCount}
              </span>
            )}
          </div>
          {unreadCount > 0 && (
            <Button
              variant="ghost"
              size="sm"
              onClick={handleMarkAllRead}
              className="h-8 text-xs font-medium text-slate-600 hover:text-slate-900 hover:bg-slate-200/60 px-2"
            >
              <CheckCheckIcon className="size-3.5 me-1" />
              {t("markAllAsRead")}
            </Button>
          )}
        </div>

        {/* Content Body */}
        <div className="overflow-y-auto flex-1 max-h-[400px]">
          {loading && notifications.length === 0 ? (
            <div className="flex items-center justify-center py-8 text-slate-400">
              <Spinner size="md" />
            </div>
          ) : notifications.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-10 px-4 text-center">
              <div className="size-10 rounded-full bg-slate-100 flex items-center justify-center text-slate-400 mb-2">
                <BellOffIcon className="size-5" />
              </div>
              <p className="text-sm font-medium text-slate-700">{t("emptyState")}</p>
              <p className="text-xs text-slate-400 mt-1">{t("emptyStateDesc")}</p>
            </div>
          ) : (
            <div className="divide-y divide-slate-100">
              {notifications.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => handleMarkRead(item.id, item.is_read)}
                  className={cn(
                    "w-full text-start p-3.5 hover:bg-slate-50 transition-colors flex items-start gap-3 group relative",
                    !item.is_read && "bg-blue-50/40"
                  )}
                >
                  {!item.is_read && (
                    <span className="mt-1.5 shrink-0 size-2 rounded-full bg-blue-600" />
                  )}
                  <div className={cn("flex-1 min-w-0", item.is_read && "ps-5")}>
                    <div className="flex items-center justify-between gap-2">
                      <p className={cn("text-xs font-semibold text-slate-900 truncate", !item.is_read && "text-blue-950")}>
                        {item.title}
                      </p>
                      <span className="text-[10px] text-slate-400 shrink-0 font-normal">
                        {formatRelativeTime(item.created_at, t)}
                      </span>
                    </div>
                    <p className="text-xs text-slate-600 mt-0.5 line-clamp-2 leading-relaxed">
                      {item.message}
                    </p>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
