import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  Search,
  FileSearch,
  Calendar,
  Building2,
  DollarSign,
  MessageSquare,
  Loader2,
  Trash2,
  ExternalLink,
  Clock,
  CheckCircle,
  XCircle,
  Edit,
} from "lucide-react";
import { formatCurrency, formatDate } from "@/lib/format";
import { toast } from "sonner";

const STATUS_LABELS: Record<string, string> = {
  cho_xu_ly: "Chờ xử lý",
  dang_review: "Đang review",
  da_hoan_thanh: "Đã hoàn thành",
  yeu_cau_chinh_sua: "Yêu cầu chỉnh sửa",
  tu_choi: "Từ chối",
};

const STATUS_COLORS: Record<string, string> = {
  cho_xu_ly: "bg-muted text-muted-foreground",
  dang_review: "bg-info/10 text-info border-info/20",
  da_hoan_thanh: "bg-success/10 text-success border-success/20",
  yeu_cau_chinh_sua: "bg-warning/10 text-warning border-warning/20",
  tu_choi: "bg-destructive/10 text-destructive border-destructive/20",
};

const STATUS_TIMELINE_ICONS: Record<string, any> = {
  cho_xu_ly: Clock,
  dang_review: FileSearch,
  da_hoan_thanh: CheckCircle,
  yeu_cau_chinh_sua: Edit,
  tu_choi: XCircle,
};

const PRIORITY_LABELS: Record<string, string> = {
  cao: "🔴 Cao",
  trung_binh: "🟡 Trung bình",
  thap: "🟢 Thấp",
};

const AdminReviewRequests = () => {
  const { user, profile } = useAuth();
  const [requests, setRequests] = useState<any[]>([]);
  const [notes, setNotes] = useState<Record<string, any[]>>({});
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [selectedReq, setSelectedReq] = useState<any>(null);
  const [newNote, setNewNote] = useState("");
  const [newStatus, setNewStatus] = useState("");
  const [adminNotes, setAdminNotes] = useState("");
  const [saving, setSaving] = useState(false);

  const fetchRequests = async () => {
    const { data } = await supabase
      .from("review_requests")
      .select("*")
      .order("created_at", { ascending: false });
    if (data) {
      setRequests(data);
      const ids = data.map((r: any) => r.id);
      if (ids.length > 0) {
        const { data: notesData } = await supabase
          .from("review_notes")
          .select("*")
          .in("review_request_id", ids)
          .order("created_at", { ascending: true });
        if (notesData) {
          const grouped: Record<string, any[]> = {};
          notesData.forEach((n: any) => {
            if (!grouped[n.review_request_id]) grouped[n.review_request_id] = [];
            grouped[n.review_request_id].push(n);
          });
          setNotes(grouped);
        }
      }
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchRequests();
    // Realtime subscription
    const channel = supabase
      .channel("review-requests-admin")
      .on("postgres_changes", { event: "*", schema: "public", table: "review_requests" }, () => fetchRequests())
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, []);

  const filtered = requests.filter((req) => {
    const matchSearch = search === "" ||
      req.contract_title.toLowerCase().includes(search.toLowerCase()) ||
      req.partner_name?.toLowerCase().includes(search.toLowerCase()) ||
      req.requester_name?.toLowerCase().includes(search.toLowerCase());
    const matchStatus = statusFilter === "all" || req.status === statusFilter;
    return matchSearch && matchStatus;
  });

  const openDetail = (req: any) => {
    setSelectedReq(req);
    setNewStatus(req.status);
    setAdminNotes(req.admin_notes || "");
    setNewNote("");
  };

  const handleSave = async () => {
    if (!selectedReq || !user) return;
    setSaving(true);
    const oldStatus = selectedReq.status;

    await supabase
      .from("review_requests")
      .update({ status: newStatus as any, admin_notes: adminNotes })
      .eq("id", selectedReq.id);

    if (newNote.trim()) {
      await supabase.from("review_notes").insert({
        review_request_id: selectedReq.id,
        author_id: user.id,
        author_name: profile?.full_name || user.email || "Pháp chế",
        content: newNote.trim(),
      });
    }

    // Send email notification if status changed
    if (oldStatus !== newStatus) {
      try {
        await supabase.functions.invoke("send-notification-email", {
          body: {
            requestId: selectedReq.id,
            contractTitle: selectedReq.contract_title,
            newStatus: STATUS_LABELS[newStatus] || newStatus,
            updatedBy: profile?.full_name || user.email,
            requesterEmail: null, // Will be looked up by edge function
            requesterId: selectedReq.requester_id,
          },
        });
      } catch (e) {
        // Email is best-effort, don't block the save
        console.warn("Email notification failed:", e);
      }
    }

    setSaving(false);
    setSelectedReq(null);
    toast.success("Đã cập nhật yêu cầu review");
    fetchRequests();
  };

  const handleDelete = async (reqId: string) => {
    const { error } = await supabase.from("review_requests").delete().eq("id", reqId);
    if (error) {
      toast.error("Lỗi xóa", { description: error.message });
    } else {
      toast.success("Đã xóa yêu cầu");
      fetchRequests();
    }
  };

  const statusCounts = requests.reduce((acc: Record<string, number>, r) => {
    acc[r.status] = (acc[r.status] || 0) + 1;
    return acc;
  }, {});

  if (loading) {
    return <div className="flex items-center justify-center h-64"><Loader2 className="h-8 w-8 animate-spin text-accent" /></div>;
  }

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Quản lý yêu cầu review</h1>
        <p className="text-muted-foreground">Xem và xử lý các yêu cầu review hợp đồng</p>
      </div>

      {/* Status Summary */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
        {Object.entries(STATUS_LABELS).map(([key, label]) => (
          <Card key={key} className={`border shadow-sm cursor-pointer transition-all hover:shadow-md ${statusFilter === key ? "ring-2 ring-accent" : ""}`} onClick={() => setStatusFilter(statusFilter === key ? "all" : key)}>
            <CardContent className="p-3 text-center">
              <p className="text-2xl font-bold">{statusCounts[key] || 0}</p>
              <p className="text-xs text-muted-foreground mt-1">{label}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Search */}
      <Card className="border-none shadow-sm">
        <CardContent className="p-4">
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input placeholder="Tìm theo tên hợp đồng, đối tác, người yêu cầu..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-full sm:w-48"><SelectValue placeholder="Trạng thái" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tất cả trạng thái</SelectItem>
                {Object.entries(STATUS_LABELS).map(([key, label]) => (
                  <SelectItem key={key} value={key}>{label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Cards */}
      <div className="space-y-4">
        {filtered.map((req, i) => (
          <Card key={req.id} className="border shadow-sm hover:shadow-md transition-all animate-slide-up" style={{ animationDelay: `${i * 80}ms`, animationFillMode: "backwards" }}>
            <CardHeader className="pb-3">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="flex items-start gap-3">
                  <div className="p-2 rounded-lg bg-info/10 shrink-0 mt-0.5">
                    <FileSearch className="h-4 w-4 text-info" />
                  </div>
                  <div>
                    <CardTitle className="text-base font-semibold">{req.contract_title}</CardTitle>
                    <p className="text-sm text-muted-foreground mt-0.5">
                      Yêu cầu bởi <span className="font-medium text-foreground">{req.requester_name}</span> — {req.department}
                    </p>
                    <p className="text-xs text-muted-foreground">Ưu tiên: {PRIORITY_LABELS[req.priority] || req.priority}</p>
                  </div>
                </div>
                <Badge className={STATUS_COLORS[req.status] || ""}>{STATUS_LABELS[req.status] || req.status}</Badge>
              </div>
            </CardHeader>
            <CardContent className="pt-0 space-y-4">
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 p-3 rounded-lg bg-muted/40">
                <div className="flex items-center gap-2">
                  <Building2 className="h-4 w-4 text-muted-foreground shrink-0" />
                  <div><p className="text-xs text-muted-foreground">Đối tác</p><p className="text-sm font-medium">{req.partner_name || "—"}</p></div>
                </div>
                <div className="flex items-center gap-2">
                  <DollarSign className="h-4 w-4 text-muted-foreground shrink-0" />
                  <div><p className="text-xs text-muted-foreground">Giá trị</p><p className="text-sm font-medium">{req.contract_value > 0 ? formatCurrency(req.contract_value) : "—"}</p></div>
                </div>
                <div className="flex items-center gap-2">
                  <Calendar className="h-4 w-4 text-muted-foreground shrink-0" />
                  <div><p className="text-xs text-muted-foreground">Thời hạn HĐ</p><p className="text-sm font-medium">{req.contract_start_date && req.contract_end_date ? `${formatDate(req.contract_start_date)} - ${formatDate(req.contract_end_date)}` : "—"}</p></div>
                </div>
                <div className="flex items-center gap-2">
                  <Calendar className="h-4 w-4 text-muted-foreground shrink-0" />
                  <div><p className="text-xs text-muted-foreground">Ngày gửi</p><p className="text-sm font-medium">{formatDate(req.created_at)}</p></div>
                </div>
              </div>

              {/* Description */}
              {req.description && (
                <div className="p-3 rounded-lg bg-muted/30 text-sm">
                  <p className="text-xs font-medium text-muted-foreground mb-1">Mô tả:</p>
                  <p>{req.description}</p>
                </div>
              )}

              {/* File link */}
              {req.file_url && (
                <a href={req.file_url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-sm text-accent hover:underline">
                  <ExternalLink className="h-3.5 w-3.5" />
                  Xem tài liệu đính kèm
                </a>
              )}

              {/* Notes / Timeline */}
              {notes[req.id] && notes[req.id].length > 0 && (
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <MessageSquare className="h-4 w-4 text-muted-foreground" />
                    <p className="text-sm font-medium">Lịch sử xử lý ({notes[req.id].length})</p>
                  </div>
                  <div className="space-y-2 pl-6 border-l-2 border-muted ml-2">
                    {notes[req.id].map((note: any) => (
                      <div key={note.id} className="p-3 rounded-lg bg-card border text-sm relative">
                        <div className="absolute -left-[1.65rem] top-3 w-3 h-3 rounded-full bg-accent border-2 border-background" />
                        <div className="flex items-center justify-between mb-1">
                          <span className="font-medium text-xs">{note.author_name}</span>
                          <span className="text-xs text-muted-foreground">{formatDate(note.created_at)}</span>
                        </div>
                        <p className="text-muted-foreground">{note.content}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <Separator />
              <div className="flex items-center justify-between">
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button variant="ghost" size="sm" className="text-xs text-destructive hover:text-destructive">
                      <Trash2 className="h-3.5 w-3.5 mr-1" />
                      Xóa
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Xác nhận xóa?</AlertDialogTitle>
                      <AlertDialogDescription>Yêu cầu review "{req.contract_title}" sẽ bị xóa vĩnh viễn.</AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Hủy</AlertDialogCancel>
                      <AlertDialogAction onClick={() => handleDelete(req.id)} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">Xóa</AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
                <Button size="sm" className="text-xs bg-accent hover:bg-accent/90 text-accent-foreground" onClick={() => openDetail(req)}>
                  Xử lý yêu cầu
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {filtered.length === 0 && (
        <div className="text-center py-12">
          <FileSearch className="h-12 w-12 text-muted-foreground/30 mx-auto mb-4" />
          <p className="text-muted-foreground font-medium">Không có yêu cầu review nào</p>
        </div>
      )}

      {/* Detail Dialog */}
      <Dialog open={!!selectedReq} onOpenChange={(open) => !open && setSelectedReq(null)}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Xử lý: {selectedReq?.contract_title}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Cập nhật trạng thái</label>
              <Select value={newStatus} onValueChange={setNewStatus}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {Object.entries(STATUS_LABELS).map(([key, label]) => (
                    <SelectItem key={key} value={key}>{label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Nhận xét pháp chế</label>
              <Textarea value={adminNotes} onChange={(e) => setAdminNotes(e.target.value)} placeholder="Nhận xét tổng quan cho người yêu cầu..." rows={3} />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Thêm ghi chú mới</label>
              <Textarea value={newNote} onChange={(e) => setNewNote(e.target.value)} placeholder="Ghi chú chi tiết..." rows={2} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setSelectedReq(null)}>Hủy</Button>
            <Button className="bg-accent hover:bg-accent/90 text-accent-foreground" onClick={handleSave} disabled={saving}>
              {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Lưu thay đổi
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default AdminReviewRequests;
