import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { User, Session } from "@supabase/supabase-js";
import { toast } from "sonner";

type AppRole = "admin" | "user" | "accountant" | "finance" | "manager" | "manager_chung";

interface AuthContextType {
  user: User | null;
  session: Session | null;
  role: AppRole | null;
  roles: AppRole[];
  profile: { full_name: string; department: string } | null;
  managerDepartment: string | null;
  loading: boolean;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  session: null,
  role: null,
  roles: [],
  profile: null,
  managerDepartment: null,
  loading: true,
  signOut: async () => { },
});

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [role, setRole] = useState<AppRole | null>(null);
  const [roles, setRoles] = useState<AppRole[]>([]);
  const [profile, setProfile] = useState<{ full_name: string; department: string } | null>(null);
  const [managerDepartment, setManagerDepartment] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchUserData = async (userId: string) => {
    const [rolesRes, profileRes] = await Promise.all([
      supabase.from("user_roles").select("role").eq("user_id", userId),
      supabase.from("profiles").select("full_name, department").eq("user_id", userId).single(),
    ]);

    // Handle deleted account (no profile found) - try to auto-recreate
    if (profileRes.error && profileRes.error.code === 'PGRST116') {
      // Allow them to stay logged in temporarily if they are recovering from deletion
      if (window.location.pathname.includes('/reset-password')) {
        setLoading(false);
        return;
      }

      // Try to auto-recreate profile using RPC
      const { data: { user: currentUser } } = await supabase.auth.getUser();
      if (currentUser) {
        const name = currentUser.user_metadata?.full_name || currentUser.email?.split('@')[0] || "User";
        const dept = currentUser.user_metadata?.department || "";

        const { error: rpcError } = await (supabase.rpc as any)('recreate_user_profile', {
          _user_id: currentUser.id,
          _email: currentUser.email,
          _full_name: name,
          _department: dept
        });

        if (!rpcError) {
          // Profile recreated successfully - refetch data
          const [newRolesRes, newProfileRes] = await Promise.all([
            supabase.from("user_roles").select("role").eq("user_id", userId),
            supabase.from("profiles").select("full_name, department").eq("user_id", userId).single(),
          ]);

          if (newProfileRes.data) {
            setProfile(newProfileRes.data as any);
            toast.success("Tài khoản đã được phục hồi thành công!");
          }

          if (newRolesRes.data && newRolesRes.data.length > 0) {
            const allRoles = newRolesRes.data.map((r: any) => r.role as AppRole);
            setRoles(allRoles);
            if (allRoles.includes("admin")) setRole("admin");
            else if (allRoles.includes("manager_chung")) setRole("manager_chung");
            else if (allRoles.includes("manager")) setRole("manager");
            else if (allRoles.includes("accountant")) setRole("accountant");
            else if (allRoles.includes("finance")) setRole("finance");
            else setRole("user");
          } else {
            setRole("user");
            setRoles(["user"]);
          }
          return;
        }
      }

      // RPC failed or no user - sign out
      toast.error("Tài khoản này đã bị xóa khỏi hệ thống. Vui lòng đăng ký lại nếu cần sử dụng.", { duration: 10000 });
      await supabase.auth.signOut();
      setUser(null);
      setSession(null);
      setRole(null);
      setRoles([]);
      setProfile(null);
      setManagerDepartment(null);
      return;
    }

    if (rolesRes.data && rolesRes.data.length > 0) {
      const allRoles = rolesRes.data.map((r: any) => r.role as AppRole);
      setRoles(allRoles);
      if (allRoles.includes("admin")) setRole("admin");
      else if (allRoles.includes("manager_chung")) setRole("manager_chung");
      else if (allRoles.includes("manager")) setRole("manager");
      else if (allRoles.includes("accountant")) setRole("accountant");
      else if (allRoles.includes("finance")) setRole("finance");
      else setRole("user");

      const isManagerRole = rolesRes.data.some((r: any) => r.role === "manager");
      if (isManagerRole && profileRes.data) {
        setManagerDepartment(profileRes.data.department || null);
      }
    } else {
      setRole("user");
      setRoles(["user"]);
    }

    if (profileRes.data) {
      setProfile(profileRes.data as any);
    }
  };

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (_event, session) => {
        setSession(session);
        setUser(session?.user ?? null);
        if (session?.user) {
          setTimeout(() => fetchUserData(session.user.id), 0);
        } else {
          setRole(null);
          setRoles([]);
          setProfile(null);
          setManagerDepartment(null);
        }
        setLoading(false);
      }
    );

    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      if (session?.user) {
        fetchUserData(session.user.id);
      }
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  const signOut = async () => {
    await supabase.auth.signOut();
    setUser(null);
    setSession(null);
    setRole(null);
    setRoles([]);
    setProfile(null);
    setManagerDepartment(null);
  };

  return (
    <AuthContext.Provider value={{ user, session, role, roles, profile, managerDepartment, loading, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);

// Helper: extract employee name from email (e.g., "Linhnt2@clevai.edu.vn" → "Linhnt2")
export function getEmployeeName(email?: string | null): string {
  if (!email) return "";
  const localPart = email.split("@")[0];
  return localPart.charAt(0).toUpperCase() + localPart.slice(1);
}

// Helper: display as "EmployeeName (email)"
export function getEmployeeDisplayName(email?: string | null): string {
  if (!email) return "";
  const name = getEmployeeName(email);
  return `${name} (${email})`;
}
