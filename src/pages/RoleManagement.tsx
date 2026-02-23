import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Loader2, UserCog, Plus, Trash2, Search, ShieldCheck } from "lucide-react";
import { toast } from "sonner";

const ROLE_LABELS: Record<string, string> = {
  admin: "Admin",
  user: "User",
  accountant: "Kế toán (Accountant)",
  finance: "Tài chính (Finance)",
};

const ASSIGNABLE_ROLES = ["accountant", "finance"] as const;

const RoleManagement = () => {
  const { user } = useAuth();
  const [profiles, setProfiles] = useState<any[]>([]);
  const [roles, setRoles] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [selectedUserId, setSelectedUserId] = useState("");
  const [selectedRole, setSelectedRole] = useState<string>("");
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

  useEffect(() => {
    fetchData();
  }, []);

  const getUserRoles = (userId: string) => {
    return roles.filter((r) => r.user_id === userId);
  };

  const handleAddRole = async () => {
    if (!selectedUserId || !selectedRole) return;

    // Check if already has role
    const existing = roles.find(
      (r) => r.user_id === selectedUserId && r.role === selectedRole
    );
    if (existing) {
      toast.error("User đã có vai trò này");
      return;
    }

    setSaving(true);
    const { error } = await supabase.from("user_roles").insert({
      user_id: selectedUserId,
      role: selectedRole as any,
    });
    setSaving(false);

    if (error) {
      toast.error("Lỗi", { description: error.message });
    } else {
      toast.success("Đã thêm vai trò");
      setSelectedUserId("");
      setSelectedRole("");
      fetchData();
    }
  };

  const handleRemoveRole = async (roleId: string) => {
    const { error } = await supabase.from("user_roles").delete().eq("id", roleId);
    if (error) {
      toast.error("Lỗi xóa", { description: error.message });
    } else {
      toast.success("Đã gỡ vai trò");
      fetchData();
    }
  };

  const filteredProfiles = profiles.filter((p) => {
    if (!search) return true;
    return (
      p.full_name?.toLowerCase().includes(search.toLowerCase()) ||
      p.department?.toLowerCase().includes(search.toLowerCase())
    );
  });

  // Only show users with accountant/finance roles, plus all in search
  const usersWithApproverRoles = profiles.filter((p) => {
    const userRoles = getUserRoles(p.user_id);
    return userRoles.some((r) => r.role === "accountant" || r.role === "finance");
  });

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
        <h1 className="text-2xl font-bold tracking-tight">Quản lý người duyệt hợp đồng</h1>
        <p className="text-muted-foreground">
          Thêm hoặc gỡ vai trò Kế toán (Accountant) / Tài chính (Finance) cho nhân viên
        </p>
      </div>

      {/* Add Role Section */}
      <Card className="border shadow-sm">
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Plus className="h-4 w-4" />
            Thêm vai trò duyệt
          </CardTitle>
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
            <Select value={selectedRole} onValueChange={setSelectedRole}>
              <SelectTrigger className="w-full sm:w-56">
                <SelectValue placeholder="Chọn vai trò..." />
              </SelectTrigger>
              <SelectContent>
                {ASSIGNABLE_ROLES.map((role) => (
                  <SelectItem key={role} value={role}>
                    {ROLE_LABELS[role]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button
              className="bg-accent hover:bg-accent/90 text-accent-foreground shrink-0"
              onClick={handleAddRole}
              disabled={saving || !selectedUserId || !selectedRole}
            >
              {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Thêm vai trò
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Current Approvers */}
      <Card className="border shadow-sm">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base flex items-center gap-2">
              <ShieldCheck className="h-4 w-4" />
              Danh sách người duyệt ({usersWithApproverRoles.length})
            </CardTitle>
          </div>
          <div className="relative mt-2">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Tìm theo tên hoặc phòng ban..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9"
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
                  (r) => r.role === "accountant" || r.role === "finance"
                );
                if (!search && approverRoles.length === 0) return null;
                return (
                  <TableRow key={p.user_id}>
                    <TableCell className="font-medium">
                      {p.full_name || "Chưa đặt tên"}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {p.department || "—"}
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-1">
                        {userRoles.map((r) => (
                          <Badge
                            key={r.id}
                            variant={
                              r.role === "accountant"
                                ? "default"
                                : r.role === "finance"
                                ? "secondary"
                                : "outline"
                            }
                            className="text-xs"
                          >
                            {ROLE_LABELS[r.role] || r.role}
                          </Badge>
                        ))}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        {approverRoles.map((r) => (
                          <AlertDialog key={r.id}>
                            <AlertDialogTrigger asChild>
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-7 text-xs text-destructive hover:text-destructive"
                              >
                                <Trash2 className="h-3 w-3 mr-1" />
                                Gỡ {ROLE_LABELS[r.role]?.split(" ")[0]}
                              </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                              <AlertDialogHeader>
                                <AlertDialogTitle>Xác nhận gỡ vai trò?</AlertDialogTitle>
                                <AlertDialogDescription>
                                  Gỡ vai trò "{ROLE_LABELS[r.role]}" khỏi {p.full_name || "user này"}. User sẽ không thể duyệt hợp đồng với vai trò này nữa.
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>Hủy</AlertDialogCancel>
                                <AlertDialogAction
                                  onClick={() => handleRemoveRole(r.id)}
                                  className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                                >
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
              <UserCog className="h-12 w-12 text-muted-foreground/30 mx-auto mb-4" />
              <p className="text-muted-foreground font-medium">Chưa có người duyệt nào</p>
              <p className="text-sm text-muted-foreground/70 mt-1">
                Thêm vai trò Accountant hoặc Finance cho nhân viên ở trên
              </p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default RoleManagement;
