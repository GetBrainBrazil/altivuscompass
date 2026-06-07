import { useMemo, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Input } from "@/components/ui/input";
import { CurrencyInput } from "@/components/ui/currency-input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Sparkles, FileText, ShoppingBag, LifeBuoy, UserRound,
  ExternalLink, Plus, Loader2, MapPin, Users, CalendarRange, Wallet,
  Phone, Mail, Save, MessageCircle, Trash2,
} from "lucide-react";
import { COUNTRY_CODES, applyPhoneMask, stripMask } from "@/lib/phone-masks";

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
  const qc = useQueryClient();

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

  // ---- Dados de topo (vindos do WhatsApp / cadastro) ----
  const waName = client?.full_name ?? lead?.full_name ?? contact?.full_name ?? contactName;
  const waPhone = client?.phone ?? lead?.phone ?? contact?.phone ?? phone;
  const waEmail = client?.email ?? lead?.email ?? contact?.email ?? "";

  // ---- Ficha editável ----
  type PhoneEntry = { id?: string; phone: string; description: string; country_code: string; is_primary: boolean };
  type EmailEntry = { id?: string; email: string; description: string; is_primary: boolean };

  const [form, setForm] = useState<Record<string, any>>({});
  const [phones, setPhones] = useState<PhoneEntry[]>([]);
  const [emails, setEmails] = useState<EmailEntry[]>([]);
  const [saving, setSaving] = useState(false);

  // Cliente: carrega phones/emails normalizados
  const { data: clientPhones = [] } = useQuery({
    queryKey: ["side-client-phones", clientId],
    enabled: !!clientId && level === "cliente",
    queryFn: async () => {
      const { data } = await supabase.from("client_phones").select("*").eq("client_id", clientId!);
      return data ?? [];
    },
  });
  const { data: clientEmails = [] } = useQuery({
    queryKey: ["side-client-emails", clientId],
    enabled: !!clientId && level === "cliente",
    queryFn: async () => {
      const { data } = await supabase.from("client_emails").select("*").eq("client_id", clientId!);
      return data ?? [];
    },
  });

  useEffect(() => {
    const src: any = client || lead || contact || {};
    setForm({
      full_name: src.full_name ?? contactName ?? "",
      email: src.email ?? "",
      phone: src.phone ?? phone ?? "",
      destination: (src as any).destination ?? "",
      travelers_count: (src as any).travelers_count ?? "",
      travel_date_start: (src as any).travel_date_start ?? "",
      travel_date_end: (src as any).travel_date_end ?? "",
      budget_estimate: (src as any).budget_estimate ?? "",
      preferences: (src as any).preferences ?? "",
      cpf_cnpj: (src as any).cpf_cnpj ?? "",
      birth_date: (src as any).birth_date ?? "",
      gender: (src as any).gender ?? "",
      nationality: (src as any).nationality ?? "",
      marital_status: (src as any).marital_status ?? "",
      cep: (src as any).cep ?? "",
      country: (src as any).country ?? "",
      state: (src as any).state ?? "",
      city: (src as any).city ?? "",
      neighborhood: (src as any).neighborhood ?? "",
      address_street: (src as any).address_street ?? "",
      address_number: (src as any).address_number ?? "",
      address_complement: (src as any).address_complement ?? "",
      notes: (src as any).notes ?? "",
    });
  }, [client?.id, lead?.id, contact?.id]);

  // Hidrata phones/emails para cliente
  useEffect(() => {
    if (level !== "cliente" || !clientId) return;
    if (clientPhones.length > 0) {
      setPhones(clientPhones.map((p: any) => {
        // Parse "+55 (21) 9..." -> separa dial do número
        const raw = String(p.phone || "");
        const match = raw.match(/^(\+\d{1,4})\s*(.*)$/);
        const dial = match?.[1] || "+55";
        const localRaw = match?.[2] || raw;
        const cc = COUNTRY_CODES.find((c) => c.dial === dial) || COUNTRY_CODES[0];
        return {
          id: p.id,
          phone: applyPhoneMask(stripMask(localRaw), cc.mask),
          description: p.description ?? "",
          country_code: cc.code,
          is_primary: p.is_primary ?? false,
        };
      }));
    } else {
      setPhones(client?.phone ? [{ phone: client.phone, description: "", country_code: "BR", is_primary: true }] : []);
    }
    if (clientEmails.length > 0) {
      setEmails(clientEmails.map((e: any) => ({
        id: e.id, email: e.email, description: e.description ?? "", is_primary: e.is_primary ?? false,
      })));
    } else {
      setEmails(client?.email ? [{ email: client.email, description: "", is_primary: true }] : []);
    }
  }, [clientPhones, clientEmails, clientId, level, client?.phone, client?.email]);


  const set = (k: string, v: any) => setForm((p) => ({ ...p, [k]: v }));

  // ViaCEP autofill (Brasil)
  const handleCepBlur = async () => {
    const cep = String(form.cep || "").replace(/\D/g, "");
    if (cep.length !== 8) return;
    try {
      const r = await fetch(`https://viacep.com.br/ws/${cep}/json/`);
      const data = await r.json();
      if (!data?.erro) {
        setForm((p) => ({
          ...p,
          address_street: data.logradouro || p.address_street,
          neighborhood: data.bairro || p.neighborhood,
          city: data.localidade || p.city,
          state: data.uf || p.state,
          country: p.country || "Brasil",
        }));
      }
    } catch { /* ignore */ }
  };

  const save = async () => {
    setSaving(true);
    try {
      if (level === "cliente" && clientId) {
        // Determina principal/principal email a partir das listas
        const primaryPhone = phones.find((p) => p.is_primary) || phones[0];
        const primaryEmail = emails.find((e) => e.is_primary) || emails[0];
        const primaryPhoneStr = primaryPhone
          ? `${COUNTRY_CODES.find((c) => c.code === primaryPhone.country_code)?.dial || "+55"} ${primaryPhone.phone}`
          : null;
        const payload: any = {
          full_name: form.full_name?.trim() || waName,
          email: primaryEmail?.email || form.email || null,
          phone: primaryPhoneStr || form.phone || null,
          cpf_cnpj: form.cpf_cnpj || null,
          birth_date: form.birth_date || null,
          gender: form.gender || null,
          nationality: form.nationality || null,
          marital_status: form.marital_status || null,
          cep: form.cep || null,
          country: form.country || null,
          state: form.state || null,
          city: form.city || null,
          neighborhood: form.neighborhood || null,
          address_street: form.address_street || null,
          address_number: form.address_number || null,
          address_complement: form.address_complement || null,
          notes: form.notes || null,
        };
        const { error } = await supabase.from("clients").update(payload).eq("id", clientId);
        if (error) throw error;

        // Sync client_phones (replace-all, igual a /clients)
        await supabase.from("client_phones").delete().eq("client_id", clientId);
        const validPhones = phones.filter((p) => p.phone.trim());
        if (validPhones.length > 0) {
          await supabase.from("client_phones").insert(
            validPhones.map((p, _i, arr) => {
              const cc = COUNTRY_CODES.find((c) => c.code === p.country_code);
              const isPrimary = arr.length === 1 ? true : p.is_primary;
              return {
                client_id: clientId!,
                phone: `${cc?.dial || "+55"} ${p.phone}`,
                description: p.description || null,
                is_primary: isPrimary,
              };
            }),
          );
        }
        // Sync client_emails
        await supabase.from("client_emails").delete().eq("client_id", clientId);
        const validEmails = emails.filter((e) => e.email.trim());
        if (validEmails.length > 0) {
          await supabase.from("client_emails").insert(
            validEmails.map((e, _i, arr) => ({
              client_id: clientId!,
              email: e.email,
              description: e.description || null,
              is_primary: arr.length === 1 ? true : e.is_primary,
            })),
          );
        }
        qc.invalidateQueries({ queryKey: ["side-client", clientId] });
        qc.invalidateQueries({ queryKey: ["side-client-phones", clientId] });
        qc.invalidateQueries({ queryKey: ["side-client-emails", clientId] });

      } else if (level === "lead" && leadId) {
        const payload: any = {
          full_name: form.full_name?.trim() || waName,
          email: form.email || null,
          phone: form.phone || null,
          destination: form.destination || null,
          travelers_count: form.travelers_count ? Number(form.travelers_count) : null,
          travel_date_start: form.travel_date_start || null,
          travel_date_end: form.travel_date_end || null,
          budget_estimate: form.budget_estimate ? Number(form.budget_estimate) : null,
          preferences: form.preferences || null,
        };
        const { error } = await supabase.from("leads").update(payload).eq("id", leadId);
        if (error) throw error;
        qc.invalidateQueries({ queryKey: ["side-lead", leadId] });
      } else if (contactId) {
        const payload: any = {
          full_name: form.full_name?.trim() || waName,
          email: form.email || null,
          phone: form.phone || null,
        };
        const { error } = await supabase.from("contacts").update(payload).eq("id", contactId);
        if (error) throw error;
        qc.invalidateQueries({ queryKey: ["side-contact", contactId] });
      }
      toast.success("Dados atualizados");
    } catch (e: any) {
      toast.error(e?.message || "Erro ao salvar");
    } finally {
      setSaving(false);
    }
  };

  return (
    <ScrollArea className="h-full">
      <div className="p-5 space-y-5">
        {/* Cabeçalho */}
        <div className="flex items-center justify-between gap-2">
          <ContactLevelBadge level={level} size="md" />
          <Button size="sm" variant="outline" onClick={openFullPage} className="gap-1.5">
            <ExternalLink className="h-3.5 w-3.5" />
            Abrir ficha completa
          </Button>
        </div>

        {/* ===== TOPO: dados do WhatsApp (read-only) ===== */}
        <section className="rounded-lg border bg-muted/30 p-3 space-y-2.5">
          <div className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
            <MessageCircle className="h-3 w-3" /> Dados do WhatsApp
          </div>
          <div>
            <Label className="text-[11px] uppercase tracking-wide text-muted-foreground">Nome</Label>
            <p className="text-sm font-medium mt-0.5 break-words">{waName || "—"}</p>
          </div>
          <div className="grid grid-cols-1 gap-2.5">
            <div>
              <Label className="text-[11px] uppercase tracking-wide text-muted-foreground flex items-center gap-1">
                <Phone className="h-3 w-3" /> Telefone
              </Label>
              <p className="text-sm mt-0.5">{waPhone || "—"}</p>
            </div>
            <div>
              <Label className="text-[11px] uppercase tracking-wide text-muted-foreground flex items-center gap-1">
                <Mail className="h-3 w-3" /> E-mail
              </Label>
              <p className="text-sm mt-0.5">
                {waEmail || <span className="text-muted-foreground italic">—</span>}
              </p>
            </div>
          </div>
        </section>

        {/* ===== BASE: ficha editável ===== */}
        <section className="space-y-3">
          <div className="flex items-center justify-between">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
              Ficha do {level === "cliente" ? "cliente" : level === "lead" ? "lead" : "contato"}
            </p>
          </div>

          {/* Campos comuns */}
          <FieldGroup>
            <Field label="Nome completo">
              <Input value={form.full_name || ""} onChange={(e) => set("full_name", e.target.value)} className="h-8" />
            </Field>
            {level !== "cliente" && (
              <div className="grid grid-cols-2 gap-2">
                <Field label="Telefone">
                  <Input value={form.phone || ""} onChange={(e) => set("phone", e.target.value)} className="h-8" />
                </Field>
                <Field label="E-mail">
                  <Input type="email" value={form.email || ""} onChange={(e) => set("email", e.target.value)} className="h-8" />
                </Field>
              </div>
            )}
          </FieldGroup>

          {/* Cliente: múltiplos telefones / e-mails (igual à ficha) */}
          {level === "cliente" && (
            <>
              <FieldGroup title="Celulares / Telefones">
                <div className="space-y-1.5">
                  {phones.length === 0 && (
                    <p className="text-[11px] text-muted-foreground italic">Nenhum telefone.</p>
                  )}
                  {phones.map((p, i) => {
                    const cc = COUNTRY_CODES.find((c) => c.code === p.country_code) || COUNTRY_CODES[0];
                    return (
                      <div key={i} className="flex items-center gap-1.5">
                        <Checkbox
                          checked={phones.length === 1 || p.is_primary}
                          onCheckedChange={() => setPhones(phones.map((ph, j) => ({ ...ph, is_primary: j === i })))}
                          className="shrink-0"
                          title="Principal"
                        />
                        <Select
                          value={p.country_code}
                          onValueChange={(v) => {
                            const ncc = COUNTRY_CODES.find((c) => c.code === v) || COUNTRY_CODES[0];
                            setPhones(phones.map((ph, j) => j === i ? { ...ph, country_code: v, phone: applyPhoneMask(stripMask(ph.phone), ncc.mask) } : ph));
                          }}
                        >
                          <SelectTrigger className="h-8 w-[78px] px-2 text-xs"><SelectValue /></SelectTrigger>
                          <SelectContent>
                            {COUNTRY_CODES.map((c) => (
                              <SelectItem key={c.code} value={c.code}>{c.flag} {c.dial}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <Input
                          value={p.phone}
                          onChange={(e) => setPhones(phones.map((ph, j) => j === i ? { ...ph, phone: applyPhoneMask(e.target.value, cc.mask) } : ph))}
                          placeholder={cc.mask.replace(/#/g, "0")}
                          className="h-8 flex-1 min-w-0"
                        />
                        <Input
                          value={p.description}
                          onChange={(e) => setPhones(phones.map((ph, j) => j === i ? { ...ph, description: e.target.value } : ph))}
                          placeholder="Descrição"
                          className="h-8 w-24"
                        />
                        <Button type="button" variant="ghost" size="icon" className="h-7 w-7 text-destructive shrink-0" onClick={() => setPhones(phones.filter((_, j) => j !== i))}>
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    );
                  })}
                  <Button type="button" variant="ghost" size="sm" className="h-7 px-2 text-xs gap-1" onClick={() => setPhones([...phones, { phone: "", description: "", country_code: "BR", is_primary: phones.length === 0 }])}>
                    <Plus className="h-3 w-3" /> Adicionar
                  </Button>
                </div>
              </FieldGroup>

              <FieldGroup title="E-mails">
                <div className="space-y-1.5">
                  {emails.length === 0 && (
                    <p className="text-[11px] text-muted-foreground italic">Nenhum e-mail.</p>
                  )}
                  {emails.map((e, i) => (
                    <div key={i} className="flex items-center gap-1.5">
                      <Checkbox
                        checked={emails.length === 1 || e.is_primary}
                        onCheckedChange={() => setEmails(emails.map((em, j) => ({ ...em, is_primary: j === i })))}
                        className="shrink-0"
                        title="Principal"
                      />
                      <Input
                        type="email"
                        value={e.email}
                        onChange={(ev) => setEmails(emails.map((em, j) => j === i ? { ...em, email: ev.target.value } : em))}
                        placeholder="email@exemplo.com"
                        className="h-8 flex-1 min-w-0"
                      />
                      <Input
                        value={e.description}
                        onChange={(ev) => setEmails(emails.map((em, j) => j === i ? { ...em, description: ev.target.value } : em))}
                        placeholder="Descrição"
                        className="h-8 w-24"
                      />
                      <Button type="button" variant="ghost" size="icon" className="h-7 w-7 text-destructive shrink-0" onClick={() => setEmails(emails.filter((_, j) => j !== i))}>
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  ))}
                  <Button type="button" variant="ghost" size="sm" className="h-7 px-2 text-xs gap-1" onClick={() => setEmails([...emails, { email: "", description: "", is_primary: emails.length === 0 }])}>
                    <Plus className="h-3 w-3" /> Adicionar
                  </Button>
                </div>
              </FieldGroup>
            </>
          )}


          {/* Lead extras */}
          {level === "lead" && (
            <FieldGroup>
              <Field label="Destino">
                <Input value={form.destination || ""} onChange={(e) => set("destination", e.target.value)} className="h-8" />
              </Field>
              <div className="grid grid-cols-2 gap-2">
                <Field label="Nº de viajantes">
                  <Input type="number" min={0} value={form.travelers_count || ""} onChange={(e) => set("travelers_count", e.target.value)} className="h-8" />
                </Field>
                <Field label="Orçamento (R$)">
                  <Input type="number" min={0} step="0.01" value={form.budget_estimate || ""} onChange={(e) => set("budget_estimate", e.target.value)} className="h-8" />
                </Field>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <Field label="Início">
                  <Input type="date" value={form.travel_date_start || ""} onChange={(e) => set("travel_date_start", e.target.value)} className="h-8" />
                </Field>
                <Field label="Fim">
                  <Input type="date" value={form.travel_date_end || ""} onChange={(e) => set("travel_date_end", e.target.value)} className="h-8" />
                </Field>
              </div>
              <Field label="Preferências">
                <Textarea rows={2} value={form.preferences || ""} onChange={(e) => set("preferences", e.target.value)} className="text-sm" />
              </Field>
            </FieldGroup>
          )}

          {/* Cliente extras (mesmos campos da ficha em /clients) */}
          {level === "cliente" && (
            <>
              <FieldGroup title="Dados pessoais">
                <div className="grid grid-cols-2 gap-2">
                  <Field label="CPF/CNPJ">
                    <Input value={form.cpf_cnpj || ""} onChange={(e) => set("cpf_cnpj", e.target.value)} className="h-8" />
                  </Field>
                  <Field label="Nascimento">
                    <Input type="date" value={form.birth_date || ""} onChange={(e) => set("birth_date", e.target.value)} className="h-8" />
                  </Field>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <Field label="Gênero">
                    <Select value={form.gender || ""} onValueChange={(v) => set("gender", v)}>
                      <SelectTrigger className="h-8"><SelectValue placeholder="—" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="masculino">Masculino</SelectItem>
                        <SelectItem value="feminino">Feminino</SelectItem>
                        <SelectItem value="outro">Outro</SelectItem>
                      </SelectContent>
                    </Select>
                  </Field>
                  <Field label="Est. civil">
                    <Select value={form.marital_status || ""} onValueChange={(v) => set("marital_status", v)}>
                      <SelectTrigger className="h-8"><SelectValue placeholder="—" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="solteiro">Solteiro(a)</SelectItem>
                        <SelectItem value="casado">Casado(a)</SelectItem>
                        <SelectItem value="divorciado">Divorciado(a)</SelectItem>
                        <SelectItem value="viuvo">Viúvo(a)</SelectItem>
                        <SelectItem value="uniao_estavel">União estável</SelectItem>
                      </SelectContent>
                    </Select>
                  </Field>
                </div>
                <Field label="Nacionalidade">
                  <Input value={form.nationality || ""} onChange={(e) => set("nationality", e.target.value)} className="h-8" />
                </Field>
              </FieldGroup>

              <FieldGroup title="Endereço">
                <div className="grid grid-cols-2 gap-2">
                  <Field label="CEP">
                    <Input value={form.cep || ""} onChange={(e) => set("cep", e.target.value)} onBlur={handleCepBlur} className="h-8" />
                  </Field>
                  <Field label="País">
                    <Input value={form.country || ""} onChange={(e) => set("country", e.target.value)} className="h-8" />
                  </Field>
                </div>
                <div className="grid grid-cols-[1fr_80px] gap-2">
                  <Field label="Logradouro">
                    <Input value={form.address_street || ""} onChange={(e) => set("address_street", e.target.value)} className="h-8" />
                  </Field>
                  <Field label="Nº">
                    <Input value={form.address_number || ""} onChange={(e) => set("address_number", e.target.value)} className="h-8" />
                  </Field>
                </div>
                <Field label="Complemento">
                  <Input value={form.address_complement || ""} onChange={(e) => set("address_complement", e.target.value)} className="h-8" />
                </Field>
                <Field label="Bairro">
                  <Input value={form.neighborhood || ""} onChange={(e) => set("neighborhood", e.target.value)} className="h-8" />
                </Field>
                <div className="grid grid-cols-[1fr_80px] gap-2">
                  <Field label="Cidade">
                    <Input value={form.city || ""} onChange={(e) => set("city", e.target.value)} className="h-8" />
                  </Field>
                  <Field label="UF">
                    <Input value={form.state || ""} onChange={(e) => set("state", e.target.value)} className="h-8" maxLength={2} />
                  </Field>
                </div>
              </FieldGroup>

              <FieldGroup title="Observações">
                <Textarea rows={3} value={form.notes || ""} onChange={(e) => set("notes", e.target.value)} className="text-sm" />
              </FieldGroup>
            </>
          )}

          <div className="sticky bottom-0 bg-white pt-2 pb-1 -mx-5 px-5 border-t">
            <Button size="sm" onClick={save} disabled={saving} className="w-full gap-1.5">
              {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
              Salvar alterações
            </Button>
          </div>
        </section>
      </div>
    </ScrollArea>
  );
}

function FieldGroup({ title, children }: { title?: string; children: React.ReactNode }) {
  return (
    <div className="space-y-2">
      {title && (
        <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground/80">{title}</p>
      )}
      {children}
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1">
      <Label className="text-[11px] uppercase tracking-wide text-muted-foreground">{label}</Label>
      {children}
    </div>
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
