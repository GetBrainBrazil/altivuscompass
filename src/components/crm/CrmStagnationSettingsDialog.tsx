import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Loader2, Settings2 } from "lucide-react";

/**
 * Diálogo de configurações da automação de estagnação/arquivamento
 * automático no Funil de Vendas. Apenas admins/managers conseguem
 * salvar (regra herdada da RLS de agency_settings).
 */
export function CrmStagnationSettingsDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [rowId, setRowId] = useState<string | null>(null);
  const [stagnationDays, setStagnationDays] = useState(7);
  const [autoArchiveDays, setAutoArchiveDays] = useState(21);
  const [autoArchiveEnabled, setAutoArchiveEnabled] = useState(true);

  useEffect(() => {
    if (!open) return;
    setLoading(true);
    (async () => {
      const { data } = await supabase
        .from("agency_settings")
        .select("id, stagnation_days, auto_archive_days, auto_archive_enabled")
        .limit(1)
        .maybeSingle();
      if (data) {
        setRowId(data.id);
        setStagnationDays((data as any).stagnation_days ?? 7);
        setAutoArchiveDays((data as any).auto_archive_days ?? 21);
        setAutoArchiveEnabled((data as any).auto_archive_enabled ?? true);
      }
      setLoading(false);
    })();
  }, [open]);

  const save = async () => {
    if (!rowId) {
      toast.error("Configurações da agência ainda não inicializadas.");
      return;
    }
    if (stagnationDays < 1 || autoArchiveDays < stagnationDays) {
      toast.error("Prazo de arquivamento deve ser maior que o de estagnação.");
      return;
    }
    setSaving(true);
    try {
      const { error } = await supabase
        .from("agency_settings")
        .update({
          stagnation_days: stagnationDays,
          auto_archive_days: autoArchiveDays,
          auto_archive_enabled: autoArchiveEnabled,
        } as any)
        .eq("id", rowId);
      if (error) throw error;
      toast.success("Configurações salvas.");
      onOpenChange(false);
    } catch (e: any) {
      toast.error(e?.message || "Erro ao salvar.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Settings2 className="w-4 h-4" /> Estagnação e arquivamento automático
          </DialogTitle>
          <DialogDescription className="text-xs">
            Defina os prazos para o sistema marcar leads sem atividade como estagnados e arquivá-los automaticamente.
          </DialogDescription>
        </DialogHeader>
        {loading ? (
          <div className="flex items-center justify-center py-10 text-muted-foreground">
            <Loader2 className="w-4 h-4 animate-spin" />
          </div>
        ) : (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">Prazo estagnação (dias)</Label>
                <Input
                  type="number"
                  min={1}
                  value={stagnationDays}
                  onChange={(e) => setStagnationDays(Math.max(1, Number(e.target.value) || 1))}
                  className="h-8"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">Prazo arquivamento (dias)</Label>
                <Input
                  type="number"
                  min={1}
                  value={autoArchiveDays}
                  onChange={(e) => setAutoArchiveDays(Math.max(1, Number(e.target.value) || 1))}
                  className="h-8"
                  disabled={!autoArchiveEnabled}
                />
              </div>
            </div>
            <div className="flex items-center justify-between rounded-md border border-border p-3">
              <div>
                <p className="text-sm font-medium">Arquivamento automático</p>
                <p className="text-xs text-muted-foreground">
                  Se desativado, o sistema apenas marca como estagnado.
                </p>
              </div>
              <Switch checked={autoArchiveEnabled} onCheckedChange={setAutoArchiveEnabled} />
            </div>
          </div>
        )}
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={saving}>
            Cancelar
          </Button>
          <Button onClick={save} disabled={saving || loading}>
            {saving && <Loader2 className="w-4 h-4 animate-spin" />} Salvar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
