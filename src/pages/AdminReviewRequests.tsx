import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";
import { Label } from "@/components/ui/label";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { formatCurrency, formatDate } from "@/lib/format";
import { toast } from "sonner";
import { DepartmentReviewTracker } from "@/components/common/DepartmentReviewTracker";
import {
  type ReviewDepartment,
  type DepartmentReviewStatus,
  REVIEW_DEPARTMENTS,
  DEPARTMENT_REVIEW_STATUS_LABELS,
  extractDeptReviews,
  encodeDeptReview,
  decodeDeptReview,
  getReviewProgress,
  getCurrentStep,
  getNextStatus,
  WORKFLOW_STATUSES,
} from "@/types/reviewDepartments";

const STATUS_LABELS: Record<string, string> = {
  cho_xu_ly: "Chờ xử lý",
  cho_quan_ly: "Chờ Quản lý xác nhận",
  cho_phap_che: "Chờ Pháp chế review",
  cho_ke_toan: "Chờ Kế toán review",
  cho_tai_chinh: "Chờ Tài chính review",
  hoan_tat: "Hoàn tất",
  dang_review: "Đang review",
  da_hoan_thanh: "Đã hoàn thành",
  yeu_cau_chinh_sua: "Yêu cầu chỉnh sửa",
  tu_choi: "Từ chối",
};

const STATUS_COLORS: Record<string, string> = {
  cho_xu_ly: "bg-muted text-muted-foreground",
  cho_quan_ly: "bg-muted text-muted-foreground",
  cho_phap_che: "bg-info/10 text-info border-info/20",
  cho_ke_toan: "bg-info/10 text-info border-info/20",
  cho_tai_chinh: "bg-info/10 text-info border-info/20",
  hoan_tat: "bg-success/10 text-success border-success/20",
  dang_review: "bg-info/10 text-info border-info/20",
  da_hoan_thanh: "bg-success/10 text-success border-success/20",
  yeu_cau_chinh_sua: "bg-warning/10 text-warning border-warning/20",
  tu_choi: "bg-destructive/10 text-destructive border-destructive/20",
};

const isValidGoogleDocUrl = (url: string): boolean => {
  if (!url) return false;
  return /^https:\/\/docs\.google\.com\/(document|spreadsheets|presentation)\/d\//.test(url);
};

const AdminReviewRequests = () => {
  const { user, profile, role, roles, managerDepartment } = useAuth();
  const isAdmin = role === "admin";
  const isManager = role === "manager";
  const isAccountant = role === "accountant";
  const isFinance = role === "finance";

  // Determine which status this role can act on
  const getMyActionableStatus = (): string | null => {
    if (isAdmin) return null; // admin can act on any
    if (isManager) return "cho_quan_ly";
    if (isAccountant) return "cho_ke_toan";
    if (isFinance) return "cho_tai_chinh";
    return null;
  };

  const [requests, setRequests] = useState<any[]>([]);
  const [notes, setNotes] = useState<Record<string, any[]>>({});
  const [paymentSchedules, setPaymentSchedules] = useState<Record<string, any[]>>({});
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [selectedReq, setSelectedReq] = useState<any>(null);
  const [newNote, setNewNote] = useState("");
  const [adminNotes, setAdminNotes] = useState("");
  const [legalReviewDocLink, setLegalReviewDocLink] = useState("");
  const [saving, setSaving] = useState(false);

  const fetchRequests = async () => {
    let query = supabase
      .from("review_requests")
      .select("*")
      .order("created_at", { ascending: false });

    // Manager only sees requests from their department
    if (isManager && !isAdmin && managerDepartment) {
      query = query.eq("department", managerDepartment);
    }

    const { data } = await query;
    if (data) {
      setRequests(data);
      const ids = data.map((r: any) => r.id);
      if (ids.length > 0) {
        const [notesRes, paymentsRes] = await Promise.all([
          supabase.from("review_notes").select("*").in("review_request_id", ids).order("created_at", { ascending: true }),
          supabase.from("payment_schedules").select("*").in("review_request_id", ids).order("created_at", { ascending: true }),
        ]);
        if (notesRes.data) {
          const grouped: Record<string, any[]> = {};
          notesRes.data.forEach((n: any) => {
            if (!grouped[n.review_request_id]) grouped[n.review_request_id] = [];
            grouped[n.review_request_id].push(n);
          });
          setNotes(grouped);
        }
        if (paymentsRes.data) {
          const grouped: Record<string, any[]> = {};
          paymentsRes.data.forEach((p: any) => {
            if (!grouped[p.review_request_id]) grouped[p.review_request_id] = [];
            grouped[p.review_request_id].push(p);
          });
          setPaymentSchedules(grouped);
        }
      }
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchRequests();
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
      req.requester_name?.toLowerCase().includes(search.toLowerCase()) ||
      req.department?.toLowerCase().includes(search.toLowerCase()) ||
      req.tax_code?.toLowerCase().includes(search.toLowerCase());
    const matchStatus = statusFilter === "all" || req.status === statusFilter;
    return matchSearch && matchStatus;
  });

  const openDetail = (req: any) => {
    setSelectedReq(req);
    setAdminNotes(req.admin_notes || "");
    setLegalReviewDocLink(req.legal_review_doc_link || "");
    setNewNote("");
  };

  // Approve current step and advance workflow
  const handleApproveStep = async () => {
    if (!selectedReq || !user) return;
    setSaving(true);

    const currentStatus = selectedReq.status;
    const nextStatus = getNextStatus(currentStatus);
    const stepDept = getCurrentStep(currentStatus);

    // Save department review note
    if (stepDept) {
      const encodedContent = encodeDeptReview(stepDept, "approved", newNote || "Đã duyệt");
      await supabase.from("review_notes").insert({
        review_request_id: selectedReq.id,
        author_id: user.id,
        author_name: profile?.full_name || user.email || "",
        content: encodedContent,
      });
    }

    // Build update
    const updateData: any = { status: nextStatus as any };

    // Admin (Legal) can set legal_review_doc_link
    if (isAdmin && legalReviewDocLink && currentStatus === "cho_phap_che") {
      updateData.legal_review_doc_link = legalReviewDocLink;
    }

    if (adminNotes) {
      updateData.admin_notes = adminNotes;
    }

    const { error } = await supabase.from("review_requests").update(updateData).eq("id", selectedReq.id);
    
    if (error) {
      toast.error("Lỗi cập nhật", { description: error.message });
      setSaving(false);
      return;
    }

    // Audit log
    await supabase.from("edit_logs").insert({
      editor_id: user.id,
      editor_name: profile?.full_name || user.email || "",
      record_id: selectedReq.id,
      table_name: "review_requests",
      changes: { field: "status", old: currentStatus, new: nextStatus, action: "approve" },
    } as any);

    // Save regular note
    if (newNote.trim()) {
      await supabase.from("review_notes").insert({
        review_request_id: selectedReq.id,
        author_id: user.id,
        author_name: profile?.full_name || user.email || "",
        content: newNote.trim(),
      });
    }

    // Send email notification
    try {
      await supabase.functions.invoke("send-notification-email", {
        body: {
          requestId: selectedReq.id,
          contractTitle: selectedReq.contract_title,
          newStatus: STATUS_LABELS[nextStatus] || nextStatus,
          updatedBy: profile?.full_name || user.email,
          requesterId: selectedReq.requester_id,
        },
      });
    } catch (e) {
      console.warn("Email notification failed:", e);
    }

    setSaving(false);
    setSelectedReq(null);
    toast.success(`Đã duyệt và chuyển sang: ${STATUS_LABELS[nextStatus] || nextStatus}`);
    fetchRequests();
  };

  const handleReject = async () => {
    if (!selectedReq || !user) return;
    setSaving(true);

    const currentStatus = selectedReq.status;
    const stepDept = getCurrentStep(currentStatus);

    if (stepDept) {
      const encodedContent = encodeDeptReview(stepDept, "rejected", newNote || "Từ chối");
      await supabase.from("review_notes").insert({
        review_request_id: selectedReq.id,
        author_id: user.id,
        author_name: profile?.full_name || user.email || "",
        content: encodedContent,
      });
    }

    const { error } = await supabase.from("review_requests").update({
      status: "tu_choi" as any,
      admin_notes: adminNotes,
    } as any).eq("id", selectedReq.id);

    if (error) {
      toast.error("Lỗi cập nhật", { description: error.message });
      setSaving(false);
      return;
    }

    // Audit log
    await supabase.from("edit_logs").insert({
      editor_id: user.id,
      editor_name: profile?.full_name || user.email || "",
      record_id: selectedReq.id,
      table_name: "review_requests",
      changes: { field: "status", old: currentStatus, new: "tu_choi", action: "reject" },
    } as any);

    if (newNote.trim()) {
      await supabase.from("review_notes").insert({
        review_request_id: selectedReq.id,
        author_id: user.id,
        author_name: profile?.full_name || user.email || "",
        content: newNote.trim(),
      });
    }

    try {
      await supabase.functions.invoke("send-notification-email", {
        body: {
          requestId: selectedReq.id,
          contractTitle: selectedReq.contract_title,
          newStatus: "Từ chối",
          updatedBy: profile?.full_name || user.email,
          requesterId: selectedReq.requester_id,
        },
      });
    } catch (e) { console.warn(e); }

    setSaving(false);
    setSelectedReq(null);
    toast.success("Đã từ chối yêu cầu");
    fetchRequests();
  };

  const handleDelete = async (reqId: string) => {
    const { error } = await supabase.from("review_requests").delete().eq("id", reqId);
    if (error) toast.error("Lỗi xóa", { description: error.message });
    else { toast.success("Đã xóa yêu cầu"); fetchRequests(); }
  };

  // Can this user act on this request?
  const canActOnRequest = (req: any): boolean => {
    if (!req) return false;
    if (isAdmin) return true;
    const actionableStatus = getMyActionableStatus();
    return req.status === actionableStatus;
  };

  const statusCounts = requests.reduce((acc: Record<string, number>, r) => {
    acc[r.status] = (acc[r.status] || 0) + 1;
    return acc;
  }, {});

  if (loading) {
    return <div className="flex items-center justify-center h-64"><p className="text-muted-foreground">Đang tải...</p></div>;
  }

  const roleLabel = isAdmin ? "Pháp chế" : isManager ? "Quản lý" : isAccountant ? "Kế toán" : isFinance ? "Tài chính" : "";

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">
          {isAdmin ? "Quản lý yêu cầu review" : `Yêu cầu review — ${roleLabel}`}
        </h1>
        <p className="text-muted-foreground">
          {isAdmin ? "Xem và xử lý các yêu cầu review hợp đồng" : `Duyệt các yêu cầu ở bước ${roleLabel}`}
        </p>
      </div>

      {/* Workflow Status Summary */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
        {Object.entries(WORKFLOW_STATUSES).map(([key, ws]) => (
          <Card key={key} className={`border shadow-sm cursor-pointer transition-all hover:shadow-md ${statusFilter === key ? "ring-2 ring-accent" : ""}`} onClick={() => setStatusFilter(statusFilter === key ? "all" : key)}>
            <CardContent className="p-3 text-center">
              <p className="text-2xl font-bold">{statusCounts[key] || 0}</p>
              <p className="text-xs text-muted-foreground mt-1">{ws.label}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Search */}
      <Card className="border-none shadow-sm">
        <CardContent className="p-4">
          <div className="flex flex-col sm:flex-row gap-3">
            <Input placeholder="Tìm theo tên hợp đồng, đối tác, phòng ban, MST..." value={search} onChange={(e) => setSearch(e.target.value)} className="flex-1" />
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-full sm:w-48"><SelectValue placeholder="Trạng thái" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tất cả</SelectItem>
                {Object.entries(STATUS_LABELS).map(([key, label]) => (
                  <SelectItem key={key} value={key}>{label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Request Cards */}
      <div className="space-y-4">
        {filtered.map((req, i) => {
          const deptReviews = extractDeptReviews(notes[req.id] || []);
          const reqNotes = (notes[req.id] || []).filter((n: any) => !decodeDeptReview(n.content));
          const reqPayments = paymentSchedules[req.id] || [];
          const canAct = canActOnRequest(req);

          return (
            <Card key={req.id} className="border shadow-sm hover:shadow-md transition-all animate-slide-up" style={{ animationDelay: `${i * 80}ms`, animationFillMode: "backwards" }}>
              <CardHeader className="pb-3">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div>
                    <CardTitle className="text-base font-semibold">{req.contract_title}</CardTitle>
                    <p className="text-sm text-muted-foreground mt-0.5">
                      Yêu cầu bởi <span className="font-medium text-foreground">{req.requester_name}</span> — {req.department}
                      {req.contract_type_category && <> — {req.contract_type_category}</>}
                      {req.tax_code && <> — MST: {req.tax_code}</>}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <DepartmentReviewTracker deptReviews={deptReviews} compact />
                    <Badge className={STATUS_COLORS[req.status] || ""}>{STATUS_LABELS[req.status] || req.status}</Badge>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="pt-0 space-y-4">
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 p-3 rounded-lg bg-muted/40">
                  <div>
                    <p className="text-xs text-muted-foreground">Đối tác</p>
                    <p className="text-sm font-medium">{req.partner_name || "—"}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Giá trị</p>
                    <p className="text-sm font-medium">{req.contract_value > 0 ? formatCurrency(req.contract_value) : "N/A"}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Thời hạn HĐ</p>
                    <p className="text-sm font-medium">{req.contract_start_date && req.contract_end_date ? `${formatDate(req.contract_start_date)} - ${formatDate(req.contract_end_date)}` : "—"}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Hạn review</p>
                    <p className="text-sm font-medium">{req.review_deadline ? formatDate(req.review_deadline) : "—"}</p>
                  </div>
                </div>

                {/* Payment Schedule */}
                {reqPayments.length > 0 && (
                  <div className="p-3 rounded-lg bg-muted/30 space-y-2">
                    <p className="text-xs font-medium text-muted-foreground">Đợt thanh toán</p>
                    <div className="space-y-1">
                      {reqPayments.map((ps: any) => (
                        <div key={ps.id} className="flex items-center justify-between text-sm">
                          <span className="font-medium">{ps.phase_name}</span>
                          <span>{ps.payment_amount > 0 ? formatCurrency(ps.payment_amount) : "N/A"} — {ps.payment_due_date ? formatDate(ps.payment_due_date) : "—"}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                <DepartmentReviewTracker deptReviews={deptReviews} />

                {/* File links */}
                <div className="space-y-1">
                  {isAdmin && (
                    <>
                      {req.file_url && (
                        <button
                          onClick={async () => {
                            const url = req.file_url as string;
                            if (url.includes("/storage/v1/object/public/contracts/")) {
                              const path = url.substring(url.indexOf("/storage/v1/object/public/contracts/") + "/storage/v1/object/public/contracts/".length);
                              const { data } = await supabase.storage.from("contracts").createSignedUrl(path, 3600);
                              if (data) window.open(data.signedUrl, "_blank");
                              else toast.error("Không thể mở file");
                            } else {
                              window.open(url, "_blank");
                            }
                          }}
                          className="inline-flex items-center gap-1 text-sm text-accent hover:underline"
                        >
                          Xem tài liệu ban đầu
                        </button>
                      )}
                      {req.legal_review_doc_link && (
                        <a href={req.legal_review_doc_link} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-sm text-accent hover:underline">
                          Xem tài liệu đã review (Pháp chế)
                        </a>
                      )}
                    </>
                  )}
                  {(isAccountant || isFinance) && (
                    <>
                      {req.legal_review_doc_link ? (
                        <a href={req.legal_review_doc_link} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-sm text-accent hover:underline">
                          Xem tài liệu review
                        </a>
                      ) : (
                        <p className="text-xs text-muted-foreground italic">Pháp chế chưa upload tài liệu review</p>
                      )}
                    </>
                  )}
                  {isManager && req.file_url && (
                    <button
                      onClick={async () => {
                        const url = req.file_url as string;
                        if (url.includes("/storage/v1/object/public/contracts/")) {
                          const path = url.substring(url.indexOf("/storage/v1/object/public/contracts/") + "/storage/v1/object/public/contracts/".length);
                          const { data } = await supabase.storage.from("contracts").createSignedUrl(path, 3600);
                          if (data) window.open(data.signedUrl, "_blank");
                          else toast.error("Không thể mở file");
                        } else {
                          window.open(url, "_blank");
                        }
                      }}
                      className="inline-flex items-center gap-1 text-sm text-accent hover:underline"
                    >
                      Xem tài liệu
                    </button>
                  )}
                </div>

                <Separator />
                <div className="flex items-center justify-between">
                  {isAdmin && (
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button variant="ghost" size="sm" className="text-xs text-destructive hover:text-destructive">Xóa</Button>
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
                  )}
                  <div className="flex gap-2 ml-auto">
                    {canAct && (
                      <Button size="sm" className="text-xs bg-accent hover:bg-accent/90 text-accent-foreground" onClick={() => openDetail(req)}>
                        Duyệt
                      </Button>
                    )}
                    {!canAct && (
                      <Button size="sm" className="text-xs" variant="outline" onClick={() => openDetail(req)}>
                        Xem chi tiết
                      </Button>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {filtered.length === 0 && (
        <div className="text-center py-12">
          <p className="text-muted-foreground font-medium">Không có yêu cầu review nào</p>
        </div>
      )}

      {/* Detail / Approve Dialog */}
      <Dialog open={!!selectedReq} onOpenChange={(open) => !open && setSelectedReq(null)}>
        <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {canActOnRequest(selectedReq) ? "Duyệt" : "Chi tiết"}: {selectedReq?.contract_title}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-6 py-4">
            {/* Current workflow step */}
            <div className="p-4 rounded-lg bg-muted/30 border">
              <p className="text-sm font-medium mb-2">Trạng thái hiện tại</p>
              <Badge className={`${STATUS_COLORS[selectedReq?.status] || ""} text-sm px-3 py-1`}>
                {STATUS_LABELS[selectedReq?.status] || selectedReq?.status}
              </Badge>
            </div>

            {selectedReq && (
              <DepartmentReviewTracker deptReviews={extractDeptReviews(notes[selectedReq.id] || [])} />
            )}

            <Separator />

            {/* Legal Review Doc Link - only for admin at legal review step */}
            {isAdmin && selectedReq?.status === "cho_phap_che" && (
              <div className="space-y-2">
                <Label>Link Google Doc review (Pháp chế)</Label>
                <Input
                  type="url"
                  value={legalReviewDocLink}
                  onChange={(e) => setLegalReviewDocLink(e.target.value)}
                  placeholder="https://docs.google.com/document/d/..."
                  className={legalReviewDocLink && !isValidGoogleDocUrl(legalReviewDocLink) ? "border-destructive focus-visible:ring-destructive" : ""}
                />
                <p className="text-xs text-muted-foreground">
                  Upload link Google Doc đã review. Link này sẽ được gửi cho Kế toán và Tài chính.
                </p>
              </div>
            )}

            {/* Admin notes */}
            {isAdmin && (
              <div className="space-y-2">
                <Label>Nhận xét pháp chế</Label>
                <Textarea value={adminNotes} onChange={(e) => setAdminNotes(e.target.value)} placeholder="Nhận xét tổng quan..." rows={3} />
              </div>
            )}

            {canActOnRequest(selectedReq) && (
              <div className="space-y-2">
                <Label>Ghi chú</Label>
                <Textarea value={newNote} onChange={(e) => setNewNote(e.target.value)} placeholder="Ghi chú khi duyệt/từ chối..." rows={2} />
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setSelectedReq(null)}>Đóng</Button>
            {canActOnRequest(selectedReq) && (
              <>
                <Button variant="destructive" onClick={handleReject} disabled={saving}>
                  {saving ? "Đang xử lý..." : "Từ chối"}
                </Button>
                <Button className="bg-accent hover:bg-accent/90 text-accent-foreground" onClick={handleApproveStep} disabled={saving}>
                  {saving ? "Đang xử lý..." : "Duyệt & chuyển bước tiếp"}
                </Button>
              </>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default AdminReviewRequests;
