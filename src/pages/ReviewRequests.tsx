import { useState, useMemo } from "react";
import { Search, Plus, FileSearch, MessageSquare, Calendar, Building2, DollarSign } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
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
  DialogTrigger,
  DialogFooter,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";
import { mockReviewRequests } from "@/data/mockData";
import { REVIEW_STATUS_LABELS } from "@/types";
import type { ReviewStatus } from "@/types";
import { StatusBadge } from "@/components/common/StatusBadge";
import { formatCurrency, formatDate } from "@/lib/format";
import { toast } from "sonner";

const ReviewRequests = () => {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [dialogOpen, setDialogOpen] = useState(false);

  const filteredRequests = useMemo(() => {
    return mockReviewRequests.filter((req) => {
      const matchesSearch =
        search === "" ||
        req.contractTitle.toLowerCase().includes(search.toLowerCase()) ||
        req.partnerName.toLowerCase().includes(search.toLowerCase()) ||
        req.requesterName.toLowerCase().includes(search.toLowerCase());
      const matchesStatus =
        statusFilter === "all" || req.status === statusFilter;
      return matchesSearch && matchesStatus;
    });
  }, [search, statusFilter]);

  const handleSubmitRequest = () => {
    toast.success("Yêu cầu review đã được tạo", {
      description: "Bộ phận pháp chế sẽ xem xét trong thời gian sớm nhất.",
    });
    setDialogOpen(false);
  };

  const statusCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    mockReviewRequests.forEach((req) => {
      counts[req.status] = (counts[req.status] || 0) + 1;
    });
    return counts;
  }, []);

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Yêu cầu review hợp đồng</h1>
          <p className="text-muted-foreground">
            Quản lý quy trình gửi và xử lý yêu cầu review
          </p>
        </div>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button className="bg-accent hover:bg-accent/90 text-accent-foreground shrink-0">
              <Plus className="h-4 w-4 mr-2" />
              Tạo yêu cầu
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-lg">
            <DialogHeader>
              <DialogTitle>Tạo yêu cầu review hợp đồng</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label>Tên hợp đồng</Label>
                <Input placeholder="Nhập tên hợp đồng..." />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Tên đối tác</Label>
                  <Input placeholder="Tên công ty đối tác..." />
                </div>
                <div className="space-y-2">
                  <Label>Giá trị hợp đồng (VNĐ)</Label>
                  <Input type="number" placeholder="0" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Thời hạn thanh toán</Label>
                  <Input placeholder="VD: 30 ngày sau nhận hàng" />
                </div>
                <div className="space-y-2">
                  <Label>Thời hạn hợp đồng</Label>
                  <Input placeholder="VD: 12 tháng" />
                </div>
              </div>
              <div className="space-y-2">
                <Label>File hợp đồng</Label>
                <Input type="file" accept=".pdf,.doc,.docx" />
                <p className="text-xs text-muted-foreground">
                  Hỗ trợ file PDF, DOC, DOCX
                </p>
              </div>
              <div className="space-y-2">
                <Label>Ghi chú thêm</Label>
                <Textarea
                  placeholder="Mô tả thêm về hợp đồng cần review..."
                  rows={3}
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setDialogOpen(false)}>
                Hủy
              </Button>
              <Button
                className="bg-accent hover:bg-accent/90 text-accent-foreground"
                onClick={handleSubmitRequest}
              >
                Gửi yêu cầu
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {/* Status Summary */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
        {(Object.entries(REVIEW_STATUS_LABELS) as [ReviewStatus, string][]).map(
          ([key, label]) => (
            <Card
              key={key}
              className={`border shadow-sm cursor-pointer transition-all hover:shadow-md ${
                statusFilter === key ? "ring-2 ring-accent" : ""
              }`}
              onClick={() =>
                setStatusFilter(statusFilter === key ? "all" : key)
              }
            >
              <CardContent className="p-3 text-center">
                <p className="text-2xl font-bold">{statusCounts[key] || 0}</p>
                <p className="text-xs text-muted-foreground mt-1">{label}</p>
              </CardContent>
            </Card>
          )
        )}
      </div>

      {/* Search */}
      <Card className="border-none shadow-sm">
        <CardContent className="p-4">
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Tìm theo tên hợp đồng, đối tác, người yêu cầu..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9"
              />
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-full sm:w-48">
                <SelectValue placeholder="Trạng thái" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tất cả trạng thái</SelectItem>
                {Object.entries(REVIEW_STATUS_LABELS).map(([key, label]) => (
                  <SelectItem key={key} value={key}>
                    {label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Review Cards */}
      <div className="space-y-4">
        {filteredRequests.map((request, i) => (
          <Card
            key={request.id}
            className="border shadow-sm hover:shadow-md transition-all animate-slide-up"
            style={{ animationDelay: `${i * 80}ms`, animationFillMode: 'backwards' }}
          >
            <CardHeader className="pb-3">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="flex items-start gap-3">
                  <div className="p-2 rounded-lg bg-info/10 shrink-0 mt-0.5">
                    <FileSearch className="h-4 w-4 text-info" />
                  </div>
                  <div>
                    <CardTitle className="text-base font-semibold">
                      {request.contractTitle}
                    </CardTitle>
                    <p className="text-sm text-muted-foreground mt-0.5">
                      Yêu cầu bởi{" "}
                      <span className="font-medium text-foreground">
                        {request.requesterName}
                      </span>{" "}
                      — {request.requesterDepartment}
                    </p>
                  </div>
                </div>
                <StatusBadge status={request.status} type="review" />
              </div>
            </CardHeader>
            <CardContent className="pt-0 space-y-4">
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 p-3 rounded-lg bg-muted/40">
                <div className="flex items-center gap-2">
                  <Building2 className="h-4 w-4 text-muted-foreground shrink-0" />
                  <div>
                    <p className="text-xs text-muted-foreground">Đối tác</p>
                    <p className="text-sm font-medium">{request.partnerName}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <DollarSign className="h-4 w-4 text-muted-foreground shrink-0" />
                  <div>
                    <p className="text-xs text-muted-foreground">Giá trị</p>
                    <p className="text-sm font-medium">
                      {request.contractValue > 0
                        ? formatCurrency(request.contractValue)
                        : "Không áp dụng"}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Calendar className="h-4 w-4 text-muted-foreground shrink-0" />
                  <div>
                    <p className="text-xs text-muted-foreground">Thời hạn HĐ</p>
                    <p className="text-sm font-medium">
                      {request.contractDuration}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Calendar className="h-4 w-4 text-muted-foreground shrink-0" />
                  <div>
                    <p className="text-xs text-muted-foreground">Ngày gửi</p>
                    <p className="text-sm font-medium">
                      {formatDate(request.createdAt)}
                    </p>
                  </div>
                </div>
              </div>

              {/* Notes */}
              {request.notes.length > 0 && (
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <MessageSquare className="h-4 w-4 text-muted-foreground" />
                    <p className="text-sm font-medium">
                      Ghi chú ({request.notes.length})
                    </p>
                  </div>
                  <div className="space-y-2 pl-6">
                    {request.notes.map((note) => (
                      <div
                        key={note.id}
                        className="p-3 rounded-lg bg-card border text-sm"
                      >
                        <div className="flex items-center justify-between mb-1">
                          <span className="font-medium text-xs">
                            {note.author}
                          </span>
                          <span className="text-xs text-muted-foreground">
                            {formatDate(note.createdAt)}
                          </span>
                        </div>
                        <p className="text-muted-foreground">{note.content}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <Separator />

              <div className="flex items-center justify-between">
                <p className="text-xs text-muted-foreground">
                  📎 {request.fileName}
                </p>
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" className="text-xs">
                    Xem chi tiết
                  </Button>
                  {(request.status === "cho_xu_ly" ||
                    request.status === "dang_review") && (
                    <Button
                      size="sm"
                      className="text-xs bg-accent hover:bg-accent/90 text-accent-foreground"
                    >
                      Xử lý
                    </Button>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {filteredRequests.length === 0 && (
        <div className="text-center py-12">
          <FileSearch className="h-12 w-12 text-muted-foreground/30 mx-auto mb-4" />
          <p className="text-muted-foreground font-medium">
            Không có yêu cầu review nào
          </p>
          <p className="text-sm text-muted-foreground/70 mt-1">
            Thử thay đổi bộ lọc hoặc tạo yêu cầu mới
          </p>
        </div>
      )}
    </div>
  );
};

export default ReviewRequests;
