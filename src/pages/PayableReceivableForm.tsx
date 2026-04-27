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
import { useToast } from "@/hooks/use-toast";
import { ArrowDown, ArrowUp, ArrowLeft, Plus } from "lucide-react";
import { cn } from "@/lib/utils";

type TxType = "payable" | "receivable";

const tourismCategories = [
  "Passagens Aéreas", "Hospedagem", "Transporte/Transfer", "Seguro Viagem",
  "Experiências/Passeios", "Cruzeiro", "Comissão", "Custo Operacional", "Outros",
];

const recurrenceOptions = [
  { value: "none", label: "Sem recorrência" },
  { value: "weekly", label: "Semanal" },
  { value: "biweekly", label: "Quinzenal" },
  { value: "monthly", label: "Mensal" },
  { value: "quarterly", label: "Trimestral" },
  { value: "yearly", label: "Anual" },
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
  project: "",
  client_id: "",
  supplier_id: "",
  competence_date: todayStr(),
  due_date: todayStr(),
  bank_account_id: "",
  payment_method: "",
  base_amount: "",
  discount_amount: "",
  interest_amount: "",
  fine_amount: "",
  admin_fee_amount: "",
  installment_total: "1",
  installment_interval_days: "30",
  recurrence_type: "none",
  observations: "",
};

export default function PayableReceivableForm() {
  const navigate = useNavigate();
  const { id: editingId } = useParams<{ id?: string }>();
  const [searchParams] = useSearchParams();
  const initialType = (searchParams.get("type") as TxType) || "payable";
  const { toast } = useToast();
  const qc = useQueryClient();

  const [form, setForm] = useState<typeof emptyForm>({ ...emptyForm, type: initialType });

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
    setForm({
      type: existing.type,
      description: existing.description ?? "",
      category: existing.category ?? "",
      cost_center: existing.cost_center ?? "",
      project: existing.project ?? "",
      client_id: existing.client_id ?? "",
      supplier_id: existing.supplier_id ?? "",
      competence_date: existing.competence_date ?? existing.date ?? todayStr(),
      due_date: existing.due_date ?? todayStr(),
      bank_account_id: existing.bank_account_id ?? "",
      payment_method: existing.payment_method ?? "",
      base_amount: String(existing.base_amount ?? existing.amount ?? ""),
      discount_amount: String(existing.discount_amount ?? ""),
      interest_amount: String(existing.interest_amount ?? ""),
      fine_amount: String(existing.fine_amount ?? ""),
      admin_fee_amount: String(existing.admin_fee_amount ?? ""),
      installment_total: String(existing.installment_total ?? "1"),
      installment_interval_days: "30",
      recurrence_type: existing.recurrence_type ?? "none",
      observations: existing.observations ?? "",
    });
  }, [existing]);

  const clientsMap = useMemo(
    () => Object.fromEntries(clients.map((c: any) => [c.id, c.full_name])), [clients]);
  const suppliersMap = useMemo(
    () => Object.fromEntries(suppliers.map((s: any) => [s.id, s.trade_name || s.name])), [suppliers]);

  const totalPreview = useMemo(() => {
    const b = parseFloat(form.base_amount || "0");
    const d = parseFloat(form.discount_amount || "0");
    const i = parseFloat(form.interest_amount || "0");
    const f = parseFloat(form.fine_amount || "0");
    const a = parseFloat(form.admin_fee_amount || "0");
    return b - d + i + f + a;
  }, [form]);

  // ----- mutation -----
  const saveMutation = useMutation({
    mutationFn: async () => {
      const installments = Math.max(1, parseInt(form.installment_total || "1", 10));
      const intervalDays = Math.max(1, parseInt(form.installment_interval_days || "30", 10));
      const baseAmount = parseFloat(form.base_amount || "0");
      const discount = parseFloat(form.discount_amount || "0");
      const interest = parseFloat(form.interest_amount || "0");
      const fine = parseFloat(form.fine_amount || "0");
      const adminFee = parseFloat(form.admin_fee_amount || "0");
      const totalPerRow = baseAmount - discount + interest + fine + adminFee;

      const rowBase = {
        type: form.type,
        description: form.description,
        category: form.category || null,
        cost_center: form.cost_center || null,
        project: form.project || null,
        client_id: form.client_id || null,
        supplier_id: form.supplier_id || null,
        competence_date: form.competence_date || null,
        bank_account_id: form.bank_account_id || null,
        payment_method: form.payment_method || null,
        base_amount: baseAmount,
        discount_amount: discount,
        interest_amount: interest,
        fine_amount: fine,
        admin_fee_amount: adminFee,
        amount: totalPerRow,
        date: form.competence_date || todayStr(),
        observations: form.observations || null,
        recurrence_type: form.recurrence_type === "none" ? null : form.recurrence_type,
        status: "pending",
        party_name:
          (form.type === "payable" ? suppliersMap[form.supplier_id] : clientsMap[form.client_id]) ?? null,
      };

      if (editingId) {
        const { error } = await (supabase.from("financial_transactions") as any)
          .update({ ...rowBase, due_date: form.due_date }).eq("id", editingId);
        if (error) throw error;
        return;
      }

      const groupId = installments > 1 ? crypto.randomUUID() : null;
      const rows: any[] = [];
      const baseDue = new Date(form.due_date + "T00:00:00");
      for (let i = 0; i < installments; i++) {
        const d = new Date(baseDue);
        d.setDate(d.getDate() + i * intervalDays);
        rows.push({
          ...rowBase,
          due_date: d.toISOString().slice(0, 10),
          installment_number: installments > 1 ? i + 1 : null,
          installment_total: installments > 1 ? installments : null,
          installment_group_id: groupId,
          is_future_recurrence: i > 0,
        });
      }
      const { error } = await (supabase.from("financial_transactions") as any).insert(rows);
      if (error) throw error;
    },
    onSuccess: () => {
      toast({ title: editingId ? "Movimentação atualizada" : "Movimentação criada" });
      qc.invalidateQueries({ queryKey: ["finance-transactions"] });
      navigate("/finance/payables-receivables");
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

  return (
    <div className="space-y-6 p-4 sm:p-6 max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => navigate("/finance/payables-receivables")}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div className="flex-1">
          <h1 className="text-2xl sm:text-3xl font-display font-semibold">
            {editingId ? "Editar movimentação" : "Nova movimentação financeira"}
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Cadastre uma conta a pagar ou a receber com classificação, vinculação e parcelamento.
          </p>
        </div>
      </div>

      {/* Type cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {(["payable", "receivable"] as TxType[]).map((t) => (
          <button
            key={t}
            type="button"
            disabled={!!editingId}
            onClick={() => setForm({ ...form, type: t })}
            className={cn(
              "p-4 rounded-lg border-2 text-left transition-all disabled:opacity-60 disabled:cursor-not-allowed",
              form.type === t
                ? "border-success bg-success/5"
                : "border-border hover:border-muted-foreground/40",
            )}
          >
            <div className="flex items-center gap-2 mb-1">
              {t === "payable"
                ? <ArrowDown className="h-4 w-4 text-destructive" />
                : <ArrowUp className="h-4 w-4 text-success" />}
              <span className="font-semibold">
                {t === "payable" ? "Conta a Pagar" : "Conta a Receber"}
              </span>
            </div>
            <p className="text-xs text-muted-foreground">
              {t === "payable"
                ? "Despesa ou pagamento a fornecedores"
                : "Recebimento de cliente ou venda"}
            </p>
          </button>
        ))}
      </div>

      <Card>
        <Section>
          <div className="space-y-2">
            <Label>Descrição da Movimentação *</Label>
            <Input
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              placeholder="Ex.: Reserva de hotel — Cliente João"
            />
          </div>
        </Section>

        <Section title="Classificação Financeira">
          <div className="grid sm:grid-cols-3 gap-3">
            <div className="space-y-2">
              <Label>Categoria *</Label>
              <Select value={form.category} onValueChange={(v) => setForm({ ...form, category: v })}>
                <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                <SelectContent>
                  {tourismCategories.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Centro de Custo</Label>
              <Input value={form.cost_center}
                onChange={(e) => setForm({ ...form, cost_center: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label>Projeto / Cotação</Label>
              <Input value={form.project}
                onChange={(e) => setForm({ ...form, project: e.target.value })}
                placeholder="Vincular a uma viagem" />
            </div>
          </div>
        </Section>

        <Section title="Vinculação">
          {form.type === "receivable" ? (
            <div className="space-y-2">
              <Label>Cliente</Label>
              <div className="flex gap-2">
                <Select value={form.client_id} onValueChange={(v) => setForm({ ...form, client_id: v })}>
                  <SelectTrigger><SelectValue placeholder="Selecione um cliente" /></SelectTrigger>
                  <SelectContent>
                    {clients.length === 0 && (
                      <div className="px-3 py-2 text-xs text-muted-foreground">
                        Nenhum cliente cadastrado.
                      </div>
                    )}
                    {clients.map((c: any) => (
                      <SelectItem key={c.id} value={c.id}>{c.full_name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button type="button" variant="outline" size="icon"
                  onClick={() => window.open("/clients", "_blank")}
                  title="Cadastrar novo cliente">
                  <Plus className="h-4 w-4" />
                </Button>
              </div>
              <p className="text-[11px] text-muted-foreground">
                Apenas Clientes da base aparecem (não inclui Leads ou Prospects).
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              <Label>Fornecedor</Label>
              <Select value={form.supplier_id} onValueChange={(v) => setForm({ ...form, supplier_id: v })}>
                <SelectTrigger><SelectValue placeholder="Selecione um fornecedor" /></SelectTrigger>
                <SelectContent>
                  {suppliers.map((s: any) => (
                    <SelectItem key={s.id} value={s.id}>{s.trade_name || s.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
        </Section>

        <Section title="Datas e Condições">
          <div className="grid sm:grid-cols-3 gap-3">
            <div className="space-y-2">
              <Label>Data de Competência *</Label>
              <Input type="date" value={form.competence_date}
                onChange={(e) => setForm({ ...form, competence_date: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label>Data de Vencimento *</Label>
              <Input type="date" value={form.due_date}
                onChange={(e) => setForm({ ...form, due_date: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label>Conta Bancária</Label>
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
            <div className="space-y-2 sm:col-span-3">
              <Label>Meio de Pagamento</Label>
              <Select value={form.payment_method}
                onValueChange={(v) => setForm({ ...form, payment_method: v })}>
                <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                <SelectContent>
                  {paymentMethods.map((m) => <SelectItem key={m} value={m}>{m}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>
        </Section>

        <Section title="Valores e Encargos">
          <div className="grid sm:grid-cols-3 gap-3">
            <MoneyField label="Valor Base (R$) *" value={form.base_amount}
              onChange={(v) => setForm({ ...form, base_amount: v })} />
            <MoneyField label="Desconto Previsto" value={form.discount_amount}
              onChange={(v) => setForm({ ...form, discount_amount: v })} />
            <MoneyField label="Juros Previstos" value={form.interest_amount}
              onChange={(v) => setForm({ ...form, interest_amount: v })} />
            <MoneyField label="Multa Prevista" value={form.fine_amount}
              onChange={(v) => setForm({ ...form, fine_amount: v })} />
            <MoneyField label="Taxas ADM" value={form.admin_fee_amount}
              onChange={(v) => setForm({ ...form, admin_fee_amount: v })} />
            <div className="space-y-2 flex flex-col justify-end">
              <Label>Total Calculado</Label>
              <div className="h-10 px-3 rounded-md border border-border bg-muted/30 flex items-center font-semibold">
                {brl(totalPreview)}
              </div>
            </div>
          </div>
        </Section>

        {!editingId && (
          <Section title="Parcelamento e Recorrência">
            <div className="grid sm:grid-cols-3 gap-3">
              <div className="space-y-2">
                <Label>Quantidade de Parcelas</Label>
                <Input type="number" min={1} value={form.installment_total}
                  onChange={(e) => setForm({ ...form, installment_total: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label>Intervalo (dias)</Label>
                <Input type="number" min={1} value={form.installment_interval_days}
                  onChange={(e) => setForm({ ...form, installment_interval_days: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label>Recorrência</Label>
                <Select value={form.recurrence_type}
                  onValueChange={(v) => setForm({ ...form, recurrence_type: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {recurrenceOptions.map((r) => (
                      <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </Section>
        )}

        <Section title="Observações">
          <Textarea value={form.observations}
            onChange={(e) => setForm({ ...form, observations: e.target.value })}
            rows={3} />
        </Section>
      </Card>

      {/* Actions */}
      <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-2 pb-6">
        <Button variant="outline" onClick={() => navigate("/finance/payables-receivables")}>
          Cancelar
        </Button>
        <Button onClick={handleSubmit} disabled={saveMutation.isPending}>
          {saveMutation.isPending ? "Salvando…" : "Salvar movimentação"}
        </Button>
      </div>
    </div>
  );
}

// ----- helpers -----
function Card({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-border bg-card divide-y divide-border">
      {children}
    </div>
  );
}

function Section({ title, children }: { title?: string; children: React.ReactNode }) {
  return (
    <div className="p-4 sm:p-6 space-y-3">
      {title && (
        <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">{title}</h3>
      )}
      {children}
    </div>
  );
}

function MoneyField({
  label, value, onChange,
}: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      <Input type="number" step="0.01" min="0" value={value}
        onChange={(e) => onChange(e.target.value)} placeholder="0,00" />
    </div>
  );
}
