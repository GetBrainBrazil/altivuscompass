import React, { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { MetricCard } from "@/components/MetricCard";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Checkbox } from "@/components/ui/checkbox";
import { useToast } from "@/hooks/use-toast";
import { CheckCircle2, ChevronsUpDown, Check, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { ScrollArea } from "@/components/ui/scroll-area";

type Transaction = {
  id: string; description: string; type: string; amount: number; date: string;
  status: string | null; category?: string | null; due_date?: string | null;
  party_name?: string | null; created_at: string;
  is_reconciled?: boolean; virtual_account_owner?: string | null;
  observations?: string | null; payment_account?: string | null;
};

const typeLabels: Record<string, string> = {
  receivable: "A Receber", payable: "A Pagar", sale: "Venda", expense: "Despesa", commission: "Comissão",
};

const statusLabels: Record<string, { label: string; color: string }> = {
  pending: { label: "Pendente", color: "bg-gold/10 text-gold" },
  paid: { label: "Pago", color: "bg-success/10 text-success" },
  received: { label: "Recebido", color: "bg-success/10 text-success" },
  overdue: { label: "Vencido", color: "bg-destructive/10 text-destructive" },
  cancelled: { label: "Cancelado", color: "bg-muted text-muted-foreground" },
};

export default function Finance() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Transaction | null>(null);
  const [form, setForm] = useState<Record<string, any>>({});
  const [filter, setFilter] = useState("all");
  const [partyPopoverOpen, setPartyPopoverOpen] = useState(false);
  const [accountFilter, setAccountFilter] = useState<Set<string>>(new Set());
  const [accountFilterOpen, setAccountFilterOpen] = useState(false);

  const { data: clients = [] } = useQuery({
    queryKey: ["clients-list"],
    queryFn: async () => {
      const { data, error } = await supabase.from("clients").select("id, full_name").eq("is_active", true).order("full_name");
      if (error) throw error;
      return data;
    },
  });

  const { data: suppliers = [] } = useQuery({
    queryKey: ["suppliers-list"],
    queryFn: async () => {
      const { data, error } = await supabase.from("suppliers").select("id, name, trade_name").eq("is_active", true).order("name");
      if (error) throw error;
      return data;
    },
  });

  const { data: financialCategories = [] } = useQuery({
    queryKey: ["financial-categories"],
    queryFn: async () => {
      const { data, error } = await supabase.from("financial_categories").select("*").eq("is_active", true).order("code").order("name");
      if (error) throw error;
      return data;
    },
  });

  const categoryTree = useMemo(() => {
    type Cat = typeof financialCategories[number] & { children: Cat[] };
    const build = (parentId: string | null): Cat[] =>
      financialCategories
        .filter(c => c.parent_id === parentId)
        .map(c => ({ ...c, children: build(c.id) }));
    return build(null);
  }, [financialCategories]);

  const { data: bankAccounts = [] } = useQuery({
    queryKey: ["bank-accounts-active"],
    queryFn: async () => {
      const { data, error } = await supabase.from("bank_accounts").select("id, bank_name, agency, account_number").eq("is_active", true).order("bank_name");
      if (error) throw error;
      return data;
    },
  });

  const partyOptions = useMemo(() => {
    const clientOpts = clients.map(c => ({ value: c.full_name, label: c.full_name, group: "Clientes" }));
    const supplierOpts = suppliers.map(s => ({ value: s.trade_name || s.name, label: s.trade_name ? `${s.name} (${s.trade_name})` : s.name, group: "Fornecedores" }));
    return { clients: clientOpts, suppliers: supplierOpts };
  }, [clients, suppliers]);

  const { data: transactions = [], isLoading } = useQuery({
    queryKey: ["financial-transactions"],
    queryFn: async () => {
      const { data, error } = await supabase.from("financial_transactions").select("*").order("date", { ascending: false });
      if (error) throw error;
      return data as Transaction[];
    },
  });

  const saveMutation = useMutation({
    mutationFn: async () => {
      const payload = {
        description: form.description, type: form.type || "receivable",
        amount: Number(form.amount), date: form.date || new Date().toISOString().split("T")[0],
        status: form.status || "pending", category: form.category || form.type || "receivable",
        due_date: form.due_date || null, party_name: form.party_name || null,
        is_reconciled: form.is_reconciled ?? false,
        observations: form.observations || null,
        payment_account: form.payment_account || null,
      };
      if (editing) {
        const { error } = await supabase.from("financial_transactions").update(payload).eq("id", editing.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("financial_transactions").insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast({ title: editing ? "Transação atualizada" : "Transação criada" });
      queryClient.invalidateQueries({ queryKey: ["financial-transactions"] });
      closeDialog();
    },
    onError: (err: Error) => toast({ title: "Erro", description: err.message, variant: "destructive" }),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("financial_transactions").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast({ title: "Transação removida" });
      queryClient.invalidateQueries({ queryKey: ["financial-transactions"] });
    },
    onError: (err: Error) => toast({ title: "Erro", description: err.message, variant: "destructive" }),
  });

  const openCreate = (type: string = "receivable") => {
    setEditing(null);
    setForm({ type, category: type, status: "pending", date: new Date().toISOString().split("T")[0], is_reconciled: false });
    setDialogOpen(true);
  };

  const openEdit = (t: Transaction) => {
    setEditing(t);
    setForm({
      description: t.description, type: t.type, amount: t.amount, date: t.date,
      status: t.status ?? "pending", category: t.category ?? t.type,
      due_date: t.due_date ?? "", party_name: t.party_name ?? "",
      is_reconciled: t.is_reconciled ?? false,
      observations: t.observations ?? "",
      payment_account: t.payment_account ?? "",
    });
    setDialogOpen(true);
  };

  const closeDialog = () => { setDialogOpen(false); setEditing(null); setForm({}); };

  const formatCurrency = (v: number) => new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v);

  const categoryPathMap = useMemo(() => {
    const map = new Map<string, string>();
    const buildPath = (id: string): string => {
      const cat = financialCategories.find(c => c.id === id);
      if (!cat) return "";
      const parentPath = cat.parent_id ? buildPath(cat.parent_id) : "";
      return parentPath ? `${parentPath} > ${cat.name}` : cat.name;
    };
    financialCategories.forEach(c => map.set(c.id, buildPath(c.id)));
    return map;
  }, [financialCategories]);

  const bankAccountMap = useMemo(() => {
    const map = new Map<string, string>();
    bankAccounts.forEach(ba => {
      map.set(ba.id, `${ba.bank_name}${ba.agency ? ` Ag ${ba.agency}` : ""}${ba.account_number ? ` / ${ba.account_number}` : ""}`);
    });
    return map;
  }, [bankAccounts]);

  const receivables = transactions.filter(t => t.category?.startsWith("RECEITAS") || t.type === "receivable" || t.type === "sale" || t.type === "commission");
  const payables = transactions.filter(t => t.category?.startsWith("DESPESAS") || t.category?.startsWith("IMPOSTOS") || t.type === "expense" || t.type === "payable");
  const pendingReceivables = receivables.filter(t => t.status === "pending").reduce((s, t) => s + Number(t.amount), 0);
  const pendingPayables = payables.filter(t => t.status === "pending").reduce((s, t) => s + Number(t.amount), 0);
  const totalReceived = receivables.filter(t => t.status === "received" || t.status === "paid").reduce((s, t) => s + Number(t.amount), 0);
  const totalPaid = payables.filter(t => t.status === "paid").reduce((s, t) => s + Number(t.amount), 0);

  const typeFiltered = filter === "all" ? transactions : filter === "receivable" ? receivables : payables;
  const filtered = accountFilter.size === 0 ? typeFiltered : typeFiltered.filter(t => t.payment_account && accountFilter.has(t.payment_account));

  // Calculate running balance
  const sortedFiltered = [...filtered].sort((a, b) => a.date.localeCompare(b.date) || a.created_at.localeCompare(b.created_at));
  let runningBalance = 0;
  const balanceMap = new Map<string, number>();
  sortedFiltered.forEach(t => {
    const isExpense = t.category?.startsWith("DESPESAS") || t.category?.startsWith("IMPOSTOS") || t.type === "expense" || t.type === "payable";
    runningBalance += isExpense ? -Number(t.amount) : Number(t.amount);
    balanceMap.set(t.id, runningBalance);
  });

  return (
    <div className="max-w-7xl mx-auto space-y-4 sm:space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl sm:text-3xl font-display font-semibold text-foreground">Financeiro</h1>
          <p className="text-muted-foreground font-body mt-1 text-sm">Contas a pagar e receber.</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => openCreate("expense")} className="font-body flex-1 sm:flex-none text-xs sm:text-sm">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M12 5v14M5 12h14" /></svg>
            <span className="hidden sm:inline">Conta a </span>Pagar
          </Button>
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button onClick={() => openCreate("receivable")} className="font-body flex-1 sm:flex-none text-xs sm:text-sm">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M12 5v14M5 12h14" /></svg>
                <span className="hidden sm:inline">Conta a </span>Receber
              </Button>
            </DialogTrigger>
            <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
              <DialogHeader>
                <DialogTitle className="font-display">{editing ? "Editar Transação" : "Nova Transação"}</DialogTitle>
              </DialogHeader>
              <form onSubmit={(e) => { e.preventDefault(); saveMutation.mutate(); }} className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="sm:col-span-2 space-y-2">
                    <Label className="font-body">Descrição *</Label>
                    <Input value={form.description ?? ""} onChange={(e) => setForm({ ...form, description: e.target.value })} required />
                  </div>
                  <div className="space-y-2">
                    <Label className="font-body">Tipo</Label>
                    <Select value={form.type ?? "receivable"} onValueChange={(v) => setForm({ ...form, type: v })}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="receivable">A Receber</SelectItem>
                        <SelectItem value="payable">A Pagar</SelectItem>
                        <SelectItem value="sale">Venda</SelectItem>
                        <SelectItem value="expense">Despesa</SelectItem>
                        <SelectItem value="commission">Comissão</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label className="font-body">Valor (R$) *</Label>
                    <Input type="number" step="0.01" value={form.amount ?? ""} onChange={(e) => setForm({ ...form, amount: e.target.value })} required />
                  </div>
                  <div className="space-y-2">
                    <Label className="font-body">Data</Label>
                    <Input type="date" value={form.date ?? ""} onChange={(e) => setForm({ ...form, date: e.target.value })} />
                  </div>
                  <div className="space-y-2">
                    <Label className="font-body">Vencimento</Label>
                    <Input type="date" value={form.due_date ?? ""} onChange={(e) => setForm({ ...form, due_date: e.target.value })} />
                  </div>
                  <div className="space-y-2">
                    <Label className="font-body">Status</Label>
                    <Select value={form.status ?? "pending"} onValueChange={(v) => setForm({ ...form, status: v })}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="pending">Pendente</SelectItem>
                        <SelectItem value="paid">Pago</SelectItem>
                        <SelectItem value="received">Recebido</SelectItem>
                        <SelectItem value="overdue">Vencido</SelectItem>
                        <SelectItem value="cancelled">Cancelado</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label className="font-body">Categoria</Label>
                    <Popover>
                      <PopoverTrigger asChild>
                        <Button variant="outline" role="combobox" className="w-full justify-between font-normal">
                          {form.category ? (
                            (() => {
                              const cat = financialCategories.find(c => c.id === form.category);
                              return cat ? `${cat.code ? cat.code + " - " : ""}${cat.name}` : form.category;
                            })()
                          ) : <span className="text-muted-foreground">Selecione a categoria...</span>}
                          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
                        <Command>
                          <CommandInput placeholder="Buscar categoria..." />
                          <CommandList>
                            <CommandEmpty>Nenhuma categoria encontrada.</CommandEmpty>
                            {(() => {
                              const renderItems = (cats: typeof categoryTree, depth = 0): React.ReactNode[] =>
                                cats.flatMap(cat => {
                                  const isSynthetic = cat.account_nature === "synthetic";
                                  const prefix = cat.code ? `${cat.code} - ` : "";
                                  const nodes: React.ReactNode[] = [];
                                  if (isSynthetic) {
                                    nodes.push(
                                      <CommandGroup key={cat.id} heading={
                                        <span style={{ paddingLeft: `${depth * 12}px` }} className="text-xs font-semibold text-muted-foreground">
                                          {prefix}{cat.name}
                                        </span>
                                      }>
                                        {renderItems(cat.children, depth + 1)}
                                      </CommandGroup>
                                    );
                                  } else {
                                    nodes.push(
                                      <CommandItem
                                        key={cat.id}
                                        value={`${prefix}${cat.name}`}
                                        onSelect={() => setForm({ ...form, category: cat.id })}
                                        style={{ paddingLeft: `${depth * 12 + 8}px` }}
                                      >
                                        <Check className={cn("mr-2 h-4 w-4", form.category === cat.id ? "opacity-100" : "opacity-0")} />
                                        {prefix}{cat.name}
                                      </CommandItem>
                                    );
                                    if (cat.children.length > 0) {
                                      nodes.push(...renderItems(cat.children, depth + 1));
                                    }
                                  }
                                  return nodes;
                                });
                              return renderItems(categoryTree);
                            })()}
                          </CommandList>
                        </Command>
                      </PopoverContent>
                    </Popover>
                  </div>
                  <div className="space-y-2">
                    <Label className="font-body">Cliente / Fornecedor</Label>
                    <Popover open={partyPopoverOpen} onOpenChange={setPartyPopoverOpen}>
                      <PopoverTrigger asChild>
                        <Button variant="outline" role="combobox" className="w-full justify-between font-normal">
                          {form.party_name || <span className="text-muted-foreground">Selecione...</span>}
                          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
                        <Command>
                          <CommandInput placeholder="Buscar cliente ou fornecedor..." />
                          <CommandList>
                            <CommandEmpty>Nenhum resultado.</CommandEmpty>
                            {partyOptions.clients.length > 0 && (
                              <CommandGroup heading="Clientes">
                                {partyOptions.clients.map(o => (
                                  <CommandItem key={`c-${o.value}`} value={o.label} onSelect={() => { setForm({ ...form, party_name: o.value }); setPartyPopoverOpen(false); }}>
                                    <Check className={cn("mr-2 h-4 w-4", form.party_name === o.value ? "opacity-100" : "opacity-0")} />
                                    {o.label}
                                  </CommandItem>
                                ))}
                              </CommandGroup>
                            )}
                            {partyOptions.suppliers.length > 0 && (
                              <CommandGroup heading="Fornecedores">
                                {partyOptions.suppliers.map(o => (
                                  <CommandItem key={`s-${o.value}`} value={o.label} onSelect={() => { setForm({ ...form, party_name: o.value }); setPartyPopoverOpen(false); }}>
                                    <Check className={cn("mr-2 h-4 w-4", form.party_name === o.value ? "opacity-100" : "opacity-0")} />
                                    {o.label}
                                  </CommandItem>
                                ))}
                              </CommandGroup>
                            )}
                          </CommandList>
                        </Command>
                      </PopoverContent>
                    </Popover>
                  </div>
                  <div className="space-y-2">
                    <Label className="font-body">Conta</Label>
                    <Select value={form.payment_account ?? ""} onValueChange={(v) => setForm({ ...form, payment_account: v === "none" ? null : v })}>
                      <SelectTrigger><SelectValue placeholder="Selecione a conta..." /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">Nenhuma</SelectItem>
                        {bankAccounts.map(ba => (
                          <SelectItem key={ba.id} value={ba.id}>
                            {ba.bank_name}{ba.agency ? ` - Ag ${ba.agency}` : ""}{ba.account_number ? ` / ${ba.account_number}` : ""}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label className="font-body">Observações</Label>
                    <Input value={form.observations ?? ""} onChange={(e) => setForm({ ...form, observations: e.target.value })} />
                  </div>
                  <div className="flex items-center gap-2 pt-6">
                    <Checkbox
                      checked={form.is_reconciled ?? false}
                      onCheckedChange={(v) => setForm({ ...form, is_reconciled: !!v })}
                    />
                    <Label className="font-body">Conciliado</Label>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {editing && (
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button type="button" variant="ghost" className="text-destructive font-body">Excluir Transação</Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Excluir transação?</AlertDialogTitle>
                          <AlertDialogDescription>Esta ação não pode ser desfeita.</AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancelar</AlertDialogCancel>
                          <AlertDialogAction onClick={() => { deleteMutation.mutate(editing.id); closeDialog(); }}>Excluir</AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  )}
                  <div className="flex-1" />
                  <Button type="button" variant="outline" onClick={closeDialog} className="font-body">Cancelar</Button>
                  <Button type="submit" disabled={saveMutation.isPending} className="font-body">
                    {saveMutation.isPending ? "Salvando..." : "Salvar"}
                  </Button>
                </div>
              </form>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <MetricCard title="A Receber (Pendente)" value={formatCurrency(pendingReceivables)} icon={
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.2" className="text-success"><path d="M2 17l4-4 4 4 4-6 4 2 4-4" /><path d="M2 21h20" /></svg>
        } />
        <MetricCard title="A Pagar (Pendente)" value={formatCurrency(pendingPayables)} icon={
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.2" className="text-destructive"><path d="M2 7l4 4 4-4 4 6 4-2 4 4" /><path d="M2 3h20" /></svg>
        } />
        <MetricCard title="Total Recebido" value={formatCurrency(totalReceived)} icon={
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.2" className="text-gold"><circle cx="12" cy="12" r="10" /><path d="M12 6v12M9 9h6M9 15h6" /></svg>
        } />
        <MetricCard title="Total Pago" value={formatCurrency(totalPaid)} icon={
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.2" className="text-soft-blue"><path d="M12 2l3 7h7l-5.5 4 2 7L12 16l-6.5 4 2-7L2 9h7l3-7z" /></svg>
        } />
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <div className="flex gap-1 p-1 rounded-lg bg-muted w-fit">
          {[{ id: "all", label: "Todas" }, { id: "receivable", label: "Receitas" }, { id: "payable", label: "Despesas" }].map((f) => (
            <button key={f.id} onClick={() => setFilter(f.id)}
              className={`px-3 py-1.5 rounded-md text-xs font-medium font-body transition-colors ${filter === f.id ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"}`}>
              {f.label}
            </button>
          ))}
        </div>
        <Popover open={accountFilterOpen} onOpenChange={setAccountFilterOpen}>
          <PopoverTrigger asChild>
            <Button variant="outline" size="sm" className="font-body text-xs gap-1.5">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M22 3H2l8 9.46V19l4 2v-8.54L22 3z" /></svg>
              Conta{accountFilter.size > 0 ? ` (${accountFilter.size})` : ""}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-64 p-0" align="start">
            <Command>
              <CommandInput placeholder="Buscar conta..." />
              <CommandList>
                <CommandEmpty>Nenhuma conta encontrada.</CommandEmpty>
                <CommandGroup>
                  {bankAccounts.map(ba => {
                    const label = `${ba.bank_name}${ba.agency ? ` - Ag ${ba.agency}` : ""}${ba.account_number ? ` / ${ba.account_number}` : ""}`;
                    const isSelected = accountFilter.has(ba.id);
                    return (
                      <CommandItem
                        key={ba.id}
                        value={label}
                        onSelect={() => {
                          setAccountFilter(prev => {
                            const next = new Set(prev);
                            isSelected ? next.delete(ba.id) : next.add(ba.id);
                            return next;
                          });
                        }}
                      >
                        <Checkbox checked={isSelected} className="mr-2" />
                        {label}
                      </CommandItem>
                    );
                  })}
                </CommandGroup>
              </CommandList>
            </Command>
            {accountFilter.size > 0 && (
              <div className="border-t p-2">
                <Button variant="ghost" size="sm" className="w-full text-xs font-body" onClick={() => setAccountFilter(new Set())}>
                  Limpar filtro
                </Button>
              </div>
            )}
          </PopoverContent>
        </Popover>
      </div>

      {/* Desktop table */}
      <div className="glass-card rounded-xl hidden sm:block overflow-x-auto">
        <div className="p-4 sm:p-5 border-b border-border/50">
          <h2 className="font-display text-lg font-semibold">Transações</h2>
        </div>
        {isLoading ? (
          <div className="p-8 text-center text-muted-foreground font-body">Carregando...</div>
        ) : filtered.length === 0 ? (
          <div className="p-8 text-center text-muted-foreground font-body">Nenhuma transação encontrada.</div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border/50 text-muted-foreground font-body text-xs">
                <th className="p-3 text-left font-medium">Data</th>
                <th className="p-3 text-center font-medium w-8">C</th>
                <th className="p-3 text-left font-medium">Descrição</th>
                <th className="p-3 text-left font-medium">Conta</th>
                <th className="p-3 text-left font-medium">Categoria</th>
                <th className="p-3 text-left font-medium">Cliente/Fornecedor</th>
                <th className="p-3 text-right font-medium">Valor</th>
                <th className="p-3 text-right font-medium">Saldo</th>
                <th className="p-3 text-left font-medium">Obs</th>
                
              </tr>
            </thead>
            <tbody className="divide-y divide-border/30">
              {[...filtered].sort((a, b) => a.date.localeCompare(b.date) || a.created_at.localeCompare(b.created_at)).map((t) => {
                const isExpense = t.category?.startsWith("DESPESAS") || t.category?.startsWith("IMPOSTOS") || t.type === "expense" || t.type === "payable";
                const balance = balanceMap.get(t.id) ?? 0;
                return (
                  <tr key={t.id} className="hover:bg-muted/30 transition-colors cursor-pointer" onClick={() => openEdit(t)}>
                    <td className="p-3 font-body text-xs text-muted-foreground whitespace-nowrap">{t.date}</td>
                    <td className="p-3 text-center">
                      {t.is_reconciled && <CheckCircle2 size={14} className="text-success mx-auto" />}
                    </td>
                    <td className="p-3 font-body font-medium text-foreground">{t.description}</td>
                    <td className="p-3 font-body text-xs text-muted-foreground">{(t.payment_account && bankAccountMap.get(t.payment_account)) || t.payment_account || "-"}</td>
                    <td className="p-3 font-body text-xs text-muted-foreground max-w-[200px] truncate" title={categoryPathMap.get(t.category || "") || t.category || ""}>{categoryPathMap.get(t.category || "") || t.category || "-"}</td>
                    <td className="p-3 font-body text-xs text-muted-foreground">{t.party_name || "-"}</td>
                    <td className={`p-3 font-body text-sm font-medium text-right whitespace-nowrap ${isExpense ? "text-destructive" : "text-success"}`}>
                      {isExpense ? `(${formatCurrency(Number(t.amount))})` : formatCurrency(Number(t.amount))}
                    </td>
                    <td className={`p-3 font-body text-xs text-right whitespace-nowrap ${balance < 0 ? "text-destructive" : "text-foreground"}`}>
                      {balance < 0 ? `(${formatCurrency(Math.abs(balance))})` : formatCurrency(balance)}
                    </td>
                    <td className="p-3 font-body text-xs text-muted-foreground max-w-[120px] truncate">{t.observations || "-"}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* Mobile cards */}
      <div className="sm:hidden space-y-3">
        {isLoading ? (
          <div className="p-8 text-center text-muted-foreground font-body">Carregando...</div>
        ) : filtered.length === 0 ? (
          <div className="p-8 text-center text-muted-foreground font-body">Nenhuma transação encontrada.</div>
        ) : (
          filtered.map((t) => {
            const isExpense = t.category?.startsWith("DESPESAS") || t.category?.startsWith("IMPOSTOS") || t.type === "expense" || t.type === "payable";
            const st = statusLabels[t.status ?? "pending"] ?? statusLabels.pending;
            return (
              <div key={t.id} className="glass-card rounded-xl p-4 space-y-2" onClick={() => openEdit(t)}>
                <div className="flex items-start justify-between">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5">
                      {t.is_reconciled && <CheckCircle2 size={12} className="text-success shrink-0" />}
                      <p className="text-sm font-medium font-body text-foreground truncate">{t.description}</p>
                    </div>
                    <p className="text-xs text-muted-foreground font-body">{t.category || t.type}{t.party_name ? ` · ${t.party_name}` : ""}</p>
                  </div>
                  <span className={`text-sm font-semibold font-body ml-2 ${isExpense ? "text-destructive" : "text-success"}`}>
                    {isExpense ? "-" : ""}{formatCurrency(Number(t.amount))}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className={`text-[10px] font-medium px-2.5 py-1 rounded-full font-body ${st.color}`}>{st.label}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-muted-foreground font-body">{t.date}</span>
                    <Button variant="ghost" size="sm" className="text-destructive h-6 px-2 text-xs" onClick={(e) => { e.stopPropagation(); if (confirm("Remover?")) deleteMutation.mutate(t.id); }}>✕</Button>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
