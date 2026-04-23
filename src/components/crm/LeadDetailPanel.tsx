import {
  Sheet,
  SheetContent,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import {
  Bot,
  UserCheck,
  MessageCircle,
  FileText,
  ExternalLink,
  CircleDot,
} from "lucide-react";
import type { KanbanCardData } from "@/components/crm/KanbanCard";

type Props = {
  card: KanbanCardData | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

type TimelineEvent = {
  id: string;
  icon: React.ElementType;
  iconClass: string;
  title: string;
  description?: string;
  timestamp: string;
};

function buildTimeline(card: KanbanCardData | null): TimelineEvent[] {
  if (!card) return [];
  const events: TimelineEvent[] = [
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
  return events;
}

export function LeadDetailPanel({ card, open, onOpenChange }: Props) {
  const timeline = buildTimeline(card);

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="w-full sm:max-w-none p-0 flex flex-col gap-0 sm:w-[40vw] sm:min-w-[480px]"
      >
        {/* Header */}
        <div className="px-6 pt-6 pb-4 border-b border-border">
          <SheetTitle className="text-lg font-semibold tracking-tight">
            {card?.clientName ?? "Detalhes do Lead"}
          </SheetTitle>
          <SheetDescription className="mt-1 text-sm">
            {card?.destination ? `${card.destination}` : "Lead sem destino definido"}
            {card?.travelDate ? ` • ${card.travelDate}` : ""}
          </SheetDescription>
          {card?.isAILead && (
            <div className="mt-3">
              <Badge
                variant="secondary"
                className="bg-emerald-50 text-emerald-700 hover:bg-emerald-50 ring-1 ring-inset ring-emerald-100"
              >
                <Bot className="h-3 w-3 mr-1" /> Lead triado pela IA
              </Badge>
            </div>
          )}
        </div>

        {/* Tabs */}
        <Tabs defaultValue="details" className="flex-1 flex flex-col min-h-0">
          <TabsList className="mx-6 mt-4 self-start bg-muted">
            <TabsTrigger value="details">Detalhes da Viagem</TabsTrigger>
            <TabsTrigger value="history">Histórico / Log</TabsTrigger>
          </TabsList>

          {/* Details */}
          <TabsContent value="details" className="flex-1 min-h-0 mt-0">
            <ScrollArea className="h-full">
              <div className="px-6 py-5 space-y-5">
                <Section title="Resumo">
                  <div className="grid grid-cols-2 gap-3">
                    <Field label="Destino" defaultValue={card?.destination ?? ""} />
                    <Field label="Data da viagem" defaultValue={card?.travelDate ?? ""} />
                    <Field
                      label="Orçamento estimado (R$)"
                      defaultValue={card?.estimatedValue?.toString() ?? ""}
                      type="number"
                    />
                    <Field label="Nº de pessoas" defaultValue="" placeholder="Ex.: 2 adultos" />
                  </div>
                </Section>

                <Section title="Aéreo">
                  <div className="grid grid-cols-2 gap-3">
                    <Field label="Origem" placeholder="Ex.: GRU" />
                    <Field label="Destino" placeholder="Ex.: CDG" />
                    <Field label="Ida" type="date" />
                    <Field label="Volta" type="date" />
                  </div>
                  <div className="mt-3">
                    <Field
                      label="Preferências de cia"
                      placeholder="Ex.: Air France, LATAM"
                    />
                  </div>
                </Section>

                <Section title="Hospedagem">
                  <div className="grid grid-cols-2 gap-3">
                    <Field label="Cidade base" placeholder="Ex.: Paris centro" />
                    <Field label="Categoria" placeholder="Ex.: 4–5 estrelas" />
                    <Field label="Check-in" type="date" />
                    <Field label="Check-out" type="date" />
                  </div>
                  <div className="mt-3 space-y-1.5">
                    <Label className="text-xs font-medium text-muted-foreground">
                      Observações
                    </Label>
                    <Textarea
                      rows={3}
                      placeholder="Preferências, restrições, pedidos especiais..."
                    />
                  </div>
                </Section>
              </div>
            </ScrollArea>

            {/* Footer actions */}
            <div className="border-t border-border px-6 py-3 flex items-center justify-end gap-2">
              <Button variant="outline" size="sm" onClick={() => onOpenChange(false)}>
                Cancelar
              </Button>
              <Button size="sm">Salvar alterações</Button>
            </div>
          </TabsContent>

          {/* History */}
          <TabsContent value="history" className="flex-1 min-h-0 mt-0">
            <ScrollArea className="h-full">
              <div className="px-6 py-5">
                {/* Quick actions */}
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

                {/* Timeline */}
                <div className="relative">
                  <div className="absolute left-[15px] top-2 bottom-2 w-px bg-border" />
                  <ul className="space-y-5">
                    {timeline.map((ev) => {
                      const Icon = ev.icon;
                      return (
                        <li key={ev.id} className="relative pl-10">
                          <span
                            className={`absolute left-0 top-0 flex h-8 w-8 items-center justify-center rounded-full ring-1 ring-inset ${ev.iconClass}`}
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
              </div>
            </ScrollArea>
          </TabsContent>
        </Tabs>
      </SheetContent>
    </Sheet>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section>
      <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2.5">
        {title}
      </h4>
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
      <Label className="text-xs font-medium text-muted-foreground">{label}</Label>
      <Input {...props} />
    </div>
  );
}
