import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell,
} from "recharts";
import { Link, useNavigate } from "react-router-dom";
import { useContractStats } from "@/hooks/useContracts";
import { supabase } from "@/integrations/supabase/client";
import { formatDate, formatCurrency } from "@/lib/format";
import { useAuth } from "@/hooks/useAuth";

const Dashboard = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { contracts, loading, total, signed, byStatus } = useContractStats();
  const [categories, setCategories] = useState<any[]>([]);
  const [reviewCount, setReviewCount] = useState(0);
  const [expiringReviewCount, setExpiringReviewCount] = useState(0);
  const [overdueReviews, setOverdueReviews] = useState<any[]>([]);
  const [upcomingPayments, setUpcomingPayments] = useState<any[]>([]);

  useEffect(() => {
    supabase.from("contract_categories").select("id, name").then(({ data }) => {
      if (data) setCategories(data);
    });
    supabase.from("review_requests").select("id", { count: "exact", head: true }).in("status", ["cho_quan_ly", "cho_phap_che", "cho_ke_toan", "cho_tai_chinh"] as any).then(({ count }) => {
      setReviewCount(count || 0);
    });

    const today = new Date().toISOString().split("T")[0];
    const in5Days = new Date();
    in5Days.setDate(in5Days.getDate() + 5);

    supabase
      .from("review_requests")
      .select("id", { count: "exact", head: true })
      .in("status", ["cho_quan_ly", "cho_phap_che", "cho_ke_toan", "cho_tai_chinh"] as any)
      .lte("request_deadline", in5Days.toISOString().split("T")[0])
      .then(({ count }) => {
        setExpiringReviewCount(count || 0);
      });

    supabase
      .from("review_requests")
      .select("id, contract_title, requester_name, department, request_deadline, status")
      .in("status", ["cho_quan_ly", "cho_phap_che", "cho_ke_toan", "cho_tai_chinh"] as any)
      .lt("request_deadline", today)
      .order("request_deadline", { ascending: true })
      .limit(10)
      .then(({ data }) => { if (data) setOverdueReviews(data); });

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
      .then(({ data }) => { if (data) setUpcomingPayments(data); });

    supabase.rpc("auto_expire_contracts" as any).then(() => { });
  }, []);

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

  const categoryStats = categories.map((cat) => ({
    name: cat.name,
    value: contracts.filter((c) => c.category_id === cat.id).length,
  })).filter((c) => c.value > 0);

  const expiring60 = expiringContracts.length;

  const stats = [
    { title: "Tổng hợp đồng", value: total, link: "/tong-hop-dong" },
    { title: "Sắp hết hạn (60 ngày)", value: expiring60, link: "/tong-hop-dong" },
    { title: "Chờ review", value: reviewCount, link: "/yeu-cau-review" },
    { title: "Sắp hết hạn review (5 ngày)", value: expiringReviewCount, link: "/yeu-cau-review" },
  ];

  if (loading) {
    return <div className="flex items-center justify-center h-64"><p className="text-muted-foreground">Đang tải...</p></div>;
  }

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Tổng quan</h1>
        <p className="text-muted-foreground">Quản lý hợp đồng và hoạt động pháp chế</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {stats.map((stat, i) => (
          <Link to={stat.link} key={i}>
            <Card className="border-none shadow-sm hover:shadow-md transition-shadow animate-slide-up cursor-pointer" style={{ animationDelay: `${i * 80}ms`, animationFillMode: "backwards" }}>
              <CardContent className="p-5">
                <p className="text-sm text-muted-foreground">{stat.title}</p>
                <p className="text-3xl font-bold tracking-tight mt-1">{stat.value}</p>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Left Column: Contracts & Payments */}
        <div className="space-y-6">
          <Card className="border-none shadow-sm">
            <CardHeader><CardTitle className="text-lg font-semibold">Hợp đồng theo trạng thái</CardTitle></CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={240}>
                <BarChart data={byStatus} barSize={40}>
                  <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
                  <XAxis dataKey="name" fontSize={12} tickLine={false} axisLine={false} />
                  <YAxis allowDecimals={false} fontSize={12} tickLine={false} axisLine={false} />
                  <Tooltip contentStyle={{ borderRadius: "8px", border: "1px solid hsl(var(--border))", boxShadow: "0 4px 12px rgba(0,0,0,0.08)", fontSize: "13px" }} />
                  <Bar dataKey="value" radius={[6, 6, 0, 0]}>
                    {byStatus.map((entry, index) => (<Cell key={index} fill={entry.fill} />))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          <Card className="border-none shadow-sm">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
              <CardTitle className="text-lg font-semibold">Sắp hết hạn (60 ngày)</CardTitle>
              <Link to="/tong-hop-dong"><Button variant="ghost" size="sm" className="text-accent hover:text-accent/80">Xem tất cả →</Button></Link>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {expiringContracts.length === 0 && <p className="text-sm text-muted-foreground text-center py-6">Không có hợp đồng nào sắp hết hạn</p>}
                {expiringContracts.slice(0, 6).map((contract) => {
                  const todayDate = new Date();
                  todayDate.setHours(0, 0, 0, 0);
                  const expiryDate = new Date(contract.expiry_date!.replace(/-/g, '/'));
                  expiryDate.setHours(0, 0, 0, 0);
                  const daysLeft = Math.round((expiryDate.getTime() - todayDate.getTime()) / (1000 * 60 * 60 * 24));
                  return (
                    <div
                      key={contract.id}
                      onClick={() => navigate(`/contract/${contract.id}`)}
                      className="flex items-center justify-between p-3 rounded-lg bg-muted/50 hover:bg-muted transition-colors cursor-pointer"
                    >
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-sm truncate">{contract.title}</p>
                        <p className="text-xs text-muted-foreground">{contract.partner_name} — Hết hạn: {formatDate(contract.expiry_date!)}</p>
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

          <Card className="border-none shadow-sm">
            <CardHeader><CardTitle className="text-lg font-semibold">Nghĩa vụ thanh toán sắp đến hạn</CardTitle></CardHeader>
            <CardContent>
              <div className="space-y-2">
                {upcomingPayments.length === 0 && <p className="text-sm text-muted-foreground text-center py-6">Không có nghĩa vụ thanh toán nào sắp đến hạn</p>}
                {upcomingPayments.map((p) => {
                  const todayDate = new Date();
                  todayDate.setHours(0, 0, 0, 0);
                  const dueDate = new Date(p.payment_due_date.replace(/-/g, '/'));
                  dueDate.setHours(0, 0, 0, 0);
                  const daysLeft = Math.round((dueDate.getTime() - todayDate.getTime()) / (1000 * 60 * 60 * 24));
                  return (
                    <div
                      key={p.id}
                      onClick={() => navigate(`/contract/${p.contract_id}`)}
                      className="flex items-center justify-between p-3 rounded-lg bg-muted/50 hover:bg-muted transition-colors cursor-pointer"
                    >
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-sm truncate">{p.phase_name}</p>
                        <p className="text-xs text-muted-foreground">Hạn: {formatDate(p.payment_due_date)} — {formatCurrency(p.payment_amount)}</p>
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

        {/* Right Column: Reviews */}
        <div className="space-y-6">
          <Card className="border-none shadow-sm">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
              <CardTitle className="text-lg font-semibold">Review quá hạn</CardTitle>
              <Link to="/yeu-cau-review"><Button variant="ghost" size="sm" className="text-accent hover:text-accent/80">Xem tất cả →</Button></Link>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {overdueReviews.length === 0 && <p className="text-sm text-muted-foreground text-center py-6">Không có yêu cầu review quá hạn</p>}
                {overdueReviews.map((r) => {
                  const todayDate = new Date();
                  todayDate.setHours(0, 0, 0, 0);
                  const deadlineDate = new Date(r.request_deadline.replace(/-/g, '/'));
                  deadlineDate.setHours(0, 0, 0, 0);
                  const daysOverdue = Math.round((todayDate.getTime() - deadlineDate.getTime()) / (1000 * 60 * 60 * 24));
                  return (
                    <div
                      key={r.id}
                      onClick={() => navigate(user?.role === 'admin' ? `/admin-request/${r.id}` : `/request/${r.id}`)}
                      className="flex items-center justify-between p-3 rounded-lg bg-destructive/5 hover:bg-destructive/10 transition-colors cursor-pointer"
                    >
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-sm truncate">{r.contract_title}</p>
                        <p className="text-xs text-muted-foreground">{r.requester_name} — {r.department}</p>
                      </div>
                      <Badge variant="destructive" className="ml-3 shrink-0">Quá {daysOverdue} ngày</Badge>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
