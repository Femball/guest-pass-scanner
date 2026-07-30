import { Suspense } from "react";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import Index from "./pages/Index";
import Admin from "./pages/Admin";
import Auth from "./pages/Auth";
import NotFound from "./pages/NotFound";
import Unsubscribe from "./pages/Unsubscribe";
import Feedback from "./pages/Feedback";
import QrView from "./pages/QrView";
import Ticket from "./pages/Ticket";
import MemberCards from "./pages/MemberCards";
import WalletDiagnostic from "./pages/WalletDiagnostic";
import Carte from "./pages/Carte";
import ProtectedRoute from "./components/ProtectedRoute";
import { useScanNotifications } from "./hooks/useScanNotifications";

const queryClient = new QueryClient();

const RouteFallback = () => (
  <div className="min-h-screen flex items-center justify-center bg-background">
    <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin" />
  </div>
);

const AppContent = () => {
  // Listen for scan notifications across all pages for staff
  const { alertElement } = useScanNotifications();

  return (
    <>
    {alertElement}
    <Suspense fallback={<RouteFallback />}>
      <Routes>
        <Route path="/auth" element={<Auth />} />
        <Route
          path="/"
          element={
            <ProtectedRoute requiredRole="staff">
              <Index />
            </ProtectedRoute>
          }
        />
        <Route
          path="/admin"
          element={
            <ProtectedRoute requiredRole="adminOrSupervisor">
              <Admin />
            </ProtectedRoute>
          }
        />
        <Route
          path="/admin/cartes"
          element={
            <ProtectedRoute requiredRole="adminOrSupervisor">
              <MemberCards />
            </ProtectedRoute>
          }
        />
        <Route path="/carte/:uid" element={<Carte />} />
        <Route
          path="/admin/wallet-diagnostic"
          element={
            <ProtectedRoute requiredRole="adminOrSupervisor">
              <WalletDiagnostic />
            </ProtectedRoute>
          }
        />
        <Route path="/unsubscribe" element={<Unsubscribe />} />
        <Route path="/feedback" element={<Feedback />} />
        <Route path="/qr/:code" element={<QrView />} />
        <Route path="/ticket" element={<Ticket />} />
        <Route path="/ticket/:code" element={<Ticket />} />
        <Route path="/ticket/:code/*" element={<Ticket />} />
        <Route path="*" element={<NotFound />} />
      </Routes>
    </Suspense>
    </>
  );
};

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Sonner />
      <BrowserRouter>
        <AppContent />
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
