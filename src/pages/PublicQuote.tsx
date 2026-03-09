import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Plane, Hotel, Bus, Ship, Sparkles, Shield, Package, CalendarDays, Map, Phone, Mail, Instagram, Printer } from "lucide-react";
import logoAltivusFallback from "@/assets/logo-altivus.png";

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

type AgencyData = {
  name: string;
  cnpj: string;
  phone: string;
  email: string;
  instagram: string;
  website: string;
  logo_url: string;
  address: string;
};

type QuoteData = {
  quote: any;
  items: any[];
  passengers: { full_name: string; relationship_type: string | null }[];
  agency: AgencyData | null;
};

export default function PublicQuote() {
  const { id } = useParams<{ id: string }>();
  const [data, setData] = useState<QuoteData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!id) return;
    const fetchQuote = async () => {
      try {
        const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
        const res = await fetch(
          `${supabaseUrl}/functions/v1/get-public-quote?id=${id}`
        );
        if (!res.ok) {
          setError("Cotação não encontrada.");
          setLoading(false);
          return;
        }
        const json = await res.json();
        setData(json);
      } catch (err) {
        setError("Erro ao carregar cotação.");
      } finally {
        setLoading(false);
      }
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

  const { quote, items, passengers, agency } = data;
  const formatCurrency = (v: number | null) =>
    v != null ? v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" }) : "—";

  const groupedItems = items.reduce((acc: Record<string, any[]>, item: any) => {
    if (!acc[item.item_type]) acc[item.item_type] = [];
    acc[item.item_type].push(item);
    return acc;
  }, {});

  const handleWhatsApp = () => {
    const phone = quote.client_phone;
    if (!phone) return;
    // Clean phone number - keep only digits
    const cleanPhone = phone.replace(/\D/g, "");
    const link = window.location.href;
    const agName = agency?.name || "Altivus Turismo";
    const destination = quote.title || quote.destination || "sua viagem";
    const message = `Olá! Segue o orçamento de *${destination}* preparado pela *${agName}*:\n\n${link}`;
    window.open(`https://wa.me/${cleanPhone}?text=${encodeURIComponent(message)}`, "_blank");
  };

  const handlePrint = () => {
    window.print();
  };

  const agencyLogo = agency?.logo_url || logoAltivusFallback;
  const agencyName = agency?.name || "Altivus Turismo";

  return (
    <div className="min-h-screen bg-background">
      {/* Top toolbar - hidden on print */}
      <div className="print:hidden border-b border-border bg-card">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 py-2 flex items-center gap-2">
          {quote.client_phone && (
            <Button variant="outline" size="sm" className="gap-1.5 font-body text-xs" onClick={handleWhatsApp}>
              <Phone className="w-3.5 h-3.5" />
              Enviar por WhatsApp
            </Button>
          )}
          <Button variant="outline" size="sm" className="gap-1.5 font-body text-xs" onClick={handlePrint}>
            <Printer className="w-3.5 h-3.5" />
            Imprimir/PDF
          </Button>
        </div>
      </div>

      {/* Header - like the reference: logo left, title center, agency info right */}
      <header className="border-b border-border bg-card">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 py-5">
          <div className="flex items-start justify-between gap-4">
            {/* Logo */}
            <div className="flex-shrink-0">
              <img src={agencyLogo} alt={agencyName} className="h-12 sm:h-14 object-contain" />
            </div>

            {/* Center: Title */}
            <div className="flex-1 text-center">
              <h1 className="text-lg sm:text-xl font-display font-bold text-foreground tracking-wide uppercase">
                Orçamento de Viagem
              </h1>
              <div className="mt-1.5">
                <Badge variant="outline" className="font-body text-xs px-3 py-0.5 font-medium">
                  {quote.title || quote.destination || "Cotação"}
                </Badge>
              </div>
            </div>

            {/* Right: Agency info */}
            <div className="flex-shrink-0 text-right space-y-0.5">
              {agency?.name && (
                <p className="text-sm font-semibold text-foreground font-body">{agency.name}</p>
              )}
              {agency?.cnpj && (
                <p className="text-xs text-muted-foreground font-body flex items-center justify-end gap-1">
                  {agency.cnpj} <span className="text-[10px]">📋</span>
                </p>
              )}
              {agency?.phone && (
                <p className="text-xs text-muted-foreground font-body flex items-center justify-end gap-1">
                  {agency.phone} <Phone className="w-3 h-3" />
                </p>
              )}
              {agency?.email && (
                <p className="text-xs text-muted-foreground font-body flex items-center justify-end gap-1">
                  {agency.email} <Mail className="w-3 h-3" />
                </p>
              )}
              {agency?.instagram && (
                <p className="text-xs text-muted-foreground font-body flex items-center justify-end gap-1">
                  {agency.instagram} <Instagram className="w-3 h-3" />
                </p>
              )}
            </div>
          </div>
        </div>
      </header>

      {/* Cover image - full width */}
      {quote.cover_image_url && (
        <div className="max-w-5xl mx-auto">
          <img
            src={quote.cover_image_url}
            alt="Capa da cotação"
            className="w-full h-56 sm:h-72 lg:h-80 object-cover"
          />
        </div>
      )}

      <main className="max-w-5xl mx-auto px-4 sm:px-6 py-8 space-y-6">
        {/* Client & dates info */}
        <div className="glass-card rounded-xl p-5 space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="space-y-1">
              {quote.client_name && (
                <p className="text-muted-foreground font-body text-sm">
                  Cliente: <span className="text-foreground font-semibold">{quote.client_name}</span>
                </p>
              )}
              {quote.travel_date_start && (
                <p className="text-sm text-muted-foreground font-body">
                  📅 {quote.travel_date_start}{quote.travel_date_end ? ` – ${quote.travel_date_end}` : ""}
                </p>
              )}
            </div>
            {quote.total_value != null && quote.total_value > 0 && (
              <div className="text-right">
                <p className="text-xs text-muted-foreground font-body">Valor Total</p>
                <p className="text-xl font-display font-bold text-foreground">{formatCurrency(quote.total_value)}</p>
              </div>
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
                    <Badge variant="outline" className="text-[10px] h-5">{(typeItems as any[]).length}</Badge>
                  </div>
                  <div className="space-y-2">
                    {(typeItems as any[]).map((item: any, idx: number) => (
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
      <footer className="border-t border-border bg-card mt-12 print:mt-4">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 py-4 text-center space-y-1">
          <p className="text-xs text-muted-foreground font-body">
            Cotação gerada por <span className="font-medium text-foreground">{agencyName}</span>
          </p>
          {agency?.phone && (
            <p className="text-[11px] text-muted-foreground font-body">
              {agency.phone} • {agency.email}
            </p>
          )}
        </div>
      </footer>
    </div>
  );
}
