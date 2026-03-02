import { Bell } from "lucide-react";
import { SidebarMenuButton, SidebarMenuBadge } from "@/components/ui/sidebar";
import { useNotifications } from "@/hooks/useNotifications";
import { NavLink } from "@/components/NavLink";

export function NotificationBell() {
  const { unreadCount } = useNotifications();

  return (
    <SidebarMenuButton asChild tooltip="Thông báo">
      <NavLink
        to="/thong-bao"
        activeClassName="bg-sidebar-accent text-sidebar-accent-foreground font-medium"
      >
        <Bell className="w-4 h-4 mr-2" />
        <span>Thông báo</span>

        {unreadCount > 0 && (
          <SidebarMenuBadge className="bg-destructive text-destructive-foreground flex h-5 min-w-5 items-center justify-center rounded-full p-0 px-1 text-[10px] ml-auto group-data-[collapsible=icon]:hidden">
            {unreadCount > 9 ? "9+" : unreadCount}
          </SidebarMenuBadge>
        )}
        {unreadCount > 0 && (
          <div className="pointer-events-none absolute left-3 top-1 flex h-3 min-w-3 items-center justify-center rounded-full bg-destructive text-[8px] font-medium text-destructive-foreground opacity-0 group-data-[collapsible=icon]:opacity-100">
            {unreadCount > 9 ? "9+" : unreadCount}
          </div>
        )}
      </NavLink>
    </SidebarMenuButton>
  );
}
