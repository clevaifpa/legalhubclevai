import { useState, useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth, getEmployeeName } from "@/hooks/useAuth";
import { createWorkflowNotifications } from "@/lib/notifications";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter,
} from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { formatCurrency, formatDate } from "@/lib/format";
import { toast } from "sonner";
import { DepartmentReviewTracker } from "@/components/common/DepartmentReviewTracker";
import { extractDeptReviews, decodeDeptReview, WORKFLOW_STATUSES, GLOBAL_MANAGER_EMAIL } from "@/types/reviewDepartments";

const isValidGoogleDocUrl = (url: string): boolean => {
  if (!url) return false;
  return /^https:\/\/docs\.google\.com\/(document|spreadsheets|presentation)\/d\//.test(url);
};

const DEPARTMENTS = [
  { id: "LVO", name: "Khối Vận hành" },
  { id: "LVS", name: "Khối Kinh doanh" },
  { id: "LVH", name: "Khối Nhân sự" },
  { id: "LVD", name: "Khối Phát triển mới" },
  { id: "LVB", name: "Khối Back-office" },
  { id: "LVI", name: "Khối Kỹ thuật" },
];

const CONTRACT_TYPE_CATEGORIES = [
  "Hợp đồng nguyên tắc",
  "Hợp đồng sử dụng 1 lần",
  "Hợp đồng sử dụng dài hạn",
  "Hợp đồng/phụ lục gia hạn",
];

const STATUS_LABELS: Record<string, string> = {
  cho_xu_ly: "Chờ xử lý",
  cho_quan_ly: "Chờ Quản lý xác nhận",
  cho_quan_ly_chung: "Chờ Quản lý chung duyệt",
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
  cho_quan_ly_chung: "bg-info/10 text-info border-info/20",
  cho_phap_che: "bg-info/10 text-info border-info/20",
  cho_ke_toan: "bg-info/10 text-info border-info/20",
  cho_tai_chinh: "bg-info/10 text-info border-info/20",
  hoan_tat: "bg-success/10 text-success border-success/20",
  dang_review: "bg-info/10 text-info border-info/20",
  da_hoan_thanh: "bg-success/10 text-success border-success/20",
  yeu_cau_chinh_sua: "bg-warning/10 text-warning border-warning/20",
  tu_choi: "bg-destructive/10 text-destructive border-destructive/20",
};

interface PaymentPhase {
  phase_name: string;
  payment_amount: string;
  payment_due_date: string;
  is_na: boolean;
}

const UserDashboard = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const reqIdParam = searchParams.get('id');
  const { user, profile, role } = useAuth();
  const isPhapc = role === "admin"; // Pháp chế = admin role
  const isAccountant = role === "accountant";
  const isFinance = role === "finance";
  const isDirectSubmit = isPhapc || isAccountant || isFinance;
  const [requests, setRequests] = useState<any[]>([]);
  const [notes, setNotes] = useState<Record<string, any[]>>({});
  const [paymentSchedules, setPaymentSchedules] = useState<Record<string, any[]>>({});
  const [managers, setManagers] = useState<any[]>([]);
  const [globalManagers, setGlobalManagers] = useState<any[]>([]);
  const [reviewers, setReviewers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const [editingReqId, setEditingReqId] = useState<string | null>(null);

  const [form, setForm] = useState({
    priority: "trung_binh",
    contract_title: "",
    partner_name: "",
    contract_value: "",
    contract_value_na: false,
    request_deadline: "",
    contract_start_date: "",
    contract_end_date: "",
    review_deadline: "",
    description: "",
    google_doc_url: "",
    approved_pe_number: "",
    department: "",
    contract_type_category: "",
    tax_code: "",
    manager_id: "",
    global_manager_id: "",
  });

  const [paymentPhases, setPaymentPhases] = useState<PaymentPhase[]>([
    { phase_name: "Đợt 01", payment_amount: "", payment_due_date: "", is_na: false },
  ]);

  const addPaymentPhase = () => {
    const num = paymentPhases.length + 1;
    setPaymentPhases([...paymentPhases, { phase_name: `Đợt ${String(num).padStart(2, "0")}`, payment_amount: "", payment_due_date: "", is_na: false }]);
  };

  const removePaymentPhase = (idx: number) => {
    if (paymentPhases.length <= 1) return;
    setPaymentPhases(paymentPhases.filter((_, i) => i !== idx));
  };

  const updatePaymentPhase = (idx: number, field: keyof PaymentPhase, value: any) => {
    setPaymentPhases(paymentPhases.map((p, i) => i === idx ? { ...p, [field]: value } : p));
  };

  // Fetch managers filtered by department (global manager included via DB function)
  const fetchManagers = async (dept: string) => {
    if (!dept) { setManagers([]); return; }
    const { data } = await supabase.rpc("get_managers_by_department", { _department: dept } as any);
    setManagers(data || []);
  };

  const fetchReviewers = async () => {
    const { data, error } = await (supabase.rpc as any)("get_all_reviewers_with_names");
    if (!error) {
      setReviewers(data || []);
    } else {
      console.error("Error fetching reviewers:", error);
    }
  };

  useEffect(() => {
    if (form.department) fetchManagers(form.department);
  }, [form.department]);

  // Auto assign global_manager_id if there's exactly 1
  useEffect(() => {
    if (globalManagers.length === 1 && !form.global_manager_id) {
      setForm((prev) => ({ ...prev, global_manager_id: globalManagers[0].user_id }));
    }
  }, [globalManagers, form.global_manager_id]);

  // Fetch all global managers on mount
  useEffect(() => {
    const fetchGlobalManagers = async () => {
      // Bypassing strict RPC typing for the new RPC if it's not yet in types.ts
      const { data, error } = await (supabase.rpc as any)("get_users_by_roles", { _roles: ["manager_chung"] });
      if (!error && Array.isArray(data)) {
        setGlobalManagers(data);
      } else {
        console.error("Error fetching global managers:", error);
      }
    };
    fetchGlobalManagers();
    fetchReviewers();
  }, []);

  const fetchRequests = async () => {
    if (!user) return;
    const { data } = await supabase
      .from("review_requests")
      .select("*")
      .eq("requester_id", user.id)
      .order("created_at", { ascending: false });
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
      .channel("review-requests-user")
      .on("postgres_changes", { event: "*", schema: "public", table: "review_requests" }, () => fetchRequests())
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [user]);

  const handleSubmit = async () => {
    if (!user || !profile) return;

    if (!form.google_doc_url || !isValidGoogleDocUrl(form.google_doc_url)) {
      toast.error("Link Google Doc bắt buộc", { description: "Vui lòng nhập đúng link Google Docs (docs.google.com/document/d/...)" });
      return;
    }

    const invalidPhases = paymentPhases.some(p => !p.is_na && (!p.payment_amount || parseInt(p.payment_amount) <= 0));
    if (invalidPhases) {
      toast.error("Vui lòng nhập giá trị thanh toán hoặc chọn N/A cho tất cả các đợt");
      return;
    }

    const missingDates = paymentPhases.some(p => !p.payment_due_date);
    if (missingDates) {
      toast.error("Vui lòng nhập ngày thanh toán cho tất cả các đợt");
      return;
    }

    setSubmitting(true);

    const employeeName = getEmployeeName(user.email);

    let submitError = null;
    let finalReqId = editingReqId;

    if (editingReqId) {
      // Logic cập nhật (Update)
      const { error } = await supabase.from("review_requests").update({
        department: form.department,
        priority: form.priority as any,
        contract_title: form.contract_title,
        partner_name: form.partner_name,
        contract_value: form.contract_value_na ? 0 : (parseInt(form.contract_value) || 0),
        request_deadline: form.request_deadline,
        contract_start_date: form.contract_start_date || null,
        contract_end_date: form.contract_end_date || null,
        review_deadline: form.review_deadline || null,
        description: form.description,
        file_url: form.google_doc_url || null,
        approved_pe_number: form.approved_pe_number.trim() || null,
        contract_type_category: form.contract_type_category,
        tax_code: form.tax_code,
        manager_id: isDirectSubmit ? null : (form.manager_id || null),
        global_manager_id: isDirectSubmit ? (form.global_manager_id || null) : null,
      }).eq("id", editingReqId);
      submitError = error;

      if (!error) {
        // Xoá lịch thanh toán cũ
        await supabase.from("payment_schedules").delete().eq("review_request_id", editingReqId);
      }
    } else {
      // Logic tạo mới (Create)
      const initialStatus = isDirectSubmit ? "cho_quan_ly_chung" : "cho_quan_ly";
      const { data, error } = await supabase.from("review_requests").insert({
        requester_id: user.id,
        requester_name: employeeName || profile.full_name || user.email || "",
        department: form.department,
        priority: form.priority as any,
        contract_title: form.contract_title,
        partner_name: form.partner_name,
        contract_value: form.contract_value_na ? 0 : (parseInt(form.contract_value) || 0),
        request_deadline: form.request_deadline,
        contract_start_date: form.contract_start_date || null,
        contract_end_date: form.contract_end_date || null,
        review_deadline: form.review_deadline || null,
        description: form.description,
        file_url: form.google_doc_url || null,
        approved_pe_number: form.approved_pe_number.trim() || null,
        contract_type_category: form.contract_type_category,
        tax_code: form.tax_code,
        manager_id: isDirectSubmit ? null : (form.manager_id || null),
        global_manager_id: isDirectSubmit ? (form.global_manager_id || null) : null,
        status: initialStatus as any,
        admin_notes: isDirectSubmit ? "Yêu cầu tạo bởi Pháp chế/Kế toán/Tài chính — chuyển thẳng cho Quản lý chung duyệt." : null,
      }).select().single();

      submitError = error;
      if (data) finalReqId = data.id;

      // Send notifications for new request
      if (data) {
        // Auto-assign reviewers for steps with only 1 person
        const autoAssign: Record<string, string> = {};
        const roleStepMap: Record<string, string> = {
          admin: "legal_reviewer_id",
          accountant: "accountant_reviewer_id",
          finance: "finance_reviewer_id",
        };
        for (const [roleKey, col] of Object.entries(roleStepMap)) {
          const candidates = reviewers.filter(r => r.role === roleKey);
          if (candidates.length === 1) {
            autoAssign[col] = candidates[0].user_id;
          }
        }
        const managerCandidates = reviewers.filter(r => r.role === "manager");
        if (managerCandidates.length === 1) {
          autoAssign["global_manager_id"] = managerCandidates[0].user_id;
        } else if (globalManagerId) {
          autoAssign["global_manager_id"] = globalManagerId;
        }
        if (Object.keys(autoAssign).length > 0) {
          await supabase.from("review_requests").update(autoAssign as any).eq("id", data.id);
        }

        await createWorkflowNotifications({
          reviewRequestId: data.id,
          contractTitle: form.contract_title,
          oldStatus: "moi_tao",
          newStatus: initialStatus,
          actorName: employeeName || profile.full_name || "",
          requesterId: user.id,
          managerId: form.manager_id || null,
          department: form.department || profile?.department || "",
        });
      }
    }

    if (submitError) {
      toast.error(editingReqId ? "Lỗi cập nhật yêu cầu" : "Lỗi tạo yêu cầu", { description: submitError.message });
      setSubmitting(false);
      return;
    }

    if (finalReqId) {
      const schedules = paymentPhases.map(p => ({
        review_request_id: finalReqId!,
        phase_name: p.phase_name,
        payment_amount: p.is_na ? 0 : (parseInt(p.payment_amount) || 0),
        payment_due_date: p.payment_due_date,
      }));
      await supabase.from("payment_schedules").insert(schedules as any);
    }

    setSubmitting(false);
    toast.success(editingReqId ? "Cập nhật thành công!" : (isDirectSubmit ? "Yêu cầu đã tạo!" : "Yêu cầu review đã được tạo!"));
    handleResetForm();
    fetchRequests();
  };

  const resetFormData = () => {
    setEditingReqId(null);
    setForm({ priority: "trung_binh", contract_title: "", partner_name: "", contract_value: "", contract_value_na: false, request_deadline: "", contract_start_date: "", contract_end_date: "", review_deadline: "", description: "", google_doc_url: "", approved_pe_number: "", department: "", contract_type_category: "", tax_code: "", manager_id: "", global_manager_id: "" });
    setPaymentPhases([{ phase_name: "Đợt 01", payment_amount: "", payment_due_date: "", is_na: false }]);
  };

  const handleResetForm = () => {
    setDialogOpen(false);
    resetFormData();
  };

  const handleEdit = (req: any) => {
    setEditingReqId(req.id);
    let schedules = paymentSchedules[req.id] || [];

    setForm({
      priority: req.priority || "trung_binh",
      contract_title: req.contract_title || "",
      partner_name: req.partner_name || "",
      contract_value: req.contract_value ? String(req.contract_value) : "",
      contract_value_na: req.contract_value === 0,
      request_deadline: req.request_deadline || "",
      contract_start_date: req.contract_start_date || "",
      contract_end_date: req.contract_end_date || "",
      review_deadline: req.review_deadline || "",
      description: req.description || "",
      google_doc_url: req.file_url || "",
      approved_pe_number: req.approved_pe_number || "",
      department: req.department || "",
      contract_type_category: req.contract_type_category || "",
      tax_code: req.tax_code || "",
      manager_id: req.manager_id || "",
      global_manager_id: req.global_manager_id || (globalManagers.length === 1 ? globalManagers[0].user_id : ""),
    });

    if (schedules.length > 0) {
      setPaymentPhases(schedules.map((s: any) => ({
        phase_name: s.phase_name,
        payment_amount: s.payment_amount ? String(s.payment_amount) : "",
        payment_due_date: s.payment_due_date || "",
        is_na: s.payment_amount === 0
      })));
    } else {
      setPaymentPhases([{ phase_name: "Đợt 01", payment_amount: "", payment_due_date: "", is_na: false }]);
    }

    setDialogOpen(true);
  };

  const handleDelete = async (reqId: string) => {
    // Workaround: To bypass the strict validation in the SQL RPC `delete_review_request`
    // protecting states other than cho_xu_ly and cho_quan_ly without needing SQL execution.
    await supabase.from("review_requests").update({ status: "cho_xu_ly" as any }).eq("id", reqId);

    const { error } = await (supabase.rpc as any)("delete_review_request", { _req_id: reqId });
    if (error) {
      toast.error("Lỗi xóa", { description: error.message });
    } else {
      toast.success("Đã xóa yêu cầu");
      fetchRequests();
    }
  };

  if (loading) return <div className="p-8 text-center text-muted-foreground animate-pulse">Đang tải dữ liệu...</div>;

  // Helper for tracking props
  const getAssignedReviewers = (req: any) => {
    const findName = (id: string | null) => {
      if (!id) return "";
      return reviewers.find(r => r.user_id === id)?.full_name || globalManagers.find(m => m.user_id === id)?.full_name || "";
    };
    return {
      quan_ly: { id: req.manager_id || "", name: findName(req.manager_id) },
      quan_ly_chung: { id: req.global_manager_id || "", name: findName(req.global_manager_id) || "Quản lý chung" },
      phap_ly: { id: req.legal_reviewer_id || "", name: findName(req.legal_reviewer_id) },
      ke_toan: { id: req.accountant_reviewer_id || "", name: findName(req.accountant_reviewer_id) },
      tai_chinh: { id: req.finance_reviewer_id || "", name: findName(req.finance_reviewer_id) },
    };
  };

  const isFormValid = form.contract_title && form.request_deadline && form.approved_pe_number.trim() && form.partner_name.trim() && (form.contract_value_na || form.contract_value) && form.review_deadline && form.contract_start_date && form.contract_end_date && form.description.trim() && form.department && form.contract_type_category && form.tax_code.trim() && (isDirectSubmit || form.manager_id) && isValidGoogleDocUrl(form.google_doc_url) && paymentPhases.every(p => (p.is_na || (p.payment_amount && parseInt(p.payment_amount) > 0)) && p.payment_due_date);

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Yêu cầu review hợp đồng</h1>
          <p className="text-muted-foreground">
            {isPhapc
              ? "Tạo yêu cầu review (chuyển trực tiếp Kế toán & Tài chính)"
              : "Tạo và theo dõi yêu cầu review hợp đồng của bạn"}
          </p>
        </div>
        <Dialog open={dialogOpen} onOpenChange={(open) => {
          if (!open) handleResetForm();
          else setDialogOpen(true);
        }}>
          <Button className="bg-accent hover:bg-accent/90 text-accent-foreground shrink-0" onClick={() => { resetFormData(); setDialogOpen(true); }}>
            Tạo yêu cầu mới
          </Button>
          <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>{editingReqId ? "Chỉnh sửa yêu cầu review hợp đồng" : "Tạo yêu cầu review hợp đồng"}</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Phòng ban *</Label>
                  <Select value={form.department} onValueChange={(v) => setForm({ ...form, department: v, manager_id: "" })}>
                    <SelectTrigger><SelectValue placeholder="Chọn phòng ban" /></SelectTrigger>
                    <SelectContent>
                      {DEPARTMENTS.map((dept) => (
                        <SelectItem key={dept.id} value={dept.id}>{dept.id} - {dept.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Người quản lý *</Label>
                  <Select value={form.manager_id} onValueChange={(v) => setForm({ ...form, manager_id: v })}>
                    <SelectTrigger><SelectValue placeholder={managers.length === 0 ? "Chọn phòng ban trước" : "Chọn quản lý"} /></SelectTrigger>
                    <SelectContent>
                      {managers.map((m) => (
                        <SelectItem key={m.user_id} value={m.user_id}>{m.full_name || "Chưa đặt tên"}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Loại hợp đồng *</Label>
                  <Select value={form.contract_type_category} onValueChange={(v) => setForm({ ...form, contract_type_category: v })}>
                    <SelectTrigger><SelectValue placeholder="Chọn loại" /></SelectTrigger>
                    <SelectContent>
                      {CONTRACT_TYPE_CATEGORIES.map((t) => (
                        <SelectItem key={t} value={t}>{t}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Mức độ ưu tiên *</Label>
                  <Select value={form.priority} onValueChange={(v) => setForm({ ...form, priority: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="cao">Cao</SelectItem>
                      <SelectItem value="trung_binh">Trung bình</SelectItem>
                      <SelectItem value="thap">Thấp</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="space-y-2">
                <Label>Tên hợp đồng *</Label>
                <Input value={form.contract_title} onChange={(e) => setForm({ ...form, contract_title: e.target.value })} placeholder="VD: Hợp đồng mua bán thiết bị" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Tên đối tác *</Label>
                  <Input value={form.partner_name} onChange={(e) => setForm({ ...form, partner_name: e.target.value })} placeholder="Tên công ty đối tác" />
                </div>
                <div className="space-y-2">
                  <Label>Mã số thuế đối tác *</Label>
                  <Input value={form.tax_code} onChange={(e) => setForm({ ...form, tax_code: e.target.value })} placeholder="VD: 0123456789" />
                </div>
              </div>
              <div className="space-y-2">
                <div className="flex items-center gap-3">
                  <Label>Giá trị hợp đồng (VNĐ) *</Label>
                  <div className="flex items-center gap-1.5">
                    <Checkbox checked={form.contract_value_na} onCheckedChange={(v) => setForm({ ...form, contract_value_na: !!v, contract_value: "" })} id="value-na" />
                    <label htmlFor="value-na" className="text-xs text-muted-foreground cursor-pointer">N/A</label>
                  </div>
                </div>
                {!form.contract_value_na && (
                  <Input type="number" value={form.contract_value} onChange={(e) => setForm({ ...form, contract_value: e.target.value })} placeholder="0" />
                )}
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Thời hạn yêu cầu *</Label>
                  <Input type="date" value={form.request_deadline} onChange={(e) => setForm({ ...form, request_deadline: e.target.value })} />
                </div>
                <div className="space-y-2">
                  <Label>Hạn review *</Label>
                  <Input type="date" value={form.review_deadline} onChange={(e) => setForm({ ...form, review_deadline: e.target.value })} />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Ngày bắt đầu HĐ *</Label>
                  <Input type="date" value={form.contract_start_date} onChange={(e) => setForm({ ...form, contract_start_date: e.target.value })} />
                </div>
                <div className="space-y-2">
                  <Label>Ngày kết thúc HĐ *</Label>
                  <Input type="date" value={form.contract_end_date} onChange={(e) => setForm({ ...form, contract_end_date: e.target.value })} />
                </div>
              </div>
              <div className="space-y-2">
                <Label>Link Google Doc *</Label>
                <Input
                  type="url"
                  value={form.google_doc_url}
                  onChange={(e) => setForm({ ...form, google_doc_url: e.target.value })}
                  placeholder="https://docs.google.com/document/d/..."
                  className={form.google_doc_url && !isValidGoogleDocUrl(form.google_doc_url) ? "border-destructive focus-visible:ring-destructive" : ""}
                />
                {form.google_doc_url && !isValidGoogleDocUrl(form.google_doc_url) && (
                  <p className="text-xs text-destructive">Link không hợp lệ. Vui lòng nhập link Google Docs đúng định dạng.</p>
                )}
                <p className="text-xs text-muted-foreground">
                  ⚠️ Vui lòng cấp quyền <strong>Comment</strong> cho tất cả reviewer trước khi gửi.
                </p>
              </div>
              <div className="space-y-2">
                <Label>Số PE đã duyệt *</Label>
                <Input value={form.approved_pe_number} onChange={(e) => setForm({ ...form, approved_pe_number: e.target.value })} placeholder="VD: PE-2026-001" />
              </div>

              {/* Payment Schedule Section */}
              <div className="space-y-3 p-4 rounded-lg border bg-muted/20">
                <div className="flex items-center justify-between">
                  <Label className="text-sm font-semibold">Đợt thanh toán *</Label>
                  <Button type="button" variant="outline" size="sm" onClick={addPaymentPhase}>
                    Thêm đợt
                  </Button>
                </div>
                {paymentPhases.map((phase, idx) => (
                  <div key={idx} className="space-y-2 p-3 rounded border bg-background">
                    <div className="flex items-center justify-between">
                      <Input
                        value={phase.phase_name}
                        onChange={(e) => updatePaymentPhase(idx, "phase_name", e.target.value)}
                        className="w-28"
                        placeholder="Tên đợt"
                      />
                      {paymentPhases.length > 1 && (
                        <Button type="button" variant="ghost" size="sm" className="text-destructive text-xs" onClick={() => removePaymentPhase(idx)}>
                          Xóa
                        </Button>
                      )}
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-xs text-muted-foreground">Giá trị (VNĐ)</span>
                          <div className="flex items-center gap-1">
                            <Checkbox checked={phase.is_na} onCheckedChange={(v) => updatePaymentPhase(idx, "is_na", !!v)} />
                            <span className="text-xs text-muted-foreground">N/A</span>
                          </div>
                        </div>
                        {!phase.is_na && (
                          <Input
                            type="number"
                            value={phase.payment_amount}
                            onChange={(e) => updatePaymentPhase(idx, "payment_amount", e.target.value)}
                            placeholder="0"
                          />
                        )}
                      </div>
                      <div>
                        <span className="text-xs text-muted-foreground">Ngày thanh toán *</span>
                        <Input
                          type="date"
                          value={phase.payment_due_date}
                          onChange={(e) => updatePaymentPhase(idx, "payment_due_date", e.target.value)}
                        />
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              <div className="space-y-2">
                <Label>Mô tả chi tiết *</Label>
                <Textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="Mô tả thêm về hợp đồng cần review..." rows={3} />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={handleResetForm}>Hủy</Button>
              <Button className="bg-accent hover:bg-accent/90 text-accent-foreground" onClick={handleSubmit} disabled={submitting || !isFormValid}>
                {submitting ? "Đang xử lý..." : (editingReqId ? "Cập nhật yêu cầu" : "Gửi yêu cầu")}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: "Chờ duyệt", statuses: ["cho_quan_ly", "cho_quan_ly_chung", "cho_phap_che", "cho_ke_toan", "cho_tai_chinh", "cho_xu_ly"] },
          { label: "Đang review", statuses: ["dang_review"] },
          { label: "Hoàn tất", statuses: ["hoan_tat", "da_hoan_thanh"] },
          { label: "Từ chối", statuses: ["tu_choi", "yeu_cau_chinh_sua"] },
        ].map((item) => (
          <Card key={item.label} className="border shadow-sm">
            <CardContent className="p-3 text-center">
              <p className="text-2xl font-bold">{requests.filter((r) => item.statuses.includes(r.status)).length}</p>
              <p className="text-xs text-muted-foreground mt-1">{item.label}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Request List */}
      <div className="space-y-4">
        {requests.map((req, i) => {
          const deptReviews = extractDeptReviews(notes[req.id] || []);

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
                    {req.status !== "hoan_tat" && req.status !== "da_hoan_thanh" && (
                      <DepartmentReviewTracker deptReviews={deptReviews} assignedReviewers={getAssignedReviewers(req)} compact skipManagerStep={!!req.admin_notes?.includes("Quản lý chung duyệt")} reviewers={[...reviewers, ...globalManagers]} />
                    )}
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

                {/* Mô tả chi tiết */}
                <div className="p-3 rounded-lg bg-muted/20 border space-y-1">
                  <p className="text-xs font-medium text-muted-foreground">Mô tả chi tiết</p>
                  <p className="text-sm whitespace-pre-wrap">{req.description || "Không có mô tả"}</p>
                </div>

                {/* Payment Schedule */}
                {paymentSchedules[req.id] && paymentSchedules[req.id].length > 0 && (
                  <div className="p-3 rounded-lg bg-muted/30 space-y-2">
                    <p className="text-xs font-medium text-muted-foreground">Đợt thanh toán</p>
                    <div className="space-y-1">
                      {paymentSchedules[req.id].map((ps: any) => (
                        <div key={ps.id} className="flex items-center justify-between text-sm">
                          <span className="font-medium">{ps.phase_name}</span>
                          <span>{ps.payment_amount > 0 ? formatCurrency(ps.payment_amount) : "N/A"} — {ps.payment_due_date ? formatDate(ps.payment_due_date) : "—"}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Link rendering kept the same */}

                {/* File links */}
                {(req.legal_review_doc_link || req.file_url) && (
                  <div className="space-y-1">
                    {req.legal_review_doc_link && (
                      <a href={req.legal_review_doc_link} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-sm text-accent hover:underline">
                        Xem tài liệu đã review (Pháp chế)
                      </a>
                    )}
                    {req.file_url && (
                      <button
                        onClick={() => {
                          window.open(req.file_url as string, "_blank");
                        }}
                        className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:underline"
                      >
                        Xem tài liệu ban đầu
                      </button>
                    )}
                  </div>
                )}

                {req.admin_notes && (
                  <div className="p-3 rounded-lg bg-accent/5 border border-accent/20">
                    <p className="text-xs font-medium text-accent mb-1">Nhận xét pháp chế</p>
                    <p className="text-sm">{req.admin_notes}</p>
                  </div>
                )}

                {notes[req.id] && notes[req.id].filter((n: any) => !decodeDeptReview(n.content)).length > 0 && (
                  <div className="space-y-2">
                    <p className="text-sm font-medium">Lịch sử xử lý ({notes[req.id].filter((n: any) => !decodeDeptReview(n.content)).length})</p>
                    <div className="space-y-2 pl-6 border-l-2 border-muted ml-2">
                      {notes[req.id].filter((n: any) => !decodeDeptReview(n.content)).map((note: any) => (
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

                {["cho_xu_ly", "cho_quan_ly", "cho_quan_ly_chung", "cho_phap_che", "dang_review"].includes(req.status) && (
                  <>
                    <Separator />
                    <div className="flex justify-end gap-2">
                      <Button variant="outline" size="sm" className="text-xs" onClick={() => handleEdit(req)}>
                        Chỉnh sửa
                      </Button>
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button variant="outline" size="sm" className="text-xs text-destructive hover:text-destructive hover:bg-destructive/10">
                            Xóa yêu cầu
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
                    </div>
                  </>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>

      {requests.length === 0 && (
        <div className="text-center py-12">
          <p className="text-muted-foreground font-medium">Chưa có yêu cầu review nào</p>
          <p className="text-sm text-muted-foreground/70 mt-1">Nhấn "Tạo yêu cầu mới" để bắt đầu</p>
        </div>
      )}
      {/* Modal View for specific request */}
      {reqIdParam && requests.find(r => r.id === reqIdParam) && (() => {
        const req = requests.find(r => r.id === reqIdParam)!;
        const deptReviews = extractDeptReviews(notes[req.id] || []);

        return (
          <Dialog open={true} onOpenChange={(open) => {
            if (!open) {
              searchParams.delete('id');
              setSearchParams(searchParams);
            }
          }}>
            <DialogContent className="sm:max-w-3xl max-h-[90vh] overflow-y-auto p-0 border-none bg-transparent shadow-none">
              <Card className="border shadow-lg">
                <CardHeader className="pb-3 bg-background sticky top-0 z-10 border-b">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div>
                      <DialogTitle className="text-base font-semibold">{req.contract_title}</DialogTitle>
                      <p className="text-sm text-muted-foreground mt-0.5">
                        Yêu cầu bởi <span className="font-medium text-foreground">{req.requester_name}</span> — {req.department}
                        {req.contract_type_category && <> — {req.contract_type_category}</>}
                        {req.tax_code && <> — MST: {req.tax_code}</>}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      {req.status !== "hoan_tat" && req.status !== "da_hoan_thanh" && (
                        <DepartmentReviewTracker deptReviews={deptReviews} assignedReviewers={getAssignedReviewers(req)} compact skipManagerStep={!!req.admin_notes?.includes("Quản lý chung duyệt")} reviewers={[...reviewers, ...globalManagers]} />
                      )}
                      <Badge className={STATUS_COLORS[req.status] || ""}>{STATUS_LABELS[req.status] || req.status}</Badge>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="pt-4 space-y-4 bg-background">
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

                  <div className="p-3 rounded-lg bg-muted/20 border space-y-1">
                    <p className="text-xs font-medium text-muted-foreground">Mô tả chi tiết</p>
                    <p className="text-sm whitespace-pre-wrap">{req.description || "Không có mô tả"}</p>
                  </div>

                  {paymentSchedules[req.id] && paymentSchedules[req.id].length > 0 && (
                    <div className="p-3 rounded-lg bg-muted/30 space-y-2">
                      <p className="text-xs font-medium text-muted-foreground">Đợt thanh toán</p>
                      <div className="space-y-1">
                        {paymentSchedules[req.id].map((ps: any) => (
                          <div key={ps.id} className="flex items-center justify-between text-sm">
                            <span className="font-medium">{ps.phase_name}</span>
                            <span>{ps.payment_amount > 0 ? formatCurrency(ps.payment_amount) : "N/A"} — {ps.payment_due_date ? formatDate(ps.payment_due_date) : "—"}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {(req.legal_review_doc_link || req.file_url) && (
                    <div className="space-y-1">
                      {req.legal_review_doc_link && (
                        <a href={req.legal_review_doc_link} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-sm text-accent hover:underline">
                          Xem tài liệu đã review (Pháp chế)
                        </a>
                      )}
                      {req.file_url && (
                        <button
                          onClick={() => {
                            window.open(req.file_url as string, "_blank");
                          }}
                          className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:underline block mt-2"
                        >
                          Xem tài liệu ban đầu
                        </button>
                      )}
                    </div>
                  )}

                  {req.admin_notes && (
                    <div className="p-3 rounded-lg bg-accent/5 border border-accent/20">
                      <p className="text-xs font-medium text-accent mb-1">Nhận xét pháp chế</p>
                      <p className="text-sm">{req.admin_notes}</p>
                    </div>
                  )}

                  {notes[req.id] && notes[req.id].filter((n: any) => !decodeDeptReview(n.content)).length > 0 && (
                    <div className="space-y-2 mt-4">
                      <p className="text-sm font-medium">Lịch sử xử lý ({notes[req.id].filter((n: any) => !decodeDeptReview(n.content)).length})</p>
                      <div className="space-y-2 pl-6 border-l-2 border-muted ml-2">
                        {notes[req.id].filter((n: any) => !decodeDeptReview(n.content)).map((note: any) => (
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
                </CardContent>
              </Card>
            </DialogContent>
          </Dialog>
        );
      })()}
    </div>
  );
};

export default UserDashboard;
