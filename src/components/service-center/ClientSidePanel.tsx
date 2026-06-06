import { useMemo, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Sparkles, FileText, ShoppingBag, LifeBuoy, UserRound,
  ExternalLink, Plus, Loader2, MapPin, Users, CalendarRange, Wallet,
  Phone, Mail, Save, MessageCircle,
} from "lucide-react";

import { ContactLevelBadge, type ContactLevel } from "@/components/contacts/ContactLevelBadge";
import { toast } from "sonner";

interface LeadSummary {
  destination?: string;
  travelers?: string;
  duration?: string;
  budget?: string;
  notes: string[];
}

interface Props {
  level: ContactLevel;
  contactId?: string | null;
  leadId?: string | null;
  clientId?: string | null;
  contactName: string;
  phone: string;
  summary: LeadSummary;
}

const STAGE_LABELS: Record<string, string> = {
  new: "Nova",
  sent: "Enviada",
  negotiation: "Negociação",
  confirmed: "Confirmada",
  issued: "Emitida",
  completed: "Concluída",
  post_sale: "Pós-venda",
};

const STAGE_BADGE: Record<string, string> = {
  new: "bg-slate-100 text-slate-700",
  sent: "bg-blue-50 text-blue-700",
  negotiation: "bg-amber-50 text-amber-700",
  confirmed: "bg-emerald-50 text-emerald-700",
  issued: "bg-emerald-100 text-emerald-800",
  completed: "bg-emerald-100 text-emerald-800",
  post_sale: "bg-rose-50 text-rose-700",
};

function fmtBRL(n: number | null | undefined) {
  if (n == null) return "—";
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(Number(n));
}
function fmtDate(iso: string | null | undefined) {
  if (!iso) return "—";
  try { return new Date(iso).toLocaleDateString("pt-BR"); } catch { return iso; }
}

// ============ Cliente Tab ============
function ClientTab({ level, contactId, leadId, clientId, contactName, phone }: Props) {
  const navigate = useNavigate();

  // Para Prospect/Lead — busca contact
  const { data: contact } = useQuery({
    queryKey: ["side-contact", contactId],
    enabled: !!contactId && level !== "cliente",
    queryFn: async () => {
      const { data } = await supabase.from("contacts").select("*").eq("id", contactId!).maybeSingle();
      return data;
    },
  });

  // Para Lead — busca lead também
  const { data: lead } = useQuery({
    queryKey: ["side-lead", leadId],
    enabled: !!leadId && level === "lead",
    queryFn: async () => {
      const { data } = await supabase.from("leads").select("*").eq("id", leadId!).maybeSingle();
      return data;
    },
  });

  // Para Cliente — busca client
  const { data: client } = useQuery({
    queryKey: ["side-client", clientId],
    enabled: !!clientId && level === "cliente",
    queryFn: async () => {
      const { data } = await supabase.from("clients").select("*").eq("id", clientId!).maybeSingle();
      return data;
    },
  });

  const openFullPage = () => {
    if (level === "cliente" && clientId) navigate(`/clients?id=${clientId}`);
    else if (level === "lead" && leadId) navigate(`/leads/${leadId}`);
    else if (contactId) navigate(`/contacts?id=${contactId}`);
  };

  return (
    <ScrollArea className="h-full">
      <div className="p-5 space-y-5">
        <div className="flex items-center justify-between gap-2">
          <ContactLevelBadge level={level} size="md" />
          <Button size="sm" variant="outline" onClick={openFullPage} className="gap-1.5">
            <ExternalLink className="h-3.5 w-3.5" />
            Abrir ficha completa
          </Button>
        </div>

        <div className="space-y-3">
          <div>
            <Label className="text-[11px] uppercase tracking-wide text-muted-foreground">Nome</Label>
            <p className="text-sm font-medium mt-0.5">
              {client?.full_name ?? lead?.full_name ?? contact?.full_name ?? contactName}
            </p>
          </div>
          <div className="grid grid-cols-1 gap-3">
            <div>
              <Label className="text-[11px] uppercase tracking-wide text-muted-foreground flex items-center gap-1">
                <Phone className="h-3 w-3" /> Telefone
              </Label>
              <p className="text-sm mt-0.5">{client?.phone ?? lead?.phone ?? contact?.phone ?? phone}</p>
            </div>
            <div>
              <Label className="text-[11px] uppercase tracking-wide text-muted-foreground flex items-center gap-1">
                <Mail className="h-3 w-3" /> E-mail
              </Label>
              <p className="text-sm mt-0.5">
                {client?.email ?? lead?.email ?? contact?.email ?? <span className="text-muted-foreground italic">—</span>}
              </p>
            </div>
          </div>
        </div>

        {level === "lead" && lead && (
          <div className="space-y-3 pt-4 border-t">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Viagem</p>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-[11px] text-muted-foreground flex items-center gap-1"><MapPin className="h-3 w-3" /> Destino</Label>
                <p className="text-sm mt-0.5">{(lead as any).destination ?? "—"}</p>
              </div>
              <div>
                <Label className="text-[11px] text-muted-foreground flex items-center gap-1"><Users className="h-3 w-3" /> Viajantes</Label>
                <p className="text-sm mt-0.5">{(lead as any).travelers_count ?? "—"}</p>
              </div>
              <div>
                <Label className="text-[11px] text-muted-foreground flex items-center gap-1"><CalendarRange className="h-3 w-3" /> Início</Label>
                <p className="text-sm mt-0.5">{fmtDate((lead as any).travel_date_start)}</p>
              </div>
              <div>
                <Label className="text-[11px] text-muted-foreground flex items-center gap-1"><Wallet className="h-3 w-3" /> Orçamento</Label>
                <p className="text-sm mt-0.5">{fmtBRL((lead as any).budget_estimate)}</p>
              </div>
            </div>
          </div>
        )}

        <p className="text-[11px] text-muted-foreground italic pt-2 border-t">
          Edição completa disponível na ficha. Em breve: edição inline aqui mesmo.
        </p>
      </div>
    </ScrollArea>
  );
}

// ============ Cotações Tab ============
function QuotesTab({ clientId, leadId }: { clientId?: string | null; leadId?: string | null }) {
  const navigate = useNavigate();

  const { data: quotes = [], isLoading, refetch } = useQuery({
    queryKey: ["side-quotes", clientId, leadId],
    enabled: !!(clientId || leadId),
    queryFn: async () => {
      let q = supabase
        .from("quotes")
        .select("id, title, stage, total_value, destination, created_at, updated_at")
        .order("updated_at", { ascending: false })
        .limit(50);
      if (clientId && leadId) q = q.or(`client_id.eq.${clientId},lead_id.eq.${leadId}`);
      else if (clientId) q = q.eq("client_id", clientId);
      else if (leadId) q = q.eq("lead_id", leadId);
      const { data, error } = await q;
      if (error) throw error;
      return data ?? [];
    },
  });

  const createQuote = () => {
    if (clientId) navigate(`/quotes?new=1&client=${clientId}`);
    else if (leadId) navigate(`/quotes?new=1&lead=${leadId}`);
    else toast.error("Cadastre o contato como Lead ou Cliente para criar cotação.");
  };

  return (
    <ScrollArea className="h-full">
      <div className="p-5 space-y-3">
        <div className="flex items-center justify-between">
          <p className="text-sm font-medium">{quotes.length} cotação(ões)</p>
          <Button size="sm" onClick={createQuote} className="gap-1.5 h-8">
            <Plus className="h-3.5 w-3.5" /> Nova
          </Button>
        </div>

        {isLoading ? (
          <div className="py-8 flex justify-center"><Loader2 className="h-5 w-5 animate-spin" /></div>
        ) : quotes.length === 0 ? (
          <p className="text-sm text-muted-foreground py-8 text-center">Nenhuma cotação ainda.</p>
        ) : (
          <div className="space-y-2">
            {quotes.map((q: any) => (
              <button
                key={q.id}
                onClick={() => navigate(`/quotes?id=${q.id}`)}
                className="w-full text-left p-3 rounded-lg border hover:bg-muted/40 transition-colors"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <FileText className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                      <span className="text-sm font-medium truncate">
                        {q.title || q.destination || "Sem título"}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 mt-1 flex-wrap">
                      <Badge className={`text-[10px] ${STAGE_BADGE[q.stage] || ""}`} variant="secondary">
                        {STAGE_LABELS[q.stage] || q.stage}
                      </Badge>
                      <span className="text-[11px] text-muted-foreground">
                        {fmtBRL(q.total_value)} · {fmtDate(q.updated_at)}
                      </span>
                    </div>
                  </div>
                  <ExternalLink className="h-3.5 w-3.5 text-muted-foreground shrink-0 mt-1" />
                </div>
              </button>
            ))}
          </div>
        )}
      </div>
    </ScrollArea>
  );
}

// ============ Vendas Tab ============
function SalesTab({ clientId }: { clientId?: string | null }) {
  const navigate = useNavigate();
  const { data: sales = [], isLoading } = useQuery({
    queryKey: ["side-sales", clientId],
    enabled: !!clientId,
    queryFn: async () => {
      const { data } = await supabase
        .from("quotes")
        .select("id, title, stage, total_value, destination, travel_date_start, updated_at")
        .eq("client_id", clientId!)
        .in("stage", ["confirmed", "issued", "completed", "post_sale"])
        .order("updated_at", { ascending: false })
        .limit(50);
      return data ?? [];
    },
  });

  return (
    <ScrollArea className="h-full">
      <div className="p-5 space-y-3">
        <p className="text-sm font-medium">{sales.length} venda(s) confirmada(s)</p>
        {isLoading ? (
          <div className="py-8 flex justify-center"><Loader2 className="h-5 w-5 animate-spin" /></div>
        ) : sales.length === 0 ? (
          <p className="text-sm text-muted-foreground py-8 text-center">Nenhuma venda confirmada.</p>
        ) : (
          <div className="space-y-2">
            {sales.map((s: any) => (
              <button
                key={s.id}
                onClick={() => navigate(`/quotes?id=${s.id}`)}
                className="w-full text-left p-3 rounded-lg border hover:bg-muted/40 transition-colors"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <ShoppingBag className="h-3.5 w-3.5 text-emerald-600 shrink-0" />
                      <span className="text-sm font-medium truncate">
                        {s.title || s.destination || "Venda"}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 mt-1 flex-wrap">
                      <Badge className="bg-emerald-50 text-emerald-700 text-[10px]" variant="secondary">
                        {STAGE_LABELS[s.stage] || s.stage}
                      </Badge>
                      <span className="text-[11px] text-muted-foreground">
                        {fmtBRL(s.total_value)}
                        {s.travel_date_start ? ` · ${fmtDate(s.travel_date_start)}` : ""}
                      </span>
                    </div>
                  </div>
                  <ExternalLink className="h-3.5 w-3.5 text-muted-foreground shrink-0 mt-1" />
                </div>
              </button>
            ))}
          </div>
        )}
      </div>
    </ScrollArea>
  );
}

// ============ Pós-venda Tab ============
function PostSaleTab({ clientId }: { clientId?: string | null }) {
  const navigate = useNavigate();
  const { data: trips = [], isLoading } = useQuery({
    queryKey: ["side-post-sale", clientId],
    enabled: !!clientId,
    queryFn: async () => {
      const { data } = await supabase
        .from("quotes")
        .select("id, title, destination, travel_date_start, travel_date_end, stage")
        .eq("client_id", clientId!)
        .in("stage", ["confirmed", "issued", "completed", "post_sale"])
        .order("travel_date_start", { ascending: false })
        .limit(50);
      return data ?? [];
    },
  });

  return (
    <ScrollArea className="h-full">
      <div className="p-5 space-y-3">
        <p className="text-sm font-medium">{trips.length} viagem(ns)</p>
        {isLoading ? (
          <div className="py-8 flex justify-center"><Loader2 className="h-5 w-5 animate-spin" /></div>
        ) : trips.length === 0 ? (
          <p className="text-sm text-muted-foreground py-8 text-center">Sem viagens em pós-venda.</p>
        ) : (
          <div className="space-y-2">
            {trips.map((t: any) => (
              <button
                key={t.id}
                onClick={() => navigate(`/quotes?id=${t.id}`)}
                className="w-full text-left p-3 rounded-lg border hover:bg-muted/40 transition-colors"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <LifeBuoy className="h-3.5 w-3.5 text-rose-600 shrink-0" />
                      <span className="text-sm font-medium truncate">
                        {t.title || t.destination || "Viagem"}
                      </span>
                    </div>
                    <p className="text-[11px] text-muted-foreground mt-1">
                      {t.travel_date_start ? `${fmtDate(t.travel_date_start)} → ${fmtDate(t.travel_date_end)}` : "Sem datas"}
                    </p>
                  </div>
                  <ExternalLink className="h-3.5 w-3.5 text-muted-foreground shrink-0 mt-1" />
                </div>
              </button>
            ))}
          </div>
        )}
        <p className="text-[11px] text-muted-foreground italic pt-4 border-t">
          Checklist de pós-venda dedicado virá em breve.
        </p>
      </div>
    </ScrollArea>
  );
}

// ============ Resumo IA Tab ============
function SummaryTab({ summary }: { summary: LeadSummary }) {
  return (
    <ScrollArea className="h-full">
      <div className="p-5 space-y-4">
        <div className="space-y-3">
          <SummaryRow icon={MapPin} label="Destino" value={summary.destination} />
          <SummaryRow icon={Users} label="Nº de pessoas" value={summary.travelers} />
          <SummaryRow icon={CalendarRange} label="Duração" value={summary.duration} />
          <SummaryRow icon={Wallet} label="Orçamento" value={summary.budget} />
        </div>
        <div className="pt-3 border-t">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground mb-2 flex items-center gap-1.5">
            <Sparkles className="h-3 w-3" /> Anotações da IA
          </p>
          {summary.notes.length === 0 ? (
            <p className="text-xs text-muted-foreground italic">Sem anotações.</p>
          ) : (
            <ul className="space-y-2">
              {summary.notes.map((n, i) => (
                <li key={i} className="text-xs leading-relaxed bg-muted/40 rounded-lg px-3 py-2 border border-border/40">
                  {n}
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </ScrollArea>
  );
}

function SummaryRow({ icon: Icon, label, value }: { icon: any; label: string; value?: string }) {
  return (
    <div className="space-y-0.5">
      <div className="flex items-center gap-1.5 text-[11px] font-medium text-muted-foreground uppercase tracking-wide">
        <Icon className="h-3 w-3" /> {label}
      </div>
      <p className="text-sm pl-[18px]">
        {value || <span className="text-muted-foreground italic">Não informado</span>}
      </p>
    </div>
  );
}

// ============ Main ============
export function ClientSidePanel(props: Props) {
  const { level, summary } = props;

  const tabs = useMemo(() => {
    const base = [{ value: "client", label: "Cliente", icon: UserRound }];
    if (level === "lead" || level === "cliente") {
      base.push({ value: "quotes", label: "Cotações", icon: FileText });
    }
    if (level === "cliente") {
      base.push({ value: "sales", label: "Vendas", icon: ShoppingBag });
      base.push({ value: "post-sale", label: "Pós-venda", icon: LifeBuoy });
    }
    base.push({ value: "summary", label: "Resumo IA", icon: Sparkles });
    return base;
  }, [level]);

  return (
    <div className="h-full flex flex-col bg-white">
      <Tabs defaultValue="client" className="flex-1 flex flex-col min-h-0">
        <div className="px-3 pt-3 pb-0 border-b">
          <TabsList
            className="grid w-full h-9 bg-muted/60 p-0.5"
            style={{ gridTemplateColumns: `repeat(${tabs.length}, minmax(0, 1fr))` }}
          >
            {tabs.map((t) => (
              <TabsTrigger
                key={t.value}
                value={t.value}
                className="text-[11px] gap-1 px-1"
                title={t.label}
              >
                <t.icon className="h-3 w-3" />
                <span className="hidden xl:inline">{t.label}</span>
              </TabsTrigger>
            ))}
          </TabsList>
        </div>

        <TabsContent value="client" className="flex-1 min-h-0 m-0 data-[state=inactive]:hidden">
          <ClientTab {...props} />
        </TabsContent>
        {(level === "lead" || level === "cliente") && (
          <TabsContent value="quotes" className="flex-1 min-h-0 m-0 data-[state=inactive]:hidden">
            <QuotesTab clientId={props.clientId} leadId={props.leadId} />
          </TabsContent>
        )}
        {level === "cliente" && (
          <>
            <TabsContent value="sales" className="flex-1 min-h-0 m-0 data-[state=inactive]:hidden">
              <SalesTab clientId={props.clientId} />
            </TabsContent>
            <TabsContent value="post-sale" className="flex-1 min-h-0 m-0 data-[state=inactive]:hidden">
              <PostSaleTab clientId={props.clientId} />
            </TabsContent>
          </>
        )}
        <TabsContent value="summary" className="flex-1 min-h-0 m-0 data-[state=inactive]:hidden">
          <SummaryTab summary={summary} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
