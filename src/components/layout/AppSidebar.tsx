import {
  LayoutDashboard,
  BookOpen,
  FolderArchive,
  FileSearch,
  Brain,
  Scale,
} from "lucide-react";
import { NavLink } from "@/components/NavLink";
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

const mainMenuItems = [
  { title: "Tổng quan", url: "/", icon: LayoutDashboard },
  { title: "Kho điều khoản", url: "/dieu-khoan", icon: BookOpen },
  { title: "Kho hợp đồng", url: "/hop-dong", icon: FolderArchive },
  { title: "Yêu cầu review", url: "/yeu-cau-review", icon: FileSearch },
];

const advancedMenuItems = [
  { title: "AI Kiểm tra", url: "/ai-kiem-tra", icon: Brain },
];

export function AppSidebar() {
  return (
    <Sidebar collapsible="icon">
      <SidebarHeader className="border-b border-sidebar-border px-3 py-4">
        <div className="flex items-center gap-3">
          <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-sidebar-primary shrink-0">
            <Scale className="h-4 w-4 text-sidebar-primary-foreground" />
          </div>
          <div className="flex flex-col overflow-hidden group-data-[collapsible=icon]:hidden">
            <span className="font-bold text-sidebar-accent-foreground text-sm leading-tight truncate">
              LegalHub
            </span>
            <span className="text-[11px] text-sidebar-foreground/60 leading-tight truncate">
              Quản lý pháp chế
            </span>
          </div>
        </div>
      </SidebarHeader>

      <SidebarContent className="pt-2">
        <SidebarGroup>
          <SidebarGroupLabel>Điều hướng</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {mainMenuItems.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton asChild tooltip={item.title}>
                    <NavLink
                      to={item.url}
                      end={item.url === "/"}
                      activeClassName="bg-sidebar-accent text-sidebar-accent-foreground font-medium"
                    >
                      <item.icon className="h-4 w-4" />
                      <span>{item.title}</span>
                    </NavLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        <SidebarGroup>
          <SidebarGroupLabel>Nâng cao</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {advancedMenuItems.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton asChild tooltip={item.title}>
                    <NavLink
                      to={item.url}
                      activeClassName="bg-sidebar-accent text-sidebar-accent-foreground font-medium"
                    >
                      <item.icon className="h-4 w-4" />
                      <span>{item.title}</span>
                    </NavLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
    </Sidebar>
  );
}
