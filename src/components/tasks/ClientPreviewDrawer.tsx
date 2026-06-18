import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetFooter,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  ContactLevelBadge,
  type ContactLevel,
} from "@/components/contacts/ContactLevelBadge";
import { User as UserIcon, Mail, Phone, ExternalLink, MapPin } from "lucide-react";

const STAGE_LABEL: Record<string, string> = {
  draft: "Rascunho",
  sent: "Enviada",
  negotiating: "Em negociação",
  confirmed: "Confirmada",
  completed: "Concluída",
  lost: "Perdida",
  canceled: "Cancelada",
  fulfilling: "Em execução",
};

export function ClientPreviewDrawer({
  clientId,
  open,
  onOpenChange,
}: {
  clientId: string | null;
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  const navigate = useNavigate();

  const { data, isLoading } = useQuery({
    queryKey: ["client-preview", clientId],
    enabled: !!clientId && open,
    queryFn: async () => {
      const { data: c } = await supabase
        .from("clients")
        .select("id, full_name, email, phone, city, state")
        .eq("id", clientId!)
        .maybeSingle();
      const { data: contact } = await (supabase as any)
        .from("contacts")
        .select("level")
        .eq("client_id", clientId!)
        .maybeSingle();
      const { data: deals } = await (supabase as any)
        .from("deals")
        .select("id, title, destination, stage, phase, total_value")
        .eq("client_id", clientId!)
        .is("archived_at", null)
        .order("created_at", { ascending: false })
        .limit(10);
      return {
        client: c as any,
        level: ((contact?.level as ContactLevel) ?? "cliente") as ContactLevel,
        deals: (deals ?? []) as any[],
      };
    },
  });

  const c = data?.client;
  const level = data?.level ?? "cliente";
  const deals = data?.deals ?? [];
  const loc = c ? [c.city, c.state].filter(Boolean).join(", ") : "";

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-md flex flex-col p-0">
        <SheetHeader className="px-6 pt-6 pb-3 border-b">
          <SheetTitle className="font-display text-lg flex items-center gap-2">
            <UserIcon size={16} className="text-muted-foreground" />
            Resumo do contato
          </SheetTitle>
        </SheetHeader>

        <ScrollArea className="flex-1">
          <div className="px-6 py-4 space-y-4 font-body text-sm">
            {isLoading || !c ? (
              <PreviewSkeleton />
            ) : (
              <>
                <section className="space-y-2">
                  <div className="text-xs uppercase tracking-wide text-muted-foreground">Nome</div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-medium text-foreground">{c.full_name}</span>
                    <ContactLevelBadge level={level} size="sm" />
                  </div>
                </section>

                <section className="space-y-2">
                  <div className="text-xs uppercase tracking-wide text-muted-foreground">Contato</div>
                  {c.phone && (
                    <div className="flex items-center gap-1.5 text-foreground">
                      <Phone size={12} className="text-muted-foreground" /> {c.phone}
                    </div>
                  )}
                  {c.email && (
                    <div className="flex items-center gap-1.5 text-foreground truncate">
                      <Mail size={12} className="text-muted-foreground" />
                      <span className="truncate">{c.email}</span>
                    </div>
                  )}
                  {loc && (
                    <div className="flex items-center gap-1.5 text-muted-foreground">
                      <MapPin size={12} /> {loc}
                    </div>
                  )}
                  {!c.phone && !c.email && !loc && (
                    <div className="text-xs text-muted-foreground italic">Sem contato registrado.</div>
                  )}
                </section>

                <section className="space-y-2">
                  <div className="text-xs uppercase tracking-wide text-muted-foreground">
                    Deals ({deals.length})
                  </div>
                  {deals.length === 0 ? (
                    <div className="text-xs text-muted-foreground italic">Nenhum deal vinculado.</div>
                  ) : (
                    <ul className="space-y-1.5">
                      {deals.map((d) => (
                        <li
                          key={d.id}
                          className="rounded-md border border-border/60 bg-card px-2.5 py-1.5 text-xs"
                        >
                          <div className="flex items-center justify-between gap-2">
                            <span className="font-medium text-foreground truncate">
                              {d.title || d.destination || "Sem título"}
                            </span>
                            <span className="text-muted-foreground capitalize shrink-0">
                              {STAGE_LABEL[d.stage] ?? String(d.stage ?? "").replace(/_/g, " ")}
                            </span>
                          </div>
                        </li>
                      ))}
                    </ul>
                  )}
                </section>
              </>
            )}
          </div>
        </ScrollArea>

        <SheetFooter className="px-6 py-3 border-t">
          <Button
            className="w-full"
            onClick={() => {
              if (clientId) navigate(`/clients?id=${clientId}`);
            }}
            disabled={!clientId}
          >
            <ExternalLink size={14} className="mr-2" />
            Abrir cliente completo
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}

function PreviewSkeleton() {
  return (
    <div className="space-y-4 animate-pulse">
      <div className="space-y-2">
        <Skeleton className="h-3 w-16" />
        <Skeleton className="h-4 w-48" />
      </div>
      <div className="space-y-2">
        <Skeleton className="h-3 w-16" />
        <Skeleton className="h-4 w-40" />
        <Skeleton className="h-4 w-56" />
      </div>
      <div className="space-y-1.5">
        <Skeleton className="h-8 w-full rounded-md" />
        <Skeleton className="h-8 w-full rounded-md" />
      </div>
    </div>
  );
}
