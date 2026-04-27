import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  ArrowLeft,
  MessageCircle,
  Smartphone,
  Link2,
  ScanLine,
  RefreshCw,
  ShieldCheck,
} from "lucide-react";

type Status = "disconnected" | "connecting" | "connected";

const QR_PLACEHOLDER =
  "data:image/svg+xml;utf8," +
  encodeURIComponent(`
<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 200 200' shape-rendering='crispEdges'>
  <rect width='200' height='200' fill='white'/>
  ${Array.from({ length: 25 })
    .map((_, y) =>
      Array.from({ length: 25 })
        .map((__, x) => {
          const seed = (x * 31 + y * 17) % 7;
          return seed < 3
            ? `<rect x='${x * 8}' y='${y * 8}' width='8' height='8' fill='black'/>`
            : "";
        })
        .join("")
    )
    .join("")}
  <rect x='0' y='0' width='56' height='56' fill='white'/>
  <rect x='0' y='0' width='56' height='56' fill='none' stroke='black' stroke-width='8'/>
  <rect x='16' y='16' width='24' height='24' fill='black'/>
  <rect x='144' y='0' width='56' height='56' fill='white'/>
  <rect x='144' y='0' width='56' height='56' fill='none' stroke='black' stroke-width='8'/>
  <rect x='160' y='16' width='24' height='24' fill='black'/>
  <rect x='0' y='144' width='56' height='56' fill='white'/>
  <rect x='0' y='144' width='56' height='56' fill='none' stroke='black' stroke-width='8'/>
  <rect x='16' y='160' width='24' height='24' fill='black'/>
</svg>`);

export default function WhatsAppConnection() {
  const navigate = useNavigate();
  const [status, setStatus] = useState<Status>("disconnected");
  const [refreshKey, setRefreshKey] = useState(0);
  const [secondsLeft, setSecondsLeft] = useState(60);

  useEffect(() => {
    setSecondsLeft(60);
    const interval = setInterval(() => {
      setSecondsLeft((s) => (s > 0 ? s - 1 : 0));
    }, 1000);
    return () => clearInterval(interval);
  }, [refreshKey]);

  const statusConfig = {
    disconnected: {
      label: "Desconectado",
      className: "bg-destructive/10 text-destructive border-destructive/20",
      dot: "bg-destructive",
    },
    connecting: {
      label: "Conectando...",
      className: "bg-amber-100 text-amber-700 border-amber-200",
      dot: "bg-amber-500",
    },
    connected: {
      label: "Conectado",
      className: "bg-emerald-100 text-emerald-700 border-emerald-200",
      dot: "bg-emerald-500",
    },
  }[status];

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
          <div className="grid grid-cols-1 md:grid-cols-2 gap-0">
            {/* Instructions */}
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
                  Suas mensagens são criptografadas de ponta a ponta. A Altivus
                  não armazena suas conversas pessoais.
                </p>
              </div>
            </div>

            {/* QR Code */}
            <div className="p-10 flex flex-col items-center justify-center bg-[hsl(220_15%_98.5%)]">
              <div className="relative aspect-square w-full max-w-[320px] rounded-2xl border border-border/60 bg-white p-5 shadow-sm">
                <img
                  key={refreshKey}
                  src={QR_PLACEHOLDER}
                  alt="QR Code de conexão WhatsApp"
                  className="h-full w-full"
                />
                <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                  <div className="h-14 w-14 rounded-xl bg-white flex items-center justify-center shadow-md border border-border/60">
                    <MessageCircle className="h-7 w-7 text-[hsl(142_70%_40%)]" />
                  </div>
                </div>
              </div>

              <div className="mt-5 text-center">
                <p className="text-xs text-muted-foreground">
                  {secondsLeft > 0
                    ? `O QR Code expira em ${secondsLeft}s`
                    : "QR Code expirado"}
                </p>
                <Button
                  variant="ghost"
                  size="sm"
                  className="mt-2 text-foreground hover:bg-muted"
                  onClick={() => setRefreshKey((k) => k + 1)}
                >
                  <RefreshCw className="h-3.5 w-3.5 mr-2" />
                  Atualizar QR Code
                </Button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
