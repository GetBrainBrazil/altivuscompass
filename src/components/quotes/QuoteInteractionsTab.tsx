import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import { MessageCircle, Phone, Mail, Instagram, Users, MoreHorizontal, Trash2, History, UserCircle2, Plus } from "lucide-react";
import { cn } from "@/lib/utils";

const CHANNEL_OPTIONS = [
  { value: "whatsapp", label: "WhatsApp", Icon: MessageCircle },
  { value: "phone", label: "Telefone", Icon: Phone },
  { value: "email", label: "E-mail", Icon: Mail },
  { value: "instagram", label: "Instagram", Icon: Instagram },
  { value: "in_person", label: "Presencial", Icon: Users },
  { value: "other", label: "Outro", Icon: MoreHorizontal },
];
const CHANNEL_LABEL = CHANNEL_OPTIONS.reduce<Record<string, { label: string; Icon: typeof MessageCircle }>>(
  (acc, c) => ({ ...acc, [c.value]: { label: c.label, Icon: c.Icon } }), {},
);

function nowLocalDateTime(): string {
  const d = new Date();
  d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
  return d.toISOString().slice(0, 16);
}

interface Props {
  quoteId: string | null;
}

export default function QuoteInteractionsTab({ quoteId }: Props) {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [channel, setChannel] = useState<string>("whatsapp");
  const [content, setContent] = useState("");
  const [interactionDate, setInteractionDate] = useState<string>(nowLocalDateTime());
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);

  const { data: interactions = [] } = useQuery({
    queryKey: ["quote-interactions", quoteId],
    queryFn: async () => {
      if (!quoteId) return [];
      const { data, error } = await supabase
        .from("quote_interactions")
        .select("*")
        .eq("quote_id", quoteId)
        .order("interaction_date", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
    enabled: !!quoteId,
  });

  const { data: history = [] } = useQuery({
    queryKey: ["quote-history-merged", quoteId],
    queryFn: async () => {
      if (!quoteId) return [];
      const { data, error } = await supabase
        .from("quote_history")
        .select("*")
        .eq("quote_id", quoteId)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
    enabled: !!quoteId,
  });

  const createMutation = useMutation({
    mutationFn: async () => {
      if (!quoteId) throw new Error("Salve a cotação primeiro.");
      if (!content.trim()) throw new Error("Descreva a interação.");
      let userName: string | null = user?.email ?? null;
      try {
        if (user?.id) {
          const { data: profile } = await supabase
            .from("profiles").select("full_name").eq("user_id", user.id).single();
          if (profile?.full_name) userName = profile.full_name;
        }
      } catch {}
      const isoDate = interactionDate ? new Date(interactionDate).toISOString() : new Date().toISOString();
      const { error } = await supabase.from("quote_interactions").insert({
        quote_id: quoteId,
        user_id: user?.id ?? null,
        user_name: userName,
        interaction_date: isoDate,
        channel,
        content: content.trim(),
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast({ title: "Interação registrada" });
      setContent("");
      setInteractionDate(nowLocalDateTime());
      queryClient.invalidateQueries({ queryKey: ["quote-interactions", quoteId] });
    },
    onError: (e: any) => toast({ title: "Erro", description: e.message, variant: "destructive" }),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("quote_interactions").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast({ title: "Interação removida" });
      setConfirmDelete(null);
      queryClient.invalidateQueries({ queryKey: ["quote-interactions", quoteId] });
    },
    onError: (e: any) => toast({ title: "Erro", description: e.message, variant: "destructive" }),
  });

  type TimelineEntry = {
    key: string;
    kind: "manual" | "auto";
    date: string;
    user_name: string | null;
    user_id: string | null;
    channel?: string | null;
    content: string;
    action?: string | null;
    id: string;
  };

  const merged: TimelineEntry[] = [
    ...interactions.map((i: any) => ({
      key: `i-${i.id}`,
      kind: "manual" as const,
      date: i.interaction_date,
      user_name: i.user_name,
      user_id: i.user_id,
      channel: i.channel,
      content: i.content,
      id: i.id,
    })),
    ...history.map((h: any) => ({
      key: `h-${h.id}`,
      kind: "auto" as const,
      date: h.created_at,
      user_name: h.user_name,
      user_id: h.user_id,
      content: h.description ?? h.action ?? "",
      action: h.action,
      id: h.id,
    })),
  ].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  return (
    <div className="space-y-4">
      {/* New interaction form */}
      <div className="glass-card rounded-lg p-4 space-y-3">
        <div className="flex items-center gap-2">
          <Plus className="w-4 h-4 text-primary" />
          <h3 className="text-sm font-semibold font-body">Nova interação</h3>
        </div>
        {!quoteId && (
          <div className="rounded-md border border-dashed border-border bg-muted/40 px-3 py-2 text-xs text-muted-foreground font-body">
            Salve a cotação primeiro para registrar interações.
          </div>
        )}
        <div className="grid grid-cols-1 sm:grid-cols-12 gap-3">
          <div className="sm:col-span-4 space-y-1">
            <Label className="text-xs font-body">Data e hora</Label>
            <Input
              type="datetime-local"
              className="h-9 text-sm"
              value={interactionDate}
              onChange={(e) => setInteractionDate(e.target.value)}
              disabled={!quoteId}
            />
          </div>
          <div className="sm:col-span-4 space-y-1">
            <Label className="text-xs font-body">Canal</Label>
            <Select value={channel} onValueChange={setChannel} disabled={!quoteId}>
              <SelectTrigger className="h-9 text-sm"><SelectValue /></SelectTrigger>
              <SelectContent>
                {CHANNEL_OPTIONS.map((c) => (
                  <SelectItem key={c.value} value={c.value}>
                    <span className="flex items-center gap-2"><c.Icon className="w-3.5 h-3.5" />{c.label}</span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="sm:col-span-12 space-y-1">
            <Label className="text-xs font-body">Conteúdo</Label>
            <Textarea
              rows={3}
              className="text-sm"
              placeholder="Ex: Mandei proposta revisada, cliente disse que vai pensar."
              value={content}
              onChange={(e) => setContent(e.target.value)}
              disabled={!quoteId}
            />
          </div>
        </div>
        <div className="flex justify-end">
          <Button
            size="sm"
            disabled={!quoteId || !content.trim() || createMutation.isPending}
            onClick={() => createMutation.mutate()}
            className="font-body gap-1.5"
          >
            <Plus className="w-3.5 h-3.5" />
            Registrar interação
          </Button>
        </div>
      </div>

      {/* Timeline */}
      <div className="space-y-2">
        <div className="flex items-center gap-2 px-1">
          <History className="w-4 h-4 text-muted-foreground" />
          <h3 className="text-sm font-semibold font-body">Timeline</h3>
          <span className="text-xs text-muted-foreground font-body ml-auto">{merged.length} {merged.length === 1 ? "registro" : "registros"}</span>
        </div>
        {merged.length === 0 ? (
          <div className="rounded-lg border border-dashed border-border p-6 text-center text-xs text-muted-foreground font-body">
            Nenhuma interação ou evento registrado ainda.
          </div>
        ) : (
          <ol className="space-y-2">
            {merged.map((entry) => {
              const isManual = entry.kind === "manual";
              const channelInfo = entry.channel ? CHANNEL_LABEL[entry.channel] : null;
              const Icon = channelInfo?.Icon ?? (isManual ? UserCircle2 : History);
              const canDelete = isManual && entry.user_id && entry.user_id === user?.id;
              return (
                <li
                  key={entry.key}
                  className={cn(
                    "rounded-lg border p-3 flex gap-3",
                    isManual ? "border-primary/30 bg-primary/5" : "border-border bg-card/50",
                  )}
                >
                  <div className={cn(
                    "shrink-0 w-7 h-7 rounded-full flex items-center justify-center",
                    isManual ? "bg-primary/15 text-primary" : "bg-muted text-muted-foreground",
                  )}>
                    <Icon className="w-3.5 h-3.5" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap mb-1">
                      <span className="text-xs font-medium font-body">{entry.user_name || "Sistema"}</span>
                      <span className="text-[10px] text-muted-foreground font-body">
                        {format(parseISO(entry.date), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                      </span>
                      {channelInfo && (
                        <Badge variant="secondary" className="text-[9px] px-1.5 py-0">{channelInfo.label}</Badge>
                      )}
                      {!isManual && (
                        <Badge variant="outline" className="text-[9px] px-1.5 py-0">automático</Badge>
                      )}
                      {canDelete && (
                        <Button
                          variant="ghost" size="icon" className="h-6 w-6 ml-auto text-destructive hover:text-destructive"
                          onClick={() => setConfirmDelete(entry.id)}
                          aria-label="Remover interação"
                        >
                          <Trash2 className="w-3 h-3" />
                        </Button>
                      )}
                    </div>
                    <p className="text-xs font-body whitespace-pre-wrap break-words">{entry.content}</p>
                  </div>
                </li>
              );
            })}
          </ol>
        )}
      </div>

      <AlertDialog open={!!confirmDelete} onOpenChange={(o) => !o && setConfirmDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remover interação?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta ação não pode ser desfeita. Apenas interações manuais que você criou podem ser removidas.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={() => confirmDelete && deleteMutation.mutate(confirmDelete)}>
              Remover
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
