import { useState } from "react";
import { Bell, Mail, MailOpen, CheckCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
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
    const now = new Date();
    const diffTime = now.getTime() - d.getTime();
    const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));

    if (diffDays > 0 && diffDays <= 3) {
      return `${diffDays} ngày trước`;
    }

    const day = String(d.getDate()).padStart(2, "0");
    const month = String(d.getMonth() + 1).padStart(2, "0");
    const year = d.getFullYear();
    const hours = String(d.getHours()).padStart(2, "0");
    const minutes = String(d.getMinutes()).padStart(2, "0");
    return `${day}/${month}/${year} ${hours}:${minutes}`;
  };

  const getBadge = (title: string, content: string) => {
    const text = (title + " " + content).toLowerCase();
    if (text.includes("từ chối") || text.includes("hủy") || text.includes("thất bại")) {
      return <Badge className="mt-2 bg-red-50 text-red-600 hover:bg-red-50 border-red-200 shadow-none font-medium">Từ chối</Badge>;
    }
    if (text.includes("duyệt") || text.includes("thành công") || text.includes("hoàn tất") || text.includes("đồng ý")) {
      return <Badge className="mt-2 bg-green-50 text-green-600 hover:bg-green-50 border-green-200 shadow-none font-medium">Thành công</Badge>;
    }
    return null;
  };

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <SidebarMenuButton tooltip="Thông báo">
          <Bell className="w-4 h-4 mr-2" />
          <span>Thông báo</span>
        </SidebarMenuButton>
      </SheetTrigger>
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

      <SheetContent className="w-full sm:max-w-3xl p-0 bg-slate-50 flex flex-col h-full border-l [&>button]:hidden" side="right">
        <div className="p-6 border-b bg-white flex-shrink-0">
          <div className="flex items-start justify-between">
            <div>
              <h2 className="text-2xl font-bold text-slate-900">Thông báo</h2>
              <p className="text-slate-600 font-medium mt-1">{unreadCount} thông báo chưa đọc</p>
            </div>
            {unreadCount > 0 && (
              <Button variant="outline" onClick={markAllAsRead} className="shadow-sm font-medium">
                <CheckCheck className="w-4 h-4 mr-2 text-slate-600" />
                Đánh dấu tất cả đã đọc
              </Button>
            )}
          </div>
        </div>

        <ScrollArea className="flex-1 p-6">
          {notifications.length === 0 ? (
            <div className="text-center text-slate-500 py-12 bg-white rounded-lg border shadow-sm">
              Không có thông báo nào
            </div>
          ) : (
            <div className="bg-white rounded-lg border shadow-sm overflow-hidden border-slate-200 mb-6">
              {notifications.map((n) => (
                <div
                  key={n.id}
                  className={`p-5 flex gap-4 cursor-pointer transition-colors border-b last:border-b-0 border-slate-100 ${!n.is_read ? "bg-slate-50/80 hover:bg-slate-100/80" : "bg-white hover:bg-slate-50"
                    }`}
                  onClick={() => handleClick(n)}
                >
                  <div className="mt-0.5 shrink-0">
                    {!n.is_read ? (
                      <Mail className="w-5 h-5 text-slate-500" />
                    ) : (
                      <MailOpen className="w-5 h-5 text-slate-400" />
                    )}
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex justify-between items-start gap-4 mb-1">
                      <h3 className="font-semibold text-slate-800 text-base leading-tight">
                        {n.title}
                      </h3>
                      <div className="flex flex-col items-end gap-1.5 shrink-0 text-right">
                        <span className="text-xs font-medium text-slate-500">
                          {formatTime(n.created_at)}
                        </span>
                        {!n.is_read && (
                          <Badge className="bg-[#0ea5e9] hover:bg-[#0ea5e9]/90 text-white text-[10px] px-2 py-0 h-5 font-medium border-none rounded-full shadow-sm">
                            Mới
                          </Badge>
                        )}
                      </div>
                    </div>

                    <p className="text-sm text-slate-600 leading-relaxed pr-8">
                      {n.content}
                    </p>

                    {getBadge(n.title, n.content)}
                  </div>
                </div>
              ))}
            </div>
          )}
        </ScrollArea>
      </SheetContent>
    </Sheet>
  );
}
