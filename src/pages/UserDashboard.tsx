import { useState, useEffect } from "react";
import { useSearchParams, useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth, getEmployeeName } from "@/hooks/useAuth";
import { createWorkflowNotifications, notifyReviewRequestEdited } from "@/lib/notifications";
import { FolderOpen, Loader2, Sparkles, FileText, MessageCircle, ChevronDown } from "lucide-react";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
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
import { InternalChat } from "@/components/review/InternalChat";
import { extractDeptReviews, decodeDeptReview, getVisibleDeptNotes, WORKFLOW_STATUSES, REVIEW_DEPARTMENTS } from "@/types/reviewDepartments";

const isValidGoogleDocUrl = (url: string): boolean => {
  if (!url) return false;
  if (!/^https:\/\/docs\.google\.com\/(document|spreadsheets|presentation)\/d\//.test(url)) return false;
  if (url.includes('/view') || url.includes('/preview')) return false;
  if (!url.includes('/edit')) return false;
  return true;
};

const SHARED_GOOGLE_DRIVE_FOLDER_URL = "https://drive.google.com/drive/folders/1Ui7l9o9AQwtecrVLgc3JMp1lALs5QwAr";

const GOOGLE_DOC_FOLDER_ERROR = "Link Google Doc không thuộc folder chung. Vui lòng tạo tài liệu trong folder quy định.";
const GOOGLE_DOC_CHECK_ERROR = "Không thể kiểm tra file. Vui lòng đảm bảo file nằm trong folder chung hoặc liên hệ admin.";

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
  "Phụ lục hợp đồng",
  "NDA",
  "Văn bản khác",
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

interface SupplementaryDoc {
  doc_name: string;
  doc_url: string;
}

const UserDashboard = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const { id: routeReqId } = useParams();
  const [closedRouteIds, setClosedRouteIds] = useState<Set<string>>(new Set());
  const reqIdParam = searchParams.get('id');
  const activeReqId = (routeReqId && !closedRouteIds.has(routeReqId)) ? routeReqId : reqIdParam;
  const { user, profile, role } = useAuth();
  const isPhapc = role === "admin"; // Pháp chế = admin role
  const isAccountant = role === "accountant";
  const isFinance = role === "finance";
  const isDirectSubmit = isPhapc || isAccountant || isFinance;
  const [requests, setRequests] = useState<any[]>([]);
  const [notes, setNotes] = useState<Record<string, any[]>>({});
  const [paymentSchedules, setPaymentSchedules] = useState<Record<string, any[]>>({});
  const [supplementaryDocs, setSupplementaryDocs] = useState<SupplementaryDoc[]>([]);
  const [supplementaryDocsData, setSupplementaryDocsData] = useState<Record<string, any[]>>({});
  const [managers, setManagers] = useState<any[]>([]);
  const [reviewers, setReviewers] = useState<any[]>([]);
  // Group reviewers by role (declared early so handlers like handleEdit can safely use them)
  const globalManagers = reviewers.filter(r => r.role === 'manager_chung');
  const legalReviewers = reviewers.filter(r => r.role === 'admin');
  const accountantReviewers = reviewers.filter(r => r.role === 'accountant');
  const financeReviewers = reviewers.filter(r => r.role === 'finance');
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
    legal_reviewer_id: "",
    accountant_reviewer_id: "",
    finance_reviewer_id: "",
    legal_review_doc_link: "",
  });

  const [paymentPhases, setPaymentPhases] = useState<PaymentPhase[]>([
    { phase_name: "Đợt 01", payment_amount: "", payment_due_date: "", is_na: false },
  ]);

  const [formErrors, setFormErrors] = useState<Record<string, string>>({});
  const [aiExtracting, setAiExtracting] = useState(false);
  const [aiDescriptionUpdated, setAiDescriptionUpdated] = useState(false);

  const validSupplementaryDocs = supplementaryDocs.filter(d => d.doc_name.trim() && d.doc_url.trim());

  const handleAiExtract = async () => {
    if (!form.google_doc_url) {
      toast.error("Vui lòng dán link Google Doc trước");
      return;
    }
    if (form.description.trim()) {
      const shouldOverwrite = window.confirm("Bạn có muốn cập nhật lại nội dung từ AI không?");
      if (!shouldOverwrite) return;
    }
    setAiExtracting(true);
    try {
      const { data, error } = await supabase.functions.invoke("extract-contract-from-doc", {
        body: {
          googleDocUrl: form.google_doc_url,
          forceRefresh: true,
          cacheBust: Date.now(),
          attachments: validSupplementaryDocs.map(d => ({
            type: d.doc_name,
            name: d.doc_name,
            url: d.doc_url,
          })),
        },
      });

      if (error) {
        toast.error("Lỗi khi phân tích", { description: error.message });
        return;
      }
      if (data?.error) {
        toast.error("AI không thể phân tích", { description: data.error });
        return;
      }

      // Auto-fill form
      const updates: Partial<typeof form> = {};
      if (data.loai_van_ban && CONTRACT_TYPE_CATEGORIES.includes(data.loai_van_ban)) {
        updates.contract_type_category = data.loai_van_ban;
      }
      if (data.ten_van_ban) updates.contract_title = data.ten_van_ban;
      if (data.ten_doi_tac) updates.partner_name = data.ten_doi_tac;
      if (data.ma_so_thue) updates.tax_code = data.ma_so_thue;
      if (data.ngay_bat_dau) updates.contract_start_date = data.ngay_bat_dau;
      if (data.ngay_ket_thuc) updates.contract_end_date = data.ngay_ket_thuc;
      if (data.mo_ta) {
        updates.description = data.mo_ta;
        setAiDescriptionUpdated(true);
        window.setTimeout(() => setAiDescriptionUpdated(false), 4500);
      }

      setForm(prev => ({ ...prev, ...updates }));

      // Auto-fill payment phases
      if (data.dot_thanh_toan && data.dot_thanh_toan.length > 0) {
        setPaymentPhases(data.dot_thanh_toan.map((d: any, idx: number) => ({
          phase_name: d.ten_dot || `Đợt ${String(idx + 1).padStart(2, "0")}`,
          payment_amount: d.gia_tri ? String(d.gia_tri) : "",
          payment_due_date: d.ngay_thanh_toan || "",
          is_na: false,
        })));
      } else if (data.gia_tri_hop_dong && data.gia_tri_hop_dong > 0) {
        // No payment phases, set single phase with total value
        setPaymentPhases([{
          phase_name: "Đợt 01",
          payment_amount: String(data.gia_tri_hop_dong),
          payment_due_date: "",
          is_na: false,
        }]);
      }

      toast.success("Nội dung đã được cập nhật từ phiên bản mới của tài liệu", { description: "Vui lòng kiểm tra và bổ sung thông tin còn thiếu." });
    } catch (err: any) {
      console.error("AI extract error:", err);
      toast.error("Lỗi hệ thống khi phân tích");
    } finally {
      setAiExtracting(false);
    }
  };

  const openSharedGoogleDriveFolder = () => {
    window.open(SHARED_GOOGLE_DRIVE_FOLDER_URL, "_blank", "noopener,noreferrer");
  };
  useEffect(() => {
    setFormErrors(prev => {
      if (Object.keys(prev).length === 0) return prev;
      const newErrors = { ...prev };
      if (form.department) delete newErrors.department;
      if (form.contract_type_category) delete newErrors.contract_type_category;
      if (form.contract_title.trim()) delete newErrors.contract_title;
      if (form.partner_name.trim()) delete newErrors.partner_name;
      if (form.tax_code.trim()) delete newErrors.tax_code;
      if (form.review_deadline) delete newErrors.review_deadline;
      if (form.contract_start_date) delete newErrors.contract_start_date;
      if (form.contract_end_date) delete newErrors.contract_end_date;
      if (form.google_doc_url && isValidGoogleDocUrl(form.google_doc_url)) delete newErrors.google_doc_url;
      if (form.description.trim()) delete newErrors.description;
      if (form.approved_pe_number.trim()) delete newErrors.approved_pe_number;
      if (!isDirectSubmit && form.manager_id) delete newErrors.manager_id;

      paymentPhases.forEach((p, idx) => {
        if (p.is_na || (p.payment_amount && parseInt(p.payment_amount) > 0)) {
          delete newErrors[`payment_amount_${idx}`];
        }
        if (p.payment_due_date) {
          delete newErrors[`payment_due_date_${idx}`];
        }
      });

      const prevKeys = Object.keys(prev);
      const newKeys = Object.keys(newErrors);
      if (prevKeys.length === newKeys.length && prevKeys.every(k => newErrors[k] === prev[k])) return prev;
      return newErrors;
    });
  }, [form, paymentPhases]);

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

  useEffect(() => {
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
        const [notesRes, paymentsRes, suppDocsRes] = await Promise.all([
          supabase.from("review_notes").select("*").in("review_request_id", ids).order("created_at", { ascending: true }),
          supabase.from("payment_schedules").select("*").in("review_request_id", ids).order("created_at", { ascending: true }),
          supabase.from("review_supplementary_docs").select("*").in("review_request_id", ids).order("created_at", { ascending: true }),
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
        if (suppDocsRes.data) {
          const grouped: Record<string, any[]> = {};
          suppDocsRes.data.forEach((d: any) => {
            if (!grouped[d.review_request_id]) grouped[d.review_request_id] = [];
            grouped[d.review_request_id].push(d);
          });
          setSupplementaryDocsData(grouped);
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

    const errors: Record<string, string> = {};
    if (!form.department) errors.department = "Vui lòng chọn phòng ban";
    if (!form.contract_type_category) errors.contract_type_category = "Vui lòng chọn loại văn bản";
    if (!form.contract_title.trim()) errors.contract_title = "Vui lòng nhập tên văn bản";
    if (!form.partner_name.trim()) errors.partner_name = "Vui lòng nhập tên đối tác";
    if (!form.tax_code.trim()) errors.tax_code = "Vui lòng nhập mã số thuế đối tác";
    if (!form.review_deadline) errors.review_deadline = "Vui lòng nhập hạn review";
    if (!form.contract_start_date) errors.contract_start_date = "Vui lòng nhập ngày bắt đầu HĐ";
    if (!form.contract_end_date) errors.contract_end_date = "Vui lòng nhập ngày kết thúc HĐ";
    if (!form.google_doc_url || !isValidGoogleDocUrl(form.google_doc_url)) {
      errors.google_doc_url = "Vui lòng nhập link Google Docs có quyền chỉnh sửa";
    }
    if (!form.approved_pe_number.trim()) errors.approved_pe_number = "Vui lòng nhập số PE đã duyệt";
    if (!form.description.trim()) errors.description = "Vui lòng nhập mô tả chi tiết";
    if (!isDirectSubmit && !form.manager_id) errors.manager_id = "Vui lòng chọn người quản lý";

    paymentPhases.forEach((p, idx) => {
      if (!p.is_na && (!p.payment_amount || parseInt(p.payment_amount) <= 0)) {
        errors[`payment_amount_${idx}`] = "Vui lòng nhập giá trị thanh toán hoặc chọn N/A";
      }
      if (!p.payment_due_date) {
        errors[`payment_due_date_${idx}`] = "Vui lòng nhập ngày thanh toán";
      }
    });

    if (Object.keys(errors).length > 0) {
      setFormErrors(errors);
      toast.error("Thiếu thông tin bắt buộc", { description: "Vui lòng điền đầy đủ các trường báo đỏ." });
      const firstError = Object.keys(errors)[0];
      const element = document.getElementById(`field-${firstError}`);
      if (element) {
        element.scrollIntoView({ behavior: 'smooth', block: 'center' });
      } else {
        // Fallback for payment fields which might not have field- IDs
        const container = document.getElementById("payment-schedules-section");
        if (container) container.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
      return;
    }

    setSubmitting(true);

    // Verify Google Doc Link via API
    try {
      const { data: verifyData, error: verifyError } = await supabase.functions.invoke('verify-google-doc', {
        body: { url: form.google_doc_url }
      });

      if (verifyError || verifyData?.error || verifyData?.isInSharedFolder !== true) {
        const message = verifyData?.isInSharedFolder === false ? GOOGLE_DOC_FOLDER_ERROR : (verifyData?.error || GOOGLE_DOC_CHECK_ERROR);
        console.error("verify-google-doc failed:", verifyError || verifyData?.error || verifyData);
        toast.error(verifyData?.isInSharedFolder === false ? "Link Google Doc không thuộc folder chung" : "Không thể kiểm tra file", {
          description: message
        });
        setFormErrors(prev => ({ ...prev, google_doc_url: message }));
        setSubmitting(false);
        return;
      }
    } catch (err: any) {
      console.error("Exception verifying Google Doc:", err);
      toast.error("Không thể kiểm tra file", { description: GOOGLE_DOC_CHECK_ERROR });
      setFormErrors(prev => ({ ...prev, google_doc_url: GOOGLE_DOC_CHECK_ERROR }));
      setSubmitting(false);
      return;
    }

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
        contract_value: form.contract_value_na ? 0 : calculatedContractValue,
        request_deadline: form.review_deadline,
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
        legal_review_doc_link: form.legal_review_doc_link?.trim() || null,
      }).eq("id", editingReqId);
      submitError = error;

      if (!error) {
        // Xoá lịch thanh toán cũ
        await supabase.from("payment_schedules").delete().eq("review_request_id", editingReqId);
      }
    } else {
      // Logic tạo mới (Create)
      const initialStatus = isDirectSubmit ? "cho_quan_ly_chung" : "cho_quan_ly";

      // PRE-CALCULATE AUTO ASSIGNMENTS TO SAVE DB REQUESTS
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
      const gManagers = reviewers.filter(r => r.role === 'manager_chung');
      if (gManagers.length === 1) {
        autoAssign["global_manager_id"] = gManagers[0].user_id;
      }

      const { data, error } = await supabase.from("review_requests").insert({
        requester_id: user.id,
        requester_name: employeeName || profile.full_name || user.email || "",
        department: form.department,
        priority: form.priority as any,
        contract_title: form.contract_title,
        partner_name: form.partner_name,
        contract_value: form.contract_value_na ? 0 : calculatedContractValue,
        request_deadline: form.review_deadline,
        contract_start_date: form.contract_start_date || null,
        contract_end_date: form.contract_end_date || null,
        review_deadline: form.review_deadline || null,
        description: form.description,
        file_url: form.google_doc_url || null,
        approved_pe_number: form.approved_pe_number.trim() || null,
        contract_type_category: form.contract_type_category,
        tax_code: form.tax_code,
        manager_id: isDirectSubmit ? null : (form.manager_id || null),
        global_manager_id: isDirectSubmit ? (form.global_manager_id || autoAssign.global_manager_id || null) : (autoAssign.global_manager_id || null),
        legal_reviewer_id: autoAssign.legal_reviewer_id || null,
        accountant_reviewer_id: autoAssign.accountant_reviewer_id || null,
        finance_reviewer_id: autoAssign.finance_reviewer_id || null,
        status: initialStatus as any,
        admin_notes: isDirectSubmit ? "Yêu cầu tạo bởi Pháp chế/Kế toán/Tài chính — chuyển thẳng cho Quản lý chung duyệt." : null,
      }).select().single();

      submitError = error;
      if (data) finalReqId = data.id;

      // Send notifications for new request (no extra DB query for assignment)
      if (data) {
        createWorkflowNotifications({
          reviewRequestId: data.id,
          contractTitle: form.contract_title,
          oldStatus: "moi_tao",
          newStatus: initialStatus,
          actorName: employeeName || profile.full_name || "",
          requesterId: user.id,
          managerId: form.manager_id || null,
          department: form.department || profile?.department || "",
        }).catch(console.error);
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

      // Save supplementary docs
      if (editingReqId) {
        await supabase.from("review_supplementary_docs").delete().eq("review_request_id", finalReqId);
      }
      const validDocs = supplementaryDocs.filter(d => d.doc_name.trim() && d.doc_url.trim());
      if (validDocs.length > 0) {
        await supabase.from("review_supplementary_docs").insert(
          validDocs.map(d => ({ review_request_id: finalReqId!, doc_name: d.doc_name.trim(), doc_url: d.doc_url.trim() })) as any
        );
      }
    }

    setSubmitting(false);
    if (editingReqId && finalReqId) {
      notifyReviewRequestEdited({
        reviewRequestId: finalReqId,
        contractTitle: form.contract_title,
        actorName: profile?.full_name || "Người dùng",
        requesterId: user?.id || "",
        department: form.department || profile?.department || "",
      }).catch(console.error);
    }
    toast.success(editingReqId ? "Cập nhật thành công!" : (isDirectSubmit ? "Yêu cầu đã tạo!" : "Yêu cầu review đã được tạo!"));
    handleResetForm();
    fetchRequests();
  };

  const resetFormData = () => {
    setEditingReqId(null);
    setForm({ priority: "trung_binh", contract_title: "", partner_name: "", contract_value: "", contract_value_na: false, request_deadline: "", contract_start_date: "", contract_end_date: "", review_deadline: "", description: "", google_doc_url: "", approved_pe_number: "", department: "", contract_type_category: "", tax_code: "", manager_id: "", global_manager_id: "", legal_reviewer_id: "", accountant_reviewer_id: "", finance_reviewer_id: "", legal_review_doc_link: "" });
    setPaymentPhases([{ phase_name: "Đợt 01", payment_amount: "", payment_due_date: "", is_na: false }]);
    setSupplementaryDocs([]);
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
      legal_reviewer_id: req.legal_reviewer_id || "",
      accountant_reviewer_id: req.accountant_reviewer_id || "",
      finance_reviewer_id: req.finance_reviewer_id || "",
      legal_review_doc_link: req.legal_review_doc_link || "",
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

    // Load supplementary docs for editing
    const existingDocs = supplementaryDocsData[req.id] || [];
    setSupplementaryDocs(existingDocs.map((d: any) => ({ doc_name: d.doc_name, doc_url: d.doc_url })));

    setDialogOpen(true);
  };

  const handleDelete = async (reqId: string) => {
    const { error } = await (supabase.rpc as any)("delete_review_request", { _req_id: reqId });
    if (error) {
      toast.error("Lỗi xóa", { description: error.message });
    } else {
      toast.success("Đã xóa yêu cầu");
      fetchRequests();
    }
  };

  // First-step status based on requester's role workflow
  const firstStepForRole = (r: string | null | undefined): string => {
    if (r === 'manager') return 'cho_quan_ly_chung';
    if (r === 'manager_chung') return 'cho_phap_che';
    if (r === 'admin' || r === 'accountant' || r === 'finance') return 'cho_quan_ly_chung';
    return 'cho_quan_ly'; // user
  };
  const canDeleteRequest = (req: any): boolean => {
    if (!req) return false;
    if (role === 'admin') return true; // Pháp chế/admin có quyền rộng hơn
    if (user?.id !== req.requester_id) return false;
    return req.status === firstStepForRole(role);
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


  const hasAllReviewerRoles = globalManagers.length > 0 && legalReviewers.length > 0 && accountantReviewers.length > 0 && financeReviewers.length > 0;

  const calculatedContractValue = form.contract_value_na ? 0 : paymentPhases.reduce((sum, p) => sum + (p.is_na ? 0 : (parseInt(p.payment_amount) || 0)), 0);

  const isFormValid = form.contract_title && form.approved_pe_number.trim() && form.partner_name.trim() && form.review_deadline && form.contract_start_date && form.contract_end_date && form.description.trim() && form.department && form.contract_type_category && form.tax_code.trim() && (isDirectSubmit || form.manager_id) && isValidGoogleDocUrl(form.google_doc_url) && paymentPhases.every(p => (p.is_na || (p.payment_amount && parseInt(p.payment_amount) > 0)) && p.payment_due_date) && hasAllReviewerRoles;

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
              {!hasAllReviewerRoles && (
                <div className="p-3 bg-destructive/10 text-destructive text-sm rounded-md border border-destructive/20 mb-4">
                  Hệ thống chưa cấu hình đủ người duyệt (Quản lý chung, Pháp chế, Kế toán, Tài chính). Vui lòng liên hệ Admin để thêm đủ người vào các vai trò này trước khi tạo yêu cầu.
                </div>
              )}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2" id="field-department">
                  <Label className={formErrors.department ? "text-destructive" : ""}>Phòng ban *</Label>
                  <Select value={form.department} onValueChange={(v) => setForm({ ...form, department: v, manager_id: "" })}>
                    <SelectTrigger className={formErrors.department ? "border-destructive focus:ring-destructive" : ""}><SelectValue placeholder="Chọn phòng ban" /></SelectTrigger>
                    <SelectContent>
                      {DEPARTMENTS.map((dept) => (
                        <SelectItem key={dept.id} value={dept.id}>{dept.id} - {dept.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {formErrors.department && <p className="text-xs text-destructive">{formErrors.department}</p>}
                </div>
                <div className="space-y-2" id="field-manager_id">
                  <Label className={formErrors.manager_id ? "text-destructive" : ""}>Người quản lý *</Label>
                  <Select value={form.manager_id} onValueChange={(v) => setForm({ ...form, manager_id: v })}>
                    <SelectTrigger className={formErrors.manager_id ? "border-destructive focus:ring-destructive" : ""}><SelectValue placeholder={managers.length === 0 ? "Chọn phòng ban trước" : "Chọn quản lý"} /></SelectTrigger>
                    <SelectContent>
                      {managers.map((m) => (
                        <SelectItem key={m.user_id} value={m.user_id}>{m.full_name || "Chưa đặt tên"}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {formErrors.manager_id && <p className="text-xs text-destructive">{formErrors.manager_id}</p>}
                </div>
              </div>

              {/* --- ADVANCED REVIEWER ASSIGNMENT (USER VIEW - READONLY IF NOT AUTO-ASSIGNABLE) --- */}
              <div className="grid grid-cols-2 gap-4 mb-4 p-3 border rounded-md bg-muted/20">
                <div className="space-y-2">
                  <Label>Quản lý chung (Bước 2)</Label>
                  {globalManagers.length === 1 ? (
                    <p className="text-sm font-medium text-muted-foreground bg-muted p-2 rounded">{globalManagers[0].full_name || globalManagers[0].email}</p>
                  ) : (
                    <p className="text-sm italic text-muted-foreground bg-muted p-2 rounded border border-dashed">Sẽ được phân công bởi Admin</p>
                  )}
                </div>

                <div className="space-y-2">
                  <Label>Pháp chế (Bước 3)</Label>
                  {legalReviewers.length === 1 ? (
                    <p className="text-sm font-medium text-muted-foreground bg-muted p-2 rounded">{legalReviewers[0].full_name || legalReviewers[0].email}</p>
                  ) : (
                    <p className="text-sm italic text-muted-foreground bg-muted p-2 rounded border border-dashed">Sẽ được phân công bởi Admin</p>
                  )}
                </div>

                <div className="space-y-2">
                  <Label>Kế toán (Bước 4)</Label>
                  {accountantReviewers.length === 1 ? (
                    <p className="text-sm font-medium text-muted-foreground bg-muted p-2 rounded">{accountantReviewers[0].full_name || accountantReviewers[0].email}</p>
                  ) : (
                    <p className="text-sm italic text-muted-foreground bg-muted p-2 rounded border border-dashed">Sẽ được phân công bởi Admin</p>
                  )}
                </div>

              </div>


              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2" id="field-contract_type_category">
                  <Label className={formErrors.contract_type_category ? "text-destructive" : ""}>Loại văn bản *</Label>
                  <Select value={form.contract_type_category} onValueChange={(v) => setForm({ ...form, contract_type_category: v })}>
                    <SelectTrigger className={formErrors.contract_type_category ? "border-destructive focus:ring-destructive" : ""}><SelectValue placeholder="Chọn loại" /></SelectTrigger>
                    <SelectContent>
                      {CONTRACT_TYPE_CATEGORIES.map((t) => (
                        <SelectItem key={t} value={t}>{t}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {formErrors.contract_type_category && <p className="text-xs text-destructive">{formErrors.contract_type_category}</p>}
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
              <div className="space-y-2" id="field-contract_title">
                <Label className={formErrors.contract_title ? "text-destructive" : ""}>Tên văn bản *</Label>
                <Input className={formErrors.contract_title ? "border-destructive focus-visible:ring-destructive" : ""} value={form.contract_title} onChange={(e) => setForm({ ...form, contract_title: e.target.value })} placeholder="VD: Hợp đồng mua bán thiết bị" />
                {formErrors.contract_title && <p className="text-xs text-destructive">{formErrors.contract_title}</p>}
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2" id="field-partner_name">
                  <Label className={formErrors.partner_name ? "text-destructive" : ""}>Tên đối tác *</Label>
                  <Input className={formErrors.partner_name ? "border-destructive focus-visible:ring-destructive" : ""} value={form.partner_name} onChange={(e) => setForm({ ...form, partner_name: e.target.value })} placeholder="Tên công ty đối tác" />
                  {formErrors.partner_name && <p className="text-xs text-destructive">{formErrors.partner_name}</p>}
                </div>
                <div className="space-y-2" id="field-tax_code">
                  <Label className={formErrors.tax_code ? "text-destructive" : ""}>Mã số thuế đối tác *</Label>
                  <Input className={formErrors.tax_code ? "border-destructive focus-visible:ring-destructive" : ""} value={form.tax_code} onChange={(e) => setForm({ ...form, tax_code: e.target.value })} placeholder="VD: 0123456789" />
                  {formErrors.tax_code && <p className="text-xs text-destructive">{formErrors.tax_code}</p>}
                </div>
              </div>
              <div className="space-y-2" id="field-contract_value">
                <div className="flex items-center gap-3">
                  <Label>Giá trị hợp đồng (VNĐ)</Label>
                  <div className="flex items-center gap-1.5">
                    <Checkbox checked={form.contract_value_na} onCheckedChange={(v) => setForm({ ...form, contract_value_na: !!v, contract_value: "" })} id="value-na" />
                    <label htmlFor="value-na" className="text-xs text-muted-foreground cursor-pointer">N/A</label>
                  </div>
                </div>
                {!form.contract_value_na ? (
                  <div>
                    <Input
                      type="text"
                      readOnly
                      disabled
                      value={calculatedContractValue > 0 ? new Intl.NumberFormat('vi-VN').format(calculatedContractValue) + ' VNĐ' : '0'}
                      className="bg-muted cursor-not-allowed"
                    />
                    <p className="text-xs text-muted-foreground mt-1">
                      Tự động tính từ {paymentPhases.filter(p => !p.is_na).length} đợt thanh toán
                    </p>
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground italic">N/A</p>
                )}
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2 col-span-2 sm:col-span-1" id="field-review_deadline">
                  <Label className={formErrors.review_deadline ? "text-destructive" : ""}>Hạn review *</Label>
                  <Input className={formErrors.review_deadline ? "border-destructive focus-visible:ring-destructive" : ""} type="date" value={form.review_deadline} onChange={(e) => setForm({ ...form, review_deadline: e.target.value })} />
                  {formErrors.review_deadline && <p className="text-xs text-destructive">{formErrors.review_deadline}</p>}
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2" id="field-contract_start_date">
                  <Label className={formErrors.contract_start_date ? "text-destructive" : ""}>Ngày bắt đầu HĐ *</Label>
                  <Input className={formErrors.contract_start_date ? "border-destructive focus-visible:ring-destructive" : ""} type="date" value={form.contract_start_date} onChange={(e) => setForm({ ...form, contract_start_date: e.target.value })} />
                  {formErrors.contract_start_date && <p className="text-xs text-destructive">{formErrors.contract_start_date}</p>}
                </div>
                <div className="space-y-2" id="field-contract_end_date">
                  <Label className={formErrors.contract_end_date ? "text-destructive" : ""}>Ngày kết thúc HĐ *</Label>
                  <Input className={formErrors.contract_end_date ? "border-destructive focus-visible:ring-destructive" : ""} type="date" value={form.contract_end_date} onChange={(e) => setForm({ ...form, contract_end_date: e.target.value })} />
                  {formErrors.contract_end_date && <p className="text-xs text-destructive">{formErrors.contract_end_date}</p>}
                </div>
              </div>
              <div className="space-y-2" id="field-google_doc_url">
                <Label className={formErrors.google_doc_url ? "text-destructive" : ""}>Link Google Doc *</Label>
                <div className="flex gap-2">
                  <Input
                    type="url"
                    value={form.google_doc_url}
                    onChange={(e) => setForm({ ...form, google_doc_url: e.target.value })}
                    placeholder="Dán link Google Doc (đã cấp quyền chỉnh sửa)"
                    className={`flex-1 ${formErrors.google_doc_url ? "border-destructive focus-visible:ring-destructive" : ""}`}
                    title="Link phải cho phép người được phân công có quyền edit"
                  />
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="shrink-0 gap-1.5"
                    onClick={openSharedGoogleDriveFolder}
                    title="Mở folder chung để tạo hợp đồng"
                  >
                    <FolderOpen className="h-4 w-4" />
                    Tạo Google Doc
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="shrink-0 gap-1.5"
                    disabled={aiExtracting || !form.google_doc_url}
                    onClick={handleAiExtract}
                  >
                    {aiExtracting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
                    {aiExtracting ? "Đang cập nhật..." : "AI đọc HĐ"}
                  </Button>
                </div>
                {formErrors.google_doc_url && <p className="text-xs text-destructive">{formErrors.google_doc_url}</p>}
                <p className="text-xs text-muted-foreground">
                  ⚠️ Vui lòng tạo Google Doc trong folder chung để đảm bảo quản lý tập trung.
                </p>
                {aiExtracting && (
                  <div className="flex items-center gap-2 p-2 rounded bg-accent/10 border border-accent/20">
                    <Loader2 className="h-3 w-3 animate-spin text-accent" />
                    <span className="text-xs text-accent">
                      {validSupplementaryDocs.length > 0 ? "Đang cập nhật nội dung mới từ hợp đồng + văn bản bổ sung..." : "Đang cập nhật nội dung mới từ hợp đồng..."}
                    </span>
                  </div>
                )}
              </div>
              <div className="space-y-2" id="field-approved_pe_number">
                <Label className={formErrors.approved_pe_number ? "text-destructive" : ""}>Số PE đã duyệt *</Label>
                <Input className={formErrors.approved_pe_number ? "border-destructive focus-visible:ring-destructive" : ""} value={form.approved_pe_number} onChange={(e) => setForm({ ...form, approved_pe_number: e.target.value })} placeholder="VD: PE-2026-001" />
                {formErrors.approved_pe_number && <p className="text-xs text-destructive">{formErrors.approved_pe_number}</p>}
              </div>

              {/* Payment Schedule Section */}
              <div className="space-y-3 p-4 rounded-lg border bg-muted/20" id="payment-schedules-section">
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
                          <span className={formErrors[`payment_amount_${idx}`] ? "text-xs text-destructive" : "text-xs text-muted-foreground"}>Giá trị (VNĐ)</span>
                          <div className="flex items-center gap-1">
                            <Checkbox checked={phase.is_na} onCheckedChange={(v) => updatePaymentPhase(idx, "is_na", !!v)} />
                            <span className="text-xs text-muted-foreground">N/A</span>
                          </div>
                        </div>
                        {!phase.is_na && (
                          <Input
                            type="number"
                            className={formErrors[`payment_amount_${idx}`] ? "border-destructive focus-visible:ring-destructive" : ""}
                            value={phase.payment_amount}
                            onChange={(e) => updatePaymentPhase(idx, "payment_amount", e.target.value)}
                            placeholder="0"
                          />
                        )}
                        {formErrors[`payment_amount_${idx}`] && <p className="text-xs text-destructive mt-1">{formErrors[`payment_amount_${idx}`]}</p>}
                      </div>
                      <div>
                        <span className={formErrors[`payment_due_date_${idx}`] ? "text-xs text-destructive" : "text-xs text-muted-foreground"}>Ngày thanh toán *</span>
                        <Input
                          type="date"
                          className={formErrors[`payment_due_date_${idx}`] ? "border-destructive focus-visible:ring-destructive" : ""}
                          value={phase.payment_due_date}
                          onChange={(e) => updatePaymentPhase(idx, "payment_due_date", e.target.value)}
                        />
                        {formErrors[`payment_due_date_${idx}`] && <p className="text-xs text-destructive mt-1">{formErrors[`payment_due_date_${idx}`]}</p>}
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              <div className="space-y-2" id="field-description">
                <Label className={formErrors.description ? "text-destructive" : ""}>Mô tả chi tiết *</Label>
                <Textarea className={`${formErrors.description ? "border-destructive focus-visible:ring-destructive" : ""} ${aiDescriptionUpdated ? "border-accent ring-2 ring-accent/20" : ""}`} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="Mô tả thêm về hợp đồng cần review..." rows={3} />
                {aiDescriptionUpdated && <p className="text-xs text-accent">Nội dung đã được cập nhật từ phiên bản mới của tài liệu</p>}
                {formErrors.description && <p className="text-xs text-destructive">{formErrors.description}</p>}
              </div>

              {editingReqId && (
                <div className="space-y-2">
                  <Label>Link tài liệu đã review</Label>
                  <Input
                    type="url"
                    value={form.legal_review_doc_link}
                    onChange={(e) => setForm({ ...form, legal_review_doc_link: e.target.value })}
                    placeholder="Dán link Google Doc đã review (có /edit)"
                    className={form.legal_review_doc_link && !isValidGoogleDocUrl(form.legal_review_doc_link) ? "border-destructive focus-visible:ring-destructive" : ""}
                  />
                  {form.legal_review_doc_link && !isValidGoogleDocUrl(form.legal_review_doc_link) && (
                    <p className="text-xs text-destructive">Link Google Doc phải có quyền chỉnh sửa (/edit), không phải /view hay /preview.</p>
                  )}
                  <p className="text-xs text-muted-foreground">Để trống nếu chưa có. Có thể cập nhật/sửa link tài liệu đã review tại đây.</p>
                </div>
              )}

              {/* Supplementary Documents */}
              <div className="space-y-3 p-4 rounded-lg border bg-muted/20">
                <div className="flex items-center justify-between">
                  <Label className="text-sm font-semibold">Văn bản bổ sung (nếu có)</Label>
                  <Button type="button" variant="outline" size="sm" onClick={() => setSupplementaryDocs([...supplementaryDocs, { doc_name: "", doc_url: "" }])}>
                    + Thêm văn bản
                  </Button>
                </div>
                {supplementaryDocs.length === 0 && (
                  <p className="text-xs text-muted-foreground italic">Chưa có văn bản bổ sung. Nhấn "Thêm văn bản" để đính kèm tài liệu.</p>
                )}
                {supplementaryDocs.map((doc, idx) => (
                  <div key={idx} className="space-y-2 p-3 rounded border bg-background">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-medium text-muted-foreground">Văn bản {idx + 1}</span>
                      <Button type="button" variant="ghost" size="sm" className="text-destructive text-xs h-6 px-2" onClick={() => setSupplementaryDocs(supplementaryDocs.filter((_, i) => i !== idx))}>
                        ✕ Xóa
                      </Button>
                    </div>
                    <Input placeholder="Tên văn bản" value={doc.doc_name} onChange={(e) => {
                      const updated = [...supplementaryDocs];
                      updated[idx] = { ...updated[idx], doc_name: e.target.value };
                      setSupplementaryDocs(updated);
                    }} />
                    <Input placeholder="Link văn bản (URL)" value={doc.doc_url} onChange={(e) => {
                      const updated = [...supplementaryDocs];
                      updated[idx] = { ...updated[idx], doc_url: e.target.value };
                      setSupplementaryDocs(updated);
                    }} />
                  </div>
                ))}
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={handleResetForm}>Hủy</Button>
              <Button className="bg-accent hover:bg-accent/90 text-accent-foreground" onClick={handleSubmit} disabled={submitting}>
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
        {requests.filter(req => routeReqId ? req.id === routeReqId : true).map((req, i) => {
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
                    <DepartmentReviewTracker deptReviews={deptReviews} assignedReviewers={getAssignedReviewers(req)} compact skipManagerStep={!!req.admin_notes?.includes("Quản lý chung duyệt")} reviewers={[...reviewers, ...globalManagers]} />
                    <Badge className={STATUS_COLORS[req.status] || ""}>{STATUS_LABELS[req.status] || req.status}</Badge>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="pt-0 space-y-4">
                <div className="grid grid-cols-2 sm:grid-cols-5 gap-4 p-3 rounded-lg bg-muted/40">
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
                  <div>
                    <p className="text-xs text-muted-foreground">Ngày tạo yêu cầu</p>
                    <p className="text-sm font-medium">{req.created_at ? formatDate(req.created_at) : "—"}</p>
                  </div>
                </div>

                {/* Mô tả chi tiết - collapsible */}
                <Collapsible>
                  <div className="rounded-lg border bg-card">
                    <CollapsibleTrigger asChild>
                      <button type="button" onClick={(e) => e.stopPropagation()} className="w-full flex items-center justify-between px-3 py-2.5 hover:bg-muted/40 rounded-lg transition-colors group">
                        <div className="flex items-center gap-2">
                          <FileText className="w-4 h-4 text-accent" />
                          <span className="text-sm font-medium">Mô tả chi tiết</span>
                        </div>
                        <ChevronDown className="w-4 h-4 text-muted-foreground transition-transform group-data-[state=open]:rotate-180" />
                      </button>
                    </CollapsibleTrigger>
                    <CollapsibleContent>
                      <div className="px-3 pb-3 pt-1 text-sm whitespace-pre-wrap" onClick={(e) => e.stopPropagation()}>
                        {req.description || <span className="text-muted-foreground italic">Không có mô tả</span>}
                      </div>
                    </CollapsibleContent>
                  </div>
                </Collapsible>


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
                        Xem tài liệu đã review
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

                {/* Nhận xét các bước duyệt - filtered by role, collapsible */}
                {(() => {
                  const deptReviews = extractDeptReviews(notes[req.id] || []);
                  const visibleNotes = getVisibleDeptNotes(
                    deptReviews,
                    role || 'user',
                    !!(user?.id === req.requester_id && role === 'user'),
                    !!req.admin_notes?.includes("Quản lý chung duyệt")
                  );
                  return visibleNotes.length > 0 ? (
                    <Collapsible>
                      <div className="rounded-lg border bg-card">
                        <CollapsibleTrigger asChild>
                          <button type="button" onClick={(e) => e.stopPropagation()} className="w-full flex items-center justify-between px-3 py-2.5 hover:bg-muted/40 rounded-lg transition-colors group">
                            <div className="flex items-center gap-2">
                              <MessageCircle className="w-4 h-4 text-accent" />
                              <span className="text-sm font-medium">Nhận xét các bước duyệt ({visibleNotes.length})</span>
                            </div>
                            <ChevronDown className="w-4 h-4 text-muted-foreground transition-transform group-data-[state=open]:rotate-180" />
                          </button>
                        </CollapsibleTrigger>
                        <CollapsibleContent>
                          <div className="px-3 pb-3 pt-1 space-y-1.5" onClick={(e) => e.stopPropagation()}>
                            {visibleNotes.map(({ dept, review, label }) => (
                              <div key={dept} className="p-2.5 rounded-lg bg-muted/30 border text-sm">
                                <div className="flex items-center justify-between mb-0.5">
                                  <span className="font-medium text-xs">{label}</span>
                                  <div className="flex items-center gap-2">
                                    {review.reviewerName && <span className="text-xs text-muted-foreground">{review.reviewerName}</span>}
                                    {review.reviewedAt && <span className="text-xs text-muted-foreground">{formatDate(review.reviewedAt)}</span>}
                                  </div>
                                </div>
                                <p className="text-muted-foreground italic text-xs">"{review.notes}"</p>
                              </div>
                            ))}
                          </div>
                        </CollapsibleContent>
                      </div>
                    </Collapsible>
                  ) : null;
                })()}

                <InternalChat
                  requestId={req.id}
                  contractTitle={req.contract_title}
                  shouldScrollOnMount={routeReqId === req.id && typeof window !== "undefined" && (window.location.hash.includes("internal-chat") || window.location.hash.includes("msg-"))}
                />


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

                {canDeleteRequest(req) && (
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
      {activeReqId && requests.find(r => r.id === activeReqId) && (() => {
        const req = requests.find(r => r.id === activeReqId)!;
        const deptReviews = extractDeptReviews(notes[req.id] || []);

        return (
          <Dialog open={true} onOpenChange={(open) => {
            if (!open) {
              if (routeReqId && activeReqId === routeReqId) {
                setClosedRouteIds(prev => new Set(prev).add(routeReqId));
              }
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
                      <DepartmentReviewTracker deptReviews={deptReviews} assignedReviewers={getAssignedReviewers(req)} compact skipManagerStep={!!req.admin_notes?.includes("Quản lý chung duyệt")} reviewers={[...reviewers, ...globalManagers]} />
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

                  {/* Mô tả chi tiết - collapsible */}
                  <Collapsible>
                    <div className="rounded-lg border bg-card">
                      <CollapsibleTrigger asChild>
                        <button type="button" onClick={(e) => e.stopPropagation()} className="w-full flex items-center justify-between px-3 py-2.5 hover:bg-muted/40 rounded-lg transition-colors group">
                          <div className="flex items-center gap-2">
                            <FileText className="w-4 h-4 text-accent" />
                            <span className="text-sm font-medium">Mô tả chi tiết</span>
                          </div>
                          <ChevronDown className="w-4 h-4 text-muted-foreground transition-transform group-data-[state=open]:rotate-180" />
                        </button>
                      </CollapsibleTrigger>
                      <CollapsibleContent>
                        <div className="px-3 pb-3 pt-1 text-sm whitespace-pre-wrap" onClick={(e) => e.stopPropagation()}>
                          {req.description || <span className="text-muted-foreground italic">Không có mô tả</span>}
                        </div>
                      </CollapsibleContent>
                    </div>
                  </Collapsible>


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
                          Xem tài liệu đã review
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

                  {/* Nhận xét các bước duyệt - filtered by role, collapsible */}
                  {(() => {
                    const visibleNotes = getVisibleDeptNotes(
                      deptReviews,
                      role || 'user',
                      !!(user?.id === req.requester_id && role === 'user'),
                      !!req.admin_notes?.includes("Quản lý chung duyệt")
                    );
                    return visibleNotes.length > 0 ? (
                      <Collapsible>
                        <div className="rounded-lg border bg-card">
                          <CollapsibleTrigger asChild>
                            <button type="button" onClick={(e) => e.stopPropagation()} className="w-full flex items-center justify-between px-3 py-2.5 hover:bg-muted/40 rounded-lg transition-colors group">
                              <div className="flex items-center gap-2">
                                <MessageCircle className="w-4 h-4 text-accent" />
                                <span className="text-sm font-medium">Nhận xét các bước duyệt ({visibleNotes.length})</span>
                              </div>
                              <ChevronDown className="w-4 h-4 text-muted-foreground transition-transform group-data-[state=open]:rotate-180" />
                            </button>
                          </CollapsibleTrigger>
                          <CollapsibleContent>
                            <div className="px-3 pb-3 pt-1 space-y-1.5" onClick={(e) => e.stopPropagation()}>
                              {visibleNotes.map(({ dept, review, label }) => (
                                <div key={dept} className="p-2.5 rounded-lg bg-muted/30 border text-sm">
                                  <div className="flex items-center justify-between mb-0.5">
                                    <span className="font-medium text-xs">{label}</span>
                                    <div className="flex items-center gap-2">
                                      {review.reviewerName && <span className="text-xs text-muted-foreground">{review.reviewerName}</span>}
                                      {review.reviewedAt && <span className="text-xs text-muted-foreground">{formatDate(review.reviewedAt)}</span>}
                                    </div>
                                  </div>
                                  <p className="text-muted-foreground italic text-xs">"{review.notes}"</p>
                                </div>
                              ))}
                            </div>
                          </CollapsibleContent>
                        </div>
                      </Collapsible>
                    ) : null;
                  })()}

                  <InternalChat
                    requestId={req.id}
                    contractTitle={req.contract_title}
                    shouldScrollOnMount={routeReqId === req.id && typeof window !== "undefined" && (window.location.hash.includes("internal-chat") || window.location.hash.includes("msg-"))}
                  />


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

                  {canDeleteRequest(req) && (
                    <div className="flex justify-end gap-2 mt-4 pt-4 border-t">
                      <Button variant="outline" size="sm" className="text-xs" onClick={() => {
                        handleEdit(req);
                        // Note: deep link dialog should ideally close when editing, but opening edit on top is fine too
                      }}>
                        Chỉnh sửa
                      </Button>
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button variant="outline" size="sm" className="text-xs text-destructive hover:text-destructive hover:bg-destructive/10">
                            Xóa yêu cầu
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent className="z-[100]">
                          <AlertDialogHeader>
                            <AlertDialogTitle>Xác nhận xóa?</AlertDialogTitle>
                            <AlertDialogDescription>Yêu cầu review "{req.contract_title}" sẽ bị xóa vĩnh viễn.</AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Hủy</AlertDialogCancel>
                            <AlertDialogAction onClick={() => {
                              handleDelete(req.id);
                              searchParams.delete('id');
                              setSearchParams(searchParams);
                            }} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">Xóa</AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
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
