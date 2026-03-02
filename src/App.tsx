import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider, useAuth } from "@/hooks/useAuth";
import { AppLayout } from "@/components/layout/AppLayout";
import Auth from "@/pages/Auth";
import ResetPassword from "@/pages/ResetPassword";
import Dashboard from "@/pages/Dashboard";
import ClauseLibrary from "@/pages/ClauseLibrary";
import ContractCategories from "@/pages/ContractCategories";
import AdminReviewRequests from "@/pages/AdminReviewRequests";
import AIReview from "@/pages/AIReview";
import EmployeeManagement from "@/pages/EmployeeManagement";
import UserDashboard from "@/pages/UserDashboard";
import Notifications from "@/pages/Notifications";
import NotFound from "@/pages/NotFound";

const queryClient = new QueryClient();

function ProtectedRoutes() {
  const { user, role, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-muted-foreground">Đang tải...</p>
      </div>
    );
  }

  if (!user) return <Navigate to="/auth" replace />;

  if (role === "admin") {
    return (
      <Routes>
        <Route element={<AppLayout />}>
          <Route path="/" element={<Dashboard />} />
          <Route path="/dieu-khoan" element={<ClauseLibrary />} />
          <Route path="/tong-hop-dong" element={<ContractCategories />} />
          <Route path="/yeu-cau-review" element={<AdminReviewRequests />} />
          <Route path="/ai-kiem-tra" element={<AIReview />} />
          <Route path="/quan-ly-nhan-vien" element={<EmployeeManagement />} />
          <Route path="/thong-bao" element={<Notifications />} />
        </Route>
        <Route path="*" element={<NotFound />} />
      </Routes>
    );
  }

  // Accountant, Finance → can access Dashboard + ContractCategories + review
  if (role === "accountant" || role === "finance") {
    return (
      <Routes>
        <Route element={<AppLayout />}>
          <Route path="/" element={<Dashboard />} />
          <Route path="/tong-hop-dong" element={<ContractCategories />} />
          <Route path="/yeu-cau-review" element={<AdminReviewRequests />} />
          <Route path="/thong-bao" element={<Notifications />} />
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    );
  }

  // Manager → view-only Dashboard + ContractCategories + review (read-only)
  if (role === "manager") {
    return (
      <Routes>
        <Route element={<AppLayout />}>
          <Route path="/" element={<Dashboard />} />
          <Route path="/tong-hop-dong" element={<ContractCategories />} />
          <Route path="/yeu-cau-review" element={<AdminReviewRequests />} />
          <Route path="/thong-bao" element={<Notifications />} />
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    );
  }

  // Regular user
  return (
    <Routes>
      <Route element={<AppLayout />}>
        <Route path="/" element={<UserDashboard />} />
        <Route path="/thong-bao" element={<Notifications />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <AuthProvider>
        <BrowserRouter>
          <Routes>
            <Route path="/auth" element={<AuthGuard />} />
            <Route path="/reset-password" element={<ResetPassword />} />
            <Route path="/*" element={<ProtectedRoutes />} />
          </Routes>
        </BrowserRouter>
      </AuthProvider>
    </TooltipProvider>
  </QueryClientProvider>
);

function AuthGuard() {
  const { user, loading } = useAuth();
  if (loading) return <div className="min-h-screen flex items-center justify-center"><p className="text-muted-foreground">Đang tải...</p></div>;
  if (user) return <Navigate to="/" replace />;
  return <Auth />;
}

export default App;
