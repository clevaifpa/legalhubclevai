import { useState, useEffect, useCallback, useRef } from "react";
import { useSearchParams, useParams } from "react-router-dom";
import { EntitySyncButton } from "@/components/EntitySyncButton";
import { X, Plus, GripVertical, Trash2 } from "lucide-react";
import { InlineEditCell } from "@/components/contracts/InlineEditCell";
import { ContractLinkCell, getLinkType } from "@/components/contracts/ContractLinkCell";
import type { LinkItem } from "@/components/contracts/ContractLinkCell";
import { supabase } from "@/integrations/supabase/client";
import { useAuth, getEmployeeName } from "@/hooks/useAuth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter,
} from "@/components/ui/dialog";
import {
  Accordion, AccordionContent, AccordionItem, AccordionTrigger,
} from "@/components/ui/accordion";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { formatCurrency, formatDate } from "@/lib/format";
import { notifyAdminsOnContractUpload, notifyAdminsOnContractDeletion } from "@/lib/notifications";
import { DepartmentReviewTracker } from "@/components/common/DepartmentReviewTracker";
import { toast } from "sonner";

const DEPARTMENTS = [
  { id: "LVO", name: "Khối Vận hành" },
  { id: "LVS", name: "Khối Kinh doanh" },
  { id: "LVH", name: "Khối Nhân sự" },
  { id: "LVD", name: "Khối Phát triển mới" },
  { id: "LVB", name: "Khối Back-office" },
  { id: "LVI", name: "Khối Kỹ thuật" },
];

const sanitizeFileName = (name: string): string => {
  return name.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/đ/g, "d").replace(/Đ/g, "D").replace(/\s+/g, "_").replace(/[^a-zA-Z0-9._-]/g, "");
};

const isValidPdfLink = (url: string) => {
  if (!url) return false;
  const lowerUrl = url.toLowerCase();
  return lowerUrl.includes('.pdf') || lowerUrl.includes('drive.google.com/file/d/');
};

const STATUS_LABELS: Record<string, string> = {
  da_ky: "Đã ký",
  het_hieu_luc: "Đã hết hạn",
  het_hieu_luc_chua_hoan_thanh: "Hết hiệu lực - Chưa hoàn thành nghĩa vụ",
  da_thanh_ly: "Đã thanh lý",
};

interface PaymentPhase {
  phase_name: string;
  payment_amount: string;
  payment_due_date: string;
}

const ContractCategories = () => {
  const { user, role, profile } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const { contractId: routeContractId } = useParams();
  const [closedRouteIds, setClosedRouteIds] = useState<Set<string>>(new Set());
  const categoryIdParam = searchParams.get('categoryId');
  const contractIdParamSearch = searchParams.get('contractId');
  const activeContractId = (routeContractId && !closedRouteIds.has(routeContractId)) ? routeContractId : contractIdParamSearch;
  const isAdmin = role === "admin";
  const canEdit = role === "admin" || role === "accountant" || role === "finance" || role === "manager_chung";
  const canEditContract = (c: any) => isAdmin || role === "manager_chung" || c.created_by === user?.id;
  const canInlineEdit = role === "admin" || role === "manager_chung";
  const isViewOnly = false;
  const [categories, setCategories] = useState<any[]>([]);
  const [contracts, setContracts] = useState<any[]>([]);
  const [contractPayments, setContractPayments] = useState<Record<string, any[]>>({});
  const [contractRelatedDocs, setContractRelatedDocs] = useState<Record<string, any[]>>({});
  const [selectedContractIds, setSelectedContractIds] = useState<Set<string>>(new Set());
  const [bulkDeleting, setBulkDeleting] = useState(false);
  const [categoryCounts, setCategoryCounts] = useState<Record<string, number>>({});
  const [selectedCategory, setSelectedCategory] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [uploadDialogOpen, setUploadDialogOpen] = useState(false);
  const [newCatName, setNewCatName] = useState("");
  const [newCatDesc, setNewCatDesc] = useState("");
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [newCatEntity, setNewCatEntity] = useState("CHV");
  const [addEntityDialogOpen, setAddEntityDialogOpen] = useState(false);
  const [newEntityName, setNewEntityName] = useState("");
  const [globalSearchTerm, setGlobalSearchTerm] = useState("");
  const [globalSearchDebounced, setGlobalSearchDebounced] = useState("");
  const [globalResults, setGlobalResults] = useState<any[]>([]);
  const [globalResultPayments, setGlobalResultPayments] = useState<Record<string, any[]>>({});
  const [globalSearching, setGlobalSearching] = useState(false);
  const [globalSelectedContract, setGlobalSelectedContract] = useState<any>(null);
  const [entityOrder, setEntityOrder] = useState<Record<string, number>>({});
  const [draggedEntity, setDraggedEntity] = useState<string | null>(null);
  const [dragOverEntity, setDragOverEntity] = useState<string | null>(null);
  // Description popup
  const [descriptionPopupContract, setDescriptionPopupContract] = useState<any>(null);
  // Related docs add dialog
  const [addDocDialogContractId, setAddDocDialogContractId] = useState<string | null>(null);
  const [newDocType, setNewDocType] = useState("bien_ban_nghiem_thu");
  const [newDocCustomName, setNewDocCustomName] = useState("");
  const [newDocUrl, setNewDocUrl] = useState("");

  const DOC_TYPE_OPTIONS = [
    { value: "bien_ban_nghiem_thu", label: "Biên bản nghiệm thu" },
    { value: "thanh_ly", label: "Thanh lý" },
    { value: "phu_luc_hop_dong", label: "Phụ lục hợp đồng" },
    { value: "khac", label: "Khác" },
  ];

  const getDocDisplayName = useCallback((doc: any, allDocs: any[]) => {
    if (doc.doc_type === "folder") return doc.doc_name || "Folder";
    if (doc.doc_type === "pdf") return doc.doc_name || "PDF";
    if (doc.doc_type === "doc") return doc.doc_name || "DOC";
    if (doc.doc_type === "phu_luc_hop_dong") {
      const appendices = allDocs.filter(d => d.doc_type === "phu_luc_hop_dong").sort((a: any, b: any) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
      const idx = appendices.findIndex((d: any) => d.id === doc.id);
      return `Phụ lục hợp đồng ${idx + 1}`;
    }
    if (doc.doc_type === "khac") return doc.doc_name || "Khác";
    const found = DOC_TYPE_OPTIONS.find(o => o.value === doc.doc_type);
    return found?.label || doc.doc_type;
  }, []);

  const [form, setForm] = useState({
    title: "", partner_name: "", contract_type: "khac", status: "da_ky",
    value: "", effective_date: "", expiry_date: "", department: "",
    risk_level: "thap", tax_code: "", file_link: "",
  });
  const [paymentPhases, setPaymentPhases] = useState<PaymentPhase[]>([
    { phase_name: "Đợt 01", payment_amount: "", payment_due_date: "" },
  ]);

  const addPaymentPhase = () => {
    const num = paymentPhases.length + 1;
    setPaymentPhases([...paymentPhases, { phase_name: `Đợt ${String(num).padStart(2, "0")}`, payment_amount: "", payment_due_date: "" }]);
  };

  const removePaymentPhase = (idx: number) => {
    if (paymentPhases.length <= 1) return;
    setPaymentPhases(paymentPhases.filter((_, i) => i !== idx));
  };

  const fetchCategories = async () => {
    const { data } = await supabase.from("contract_categories").select("*").order("name");
    if (data) {
      setCategories(data);
      let query = supabase.from("contracts").select("category_id");
      const { data: allContracts } = await query;
      if (allContracts) {
        const counts: Record<string, number> = {};
        allContracts.forEach((c: any) => { if (c.category_id) counts[c.category_id] = (counts[c.category_id] || 0) + 1; });
        setCategoryCounts(counts);
      }
    }
    setLoading(false);
  };

  const fetchContracts = async (categoryId: string) => {
    let query = supabase.from("contracts").select("*").eq("category_id", categoryId).order("created_at", { ascending: false });
    const { data } = await query;
    if (data) {
      setContracts(data);
      const ids = data.map((c: any) => c.id);
      if (ids.length > 0) {
        const { data: payments } = await supabase.from("contract_payment_schedules").select("*").in("contract_id", ids).order("created_at", { ascending: true });
        if (payments) {
          const grouped: Record<string, any[]> = {};
          payments.forEach((p: any) => {
            if (!grouped[p.contract_id]) grouped[p.contract_id] = [];
            grouped[p.contract_id].push(p);
          });
          setContractPayments(grouped);
        }
        const { data: relDocs } = await supabase.from("contract_related_docs").select("*").in("contract_id", ids).order("created_at", { ascending: true });
        if (relDocs) {
          const grouped: Record<string, any[]> = {};
          relDocs.forEach((d: any) => {
            if (!grouped[d.contract_id]) grouped[d.contract_id] = [];
            grouped[d.contract_id].push(d);
          });
          setContractRelatedDocs(grouped);
        }
      }
    }
  };

  const fetchEntityOrder = async () => {
    const { data } = await supabase.from("entity_order").select("entity_name, order_index").order("order_index");
    if (data) {
      const order: Record<string, number> = {};
      data.forEach((r: any) => { order[r.entity_name] = r.order_index; });
      setEntityOrder(order);
    }
  };

  useEffect(() => { fetchCategories(); fetchEntityOrder(); }, []);
  useEffect(() => { if (selectedCategory) fetchContracts(selectedCategory.id); }, [selectedCategory, activeContractId]);

  const handleAddRelatedDoc = async () => {
    if (!addDocDialogContractId || !newDocUrl.trim()) return;
    if (newDocType === "khac" && !newDocCustomName.trim()) {
      toast.error("Vui lòng nhập tên văn bản");
      return;
    }
    const docName = newDocType === "khac" ? newDocCustomName.trim() : "";
    const { error } = await supabase.from("contract_related_docs").insert({
      contract_id: addDocDialogContractId,
      doc_type: newDocType,
      doc_name: docName,
      doc_url: newDocUrl.trim(),
    } as any);
    if (error) {
      toast.error("Lỗi thêm văn bản", { description: error.message });
    } else {
      toast.success("Đã thêm văn bản");
      setAddDocDialogContractId(null);
      setNewDocType("bien_ban_nghiem_thu");
      setNewDocCustomName("");
      setNewDocUrl("");
      if (selectedCategory) fetchContracts(selectedCategory.id);
    }
  };

  const handleDeleteRelatedDoc = async (docId: string) => {
    const { error } = await supabase.from("contract_related_docs").delete().eq("id", docId);
    if (error) toast.error("Lỗi xóa văn bản", { description: error.message });
    else {
      toast.success("Đã xóa văn bản");
      if (selectedCategory) fetchContracts(selectedCategory.id);
    }
  };

  // Debounce global search
  useEffect(() => {
    const timer = setTimeout(() => setGlobalSearchDebounced(globalSearchTerm), 300);
    return () => clearTimeout(timer);
  }, [globalSearchTerm]);

  // Fetch global search results
  useEffect(() => {
    if (!globalSearchDebounced.trim()) {
      setGlobalResults([]);
      setGlobalResultPayments({});
      return;
    }
    const doSearch = async () => {
      setGlobalSearching(true);
      // Fetch all contracts and filter client-side to avoid PostgREST .or() encoding issues with Vietnamese
      const { data } = await supabase
        .from("contracts")
        .select("*")
        .order("created_at", { ascending: false });
      if (data) {
        const term = globalSearchDebounced.trim().toLowerCase();
        const filtered = data.filter((c: any) =>
          c.title?.toLowerCase().includes(term) ||
          c.partner_name?.toLowerCase().includes(term) ||
          c.tax_code?.toLowerCase().includes(term) ||
          c.department?.toLowerCase().includes(term) ||
          (STATUS_LABELS[c.status] || c.status)?.toLowerCase().includes(term)
        ).slice(0, 50);
        setGlobalResults(filtered);
        const ids = filtered.map((c: any) => c.id);
        if (ids.length > 0) {
          const { data: payments } = await supabase.from("contract_payment_schedules").select("*").in("contract_id", ids).order("created_at", { ascending: true });
          if (payments) {
            const grouped: Record<string, any[]> = {};
            payments.forEach((p: any) => {
              if (!grouped[p.contract_id]) grouped[p.contract_id] = [];
              grouped[p.contract_id].push(p);
            });
            setGlobalResultPayments(grouped);
          }
        } else {
          setGlobalResultPayments({});
        }
      }
      setGlobalSearching(false);
    };
    doSearch();
  }, [globalSearchDebounced]);

  useEffect(() => {
    const resolveDeepLink = async () => {
      if (categories.length === 0) return;

      if (activeContractId) {
        // If contractId is in URL, we must ensure the correct category is selected
        // First check if it's already in the currently selected category's fetched contracts
        const currentContract = contracts.find(c => c.id === activeContractId);
        if (selectedCategory && currentContract) {
          return; // Already selected, and we have the contract data, nothing to do
        }

        // Fetch just the category_id of this contract
        const { data: contract, error } = await supabase.from("contracts").select("category_id").eq("id", activeContractId).single();
        if (error && error.code === 'PGRST116') {
          toast.error("Hợp đồng không còn tồn tại");
          if (routeContractId && activeContractId === routeContractId) {
            setClosedRouteIds(prev => new Set(prev).add(routeContractId));
          }
          searchParams.delete('contractId');
          setSearchParams(searchParams);
          return;
        }
        if (contract && contract.category_id) {
          const cat = categories.find(c => c.id === contract.category_id);
          if (cat && (!selectedCategory || selectedCategory.id !== cat.id)) {
            setSelectedCategory(cat);
          }
        }
      } else if (categoryIdParam) {
        // Fallback: if only categoryId is in URL
        const cat = categories.find(c => c.id === categoryIdParam);
        if (cat && (!selectedCategory || selectedCategory.id !== cat.id)) {
          setSelectedCategory(cat);
        }
      }
    };
    resolveDeepLink();
  }, [categoryIdParam, activeContractId, categories, routeContractId, searchParams, setSearchParams]);

  const handleAddCategory = async () => {
    if (!newCatName.trim()) return;
    setSaving(true);
    const fullName = `${newCatEntity} - ${newCatName.trim()}`;
    const { error } = await supabase.from("contract_categories").insert({ name: fullName, description: newCatDesc.trim(), created_by: user?.id });
    setSaving(false);
    if (error) toast.error("Lỗi", { description: error.message });
    else { toast.success("Đã tạo loại hợp đồng mới"); setDialogOpen(false); setNewCatName(""); setNewCatDesc(""); setNewCatEntity("CHV"); fetchCategories(); }
  };

  const handleDeleteCategory = async (catId: string) => {
    // Check if category has contracts
    const count = categoryCounts[catId] || 0;
    if (count > 0) {
      toast.error("Không thể xóa", { description: `Loại hợp đồng này đang chứa ${count} hợp đồng. Vui lòng xóa hoặc chuyển hết hợp đồng trước khi xóa loại.` });
      return;
    }
    const { error } = await supabase.from("contract_categories").delete().eq("id", catId);
    if (error) {
      if (error.message?.includes("foreign key")) {
        toast.error("Không thể xóa", { description: "Loại hợp đồng này vẫn còn hợp đồng liên kết. Hãy xóa hết hợp đồng bên trong trước." });
      } else {
        toast.error("Lỗi xóa", { description: error.message });
      }
    } else {
      toast.success("Đã xóa loại hợp đồng");
      fetchCategories();
    }
  };

  const handleDeleteContract = async (contract: any) => {
    const { error } = await (supabase.rpc as any)("delete_contract", { _contract_id: contract.id });
    if (error) {
      toast.error("Lỗi xóa", { description: error.message });
    } else {
      toast.success("Đã xóa hợp đồng");
      // Optimistic UI update - remove from state immediately
      setContracts(prev => prev.filter(c => c.id !== contract.id));
      setCategoryCounts(prev => {
        if (!contract.category_id) return prev;
        const newCounts = { ...prev };
        newCounts[contract.category_id] = Math.max(0, (newCounts[contract.category_id] || 1) - 1);
        return newCounts;
      });

      // If the current user is NOT an admin, trigger notification to admins
      if (!isAdmin && user && profile) {
        try {
          const uploaderName = user.email ? getEmployeeName(user.email) || profile.full_name || user.email : "Người dùng";
          await notifyAdminsOnContractDeletion(contract.title || "Không tên", uploaderName, contract.department || profile.department || "", contract.id, contract.category_id);
        } catch (err) {
          console.error("Failed to notify admins of deletion", err);
        }
      }
    }
  };

  const uploadFile = async (file: File, path: string) => {
    const { error } = await supabase.storage.from("contracts").upload(path, file, { upsert: true });
    if (error) throw error;
    return path;
  };

  const extractStoragePath = (urlOrPath: string): string => {
    const publicPrefix = "/storage/v1/object/public/contracts/";
    const idx = urlOrPath.indexOf(publicPrefix);
    if (idx !== -1) return urlOrPath.substring(idx + publicPrefix.length);
    return urlOrPath;
  };

  const openFile = (urlOrPath: string) => {
    const storagePath = extractStoragePath(urlOrPath);
    const { data } = supabase.storage.from("contracts").getPublicUrl(storagePath);
    window.open(data.publicUrl, "_blank");
  };

  const handleUploadContract = async () => {
    if (!form.title.trim() || !selectedCategory || !form.expiry_date) return;

    if (!form.file_link.trim()) {
      toast.error("Bắt buộc phải điền Link hợp đồng.");
      return;
    }

    if (!isValidPdfLink(form.file_link.trim())) {
      toast.error("Chỉ chấp nhận file PDF");
      return;
    }

    if (!form.partner_name.trim()) {
      toast.error("Bắt buộc nhập Tên đối tác.");
      return;
    }

    if (!form.department) {
      toast.error("Bắt buộc chọn Đơn vị phụ trách.");
      return;
    }

    setUploading(true);

    try {
      // Map UI status het_hieu_luc_chua_hoan_thanh to DB status het_hieu_luc
      const dbStatus = form.status === "het_hieu_luc_chua_hoan_thanh" ? "het_hieu_luc" : form.status;

      const { data: insertedContract, error } = await supabase.from("contracts").insert({
        title: form.title.trim(), partner_name: form.partner_name.trim(),
        contract_type: form.contract_type as any, status: dbStatus as any,
        value: paymentPhases.reduce((sum, p) => sum + (parseInt(p.payment_amount) || 0), 0), effective_date: form.effective_date || null,
        expiry_date: form.expiry_date, department: form.department,
        risk_level: form.risk_level as any, category_id: selectedCategory.id,
        created_by: user?.id, file_url: form.file_link.trim(),
        tax_code: form.tax_code.trim(),
      } as any).select().single();

      if (error) throw error;

      // Insert payment schedules
      if (insertedContract) {
        const validPhases = paymentPhases.filter(p => p.phase_name.trim());
        if (validPhases.length > 0) {
          const schedules = validPhases.map(p => ({
            contract_id: insertedContract.id,
            phase_name: p.phase_name,
            payment_amount: parseInt(p.payment_amount) || 0,
            payment_due_date: p.payment_due_date || null,
          }));

          if (form.status === "het_hieu_luc_chua_hoan_thanh") {
            schedules.push({
              contract_id: insertedContract.id,
              phase_name: "[HIDDEN] CHUA_HOAN_THANH",
              payment_amount: 0,
              payment_due_date: null,
            });
          }

          await supabase.from("contract_payment_schedules").insert(schedules as any);
        } else if (form.status === "het_hieu_luc_chua_hoan_thanh") {
          // If no valid phases, but they chose this status, we MUST create the hidden flag
          await supabase.from("contract_payment_schedules").insert({
            contract_id: insertedContract.id,
            phase_name: "[HIDDEN] CHUA_HOAN_THANH",
            payment_amount: 0,
            payment_due_date: null,
          } as any);
        }

        // Notify Admins safely without breaking the local UI flow
        try {
          const uploaderName = user?.email ? getEmployeeName(user.email) || profile?.full_name || user.email : "Người dùng";
          await notifyAdminsOnContractUpload(form.title.trim(), uploaderName, profile?.department || "", insertedContract.id, selectedCategory.id);
        } catch (notifErr) {
          console.warn("Lỗi gửi thông báo admin, upload vẫn thành công:", notifErr);
        }
      }

      toast.success("Đã thêm hợp đồng thành công");
      setUploadDialogOpen(false);
      resetForm();
      fetchContracts(selectedCategory.id);
    } catch (err: any) {
      toast.error("Lỗi", { description: err.message });
    }
    setUploading(false);
  };

  const handleMarkPaid = async (scheduleId: string, contractId: string) => {
    await supabase.from("contract_payment_schedules").update({ payment_status: "da_thanh_toan" } as any).eq("id", scheduleId);
    toast.success("Đã đánh dấu thanh toán");
    if (selectedCategory) fetchContracts(selectedCategory.id);
  };

  const handleUploadLiquidation = async (contractId: string, file: File) => {
    try {
      const path = `${user?.id}/${Date.now()}_liquidation_${sanitizeFileName(file.name)}`;
      const url = await uploadFile(file, path);
      await supabase.from("contracts").update({ liquidation_file_url: url } as any).eq("id", contractId);
      toast.success("Đã tải biên bản thanh lý");
      if (selectedCategory) fetchContracts(selectedCategory.id);
    } catch (err: any) { toast.error("Lỗi", { description: err.message }); }
  };

  const resetForm = () => {
    setForm({ title: "", partner_name: "", contract_type: "khac", status: "da_ky", value: "", effective_date: "", expiry_date: "", department: "", risk_level: "thap", tax_code: "", file_link: "" });
    setPaymentPhases([{ phase_name: "Đợt 01", payment_amount: "", payment_due_date: "" }]);
  };

  const handleInlineEdit = async (contractId: string, field: string, oldValue: any, newValue: any) => {
    if (String(oldValue ?? "") === String(newValue ?? "")) return;
    const updateData: any = {};
    if (field === "value") {
      updateData.value = parseInt(String(newValue)) || 0;
    } else if (field === "effective_date" || field === "expiry_date") {
      updateData[field] = newValue || null;
    } else {
      updateData[field] = newValue;
    }
    const { error } = await supabase.from("contracts").update(updateData).eq("id", contractId);
    if (error) {
      toast.error("Lỗi cập nhật", { description: error.message });
      return;
    }
    if (user && profile) {
      await supabase.from("edit_logs").insert({
        editor_id: user.id,
        editor_name: profile.full_name || user.email || "",
        record_id: contractId,
        table_name: "contracts",
        changes: { field, old: oldValue, new: newValue },
      } as any);
    }
    toast.success("Đã cập nhật");
    if (selectedCategory) fetchContracts(selectedCategory.id);
  };

  const handleStatusChange = async (contract: any, oldDerivedStatus: string, newStatus: string, payments: any[], hasHiddenFlag: boolean) => {
    if (oldDerivedStatus === newStatus) return;
    const oldDbStatus = contract.status;
    const dbStatusToSave = newStatus === "het_hieu_luc_chua_hoan_thanh" ? "het_hieu_luc" : newStatus;
    const { error } = await supabase.from("contracts").update({ status: dbStatusToSave as any }).eq("id", contract.id);
    if (error) {
      toast.error("Lỗi cập nhật trạng thái", { description: error.message });
      return;
    }
    if (user && profile) {
      await supabase.from("edit_logs").insert({
        editor_id: user.id,
        editor_name: profile.full_name || user.email || "",
        record_id: contract.id,
        table_name: "contracts",
        changes: { field: "status", old: oldDbStatus, new: dbStatusToSave },
      } as any);
    }
    if (newStatus === "het_hieu_luc_chua_hoan_thanh") {
      if (!hasHiddenFlag) {
        await supabase.from("contract_payment_schedules").insert({
          contract_id: contract.id,
          phase_name: "[HIDDEN] CHUA_HOAN_THANH",
          payment_amount: 0,
          payment_due_date: null,
        } as any);
      }
    } else {
      const flagPhase = payments.find((p: any) => p.phase_name === "[HIDDEN] CHUA_HOAN_THANH");
      if (flagPhase) {
        await supabase.from("contract_payment_schedules").delete().eq("id", flagPhase.id);
      }
    }
    toast.success("Đã cập nhật trạng thái");
    if (selectedCategory) fetchContracts(selectedCategory.id);
  };

  if (loading) {
    return <div className="flex items-center justify-center h-64"><p className="text-muted-foreground">Đang tải...</p></div>;
  }

  const filteredContracts = contracts.filter((c) => {
    if (!searchTerm) return true;
    const term = searchTerm.toLowerCase();
    return (
      c.title?.toLowerCase().includes(term) || c.department?.toLowerCase().includes(term) ||
      c.partner_name?.toLowerCase().includes(term) || c.tax_code?.toLowerCase().includes(term) ||
      (STATUS_LABELS[c.status] || c.status)?.toLowerCase().includes(term)
    );
  }).sort((a, b) => {
    // Move the contract from notification to the top
    if (activeContractId) {
      if (a.id === activeContractId) return -1;
      if (b.id === activeContractId) return 1;
    }
    return 0;
  });

  // Get nearest obligation date for a contract
  const getNearestObligation = (contractId: string) => {
    const payments = contractPayments[contractId] || [];
    const unpaid = payments.filter((p: any) => p.payment_status !== "da_thanh_toan" && p.payment_due_date && p.phase_name !== "[HIDDEN] CHUA_HOAN_THANH");
    if (unpaid.length === 0) return null;
    unpaid.sort((a: any, b: any) => new Date(a.payment_due_date).getTime() - new Date(b.payment_due_date).getTime());
    return unpaid[0];
  };

  // Contract detail view
  if (selectedCategory) {
    return (
      <div className="space-y-6 animate-fade-in">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="sm" onClick={() => { setSelectedCategory(null); setContracts([]); setSearchTerm(""); setContractPayments({}); }}>
            ← Quay lại
          </Button>
          <div className="flex-1">
            <h1 className="text-2xl font-bold tracking-tight">{selectedCategory.name}</h1>
            <p className="text-muted-foreground">{selectedCategory.description || "Danh sách hợp đồng"}</p>
          </div>
          {canEdit && <Dialog open={uploadDialogOpen} onOpenChange={(o) => { setUploadDialogOpen(o); if (!o) resetForm(); }}>
            <DialogTrigger asChild>
              <Button className="bg-accent hover:bg-accent/90 text-accent-foreground">Upload hợp đồng</Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
              <DialogHeader><DialogTitle>Upload hợp đồng mới</DialogTitle></DialogHeader>
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label>Tên hợp đồng *</Label>
                  <Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="VD: Hợp đồng thuê văn phòng" />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Đối tác *</Label>
                    <Input value={form.partner_name} onChange={(e) => setForm({ ...form, partner_name: e.target.value })} placeholder="Tên đối tác" />
                  </div>
                  <div className="space-y-2">
                    <Label>Mã số thuế đối tác</Label>
                    <Input value={form.tax_code} onChange={(e) => setForm({ ...form, tax_code: e.target.value })} placeholder="0123456789" />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Giá trị (VNĐ)</Label>
                    <Input
                      type="text"
                      readOnly
                      disabled
                      value={(() => {
                        const total = paymentPhases.reduce((sum, p) => sum + (parseInt(p.payment_amount) || 0), 0);
                        return total > 0 ? new Intl.NumberFormat('vi-VN').format(total) + ' VNĐ' : '0';
                      })()}
                      className="bg-muted cursor-not-allowed"
                    />
                    <p className="text-xs text-muted-foreground">Tự động tính từ {paymentPhases.length} đợt thanh toán</p>
                  </div>
                  <div className="space-y-2">
                    <Label>Trạng thái</Label>
                    <Select value={form.status} onValueChange={(v) => setForm({ ...form, status: v })}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="da_ky">Đã ký</SelectItem>
                        <SelectItem value="het_hieu_luc">Đã hết hạn</SelectItem>
                        <SelectItem value="het_hieu_luc_chua_hoan_thanh">Hết hiệu lực - Chưa hoàn thành nghĩa vụ</SelectItem>
                        <SelectItem value="da_thanh_ly">Đã thanh lý</SelectItem>
                      </SelectContent>

                    </Select>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Ngày hiệu lực</Label>
                    <Input type="date" value={form.effective_date} onChange={(e) => setForm({ ...form, effective_date: e.target.value })} />
                  </div>
                  <div className="space-y-2">
                    <Label>Ngày hết hiệu lực *</Label>
                    <Input type="date" value={form.expiry_date} onChange={(e) => setForm({ ...form, expiry_date: e.target.value })} />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Đơn vị phụ trách</Label>
                    <Select value={form.department} onValueChange={(v) => setForm({ ...form, department: v })}>
                      <SelectTrigger><SelectValue placeholder="Chọn phòng ban" /></SelectTrigger>
                      <SelectContent>
                        {DEPARTMENTS.map((dept) => (
                          <SelectItem key={dept.id} value={dept.id}>{dept.id} - {dept.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Link hợp đồng *</Label>
                    <Input
                      value={form.file_link}
                      onChange={(e) => setForm({ ...form, file_link: e.target.value })}
                      placeholder="Dán link Google Drive, SharePoint..."
                      className={form.file_link && !isValidPdfLink(form.file_link) ? "border-destructive focus-visible:ring-destructive" : ""}
                    />
                    {form.file_link && !isValidPdfLink(form.file_link) && (
                      <p className="text-xs text-destructive mt-1">Chỉ chấp nhận file PDF</p>
                    )}
                  </div>
                </div>

                {/* Payment Schedule */}
                <div className="space-y-3 p-4 rounded-lg border bg-muted/20">
                  <div className="flex items-center justify-between">
                    <Label className="text-sm font-semibold">Đợt thanh toán *</Label>
                    <Button type="button" variant="outline" size="sm" onClick={addPaymentPhase}>Thêm đợt</Button>
                  </div>
                  {paymentPhases.map((phase, idx) => (
                    <div key={idx} className="space-y-2 p-3 rounded border bg-background">
                      <div className="flex items-center justify-between">
                        <Input value={phase.phase_name} onChange={(e) => {
                          const updated = [...paymentPhases];
                          updated[idx].phase_name = e.target.value;
                          setPaymentPhases(updated);
                        }} className="w-28" placeholder="Tên đợt" />
                        {paymentPhases.length > 1 && (
                          <Button type="button" variant="ghost" size="sm" className="text-destructive text-xs" onClick={() => removePaymentPhase(idx)}>Xóa</Button>
                        )}
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <span className="text-xs text-muted-foreground">Giá trị (VNĐ) *</span>
                          <Input type="number" value={phase.payment_amount} onChange={(e) => {
                            const updated = [...paymentPhases];
                            updated[idx].payment_amount = e.target.value;
                            setPaymentPhases(updated);
                          }} placeholder="0" />
                        </div>
                        <div>
                          <span className="text-xs text-muted-foreground">Ngày thanh toán *</span>
                          <Input type="date" value={phase.payment_due_date} onChange={(e) => {
                            const updated = [...paymentPhases];
                            updated[idx].payment_due_date = e.target.value;
                            setPaymentPhases(updated);
                          }} />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>

              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => { setUploadDialogOpen(false); resetForm(); }}>Hủy</Button>
                <Button className="bg-accent hover:bg-accent/90 text-accent-foreground" onClick={handleUploadContract} disabled={uploading || !form.title.trim() || !form.file_link.trim() || !isValidPdfLink(form.file_link) || !form.expiry_date}>
                  {uploading ? "Đang lưu..." : "Lưu hợp đồng"}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>}
        </div>

        {/* Search */}
        <div className="flex items-center gap-2">
          <Input placeholder="Tìm theo tên hợp đồng, phòng ban, trạng thái, đối tác, MST..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} />
        </div>

        <Card className="border-none shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/30">
                  <TableHead>Tên hợp đồng</TableHead>
                  <TableHead>Đối tác</TableHead>
                  <TableHead>MST</TableHead>
                  <TableHead>Trạng thái</TableHead>
                  <TableHead>Giá trị HĐ</TableHead>
                  <TableHead>Ngày hiệu lực</TableHead>
                  <TableHead>Ngày hết hạn</TableHead>
                  <TableHead>Link hợp đồng</TableHead>
                  {canEdit && <TableHead>Thao tác</TableHead>}
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredContracts.map((c) => {
                  const payments = contractPayments[c.id] || [];
                  const hasHiddenFlag = payments.some((p: any) => p.phase_name === "[HIDDEN] CHUA_HOAN_THANH");
                  const derivedStatus = (c.status === "het_hieu_luc" && hasHiddenFlag)
                    ? "het_hieu_luc_chua_hoan_thanh"
                    : c.status;

                  // Build links array for multi-link cell
                  const contractLinks: LinkItem[] = [];
                  // Add links from contract_related_docs (synced + manual)
                  const docs = contractRelatedDocs[c.id] || [];
                  docs.forEach((doc: any) => {
                    // Use stored doc_type for synced items, fallback to URL detection
                    let linkType: "folder" | "pdf" | "doc" = "doc";
                    if (doc.doc_type === "folder") linkType = "folder";
                    else if (doc.doc_type === "pdf") linkType = "pdf";
                    else if (doc.doc_type === "doc") linkType = "doc";
                    else linkType = getLinkType(doc.doc_url);

                    contractLinks.push({
                      id: doc.id,
                      url: doc.doc_url,
                      name: getDocDisplayName(doc, docs),
                      type: linkType,
                    });
                  });
                  // Add file_url if not already in docs
                  if (c.file_url && !docs.some((d: any) => d.doc_url === c.file_url)) {
                    contractLinks.unshift({
                      id: "main-" + c.id,
                      url: c.file_url,
                      name: "Hợp đồng",
                      type: getLinkType(c.file_url),
                    });
                  }
                  // Add liquidation_file_url if not already in docs
                  if (c.liquidation_file_url && !docs.some((d: any) => d.doc_url === c.liquidation_file_url)) {
                    contractLinks.push({
                      id: "liq-" + c.id,
                      url: c.liquidation_file_url,
                      name: "Thanh lý",
                      type: getLinkType(c.liquidation_file_url),
                    });
                  }

                  return (
                    <TableRow key={c.id} className="hover:bg-muted/30 transition-colors">
                      <TableCell className="font-medium max-w-[200px]">
                        <div className="flex flex-col gap-0.5">
                          <InlineEditCell
                            value={c.title}
                            type="text"
                            canEdit={canInlineEdit}
                            onSave={async (v) => handleInlineEdit(c.id, "title", c.title, v)}
                            formatDisplay={(v) => v || "—"}
                          />
                          {c.description && (
                            <button
                              onClick={(e) => { e.stopPropagation(); setDescriptionPopupContract(c); }}
                              className="text-xs text-muted-foreground hover:text-foreground hover:underline text-left truncate max-w-[180px] transition-colors"
                              title="Xem mô tả nội dung"
                            >
                              📝 Xem mô tả
                            </button>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <InlineEditCell
                          value={c.partner_name}
                          type="text"
                          canEdit={canInlineEdit}
                          onSave={async (v) => handleInlineEdit(c.id, "partner_name", c.partner_name, v)}
                          formatDisplay={(v) => v || "—"}
                        />
                      </TableCell>
                      <TableCell>
                        <InlineEditCell
                          value={c.tax_code}
                          type="text"
                          canEdit={canInlineEdit}
                          onSave={async (v) => handleInlineEdit(c.id, "tax_code", c.tax_code, v)}
                          formatDisplay={(v) => v || "—"}
                          className="text-xs"
                        />
                      </TableCell>
                      <TableCell>
                        {canInlineEdit ? (
                          <Select
                            value={derivedStatus}
                            onValueChange={async (newStatus) => {
                              await handleStatusChange(c, derivedStatus, newStatus, payments, hasHiddenFlag);
                            }}
                          >
                            <SelectTrigger className="h-7 w-40 text-xs">
                              <SelectValue placeholder={STATUS_LABELS[derivedStatus] || derivedStatus} />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="da_ky">Đã ký</SelectItem>
                              <SelectItem value="het_hieu_luc">Đã hết hạn</SelectItem>
                              <SelectItem value="het_hieu_luc_chua_hoan_thanh">Hết hiệu lực - CHTNV</SelectItem>
                              <SelectItem value="da_thanh_ly">Đã thanh lý</SelectItem>
                            </SelectContent>
                          </Select>
                        ) : (
                          <Badge variant="secondary" className="text-xs whitespace-nowrap">
                            {STATUS_LABELS[derivedStatus] || derivedStatus}
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell>
                        <InlineEditCell
                          value={c.value}
                          type="number"
                          canEdit={canInlineEdit}
                          onSave={async (v) => handleInlineEdit(c.id, "value", c.value, v)}
                          formatDisplay={(v) => v && Number(v) > 0 ? formatCurrency(Number(v)) : "—"}
                        />
                      </TableCell>
                      <TableCell>
                        <InlineEditCell
                          value={c.effective_date}
                          type="date"
                          canEdit={canInlineEdit}
                          onSave={async (v) => handleInlineEdit(c.id, "effective_date", c.effective_date, v)}
                          formatDisplay={(v) => v ? formatDate(String(v)) : "—"}
                        />
                      </TableCell>
                      <TableCell>
                        <InlineEditCell
                          value={c.expiry_date}
                          type="date"
                          canEdit={canInlineEdit}
                          onSave={async (v) => handleInlineEdit(c.id, "expiry_date", c.expiry_date, v)}
                          formatDisplay={(v) => v ? formatDate(String(v)) : "—"}
                        />
                      </TableCell>
                      <TableCell>
                        <ContractLinkCell
                          links={contractLinks}
                          canEdit={canInlineEdit}
                          onAddLink={() => {
                            setAddDocDialogContractId(c.id);
                            setNewDocType("bien_ban_nghiem_thu");
                            setNewDocCustomName("");
                            setNewDocUrl("");
                          }}
                        />
                      </TableCell>
                      {canEdit && (
                        <TableCell>
                          {canEditContract(c) && (
                            <AlertDialog>
                              <AlertDialogTrigger asChild>
                                <Button variant="ghost" size="sm" className="h-7 text-xs text-destructive hover:text-destructive">Xóa</Button>
                              </AlertDialogTrigger>
                              <AlertDialogContent>
                                <AlertDialogHeader>
                                  <AlertDialogTitle>Bạn có chắc chắn muốn xóa hợp đồng này không?</AlertDialogTitle>
                                  <AlertDialogDescription>Hợp đồng "{c.title}" sẽ bị xóa vĩnh viễn.</AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter>
                                  <AlertDialogCancel>Hủy</AlertDialogCancel>
                                  <AlertDialogAction onClick={() => handleDeleteContract(c)} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">Xóa</AlertDialogAction>
                                </AlertDialogFooter>
                              </AlertDialogContent>
                            </AlertDialog>
                          )}
                        </TableCell>
                      )}
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        </Card>

        {filteredContracts.length === 0 && (
          <div className="text-center py-12">
            <p className="text-muted-foreground font-medium">{searchTerm ? "Không tìm thấy hợp đồng" : "Chưa có hợp đồng nào"}</p>
          </div>
        )}

        {/* Contract Detail Modal via URL Params */}
        {activeContractId && contracts.find(c => c.id === activeContractId) && (() => {
          const detailContract = contracts.find(c => c.id === activeContractId)!;
          const payments = contractPayments[detailContract.id] || [];
          const visiblePayments = payments.filter((p: any) => p.phase_name !== "[HIDDEN] CHUA_HOAN_THANH");
          const hasHiddenFlag = payments.some((p: any) => p.phase_name === "[HIDDEN] CHUA_HOAN_THANH");
          const derivedStatus = (detailContract.status === "het_hieu_luc" && hasHiddenFlag)
            ? "het_hieu_luc_chua_hoan_thanh"
            : detailContract.status;

          return (
            <Dialog open={true} onOpenChange={(open) => {
              if (!open) {
                if (routeContractId && activeContractId === routeContractId) {
                  setClosedRouteIds(prev => new Set(prev).add(routeContractId));
                }
                searchParams.delete('contractId');
                setSearchParams(searchParams);
              }
            }}>
              <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                  <DialogTitle>Chi tiết hợp đồng</DialogTitle>
                </DialogHeader>
                <div className="space-y-6 mt-4">
                  <div>
                    <h3 className="font-bold text-lg">{detailContract.title}</h3>
                    <Badge className="mt-2" variant="secondary">
                      {STATUS_LABELS[derivedStatus] || derivedStatus}
                    </Badge>
                  </div>

                  <div className="grid grid-cols-2 gap-4 text-sm bg-muted/30 p-4 rounded-lg">
                    <div><span className="text-muted-foreground mr-2">Đối tác:</span> <span className="font-medium">{detailContract.partner_name || "—"}</span></div>
                    <div><span className="text-muted-foreground mr-2">MST:</span> <span>{detailContract.tax_code || "—"}</span></div>
                    <div><span className="text-muted-foreground mr-2">Phòng ban:</span> <span>{detailContract.department || "—"}</span></div>
                    <div><span className="text-muted-foreground mr-2">Cập nhật:</span> <span>{detailContract.created_at ? formatDate(detailContract.created_at) : "—"}</span></div>
                    <div><span className="text-muted-foreground mr-2">Hết hiệu lực:</span> <span>{detailContract.expiry_date ? formatDate(detailContract.expiry_date) : "—"}</span></div>
                  </div>

                  <div>
                    <h4 className="font-semibold text-sm mb-3">Đợt thanh toán (Nghĩa vụ)</h4>
                    {visiblePayments.length > 0 ? (
                      <div className="space-y-2">
                        {visiblePayments.map((p: any) => (
                          <div key={p.id} className="flex justify-between items-center text-sm p-3 border rounded-md">
                            <span className="font-medium">{p.phase_name}</span>
                            <span>{formatCurrency(p.payment_amount)} — <span className="text-muted-foreground">{p.payment_due_date ? formatDate(p.payment_due_date) : "—"}</span></span>
                          </div>
                        ))}
                      </div>
                    ) : <p className="text-sm text-muted-foreground italic">Không có đợt thanh toán nào</p>}
                  </div>

                  <div>
                    <h4 className="font-semibold text-sm mb-3">Liên kết hợp đồng</h4>
                    <div className="flex flex-col gap-2">
                      {detailContract.file_url && (
                        <div>
                          <span className="text-xs text-muted-foreground mb-1 block">Link hợp đồng:</span>
                          <a href={detailContract.file_url.startsWith('http') ? detailContract.file_url : `https://${detailContract.file_url}`} target="_blank" rel="noopener noreferrer" className="text-accent hover:underline break-all text-sm block bg-muted/20 p-2 rounded border">
                            {detailContract.file_url}
                          </a>
                        </div>
                      )}
                      {!detailContract.file_url && <span className="text-sm text-muted-foreground italic">Không có link hợp đồng</span>}
                    </div>
                  </div>

                  <div>
                    <h4 className="font-semibold text-sm mb-3">Văn bản liên quan</h4>
                    {(() => {
                      const docs = contractRelatedDocs[detailContract.id] || [];
                      const legacyLiq = detailContract.liquidation_file_url && !docs.some((d: any) => d.doc_type === "thanh_ly");
                      if (docs.length === 0 && !legacyLiq) return <p className="text-sm text-muted-foreground italic">Không có văn bản liên quan</p>;
                      return (
                        <div className="space-y-2">
                          {legacyLiq && (
                            <div className="flex items-center gap-2 text-sm p-2 border rounded-md">
                              <span className="font-medium">Thanh lý</span>
                              <a href={detailContract.liquidation_file_url.startsWith('http') ? detailContract.liquidation_file_url : `https://${detailContract.liquidation_file_url}`} target="_blank" rel="noopener noreferrer" className="text-accent hover:underline break-all">
                                [Link]
                              </a>
                            </div>
                          )}
                          {docs.map((doc: any) => (
                            <div key={doc.id} className="flex items-center gap-2 text-sm p-2 border rounded-md">
                              <span className="font-medium">{getDocDisplayName(doc, docs)}</span>
                              <a href={doc.doc_url.startsWith('http') ? doc.doc_url : `https://${doc.doc_url}`} target="_blank" rel="noopener noreferrer" className="text-accent hover:underline break-all">
                                [Link]
                              </a>
                            </div>
                          ))}
                        </div>
                      );
                    })()}
                  </div>
                </div>
              </DialogContent>
            </Dialog>
          );
        })()}

        {/* Add Related Doc Dialog */}
        <Dialog open={!!addDocDialogContractId} onOpenChange={(open) => { if (!open) setAddDocDialogContractId(null); }}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader><DialogTitle>Thêm văn bản liên quan</DialogTitle></DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label>Loại văn bản</Label>
                <Select value={newDocType} onValueChange={setNewDocType}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {DOC_TYPE_OPTIONS.map(opt => (
                      <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              {newDocType === "khac" && (
                <div className="space-y-2">
                  <Label>Tên văn bản</Label>
                  <Input value={newDocCustomName} onChange={(e) => setNewDocCustomName(e.target.value)} placeholder="VD: Báo giá, Email xác nhận…" />
                </div>
              )}
              <div className="space-y-2">
                <Label>Link tài liệu *</Label>
                <Input value={newDocUrl} onChange={(e) => setNewDocUrl(e.target.value)} placeholder="Dán link Google Drive, PDF…" />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setAddDocDialogContractId(null)}>Hủy</Button>
              <Button className="bg-accent hover:bg-accent/90 text-accent-foreground" onClick={handleAddRelatedDoc} disabled={!newDocUrl.trim() || (newDocType === "khac" && !newDocCustomName.trim())}>
                Thêm
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Description Popup */}
        <Dialog open={!!descriptionPopupContract} onOpenChange={(open) => { if (!open) setDescriptionPopupContract(null); }}>
          <DialogContent className="sm:max-w-lg">
            <DialogHeader>
              <DialogTitle>{descriptionPopupContract?.title || "Mô tả nội dung"}</DialogTitle>
            </DialogHeader>
            <div className="py-4">
              {descriptionPopupContract?.description ? (
                <p className="text-sm whitespace-pre-wrap leading-relaxed">{descriptionPopupContract.description}</p>
              ) : (
                <p className="text-sm text-muted-foreground italic">Không có mô tả nội dung</p>
              )}
            </div>
          </DialogContent>
        </Dialog>
      </div>
    );
  }

  // Category list view
  const DEFAULT_ENTITIES = ["CHV", "LKV", "LKO", "C2V"];

  const extractEntity = (name: string) => {
    // Try to match "ENTITY - TypeName" or "ENTITY TypeName" pattern
    const match = name.match(/^([A-Z0-9]+)\s*[-:]\s*(.+)$/i);
    if (match) {
      return { entity: match[1].toUpperCase(), typeName: match[2].trim() };
    }
    // Check if starts with any known entity
    for (const entity of DEFAULT_ENTITIES) {
      if (name.toUpperCase().startsWith(entity)) {
        const typeName = name.substring(entity.length).replace(/^[\s-:]+/, '').trim() || name;
        return { entity, typeName };
      }
    }
    return { entity: "Khác", typeName: name };
  };

  // Build grouped categories and discover all entities
  const groupedCategories = categories.reduce((acc, cat) => {
    const { entity, typeName } = extractEntity(cat.name);
    if (!acc[entity]) acc[entity] = [];
    acc[entity].push({ ...cat, typeName });
    return acc;
  }, {} as Record<string, any[]>);

  // Merge default + discovered entities
  const allEntities = Array.from(new Set([...DEFAULT_ENTITIES, ...Object.keys(groupedCategories)]));

  const sortedEntities = allEntities.sort((a, b) => {
    if (a === "Khác") return 1;
    if (b === "Khác") return -1;
    const orderA = entityOrder[a] ?? 999;
    const orderB = entityOrder[b] ?? 999;
    if (orderA !== orderB) return orderA - orderB;
    return a.localeCompare(b);
  });

  const handleDragStart = (entity: string) => {
    setDraggedEntity(entity);
  };

  const handleDragOver = (e: React.DragEvent, entity: string) => {
    e.preventDefault();
    if (entity !== draggedEntity && entity !== "Khác") {
      setDragOverEntity(entity);
    }
  };

  const handleDrop = async (targetEntity: string) => {
    if (!draggedEntity || draggedEntity === targetEntity || targetEntity === "Khác") {
      setDraggedEntity(null);
      setDragOverEntity(null);
      return;
    }
    const reordered = sortedEntities.filter(e => e !== "Khác");
    const fromIdx = reordered.indexOf(draggedEntity);
    const toIdx = reordered.indexOf(targetEntity);
    if (fromIdx === -1 || toIdx === -1) return;
    reordered.splice(fromIdx, 1);
    reordered.splice(toIdx, 0, draggedEntity);

    // Optimistic update
    const newOrder: Record<string, number> = {};
    reordered.forEach((e, i) => { newOrder[e] = i; });
    setEntityOrder(newOrder);
    setDraggedEntity(null);
    setDragOverEntity(null);

    // Persist to DB - upsert each entity
    for (const [i, entityName] of reordered.entries()) {
      await supabase.from("entity_order").upsert(
        { entity_name: entityName, order_index: i, updated_at: new Date().toISOString() } as any,
        { onConflict: "entity_name" }
      );
    }
    toast.success("Đã cập nhật thứ tự pháp nhân");
  };

  const handleDragEnd = () => {
    setDraggedEntity(null);
    setDragOverEntity(null);
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Tổng hợp đồng</h1>
          <p className="text-muted-foreground">Kho lưu trữ hợp đồng tập trung theo loại</p>
        </div>
        <div className="flex gap-2">
          {isAdmin && (
            <Dialog open={addEntityDialogOpen} onOpenChange={setAddEntityDialogOpen}>
              <DialogTrigger asChild>
                <Button variant="outline" className="shrink-0">+ Pháp nhân</Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader><DialogTitle>Thêm pháp nhân mới</DialogTitle></DialogHeader>
                <div className="space-y-4 py-4">
                  <div className="space-y-2">
                    <Label>Tên pháp nhân (viết tắt) *</Label>
                    <Input value={newEntityName} onChange={(e) => setNewEntityName(e.target.value.toUpperCase())} placeholder="VD: ABC" />
                    <p className="text-xs text-muted-foreground">Sau khi thêm, bạn có thể tạo loại hợp đồng thuộc pháp nhân này.</p>
                  </div>
                </div>
                <DialogFooter>
                  <Button variant="outline" onClick={() => setAddEntityDialogOpen(false)}>Hủy</Button>
                  <Button className="bg-accent hover:bg-accent/90 text-accent-foreground" onClick={() => {
                    if (!newEntityName.trim()) return;
                    // Just create a placeholder category so entity shows up
                    setNewCatEntity(newEntityName.trim());
                    setAddEntityDialogOpen(false);
                    setNewEntityName("");
                    setDialogOpen(true);
                  }} disabled={!newEntityName.trim()}>
                    Tiếp tục
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          )}
          {canEdit && (
            <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
              <DialogTrigger asChild>
                <Button className="bg-accent hover:bg-accent/90 text-accent-foreground shrink-0">Tạo loại hợp đồng</Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader><DialogTitle>Tạo loại hợp đồng mới</DialogTitle></DialogHeader>
                <div className="space-y-4 py-4">
                  <div className="space-y-2">
                    <Label>Pháp nhân *</Label>
                    <Select value={newCatEntity} onValueChange={setNewCatEntity}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {allEntities.filter(e => e !== "Khác").map(e => (
                          <SelectItem key={e} value={e}>{e}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Tên loại hợp đồng *</Label>
                    <Input value={newCatName} onChange={(e) => setNewCatName(e.target.value)} placeholder="VD: Hợp đồng bảo hiểm" />
                    <p className="text-xs text-muted-foreground">Tên sẽ được lưu: <strong>{newCatEntity} - {newCatName || "..."}</strong></p>
                  </div>
                  <div className="space-y-2">
                    <Label>Mô tả</Label>
                    <Input value={newCatDesc} onChange={(e) => setNewCatDesc(e.target.value)} placeholder="Mô tả ngắn gọn" />
                  </div>
                </div>
                <DialogFooter>
                  <Button variant="outline" onClick={() => setDialogOpen(false)}>Hủy</Button>
                  <Button className="bg-accent hover:bg-accent/90 text-accent-foreground" onClick={handleAddCategory} disabled={saving || !newCatName.trim()}>
                    {saving ? "Đang tạo..." : "Tạo"}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          )}
        </div>
      </div>

      {/* Global Search Bar */}
      <div className="relative">
        <Input
          placeholder="Tìm theo tên hợp đồng, phòng ban, trạng thái, đối tác, MST…"
          value={globalSearchTerm}
          onChange={(e) => setGlobalSearchTerm(e.target.value)}
          className="text-base"
        />
        {globalSearchTerm && (
          <Button
            variant="ghost"
            size="sm"
            className="absolute right-2 top-1/2 -translate-y-1/2 h-6 text-xs text-muted-foreground"
            onClick={() => setGlobalSearchTerm("")}
          >
            ✕
          </Button>
        )}
      </div>

      {/* Global search results */}
      {globalSearchDebounced.trim() ? (
        <div className="space-y-2">
          <p className="text-sm text-muted-foreground">
            {globalSearching ? "Đang tìm kiếm..." : `${globalResults.length} kết quả cho "${globalSearchDebounced}"`}
          </p>
          {globalResults.length > 0 && (
            <Card className="border-none shadow-sm overflow-hidden">
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-muted/30">
                      <TableHead>Tên hợp đồng</TableHead>
                      <TableHead>Đối tác</TableHead>
                      <TableHead>MST</TableHead>
                      <TableHead>Trạng thái</TableHead>
                      <TableHead>Hết hiệu lực</TableHead>
                      <TableHead>Đơn vị</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {globalResults.map((c) => {
                      const payments = globalResultPayments[c.id] || [];
                      const hasHiddenFlag = payments.some((p: any) => p.phase_name === "[HIDDEN] CHUA_HOAN_THANH");
                      const derivedStatus = (c.status === "het_hieu_luc" && hasHiddenFlag) ? "het_hieu_luc_chua_hoan_thanh" : c.status;
                      // Find category name
                      const cat = categories.find((cat: any) => cat.id === c.category_id);
                      return (
                        <TableRow
                          key={c.id}
                          className="hover:bg-muted/30 transition-colors cursor-pointer"
                          onClick={() => setGlobalSelectedContract(c)}
                        >
                          <TableCell className="font-medium max-w-[250px]">
                            <div>
                              <span className="truncate block">{c.title}</span>
                              {cat && <span className="text-xs text-muted-foreground">{cat.name}</span>}
                            </div>
                          </TableCell>
                          <TableCell className="text-muted-foreground">{c.partner_name || "—"}</TableCell>
                          <TableCell className="text-muted-foreground text-xs">{c.tax_code || "—"}</TableCell>
                          <TableCell>
                            <Badge variant="secondary">{STATUS_LABELS[derivedStatus] || derivedStatus}</Badge>
                          </TableCell>
                          <TableCell className="text-sm text-muted-foreground">{c.expiry_date ? formatDate(c.expiry_date) : "—"}</TableCell>
                          <TableCell className="text-sm text-muted-foreground">{c.department || "—"}</TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            </Card>
          )}
          {!globalSearching && globalResults.length === 0 && (
            <div className="text-center py-12">
              <p className="text-muted-foreground font-medium">Không tìm thấy hợp đồng nào</p>
            </div>
          )}

          {/* Global search contract detail modal */}
          {globalSelectedContract && (() => {
            const detailContract = globalSelectedContract;
            const payments = globalResultPayments[detailContract.id] || [];
            const visiblePayments = payments.filter((p: any) => p.phase_name !== "[HIDDEN] CHUA_HOAN_THANH");
            const hasHiddenFlag = payments.some((p: any) => p.phase_name === "[HIDDEN] CHUA_HOAN_THANH");
            const derivedStatus = (detailContract.status === "het_hieu_luc" && hasHiddenFlag) ? "het_hieu_luc_chua_hoan_thanh" : detailContract.status;
            return (
              <Dialog open={true} onOpenChange={(open) => { if (!open) setGlobalSelectedContract(null); }}>
                <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
                  <DialogHeader><DialogTitle>Chi tiết hợp đồng</DialogTitle></DialogHeader>
                  <div className="space-y-6 mt-4">
                    <div>
                      <h3 className="font-bold text-lg">{detailContract.title}</h3>
                      <Badge className="mt-2" variant="secondary">{STATUS_LABELS[derivedStatus] || derivedStatus}</Badge>
                    </div>
                    <div className="grid grid-cols-2 gap-4 text-sm bg-muted/30 p-4 rounded-lg">
                      <div><span className="text-muted-foreground mr-2">Đối tác:</span> <span className="font-medium">{detailContract.partner_name || "—"}</span></div>
                      <div><span className="text-muted-foreground mr-2">MST:</span> <span>{detailContract.tax_code || "—"}</span></div>
                      <div><span className="text-muted-foreground mr-2">Phòng ban:</span> <span>{detailContract.department || "—"}</span></div>
                      <div><span className="text-muted-foreground mr-2">Cập nhật:</span> <span>{detailContract.created_at ? formatDate(detailContract.created_at) : "—"}</span></div>
                      <div><span className="text-muted-foreground mr-2">Hết hiệu lực:</span> <span>{detailContract.expiry_date ? formatDate(detailContract.expiry_date) : "—"}</span></div>
                    </div>
                    <div>
                      <h4 className="font-semibold text-sm mb-3">Đợt thanh toán (Nghĩa vụ)</h4>
                      {visiblePayments.length > 0 ? (
                        <div className="space-y-2">
                          {visiblePayments.map((p: any) => (
                            <div key={p.id} className="flex justify-between items-center text-sm p-3 border rounded-md">
                              <span className="font-medium">{p.phase_name}</span>
                              <span>{formatCurrency(p.payment_amount)} — <span className="text-muted-foreground">{p.payment_due_date ? formatDate(p.payment_due_date) : "—"}</span></span>
                            </div>
                          ))}
                        </div>
                      ) : <p className="text-sm text-muted-foreground italic">Không có đợt thanh toán nào</p>}
                    </div>
                    <div>
                      <h4 className="font-semibold text-sm mb-3">Liên kết hợp đồng</h4>
                      <div className="flex flex-col gap-2">
                        {detailContract.file_url && (
                          <div>
                            <span className="text-xs text-muted-foreground mb-1 block">Link hợp đồng:</span>
                            <a href={detailContract.file_url.startsWith('http') ? detailContract.file_url : `https://${detailContract.file_url}`} target="_blank" rel="noopener noreferrer" className="text-accent hover:underline break-all text-sm block bg-muted/20 p-2 rounded border">
                              {detailContract.file_url}
                            </a>
                          </div>
                        )}
                        {!detailContract.file_url && <span className="text-sm text-muted-foreground italic">Không có link hợp đồng</span>}
                      </div>
                    </div>
                    <div>
                      <h4 className="font-semibold text-sm mb-3">Văn bản liên quan</h4>
                      <p className="text-sm text-muted-foreground italic">Mở từ danh sách chính để xem chi tiết</p>
                    </div>
                  </div>
                </DialogContent>
              </Dialog>
            );
          })()}
        </div>
      ) : (
      <>
      <Accordion type="multiple" defaultValue={sortedEntities} className="w-full space-y-4">
        {sortedEntities.map(entity => {
          const entityCategories = groupedCategories[entity] || [];
          const totalContracts = entityCategories.reduce((sum: number, cat: any) => sum + (categoryCounts[cat.id] || 0), 0);

          return (
            <AccordionItem
              key={entity}
              value={entity}
              className={`border rounded-lg bg-card shadow-sm px-4 transition-all ${dragOverEntity === entity ? "ring-2 ring-accent" : ""} ${draggedEntity === entity ? "opacity-50" : ""}`}
              draggable={isAdmin && entity !== "Khác"}
              onDragStart={() => handleDragStart(entity)}
              onDragOver={(e) => handleDragOver(e, entity)}
              onDrop={() => handleDrop(entity)}
              onDragEnd={handleDragEnd}
            >
              <AccordionTrigger className="hover:no-underline py-4">
                <div className="flex items-center gap-2 flex-1">
                  <div className="flex items-center gap-2">
                    {isAdmin && entity !== "Khác" && (
                      <GripVertical className="h-4 w-4 text-muted-foreground cursor-grab active:cursor-grabbing shrink-0" />
                    )}
                    <span className="font-semibold text-lg">{entity}</span>
                    <Badge variant="secondary" className="font-normal text-muted-foreground">{totalContracts} hợp đồng</Badge>
                  </div>
                  {entity !== "Khác" && (
                    <div className="ml-auto mr-4">
                      <EntitySyncButton entityName={entity} isAdmin={isAdmin} />
                    </div>
                  )}
                </div>
              </AccordionTrigger>
              <AccordionContent className="pt-2 pb-4">
                {entityCategories.length === 0 ? (
                  <p className="text-sm text-muted-foreground italic py-4 text-center">Chưa có loại hợp đồng nào. {canEdit ? 'Nhấn "Tạo loại hợp đồng" để thêm.' : ""}</p>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                    {entityCategories.map((cat: any, i: number) => (
                      <Card
                        key={cat.id}
                        className="border shadow-sm hover:shadow-md transition-all cursor-pointer animate-slide-up group"
                        style={{ animationDelay: `${i * 60}ms`, animationFillMode: "backwards" }}
                        onClick={() => setSelectedCategory(cat)}
                      >
                        <CardContent className="p-5 flex items-center gap-4">
                          <div className="flex-1 min-w-0">
                            <p className="font-semibold truncate">{cat.typeName}</p>
                            <p className="text-sm text-muted-foreground truncate">{categoryCounts[cat.id] || 0} hợp đồng</p>
                          </div>
                          <div className="flex items-center gap-1">
                            {canEdit && (
                              <Button variant="outline" size="sm" className="opacity-0 group-hover:opacity-100 transition-opacity text-xs h-7" onClick={(e) => { e.stopPropagation(); setSelectedCategory(cat); setUploadDialogOpen(true); }}>
                                Upload
                              </Button>
                            )}
                            {isAdmin && (
                              <AlertDialog>
                                <AlertDialogTrigger asChild>
                                  <Button variant="ghost" size="sm" className="opacity-0 group-hover:opacity-100 transition-opacity text-destructive hover:text-destructive text-xs" onClick={(e) => e.stopPropagation()}>
                                    Xóa
                                  </Button>
                                </AlertDialogTrigger>
                                <AlertDialogContent onClick={(e) => e.stopPropagation()}>
                                  <AlertDialogHeader>
                                    <AlertDialogTitle>Xác nhận xóa?</AlertDialogTitle>
                                    <AlertDialogDescription>Loại "{cat.name}" sẽ bị xóa.</AlertDialogDescription>
                                  </AlertDialogHeader>
                                  <AlertDialogFooter>
                                    <AlertDialogCancel>Hủy</AlertDialogCancel>
                                    <AlertDialogAction onClick={() => handleDeleteCategory(cat.id)} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">Xóa</AlertDialogAction>
                                  </AlertDialogFooter>
                                </AlertDialogContent>
                              </AlertDialog>
                            )}
                            <span className="text-muted-foreground">→</span>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                )}
              </AccordionContent>
            </AccordionItem>
          );
        })}
      </Accordion>

      {categories.length === 0 && (
        <div className="text-center py-12">
          <p className="text-muted-foreground font-medium">Chưa có loại hợp đồng nào</p>
          <p className="text-sm text-muted-foreground/70 mt-1">{canEdit ? 'Nhấn "Tạo loại hợp đồng" để bắt đầu' : "Liên hệ admin để tạo danh mục"}</p>
        </div>
      )}
      </>
      )}
    </div>
  );
};

export default ContractCategories;
