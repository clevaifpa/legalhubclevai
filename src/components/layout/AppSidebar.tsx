import { NavLink } from "@/components/NavLink";
import { useAuth } from "@/hooks/useAuth";
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
  { title: "Tổng quan", url: "/" },
  { title: "Kho điều khoản", url: "/dieu-khoan" },
  { title: "Tổng hợp đồng", url: "/tong-hop-dong" },
  { title: "Yêu cầu review", url: "/yeu-cau-review" },
];

const advancedMenuItems = [
  { title: "AI Kiểm tra", url: "/ai-kiem-tra" },
  { title: "Quản lý người duyệt", url: "/quan-ly-nguoi-duyet" },
];

const userMenuItems = [
  { title: "Yêu cầu của tôi", url: "/" },
];

const reviewerMenuItems = [
  { title: "Yêu cầu review", url: "/" },
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

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader className="border-b border-sidebar-border px-3 py-4">
        <div className="flex items-center gap-3">
          <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-sidebar-primary shrink-0">
            <span className="text-sidebar-primary-foreground font-bold text-sm">L</span>
          </div>
          <div className="flex flex-col overflow-hidden group-data-[collapsible=icon]:hidden">
            <span className="font-bold text-sidebar-accent-foreground text-sm leading-tight truncate">
              LegalHub
            </span>
            <span className="text-[11px] text-sidebar-foreground/60 leading-tight truncate">
              {isAdmin ? "Pháp chế" : isReviewer ? role === "manager" ? "Quản lý" : role === "accountant" ? "Kế toán" : "Tài chính" : "Nhân viên"}
            </span>
          </div>
        </div>
      </SidebarHeader>

      <SidebarContent className="pt-2">
        <SidebarGroup>
          <SidebarGroupLabel>{isAdmin ? "Điều hướng" : "Menu"}</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {getMenuItems().map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton asChild tooltip={item.title}>
                    <NavLink
                      to={item.url}
                      end={item.url === "/"}
                      activeClassName="bg-sidebar-accent text-sidebar-accent-foreground font-medium"
                    >
                      <span>{item.title}</span>
                    </NavLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        {isAdmin && (
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
