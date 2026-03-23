import { useState, useEffect } from "react";
import { useSearchParams, useParams } from "react-router-dom";
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
  const canEdit = role === "admin" || role === "accountant" || role === "finance";
  const canEditContract = (c: any) => isAdmin || ((role === "accountant" || role === "finance") && c.created_by === user?.id);
  const isViewOnly = false;
  const [categories, setCategories] = useState<any[]>([]);
  const [contracts, setContracts] = useState<any[]>([]);
  const [contractPayments, setContractPayments] = useState<Record<string, any[]>>({});
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
      }
    }
  };

  useEffect(() => { fetchCategories(); }, []);
  useEffect(() => { if (selectedCategory) fetchContracts(selectedCategory.id); }, [selectedCategory, activeContractId]);

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
    const { error } = await supabase.from("contract_categories").delete().eq("id", catId);
    if (error) toast.error("Lỗi xóa", { description: error.message });
    else { toast.success("Đã xóa loại hợp đồng"); fetchCategories(); }
  };

  const handleDeleteContract = async (contract: any) => {
    const { error } = await (supabase.rpc as any)("delete_contract", { _contract_id: contract.id });
    if (error) {
      toast.error("Lỗi xóa", { description: error.message });
    } else {
      toast.success("Đã xóa hợp đồng");
      if (selectedCategory) fetchContracts(selectedCategory.id);

      // If the current user is NOT an admin, trigger notification to admins
      if (!isAdmin && user && profile) {
        try {
          const uploaderName = user.email ? getEmployeeName(user.email) || profile.full_name || user.email : "Người dùng";
          // Also pass contractId to the notification so we handle it similarly to upload
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
        value: parseInt(form.value) || 0, effective_date: form.effective_date || null,
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

  if (loading) {
    return <div className="flex items-center justify-center h-64"><p className="text-muted-foreground">Đang tải...</p></div>;
  }

  const filteredContracts = contracts.filter((c) => {
    if (routeContractId) return c.id === routeContractId;
    if (!searchTerm) return true;
    const term = searchTerm.toLowerCase();
    return (
      c.title?.toLowerCase().includes(term) || c.department?.toLowerCase().includes(term) ||
      c.partner_name?.toLowerCase().includes(term) || c.tax_code?.toLowerCase().includes(term) ||
      (STATUS_LABELS[c.status] || c.status)?.toLowerCase().includes(term)
    );
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
                    <Input type="number" value={form.value} onChange={(e) => setForm({ ...form, value: e.target.value })} placeholder="0" />
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
                  <TableHead>Hết hiệu lực</TableHead>
                  <TableHead>Nghĩa vụ tiếp theo</TableHead>
                  <TableHead>Đơn vị</TableHead>
                  <TableHead>Link</TableHead>
                  {canEdit && <TableHead>Thao tác</TableHead>}
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredContracts.map((c) => {
                  const nearestObl = getNearestObligation(c.id);
                  const payments = contractPayments[c.id] || [];
                  const visiblePayments = payments.filter((p: any) => p.phase_name !== "[HIDDEN] CHUA_HOAN_THANH");

                  // Compute reliable UI status
                  const hasHiddenFlag = payments.some((p: any) => p.phase_name === "[HIDDEN] CHUA_HOAN_THANH");
                  const derivedStatus = (c.status === "het_hieu_luc" && hasHiddenFlag)
                    ? "het_hieu_luc_chua_hoan_thanh"
                    : c.status;

                  return (
                    <TableRow key={c.id} className="hover:bg-muted/30 transition-colors">
                      <TableCell className="font-medium max-w-[200px]">
                        <span className="truncate block">{c.title}</span>
                      </TableCell>
                      <TableCell className="text-muted-foreground">{c.partner_name || "—"}</TableCell>
                      <TableCell className="text-muted-foreground text-xs">{c.tax_code || "—"}</TableCell>
                      <TableCell>
                        {canEditContract(c) ? (
                          <Select
                            value={derivedStatus}
                            onValueChange={async (newStatus) => {
                              const oldStatus = c.status;
                              // Map back to DB enum
                              const dbStatusToSave = newStatus === "het_hieu_luc_chua_hoan_thanh" ? "het_hieu_luc" : newStatus;
                              const { error } = await supabase.from("contracts").update({ status: dbStatusToSave as any }).eq("id", c.id);
                              if (error) {
                                toast.error("Lỗi cập nhật trạng thái", { description: error.message });
                              } else {
                                // Log audit
                                if (user && profile) {
                                  await supabase.from("edit_logs").insert({
                                    editor_id: user.id,
                                    editor_name: profile.full_name || user.email || "",
                                    record_id: c.id,
                                    table_name: "contracts",
                                    changes: { field: "status", old: oldStatus, new: dbStatusToSave },
                                  } as any);
                                }

                                // Manage hidden flag for state retention
                                if (newStatus === "het_hieu_luc_chua_hoan_thanh") {
                                  if (!hasHiddenFlag) {
                                    await supabase.from("contract_payment_schedules").insert({
                                      contract_id: c.id,
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
                                fetchContracts(selectedCategory.id);
                              }
                            }}
                          >
                            <SelectTrigger className="h-7 w-32 text-xs">
                              <SelectValue placeholder={
                                STATUS_LABELS[derivedStatus] || derivedStatus
                              } />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="da_ky">Đã ký</SelectItem>
                              <SelectItem value="het_hieu_luc">Đã hết hạn</SelectItem>
                              <SelectItem value="het_hieu_luc_chua_hoan_thanh">Hết hiệu lực - Chưa hoàn thành nghĩa vụ</SelectItem>
                              <SelectItem value="da_thanh_ly">Đã thanh lý</SelectItem>
                            </SelectContent>
                          </Select>
                        ) : (
                          <Badge variant="secondary">
                            {STATUS_LABELS[derivedStatus] || derivedStatus}
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">{c.expiry_date ? formatDate(c.expiry_date) : "—"}</TableCell>
                      <TableCell className="text-sm">
                        {nearestObl ? (
                          <div>
                            <p className="font-medium text-xs">{nearestObl.phase_name}</p>
                            <p className="text-xs text-muted-foreground">{formatDate(nearestObl.payment_due_date)} — {formatCurrency(nearestObl.payment_amount)}</p>
                            {canEditContract(c) && (
                              <Button size="sm" variant="outline" className="text-xs mt-1 h-6" onClick={() => handleMarkPaid(nearestObl.id, c.id)}>
                                Đã thanh toán
                              </Button>
                            )}
                          </div>
                        ) : visiblePayments.length > 0 ? (
                          <span className="text-xs text-success">Đã hoàn thành</span>
                        ) : "—"}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">{c.department || "—"}</TableCell>
                      <TableCell>
                        {c.file_url ? (
                          <a href={c.file_url.startsWith('http') ? c.file_url : `https://${c.file_url}`} target="_blank" rel="noopener noreferrer" className="text-blue-500 hover:underline text-xs break-all line-clamp-2" title={c.file_url}>
                            {c.file_url}
                          </a>
                        ) : "—"}
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-1 items-center">
                          {c.liquidation_file_url ? (
                            <a href={c.liquidation_file_url.startsWith('http') ? c.liquidation_file_url : `https://${c.liquidation_file_url}`} target="_blank" rel="noopener noreferrer" className="text-info hover:underline text-xs break-all line-clamp-1" title={c.liquidation_file_url}>
                              Thanh lý
                            </a>
                          ) : (
                            (c.status === "het_hieu_luc" || c.status === "da_ky") && canEditContract(c) && (
                              <label className="cursor-pointer whitespace-nowrap">
                                <span className="text-xs text-warning hover:underline cursor-pointer border px-2 py-1 rounded-md" onClick={() => {
                                  const url = prompt("Nhập link biên bản thanh lý:");
                                  if (url) {
                                    supabase.from("contracts").update({ liquidation_file_url: url } as any).eq("id", c.id)
                                      .then(({ error }) => {
                                        if (error) toast.error("Lỗi cập nhật link thanh lý", { description: error.message });
                                        else {
                                          toast.success("Đã cập nhật link thanh lý");
                                          if (selectedCategory) fetchContracts(selectedCategory.id);
                                        }
                                      });
                                  }
                                }}>+ Link TL</span>
                              </label>
                            )
                          )}
                        </div>
                      </TableCell>
                      {canEditContract(c) && (
                        <TableCell>
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
                          <a href={detailContract.file_url.startsWith('http') ? detailContract.file_url : `https://${detailContract.file_url}`} target="_blank" rel="noopener noreferrer" className="text-blue-500 hover:underline break-all text-sm block bg-muted/20 p-2 rounded border">
                            {detailContract.file_url}
                          </a>
                        </div>
                      )}

                      {detailContract.liquidation_file_url && (
                        <div className="mt-2">
                          <span className="text-xs text-muted-foreground mb-1 block">Link biên bản thanh lý:</span>
                          <a href={detailContract.liquidation_file_url.startsWith('http') ? detailContract.liquidation_file_url : `https://${detailContract.liquidation_file_url}`} target="_blank" rel="noopener noreferrer" className="text-blue-500 hover:underline break-all text-sm block bg-muted/20 p-2 rounded border">
                            {detailContract.liquidation_file_url}
                          </a>
                        </div>
                      )}

                      {!detailContract.file_url && !detailContract.liquidation_file_url && <span className="text-sm text-muted-foreground italic">Không có link đính kèm</span>}
                    </div>
                  </div>
                </div>
              </DialogContent>
            </Dialog>
          );
        })()}
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
    return a.localeCompare(b);
  });

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

      <Accordion type="multiple" defaultValue={sortedEntities} className="w-full space-y-4">
        {sortedEntities.map(entity => {
          const entityCategories = groupedCategories[entity] || [];
          const totalContracts = entityCategories.reduce((sum: number, cat: any) => sum + (categoryCounts[cat.id] || 0), 0);

          return (
            <AccordionItem key={entity} value={entity} className="border rounded-lg bg-card shadow-sm px-4">
              <AccordionTrigger className="hover:no-underline py-4">
                <div className="flex items-center gap-2">
                  <span className="font-semibold text-lg">{entity}</span>
                  <Badge variant="secondary" className="font-normal text-muted-foreground">{totalContracts} hợp đồng</Badge>
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
    </div>
  );
};

export default ContractCategories;
