import { useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { ExternalLink, Paperclip, Trash2, FileText, Image as ImageIcon, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface Props {
  externalUrl: string | null;
  attachmentUrls: string[];
  quoteId?: string;
  itemId?: string;
  isNew: boolean;
  onChange: (patch: { externalUrl?: string | null; attachmentUrls?: string[] }) => void;
}

const BUCKET = "quote-item-attachments";

const isImage = (path: string) => /\.(png|jpe?g|webp|gif)$/i.test(path);
const fileNameFromPath = (path: string) => path.split("/").pop() ?? path;

export default function QuoteItemAttachments({
  externalUrl,
  attachmentUrls,
  quoteId,
  itemId,
  isNew,
  onChange,
}: Props) {
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const canUpload = !!quoteId && !!itemId && !isNew;

  const handleFiles = async (files: FileList | null) => {
    if (!files || !files.length || !canUpload) return;
    setUploading(true);
    try {
      const newPaths: string[] = [];
      for (const file of Array.from(files)) {
        const ext = file.name.split(".").pop() || "bin";
        const uuid = crypto.randomUUID();
        const path = `${quoteId}/${itemId}/${uuid}.${ext}`;
        const { error } = await supabase.storage.from(BUCKET).upload(path, file, {
          cacheControl: "3600",
          upsert: false,
        });
        if (error) throw error;
        newPaths.push(path);
      }
      onChange({ attachmentUrls: [...(attachmentUrls ?? []), ...newPaths] });
      toast({ title: "Anexo enviado", duration: 1500 });
    } catch (err: any) {
      toast({ title: "Erro ao enviar", description: err.message, variant: "destructive" });
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const openAttachment = async (path: string) => {
    const { data, error } = await supabase.storage.from(BUCKET).createSignedUrl(path, 60 * 10);
    if (error || !data?.signedUrl) {
      toast({ title: "Não foi possível abrir o anexo", variant: "destructive" });
      return;
    }
    window.open(data.signedUrl, "_blank", "noopener,noreferrer");
  };

  const removeAttachment = async (path: string) => {
    try {
      await supabase.storage.from(BUCKET).remove([path]);
    } catch {
      /* ignore — still remove from list */
    }
    onChange({ attachmentUrls: (attachmentUrls ?? []).filter((p) => p !== path) });
  };

  const openExternal = () => {
    if (!externalUrl) return;
    let url = externalUrl.trim();
    if (!/^https?:\/\//i.test(url)) url = `https://${url}`;
    window.open(url, "_blank", "noopener,noreferrer");
  };

  return (
    <div className="space-y-2">
      <Label className="text-[11px] font-body font-semibold text-muted-foreground uppercase tracking-wide">
        Referências e anexos
      </Label>
      <div className="grid grid-cols-1 lg:grid-cols-[1fr_auto] gap-2">
        <div className="space-y-0.5">
          <Label className="text-[11px] font-body">Link externo</Label>
          <div className="flex items-center gap-1">
            <Input
              value={externalUrl ?? ""}
              onChange={(e) => onChange({ externalUrl: e.target.value || null })}
              placeholder="URL da busca (Google Flights, Booking, site da companhia...)"
              className="h-8 text-xs"
            />
            {externalUrl && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-8 px-2"
                onClick={openExternal}
                title="Abrir em nova aba"
              >
                <ExternalLink className="w-3.5 h-3.5" />
              </Button>
            )}
          </div>
        </div>
        <div className="space-y-0.5">
          <Label className="text-[11px] font-body">Anexos</Label>
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <span className="inline-block">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="h-8 text-xs gap-1"
                    disabled={!canUpload || uploading}
                    onClick={() => fileInputRef.current?.click()}
                  >
                    {uploading ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <Paperclip className="w-3.5 h-3.5" />
                    )}
                    Anexar arquivo
                  </Button>
                </span>
              </TooltipTrigger>
              {!canUpload && (
                <TooltipContent side="top" className="text-xs">
                  Salve a cotação primeiro pra anexar arquivos a este item.
                </TooltipContent>
              )}
            </Tooltip>
          </TooltipProvider>
          <input
            ref={fileInputRef}
            type="file"
            accept=".png,.jpg,.jpeg,.pdf,.webp"
            multiple
            className="hidden"
            onChange={(e) => handleFiles(e.target.files)}
          />
        </div>
      </div>

      {(attachmentUrls?.length ?? 0) > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {attachmentUrls.map((path) => (
            <div
              key={path}
              className="flex items-center gap-1.5 px-2 py-1 border border-border rounded-md bg-muted/30 text-xs"
            >
              {isImage(path) ? (
                <ImageIcon className="w-3 h-3 text-muted-foreground shrink-0" />
              ) : (
                <FileText className="w-3 h-3 text-muted-foreground shrink-0" />
              )}
              <button
                type="button"
                onClick={() => openAttachment(path)}
                className="truncate max-w-[180px] hover:text-primary transition-colors"
                title={fileNameFromPath(path)}
              >
                {fileNameFromPath(path)}
              </button>
              <button
                type="button"
                onClick={() => removeAttachment(path)}
                className="text-destructive hover:text-destructive/80 transition-colors"
                title="Remover anexo"
              >
                <Trash2 className="w-3 h-3" />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
