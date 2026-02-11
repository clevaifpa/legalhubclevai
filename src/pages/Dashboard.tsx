import {
  FileText,
  Clock,
  AlertTriangle,
  ShieldAlert,
  ArrowRight,
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
import { mockContracts, mockDeadlines } from "@/data/mockData";
import { DEADLINE_TYPE_LABELS } from "@/types";
import { RiskBadge } from "@/components/common/RiskBadge";
import { StatusBadge } from "@/components/common/StatusBadge";
import { formatCurrency } from "@/lib/format";
import { Link } from "react-router-dom";

const Dashboard = () => {
  const totalContracts = mockContracts.length;
  const pendingReview = mockContracts.filter((c) => c.status === "dang_review").length;
  const expiringSoon = mockDeadlines.filter((d) => d.daysRemaining <= 7).length;
  const highRisk = mockContracts.filter((c) => c.riskLevel === "cao").length;

  const statusData = [
    { name: "Nháp", value: mockContracts.filter((c) => c.status === "nhap").length, fill: "hsl(220, 14%, 70%)" },
    { name: "Đang review", value: mockContracts.filter((c) => c.status === "dang_review").length, fill: "hsl(210, 92%, 45%)" },
    { name: "Đã ký", value: mockContracts.filter((c) => c.status === "da_ky").length, fill: "hsl(152, 69%, 31%)" },
    { name: "Hết hiệu lực", value: mockContracts.filter((c) => c.status === "het_hieu_luc").length, fill: "hsl(0, 84%, 60%)" },
  ];

  const stats = [
    {
      title: "Tổng hợp đồng",
      value: totalContracts,
      icon: FileText,
      iconColor: "text-primary",
      bgColor: "bg-primary/10",
    },
    {
      title: "Chờ review",
      value: pendingReview,
      icon: Clock,
      iconColor: "text-info",
      bgColor: "bg-info/10",
    },
    {
      title: "Sắp hết hạn",
      value: expiringSoon,
      icon: AlertTriangle,
      iconColor: "text-warning",
      bgColor: "bg-warning/10",
    },
    {
      title: "Rủi ro cao",
      value: highRisk,
      icon: ShieldAlert,
      iconColor: "text-destructive",
      bgColor: "bg-destructive/10",
    },
  ];

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Tổng quan</h1>
        <p className="text-muted-foreground">
          Quản lý hợp đồng và hoạt động pháp chế
        </p>
      </div>

      {/* Stat Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {stats.map((stat, i) => (
          <Card key={i} className="border-none shadow-sm hover:shadow-md transition-shadow animate-slide-up" style={{ animationDelay: `${i * 80}ms`, animationFillMode: 'backwards' }}>
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
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Chart */}
        <Card className="border-none shadow-sm">
          <CardHeader>
            <CardTitle className="text-lg font-semibold">
              Hợp đồng theo trạng thái
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={240}>
              <BarChart data={statusData} barSize={40}>
                <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
                <XAxis dataKey="name" fontSize={12} tickLine={false} axisLine={false} />
                <YAxis allowDecimals={false} fontSize={12} tickLine={false} axisLine={false} />
                <Tooltip
                  contentStyle={{
                    borderRadius: "8px",
                    border: "1px solid hsl(220, 13%, 90%)",
                    boxShadow: "0 4px 12px rgba(0,0,0,0.08)",
                    fontSize: "13px",
                  }}
                />
                <Bar dataKey="value" radius={[6, 6, 0, 0]}>
                  {statusData.map((entry, index) => (
                    <Cell key={index} fill={entry.fill} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Upcoming Deadlines */}
        <Card className="border-none shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
            <CardTitle className="text-lg font-semibold">Sắp đến hạn</CardTitle>
            <Link to="/hop-dong">
              <Button variant="ghost" size="sm" className="text-accent hover:text-accent/80">
                Xem tất cả <ArrowRight className="ml-1 h-4 w-4" />
              </Button>
            </Link>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {mockDeadlines
                .filter((d) => d.daysRemaining <= 14)
                .sort((a, b) => a.daysRemaining - b.daysRemaining)
                .slice(0, 5)
                .map((deadline) => (
                  <div
                    key={deadline.id}
                    className="flex items-center justify-between p-3 rounded-lg bg-muted/50 hover:bg-muted transition-colors"
                  >
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-sm truncate">
                        {deadline.contractTitle}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {deadline.partnerName} • {DEADLINE_TYPE_LABELS[deadline.type]}
                      </p>
                    </div>
                    <Badge
                      variant={
                        deadline.daysRemaining <= 1
                          ? "destructive"
                          : "secondary"
                      }
                      className={`ml-3 shrink-0 ${
                        deadline.daysRemaining <= 3 && deadline.daysRemaining > 1
                          ? "bg-warning/10 text-warning border-warning/20"
                          : ""
                      }`}
                    >
                      {deadline.daysRemaining === 1
                        ? "1 ngày"
                        : `${deadline.daysRemaining} ngày`}
                    </Badge>
                  </div>
                ))}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* High Risk Contracts */}
      <Card className="border-none shadow-sm">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
          <CardTitle className="text-lg font-semibold">
            Hợp đồng rủi ro cao
          </CardTitle>
          <Link to="/hop-dong">
            <Button variant="ghost" size="sm" className="text-accent hover:text-accent/80">
              Xem tất cả <ArrowRight className="ml-1 h-4 w-4" />
            </Button>
          </Link>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {mockContracts
              .filter((c) => c.riskLevel === "cao")
              .map((contract) => (
                <div
                  key={contract.id}
                  className="flex items-center justify-between p-3 rounded-lg bg-destructive/5 border border-destructive/10 hover:bg-destructive/10 transition-colors"
                >
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-sm">{contract.title}</p>
                    <p className="text-xs text-muted-foreground">
                      {contract.partnerName}
                      {contract.value > 0 && ` • ${formatCurrency(contract.value)}`}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 ml-3">
                    <StatusBadge status={contract.status} type="contract" />
                    <RiskBadge level={contract.riskLevel} />
                  </div>
                </div>
              ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default Dashboard;
