import { useState, useEffect, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { Save, Upload, X, Building2 } from "lucide-react";

export default function AgencySettingsTab() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [form, setForm] = useState<Record<string, any>>({});
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [logoPreview, setLogoPreview] = useState<string | null>(null);

  const { data: settings, isLoading } = useQuery({
    queryKey: ["agency-settings"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("agency_settings")
        .select("*")
        .limit(1)
        .single();
      if (error) throw error;
      return data;
    },
  });

  useEffect(() => {
    if (settings) {
      setForm(settings);
      if (settings.logo_url) setLogoPreview(settings.logo_url);
    }
  }, [settings]);

  const handleLogoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setLogoFile(file);
    setLogoPreview(URL.createObjectURL(file));
  };

  const saveMutation = useMutation({
    mutationFn: async () => {
      let logo_url = form.logo_url || "";

      if (logoFile) {
        const ext = logoFile.name.split(".").pop();
        const path = `agency-logo.${ext}`;
        const { error: uploadError } = await supabase.storage
          .from("avatars")
          .upload(path, logoFile, { upsert: true });
        if (uploadError) throw uploadError;
        const { data: urlData } = supabase.storage.from("avatars").getPublicUrl(path);
        logo_url = urlData.publicUrl;
      }

      const { error } = await supabase
        .from("agency_settings")
        .update({
          name: form.name || "",
          cnpj: form.cnpj || "",
          phone: form.phone || "",
          email: form.email || "",
          instagram: form.instagram || "",
          website: form.website || "",
          address: form.address || "",
          logo_url,
          updated_at: new Date().toISOString(),
        })
        .eq("id", form.id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["agency-settings"] });
      toast({ title: "Dados da agência salvos!" });
      setLogoFile(null);
    },
    onError: (err: any) => {
      toast({ title: "Erro ao salvar", description: err.message, variant: "destructive" });
    },
  });

  if (isLoading) {
    return <p className="text-sm text-muted-foreground font-body p-4">Carregando...</p>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2 mb-2">
        <Building2 className="w-5 h-5 text-accent" />
        <h2 className="text-lg font-display font-semibold text-foreground">Dados da Agência</h2>
      </div>

      <div className="glass-card rounded-xl p-5 space-y-5">
        {/* Logo */}
        <div className="space-y-2">
          <Label className="font-body text-sm font-medium">Logo da Agência</Label>
          <div className="flex items-center gap-4">
            {logoPreview ? (
              <div className="relative">
                <img src={logoPreview} alt="Logo" className="h-16 max-w-[200px] object-contain rounded-lg border border-border p-1 bg-card" />
                <button
                  type="button"
                  onClick={() => { setLogoFile(null); setLogoPreview(null); setForm({ ...form, logo_url: "" }); }}
                  className="absolute -top-2 -right-2 bg-destructive text-destructive-foreground rounded-full p-0.5"
                >
                  <X className="w-3 h-3" />
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="h-16 w-32 border-2 border-dashed border-border rounded-lg flex flex-col items-center justify-center gap-1 text-muted-foreground hover:border-primary hover:text-primary transition-colors"
              >
                <Upload className="w-4 h-4" />
                <span className="text-[10px] font-body">Upload Logo</span>
              </button>
            )}
            <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleLogoChange} />
            <p className="text-xs text-muted-foreground font-body">Esta logo será exibida nas cotações públicas enviadas aos clientes.</p>
          </div>
        </div>

        {/* Fields */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-1">
            <Label className="font-body text-xs">Nome da Agência</Label>
            <Input className="h-9 text-sm" value={form.name ?? ""} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Ex: Altivus Turismo" />
          </div>
          <div className="space-y-1">
            <Label className="font-body text-xs">CNPJ</Label>
            <Input className="h-9 text-sm" value={form.cnpj ?? ""} onChange={(e) => setForm({ ...form, cnpj: e.target.value })} placeholder="00.000.000/0000-00" />
          </div>
          <div className="space-y-1">
            <Label className="font-body text-xs">Telefone</Label>
            <Input className="h-9 text-sm" value={form.phone ?? ""} onChange={(e) => setForm({ ...form, phone: e.target.value })} placeholder="(00) 00000-0000" />
          </div>
          <div className="space-y-1">
            <Label className="font-body text-xs">E-mail</Label>
            <Input className="h-9 text-sm" type="email" value={form.email ?? ""} onChange={(e) => setForm({ ...form, email: e.target.value })} placeholder="contato@agencia.com.br" />
          </div>
          <div className="space-y-1">
            <Label className="font-body text-xs">Instagram</Label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">@</span>
              <Input className="h-9 text-sm pl-7" value={form.instagram ?? ""} onChange={(e) => setForm({ ...form, instagram: e.target.value })} placeholder="nomedaagencia" />
            </div>
          </div>
          <div className="space-y-1">
            <Label className="font-body text-xs">Website</Label>
            <Input className="h-9 text-sm" value={form.website ?? ""} onChange={(e) => setForm({ ...form, website: e.target.value })} placeholder="https://www.agencia.com.br" />
          </div>
          <div className="sm:col-span-2 space-y-1">
            <Label className="font-body text-xs">Endereço</Label>
            <Textarea className="text-sm" rows={2} value={form.address ?? ""} onChange={(e) => setForm({ ...form, address: e.target.value })} placeholder="Endereço completo da agência" />
          </div>
        </div>

        <div className="flex justify-end pt-2">
          <Button size="sm" className="font-body gap-1.5" onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending}>
            <Save className="w-3.5 h-3.5" />
            {saveMutation.isPending ? "Salvando..." : "Salvar"}
          </Button>
        </div>
      </div>
    </div>
  );
}
