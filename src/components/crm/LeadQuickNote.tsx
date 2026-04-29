import { useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { StickyNote, Sparkles, X, Check } from "lucide-react";
import { cn } from "@/lib/utils";

export type QuickNoteFormSnapshot = {
  destination?: string;
  travel_date_label?: string;
  budget_estimate?: string;
  travelers_count?: string;
};

export type QuickNoteSuggestion =
  | { field: "destination"; label: string; value: string }
  | { field: "travel_date_label"; label: string; value: string }
  | { field: "budget_estimate"; label: string; value: string }
  | { field: "travelers_count"; label: string; value: string };

interface Props {
  leadId: string | null;
  form: QuickNoteFormSnapshot;
  onApplySuggestion: (s: QuickNoteSuggestion) => void;
}

// ---------- Heurísticas de extração ----------
const KNOWN_DESTINATIONS = [
  "Paris", "Londres", "Roma", "Lisboa", "Madri", "Madrid", "Barcelona", "Amsterdã", "Amsterdam",
  "Nova York", "New York", "Miami", "Orlando", "Los Angeles", "San Francisco", "Las Vegas",
  "Tóquio", "Tokyo", "Quioto", "Kyoto", "Osaka", "Bangkok", "Phuket", "Bali", "Dubai",
  "Cancún", "Cancun", "Buenos Aires", "Santiago", "Bariloche", "Cusco", "Lima", "Cartagena",
  "Cidade do Cabo", "Cape Town", "Marrakech", "Istambul", "Atenas", "Veneza", "Florença",
  "Milão", "Milao", "Berlim", "Praga", "Viena", "Budapeste", "Reykjavik", "Maldivas",
  "Maui", "Havaí", "Hawaii", "Punta Cana", "Aruba", "Curaçao", "Fernando de Noronha",
];

function extractDestination(text: string): string | null {
  const lower = text.toLowerCase();
  for (const d of KNOWN_DESTINATIONS) {
    const re = new RegExp(`\\b${d.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`, "i");
    if (re.test(text)) return d;
  }
  // Padrão: "para Xxxxx" / "destino Xxxxx" / "viagem para Xxxxx"
  const m = text.match(/(?:para|destino|viagem para|ir (?:a|para))\s+([A-ZÀ-Ú][\wÀ-ú-]+(?:\s+[A-ZÀ-Ú][\wÀ-ú-]+){0,2})/);
  if (m) return m[1];
  // fallback case-insensitive
  const m2 = lower.match(/(?:para|destino|viagem para)\s+([a-zà-ú][\wà-ú-]+(?:\s+[a-zà-ú][\wà-ú-]+){0,2})/);
  if (m2) return m2[1].replace(/\b\w/g, (c) => c.toUpperCase());
  return null;
}

function extractBudget(text: string): { value: string; label: string } | null {
  // R$15k, R$ 15.000, 15 mil, até 15k, 15.000 reais
  const reK = /(?:r\$\s*)?(\d{1,3}(?:[.,]\d{3})*|\d+)\s*(k|mil)\b/i;
  const m1 = text.match(reK);
  if (m1) {
    const n = parseInt(m1[1].replace(/[.,]/g, ""), 10);
    if (!isNaN(n)) {
      const total = n * 1000;
      return { value: String(total), label: `R$ ${total.toLocaleString("pt-BR")}` };
    }
  }
  const reReais = /r\$\s*(\d{1,3}(?:\.\d{3})+|\d{4,})(?:,\d{2})?/i;
  const m2 = text.match(reReais);
  if (m2) {
    const n = parseInt(m2[1].replace(/\./g, ""), 10);
    if (!isNaN(n)) return { value: String(n), label: `R$ ${n.toLocaleString("pt-BR")}` };
  }
  return null;
}

function extractTravelers(text: string): { value: string; label: string } | null {
  const m = text.match(/(\d{1,2})\s*(?:pessoas|pax|viajantes|adultos|pessoa)\b/i);
  if (m) return { value: m[1], label: `${m[1]} viajantes` };
  const casal = /\bcasal\b/i.test(text);
  if (casal) return { value: "2", label: "2 viajantes (casal)" };
  return null;
}

function extractTravelDate(text: string): string | null {
  // "em julho", "em julho/2026", "para dezembro", "no fim de ano"
  const meses = "(janeiro|fevereiro|março|marco|abril|maio|junho|julho|agosto|setembro|outubro|novembro|dezembro)";
  const re = new RegExp(`(?:em|para|no mês de|no mes de)\\s+${meses}(?:\\s*(?:de|/)?\\s*(20\\d{2}))?`, "i");
  const m = text.match(re);
  if (m) {
    const mes = m[1][0].toUpperCase() + m[1].slice(1).toLowerCase();
    return m[2] ? `${mes}/${m[2]}` : mes;
  }
  if (/fim de ano|final de ano|natal|réveillon|reveillon/i.test(text)) return "Fim de ano";
  if (/carnaval/i.test(text)) return "Carnaval";
  // dd/mm/yyyy
  const d = text.match(/\b(\d{1,2}\/\d{1,2}(?:\/\d{2,4})?)\b/);
  if (d) return d[1];
  return null;
}

function buildSuggestions(text: string, form: QuickNoteFormSnapshot): QuickNoteSuggestion[] {
  const out: QuickNoteSuggestion[] = [];
  if (!form.destination?.trim()) {
    const d = extractDestination(text);
    if (d) out.push({ field: "destination", label: `Preencher destino com ${d}?`, value: d });
  }
  if (!form.budget_estimate?.trim()) {
    const b = extractBudget(text);
    if (b) out.push({ field: "budget_estimate", label: `Preencher orçamento com ${b.label}?`, value: b.value });
  }
  if (!form.travelers_count?.trim()) {
    const t = extractTravelers(text);
    if (t) out.push({ field: "travelers_count", label: `Preencher viajantes com ${t.label}?`, value: t.value });
  }
  if (!form.travel_date_label?.trim()) {
    const td = extractTravelDate(text);
    if (td) out.push({ field: "travel_date_label", label: `Preencher data com "${td}"?`, value: td });
  }
  return out;
}

export function LeadQuickNote({ leadId, form, onApplySuggestion }: Props) {
  const qc = useQueryClient();
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);
  const [suggestions, setSuggestions] = useState<QuickNoteSuggestion[]>([]);
  const [dismissed, setDismissed] = useState<Set<string>>(new Set());

  const visibleSuggestions = useMemo(
    () => suggestions.filter((s) => !dismissed.has(s.field)),
    [suggestions, dismissed]
  );

  const handleSave = async () => {
    const text = note.trim();
    if (!text || saving) return;
    if (!leadId) {
      toast.error("Lead não identificado.");
      return;
    }
    setSaving(true);
    try {
      const { data: userData } = await supabase.auth.getUser();
      const uid = userData?.user?.id ?? null;
      let userName: string | null = null;
      if (uid) {
        const { data: prof } = await supabase
          .from("profiles")
          .select("full_name, email")
          .eq("user_id", uid)
          .maybeSingle();
        userName = prof?.full_name || prof?.email || null;
      }
      const { error } = await supabase.from("contact_events" as any).insert({
        lead_id: leadId,
        event_type: "note",
        title: "Nota adicionada durante conversa",
        description: text,
        is_manual: true,
        user_id: uid,
        user_name: userName,
      });
      if (error) throw error;

      const sugg = buildSuggestions(text, form);
      setSuggestions(sugg);
      setDismissed(new Set());
      setNote("");
      qc.invalidateQueries({ queryKey: ["lead-timeline", leadId] });
      toast.success("Nota registrada na timeline.");
    } catch (err) {
      console.error("[LeadQuickNote] save error:", err);
      toast.error("Não foi possível salvar a nota.");
    } finally {
      setSaving(false);
    }
  };

  const handleApply = (s: QuickNoteSuggestion) => {
    onApplySuggestion(s);
    setDismissed((prev) => new Set(prev).add(s.field));
    toast.success("Campo preenchido. Lembre de salvar a ficha.");
  };
  const handleDismiss = (s: QuickNoteSuggestion) => {
    setDismissed((prev) => new Set(prev).add(s.field));
  };

  return (
    <div className="border-b border-border bg-amber-50/60 dark:bg-amber-950/20 px-3 py-2.5">
      <div className="flex items-center gap-1.5 mb-1.5">
        <StickyNote className="h-3.5 w-3.5 text-amber-700 dark:text-amber-400" />
        <span className="text-[11px] font-semibold uppercase tracking-wider text-amber-800 dark:text-amber-300">
          Nota rápida
        </span>
      </div>
      <div className="flex items-start gap-2">
        <Textarea
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="Ex: Quer hotel 5 estrelas, orçamento até R$15k..."
          rows={2}
          className="min-h-[44px] text-xs resize-none bg-background flex-1"
          onKeyDown={(e) => {
            if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
              e.preventDefault();
              handleSave();
            }
          }}
          disabled={saving}
        />
        <Button
          size="sm"
          onClick={handleSave}
          disabled={!note.trim() || saving}
          className="h-9 shrink-0 text-xs"
        >
          {saving ? "..." : "Salvar"}
        </Button>
      </div>

      {visibleSuggestions.length > 0 && (
        <div className="mt-2 flex flex-col gap-1.5">
          {visibleSuggestions.map((s) => (
            <div
              key={s.field}
              className={cn(
                "flex items-center justify-between gap-2 rounded-md border border-amber-300/60 dark:border-amber-700/40",
                "bg-amber-100/60 dark:bg-amber-900/20 px-2 py-1.5"
              )}
            >
              <span className="text-[11px] text-amber-900 dark:text-amber-200 inline-flex items-center gap-1.5 min-w-0">
                <Sparkles className="h-3 w-3 shrink-0" />
                <span className="truncate">{s.label}</span>
              </span>
              <div className="flex items-center gap-1 shrink-0">
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-6 px-2 text-[11px] hover:bg-amber-200/60 dark:hover:bg-amber-800/40"
                  onClick={() => handleApply(s)}
                >
                  <Check className="h-3 w-3 mr-1" />
                  Sim
                </Button>
                <Button
                  size="icon"
                  variant="ghost"
                  className="h-6 w-6 text-muted-foreground"
                  onClick={() => handleDismiss(s)}
                  aria-label="Descartar sugestão"
                >
                  <X className="h-3 w-3" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
