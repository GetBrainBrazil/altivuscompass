import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Sparkles, Send, Loader2, AlertCircle } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient } from "@tanstack/react-query";

interface Props {
  itineraryId: string;
  aiStatus: string | null;
  onStatusChange: (status: string) => void;
}

export default function ItineraryAIPanel({ itineraryId, aiStatus, onStatusChange }: Props) {
  const queryClient = useQueryClient();
  const [chatMessage, setChatMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const [lastResult, setLastResult] = useState<{ summary?: string; tips?: string[]; days_count?: number } | null>(null);

  const generate = async (mode: "full" | "chat", message?: string) => {
    setLoading(true);
    onStatusChange("generating");
    try {
      const { data, error } = await supabase.functions.invoke("generate-itinerary", {
        body: { itinerary_id: itineraryId, mode, chat_message: message },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      setLastResult(data);
      onStatusChange("completed");
      queryClient.invalidateQueries({ queryKey: ["itinerary-days", itineraryId] });
      queryClient.invalidateQueries({ queryKey: ["itinerary-day-activities"] });
      toast({ title: `Roteiro gerado com sucesso! ${data.days_count} dias criados.` });
      setChatMessage("");
    } catch (e: any) {
      onStatusChange("error");
      toast({ title: "Erro ao gerar roteiro", description: e.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="border rounded-lg p-4 space-y-4 bg-muted/20">
      <div className="flex items-center gap-2">
        <Sparkles className="h-5 w-5 text-primary" />
        <h3 className="font-semibold text-foreground">Assistente IA para Roteiros</h3>
        {aiStatus === "generating" && <Loader2 className="h-4 w-4 animate-spin text-primary" />}
        {aiStatus === "error" && <AlertCircle className="h-4 w-4 text-destructive" />}
      </div>

      <div className="flex gap-2">
        <Button onClick={() => generate("full")} disabled={loading} className="gap-2">
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
          {loading ? "Gerando..." : "Gerar Roteiro Completo"}
        </Button>
      </div>

      <div className="flex gap-2">
        <Input
          value={chatMessage}
          onChange={(e) => setChatMessage(e.target.value)}
          placeholder="Ex: Troque o restaurante do dia 2 por algo japonês..."
          disabled={loading}
          onKeyDown={(e) => { if (e.key === "Enter" && chatMessage.trim()) generate("chat", chatMessage); }}
        />
        <Button variant="outline" size="icon" onClick={() => chatMessage.trim() && generate("chat", chatMessage)} disabled={loading || !chatMessage.trim()}>
          <Send className="h-4 w-4" />
        </Button>
      </div>

      {lastResult && (
        <div className="text-sm space-y-2 border-t pt-3">
          {lastResult.summary && <p className="text-muted-foreground">{lastResult.summary}</p>}
          {lastResult.tips && lastResult.tips.length > 0 && (
            <div>
              <p className="font-medium text-foreground">💡 Dicas:</p>
              <ul className="list-disc pl-5 text-muted-foreground">
                {lastResult.tips.map((tip, i) => <li key={i}>{tip}</li>)}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
