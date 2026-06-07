import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { Check, Clock, AlertTriangle, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

type State =
  | { kind: "loading" }
  | { kind: "ok"; action: "complete" | "snooze"; minutes?: number; taskTitle?: string | null; taskId?: string; alreadyUsed?: boolean }
  | { kind: "error"; message: string };

export default function ReminderAction() {
  const { code } = useParams<{ code: string }>();
  const [state, setState] = useState<State>({ kind: "loading" });

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!code) {
        setState({ kind: "error", message: "Código ausente." });
        return;
      }
      const { data, error } = await supabase.functions.invoke("task-reminder-action", {
        body: { code },
      });
      if (cancelled) return;
      if (error || !data?.ok) {
        setState({ kind: "error", message: (data?.error as string) || error?.message || "Não foi possível processar." });
        return;
      }
      setState({
        kind: "ok",
        action: data.action,
        minutes: data.minutes,
        taskTitle: data.taskTitle,
        taskId: data.taskId,
        alreadyUsed: !!data.alreadyUsed,
      });
    })();
    return () => {
      cancelled = true;
    };
  }, [code]);

  return (
    <div className="min-h-screen bg-background flex items-center justify-center px-4 py-10">
      <div className="w-full max-w-md rounded-2xl border border-border bg-card shadow-sm p-8 text-center">
        <div className="mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-full bg-primary/10 text-primary">
          {state.kind === "loading" && <Loader2 className="h-7 w-7 animate-spin" />}
          {state.kind === "ok" && state.action === "complete" && <Check className="h-7 w-7" />}
          {state.kind === "ok" && state.action === "snooze" && <Clock className="h-7 w-7" />}
          {state.kind === "error" && <AlertTriangle className="h-7 w-7 text-destructive" />}
        </div>

        {state.kind === "loading" && (
          <>
            <h1 className="font-serif text-2xl text-foreground">Processando…</h1>
            <p className="mt-2 text-sm text-muted-foreground">Aguarde um instante.</p>
          </>
        )}

        {state.kind === "ok" && state.action === "complete" && (
          <>
            <h1 className="font-serif text-2xl text-foreground">
              {state.alreadyUsed ? "Já estava concluída" : "Tarefa concluída"}
            </h1>
            {state.taskTitle && (
              <p className="mt-2 text-sm text-muted-foreground">{state.taskTitle}</p>
            )}
            <p className="mt-4 text-sm text-foreground">Tudo certo! ✅</p>
          </>
        )}

        {state.kind === "ok" && state.action === "snooze" && (
          <>
            <h1 className="font-serif text-2xl text-foreground">
              {state.alreadyUsed ? "Adiamento já registrado" : `Lembrete adiado por ${state.minutes ?? 30} min`}
            </h1>
            {state.taskTitle && (
              <p className="mt-2 text-sm text-muted-foreground">{state.taskTitle}</p>
            )}
            <p className="mt-4 text-sm text-foreground">Você receberá um novo aviso em breve. ⏰</p>
          </>
        )}

        {state.kind === "error" && (
          <>
            <h1 className="font-serif text-2xl text-destructive">Não foi possível processar</h1>
            <p className="mt-2 text-sm text-muted-foreground">{state.message}</p>
          </>
        )}

        {state.kind === "ok" && state.taskId && (
          <Link
            to={`/tasks/${state.taskId}`}
            className="mt-6 inline-flex items-center justify-center rounded-md bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground hover:opacity-90"
          >
            Abrir tarefa
          </Link>
        )}
      </div>
    </div>
  );
}
