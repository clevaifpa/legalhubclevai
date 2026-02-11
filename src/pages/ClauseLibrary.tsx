import { useState, useMemo } from "react";
import { Search, Copy, Filter, Plus, BookOpen } from "lucide-react";
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
import { mockClauses } from "@/data/mockData";
import { CONTRACT_TYPE_LABELS, RISK_LEVEL_LABELS } from "@/types";
import type { ContractType, RiskLevel } from "@/types";
import { RiskBadge } from "@/components/common/RiskBadge";
import { ContractTypeBadge } from "@/components/common/ContractTypeBadge";
import { toast } from "sonner";

const ClauseLibrary = () => {
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState<string>("all");
  const [riskFilter, setRiskFilter] = useState<string>("all");

  const filteredClauses = useMemo(() => {
    return mockClauses.filter((clause) => {
      const matchesSearch =
        search === "" ||
        clause.name.toLowerCase().includes(search.toLowerCase()) ||
        clause.content.toLowerCase().includes(search.toLowerCase());
      const matchesType = typeFilter === "all" || clause.contractType === typeFilter;
      const matchesRisk = riskFilter === "all" || clause.riskLevel === riskFilter;
      return matchesSearch && matchesType && matchesRisk;
    });
  }, [search, typeFilter, riskFilter]);

  const handleCopy = (content: string, name: string) => {
    navigator.clipboard.writeText(content);
    toast.success(`Đã sao chép "${name}"`, {
      description: "Điều khoản đã được sao chép vào clipboard",
    });
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Kho điều khoản chuẩn</h1>
          <p className="text-muted-foreground">
            Quản lý và sử dụng các điều khoản hợp đồng mẫu
          </p>
        </div>
        <Button className="bg-accent hover:bg-accent/90 text-accent-foreground shrink-0">
          <Plus className="h-4 w-4 mr-2" />
          Thêm điều khoản
        </Button>
      </div>

      {/* Filters */}
      <Card className="border-none shadow-sm">
        <CardContent className="p-4">
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Tìm kiếm điều khoản..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9"
              />
            </div>
            <Select value={typeFilter} onValueChange={setTypeFilter}>
              <SelectTrigger className="w-full sm:w-44">
                <Filter className="h-4 w-4 mr-2 text-muted-foreground" />
                <SelectValue placeholder="Loại hợp đồng" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tất cả loại</SelectItem>
                {Object.entries(CONTRACT_TYPE_LABELS).map(([key, label]) => (
                  <SelectItem key={key} value={key}>
                    {label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={riskFilter} onValueChange={setRiskFilter}>
              <SelectTrigger className="w-full sm:w-40">
                <SelectValue placeholder="Mức rủi ro" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tất cả</SelectItem>
                {Object.entries(RISK_LEVEL_LABELS).map(([key, label]) => (
                  <SelectItem key={key} value={key}>
                    {label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Results count */}
      <p className="text-sm text-muted-foreground">
        Hiển thị {filteredClauses.length} / {mockClauses.length} điều khoản
      </p>

      {/* Clauses Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {filteredClauses.map((clause, i) => (
          <Card
            key={clause.id}
            className="border shadow-sm hover:shadow-md transition-all animate-slide-up group"
            style={{ animationDelay: `${i * 60}ms`, animationFillMode: 'backwards' }}
          >
            <CardHeader className="pb-3">
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-start gap-3 flex-1 min-w-0">
                  <div className="p-2 rounded-lg bg-accent/10 shrink-0 mt-0.5">
                    <BookOpen className="h-4 w-4 text-accent" />
                  </div>
                  <div className="min-w-0">
                    <CardTitle className="text-base font-semibold leading-tight">
                      {clause.name}
                    </CardTitle>
                    <div className="flex flex-wrap gap-2 mt-2">
                      <ContractTypeBadge type={clause.contractType} />
                      <RiskBadge level={clause.riskLevel} />
                    </div>
                  </div>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  className="shrink-0 opacity-0 group-hover:opacity-100 transition-opacity"
                  onClick={() => handleCopy(clause.content, clause.name)}
                >
                  <Copy className="h-4 w-4" />
                </Button>
              </div>
            </CardHeader>
            <CardContent className="pt-0 space-y-3">
              <p className="text-sm text-foreground/80 leading-relaxed line-clamp-3">
                {clause.content}
              </p>
              {clause.notes && (
                <div className="p-3 rounded-lg bg-muted/50 border border-border/50">
                  <p className="text-xs font-medium text-muted-foreground mb-1">
                    📝 Ghi chú khi sử dụng
                  </p>
                  <p className="text-xs text-muted-foreground leading-relaxed line-clamp-2">
                    {clause.notes}
                  </p>
                </div>
              )}
              <div className="flex justify-end">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleCopy(clause.content, clause.name)}
                  className="text-xs"
                >
                  <Copy className="h-3 w-3 mr-1.5" />
                  Sao chép điều khoản
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {filteredClauses.length === 0 && (
        <div className="text-center py-12">
          <BookOpen className="h-12 w-12 text-muted-foreground/30 mx-auto mb-4" />
          <p className="text-muted-foreground font-medium">
            Không tìm thấy điều khoản phù hợp
          </p>
          <p className="text-sm text-muted-foreground/70 mt-1">
            Thử thay đổi bộ lọc hoặc từ khóa tìm kiếm
          </p>
        </div>
      )}
    </div>
  );
};

export default ClauseLibrary;
