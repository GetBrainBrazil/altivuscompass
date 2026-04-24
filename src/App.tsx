import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "@/contexts/AuthContext";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { AppLayout } from "@/components/AppLayout";
import Dashboard from "./pages/Dashboard";
import Clients from "./pages/Clients";
import Quotes from "./pages/Quotes";
import Campaigns from "./pages/Campaigns";
import Finance from "./pages/Finance";
import FinancialRegistrations from "./pages/FinancialRegistrations";
import FinancialReports from "./pages/FinancialReports";
import Miles from "./pages/Miles";
import Login from "./pages/Login";
import ResetPassword from "./pages/ResetPassword";
import UserManagement from "./pages/UserManagement";
import UserDetail from "./pages/UserDetail";
import Permissions from "./pages/Permissions";
import Registrations from "./pages/Registrations";
import Sales from "./pages/Sales";
import MyProfile from "./pages/MyProfile";
import System from "./pages/System";
import Tasks from "./pages/Tasks";
import TaskDetail from "./pages/TaskDetail";
import PublicQuote from "./pages/PublicQuote";
import Itineraries from "./pages/Itineraries";
import PublicItinerary from "./pages/PublicItinerary";
import ServiceCenter from "./pages/ServiceCenter";
import CRM from "./pages/CRM";
import LeadDetail from "./pages/LeadDetail";
import AIAgents from "./pages/AIAgents";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
    },
  },
});

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <AuthProvider>
          <Routes>
            <Route path="/login" element={<Login />} />
            <Route path="/quote/:id" element={<PublicQuote />} />
            <Route path="/roteiro/:token" element={<PublicItinerary />} />
            <Route path="/reset-password" element={<ResetPassword />} />
            <Route path="/" element={<ProtectedRoute><AppLayout><Dashboard /></AppLayout></ProtectedRoute>} />
            <Route path="/tasks" element={<ProtectedRoute><AppLayout><Tasks /></AppLayout></ProtectedRoute>} />
            <Route path="/tasks/new" element={<ProtectedRoute><AppLayout><TaskDetail /></AppLayout></ProtectedRoute>} />
            <Route path="/tasks/:id" element={<ProtectedRoute><AppLayout><TaskDetail /></AppLayout></ProtectedRoute>} />
            <Route path="/clients" element={<ProtectedRoute><AppLayout><Clients /></AppLayout></ProtectedRoute>} />
            <Route path="/quotes" element={<ProtectedRoute><AppLayout><Quotes /></AppLayout></ProtectedRoute>} />
            <Route path="/sales" element={<ProtectedRoute><AppLayout><Sales /></AppLayout></ProtectedRoute>} />
            <Route path="/campaigns" element={<ProtectedRoute><AppLayout><Campaigns /></AppLayout></ProtectedRoute>} />
            <Route path="/finance" element={<ProtectedRoute><AppLayout><Finance /></AppLayout></ProtectedRoute>} />
            <Route path="/finance/registrations" element={<ProtectedRoute><AppLayout><FinancialRegistrations /></AppLayout></ProtectedRoute>} />
            <Route path="/finance/reports" element={<ProtectedRoute><AppLayout><FinancialReports /></AppLayout></ProtectedRoute>} />
            <Route path="/miles" element={<ProtectedRoute><AppLayout><Miles /></AppLayout></ProtectedRoute>} />
            <Route path="/users" element={<ProtectedRoute><AppLayout><UserManagement /></AppLayout></ProtectedRoute>} />
            <Route path="/users/new" element={<ProtectedRoute><AppLayout><UserDetail /></AppLayout></ProtectedRoute>} />
            <Route path="/users/:id" element={<ProtectedRoute><AppLayout><UserDetail /></AppLayout></ProtectedRoute>} />
            <Route path="/permissions" element={<ProtectedRoute><AppLayout><Permissions /></AppLayout></ProtectedRoute>} />
            <Route path="/registrations" element={<ProtectedRoute><AppLayout><Registrations /></AppLayout></ProtectedRoute>} />
            <Route path="/itineraries" element={<ProtectedRoute><AppLayout><Itineraries /></AppLayout></ProtectedRoute>} />
            <Route path="/profile" element={<ProtectedRoute><AppLayout><MyProfile /></AppLayout></ProtectedRoute>} />
            <Route path="/system" element={<ProtectedRoute><AppLayout><System /></AppLayout></ProtectedRoute>} />
            <Route path="/service-center" element={<ProtectedRoute><AppLayout><ServiceCenter /></AppLayout></ProtectedRoute>} />
            <Route path="/atendimento" element={<ProtectedRoute><AppLayout><ServiceCenter /></AppLayout></ProtectedRoute>} />
            <Route path="/inbox" element={<ProtectedRoute><AppLayout><ServiceCenter /></AppLayout></ProtectedRoute>} />
            <Route path="/crm" element={<ProtectedRoute><AppLayout><CRM /></AppLayout></ProtectedRoute>} />
            <Route path="/crm/lead/:id" element={<ProtectedRoute><AppLayout><LeadDetail /></AppLayout></ProtectedRoute>} />
            <Route path="/ai-agents" element={<ProtectedRoute><AppLayout><AIAgents /></AppLayout></ProtectedRoute>} />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
