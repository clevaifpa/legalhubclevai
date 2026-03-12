import { useState, useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth, getEmployeeName } from "@/hooks/useAuth";
import { createWorkflowNotifications } from "@/lib/notifications";
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
import { Checkbox } from "@/components/ui/checkbox";
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
  GLOBAL_MANAGER_EMAIL,
} from "@/types/reviewDepartments";

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

interface PaymentPhase {
  phase_name: string;
  payment_amount: string;
  payment_due_date: string;
  is_na: boolean;
}

const AdminReviewRequests = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const reqIdParam = searchParams.get('id');
  const { user, profile, role, roles, managerDepartment } = useAuth();
  const isAdmin = role === "admin";
  const isManager = role === "manager";
  const isAccountant = role === "accountant";
  const isFinance = role === "finance";
  const isDirectSubmit = isAdmin || isAccountant || isFinance || isManager;

  const [globalManagerId, setGlobalManagerId] = useState<string | null>(null);

  // Fetch global manager user_id on mount
  useEffect(() => {
    const fetchGlobalManager = async () => {
      const { data } = await supabase
        .from("profiles")
        .select("user_id")
        .eq("email", GLOBAL_MANAGER_EMAIL)
        .single();
      if (data) setGlobalManagerId(data.user_id);
    };
    fetchGlobalManager();
  }, []);

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

  const [managers, setManagers] = useState<any[]>([]);
  const [reviewers, setReviewers] = useState<any[]>([]);
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
    const { data, error } = await supabase.rpc("get_all_reviewers_with_names");
    if (!error) {
      setReviewers(data || []);
    } else {
      console.error("Error fetching reviewers:", error);
    }
  };

  useEffect(() => {
    if (form.department) fetchManagers(form.department);
  }, [form.department]);

  useEffect(() => {
    fetchReviewers();
  }, []);

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
    // Xóa nội dung nhận xét trước đó khi mở form duyệt
    setAdminNotes("");
    setLegalReviewDocLink(req.legal_review_doc_link || "");
    setNewNote("");
  };

  const handleAssignReviewer = async (reqId: string, dept: string, reviewerId: string) => {
    let columnToUpdate = "";
    if (dept === "quan_ly") columnToUpdate = "manager_id";
    if (dept === "quan_ly_chung") columnToUpdate = "global_manager_id";
    if (dept === "phap_ly") columnToUpdate = "legal_reviewer_id";
    if (dept === "ke_toan") columnToUpdate = "accountant_reviewer_id";
    if (dept === "tai_chinh") columnToUpdate = "finance_reviewer_id";

    if (!columnToUpdate) return;

    const { error } = await supabase.from("review_requests").update({
      [columnToUpdate]: reviewerId === "none" || !reviewerId ? null : reviewerId
    }).eq("id", reqId);

    if (error) {
      toast.error("Lỗi phân công người duyệt", { description: error.message });
    } else {
      toast.success("Đã phân công người duyệt thành công!");
      fetchRequests(); // Lấy lại dữ liệu để cap nhat List view
      // Update selected req so the UI reflects it immediately
      if (selectedReq && selectedReq.id === reqId) {
        setSelectedReq({
          ...selectedReq,
          [columnToUpdate]: reviewerId === "none" || !reviewerId ? null : reviewerId,
        });
      }
    }
  };

  const handleSubmitNewRequest = async () => {
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
      }).eq("id", editingReqId);
      submitError = error;

      if (!error) {
        // Xoá lịch thanh toán cũ
        await supabase.from("payment_schedules").delete().eq("review_request_id", editingReqId);
      }
    } else {
      // Logic tạo mới (Create)
      const initialStatus = isDirectSubmit ? "cho_quan_ly_chung" : "cho_quan_ly";

      const { data: insertedReq, error } = await supabase.from("review_requests").insert({
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
        manager_id: isDirectSubmit ? (globalManagerId || null) : (form.manager_id || null),
        status: initialStatus as any,
        admin_notes: isDirectSubmit ? "Yêu cầu tạo bởi Pháp chế/Kế toán/Quản lý — chuyển thẳng cho Quản lý chung duyệt." : null,
      } as any).select().single();

      submitError = error;
      if (insertedReq) finalReqId = insertedReq.id;

      if (insertedReq) {
        await createWorkflowNotifications({
          reviewRequestId: insertedReq.id,
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

    // Notification already sent in the create/update block above

    setSubmitting(false);
    toast.success(editingReqId ? "Cập nhật thành công!" : (isDirectSubmit
      ? "Yêu cầu đã tạo, chuyển cho Quản lý chung duyệt!"
      : "Yêu cầu review đã được tạo!"));
    handleResetForm();
    fetchRequests();
  };

  const resetFormData = () => {
    setEditingReqId(null);
    setForm({ priority: "trung_binh", contract_title: "", partner_name: "", contract_value: "", contract_value_na: false, request_deadline: "", contract_start_date: "", contract_end_date: "", review_deadline: "", description: "", google_doc_url: "", approved_pe_number: "", department: "", contract_type_category: "", tax_code: "", manager_id: "" });
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

  // Approve current step and advance workflow
  const handleApproveStep = async () => {
    if (!selectedReq || !user) return;

    // Block legal step if no valid review doc link
    if (isAdmin && selectedReq.status === "cho_phap_che" && !isValidGoogleDocUrl(legalReviewDocLink)) {
      toast.error("Bắt buộc nhập link Google Doc review", { description: "Vui lòng nhập link Google Docs đã review trước khi chuyển bước." });
      return;
    }

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
        author_name: getEmployeeName(user.email) || user.email || "",
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
      editor_name: getEmployeeName(user.email) || user.email || "",
      record_id: selectedReq.id,
      table_name: "review_requests",
      changes: { field: "status", old: currentStatus, new: nextStatus, action: "approve" },
    } as any);

    // Save regular note
    if (newNote.trim()) {
      await supabase.from("review_notes").insert({
        review_request_id: selectedReq.id,
        author_id: user.id,
        author_name: getEmployeeName(user.email) || user.email || "",
        content: newNote.trim(),
      });
    }

    // Send notifications (in-app + email)
    await createWorkflowNotifications({
      reviewRequestId: selectedReq.id,
      contractTitle: selectedReq.contract_title,
      oldStatus: currentStatus,
      newStatus: nextStatus,
      actorName: getEmployeeName(user.email) || user.email || "",
      requesterId: selectedReq.requester_id,
      managerId: selectedReq.manager_id,
      department: selectedReq.department || "",
    });

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
        author_name: getEmployeeName(user.email) || user.email || "",
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
      editor_name: getEmployeeName(user.email) || user.email || "",
      record_id: selectedReq.id,
      table_name: "review_requests",
      changes: { field: "status", old: currentStatus, new: "tu_choi", action: "reject" },
    } as any);

    if (newNote.trim()) {
      await supabase.from("review_notes").insert({
        review_request_id: selectedReq.id,
        author_id: user.id,
        author_name: getEmployeeName(user.email) || user.email || "",
        content: newNote.trim(),
      });
    }

    // Send notifications (in-app + email)
    await createWorkflowNotifications({
      reviewRequestId: selectedReq.id,
      contractTitle: selectedReq.contract_title,
      oldStatus: currentStatus,
      newStatus: "tu_choi",
      actorName: getEmployeeName(user.email) || user.email || "",
      requesterId: selectedReq.requester_id,
      managerId: selectedReq.manager_id,
      department: selectedReq.department || "",
    });

    setSaving(false);
    setSelectedReq(null);
    toast.success("Đã từ chối yêu cầu");
    fetchRequests();
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

  // Can this user act on this request?
  const canActOnRequest = (req: any): boolean => {
    if (!req) return false;
    if (isAdmin) return true;
    if (isManager && req.status === 'cho_quan_ly') return true;
    // Global manager (hiennd) can act on cho_quan_ly_chung
    if (isManager && req.status === 'cho_quan_ly_chung' && user?.email === GLOBAL_MANAGER_EMAIL) return true;
    if (isAccountant && req.status === 'cho_ke_toan') return true;
    if (isFinance && req.status === 'cho_tai_chinh') return true;
    return false;
  };

  const statusCounts = requests.reduce((acc: Record<string, number>, r) => {
    acc[r.status] = (acc[r.status] || 0) + 1;
    return acc;
  }, {});

  if (loading) {
    return <div className="flex items-center justify-center h-64"><p className="text-muted-foreground">Đang tải...</p></div>;
  }

  const roleLabel = isAdmin ? "Pháp chế" : isManager ? "Quản lý" : isAccountant ? "Kế toán" : isFinance ? "Tài chính" : "";
  const isFormValid = form.contract_title && form.request_deadline && form.approved_pe_number.trim() && form.partner_name.trim() && (form.contract_value_na || form.contract_value) && form.review_deadline && form.contract_start_date && form.contract_end_date && form.description.trim() && form.department && form.contract_type_category && form.tax_code.trim() && (isDirectSubmit || form.manager_id) && isValidGoogleDocUrl(form.google_doc_url) && paymentPhases.every(p => (p.is_na || (p.payment_amount && parseInt(p.payment_amount) > 0)) && p.payment_due_date);

  // Helper for tracking props
  const getAssignedReviewers = (req: any) => ({
    quan_ly: { id: req.manager_id, name: reviewers.find(r => r.user_id === req.manager_id)?.full_name },
    quan_ly_chung: { id: req.global_manager_id, name: reviewers.find(r => r.user_id === req.global_manager_id)?.full_name },
    phap_ly: { id: req.legal_reviewer_id, name: reviewers.find(r => r.user_id === req.legal_reviewer_id)?.full_name },
    ke_toan: { id: req.accountant_reviewer_id, name: reviewers.find(r => r.user_id === req.accountant_reviewer_id)?.full_name },
    tai_chinh: { id: req.finance_reviewer_id, name: reviewers.find(r => r.user_id === req.finance_reviewer_id)?.full_name }
  });

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">
            {isAdmin ? "Quản lý yêu cầu review" : `Yêu cầu review — ${roleLabel}`}
          </h1>
          <p className="text-muted-foreground">
            {isAdmin ? "Xem và xử lý các yêu cầu review hợp đồng" : `Duyệt các yêu cầu ở bước ${roleLabel}`}
          </p>
        </div>

        {isDirectSubmit && (
          <Dialog open={dialogOpen} onOpenChange={(open) => {
            if (!open) handleResetForm();
            else setDialogOpen(true);
          }}>
            <Button
              className="bg-accent hover:bg-accent/90 text-accent-foreground shrink-0"
              onClick={() => { resetFormData(); setDialogOpen(true); }}
            >
              Tạo yêu cầu mới
            </Button>
            <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>{editingReqId ? "Chỉnh sửa yêu cầu review hợp đồng" : `Tạo yêu cầu review hợp đồng (${isAdmin ? "Pháp chế" : isManager ? "Quản lý" : "Kế toán/Tài chính"})`}</DialogTitle>
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
                  {!isDirectSubmit && (
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
                  )}
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
                <Button className="bg-accent hover:bg-accent/90 text-accent-foreground" onClick={handleSubmitNewRequest} disabled={submitting || !isFormValid}>
                  {submitting ? "Đang xử lý..." : (editingReqId ? "Cập nhật yêu cầu" : "Gửi yêu cầu")}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        )}
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
                    {req.status !== "hoan_tat" && req.status !== "da_hoan_thanh" && (
                      <DepartmentReviewTracker deptReviews={deptReviews} assignedReviewers={getAssignedReviewers(req)} compact skipManagerStep={!!req.admin_notes?.includes("Quản lý chung duyệt")} />
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

                {req.status !== "hoan_tat" && req.status !== "da_hoan_thanh" && (
                  <DepartmentReviewTracker
                    deptReviews={deptReviews}
                    assignedReviewers={getAssignedReviewers(req)}
                    skipManagerStep={!!req.admin_notes?.includes("Quản lý chung duyệt")}
                    assignable={isAdmin}
                    reviewers={reviewers}
                    onAssignReviewer={(dept, reviewerId) => handleAssignReviewer(req.id, dept, reviewerId)}
                  />
                )}

                {/* File links */}
                <div className="space-y-1">
                  {isAdmin && (
                    <>
                      {req.file_url && (
                        <button
                          onClick={() => {
                            window.open(req.file_url as string, "_blank");
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
                      onClick={() => {
                        window.open(req.file_url as string, "_blank");
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
                  {req.status !== "hoan_tat" && req.status !== "da_hoan_thanh" && (
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
                  )}
                </div>

                {user?.id === req.requester_id && ["cho_xu_ly", "cho_quan_ly", "cho_quan_ly_chung", "cho_phap_che", "dang_review"].includes(req.status) && (
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

            <DepartmentReviewTracker
              deptReviews={extractDeptReviews(notes[selectedReq.id] || [])}
              assignedReviewers={getAssignedReviewers(selectedReq)}
              skipManagerStep={!!selectedReq.admin_notes?.includes("Quản lý chung duyệt")}
              assignable={isAdmin}
              reviewers={reviewers}
              onAssignReviewer={(dept, reviewerId) => handleAssignReviewer(selectedReq.id, dept, reviewerId)}
            />

            <Separator />

            {/* Legal Review Doc Link - only for admin at legal review step */}
            {isAdmin && selectedReq?.status === "cho_phap_che" && (
              <div className="space-y-2">
                <Label>Link Google Doc review (Pháp chế) *</Label>
                <Input
                  type="url"
                  value={legalReviewDocLink}
                  onChange={(e) => setLegalReviewDocLink(e.target.value)}
                  placeholder="https://docs.google.com/document/d/..."
                  className={legalReviewDocLink && !isValidGoogleDocUrl(legalReviewDocLink) ? "border-destructive focus-visible:ring-destructive" : ""}
                />
                {!legalReviewDocLink && (
                  <p className="text-xs text-destructive">Bắt buộc nhập link review trước khi hoàn tất.</p>
                )}
                {legalReviewDocLink && !isValidGoogleDocUrl(legalReviewDocLink) && (
                  <p className="text-xs text-destructive">Link không hợp lệ. Vui lòng nhập link Google Docs đúng định dạng.</p>
                )}
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
      {reqIdParam && requests.find(r => r.id === reqIdParam) && (() => {
        const req = requests.find(r => r.id === reqIdParam)!;
        const deptReviews = extractDeptReviews(notes[req.id] || []);
        const reqPayments = paymentSchedules[req.id] || [];

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
                        <DepartmentReviewTracker deptReviews={deptReviews} assignedReviewers={getAssignedReviewers(req)} compact skipManagerStep={!!req.admin_notes?.includes("Quản lý chung duyệt")} />
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

                  {req.status !== "hoan_tat" && req.status !== "da_hoan_thanh" && (
                    <DepartmentReviewTracker deptReviews={deptReviews} assignedReviewers={getAssignedReviewers(req)} skipManagerStep={!!req.admin_notes?.includes("Quản lý chung duyệt")} />
                  )}

                  <div className="space-y-1">
                    {isAdmin && (
                      <>
                        {req.file_url && (
                          <button
                            onClick={() => {
                              window.open(req.file_url as string, "_blank");
                            }}
                            className="inline-flex items-center gap-1 text-sm text-accent hover:underline"
                          >
                            Xem tài liệu ban đầu
                          </button>
                        )}
                        {req.legal_review_doc_link && (
                          <a href={req.legal_review_doc_link} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-sm text-accent hover:underline block mt-2">
                            Xem tài liệu đã review (Pháp chế)
                          </a>
                        )}
                      </>
                    )}
                    {isManager && req.file_url && (
                      <button
                        onClick={() => {
                          window.open(req.file_url as string, "_blank");
                        }}
                        className="inline-flex items-center gap-1 text-sm text-accent hover:underline"
                      >
                        Xem tài liệu
                      </button>
                    )}
                  </div>
                </CardContent>
              </Card>
            </DialogContent>
          </Dialog>
        );
      })()}
    </div>
  );
};

export default AdminReviewRequests;
