import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AppLayout } from "@/components/layout/AppLayout";
import Dashboard from "@/pages/Dashboard";
import ClauseLibrary from "@/pages/ClauseLibrary";
import ContractStorage from "@/pages/ContractStorage";
import ReviewRequests from "@/pages/ReviewRequests";
import AIReview from "@/pages/AIReview";
import NotFound from "@/pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <Routes>
          <Route element={<AppLayout />}>
            <Route path="/" element={<Dashboard />} />
            <Route path="/dieu-khoan" element={<ClauseLibrary />} />
            <Route path="/hop-dong" element={<ContractStorage />} />
            <Route path="/yeu-cau-review" element={<ReviewRequests />} />
            <Route path="/ai-kiem-tra" element={<AIReview />} />
          </Route>
          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
