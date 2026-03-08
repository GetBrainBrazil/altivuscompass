import { useState } from "react";
import { ArrowLeft } from "lucide-react";
import { Link, useSearchParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import BankAccountsTab from "@/components/finance/BankAccountsTab";
import ChartOfAccountsTab from "@/components/finance/ChartOfAccountsTab";

export default function FinancialRegistrations() {
  const [searchParams, setSearchParams] = useSearchParams();
  const activeTab = searchParams.get("tab") || "bank-accounts";

  const handleTabChange = (value: string) => {
    setSearchParams({ tab: value });
  };

  return (
    <div className="max-w-5xl mx-auto space-y-4 sm:space-y-6">
      <div className="flex items-center gap-3">
        <Link to="/finance">
          <Button variant="ghost" size="icon" className="h-8 w-8">
            <ArrowLeft size={18} />
          </Button>
        </Link>
        <div>
          <h1 className="text-2xl sm:text-3xl font-display font-semibold text-foreground">Cadastros Financeiros</h1>
          <p className="text-muted-foreground font-body mt-1 text-sm">Contas bancárias e plano de contas.</p>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={handleTabChange}>
        <TabsList>
          <TabsTrigger value="bank-accounts" className="font-body">Contas Bancárias</TabsTrigger>
          <TabsTrigger value="chart-of-accounts" className="font-body">Plano de Contas</TabsTrigger>
        </TabsList>
        <TabsContent value="bank-accounts" className="mt-4">
          <BankAccountsTab />
        </TabsContent>
        <TabsContent value="chart-of-accounts" className="mt-4">
          <ChartOfAccountsTab />
        </TabsContent>
      </Tabs>
    </div>
  );
}
