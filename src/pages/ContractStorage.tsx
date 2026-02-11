import { useState, useMemo } from "react";
import { Search, Filter, Plus, FolderArchive, ArrowUpDown } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
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
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { mockContracts } from "@/data/mockData";
import {
  CONTRACT_TYPE_LABELS,
  RISK_LEVEL_LABELS,
  CONTRACT_STATUS_LABELS,
} from "@/types";
import { RiskBadge } from "@/components/common/RiskBadge";
import { StatusBadge } from "@/components/common/StatusBadge";
import { ContractTypeBadge } from "@/components/common/ContractTypeBadge";
import { formatCurrency, formatDate } from "@/lib/format";

const ContractStorage = () => {
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [riskFilter, setRiskFilter] = useState<string>("all");
  const [sortField, setSortField] = useState<string>("createdAt");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("desc");

  const filteredContracts = useMemo(() => {
    const filtered = mockContracts.filter((contract) => {
      const matchesSearch =
        search === "" ||
        contract.title.toLowerCase().includes(search.toLowerCase()) ||
        contract.partnerName.toLowerCase().includes(search.toLowerCase());
      const matchesType =
        typeFilter === "all" || contract.contractType === typeFilter;
      const matchesStatus =
        statusFilter === "all" || contract.status === statusFilter;
      const matchesRisk =
        riskFilter === "all" || contract.riskLevel === riskFilter;
      return matchesSearch && matchesType && matchesStatus && matchesRisk;
    });

    filtered.sort((a, b) => {
      let aVal: string | number = "";
      let bVal: string | number = "";
      if (sortField === "createdAt") {
        aVal = new Date(a.createdAt).getTime();
        bVal = new Date(b.createdAt).getTime();
      } else if (sortField === "value") {
        aVal = a.value;
        bVal = b.value;
      } else if (sortField === "expiryDate") {
        aVal = new Date(a.expiryDate).getTime();
        bVal = new Date(b.expiryDate).getTime();
      }
      if (sortOrder === "asc") return aVal > bVal ? 1 : -1;
      return aVal < bVal ? 1 : -1;
    });

    return filtered;
  }, [search, typeFilter, statusFilter, riskFilter, sortField, sortOrder]);

  const toggleSort = (field: string) => {
    if (sortField === field) {
      setSortOrder(sortOrder === "asc" ? "desc" : "asc");
    } else {
      setSortField(field);
      setSortOrder("desc");
    }
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Kho hợp đồng</h1>
          <p className="text-muted-foreground">
            Quản lý và lưu trữ tập trung toàn bộ hợp đồng
          </p>
        </div>
        <Button className="bg-accent hover:bg-accent/90 text-accent-foreground shrink-0">
          <Plus className="h-4 w-4 mr-2" />
          Thêm hợp đồng
        </Button>
      </div>

      {/* Filters */}
      <Card className="border-none shadow-sm">
        <CardContent className="p-4">
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Tìm theo tên hợp đồng, đối tác..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9"
              />
            </div>
            <Select value={typeFilter} onValueChange={setTypeFilter}>
              <SelectTrigger className="w-full sm:w-40">
                <Filter className="h-4 w-4 mr-2 text-muted-foreground" />
                <SelectValue placeholder="Loại HĐ" />
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
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-full sm:w-40">
                <SelectValue placeholder="Trạng thái" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tất cả</SelectItem>
                {Object.entries(CONTRACT_STATUS_LABELS).map(([key, label]) => (
                  <SelectItem key={key} value={key}>
                    {label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={riskFilter} onValueChange={setRiskFilter}>
              <SelectTrigger className="w-full sm:w-36">
                <SelectValue placeholder="Rủi ro" />
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
        Hiển thị {filteredContracts.length} / {mockContracts.length} hợp đồng
      </p>

      {/* Table */}
      <Card className="border-none shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/30">
                <TableHead className="font-semibold">Tên hợp đồng</TableHead>
                <TableHead className="font-semibold">Đối tác</TableHead>
                <TableHead className="font-semibold">Loại</TableHead>
                <TableHead className="font-semibold">Trạng thái</TableHead>
                <TableHead className="font-semibold">
                  <button
                    onClick={() => toggleSort("value")}
                    className="flex items-center gap-1 hover:text-foreground transition-colors"
                  >
                    Giá trị
                    <ArrowUpDown className="h-3 w-3" />
                  </button>
                </TableHead>
                <TableHead className="font-semibold">Hiệu lực</TableHead>
                <TableHead className="font-semibold">
                  <button
                    onClick={() => toggleSort("expiryDate")}
                    className="flex items-center gap-1 hover:text-foreground transition-colors"
                  >
                    Hết hạn
                    <ArrowUpDown className="h-3 w-3" />
                  </button>
                </TableHead>
                <TableHead className="font-semibold">Rủi ro</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredContracts.map((contract) => (
                <TableRow
                  key={contract.id}
                  className="hover:bg-muted/30 transition-colors cursor-pointer"
                >
                  <TableCell className="font-medium max-w-[250px]">
                    <span className="truncate block">{contract.title}</span>
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {contract.partnerName}
                  </TableCell>
                  <TableCell>
                    <ContractTypeBadge type={contract.contractType} />
                  </TableCell>
                  <TableCell>
                    <StatusBadge status={contract.status} type="contract" />
                  </TableCell>
                  <TableCell className="text-sm">
                    {contract.value > 0
                      ? formatCurrency(contract.value)
                      : "—"}
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {formatDate(contract.effectiveDate)}
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {formatDate(contract.expiryDate)}
                  </TableCell>
                  <TableCell>
                    <RiskBadge level={contract.riskLevel} showIcon={false} />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </Card>

      {filteredContracts.length === 0 && (
        <div className="text-center py-12">
          <FolderArchive className="h-12 w-12 text-muted-foreground/30 mx-auto mb-4" />
          <p className="text-muted-foreground font-medium">
            Không tìm thấy hợp đồng phù hợp
          </p>
          <p className="text-sm text-muted-foreground/70 mt-1">
            Thử thay đổi bộ lọc hoặc từ khóa tìm kiếm
          </p>
        </div>
      )}
    </div>
  );
};

export default ContractStorage;
