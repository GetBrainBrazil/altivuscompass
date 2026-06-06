import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2, CheckCircle2, XCircle, MailX } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

type State = "loading" | "valid" | "already" | "invalid" | "submitting" | "success" | "error";

export default function Unsubscribe() {
  const [params] = useSearchParams();
  const token = params.get("token");
  const [state, setState] = useState<State>("loading");

  useEffect(() => {
    if (!token) {
      setState("invalid");
      return;
    }
    const url = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/handle-email-unsubscribe?token=${encodeURIComponent(token)}`;
    fetch(url, { headers: { apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY } })
      .then((r) => r.json())
      .then((d) => {
        if (d.valid) setState("valid");
        else if (d.reason === "already_unsubscribed") setState("already");
        else setState("invalid");
      })
      .catch(() => setState("invalid"));
  }, [token]);

  const confirm = async () => {
    setState("submitting");
    const { data, error } = await supabase.functions.invoke("handle-email-unsubscribe", {
      body: { token },
    });
    if (error || !data?.success) {
      if (data?.reason === "already_unsubscribed") setState("already");
      else setState("error");
    } else {
      setState("success");
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle className="font-display flex items-center gap-2">
            <MailX className="h-5 w-5 text-primary" />
            Cancelar inscrição
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {state === "loading" && (
            <div className="flex items-center gap-2 text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" /> Validando link...
            </div>
          )}
          {state === "valid" && (
            <>
              <p className="text-sm text-muted-foreground">
                Confirme abaixo para deixar de receber e-mails do Altivus Compass.
              </p>
              <Button onClick={confirm} className="w-full">Confirmar cancelamento</Button>
            </>
          )}
          {state === "submitting" && (
            <div className="flex items-center gap-2 text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" /> Processando...
            </div>
          )}
          {state === "success" && (
            <div className="flex items-start gap-2 text-sm">
              <CheckCircle2 className="h-5 w-5 text-success mt-0.5" />
              <p>Inscrição cancelada. Você não receberá mais e-mails deste endereço.</p>
            </div>
          )}
          {state === "already" && (
            <div className="flex items-start gap-2 text-sm text-muted-foreground">
              <CheckCircle2 className="h-5 w-5 mt-0.5" />
              <p>Este endereço já estava cancelado.</p>
            </div>
          )}
          {state === "invalid" && (
            <div className="flex items-start gap-2 text-sm text-destructive">
              <XCircle className="h-5 w-5 mt-0.5" />
              <p>Link inválido ou expirado.</p>
            </div>
          )}
          {state === "error" && (
            <div className="flex items-start gap-2 text-sm text-destructive">
              <XCircle className="h-5 w-5 mt-0.5" />
              <p>Não foi possível processar. Tente novamente.</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
