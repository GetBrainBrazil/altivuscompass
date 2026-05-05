import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import {
  MessageCircle,
  RefreshCw,
  Loader2,
  Copy,
  Check,
  Unplug,
  MessageSquare,
  Clock,
} from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

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
  if (!data?.value) return null;
  const v: string = data.value;
  return v.startsWith("data:") ? v : `data:image/png;base64,${v}`;
}

export default function WhatsAppConnectionPanel() {
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
      setQrCode(await fetchQrCode());
    } catch (e) {
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

  return (
    <section className="bg-white rounded-xl border border-border/60 shadow-sm overflow-hidden">
      <div className="px-8 py-5 border-b border-border/60">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
          Conexão WhatsApp
        </h2>
        <p className="text-xs text-muted-foreground mt-1">
          Gerencie a conexão com seu número de WhatsApp.
        </p>
      </div>
      <div className="p-8">
        <div className="max-w-[600px] mx-auto bg-white rounded-xl border border-gray-200 shadow-[0_1px_3px_rgba(0,0,0,0.08)] p-8">
          {isLoading || !status ? (
            <LoadingView />
          ) : isConnected ? (
            <ConnectedView
              status={status}
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
    </section>
  );
}

function LoadingView() {
  return (
    <div className="space-y-5" role="status" aria-busy="true">
      <div className="flex items-center gap-4">
        <Skeleton className="h-[72px] w-[72px] rounded-full" />
        <div className="flex-1 space-y-2">
          <Skeleton className="h-5 w-40" />
          <Skeleton className="h-4 w-32" />
          <Skeleton className="h-5 w-24 rounded-full" />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <Skeleton className="h-12 rounded-md" />
        <Skeleton className="h-12 rounded-md" />
      </div>
      <Skeleton className="h-8 w-full" />
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
  const [copied, setCopied] = useState(false);

  const copyInstanceId = async () => {
    try {
      await navigator.clipboard.writeText(instanceId);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      toast.error("Não foi possível copiar");
    }
  };

  const truncatedId =
    instanceId.length > 14
      ? `${instanceId.slice(0, 8)}…${instanceId.slice(-4)}`
      : instanceId;

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-4">
        {device.imgUrl ? (
          <img
            src={device.imgUrl}
            alt={device.name ?? "Perfil WhatsApp"}
            className="h-[72px] w-[72px] rounded-full object-cover ring-[3px] ring-emerald-500"
          />
        ) : (
          <div className="h-[72px] w-[72px] rounded-full bg-emerald-50 ring-[3px] ring-emerald-500 flex items-center justify-center">
            <MessageCircle className="h-8 w-8 text-emerald-600" />
          </div>
        )}
        <div className="flex-1 min-w-0">
          <div className="text-[18px] font-semibold text-foreground truncate">
            {device.name ?? "WhatsApp Conectado"}
          </div>
          {device.formattedPhone && (
            <div className="text-sm text-gray-500 mt-0.5">{device.formattedPhone}</div>
          )}
          <div className="mt-2 inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-medium text-emerald-700">
            <span className="relative flex h-1.5 w-1.5">
              <span className="absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75 animate-ping" />
              <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-emerald-500" />
            </span>
            Conectado
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <InfoPill label="ID da Instância">
          <span className="font-mono text-[13px] text-gray-700 truncate">{truncatedId}</span>
          <TooltipProvider>
            <Tooltip open={copied ? true : undefined}>
              <TooltipTrigger asChild>
                <button
                  type="button"
                  onClick={copyInstanceId}
                  className="ml-1 p-1 rounded hover:bg-gray-200 text-gray-500"
                  aria-label="Copiar ID"
                >
                  {copied ? (
                    <Check className="h-3.5 w-3.5 text-emerald-600" />
                  ) : (
                    <Copy className="h-3.5 w-3.5" />
                  )}
                </button>
              </TooltipTrigger>
              <TooltipContent>{copied ? "Copiado!" : "Copiar"}</TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </InfoPill>
        <InfoPill label="Nome da Instância">
          <span className="text-[13px] text-gray-700 truncate">{device.name ?? "—"}</span>
        </InfoPill>
      </div>

      <div className="flex items-center gap-3 text-[12px] text-gray-500 pt-1">
        <div className="flex items-center gap-1.5">
          <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
          <span>Online</span>
        </div>
        <span className="h-3 w-px bg-gray-200" />
        <div className="flex items-center gap-1.5">
          <MessageSquare className="h-3.5 w-3.5" />
          <span>Mensagens hoje: —</span>
        </div>
        <span className="h-3 w-px bg-gray-200" />
        <div className="flex items-center gap-1.5">
          <Clock className="h-3.5 w-3.5" />
          <span>Última: —</span>
        </div>
      </div>

      <div className="flex items-center justify-end gap-2 pt-2 border-t border-gray-100">
        <button
          type="button"
          onClick={onRestart}
          disabled={loading}
          className="inline-flex items-center gap-1.5 rounded-lg border border-gray-300 bg-white px-4 py-2 text-[13px] font-medium text-gray-600 hover:border-gray-400 hover:bg-gray-50 disabled:opacity-50 transition-colors"
        >
          {loading ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <RefreshCw className="h-3.5 w-3.5" />
          )}
          Reiniciar Conexão
        </button>
        <button
          type="button"
          onClick={onDisconnect}
          disabled={loading}
          className="inline-flex items-center gap-1.5 rounded-lg px-4 py-2 text-[13px] font-medium text-red-500 hover:bg-red-50 disabled:opacity-50 transition-colors"
        >
          <Unplug className="h-3.5 w-3.5" />
          Desconectar
        </button>
      </div>
    </div>
  );
}

function InfoPill({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="rounded-md bg-gray-50 px-3 py-2">
      <div className="text-[10px] font-semibold uppercase tracking-wider text-gray-400">
        {label}
      </div>
      <div className="mt-1 flex items-center gap-1">{children}</div>
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
    <div className="flex flex-col items-center text-center space-y-5">
      <div className="h-20 w-20 rounded-full bg-gray-100 flex items-center justify-center">
        <MessageCircle className="h-9 w-9 text-gray-400" />
      </div>
      <div>
        <h2 className="text-base font-semibold text-gray-600">Nenhum WhatsApp conectado</h2>
        <p className="text-sm text-gray-400 mt-1">
          Escaneie o QR Code para conectar seu número
        </p>
      </div>

      <div className="h-[200px] w-[200px] rounded-lg border border-gray-200 bg-white p-3 shadow-sm flex items-center justify-center">
        {qrLoading && !qrCode ? (
          <Loader2 className="h-8 w-8 text-gray-400 animate-spin" />
        ) : qrCode ? (
          <img src={qrCode} alt="QR Code WhatsApp" className="h-full w-full" />
        ) : (
          <span className="text-xs text-gray-400 px-4">QR Code indisponível</span>
        )}
      </div>

      <div className="flex items-center gap-2 text-xs text-gray-500">
        <Loader2 className="h-3 w-3 animate-spin" />
        Aguardando conexão...
      </div>

      <Button variant="outline" size="sm" onClick={onRefreshQr} disabled={qrLoading}>
        {qrLoading ? (
          <Loader2 className="h-3.5 w-3.5 mr-2 animate-spin" />
        ) : (
          <RefreshCw className="h-3.5 w-3.5 mr-2" />
        )}
        Gerar novo QR Code
      </Button>
    </div>
  );
}
