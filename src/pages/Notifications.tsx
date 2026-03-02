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
        return null;
    };

    return (
        <div className="w-full max-w-5xl mx-auto py-8 px-4 animate-fade-in">
            <div className="flex items-start justify-between mb-8">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight text-slate-900 mb-2">Thông báo</h1>
                    <p className="text-slate-600 font-medium">{unreadCount} thông báo chưa đọc</p>
                </div>

                {unreadCount > 0 && (
                    <Button variant="outline" onClick={markAllAsRead} className="shadow-sm font-medium">
                        <CheckCheck className="w-4 h-4 mr-2 text-slate-600" />
                        Đánh dấu tất cả đã đọc
                    </Button>
                )}
            </div>

            {notifications.length === 0 ? (
                <div className="text-center text-slate-500 py-16 bg-white rounded-xl border border-slate-200 shadow-sm">
                    <Bell className="w-12 h-12 text-slate-300 mx-auto mb-4" />
                    <p className="text-lg font-medium">Không có thông báo nào</p>
                    <p className="text-sm mt-1">Khi có cập nhật mới, thông báo sẽ xuất hiện tại đây.</p>
                </div>
            ) : (
                <div className="bg-white rounded-xl border shadow-sm overflow-hidden border-slate-200 shadow-slate-200/50">
                    {notifications.map((n) => (
                        <div
                            key={n.id}
                            className={`p-5 sm:p-6 flex gap-4 cursor-pointer transition-colors border-b last:border-b-0 border-slate-100 ${!n.is_read ? "bg-slate-50/80 hover:bg-slate-100/80" : "bg-white hover:bg-slate-50"
                                }`}
                            onClick={() => handleClick(n)}
                        >
                            <div className="mt-0.5 shrink-0">
                                {!n.is_read ? (
                                    <Mail className="w-6 h-6 text-slate-500" />
                                ) : (
                                    <MailOpen className="w-6 h-6 text-slate-400" />
                                )}
                            </div>

                            <div className="flex-1 min-w-0">
                                <div className="flex flex-col sm:flex-row sm:justify-between sm:items-start gap-2 sm:gap-4 mb-2">
                                    <h3 className="font-semibold text-slate-800 text-base leading-tight">
                                        {n.title}
                                    </h3>
                                    <div className="flex justify-between sm:flex-col items-center sm:items-end gap-1.5 shrink-0 text-right w-full sm:w-auto mt-2 sm:mt-0">
                                        <span className="text-xs font-medium text-slate-500 order-2 sm:order-1">
                                            {formatTime(n.created_at)}
                                        </span>
                                        {!n.is_read && (
                                            <Badge className="bg-[#0ea5e9] hover:bg-[#0ea5e9]/90 text-white text-[10px] px-2 py-0 h-5 font-medium border-none rounded-full shadow-sm order-1 sm:order-2">
                                                Mới
                                            </Badge>
                                        )}
                                    </div>
                                </div>

                                <p className="text-sm text-slate-600 leading-relaxed pr-0 sm:pr-8">
                                    {n.content}
                                </p>

                                {getBadge(n.title, n.content)}
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}
