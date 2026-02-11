import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider, useAuth } from "@/hooks/useAuth";
import { AppLayout } from "@/components/layout/AppLayout";
import Auth from "@/pages/Auth";
import Dashboard from "@/pages/Dashboard";
import ClauseLibrary from "@/pages/ClauseLibrary";
import ContractCategories from "@/pages/ContractCategories";
import AdminReviewRequests from "@/pages/AdminReviewRequests";
import AIReview from "@/pages/AIReview";
import UserDashboard from "@/pages/UserDashboard";
import NotFound from "@/pages/NotFound";
import { Loader2 } from "lucide-react";

const queryClient = new QueryClient();

function ProtectedRoutes() {
  const { user, role, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-accent" />
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
        </Route>
        <Route path="*" element={<NotFound />} />
      </Routes>
    );
  }

  // Regular user
  return (
    <Routes>
      <Route element={<AppLayout />}>
        <Route path="/" element={<UserDashboard />} />
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
            <Route path="/*" element={<ProtectedRoutes />} />
          </Routes>
        </BrowserRouter>
      </AuthProvider>
    </TooltipProvider>
  </QueryClientProvider>
);

function AuthGuard() {
  const { user, loading } = useAuth();
  if (loading) return <div className="min-h-screen flex items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-accent" /></div>;
  if (user) return <Navigate to="/" replace />;
  return <Auth />;
}

export default App;
