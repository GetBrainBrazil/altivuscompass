import { useEffect, useState, useCallback, useRef } from "react";
import { useParams } from "react-router-dom";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plane, Hotel, Bus, Ship, Sparkles, Shield, Package, CalendarDays, Map, Phone, Mail, Instagram, Printer, Globe, Loader2, Backpack, Briefcase, Luggage } from "lucide-react";
import logoAltivusFallback from "@/assets/logo-altivus.png";
import { type QuoteLang, LANG_OPTIONS, getTranslations, getItemTypeLabel, getRelationshipLabel, getFlagUrl, getCabinClassLabel, getConnectionsLabel, getFlightDirectionLabel } from "@/lib/quote-translations";

const ITEM_TYPE_ICONS: Record<string, any> = {
  flight: Plane, hotel: Hotel, transport: Bus, cruise: Ship,
  experience: Sparkles, insurance: Shield, other_service: Package,
  itinerary: CalendarDays, map: Map,
};

type AgencyData = {
  name: string; cnpj: string; phone: string; email: string;
  instagram: string; website: string; logo_url: string; address: string;
};

type QuoteData = {
  quote: any;
  items: any[];
  passengers: { full_name: string; relationship_type: string | null }[];
  agency: AgencyData | null;
};

// Keys of translatable content fields
const CONTENT_KEYS = ["details", "payment_terms", "terms_conditions", "other_info"] as const;

export default function PublicQuote() {
  const { id } = useParams<{ id: string }>();
  const [data, setData] = useState<QuoteData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lang, setLang] = useState<QuoteLang>("pt");
  const [translating, setTranslating] = useState(false);
  const [translatedContent, setTranslatedContent] = useState<Record<string, string>>({});
  const [translatedItems, setTranslatedItems] = useState<Record<number, { title?: string; description?: string }>>({});
  const translationCache = useRef<Record<string, { content: Record<string, string>; items: Record<number, { title?: string; description?: string }> }>>({});

  const t = getTranslations(lang);

  useEffect(() => {
    if (!id) return;
    const fetchQuote = async () => {
      try {
        const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
        const res = await fetch(`${supabaseUrl}/functions/v1/get-public-quote?id=${id}`);
        if (!res.ok) { setError("Cotação não encontrada."); setLoading(false); return; }
        const json = await res.json();
        setData(json);
      } catch (err) { setError("Erro ao carregar cotação."); }
      finally { setLoading(false); }
    };
    fetchQuote();
  }, [id]);

  const translateContent = useCallback(async (targetLang: QuoteLang) => {
    if (!data || targetLang === "pt") {
      setTranslatedContent({});
      setTranslatedItems({});
      return;
    }

    // Check cache
    if (translationCache.current[targetLang]) {
      setTranslatedContent(translationCache.current[targetLang].content);
      setTranslatedItems(translationCache.current[targetLang].items);
      return;
    }

    setTranslating(true);
    try {
      // Collect all texts to translate in one batch
      const textsToTranslate: string[] = [];
      const contentMapping: { key: string; index: number }[] = [];
      const itemMapping: { itemIdx: number; field: "title" | "description"; index: number }[] = [];

      // Quote content fields
      for (const key of CONTENT_KEYS) {
        const value = data.quote[key];
        if (value) {
          contentMapping.push({ key, index: textsToTranslate.length });
          textsToTranslate.push(value);
        }
      }

      // Item titles and descriptions
      data.items.forEach((item, idx) => {
        if (item.title) {
          itemMapping.push({ itemIdx: idx, field: "title", index: textsToTranslate.length });
          textsToTranslate.push(item.title);
        }
        if (item.description) {
          itemMapping.push({ itemIdx: idx, field: "description", index: textsToTranslate.length });
          textsToTranslate.push(item.description);
        }
      });

      if (textsToTranslate.length === 0) {
        setTranslating(false);
        return;
      }

      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
      const res = await fetch(`${supabaseUrl}/functions/v1/translate-quote`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ texts: textsToTranslate, targetLang }),
      });

      if (!res.ok) throw new Error("Translation failed");
      const result = await res.json();
      const translated: string[] = result.translations;

      // Map back
      const newContent: Record<string, string> = {};
      for (const { key, index } of contentMapping) {
        newContent[key] = translated[index];
      }

      const newItems: Record<number, { title?: string; description?: string }> = {};
      for (const { itemIdx, field, index } of itemMapping) {
        if (!newItems[itemIdx]) newItems[itemIdx] = {};
        newItems[itemIdx][field] = translated[index];
      }

      // Cache
      translationCache.current[targetLang] = { content: newContent, items: newItems };
      setTranslatedContent(newContent);
      setTranslatedItems(newItems);
    } catch (err) {
      console.error("Translation error:", err);
    } finally {
      setTranslating(false);
    }
  }, [data]);

  const handleLangChange = (newLang: QuoteLang) => {
    setLang(newLang);
    translateContent(newLang);
  };

  // Helper to get content - translated or original
  const getContent = (key: string): string | null => {
    if (lang !== "pt" && translatedContent[key]) return translatedContent[key];
    return data?.quote[key] || null;
  };

  const getItemContent = (idx: number, field: "title" | "description"): string | null => {
    if (lang !== "pt" && translatedItems[idx]?.[field]) return translatedItems[idx][field]!;
    return data?.items[idx]?.[field] || null;
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <p className="text-muted-foreground font-body animate-pulse">{t.loading}</p>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center space-y-2">
          <p className="text-lg font-semibold text-foreground font-display">{error || t.error}</p>
          <p className="text-sm text-muted-foreground font-body">{t.checkLink}</p>
        </div>
      </div>
    );
  }

  const { quote, items, passengers, agency } = data;
  const formatCurrency = (v: number | null) =>
    v != null ? v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" }) : "—";

  const groupedItems: Record<string, { item: any; originalIdx: number }[]> = items.reduce((acc: Record<string, { item: any; originalIdx: number }[]>, item: any, idx: number) => {
    if (!acc[item.item_type]) acc[item.item_type] = [];
    acc[item.item_type].push({ item, originalIdx: idx });
    return acc;
  }, {});

  const handleWhatsApp = () => {
    const phone = quote.client_phone;
    if (!phone) return;
    const cleanPhone = phone.replace(/\D/g, "");
    const link = window.location.href;
    const agName = agency?.name || "Altivus Turismo";
    const destination = quote.title || quote.destination || "sua viagem";
    const message = `Olá! Segue o orçamento de *${destination}* preparado pela *${agName}*:\n\n${link}`;
    window.open(`https://wa.me/${cleanPhone}?text=${encodeURIComponent(message)}`, "_blank");
  };

  const agencyLogo = agency?.logo_url || logoAltivusFallback;
  const agencyName = agency?.name || "Altivus Turismo";
  const selectedLang = LANG_OPTIONS.find(l => l.value === lang);

  return (
    <div className="min-h-screen bg-background">
      {/* Top toolbar - hidden on print */}
      <div className="print:hidden border-b border-border bg-card">
        <div className="max-w-5xl mx-auto px-3 sm:px-6 py-2 flex items-center gap-1.5 sm:gap-2 flex-wrap">
          {quote.client_phone && (
            <Button variant="outline" size="sm" className="gap-1.5 font-body text-xs h-8" onClick={handleWhatsApp}>
              <Phone className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">{t.sendWhatsApp}</span>
              <span className="sm:hidden">WhatsApp</span>
            </Button>
          )}
          <Button variant="outline" size="sm" className="gap-1.5 font-body text-xs h-8" onClick={() => window.print()}>
            <Printer className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">{t.printPdf}</span>
            <span className="sm:hidden">PDF</span>
          </Button>

          {translating && (
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground font-body ml-1">
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
              <span className="hidden sm:inline">Traduzindo...</span>
            </div>
          )}

          <div className="ml-auto">
            <Select value={lang} onValueChange={(v) => handleLangChange(v as QuoteLang)}>
              <SelectTrigger className="h-8 w-[130px] sm:w-[160px] text-xs font-body">
                <SelectValue>
                  {selectedLang && (
                    <span className="flex items-center gap-1.5">
                      <img src={getFlagUrl(selectedLang.countryCode)} alt="" className="w-5 h-auto rounded-[2px]" />
                      <span>{selectedLang.label}</span>
                    </span>
                  )}
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                {LANG_OPTIONS.map(opt => (
                  <SelectItem key={opt.value} value={opt.value} className="text-xs font-body">
                    <span className="flex items-center gap-2">
                      <img src={getFlagUrl(opt.countryCode)} alt="" className="w-5 h-auto rounded-[2px]" />
                      <span>{opt.label}</span>
                    </span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>

      {/* Header */}
      <header className="border-b border-border bg-card">
        <div className="max-w-5xl mx-auto px-3 sm:px-6 py-4 sm:py-5">
          {/* Mobile: stack vertically, Desktop: side by side */}
          <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3 sm:gap-4">
            {/* Top row on mobile: logo + agency info */}
            <div className="flex items-start justify-between gap-3 sm:contents">
              <div className="flex-shrink-0">
                <img src={agencyLogo} alt={agencyName} className="h-10 sm:h-14 object-contain" />
              </div>
              {/* Agency info - visible on mobile as compact, desktop as full */}
              <div className="flex-shrink-0 text-right space-y-0.5 sm:order-3">
                {agency?.name && <p className="text-xs sm:text-sm font-semibold text-foreground font-body">{agency.name}</p>}
                {agency?.cnpj && (
                  <p className="text-[10px] sm:text-xs text-muted-foreground font-body hidden sm:flex items-center justify-end gap-1">
                    {agency.cnpj} <span className="text-[10px]">📋</span>
                  </p>
                )}
                {agency?.phone && (
                  <p className="text-[10px] sm:text-xs text-muted-foreground font-body flex items-center justify-end gap-1">
                    {agency.phone} <Phone className="w-3 h-3" />
                  </p>
                )}
                {agency?.email && (
                  <p className="text-[10px] sm:text-xs text-muted-foreground font-body hidden sm:flex items-center justify-end gap-1">
                    {agency.email} <Mail className="w-3 h-3" />
                  </p>
                )}
                {agency?.instagram && (
                  <p className="text-[10px] sm:text-xs text-muted-foreground font-body hidden sm:flex items-center justify-end gap-1">
                    {agency.instagram} <Instagram className="w-3 h-3" />
                  </p>
                )}
              </div>
            </div>
            {/* Title centered */}
            <div className="flex-1 text-center sm:order-2">
              <h1 className="text-base sm:text-xl font-display font-bold text-foreground tracking-wide uppercase">
                {t.travelQuote}
              </h1>
              <div className="mt-1">
                <Badge variant="outline" className="font-body text-xs px-3 py-0.5 font-medium">
                  {quote.title || quote.destination || t.quote}
                </Badge>
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* Cover image */}
      {quote.cover_image_url && (
        <div className="max-w-5xl mx-auto">
          <img src={quote.cover_image_url} alt="" className="w-full h-56 sm:h-72 lg:h-80 object-cover" />
        </div>
      )}

      <main className="max-w-5xl mx-auto px-3 sm:px-6 py-6 sm:py-8 space-y-4 sm:space-y-6">
        {/* Client & dates */}
        <div className="glass-card rounded-xl p-4 sm:p-5 space-y-3">
          <div className="flex flex-col sm:flex-row sm:flex-wrap sm:items-center sm:justify-between gap-2 sm:gap-3">
            <div className="space-y-1">
              {quote.client_name && (
                <p className="text-muted-foreground font-body text-sm">
                  {t.client}: <span className="text-foreground font-semibold">{quote.client_name}</span>
                  {quote.travel_date_start && (
                    <span className="block sm:inline sm:ml-3 text-muted-foreground text-xs sm:text-sm mt-0.5 sm:mt-0">
                      {quote.travel_date_start.split("-").reverse().join("/")}{quote.travel_date_end ? ` – ${quote.travel_date_end.split("-").reverse().join("/")}` : ""}
                    </span>
                  )}
                </p>
              )}
            </div>
            {quote.total_value != null && quote.total_value > 0 && (
              <div className="text-left sm:text-right">
                <p className="text-xs text-muted-foreground font-body">{t.totalValue}</p>
                <p className="text-lg sm:text-xl font-display font-bold text-foreground">{formatCurrency(quote.total_value)}</p>
              </div>
            )}
          </div>
        </div>

        {/* Details */}
        {getContent("details") && (
          <div className="glass-card rounded-xl p-4 sm:p-5 space-y-1">
            <h2 className="text-sm font-semibold text-foreground font-body">{t.details}</h2>
            <p className="text-xs sm:text-sm text-muted-foreground font-body whitespace-pre-line">{getContent("details")}</p>
          </div>
        )}

        {/* Travelers */}
        {(() => {
          const clientIsTraveling = quote.price_breakdown?.client_self_traveling === true;
          const hasTravelers = clientIsTraveling || passengers.length > 0;
          if (!hasTravelers) return null;
          return (
            <div className="glass-card rounded-xl p-5 space-y-2">
              <h2 className="text-sm font-semibold text-foreground font-body">{t.travelers}</h2>
              <div className="flex flex-wrap gap-2">
                {clientIsTraveling && quote.client_name && (
                  <Badge variant="secondary" className="text-xs font-body">{quote.client_name}</Badge>
                )}
                {passengers.map((p, i) => (
                  <Badge key={i} variant="secondary" className="text-xs font-body">
                    {p.full_name}
                    {p.relationship_type && (
                      <span className="ml-1 opacity-60">({getRelationshipLabel(lang, p.relationship_type)})</span>
                    )}
                  </Badge>
                ))}
              </div>
            </div>
          );
        })()}

        {/* Items by type */}
        {Object.keys(groupedItems).length > 0 && (
          <div className="space-y-4">
            {Object.entries(groupedItems).map(([type, typeEntries]) => {
              const Icon = ITEM_TYPE_ICONS[type] || Package;
              return (
                <div key={type} className="glass-card rounded-xl p-5 space-y-3">
                  <div className="flex items-center gap-2">
                    <Icon className="w-4 h-4 text-accent" />
                    <h2 className="text-sm font-semibold text-foreground font-body">
                      {getItemTypeLabel(lang, type)}
                    </h2>
                    <Badge variant="outline" className="text-[10px] h-5">{typeEntries.length}</Badge>
                  </div>
                  <div className="space-y-2">
                    {typeEntries.map(({ item, originalIdx }, idx) => {
                      const title = getItemContent(originalIdx, "title");
                      const description = getItemContent(originalIdx, "description");
                      const d = (item.details as any) || {};
                      const isFlight = type === "flight";

                      if (isFlight && (d.origin || d.destination || d.departure_date)) {
                        const formatDate = (ds: string) => ds ? ds.split("-").reverse().join("/") : "";
                        const dirLabel = d.flight_direction ? getFlightDirectionLabel(lang, d.flight_direction) : null;
                        // Baggage stored as pax_adults (backpack), pax_children (carry-on), pax_infants (checked bag)
                        const hasBaggage = d.pax_adults != null || d.pax_children != null || d.pax_infants != null;

                        return (
                          <div key={idx} className="border border-border rounded-lg p-3 sm:p-4 space-y-2 sm:space-y-2.5">
                            {/* Route header */}
                            <div className="flex items-start sm:items-center gap-2 flex-wrap justify-between">
                              <div className="flex items-center gap-2 flex-wrap flex-1 min-w-0">
                                {dirLabel && (
                                  <Badge variant="secondary" className="text-[10px] font-body flex-shrink-0">{dirLabel}</Badge>
                                )}
                                <div className="flex items-center gap-1.5 text-xs sm:text-sm font-medium text-foreground font-body min-w-0">
                                  {d.origin && <span className="truncate">{d.origin}</span>}
                                  {d.origin && d.destination && <Plane className="w-3 sm:w-3.5 h-3 sm:h-3.5 text-muted-foreground flex-shrink-0" />}
                                  {d.destination && <span className="truncate">{d.destination}</span>}
                                </div>
                              </div>
                              {d.airline && (
                                <div className="text-right flex-shrink-0 space-y-1.5">
                                  <span className="text-[10px] sm:text-xs text-muted-foreground font-body block">
                                    {d.airline}{d.flight_number ? ` (${d.flight_number})` : ""}
                                  </span>
                                  <div className="flex items-center gap-1 justify-end">
                                    <div className="flex flex-col items-center border border-border rounded px-1.5 py-1 min-w-[36px]">
                                      <Backpack className="w-3.5 h-3.5 text-primary" />
                                      <span className="text-[9px] text-muted-foreground font-body">{t.backpack}</span>
                                      <span className="text-[10px] font-medium text-foreground font-body">{d.pax_adults ?? 0}</span>
                                    </div>
                                    <div className="flex flex-col items-center border border-border rounded px-1.5 py-1 min-w-[36px]">
                                      <Briefcase className="w-3.5 h-3.5 text-primary" />
                                      <span className="text-[9px] text-muted-foreground font-body">{t.carryOn}</span>
                                      <span className="text-[10px] font-medium text-foreground font-body">{d.pax_children ?? 0}</span>
                                    </div>
                                    <div className="flex flex-col items-center border border-border rounded px-1.5 py-1 min-w-[36px]">
                                      <Luggage className="w-3.5 h-3.5 text-primary" />
                                      <span className="text-[9px] text-muted-foreground font-body">{t.checkedBag}</span>
                                      <span className="text-[10px] font-medium text-foreground font-body">{d.pax_infants ?? 0}</span>
                                    </div>
                                  </div>
                                </div>
                              )}
                            </div>

                            {/* Date/time row */}
                            <div className="grid grid-cols-2 gap-2 sm:gap-3 text-xs font-body sm:pl-6">
                              {d.departure_date && (
                                <div className="space-y-0.5">
                                  <p className="text-[10px] text-muted-foreground uppercase tracking-wide">{t.departure}</p>
                                  <p className="text-foreground font-medium text-[11px] sm:text-xs">
                                    {formatDate(d.departure_date)}{d.departure_time ? ` · ${d.departure_time}` : ""}
                                  </p>
                                </div>
                              )}
                              {d.arrival_date && (
                                <div className="space-y-0.5">
                                  <p className="text-[10px] text-muted-foreground uppercase tracking-wide">{t.arrival}</p>
                                  <p className="text-foreground font-medium text-[11px] sm:text-xs">
                                    {formatDate(d.arrival_date)}{d.arrival_time ? ` · ${d.arrival_time}` : ""}
                                  </p>
                                </div>
                              )}
                            </div>

                            {/* Meta badges */}
                            <div className="flex flex-wrap gap-1 sm:gap-1.5 sm:pl-6">
                              {d.duration && (
                                <Badge variant="outline" className="text-[10px] font-body gap-1">
                                  ⏱ {d.duration}
                                </Badge>
                              )}
                              {d.cabin_class && (
                                <Badge variant="outline" className="text-[10px] font-body">
                                  {getCabinClassLabel(lang, d.cabin_class)}
                                </Badge>
                              )}
                              {d.connections && (
                                <Badge variant="outline" className="text-[10px] font-body">
                                  {getConnectionsLabel(lang, d.connections)}
                                </Badge>
                              )}
                            </div>

                            {/* Observation */}
                            {d.observation && (
                              <p className="text-[11px] text-muted-foreground font-body italic sm:pl-6">{d.observation}</p>
                            )}
                          </div>
                        );
                      }

                      return (
                        <div key={idx} className="border border-border rounded-lg p-3">
                          {title && <p className="text-sm font-medium text-foreground font-body">{title}</p>}
                          {description && <p className="text-xs text-muted-foreground font-body mt-0.5">{description}</p>}
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Payment terms */}
        {getContent("payment_terms") && (
          <div className="glass-card rounded-xl p-4 sm:p-5 space-y-1">
            <h2 className="text-sm font-semibold text-foreground font-body">{t.paymentTerms}</h2>
            <p className="text-xs sm:text-sm text-muted-foreground font-body whitespace-pre-line">{getContent("payment_terms")}</p>
          </div>
        )}

        {/* Terms */}
        {getContent("terms_conditions") && (
          <div className="glass-card rounded-xl p-4 sm:p-5 space-y-1">
            <h2 className="text-sm font-semibold text-foreground font-body">{t.termsConditions}</h2>
            <p className="text-xs sm:text-sm text-muted-foreground font-body whitespace-pre-line">{getContent("terms_conditions")}</p>
          </div>
        )}

        {/* Other info */}
        {getContent("other_info") && (
          <div className="glass-card rounded-xl p-4 sm:p-5 space-y-1">
            <h2 className="text-sm font-semibold text-foreground font-body">{t.otherInfo}</h2>
            <p className="text-xs sm:text-sm text-muted-foreground font-body whitespace-pre-line">{getContent("other_info")}</p>
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="border-t border-border bg-card mt-12 print:mt-4">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 py-4 text-center space-y-1">
          <p className="text-xs text-muted-foreground font-body">
            {t.quoteGeneratedBy} <span className="font-medium text-foreground">{agencyName}</span>
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
