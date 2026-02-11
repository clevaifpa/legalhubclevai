import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from "@/components/ui/dialog";
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
  Upload,
  ChevronRight,
  ArrowLeft,
  Loader2,
  FileText,
} from "lucide-react";
import { formatDate } from "@/lib/format";
import { toast } from "sonner";

const ContractCategories = () => {
  const { user } = useAuth();
  const [categories, setCategories] = useState<any[]>([]);
  const [contracts, setContracts] = useState<any[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [uploadDialogOpen, setUploadDialogOpen] = useState(false);
  const [newCatName, setNewCatName] = useState("");
  const [newCatDesc, setNewCatDesc] = useState("");
  const [contractTitle, setContractTitle] = useState("");
  const [contractPartner, setContractPartner] = useState("");
  const [saving, setSaving] = useState(false);

  const fetchCategories = async () => {
    const { data } = await supabase.from("contract_categories").select("*").order("name");
    if (data) setCategories(data);
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

  const handleUploadContract = async () => {
    if (!contractTitle.trim() || !selectedCategory) return;
    setSaving(true);
    const { error } = await supabase.from("contracts").insert({
      title: contractTitle.trim(),
      partner_name: contractPartner.trim(),
      category_id: selectedCategory.id,
      created_by: user?.id,
    });
    setSaving(false);
    if (error) {
      toast.error("Lỗi", { description: error.message });
    } else {
      toast.success("Đã thêm hợp đồng");
      setUploadDialogOpen(false);
      setContractTitle("");
      setContractPartner("");
      fetchContracts(selectedCategory.id);
    }
  };

  if (loading) {
    return <div className="flex items-center justify-center h-64"><Loader2 className="h-8 w-8 animate-spin text-accent" /></div>;
  }

  if (selectedCategory) {
    return (
      <div className="space-y-6 animate-fade-in">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => { setSelectedCategory(null); setContracts([]); }}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">{selectedCategory.name}</h1>
            <p className="text-muted-foreground">{selectedCategory.description || "Danh sách hợp đồng"}</p>
          </div>
        </div>

        <div className="flex justify-end">
          <Dialog open={uploadDialogOpen} onOpenChange={setUploadDialogOpen}>
            <DialogTrigger asChild>
              <Button className="bg-accent hover:bg-accent/90 text-accent-foreground">
                <Plus className="h-4 w-4 mr-2" />
                Thêm hợp đồng
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>Thêm hợp đồng</DialogTitle></DialogHeader>
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label>Tên hợp đồng *</Label>
                  <Input value={contractTitle} onChange={(e) => setContractTitle(e.target.value)} placeholder="VD: Hợp đồng thuê văn phòng" />
                </div>
                <div className="space-y-2">
                  <Label>Đối tác</Label>
                  <Input value={contractPartner} onChange={(e) => setContractPartner(e.target.value)} placeholder="Tên đối tác" />
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setUploadDialogOpen(false)}>Hủy</Button>
                <Button className="bg-accent hover:bg-accent/90 text-accent-foreground" onClick={handleUploadContract} disabled={saving || !contractTitle.trim()}>
                  {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                  Thêm
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
                  <TableHead>Ngày tạo</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {contracts.map((c) => (
                  <TableRow key={c.id}>
                    <TableCell className="font-medium">{c.title}</TableCell>
                    <TableCell className="text-muted-foreground">{c.partner_name || "—"}</TableCell>
                    <TableCell>
                      <Badge variant="secondary">{c.status === "da_ky" ? "Đã ký" : c.status === "nhap" ? "Nháp" : c.status}</Badge>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">{formatDate(c.created_at)}</TableCell>
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
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Tổng hợp đồng</h1>
          <p className="text-muted-foreground">Kho lưu trữ hợp đồng tập trung theo loại</p>
        </div>
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
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {categories.map((cat, i) => (
          <Card
            key={cat.id}
            className="border shadow-sm hover:shadow-md transition-all cursor-pointer animate-slide-up"
            style={{ animationDelay: `${i * 60}ms`, animationFillMode: "backwards" }}
            onClick={() => setSelectedCategory(cat)}
          >
            <CardContent className="p-5 flex items-center gap-4">
              <div className="p-3 rounded-xl bg-accent/10 shrink-0">
                <FolderArchive className="h-6 w-6 text-accent" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-semibold truncate">{cat.name}</p>
                <p className="text-sm text-muted-foreground truncate">{cat.description || "Nhấn để xem danh sách"}</p>
              </div>
              <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
            </CardContent>
          </Card>
        ))}
      </div>

      {categories.length === 0 && (
        <div className="text-center py-12">
          <FolderArchive className="h-12 w-12 text-muted-foreground/30 mx-auto mb-4" />
          <p className="text-muted-foreground font-medium">Chưa có loại hợp đồng nào</p>
        </div>
      )}
    </div>
  );
};

export default ContractCategories;
