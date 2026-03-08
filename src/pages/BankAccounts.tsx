import { useState } from "react";
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
import { useToast } from "@/hooks/use-toast";
import { ArrowLeft, Plus, Pencil, Trash2, Building2 } from "lucide-react";
import { Link } from "react-router-dom";

type BankAccount = {
  id: string; bank_name: string; agency: string | null; account_number: string | null;
  account_type: string | null; pix_key: string | null; pix_key_type: string | null;
  holder_name: string | null; holder_document: string | null; is_active: boolean;
  notes: string | null; created_at: string; updated_at: string;
};

const accountTypeLabels: Record<string, string> = {
  checking: "Conta Corrente", savings: "Conta Poupança", salary: "Conta Salário", payment: "Conta Pagamento",
};

const pixKeyTypeLabels: Record<string, string> = {
  cpf: "CPF", cnpj: "CNPJ", email: "E-mail", phone: "Telefone", random: "Chave Aleatória",
};

export default function BankAccounts() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<BankAccount | null>(null);
  const [form, setForm] = useState<Record<string, any>>({});

  const { data: accounts = [], isLoading } = useQuery({
    queryKey: ["bank-accounts"],
    queryFn: async () => {
      const { data, error } = await supabase.from("bank_accounts").select("*").order("bank_name");
      if (error) throw error;
      return data as BankAccount[];
    },
  });

  const saveMutation = useMutation({
    mutationFn: async () => {
      const payload = {
        bank_name: form.bank_name, agency: form.agency || null, account_number: form.account_number || null,
        account_type: form.account_type || "checking", pix_key: form.pix_key || null,
        pix_key_type: form.pix_key_type || null, holder_name: form.holder_name || null,
        holder_document: form.holder_document || null, is_active: form.is_active ?? true, notes: form.notes || null,
      };
      if (editing) {
        const { error } = await supabase.from("bank_accounts").update(payload).eq("id", editing.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("bank_accounts").insert(payload);
        if (error) throw error;
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
    },
    onError: (err: Error) => toast({ title: "Erro", description: err.message, variant: "destructive" }),
  });

  const openCreate = () => {
    setEditing(null);
    setForm({ account_type: "checking", is_active: true });
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

  const closeDialog = () => { setDialogOpen(false); setEditing(null); setForm({}); };

  return (
    <div className="max-w-5xl mx-auto space-y-4 sm:space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-3">
        <div className="flex items-center gap-3">
          <Link to="/finance">
            <Button variant="ghost" size="icon" className="h-8 w-8">
              <ArrowLeft size={18} />
            </Button>
          </Link>
          <div>
            <h1 className="text-2xl sm:text-3xl font-display font-semibold text-foreground">Contas Bancárias</h1>
            <p className="text-muted-foreground font-body mt-1 text-sm">Contas bancárias da empresa.</p>
          </div>
        </div>
        <Button onClick={openCreate} className="font-body text-xs sm:text-sm">
          <Plus size={16} /> Nova Conta
        </Button>
      </div>

      <div className="glass-card rounded-xl">
        <div className="p-4 sm:p-5 border-b border-border/50">
          <h2 className="font-display text-lg font-semibold">Contas Cadastradas</h2>
        </div>
        {isLoading ? (
          <div className="p-8 text-center text-muted-foreground font-body">Carregando...</div>
        ) : accounts.length === 0 ? (
          <div className="p-8 text-center text-muted-foreground font-body">Nenhuma conta bancária cadastrada.</div>
        ) : (
          <div className="divide-y divide-border/30">
            {accounts.map((a) => (
              <div key={a.id} className="p-4 flex items-center gap-4 hover:bg-muted/30 transition-colors">
                <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                  <Building2 size={18} className="text-primary" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-medium font-body text-foreground">{a.bank_name}</p>
                    {!a.is_active && (
                      <span className="text-[10px] px-2 py-0.5 rounded-full bg-muted text-muted-foreground font-body">Inativa</span>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground font-body">
                    {accountTypeLabels[a.account_type ?? "checking"] ?? a.account_type}
                    {a.agency ? ` · Ag: ${a.agency}` : ""}
                    {a.account_number ? ` · Cc: ${a.account_number}` : ""}
                    {a.pix_key ? ` · PIX: ${a.pix_key}` : ""}
                  </p>
                </div>
                <div className="flex items-center gap-1">
                  <Button variant="ghost" size="sm" className="h-8 w-8 p-0" onClick={() => openEdit(a)}>
                    <Pencil size={14} />
                  </Button>
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button variant="ghost" size="sm" className="h-8 w-8 p-0 text-destructive">
                        <Trash2 size={14} />
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Remover conta bancária?</AlertDialogTitle>
                        <AlertDialogDescription>Esta ação não pode ser desfeita.</AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Cancelar</AlertDialogCancel>
                        <AlertDialogAction onClick={() => deleteMutation.mutate(a.id)}>Remover</AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="font-display">{editing ? "Editar Conta" : "Nova Conta Bancária"}</DialogTitle>
          </DialogHeader>
          <form onSubmit={(e) => { e.preventDefault(); saveMutation.mutate(); }} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="sm:col-span-2 space-y-2">
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
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label className="font-body">Agência</Label>
                <Input value={form.agency ?? ""} onChange={(e) => setForm({ ...form, agency: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label className="font-body">Nº da Conta</Label>
                <Input value={form.account_number ?? ""} onChange={(e) => setForm({ ...form, account_number: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label className="font-body">Tipo de Chave PIX</Label>
                <Select value={form.pix_key_type ?? ""} onValueChange={(v) => setForm({ ...form, pix_key_type: v })}>
                  <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="cpf">CPF</SelectItem>
                    <SelectItem value="cnpj">CNPJ</SelectItem>
                    <SelectItem value="email">E-mail</SelectItem>
                    <SelectItem value="phone">Telefone</SelectItem>
                    <SelectItem value="random">Chave Aleatória</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label className="font-body">Chave PIX</Label>
                <Input value={form.pix_key ?? ""} onChange={(e) => setForm({ ...form, pix_key: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label className="font-body">Titular</Label>
                <Input value={form.holder_name ?? ""} onChange={(e) => setForm({ ...form, holder_name: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label className="font-body">CPF/CNPJ do Titular</Label>
                <Input value={form.holder_document ?? ""} onChange={(e) => setForm({ ...form, holder_document: e.target.value })} />
              </div>
              <div className="sm:col-span-2 space-y-2">
                <Label className="font-body">Observações</Label>
                <Textarea value={form.notes ?? ""} onChange={(e) => setForm({ ...form, notes: e.target.value })} rows={2} />
              </div>
              <div className="flex items-center gap-2">
                <Switch checked={form.is_active ?? true} onCheckedChange={(v) => setForm({ ...form, is_active: v })} />
                <Label className="font-body">Conta ativa</Label>
              </div>
            </div>
            <div className="flex gap-2 justify-end">
              <Button type="button" variant="outline" onClick={closeDialog} className="font-body">Cancelar</Button>
              <Button type="submit" disabled={saveMutation.isPending} className="font-body">
                {saveMutation.isPending ? "Salvando..." : "Salvar"}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
