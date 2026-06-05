import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Card } from "@/components/ui/card";
import { ArrowLeft, Sparkles, User, Phone, Mail } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { ContactLevelBadge, type ContactLevel } from "@/components/contacts/ContactLevelBadge";

type ContactRow = {
  id: string;
  level: ContactLevel;
  full_name: string;
  phone: string | null;
  email: string | null;
  lead_id: string | null;
};

export default function PromoteContact() {
  const { id: contactId } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { toast } = useToast();

  const [loading, setLoading] = useState(true);
  const [contact, setContact] = useState<ContactRow | null>(null);

  const [destination, setDestination] = useState("");
  const [travelDateStart, setTravelDateStart] = useState("");
  const [travelDateEnd, setTravelDateEnd] = useState("");
  const [flexibleDates, setFlexibleDates] = useState(false);
  const [flexibleDescription, setFlexibleDescription] = useState("");
  const [travelersCount, setTravelersCount] = useState<string>("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!contactId) return;
    let active = true;
    (async () => {
      setLoading(true);
      const { data: c } = await (supabase as any)
        .from("contacts")
        .select("id, level, full_name, phone, email, lead_id")
        .eq("id", contactId)
        .maybeSingle();
      if (!active) return;
      setContact(c ?? null);
      if (c?.lead_id) {
        const { data: lead } = await (supabase as any)
          .from("leads")
          .select("destination, travel_date_start, travel_date_end, flexible_dates, flexible_dates_description, travelers_count")
          .eq("id", c.lead_id)
          .maybeSingle();
        if (active && lead) {
          setDestination(lead.destination ?? "");
          setTravelDateStart(lead.travel_date_start ?? "");
          setTravelDateEnd(lead.travel_date_end ?? "");
          setFlexibleDates(!!lead.flexible_dates);
          setFlexibleDescription(lead.flexible_dates_description ?? "");
          setTravelersCount(lead.travelers_count?.toString() ?? "");
        }
      }
      setLoading(false);
    })();
    return () => {
      active = false;
    };
  }, [contactId]);

  const canSubmit =
    destination.trim().length > 0 &&
    travelersCount.trim().length > 0 &&
    Number(travelersCount) > 0 &&
    (flexibleDates || travelDateStart.length > 0 || travelDateEnd.length > 0);

  const goBack = () => navigate("/clients");

  const handleSubmit = async () => {
    if (!canSubmit || !contact) return;
    setSaving(true);
    try {
      let leadId = contact.lead_id;

      if (!leadId) {
        const { data: newLead, error: leadErr } = await (supabase as any)
          .from("leads")
          .insert({
            full_name: contact.full_name ?? "Contato sem nome",
            phone: contact.phone,
            email: contact.email,
            source: "manual_promotion",
            status: "new",
          })
          .select("id")
          .single();
        if (leadErr) throw leadErr;
        leadId = newLead.id;
        await (supabase as any)
          .from("contacts")
          .update({ lead_id: leadId })
          .eq("id", contact.id);
      }

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
      goBack();
    } catch (e: any) {
      console.error("[PromoteContact] error", e);
      toast({
        title: "Erro ao promover contato",
        description: e?.message ?? "Tente novamente.",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="max-w-3xl mx-auto px-4 sm:px-6 py-6">
        <p className="text-sm text-muted-foreground">Carregando...</p>
      </div>
    );
  }

  if (!contact) {
    return (
      <div className="max-w-3xl mx-auto px-4 sm:px-6 py-6 space-y-4">
        <Button variant="ghost" size="sm" onClick={goBack} className="gap-1.5">
          <ArrowLeft className="h-4 w-4" /> Voltar
        </Button>
        <p className="text-sm text-muted-foreground">Contato não encontrado.</p>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 py-6 space-y-6">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={goBack} className="shrink-0">
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div className="flex-1">
          <h1 className="text-2xl sm:text-3xl font-display font-semibold text-foreground inline-flex items-center gap-2">
            <Sparkles className="h-6 w-6 text-sky-600" />
            Promover para Lead
          </h1>
          <p className="text-sm text-muted-foreground font-body mt-1">
            Preencha as informações mínimas de qualificação para mover este contato para o funil de vendas em <strong>Novos Leads</strong>.
          </p>
        </div>
      </div>

      {/* Resumo do contato */}
      <Card className="p-4">
        <div className="flex flex-wrap items-center gap-x-6 gap-y-2">
          <div className="flex items-center gap-2 min-w-0">
            <User className="h-4 w-4 text-muted-foreground shrink-0" />
            <span className="font-medium font-body text-foreground truncate">{contact.full_name}</span>
            <ContactLevelBadge level={contact.level} size="xs" />
          </div>
          {contact.phone && (
            <div className="flex items-center gap-1.5 text-sm text-muted-foreground font-body">
              <Phone className="h-3.5 w-3.5" />
              <span>{contact.phone}</span>
            </div>
          )}
          {contact.email && (
            <div className="flex items-center gap-1.5 text-sm text-muted-foreground font-body">
              <Mail className="h-3.5 w-3.5" />
              <span>{contact.email}</span>
            </div>
          )}
        </div>
      </Card>

      {/* Formulário */}
      <Card className="p-6 space-y-5">
        <div className="space-y-1.5">
          <Label htmlFor="destination">
            Destino <span className="text-destructive">*</span>
          </Label>
          <Input
            id="destination"
            placeholder="Ex.: Paris, França"
            value={destination}
            onChange={(e) => setDestination(e.target.value.slice(0, 200))}
            maxLength={200}
          />
        </div>

        <div className="space-y-1.5">
          <Label>
            Período da viagem <span className="text-destructive">*</span>
          </Label>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label htmlFor="dstart" className="text-xs text-muted-foreground">Início</Label>
              <Input
                id="dstart"
                type="date"
                value={travelDateStart}
                onChange={(e) => setTravelDateStart(e.target.value)}
                disabled={flexibleDates}
              />
            </div>
            <div className="space-y-1">
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
          <div className="flex items-center gap-2 mt-2">
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
              placeholder='Descreva o período (ex.: julho/2026, férias escolares)'
              value={flexibleDescription}
              onChange={(e) => setFlexibleDescription(e.target.value.slice(0, 200))}
              maxLength={200}
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
            max={99}
            placeholder="Ex.: 2"
            value={travelersCount}
            onChange={(e) => setTravelersCount(e.target.value)}
            className="sm:max-w-xs"
          />
        </div>
      </Card>

      <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-2">
        <Button variant="outline" onClick={goBack} disabled={saving}>
          Cancelar
        </Button>
        <Button onClick={handleSubmit} disabled={!canSubmit || saving} className="gap-1.5">
          <Sparkles className="h-4 w-4" />
          {saving ? "Promovendo..." : "Promover para Lead"}
        </Button>
      </div>
    </div>
  );
}
