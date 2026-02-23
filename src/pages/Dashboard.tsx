import { useState, useEffect } from "react";
import {
  FileText,
  Clock,
  AlertTriangle,
  CheckCircle,
  ArrowRight,
  Loader2,
  FolderArchive,
  DollarSign,
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
} from "recharts";
import { Link } from "react-router-dom";
import { useContractStats } from "@/hooks/useContracts";
import { supabase } from "@/integrations/supabase/client";
import { formatDate, formatCurrency } from "@/lib/format";

const Dashboard = () => {
  const { contracts, loading, total, signed, pendingReview, expiringSoon, byStatus } = useContractStats();
  const [categories, setCategories] = useState<any[]>([]);
  const [reviewCount, setReviewCount] = useState(0);
  const [overdueReviews, setOverdueReviews] = useState<any[]>([]);
  const [upcomingPayments, setUpcomingPayments] = useState<any[]>([]);

  useEffect(() => {
    supabase.from("contract_categories").select("id, name").then(({ data }) => {
      if (data) setCategories(data);
    });
    supabase.from("review_requests").select("id", { count: "exact", head: true }).eq("status", "cho_xu_ly").then(({ count }) => {
      setReviewCount(count || 0);
    });

    // Fetch overdue reviews (past request_deadline but still pending/in_review)
    const today = new Date().toISOString().split("T")[0];
    supabase
      .from("review_requests")
      .select("id, contract_title, requester_name, department, request_deadline, status")
      .in("status", ["cho_xu_ly", "dang_review"])
      .lt("request_deadline", today)
      .order("request_deadline", { ascending: true })
      .limit(10)
      .then(({ data }) => {
        if (data) setOverdueReviews(data);
      });

    // Fetch upcoming payment schedules (within 30 days)
    const in30Days = new Date();
    in30Days.setDate(in30Days.getDate() + 30);
    supabase
      .from("contract_payment_schedules")
      .select("id, phase_name, payment_amount, payment_due_date, payment_status, contract_id")
      .eq("payment_status", "chua_thanh_toan")
      .gte("payment_due_date", today)
      .lte("payment_due_date", in30Days.toISOString().split("T")[0])
      .order("payment_due_date", { ascending: true })
      .limit(10)
      .then(({ data }) => {
        if (data) setUpcomingPayments(data);
      });

    // Auto-expire contracts
    supabase.rpc("auto_expire_contracts" as any).then(() => {});
  }, []);

  // Expiring contracts (within 60 days)
  const today = new Date();
  const in60Days = new Date(today);
  in60Days.setDate(in60Days.getDate() + 60);
  const expiringContracts = contracts
    .filter((c) => {
      if (!c.expiry_date || c.status === "het_hieu_luc") return false;
      const exp = new Date(c.expiry_date);
      return exp >= today && exp <= in60Days;
    })
    .sort((a, b) => new Date(a.expiry_date!).getTime() - new Date(b.expiry_date!).getTime());

  // Category stats
  const categoryStats = categories.map((cat) => ({
    name: cat.name,
    value: contracts.filter((c) => c.category_id === cat.id).length,
  })).filter((c) => c.value > 0);

  // Count expiring within 60 days
  const expiring60 = expiringContracts.length;

  const stats = [
    { title: "Tổng hợp đồng", value: total, icon: FileText, iconColor: "text-primary", bgColor: "bg-primary/10", link: "/tong-hop-dong" },
    { title: "Sắp hết hạn (60 ngày)", value: expiring60, icon: AlertTriangle, iconColor: "text-warning", bgColor: "bg-warning/10", link: "/tong-hop-dong" },
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

        {/* Expiring Soon (60 days) */}
        <Card className="border-none shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
            <CardTitle className="text-lg font-semibold">⚠️ Sắp hết hạn (60 ngày)</CardTitle>
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
                    <Badge variant={daysLeft <= 7 ? "destructive" : "secondary"} className={`ml-3 shrink-0 ${daysLeft <= 30 && daysLeft > 7 ? "bg-warning/10 text-warning border-warning/20" : ""}`}>
                      {daysLeft} ngày
                    </Badge>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Alerts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Overdue Reviews */}
        <Card className="border-none shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
            <CardTitle className="text-lg font-semibold">🔔 Review quá hạn</CardTitle>
            <Link to="/yeu-cau-review">
              <Button variant="ghost" size="sm" className="text-accent hover:text-accent/80">
                Xem tất cả <ArrowRight className="ml-1 h-4 w-4" />
              </Button>
            </Link>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {overdueReviews.length === 0 && (
                <p className="text-sm text-muted-foreground text-center py-6">Không có yêu cầu review quá hạn</p>
              )}
              {overdueReviews.map((r) => {
                const daysOverdue = Math.ceil((today.getTime() - new Date(r.request_deadline).getTime()) / (1000 * 60 * 60 * 24));
                return (
                  <div key={r.id} className="flex items-center justify-between p-3 rounded-lg bg-destructive/5 hover:bg-destructive/10 transition-colors">
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-sm truncate">{r.contract_title}</p>
                      <p className="text-xs text-muted-foreground">{r.requester_name} — {r.department}</p>
                    </div>
                    <Badge variant="destructive" className="ml-3 shrink-0">
                      Quá {daysOverdue} ngày
                    </Badge>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>

        {/* Upcoming Payments */}
        <Card className="border-none shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
            <CardTitle className="text-lg font-semibold">💰 Nghĩa vụ thanh toán sắp đến hạn</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {upcomingPayments.length === 0 && (
                <p className="text-sm text-muted-foreground text-center py-6">Không có nghĩa vụ thanh toán nào sắp đến hạn</p>
              )}
              {upcomingPayments.map((p) => {
                const daysLeft = Math.ceil((new Date(p.payment_due_date).getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
                return (
                  <div key={p.id} className="flex items-center justify-between p-3 rounded-lg bg-muted/50 hover:bg-muted transition-colors">
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-sm truncate">{p.phase_name}</p>
                      <p className="text-xs text-muted-foreground">Hạn: {formatDate(p.payment_due_date)} • {formatCurrency(p.payment_amount)}</p>
                    </div>
                    <Badge variant={daysLeft <= 7 ? "destructive" : "secondary"} className={`ml-3 shrink-0 ${daysLeft <= 14 && daysLeft > 7 ? "bg-warning/10 text-warning border-warning/20" : ""}`}>
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
