import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
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
import { formatDate } from "@/lib/format";

const ROLE_LABELS: Record<string, string> = {
  admin: "Admin",
  user: "Nhân viên",
  manager: "Người quản lý",
  accountant: "Kế toán",
  finance: "Tài chính",
};

const ASSIGNABLE_ROLES = ["admin", "manager", "accountant", "finance", "user"] as const;

const EmployeeManagement = () => {
  const { user } = useAuth();
  const [profiles, setProfiles] = useState<any[]>([]);
  const [roles, setRoles] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  const fetchData = async () => {
    const [profilesRes, rolesRes] = await Promise.all([
      supabase.from("profiles").select("*").order("created_at", { ascending: false }),
      supabase.from("user_roles").select("*"),
    ]);
    if (profilesRes.data) setProfiles(profilesRes.data);
    if (rolesRes.data) setRoles(rolesRes.data);
    setLoading(false);
  };

  useEffect(() => { fetchData(); }, []);

  const getUserRoles = (userId: string) => roles.filter((r) => r.user_id === userId);

  // Get display name: use full_name from profile, fallback to email-derived name
  const getDisplayName = (p: any) => {
    return p.full_name || "—";
  };

  // Get email from auth metadata - we'll show it if available
  const getEmail = (p: any) => {
    // We don't have email in profiles, but we can show user_id hint
    return null;
  };

  const handleChangeRole = async (userId: string, currentRoleId: string, newRoleValue: string) => {
    const { error } = await supabase.from("user_roles").update({ role: newRoleValue as any }).eq("id", currentRoleId);
    if (error) toast.error("Lỗi cập nhật vai trò", { description: error.message });
    else { toast.success("Đã cập nhật vai trò"); fetchData(); }
  };

  const handleDeleteUser = async (userId: string) => {
    // Delete roles and profile (cascade will handle related data)
    await supabase.from("user_roles").delete().eq("user_id", userId);
    await supabase.from("profiles").delete().eq("user_id", userId);
    toast.success("Đã xóa tài khoản");
    fetchData();
  };

  const filteredProfiles = profiles.filter((p) => {
    if (!search) return true;
    const term = search.toLowerCase();
    const displayName = getDisplayName(p).toLowerCase();
    return (
      displayName.includes(term) ||
      p.department?.toLowerCase().includes(term)
    );
  });

  if (loading) {
    return <div className="flex items-center justify-center h-64"><p className="text-muted-foreground">Đang tải...</p></div>;
  }

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Quản lý nhân viên</h1>
          <p className="text-muted-foreground">
            Danh sách tài khoản và phân quyền hệ thống
          </p>
        </div>
      </div>

      <Card className="border shadow-sm">
        <CardHeader className="pb-3">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <CardTitle className="text-base">Tất cả nhân viên ({profiles.length})</CardTitle>
          </div>
          <Input
            placeholder="Tìm theo tên hoặc phòng ban..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="mt-2"
          />
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/30">
                  <TableHead>Tên hiển thị</TableHead>
                  <TableHead>Phòng ban</TableHead>
                  <TableHead>Ngày tạo</TableHead>
                  <TableHead>Vai trò</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredProfiles.map((p) => {
                  const userRoles = getUserRoles(p.user_id);
                  const primaryRole = userRoles[0];
                  const isSelf = p.user_id === user?.id;
                  const displayName = getDisplayName(p);
                  return (
                    <TableRow key={p.user_id}>
                      <TableCell className="font-medium">{displayName}</TableCell>
                      <TableCell className="text-muted-foreground">{p.department || "—"}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {formatDate(p.created_at)}
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-2 items-center">
                          {primaryRole && !isSelf ? (
                            <Select
                              value={primaryRole.role}
                              onValueChange={(v) => handleChangeRole(p.user_id, primaryRole.id, v)}
                            >
                              <SelectTrigger className="h-8 w-40 text-xs">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                {ASSIGNABLE_ROLES.map((r) => (
                                  <SelectItem key={r} value={r}>{ROLE_LABELS[r]}</SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          ) : (
                            <span className="text-sm font-medium text-muted-foreground">
                              {ROLE_LABELS[primaryRole?.role] || "Nhân viên"}
                              {isSelf && " (bạn)"}
                            </span>
                          )}
                          {!isSelf && (
                            <AlertDialog>
                              <AlertDialogTrigger asChild>
                                <Button variant="ghost" size="sm" className="h-7 text-xs text-destructive hover:text-destructive">
                                  Xóa
                                </Button>
                              </AlertDialogTrigger>
                              <AlertDialogContent>
                                <AlertDialogHeader>
                                  <AlertDialogTitle>Xác nhận xóa tài khoản?</AlertDialogTitle>
                                  <AlertDialogDescription>
                                    Tài khoản "{displayName}" sẽ bị xóa. Hành động này không thể hoàn tác.
                                  </AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter>
                                  <AlertDialogCancel>Hủy</AlertDialogCancel>
                                  <AlertDialogAction
                                    onClick={() => handleDeleteUser(p.user_id)}
                                    className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                                  >
                                    Xóa tài khoản
                                  </AlertDialogAction>
                                </AlertDialogFooter>
                              </AlertDialogContent>
                            </AlertDialog>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
          {filteredProfiles.length === 0 && (
            <div className="text-center py-12">
              <p className="text-muted-foreground font-medium">Không tìm thấy nhân viên</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default EmployeeManagement;
