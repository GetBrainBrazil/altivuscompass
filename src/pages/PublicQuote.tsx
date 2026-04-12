import { useEffect, useState, useCallback, useRef } from "react";
import { useParams } from "react-router-dom";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plane, Hotel, Bus, Ship, Sparkles, Shield, Package, CalendarDays, Map, Phone, Mail, Instagram, Printer, Globe, Loader2, Backpack, Briefcase, Luggage, Plus, Minus, MapPin, ExternalLink, Clock } from "lucide-react";
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
  const [fontScale, setFontScale] = useState(0); // -1, 0, +1, +2
  const [hotelPhotos, setHotelPhotos] = useState<Record<string, string>>({});

  const t = getTranslations(lang);

  // Force light mode on this page — override browser dark mode
  useEffect(() => {
    const html = document.documentElement;
    const body = document.body;
    const root = document.getElementById("root");
    const hadDarkClass = html.classList.contains("dark");
    const previousHtmlColorScheme = html.style.colorScheme;
    const previousHtmlBackground = html.style.backgroundColor;
    const previousHtmlForcedColorAdjust = html.style.getPropertyValue("forced-color-adjust");
    const previousBodyBackground = body.style.backgroundColor;
    const previousBodyBackgroundImage = body.style.backgroundImage;
    const previousBodyColor = body.style.color;
    const previousBodyForcedColorAdjust = body.style.getPropertyValue("forced-color-adjust");
    const previousRootBackground = root?.style.backgroundColor ?? "";
    const previousRootBackgroundImage = root?.style.backgroundImage ?? "";
    const previousRootColor = root?.style.color ?? "";
    const previousRootForcedColorAdjust = root?.style.getPropertyValue("forced-color-adjust") ?? "";

    const ensureMeta = (name: string, content: string) => {
      let meta = document.querySelector(`meta[name="${name}"]`) as HTMLMetaElement | null;
      const created = !meta;
      const previousContent = meta?.content ?? "";

      if (!meta) {
        meta = document.createElement("meta");
        meta.name = name;
        document.head.appendChild(meta);
      }

      meta.content = content;

      return () => {
        if (!meta) return;
        if (created) meta.remove();
        else meta.content = previousContent;
      };
    };

    const restoreColorScheme = ensureMeta("color-scheme", "light");
    const restoreSupportedSchemes = ensureMeta("supported-color-schemes", "light");
    const restoreThemeColor = ensureMeta("theme-color", "#ffffff");

    html.classList.remove("dark");
    html.classList.add("public-quote-light-root");
    body.classList.add("public-quote-light-body");
    root?.classList.add("public-quote-light-app");
    html.style.colorScheme = "only light";
    html.style.backgroundColor = "#ffffff";
    html.style.setProperty("forced-color-adjust", "none");
    body.style.backgroundColor = "#ffffff";
    body.style.backgroundImage = "none";
    body.style.color = "#111827";
    body.style.setProperty("forced-color-adjust", "none");
    if (root) {
      root.style.backgroundColor = "#ffffff";
      root.style.backgroundImage = "none";
      root.style.color = "#111827";
      root.style.setProperty("forced-color-adjust", "none");
    }

    return () => {
      html.classList.remove("public-quote-light-root");
      body.classList.remove("public-quote-light-body");
      root?.classList.remove("public-quote-light-app");
      if (hadDarkClass) html.classList.add("dark");
      html.style.colorScheme = previousHtmlColorScheme;
      html.style.backgroundColor = previousHtmlBackground;
      if (previousHtmlForcedColorAdjust) html.style.setProperty("forced-color-adjust", previousHtmlForcedColorAdjust);
      else html.style.removeProperty("forced-color-adjust");
      body.style.backgroundColor = previousBodyBackground;
      body.style.backgroundImage = previousBodyBackgroundImage;
      body.style.color = previousBodyColor;
      if (previousBodyForcedColorAdjust) body.style.setProperty("forced-color-adjust", previousBodyForcedColorAdjust);
      else body.style.removeProperty("forced-color-adjust");
      if (root) {
        root.style.backgroundColor = previousRootBackground;
        root.style.backgroundImage = previousRootBackgroundImage;
        root.style.color = previousRootColor;
        if (previousRootForcedColorAdjust) root.style.setProperty("forced-color-adjust", previousRootForcedColorAdjust);
        else root.style.removeProperty("forced-color-adjust");
      }
      restoreColorScheme();
      restoreSupportedSchemes();
      restoreThemeColor();
    };
  }, []);

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

  // Fetch hotel photos from Google Places JS API
  useEffect(() => {
    if (!data) return;
    const hotelItems = data.items.filter((i: any) => i.item_type === "hotel" && i.title);
    if (hotelItems.length === 0) return;

    const fetchPhotos = async () => {
      try {
        const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
        const res = await fetch(`${supabaseUrl}/functions/v1/get-maps-key`);
        const json = await res.json();
        const apiKey = json?.key;
        if (!apiKey) return;

        // Load Google Maps JS API if not loaded
        if (!(window as any).google?.maps?.places) {
          await new Promise<void>((resolve, reject) => {
            const s = document.createElement("script");
            s.src = `https://maps.googleapis.com/maps/api/js?key=${apiKey}&libraries=places`;
            s.async = true;
            s.onload = () => resolve();
            s.onerror = () => reject();
            document.head.appendChild(s);
          });
        }

        const mapDiv = document.createElement("div");
        const service = new (window as any).google.maps.places.PlacesService(mapDiv);

        const photos: Record<string, string> = {};
        for (const item of hotelItems) {
          try {
            await new Promise<void>((resolve) => {
              service.findPlaceFromQuery(
                { query: `${item.title} hotel`, fields: ["photos", "place_id"] },
                (results: any, status: any) => {
                  if (status === "OK" && results?.[0]?.photos?.[0]) {
                    photos[item.title] = results[0].photos[0].getUrl({ maxWidth: 400, maxHeight: 300 });
                  }
                  resolve();
                }
              );
            });
          } catch {}
        }
        setHotelPhotos(photos);
      } catch {}
    };
    fetchPhotos();
  }, [data]);

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
      <div className="min-h-screen flex items-center justify-center bg-white">
        <p className="text-gray-500 font-body animate-pulse">{t.loading}</p>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white">
        <div className="text-center space-y-2">
          <p className="text-lg font-semibold text-gray-900 font-display">{error || t.error}</p>
          <p className="text-sm text-gray-500 font-body">{t.checkLink}</p>
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
    <div className="public-quote public-quote-shell min-h-screen bg-white text-gray-900" data-theme="light" style={{ ["--pq-font-step" as string]: fontScale }}>
      {/* Top toolbar - hidden on print */}
      <div className="public-quote-toolbar print:hidden">
        <div className="max-w-5xl mx-auto px-2 sm:px-6 py-2 flex flex-nowrap items-center justify-between gap-2 sm:gap-3 border-b border-gray-200 bg-white">
          <div className="flex min-w-0 flex-nowrap items-center gap-1 sm:gap-2">
            {quote.client_phone && (
              <Button variant="outline" size="sm" className="public-quote-control-button gap-1 font-body h-8 px-2 sm:px-3" onClick={handleWhatsApp}>
                <Phone className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">{t.sendWhatsApp}</span>
                <span className="sm:hidden">WhatsApp</span>
              </Button>
            )}
            <Button variant="outline" size="sm" className="public-quote-control-button gap-1 font-body h-8 px-2 sm:px-3" onClick={() => window.print()}>
              <Printer className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">{t.printPdf}</span>
              <span className="sm:hidden">PDF</span>
            </Button>

            <div className="flex items-center gap-0.5 sm:hidden shrink-0">
              <Button
                variant="outline"
                size="sm"
                className="public-quote-control-button h-8 w-8 p-0 font-body"
                onClick={() => setFontScale(s => Math.max(-1, s - 1))}
                disabled={fontScale <= -1}
              >
                <Minus className="w-3.5 h-3.5" />
              </Button>
              <span className="public-quote-control-label font-body text-gray-500 w-4 text-center shrink-0">A</span>
              <Button
                variant="outline"
                size="sm"
                className="public-quote-control-button h-8 w-8 p-0 font-body"
                onClick={() => setFontScale(s => Math.min(2, s + 1))}
                disabled={fontScale >= 2}
              >
                <Plus className="w-3.5 h-3.5" />
              </Button>
            </div>

            {translating && (
              <div className="hidden sm:flex items-center gap-1.5 text-xs text-muted-foreground font-body ml-1 shrink-0">
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                <span>Traduzindo...</span>
              </div>
            )}
          </div>

          <div className="shrink-0">
            <Select value={lang} onValueChange={(v) => handleLangChange(v as QuoteLang)}>
              <SelectTrigger className="public-quote-control-button h-8 w-[112px] sm:w-[160px] font-body px-2 sm:px-3">
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
                  <SelectItem key={opt.value} value={opt.value} className="pq-fs-xs sm:text-xs font-body">
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
      <header className="border-b border-gray-200 bg-white">
        <div className="max-w-5xl mx-auto px-3 sm:px-6 py-4 sm:py-5">
          <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3 sm:gap-4">
            {/* Top row on mobile: logo + agency info */}
            <div className="flex items-start justify-between gap-3 sm:contents">
              <div className="flex-shrink-0">
                <img src={agencyLogo} alt={agencyName} className="h-14 sm:h-16 object-contain" />
              </div>
              {/* Agency info - always visible */}
              <div className="flex-shrink-0 text-right space-y-0.5 sm:order-3">
                {agency?.name && <p className="pq-fs-xs sm:text-sm font-semibold text-gray-900 font-body">{agency.name}</p>}
                {agency?.cnpj && (
                  <p className="pq-fs-3xs sm:text-xs text-gray-500 font-body flex items-center justify-end gap-1">
                    {agency.cnpj} <span className="pq-fs-3xs">📋</span>
                  </p>
                )}
                {agency?.phone && (
                  <p className="pq-fs-3xs sm:text-xs text-gray-500 font-body flex items-center justify-end gap-1">
                    {agency.phone} <Phone className="w-3 h-3" />
                  </p>
                )}
                {agency?.email && (
                  <p className="pq-fs-3xs sm:text-xs text-gray-500 font-body flex items-center justify-end gap-1">
                    {agency.email} <Mail className="w-3 h-3" />
                  </p>
                )}
                {agency?.instagram && (
                  <p className="pq-fs-3xs sm:text-xs text-gray-500 font-body flex items-center justify-end gap-1">
                    {agency.instagram} <Instagram className="w-3 h-3" />
                  </p>
                )}
              </div>
            </div>
            {/* Title centered */}
            <div className="flex-1 text-center sm:order-2">
              <h1 className="pq-fs-base sm:text-xl font-display font-bold text-gray-900 tracking-wide uppercase">
                {t.travelQuote}
              </h1>
              <div className="mt-1">
                <Badge variant="outline" className="font-body pq-fs-xs sm:text-xs px-3 py-0.5 font-medium border-gray-300 text-gray-700">
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
        <div className="bg-white border border-gray-200 shadow-sm rounded-xl p-4 sm:p-5 space-y-3">
          <div className="flex flex-col sm:flex-row sm:flex-wrap sm:items-center sm:justify-between gap-2 sm:gap-3">
            <div className="space-y-1">
              {quote.client_name && (
                <p className="text-gray-500 font-body pq-fs-sm sm:text-sm">
                  {t.client}: <span className="text-gray-900 font-semibold">{quote.client_name}</span>
                  {quote.travel_date_start && (
                    <span className="block sm:inline sm:ml-3 text-gray-500 pq-fs-xs sm:text-sm mt-0.5 sm:mt-0">
                      {quote.travel_date_start.split("-").reverse().join("/")}{quote.travel_date_end ? ` – ${quote.travel_date_end.split("-").reverse().join("/")}` : ""}
                    </span>
                  )}
                </p>
              )}
            </div>
            {quote.total_value != null && quote.total_value > 0 && (
              <div className="text-left sm:text-right">
                <p className="pq-fs-xs sm:text-xs text-gray-500 font-body">{t.totalValue}</p>
                <p className="pq-fs-lg sm:text-xl font-display font-bold text-gray-900">{formatCurrency(quote.total_value)}</p>
              </div>
            )}
          </div>
        </div>

        {/* Details */}
        {getContent("details") && (
          <div className="bg-white border border-gray-200 shadow-sm rounded-xl p-4 sm:p-5 space-y-1">
            <h2 className="pq-fs-sm sm:text-sm font-semibold text-gray-900 font-body">{t.details}</h2>
            <p className="pq-fs-sm sm:text-sm text-gray-500 font-body whitespace-pre-line leading-relaxed">{getContent("details")}</p>
          </div>
        )}

        {/* Travelers */}
        {(() => {
          const clientIsTraveling = quote.price_breakdown?.client_self_traveling === true;
          const hasTravelers = clientIsTraveling || passengers.length > 0;
          if (!hasTravelers) return null;
          return (
            <div className="bg-white border border-gray-200 shadow-sm rounded-xl p-5 space-y-2">
              <h2 className="pq-fs-sm sm:text-sm font-semibold text-gray-900 font-body">{t.travelers}</h2>
              <div className="flex flex-wrap gap-2">
                {clientIsTraveling && quote.client_name && (
                  <span className="inline-flex items-center px-2.5 py-0.5 rounded-full pq-fs-sm sm:text-xs font-body bg-gray-100 text-gray-700">{quote.client_name}</span>
                )}
                {passengers.map((p, i) => (
                  <span key={i} className="inline-flex items-center px-2.5 py-0.5 rounded-full pq-fs-sm sm:text-xs font-body bg-gray-100 text-gray-700">
                    {p.full_name}
                    {p.relationship_type && (
                      <span className="ml-1 opacity-60">({getRelationshipLabel(lang, p.relationship_type)})</span>
                    )}
                  </span>
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
                <div key={type} className="bg-white border border-gray-200 shadow-sm rounded-xl p-4 sm:p-5 space-y-3">
                  <div className="flex items-center gap-2">
                    <Icon className="w-4 h-4 text-amber-600" />
                    <h2 className="pq-fs-sm sm:text-sm font-semibold text-gray-900 font-body">
                      {getItemTypeLabel(lang, type)}
                    </h2>
                    <span className="inline-flex items-center px-1.5 py-0.5 rounded-full pq-fs-3xs h-5 border border-gray-300 text-gray-600">{typeEntries.length}</span>
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

                        return (
                          <div key={idx} className="border border-gray-200 rounded-lg p-3 sm:p-4 space-y-2 sm:space-y-2.5">
                            {/* Route header - stacked on mobile */}
                            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                              <div className="flex items-center gap-2 flex-wrap">
                                {dirLabel && (
                                  <span className="inline-flex items-center px-2 py-0.5 rounded-full pq-fs-3xs font-body bg-gray-100 text-gray-700 flex-shrink-0">{dirLabel}</span>
                                )}
                                <div className="flex items-center gap-1.5 pq-fs-sm sm:text-sm font-bold text-gray-900 font-body">
                                  {d.origin && <span>{d.origin}</span>}
                                  {d.origin && d.destination && <Plane className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" />}
                                  {d.destination && <span>{d.destination}</span>}
                                </div>
                              </div>
                              {d.airline && (
                                <div className="flex flex-row sm:flex-col items-center sm:items-end gap-2 sm:gap-1.5">
                                  <div className="flex items-center gap-2">
                                    {(() => {
                                      const iataMatch = d.airline.match(/\(([A-Z0-9]{2})\)/);
                                      const iata = iataMatch?.[1];
                                      return iata ? (
                                        <img
                                          src={`https://pics.avs.io/60/60/${iata}.png`}
                                          alt={d.airline}
                                          className="w-6 h-6 object-contain"
                                          onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
                                        />
                                      ) : null;
                                    })()}
                                    <span className="pq-fs-xs sm:text-xs text-gray-500 font-body">
                                      {d.airline}{d.flight_number ? ` (${d.flight_number})` : ""}
                                    </span>
                                  </div>
                                  <div className="flex items-center gap-1">
                                    <div className="flex flex-col items-center border border-gray-200 rounded px-1.5 py-1 min-w-[36px]">
                                      <Backpack className="w-3.5 h-3.5 text-blue-800" />
                                      <span className="pq-fs-4xs text-gray-500 font-body">{t.backpack}</span>
                                      <span className="pq-fs-3xs font-medium text-gray-900 font-body">{d.pax_adults ?? 0}</span>
                                    </div>
                                    <div className="flex flex-col items-center border border-gray-200 rounded px-1.5 py-1 min-w-[36px]">
                                      <Briefcase className="w-3.5 h-3.5 text-blue-800" />
                                      <span className="pq-fs-4xs text-gray-500 font-body">{t.carryOn}</span>
                                      <span className="pq-fs-3xs font-medium text-gray-900 font-body">{d.pax_children ?? 0}</span>
                                    </div>
                                    <div className="flex flex-col items-center border border-gray-200 rounded px-1.5 py-1 min-w-[36px]">
                                      <Luggage className="w-3.5 h-3.5 text-blue-800" />
                                      <span className="pq-fs-4xs text-gray-500 font-body">{t.checkedBag}</span>
                                      <span className="pq-fs-3xs font-medium text-gray-900 font-body">{d.pax_infants ?? 0}</span>
                                    </div>
                                  </div>
                                </div>
                              )}
                            </div>

                            {/* Date/time row */}
                            <div className="grid grid-cols-2 gap-2 sm:gap-3 pq-fs-xs sm:text-xs font-body sm:pl-6">
                              {d.departure_date && (
                                <div className="space-y-0.5">
                                  <p className="pq-fs-2xs sm:text-[10px] text-gray-400 uppercase tracking-wide">{t.departure}</p>
                                  <p className="text-gray-900 font-bold pq-fs-xs sm:text-xs">
                                    {formatDate(d.departure_date)}{d.departure_time ? ` · ${d.departure_time}` : ""}
                                  </p>
                                </div>
                              )}
                              {d.arrival_date && (
                                <div className="space-y-0.5">
                                  <p className="pq-fs-2xs sm:text-[10px] text-gray-400 uppercase tracking-wide">{t.arrival}</p>
                                  <p className="text-gray-900 font-bold pq-fs-xs sm:text-xs">
                                    {formatDate(d.arrival_date)}{d.arrival_time ? ` · ${d.arrival_time}` : ""}
                                  </p>
                                </div>
                              )}
                            </div>

                            {/* Meta badges */}
                            <div className="flex flex-wrap gap-1 sm:gap-1.5 sm:pl-6">
                              {d.duration && (
                                <span className="inline-flex items-center px-2 py-0.5 rounded-full pq-fs-3xs font-body border border-gray-300 text-gray-600 gap-1">
                                  ⏱ {d.duration}
                                </span>
                              )}
                              {d.cabin_class && (
                                <span className="inline-flex items-center px-2 py-0.5 rounded-full pq-fs-3xs font-body border border-gray-300 text-gray-600">
                                  {getCabinClassLabel(lang, d.cabin_class)}
                                </span>
                              )}
                              {d.connections && (
                                <span className="inline-flex items-center px-2 py-0.5 rounded-full pq-fs-3xs font-body border border-gray-300 text-gray-600">
                                  {getConnectionsLabel(lang, d.connections)}
                                </span>
                              )}
                            </div>

                            {/* Observation */}
                            {d.observation && (
                              <p className="pq-fs-2xs text-gray-500 font-body italic sm:pl-6">{d.observation}</p>
                            )}
                          </div>
                        );
                      }

                      // Rich hotel card
                      if (type === "hotel") {
                        const formatDate = (ds: string) => ds ? ds.split("-").reverse().join("/") : "";
                        const tripAdvisorUrl = title ? `https://www.tripadvisor.com/Search?q=${encodeURIComponent(title)}` : null;
                        const photoUrl = title ? hotelPhotos[title] : null;

                        return (
                          <div key={idx} className="border border-gray-200 rounded-lg overflow-hidden">
                            <div className="flex flex-col sm:flex-row">
                              {/* Thumbnail */}
                              <div className="sm:w-36 sm:min-h-[120px] h-32 sm:h-auto bg-gray-100 flex-shrink-0 relative overflow-hidden">
                                {photoUrl ? (
                                  <img src={photoUrl} alt={title || ""} className="w-full h-full object-cover" />
                                ) : (
                                  <div className="w-full h-full flex items-center justify-center">
                                    <Hotel className="w-8 h-8 text-gray-300" />
                                  </div>
                                )}
                              </div>
                              {/* Info */}
                              <div className="flex-1 p-3 sm:p-4 space-y-2">
                                <div className="flex items-start justify-between gap-2">
                                  <div>
                                    {title && <p className="pq-fs-sm sm:text-sm font-bold text-gray-900 font-body">{title}</p>}
                                    {d.address && (
                                      <p className="pq-fs-xs sm:text-xs text-gray-500 font-body flex items-center gap-1 mt-0.5">
                                        <MapPin className="w-3 h-3 flex-shrink-0" /> {d.address}
                                      </p>
                                    )}
                                  </div>
                                  {tripAdvisorUrl && (
                                    <a href={tripAdvisorUrl} target="_blank" rel="noopener noreferrer"
                                       className="flex items-center gap-1 px-2 py-1 rounded-full border border-gray-200 pq-fs-3xs text-gray-500 hover:text-green-700 hover:border-green-300 transition-colors flex-shrink-0">
                                      <ExternalLink className="w-3 h-3" />
                                      <span className="hidden sm:inline">TripAdvisor</span>
                                    </a>
                                  )}
                                </div>

                                {/* Dates */}
                                {(d.checkin_date || d.checkout_date) && (
                                  <div className="flex flex-wrap gap-3 pq-fs-xs sm:text-xs font-body">
                                    {d.checkin_date && (
                                      <div className="flex items-center gap-1.5">
                                        <Clock className="w-3 h-3 text-gray-400" />
                                        <span className="text-gray-400">Check-in:</span>
                                        <span className="font-medium text-gray-700">{formatDate(d.checkin_date)}{d.checkin_time ? ` · ${d.checkin_time}` : ""}</span>
                                      </div>
                                    )}
                                    {d.checkout_date && (
                                      <div className="flex items-center gap-1.5">
                                        <Clock className="w-3 h-3 text-gray-400" />
                                        <span className="text-gray-400">Check-out:</span>
                                        <span className="font-medium text-gray-700">{formatDate(d.checkout_date)}{d.checkout_time ? ` · ${d.checkout_time}` : ""}</span>
                                      </div>
                                    )}
                                  </div>
                                )}

                                {/* Details & Description */}
                                {d.hotel_details && (
                                  <p className="pq-fs-xs sm:text-xs text-gray-600 font-body">{d.hotel_details}</p>
                                )}
                                {description && (
                                  <p className="pq-fs-xs sm:text-xs text-gray-500 font-body italic">{description}</p>
                                )}
                              </div>
                            </div>
                          </div>
                        );
                      }

                      return (
                        <div key={idx} className="border border-gray-200 rounded-lg p-3">
                          {title && <p className="pq-fs-sm sm:text-sm font-medium text-gray-900 font-body">{title}</p>}
                          {description && <p className="pq-fs-xs sm:text-xs text-gray-500 font-body mt-0.5">{description}</p>}
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
          <div className="bg-white border border-gray-200 shadow-sm rounded-xl p-4 sm:p-5 space-y-1">
            <h2 className="pq-fs-sm sm:text-sm font-semibold text-gray-900 font-body">{t.paymentTerms}</h2>
            <p className="pq-fs-sm sm:text-sm text-gray-500 font-body whitespace-pre-line leading-relaxed">{getContent("payment_terms")}</p>
          </div>
        )}

        {/* Terms */}
        {getContent("terms_conditions") && (
          <div className="bg-white border border-gray-200 shadow-sm rounded-xl p-4 sm:p-5 space-y-1">
            <h2 className="pq-fs-sm sm:text-sm font-semibold text-gray-900 font-body">{t.termsConditions}</h2>
            <p className="pq-fs-sm sm:text-sm text-gray-500 font-body whitespace-pre-line leading-relaxed">{getContent("terms_conditions")}</p>
          </div>
        )}

        {/* Other info */}
        {getContent("other_info") && (
          <div className="bg-white border border-gray-200 shadow-sm rounded-xl p-4 sm:p-5 space-y-1">
            <h2 className="pq-fs-sm sm:text-sm font-semibold text-gray-900 font-body">{t.otherInfo}</h2>
            <p className="pq-fs-sm sm:text-sm text-gray-500 font-body whitespace-pre-line leading-relaxed">{getContent("other_info")}</p>
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="border-t border-gray-200 bg-white mt-12 print:mt-4">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 py-4 text-center space-y-1">
          <p className="pq-fs-xs sm:text-xs text-gray-500 font-body">
            {t.quoteGeneratedBy} <span className="font-medium text-gray-900">{agencyName}</span>
          </p>
          {agency?.phone && (
            <p className="pq-fs-2xs text-gray-500 font-body">
              {agency.phone} • {agency.email}
            </p>
          )}
        </div>
      </footer>
    </div>
  );
}
