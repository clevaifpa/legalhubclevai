import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { toast } from "sonner";

const ROLE_LABELS: Record<string, string> = {
  admin: "Admin (Pháp chế)",
  user: "User",
  manager: "Quản lý (Manager)",
  accountant: "Kế toán (Accountant)",
  finance: "Tài chính (Finance)",
};

const ASSIGNABLE_ROLES = ["manager", "accountant", "finance"] as const;

const DEPARTMENT_OPTIONS = [
  "Phòng Kinh doanh", "Phòng Marketing", "Phòng Nhân sự", "Phòng Kế toán",
  "Phòng Tài chính", "Phòng IT", "Phòng Hành chính", "Phòng Pháp chế",
  "Phòng Sản xuất", "Phòng R&D", "Ban Giám đốc", "Khác",
];

const RoleManagement = () => {
  const { user } = useAuth();
  const [profiles, setProfiles] = useState<any[]>([]);
  const [roles, setRoles] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [selectedUserId, setSelectedUserId] = useState("");
  const [selectedRole, setSelectedRole] = useState<string>("");
  const [selectedDepartment, setSelectedDepartment] = useState("");
  const [saving, setSaving] = useState(false);

  const fetchData = async () => {
    const [profilesRes, rolesRes] = await Promise.all([
      supabase.from("profiles").select("*").order("full_name"),
      supabase.from("user_roles").select("*"),
    ]);
    if (profilesRes.data) setProfiles(profilesRes.data);
    if (rolesRes.data) setRoles(rolesRes.data);
    setLoading(false);
  };

  useEffect(() => { fetchData(); }, []);

  const getUserRoles = (userId: string) => roles.filter((r) => r.user_id === userId);

  const handleAddRole = async () => {
    if (!selectedUserId || !selectedRole) return;
    if (selectedRole === "manager" && !selectedDepartment) {
      toast.error("Vui lòng chọn phòng ban cho Manager");
      return;
    }

    const existing = roles.find(
      (r) => r.user_id === selectedUserId && r.role === selectedRole && (selectedRole !== "manager" || r.department === selectedDepartment)
    );
    if (existing) {
      toast.error("User đã có vai trò này");
      return;
    }

    setSaving(true);
    const { error } = await supabase.from("user_roles").insert({
      user_id: selectedUserId,
      role: selectedRole as any,
      department: selectedRole === "manager" ? selectedDepartment : "",
    } as any);
    setSaving(false);

    if (error) {
      toast.error("Lỗi", { description: error.message });
    } else {
      toast.success("Đã thêm vai trò");
      setSelectedUserId("");
      setSelectedRole("");
      setSelectedDepartment("");
      fetchData();
    }
  };

  const handleRemoveRole = async (roleId: string) => {
    const { error } = await supabase.from("user_roles").delete().eq("id", roleId);
    if (error) toast.error("Lỗi xóa", { description: error.message });
    else { toast.success("Đã gỡ vai trò"); fetchData(); }
  };

  const filteredProfiles = profiles.filter((p) => {
    if (!search) return true;
    return (
      p.full_name?.toLowerCase().includes(search.toLowerCase()) ||
      p.department?.toLowerCase().includes(search.toLowerCase())
    );
  });

  const usersWithApproverRoles = profiles.filter((p) => {
    const userRoles = getUserRoles(p.user_id);
    return userRoles.some((r) => ["manager", "accountant", "finance"].includes(r.role));
  });

  if (loading) {
    return <div className="flex items-center justify-center h-64"><p className="text-muted-foreground">Đang tải...</p></div>;
  }

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Quản lý người duyệt hợp đồng</h1>
        <p className="text-muted-foreground">
          Gán vai trò Manager (theo phòng ban), Kế toán, Tài chính cho nhân viên
        </p>
      </div>

      {/* Add Role Section */}
      <Card className="border shadow-sm">
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Thêm vai trò duyệt</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col sm:flex-row gap-3">
            <Select value={selectedUserId} onValueChange={setSelectedUserId}>
              <SelectTrigger className="flex-1">
                <SelectValue placeholder="Chọn nhân viên..." />
              </SelectTrigger>
              <SelectContent>
                {profiles.map((p) => (
                  <SelectItem key={p.user_id} value={p.user_id}>
                    {p.full_name || "Chưa đặt tên"} — {p.department || "Chưa có phòng ban"}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={selectedRole} onValueChange={(v) => { setSelectedRole(v); if (v !== "manager") setSelectedDepartment(""); }}>
              <SelectTrigger className="w-full sm:w-48">
                <SelectValue placeholder="Chọn vai trò..." />
              </SelectTrigger>
              <SelectContent>
                {ASSIGNABLE_ROLES.map((role) => (
                  <SelectItem key={role} value={role}>{ROLE_LABELS[role]}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            {selectedRole === "manager" && (
              <Select value={selectedDepartment} onValueChange={setSelectedDepartment}>
                <SelectTrigger className="w-full sm:w-56">
                  <SelectValue placeholder="Chọn phòng ban..." />
                </SelectTrigger>
                <SelectContent>
                  {DEPARTMENT_OPTIONS.map((dept) => (
                    <SelectItem key={dept} value={dept}>{dept}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
            <Button
              className="bg-accent hover:bg-accent/90 text-accent-foreground shrink-0"
              onClick={handleAddRole}
              disabled={saving || !selectedUserId || !selectedRole || (selectedRole === "manager" && !selectedDepartment)}
            >
              {saving ? "Đang thêm..." : "Thêm vai trò"}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Current Approvers */}
      <Card className="border shadow-sm">
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Danh sách người duyệt ({usersWithApproverRoles.length})</CardTitle>
          <div className="relative mt-2">
            <Input
              placeholder="Tìm theo tên hoặc phòng ban..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/30">
                <TableHead>Nhân viên</TableHead>
                <TableHead>Phòng ban</TableHead>
                <TableHead>Vai trò</TableHead>
                <TableHead>Thao tác</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {(search ? filteredProfiles : usersWithApproverRoles).map((p) => {
                const userRoles = getUserRoles(p.user_id);
                const approverRoles = userRoles.filter(
                  (r) => ["manager", "accountant", "finance"].includes(r.role)
                );
                if (!search && approverRoles.length === 0) return null;
                return (
                  <TableRow key={p.user_id}>
                    <TableCell className="font-medium">{p.full_name || "Chưa đặt tên"}</TableCell>
                    <TableCell className="text-muted-foreground">{p.department || "—"}</TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-1">
                        {userRoles.map((r) => (
                          <Badge key={r.id} variant={r.role === "manager" ? "default" : r.role === "accountant" ? "secondary" : "outline"} className="text-xs">
                            {ROLE_LABELS[r.role] || r.role}
                            {r.role === "manager" && r.department ? ` (${r.department})` : ""}
                          </Badge>
                        ))}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-1 flex-wrap">
                        {approverRoles.map((r) => (
                          <AlertDialog key={r.id}>
                            <AlertDialogTrigger asChild>
                              <Button variant="ghost" size="sm" className="h-7 text-xs text-destructive hover:text-destructive">
                                Gỡ {ROLE_LABELS[r.role]?.split(" ")[0]}
                              </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                              <AlertDialogHeader>
                                <AlertDialogTitle>Xác nhận gỡ vai trò?</AlertDialogTitle>
                                <AlertDialogDescription>
                                  Gỡ vai trò "{ROLE_LABELS[r.role]}" khỏi {p.full_name || "user này"}.
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>Hủy</AlertDialogCancel>
                                <AlertDialogAction onClick={() => handleRemoveRole(r.id)} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                                  Gỡ vai trò
                                </AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                        ))}
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
          {usersWithApproverRoles.length === 0 && !search && (
            <div className="text-center py-12">
              <p className="text-muted-foreground font-medium">Chưa có người duyệt nào</p>
              <p className="text-sm text-muted-foreground/70 mt-1">Thêm vai trò cho nhân viên ở trên</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default RoleManagement;
