import { useState, useEffect, useCallback, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

export interface Notification {
  id: string;
  user_id: string;
  title: string;
  content: string;
  review_request_id: string | null;
  is_read: boolean;
  created_at: string;
}

type NotificationSyncEvent =
  | { type: "mark_read"; id: string }
  | { type: "mark_all_read" };

const NOTIFICATION_SYNC_EVENT = "notifications-sync";

const emitNotificationSync = (payload: NotificationSyncEvent) => {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent<NotificationSyncEvent>(NOTIFICATION_SYNC_EVENT, { detail: payload }));
};

export function useNotifications() {
  const { user } = useAuth();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const instanceId = useRef(Math.random().toString(36).slice(2, 8));

  const unreadCount = notifications.filter((n) => !n.is_read).length;

  const fetchNotifications = useCallback(async () => {
    if (!user) return;
    const { data } = await supabase
      .from("notifications")
      .select("*")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false });
    if (data) setNotifications(data as any);
    setLoading(false);
  }, [user]);

  useEffect(() => {
    fetchNotifications();
    if (!user) return;

    const channel = supabase
      .channel("notifications-" + user.id + "-" + instanceId.current)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "notifications", filter: `user_id=eq.${user.id}` },
        (payload) => {
          setNotifications((prev) => [payload.new as Notification, ...prev]);
        }
      )
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "notifications", filter: `user_id=eq.${user.id}` },
        (payload) => {
          const updated = payload.new as Notification;
          setNotifications((prev) =>
            prev.map((n) => (n.id === updated.id ? updated : n))
          );
        }
      )
      .on(
        "postgres_changes",
        { event: "DELETE", schema: "public", table: "notifications", filter: `user_id=eq.${user.id}` },
        (payload) => {
          const deletedId = (payload.old as any)?.id;
          if (deletedId) {
            setNotifications((prev) => prev.filter((n) => n.id !== deletedId));
          }
        }
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [user, fetchNotifications]);

  useEffect(() => {
    if (typeof window === "undefined") return;

    const handleSync = (event: Event) => {
      const { detail } = event as CustomEvent<NotificationSyncEvent>;
      if (!detail) return;

      if (detail.type === "mark_read") {
        setNotifications((prev) =>
          prev.map((n) => (n.id === detail.id && !n.is_read ? { ...n, is_read: true } : n))
        );
        return;
      }

      setNotifications((prev) => prev.map((n) => (n.is_read ? n : { ...n, is_read: true })));
    };

    window.addEventListener(NOTIFICATION_SYNC_EVENT, handleSync as EventListener);
    return () => window.removeEventListener(NOTIFICATION_SYNC_EVENT, handleSync as EventListener);
  }, []);

  const markAsRead = (id: string) => {
    const target = notifications.find((n) => n.id === id);
    if (!target || target.is_read) return;

    setNotifications((prev) => prev.map((n) => (n.id === id ? { ...n, is_read: true } : n)));
    emitNotificationSync({ type: "mark_read", id });
    void supabase.from("notifications").update({ is_read: true } as any).eq("id", id);
  };

  const markAllAsRead = () => {
    if (!user) return;
    if (!notifications.some((n) => !n.is_read)) return;

    setNotifications((prev) => prev.map((n) => ({ ...n, is_read: true })));
    emitNotificationSync({ type: "mark_all_read" });
    void supabase
      .from("notifications")
      .update({ is_read: true } as any)
      .eq("user_id", user.id)
      .eq("is_read", false);
  };

  return { notifications, unreadCount, loading, markAsRead, markAllAsRead };
}
