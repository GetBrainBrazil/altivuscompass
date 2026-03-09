export type QuoteLang = "pt" | "en" | "es" | "fr" | "de" | "it";

export const LANG_OPTIONS: { value: QuoteLang; label: string; countryCode: string }[] = [
  { value: "pt", label: "Português", countryCode: "br" },
  { value: "en", label: "English", countryCode: "us" },
  { value: "es", label: "Español", countryCode: "es" },
  { value: "fr", label: "Français", countryCode: "fr" },
  { value: "de", label: "Deutsch", countryCode: "de" },
  { value: "it", label: "Italiano", countryCode: "it" },
];

export function getFlagUrl(countryCode: string) {
  return `https://flagcdn.com/w40/${countryCode}.png`;
}

type TranslationKeys = {
  travelQuote: string;
  quote: string;
  client: string;
  totalValue: string;
  details: string;
  travelers: string;
  paymentTerms: string;
  termsConditions: string;
  otherInfo: string;
  quoteGeneratedBy: string;
  sendWhatsApp: string;
  printPdf: string;
  loading: string;
  notFound: string;
  checkLink: string;
  error: string;
  flights: string;
  accommodation: string;
  transport: string;
  cruise: string;
  experiences: string;
  insurance: string;
  otherServices: string;
  dayByDay: string;
  map: string;
  spouse: string;
  child: string;
  parent: string;
  employee: string;
  partner: string;
  sibling: string;
  other: string;
  // Flight details
  outbound: string;
  inbound: string;
  departure: string;
  arrival: string;
  duration: string;
  airline: string;
  flightNumber: string;
  cabinClass: string;
  connections: string;
  directFlight: string;
  connection1: string;
  connections2: string;
  connections3plus: string;
  economy: string;
  premiumEconomy: string;
  business: string;
  firstClass: string;
  baggage: string;
  backpack: string;
  carryOn: string;
  checkedBag: string;
  observation: string;
};

const flightPt = {
  outbound: "Ida",
  inbound: "Volta",
  departure: "Embarque",
  arrival: "Chegada",
  duration: "Duração",
  airline: "Companhia",
  flightNumber: "Voo",
  cabinClass: "Classe",
  connections: "Conexões",
  directFlight: "Voo direto",
  connection1: "1 conexão",
  connections2: "2 conexões",
  connections3plus: "3+ conexões",
  economy: "Econômica",
  premiumEconomy: "Premium Economy",
  business: "Executiva",
  firstClass: "Primeira",
  baggage: "Bagagem",
  backpack: "Mochila",
  carryOn: "Mão",
  checkedBag: "Despachada",
  observation: "Observação",
};

const flightEn = {
  outbound: "Outbound",
  inbound: "Return",
  departure: "Departure",
  arrival: "Arrival",
  duration: "Duration",
  airline: "Airline",
  flightNumber: "Flight",
  cabinClass: "Class",
  connections: "Connections",
  directFlight: "Direct flight",
  connection1: "1 connection",
  connections2: "2 connections",
  connections3plus: "3+ connections",
  economy: "Economy",
  premiumEconomy: "Premium Economy",
  business: "Business",
  firstClass: "First",
  baggage: "Baggage",
  backpack: "Backpack",
  carryOn: "Carry-on",
  checkedBag: "Checked",
  observation: "Note",
};

const flightEs = {
  outbound: "Ida",
  inbound: "Vuelta",
  departure: "Salida",
  arrival: "Llegada",
  duration: "Duración",
  airline: "Aerolínea",
  flightNumber: "Vuelo",
  cabinClass: "Clase",
  connections: "Conexiones",
  directFlight: "Vuelo directo",
  connection1: "1 conexión",
  connections2: "2 conexiones",
  connections3plus: "3+ conexiones",
  economy: "Económica",
  premiumEconomy: "Premium Economy",
  business: "Ejecutiva",
  firstClass: "Primera",
  baggage: "Equipaje",
  backpack: "Mochila",
  carryOn: "Mano",
  checkedBag: "Facturado",
  observation: "Observación",
};

const flightFr = {
  outbound: "Aller",
  inbound: "Retour",
  departure: "Départ",
  arrival: "Arrivée",
  duration: "Durée",
  airline: "Compagnie",
  flightNumber: "Vol",
  cabinClass: "Classe",
  connections: "Correspondances",
  directFlight: "Vol direct",
  connection1: "1 correspondance",
  connections2: "2 correspondances",
  connections3plus: "3+ correspondances",
  economy: "Économique",
  premiumEconomy: "Premium Economy",
  business: "Affaires",
  firstClass: "Première",
  baggage: "Bagages",
  backpack: "Sac à dos",
  carryOn: "Cabine",
  checkedBag: "Soute",
  observation: "Observation",
};

const flightDe = {
  outbound: "Hinflug",
  inbound: "Rückflug",
  departure: "Abflug",
  arrival: "Ankunft",
  duration: "Dauer",
  airline: "Fluggesellschaft",
  flightNumber: "Flug",
  cabinClass: "Klasse",
  connections: "Umsteigen",
  directFlight: "Direktflug",
  connection1: "1 Umstieg",
  connections2: "2 Umstiege",
  connections3plus: "3+ Umstiege",
  economy: "Economy",
  premiumEconomy: "Premium Economy",
  business: "Business",
  firstClass: "First",
  baggage: "Gepäck",
  backpack: "Rucksack",
  carryOn: "Handgepäck",
  checkedBag: "Aufgegeben",
  observation: "Bemerkung",
};

const flightIt = {
  outbound: "Andata",
  inbound: "Ritorno",
  departure: "Partenza",
  arrival: "Arrivo",
  duration: "Durata",
  airline: "Compagnia",
  flightNumber: "Volo",
  cabinClass: "Classe",
  connections: "Scali",
  directFlight: "Volo diretto",
  connection1: "1 scalo",
  connections2: "2 scali",
  connections3plus: "3+ scali",
  economy: "Economica",
  premiumEconomy: "Premium Economy",
  business: "Business",
  firstClass: "Prima",
  baggage: "Bagaglio",
  backpack: "Zaino",
  carryOn: "Mano",
  checkedBag: "Stiva",
  observation: "Osservazione",
};

const translations: Record<QuoteLang, TranslationKeys> = {
  pt: {
    travelQuote: "Orçamento de Viagem",
    quote: "Cotação",
    client: "Cliente",
    totalValue: "Valor Total",
    details: "Detalhes",
    travelers: "Viajantes",
    paymentTerms: "Forma de Pagamento",
    termsConditions: "Termos e Condições",
    otherInfo: "Outras Informações",
    quoteGeneratedBy: "Cotação gerada por",
    sendWhatsApp: "Enviar por WhatsApp",
    printPdf: "Imprimir/PDF",
    loading: "Carregando cotação...",
    notFound: "Cotação não encontrada.",
    checkLink: "Verifique o link e tente novamente.",
    error: "Erro ao carregar",
    flights: "Voos",
    accommodation: "Hospedagem",
    transport: "Transporte",
    cruise: "Cruzeiro",
    experiences: "Experiências",
    insurance: "Seguros",
    otherServices: "Outros Serviços",
    dayByDay: "Roteiro Dia a Dia",
    map: "Mapa",
    spouse: "Cônjuge",
    child: "Filho(a)",
    parent: "Pai/Mãe",
    employee: "Funcionário(a)",
    partner: "Sócio(a)",
    sibling: "Irmão/Irmã",
    other: "Outro",
    ...flightPt,
  },
  en: {
    travelQuote: "Travel Quote",
    quote: "Quote",
    client: "Client",
    totalValue: "Total Value",
    details: "Details",
    travelers: "Travelers",
    paymentTerms: "Payment Terms",
    termsConditions: "Terms & Conditions",
    otherInfo: "Additional Information",
    quoteGeneratedBy: "Quote generated by",
    sendWhatsApp: "Send via WhatsApp",
    printPdf: "Print/PDF",
    loading: "Loading quote...",
    notFound: "Quote not found.",
    checkLink: "Please check the link and try again.",
    error: "Error loading",
    flights: "Flights",
    accommodation: "Accommodation",
    transport: "Transport",
    cruise: "Cruise",
    experiences: "Experiences",
    insurance: "Insurance",
    otherServices: "Other Services",
    dayByDay: "Day-by-Day Itinerary",
    map: "Map",
    spouse: "Spouse",
    child: "Child",
    parent: "Parent",
    employee: "Employee",
    partner: "Partner",
    sibling: "Sibling",
    other: "Other",
    ...flightEn,
  },
  es: {
    travelQuote: "Presupuesto de Viaje",
    quote: "Cotización",
    client: "Cliente",
    totalValue: "Valor Total",
    details: "Detalles",
    travelers: "Viajeros",
    paymentTerms: "Forma de Pago",
    termsConditions: "Términos y Condiciones",
    otherInfo: "Otra Información",
    quoteGeneratedBy: "Cotización generada por",
    sendWhatsApp: "Enviar por WhatsApp",
    printPdf: "Imprimir/PDF",
    loading: "Cargando cotización...",
    notFound: "Cotización no encontrada.",
    checkLink: "Verifique el enlace e intente nuevamente.",
    error: "Error al cargar",
    flights: "Vuelos",
    accommodation: "Alojamiento",
    transport: "Transporte",
    cruise: "Crucero",
    experiences: "Experiencias",
    insurance: "Seguros",
    otherServices: "Otros Servicios",
    dayByDay: "Itinerario Día a Día",
    map: "Mapa",
    spouse: "Cónyuge",
    child: "Hijo(a)",
    parent: "Padre/Madre",
    employee: "Empleado(a)",
    partner: "Socio(a)",
    sibling: "Hermano(a)",
    other: "Otro",
    ...flightEs,
  },
  fr: {
    travelQuote: "Devis de Voyage",
    quote: "Devis",
    client: "Client",
    totalValue: "Valeur Totale",
    details: "Détails",
    travelers: "Voyageurs",
    paymentTerms: "Modalités de Paiement",
    termsConditions: "Termes et Conditions",
    otherInfo: "Autres Informations",
    quoteGeneratedBy: "Devis généré par",
    sendWhatsApp: "Envoyer par WhatsApp",
    printPdf: "Imprimer/PDF",
    loading: "Chargement du devis...",
    notFound: "Devis introuvable.",
    checkLink: "Vérifiez le lien et réessayez.",
    error: "Erreur de chargement",
    flights: "Vols",
    accommodation: "Hébergement",
    transport: "Transport",
    cruise: "Croisière",
    experiences: "Expériences",
    insurance: "Assurances",
    otherServices: "Autres Services",
    dayByDay: "Itinéraire Jour par Jour",
    map: "Carte",
    spouse: "Conjoint(e)",
    child: "Enfant",
    parent: "Parent",
    employee: "Employé(e)",
    partner: "Associé(e)",
    sibling: "Frère/Sœur",
    other: "Autre",
    ...flightFr,
  },
  de: {
    travelQuote: "Reiseangebot",
    quote: "Angebot",
    client: "Kunde",
    totalValue: "Gesamtwert",
    details: "Details",
    travelers: "Reisende",
    paymentTerms: "Zahlungsbedingungen",
    termsConditions: "Geschäftsbedingungen",
    otherInfo: "Weitere Informationen",
    quoteGeneratedBy: "Angebot erstellt von",
    sendWhatsApp: "Per WhatsApp senden",
    printPdf: "Drucken/PDF",
    loading: "Angebot wird geladen...",
    notFound: "Angebot nicht gefunden.",
    checkLink: "Bitte überprüfen Sie den Link und versuchen Sie es erneut.",
    error: "Fehler beim Laden",
    flights: "Flüge",
    accommodation: "Unterkunft",
    transport: "Transport",
    cruise: "Kreuzfahrt",
    experiences: "Erlebnisse",
    insurance: "Versicherungen",
    otherServices: "Weitere Dienstleistungen",
    dayByDay: "Tagesablauf",
    map: "Karte",
    spouse: "Ehepartner(in)",
    child: "Kind",
    parent: "Elternteil",
    employee: "Mitarbeiter(in)",
    partner: "Partner(in)",
    sibling: "Geschwister",
    other: "Sonstige",
    ...flightDe,
  },
  it: {
    travelQuote: "Preventivo di Viaggio",
    quote: "Preventivo",
    client: "Cliente",
    totalValue: "Valore Totale",
    details: "Dettagli",
    travelers: "Viaggiatori",
    paymentTerms: "Modalità di Pagamento",
    termsConditions: "Termini e Condizioni",
    otherInfo: "Altre Informazioni",
    quoteGeneratedBy: "Preventivo generato da",
    sendWhatsApp: "Invia via WhatsApp",
    printPdf: "Stampa/PDF",
    loading: "Caricamento preventivo...",
    notFound: "Preventivo non trovato.",
    checkLink: "Controlla il link e riprova.",
    error: "Errore durante il caricamento",
    flights: "Voli",
    accommodation: "Alloggio",
    transport: "Trasporto",
    cruise: "Crociera",
    experiences: "Esperienze",
    insurance: "Assicurazioni",
    otherServices: "Altri Servizi",
    dayByDay: "Itinerario Giorno per Giorno",
    map: "Mappa",
    spouse: "Coniuge",
    child: "Figlio/a",
    parent: "Genitore",
    employee: "Dipendente",
    partner: "Socio/a",
    sibling: "Fratello/Sorella",
    other: "Altro",
    ...flightIt,
  },
};

export function getTranslations(lang: QuoteLang) {
  return translations[lang];
}

export function getItemTypeLabel(lang: QuoteLang, itemType: string): string {
  const t = translations[lang];
  const map: Record<string, string> = {
    flight: t.flights,
    hotel: t.accommodation,
    transport: t.transport,
    cruise: t.cruise,
    experience: t.experiences,
    insurance: t.insurance,
    other_service: t.otherServices,
    itinerary: t.dayByDay,
    map: t.map,
  };
  return map[itemType] || itemType;
}

export function getRelationshipLabel(lang: QuoteLang, relType: string): string {
  const t = translations[lang];
  const map: Record<string, string> = {
    spouse: t.spouse,
    child: t.child,
    parent: t.parent,
    employee: t.employee,
    partner: t.partner,
    sibling: t.sibling,
    other: t.other,
  };
  return map[relType] || relType;
}

export function getCabinClassLabel(lang: QuoteLang, cls: string): string {
  const t = translations[lang];
  const map: Record<string, string> = {
    economy: t.economy,
    premium_economy: t.premiumEconomy,
    business: t.business,
    first: t.firstClass,
  };
  return map[cls] || cls;
}

export function getConnectionsLabel(lang: QuoteLang, conn: string): string {
  const t = translations[lang];
  const map: Record<string, string> = {
    direct: t.directFlight,
    "1": t.connection1,
    "2": t.connections2,
    "3+": t.connections3plus,
  };
  return map[conn] || conn;
}

export function getFlightDirectionLabel(lang: QuoteLang, dir: string): string {
  const t = translations[lang];
  const map: Record<string, string> = {
    outbound: t.outbound,
    inbound: t.inbound,
    return: t.inbound,
  };
  return map[dir] || dir;
}
