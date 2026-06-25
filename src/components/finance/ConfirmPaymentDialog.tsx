import { useEffect, useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { CheckCircle2, Upload, AlertTriangle, FileText } from "lucide-react";

const FIN_BUCKET = "financial-attachments";

const paymentMethods = [
  "Pix", "Boleto", "Cartão de Crédito", "Cartão de Débito",
  "Transferência", "Dinheiro", "Outros",
];

export interface ConfirmPaymentTarget {
  id: string;
  type: "payable" | "receivable";
  description?: string | null;
  bank_account_id?: string | null;
  payment_method?: string | null;
  payment_date?: string | null;
  amount?: number | null;
  base_amount?: number | null;
  attachment_urls?: string[] | null;
  attachment_notes?: string[] | null;
  status?: string | null;
}

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  target: ConfirmPaymentTarget | null;
  onConfirmed?: () => void;
  invalidateKeys?: any[][];
}

const todayStr = () => new Date().toISOString().slice(0, 10);

export function ConfirmPaymentDialog({ open, onOpenChange, target, onConfirmed, invalidateKeys = [] }: Props) {
  const qc = useQueryClient();
  const { toast } = useToast();

  const isReceivable = target?.type === "receivable";
  const labelAction = isReceivable ? "recebimento" : "pagamento";
  const labelDone = isReceivable ? "Recebido" : "Pago";
  const newStatus = isReceivable ? "received" : "paid";

  const [bankAccountId, setBankAccountId] = useState("");
  const [paymentDate, setPaymentDate] = useState(todayStr());
  const [paymentMethod, setPaymentMethod] = useState("");
  const [proofFile, setProofFile] = useState<File | null>(null);
  const [proofNote, setProofNote] = useState("");

  useEffect(() => {
    if (open && target) {
      setBankAccountId(target.bank_account_id ?? "");
      setPaymentDate(target.payment_date ?? todayStr());
      setPaymentMethod(target.payment_method ?? "");
      setProofFile(null);
      setProofNote("");
    }
  }, [open, target]);

  const { data: bankAccounts = [] } = useQuery({
    queryKey: ["finance-banks-confirm"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("bank_accounts").select("id, bank_name, account_number").eq("is_active", true);
      if (error) throw error;
      return data ?? [];
    },
  });

  const existingProofs = target?.attachment_urls?.length ?? 0;
  const willHaveProof = !!proofFile || existingProofs > 0;

  const confirmMutation = useMutation({
    mutationFn: async () => {
      if (!target) return;
      if (!bankAccountId) throw new Error("Conta bancária é obrigatória para confirmar.");
      if (!paymentDate) throw new Error("Data do pagamento é obrigatória.");

      let urls = Array.isArray(target.attachment_urls) ? [...target.attachment_urls] : [];
      let notes = Array.isArray(target.attachment_notes) ? [...target.attachment_notes] : [];
      while (notes.length < urls.length) notes.push("");

      if (proofFile) {
        const { data: auth } = await supabase.auth.getUser();
        const userId = auth?.user?.id ?? "anon";
        const safe = proofFile.name.replace(/[^a-zA-Z0-9._-]/g, "_");
        const path = `${userId}/${target.id}/${Date.now()}-${safe}`;
        const { error: upErr } = await supabase.storage.from(FIN_BUCKET).upload(path, proofFile, {
          cacheControl: "3600", upsert: false, contentType: proofFile.type || undefined,
        });
        if (upErr) throw upErr;
        urls.push(path);
        notes.push(proofNote || `Comprovante de ${labelAction}`);
      }

      const { error } = await (supabase.from("financial_transactions") as any)
        .update({
          status: newStatus,
          bank_account_id: bankAccountId,
          payment_date: paymentDate,
          payment_method: paymentMethod || null,
          attachment_urls: urls,
          attachment_notes: notes,
        })
        .eq("id", target.id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast({ title: `${labelDone} com sucesso`, description: "Movimentação confirmada." });
      qc.invalidateQueries({ queryKey: ["finance-transactions"] });
      qc.invalidateQueries({ queryKey: ["finance-tx", target?.id] });
      qc.invalidateQueries({ queryKey: ["finance-reconciliation"] });
      invalidateKeys.forEach((k) => qc.invalidateQueries({ queryKey: k }));
      onOpenChange(false);
      onConfirmed?.();
    },
    onError: (e: any) => toast({ title: "Erro", description: e.message, variant: "destructive" }),
  });

  const valueDisplay = useMemo(() => {
    const v = target?.base_amount ?? target?.amount ?? 0;
    return (Number(v) || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
  }, [target]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <CheckCircle2 className="h-5 w-5 text-success" />
            Confirmar {labelAction}
          </DialogTitle>
          <DialogDescription>
            {target?.description ? <span className="font-medium">{target.description}</span> : "Movimentação"}
            {" — "}
            <span className="tabular-nums">{valueDisplay}</span>
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3 py-2">
          <div className="space-y-1">
            <Label>Conta bancária *</Label>
            <Select value={bankAccountId} onValueChange={setBankAccountId}>
              <SelectTrigger><SelectValue placeholder="Selecione a conta" /></SelectTrigger>
              <SelectContent>
                {bankAccounts.map((b: any) => (
                  <SelectItem key={b.id} value={b.id}>
                    {b.bank_name}{b.account_number ? ` — ${b.account_number}` : ""}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1">
              <Label>Data do {labelAction} *</Label>
              <Input type="date" value={paymentDate} onChange={(e) => setPaymentDate(e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label>Forma</Label>
              <Select value={paymentMethod} onValueChange={setPaymentMethod}>
                <SelectTrigger><SelectValue placeholder="—" /></SelectTrigger>
                <SelectContent>
                  {paymentMethods.map((m) => <SelectItem key={m} value={m}>{m}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-1">
            <Label>Comprovante (opcional)</Label>
            <label className="flex items-center gap-2 border border-dashed border-border rounded-md px-3 py-2 cursor-pointer hover:bg-muted/40 text-sm">
              <Upload className="h-4 w-4 text-muted-foreground" />
              <span className="text-muted-foreground truncate">
                {proofFile ? proofFile.name : "Selecionar arquivo (PDF, imagem)…"}
              </span>
              <input
                type="file" className="hidden"
                accept="image/*,application/pdf"
                onChange={(e) => setProofFile(e.target.files?.[0] ?? null)}
              />
            </label>
            {proofFile && (
              <Input
                placeholder="Observação do comprovante (opcional)"
                value={proofNote}
                onChange={(e) => setProofNote(e.target.value)}
                className="text-xs"
              />
            )}
            {existingProofs > 0 && !proofFile && (
              <p className="text-[11px] text-muted-foreground flex items-center gap-1">
                <FileText className="h-3 w-3" /> {existingProofs} anexo(s) já enviados serão mantidos.
              </p>
            )}
            {!willHaveProof && (
              <p className="text-[11px] text-amber-600 flex items-center gap-1">
                <AlertTriangle className="h-3 w-3" />
                Sem comprovante — você poderá anexar depois.
              </p>
            )}
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={confirmMutation.isPending}>
            Cancelar
          </Button>
          <Button onClick={() => confirmMutation.mutate()} disabled={confirmMutation.isPending}>
            {confirmMutation.isPending ? "Confirmando…" : `Confirmar ${labelAction}`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default ConfirmPaymentDialog;
