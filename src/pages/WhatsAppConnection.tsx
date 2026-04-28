import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import {
  ArrowLeft,
  MessageCircle,
  Smartphone,
  Link2,
  ScanLine,
  RefreshCw,
  ShieldCheck,
  Wifi,
  Phone,
  PowerOff,
  Loader2,
  BatteryMedium,
} from "lucide-react";

type StatusResponse = {
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
  instanceId: string;
  statusRaw?: any;
};

async function fetchStatus(): Promise<StatusResponse> {
  const { data, error } = await supabase.functions.invoke("whatsapp-status", {
    body: { action: "status" },
  });
  if (error) throw error;
  return data as StatusResponse;
}

async function fetchQrCode(): Promise<string | null> {
  const { data, error } = await supabase.functions.invoke("whatsapp-status", {
    body: { action: "qr-code" },
  });
  if (error) throw error;
  // Z-API returns { value: "data:image/png;base64,..." } or { value: "<base64>" }
  if (!data?.value) return null;
  const v: string = data.value;
  return v.startsWith("data:") ? v : `data:image/png;base64,${v}`;
}

export default function WhatsAppConnection() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [qrCode, setQrCode] = useState<string | null>(null);
  const [qrLoading, setQrLoading] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);

  const { data: status, isLoading, refetch } = useQuery({
    queryKey: ["whatsapp-status"],
    queryFn: fetchStatus,
    refetchInterval: 5000,
  });

  const isConnected = status?.connected === true;

  // Load QR when disconnected
  useEffect(() => {
    if (!status) return;
    if (isConnected) {
      setQrCode(null);
      return;
    }
    loadQr();
    const id = setInterval(loadQr, 20000);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isConnected]);

  const loadQr = async () => {
    setQrLoading(true);
    try {
      const qr = await fetchQrCode();
      setQrCode(qr);
    } catch (e: any) {
      console.error("QR load error", e);
    } finally {
      setQrLoading(false);
    }
  };

  const handleDisconnect = async () => {
    if (!confirm("Tem certeza que deseja desconectar o WhatsApp?")) return;
    setActionLoading(true);
    try {
      const { error } = await supabase.functions.invoke("whatsapp-status", {
        body: { action: "disconnect" },
      });
      if (error) throw error;
      toast.success("WhatsApp desconectado");
      await queryClient.invalidateQueries({ queryKey: ["whatsapp-status"] });
      setTimeout(() => refetch(), 1500);
    } catch (e: any) {
      toast.error("Erro ao desconectar", { description: e?.message });
    } finally {
      setActionLoading(false);
    }
  };

  const handleRestart = async () => {
    setActionLoading(true);
    try {
      const { error } = await supabase.functions.invoke("whatsapp-status", {
        body: { action: "restart" },
      });
      if (error) throw error;
      toast.success("Instância reiniciada");
      setTimeout(() => refetch(), 2000);
    } catch (e: any) {
      toast.error("Erro ao reiniciar", { description: e?.message });
    } finally {
      setActionLoading(false);
    }
  };

  const statusConfig = isLoading
    ? {
        label: "Verificando...",
        className: "bg-muted text-muted-foreground border-border",
        dot: "bg-muted-foreground",
      }
    : isConnected
    ? {
        label: "Conectado",
        className: "bg-emerald-100 text-emerald-700 border-emerald-200",
        dot: "bg-emerald-500",
      }
    : {
        label: "Desconectado",
        className: "bg-destructive/10 text-destructive border-destructive/20",
        dot: "bg-destructive",
      };

  return (
    <div className="min-h-screen bg-[hsl(220_15%_97%)]">
      <div className="max-w-[1200px] mx-auto px-8 py-10">
        {/* Header */}
        <header className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-4">
            <Button
              variant="ghost"
              size="icon"
              className="h-9 w-9"
              onClick={() => navigate("/ai-agents")}
              aria-label="Voltar"
            >
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <div className="flex items-center gap-3">
              <div className="h-11 w-11 rounded-xl bg-[hsl(142_70%_95%)] flex items-center justify-center">
                <MessageCircle className="h-5 w-5 text-[hsl(142_70%_40%)]" />
              </div>
              <div>
                <h1 className="text-2xl font-semibold tracking-tight text-foreground">
                  Conexão WhatsApp
                </h1>
                <p className="text-sm text-muted-foreground mt-0.5">
                  Conecte seu número para começar a atender pelos agentes IA
                </p>
              </div>
            </div>
          </div>

          <Badge
            variant="outline"
            className={`${statusConfig.className} font-medium px-3 py-1.5 gap-1.5`}
          >
            <span className={`h-1.5 w-1.5 rounded-full ${statusConfig.dot}`} />
            {statusConfig.label}
          </Badge>
        </header>

        {/* Main card */}
        <div className="bg-white rounded-2xl border border-border/60 shadow-sm overflow-hidden">
          {isConnected ? (
            <ConnectedView
              status={status!}
              onDisconnect={handleDisconnect}
              onRestart={handleRestart}
              loading={actionLoading}
            />
          ) : (
            <DisconnectedView
              qrCode={qrCode}
              qrLoading={qrLoading}
              onRefreshQr={loadQr}
            />
          )}
        </div>
      </div>
    </div>
  );
}

function ConnectedView({
  status,
  onDisconnect,
  onRestart,
  loading,
}: {
  status: StatusResponse;
  onDisconnect: () => void;
  onRestart: () => void;
  loading: boolean;
}) {
  const { device, instanceId } = status;
  return (
    <div className="p-10 flex flex-col items-center text-center">
      <div className="h-16 w-16 rounded-full bg-emerald-100 flex items-center justify-center mb-5">
        <Wifi className="h-8 w-8 text-emerald-600" />
      </div>
      <h2 className="text-xl font-semibold text-foreground">
        Instância Conectada e Ativa
      </h2>
      <p className="text-sm text-muted-foreground mt-1.5">
        O WhatsApp está conectado e pronto para receber mensagens.
      </p>

      {device.formattedPhone && (
        <div className="mt-6 inline-flex items-center gap-2 rounded-full bg-muted px-4 py-2 text-sm font-medium text-foreground">
          <Phone className="h-4 w-4 text-muted-foreground" />
          {device.formattedPhone}
        </div>
      )}

      <div className="mt-3 inline-flex items-center gap-2 text-xs text-emerald-600">
        <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
        Online
      </div>

      {/* Device details */}
      <div className="mt-8 grid grid-cols-2 md:grid-cols-4 gap-4 w-full max-w-2xl">
        <DetailCard label="ID da Instância" value={instanceId.slice(0, 12) + "..."} />
        {device.name && <DetailCard label="Nome" value={device.name} />}
        {device.platform && <DetailCard label="Plataforma" value={device.platform} />}
        {device.battery !== null && (
          <DetailCard
            label="Bateria"
            value={`${device.battery}%`}
            icon={<BatteryMedium className="h-3.5 w-3.5" />}
          />
        )}
      </div>

      <div className="mt-8 flex items-center gap-3">
        <Button
          variant="outline"
          size="sm"
          onClick={onRestart}
          disabled={loading}
        >
          {loading ? (
            <Loader2 className="h-3.5 w-3.5 mr-2 animate-spin" />
          ) : (
            <RefreshCw className="h-3.5 w-3.5 mr-2" />
          )}
          Reiniciar
        </Button>
        <Button
          variant="destructive"
          size="sm"
          onClick={onDisconnect}
          disabled={loading}
        >
          {loading ? (
            <Loader2 className="h-3.5 w-3.5 mr-2 animate-spin" />
          ) : (
            <PowerOff className="h-3.5 w-3.5 mr-2" />
          )}
          Desconectar
        </Button>
      </div>
    </div>
  );
}

function DetailCard({
  label,
  value,
  icon,
}: {
  label: string;
  value: string;
  icon?: React.ReactNode;
}) {
  return (
    <div className="rounded-lg border border-border/60 bg-[hsl(220_15%_98.5%)] p-3 text-left">
      <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">
        {label}
      </p>
      <p className="text-sm font-medium text-foreground mt-1 flex items-center gap-1.5 truncate">
        {icon}
        {value}
      </p>
    </div>
  );
}

function DisconnectedView({
  qrCode,
  qrLoading,
  onRefreshQr,
}: {
  qrCode: string | null;
  qrLoading: boolean;
  onRefreshQr: () => void;
}) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-0">
      <div className="p-10 border-b md:border-b-0 md:border-r border-border/60">
        <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-6">
          Como conectar
        </h3>
        <ol className="space-y-6">
          <li className="flex gap-4">
            <div className="flex-shrink-0 h-10 w-10 rounded-full bg-muted flex items-center justify-center font-semibold text-foreground">
              1
            </div>
            <div className="pt-2">
              <div className="flex items-center gap-2 text-sm font-medium text-foreground">
                <Smartphone className="h-4 w-4 text-muted-foreground" />
                Abra o WhatsApp no celular
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                Use o aparelho onde sua conta está ativa
              </p>
            </div>
          </li>
          <li className="flex gap-4">
            <div className="flex-shrink-0 h-10 w-10 rounded-full bg-muted flex items-center justify-center font-semibold text-foreground">
              2
            </div>
            <div className="pt-2">
              <div className="flex items-center gap-2 text-sm font-medium text-foreground">
                <Link2 className="h-4 w-4 text-muted-foreground" />
                Toque em Aparelhos Conectados
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                Acesse pelo menu de configurações
              </p>
            </div>
          </li>
          <li className="flex gap-4">
            <div className="flex-shrink-0 h-10 w-10 rounded-full bg-muted flex items-center justify-center font-semibold text-foreground">
              3
            </div>
            <div className="pt-2">
              <div className="flex items-center gap-2 text-sm font-medium text-foreground">
                <ScanLine className="h-4 w-4 text-muted-foreground" />
                Aponte a câmera para o QR Code
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                A conexão será estabelecida automaticamente
              </p>
            </div>
          </li>
        </ol>

        <div className="mt-8 flex items-start gap-3 rounded-lg bg-[hsl(220_15%_97%)] border border-border/60 p-4">
          <ShieldCheck className="h-4 w-4 text-muted-foreground flex-shrink-0 mt-0.5" />
          <p className="text-xs text-muted-foreground leading-relaxed">
            Suas mensagens são criptografadas de ponta a ponta. A Altivus não
            armazena suas conversas pessoais.
          </p>
        </div>
      </div>

      <div className="p-10 flex flex-col items-center justify-center bg-[hsl(220_15%_98.5%)]">
        <div className="relative aspect-square w-full max-w-[320px] rounded-2xl border border-border/60 bg-white p-5 shadow-sm flex items-center justify-center">
          {qrLoading && !qrCode ? (
            <Loader2 className="h-10 w-10 text-muted-foreground animate-spin" />
          ) : qrCode ? (
            <img src={qrCode} alt="QR Code Z-API" className="h-full w-full" />
          ) : (
            <div className="text-center text-sm text-muted-foreground px-6">
              Não foi possível carregar o QR Code. Tente atualizar.
            </div>
          )}
        </div>

        <div className="mt-5 text-center">
          <p className="text-xs text-muted-foreground">
            O QR Code é renovado automaticamente a cada 20s
          </p>
          <Button
            variant="ghost"
            size="sm"
            className="mt-2 text-foreground hover:bg-muted"
            onClick={onRefreshQr}
            disabled={qrLoading}
          >
            {qrLoading ? (
              <Loader2 className="h-3.5 w-3.5 mr-2 animate-spin" />
            ) : (
              <RefreshCw className="h-3.5 w-3.5 mr-2" />
            )}
            Atualizar QR Code
          </Button>
        </div>
      </div>
    </div>
  );
}
