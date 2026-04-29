import { useEffect, useMemo, useState } from "react";
import { Loader2, PartyPopper, AlertTriangle, UserCheck, Clock, Receipt, MapPin, Calendar, DollarSign, Users, User } from "lucide-react";
import { toast } from "sonner";
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
import { Separator } from "@/components/ui/separator";

type SaleSummary = {
  title: string;
  destination: string | null;
  travelDateStart: string | null;
  travelDateEnd: string | null;
  totalValue: number | null;
  travelersCount: number | null;
  agentName: string | null;
};

const fmtBRL = (v: number | null) =>
  v == null ? "—" : v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

const fmtDate = (iso: string | null) => {
  if (!iso) return null;
  const [y, m, d] = iso.split("-");
  return `${d}/${m}/${y}`;
};

const fmtDateRange = (a: string | null, b: string | null) => {
  const fa = fmtDate(a);
  const fb = fmtDate(b);
  if (fa && fb) return `${fa} → ${fb}`;
  return fa || fb || "—";
};

type Traveler = {
  full_name: string;
  cpf: string;
  birth_date: string;
  passport_number: string;
  passport_expiry: string;
  passport_country: string;
};

const emptyTraveler: Traveler = {
  full_name: "",
  cpf: "",
  birth_date: "",
  passport_number: "",
  passport_expiry: "",
  passport_country: "",
};

export type ClientPromotionResult = {
  clientId: string;
  contactId: string | null;
  needsComplementaryData: boolean;
};

export function ClientPromotionDialog({
  open,
  onOpenChange,
  leadId,
  onPromoted,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  leadId: string | null;
  onPromoted: (result: ClientPromotionResult) => void;
}) {
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [leadName, setLeadName] = useState("");

  // Main client fields
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [address, setAddress] = useState("");
  const [travelers, setTravelers] = useState<Traveler[]>([{ ...emptyTraveler }]);

  // Pre-fill from lead
  useEffect(() => {
    if (!open || !leadId) return;
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const { data: lead } = await supabase
          .from("leads")
          .select("*")
          .eq("id", leadId)
          .maybeSingle();
        if (cancelled || !lead) return;

        setLeadName(lead.full_name ?? "");
        setEmail(lead.email ?? "");
        setPhone(lead.phone ?? "");
        setAddress("");

        // Try to get an existing client (in case already converted previously)
        let existingClient: any = null;
        if (lead.converted_client_id) {
          const { data } = await supabase
            .from("clients")
            .select("*")
            .eq("id", lead.converted_client_id)
            .maybeSingle();
          existingClient = data;
        }

        if (existingClient) {
          setEmail(existingClient.email ?? lead.email ?? "");
          setPhone(existingClient.phone ?? lead.phone ?? "");
          const parts = [
            existingClient.address_street,
            existingClient.address_number,
            existingClient.neighborhood,
            existingClient.city,
            existingClient.state,
          ].filter(Boolean);
          setAddress(parts.join(", "));
          setTravelers([
            {
              full_name: existingClient.full_name ?? lead.full_name ?? "",
              cpf: existingClient.cpf_cnpj ?? "",
              birth_date: existingClient.birth_date ?? "",
              passport_number: existingClient.passport_number ?? "",
              passport_expiry: existingClient.passport_expiry_date ?? "",
              passport_country: existingClient.passport_nationality ?? "",
            },
          ]);
        } else {
          setTravelers([
            {
              ...emptyTraveler,
              full_name: lead.full_name ?? "",
            },
          ]);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [open, leadId]);

  const updTraveler = (idx: number, key: keyof Traveler, val: string) => {
    setTravelers((prev) => prev.map((t, i) => (i === idx ? { ...t, [key]: val } : t)));
  };

  const addTraveler = () => {
    setTravelers((prev) => [...prev, { ...emptyTraveler }]);
  };

  const removeTraveler = (idx: number) => {
    setTravelers((prev) => prev.filter((_, i) => i !== idx));
  };

  const isComplete = useMemo(() => {
    if (!email.trim() || !address.trim()) return false;
    return travelers.every(
      (t) =>
        t.full_name.trim() &&
        t.cpf.trim() &&
        t.birth_date &&
        t.passport_number.trim() &&
        t.passport_expiry &&
        t.passport_country.trim(),
    );
  }, [email, address, travelers]);

  const promote = async (skipped: boolean) => {
    if (!leadId) return;
    setSaving(true);
    try {
      const main = travelers[0] ?? { ...emptyTraveler, full_name: leadName };

      // 1. Resolve / create client record
      const { data: lead } = await supabase
        .from("leads")
        .select("converted_client_id, full_name, email, phone")
        .eq("id", leadId)
        .maybeSingle();

      let clientId = lead?.converted_client_id ?? null;

      const clientPayload: Record<string, any> = {
        full_name: main.full_name?.trim() || lead?.full_name || leadName,
        email: email.trim() || lead?.email || null,
        phone: phone.trim() || lead?.phone || null,
        cpf_cnpj: main.cpf?.trim() || null,
        birth_date: main.birth_date || null,
        passport_number: main.passport_number?.trim() || null,
        passport_expiry_date: main.passport_expiry || null,
        passport_nationality: main.passport_country?.trim() || null,
        passport_status: main.passport_number ? "valid" : "none",
        address_street: address.trim() || null,
        is_active: true,
      };

      if (clientId) {
        await (supabase as any).from("clients").update(clientPayload).eq("id", clientId);
      } else {
        const { data: newClient, error } = await (supabase as any)
          .from("clients")
          .insert(clientPayload)
          .select("id")
          .single();
        if (error || !newClient) throw error ?? new Error("Falha ao criar cliente");
        clientId = newClient.id;

        await supabase
          .from("leads")
          .update({
            converted_client_id: clientId,
            converted_at: new Date().toISOString(),
            status: "converted",
          })
          .eq("id", leadId);
      }

      // 2. Create passport record if filled
      if (main.passport_number?.trim()) {
        await supabase.from("client_passports").insert({
          client_id: clientId,
          passport_number: main.passport_number.trim(),
          expiry_date: main.passport_expiry || null,
          nationality: main.passport_country?.trim() || null,
          status: "valid",
          image_urls: [],
        });
      }

      // 3. Promote contact to "cliente" + flag pending data
      const { data: contact } = await (supabase as any)
        .from("contacts")
        .select("id")
        .eq("lead_id", leadId)
        .maybeSingle();

      let contactId: string | null = contact?.id ?? null;
      const needsFlag = skipped || !isComplete;

      if (contactId) {
        await (supabase as any)
          .from("contacts")
          .update({
            level: "cliente",
            client_id: clientId,
            promoted_to_cliente_at: new Date().toISOString(),
            needs_complementary_data: needsFlag,
          })
          .eq("id", contactId);
      } else {
        const { data: newContact } = await (supabase as any)
          .from("contacts")
          .insert({
            level: "cliente",
            full_name: clientPayload.full_name,
            email: clientPayload.email,
            phone: clientPayload.phone,
            client_id: clientId,
            lead_id: leadId,
            source: "manual",
            promoted_to_cliente_at: new Date().toISOString(),
            needs_complementary_data: needsFlag,
          })
          .select("id")
          .single();
        contactId = newContact?.id ?? null;
      }

      toast.success(
        skipped
          ? "Promovido a Cliente. Lembre-se de completar os dados pendentes."
          : "Cliente promovido com sucesso!",
      );

      onPromoted({
        clientId: clientId!,
        contactId,
        needsComplementaryData: needsFlag,
      });
      onOpenChange(false);
    } catch (e: any) {
      toast.error(e?.message ?? "Erro ao promover lead em cliente.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !saving && onOpenChange(v)}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-xl font-display">
            <PartyPopper className="h-5 w-5 text-amber-500" />
            Parabéns! Venda fechada 🎉
          </DialogTitle>
          <DialogDescription className="font-body">
            <span className="font-medium text-foreground">{leadName || "Este lead"}</span> será
            promovido para Cliente. Preencha os dados complementares para dar continuidade à operação
            da viagem.
          </DialogDescription>
        </DialogHeader>

        {loading ? (
          <div className="flex items-center justify-center py-12 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 mr-2 animate-spin" /> Carregando dados do lead...
          </div>
        ) : (
          <div className="space-y-5 pt-2">
            {/* Contact */}
            <section className="space-y-3">
              <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground font-body">
                Contato
              </h4>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <Field
                  label="E-mail *"
                  type="email"
                  value={email}
                  onChange={setEmail}
                />
                <Field label="Telefone" value={phone} onChange={setPhone} />
              </div>
              <Field
                label="Endereço completo *"
                value={address}
                onChange={setAddress}
                placeholder="Rua, número, bairro, cidade, estado"
              />
            </section>

            <Separator />

            {/* Travelers */}
            <section className="space-y-3">
              <div className="flex items-center justify-between">
                <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground font-body">
                  Viajantes
                </h4>
                <Button type="button" variant="ghost" size="sm" onClick={addTraveler}>
                  + Adicionar viajante
                </Button>
              </div>

              {travelers.map((t, idx) => (
                <div
                  key={idx}
                  className="rounded-lg border border-border bg-muted/20 p-3 space-y-3"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-medium text-muted-foreground font-body">
                      Viajante {idx + 1}
                      {idx === 0 && " (titular)"}
                    </span>
                    {idx > 0 && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="h-7 text-destructive hover:text-destructive"
                        onClick={() => removeTraveler(idx)}
                      >
                        Remover
                      </Button>
                    )}
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <Field
                      label="Nome completo *"
                      value={t.full_name}
                      onChange={(v) => updTraveler(idx, "full_name", v)}
                    />
                    <Field
                      label="CPF *"
                      value={t.cpf}
                      onChange={(v) => updTraveler(idx, "cpf", v)}
                      placeholder="000.000.000-00"
                    />
                    <Field
                      label="Data de nascimento *"
                      type="date"
                      value={t.birth_date}
                      onChange={(v) => updTraveler(idx, "birth_date", v)}
                    />
                    <Field
                      label="Nº do passaporte *"
                      value={t.passport_number}
                      onChange={(v) => updTraveler(idx, "passport_number", v.toUpperCase())}
                    />
                    <Field
                      label="Validade do passaporte *"
                      type="date"
                      value={t.passport_expiry}
                      onChange={(v) => updTraveler(idx, "passport_expiry", v)}
                    />
                    <Field
                      label="País emissor *"
                      value={t.passport_country}
                      onChange={(v) => updTraveler(idx, "passport_country", v)}
                      placeholder="Brasil"
                    />
                  </div>
                </div>
              ))}
            </section>

            {!isComplete && (
              <div className="flex items-start gap-2 rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-xs text-amber-800 font-body">
                <AlertTriangle className="h-3.5 w-3.5 mt-0.5 shrink-0" />
                <span>
                  Há campos pendentes. Você pode salvar mesmo assim — um alerta de{" "}
                  <strong>"Cadastro incompleto"</strong> ficará visível no card e na ficha do cliente
                  até que sejam preenchidos.
                </span>
              </div>
            )}
          </div>
        )}

        <DialogFooter className="gap-2 sm:gap-2 flex-col-reverse sm:flex-row">
          <Button
            variant="outline"
            onClick={() => promote(true)}
            disabled={saving || loading}
            className="font-body"
          >
            <Clock className="h-4 w-4 mr-1.5" />
            Completar depois
          </Button>
          <Button
            onClick={() => promote(false)}
            disabled={saving || loading}
            className="font-body"
          >
            {saving ? (
              <>
                <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />
                Promovendo...
              </>
            ) : (
              <>
                <UserCheck className="h-4 w-4 mr-1.5" />
                Promover a Cliente
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function Field({
  label,
  value,
  onChange,
  type = "text",
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  type?: string;
  placeholder?: string;
}) {
  return (
    <div className="space-y-1">
      <Label className="text-[11px] font-medium text-muted-foreground font-body">{label}</Label>
      <Input
        type={type}
        value={value}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
        className="h-9"
      />
    </div>
  );
}
