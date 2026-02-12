import { useState, useEffect } from "react";
import {
  FileText,
  Clock,
  AlertTriangle,
  CheckCircle,
  ArrowRight,
  Loader2,
  FolderArchive,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
  PieChart,
  Pie,
} from "recharts";
import { Link } from "react-router-dom";
import { useContractStats } from "@/hooks/useContracts";
import { supabase } from "@/integrations/supabase/client";
import { formatDate } from "@/lib/format";

const Dashboard = () => {
  const { contracts, loading, total, signed, pendingReview, expiringSoon, byStatus } = useContractStats();
  const [categories, setCategories] = useState<any[]>([]);
  const [reviewCount, setReviewCount] = useState(0);

  useEffect(() => {
    supabase.from("contract_categories").select("id, name").then(({ data }) => {
      if (data) setCategories(data);
    });
    supabase.from("review_requests").select("id", { count: "exact", head: true }).eq("status", "cho_xu_ly").then(({ count }) => {
      setReviewCount(count || 0);
    });
    // Auto-expire contracts
    supabase.rpc("auto_expire_contracts" as any).then(() => {});
  }, []);

  // Expiring contracts (within 30 days)
  const today = new Date();
  const in30Days = new Date(today);
  in30Days.setDate(in30Days.getDate() + 30);
  const expiringContracts = contracts
    .filter((c) => {
      if (!c.expiry_date || c.status === "het_hieu_luc") return false;
      const exp = new Date(c.expiry_date);
      return exp >= today && exp <= in30Days;
    })
    .sort((a, b) => new Date(a.expiry_date!).getTime() - new Date(b.expiry_date!).getTime());

  // Category stats
  const categoryStats = categories.map((cat) => ({
    name: cat.name,
    value: contracts.filter((c) => c.category_id === cat.id).length,
  })).filter((c) => c.value > 0);

  const stats = [
    { title: "Tổng hợp đồng", value: total, icon: FileText, iconColor: "text-primary", bgColor: "bg-primary/10", link: "/tong-hop-dong" },
    { title: "Sắp hết hạn (30 ngày)", value: expiringSoon, icon: AlertTriangle, iconColor: "text-warning", bgColor: "bg-warning/10", link: "/tong-hop-dong" },
    { title: "Chờ review", value: pendingReview + reviewCount, icon: Clock, iconColor: "text-info", bgColor: "bg-info/10", link: "/yeu-cau-review" },
    { title: "Đã ký", value: signed, icon: CheckCircle, iconColor: "text-success", bgColor: "bg-success/10", link: "/tong-hop-dong" },
  ];

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-accent" />
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Tổng quan</h1>
        <p className="text-muted-foreground">Quản lý hợp đồng và hoạt động pháp chế</p>
      </div>

      {/* Stat Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {stats.map((stat, i) => (
          <Link to={stat.link} key={i}>
            <Card className="border-none shadow-sm hover:shadow-md transition-shadow animate-slide-up cursor-pointer" style={{ animationDelay: `${i * 80}ms`, animationFillMode: "backwards" }}>
              <CardContent className="flex items-center gap-4 p-5">
                <div className={`p-3 rounded-xl ${stat.bgColor}`}>
                  <stat.icon className={`h-5 w-5 ${stat.iconColor}`} />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">{stat.title}</p>
                  <p className="text-3xl font-bold tracking-tight">{stat.value}</p>
                </div>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Status Chart */}
        <Card className="border-none shadow-sm">
          <CardHeader>
            <CardTitle className="text-lg font-semibold">Hợp đồng theo trạng thái</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={240}>
              <BarChart data={byStatus} barSize={40}>
                <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
                <XAxis dataKey="name" fontSize={12} tickLine={false} axisLine={false} />
                <YAxis allowDecimals={false} fontSize={12} tickLine={false} axisLine={false} />
                <Tooltip contentStyle={{ borderRadius: "8px", border: "1px solid hsl(var(--border))", boxShadow: "0 4px 12px rgba(0,0,0,0.08)", fontSize: "13px" }} />
                <Bar dataKey="value" radius={[6, 6, 0, 0]}>
                  {byStatus.map((entry, index) => (
                    <Cell key={index} fill={entry.fill} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Expiring Soon */}
        <Card className="border-none shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
            <CardTitle className="text-lg font-semibold">⚠️ Sắp hết hạn (30 ngày)</CardTitle>
            <Link to="/tong-hop-dong">
              <Button variant="ghost" size="sm" className="text-accent hover:text-accent/80">
                Xem tất cả <ArrowRight className="ml-1 h-4 w-4" />
              </Button>
            </Link>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {expiringContracts.length === 0 && (
                <p className="text-sm text-muted-foreground text-center py-6">Không có hợp đồng nào sắp hết hạn</p>
              )}
              {expiringContracts.slice(0, 6).map((contract) => {
                const daysLeft = Math.ceil((new Date(contract.expiry_date!).getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
                return (
                  <div key={contract.id} className="flex items-center justify-between p-3 rounded-lg bg-muted/50 hover:bg-muted transition-colors">
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-sm truncate">{contract.title}</p>
                      <p className="text-xs text-muted-foreground">{contract.partner_name} • Hết hạn: {formatDate(contract.expiry_date!)}</p>
                    </div>
                    <Badge variant={daysLeft <= 3 ? "destructive" : "secondary"} className={`ml-3 shrink-0 ${daysLeft <= 7 && daysLeft > 3 ? "bg-warning/10 text-warning border-warning/20" : ""}`}>
                      {daysLeft} ngày
                    </Badge>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Category Stats */}
      {categoryStats.length > 0 && (
        <Card className="border-none shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
            <CardTitle className="text-lg font-semibold">Thống kê theo loại hợp đồng</CardTitle>
            <Link to="/tong-hop-dong">
              <Button variant="ghost" size="sm" className="text-accent hover:text-accent/80">
                Quản lý <ArrowRight className="ml-1 h-4 w-4" />
              </Button>
            </Link>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
              {categoryStats.map((cat, i) => (
                <div key={i} className="flex items-center gap-3 p-3 rounded-lg bg-muted/50">
                  <div className="p-2 rounded-lg bg-accent/10">
                    <FolderArchive className="h-4 w-4 text-accent" />
                  </div>
                  <div>
                    <p className="text-sm font-medium truncate">{cat.name}</p>
                    <p className="text-lg font-bold">{cat.value}</p>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default Dashboard;
