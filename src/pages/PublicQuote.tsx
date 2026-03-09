import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { Plane, Hotel, Bus, Ship, Sparkles, Shield, Package, CalendarDays, Map } from "lucide-react";
import logoAltivus from "@/assets/logo-altivus.png";

const ITEM_TYPE_META: Record<string, { label: string; icon: any }> = {
  flight: { label: "Voos", icon: Plane },
  hotel: { label: "Hospedagem", icon: Hotel },
  transport: { label: "Transporte", icon: Bus },
  cruise: { label: "Cruzeiro", icon: Ship },
  experience: { label: "Experiências", icon: Sparkles },
  insurance: { label: "Seguros", icon: Shield },
  other_service: { label: "Outros Serviços", icon: Package },
  itinerary: { label: "Roteiro Dia a Dia", icon: CalendarDays },
  map: { label: "Mapa", icon: Map },
};

const STAGE_LABELS: Record<string, string> = {
  new: "Nova Cotação",
  sent: "Cotação Enviada",
  negotiation: "Negociação",
  confirmed: "Concluída",
  issued: "Emitida",
  completed: "Finalizada",
  post_sale: "Pós-Venda",
};

type QuoteData = {
  quote: any;
  items: any[];
  passengers: { full_name: string; relationship_type: string | null }[];
};

export default function PublicQuote() {
  const { id } = useParams<{ id: string }>();
  const [data, setData] = useState<QuoteData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!id) return;
    const fetchQuote = async () => {
      try {
        const { data: result, error: fnError } = await supabase.functions.invoke(
          "get-public-quote",
          { body: null, headers: {}, method: "GET" }
        );
        // supabase.functions.invoke doesn't support query params easily, use fetch directly
      } catch {}

      // Use direct fetch for GET with query param
      const projectId = import.meta.env.VITE_SUPABASE_PROJECT_ID;
      const res = await fetch(
        `https://${projectId}.supabase.co/functions/v1/get-public-quote?id=${id}`
      );
      if (!res.ok) {
        setError("Cotação não encontrada.");
        setLoading(false);
        return;
      }
      const json = await res.json();
      setData(json);
      setLoading(false);
    };
    fetchQuote();
  }, [id]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <p className="text-muted-foreground font-body animate-pulse">Carregando cotação...</p>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center space-y-2">
          <p className="text-lg font-semibold text-foreground font-display">{error || "Erro ao carregar"}</p>
          <p className="text-sm text-muted-foreground font-body">Verifique o link e tente novamente.</p>
        </div>
      </div>
    );
  }

  const { quote, items, passengers } = data;
  const formatCurrency = (v: number | null) =>
    v != null ? v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" }) : "—";

  const groupedItems = items.reduce((acc: Record<string, any[]>, item: any) => {
    if (!acc[item.item_type]) acc[item.item_type] = [];
    acc[item.item_type].push(item);
    return acc;
  }, {});

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-border bg-card">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 py-4 flex items-center justify-between">
          <img src={logoAltivus} alt="Altivus" className="h-8" />
          <Badge variant="secondary" className="font-body text-xs">
            {STAGE_LABELS[quote.stage] || quote.stage}
          </Badge>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 sm:px-6 py-8 space-y-6">
        {/* Cover image */}
        {quote.cover_image_url && (
          <div className="rounded-xl overflow-hidden">
            <img
              src={quote.cover_image_url}
              alt="Capa da cotação"
              className="w-full h-48 sm:h-64 object-cover"
            />
          </div>
        )}

        {/* Title & basic info */}
        <div className="space-y-2">
          <h1 className="text-2xl sm:text-3xl font-display font-semibold text-foreground">
            {quote.title || quote.destination || "Cotação"}
          </h1>
          {quote.client_name && (
            <p className="text-muted-foreground font-body">
              Cliente: <span className="text-foreground font-medium">{quote.client_name}</span>
            </p>
          )}
          <div className="flex flex-wrap gap-4 text-sm text-muted-foreground font-body">
            {quote.travel_date_start && (
              <span>📅 {quote.travel_date_start}{quote.travel_date_end ? ` – ${quote.travel_date_end}` : ""}</span>
            )}
            {quote.total_value != null && quote.total_value > 0 && (
              <span className="font-semibold text-foreground text-lg">{formatCurrency(quote.total_value)}</span>
            )}
          </div>
        </div>

        {/* Details */}
        {quote.details && (
          <div className="glass-card rounded-xl p-5 space-y-1">
            <h2 className="text-sm font-semibold text-foreground font-body">Detalhes</h2>
            <p className="text-sm text-muted-foreground font-body whitespace-pre-line">{quote.details}</p>
          </div>
        )}

        {/* Passengers */}
        {passengers.length > 0 && (
          <div className="glass-card rounded-xl p-5 space-y-2">
            <h2 className="text-sm font-semibold text-foreground font-body">Passageiros</h2>
            <div className="flex flex-wrap gap-2">
              {passengers.map((p, i) => (
                <Badge key={i} variant="secondary" className="text-xs font-body">
                  {p.full_name}
                  {p.relationship_type && <span className="ml-1 opacity-60">({p.relationship_type})</span>}
                </Badge>
              ))}
            </div>
          </div>
        )}

        {/* Items by type */}
        {Object.keys(groupedItems).length > 0 && (
          <div className="space-y-4">
            {Object.entries(groupedItems).map(([type, typeItems]) => {
              const meta = ITEM_TYPE_META[type];
              const Icon = meta?.icon || Package;
              return (
                <div key={type} className="glass-card rounded-xl p-5 space-y-3">
                  <div className="flex items-center gap-2">
                    <Icon className="w-4 h-4 text-accent" />
                    <h2 className="text-sm font-semibold text-foreground font-body">
                      {meta?.label || type}
                    </h2>
                    <Badge variant="outline" className="text-[10px] h-5">{typeItems.length}</Badge>
                  </div>
                  <div className="space-y-2">
                    {typeItems.map((item: any, idx: number) => (
                      <div key={idx} className="border border-border rounded-lg p-3">
                        {item.title && (
                          <p className="text-sm font-medium text-foreground font-body">{item.title}</p>
                        )}
                        {item.description && (
                          <p className="text-xs text-muted-foreground font-body mt-0.5">{item.description}</p>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Payment terms */}
        {quote.payment_terms && (
          <div className="glass-card rounded-xl p-5 space-y-1">
            <h2 className="text-sm font-semibold text-foreground font-body">Forma de Pagamento</h2>
            <p className="text-sm text-muted-foreground font-body whitespace-pre-line">{quote.payment_terms}</p>
          </div>
        )}

        {/* Terms */}
        {quote.terms_conditions && (
          <div className="glass-card rounded-xl p-5 space-y-1">
            <h2 className="text-sm font-semibold text-foreground font-body">Termos e Condições</h2>
            <p className="text-sm text-muted-foreground font-body whitespace-pre-line">{quote.terms_conditions}</p>
          </div>
        )}

        {/* Other info */}
        {quote.other_info && (
          <div className="glass-card rounded-xl p-5 space-y-1">
            <h2 className="text-sm font-semibold text-foreground font-body">Outras Informações</h2>
            <p className="text-sm text-muted-foreground font-body whitespace-pre-line">{quote.other_info}</p>
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="border-t border-border bg-card mt-12">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 py-4 text-center">
          <p className="text-xs text-muted-foreground font-body">
            Cotação gerada por <span className="font-medium text-foreground">Altivus Travel</span>
          </p>
        </div>
      </footer>
    </div>
  );
}
