import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Pencil, Check, X, Loader2 } from "lucide-react";
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
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { formatDate } from "@/lib/format";

const DEPARTMENTS = [
  { id: "LVO", name: "Khối Vận hành" },
  { id: "LVS", name: "Khối Kinh doanh" },
  { id: "LVH", name: "Khối Nhân sự" },
  { id: "LVD", name: "Khối Phát triển mới" },
  { id: "LVB", name: "Khối Back-office" },
  { id: "LVI", name: "Khối Kỹ thuật" },
];

const ROLE_LABELS: Record<string, string> = {
  admin: "Admin (Pháp chế)",
  user: "Nhân viên",
  manager: "Người quản lý",
  manager_chung: "Quản lý chung",
  accountant: "Kế toán",
  finance: "Tài chính",
};

const ASSIGNABLE_ROLES = ["admin", "manager_chung", "manager", "accountant", "finance", "user"] as const;

const EmployeeManagement = () => {
  const { user, role } = useAuth();
  const isAdmin = role === "admin";
  const [profiles, setProfiles] = useState<any[]>([]);
  const [roles, setRoles] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState("");
  const [savingId, setSavingId] = useState<string | null>(null);

  const startEditName = (p: any) => {
    setEditingId(p.user_id);
    setEditingName(p.full_name || "");
  };
  const cancelEditName = () => {
    setEditingId(null);
    setEditingName("");
  };
  const saveEditName = async (userId: string) => {
    const trimmed = editingName.trim();
    if (!trimmed) {
      toast.error("Tên nhân viên không được để trống");
      return;
    }
    setSavingId(userId);
    try {
      const { data, error } = await supabase.functions.invoke("admin-update-user", {
        body: { userId, full_name: trimmed },
      });
      if (error) throw new Error(error.message);
      if (data?.error) throw new Error(data.error);
      setProfiles((prev) => prev.map((p) => p.user_id === userId ? { ...p, full_name: trimmed } : p));
      toast.success("Đã cập nhật tên nhân viên");
      cancelEditName();
    } catch (err: any) {
      toast.error("Không thể cập nhật tên nhân viên. Vui lòng thử lại.", { description: err.message });
    } finally {
      setSavingId(null);
    }
  };

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

  const getDisplayName = (p: any) => {
    if (p.email) {
      const localPart = p.email.split("@")[0];
      const name = localPart.charAt(0).toUpperCase() + localPart.slice(1);
      return `${name} (${p.email})`;
    }
    return p.full_name || "—";
  };

  const handleChangeRole = async (userId: string, currentRoleId: string, newRoleValue: string) => {
    const { error } = await supabase.from("user_roles").update({ role: newRoleValue as any }).eq("id", currentRoleId);
    if (error) toast.error("Lỗi cập nhật vai trò", { description: error.message });
    else { toast.success("Đã cập nhật vai trò"); fetchData(); }
  };

  const handleChangeDepartment = async (userId: string, newDept: string) => {
    try {
      const { data, error } = await supabase.functions.invoke("admin-update-user", {
        body: { userId, department: newDept },
      });

      if (error) throw new Error(error.message);
      if (data?.error) throw new Error(data.error);

      toast.success("Đã cập nhật phòng ban");
      fetchData();
    } catch (err: any) {
      toast.error("Lỗi cập nhật phòng ban", { description: err.message || "Không có quyền thực hiện hoặc lỗi máy chủ." });
    }
  };

  const handleDeleteUser = async (userId: string) => {
    const { error } = await (supabase.rpc as any)("admin_delete_user", { _user_id: userId });
    if (error) {
      toast.error("Lỗi xóa tài khoản", { description: error.message });
    } else {
      toast.success("Đã xóa hoàn toàn tài khoản");
      fetchData();
    }
  };

  const filteredProfiles = profiles.filter((p) => {
    if (!search) return true;
    const term = search.toLowerCase();
    return (
      getDisplayName(p).toLowerCase().includes(term) ||
      p.department?.toLowerCase().includes(term) ||
      (p.email || "").toLowerCase().includes(term)
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
            placeholder="Tìm theo tên, email hoặc phòng ban..."
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
                  <TableHead>Mã nhân viên</TableHead>
                  <TableHead>Email</TableHead>
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
                  const displayName = p.full_name || (p.email ? p.email.split("@")[0] : "—");
                  return (
                    <TableRow key={p.user_id}>
                      <TableCell className="font-medium">
                        {editingId === p.user_id ? (
                          <div className="flex items-center gap-1">
                            <Input
                              autoFocus
                              value={editingName}
                              onChange={(e) => setEditingName(e.target.value)}
                              onKeyDown={(e) => {
                                if (e.key === "Enter") saveEditName(p.user_id);
                                if (e.key === "Escape") cancelEditName();
                              }}
                              className="h-8 text-sm w-44"
                              disabled={savingId === p.user_id}
                            />
                            <Button
                              size="icon"
                              variant="ghost"
                              className="h-7 w-7"
                              onClick={() => saveEditName(p.user_id)}
                              disabled={savingId === p.user_id}
                            >
                              {savingId === p.user_id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />}
                            </Button>
                            <Button
                              size="icon"
                              variant="ghost"
                              className="h-7 w-7"
                              onClick={cancelEditName}
                              disabled={savingId === p.user_id}
                            >
                              <X className="h-3.5 w-3.5" />
                            </Button>
                          </div>
                        ) : (
                          <div className="flex items-center gap-1.5 group">
                            <span>{displayName}</span>
                            {isAdmin && (
                              <Button
                                size="icon"
                                variant="ghost"
                                className="h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity"
                                onClick={() => startEditName(p)}
                                title="Sửa tên"
                              >
                                <Pencil className="h-3 w-3" />
                              </Button>
                            )}
                          </div>
                        )}
                      </TableCell>
                      <TableCell className="text-muted-foreground">{p.email || "—"}</TableCell>
                      <TableCell>
                        <Select
                          value={p.department || ""}
                          onValueChange={(v) => handleChangeDepartment(p.user_id, v)}
                        >
                          <SelectTrigger className="h-8 w-fit text-xs border-0 p-0 shadow-none bg-transparent focus:ring-0">
                            <SelectValue>
                              <Badge variant="outline" className="cursor-pointer bg-muted/50 hover:bg-muted font-normal text-xs">{p.department || "Chưa có"}</Badge>
                            </SelectValue>
                          </SelectTrigger>
                          <SelectContent>
                            {DEPARTMENTS.map((d) => (
                              <SelectItem key={d.id} value={d.id}>{d.id} - {d.name}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </TableCell>
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
                                  <AlertDialogTitle>Bạn có chắc chắn muốn xóa tài khoản này không?</AlertDialogTitle>
                                  <AlertDialogDescription className="whitespace-pre-line">
                                    Tài khoản sẽ bị xóa hoàn toàn khỏi hệ thống và
                                    không thể đăng nhập lại.
                                    Người dùng phải đăng ký lại từ đầu.
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
