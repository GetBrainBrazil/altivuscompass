import { useEffect, useState } from "react";
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogCancel,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { AlertTriangle, ShieldAlert, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { ContactLevelBadge, type ContactLevel, getContactLevelLabel } from "./ContactLevelBadge";
import { logAuditEvent } from "@/lib/audit";

export type DeleteContactTarget = {
  contactId: string;
  clientId: string | null;
  leadId: string | null;
  fullName: string;
  level: ContactLevel;
};

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  target: DeleteContactTarget | null;
  onDeleted?: () => void;
};

const ACTIVE_QUOTE_STAGES = ["draft", "sent", "negotiation", "approved", "in_progress"];

async function checkActiveBlockers(target: DeleteContactTarget): Promise<string[]> {
  const blockers: string[] = [];

  // Quotes em andamento (por lead_id ou client_id)
  try {
    const orParts: string[] = [];
    if (target.leadId) orParts.push(`lead_id.eq.${target.leadId}`);
    if (target.clientId) orParts.push(`client_id.eq.${target.clientId}`);
    if (orParts.length) {
      const { data } = await (supabase as any)
        .from("quotes")
        .select("id, stage, conclusion_type")
        .or(orParts.join(","));
      const active = (data ?? []).filter((q: any) => {
        if (q.conclusion_type === "won" || q.conclusion_type === "lost") return false;
        return ACTIVE_QUOTE_STAGES.includes(q.stage);
      });
      if (active.length) {
        blockers.push(`${active.length} cotação(ões) em andamento`);
      }
    }
  } catch (e) {
    console.warn("[DeleteContactDialog] check quotes failed", e);
  }

  // Viagens em curso: itinerários cuja janela inclui hoje
  if (target.clientId) {
    try {
      const today = new Date().toISOString().slice(0, 10);
      const { data } = await supabase
        .from("itineraries")
        .select("id, travel_date_start, travel_date_end")
        .eq("client_id", target.clientId);
      const ongoing = (data ?? []).filter((i: any) => {
        const start = i.travel_date_start;
        const end = i.travel_date_end ?? i.travel_date_start;
        return start && end && start <= today && today <= end;
      });
      if (ongoing.length) {
        blockers.push(`${ongoing.length} viagem(ns) em curso`);
      }
    } catch (e) {
      console.warn("[DeleteContactDialog] check itineraries failed", e);
    }
  }

  return blockers;
}

async function performDelete(target: DeleteContactTarget) {
  // Para Cliente: apaga cascata: financial_transactions, quotes, itineraries, client_*, clients, lead, contact
  if (target.level === "cliente" && target.clientId) {
    const cid = target.clientId;
    await supabase.from("financial_transactions").delete().eq("client_id", cid);
    await (supabase as any).from("quotes").delete().eq("client_id", cid);
    await supabase.from("itineraries").delete().eq("client_id", cid);
    await supabase.from("client_phones").delete().eq("client_id", cid);
    await supabase.from("client_emails").delete().eq("client_id", cid);
    await supabase.from("client_social_media").delete().eq("client_id", cid);
    await supabase.from("client_passports").delete().eq("client_id", cid);
    await supabase.from("client_visas").delete().eq("client_id", cid);
    const { error } = await supabase.from("clients").delete().eq("id", cid);
    if (error) throw error;
    logAuditEvent({
      action: "delete",
      tableName: "clients",
      recordId: cid,
      recordLabel: target.fullName,
    });
  }

  if (target.leadId) {
    try {
      await (supabase as any).from("lead_history").delete().eq("lead_id", target.leadId);
    } catch {}
    try {
      await (supabase as any).from("quotes").delete().eq("lead_id", target.leadId);
    } catch {}
    await supabase.from("leads").delete().eq("id", target.leadId);
    logAuditEvent({
      action: "delete",
      tableName: "leads",
      recordId: target.leadId,
      recordLabel: target.fullName,
    });
  }

  const { error: cErr } = await (supabase as any)
    .from("contacts")
    .delete()
    .eq("id", target.contactId);
  if (cErr) throw cErr;
  logAuditEvent({
    action: "delete",
    tableName: "contacts",
    recordId: target.contactId,
    recordLabel: target.fullName,
  });
}

export function DeleteContactDialog({ open, onOpenChange, target, onDeleted }: Props) {
  const { toast } = useToast();
  const [confirmText, setConfirmText] = useState("");
  const [checking, setChecking] = useState(false);
  const [blockers, setBlockers] = useState<string[]>([]);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    if (!open || !target) return;
    setConfirmText("");
    setBlockers([]);
    setChecking(true);
    checkActiveBlockers(target)
      .then(setBlockers)
      .finally(() => setChecking(false));
  }, [open, target]);

  if (!target) return null;

  const isClient = target.level === "cliente";
  const hasBlockers = blockers.length > 0;
  const nameMatches = confirmText.trim() === target.fullName.trim();
  const canDelete = !checking && !hasBlockers && (!isClient || nameMatches);

  const handleDelete = async () => {
    if (!canDelete || !target) return;
    setDeleting(true);
    try {
      await performDelete(target);
      toast({ title: "Contato excluído", description: `${target.fullName} foi removido.` });
      onOpenChange(false);
      onDeleted?.();
    } catch (e: any) {
      toast({
        title: "Erro ao excluir",
        description: e?.message ?? "Tente novamente.",
        variant: "destructive",
      });
    } finally {
      setDeleting(false);
    }
  };

  return (
    <AlertDialog open={open} onOpenChange={(o) => !deleting && onOpenChange(o)}>
      <AlertDialogContent className="max-w-lg">
        <AlertDialogHeader>
          <div className="flex items-start gap-3">
            <div
              className={`shrink-0 w-10 h-10 rounded-full flex items-center justify-center ${
                isClient ? "bg-destructive/15" : "bg-destructive/10"
              }`}
            >
              {isClient ? (
                <ShieldAlert className="w-5 h-5 text-destructive" />
              ) : (
                <AlertTriangle className="w-5 h-5 text-destructive" />
              )}
            </div>
            <div className="flex-1 min-w-0">
              <AlertDialogTitle className="font-display text-lg">
                {isClient ? "Excluir Cliente — atenção" : "Excluir contato"}
              </AlertDialogTitle>
              <div className="flex items-center gap-2 mt-1.5">
                <span className="text-sm font-medium text-foreground truncate">
                  {target.fullName}
                </span>
                <ContactLevelBadge level={target.level} size="xs" />
              </div>
            </div>
          </div>
        </AlertDialogHeader>

        <AlertDialogDescription asChild>
          <div className="space-y-3 text-sm font-body text-muted-foreground">
            {checking ? (
              <div className="flex items-center gap-2 text-muted-foreground">
                <Loader2 className="w-4 h-4 animate-spin" />
                Verificando processos ativos...
              </div>
            ) : hasBlockers ? (
              <div className="rounded-md border border-amber-300 bg-amber-50 p-3 text-amber-900">
                <p className="font-medium mb-1">Não é possível excluir este contato.</p>
                <p>
                  Existem processos ativos vinculados que precisam ser finalizados ou cancelados
                  antes da exclusão:
                </p>
                <ul className="list-disc pl-5 mt-2 space-y-0.5">
                  {blockers.map((b, i) => (
                    <li key={i}>{b}</li>
                  ))}
                </ul>
              </div>
            ) : isClient ? (
              <p>
                <span className="font-semibold text-foreground">Atenção:</span> {target.fullName} é
                um {getContactLevelLabel(target.level)} com histórico de viagens. A exclusão
                removerá permanentemente o cadastro, cotações vinculadas, histórico de viagens e
                movimentações financeiras associadas. Digite o nome do cliente para confirmar a
                exclusão.
              </p>
            ) : (
              <p>
                Tem certeza que deseja excluir <span className="font-medium text-foreground">{target.fullName}</span>?
                Essa ação removerá o contato e todas as informações associadas (conversas,
                observações) permanentemente.
              </p>
            )}

            {!checking && !hasBlockers && isClient && (
              <div className="space-y-1.5 pt-1">
                <Label className="text-xs font-body text-foreground">
                  Digite <span className="font-semibold">{target.fullName}</span> para confirmar
                </Label>
                <Input
                  autoFocus
                  value={confirmText}
                  onChange={(e) => setConfirmText(e.target.value)}
                  placeholder={target.fullName}
                />
              </div>
            )}
          </div>
        </AlertDialogDescription>

        <AlertDialogFooter>
          <AlertDialogCancel className="font-body" disabled={deleting}>
            Cancelar
          </AlertDialogCancel>
          {!hasBlockers && (
            <Button
              type="button"
              variant="destructive"
              className="font-body"
              disabled={!canDelete || deleting}
              onClick={handleDelete}
            >
              {deleting ? (
                <>
                  <Loader2 className="w-4 h-4 mr-1.5 animate-spin" />
                  Excluindo...
                </>
              ) : (
                "Excluir permanentemente"
              )}
            </Button>
          )}
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
