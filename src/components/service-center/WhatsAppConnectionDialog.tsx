import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import {
  RefreshCw,
  Smartphone,
  CheckCircle2,
  XCircle,
  QrCode,
  Power,
  Loader2,
} from "lucide-react";

interface Props {
  open: boolean;
  onOpenChange: (o: boolean) => void;
}

interface StatusResp {
  connected: boolean;
  smartphoneConnected: boolean;
  session: boolean;
  device: {
    phone: string | null;
    formattedPhone: string | null;
    name: string | null;
    imgUrl: string | null;
    battery: number | null;
    platform: string | null;
    deviceManufacturer: string | null;
    deviceModel: string | null;
  };
  instanceId?: string;
}

export function WhatsAppConnectionDialog({ open, onOpenChange }: Props) {
  const [status, setStatus] = useState<StatusResp | null>(null);
  const [loading, setLoading] = useState(false);
  const [qrCode, setQrCode] = useState<string | null>(null);
  const [qrLoading, setQrLoading] = useState(false);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  const fetchStatus = useCallback(async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("whatsapp-status", {
        body: { action: "status" },
      });
      if (error) throw error;
      setStatus(data as StatusResp);
    } catch (e: any) {
      toast.error("Erro ao consultar status: " + (e?.message ?? "desconhecido"));
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchQrCode = useCallback(async () => {
    setQrLoading(true);
    setQrCode(null);
    try {
      const { data, error } = await supabase.functions.invoke("whatsapp-status", {
        body: { action: "qr-code" },
      });
      if (error) throw error;
      const img = (data as any)?.value ?? (data as any)?.qrcode ?? (data as any)?.image;
      if (img) {
        setQrCode(img.startsWith("data:") ? img : `data:image/png;base64,${img}`);
      } else if ((data as any)?.connected) {
        toast.success("WhatsApp já está conectado.");
        await fetchStatus();
      } else {
        toast.error("Não foi possível obter o QR Code.");
      }
    } catch (e: any) {
      toast.error("Erro ao gerar QR Code: " + (e?.message ?? "desconhecido"));
    } finally {
      setQrLoading(false);
    }
  }, [fetchStatus]);

  const handleAction = async (action: "disconnect" | "restart") => {
    setActionLoading(action);
    try {
      const { error } = await supabase.functions.invoke("whatsapp-status", {
        body: { action },
      });
      if (error) throw error;
      toast.success(action === "disconnect" ? "Desconectado." : "Instância reiniciada.");
      setQrCode(null);
      setTimeout(fetchStatus, 1500);
    } catch (e: any) {
      toast.error("Falha: " + (e?.message ?? "desconhecido"));
    } finally {
      setActionLoading(null);
    }
  };

  useEffect(() => {
    if (open) {
      setQrCode(null);
      fetchStatus();
    }
  }, [open, fetchStatus]);

  // Auto-refresh while showing QR code
  useEffect(() => {
    if (!open || !qrCode) return;
    const interval = setInterval(fetchStatus, 4000);
    return () => clearInterval(interval);
  }, [open, qrCode, fetchStatus]);

  // Close QR view when becomes connected
  useEffect(() => {
    if (qrCode && status?.connected) setQrCode(null);
  }, [status, qrCode]);

  const isConnected = status?.connected && status?.smartphoneConnected;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Conexão do WhatsApp</DialogTitle>
          <DialogDescription>
            Gerencie a conexão do WhatsApp usada pela Central de Atendimento.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {loading && !status ? (
            <div className="space-y-2">
              <Skeleton className="h-12 w-full" />
              <Skeleton className="h-12 w-full" />
            </div>
          ) : status ? (
            <>
              {/* Status card */}
              <div className="rounded-lg border p-4 space-y-3 bg-muted/30">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Status</span>
                  {isConnected ? (
                    <Badge className="bg-success text-white hover:bg-success/90 gap-1">
                      <CheckCircle2 className="h-3 w-3" />
                      Conectado
                    </Badge>
                  ) : (
                    <Badge variant="destructive" className="gap-1">
                      <XCircle className="h-3 w-3" />
                      Desconectado
                    </Badge>
                  )}
                </div>

                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Smartphone</span>
                  <span className="text-sm font-medium">
                    {status.smartphoneConnected ? "Pareado" : "Não pareado"}
                  </span>
                </div>

                {status.device?.formattedPhone && (
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">Número</span>
                    <span className="text-sm font-medium">{status.device.formattedPhone}</span>
                  </div>
                )}

                {status.device?.name && (
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">Nome</span>
                    <span className="text-sm font-medium truncate max-w-[200px]">
                      {status.device.name}
                    </span>
                  </div>
                )}

                {status.device?.battery != null && (
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">Bateria</span>
                    <span className="text-sm font-medium">{status.device.battery}%</span>
                  </div>
                )}

                {(status.device?.deviceManufacturer || status.device?.deviceModel) && (
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">Dispositivo</span>
                    <span className="text-sm font-medium truncate max-w-[200px]">
                      {[status.device.deviceManufacturer, status.device.deviceModel]
                        .filter(Boolean)
                        .join(" ")}
                    </span>
                  </div>
                )}
              </div>

              {/* QR Code panel */}
              {qrCode && (
                <div className="rounded-lg border p-4 flex flex-col items-center gap-3 bg-white">
                  <p className="text-sm text-muted-foreground text-center">
                    Abra o WhatsApp no seu celular, vá em{" "}
                    <strong>Aparelhos conectados</strong> e escaneie o código:
                  </p>
                  <img src={qrCode} alt="QR Code" className="w-56 h-56" />
                  <p className="text-[11px] text-muted-foreground">
                    Atualizando status automaticamente...
                  </p>
                </div>
              )}

              {/* Actions */}
              <div className="flex flex-wrap gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={fetchStatus}
                  disabled={loading}
                  className="gap-1.5"
                >
                  <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
                  Atualizar
                </Button>

                {!isConnected && (
                  <Button
                    size="sm"
                    onClick={fetchQrCode}
                    disabled={qrLoading}
                    className="gap-1.5 bg-[hsl(var(--navy))] text-[hsl(var(--cream))] hover:bg-[hsl(var(--navy))]/90"
                  >
                    {qrLoading ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <QrCode className="h-3.5 w-3.5" />
                    )}
                    Mostrar QR Code
                  </Button>
                )}

                {isConnected && (
                  <>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleAction("restart")}
                      disabled={actionLoading === "restart"}
                      className="gap-1.5"
                    >
                      {actionLoading === "restart" ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      ) : (
                        <Power className="h-3.5 w-3.5" />
                      )}
                      Reiniciar
                    </Button>
                    <Button
                      variant="destructive"
                      size="sm"
                      onClick={() => handleAction("disconnect")}
                      disabled={actionLoading === "disconnect"}
                      className="gap-1.5"
                    >
                      {actionLoading === "disconnect" ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      ) : (
                        <Smartphone className="h-3.5 w-3.5" />
                      )}
                      Desconectar
                    </Button>
                  </>
                )}
              </div>
            </>
          ) : (
            <p className="text-sm text-muted-foreground">Sem dados.</p>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
