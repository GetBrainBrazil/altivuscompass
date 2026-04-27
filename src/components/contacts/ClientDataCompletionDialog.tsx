import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Plane, Plus, Trash2, Info } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

type Traveler = {
  full_name: string;
  cpf: string;
  birth_date: string;
  passport_number: string;
  passport_expiry: string;
  passport_country: string;
  email: string;
  address: string;
};

const emptyTraveler = (): Traveler => ({
  full_name: "",
  cpf: "",
  birth_date: "",
  passport_number: "",
  passport_expiry: "",
  passport_country: "Brasil",
  email: "",
  address: "",
});

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  clientId: string | null;
  clientName?: string | null;
  /** opcional: nº de viajantes esperado (preenche automaticamente o nº de cards) */
  travelersCount?: number | null;
  onCompleted?: () => void;
}

export function ClientDataCompletionDialog({
  open, onOpenChange, clientId, clientName, travelersCount, onCompleted,
}: Props) {
  const { toast } = useToast();
  const [saving, setSaving] = useState(false);
  const [travelers, setTravelers] = useState<Traveler[]>([emptyTraveler()]);

  useEffect(() => {
    if (open) {
      const n = Math.max(1, Math.min(travelersCount ?? 1, 12));
      setTravelers(Array.from({ length: n }, () => emptyTraveler()));
      // Pré-preenche o titular
      if (clientName) {
        setTravelers((prev) => {
          const next = [...prev];
          next[0] = { ...next[0], full_name: clientName };
          return next;
        });
      }
    }
  }, [open, travelersCount, clientName]);

  const updateTraveler = (i: number, patch: Partial<Traveler>) => {
    setTravelers((prev) => prev.map((t, idx) => (idx === i ? { ...t, ...patch } : t)));
  };

  const addTraveler = () => setTravelers((p) => [...p, emptyTraveler()]);
  const removeTraveler = (i: number) => setTravelers((p) => p.filter((_, idx) => idx !== i));

  const handleSave = async () => {
    if (!clientId) return;
    // Validação mínima do titular
    const main = travelers[0];
    if (!main.full_name.trim()) {
      toast({ title: "Nome do titular é obrigatório", variant: "destructive" });
      return;
    }

    setSaving(true);
    try {
      // Atualiza o cliente principal com os dados do titular
      const clientPatch: any = {
        full_name: main.full_name.trim(),
      };
      if (main.cpf) clientPatch.cpf_cnpj = main.cpf;
      if (main.birth_date) clientPatch.birth_date = main.birth_date;
      if (main.email) clientPatch.email = main.email;
      if (main.address) clientPatch.address_street = main.address;
      if (main.passport_number) {
        clientPatch.passport_number = main.passport_number;
        clientPatch.passport_status = "valid";
      }
      if (main.passport_expiry) clientPatch.passport_expiry_date = main.passport_expiry;
      if (main.passport_country) clientPatch.passport_nationality = main.passport_country;

      const { error: clientErr } = await supabase.from("clients").update(clientPatch).eq("id", clientId);
      if (clientErr) throw clientErr;

      // Passaporte do titular como registro separado (se preenchido)
      if (main.passport_number || main.passport_expiry) {
        await supabase.from("client_passports").insert({
          client_id: clientId,
          passport_number: main.passport_number || null,
          expiry_date: main.passport_expiry || null,
          nationality: main.passport_country || null,
          status: "valid",
        });
      }

      // Acompanhantes: cria como clientes vinculados
      const companions = travelers.slice(1).filter((t) => t.full_name.trim());
      for (const c of companions) {
        const { data: newClient, error: cErr } = await supabase
          .from("clients")
          .insert({
            full_name: c.full_name.trim(),
            cpf_cnpj: c.cpf || null,
            birth_date: c.birth_date || null,
            email: c.email || null,
            address_street: c.address || null,
            passport_number: c.passport_number || null,
            passport_expiry_date: c.passport_expiry || null,
            passport_nationality: c.passport_country || null,
            passport_status: c.passport_number ? "valid" : "none",
            notes: `Viajante vinculado a ${clientName ?? "titular"}.`,
          })
          .select("id")
          .single();
        if (cErr) continue;
        // Relaciona como acompanhante
        if (newClient?.id) {
          await supabase.from("client_relationships").insert({
            client_id_a: clientId,
            client_id_b: newClient.id,
            relationship_type: "other",
            relationship_label: "Acompanhante de viagem",
          });
          if (c.passport_number || c.passport_expiry) {
            await supabase.from("client_passports").insert({
              client_id: newClient.id,
              passport_number: c.passport_number || null,
              expiry_date: c.passport_expiry || null,
              nationality: c.passport_country || null,
              status: "valid",
            });
          }
        }
      }

      toast({ title: "Dados salvos", description: "Informações dos viajantes registradas com sucesso." });
      onCompleted?.();
      onOpenChange(false);
    } catch (err: any) {
      toast({ title: "Erro ao salvar", description: err.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 font-display">
            <Plane className="h-5 w-5 text-gold" />
            Complete os dados para emissão
          </DialogTitle>
          <DialogDescription className="font-body">
            Cotação concluída! O contato foi promovido a <strong>Cliente</strong>.
          </DialogDescription>
        </DialogHeader>

        <Alert className="border-gold/40 bg-gold/5">
          <Info className="h-4 w-4 text-gold" />
          <AlertDescription className="text-sm font-body">
            Os dados abaixo são <strong>necessários</strong> para emissão de passagens, reservas de hospedagem e demais serviços da viagem.
            Você pode completar agora ou clicar em "Salvar mais tarde" para preencher depois pela ficha do cliente.
          </AlertDescription>
        </Alert>

        <div className="space-y-4 mt-2">
          {travelers.map((t, i) => (
            <div key={i} className="border rounded-lg p-4 space-y-3 bg-muted/30">
              <div className="flex items-center justify-between">
                <h4 className="font-semibold text-sm font-display">
                  {i === 0 ? "Titular" : `Viajante ${i + 1}`}
                </h4>
                {i > 0 && (
                  <Button type="button" size="sm" variant="ghost" onClick={() => removeTraveler(i)}>
                    <Trash2 className="h-4 w-4" />
                  </Button>
                )}
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div className="md:col-span-2">
                  <Label className="text-xs">Nome completo *</Label>
                  <Input value={t.full_name} onChange={(e) => updateTraveler(i, { full_name: e.target.value })} />
                </div>
                <div>
                  <Label className="text-xs">CPF</Label>
                  <Input value={t.cpf} onChange={(e) => updateTraveler(i, { cpf: e.target.value })} placeholder="000.000.000-00" />
                </div>
                <div>
                  <Label className="text-xs">Data de nascimento</Label>
                  <Input type="date" value={t.birth_date} onChange={(e) => updateTraveler(i, { birth_date: e.target.value })} />
                </div>
                <div>
                  <Label className="text-xs">Nº do passaporte</Label>
                  <Input value={t.passport_number} onChange={(e) => updateTraveler(i, { passport_number: e.target.value })} />
                </div>
                <div>
                  <Label className="text-xs">Validade do passaporte</Label>
                  <Input type="date" value={t.passport_expiry} onChange={(e) => updateTraveler(i, { passport_expiry: e.target.value })} />
                </div>
                <div>
                  <Label className="text-xs">País emissor do passaporte</Label>
                  <Input value={t.passport_country} onChange={(e) => updateTraveler(i, { passport_country: e.target.value })} />
                </div>
                <div>
                  <Label className="text-xs">E-mail</Label>
                  <Input type="email" value={t.email} onChange={(e) => updateTraveler(i, { email: e.target.value })} />
                </div>
                <div className="md:col-span-2">
                  <Label className="text-xs">Endereço completo</Label>
                  <Textarea rows={2} value={t.address} onChange={(e) => updateTraveler(i, { address: e.target.value })} />
                </div>
              </div>
            </div>
          ))}

          <Button type="button" variant="outline" size="sm" onClick={addTraveler} className="w-full">
            <Plus className="h-4 w-4 mr-2" /> Adicionar viajante
          </Button>
        </div>

        <DialogFooter className="gap-2">
          <Button type="button" variant="ghost" onClick={() => onOpenChange(false)} disabled={saving}>
            Salvar mais tarde
          </Button>
          <Button type="button" onClick={handleSave} disabled={saving} className="bg-gold hover:bg-gold/90 text-primary">
            {saving ? "Salvando..." : "Salvar dados"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default ClientDataCompletionDialog;
