import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import type { Tables } from "@/integrations/supabase/types";

type Campaign = Tables<"campaigns">;

const statusLabels: Record<string, { label: string; color: string }> = {
  draft: { label: "Rascunho", color: "bg-muted text-muted-foreground" },
  active: { label: "Ativa", color: "bg-success/10 text-success" },
  paused: { label: "Pausada", color: "bg-gold/10 text-gold" },
  completed: { label: "Concluída", color: "bg-soft-blue/10 text-soft-blue" },
};

export default function Campaigns() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Campaign | null>(null);
  const [form, setForm] = useState<Record<string, any>>({});

  const { data: campaigns = [], isLoading } = useQuery({
    queryKey: ["campaigns"],
    queryFn: async () => {
      const { data, error } = await supabase.from("campaigns").select("*").order("created_at", { ascending: false });
      if (error) throw error;
      return data as Campaign[];
    },
  });

  const saveMutation = useMutation({
    mutationFn: async () => {
      const payload = {
        name: form.name,
        channel: form.channel || null,
        status: form.status || "draft",
        template: form.template || null,
        recipients_count: form.recipients_count ? Number(form.recipients_count) : 0,
      };
      if (editing) {
        const { error } = await supabase.from("campaigns").update(payload).eq("id", editing.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("campaigns").insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast({ title: editing ? "Campanha atualizada" : "Campanha criada" });
      queryClient.invalidateQueries({ queryKey: ["campaigns"] });
      closeDialog();
    },
    onError: (err: Error) => toast({ title: "Erro", description: err.message, variant: "destructive" }),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("campaigns").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast({ title: "Campanha removida" });
      queryClient.invalidateQueries({ queryKey: ["campaigns"] });
    },
    onError: (err: Error) => toast({ title: "Erro", description: err.message, variant: "destructive" }),
  });

  const openCreate = () => {
    setEditing(null);
    setForm({ status: "draft", name: "", channel: "", template: "", recipients_count: "" });
    setDialogOpen(true);
  };

  const openEdit = (c: Campaign) => {
    setEditing(c);
    setForm({
      name: c.name, channel: c.channel ?? "", status: c.status ?? "draft",
      template: c.template ?? "", recipients_count: c.recipients_count ?? "",
    });
    setDialogOpen(true);
  };

  const closeDialog = () => { setDialogOpen(false); setEditing(null); };

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      <div className="flex items-end justify-between">
        <div>
          <h1 className="text-3xl font-display font-semibold text-foreground">Campanhas</h1>
          <p className="text-muted-foreground font-body mt-1">{campaigns.length} campanhas</p>
        </div>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button onClick={openCreate} className="font-body">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M12 5v14M5 12h14" /></svg>
              Nova Campanha
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle className="font-display">{editing ? "Editar Campanha" : "Nova Campanha"}</DialogTitle>
            </DialogHeader>
            <form onSubmit={(e) => { e.preventDefault(); saveMutation.mutate(); }} className="space-y-4">
              <div className="space-y-2">
                <Label className="font-body">Nome *</Label>
                <Input value={form.name ?? ""} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
              </div>
              <div className="space-y-2">
                <Label className="font-body">Canal</Label>
                <Select value={form.channel ?? ""} onValueChange={(v) => setForm({ ...form, channel: v })}>
                  <SelectTrigger><SelectValue placeholder="Selecionar canal" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="whatsapp">WhatsApp</SelectItem>
                    <SelectItem value="email">E-mail</SelectItem>
                    <SelectItem value="email_whatsapp">E-mail + WhatsApp</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label className="font-body">Status</Label>
                <Select value={form.status ?? "draft"} onValueChange={(v) => setForm({ ...form, status: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="draft">Rascunho</SelectItem>
                    <SelectItem value="active">Ativa</SelectItem>
                    <SelectItem value="paused">Pausada</SelectItem>
                    <SelectItem value="completed">Concluída</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label className="font-body">Destinatários</Label>
                <Input type="number" value={form.recipients_count ?? ""} onChange={(e) => setForm({ ...form, recipients_count: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label className="font-body">Template / Mensagem</Label>
                <Textarea value={form.template ?? ""} onChange={(e) => setForm({ ...form, template: e.target.value })} rows={4} />
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

      {isLoading ? (
        <div className="p-8 text-center text-muted-foreground font-body">Carregando...</div>
      ) : campaigns.length === 0 ? (
        <div className="p-8 text-center text-muted-foreground font-body">Nenhuma campanha cadastrada.</div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {campaigns.map((c) => {
            const st = statusLabels[c.status ?? "draft"] ?? statusLabels.draft;
            const channelLabel = { whatsapp: "WhatsApp", email: "E-mail", email_whatsapp: "E-mail + WhatsApp" }[c.channel ?? ""] ?? c.channel ?? "—";
            return (
              <div key={c.id} className="glass-card rounded-xl p-5 cursor-pointer hover:shadow-md transition-shadow animate-fade-in" onClick={() => openEdit(c)}>
                <div className="flex items-start justify-between mb-3">
                  <h3 className="text-sm font-semibold font-body text-foreground">{c.name}</h3>
                  <span className={`text-[10px] font-medium px-2.5 py-1 rounded-full font-body ${st.color}`}>{st.label}</span>
                </div>
                <p className="text-xs text-muted-foreground font-body mb-3">{channelLabel}</p>
                <div className="flex items-center justify-between text-xs text-muted-foreground font-body">
                  <span>{c.recipients_count ?? 0} destinatários</span>
                  <Button variant="ghost" size="sm" className="h-6 px-2 text-destructive text-xs" onClick={(e) => { e.stopPropagation(); if (confirm("Remover campanha?")) deleteMutation.mutate(c.id); }}>Excluir</Button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
