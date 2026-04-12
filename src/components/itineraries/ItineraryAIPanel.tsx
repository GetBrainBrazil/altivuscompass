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

const LOCATION_SEPARATION_RULES = [
  "13. CADA ATIVIDADE DEVE REPRESENTAR UM ÚNICO LOCAL FÍSICO. Nunca combine dois locais em uma mesma atividade/card, seja aeroporto, hotel, restaurante, estação, atração ou qualquer outro ponto",
  "14. Os campos de transporte (transport_mode, horários, duração, custo e notas) descrevem como o viajante CHEGOU naquele local, vindo do card anterior. A primeira atividade do dia não precisa de transporte",
  "15. Em voos, trens, barcos ou deslocamentos entre cidades/terminais, crie sempre cards separados para origem e destino. Exemplo: aeroporto CDG deve ser um card e aeroporto de Nice outro card; o voo fica apenas no conector de transporte entre eles",
].join("\n");

const DEFAULT_AI_PROMPT = `Você é um especialista em planejamento de viagens para a agência Altivus Turismo.
Sua tarefa é criar roteiros detalhados dia a dia com horários precisos.

REGRAS CRÍTICAS:
1. Respeite RIGOROSAMENTE os horários de chegada e saída do destino
2. O roteiro de cada dia deve começar no hotel (ou ponto de hospedagem) e terminar nele
3. Para cada deslocamento entre pontos, especifique: modal de transporte (uber/taxi/transfer/trem/metrô/barco/avião/a_pé/ônibus ou outro), horário de saída, horário de chegada, duração estimada em minutos, custo estimado na moeda local/conversão para real
4. Para cada atividade/ponto, inclua: horário início, horário fim, endereço completo, coordenadas GPS (latitude/longitude)
5. Considere horários de funcionamento reais dos locais (consulte)
6. Respeite os horários de acordar e dormir do viajante
7. Organize a rota para minimizar deslocamentos desnecessários, ordene da melhor forma
8. Use as informações em Pontos de Interesse para entender cidades, pontos de interesse, hotéis e preferências
9. Considere a necessidade de chegada no aeroporto de saída 2h antes
10. Considere o trânsito (tráfego) local no dia e hora do deslocamento
11. Consulte feriados e grandes eventos no local e informe no início do roteiro
12. Dê sua opinião sobre o tempo e se dá para fazer todos os pontos solicitados; se não der, sugira os melhores pontos, priorizando os solicitados
${LOCATION_SEPARATION_RULES}`;

const normalizePrompt = (prompt?: string | null) => {
  const trimmedPrompt = prompt?.trim();

  if (!trimmedPrompt) {
    return DEFAULT_AI_PROMPT;
  }

  const missingRules: string[] = [];

  if (!/CADA ATIVIDADE DEVE REPRESENTAR UM ÚNICO LOCAL FÍSICO/i.test(trimmedPrompt)) {
    missingRules.push("13. CADA ATIVIDADE DEVE REPRESENTAR UM ÚNICO LOCAL FÍSICO. Nunca combine dois locais em uma mesma atividade/card, seja aeroporto, hotel, restaurante, estação, atração ou qualquer outro ponto");
  }

  if (!/campos de transporte .*CHEGOU naquele local/i.test(trimmedPrompt)) {
    missingRules.push("14. Os campos de transporte (transport_mode, horários, duração, custo e notas) descrevem como o viajante CHEGOU naquele local, vindo do card anterior. A primeira atividade do dia não precisa de transporte");
  }

  if (!/cards separados para origem e destino|CDG.*Nice|origem e destino/i.test(trimmedPrompt)) {
    missingRules.push("15. Em voos, trens, barcos ou deslocamentos entre cidades/terminais, crie sempre cards separados para origem e destino. Exemplo: aeroporto CDG deve ser um card e aeroporto de Nice outro card; o voo fica apenas no conector de transporte entre eles");
  }

  return missingRules.length > 0 ? `${trimmedPrompt}\n${missingRules.join("\n")}` : trimmedPrompt;
};

interface Props {
  itineraryId: string;
  aiStatus: string | null;
  onStatusChange: (status: string) => void;
  onBeforeGenerate?: () => Promise<void>;
}

export default function ItineraryAIPanel({ itineraryId, aiStatus, onStatusChange, onBeforeGenerate }: Props) {
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

  const currentPrompt = normalizePrompt(agencySettings?.ai_prompt);

  useEffect(() => {
    if (!agencySettings?.id) return;

    const normalizedPrompt = normalizePrompt(agencySettings.ai_prompt);
    const storedPrompt = agencySettings.ai_prompt?.trim() || "";

    if (normalizedPrompt === storedPrompt) return;

    void supabase
      .from("agency_settings")
      .update({ ai_prompt: normalizedPrompt })
      .eq("id", agencySettings.id)
      .then(({ error }) => {
        if (!error) {
          queryClient.invalidateQueries({ queryKey: ["agency-settings-prompt"] });
        }
      });
  }, [agencySettings?.id, agencySettings?.ai_prompt, queryClient]);

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
    try {
      if (onBeforeGenerate) {
        await onBeforeGenerate();
      }
      onStatusChange("generating");
      const { data, error } = await supabase.functions.invoke("generate-itinerary", {
        body: { itinerary_id: itineraryId, mode, chat_message: message, custom_prompt: currentPrompt },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      setLastResult(data);
      onStatusChange("completed");
      queryClient.invalidateQueries({ queryKey: ["itinerary-days", itineraryId] });
      queryClient.invalidateQueries({ queryKey: ["itinerary-day-activities"] });
      queryClient.invalidateQueries({ queryKey: ["itinerary", itineraryId] });
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
        <DialogContent className="max-w-2xl max-h-[80vh] flex flex-col">
          <DialogHeader>
            <DialogTitle>Configurar Prompt da IA</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 flex-1 overflow-hidden flex flex-col min-h-0">
            <Label className="text-sm text-muted-foreground shrink-0">
              Este prompt define como a IA deve se comportar ao gerar roteiros. Ele é enviado como instrução de sistema para a IA.
            </Label>
            <Textarea
              value={editPrompt}
              onChange={(e) => setEditPrompt(e.target.value)}
              rows={16}
              className="text-sm font-mono flex-1 resize-none overflow-y-auto"
              placeholder="Escreva as instruções para a IA..."
            />
          </div>
          <DialogFooter className="shrink-0">
            <Button size="sm" onClick={savePrompt} disabled={savingPrompt}>
              {savingPrompt ? "Salvando..." : "Salvar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
