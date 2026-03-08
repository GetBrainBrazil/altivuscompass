import React, { useState, useMemo, useEffect, useRef } from "react";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Checkbox } from "@/components/ui/checkbox";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { ArrowUp, ArrowDown, ArrowUpDown, ChevronsUpDown, X, Plus, ArrowLeft, Star, Trash2, AlertTriangle, AlertCircle, ShieldAlert, Info, ChevronRight, ChevronDown, Users, Eye, EyeOff } from "lucide-react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { useCountries, useStates, useCities } from "@/components/LocationsTab";
import { COUNTRY_CODES, applyPhoneMask } from "@/lib/phone-masks";
import { ImageEditor } from "@/components/ImageEditor";
import { ClientTravelersTab } from "@/components/ClientTravelersTab";
import { useAuth } from "@/contexts/AuthContext";
import { canAccessFeature } from "@/lib/permissions";

type SortDir = "asc" | "desc";
type SortState = { key: string; dir: SortDir } | null;

function sortData<T extends Record<string, any>>(data: T[], sort: SortState): T[] {
  if (!sort) return data;
  return [...data].sort((a, b) => {
    const va = (a[sort.key] ?? "").toString().toLowerCase();
    const vb = (b[sort.key] ?? "").toString().toLowerCase();
    return sort.dir === "asc" ? va.localeCompare(vb) : -va.localeCompare(vb);
  });
}

function toggleSort(sort: SortState, key: string): SortState {
  if (sort?.key === key) {
    if (sort.dir === "asc") return { key, dir: "desc" };
    return null;
  }
  return { key, dir: "asc" };
}

const travelProfiles: Record<string, { label: string; color: string; description: string }> = {
  economic: { label: "Econômico", color: "bg-soft-blue/10 text-soft-blue", description: "Prefere viajar de econômica e busca menores preços" },
  opportunity: { label: "Conforto", color: "bg-gold/10 text-gold", description: "Se tiver oportunidade de executiva ou premium, prefere pagar um pouco a mais" },
  sophisticated: { label: "Premium", color: "bg-primary/10 text-primary", description: "Prefere executiva" },
};

type PhoneEntry = { id?: string; phone: string; description: string; country_code: string; is_primary: boolean };
type EmailEntry = { id?: string; email: string; description: string; is_primary: boolean };
type SocialEntry = { id?: string; network: string; handle: string };
type VisaEntry = { id?: string; visa_type: string; validity_date: string; country_region: string; visa_number: string; issue_date: string; entry_type: string; description: string; image_url: string; _imageFile?: File };
type MilesEntry = { id?: string; program_name: string; airline: string; membership_number: string; login_username: string; login_email: string; login_password_encrypted: string; miles_balance: number | null };

const VISA_TYPES = [
  "Turismo", "Negócios", "Estudo", "Trabalho", "Trânsito", "Diplomático",
  "Oficial", "Jornalista", "Religioso", "Pesquisa", "Investidor",
  "Nômade Digital", "Tratamento Médico", "Reunião Familiar", "Au Pair", "Outro"
];

const VISA_REGIONS = [
  "EUA", "Schengen Area", "Reino Unido", "Canadá", "Austrália", "Japão",
  "China", "Índia", "Emirados Árabes", "Brasil", "Argentina", "México",
  "Nova Zelândia", "Coreia do Sul", "Singapura", "Turquia", "Rússia", "Outro"
];
type PassportEntry = {
  id?: string; passport_number: string; issue_date: string; expiry_date: string;
  nationality: string; status: string; visas: VisaEntry[];
  image_urls: string[]; _imageFiles?: File[];
};

const RELATIONSHIP_LABELS: Record<string, string> = {
  spouse: "Cônjuge", child: "Filho(a)", parent: "Pai/Mãe", employee: "Funcionário(a)",
  partner: "Sócio(a)", sibling: "Irmão(ã)", other: "Outro",
};

const TAG_COLORS: Record<string, string> = {
  blue: "bg-blue-500/15 text-blue-600",
  green: "bg-green-500/15 text-green-600",
  red: "bg-red-500/15 text-red-600",
  yellow: "bg-yellow-500/15 text-yellow-700",
  purple: "bg-purple-500/15 text-purple-600",
  orange: "bg-orange-500/15 text-orange-600",
  pink: "bg-pink-500/15 text-pink-600",
  gray: "bg-muted text-muted-foreground",
};

const SOCIAL_NETWORKS = ["Instagram", "Facebook", "LinkedIn", "Twitter/X", "TikTok", "YouTube", "Outro"];
const MARITAL_STATUSES = ["Solteiro(a)", "Casado(a)", "Separado(a)", "Divorciado(a)", "Viúvo(a)"];

function StarRating({ value, onChange }: { value: number; onChange: (v: number) => void }) {
  return (
    <div className="flex gap-1">
      {[1, 2, 3, 4, 5].map((i) => (
        <button key={i} type="button" onClick={() => onChange(value === i ? 0 : i)} className="focus:outline-none">
          <Star className={`h-5 w-5 transition-colors ${i <= value ? "fill-amber-400 text-amber-400" : "text-muted-foreground/40"}`} />
        </button>
      ))}
    </div>
  );
}

const emptyForm = {
  full_name: "", birth_date: "", gender: "", is_active: true, website: "",
  rating: 0, accepts_email_comm: false, accepts_whatsapp_comm: false,
  travel_profile: "economic" as const, passport_status: "none",
  notes: "", country: "Brasil", state: "", city: "",
  preferred_airports: [] as string[], tags: [] as string[],
  cpf_cnpj: "", rg: "", rg_issuer: "", foreign_id: "", nationality: "",
  marital_status: "", seat_preference: "",
  cep: "", neighborhood: "", address_street: "", address_number: "", address_complement: "",
};

export default function Clients() {
  const { toast } = useToast();
  const { userRole } = useAuth();
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [expandedClients, setExpandedClients] = useState<Set<string>>(new Set());
  const [profileFilter, setProfileFilter] = useState("all");
  const [tagFilter, setTagFilter] = useState<string[]>([]);
  const [sort, setSort] = useState<SortState>(null);
  const [view, setView] = useState<"list" | "form">("list");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [activeTab, setActiveTab] = useState("contact");

  // Multi-value entries
  const [phones, setPhones] = useState<PhoneEntry[]>([]);
  const [emails, setEmails] = useState<EmailEntry[]>([]);
  const [socials, setSocials] = useState<SocialEntry[]>([]);
  const [passports, setPassports] = useState<PassportEntry[]>([]);
  const [milesPrograms, setMilesPrograms] = useState<MilesEntry[]>([]);
  const [showPasswords, setShowPasswords] = useState<Record<number, boolean>>({});

  // Image editor state
  const [editorOpen, setEditorOpen] = useState(false);
  const [editorSrc, setEditorSrc] = useState("");
  const [editorCallback, setEditorCallback] = useState<((file: File) => void) | null>(null);

  const openEditor = (file: File, callback: (editedFile: File) => void) => {
    const url = URL.createObjectURL(file);
    setEditorSrc(url);
    setEditorCallback(() => callback);
    setEditorOpen(true);
  };

  // Airport selection
  const [selectedAirports, setSelectedAirports] = useState<string[]>([]);
  const [airportSearch, setAirportSearch] = useState("");
  const [airportPopoverOpen, setAirportPopoverOpen] = useState(false);

  // Tags selection
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [tagPopoverOpen, setTagPopoverOpen] = useState(false);

  // Quick-add location
  const [quickAddType, setQuickAddType] = useState<"country" | "state" | "city" | null>(null);
  const [quickAddName, setQuickAddName] = useState("");

  // Location hooks
  const { data: dbCountries = [] } = useCountries();
  const selectedCountryObj = dbCountries.find((c: any) => c.name === form.country);
  const { data: dbStates = [] } = useStates(selectedCountryObj?.id);
  const selectedStateObj = (dbStates as any[]).find((s: any) => s.name === form.state);
  const { data: dbCities = [] } = useCities(selectedCountryObj?.id, selectedStateObj?.id || undefined);

  // Address location hooks (for address tab)
  const addrCountryObj = dbCountries.find((c: any) => c.name === form.country);

  const { data: airportsList = [] } = useQuery({
    queryKey: ["airports-list"],
    queryFn: async () => {
      const { data, error } = await supabase.from("airports").select("iata_code, name, city, country").order("iata_code");
      if (error) throw error;
      return data;
    },
  });

  const { data: availableTags = [] } = useQuery({
    queryKey: ["tags"],
    queryFn: async () => {
      const { data, error } = await supabase.from("tags").select("*").order("name");
      if (error) throw error;
      return data;
    },
  });

  const { data: airlinesList = [] } = useQuery({
    queryKey: ["airlines-list"],
    queryFn: async () => {
      const { data, error } = await supabase.from("airlines").select("id, name, iata_code, mileage_program_name").order("name");
      if (error) throw error;
      return data;
    },
  });

  const filteredAirports = useMemo(() => {
    if (!airportSearch) return airportsList;
    const q = airportSearch.toLowerCase();
    return airportsList.filter((a) =>
      a.iata_code.toLowerCase().includes(q) || a.name.toLowerCase().includes(q) || a.city.toLowerCase().includes(q)
    );
  }, [airportsList, airportSearch]);

  const { data: clients = [], isLoading } = useQuery({
    queryKey: ["clients"],
    queryFn: async () => {
      const { data, error } = await supabase.from("clients").select("*, client_phones(*), client_emails(*), client_passports(*, client_visas(*))").order("created_at", { ascending: false });
      if (error) throw error;
      const now = new Date();
      return data.map((c: any) => {
        const primaryPhone = c.client_phones?.find((p: any) => p.is_primary) || c.client_phones?.[0];
        const primaryEmail = c.client_emails?.find((e: any) => e.is_primary) || c.client_emails?.[0];

        // Compute alerts
        const alerts: { label: string; level: "urgent" | "critical" | "warning"; months: number; tab: string }[] = [];
        const passportsList = c.client_passports ?? [];
        for (const pp of passportsList) {
          if (pp.expiry_date) {
            const months = Math.round((new Date(pp.expiry_date).getTime() - now.getTime()) / (1000 * 60 * 60 * 24 * 30));
            if (months <= 0) alerts.push({ label: "Passaporte vencido", level: "urgent", months, tab: "documents" });
            else if (months <= 3) alerts.push({ label: `Passaporte - urgência (${months}m)`, level: "urgent", months, tab: "documents" });
            else if (months <= 6) alerts.push({ label: `Passaporte - crítico (${months}m)`, level: "critical", months, tab: "documents" });
            else if (months <= 12) alerts.push({ label: `Passaporte - renovação (${months}m)`, level: "warning", months, tab: "documents" });
          }
          for (const v of (pp.client_visas ?? [])) {
            if (v.validity_date) {
              const vMonths = Math.round((new Date(v.validity_date).getTime() - now.getTime()) / (1000 * 60 * 60 * 24 * 30));
              const vLabel = v.country_region ? `${v.visa_type} ${v.country_region}` : v.visa_type;
              if (vMonths <= 0) alerts.push({ label: `Visto ${vLabel} vencido`, level: "urgent", months: vMonths, tab: "documents" });
              else if (vMonths <= 3) alerts.push({ label: `Visto ${vLabel} - urgência (${vMonths}m)`, level: "urgent", months: vMonths, tab: "documents" });
              else if (vMonths <= 6) alerts.push({ label: `Visto ${vLabel} - renovar (${vMonths}m)`, level: "critical", months: vMonths, tab: "documents" });
              else if (vMonths <= 9) alerts.push({ label: `Visto ${vLabel} - alerta (${vMonths}m)`, level: "warning", months: vMonths, tab: "documents" });
            }
          }
        }
        const levelOrder = { urgent: 0, critical: 1, warning: 2 };
        alerts.sort((a, b) => levelOrder[a.level] - levelOrder[b.level]);

        return { ...c, primary_phone: primaryPhone?.phone ?? null, primary_email: primaryEmail?.email ?? null, alerts };
      });
    },
  });

  // Fetch passengers to enable searching clients by passenger name
  const { data: allPassengers = [] } = useQuery({
    queryKey: ["all-passengers-for-search"],
    queryFn: async () => {
      const { data, error } = await supabase.from("passengers").select("id, full_name, client_id, birth_date, nationality, passport_number, relationship_type");
      if (error) throw error;
      return data;
    },
  });

  // Build a map: client_id -> passenger names (lowercase, joined)
  const passengerNamesByClient = useMemo(() => {
    const map: Record<string, string> = {};
    for (const p of allPassengers) {
      if (!p.client_id) continue;
      const existing = map[p.client_id] || "";
      map[p.client_id] = existing + " " + p.full_name.toLowerCase();
    }
    return map;
  }, [allPassengers]);

  // Build a map: client_id -> passenger list
  const passengersByClient = useMemo(() => {
    const map: Record<string, typeof allPassengers> = {};
    for (const p of allPassengers) {
      if (!p.client_id) continue;
      if (!map[p.client_id]) map[p.client_id] = [];
      map[p.client_id].push(p);
    }
    return map;
  }, [allPassengers]);

  const toggleExpand = (clientId: string) => {
    setExpandedClients(prev => {
      const next = new Set(prev);
      if (next.has(clientId)) next.delete(clientId); else next.add(clientId);
      return next;
    });
  };

  // Fetch related data when editing
  const { data: clientPhones = [] } = useQuery({
    queryKey: ["client-phones", editingId],
    queryFn: async () => {
      if (!editingId) return [];
      const { data } = await supabase.from("client_phones").select("*").eq("client_id", editingId);
      return data ?? [];
    },
    enabled: !!editingId,
  });
  const { data: clientEmails = [] } = useQuery({
    queryKey: ["client-emails", editingId],
    queryFn: async () => {
      if (!editingId) return [];
      const { data } = await supabase.from("client_emails").select("*").eq("client_id", editingId);
      return data ?? [];
    },
    enabled: !!editingId,
  });
  const { data: clientSocials = [] } = useQuery({
    queryKey: ["client-socials", editingId],
    queryFn: async () => {
      if (!editingId) return [];
      const { data } = await supabase.from("client_social_media").select("*").eq("client_id", editingId);
      return data ?? [];
    },
    enabled: !!editingId,
  });
  const { data: clientPassports = [] } = useQuery({
    queryKey: ["client-passports", editingId],
    queryFn: async () => {
      if (!editingId) return [];
      const { data: pData } = await supabase.from("client_passports").select("*").eq("client_id", editingId);
      if (!pData || pData.length === 0) return [];
      const passportIds = pData.map((p: any) => p.id);
      const { data: vData } = await supabase.from("client_visas").select("*").in("passport_id", passportIds);
      return pData.map((p: any) => ({
        ...p,
        visas: (vData ?? []).filter((v: any) => v.passport_id === p.id),
      }));
    },
    enabled: !!editingId,
  });
  const { data: clientMiles = [] } = useQuery({
    queryKey: ["client-miles", editingId],
    queryFn: async () => {
      if (!editingId) return [];
      const { data } = await supabase.from("miles_programs").select("*").eq("client_id", editingId);
      return data ?? [];
    },
    enabled: !!editingId,
  });

  // Populate multi-value state when editing data loads
  useEffect(() => {
    if (editingId) {
      setPhones(clientPhones.map((p: any) => {
        const stored = p.phone ?? "";
        // Match longest dial code first
        const sorted = [...COUNTRY_CODES].sort((a, b) => b.dial.length - a.dial.length);
        const match = sorted.find((c) => stored.startsWith(c.dial));
        const cc = match || COUNTRY_CODES[0];
        const localPart = match ? stored.slice(match.dial.length).trim() : stored;
        return { id: p.id, phone: applyPhoneMask(localPart, cc.mask), description: p.description ?? "", country_code: cc.code, is_primary: p.is_primary ?? false };
      }));
    }
  }, [clientPhones, editingId]);
  useEffect(() => {
    if (editingId) {
      setEmails(clientEmails.map((e: any) => ({ id: e.id, email: e.email, description: e.description ?? "", is_primary: e.is_primary ?? false })));
    }
  }, [clientEmails, editingId]);
  useEffect(() => {
    if (editingId) {
      setSocials(clientSocials.map((s: any) => ({ id: s.id, network: s.network, handle: s.handle })));
    }
  }, [clientSocials, editingId]);
  useEffect(() => {
    if (editingId) {
      setPassports(clientPassports.map((p: any) => ({
        id: p.id, passport_number: p.passport_number ?? "", issue_date: p.issue_date ?? "",
        expiry_date: p.expiry_date ?? "", nationality: p.nationality ?? "", status: p.status ?? "valid",
        image_urls: p.image_urls ?? [], _imageFiles: [] as File[],
        visas: (p.visas ?? []).map((v: any) => ({ id: v.id, visa_type: v.visa_type, validity_date: v.validity_date ?? "", country_region: v.country_region ?? "", visa_number: v.visa_number ?? "", issue_date: v.issue_date ?? "", entry_type: v.entry_type ?? "single", description: v.description ?? "", image_url: v.image_url ?? "" })),
      })));
    }
  }, [clientPassports, editingId]);
  useEffect(() => {
    if (editingId) {
      setMilesPrograms(clientMiles.map((m: any) => ({
        id: m.id, program_name: m.program_name ?? "", airline: m.airline ?? "",
        membership_number: m.membership_number ?? "", login_username: (m as any).login_username ?? "",
        login_email: m.login_email ?? "", login_password_encrypted: m.login_password_encrypted ?? "",
        miles_balance: m.miles_balance ?? null,
      })));
      setShowPasswords({});
    }
  }, [clientMiles, editingId]);

  // CEP auto-fill
  const handleCepBlur = async () => {
    if (form.country !== "Brasil" || !form.cep || form.cep.replace(/\D/g, "").length !== 8) return;
    try {
      const res = await fetch(`https://viacep.com.br/ws/${form.cep.replace(/\D/g, "")}/json/`);
      const data = await res.json();
      if (!data.erro) {
        setForm((prev) => ({
          ...prev,
          address_street: data.logradouro || prev.address_street,
          neighborhood: data.bairro || prev.neighborhood,
          city: data.localidade || prev.city,
          state: data.uf || prev.state,
        }));
      }
    } catch { /* ignore */ }
  };

  const shouldGoBackRef = useRef(false);

  const saveMutation = useMutation({
    mutationFn: async () => {
      const { preferred_airports: _pa, tags: _t, ...rest } = form;
      const payload: any = {
        ...rest,
        preferred_airports: selectedAirports,
        tags: selectedTags,
        birth_date: form.birth_date || null,
      };

      let clientId = editingId;
      if (editingId) {
        const { error } = await supabase.from("clients").update(payload).eq("id", editingId);
        if (error) throw error;
      } else {
        const { data, error } = await supabase.from("clients").insert(payload).select("id").single();
        if (error) throw error;
        clientId = data.id;
      }

      // Save multi-value records
      if (clientId) {
        await supabase.from("client_phones").delete().eq("client_id", clientId);
        if (phones.length > 0) {
          await supabase.from("client_phones").insert(phones.filter(p => p.phone).map((p, i, arr) => { const cc = COUNTRY_CODES.find(c => c.code === p.country_code); const isPrimary = arr.length === 1 ? true : p.is_primary; return { client_id: clientId!, phone: `${cc?.dial || "+55"} ${p.phone}`, description: p.description || null, is_primary: isPrimary }; }));
        }
        await supabase.from("client_emails").delete().eq("client_id", clientId);
        if (emails.length > 0) {
          await supabase.from("client_emails").insert(emails.filter(e => e.email).map((e, i, arr) => ({ client_id: clientId!, email: e.email, description: e.description || null, is_primary: arr.length === 1 ? true : e.is_primary })));
        }
        await supabase.from("client_social_media").delete().eq("client_id", clientId);
        if (socials.length > 0) {
          await supabase.from("client_social_media").insert(socials.filter(s => s.handle).map(s => ({ client_id: clientId!, network: s.network, handle: s.handle })));
        }
        // Passports & Visas: delete old passports (cascades to visas), insert new
        await supabase.from("client_passports").delete().eq("client_id", clientId);
        for (const pp of passports.filter(p => p.passport_number)) {
          // Upload passport images
          const allImageUrls: string[] = [...(pp.image_urls || [])];
          if (pp._imageFiles && pp._imageFiles.length > 0) {
            for (const file of pp._imageFiles) {
              const ext = file.name.split('.').pop();
              const filePath = `${clientId}/${crypto.randomUUID()}.${ext}`;
              const { error: upErr } = await supabase.storage.from("passport-images").upload(filePath, file);
              if (!upErr) {
                const { data: urlData } = supabase.storage.from("passport-images").getPublicUrl(filePath);
                allImageUrls.push(urlData.publicUrl);
              }
            }
          }
          const { data: ppData, error: ppErr } = await supabase.from("client_passports").insert({
            client_id: clientId!, passport_number: pp.passport_number,
            issue_date: pp.issue_date || null, expiry_date: pp.expiry_date || null,
            nationality: pp.nationality || null, status: pp.status || "valid",
            image_urls: allImageUrls.length > 0 ? allImageUrls : null,
          }).select("id").single();
          if (ppErr) throw ppErr;
          if (pp.visas.length > 0) {
            for (const v of pp.visas.filter(v => v.visa_type)) {
              let imageUrl = v.image_url || null;
              if (v._imageFile) {
                const ext = v._imageFile.name.split('.').pop();
                const filePath = `${clientId}/${crypto.randomUUID()}.${ext}`;
                const { error: upErr } = await supabase.storage.from("visa-images").upload(filePath, v._imageFile);
                if (!upErr) {
                  const { data: urlData } = supabase.storage.from("visa-images").getPublicUrl(filePath);
                  imageUrl = urlData.publicUrl;
                }
              }
              await supabase.from("client_visas").insert({ passport_id: ppData.id, visa_type: v.visa_type, validity_date: v.validity_date || null, country_region: v.country_region || null, visa_number: v.visa_number || null, issue_date: v.issue_date || null, entry_type: v.entry_type || "single", description: v.description || null, image_url: imageUrl });
            }
          }
        }

        // Save miles programs
        if (canAccessFeature(userRole, "client_miles_tab")) {
          await supabase.from("miles_programs").delete().eq("client_id", clientId);
          for (const m of milesPrograms.filter(m => m.program_name || m.airline)) {
            await supabase.from("miles_programs").insert({
              client_id: clientId!,
              program_name: m.program_name || m.airline,
              airline: m.airline,
              membership_number: m.membership_number || null,
              login_username: m.login_username || null,
              login_email: m.login_email || null,
              login_password_encrypted: m.login_password_encrypted || null,
              miles_balance: m.miles_balance ?? 0,
            } as any);
          }
        }
      }
    },
    onSuccess: () => {
      toast({ title: editingId ? "Cliente atualizado" : "Cliente criado" });
      qc.invalidateQueries({ queryKey: ["clients"] });
      if (shouldGoBackRef.current) {
        goToList();
      }
      shouldGoBackRef.current = false;
    },
    onError: (err: Error) => toast({ title: "Erro", description: err.message, variant: "destructive" }),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("clients").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast({ title: "Cliente removido" });
      qc.invalidateQueries({ queryKey: ["clients"] });
      goToList();
    },
    onError: (err: Error) => toast({ title: "Erro", description: err.message, variant: "destructive" }),
  });

  const goToList = () => {
    setView("list"); setEditingId(null); setForm(emptyForm); setActiveTab("contact");
    setSelectedAirports([]); setSelectedTags([]); setPhones([]); setEmails([]); setSocials([]); setPassports([]); setMilesPrograms([]); setShowPasswords({});
  };

  const openCreate = () => {
    setEditingId(null); setForm(emptyForm); setSelectedAirports([]); setSelectedTags([]); setActiveTab("contact");
    setPhones([]); setEmails([]); setSocials([]); setPassports([]); setMilesPrograms([]); setShowPasswords({});
    setView("form");
  };

  const openEdit = (c: any) => {
    setEditingId(c.id);
    setForm({
      full_name: c.full_name ?? "", birth_date: c.birth_date ?? "", gender: c.gender ?? "",
      is_active: c.is_active ?? true, website: c.website ?? "",
      rating: c.rating ?? 0, accepts_email_comm: c.accepts_email_comm ?? false,
      accepts_whatsapp_comm: c.accepts_whatsapp_comm ?? false,
      travel_profile: c.travel_profile ?? "economic", passport_status: c.passport_status ?? "none",
      notes: c.notes ?? "", country: c.country ?? "Brasil", state: c.state ?? "", city: c.city ?? "",
      preferred_airports: c.preferred_airports ?? [], tags: c.tags ?? [],
      cpf_cnpj: c.cpf_cnpj ?? "", rg: c.rg ?? "", rg_issuer: c.rg_issuer ?? "",
      foreign_id: c.foreign_id ?? "", nationality: c.nationality ?? "",
      marital_status: c.marital_status ?? "", seat_preference: (c as any).seat_preference ?? "",
      cep: c.cep ?? "", neighborhood: c.neighborhood ?? "",
      address_street: c.address_street ?? "", address_number: c.address_number ?? "",
      address_complement: c.address_complement ?? "",
    });
    setSelectedAirports(c.preferred_airports ?? []);
    setSelectedTags(c.tags ?? []);
    setView("form");
  };

  const quickAddMutation = useMutation({
    mutationFn: async () => {
      if (quickAddType === "country") {
        const { error } = await supabase.from("countries").insert({ name: quickAddName });
        if (error) throw error;
        setForm({ ...form, country: quickAddName, state: "", city: "" });
      } else if (quickAddType === "state" && selectedCountryObj) {
        const { error } = await supabase.from("states").insert({ name: quickAddName, country_id: selectedCountryObj.id });
        if (error) throw error;
        setForm({ ...form, state: quickAddName, city: "" });
      } else if (quickAddType === "city" && selectedCountryObj) {
        const { error } = await supabase.from("cities").insert({ name: quickAddName, country_id: selectedCountryObj.id, state_id: selectedStateObj?.id || null });
        if (error) throw error;
        setForm({ ...form, city: quickAddName });
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["locations-countries"] });
      qc.invalidateQueries({ queryKey: ["locations-states"] });
      qc.invalidateQueries({ queryKey: ["locations-cities"] });
      toast({ title: "Localidade adicionada" });
      setQuickAddType(null); setQuickAddName("");
    },
    onError: (e: any) => toast({ title: "Erro", description: e.message, variant: "destructive" }),
  });

  const filtered = sortData(
    clients.filter((c: any) => {
      const q = search.toLowerCase();
      const matchesSearch = c.full_name.toLowerCase().includes(q) ||
        (c.email ?? "").toLowerCase().includes(q) ||
        (c.city ?? "").toLowerCase().includes(q) ||
        (passengerNamesByClient[c.id] ?? "").includes(q);
      const matchesProfile = profileFilter === "all" || c.travel_profile === profileFilter;
      const matchesTags = tagFilter.length === 0 || tagFilter.every(t => (c.tags ?? []).includes(t));
      return matchesSearch && matchesProfile && matchesTags;
    }),
    sort
  );

  const SortableHeader = ({ label, sortKey, className }: { label: string; sortKey: string; className?: string }) => {
    const active = sort?.key === sortKey;
    return (
      <th className={`text-left p-4 text-[10px] uppercase tracking-widest text-muted-foreground font-body font-medium cursor-pointer select-none hover:text-foreground ${className || ""}`}
        onClick={() => setSort(toggleSort(sort, sortKey))}>
        <span className="inline-flex items-center gap-1">
          {label}
          {active ? (sort.dir === "asc" ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />) : <ArrowUpDown className="h-3 w-3 opacity-40" />}
        </span>
      </th>
    );
  };

  const upd = (key: string, val: any) => setForm((prev) => ({ ...prev, [key]: val }));

  // ========== FORM VIEW ==========
  if (view === "form") {
    return (
      <div className="max-w-5xl mx-auto space-y-4">
        {/* Header */}
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={goToList} className="shrink-0">
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div className="flex-1">
            <h1 className="text-2xl font-display font-semibold text-foreground">
              {editingId ? "Editar Cliente" : "Novo Cliente"}
            </h1>
          </div>
        </div>

        <form onSubmit={(e) => { e.preventDefault(); saveMutation.mutate(); }} className="space-y-4">
          {/* ====== UPPER SECTION: Compact header with key data ====== */}
          <div className="glass-card rounded-xl p-4 space-y-3">
            {/* Row 1: Name + Rating + Birth + Gender + Active */}
            <div className="grid grid-cols-12 gap-3 items-end">
              <div className="col-span-12 sm:col-span-4 space-y-1">
                <Label className="font-body text-xs">Nome completo *</Label>
                <Input value={form.full_name} onChange={(e) => upd("full_name", e.target.value)} required className="h-9" />
              </div>
              <div className="col-span-6 sm:col-span-2 space-y-1">
                <Label className="font-body text-xs">Nascimento</Label>
                <Input type="date" value={form.birth_date} onChange={(e) => upd("birth_date", e.target.value)} className="h-9" />
              </div>
              <div className="col-span-6 sm:col-span-2 space-y-1">
                <Label className="font-body text-xs">Sexo</Label>
                <Select value={form.gender || "_none"} onValueChange={(v) => upd("gender", v === "_none" ? "" : v)}>
                  <SelectTrigger className="h-9"><SelectValue placeholder="Selecione" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="_none">Selecione</SelectItem>
                    <SelectItem value="M">Masculino</SelectItem>
                    <SelectItem value="F">Feminino</SelectItem>
                    <SelectItem value="O">Outro</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="col-span-6 sm:col-span-2 space-y-1">
                <Label className="font-body text-xs">Qualificação</Label>
                <StarRating value={form.rating} onChange={(v) => upd("rating", v)} />
              </div>
              <div className="col-span-6 sm:col-span-2 flex items-center gap-2 pb-0.5">
                <Switch checked={form.is_active} onCheckedChange={(v) => upd("is_active", v)} />
                <Label className="font-body text-xs">{form.is_active ? "Ativo" : "Inativo"}</Label>
              </div>
            </div>

            {/* Row 2: Travel profile, Site, Passport status */}
            <div className="grid grid-cols-12 gap-3 items-end">
              <div className="col-span-6 sm:col-span-3 space-y-1">
                <div className="flex items-center gap-1">
                  <Label className="font-body text-xs">Perfil de viagem</Label>
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Info className="h-3.5 w-3.5 text-muted-foreground cursor-help" />
                      </TooltipTrigger>
                      <TooltipContent side="top" className="max-w-xs text-xs space-y-1.5 p-3">
                        {Object.values(travelProfiles).map((prof) => (
                          <div key={prof.label}><span className="font-semibold">{prof.label}:</span> {prof.description}</div>
                        ))}
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                </div>
                <Select value={form.travel_profile} onValueChange={(v) => upd("travel_profile", v)}>
                  <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {Object.entries(travelProfiles).map(([key, prof]) => (
                      <SelectItem key={key} value={key}>{prof.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="col-span-6 sm:col-span-3 space-y-1">
                <Label className="font-body text-xs">Site</Label>
                <Input value={form.website} onChange={(e) => upd("website", e.target.value)} placeholder="https://" className="h-9" />
              </div>
              <div className="col-span-12 sm:col-span-6 space-y-1">
                <Label className="font-body text-xs">Etiquetas</Label>
                <Popover open={tagPopoverOpen} onOpenChange={setTagPopoverOpen}>
                  <PopoverTrigger asChild>
                    <Button type="button" variant="outline" className="w-full h-auto min-h-9 justify-start font-normal px-3 py-1.5">
                      {selectedTags.length === 0 ? (
                        <span className="text-muted-foreground text-sm">Selecionar etiquetas...</span>
                      ) : (
                        <div className="flex flex-wrap gap-1">
                          {selectedTags.map((tag) => {
                            const tagObj = availableTags.find((t: any) => t.name === tag);
                            const colorClass = TAG_COLORS[tagObj?.color ?? ""] ?? "bg-primary/10 text-primary";
                            return (
                              <span key={tag} className={`text-[10px] font-medium px-2 py-0.5 rounded-full ${colorClass}`}>
                                {tag}
                                <button type="button" className="ml-1 hover:opacity-70" onClick={(e) => { e.stopPropagation(); setSelectedTags(selectedTags.filter(t => t !== tag)); }}>×</button>
                              </span>
                            );
                          })}
                        </div>
                      )}
                      <ChevronsUpDown className="h-3.5 w-3.5 ml-auto shrink-0 opacity-50" />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-64 p-2" align="start">
                    <div className="space-y-1 max-h-48 overflow-y-auto">
                      {availableTags.length === 0 ? (
                        <p className="text-xs text-muted-foreground p-2">Nenhuma etiqueta cadastrada. Crie em Cadastros → Etiquetas.</p>
                      ) : (
                        availableTags.map((t: any) => {
                          const isSelected = selectedTags.includes(t.name);
                          const colorClass = TAG_COLORS[t.color ?? ""] ?? "bg-primary/10 text-primary";
                          return (
                            <button
                              key={t.id}
                              type="button"
                              className={`w-full flex items-center gap-2 px-2 py-1.5 rounded text-sm font-body hover:bg-muted/50 transition-colors ${isSelected ? "bg-muted/30" : ""}`}
                              onClick={() => {
                                setSelectedTags(isSelected ? selectedTags.filter(tag => tag !== t.name) : [...selectedTags, t.name]);
                              }}
                            >
                              <Checkbox checked={isSelected} className="pointer-events-none" />
                              <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full ${colorClass}`}>{t.name}</span>
                            </button>
                          );
                        })
                      )}
                    </div>
                  </PopoverContent>
                </Popover>
              </div>
            </div>
          </div>

          {/* ====== LOWER SECTION: Tabs ====== */}
          <div className="glass-card rounded-xl p-4">
            <Tabs value={activeTab} onValueChange={setActiveTab}>
              <TabsList className="w-full justify-start">
                <TabsTrigger value="contact" className="font-body text-xs">Contato</TabsTrigger>
                <TabsTrigger value="preferences" className="font-body text-xs">Preferências</TabsTrigger>
                <TabsTrigger value="documents" className="font-body text-xs">Documentos</TabsTrigger>
                <TabsTrigger value="address" className="font-body text-xs">Endereço</TabsTrigger>
                <TabsTrigger value="travelers" className="font-body text-xs">Viajantes</TabsTrigger>
                {canAccessFeature(userRole, "client_miles_tab") && (
                  <TabsTrigger value="miles" className="font-body text-xs">Milhas</TabsTrigger>
                )}
                <TabsTrigger value="observations" className="font-body text-xs">Observações</TabsTrigger>
              </TabsList>

              {/* Contact Tab */}
              <TabsContent value="contact" className="space-y-4 pt-3">
                {/* Phones */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label className="font-body text-xs font-medium">Celulares / Telefones</Label>
                    <Button type="button" variant="ghost" size="sm" className="h-6 px-1 text-xs" onClick={() => setPhones([...phones, { phone: "", description: "", country_code: "BR", is_primary: false }])}>
                      <Plus className="h-3 w-3 mr-1" />Adicionar
                    </Button>
                  </div>
                  {phones.map((p, i) => {
                    const cc = COUNTRY_CODES.find((c) => c.code === p.country_code) || COUNTRY_CODES[0];
                    return (
                      <div key={i} className="flex gap-2 items-center">
                        <Checkbox checked={phones.length === 1 || p.is_primary} onCheckedChange={() => { const n = phones.map((ph, j) => ({ ...ph, is_primary: j === i })); setPhones(n); }} className="shrink-0" title="Principal" />
                        <Select value={p.country_code} onValueChange={(v) => { const n = [...phones]; n[i].country_code = v; n[i].phone = ""; setPhones(n); }}>
                          <SelectTrigger className="w-28 h-9 shrink-0 text-xs"><SelectValue /></SelectTrigger>
                          <SelectContent>
                            {COUNTRY_CODES.map((c) => <SelectItem key={c.code} value={c.code}>{c.flag} {c.dial}</SelectItem>)}
                          </SelectContent>
                        </Select>
                        <Input className="w-40 h-9 shrink-0" placeholder={cc.mask.replace(/#/g, "0")} value={p.phone} onChange={(e) => { const n = [...phones]; n[i].phone = applyPhoneMask(e.target.value, cc.mask); setPhones(n); }} />
                        <Input className="flex-1 h-9" placeholder="Descrição" value={p.description} onChange={(e) => { const n = [...phones]; n[i].description = e.target.value; setPhones(n); }} />
                        <Button type="button" variant="ghost" size="icon" className="shrink-0 h-9 w-9 text-destructive" onClick={() => setPhones(phones.filter((_, j) => j !== i))}>
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    );
                  })}
                </div>

                {/* Emails */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label className="font-body text-xs font-medium">E-mails</Label>
                    <Button type="button" variant="ghost" size="sm" className="h-6 px-1 text-xs" onClick={() => setEmails([...emails, { email: "", description: "", is_primary: false }])}>
                      <Plus className="h-3 w-3 mr-1" />Adicionar
                    </Button>
                  </div>
                  {emails.map((e, i) => (
                    <div key={i} className="flex gap-2 items-center">
                      <Checkbox checked={emails.length === 1 || e.is_primary} onCheckedChange={() => { const n = emails.map((em, j) => ({ ...em, is_primary: j === i })); setEmails(n); }} className="shrink-0" title="Principal" />
                      <Input className="w-72 h-9 shrink-0" type="email" placeholder="E-mail" value={e.email} onChange={(ev) => { const n = [...emails]; n[i].email = ev.target.value; setEmails(n); }} />
                      <Input className="flex-1 h-9" placeholder="Descrição" value={e.description} onChange={(ev) => { const n = [...emails]; n[i].description = ev.target.value; setEmails(n); }} />
                      <Button type="button" variant="ghost" size="icon" className="shrink-0 h-9 w-9 text-destructive" onClick={() => setEmails(emails.filter((_, j) => j !== i))}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}
                </div>

                {/* Social Media */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label className="font-body text-xs font-medium">Redes Sociais</Label>
                    <Button type="button" variant="ghost" size="sm" className="h-6 px-1 text-xs" onClick={() => setSocials([...socials, { network: "Instagram", handle: "" }])}>
                      <Plus className="h-3 w-3 mr-1" />Adicionar
                    </Button>
                  </div>
                  {socials.map((s, i) => (
                    <div key={i} className="flex gap-2 items-start">
                      <Select value={s.network} onValueChange={(v) => { const n = [...socials]; n[i].network = v; setSocials(n); }}>
                        <SelectTrigger className="w-36 h-9"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {SOCIAL_NETWORKS.map((sn) => <SelectItem key={sn} value={sn}>{sn}</SelectItem>)}
                        </SelectContent>
                      </Select>
                      <Input className="flex-1 h-9" placeholder="@ ou URL" value={s.handle} onChange={(e) => { const n = [...socials]; n[i].handle = e.target.value; setSocials(n); }} />
                      <Button type="button" variant="ghost" size="icon" className="shrink-0 h-9 w-9 text-destructive" onClick={() => setSocials(socials.filter((_, j) => j !== i))}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}
                </div>

                {/* Communication preferences */}
                <div className="border-t border-border/50 pt-3">
                  <Label className="font-body text-xs font-medium">Preferências de comunicação</Label>
                  <div className="flex flex-wrap gap-4 mt-2">
                    <div className="flex items-center gap-2">
                      <Switch checked={form.accepts_email_comm} onCheckedChange={(v) => upd("accepts_email_comm", v)} />
                      <Label className="font-body text-xs">E-mail</Label>
                    </div>
                    <div className="flex items-center gap-2">
                      <Switch checked={form.accepts_whatsapp_comm} onCheckedChange={(v) => upd("accepts_whatsapp_comm", v)} />
                      <Label className="font-body text-xs">WhatsApp</Label>
                    </div>
                  </div>
                </div>
              </TabsContent>

              {/* Preferences Tab */}
              <TabsContent value="preferences" className="space-y-4 pt-3">
                {/* Seat preference */}
                <div className="space-y-1.5">
                  <Label className="font-body text-xs font-medium">Assento preferencial</Label>
                  <Select value={form.seat_preference || "_none"} onValueChange={(v) => upd("seat_preference", v === "_none" ? "" : v)}>
                    <SelectTrigger className="w-56 h-9"><SelectValue placeholder="Selecione" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="_none">Sem preferência</SelectItem>
                      <SelectItem value="window">Janela</SelectItem>
                      <SelectItem value="aisle">Corredor</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {/* Preferred origin airports */}
                <div className="space-y-1">
                  <Label className="font-body text-xs font-medium">Aeroportos de origem preferidos</Label>
                  <Popover open={airportPopoverOpen} onOpenChange={setAirportPopoverOpen}>
                    <PopoverTrigger asChild>
                      <Button variant="outline" type="button" className="w-full justify-between font-normal h-9 text-sm">
                        {selectedAirports.length > 0 ? `${selectedAirports.length} aeroporto(s)` : "Selecione aeroportos"}
                        <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-80 p-0" align="start">
                      <div className="p-2 border-b"><Input placeholder="Buscar..." value={airportSearch} onChange={(e) => setAirportSearch(e.target.value)} className="h-8 text-sm" /></div>
                      <div className="max-h-52 overflow-y-auto p-1">
                        {filteredAirports.slice(0, 50).map((a) => (
                          <label key={a.iata_code} className="flex items-center gap-2 px-2 py-1.5 rounded hover:bg-muted cursor-pointer text-sm">
                            <Checkbox checked={selectedAirports.includes(a.iata_code)} onCheckedChange={(checked) => setSelectedAirports((prev) => checked ? [...prev, a.iata_code] : prev.filter((c) => c !== a.iata_code))} />
                            <span className="font-mono font-bold text-primary">{a.iata_code}</span>
                            <span className="text-muted-foreground truncate">{a.city} - {a.name}</span>
                          </label>
                        ))}
                      </div>
                    </PopoverContent>
                  </Popover>
                  {selectedAirports.length > 0 && (
                    <div className="flex flex-wrap gap-1 mt-1">
                      {selectedAirports.map((code) => (
                        <span key={code} className="inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded bg-muted text-muted-foreground">
                          {code}
                          <button type="button" onClick={() => setSelectedAirports((prev) => prev.filter((c) => c !== code))} className="hover:text-destructive"><X className="h-3 w-3" /></button>
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              </TabsContent>

              {/* Documents Tab */}
              <TabsContent value="documents" className="space-y-4 pt-3">
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  <div className="space-y-1.5">
                    <Label className="font-body text-xs">CPF / CNPJ</Label>
                    <Input value={form.cpf_cnpj} onChange={(e) => upd("cpf_cnpj", e.target.value)} />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="font-body text-xs">RG</Label>
                    <Input value={form.rg} onChange={(e) => upd("rg", e.target.value)} />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="font-body text-xs">Órgão Emissor RG</Label>
                    <Input value={form.rg_issuer} onChange={(e) => upd("rg_issuer", e.target.value)} />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="font-body text-xs">ID Estrangeiro</Label>
                    <Input value={form.foreign_id} onChange={(e) => upd("foreign_id", e.target.value)} />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="font-body text-xs">Nacionalidade</Label>
                    <Input value={form.nationality} onChange={(e) => upd("nationality", e.target.value)} />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="font-body text-xs">Estado Civil</Label>
                    <Select value={form.marital_status || "_none"} onValueChange={(v) => upd("marital_status", v === "_none" ? "" : v)}>
                      <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="_none">Selecione</SelectItem>
                        {MARITAL_STATUSES.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                {/* Passports */}
                <div className="border-t border-border/50 pt-4">
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="text-sm font-display font-medium text-foreground">Passaportes</h3>
                    <Button type="button" variant="ghost" size="sm" className="h-6 px-1 text-xs" onClick={() => setPassports([...passports, { passport_number: "", issue_date: "", expiry_date: "", nationality: "", status: "valid", visas: [], image_urls: [], _imageFiles: [] }])}>
                      <Plus className="h-3 w-3 mr-1" />Adicionar Passaporte
                    </Button>
                  </div>
                  {passports.length === 0 && <p className="text-xs text-muted-foreground font-body">Nenhum passaporte cadastrado.</p>}
                  {passports.map((pp, pi) => (
                    <div key={pi} className="border border-border/50 rounded-lg p-3 mb-3 space-y-3 bg-muted/20">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-body font-medium text-foreground">Passaporte {pi + 1}</span>
                        <Button type="button" variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => setPassports(passports.filter((_, j) => j !== pi))}>
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                        <div className="space-y-1">
                          <Label className="font-body text-xs">Número</Label>
                          <Input className="h-9" value={pp.passport_number} onChange={(e) => { const n = [...passports]; n[pi].passport_number = e.target.value.toUpperCase(); setPassports(n); }} />
                        </div>
                        <div className="space-y-1">
                          <Label className="font-body text-xs">Emissão</Label>
                          <Input type="date" className="h-9" value={pp.issue_date} onChange={(e) => { const n = [...passports]; n[pi].issue_date = e.target.value; setPassports(n); }} />
                        </div>
                        <div className="space-y-1">
                          <Label className="font-body text-xs">Vencimento</Label>
                          <Input type="date" className="h-9" value={pp.expiry_date} onChange={(e) => { const n = [...passports]; n[pi].expiry_date = e.target.value; setPassports(n); }} />
                        </div>
                        <div className="space-y-1">
                          <Label className="font-body text-xs">País Emissor</Label>
                          <Select value={pp.nationality || ""} onValueChange={(v) => { const n = [...passports]; n[pi].nationality = v; setPassports(n); }}>
                            <SelectTrigger className="h-9"><SelectValue placeholder="Selecione" /></SelectTrigger>
                            <SelectContent className="max-h-60">
                              {dbCountries.map((c: any) => <SelectItem key={c.id} value={c.name}>{c.name}</SelectItem>)}
                            </SelectContent>
                          </Select>
                        </div>
                      </div>
                      {/* Passport images */}
                      <div className="flex items-center gap-2 mt-1 flex-wrap">
                        <Label className="font-body text-xs">Fotos:</Label>
                        {(pp.image_urls || []).map((url, imgIdx) => (
                          <div key={imgIdx} className="relative group">
                            <a href={url} target="_blank" rel="noopener noreferrer">
                              <img src={url} alt={`Passaporte ${pi + 1} foto ${imgIdx + 1}`} className="h-10 w-14 object-cover rounded border border-border" />
                            </a>
                            <button type="button" className="absolute -top-1 -right-1 bg-destructive text-destructive-foreground rounded-full h-4 w-4 flex items-center justify-center text-[10px] opacity-0 group-hover:opacity-100 transition-opacity" onClick={() => {
                              const n = [...passports]; n[pi].image_urls = n[pi].image_urls.filter((_, j) => j !== imgIdx); setPassports([...n]);
                            }}>×</button>
                          </div>
                        ))}
                        {(pp._imageFiles || []).map((file, fIdx) => (
                          <div key={`new-${fIdx}`} className="relative group">
                            <img src={URL.createObjectURL(file)} alt={file.name} className="h-10 w-14 object-cover rounded border border-primary" />
                            <button type="button" className="absolute -top-1 -right-1 bg-destructive text-destructive-foreground rounded-full h-4 w-4 flex items-center justify-center text-[10px] opacity-0 group-hover:opacity-100 transition-opacity" onClick={() => {
                              const n = [...passports]; n[pi]._imageFiles = (n[pi]._imageFiles || []).filter((_, j) => j !== fIdx); setPassports([...n]);
                            }}>×</button>
                          </div>
                        ))}
                        <label className="cursor-pointer inline-flex items-center gap-1 text-xs px-2 py-1 rounded border border-input bg-background hover:bg-accent text-foreground">
                          <Plus className="h-3 w-3" />Adicionar
                          <input type="file" accept="image/*" multiple className="hidden" onChange={(e) => {
                            const files = Array.from(e.target.files || []);
                            if (files.length === 1) {
                              openEditor(files[0], (edited) => { const n = [...passports]; n[pi]._imageFiles = [...(n[pi]._imageFiles || []), edited]; setPassports([...n]); });
                            } else if (files.length > 1) {
                              const n = [...passports]; n[pi]._imageFiles = [...(n[pi]._imageFiles || []), ...files]; setPassports([...n]);
                            }
                            e.target.value = "";
                          }} />
                        </label>
                      </div>
                      <div className="flex items-center gap-2 mt-1">
                        <Label className="font-body text-xs">Status:</Label>
                        {(() => {
                          if (!pp.expiry_date) return <span className="text-xs text-muted-foreground">Informe o vencimento</span>;
                          const today = new Date();
                          const expiry = new Date(pp.expiry_date + "T00:00:00");
                          const diffMs = expiry.getTime() - today.getTime();
                          const diffMonths = diffMs / (1000 * 60 * 60 * 24 * 30);
                          if (diffMs < 0) return <span className="text-xs font-medium px-2 py-0.5 rounded bg-destructive/10 text-destructive">Vencido</span>;
                          if (diffMonths <= 12) return <span className="text-xs font-medium px-2 py-0.5 rounded bg-amber-500/10 text-amber-600">Vencendo ({Math.ceil(diffMonths)}m)</span>;
                          return <span className="text-xs font-medium px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-600">Válido</span>;
                        })()}
                      </div>

                      {/* Visas for this passport */}
                      <div className="border-t border-border/30 pt-2">
                        <div className="flex items-center justify-between mb-2">
                          <Label className="font-body text-xs font-medium">Vistos deste passaporte</Label>
                          <Button type="button" variant="ghost" size="sm" className="h-5 px-1 text-xs" onClick={() => {
                            const n = [...passports]; n[pi].visas = [...n[pi].visas, { visa_type: "", validity_date: "", country_region: "", visa_number: "", issue_date: "", entry_type: "single", description: "", image_url: "" }]; setPassports(n);
                          }}>
                            <Plus className="h-3 w-3 mr-1" />Visto
                          </Button>
                        </div>
                        {pp.visas.length === 0 && <p className="text-xs text-muted-foreground font-body">Nenhum visto.</p>}
                        {pp.visas.map((v, vi) => (
                          <div key={vi} className="border border-border/30 rounded-md p-3 mb-2 space-y-2 bg-background/50">
                            <div className="flex items-center justify-between">
                              <span className="text-xs font-body font-medium text-foreground">Visto {vi + 1}</span>
                              <Button type="button" variant="ghost" size="icon" className="shrink-0 h-7 w-7 text-destructive" onClick={() => {
                                const n = [...passports]; n[pi].visas = n[pi].visas.filter((_, j) => j !== vi); setPassports(n);
                              }}>
                                <Trash2 className="h-3.5 w-3.5" />
                              </Button>
                            </div>
                            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                              <div className="space-y-1">
                                <Label className="font-body text-xs">País / Região *</Label>
                                <Select value={v.country_region || ""} onValueChange={(val) => { const n = [...passports]; n[pi].visas[vi].country_region = val; setPassports(n); }}>
                                  <SelectTrigger className="h-8 text-sm"><SelectValue placeholder="Selecione" /></SelectTrigger>
                                  <SelectContent className="max-h-60">
                                    {VISA_REGIONS.map((r) => <SelectItem key={r} value={r}>{r}</SelectItem>)}
                                  </SelectContent>
                                </Select>
                              </div>
                              <div className="space-y-1">
                                <Label className="font-body text-xs">Tipo de Visto *</Label>
                                <Select value={v.visa_type || ""} onValueChange={(val) => { const n = [...passports]; n[pi].visas[vi].visa_type = val; setPassports(n); }}>
                                  <SelectTrigger className="h-8 text-sm"><SelectValue placeholder="Selecione" /></SelectTrigger>
                                  <SelectContent className="max-h-60">
                                    {VISA_TYPES.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                                  </SelectContent>
                                </Select>
                              </div>
                              <div className="space-y-1">
                                <Label className="font-body text-xs">Número do Visto</Label>
                                <Input className="h-8 text-sm" value={v.visa_number} onChange={(e) => { const n = [...passports]; n[pi].visas[vi].visa_number = e.target.value; setPassports(n); }} />
                              </div>
                              <div className="space-y-1">
                                <Label className="font-body text-xs">Entradas</Label>
                                <Select value={v.entry_type || "single"} onValueChange={(val) => { const n = [...passports]; n[pi].visas[vi].entry_type = val; setPassports(n); }}>
                                  <SelectTrigger className="h-8 text-sm"><SelectValue /></SelectTrigger>
                                  <SelectContent>
                                    <SelectItem value="single">Single Entry</SelectItem>
                                    <SelectItem value="multiple">Multiple Entry</SelectItem>
                                  </SelectContent>
                                </Select>
                              </div>
                            </div>
                            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                              <div className="space-y-1">
                                <Label className="font-body text-xs">Data de Emissão</Label>
                                <Input type="date" className="h-8 text-sm" value={v.issue_date} onChange={(e) => { const n = [...passports]; n[pi].visas[vi].issue_date = e.target.value; setPassports(n); }} />
                              </div>
                              <div className="space-y-1">
                                <Label className="font-body text-xs">Data de Validade</Label>
                                <Input type="date" className="h-8 text-sm" value={v.validity_date} onChange={(e) => { const n = [...passports]; n[pi].visas[vi].validity_date = e.target.value; setPassports(n); }} />
                              </div>
                              <div className="space-y-1">
                                <Label className="font-body text-xs">Descrição</Label>
                                <Input className="h-8 text-sm" placeholder="Observações do visto" value={v.description} onChange={(e) => { const n = [...passports]; n[pi].visas[vi].description = e.target.value; setPassports(n); }} />
                              </div>
                              <div className="space-y-1">
                                <Label className="font-body text-xs">Imagem do Visto</Label>
                                <div className="flex items-center gap-2">
                                  {(v.image_url || v._imageFile) && (
                                    <a href={v._imageFile ? URL.createObjectURL(v._imageFile) : v.image_url} target="_blank" rel="noopener noreferrer">
                                      <img src={v._imageFile ? URL.createObjectURL(v._imageFile) : v.image_url} alt="Visto" className="h-10 w-14 object-cover rounded border border-border" />
                                    </a>
                                  )}
                                  <label className="cursor-pointer inline-flex items-center gap-1 text-xs px-2 py-1 rounded border border-input bg-background hover:bg-accent text-foreground">
                                    {v.image_url || v._imageFile ? "Trocar" : "Upload"}
                                    <input type="file" accept="image/*" className="hidden" onChange={(e) => {
                                      const file = e.target.files?.[0];
                                      if (file) {
                                        openEditor(file, (edited) => { const n = [...passports]; n[pi].visas[vi]._imageFile = edited; setPassports([...n]); });
                                      }
                                    }} />
                                  </label>
                                  {(v.image_url || v._imageFile) && (
                                    <button type="button" className="text-destructive" onClick={() => { const n = [...passports]; n[pi].visas[vi].image_url = ""; n[pi].visas[vi]._imageFile = undefined; setPassports([...n]); }}>
                                      <X className="h-3.5 w-3.5" />
                                    </button>
                                  )}
                                </div>
                              </div>
                            </div>
                            {/* Row 3: Status */}
                            <div className="flex items-center gap-1.5">
                              <Label className="font-body text-xs">Status:</Label>
                              {(() => {
                                if (!v.validity_date) return <span className="text-xs text-muted-foreground">—</span>;
                                const today = new Date();
                                const expiry = new Date(v.validity_date + "T00:00:00");
                                const diffMs = expiry.getTime() - today.getTime();
                                const diffMonths = diffMs / (1000 * 60 * 60 * 24 * 30);
                                if (diffMs < 0) return <span className="text-xs font-medium px-2 py-0.5 rounded bg-destructive/10 text-destructive">Vencido</span>;
                                if (diffMonths <= 12) return <span className="text-xs font-medium px-2 py-0.5 rounded bg-amber-500/10 text-amber-600">Vencendo ({Math.ceil(diffMonths)}m)</span>;
                                return <span className="text-xs font-medium px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-600">Válido</span>;
                              })()}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </TabsContent>

              {/* Address Tab */}
              <TabsContent value="address" className="space-y-4 pt-3">
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  {/* Country */}
                  <div className="space-y-1.5">
                    <Label className="font-body text-xs">País</Label>
                    <Select value={form.country || "Brasil"} onValueChange={(v) => upd("country", v)}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent className="max-h-60">
                        {dbCountries.map((c: any) => <SelectItem key={c.id} value={c.name}>{c.name}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>

                  {/* CEP / Postal Code */}
                  <div className="space-y-1.5">
                    <Label className="font-body text-xs">{form.country === "Brasil" ? "CEP" : "Postal Code"}</Label>
                    <Input value={form.cep} onChange={(e) => upd("cep", e.target.value)} onBlur={form.country === "Brasil" ? handleCepBlur : undefined} placeholder={form.country === "Brasil" ? "00000-000" : ""} />
                  </div>

                  {/* State */}
                  <div className="space-y-1.5">
                    <Label className="font-body text-xs">Estado / Região</Label>
                    <Select value={form.state || "_none"} onValueChange={(v) => { upd("state", v === "_none" ? "" : v); upd("city", ""); }}>
                      <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                      <SelectContent className="max-h-60">
                        <SelectItem value="_none">Selecione</SelectItem>
                        {(dbStates as any[]).map((s: any) => <SelectItem key={s.id} value={s.name}>{s.name}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>

                  {/* City */}
                  <div className="space-y-1.5">
                    <Label className="font-body text-xs">Cidade</Label>
                    <Select value={form.city || "_none"} onValueChange={(v) => upd("city", v === "_none" ? "" : v)}>
                      <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                      <SelectContent className="max-h-60">
                        <SelectItem value="_none">Selecione</SelectItem>
                        {(dbCities as any[]).map((c: any) => <SelectItem key={c.id} value={c.name}>{c.name}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-1.5">
                    <Label className="font-body text-xs">Bairro</Label>
                    <Input value={form.neighborhood} onChange={(e) => upd("neighborhood", e.target.value)} />
                  </div>
                  </div>
                  <div className="grid grid-cols-12 gap-4 col-span-full">
                    <div className="col-span-12 sm:col-span-6 space-y-1.5">
                      <Label className="font-body text-xs">Endereço</Label>
                      <Input value={form.address_street} onChange={(e) => upd("address_street", e.target.value)} />
                    </div>
                    <div className="col-span-6 sm:col-span-2 space-y-1.5">
                      <Label className="font-body text-xs">Número</Label>
                      <Input value={form.address_number} onChange={(e) => upd("address_number", e.target.value)} />
                    </div>
                    <div className="col-span-6 sm:col-span-4 space-y-1.5">
                      <Label className="font-body text-xs">Complemento</Label>
                      <Input value={form.address_complement} onChange={(e) => upd("address_complement", e.target.value)} />
                    </div>
                </div>
              </TabsContent>

              {/* Travelers Tab */}
              <TabsContent value="travelers">
                <ClientTravelersTab
                  clientId={editingId}
                  onNavigateToClient={(id) => {
                    const target = clients.find((c: any) => c.id === id);
                    if (target) { openEdit(target); setActiveTab("travelers"); }
                  }}
                />
              </TabsContent>


              {/* Miles Tab */}
              {canAccessFeature(userRole, "client_miles_tab") && (
                <TabsContent value="miles" className="space-y-4 pt-3">
                  <div className="flex items-center justify-between">
                    <h3 className="text-sm font-display font-medium text-foreground">Programas de Milhagem</h3>
                    <Button type="button" variant="ghost" size="sm" className="h-6 px-1 text-xs" onClick={() => setMilesPrograms([...milesPrograms, { program_name: "", airline: "", membership_number: "", login_username: "", login_email: "", login_password_encrypted: "", miles_balance: null }])}>
                      <Plus className="h-3 w-3 mr-1" />Adicionar Programa
                    </Button>
                  </div>
                  {milesPrograms.length === 0 && <p className="text-xs text-muted-foreground font-body">Nenhum programa de milhagem cadastrado.</p>}
                  {milesPrograms.map((m, mi) => (
                    <div key={mi} className="border border-border/50 rounded-lg p-3 space-y-3 bg-muted/20">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-body font-medium text-foreground">Programa {mi + 1}</span>
                        <Button type="button" variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => setMilesPrograms(milesPrograms.filter((_, j) => j !== mi))}>
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                        <div className="space-y-1">
                          <Label className="font-body text-xs">Cia Aérea / Programa</Label>
                          <Select value={m.airline || ""} onValueChange={(v) => {
                            const n = [...milesPrograms];
                            n[mi].airline = v;
                            const airline = airlinesList.find((a: any) => a.name === v);
                            if (airline?.mileage_program_name) n[mi].program_name = airline.mileage_program_name;
                            setMilesPrograms(n);
                          }}>
                            <SelectTrigger className="h-9"><SelectValue placeholder="Selecione" /></SelectTrigger>
                            <SelectContent className="max-h-60">
                              {airlinesList.map((a: any) => (
                                <SelectItem key={a.id} value={a.name}>
                                  {a.iata_code ? `${a.iata_code} - ` : ""}{a.name}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="space-y-1">
                          <Label className="font-body text-xs">Nº de Membro</Label>
                          <Input className="h-9" placeholder="Número de associado" value={m.membership_number} onChange={(e) => { const n = [...milesPrograms]; n[mi].membership_number = e.target.value; setMilesPrograms(n); }} />
                        </div>
                        <div className="space-y-1">
                          <Label className="font-body text-xs">Nome de Usuário</Label>
                          <Input className="h-9" placeholder="Username do programa" value={m.login_username} onChange={(e) => { const n = [...milesPrograms]; n[mi].login_username = e.target.value; setMilesPrograms(n); }} />
                        </div>
                        <div className="space-y-1">
                          <Label className="font-body text-xs">E-mail de Cadastro</Label>
                          <Input className="h-9" type="email" placeholder="E-mail do programa" value={m.login_email} onChange={(e) => { const n = [...milesPrograms]; n[mi].login_email = e.target.value; setMilesPrograms(n); }} />
                        </div>
                        <div className="space-y-1">
                          <Label className="font-body text-xs">Pontos / Milhas</Label>
                          <Input className="h-9" type="number" placeholder="0" value={m.miles_balance ?? ""} onChange={(e) => { const n = [...milesPrograms]; n[mi].miles_balance = e.target.value ? parseInt(e.target.value) : null; setMilesPrograms(n); }} />
                        </div>
                        {canAccessFeature(userRole, "client_miles_access_data") && (
                          <div className="space-y-1">
                            <Label className="font-body text-xs">Dados de Acesso (Senha)</Label>
                            <div className="relative">
                              <Input
                                className="h-9 pr-9"
                                type={showPasswords[mi] ? "text" : "password"}
                                placeholder="Senha do programa"
                                value={m.login_password_encrypted}
                                onChange={(e) => { const n = [...milesPrograms]; n[mi].login_password_encrypted = e.target.value; setMilesPrograms(n); }}
                              />
                              <button
                                type="button"
                                className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                                onClick={() => setShowPasswords(prev => ({ ...prev, [mi]: !prev[mi] }))}
                              >
                                {showPasswords[mi] ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                              </button>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </TabsContent>
              )}

              {/* Observations Tab */}
              <TabsContent value="observations" className="pt-3">
                <div className="space-y-1">
                  <Label className="font-body text-xs">Observações gerais</Label>
                  <Textarea value={form.notes} onChange={(e) => upd("notes", e.target.value)} rows={4} placeholder="Anotações sobre o cliente..." />
                </div>
              </TabsContent>
            </Tabs>
          </div>

          {/* Actions */}
          <div className="flex gap-2 justify-between">
            {editingId ? (
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button type="button" variant="ghost" className="text-destructive font-body">
                    <Trash2 className="h-4 w-4 mr-1" />Excluir Cliente
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle className="font-display">Excluir cliente</AlertDialogTitle>
                    <AlertDialogDescription className="font-body">
                      Tem certeza que deseja excluir este cliente? Esta ação não pode ser desfeita.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel className="font-body">Cancelar</AlertDialogCancel>
                    <AlertDialogAction className="bg-destructive text-destructive-foreground hover:bg-destructive/90 font-body" onClick={() => deleteMutation.mutate(editingId)}>
                      Excluir
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            ) : <div />}
            <div className="flex gap-2">
              <Button type="button" variant="outline" onClick={goToList} className="font-body">
                <ArrowLeft className="h-4 w-4 mr-1" />Voltar
              </Button>
              <Button type="button" disabled={saveMutation.isPending} className="font-body" variant="secondary" onClick={() => { shouldGoBackRef.current = true; saveMutation.mutate(); }}>
                {saveMutation.isPending ? "Salvando..." : "Salvar e Voltar"}
              </Button>
              <Button type="button" disabled={saveMutation.isPending} className="font-body" onClick={() => { shouldGoBackRef.current = false; saveMutation.mutate(); }}>
                {saveMutation.isPending ? "Salvando..." : "Salvar"}
              </Button>
            </div>
          </div>
        </form>

        {/* Quick-add location dialog */}
        <Dialog open={quickAddType !== null} onOpenChange={(o) => { if (!o) { setQuickAddType(null); setQuickAddName(""); } }}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{quickAddType === "country" ? "Novo País" : quickAddType === "state" ? "Novo Estado/Região" : "Nova Cidade"}</DialogTitle>
            </DialogHeader>
            <div className="grid gap-4 py-2">
              {quickAddType === "state" && <p className="text-sm text-muted-foreground">País: {form.country}</p>}
              {quickAddType === "city" && <p className="text-sm text-muted-foreground">{form.country}{form.state ? ` → ${form.state}` : ""}</p>}
              <div>
                <Label>Nome <span className="text-destructive">*</span></Label>
                <Input value={quickAddName} onChange={(e) => setQuickAddName(e.target.value)} />
              </div>
              <Button onClick={() => quickAddMutation.mutate()} disabled={!quickAddName || quickAddMutation.isPending}>
                {quickAddMutation.isPending ? "Adicionando..." : "Adicionar"}
              </Button>
            </div>
          </DialogContent>
        </Dialog>

        <ImageEditor
          open={editorOpen}
          imageSrc={editorSrc}
          onClose={() => { setEditorOpen(false); setEditorSrc(""); setEditorCallback(null); }}
          onSave={(file) => { editorCallback?.(file); setEditorOpen(false); setEditorSrc(""); setEditorCallback(null); }}
        />
      </div>
    );
  }

  // ========== LIST VIEW ==========
  return (
    <div className="max-w-7xl mx-auto space-y-4 sm:space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl sm:text-3xl font-display font-semibold text-foreground">Clientes</h1>
          <p className="text-muted-foreground font-body mt-1 text-sm">{clients.length} clientes cadastrados</p>
        </div>
        <Button onClick={openCreate} className="font-body w-full sm:w-auto"><Plus className="h-4 w-4" />Novo Cliente</Button>
      </div>

      <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
        <div className="relative flex-1 sm:max-w-sm">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground"><circle cx="11" cy="11" r="8" /><path d="M21 21l-4.35-4.35" /></svg>
          <input type="text" placeholder="Buscar clientes e passageiros..." value={search} onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 rounded-lg border border-border bg-card text-sm font-body text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring/30" />
        </div>
        <div className="flex gap-1 p-1 rounded-lg bg-muted overflow-x-auto">
          {["all", "economic", "opportunity", "sophisticated"].map((p) => (
            <button key={p} onClick={() => setProfileFilter(p)}
              className={`px-3 py-1.5 rounded-md text-xs font-medium font-body transition-colors whitespace-nowrap ${profileFilter === p ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"}`}>
              {p === "all" ? "Todos" : travelProfiles[p].label}
            </button>
          ))}
        </div>
        <Popover>
          <PopoverTrigger asChild>
            <Button variant="outline" size="sm" className="font-body text-xs gap-1.5 h-9">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="shrink-0"><path d="M20.59 13.41l-7.17 7.17a2 2 0 01-2.83 0L2 12V2h10l8.59 8.59a2 2 0 010 2.82z"/><line x1="7" y1="7" x2="7.01" y2="7"/></svg>
              Etiquetas
              {tagFilter.length > 0 && <span className="ml-1 bg-primary text-primary-foreground rounded-full px-1.5 py-0.5 text-[10px] leading-none">{tagFilter.length}</span>}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-56 p-2" align="start">
            <div className="space-y-1 max-h-60 overflow-y-auto">
              {(availableTags ?? []).length === 0 ? (
                <p className="text-xs text-muted-foreground p-2 text-center">Nenhuma etiqueta cadastrada</p>
              ) : (availableTags ?? []).map((t: any) => {
                const isSelected = tagFilter.includes(t.name);
                const colorClass = TAG_COLORS[t.color] || TAG_COLORS.gray;
                return (
                  <button key={t.id} type="button"
                    className={`w-full flex items-center gap-2 px-2 py-1.5 rounded text-sm font-body hover:bg-muted/50 transition-colors ${isSelected ? "bg-muted/30" : ""}`}
                    onClick={() => setTagFilter(isSelected ? tagFilter.filter(tag => tag !== t.name) : [...tagFilter, t.name])}>
                    <Checkbox checked={isSelected} className="pointer-events-none h-3.5 w-3.5" />
                    <span className={`text-[11px] font-medium px-2 py-0.5 rounded-full ${colorClass}`}>{t.name}</span>
                  </button>
                );
              })}
            </div>
            {tagFilter.length > 0 && (
              <Button variant="ghost" size="sm" className="w-full mt-1 text-xs" onClick={() => setTagFilter([])}>Limpar filtro</Button>
            )}
          </PopoverContent>
        </Popover>
      </div>

      {/* Desktop table */}
      <div className="glass-card rounded-xl overflow-hidden hidden md:block">
        {isLoading ? (
          <div className="p-8 text-center text-muted-foreground font-body">Carregando...</div>
        ) : filtered.length === 0 ? (
          <div className="p-8 text-center text-muted-foreground font-body">Nenhum cliente encontrado.</div>
        ) : (
          <table className="w-full">
            <thead>
              <tr className="border-b border-border/50">
                <th className="p-2 w-10"></th>
                <SortableHeader label="Cliente" sortKey="full_name" />
                <th className="text-left p-4 text-[10px] uppercase tracking-widest text-muted-foreground font-body font-medium">Telefone</th>
                <th className="text-left p-4 text-[10px] uppercase tracking-widest text-muted-foreground font-body font-medium">E-mail</th>
                <SortableHeader label="Localização" sortKey="city" />
                <SortableHeader label="Perfil" sortKey="travel_profile" />
                <th className="text-left p-4 text-[10px] uppercase tracking-widest text-muted-foreground font-body font-medium">Aeroportos</th>
                <th className="text-left p-4 text-[10px] uppercase tracking-widest text-muted-foreground font-body font-medium">Alertas</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/30">
              {filtered.map((client: any) => {
                const clientPassengersList = passengersByClient[client.id] ?? [];
                const isExpanded = expandedClients.has(client.id);
                const hasPassengers = clientPassengersList.length > 0;
                return (
                  <React.Fragment key={client.id}>
                    <tr className="hover:bg-muted/30 transition-colors cursor-pointer" onClick={() => openEdit(client)}>
                      <td className="p-2 text-center">
                        {hasPassengers ? (
                          <button
                            type="button"
                            className="p-1 rounded hover:bg-muted/50 transition-colors text-muted-foreground hover:text-foreground"
                            onClick={(e) => { e.stopPropagation(); toggleExpand(client.id); }}
                            title={`${clientPassengersList.length} passageiro(s)`}
                          >
                            {isExpanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                          </button>
                        ) : (
                          <span className="p-1 inline-block"><span className="h-4 w-4 block" /></span>
                        )}
                      </td>
                      <td className="p-4">
                        <div className="flex items-center gap-2">
                          <div>
                            <div className="flex items-center gap-1.5">
                              <p className="text-sm font-medium font-body text-foreground">{client.full_name}</p>
                              {hasPassengers && (
                                <span className="inline-flex items-center gap-0.5 text-[10px] text-muted-foreground font-body">
                                  <Users className="h-3 w-3" />{clientPassengersList.length}
                                </span>
                              )}
                            </div>
                            {client.rating > 0 && <div className="flex gap-0.5">{[1,2,3,4,5].map(i => <Star key={i} className={`h-3 w-3 ${i <= client.rating ? "fill-amber-400 text-amber-400" : "text-muted-foreground/20"}`} />)}</div>}
                          </div>
                          {client.is_active === false && <span className="text-[10px] px-1.5 py-0.5 rounded bg-destructive/10 text-destructive font-body">Inativo</span>}
                        </div>
                      </td>
                      <td className="p-4">
                        {client.primary_phone ? (
                          <a href={`https://wa.me/${client.primary_phone.replace(/\D/g, "")}`} target="_blank" rel="noopener noreferrer" onClick={(e) => e.stopPropagation()} className="text-sm font-body text-primary hover:underline whitespace-nowrap">{client.primary_phone}</a>
                        ) : <p className="text-sm font-body text-foreground">—</p>}
                      </td>
                      <td className="p-4">
                        <p className="text-sm font-body text-foreground truncate max-w-[200px]">{client.primary_email || "—"}</p>
                      </td>
                      <td className="p-4">
                        <p className="text-sm font-body text-foreground">{client.city}</p>
                        <p className="text-xs text-muted-foreground font-body">{client.state}</p>
                      </td>
                      <td className="p-4">
                        {client.travel_profile && travelProfiles[client.travel_profile] && (
                          <span className={`text-[10px] font-medium px-2.5 py-1 rounded-full font-body ${travelProfiles[client.travel_profile].color}`}>
                            {travelProfiles[client.travel_profile].label}
                          </span>
                        )}
                      </td>
                      <td className="p-4">
                        <div className="flex gap-1 flex-wrap">
                          {(client.preferred_airports ?? []).map((a: string) => (
                            <span key={a} className="text-[10px] font-medium px-2 py-0.5 rounded bg-muted text-muted-foreground font-body">{a}</span>
                          ))}
                        </div>
                      </td>
                      <td className="p-4">
                        <div className="flex flex-col gap-1">
                          {(client.alerts ?? []).length === 0 ? (
                            <span className="text-xs text-muted-foreground font-body">—</span>
                          ) : (
                            (client.alerts as { label: string; level: string; months: number; tab: string }[]).slice(0, 3).map((alert, idx) => {
                              const styles = {
                                urgent: "bg-destructive/10 text-destructive",
                                critical: "bg-amber-500/10 text-amber-600",
                                warning: "bg-amber-400/10 text-amber-500",
                              }[alert.level] ?? "bg-muted text-muted-foreground";
                              const Icon = alert.level === "urgent" ? ShieldAlert : alert.level === "critical" ? AlertCircle : AlertTriangle;
                              return (
                                <button
                                  key={idx}
                                  type="button"
                                  onClick={(e) => { e.stopPropagation(); setActiveTab(alert.tab); openEdit(client); }}
                                  className={`inline-flex items-center gap-1 text-[10px] font-medium px-2 py-0.5 rounded-full font-body cursor-pointer hover:opacity-80 transition-opacity ${styles}`}
                                >
                                  <Icon className="h-3 w-3" />
                                  {alert.label}
                                </button>
                              );
                            })
                          )}
                        </div>
                      </td>
                    </tr>
                    {isExpanded && clientPassengersList.length > 0 && (
                      <tr className="bg-muted/10">
                        <td colSpan={9} className="p-0">
                          <div className="pl-12 pr-4 py-2">
                            <table className="w-full">
                              <thead>
                                <tr className="border-b border-border/30">
                                  <th className="text-left py-1.5 px-3 text-[10px] uppercase tracking-widest text-muted-foreground font-body">Passageiro</th>
                                  <th className="text-left py-1.5 px-3 text-[10px] uppercase tracking-widest text-muted-foreground font-body">Vínculo</th>
                                  <th className="text-left py-1.5 px-3 text-[10px] uppercase tracking-widest text-muted-foreground font-body">Nascimento</th>
                                  <th className="text-left py-1.5 px-3 text-[10px] uppercase tracking-widest text-muted-foreground font-body">Nacionalidade</th>
                                  <th className="text-left py-1.5 px-3 text-[10px] uppercase tracking-widest text-muted-foreground font-body">Passaporte</th>
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-border/20">
                                {clientPassengersList.map((p: any) => (
                                  <tr key={p.id} className="hover:bg-muted/20 cursor-pointer" onClick={(e) => { e.stopPropagation(); setActiveTab("travelers"); openEdit(client); }}>
                                    <td className="py-1.5 px-3 text-xs font-body text-foreground">{p.full_name}</td>
                                    <td className="py-1.5 px-3">
                                      {p.relationship_type ? (
                                        <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-primary/10 text-primary font-body">
                                          {RELATIONSHIP_LABELS[p.relationship_type] || p.relationship_type}
                                        </span>
                                      ) : <span className="text-xs text-muted-foreground">—</span>}
                                    </td>
                                    <td className="py-1.5 px-3 text-xs font-body text-foreground">{p.birth_date ? new Date(p.birth_date + "T12:00:00").toLocaleDateString("pt-BR") : "—"}</td>
                                    <td className="py-1.5 px-3 text-xs font-body text-foreground">{p.nationality || "—"}</td>
                                    <td className="py-1.5 px-3 text-xs font-body text-foreground">{p.passport_number || "—"}</td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* Mobile cards */}
      <div className="md:hidden space-y-3">
        {isLoading ? (
          <div className="p-8 text-center text-muted-foreground font-body">Carregando...</div>
        ) : filtered.length === 0 ? (
          <div className="p-8 text-center text-muted-foreground font-body">Nenhum cliente encontrado.</div>
        ) : (
          filtered.map((client: any) => {
            const clientPassengersList = passengersByClient[client.id] ?? [];
            const isExpanded = expandedClients.has(client.id);
            const hasPassengers = clientPassengersList.length > 0;
            return (
              <div key={client.id} className="glass-card rounded-xl p-4 space-y-3 cursor-pointer hover:bg-muted/30 transition-colors" onClick={() => openEdit(client)}>
                <div className="flex items-start justify-between">
                  <div>
                    <div className="flex items-center gap-1.5">
                      <p className="text-sm font-medium font-body text-foreground">{client.full_name}</p>
                      {hasPassengers && (
                        <span className="inline-flex items-center gap-0.5 text-[10px] text-muted-foreground font-body">
                          <Users className="h-3 w-3" />{clientPassengersList.length}
                        </span>
                      )}
                    </div>
                    {client.rating > 0 && <div className="flex gap-0.5 mt-0.5">{[1,2,3,4,5].map(i => <Star key={i} className={`h-3 w-3 ${i <= client.rating ? "fill-amber-400 text-amber-400" : "text-muted-foreground/20"}`} />)}</div>}
                  </div>
                  <div className="flex items-center gap-1">
                    {hasPassengers && (
                      <button type="button" className="p-1 rounded hover:bg-muted/50 text-muted-foreground" onClick={(e) => { e.stopPropagation(); toggleExpand(client.id); }}>
                        {isExpanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                      </button>
                    )}
                    {client.is_active === false && <span className="text-[10px] px-1.5 py-0.5 rounded bg-destructive/10 text-destructive font-body">Inativo</span>}
                    {client.travel_profile && travelProfiles[client.travel_profile] && (
                      <span className={`text-[10px] font-medium px-2.5 py-1 rounded-full font-body ${travelProfiles[client.travel_profile].color}`}>
                        {travelProfiles[client.travel_profile].label}
                      </span>
                    )}
                  </div>
                </div>
                <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground font-body">
                  {client.city && <span>{client.city}{client.state ? `, ${client.state}` : ""}</span>}
                  {client.primary_phone && <a href={`https://wa.me/${client.primary_phone.replace(/\D/g, "")}`} target="_blank" rel="noopener noreferrer" onClick={(e) => e.stopPropagation()} className="text-primary hover:underline">{client.primary_phone}</a>}
                  {client.primary_email && <span>{client.primary_email}</span>}
                </div>
                {isExpanded && clientPassengersList.length > 0 && (
                  <div className="border-t border-border/30 pt-2 mt-1 space-y-1" onClick={(e) => e.stopPropagation()}>
                    {clientPassengersList.map((p: any) => (
                      <div key={p.id} className="flex items-center gap-2 text-xs font-body text-foreground py-0.5">
                        <Users className="h-3 w-3 text-muted-foreground shrink-0" />
                        <span>{p.full_name}</span>
                        {p.relationship_type && (
                          <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-primary/10 text-primary">{RELATIONSHIP_LABELS[p.relationship_type] || p.relationship_type}</span>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
