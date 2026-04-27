import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Sparkles } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

type Props = {
  /** ID do contact (tabela contacts) */
  contactId: string | null;
  /** ID do lead vinculado (tabela leads). Se ausente, será criado a partir do contact. */
  leadId: string | null;
  /** Nome / telefone vindos do contact, usados se precisarmos criar lead. */
  contactName?: string | null;
  contactPhone?: string | null;
  contactEmail?: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onPromoted?: () => void;
};

export function PromoteToLeadDialog({
  contactId,
  leadId: initialLeadId,
  contactName,
  contactPhone,
  contactEmail,
  open,
  onOpenChange,
  onPromoted,
}: Props) {
  const { toast } = useToast();
  const [destination, setDestination] = useState("");
  const [travelDateStart, setTravelDateStart] = useState("");
  const [travelDateEnd, setTravelDateEnd] = useState("");
  const [flexibleDates, setFlexibleDates] = useState(false);
  const [flexibleDescription, setFlexibleDescription] = useState("");
  const [travelersCount, setTravelersCount] = useState<string>("");
  const [saving, setSaving] = useState(false);

  // Pré-popula com dados existentes do lead, se houver
  useEffect(() => {
    if (!open || !initialLeadId) return;
    (async () => {
      const { data } = await (supabase as any)
        .from("leads")
        .select("destination, travel_date_start, travel_date_end, flexible_dates, flexible_dates_description, travelers_count")
        .eq("id", initialLeadId)
        .maybeSingle();
      if (data) {
        setDestination(data.destination ?? "");
        setTravelDateStart(data.travel_date_start ?? "");
        setTravelDateEnd(data.travel_date_end ?? "");
        setFlexibleDates(!!data.flexible_dates);
        setFlexibleDescription(data.flexible_dates_description ?? "");
        setTravelersCount(data.travelers_count?.toString() ?? "");
      }
    })();
  }, [open, initialLeadId]);

  const canSubmit =
    destination.trim().length > 0 &&
    travelersCount.trim().length > 0 &&
    Number(travelersCount) > 0 &&
    (flexibleDates || travelDateStart.length > 0 || travelDateEnd.length > 0);

  const handleSubmit = async () => {
    if (!canSubmit || !contactId) return;
    setSaving(true);
    try {
      let leadId = initialLeadId;

      // Se o contact ainda não tem lead vinculado, cria um lead novo.
      if (!leadId) {
        const { data: newLead, error: leadErr } = await (supabase as any)
          .from("leads")
          .insert({
            full_name: contactName ?? "Contato sem nome",
            phone: contactPhone,
            email: contactEmail,
            source: "manual_promotion",
            status: "new",
          })
          .select("id")
          .single();
        if (leadErr) throw leadErr;
        leadId = newLead.id;
        // Vincula o contact ao novo lead
        await (supabase as any)
          .from("contacts")
          .update({ lead_id: leadId })
          .eq("id", contactId);
      }

      // Atualiza o lead com os campos de qualificação.
      // O trigger sync_contact_from_lead promoverá o contact para 'lead'
      // automaticamente porque destino + (datas|flexível) + viajantes estarão preenchidos.
      const updates: Record<string, any> = {
        destination: destination.trim(),
        travelers_count: Number(travelersCount),
        flexible_dates: flexibleDates,
        flexible_dates_description: flexibleDates ? flexibleDescription.trim() || null : null,
        travel_date_start: travelDateStart || null,
        travel_date_end: travelDateEnd || null,
      };
      const { error: updErr } = await (supabase as any)
        .from("leads")
        .update(updates)
        .eq("id", leadId);
      if (updErr) throw updErr;

      toast({
        title: "Contato promovido a Lead",
        description: "O lead foi adicionado ao funil de vendas em 'Novos Leads'.",
      });
      onPromoted?.();
      onOpenChange(false);
    } catch (e: any) {
      console.error("[PromoteToLead] error", e);
      toast({
        title: "Erro ao promover contato",
        description: e?.message ?? "Tente novamente.",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-sky-600" />
            Promover para Lead
          </DialogTitle>
          <DialogDescription>
            Preencha as informações mínimas de qualificação para mover este contato
            para o funil de vendas em <strong>Novos Leads</strong>.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="space-y-1.5">
            <Label htmlFor="destination">
              Destino <span className="text-destructive">*</span>
            </Label>
            <Input
              id="destination"
              placeholder="Ex.: Paris, França"
              value={destination}
              onChange={(e) => setDestination(e.target.value)}
            />
          </div>

          <div className="space-y-1.5">
            <Label>
              Período da viagem <span className="text-destructive">*</span>
            </Label>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label htmlFor="dstart" className="text-xs text-muted-foreground">Início</Label>
                <Input
                  id="dstart"
                  type="date"
                  value={travelDateStart}
                  onChange={(e) => setTravelDateStart(e.target.value)}
                  disabled={flexibleDates}
                />
              </div>
              <div>
                <Label htmlFor="dend" className="text-xs text-muted-foreground">Fim</Label>
                <Input
                  id="dend"
                  type="date"
                  value={travelDateEnd}
                  onChange={(e) => setTravelDateEnd(e.target.value)}
                  disabled={flexibleDates}
                />
              </div>
            </div>
            <div className="flex items-center gap-2 mt-1">
              <Checkbox
                id="flex"
                checked={flexibleDates}
                onCheckedChange={(v) => setFlexibleDates(v === true)}
              />
              <Label htmlFor="flex" className="text-sm font-normal cursor-pointer">
                Datas flexíveis (ex.: "em julho", "segundo semestre")
              </Label>
            </div>
            {flexibleDates && (
              <Input
                placeholder="Descreva o período (ex.: julho/2026, férias escolares)"
                value={flexibleDescription}
                onChange={(e) => setFlexibleDescription(e.target.value)}
                className="mt-2"
              />
            )}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="travelers">
              Número de viajantes <span className="text-destructive">*</span>
            </Label>
            <Input
              id="travelers"
              type="number"
              min={1}
              placeholder="Ex.: 2"
              value={travelersCount}
              onChange={(e) => setTravelersCount(e.target.value)}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
            Cancelar
          </Button>
          <Button onClick={handleSubmit} disabled={!canSubmit || saving}>
            {saving ? "Promovendo..." : "Promover para Lead"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
