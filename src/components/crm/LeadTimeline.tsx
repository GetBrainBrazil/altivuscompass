import { useEffect, useMemo, useState } from "react";
import {
  Phone,
  Mail,
  MessageCircle,
  Users,
  StickyNote,
  Bot,
  UserCheck,
  ArrowRightLeft,
  Pencil,
  FileText,
  Send,
  TrendingUp,
  UserPlus,
  Sparkles,
  CircleDot,
  Loader2,
  ExternalLink,
} from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "react-router-dom";

type ContactEvent = {
  id: string;
  lead_id: string;
  event_type: string;
  title: string;
  description: string | null;
  link: string | null;
  user_id: string | null;
  user_name: string | null;
  metadata: Record<string, unknown> | null;
  is_manual: boolean;
  created_at: string;
};

const MANUAL_TYPES = [
  { value: "manual_call", label: "Ligação", icon: Phone },
  { value: "manual_email", label: "E-mail", icon: Mail },
  { value: "manual_whatsapp", label: "WhatsApp", icon: MessageCircle },
  { value: "manual_meeting", label: "Reunião", icon: Users },
  { value: "manual_note", label: "Nota interna", icon: StickyNote },
] as const;

type EventVisual = {
  icon: React.ComponentType<{ className?: string }>;
  iconClass: string;
};

function getEventVisual(type: string): EventVisual {
  const map: Record<string, EventVisual> = {
    contact_created: { icon: UserPlus, iconClass: "bg-emerald-50 text-emerald-600 ring-emerald-100" },
    name_updated: { icon: Pencil, iconClass: "bg-slate-50 text-slate-600 ring-slate-200" },
    level_promoted: { icon: TrendingUp, iconClass: "bg-amber-50 text-amber-600 ring-amber-100" },
    kanban_moved: { icon: ArrowRightLeft, iconClass: "bg-indigo-50 text-indigo-600 ring-indigo-100" },
    assignee_changed: { icon: UserCheck, iconClass: "bg-purple-50 text-purple-600 ring-purple-100" },
    quote_created: { icon: FileText, iconClass: "bg-blue-50 text-blue-600 ring-blue-100" },
    quote_sent: { icon: Send, iconClass: "bg-blue-50 text-blue-600 ring-blue-100" },
    fields_edited: { icon: Pencil, iconClass: "bg-slate-50 text-slate-600 ring-slate-200" },
    conversation_started: { icon: MessageCircle, iconClass: "bg-emerald-50 text-emerald-600 ring-emerald-100" },
    handoff_ai_to_human: { icon: Sparkles, iconClass: "bg-purple-50 text-purple-600 ring-purple-100" },
    manual_call: { icon: Phone, iconClass: "bg-sky-50 text-sky-600 ring-sky-100" },
    manual_email: { icon: Mail, iconClass: "bg-cyan-50 text-cyan-600 ring-cyan-100" },
    manual_whatsapp: { icon: MessageCircle, iconClass: "bg-emerald-50 text-emerald-600 ring-emerald-100" },
    manual_meeting: { icon: Users, iconClass: "bg-violet-50 text-violet-600 ring-violet-100" },
    manual_note: { icon: StickyNote, iconClass: "bg-amber-50 text-amber-600 ring-amber-100" },
  };
  return map[type] || { icon: Bot, iconClass: "bg-muted text-muted-foreground ring-border" };
}

function formatTimestamp(iso: string): string {
  try {
    return format(new Date(iso), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR });
  } catch {
    return iso;
  }
}

export function LeadTimeline({ leadId }: { leadId: string }) {
  const navigate = useNavigate();
  const [events, setEvents] = useState<ContactEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [type, setType] = useState<string>("manual_note");
  const [description, setDescription] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const load = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("contact_events" as any)
      .select("*")
      .eq("lead_id", leadId)
      .order("created_at", { ascending: false });
    if (!error) setEvents((data ?? []) as unknown as ContactEvent[]);
    setLoading(false);
  };

  useEffect(() => {
    if (!leadId) return;
    load();
    const channel = supabase
      .channel(`contact_events:${leadId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "contact_events", filter: `lead_id=eq.${leadId}` },
        () => load()
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [leadId]);

  const handleSubmit = async () => {
    if (!description.trim()) {
      toast.error("Descreva a atividade.");
      return;
    }
    const meta = MANUAL_TYPES.find((t) => t.value === type);
    setSubmitting(true);
    try {
      const { data: userData } = await supabase.auth.getUser();
      const uid = userData?.user?.id ?? null;
      let userName: string | null = null;
      if (uid) {
        const { data: prof } = await supabase
          .from("profiles")
          .select("full_name, email")
          .eq("user_id", uid)
          .maybeSingle();
        userName = prof?.full_name || prof?.email || null;
      }
      const { error } = await supabase.from("contact_events" as any).insert({
        lead_id: leadId,
        event_type: type,
        title: meta?.label ?? "Atividade",
        description: description.trim(),
        is_manual: true,
        user_id: uid,
        user_name: userName,
      });
      if (error) throw error;
      setDescription("");
      toast.success("Atividade registrada.");
    } catch (err) {
      console.error("[LeadTimeline] insert error:", err);
      toast.error("Não foi possível registrar a atividade.");
    } finally {
      setSubmitting(false);
    }
  };

  const grouped = useMemo(() => events, [events]);

  return (
    <div className="space-y-6">
      {/* Registro manual */}
      <div className="rounded-xl border border-border bg-background p-4">
        <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Registrar atividade
        </Label>
        <div className="mt-3 grid grid-cols-1 sm:grid-cols-[180px_1fr_auto] gap-3 items-start">
          <Select value={type} onValueChange={setType}>
            <SelectTrigger className="h-10">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {MANUAL_TYPES.map((t) => {
                const Icon = t.icon;
                return (
                  <SelectItem key={t.value} value={t.value}>
                    <div className="flex items-center gap-2">
                      <Icon className="h-3.5 w-3.5" />
                      {t.label}
                    </div>
                  </SelectItem>
                );
              })}
            </SelectContent>
          </Select>
          <Textarea
            rows={2}
            placeholder="Descreva a atividade (ex.: Cliente confirmou datas e pediu opções de hotel 5★)"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            className="resize-none"
          />
          <Button onClick={handleSubmit} disabled={submitting} size="sm" className="h-10">
            {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : "Registrar"}
          </Button>
        </div>
      </div>

      {/* Timeline */}
      {loading ? (
        <div className="flex items-center justify-center py-12 text-muted-foreground text-sm">
          <Loader2 className="h-4 w-4 mr-2 animate-spin" /> Carregando timeline...
        </div>
      ) : grouped.length === 0 ? (
        <div className="flex flex-col items-center justify-center text-center py-12 border border-dashed border-border rounded-lg">
          <CircleDot className="h-8 w-8 text-muted-foreground mb-3" />
          <p className="text-sm font-medium text-foreground">Nenhum evento ainda</p>
          <p className="text-xs text-muted-foreground mt-1 max-w-xs">
            Eventos automáticos e manuais aparecerão aqui em ordem cronológica.
          </p>
        </div>
      ) : (
        <div className="relative">
          <div className="absolute left-[15px] top-2 bottom-2 w-px bg-border" />
          <ul className="space-y-5">
            {grouped.map((ev) => {
              const visual = getEventVisual(ev.event_type);
              const Icon = visual.icon;
              return (
                <li key={ev.id} className="relative pl-10">
                  <span
                    className={cn(
                      "absolute left-0 top-0 flex h-8 w-8 items-center justify-center rounded-full ring-1 ring-inset",
                      visual.iconClass
                    )}
                  >
                    <Icon className="h-4 w-4" />
                  </span>
                  <div className="pt-0.5">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-foreground">{ev.title}</p>
                        {ev.description && (
                          <p className="mt-0.5 text-xs text-muted-foreground leading-relaxed whitespace-pre-wrap">
                            {ev.description}
                          </p>
                        )}
                        <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-muted-foreground/80">
                          <span className="flex items-center gap-1">
                            <CircleDot className="h-2.5 w-2.5" />
                            {formatTimestamp(ev.created_at)}
                          </span>
                          {ev.user_name && (
                            <span className="flex items-center gap-1">
                              por <span className="font-medium text-foreground/80">{ev.user_name}</span>
                            </span>
                          )}
                          {ev.is_manual && (
                            <span className="px-1.5 py-0.5 rounded-sm bg-muted text-[10px] uppercase tracking-wider">
                              Manual
                            </span>
                          )}
                        </div>
                      </div>
                      {ev.link && (
                        <Button
                          size="sm"
                          variant="ghost"
                          className="shrink-0 text-xs h-7"
                          onClick={() => navigate(ev.link!)}
                        >
                          <ExternalLink className="h-3 w-3 mr-1" />
                          Abrir
                        </Button>
                      )}
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </div>
  );
}
