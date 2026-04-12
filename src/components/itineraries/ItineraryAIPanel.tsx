import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Sparkles, Send, Loader2, AlertCircle, Settings } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient, useQuery } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";

const DEFAULT_AI_PROMPT = `Você é um especialista em planejamento de viagens para a agência Altivus Turismo.
Sua tarefa é criar roteiros detalhados dia a dia com horários precisos.

REGRAS CRÍTICAS:
1. Respeite RIGOROSAMENTE os horários de chegada e saída do destino
2. O roteiro de cada dia deve começar no hotel (ou ponto de hospedagem) e terminar nele
3. Para cada deslocamento entre pontos, especifique: modal de transporte (uber/taxi/transfer/trem/metrô/barco/avião/a_pé/ônibus), horário de saída, horário de chegada, duração estimada em minutos, custo estimado na moeda local
4. Para cada atividade/ponto, inclua: horário início, horário fim, endereço completo, coordenadas GPS (latitude/longitude)
5. Considere horários de funcionamento reais dos locais
6. Respeite os horários de acordar e dormir do viajante
7. Organize a rota para minimizar deslocamentos desnecessários
8. Use as informações do descritivo da viagem para entender cidades, pontos de interesse, hotéis e preferências`;

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
  const [promptOpen, setPromptOpen] = useState(false);
  const [editPrompt, setEditPrompt] = useState("");
  const [savingPrompt, setSavingPrompt] = useState(false);

  const { data: agencySettings } = useQuery({
    queryKey: ["agency-settings-prompt"],
    queryFn: async () => {
      const { data } = await supabase.from("agency_settings").select("id, ai_prompt").limit(1).single();
      return data;
    },
  });

  const currentPrompt = agencySettings?.ai_prompt || DEFAULT_AI_PROMPT;

  const openPromptEditor = () => {
    setEditPrompt(currentPrompt);
    setPromptOpen(true);
  };

  const savePrompt = async () => {
    if (!agencySettings?.id) return;
    setSavingPrompt(true);
    try {
      const { error } = await supabase.from("agency_settings").update({ ai_prompt: editPrompt }).eq("id", agencySettings.id);
      if (error) throw error;
      queryClient.invalidateQueries({ queryKey: ["agency-settings-prompt"] });
      toast({ title: "Prompt salvo com sucesso!" });
      setPromptOpen(false);
    } catch (e: any) {
      toast({ title: "Erro ao salvar prompt", description: e.message, variant: "destructive" });
    } finally {
      setSavingPrompt(false);
    }
  };

  const resetPrompt = () => {
    setEditPrompt(DEFAULT_AI_PROMPT);
  };

  const generate = async (mode: "full" | "chat", message?: string) => {
    setLoading(true);
    onStatusChange("generating");
    try {
      const { data, error } = await supabase.functions.invoke("generate-itinerary", {
        body: { itinerary_id: itineraryId, mode, chat_message: message, custom_prompt: currentPrompt },
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
    <>
      <div className="border rounded-lg p-4 space-y-4 bg-muted/20">
        <div className="flex items-center gap-2">
          <Sparkles className="h-5 w-5 text-primary" />
          <h3 className="font-semibold text-foreground">Assistente IA para Roteiros</h3>
          {aiStatus === "generating" && <Loader2 className="h-4 w-4 animate-spin text-primary" />}
          {aiStatus === "error" && <AlertCircle className="h-4 w-4 text-destructive" />}
          <div className="ml-auto">
            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={openPromptEditor} title="Configurar prompt da IA">
              <Settings className="h-4 w-4" />
            </Button>
          </div>
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

      <Dialog open={promptOpen} onOpenChange={setPromptOpen}>
        <DialogContent className="max-w-2xl max-h-[80vh]">
          <DialogHeader>
            <DialogTitle>Configurar Prompt da IA</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <Label className="text-sm text-muted-foreground">
              Este prompt define como a IA deve se comportar ao gerar roteiros. Ele é enviado como instrução de sistema para a IA.
            </Label>
            <Textarea
              value={editPrompt}
              onChange={(e) => setEditPrompt(e.target.value)}
              rows={16}
              className="text-sm font-mono"
              placeholder="Escreva as instruções para a IA..."
            />
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" size="sm" onClick={resetPrompt}>Restaurar Padrão</Button>
            <Button size="sm" onClick={savePrompt} disabled={savingPrompt}>
              {savingPrompt ? "Salvando..." : "Salvar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
