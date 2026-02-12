import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  FolderArchive,
  Plus,
  ChevronRight,
  ArrowLeft,
  Loader2,
  FileText,
  Upload,
  Trash2,
  Download,
  Eye,
} from "lucide-react";
import { formatDate, formatCurrency } from "@/lib/format";
import { toast } from "sonner";

// Sanitize file name: remove Vietnamese diacritics, spaces, and special characters
// to avoid Supabase Storage "Invalid key" errors
const sanitizeFileName = (name: string): string => {
  return name
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "") // Remove diacritical marks
    .replace(/đ/g, "d")
    .replace(/Đ/g, "D")
    .replace(/\s+/g, "_") // Replace spaces with underscores
    .replace(/[^a-zA-Z0-9._-]/g, ""); // Remove remaining unsafe characters
};

const STATUS_LABELS: Record<string, string> = {
  nhap: "Nháp",
  dang_review: "Đang review",
  da_ky: "Đã ký",
  het_hieu_luc: "Hết hiệu lực",
};

const ContractCategories = () => {
  const { user, role } = useAuth();
  const isAdmin = role === "admin";
  const [categories, setCategories] = useState<any[]>([]);
  const [contracts, setContracts] = useState<any[]>([]);
  const [categoryCounts, setCategoryCounts] = useState<Record<string, number>>({});
  const [selectedCategory, setSelectedCategory] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [uploadDialogOpen, setUploadDialogOpen] = useState(false);
  const [newCatName, setNewCatName] = useState("");
  const [newCatDesc, setNewCatDesc] = useState("");
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);

  // Upload form state
  const [form, setForm] = useState({
    title: "",
    partner_name: "",
    contract_type: "khac" as string,
    status: "nhap" as string,
    value: "",
    effective_date: "",
    expiry_date: "",
    department: "",
    risk_level: "thap" as string,
  });
  const [docFile, setDocFile] = useState<File | null>(null);
  const [signedPdfFile, setSignedPdfFile] = useState<File | null>(null);

  const fetchCategories = async () => {
    const { data } = await supabase.from("contract_categories").select("*").order("name");
    if (data) {
      setCategories(data);
      // Fetch contract counts per category
      const { data: allContracts } = await supabase.from("contracts").select("category_id");
      if (allContracts) {
        const counts: Record<string, number> = {};
        allContracts.forEach((c: any) => {
          if (c.category_id) counts[c.category_id] = (counts[c.category_id] || 0) + 1;
        });
        setCategoryCounts(counts);
      }
    }
    setLoading(false);
  };

  const fetchContracts = async (categoryId: string) => {
    const { data } = await supabase
      .from("contracts")
      .select("*")
      .eq("category_id", categoryId)
      .order("created_at", { ascending: false });
    if (data) setContracts(data);
  };

  useEffect(() => { fetchCategories(); }, []);
  useEffect(() => {
    if (selectedCategory) fetchContracts(selectedCategory.id);
  }, [selectedCategory]);

  const handleAddCategory = async () => {
    if (!newCatName.trim()) return;
    setSaving(true);
    const { error } = await supabase.from("contract_categories").insert({
      name: newCatName.trim(),
      description: newCatDesc.trim(),
      created_by: user?.id,
    });
    setSaving(false);
    if (error) {
      toast.error("Lỗi", { description: error.message });
    } else {
      toast.success("Đã tạo loại hợp đồng mới");
      setDialogOpen(false);
      setNewCatName("");
      setNewCatDesc("");
      fetchCategories();
    }
  };

  const handleDeleteCategory = async (catId: string) => {
    const { error } = await supabase.from("contract_categories").delete().eq("id", catId);
    if (error) {
      toast.error("Lỗi xóa", { description: error.message });
    } else {
      toast.success("Đã xóa loại hợp đồng");
      fetchCategories();
    }
  };

  const handleDeleteContract = async (contractId: string) => {
    const { error } = await supabase.from("contracts").delete().eq("id", contractId);
    if (error) {
      toast.error("Lỗi xóa", { description: error.message });
    } else {
      toast.success("Đã xóa hợp đồng");
      if (selectedCategory) fetchContracts(selectedCategory.id);
    }
  };

  const uploadFile = async (file: File, path: string) => {
    const { data, error } = await supabase.storage.from("contracts").upload(path, file, { upsert: true });
    if (error) throw error;
    const { data: urlData } = supabase.storage.from("contracts").getPublicUrl(path);
    return urlData.publicUrl;
  };

  const handleUploadContract = async () => {
    if (!form.title.trim() || !selectedCategory) return;
    setUploading(true);

    try {
      let fileUrl: string | null = null;
      let signedFileUrl: string | null = null;
      const timestamp = Date.now();

      if (docFile) {
        const path = `${user?.id}/${timestamp}_doc_${sanitizeFileName(docFile.name)}`;
        fileUrl = await uploadFile(docFile, path);
      }
      if (signedPdfFile) {
        const path = `${user?.id}/${timestamp}_signed_${sanitizeFileName(signedPdfFile.name)}`;
        signedFileUrl = await uploadFile(signedPdfFile, path);
      }

      const { error } = await supabase.from("contracts").insert({
        title: form.title.trim(),
        partner_name: form.partner_name.trim(),
        contract_type: form.contract_type as any,
        status: form.status as any,
        value: parseInt(form.value) || 0,
        effective_date: form.effective_date || null,
        expiry_date: form.expiry_date || null,
        department: form.department,
        risk_level: form.risk_level as any,
        category_id: selectedCategory.id,
        created_by: user?.id,
        file_url: fileUrl,
        signed_file_url: signedFileUrl,
      });

      if (error) throw error;

      toast.success("Đã thêm hợp đồng thành công");
      setUploadDialogOpen(false);
      resetForm();
      fetchContracts(selectedCategory.id);
    } catch (err: any) {
      toast.error("Lỗi", { description: err.message });
    }
    setUploading(false);
  };

  const handleUploadLiquidation = async (contractId: string, file: File) => {
    try {
      const path = `${user?.id}/${Date.now()}_liquidation_${sanitizeFileName(file.name)}`;
      const url = await uploadFile(file, path);
      await supabase.from("contracts").update({ liquidation_file_url: url } as any).eq("id", contractId);
      toast.success("Đã tải biên bản thanh lý");
      if (selectedCategory) fetchContracts(selectedCategory.id);
    } catch (err: any) {
      toast.error("Lỗi", { description: err.message });
    }
  };

  const resetForm = () => {
    setForm({ title: "", partner_name: "", contract_type: "khac", status: "nhap", value: "", effective_date: "", expiry_date: "", department: "", risk_level: "thap" });
    setDocFile(null);
    setSignedPdfFile(null);
  };

  if (loading) {
    return <div className="flex items-center justify-center h-64"><Loader2 className="h-8 w-8 animate-spin text-accent" /></div>;
  }

  // Contract detail view
  if (selectedCategory) {
    return (
      <div className="space-y-6 animate-fade-in">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => { setSelectedCategory(null); setContracts([]); }}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div className="flex-1">
            <h1 className="text-2xl font-bold tracking-tight">{selectedCategory.name}</h1>
            <p className="text-muted-foreground">{selectedCategory.description || "Danh sách hợp đồng"}</p>
          </div>
          <Dialog open={uploadDialogOpen} onOpenChange={(o) => { setUploadDialogOpen(o); if (!o) resetForm(); }}>
            <DialogTrigger asChild>
              <Button className="bg-accent hover:bg-accent/90 text-accent-foreground">
                <Upload className="h-4 w-4 mr-2" />
                Upload hợp đồng
              </Button>
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
                    <Label>Loại hợp đồng</Label>
                    <Select value={form.contract_type} onValueChange={(v) => setForm({ ...form, contract_type: v })}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="mua_ban">Mua bán</SelectItem>
                        <SelectItem value="dich_vu">Dịch vụ</SelectItem>
                        <SelectItem value="nda">NDA</SelectItem>
                        <SelectItem value="hop_tac">Hợp tác</SelectItem>
                        <SelectItem value="lao_dong">Lao động</SelectItem>
                        <SelectItem value="thue">Thuê</SelectItem>
                        <SelectItem value="khac">Khác</SelectItem>
                      </SelectContent>
                    </Select>
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
                        <SelectItem value="nhap">Nháp (Draft)</SelectItem>
                        <SelectItem value="dang_review">Đang review</SelectItem>
                        <SelectItem value="da_ky">Đã ký (Signed)</SelectItem>
                        <SelectItem value="het_hieu_luc">Hết hiệu lực (Expired)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Ngày hiệu lực *</Label>
                    <Input type="date" value={form.effective_date} onChange={(e) => setForm({ ...form, effective_date: e.target.value })} />
                  </div>
                  <div className="space-y-2">
                    <Label>Thời hạn nghĩa vụ *</Label>
                    <Input type="date" value={form.expiry_date} onChange={(e) => setForm({ ...form, expiry_date: e.target.value })} />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Đơn vị phụ trách</Label>
                    <Input value={form.department} onChange={(e) => setForm({ ...form, department: e.target.value })} placeholder="VD: Phòng Pháp chế" />
                  </div>
                  <div className="space-y-2">
                    <Label>Mức rủi ro</Label>
                    <Select value={form.risk_level} onValueChange={(v) => setForm({ ...form, risk_level: v })}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="thap">Thấp</SelectItem>
                        <SelectItem value="trung_binh">Trung bình</SelectItem>
                        <SelectItem value="cao">Cao</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>File .doc / .docx</Label>
                  <Input type="file" accept=".doc,.docx" onChange={(e) => setDocFile(e.target.files?.[0] || null)} />
                </div>
                <div className="space-y-2">
                  <Label>File PDF đã ký & scan</Label>
                  <Input type="file" accept=".pdf" onChange={(e) => setSignedPdfFile(e.target.files?.[0] || null)} />
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => { setUploadDialogOpen(false); resetForm(); }}>Hủy</Button>
                <Button className="bg-accent hover:bg-accent/90 text-accent-foreground" onClick={handleUploadContract} disabled={uploading || !form.title.trim()}>
                  {uploading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                  Upload
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>

        <Card className="border-none shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/30">
                  <TableHead>Tên hợp đồng</TableHead>
                  <TableHead>Đối tác</TableHead>
                  <TableHead>Trạng thái</TableHead>
                  <TableHead>Hiệu lực</TableHead>
                  <TableHead>Hết hạn</TableHead>
                  <TableHead>Đơn vị</TableHead>
                  <TableHead>Files</TableHead>
                  {isAdmin && <TableHead>Thao tác</TableHead>}
                </TableRow>
              </TableHeader>
              <TableBody>
                {contracts.map((c) => (
                  <TableRow key={c.id} className="hover:bg-muted/30 transition-colors">
                    <TableCell className="font-medium max-w-[200px]">
                      <span className="truncate block">{c.title}</span>
                    </TableCell>
                    <TableCell className="text-muted-foreground">{c.partner_name || "—"}</TableCell>
                    <TableCell>
                      <Badge variant="secondary">{STATUS_LABELS[c.status] || c.status}</Badge>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">{c.effective_date ? formatDate(c.effective_date) : "—"}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">{c.expiry_date ? formatDate(c.expiry_date) : "—"}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">{c.department || "—"}</TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        {c.file_url && (
                          <a href={c.file_url} target="_blank" rel="noopener noreferrer">
                            <Button variant="ghost" size="icon" className="h-7 w-7" title="File DOC">
                              <FileText className="h-3.5 w-3.5" />
                            </Button>
                          </a>
                        )}
                        {c.signed_file_url && (
                          <a href={c.signed_file_url} target="_blank" rel="noopener noreferrer">
                            <Button variant="ghost" size="icon" className="h-7 w-7" title="PDF đã ký">
                              <Eye className="h-3.5 w-3.5 text-success" />
                            </Button>
                          </a>
                        )}
                        {c.liquidation_file_url && (
                          <a href={c.liquidation_file_url} target="_blank" rel="noopener noreferrer">
                            <Button variant="ghost" size="icon" className="h-7 w-7" title="Biên bản thanh lý">
                              <Download className="h-3.5 w-3.5 text-info" />
                            </Button>
                          </a>
                        )}
                        {(c.status === "het_hieu_luc" || c.status === "da_ky") && !c.liquidation_file_url && isAdmin && (
                          <label className="cursor-pointer">
                            <input type="file" accept=".pdf,.doc,.docx" className="hidden" onChange={(e) => {
                              const file = e.target.files?.[0];
                              if (file) handleUploadLiquidation(c.id, file);
                            }} />
                            <Button variant="ghost" size="icon" className="h-7 w-7" title="Thêm biên bản thanh lý" asChild>
                              <span><Upload className="h-3.5 w-3.5 text-warning" /></span>
                            </Button>
                          </label>
                        )}
                      </div>
                    </TableCell>
                    {isAdmin && (
                      <TableCell>
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive hover:text-destructive">
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>Xác nhận xóa?</AlertDialogTitle>
                              <AlertDialogDescription>Hợp đồng "{c.title}" sẽ bị xóa vĩnh viễn. Hành động này không thể hoàn tác.</AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Hủy</AlertDialogCancel>
                              <AlertDialogAction onClick={() => handleDeleteContract(c.id)} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">Xóa</AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      </TableCell>
                    )}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </Card>

        {contracts.length === 0 && (
          <div className="text-center py-12">
            <FileText className="h-12 w-12 text-muted-foreground/30 mx-auto mb-4" />
            <p className="text-muted-foreground font-medium">Chưa có hợp đồng nào</p>
            <p className="text-sm text-muted-foreground/70 mt-1">Nhấn "Upload hợp đồng" để thêm</p>
          </div>
        )}
      </div>
    );
  }

  // Category list view
  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Tổng hợp đồng</h1>
          <p className="text-muted-foreground">Kho lưu trữ hợp đồng tập trung theo loại</p>
        </div>
        {isAdmin && (
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button className="bg-accent hover:bg-accent/90 text-accent-foreground shrink-0">
                <Plus className="h-4 w-4 mr-2" />
                Tạo loại hợp đồng
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>Tạo loại hợp đồng mới</DialogTitle></DialogHeader>
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label>Tên loại hợp đồng *</Label>
                  <Input value={newCatName} onChange={(e) => setNewCatName(e.target.value)} placeholder="VD: Hợp đồng bảo hiểm" />
                </div>
                <div className="space-y-2">
                  <Label>Mô tả</Label>
                  <Input value={newCatDesc} onChange={(e) => setNewCatDesc(e.target.value)} placeholder="Mô tả ngắn gọn" />
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setDialogOpen(false)}>Hủy</Button>
                <Button className="bg-accent hover:bg-accent/90 text-accent-foreground" onClick={handleAddCategory} disabled={saving || !newCatName.trim()}>
                  {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                  Tạo
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        )}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {categories.map((cat, i) => (
          <Card
            key={cat.id}
            className="border shadow-sm hover:shadow-md transition-all cursor-pointer animate-slide-up group"
            style={{ animationDelay: `${i * 60}ms`, animationFillMode: "backwards" }}
            onClick={() => setSelectedCategory(cat)}
          >
            <CardContent className="p-5 flex items-center gap-4">
              <div className="p-3 rounded-xl bg-accent/10 shrink-0">
                <FolderArchive className="h-6 w-6 text-accent" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-semibold truncate">{cat.name}</p>
                <p className="text-sm text-muted-foreground truncate">{categoryCounts[cat.id] || 0} hợp đồng</p>
              </div>
              <div className="flex items-center gap-1">
                {isAdmin && (
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button variant="ghost" size="icon" className="h-8 w-8 opacity-0 group-hover:opacity-100 transition-opacity text-destructive hover:text-destructive" onClick={(e) => e.stopPropagation()}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent onClick={(e) => e.stopPropagation()}>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Xác nhận xóa?</AlertDialogTitle>
                        <AlertDialogDescription>Loại "{cat.name}" sẽ bị xóa. Các hợp đồng trong danh mục này sẽ không bị xóa nhưng sẽ mất liên kết.</AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Hủy</AlertDialogCancel>
                        <AlertDialogAction onClick={() => handleDeleteCategory(cat.id)} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">Xóa</AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                )}
                <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {categories.length === 0 && (
        <div className="text-center py-12">
          <FolderArchive className="h-12 w-12 text-muted-foreground/30 mx-auto mb-4" />
          <p className="text-muted-foreground font-medium">Chưa có loại hợp đồng nào</p>
          <p className="text-sm text-muted-foreground/70 mt-1">{isAdmin ? 'Nhấn "Tạo loại hợp đồng" để bắt đầu' : "Liên hệ admin để tạo danh mục"}</p>
        </div>
      )}
    </div>
  );
};

export default ContractCategories;
