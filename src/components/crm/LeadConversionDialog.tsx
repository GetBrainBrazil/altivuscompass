import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { UserCheck, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

type Props = {
  /** ID puro do lead (sem prefixo "lead-"). Quando null/undefined, o diálogo fica fechado. */
  leadId: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Callback após conversão bem-sucedida. Recebe o id do client criado. */
  onConverted?: (clientId: string) => void;
};

type FormState = {
  full_name: string;
  cpf_cnpj: string;
  email: string;
  phone: string;
  birth_date: string;
  nationality: string;
  // Passaporte
  passport_number: string;
  passport_issue_date: string;
  passport_expiry_date: string;
  passport_nationality: string;
  // Endereço
  cep: string;
  address_street: string;
  address_number: string;
  address_complement: string;
  neighborhood: string;
  city: string;
  state: string;
  country: string;
  // Extras
  travel_preferences: string;
};

const EMPTY: FormState = {
  full_name: "", cpf_cnpj: "", email: "", phone: "", birth_date: "", nationality: "",
  passport_number: "", passport_issue_date: "", passport_expiry_date: "", passport_nationality: "",
  cep: "", address_street: "", address_number: "", address_complement: "",
  neighborhood: "", city: "", state: "", country: "Brasil",
  travel_preferences: "",
};

export function LeadConversionDialog({ leadId, open, onOpenChange, onConverted }: Props) {
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState<FormState>(EMPTY);

  // Carrega dados do lead e pré-preenche o formulário
  useEffect(() => {
    if (!open || !leadId) return;
    let cancelled = false;
    (async () => {
      setLoading(true);
      const { data, error } = await supabase
        .from("leads")
        .select("*")
        .eq("id", leadId)
        .maybeSingle();
      if (cancelled) return;
      setLoading(false);
      if (error || !data) {
        toast.error("Não foi possível carregar os dados do lead.");
        return;
      }
      setForm({
        ...EMPTY,
        full_name: data.full_name ?? "",
        email: data.email ?? "",
        phone: data.phone ?? "",
        travel_preferences: data.preferences ?? "",
      });
    })();
    return () => { cancelled = true; };
  }, [open, leadId]);

  const upd = <K extends keyof FormState>(k: K, v: FormState[K]) =>
    setForm((p) => ({ ...p, [k]: v }));

  // Auto-fill via ViaCEP (Brasil)
  const handleCepBlur = async () => {
    const cep = form.cep.replace(/\D/g, "");
    if (cep.length !== 8) return;
    try {
      const r = await fetch(`https://viacep.com.br/ws/${cep}/json/`);
      const d = await r.json();
      if (d.erro) return;
      setForm((p) => ({
        ...p,
        address_street: d.logradouro || p.address_street,
        neighborhood: d.bairro || p.neighborhood,
        city: d.localidade || p.city,
        state: d.uf || p.state,
        country: "Brasil",
      }));
    } catch {/* ignore */}
  };

  const handleConvert = async () => {
    if (!leadId) return;
    if (!form.full_name.trim()) { toast.error("Nome completo é obrigatório."); return; }
    if (!form.cpf_cnpj.trim()) { toast.error("CPF é obrigatório para conversão."); return; }
    if (!form.email.trim()) { toast.error("E-mail é obrigatório para conversão."); return; }
    if (!form.birth_date) { toast.error("Data de nascimento é obrigatória."); return; }

    setSaving(true);
    try {
      // 1. Cria o cliente
      const { data: client, error: clientErr } = await supabase
        .from("clients")
        .insert({
          full_name: form.full_name.trim(),
          cpf_cnpj: form.cpf_cnpj.trim(),
          email: form.email.trim(),
          phone: form.phone.trim() || null,
          birth_date: form.birth_date || null,
          nationality: form.nationality || null,
          cep: form.cep || null,
          address_street: form.address_street || null,
          address_number: form.address_number || null,
          address_complement: form.address_complement || null,
          neighborhood: form.neighborhood || null,
          city: form.city || null,
          state: form.state || null,
          country: form.country || "Brasil",
          travel_preferences: form.travel_preferences || null,
          passport_number: form.passport_number || null,
          passport_issue_date: form.passport_issue_date || null,
          passport_expiry_date: form.passport_expiry_date || null,
          passport_nationality: form.passport_nationality || null,
          passport_status: form.passport_number ? "valid" : "none",
          is_active: true,
        })
        .select("id")
        .single();
      if (clientErr || !client) throw clientErr ?? new Error("Falha ao criar cliente");

      // 2. Cria registro de passaporte detalhado se informado
      if (form.passport_number) {
        await supabase.from("client_passports").insert({
          client_id: client.id,
          passport_number: form.passport_number,
          issue_date: form.passport_issue_date || null,
          expiry_date: form.passport_expiry_date || null,
          nationality: form.passport_nationality || null,
          status: "valid",
          image_urls: [],
        });
      }

      // 3. Marca lead como convertido
      await supabase
        .from("leads")
        .update({
          converted_client_id: client.id,
          converted_at: new Date().toISOString(),
          status: "converted",
        })
        .eq("id", leadId);

      toast.success("Lead convertido em cliente com sucesso!");
      onConverted?.(client.id);
      onOpenChange(false);
    } catch (e: any) {
      toast.error(e?.message || "Erro ao converter lead.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] p-0 flex flex-col">
        <DialogHeader className="px-6 pt-6 pb-3 border-b">
          <DialogTitle className="flex items-center gap-2 text-lg">
            <UserCheck className="h-5 w-5 text-primary" />
            Converter Lead em Cliente
          </DialogTitle>
          <DialogDescription>
            Complete os dados obrigatórios para criar o cadastro definitivo do cliente.
            Os campos já capturados pela IA vêm preenchidos.
          </DialogDescription>
        </DialogHeader>

        <ScrollArea className="flex-1 min-h-0">
          <div className="px-6 py-5 space-y-6">
            {loading ? (
              <div className="flex items-center justify-center py-10 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 mr-2 animate-spin" /> Carregando dados do lead...
              </div>
            ) : (
              <>
                <Section title="Dados pessoais">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <FieldText label="Nome completo *" value={form.full_name} onChange={(v) => upd("full_name", v)} />
                    <FieldText label="CPF *" value={form.cpf_cnpj} onChange={(v) => upd("cpf_cnpj", v)} placeholder="000.000.000-00" />
                    <FieldText label="E-mail *" type="email" value={form.email} onChange={(v) => upd("email", v)} />
                    <FieldText label="Telefone" value={form.phone} onChange={(v) => upd("phone", v)} />
                    <FieldText label="Data de nascimento *" type="date" value={form.birth_date} onChange={(v) => upd("birth_date", v)} />
                    <FieldText label="Nacionalidade" value={form.nationality} onChange={(v) => upd("nationality", v)} placeholder="Brasileira" />
                  </div>
                </Section>

                <Section title="Passaporte">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <FieldText label="Número do passaporte" value={form.passport_number} onChange={(v) => upd("passport_number", v.toUpperCase())} />
                    <FieldText label="Nacionalidade do passaporte" value={form.passport_nationality} onChange={(v) => upd("passport_nationality", v)} />
                    <FieldText label="Data de emissão" type="date" value={form.passport_issue_date} onChange={(v) => upd("passport_issue_date", v)} />
                    <FieldText label="Data de validade" type="date" value={form.passport_expiry_date} onChange={(v) => upd("passport_expiry_date", v)} />
                  </div>
                </Section>

                <Section title="Endereço">
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <FieldText label="CEP" value={form.cep} onChange={(v) => upd("cep", v)} onBlur={handleCepBlur} placeholder="00000-000" />
                    <div className="md:col-span-2">
                      <FieldText label="Rua / Logradouro" value={form.address_street} onChange={(v) => upd("address_street", v)} />
                    </div>
                    <FieldText label="Número" value={form.address_number} onChange={(v) => upd("address_number", v)} />
                    <FieldText label="Complemento" value={form.address_complement} onChange={(v) => upd("address_complement", v)} />
                    <FieldText label="Bairro" value={form.neighborhood} onChange={(v) => upd("neighborhood", v)} />
                    <FieldText label="Cidade" value={form.city} onChange={(v) => upd("city", v)} />
                    <FieldText label="Estado" value={form.state} onChange={(v) => upd("state", v)} />
                    <FieldText label="País" value={form.country} onChange={(v) => upd("country", v)} />
                  </div>
                </Section>

                <Section title="Preferências de viagem">
                  <Textarea
                    rows={3}
                    value={form.travel_preferences}
                    onChange={(e) => upd("travel_preferences", e.target.value)}
                    placeholder="Preferências capturadas pela IA ou observações relevantes..."
                  />
                </Section>
              </>
            )}
          </div>
        </ScrollArea>

        <DialogFooter className="px-6 py-3 border-t bg-muted/30">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
            Cancelar
          </Button>
          <Button onClick={handleConvert} disabled={saving || loading}>
            {saving ? (<><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Convertendo...</>) : (<><UserCheck className="h-4 w-4 mr-2" /> Converter para Cliente</>)}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section>
      <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">
        {title}
      </h4>
      {children}
    </section>
  );
}

function FieldText({
  label, value, onChange, onBlur, type = "text", placeholder,
}: {
  label: string; value: string; onChange: (v: string) => void;
  onBlur?: () => void; type?: string; placeholder?: string;
}) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs font-medium text-muted-foreground">{label}</Label>
      <Input
        type={type}
        value={value}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
        onBlur={onBlur}
        className="h-9"
      />
    </div>
  );
}
