import { useState, useRef, useEffect } from "react";
import { Bell } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { SidebarMenuButton, SidebarMenuBadge } from "@/components/ui/sidebar";
import { useNotifications } from "@/hooks/useNotifications";
import { useNavigate } from "react-router-dom";

export function NotificationBell() {
  const { notifications, unreadCount, markAsRead, markAllAsRead } = useNotifications();
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();

  const handleClick = (n: any) => {
    markAsRead(n.id);
    if (n.review_request_id) {
      navigate("/yeu-cau-review");
    }
    setOpen(false);
  };

  const formatTime = (date: string) => {
    const d = new Date(date);
    const day = String(d.getDate()).padStart(2, "0");
    const month = String(d.getMonth() + 1).padStart(2, "0");
    const year = d.getFullYear();
    const hours = String(d.getHours()).padStart(2, "0");
    const minutes = String(d.getMinutes()).padStart(2, "0");
    return `${hours}:${minutes} - ${day}/${month}/${year}`;
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <SidebarMenuButton tooltip="Thông báo">
          <Bell className="w-4 h-4 mr-2" />
          <span>Thông báo</span>
        </SidebarMenuButton>
      </PopoverTrigger>
      {unreadCount > 0 && (
        <SidebarMenuBadge className="bg-destructive text-destructive-foreground flex h-5 min-w-5 items-center justify-center rounded-full p-0 px-1 text-[10px]">
          {unreadCount > 9 ? "9+" : unreadCount}
        </SidebarMenuBadge>
      )}
      {unreadCount > 0 && (
        <div className="pointer-events-none absolute left-3 top-1 flex h-3 min-w-3 items-center justify-center rounded-full bg-destructive text-[8px] font-medium text-destructive-foreground opacity-0 group-data-[collapsible=icon]:opacity-100">
          {unreadCount > 9 ? "9+" : unreadCount}
        </div>
      )}

      <PopoverContent className="w-80 sm:w-96 p-0" side="right" align="start" sideOffset={16}>
        <div className="flex items-center justify-between p-3 border-b">
          <span className="font-semibold text-sm">Thông báo</span>
          {unreadCount > 0 && (
            <Button variant="ghost" size="sm" className="text-xs h-7" onClick={markAllAsRead}>
              Đánh dấu tất cả đã đọc
            </Button>
          )}
        </div>
        <ScrollArea className="max-h-80">
          {notifications.length === 0 ? (
            <div className="p-6 text-center text-sm text-muted-foreground">Không có thông báo</div>
          ) : (
            notifications.map((n) => (
              <div
                key={n.id}
                className={`p-3 cursor-pointer hover:bg-muted/50 transition-colors border-b last:border-b-0 ${!n.is_read ? "bg-accent/5" : ""}`}
                onClick={() => handleClick(n)}
              >
                <div className="flex items-start gap-2">
                  {!n.is_read && <div className="w-2 h-2 rounded-full bg-accent mt-1.5 shrink-0" />}
                  <div className={`flex-1 ${n.is_read ? "ml-4" : ""}`}>
                    <p className={`text-sm leading-tight ${!n.is_read ? "font-medium" : ""}`}>{n.title}</p>
                    <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{n.content}</p>
                    <p className="text-[11px] text-muted-foreground/70 mt-1">{formatTime(n.created_at)}</p>
                  </div>
                </div>
              </div>
            ))
          )}
        </ScrollArea>
      </PopoverContent>
    </Popover>
  );
}
