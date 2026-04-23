import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import {
  ArrowLeft,
  Bot,
  Check,
  MapPin,
  Calendar as CalendarIcon,
  MessageCircle,
  ExternalLink,
  CircleDot,
  FileText,
  UserCheck,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";
import type { KanbanCardData } from "@/components/crm/KanbanCard";

const FUNNEL_STAGES = [
  { id: "new-leads", title: "Novos Leads (IA)" },
  { id: "qualifying", title: "Em Qualificação" },
  { id: "quote", title: "Cotação" },
  { id: "proposal-sent", title: "Proposta Enviada" },
  { id: "closed", title: "Fechado" },
];

function readCard(id: string): KanbanCardData | null {
  try {
    const raw = sessionStorage.getItem(`crm:lead:${id}`);
    if (raw) return JSON.parse(raw) as KanbanCardData;
  } catch {
    /* ignore */
  }
  return null;
}

export default function LeadDetail() {
  const { id } = useParams<{ id: string }>();
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const stageId = params.get("stage") ?? "new-leads";
  const [card, setCard] = useState<KanbanCardData | null>(() =>
    id ? readCard(id) : null
  );

  useEffect(() => {
    if (!card && id) setCard(readCard(id));
  }, [id, card]);

  const stageIndex = useMemo(
    () => Math.max(0, FUNNEL_STAGES.findIndex((s) => s.id === stageId)),
    [stageId]
  );

  const timeline = useMemo(() => {
    if (!card) return [];
    return [
      {
        id: "in",
        icon: Bot,
        iconClass: "bg-emerald-50 text-emerald-600 ring-emerald-100",
        title: "Lead recebido pela IA (WhatsApp)",
        description: card.aiSummary,
        timestamp: "Hoje, 09:14",
      },
      {
        id: "ai-qualified",
        icon: FileText,
        iconClass: "bg-blue-50 text-blue-600 ring-blue-100",
        title: "IA qualificou a necessidade",
        description: "Destino, datas e perfil identificados automaticamente.",
        timestamp: "Hoje, 09:16",
      },
      {
        id: "handoff",
        icon: UserCheck,
        iconClass: "bg-purple-50 text-purple-600 ring-purple-100",
        title: "Transferido para atendimento humano",
        description: card.agent ? `Atribuído a ${card.agent.name}` : undefined,
        timestamp: "Hoje, 09:22",
      },
    ];
  }, [card]);

  return (
    <div className="flex flex-col min-h-[calc(100vh-0px)] bg-slate-50 dark:bg-slate-950">
      {/* Header */}
      <header className="border-b border-border bg-background">
        <div className="px-6 lg:px-10 pt-6 pb-5">
          <Button
            variant="ghost"
            size="sm"
            className="mb-3 -ml-2 text-muted-foreground hover:text-foreground"
            onClick={() => navigate("/crm")}
          >
            <ArrowLeft className="h-4 w-4 mr-1.5" />
            Voltar
          </Button>

          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="min-w-0">
              <h1 className="text-2xl font-semibold tracking-tight text-foreground">
                {card?.clientName ?? "Lead"}
              </h1>
              <div className="mt-1.5 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-muted-foreground">
                {card?.destination && (
                  <span className="inline-flex items-center gap-1.5">
                    <MapPin className="h-4 w-4" strokeWidth={1.5} />
                    {card.destination}
                  </span>
                )}
                {card?.travelDate && (
                  <span className="inline-flex items-center gap-1.5">
                    <CalendarIcon className="h-4 w-4" strokeWidth={1.5} />
                    {card.travelDate}
                  </span>
                )}
                {card?.isAILead && (
                  <Badge
                    variant="secondary"
                    className="bg-emerald-50 text-emerald-700 hover:bg-emerald-50 ring-1 ring-inset ring-emerald-100"
                  >
                    <Bot className="h-3 w-3 mr-1" /> Lead triado pela IA
                  </Badge>
                )}
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm">
                Cancelar
              </Button>
              <Button size="sm">Salvar alterações</Button>
            </div>
          </div>
        </div>

        {/* Stepper */}
        <div className="px-6 lg:px-10 pb-6">
          <Stepper currentIndex={stageIndex} />
        </div>
      </header>

      {/* Tabs + content */}
      <main className="flex-1 min-h-0">
        <Tabs defaultValue="main" className="flex flex-col">
          <div className="border-b border-border bg-background sticky top-0 z-10">
            <div className="px-6 lg:px-10">
              <TabsList className="h-11 bg-transparent p-0 gap-1 rounded-none justify-start">
                {[
                  { v: "main", l: "Principal" },
                  { v: "flights", l: "Voos" },
                  { v: "hotels", l: "Hospedagem" },
                  { v: "history", l: "Histórico" },
                ].map((t) => (
                  <TabsTrigger
                    key={t.v}
                    value={t.v}
                    className={cn(
                      "relative h-11 px-4 rounded-none bg-transparent text-sm",
                      "data-[state=active]:bg-transparent data-[state=active]:shadow-none",
                      "data-[state=active]:text-primary",
                      "data-[state=active]:after:absolute data-[state=active]:after:left-0 data-[state=active]:after:right-0 data-[state=active]:after:-bottom-px data-[state=active]:after:h-0.5 data-[state=active]:after:bg-primary",
                      "text-muted-foreground hover:text-foreground"
                    )}
                  >
                    {t.l}
                  </TabsTrigger>
                ))}
              </TabsList>
            </div>
          </div>

          <div className="px-6 lg:px-10 py-8">
            <div className="max-w-5xl mx-auto">
              <TabsContent value="main" className="mt-0 space-y-8">
                <Section title="Resumo">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                    <Field label="Nome do cliente" defaultValue={card?.clientName ?? ""} />
                    <Field label="Destino" defaultValue={card?.destination ?? ""} />
                    <Field label="Data da viagem" defaultValue={card?.travelDate ?? ""} />
                    <Field
                      label="Orçamento estimado (R$)"
                      type="number"
                      defaultValue={card?.estimatedValue?.toString() ?? ""}
                    />
                    <Field label="Nº de pessoas" placeholder="Ex.: 2 adultos" />
                    <Field
                      label="Atendente responsável"
                      defaultValue={card?.agent?.name ?? ""}
                    />
                  </div>
                </Section>

                <Section title="Observações">
                  <Textarea
                    rows={5}
                    placeholder="Preferências, restrições, pedidos especiais..."
                  />
                </Section>
              </TabsContent>

              <TabsContent value="flights" className="mt-0 space-y-8">
                <Section title="Aéreo">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                    <Field label="Origem" placeholder="Ex.: GRU" />
                    <Field label="Destino" placeholder="Ex.: CDG" />
                    <Field label="Ida" type="date" />
                    <Field label="Volta" type="date" />
                    <Field
                      label="Preferências de cia"
                      placeholder="Ex.: Air France, LATAM"
                    />
                    <Field label="Classe" placeholder="Econômica, Executiva..." />
                  </div>
                </Section>
              </TabsContent>

              <TabsContent value="hotels" className="mt-0 space-y-8">
                <Section title="Hospedagem">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                    <Field label="Cidade base" placeholder="Ex.: Paris centro" />
                    <Field label="Categoria" placeholder="Ex.: 4–5 estrelas" />
                    <Field label="Check-in" type="date" />
                    <Field label="Check-out" type="date" />
                  </div>
                  <div className="mt-5">
                    <Label className="text-xs font-medium text-muted-foreground">
                      Observações
                    </Label>
                    <Textarea
                      className="mt-1.5"
                      rows={4}
                      placeholder="Preferências de quarto, café da manhã, etc."
                    />
                  </div>
                </Section>
              </TabsContent>

              <TabsContent value="history" className="mt-0">
                <div className="flex flex-wrap gap-2 mb-6">
                  <Button size="sm" className="bg-emerald-600 hover:bg-emerald-700 text-white">
                    <MessageCircle className="h-4 w-4 mr-1.5" />
                    Abrir Chat no WhatsApp
                  </Button>
                  <Button size="sm" variant="outline">
                    <ExternalLink className="h-4 w-4 mr-1.5" />
                    Ver conversa completa
                  </Button>
                </div>

                <div className="relative">
                  <div className="absolute left-[15px] top-2 bottom-2 w-px bg-border" />
                  <ul className="space-y-5">
                    {timeline.map((ev) => {
                      const Icon = ev.icon;
                      return (
                        <li key={ev.id} className="relative pl-10">
                          <span
                            className={cn(
                              "absolute left-0 top-0 flex h-8 w-8 items-center justify-center rounded-full ring-1 ring-inset",
                              ev.iconClass
                            )}
                          >
                            <Icon className="h-4 w-4" />
                          </span>
                          <div className="pt-0.5">
                            <p className="text-sm font-medium text-foreground">
                              {ev.title}
                            </p>
                            {ev.description && (
                              <p className="mt-0.5 text-xs text-muted-foreground leading-relaxed">
                                {ev.description}
                              </p>
                            )}
                            <p className="mt-1 text-[11px] text-muted-foreground/80 flex items-center gap-1">
                              <CircleDot className="h-2.5 w-2.5" />
                              {ev.timestamp}
                            </p>
                          </div>
                        </li>
                      );
                    })}
                  </ul>
                </div>
              </TabsContent>
            </div>
          </div>
        </Tabs>
      </main>
    </div>
  );
}

function Stepper({ currentIndex }: { currentIndex: number }) {
  return (
    <ol className="flex items-center w-full">
      {FUNNEL_STAGES.map((stage, idx) => {
        const isComplete = idx < currentIndex;
        const isCurrent = idx === currentIndex;
        const isLast = idx === FUNNEL_STAGES.length - 1;

        return (
          <li
            key={stage.id}
            className={cn("flex items-center", !isLast && "flex-1")}
          >
            <div className="flex flex-col items-center text-center min-w-0">
              <span
                className={cn(
                  "flex h-8 w-8 items-center justify-center rounded-full text-xs font-semibold transition-colors",
                  isComplete && "bg-primary text-primary-foreground",
                  isCurrent &&
                    "bg-primary text-primary-foreground ring-4 ring-primary/15",
                  !isComplete && !isCurrent && "bg-muted text-muted-foreground"
                )}
              >
                {isComplete ? <Check className="h-4 w-4" /> : idx + 1}
              </span>
              <span
                className={cn(
                  "mt-2 text-xs font-medium tracking-tight whitespace-nowrap",
                  isCurrent ? "text-foreground" : "text-muted-foreground"
                )}
              >
                {stage.title}
              </span>
            </div>

            {!isLast && (
              <div
                className={cn(
                  "flex-1 h-px mx-3 -mt-6",
                  idx < currentIndex ? "bg-primary" : "bg-border"
                )}
              />
            )}
          </li>
        );
      })}
    </ol>
  );
}

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section>
      <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-4">
        {title}
      </h2>
      {children}
    </section>
  );
}

function Field({
  label,
  ...props
}: React.InputHTMLAttributes<HTMLInputElement> & { label: string }) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs font-medium text-muted-foreground">
        {label}
      </Label>
      <Input className="h-10" {...props} />
    </div>
  );
}
