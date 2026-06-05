import { useState, useMemo, useEffect } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import { ArrowLeft, Plus, Repeat, Layers, Upload, X, FileText } from "lucide-react";
import { cn } from "@/lib/utils";
import { COMPANY_OPTIONS, DEFAULT_COMPANY, type CompanyBrand } from "@/lib/company";

type TxType = "payable" | "receivable";

const tourismCategories = [
  "Passagens Aéreas", "Hospedagem", "Transporte/Transfer", "Seguro Viagem",
  "Experiências/Passeios", "Cruzeiro", "Comissão", "Custo Operacional", "Outros",
];

const costCenters = [
  "Operacional", "Comercial", "Marketing", "Administrativo", "Financeiro", "Outros",
];

const recurrencePeriods = [
  { value: "weekly", label: "Semanal" },
  { value: "monthly", label: "Mensal" },
  { value: "quarterly", label: "Trimestral" },
  { value: "biannual", label: "Semestral" },
  { value: "yearly", label: "Anual" },
];

const installmentIntervals = [
  { value: "weekly", label: "Semanal" },
  { value: "biweekly", label: "Quinzenal" },
  { value: "monthly", label: "Mensal" },
  { value: "bimonthly", label: "Bimestral" },
];

const paymentMethods = [
  "Pix", "Boleto", "Cartão de Crédito", "Cartão de Débito",
  "Transferência", "Dinheiro", "Outros",
];

const brl = (v: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v || 0);

const todayStr = () => new Date().toISOString().slice(0, 10);

const emptyForm = {
  type: "payable" as TxType,
  description: "",
  category: "",
  cost_center: "",
  cost_center_split: false,
  client_id: "",
  supplier_id: "",
  competence_date: todayStr(),
  due_date: todayStr(),
  bank_account_id: "",
  payment_method: "",
  base_amount: "",
  installments_enabled: false,
  installments_count: "2",
  installments_interval: "monthly",
  recurrence_enabled: false,
  recurrence_every: "1",
  recurrence_period: "monthly",
  recurrence_until: "",
  observations: "",
  company: DEFAULT_COMPANY as CompanyBrand,
};

export default function PayableReceivableForm() {
  const navigate = useNavigate();
  const { id: editingId } = useParams<{ id?: string }>();
  const [searchParams] = useSearchParams();
  const initialType = (searchParams.get("type") as TxType) || "payable";
  const { toast } = useToast();
  const qc = useQueryClient();

  const [form, setForm] = useState<typeof emptyForm>({ ...emptyForm, type: initialType });
  const [attachments, setAttachments] = useState<File[]>([]);

  const isReceivable = form.type === "receivable";

  // ----- data -----
  const { data: clients = [] } = useQuery({
    queryKey: ["finance-clients-only"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("clients").select("id, full_name").eq("is_active", true).order("full_name");
      if (error) throw error;
      return data ?? [];
    },
  });

  const { data: suppliers = [] } = useQuery({
    queryKey: ["finance-suppliers"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("suppliers").select("id, name, trade_name").eq("is_active", true).order("name");
      if (error) throw error;
      return data ?? [];
    },
  });

  const { data: bankAccounts = [] } = useQuery({
    queryKey: ["finance-banks"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("bank_accounts").select("id, bank_name").eq("is_active", true);
      if (error) throw error;
      return data ?? [];
    },
  });

  // ----- load existing on edit -----
  const { data: existing } = useQuery({
    queryKey: ["finance-tx", editingId],
    enabled: !!editingId,
    queryFn: async () => {
      const { data, error } = await (supabase.from("financial_transactions") as any)
        .select("*").eq("id", editingId).single();
      if (error) throw error;
      return data;
    },
  });

  useEffect(() => {
    if (!existing) return;
    setForm((prev) => ({
      ...prev,
      type: existing.type,
      description: existing.description ?? "",
      category: existing.category ?? "",
      cost_center: existing.cost_center ?? "",
      client_id: existing.client_id ?? "",
      supplier_id: existing.supplier_id ?? "",
      competence_date: existing.competence_date ?? existing.date ?? todayStr(),
      due_date: existing.due_date ?? todayStr(),
      bank_account_id: existing.bank_account_id ?? "",
      payment_method: existing.payment_method ?? "",
      base_amount: String(existing.base_amount ?? existing.amount ?? ""),
      recurrence_enabled: !!existing.recurrence_type && existing.recurrence_type !== "none",
      recurrence_period: existing.recurrence_type && existing.recurrence_type !== "none" ? existing.recurrence_type : "monthly",
      observations: existing.observations ?? "",
      company: (existing.company as CompanyBrand) ?? DEFAULT_COMPANY,
    }));
  }, [existing]);

  const clientsMap = useMemo(
    () => Object.fromEntries(clients.map((c: any) => [c.id, c.full_name])), [clients]);
  const suppliersMap = useMemo(
    () => Object.fromEntries(suppliers.map((s: any) => [s.id, s.trade_name || s.name])), [suppliers]);

  const baseAmountNum = parseFloat(form.base_amount || "0");

  // ----- mutation -----
  const saveMutation = useMutation({
    mutationFn: async () => {
      const baseAmount = baseAmountNum;

      const rowBase = {
        type: form.type,
        description: form.description,
        category: form.category || null,
        cost_center: form.cost_center || null,
        client_id: form.client_id || null,
        supplier_id: form.supplier_id || null,
        competence_date: form.competence_date || null,
        bank_account_id: form.bank_account_id || null,
        payment_method: form.payment_method || null,
        base_amount: baseAmount,
        amount: baseAmount,
        date: form.competence_date || todayStr(),
        observations: form.observations || null,
        recurrence_type: form.recurrence_enabled ? form.recurrence_period : null,
        status: "pending",
        party_name:
          (form.type === "payable" ? suppliersMap[form.supplier_id] : clientsMap[form.client_id]) ?? null,
        company: (form.company as CompanyBrand) || DEFAULT_COMPANY,
      };

      if (editingId) {
        const { error } = await (supabase.from("financial_transactions") as any)
          .update({ ...rowBase, due_date: form.due_date }).eq("id", editingId);
        if (error) throw error;
        return;
      }

      // Installments support: split into N rows
      if (form.installments_enabled) {
        const count = Math.max(2, parseInt(form.installments_count || "2", 10));
        const perAmount = +(baseAmount / count).toFixed(2);
        const groupId = (crypto as any)?.randomUUID?.() ?? `grp-${Date.now()}`;
        const rows = Array.from({ length: count }).map((_, i) => {
          const due = nextDate(form.due_date, form.installments_interval, i);
          return {
            ...rowBase,
            base_amount: perAmount,
            amount: perAmount,
            due_date: due,
            installment_number: i + 1,
            installment_total: count,
            installment_group_id: groupId,
            is_future_recurrence: false,
            description: `${form.description} (${i + 1}/${count})`,
          };
        });
        const { error } = await (supabase.from("financial_transactions") as any).insert(rows);
        if (error) throw error;
        return;
      }

      const { error } = await (supabase.from("financial_transactions") as any).insert([{
        ...rowBase,
        due_date: form.due_date,
        installment_number: null,
        installment_total: null,
        installment_group_id: null,
        is_future_recurrence: false,
      }]);
      if (error) throw error;
    },
    onSuccess: () => {
      toast({ title: editingId ? "Movimentação atualizada" : "Movimentação criada" });
      qc.invalidateQueries({ queryKey: ["finance-transactions"] });
      navigate(isReceivable ? "/finance/receivables" : "/finance/payables");
    },
    onError: (e: any) =>
      toast({ title: "Erro ao salvar", description: e.message, variant: "destructive" }),
  });

  const handleSubmit = () => {
    if (!form.description || !form.category || !form.base_amount || !form.due_date || !form.competence_date) {
      toast({ title: "Preencha os campos obrigatórios", variant: "destructive" });
      return;
    }
    saveMutation.mutate();
  };

  const partyLabel = isReceivable ? "Cliente" : "Fornecedor";
  const titleAction = editingId ? "Editar" : "Nova";
  const titleNoun = isReceivable ? "Conta a Receber" : "Conta a Pagar";
  const backTo = isReceivable ? "/finance/receivables" : "/finance/payables";

  return (
    <div className="space-y-3 px-8 py-4 w-full max-w-none">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => navigate(backTo)}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div className="flex-1">
          <h1 className="text-xl sm:text-2xl font-display font-semibold">
            {titleAction} {titleNoun}
          </h1>
        </div>
      </div>

      <FormBody>
        {/* DADOS PRINCIPAIS */}
        <Section title="Dados principais">
          <div className="grid grid-cols-12 gap-3">
            <div className="space-y-1 col-span-12 md:col-span-7">
              <Label>Descrição da movimentação *</Label>
              <Input
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                placeholder={isReceivable
                  ? "Ex.: Pacote Europa — Cliente João"
                  : "Ex.: Reserva de hotel — Fornecedor X"}
              />
            </div>

            <div className="space-y-1 col-span-12 md:col-span-5">
              <Label>{partyLabel}</Label>
              {isReceivable ? (
                <Select value={form.client_id} onValueChange={(v) => {
                  if (v === "__add__") { window.open("/clients", "_blank"); return; }
                  setForm({ ...form, client_id: v });
                }}>
                  <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__add__" className="text-primary font-medium">+ Cadastrar novo cliente</SelectItem>
                    {clients.map((c: any) => (
                      <SelectItem key={c.id} value={c.id}>{c.full_name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              ) : (
                <Select value={form.supplier_id} onValueChange={(v) => {
                  if (v === "__add__") { window.open("/registrations?tab=suppliers", "_blank"); return; }
                  setForm({ ...form, supplier_id: v });
                }}>
                  <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__add__" className="text-primary font-medium">+ Cadastrar novo fornecedor</SelectItem>
                    {suppliers.map((s: any) => (
                      <SelectItem key={s.id} value={s.id}>{s.trade_name || s.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </div>

            <div className="space-y-1 col-span-12 md:col-span-6">
              <Label>Categoria *</Label>
              <Select value={form.category} onValueChange={(v) => {
                if (v === "__add__") { window.open("/finance/registrations?tab=categories", "_blank"); return; }
                setForm({ ...form, category: v });
              }}>
                <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="__add__" className="text-primary font-medium">+ Cadastrar nova categoria</SelectItem>
                  {tourismCategories.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1 col-span-12 md:col-span-6">
              <div className="flex items-center justify-between h-4">
                <Label>Centro de Custo</Label>
                <div className="flex items-center gap-1.5">
                  <span className="text-[10px] text-muted-foreground">Rateio</span>
                  <Switch
                    checked={form.cost_center_split}
                    onCheckedChange={(v) => setForm({ ...form, cost_center_split: v })}
                  />
                </div>
              </div>
              <Select value={form.cost_center} onValueChange={(v) => {
                if (v === "__add__") { window.open("/finance/registrations?tab=cost-centers", "_blank"); return; }
                setForm({ ...form, cost_center: v });
              }}>
                <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="__add__" className="text-primary font-medium">+ Cadastrar centro de custo</SelectItem>
                  {costCenters.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>
        </Section>

        {/* DATAS E CONDIÇÕES */}
        <Section title="Datas e condições">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <div className="space-y-1">
              <Label>Data de competência *</Label>
              <Input type="date" value={form.competence_date}
                onChange={(e) => setForm({ ...form, competence_date: e.target.value })} />
            </div>
            <div className="space-y-1">
              <Label>Data de vencimento *</Label>
              <Input type="date" value={form.due_date}
                onChange={(e) => setForm({ ...form, due_date: e.target.value })} />
            </div>
            <div className="space-y-1">
              <Label>Forma de pagamento</Label>
              <Select value={form.payment_method}
                onValueChange={(v) => setForm({ ...form, payment_method: v })}>
                <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                <SelectContent>
                  {paymentMethods.map((m) => <SelectItem key={m} value={m}>{m}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label>Conta bancária</Label>
              <Select value={form.bank_account_id}
                onValueChange={(v) => setForm({ ...form, bank_account_id: v })}>
                <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                <SelectContent>
                  {bankAccounts.map((b: any) => (
                    <SelectItem key={b.id} value={b.id}>{b.bank_name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </Section>

        {/* VALOR */}
        <Section title="Valor">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label>Valor (R$) *</Label>
              <Input
                type="number" step="0.01" min="0"
                value={form.base_amount}
                onChange={(e) => setForm({ ...form, base_amount: e.target.value })}
                placeholder="0,00"
              />
            </div>
            <div className="space-y-1">
              <Label>Total</Label>
              <div className="h-7 px-2 rounded-md border border-gray-200 bg-muted/30 flex items-center text-xs font-semibold">
                {brl(baseAmountNum)}
              </div>
            </div>
          </div>
        </Section>

        {/* PARCELAR + REPETIR */}
        {!editingId && (
          <Section title="Parcelamento e recorrência">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {/* PARCELAR */}
              <div className="rounded-md border border-gray-200 px-3 py-2 space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-1.5">
                    <Layers className="h-3.5 w-3.5 text-primary" />
                    <span className="text-xs font-medium">Dividir em parcelas</span>
                  </div>
                  <Switch
                    checked={form.installments_enabled}
                    onCheckedChange={(v) => setForm({
                      ...form,
                      installments_enabled: v,
                      recurrence_enabled: v ? false : form.recurrence_enabled,
                    })}
                  />
                </div>
                {form.installments_enabled && (
                  <div className="grid grid-cols-2 gap-2">
                    <div className="space-y-1">
                      <Label>Parcelas</Label>
                      <Input
                        type="number" min={2} max={60}
                        value={form.installments_count}
                        onChange={(e) => setForm({ ...form, installments_count: e.target.value })}
                      />
                    </div>
                    <div className="space-y-1">
                      <Label>Intervalo</Label>
                      <Select value={form.installments_interval}
                        onValueChange={(v) => setForm({ ...form, installments_interval: v })}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {installmentIntervals.map((r) => (
                            <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                )}
              </div>

              {/* REPETIR */}
              <div className="rounded-md border border-gray-200 px-3 py-2 space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-1.5">
                    <Repeat className="h-3.5 w-3.5 text-primary" />
                    <span className="text-xs font-medium">Conta recorrente</span>
                  </div>
                  <Switch
                    checked={form.recurrence_enabled}
                    onCheckedChange={(v) => setForm({
                      ...form,
                      recurrence_enabled: v,
                      installments_enabled: v ? false : form.installments_enabled,
                    })}
                  />
                </div>
                {form.recurrence_enabled && (
                  <div className="grid grid-cols-2 gap-2">
                    <div className="space-y-1">
                      <Label>Periodicidade</Label>
                      <Select value={form.recurrence_period}
                        onValueChange={(v) => setForm({ ...form, recurrence_period: v })}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {recurrencePeriods.map((r) => (
                            <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-1">
                      <Label>Repetir até</Label>
                      <Input type="date" value={form.recurrence_until}
                        onChange={(e) => setForm({ ...form, recurrence_until: e.target.value })} />
                    </div>
                  </div>
                )}
              </div>
            </div>
          </Section>
        )}

        {/* OBS + ANEXOS */}
        <Section title="Observações e anexos">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <Textarea value={form.observations}
              onChange={(e) => setForm({ ...form, observations: e.target.value })}
              placeholder="Notas internas"
              rows={3}
              className="text-xs resize-none" />
            <label
              htmlFor="pr-attachments"
              className="flex items-center justify-center gap-2 rounded-md border border-dashed border-gray-300 bg-muted/20 px-3 py-2 cursor-pointer hover:bg-muted/40 transition-colors text-xs"
            >
              <Upload className="h-4 w-4 text-muted-foreground" />
              <span className="font-medium">Anexar arquivos</span>
              <span className="text-muted-foreground">(PDF, JPG, PNG)</span>
              <input
                id="pr-attachments"
                type="file"
                multiple
                className="hidden"
                onChange={(e) => {
                  const files = Array.from(e.target.files ?? []);
                  setAttachments((prev) => [...prev, ...files]);
                }}
              />
            </label>
          </div>

          {attachments.length > 0 && (
            <ul className="space-y-1 mt-2">
              {attachments.map((f, i) => (
                <li key={i} className="flex items-center justify-between rounded-md border border-gray-200 px-2 py-1 text-xs">
                  <div className="flex items-center gap-2 min-w-0">
                    <FileText className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                    <span className="truncate">{f.name}</span>
                    <span className="text-[10px] text-muted-foreground shrink-0">
                      {(f.size / 1024).toFixed(0)} KB
                    </span>
                  </div>
                  <Button
                    type="button" variant="ghost" size="icon" className="h-6 w-6"
                    onClick={() => setAttachments((prev) => prev.filter((_, idx) => idx !== i))}
                  >
                    <X className="h-3.5 w-3.5" />
                  </Button>
                </li>
              ))}
            </ul>
          )}
        </Section>
      </FormBody>

      {/* Actions */}
      <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-2 pt-2">
        <Button variant="outline" size="sm" onClick={() => navigate(backTo)}>
          Cancelar
        </Button>
        <Button size="sm" onClick={handleSubmit} disabled={saveMutation.isPending}>
          {saveMutation.isPending ? "Salvando…" : "Salvar e Fechar"}
        </Button>
      </div>
    </div>
  );
}

// ----- helpers -----
function nextDate(start: string, interval: string, offset: number): string {
  const d = new Date(start + "T00:00:00");
  switch (interval) {
    case "weekly": d.setDate(d.getDate() + 7 * offset); break;
    case "biweekly": d.setDate(d.getDate() + 14 * offset); break;
    case "bimonthly": d.setMonth(d.getMonth() + 2 * offset); break;
    case "monthly":
    default: d.setMonth(d.getMonth() + offset); break;
  }
  return d.toISOString().slice(0, 10);
}

function FormBody({ children }: { children: React.ReactNode }) {
  return (
    <div className="space-y-3 [&_label]:text-[11px] [&_label]:font-normal [&_label]:text-slate-500 [&_input]:h-7 [&_input]:py-1 [&_input]:px-2 [&_input]:text-xs [&_input]:border-gray-200 [&_button[role=combobox]]:h-7 [&_button[role=combobox]]:py-1 [&_button[role=combobox]]:px-2 [&_button[role=combobox]]:text-xs [&_button[role=combobox]]:border-gray-200">
      {children}
    </div>
  );
}

function Section({ title, children }: { title?: string; children: React.ReactNode }) {
  return (
    <div className="space-y-2">
      {title && (
        <div className="flex items-center gap-2">
          <h3 className="text-[10px] font-medium uppercase tracking-[0.12em] text-slate-400 whitespace-nowrap">{title}</h3>
          <div className="flex-1 h-px bg-gray-200" />
        </div>
      )}
      {children}
    </div>
  );
}
