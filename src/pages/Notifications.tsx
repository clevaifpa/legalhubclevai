import { useState, useEffect } from "react";
import { Bell, Mail, MailOpen, CheckCheck, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useNotifications } from "@/hooks/useNotifications";
import { useNavigate } from "react-router-dom";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";

export default function Notifications() {
    const { notifications, unreadCount, markAsRead, markAllAsRead, deleteNotification, deleteAllNotifications } = useNotifications();
    const { role } = useAuth();
    const { toast } = useToast();
    const navigate = useNavigate();

    const [deadlines, setDeadlines] = useState<Record<string, string>>({});
    const [validRequestIds, setValidRequestIds] = useState<Set<string>>(new Set());
    const [deadlinesLoaded, setDeadlinesLoaded] = useState(false);

    useEffect(() => {
        const fetchDeadlines = async () => {
            const requestIds = new Set<string>();
            notifications.forEach(n => {
                const reqMatch = n.content.match(/<!--REQUEST_ID:(.*?)-->/);
                const id = n.review_request_id || (reqMatch ? reqMatch[1] : null);
                if (id) requestIds.add(id);
            });

            if (requestIds.size === 0) {
                setDeadlinesLoaded(true);
                return;
            }

            const { data } = await supabase
                .from("review_requests")
                .select("id, review_deadline")
                .in("id", Array.from(requestIds));

            if (data) {
                const dMap: Record<string, string> = {};
                const validIds = new Set<string>();
                data.forEach((r: any) => {
                    validIds.add(r.id);
                    if (r.review_deadline) dMap[r.id] = r.review_deadline;
                });
                setDeadlines(dMap);
                setValidRequestIds(validIds);
            }
            setDeadlinesLoaded(true);
        };

        if (notifications.length > 0) {
            fetchDeadlines();
        } else {
            setDeadlinesLoaded(true);
        }
    }, [notifications]);

    const handleClick = (n: any) => {
        markAsRead(n.id);

        // Find embedded REQUEST_ID
        const reqMatch = n.content.match(/<!--REQUEST_ID:(.*?)-->/);
        let targetId = n.review_request_id || (reqMatch ? reqMatch[1] : null);

        if (targetId) {
            const hash = n.content.includes("SCROLL:internal-chat") ? "#internal-chat" : "";
            // Normal users go to Dashboard, others go to AdminReviewRequests
            if (!role || role === "user") {
                navigate(`/request/${targetId}${hash}`);
            } else {
                navigate(`/admin-request/${targetId}${hash}`);
            }
            return;
        }

        // Find embedded CONTRACT_ID
        const contractMatch = n.content.match(/<!--CONTRACT_ID:(.*?)-->/);
        const categoryMatch = n.content.match(/<!--CATEGORY_ID:(.*?)-->/);

        if (contractMatch) {
            navigate(`/contract/${contractMatch[1]}`);
            return;
        }

        // Fallback for older notifications without embedded IDs
        if (n.title?.includes("Hợp đồng mới") || n.content?.includes("Tên hợp đồng")) {
            navigate("/tong-hop-dong");
            return;
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

    /** Render content with line breaks preserved, strip hidden markers */
    const renderContent = (content: string, reqId: string | null) => {
        // Remove legacy "Thời gian:" and "Hạn review:"
        let cleanContent = content
            .replace(/\n?• Thời gian:.*?(?=\n|$)/g, '')
            .replace(/\n?• Hạn review:.*?(?=\n|$)/g, '')
            .replace(/\n?<!--.*?-->/g, '')
            .trim();

        const lines = cleanContent.split("\n").filter(l => l.trim().length > 0);

        // Formats date without time
        const formatOnlyDate = (date: string) => {
            const d = new Date(date);
            const day = String(d.getDate()).padStart(2, "0");
            const month = String(d.getMonth() + 1).padStart(2, "0");
            const year = d.getFullYear();
            return `${day}/${month}/${year}`;
        };

        // Dynamically inject updated deadline
        if (reqId && deadlines[reqId]) {
            lines.push(`• Hạn review: ${formatOnlyDate(deadlines[reqId])}`);
        }

        return lines.map((line, i) => (
            <span key={i}>
                {line}
                {i < lines.length - 1 && <br />}
            </span>
        ));
    };

    if (!deadlinesLoaded) {
        return (
            <div className="flex items-center justify-center p-12">
                <p className="text-muted-foreground animate-pulse">Đang tải thông báo...</p>
            </div>
        );
    }

    const visibleNotifications = notifications.filter(n => {
        const reqMatch = n.content.match(/<!--REQUEST_ID:(.*?)-->/);
        const reqId = n.review_request_id || (reqMatch ? reqMatch[1] : null);
        if (reqId) {
            return validRequestIds.has(reqId);
        }
        return true;
    });

    const visibleUnreadCount = visibleNotifications.filter(n => !n.is_read).length;

    return (
        <div className="w-full max-w-5xl mx-auto py-8 px-4 animate-fade-in">
            <div className="flex items-start justify-between mb-8">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight text-foreground mb-2">Thông báo</h1>
                    <p className="text-muted-foreground font-medium">{visibleUnreadCount} thông báo chưa đọc</p>
                </div>

                <div className="flex gap-2">
                    {visibleNotifications.length > 0 && (
                        <Button
                            variant="outline"
                            onClick={async () => {
                                const ok = await deleteAllNotifications();
                                toast({
                                    title: ok ? "Đã xóa tất cả thông báo" : "Xóa thông báo thất bại",
                                    variant: ok ? "default" : "destructive",
                                });
                            }}
                            className="shadow-sm font-medium text-destructive hover:text-destructive"
                        >
                            <Trash2 className="w-4 h-4 mr-2" />
                            Xóa tất cả
                        </Button>
                    )}
                    {visibleUnreadCount > 0 && (
                        <Button variant="outline" onClick={markAllAsRead} className="shadow-sm font-medium">
                            <CheckCheck className="w-4 h-4 mr-2" />
                            Đánh dấu tất cả đã đọc
                        </Button>
                    )}
                </div>
            </div>

            {visibleNotifications.length === 0 ? (
                <div className="text-center text-muted-foreground py-16 bg-card rounded-xl border shadow-sm">
                    <Bell className="w-12 h-12 text-muted-foreground/40 mx-auto mb-4" />
                    <p className="text-lg font-medium">Không có thông báo nào</p>
                    <p className="text-sm mt-1">Khi có cập nhật mới, thông báo sẽ xuất hiện tại đây.</p>
                </div>
            ) : (
                <div className="bg-card rounded-xl border shadow-sm overflow-hidden">
                    {visibleNotifications.map((n) => {
                        const reqMatch = n.content.match(/<!--REQUEST_ID:(.*?)-->/);
                        const reqId = n.review_request_id || (reqMatch ? reqMatch[1] : null);

                        return (
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
                                        {renderContent(n.content, reqId)}
                                    </div>

                                    {getBadge(n.title, n.content)}
                                </div>

                                <button
                                    type="button"
                                    className="mt-0.5 shrink-0 p-1.5 rounded-md text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
                                    title="Xóa thông báo"
                                    onClick={async (e) => {
                                        e.preventDefault();
                                        e.stopPropagation();
                                        const ok = await deleteNotification(n.id);
                                        toast({
                                            title: ok ? "Đã xóa thông báo" : "Xóa thông báo thất bại",
                                            variant: ok ? "default" : "destructive",
                                        });
                                    }}
                                >
                                    <Trash2 className="w-4 h-4" />
                                </button>
                            </div>
                        )
                    })}
                </div>
            )}
        </div>
    );
}
