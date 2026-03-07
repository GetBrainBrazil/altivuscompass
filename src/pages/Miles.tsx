import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { MetricCard } from "@/components/MetricCard";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { useToast } from "@/hooks/use-toast";
import type { Tables } from "@/integrations/supabase/types";

type MilesProgram = Tables<"miles_programs"> & { client_name?: string };

export default function Miles() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<MilesProgram | null>(null);
  const [form, setForm] = useState<Record<string, any>>({});

  const { data: miles = [], isLoading } = useQuery({
    queryKey: ["miles-programs"],
    queryFn: async () => {
      const { data, error } = await supabase.from("miles_programs").select("*, clients(full_name)").order("expiration_date", { ascending: true });
      if (error) throw error;
      return (data ?? []).map((m: any) => ({ ...m, client_name: m.clients?.full_name ?? "—" }));
    },
  });

  const { data: clients = [] } = useQuery({
    queryKey: ["clients-list"],
    queryFn: async () => {
      const { data, error } = await supabase.from("clients").select("id, full_name").order("full_name");
      if (error) throw error;
      return data ?? [];
    },
  });

  const saveMutation = useMutation({
    mutationFn: async () => {
      const payload = {
        client_id: form.client_id, airline: form.airline, program_name: form.program_name,
        miles_balance: form.miles_balance ? Number(form.miles_balance) : 0,
        expiration_date: form.expiration_date || null, membership_number: form.membership_number || null,
        login_email: form.login_email || null, authorized_to_manage: form.authorized_to_manage ?? false,
      };
      if (editing) {
        const { error } = await supabase.from("miles_programs").update(payload).eq("id", editing.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("miles_programs").insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast({ title: editing ? "Programa atualizado" : "Programa adicionado" });
      queryClient.invalidateQueries({ queryKey: ["miles-programs"] });
      closeDialog();
    },
    onError: (err: Error) => toast({ title: "Erro", description: err.message, variant: "destructive" }),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("miles_programs").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast({ title: "Programa removido" });
      queryClient.invalidateQueries({ queryKey: ["miles-programs"] });
    },
    onError: (err: Error) => toast({ title: "Erro", description: err.message, variant: "destructive" }),
  });

  const openCreate = () => { setEditing(null); setForm({ authorized_to_manage: false }); setDialogOpen(true); };
  const openEdit = (m: MilesProgram) => {
    setEditing(m);
    setForm({
      client_id: m.client_id, airline: m.airline, program_name: m.program_name,
      miles_balance: m.miles_balance ?? 0, expiration_date: m.expiration_date ?? "",
      membership_number: m.membership_number ?? "", login_email: m.login_email ?? "",
      authorized_to_manage: m.authorized_to_manage ?? false,
    });
    setDialogOpen(true);
  };
  const closeDialog = () => { setDialogOpen(false); setEditing(null); };

  const now = new Date();
  const thirtyDays = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
  const expiring = miles.filter(m => m.expiration_date && new Date(m.expiration_date) <= thirtyDays && new Date(m.expiration_date) >= now);
  const totalMiles = miles.reduce((s, m) => s + (m.miles_balance ?? 0), 0);

  return (
    <div className="max-w-7xl mx-auto space-y-4 sm:space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl sm:text-3xl font-display font-semibold text-foreground">Gestão de Milhas</h1>
          <p className="text-muted-foreground font-body mt-1 text-sm">{miles.length} programas cadastrados</p>
        </div>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button onClick={openCreate} className="font-body w-full sm:w-auto">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M12 5v14M5 12h14" /></svg>
              Novo Programa
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="font-display">{editing ? "Editar Programa" : "Novo Programa de Milhas"}</DialogTitle>
            </DialogHeader>
            <form onSubmit={(e) => { e.preventDefault(); saveMutation.mutate(); }} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="sm:col-span-2 space-y-2">
                  <Label className="font-body">Cliente *</Label>
                  <Select value={form.client_id ?? ""} onValueChange={(v) => setForm({ ...form, client_id: v })}>
                    <SelectTrigger><SelectValue placeholder="Selecionar cliente" /></SelectTrigger>
                    <SelectContent>{clients.map((c) => <SelectItem key={c.id} value={c.id}>{c.full_name}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label className="font-body">Companhia aérea *</Label>
                  <Input value={form.airline ?? ""} onChange={(e) => setForm({ ...form, airline: e.target.value })} required />
                </div>
                <div className="space-y-2">
                  <Label className="font-body">Programa *</Label>
                  <Input value={form.program_name ?? ""} onChange={(e) => setForm({ ...form, program_name: e.target.value })} required />
                </div>
                <div className="space-y-2">
                  <Label className="font-body">Saldo de milhas</Label>
                  <Input type="number" value={form.miles_balance ?? ""} onChange={(e) => setForm({ ...form, miles_balance: e.target.value })} />
                </div>
                <div className="space-y-2">
                  <Label className="font-body">Data de expiração</Label>
                  <Input type="date" value={form.expiration_date ?? ""} onChange={(e) => setForm({ ...form, expiration_date: e.target.value })} />
                </div>
                <div className="space-y-2">
                  <Label className="font-body">Nº do cartão/membro</Label>
                  <Input value={form.membership_number ?? ""} onChange={(e) => setForm({ ...form, membership_number: e.target.value })} />
                </div>
                <div className="space-y-2">
                  <Label className="font-body">E-mail de login</Label>
                  <Input value={form.login_email ?? ""} onChange={(e) => setForm({ ...form, login_email: e.target.value })} />
                </div>
                <div className="sm:col-span-2 flex items-center gap-2">
                  <Checkbox checked={form.authorized_to_manage ?? false} onCheckedChange={(v) => setForm({ ...form, authorized_to_manage: !!v })} />
                  <Label className="font-body text-sm">Autorizado a gerenciar</Label>
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

      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 sm:gap-4">
        <MetricCard title="Total de Milhas" value={totalMiles.toLocaleString("pt-BR")} icon={
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.2" className="text-gold"><path d="M22 2L2 8.5l7 3.5 3.5 7L22 2z" /></svg>
        } />
        <MetricCard title="Programas Ativos" value={String(miles.length)} icon={
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.2" className="text-soft-blue"><circle cx="12" cy="12" r="10" /><path d="M12 6v6l4 2" /></svg>
        } />
        <MetricCard title="Expirando em 30d" value={String(expiring.length)} trend={expiring.length > 0 ? { value: "Alerta", positive: false } : undefined} icon={
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.2" className="text-destructive"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" /><line x1="12" y1="9" x2="12" y2="13" /><line x1="12" y1="17" x2="12.01" y2="17" /></svg>
        } />
      </div>

      {expiring.length > 0 && (
        <div className="rounded-xl border border-destructive/20 bg-destructive/5 p-3 sm:p-4 flex items-start gap-3">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-destructive mt-0.5 flex-shrink-0">
            <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" /><line x1="12" y1="9" x2="12" y2="13" /><line x1="12" y1="17" x2="12.01" y2="17" />
          </svg>
          <div>
            <p className="text-sm font-medium font-body text-foreground">{expiring.length} programa(s) com milhas expirando</p>
            <p className="text-xs text-muted-foreground font-body mt-0.5">Revise e tome ação antes que as milhas expirem.</p>
          </div>
        </div>
      )}

      {/* Desktop table */}
      <div className="glass-card rounded-xl overflow-hidden hidden md:block">
        {isLoading ? (
          <div className="p-8 text-center text-muted-foreground font-body">Carregando...</div>
        ) : miles.length === 0 ? (
          <div className="p-8 text-center text-muted-foreground font-body">Nenhum programa de milhas cadastrado.</div>
        ) : (
          <table className="w-full">
            <thead>
              <tr className="border-b border-border/50">
                <th className="text-left p-4 text-[10px] uppercase tracking-widest text-muted-foreground font-body font-medium">Cliente</th>
                <th className="text-left p-4 text-[10px] uppercase tracking-widest text-muted-foreground font-body font-medium">Companhia</th>
                <th className="text-left p-4 text-[10px] uppercase tracking-widest text-muted-foreground font-body font-medium">Programa</th>
                <th className="text-right p-4 text-[10px] uppercase tracking-widest text-muted-foreground font-body font-medium">Saldo</th>
                <th className="text-right p-4 text-[10px] uppercase tracking-widest text-muted-foreground font-body font-medium">Expira</th>
                <th className="text-center p-4 text-[10px] uppercase tracking-widest text-muted-foreground font-body font-medium">Status</th>
                <th className="text-right p-4 text-[10px] uppercase tracking-widest text-muted-foreground font-body font-medium">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/30">
              {miles.map((m) => {
                const isExpiring = m.expiration_date && new Date(m.expiration_date) <= thirtyDays && new Date(m.expiration_date) >= now;
                const isExpired = m.expiration_date && new Date(m.expiration_date) < now;
                return (
                  <tr key={m.id} className="hover:bg-muted/30 transition-colors">
                    <td className="p-4 text-sm font-medium font-body text-foreground">{m.client_name}</td>
                    <td className="p-4 text-sm font-body text-foreground">{m.airline}</td>
                    <td className="p-4 text-sm font-body text-muted-foreground">{m.program_name}</td>
                    <td className="p-4 text-sm font-medium font-body text-foreground text-right">{(m.miles_balance ?? 0).toLocaleString("pt-BR")}</td>
                    <td className="p-4 text-sm font-body text-muted-foreground text-right">{m.expiration_date ?? "—"}</td>
                    <td className="p-4 text-center">
                      <span className={`text-[10px] font-medium px-2.5 py-1 rounded-full font-body ${isExpired ? "bg-muted text-muted-foreground" : isExpiring ? "bg-destructive/10 text-destructive" : "bg-success/10 text-success"}`}>
                        {isExpired ? "Expirado" : isExpiring ? "Expirando" : "Ativo"}
                      </span>
                    </td>
                    <td className="p-4 text-right">
                      <div className="flex gap-1 justify-end">
                        <Button variant="ghost" size="sm" className="font-body" onClick={() => openEdit(m)}>Editar</Button>
                        <Button variant="ghost" size="sm" className="text-destructive font-body" onClick={() => { if (confirm("Remover programa?")) deleteMutation.mutate(m.id); }}>Excluir</Button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* Mobile cards */}
      <div className="md:hidden space-y-3">
        {isLoading ? (
          <div className="p-8 text-center text-muted-foreground font-body">Carregando...</div>
        ) : miles.length === 0 ? (
          <div className="p-8 text-center text-muted-foreground font-body">Nenhum programa de milhas cadastrado.</div>
        ) : (
          miles.map((m) => {
            const isExpiring = m.expiration_date && new Date(m.expiration_date) <= thirtyDays && new Date(m.expiration_date) >= now;
            const isExpired = m.expiration_date && new Date(m.expiration_date) < now;
            return (
              <div key={m.id} className="glass-card rounded-xl p-4 space-y-2">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="text-sm font-medium font-body text-foreground">{m.client_name}</p>
                    <p className="text-xs text-muted-foreground font-body">{m.airline} · {m.program_name}</p>
                  </div>
                  <span className={`text-[10px] font-medium px-2.5 py-1 rounded-full font-body ${isExpired ? "bg-muted text-muted-foreground" : isExpiring ? "bg-destructive/10 text-destructive" : "bg-success/10 text-success"}`}>
                    {isExpired ? "Expirado" : isExpiring ? "Expirando" : "Ativo"}
                  </span>
                </div>
                <div className="flex items-center justify-between text-sm font-body">
                  <span className="text-muted-foreground">Saldo:</span>
                  <span className="font-medium text-foreground">{(m.miles_balance ?? 0).toLocaleString("pt-BR")}</span>
                </div>
                {m.expiration_date && (
                  <div className="flex items-center justify-between text-xs font-body text-muted-foreground">
                    <span>Expira: {m.expiration_date}</span>
                  </div>
                )}
                <div className="flex gap-2 pt-1">
                  <Button variant="outline" size="sm" className="font-body flex-1" onClick={() => openEdit(m)}>Editar</Button>
                  <Button variant="ghost" size="sm" className="text-destructive font-body" onClick={() => { if (confirm("Remover?")) deleteMutation.mutate(m.id); }}>Excluir</Button>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
