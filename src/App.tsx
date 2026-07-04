import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider } from "@/contexts/AuthContext";
import { ThemeProvider } from "@/contexts/ThemeContext";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { AppLayout } from "@/components/AppLayout";
import Dashboard from "./pages/Dashboard";
import Clients from "./pages/Clients";
import Contacts from "./pages/Contacts";

import Quotes from "./pages/Quotes";
import Campaigns from "./pages/Campaigns";
import Finance from "./pages/Finance";
import FinancialRegistrations from "./pages/FinancialRegistrations";
import FinancialReports from "./pages/FinancialReports";
import PayablesReceivables from "./pages/PayablesReceivables";
import Payables from "./pages/Payables";
import Receivables from "./pages/Receivables";
import PayableReceivableForm from "./pages/PayableReceivableForm";
import Reconciliation from "./pages/Reconciliation";
import Miles from "./pages/Miles";
import Login from "./pages/Login";
import ResetPassword from "./pages/ResetPassword";
import UserManagement from "./pages/UserManagement";
import UserDetail from "./pages/UserDetail";
import Permissions from "./pages/Permissions";
import Registrations from "./pages/Registrations";
import Catalog from "./pages/Catalog";
import CatalogEdit from "./pages/CatalogEdit";
import CategoryFieldsPage from "./pages/CategoryFieldsPage";
import QuoteItemEdit from "./pages/QuoteItemEdit";
import Sales from "./pages/Sales";
import FinanceClosedSales from "./pages/FinanceClosedSales";
import Suppliers from "./pages/Suppliers";
import MyProfile from "./pages/MyProfile";
import System from "./pages/System";
import Tasks from "./pages/Tasks";
import Changelog from "./pages/Changelog";
import TaskDetail from "./pages/TaskDetail";
import PublicQuote from "./pages/PublicQuote";
import Itineraries from "./pages/Itineraries";
import PublicItinerary from "./pages/PublicItinerary";
import PublicItineraryPDF from "./pages/PublicItineraryPDF";
import ServiceCenter from "./pages/ServiceCenter";
import CRM from "./pages/CRM";
import CRMDashboard from "./pages/CRMDashboard";
import LeadDetail from "./pages/LeadDetail";
import LeadNew from "./pages/LeadNew";
import LeadConvert from "./pages/LeadConvert";
import OpsNew from "./pages/OpsNew";
import Pipeline from "./pages/Pipeline";


import AIAgentEdit from "./pages/AIAgentEdit";
import Vault from "./pages/Vault";
import VaultEdit from "./pages/VaultEdit";

import { ReminderPopupCenter } from "@/components/ReminderPopupCenter";
import RouteAuditLogger from "@/components/RouteAuditLogger";

import Unsubscribe from "./pages/Unsubscribe";
import ReminderAction from "./pages/ReminderAction";
import NotFound from "./pages/NotFound";

import { useEffect, useState } from "react";
import { loadPermissionOverrides, subscribePermissionOverrides } from "@/lib/permissionSync";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
    },
  },
});

function PermissionsGate({ children }: { children: React.ReactNode }) {
  const [version, setVersion] = useState(0);
  const [ready, setReady] = useState(false);
  useEffect(() => {
    let mounted = true;
    loadPermissionOverrides().finally(() => {
      if (mounted) setReady(true);
    });
    const unsub = subscribePermissionOverrides(() => setVersion((v) => v + 1));
    return () => {
      mounted = false;
      unsub();
    };
  }, []);
  if (!ready) return null;
  return <div key={version} style={{ display: "contents" }}>{children}</div>;
}

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <AuthProvider>
          <ThemeProvider>
          <RouteAuditLogger />
          <PermissionsGate>
          <Routes>
            <Route path="/login" element={<Login />} />
            <Route path="/quote/:id" element={<PublicQuote />} />
            <Route path="/roteiro/:token" element={<PublicItinerary />} />
            <Route path="/roteiro/:token/pdf" element={<PublicItineraryPDF />} />
            <Route path="/reset-password" element={<ResetPassword />} />
            <Route path="/unsubscribe" element={<Unsubscribe />} />
            <Route path="/r/:code" element={<ReminderAction />} />
            <Route path="/" element={<ProtectedRoute><AppLayout><Dashboard /></AppLayout></ProtectedRoute>} />
            <Route path="/tasks" element={<ProtectedRoute><AppLayout><Tasks /></AppLayout></ProtectedRoute>} />
            <Route path="/tasks/new" element={<ProtectedRoute><AppLayout><TaskDetail /></AppLayout></ProtectedRoute>} />
            <Route path="/tasks/:id" element={<ProtectedRoute><AppLayout><TaskDetail /></AppLayout></ProtectedRoute>} />
            <Route path="/changelog" element={<ProtectedRoute><AppLayout><Changelog /></AppLayout></ProtectedRoute>} />
            <Route path="/contacts" element={<Navigate to="/clients" replace />} />
            
            <Route path="/clients" element={<ProtectedRoute><AppLayout><Clients /></AppLayout></ProtectedRoute>} />
            <Route path="/quotes" element={<ProtectedRoute><AppLayout><Quotes /></AppLayout></ProtectedRoute>} />
            <Route path="/quotes/:quoteId/items/:itemId" element={<ProtectedRoute><AppLayout><QuoteItemEdit /></AppLayout></ProtectedRoute>} />
            <Route path="/sales" element={<ProtectedRoute><AppLayout><Sales /></AppLayout></ProtectedRoute>} />
            <Route path="/campaigns" element={<ProtectedRoute><AppLayout><Campaigns /></AppLayout></ProtectedRoute>} />
            <Route path="/finance" element={<ProtectedRoute><AppLayout><Finance /></AppLayout></ProtectedRoute>} />
            <Route path="/finance/payables-receivables" element={<ProtectedRoute><AppLayout><PayablesReceivables /></AppLayout></ProtectedRoute>} />
            <Route path="/finance/payables" element={<ProtectedRoute><AppLayout><Payables /></AppLayout></ProtectedRoute>} />
            <Route path="/finance/receivables" element={<ProtectedRoute><AppLayout><Receivables /></AppLayout></ProtectedRoute>} />
            <Route path="/finance/payables-receivables/new" element={<ProtectedRoute><AppLayout><PayableReceivableForm /></AppLayout></ProtectedRoute>} />
            <Route path="/finance/payables-receivables/:id/edit" element={<ProtectedRoute><AppLayout><PayableReceivableForm /></AppLayout></ProtectedRoute>} />
            <Route path="/finance/registrations" element={<ProtectedRoute><AppLayout><FinancialRegistrations /></AppLayout></ProtectedRoute>} />
            <Route path="/finance/reports" element={<ProtectedRoute><AppLayout><FinancialReports /></AppLayout></ProtectedRoute>} />
            <Route path="/finance/closed-sales" element={<ProtectedRoute><AppLayout><FinanceClosedSales /></AppLayout></ProtectedRoute>} />
            <Route path="/finance/suppliers" element={<ProtectedRoute><AppLayout><Suppliers /></AppLayout></ProtectedRoute>} />
            <Route path="/finance/reconciliation" element={<ProtectedRoute><AppLayout><Reconciliation /></AppLayout></ProtectedRoute>} />
            <Route path="/miles" element={<ProtectedRoute><AppLayout><Miles /></AppLayout></ProtectedRoute>} />
            <Route path="/users" element={<ProtectedRoute><AppLayout><UserManagement /></AppLayout></ProtectedRoute>} />
            <Route path="/users/new" element={<ProtectedRoute><AppLayout><UserDetail /></AppLayout></ProtectedRoute>} />
            <Route path="/users/:id" element={<ProtectedRoute><AppLayout><UserDetail /></AppLayout></ProtectedRoute>} />
            <Route path="/permissions" element={<ProtectedRoute><AppLayout><Permissions /></AppLayout></ProtectedRoute>} />
            <Route path="/registrations" element={<ProtectedRoute><AppLayout><Registrations /></AppLayout></ProtectedRoute>} />
            <Route path="/catalog" element={<ProtectedRoute><AppLayout><Catalog /></AppLayout></ProtectedRoute>} />
            <Route path="/catalog/new" element={<ProtectedRoute><AppLayout><CatalogEdit /></AppLayout></ProtectedRoute>} />
            <Route path="/catalog/:id/edit" element={<ProtectedRoute><AppLayout><CatalogEdit /></AppLayout></ProtectedRoute>} />
            <Route path="/registrations/categories/:id/fields" element={<ProtectedRoute><AppLayout><CategoryFieldsPage /></AppLayout></ProtectedRoute>} />
            <Route path="/itineraries" element={<ProtectedRoute><AppLayout><Itineraries /></AppLayout></ProtectedRoute>} />
            <Route path="/profile" element={<ProtectedRoute><AppLayout><MyProfile /></AppLayout></ProtectedRoute>} />
            <Route path="/system" element={<ProtectedRoute><AppLayout><System /></AppLayout></ProtectedRoute>} />
            <Route path="/vault" element={<ProtectedRoute><AppLayout><Vault /></AppLayout></ProtectedRoute>} />
            <Route path="/vault/:id" element={<ProtectedRoute><AppLayout><VaultEdit /></AppLayout></ProtectedRoute>} />
            <Route path="/service-center" element={<ProtectedRoute><AppLayout><ServiceCenter /></AppLayout></ProtectedRoute>} />
            <Route path="/atendimento" element={<ProtectedRoute><AppLayout><ServiceCenter /></AppLayout></ProtectedRoute>} />
            <Route path="/inbox" element={<ProtectedRoute><AppLayout><ServiceCenter /></AppLayout></ProtectedRoute>} />
            <Route path="/crm" element={<ProtectedRoute><AppLayout><CRMDashboard /></AppLayout></ProtectedRoute>} />
            <Route path="/crm/dashboard" element={<ProtectedRoute><AppLayout><CRMDashboard /></AppLayout></ProtectedRoute>} />

            <Route path="/pipeline" element={<ProtectedRoute><AppLayout><Pipeline /></AppLayout></ProtectedRoute>} />
            <Route path="/crm/ops" element={<ProtectedRoute><AppLayout><CRM /></AppLayout></ProtectedRoute>} />
            <Route path="/crm/sales" element={<ProtectedRoute><AppLayout><CRM /></AppLayout></ProtectedRoute>} />
            <Route path="/crm/lead/new" element={<ProtectedRoute><AppLayout><LeadNew /></AppLayout></ProtectedRoute>} />
            <Route path="/crm/ops/new" element={<ProtectedRoute><AppLayout><OpsNew /></AppLayout></ProtectedRoute>} />
            <Route path="/crm/lead/:id" element={<ProtectedRoute><AppLayout><LeadDetail /></AppLayout></ProtectedRoute>} />
            <Route path="/crm/lead/:id/convert" element={<ProtectedRoute><AppLayout><LeadConvert /></AppLayout></ProtectedRoute>} />
            <Route path="/ai-agents" element={<ProtectedRoute><AppLayout><AIAgentEdit /></AppLayout></ProtectedRoute>} />
            <Route path="/ai-agents/new" element={<Navigate to="/ai-agents" replace />} />
            <Route path="/ai-agents/:id" element={<Navigate to="/ai-agents" replace />} />
            <Route path="/whatsapp-connection" element={<Navigate to="/ai-agents?section=whatsapp" replace />} />
            <Route path="*" element={<NotFound />} />
          </Routes>
          <ReminderPopupCenter />
          </PermissionsGate>
          </ThemeProvider>
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
