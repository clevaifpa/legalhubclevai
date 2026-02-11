import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Plus,
  FileSearch,
  Clock,
  CheckCircle,
  AlertCircle,
  Calendar,
  Building2,
  DollarSign,
  Loader2,
  MessageSquare,
} from "lucide-react";
import { formatCurrency, formatDate } from "@/lib/format";
import { toast } from "sonner";

const PRIORITY_LABELS: Record<string, string> = {
  cao: "Cao",
  trung_binh: "Trung bình",
  thap: "Thấp",
};

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

const UserDashboard = () => {
  const { user, profile } = useAuth();
  const [requests, setRequests] = useState<any[]>([]);
  const [notes, setNotes] = useState<Record<string, any[]>>({});
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Form state
  const [form, setForm] = useState({
    priority: "trung_binh",
    contract_title: "",
    partner_name: "",
    contract_value: "",
    request_deadline: "",
    contract_start_date: "",
    contract_end_date: "",
    review_deadline: "",
    description: "",
  });

  const fetchRequests = async () => {
    if (!user) return;
    const { data } = await supabase
      .from("review_requests")
      .select("*")
      .eq("requester_id", user.id)
      .order("created_at", { ascending: false });
    if (data) {
      setRequests(data);
      // Fetch notes for all requests
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
  }, [user]);

  const handleSubmit = async () => {
    if (!user || !profile) return;
    setSubmitting(true);
    const { error } = await supabase.from("review_requests").insert({
      requester_id: user.id,
      requester_name: profile.full_name || user.email || "",
      department: profile.department || "",
      priority: form.priority as any,
      contract_title: form.contract_title,
      partner_name: form.partner_name,
      contract_value: parseInt(form.contract_value) || 0,
      request_deadline: form.request_deadline,
      contract_start_date: form.contract_start_date || null,
      contract_end_date: form.contract_end_date || null,
      review_deadline: form.review_deadline || null,
      description: form.description,
    });
    setSubmitting(false);
    if (error) {
      toast.error("Lỗi tạo yêu cầu", { description: error.message });
    } else {
      toast.success("Yêu cầu review đã được tạo!");
      setDialogOpen(false);
      setForm({
        priority: "trung_binh",
        contract_title: "",
        partner_name: "",
        contract_value: "",
        request_deadline: "",
        contract_start_date: "",
        contract_end_date: "",
        review_deadline: "",
        description: "",
      });
      fetchRequests();
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-accent" />
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Yêu cầu review hợp đồng</h1>
          <p className="text-muted-foreground">
            Tạo và theo dõi yêu cầu review hợp đồng của bạn
          </p>
        </div>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button className="bg-accent hover:bg-accent/90 text-accent-foreground shrink-0">
              <Plus className="h-4 w-4 mr-2" />
              Tạo yêu cầu mới
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Tạo yêu cầu review hợp đồng</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label>Mức độ ưu tiên *</Label>
                <Select value={form.priority} onValueChange={(v) => setForm({ ...form, priority: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="cao">🔴 Cao</SelectItem>
                    <SelectItem value="trung_binh">🟡 Trung bình</SelectItem>
                    <SelectItem value="thap">🟢 Thấp</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Tên hợp đồng *</Label>
                <Input value={form.contract_title} onChange={(e) => setForm({ ...form, contract_title: e.target.value })} placeholder="VD: Hợp đồng mua bán thiết bị" required />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Tên đối tác</Label>
                  <Input value={form.partner_name} onChange={(e) => setForm({ ...form, partner_name: e.target.value })} placeholder="Tên công ty đối tác" />
                </div>
                <div className="space-y-2">
                  <Label>Giá trị hợp đồng (VNĐ)</Label>
                  <Input type="number" value={form.contract_value} onChange={(e) => setForm({ ...form, contract_value: e.target.value })} placeholder="0" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Thời hạn yêu cầu *</Label>
                  <Input type="date" value={form.request_deadline} onChange={(e) => setForm({ ...form, request_deadline: e.target.value })} required />
                </div>
                <div className="space-y-2">
                  <Label>Hạn review</Label>
                  <Input type="date" value={form.review_deadline} onChange={(e) => setForm({ ...form, review_deadline: e.target.value })} />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Ngày bắt đầu HĐ</Label>
                  <Input type="date" value={form.contract_start_date} onChange={(e) => setForm({ ...form, contract_start_date: e.target.value })} />
                </div>
                <div className="space-y-2">
                  <Label>Ngày kết thúc HĐ</Label>
                  <Input type="date" value={form.contract_end_date} onChange={(e) => setForm({ ...form, contract_end_date: e.target.value })} />
                </div>
              </div>
              <div className="space-y-2">
                <Label>Mô tả chi tiết</Label>
                <Textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="Mô tả thêm về hợp đồng cần review..." rows={3} />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setDialogOpen(false)}>Hủy</Button>
              <Button className="bg-accent hover:bg-accent/90 text-accent-foreground" onClick={handleSubmit} disabled={submitting || !form.contract_title || !form.request_deadline}>
                {submitting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                Gửi yêu cầu
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: "Chờ xử lý", status: "cho_xu_ly", icon: Clock },
          { label: "Đang review", status: "dang_review", icon: FileSearch },
          { label: "Hoàn thành", status: "da_hoan_thanh", icon: CheckCircle },
          { label: "Cần chỉnh sửa", status: "yeu_cau_chinh_sua", icon: AlertCircle },
        ].map((item) => (
          <Card key={item.status} className="border shadow-sm">
            <CardContent className="p-3 text-center">
              <item.icon className="h-5 w-5 mx-auto mb-1 text-muted-foreground" />
              <p className="text-2xl font-bold">{requests.filter((r) => r.status === item.status).length}</p>
              <p className="text-xs text-muted-foreground mt-1">{item.label}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Request List */}
      <div className="space-y-4">
        {requests.map((req, i) => (
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
                      Ưu tiên: <span className="font-medium">{PRIORITY_LABELS[req.priority] || req.priority}</span>
                    </p>
                  </div>
                </div>
                <Badge className={STATUS_COLORS[req.status] || ""}>{STATUS_LABELS[req.status] || req.status}</Badge>
              </div>
            </CardHeader>
            <CardContent className="pt-0 space-y-4">
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 p-3 rounded-lg bg-muted/40">
                <div className="flex items-center gap-2">
                  <Building2 className="h-4 w-4 text-muted-foreground shrink-0" />
                  <div>
                    <p className="text-xs text-muted-foreground">Đối tác</p>
                    <p className="text-sm font-medium">{req.partner_name || "—"}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <DollarSign className="h-4 w-4 text-muted-foreground shrink-0" />
                  <div>
                    <p className="text-xs text-muted-foreground">Giá trị</p>
                    <p className="text-sm font-medium">{req.contract_value > 0 ? formatCurrency(req.contract_value) : "—"}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Calendar className="h-4 w-4 text-muted-foreground shrink-0" />
                  <div>
                    <p className="text-xs text-muted-foreground">Hạn yêu cầu</p>
                    <p className="text-sm font-medium">{formatDate(req.request_deadline)}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Calendar className="h-4 w-4 text-muted-foreground shrink-0" />
                  <div>
                    <p className="text-xs text-muted-foreground">Ngày gửi</p>
                    <p className="text-sm font-medium">{formatDate(req.created_at)}</p>
                  </div>
                </div>
              </div>

              {/* Admin notes */}
              {req.admin_notes && (
                <div className="p-3 rounded-lg bg-accent/5 border border-accent/20">
                  <p className="text-xs font-medium text-accent mb-1">📋 Nhận xét pháp chế</p>
                  <p className="text-sm">{req.admin_notes}</p>
                </div>
              )}

              {/* Review notes */}
              {notes[req.id] && notes[req.id].length > 0 && (
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <MessageSquare className="h-4 w-4 text-muted-foreground" />
                    <p className="text-sm font-medium">Ghi chú ({notes[req.id].length})</p>
                  </div>
                  <div className="space-y-2 pl-6">
                    {notes[req.id].map((note: any) => (
                      <div key={note.id} className="p-3 rounded-lg bg-card border text-sm">
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
            </CardContent>
          </Card>
        ))}
      </div>

      {requests.length === 0 && (
        <div className="text-center py-12">
          <FileSearch className="h-12 w-12 text-muted-foreground/30 mx-auto mb-4" />
          <p className="text-muted-foreground font-medium">Chưa có yêu cầu review nào</p>
          <p className="text-sm text-muted-foreground/70 mt-1">Nhấn "Tạo yêu cầu mới" để bắt đầu</p>
        </div>
      )}
    </div>
  );
};

export default UserDashboard;
