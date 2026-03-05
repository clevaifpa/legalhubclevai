import { useState } from "react";
import { Eye, EyeOff } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from
"@/components/ui/select";
import { toast } from "sonner";

const DEPARTMENTS = [
{ id: "LVO", name: "Khối Vận hành" },
{ id: "LVS", name: "Khối Kinh doanh" },
{ id: "LVH", name: "Khối Nhân sự" },
{ id: "LVD", name: "Khối Phát triển mới" },
{ id: "LVB", name: "Khối Back-office" },
{ id: "LVI", name: "Khối Kỹ thuật" }];


const Auth = () => {
  const [isLogin, setIsLogin] = useState(true);
  const [isForgotPassword, setIsForgotPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [fullName, setFullName] = useState("");
  const [department, setDepartment] = useState("");

  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/reset-password`
      });
      if (error) throw error;
      toast.success("Email đặt lại mật khẩu đã được gửi!", {
        description: "Vui lòng kiểm tra hộp thư email của bạn."
      });
      setIsForgotPassword(false);
    } catch (error: any) {
      toast.error("Gửi email thất bại", { description: error.message });
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      if (isLogin) {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        toast.success("Đăng nhập thành công!");
      } else {
        if (!fullName.trim()) {
          toast.error("Vui lòng nhập mã nhân viên");
          setLoading(false);
          return;
        }
        if (!department) {
          toast.error("Vui lòng chọn phòng ban");
          setLoading(false);
          return;
        }
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            data: { full_name: fullName.trim(), department },
            emailRedirectTo: window.location.origin
          }
        });
        if (error) throw error;
        toast.success("Đăng ký thành công!", {
          description: "Vui lòng kiểm tra email để xác thực tài khoản."
        });
      }
    } catch (error: any) {
      let description = error.message;
      // Handle re-registration after deletion gracefully
      if (!isLogin && (
      error.message?.includes("already been registered") ||
      error.message?.includes("already exists") ||
      error.message?.includes("User already registered")))
      {
        // Send a magic recovery link disguised as a setup link
        const setupParams = `?setup=1&name=${encodeURIComponent(fullName.trim())}&dept=${encodeURIComponent(department)}`;
        const { error: resetError } = await supabase.auth.resetPasswordForEmail(email, {
          redirectTo: `${window.location.origin}/reset-password${setupParams}`
        });

        if (!resetError) {
          toast.success("Email này đã từng được bảo lưu hệ thống.", {
            description: "Chúng tôi đã gửi link kích hoạt lại tài khoản vào email của bạn. Vui lòng kiểm tra và làm theo hướng dẫn trong email.",
            duration: 8000
          });
          setLoading(false);
          return; // Stop here, don't show the error toast
        } else {
          description = "Email này đã tồn tại, nhưng có lỗi khi gửi link phục hồi. Vui lòng liên hệ Admin.";
        }
      }

      toast.error(isLogin ? "Đăng nhập thất bại" : "Đăng ký thất bại", {
        description
      });

    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md shadow-lg">
        <CardHeader className="text-center space-y-4">
          <div className="flex justify-center">
            <div className="flex items-center justify-center w-12 h-12 rounded-xl bg-primary">
              
            </div>
          </div>
          <div>
            <CardTitle className="text-2xl font-bold">LegalHub</CardTitle>
            <p className="text-sm text-muted-foreground mt-1">
              Hệ thống quản lý hợp đồng & pháp chế
            </p>
          </div>
        </CardHeader>
        <CardContent>
          {isForgotPassword ?
          <form onSubmit={handleForgotPassword} className="space-y-4">
              <div className="space-y-2">
                <Label>Email</Label>
                <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="email@example.com" required />
              </div>
              <Button type="submit" className="w-full bg-accent hover:bg-accent/90 text-accent-foreground" disabled={loading}>
                {loading ? "Đang gửi..." : "Gửi email đặt lại mật khẩu"}
              </Button>
              <div className="text-center">
                <button type="button" onClick={() => setIsForgotPassword(false)} className="text-sm text-accent hover:underline">
                  ← Quay lại đăng nhập
                </button>
              </div>
            </form> :

          <>
              <form onSubmit={handleSubmit} className="space-y-4">
                {!isLogin &&
              <>
                    <div className="space-y-2">
                      <Label>Mã nhân viên *</Label>
                      <Input value={fullName} onChange={(e) => setFullName(e.target.value)} placeholder="linhnt2" required />
                    </div>
                    <div className="space-y-2">
                      <Label>Phòng ban *</Label>
                      <Select value={department} onValueChange={setDepartment}>
                        <SelectTrigger><SelectValue placeholder="Chọn phòng ban" /></SelectTrigger>
                        <SelectContent>
                          {DEPARTMENTS.map((dept) =>
                      <SelectItem key={dept.id} value={dept.id}>{dept.id} - {dept.name}</SelectItem>
                      )}
                        </SelectContent>
                      </Select>
                    </div>
                  </>
              }
                <div className="space-y-2">
                  <Label>Email</Label>
                  <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="email@example.com" required />
                </div>
                <div className="space-y-2">
                  <Label>Mật khẩu</Label>
                  <div className="relative">
                    <Input
                    type={showPassword ? "text" : "password"}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    required
                    minLength={6}
                    className="pr-10" />
                  
                    <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors">
                    
                      {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                </div>
                {isLogin &&
              <div className="text-right">
                    <button type="button" onClick={() => setIsForgotPassword(true)} className="text-sm text-accent hover:underline">
                      Quên mật khẩu?
                    </button>
                  </div>
              }
                <Button type="submit" className="w-full bg-accent hover:bg-accent/90 text-accent-foreground" disabled={loading}>
                  {loading ? "Đang xử lý..." : isLogin ? "Đăng nhập" : "Đăng ký"}
                </Button>
              </form>
              <div className="mt-4 text-center">
                <button type="button" onClick={() => setIsLogin(!isLogin)} className="text-sm text-accent hover:underline">
                  {isLogin ? "Chưa có tài khoản? Đăng ký" : "Đã có tài khoản? Đăng nhập"}
                </button>
              </div>
            </>
          }
        </CardContent>
      </Card>
    </div>);

};

export default Auth;