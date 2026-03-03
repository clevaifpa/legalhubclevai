import { Bell, Mail, MailOpen, CheckCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useNotifications } from "@/hooks/useNotifications";
import { useNavigate } from "react-router-dom";

export default function Notifications() {
    const { notifications, unreadCount, markAsRead, markAllAsRead } = useNotifications();
    const navigate = useNavigate();

    const handleClick = (n: any) => {
        markAsRead(n.id);
        if (n.review_request_id) {
            navigate("/yeu-cau-review");
        }
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
            return <Badge className="mt-2 text-xs bg-red-50 text-red-600 hover:bg-red-50 border border-red-200 shadow-none font-medium px-2 py-0.5">Từ chối</Badge>;
        }
        if (text.includes("duyệt") || text.includes("thành công") || text.includes("hoàn tất") || text.includes("đồng ý")) {
            return <Badge className="mt-2 text-xs bg-green-50 text-green-600 hover:bg-green-50 border border-green-200 shadow-none font-medium px-2 py-0.5">Thành công</Badge>;
        }
        if (text.includes("upload") || text.includes("tải lên")) {
            return <Badge className="mt-2 text-xs bg-blue-50 text-blue-600 hover:bg-blue-50 border border-blue-200 shadow-none font-medium px-2 py-0.5">Upload mới</Badge>;
        }
        if (text.includes("yêu cầu review") || text.includes("review mới")) {
            return <Badge className="mt-2 text-xs bg-amber-50 text-amber-600 hover:bg-amber-50 border border-amber-200 shadow-none font-medium px-2 py-0.5">Review mới</Badge>;
        }
        if (text.includes("trạng thái") || text.includes("→")) {
            return <Badge className="mt-2 text-xs bg-purple-50 text-purple-600 hover:bg-purple-50 border border-purple-200 shadow-none font-medium px-2 py-0.5">Đổi trạng thái</Badge>;
        }
        return null;
    };

    /** Render content with line breaks preserved */
    const renderContent = (content: string) => {
        return content.split("\n").map((line, i) => (
            <span key={i}>
                {line}
                {i < content.split("\n").length - 1 && <br />}
            </span>
        ));
    };

    return (
        <div className="w-full max-w-5xl mx-auto py-8 px-4 animate-fade-in">
            <div className="flex items-start justify-between mb-8">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight text-foreground mb-2">Thông báo</h1>
                    <p className="text-muted-foreground font-medium">{unreadCount} thông báo chưa đọc</p>
                </div>

                {unreadCount > 0 && (
                    <Button variant="outline" onClick={markAllAsRead} className="shadow-sm font-medium">
                        <CheckCheck className="w-4 h-4 mr-2" />
                        Đánh dấu tất cả đã đọc
                    </Button>
                )}
            </div>

            {notifications.length === 0 ? (
                <div className="text-center text-muted-foreground py-16 bg-card rounded-xl border shadow-sm">
                    <Bell className="w-12 h-12 text-muted-foreground/40 mx-auto mb-4" />
                    <p className="text-lg font-medium">Không có thông báo nào</p>
                    <p className="text-sm mt-1">Khi có cập nhật mới, thông báo sẽ xuất hiện tại đây.</p>
                </div>
            ) : (
                <div className="bg-card rounded-xl border shadow-sm overflow-hidden">
                    {notifications.map((n) => (
                        <div
                            key={n.id}
                            className={`p-5 sm:p-6 flex gap-4 cursor-pointer transition-colors border-b last:border-b-0 ${!n.is_read ? "bg-accent/50 hover:bg-accent/70" : "bg-card hover:bg-accent/30"
                                }`}
                            onClick={() => handleClick(n)}
                        >
                            <div className="mt-0.5 shrink-0">
                                {!n.is_read ? (
                                    <Mail className="w-6 h-6 text-primary" />
                                ) : (
                                    <MailOpen className="w-6 h-6 text-muted-foreground" />
                                )}
                            </div>

                            <div className="flex-1 min-w-0">
                                <div className="flex flex-col sm:flex-row sm:justify-between sm:items-start gap-2 sm:gap-4 mb-2">
                                    <h3 className="font-semibold text-foreground text-base leading-tight">
                                        {n.title}
                                    </h3>
                                    <div className="flex justify-between sm:flex-col items-center sm:items-end gap-1.5 shrink-0 text-right w-full sm:w-auto mt-2 sm:mt-0">
                                        <span className="text-xs font-medium text-muted-foreground order-2 sm:order-1">
                                            {formatTime(n.created_at)}
                                        </span>
                                        {!n.is_read && (
                                            <Badge className="bg-primary hover:bg-primary/90 text-primary-foreground text-[10px] px-2 py-0 h-5 font-medium border-none rounded-full shadow-sm order-1 sm:order-2">
                                                Mới
                                            </Badge>
                                        )}
                                    </div>
                                </div>

                                <div className="text-sm text-muted-foreground leading-relaxed pr-0 sm:pr-8">
                                    {renderContent(n.content)}
                                </div>

                                {getBadge(n.title, n.content)}
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}
