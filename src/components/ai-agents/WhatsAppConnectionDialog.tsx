import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { MessageCircle, Smartphone, Link2, ScanLine, RefreshCw } from "lucide-react";
import { useEffect, useState } from "react";

interface WhatsAppConnectionDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

type Status = "disconnected" | "connecting" | "connected";

// Placeholder QR pattern (data URL of a generated PNG would normally come from backend)
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

export function WhatsAppConnectionDialog({ open, onOpenChange }: WhatsAppConnectionDialogProps) {
  const [status, setStatus] = useState<Status>("disconnected");
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    if (open) {
      setStatus("disconnected");
      setRefreshKey((k) => k + 1);
    }
  }, [open]);

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
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl bg-white rounded-2xl p-0 overflow-hidden">
        <DialogHeader className="px-8 pt-8 pb-4">
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-xl bg-[hsl(142_70%_95%)] flex items-center justify-center">
                <MessageCircle className="h-5 w-5 text-[hsl(142_70%_40%)]" />
              </div>
              <div>
                <DialogTitle className="text-xl font-semibold tracking-tight">
                  Conexão WhatsApp
                </DialogTitle>
                <p className="text-sm text-muted-foreground mt-0.5">
                  Conecte seu número para começar a atender
                </p>
              </div>
            </div>
            <Badge
              variant="outline"
              className={`${statusConfig.className} font-medium px-3 py-1 mr-8 gap-1.5`}
            >
              <span className={`h-1.5 w-1.5 rounded-full ${statusConfig.dot}`} />
              {statusConfig.label}
            </Badge>
          </div>
        </DialogHeader>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 px-8 pb-8 pt-2">
          {/* Instructions */}
          <div className="flex flex-col justify-center">
            <h3 className="text-sm font-semibold text-foreground mb-5 uppercase tracking-wide">
              Como conectar
            </h3>
            <ol className="space-y-5">
              <li className="flex gap-4">
                <div className="flex-shrink-0 h-9 w-9 rounded-full bg-muted flex items-center justify-center font-semibold text-sm text-foreground">
                  1
                </div>
                <div className="pt-1.5">
                  <div className="flex items-center gap-2 text-sm font-medium text-foreground">
                    <Smartphone className="h-4 w-4 text-muted-foreground" />
                    Abra o WhatsApp no celular
                  </div>
                </div>
              </li>
              <li className="flex gap-4">
                <div className="flex-shrink-0 h-9 w-9 rounded-full bg-muted flex items-center justify-center font-semibold text-sm text-foreground">
                  2
                </div>
                <div className="pt-1.5">
                  <div className="flex items-center gap-2 text-sm font-medium text-foreground">
                    <Link2 className="h-4 w-4 text-muted-foreground" />
                    Toque em Aparelhos Conectados
                  </div>
                </div>
              </li>
              <li className="flex gap-4">
                <div className="flex-shrink-0 h-9 w-9 rounded-full bg-muted flex items-center justify-center font-semibold text-sm text-foreground">
                  3
                </div>
                <div className="pt-1.5">
                  <div className="flex items-center gap-2 text-sm font-medium text-foreground">
                    <ScanLine className="h-4 w-4 text-muted-foreground" />
                    Aponte a câmera para o QR Code
                  </div>
                </div>
              </li>
            </ol>

            <div className="mt-8 rounded-lg bg-[hsl(220_15%_97%)] border border-border/60 p-3 text-xs text-muted-foreground leading-relaxed">
              O QR Code expira em 60 segundos. Caso expire, clique em atualizar
              para gerar um novo código.
            </div>
          </div>

          {/* QR Code */}
          <div className="flex flex-col items-center justify-center">
            <div className="relative aspect-square w-full max-w-[280px] rounded-2xl border border-border/60 bg-white p-4 shadow-sm">
              <img
                key={refreshKey}
                src={QR_PLACEHOLDER}
                alt="QR Code de conexão WhatsApp"
                className="h-full w-full"
              />
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                <div className="h-12 w-12 rounded-xl bg-white flex items-center justify-center shadow-md border border-border/60">
                  <MessageCircle className="h-6 w-6 text-[hsl(142_70%_40%)]" />
                </div>
              </div>
            </div>

            <Button
              variant="ghost"
              size="sm"
              className="mt-4 text-muted-foreground hover:text-foreground"
              onClick={() => setRefreshKey((k) => k + 1)}
            >
              <RefreshCw className="h-3.5 w-3.5 mr-2" />
              Atualizar QR Code
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
