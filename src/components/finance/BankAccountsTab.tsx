import { useState, useMemo, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";
import { Plus, Trash2, ArrowUpDown, ArrowUp, ArrowDown, Users } from "lucide-react";

type BankAccount = {
  id: string; bank_name: string; agency: string | null; account_number: string | null;
  account_type: string | null; pix_key: string | null; pix_key_type: string | null;
  holder_name: string | null; holder_document: string | null; is_active: boolean;
  notes: string | null; created_at: string; updated_at: string;
};

type Profile = {
  id: string; user_id: string; full_name: string; email: string | null; avatar_url: string | null;
};

const accountTypeLabels: Record<string, string> = {
  checking: "Conta Corrente", savings: "Conta Poupança", salary: "Conta Salário", payment: "Conta Pagamento", petty_cash: "Caixinha",
};

type SortDir = "asc" | "desc" | null;

function SortHeader({ label, active, direction, onClick }: { label: string; active: boolean; direction: SortDir; onClick: () => void }) {
  return (
    <button onClick={onClick} className="flex items-center gap-1 group font-medium text-xs uppercase tracking-wider text-muted-foreground hover:text-foreground transition-colors">
      {label}
      {active && direction === "asc" ? <ArrowUp size={12} /> :
       active && direction === "desc" ? <ArrowDown size={12} /> :
       <ArrowUpDown size={12} className="opacity-40 group-hover:opacity-100" />}
    </button>
  );
}

function getInitials(name: string) {
  return name.split(" ").map(n => n[0]).filter(Boolean).slice(0, 2).join("").toUpperCase();
}

export default function BankAccountsTab() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<BankAccount | null>(null);
  const [form, setForm] = useState<Record<string, any>>({});
  const [sortKey, setSortKey] = useState<string | null>(null);
  const [sortDir, setSortDir] = useState<SortDir>(null);
  const [selectedUserIds, setSelectedUserIds] = useState<Set<string>>(new Set());

  const toggleSort = (key: string) => {
    if (sortKey !== key) { setSortKey(key); setSortDir("asc"); }
    else if (sortDir === "asc") setSortDir("desc");
    else if (sortDir === "desc") { setSortKey(null); setSortDir(null); }
  };

  const { data: accounts = [], isLoading } = useQuery({
    queryKey: ["bank-accounts"],
    queryFn: async () => {
      const { data, error } = await supabase.from("bank_accounts").select("*").order("bank_name");
      if (error) throw error;
      return data as BankAccount[];
    },
  });

  const { data: profiles = [] } = useQuery({
    queryKey: ["profiles-list"],
    queryFn: async () => {
      const { data, error } = await supabase.from("profiles").select("*").order("full_name");
      if (error) throw error;
      return data as Profile[];
    },
  });

  // Load access list when editing
  useEffect(() => {
    if (editing) {
      supabase
        .from("bank_account_access")
        .select("user_id")
        .eq("bank_account_id", editing.id)
        .then(({ data }) => {
          setSelectedUserIds(new Set((data || []).map(d => d.user_id)));
        });
    } else {
      setSelectedUserIds(new Set());
    }
  }, [editing]);

  const toggleUser = (userId: string) => {
    setSelectedUserIds(prev => {
      const next = new Set(prev);
      next.has(userId) ? next.delete(userId) : next.add(userId);
      return next;
    });
  };

  const sorted = useMemo(() => {
    if (!sortKey || !sortDir) return accounts;
    return [...accounts].sort((a, b) => {
      const va = (a as any)[sortKey] ?? "";
      const vb = (b as any)[sortKey] ?? "";
      const cmp = String(va).localeCompare(String(vb), "pt-BR", { sensitivity: "base" });
      return sortDir === "asc" ? cmp : -cmp;
    });
  }, [accounts, sortKey, sortDir]);

  const saveMutation = useMutation({
    mutationFn: async () => {
      const payload = {
        bank_name: form.bank_name, agency: form.agency || null, account_number: form.account_number || null,
        account_type: form.account_type || "checking", pix_key: form.pix_key || null,
        pix_key_type: form.pix_key_type || null, holder_name: form.holder_name || null,
        holder_document: form.holder_document || null, is_active: form.is_active ?? true, notes: form.notes || null,
      };

      let accountId: string;

      if (editing) {
        const { error } = await supabase.from("bank_accounts").update(payload).eq("id", editing.id);
        if (error) throw error;
        accountId = editing.id;
      } else {
        const { data, error } = await supabase.from("bank_accounts").insert(payload).select("id").single();
        if (error) throw error;
        accountId = data.id;
      }

      // Sync access: delete all then re-insert
      await supabase.from("bank_account_access").delete().eq("bank_account_id", accountId);
      if (selectedUserIds.size > 0) {
        const rows = Array.from(selectedUserIds).map(user_id => ({
          bank_account_id: accountId,
          user_id,
        }));
        const { error: accessError } = await supabase.from("bank_account_access").insert(rows);
        if (accessError) throw accessError;
      }
    },
    onSuccess: () => {
      toast({ title: editing ? "Conta atualizada" : "Conta criada" });
      queryClient.invalidateQueries({ queryKey: ["bank-accounts"] });
      closeDialog();
    },
    onError: (err: Error) => toast({ title: "Erro", description: err.message, variant: "destructive" }),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("bank_accounts").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast({ title: "Conta removida" });
      queryClient.invalidateQueries({ queryKey: ["bank-accounts"] });
      closeDialog();
    },
    onError: (err: Error) => toast({ title: "Erro", description: err.message, variant: "destructive" }),
  });

  const openCreate = () => {
    setEditing(null);
    setForm({ account_type: "checking", is_active: true });
    setSelectedUserIds(new Set());
    setDialogOpen(true);
  };

  const openEdit = (a: BankAccount) => {
    setEditing(a);
    setForm({
      bank_name: a.bank_name, agency: a.agency ?? "", account_number: a.account_number ?? "",
      account_type: a.account_type ?? "checking", pix_key: a.pix_key ?? "",
      pix_key_type: a.pix_key_type ?? "", holder_name: a.holder_name ?? "",
      holder_document: a.holder_document ?? "", is_active: a.is_active, notes: a.notes ?? "",
    });
    setDialogOpen(true);
  };

  const closeDialog = () => { setDialogOpen(false); setEditing(null); setForm({}); setSelectedUserIds(new Set()); };

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button onClick={openCreate} className="font-body text-xs sm:text-sm">
          <Plus size={16} /> Nova Conta
        </Button>
      </div>

      <div className="glass-card rounded-xl overflow-x-auto">
        {isLoading ? (
          <div className="p-8 text-center text-muted-foreground font-body">Carregando...</div>
        ) : accounts.length === 0 ? (
          <div className="p-8 text-center text-muted-foreground font-body">Nenhuma conta bancária cadastrada.</div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border/50">
                <th className="p-4 text-left">
                  <SortHeader label="Banco" active={sortKey === "bank_name"} direction={sortKey === "bank_name" ? sortDir : null} onClick={() => toggleSort("bank_name")} />
                </th>
                <th className="p-4 text-left">
                  <SortHeader label="Tipo" active={sortKey === "account_type"} direction={sortKey === "account_type" ? sortDir : null} onClick={() => toggleSort("account_type")} />
                </th>
                <th className="p-4 text-left">
                  <SortHeader label="Agência" active={sortKey === "agency"} direction={sortKey === "agency" ? sortDir : null} onClick={() => toggleSort("agency")} />
                </th>
                <th className="p-4 text-left">
                  <SortHeader label="Conta" active={sortKey === "account_number"} direction={sortKey === "account_number" ? sortDir : null} onClick={() => toggleSort("account_number")} />
                </th>
                <th className="p-4 text-left">
                  <SortHeader label="Chave PIX" active={sortKey === "pix_key"} direction={sortKey === "pix_key" ? sortDir : null} onClick={() => toggleSort("pix_key")} />
                </th>
                <th className="p-4 text-left font-medium text-xs uppercase tracking-wider text-muted-foreground">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/30">
              {sorted.map((a) => (
                <tr key={a.id} className="hover:bg-muted/30 transition-colors cursor-pointer" onClick={() => openEdit(a)}>
                  <td className="p-4 font-body font-medium text-foreground">{a.bank_name}</td>
                  <td className="p-4 font-body text-muted-foreground">{accountTypeLabels[a.account_type ?? "checking"] ?? a.account_type}</td>
                  <td className="p-4 font-body text-muted-foreground">{a.agency || "—"}</td>
                  <td className="p-4 font-body text-muted-foreground">{a.account_number || "—"}</td>
                  <td className="p-4 font-body text-muted-foreground">{a.pix_key || "—"}</td>
                  <td className="p-4">
                    {a.is_active ? (
                      <span className="text-[10px] font-medium px-2.5 py-1 rounded-full bg-success/10 text-success font-body">Ativa</span>
                    ) : (
                      <span className="text-[10px] font-medium px-2.5 py-1 rounded-full bg-muted text-muted-foreground font-body">Inativa</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-3xl">
          <DialogHeader>
            <DialogTitle className="font-display">{editing ? "Editar Conta" : "Nova Conta Bancária"}</DialogTitle>
          </DialogHeader>
          <form onSubmit={(e) => { e.preventDefault(); saveMutation.mutate(); }} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="sm:col-span-3 space-y-2">
                <Label className="font-body">Banco *</Label>
                <Input value={form.bank_name ?? ""} onChange={(e) => setForm({ ...form, bank_name: e.target.value })} required />
              </div>
              <div className="space-y-2">
                <Label className="font-body">Tipo de Conta</Label>
                <Select value={form.account_type ?? "checking"} onValueChange={(v) => setForm({ ...form, account_type: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="checking">Conta Corrente</SelectItem>
                    <SelectItem value="savings">Conta Poupança</SelectItem>
                    <SelectItem value="salary">Conta Salário</SelectItem>
                    <SelectItem value="payment">Conta Pagamento</SelectItem>
                    <SelectItem value="petty_cash">Caixinha</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label className="font-body">Agência</Label>
                <Input value={form.agency ?? ""} onChange={(e) => setForm({ ...form, agency: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label className="font-body">Nº da Conta com dígito</Label>
                <Input value={form.account_number ?? ""} onChange={(e) => setForm({ ...form, account_number: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label className="font-body">Tipo de Chave PIX</Label>
                <Select value={form.pix_key_type ?? ""} onValueChange={(v) => setForm({ ...form, pix_key_type: v })}>
                  <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="cpf_cnpj">CPF/CNPJ</SelectItem>
                    <SelectItem value="email">E-mail</SelectItem>
                    <SelectItem value="phone">Telefone</SelectItem>
                    <SelectItem value="random">Chave Aleatória</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="sm:col-span-2 space-y-2">
                <Label className="font-body">Chave PIX</Label>
                <Input value={form.pix_key ?? ""} onChange={(e) => setForm({ ...form, pix_key: e.target.value })} />
              </div>
              <div className="sm:col-span-3 space-y-2">
                <Label className="font-body">Observações</Label>
                <Textarea value={form.notes ?? ""} onChange={(e) => setForm({ ...form, notes: e.target.value })} rows={2} />
              </div>
              <div className="flex items-center gap-2">
                <Switch checked={form.is_active ?? true} onCheckedChange={(v) => setForm({ ...form, is_active: v })} />
                <Label className="font-body">Conta ativa</Label>
              </div>
            </div>

            <Separator />

            {/* Access section */}
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <Users size={16} className="text-muted-foreground" />
                <Label className="font-body font-semibold text-sm">Acesso</Label>
              </div>
              <p className="text-xs text-muted-foreground font-body">Selecione os usuários que podem visualizar e editar esta conta.</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-48 overflow-y-auto rounded-lg border border-border/50 p-3">
                {profiles.length === 0 ? (
                  <p className="text-xs text-muted-foreground font-body col-span-2">Nenhum usuário encontrado.</p>
                ) : (
                  profiles.map((p) => (
                    <label
                      key={p.user_id}
                      className={`flex items-center gap-3 p-2 rounded-lg cursor-pointer transition-colors hover:bg-muted/50 ${
                        selectedUserIds.has(p.user_id) ? "bg-primary/5" : ""
                      }`}
                    >
                      <Checkbox
                        checked={selectedUserIds.has(p.user_id)}
                        onCheckedChange={() => toggleUser(p.user_id)}
                      />
                      <Avatar className="h-7 w-7">
                        <AvatarImage src={p.avatar_url ?? undefined} />
                        <AvatarFallback className="text-[10px] bg-primary/10 text-primary">
                          {getInitials(p.full_name)}
                        </AvatarFallback>
                      </Avatar>
                      <div className="min-w-0">
                        <p className="text-sm font-body font-medium text-foreground truncate">{p.full_name}</p>
                        {p.email && <p className="text-[10px] text-muted-foreground font-body truncate">{p.email}</p>}
                      </div>
                    </label>
                  ))
                )}
              </div>
            </div>

            <div className="flex items-center justify-between">
              {editing ? (
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button type="button" variant="ghost" className="font-body text-destructive hover:text-destructive hover:bg-destructive/10">
                      <Trash2 size={14} className="mr-1" /> Excluir Conta
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Remover conta bancária?</AlertDialogTitle>
                      <AlertDialogDescription>Esta ação não pode ser desfeita.</AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Cancelar</AlertDialogCancel>
                      <AlertDialogAction onClick={() => { deleteMutation.mutate(editing.id); }}>Remover</AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              ) : <span />}
              <div className="flex gap-2">
                <Button type="button" variant="outline" onClick={closeDialog} className="font-body">Cancelar</Button>
                <Button type="submit" disabled={saveMutation.isPending} className="font-body">
                  {saveMutation.isPending ? "Salvando..." : "Salvar"}
                </Button>
              </div>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
