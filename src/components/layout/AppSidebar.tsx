import React from "react";
import { NavLink } from "@/components/NavLink";
import { useAuth } from "@/hooks/useAuth";
import { NotificationBell } from "@/components/NotificationBell";
import {
  LayoutDashboard,
  BookOpen,
  Files,
  FileCheck,
  Bot,
  Users,
  FileText
} from "lucide-react";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarHeader,
} from "@/components/ui/sidebar";

const adminMenuItems = [
  { title: "Tổng quan", url: "/", icon: LayoutDashboard },
  { title: "Kho điều khoản", url: "/dieu-khoan", icon: BookOpen },
  { title: "Tổng hợp đồng", url: "/tong-hop-dong", icon: Files },
  { title: "Yêu cầu review", url: "/yeu-cau-review", icon: FileCheck },
  { title: "AI Kiểm tra", url: "/ai-kiem-tra", icon: Bot },
];

const advancedMenuItems = [
  { title: "Quản lý nhân viên", url: "/quan-ly-nhan-vien", icon: Users },
];

const reviewerMenuItems = [
  { title: "Tổng quan", url: "/", icon: LayoutDashboard },
  { title: "Tổng hợp đồng", url: "/tong-hop-dong", icon: Files },
  { title: "Yêu cầu review", url: "/yeu-cau-review", icon: FileCheck },
  { title: "AI Kiểm tra", url: "/ai-kiem-tra", icon: Bot },
];

const userMenuItems = [
  { title: "Yêu cầu của tôi", url: "/", icon: FileText },
  { title: "AI Kiểm tra", url: "/ai-kiem-tra", icon: Bot },
];

export function AppSidebar() {
  const { role } = useAuth();
  const isAdmin = role === "admin";
  const isReviewer = role === "manager" || role === "accountant" || role === "finance";

  const getMenuItems = () => {
    if (isAdmin) return adminMenuItems;
    if (isReviewer) return reviewerMenuItems;
    return userMenuItems;
  };

  const getRoleLabel = () => {
    if (isAdmin) return "Admin";
    if (role === "manager") return "Người quản lý";
    if (role === "accountant") return "Kế toán";
    if (role === "finance") return "Tài chính";
    return "Nhân viên";
  };

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader className="border-b border-sidebar-border px-3 py-4">
        <div className="flex items-center justify-between gap-2 w-full">
          <div className="flex items-center gap-3 overflow-hidden">
            <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-sidebar-primary shrink-0">
              <span className="text-sidebar-primary-foreground font-bold text-sm">L</span>
            </div>
            <div className="flex flex-col overflow-hidden group-data-[collapsible=icon]:hidden">
              <span className="font-bold text-sidebar-accent-foreground text-sm leading-tight truncate">
                LegalHub
              </span>
              <span className="text-[11px] text-sidebar-foreground/60 leading-tight truncate">
                {getRoleLabel()}
              </span>
            </div>
          </div>
        </div>
      </SidebarHeader>

      <SidebarContent className="pt-2">
        <SidebarGroup>
          <SidebarGroupLabel className="uppercase text-xs font-semibold tracking-wider text-muted-foreground">{isAdmin ? "ĐIỀU HƯỚNG" : "MENU"}</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {getMenuItems().map((item, index) => (
                <React.Fragment key={item.title}>
                  <SidebarMenuItem>
                    <SidebarMenuButton asChild tooltip={item.title}>
                      <NavLink
                        to={item.url}
                        end={item.url === "/"}
                        activeClassName="bg-sidebar-accent text-sidebar-accent-foreground font-medium"
                      >
                        <item.icon className="w-4 h-4 mr-2" />
                        <span>{item.title}</span>
                      </NavLink>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                  {index === 0 && (
                    <SidebarMenuItem>
                      <NotificationBell />
                    </SidebarMenuItem>
                  )}
                </React.Fragment>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        {isAdmin && (
          <SidebarGroup>
            <SidebarGroupLabel className="uppercase text-xs font-semibold tracking-wider text-muted-foreground">NÂNG CAO</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {advancedMenuItems.map((item) => (
                  <SidebarMenuItem key={item.title}>
                    <SidebarMenuButton asChild tooltip={item.title}>
                      <NavLink
                        to={item.url}
                        activeClassName="bg-sidebar-accent text-sidebar-accent-foreground font-medium"
                      >
                        <item.icon className="w-4 h-4 mr-2" />
                        <span>{item.title}</span>
                      </NavLink>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                ))}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        )}
      </SidebarContent>
    </Sidebar>
  );
}
