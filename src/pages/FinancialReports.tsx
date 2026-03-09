import React, { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { MetricCard } from "@/components/MetricCard";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { BarChart, Bar, LineChart, Line, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip as RTooltip, ResponsiveContainer, Legend, AreaChart, Area } from "recharts";

const COLORS = [
  "hsl(220, 60%, 18%)",
  "hsl(38, 60%, 55%)",
  "hsl(215, 50%, 45%)",
  "hsl(155, 50%, 42%)",
  "hsl(0, 65%, 55%)",
  "hsl(38, 80%, 55%)",
  "hsl(220, 45%, 30%)",
  "hsl(155, 40%, 55%)",
];

const MONTHS = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];

function getMonthKey(dateStr: string) {
  const d = new Date(dateStr + "T00:00:00");
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

function getMonthLabel(key: string) {
  const [y, m] = key.split("-");
  return `${MONTHS[parseInt(m) - 1]}/${y.slice(2)}`;
}

function formatCurrency(v: number) {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v);
}

type Transaction = {
  id: string; description: string; type: string; amount: number; date: string;
  status: string | null; category: string | null; due_date: string | null;
  party_name: string | null; is_reconciled: boolean;
  payment_account: string | null; created_at: string;
};

// ── Budget row type ──
type BudgetRow = {
  category: string;
  planned: number;
  actual: number;
};

export default function FinancialReports() {
  const currentYear = new Date().getFullYear();
  const [year, setYear] = useState(String(currentYear));
  const [budgetRows, setBudgetRows] = useState<BudgetRow[]>([]);
  const [budgetInitialized, setBudgetInitialized] = useState(false);

  const { data: transactions = [] } = useQuery<Transaction[]>({
    queryKey: ["finance-reports-transactions"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("financial_transactions")
        .select("*")
        .order("date", { ascending: true });
      if (error) throw error;
      return (data ?? []) as Transaction[];
    },
  });

  const { data: categories = [] } = useQuery({
    queryKey: ["finance-report-categories"],
    queryFn: async () => {
      const { data, error } = await supabase.from("financial_categories").select("*").eq("is_active", true).order("name");
      if (error) throw error;
      return data ?? [];
    },
  });

  const { data: bankAccounts = [] } = useQuery({
    queryKey: ["finance-report-bank-accounts"],
    queryFn: async () => {
      const { data, error } = await supabase.from("bank_accounts").select("*").order("bank_name");
      if (error) throw error;
      return data ?? [];
    },
  });

  // Filter by year
  const yearTx = useMemo(
    () => transactions.filter((t) => t.date.startsWith(year)),
    [transactions, year]
  );

  // ── Management Report Data ──
  const managementData = useMemo(() => {
    const income = yearTx.filter((t) => t.type === "income" || t.type === "receivable" || t.type === "sale").reduce((s, t) => s + Math.abs(t.amount), 0);
    const expense = yearTx.filter((t) => t.type === "expense" || t.type === "payable").reduce((s, t) => s + Math.abs(t.amount), 0);
    const paid = yearTx.filter((t) => t.status === "paid").reduce((s, t) => s + Math.abs(t.amount), 0);
    const received = yearTx.filter((t) => t.status === "received").reduce((s, t) => s + Math.abs(t.amount), 0);
    const pending = yearTx.filter((t) => t.status === "pending").reduce((s, t) => s + Math.abs(t.amount), 0);

    // By category pie
    const byCat: Record<string, number> = {};
    yearTx.forEach((t) => {
      const cat = t.category ?? "Sem Categoria";
      byCat[cat] = (byCat[cat] ?? 0) + Math.abs(t.amount);
    });
    const pieData = Object.entries(byCat).map(([name, value]) => ({ name: name.split(" – ").pop() ?? name, value }));

    // Monthly trend
    const monthlyMap: Record<string, { receitas: number; despesas: number }> = {};
    for (let m = 1; m <= 12; m++) {
      const key = `${year}-${String(m).padStart(2, "0")}`;
      monthlyMap[key] = { receitas: 0, despesas: 0 };
    }
    yearTx.forEach((t) => {
      const key = getMonthKey(t.date);
      if (!monthlyMap[key]) return;
      if (t.type === "income" || t.type === "receivable" || t.type === "sale") {
        monthlyMap[key].receitas += Math.abs(t.amount);
      } else {
        monthlyMap[key].despesas += Math.abs(t.amount);
      }
    });
    const monthlyTrend = Object.entries(monthlyMap)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([key, val]) => ({ month: getMonthLabel(key), ...val }));

    // By status
    const statusData = [
      { name: "Pendente", value: pending },
      { name: "Pago", value: paid },
      { name: "Recebido", value: received },
    ].filter((d) => d.value > 0);

    return { income, expense, paid, received, pending, pieData, monthlyTrend, statusData, balance: income - expense };
  }, [yearTx, year]);

  // ── DRE Data ──
  const dreData = useMemo(() => {
    // Build category tree mapping
    const catMap = new Map(categories.map((c) => [c.id, c]));
    const getFullPath = (catStr: string | null): string => {
      if (!catStr) return "Sem Categoria";
      return catStr;
    };

    // Group revenue
    const revenueItems: Record<string, number> = {};
    const expenseItems: Record<string, number> = {};

    yearTx.forEach((t) => {
      const catName = getFullPath(t.category);
      const shortName = catName.split(" – ").pop() ?? catName;
      if (t.type === "income" || t.type === "receivable" || t.type === "sale") {
        revenueItems[shortName] = (revenueItems[shortName] ?? 0) + Math.abs(t.amount);
      } else {
        expenseItems[shortName] = (expenseItems[shortName] ?? 0) + Math.abs(t.amount);
      }
    });

    const totalRevenue = Object.values(revenueItems).reduce((s, v) => s + v, 0);
    const totalExpenses = Object.values(expenseItems).reduce((s, v) => s + v, 0);
    const netIncome = totalRevenue - totalExpenses;
    const margin = totalRevenue > 0 ? (netIncome / totalRevenue) * 100 : 0;

    return {
      revenueItems: Object.entries(revenueItems).sort((a, b) => b[1] - a[1]),
      expenseItems: Object.entries(expenseItems).sort((a, b) => b[1] - a[1]),
      totalRevenue,
      totalExpenses,
      netIncome,
      margin,
    };
  }, [yearTx, categories]);

  // ── Cash Flow Data ──
  const cashFlowData = useMemo(() => {
    const monthlyMap: Record<string, { entradas: number; saidas: number; saldo: number }> = {};
    for (let m = 1; m <= 12; m++) {
      const key = `${year}-${String(m).padStart(2, "0")}`;
      monthlyMap[key] = { entradas: 0, saidas: 0, saldo: 0 };
    }

    // Only realized (paid/received)
    yearTx
      .filter((t) => t.status === "paid" || t.status === "received")
      .forEach((t) => {
        const key = getMonthKey(t.date);
        if (!monthlyMap[key]) return;
        if (t.type === "income" || t.type === "receivable" || t.type === "sale") {
          monthlyMap[key].entradas += Math.abs(t.amount);
        } else {
          monthlyMap[key].saidas += Math.abs(t.amount);
        }
      });

    let runningBalance = 0;
    const monthly = Object.entries(monthlyMap)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([key, val]) => {
        runningBalance += val.entradas - val.saidas;
        return { month: getMonthLabel(key), entradas: val.entradas, saidas: val.saidas, saldo: runningBalance };
      });

    const totalIn = monthly.reduce((s, m) => s + m.entradas, 0);
    const totalOut = monthly.reduce((s, m) => s + m.saidas, 0);

    // By account
    const byAccount: Record<string, number> = {};
    yearTx
      .filter((t) => t.status === "paid" || t.status === "received")
      .forEach((t) => {
        const acc = t.payment_account ?? "Sem Conta";
        const sign = t.type === "income" || t.type === "receivable" || t.type === "sale" ? 1 : -1;
        byAccount[acc] = (byAccount[acc] ?? 0) + sign * Math.abs(t.amount);
      });
    const accountData = Object.entries(byAccount).map(([name, value]) => ({ name, value }));

    return { monthly, totalIn, totalOut, finalBalance: runningBalance, accountData };
  }, [yearTx, year]);

  // ── Budget Data ──
  // Initialize budget rows from categories when not done
  useMemo(() => {
    if (budgetInitialized) return;
    const expenseCategories = yearTx.reduce<Record<string, number>>((acc, t) => {
      if (t.type === "expense" || t.type === "payable") {
        const cat = t.category?.split(" – ").pop() ?? "Sem Categoria";
        acc[cat] = (acc[cat] ?? 0) + Math.abs(t.amount);
      }
      return acc;
    }, {});

    const rows = Object.entries(expenseCategories).map(([category, actual]) => ({
      category,
      planned: 0,
      actual,
    }));

    if (rows.length > 0) {
      setBudgetRows(rows);
      setBudgetInitialized(true);
    }
  }, [yearTx, budgetInitialized]);

  const updateBudgetPlanned = (idx: number, value: number) => {
    setBudgetRows((prev) => prev.map((r, i) => (i === idx ? { ...r, planned: value } : r)));
  };

  // ── Account Balances Data ──
  const balancesData = useMemo(() => {
    // Calculate balance per bank account from ALL transactions (not filtered by year)
    const balanceMap: Record<string, number> = {};
    // Initialize with bank accounts
    bankAccounts.forEach((a) => {
      balanceMap[a.id] = 0;
    });
    // Also track "Virtual" and unassigned
    transactions.forEach((t) => {
      const acc = t.payment_account ?? "unassigned";
      if (!(acc in balanceMap)) balanceMap[acc] = 0;
      const isIncome = t.type === "income" || t.type === "receivable" || t.type === "sale";
      const isPaid = t.status === "paid" || t.status === "received";
      if (isPaid) {
        balanceMap[acc] += isIncome ? Math.abs(t.amount) : -Math.abs(t.amount);
      }
    });

    const accountBalances = bankAccounts.map((a) => ({
      id: a.id,
      name: a.bank_name,
      accountType: a.account_type,
      isActive: a.is_active,
      balance: balanceMap[a.id] ?? 0,
    }));

    // Virtual account
    const virtualBalance = balanceMap["Virtual"] ?? 0;
    const unassignedBalance = balanceMap["unassigned"] ?? 0;

    const totalBalance = accountBalances.reduce((s, a) => s + a.balance, 0) + virtualBalance + unassignedBalance;

    return { accountBalances, virtualBalance, unassignedBalance, totalBalance };
  }, [transactions, bankAccounts]);

  const budgetTotals = useMemo(() => {
    const totalPlanned = budgetRows.reduce((s, r) => s + r.planned, 0);
    const totalActual = budgetRows.reduce((s, r) => s + r.actual, 0);
    return { totalPlanned, totalActual, variance: totalPlanned - totalActual };
  }, [budgetRows]);

  const yearOptions = useMemo(() => {
    const years = new Set(transactions.map((t) => t.date.slice(0, 4)));
    years.add(String(currentYear));
    return Array.from(years).sort().reverse();
  }, [transactions, currentYear]);

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-display font-semibold text-foreground">Relatórios Financeiros</h1>
          <p className="text-muted-foreground font-body mt-1 text-sm">Análise gerencial, DRE, fluxo de caixa e orçamento.</p>
        </div>
        <div className="flex items-center gap-2">
          <Label className="text-xs font-body text-muted-foreground">Ano:</Label>
          <Select value={year} onValueChange={setYear}>
            <SelectTrigger className="w-24 h-9 text-sm">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {yearOptions.map((y) => (
                <SelectItem key={y} value={y}>{y}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <Tabs defaultValue="management" className="space-y-6">
        <TabsList className="w-full justify-start overflow-x-auto overflow-y-hidden flex-nowrap scrollbar-hide">
          <TabsTrigger value="management" className="font-body text-xs sm:text-sm">Gerencial</TabsTrigger>
          <TabsTrigger value="dre" className="font-body text-xs sm:text-sm">DRE</TabsTrigger>
          <TabsTrigger value="cashflow" className="font-body text-xs sm:text-sm">Fluxo de Caixa</TabsTrigger>
          <TabsTrigger value="budget" className="font-body text-xs sm:text-sm">Orçamento</TabsTrigger>
        </TabsList>

        {/* ═══ GERENCIAL ═══ */}
        <TabsContent value="management" className="space-y-6">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
            <MetricCard title="Receitas" value={formatCurrency(managementData.income)} icon={
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.2" className="text-success"><path d="M12 2v20M17 7l-5-5-5 5" /></svg>
            } />
            <MetricCard title="Despesas" value={formatCurrency(managementData.expense)} icon={
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.2" className="text-destructive"><path d="M12 22V2M7 17l5 5 5-5" /></svg>
            } />
            <MetricCard title="Resultado" value={formatCurrency(managementData.balance)} icon={
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.2" className="text-soft-blue"><path d="M2 17l4-4 4 4 4-6 4 2 4-4" /><path d="M2 21h20" /></svg>
            } trend={managementData.balance >= 0 ? { value: "Positivo", positive: true } : { value: "Negativo", positive: false }} />
            <MetricCard title="Pendente" value={formatCurrency(managementData.pending)} icon={
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.2" className="text-gold"><circle cx="12" cy="12" r="10" /><path d="M12 6v6l4 2" /></svg>
            } />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* Monthly Trend */}
            <div className="glass-card rounded-xl p-4 sm:p-5">
              <h3 className="font-display text-sm font-semibold mb-4">Receitas vs Despesas por Mês</h3>
              <ResponsiveContainer width="100%" height={280}>
                <BarChart data={managementData.monthlyTrend} barGap={2}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="month" tick={{ fontSize: 10 }} />
                  <YAxis tick={{ fontSize: 10 }} tickFormatter={(v) => `${(v / 1000).toFixed(0)}K`} />
                  <RTooltip formatter={(v: number) => formatCurrency(v)} />
                  <Legend wrapperStyle={{ fontSize: 12 }} />
                  <Bar dataKey="receitas" name="Receitas" fill="hsl(155, 50%, 42%)" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="despesas" name="Despesas" fill="hsl(0, 65%, 55%)" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>

            {/* Category Pie */}
            <div className="glass-card rounded-xl p-4 sm:p-5">
              <h3 className="font-display text-sm font-semibold mb-4">Distribuição por Categoria</h3>
              {managementData.pieData.length === 0 ? (
                <p className="text-center text-muted-foreground text-sm py-12">Sem dados para o período.</p>
              ) : (
                <ResponsiveContainer width="100%" height={280}>
                  <PieChart>
                    <Pie data={managementData.pieData} cx="50%" cy="50%" innerRadius={60} outerRadius={100} paddingAngle={2} dataKey="value">
                      {managementData.pieData.map((_, i) => (
                        <Cell key={i} fill={COLORS[i % COLORS.length]} />
                      ))}
                    </Pie>
                    <RTooltip formatter={(v: number) => formatCurrency(v)} />
                    <Legend wrapperStyle={{ fontSize: 11 }} />
                  </PieChart>
                </ResponsiveContainer>
              )}
            </div>

            {/* Status Pie */}
            <div className="glass-card rounded-xl p-4 sm:p-5">
              <h3 className="font-display text-sm font-semibold mb-4">Distribuição por Status</h3>
              {managementData.statusData.length === 0 ? (
                <p className="text-center text-muted-foreground text-sm py-12">Sem dados para o período.</p>
              ) : (
                <ResponsiveContainer width="100%" height={280}>
                  <PieChart>
                    <Pie data={managementData.statusData} cx="50%" cy="50%" innerRadius={60} outerRadius={100} paddingAngle={2} dataKey="value">
                      {managementData.statusData.map((_, i) => (
                        <Cell key={i} fill={COLORS[i % COLORS.length]} />
                      ))}
                    </Pie>
                    <RTooltip formatter={(v: number) => formatCurrency(v)} />
                    <Legend wrapperStyle={{ fontSize: 11 }} />
                  </PieChart>
                </ResponsiveContainer>
              )}
            </div>
          </div>
        </TabsContent>

        {/* ═══ DRE ═══ */}
        <TabsContent value="dre" className="space-y-6">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
            <MetricCard title="Receita Bruta" value={formatCurrency(dreData.totalRevenue)} icon={
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.2" className="text-success"><path d="M12 2v20M17 7l-5-5-5 5" /></svg>
            } />
            <MetricCard title="Despesas Totais" value={formatCurrency(dreData.totalExpenses)} icon={
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.2" className="text-destructive"><path d="M12 22V2M7 17l5 5 5-5" /></svg>
            } />
            <MetricCard title="Resultado Líquido" value={formatCurrency(dreData.netIncome)} icon={
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.2" className="text-soft-blue"><path d="M9 18l6-12" /><circle cx="9" cy="18" r="2" /><circle cx="15" cy="6" r="2" /></svg>
            } trend={dreData.netIncome >= 0 ? { value: "Positivo", positive: true } : { value: "Negativo", positive: false }} />
            <MetricCard title="Margem" value={`${dreData.margin.toFixed(1)}%`} icon={
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.2" className="text-gold"><path d="M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20z" /><path d="M12 6v6l4 2" /></svg>
            } />
          </div>

          <div className="glass-card rounded-xl overflow-hidden">
            <div className="p-4 sm:p-5 border-b border-border/50">
              <h3 className="font-display text-base font-semibold">Demonstração do Resultado do Exercício — {year}</h3>
            </div>
            <div className="divide-y divide-border/30">
              {/* Revenue Section */}
              <div className="p-4 bg-success/5">
                <p className="text-xs font-semibold uppercase tracking-wider text-success font-body mb-2">Receitas</p>
                {dreData.revenueItems.length === 0 ? (
                  <p className="text-xs text-muted-foreground">Nenhuma receita registrada.</p>
                ) : (
                  dreData.revenueItems.map(([name, value]) => (
                    <div key={name} className="flex justify-between py-1.5">
                      <span className="text-sm font-body text-foreground">{name}</span>
                      <span className="text-sm font-body font-medium text-success">{formatCurrency(value)}</span>
                    </div>
                  ))
                )}
                <div className="flex justify-between pt-2 border-t border-success/20 mt-2">
                  <span className="text-sm font-semibold font-body">Total Receitas</span>
                  <span className="text-sm font-semibold font-body text-success">{formatCurrency(dreData.totalRevenue)}</span>
                </div>
              </div>

              {/* Expense Section */}
              <div className="p-4 bg-destructive/5">
                <p className="text-xs font-semibold uppercase tracking-wider text-destructive font-body mb-2">Despesas</p>
                {dreData.expenseItems.length === 0 ? (
                  <p className="text-xs text-muted-foreground">Nenhuma despesa registrada.</p>
                ) : (
                  dreData.expenseItems.map(([name, value]) => (
                    <div key={name} className="flex justify-between py-1.5">
                      <span className="text-sm font-body text-foreground">{name}</span>
                      <span className="text-sm font-body font-medium text-destructive">-{formatCurrency(value)}</span>
                    </div>
                  ))
                )}
                <div className="flex justify-between pt-2 border-t border-destructive/20 mt-2">
                  <span className="text-sm font-semibold font-body">Total Despesas</span>
                  <span className="text-sm font-semibold font-body text-destructive">-{formatCurrency(dreData.totalExpenses)}</span>
                </div>
              </div>

              {/* Net Result */}
              <div className={`p-4 ${dreData.netIncome >= 0 ? "bg-success/10" : "bg-destructive/10"}`}>
                <div className="flex justify-between">
                  <span className="text-base font-display font-semibold">Resultado Líquido</span>
                  <span className={`text-base font-display font-semibold ${dreData.netIncome >= 0 ? "text-success" : "text-destructive"}`}>
                    {formatCurrency(dreData.netIncome)}
                  </span>
                </div>
                <div className="flex justify-between mt-1">
                  <span className="text-xs font-body text-muted-foreground">Margem Líquida</span>
                  <span className="text-xs font-body text-muted-foreground">{dreData.margin.toFixed(1)}%</span>
                </div>
              </div>
            </div>
          </div>
        </TabsContent>

        {/* ═══ FLUXO DE CAIXA ═══ */}
        <TabsContent value="cashflow" className="space-y-6">
          <div className="grid grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
            <MetricCard title="Total Entradas" value={formatCurrency(cashFlowData.totalIn)} icon={
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.2" className="text-success"><path d="M12 2v20M17 7l-5-5-5 5" /></svg>
            } />
            <MetricCard title="Total Saídas" value={formatCurrency(cashFlowData.totalOut)} icon={
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.2" className="text-destructive"><path d="M12 22V2M7 17l5 5 5-5" /></svg>
            } />
            <MetricCard title="Saldo Final" value={formatCurrency(cashFlowData.finalBalance)} icon={
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.2" className="text-soft-blue"><rect x="2" y="5" width="20" height="14" rx="2" /><path d="M2 10h20" /></svg>
            } trend={cashFlowData.finalBalance >= 0 ? { value: "Positivo", positive: true } : { value: "Negativo", positive: false }} />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* Cash Flow Chart */}
            <div className="glass-card rounded-xl p-4 sm:p-5 lg:col-span-2">
              <h3 className="font-display text-sm font-semibold mb-4">Fluxo de Caixa Mensal — {year}</h3>
              <ResponsiveContainer width="100%" height={320}>
                <AreaChart data={cashFlowData.monthly}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="month" tick={{ fontSize: 10 }} />
                  <YAxis tick={{ fontSize: 10 }} tickFormatter={(v) => `${(v / 1000).toFixed(0)}K`} />
                  <RTooltip formatter={(v: number) => formatCurrency(v)} />
                  <Legend wrapperStyle={{ fontSize: 12 }} />
                  <Area type="monotone" dataKey="entradas" name="Entradas" stroke="hsl(155, 50%, 42%)" fill="hsl(155, 50%, 42%)" fillOpacity={0.15} />
                  <Area type="monotone" dataKey="saidas" name="Saídas" stroke="hsl(0, 65%, 55%)" fill="hsl(0, 65%, 55%)" fillOpacity={0.15} />
                  <Line type="monotone" dataKey="saldo" name="Saldo Acumulado" stroke="hsl(215, 50%, 45%)" strokeWidth={2} dot={false} />
                </AreaChart>
              </ResponsiveContainer>
            </div>

            {/* Table */}
            <div className="glass-card rounded-xl overflow-hidden lg:col-span-2">
              <div className="p-4 border-b border-border/50">
                <h3 className="font-display text-sm font-semibold">Detalhamento Mensal</h3>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border/50">
                      <th className="text-left p-3 font-body font-semibold text-muted-foreground text-xs">Mês</th>
                      <th className="text-right p-3 font-body font-semibold text-muted-foreground text-xs">Entradas</th>
                      <th className="text-right p-3 font-body font-semibold text-muted-foreground text-xs">Saídas</th>
                      <th className="text-right p-3 font-body font-semibold text-muted-foreground text-xs">Saldo</th>
                    </tr>
                  </thead>
                  <tbody>
                    {cashFlowData.monthly.map((m) => (
                      <tr key={m.month} className="border-b border-border/20 hover:bg-muted/30">
                        <td className="p-3 font-body">{m.month}</td>
                        <td className="p-3 font-body text-right text-success">{formatCurrency(m.entradas)}</td>
                        <td className="p-3 font-body text-right text-destructive">{formatCurrency(m.saidas)}</td>
                        <td className={`p-3 font-body text-right font-medium ${m.saldo >= 0 ? "text-foreground" : "text-destructive"}`}>{formatCurrency(m.saldo)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </TabsContent>

        {/* ═══ ORÇAMENTO ═══ */}
        <TabsContent value="budget" className="space-y-6">
          <div className="grid grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
            <MetricCard title="Orçado" value={formatCurrency(budgetTotals.totalPlanned)} icon={
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.2" className="text-soft-blue"><path d="M9 5H2v7l6.29 6.29c.94.94 2.48.94 3.42 0l4.58-4.58c.94-.94.94-2.48 0-3.42L9 5z" /><circle cx="6" cy="9" r="1" /></svg>
            } />
            <MetricCard title="Realizado" value={formatCurrency(budgetTotals.totalActual)} icon={
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.2" className="text-gold"><path d="M22 12h-4l-3 9L9 3l-3 9H2" /></svg>
            } />
            <MetricCard title="Variação" value={formatCurrency(budgetTotals.variance)} icon={
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.2" className={budgetTotals.variance >= 0 ? "text-success" : "text-destructive"}><path d="M2 17l4-4 4 4 4-6 4 2 4-4" /><path d="M2 21h20" /></svg>
            } trend={budgetTotals.variance >= 0 ? { value: "Abaixo do orçado", positive: true } : { value: "Acima do orçado", positive: false }} />
          </div>

          {/* Budget Chart */}
          {budgetRows.length > 0 && (
            <div className="glass-card rounded-xl p-4 sm:p-5">
              <h3 className="font-display text-sm font-semibold mb-4">Orçado vs Realizado por Categoria</h3>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={budgetRows} layout="vertical" margin={{ left: 80 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis type="number" tick={{ fontSize: 10 }} tickFormatter={(v) => `${(v / 1000).toFixed(0)}K`} />
                  <YAxis type="category" dataKey="category" tick={{ fontSize: 10 }} width={75} />
                  <RTooltip formatter={(v: number) => formatCurrency(v)} />
                  <Legend wrapperStyle={{ fontSize: 12 }} />
                  <Bar dataKey="planned" name="Orçado" fill="hsl(215, 50%, 45%)" radius={[0, 4, 4, 0]} />
                  <Bar dataKey="actual" name="Realizado" fill="hsl(38, 60%, 55%)" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}

          {/* Budget Table */}
          <div className="glass-card rounded-xl overflow-hidden">
            <div className="p-4 border-b border-border/50">
              <h3 className="font-display text-sm font-semibold">Detalhamento do Orçamento — {year}</h3>
              <p className="text-xs text-muted-foreground font-body mt-1">Insira os valores orçados para cada categoria e compare com o realizado.</p>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border/50">
                    <th className="text-left p-3 font-body font-semibold text-muted-foreground text-xs">Categoria</th>
                    <th className="text-right p-3 font-body font-semibold text-muted-foreground text-xs w-32">Orçado (R$)</th>
                    <th className="text-right p-3 font-body font-semibold text-muted-foreground text-xs w-28">Realizado</th>
                    <th className="text-right p-3 font-body font-semibold text-muted-foreground text-xs w-28">Variação</th>
                    <th className="text-right p-3 font-body font-semibold text-muted-foreground text-xs w-20">%</th>
                  </tr>
                </thead>
                <tbody>
                  {budgetRows.map((row, idx) => {
                    const variance = row.planned - row.actual;
                    const pct = row.planned > 0 ? ((row.actual / row.planned) * 100) : 0;
                    return (
                      <tr key={row.category} className="border-b border-border/20 hover:bg-muted/30">
                        <td className="p-3 font-body">{row.category}</td>
                        <td className="p-3 text-right">
                          <Input
                            type="number"
                            min={0}
                            step={100}
                            value={row.planned || ""}
                            onChange={(e) => updateBudgetPlanned(idx, Number(e.target.value))}
                            className="h-7 w-full text-right text-xs"
                            placeholder="0,00"
                          />
                        </td>
                        <td className="p-3 font-body text-right">{formatCurrency(row.actual)}</td>
                        <td className={`p-3 font-body text-right font-medium ${variance >= 0 ? "text-success" : "text-destructive"}`}>
                          {formatCurrency(variance)}
                        </td>
                        <td className={`p-3 font-body text-right text-xs ${pct > 100 ? "text-destructive" : "text-muted-foreground"}`}>
                          {pct.toFixed(0)}%
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
                <tfoot>
                  <tr className="border-t border-border bg-muted/30">
                    <td className="p-3 font-body font-semibold">Total</td>
                    <td className="p-3 font-body text-right font-semibold">{formatCurrency(budgetTotals.totalPlanned)}</td>
                    <td className="p-3 font-body text-right font-semibold">{formatCurrency(budgetTotals.totalActual)}</td>
                    <td className={`p-3 font-body text-right font-semibold ${budgetTotals.variance >= 0 ? "text-success" : "text-destructive"}`}>
                      {formatCurrency(budgetTotals.variance)}
                    </td>
                    <td className="p-3 font-body text-right text-xs">
                      {budgetTotals.totalPlanned > 0 ? `${((budgetTotals.totalActual / budgetTotals.totalPlanned) * 100).toFixed(0)}%` : "—"}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>

          {budgetRows.length === 0 && (
            <div className="glass-card rounded-xl p-8 text-center">
              <p className="text-muted-foreground font-body text-sm">Nenhuma despesa registrada em {year} para construir o orçamento.</p>
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}