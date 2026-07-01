import { useMemo, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Checkbox } from "@/components/ui/checkbox";
import { Loader2, Forward, Search, Users } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export interface ForwardableMessage {
  id: string;
  messageType?: "text" | "image" | "audio" | "video" | "document" | "sticker" | "location" | "contact" | "other";
  content?: string | null;
  mediaUrl?: string | null;
  mediaCaption?: string | null;
}

export interface ForwardTarget {
  id: string;
  name: string;
  phone: string;
  isGroup?: boolean;
  groupId?: string;
  photoUrl?: string;
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  message: ForwardableMessage | null;
  targets: ForwardTarget[];
  /** id da conversa atual — excluído da lista. */
  excludeId?: string;
  onSent?: () => void;
}

export function ForwardMessageDialog({
  open, onOpenChange, message, targets, excludeId, onSent,
}: Props) {
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [sending, setSending] = useState(false);

  const list = useMemo(() => {
    const q = search.trim().toLowerCase();
    return targets
      .filter((t) => t.id !== excludeId)
      .filter((t) =>
        !q ||
        t.name.toLowerCase().includes(q) ||
        t.phone.toLowerCase().includes(q),
      );
  }, [targets, excludeId, search]);

  const toggle = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const reset = () => {
    setSearch("");
    setSelected(new Set());
  };

  const handleClose = (o: boolean) => {
    if (!o && !sending) reset();
    onOpenChange(o);
  };

  const previewLabel = (() => {
    if (!message) return "";
    const t = message.messageType ?? "text";
    if (t === "image") return "📷 Imagem";
    if (t === "audio") return "🎤 Áudio";
    if (t === "video") return "🎬 Vídeo";
    if (t === "document") return "📄 Documento";
    if (t === "sticker") return "🏷️ Figurinha";
    if (t === "location") return "📍 Localização";
    if (t === "contact") return "👤 Contato";
    return (message.content || "").slice(0, 120);
  })();

  const handleForward = async () => {
    if (!message) return;
    const chosen = list.filter((t) => selected.has(t.id));
    if (chosen.length === 0) {
      toast.error("Selecione ao menos uma conversa");
      return;
    }
    setSending(true);
    try {
      const t = message.messageType ?? "text";
      const caption = (message.mediaCaption || "").toString();
      let bodyBase: Record<string, unknown> = {};

      if (t === "image" && message.mediaUrl) {
        bodyBase = { action: "send-image", image_url: message.mediaUrl, message: caption || undefined };
      } else if (t === "document" && message.mediaUrl) {
        bodyBase = {
          action: "send-document",
          document_url: message.mediaUrl,
          document_name: caption || "documento",
          message: caption || undefined,
        };
      } else if (t === "audio" && message.mediaUrl) {
        bodyBase = { action: "send-audio", audio_url: message.mediaUrl };
      } else if (t === "video" && message.mediaUrl) {
        // Fallback: encaminhar como link no texto
        bodyBase = { action: "send-text", message: `🎬 ${message.mediaUrl}${caption ? `\n${caption}` : ""}` };
      } else {
        const txt = (message.content || "").toString();
        if (!txt.trim()) {
          toast.error("Mensagem vazia — nada para encaminhar");
          setSending(false);
          return;
        }
        bodyBase = { action: "send-text", message: txt };
      }

      let okCount = 0;
      let failCount = 0;
      for (const target of chosen) {
        try {
          const body = {
            ...bodyBase,
            phone: target.phone,
            is_group: !!target.isGroup,
            group_id: target.groupId,
          };
          const { data, error } = await supabase.functions.invoke("send-whatsapp", { body });
          if (error) throw error;
          if ((data as any)?.error) throw new Error((data as any).error);
          okCount++;
        } catch (err: any) {
          console.error("Forward failed for", target.phone, err);
          failCount++;
        }
      }

      if (okCount > 0) toast.success(`Encaminhado para ${okCount} conversa${okCount > 1 ? "s" : ""}`);
      if (failCount > 0) toast.error(`Falha ao encaminhar para ${failCount} conversa${failCount > 1 ? "s" : ""}`);
      if (okCount > 0) {
        onSent?.();
        reset();
        onOpenChange(false);
      }
    } finally {
      setSending(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-md p-0 gap-0 overflow-hidden">
        <DialogHeader className="px-5 pt-5 pb-3 border-b">
          <DialogTitle className="font-display text-base flex items-center gap-2">
            <Forward className="h-4 w-4" />
            Encaminhar mensagem
          </DialogTitle>
          {previewLabel && (
            <p className="text-xs text-muted-foreground truncate mt-1">
              {previewLabel}
            </p>
          )}
        </DialogHeader>

        <div className="px-5 py-3 border-b">
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar conversa…"
              className="pl-8 h-9"
            />
          </div>
        </div>

        <ScrollArea className="max-h-[360px]">
          <div className="py-1">
            {list.length === 0 ? (
              <p className="text-xs text-muted-foreground text-center py-8">
                Nenhuma conversa encontrada
              </p>
            ) : (
              list.map((t) => {
                const checked = selected.has(t.id);
                return (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => toggle(t.id)}
                    className="flex w-full items-center gap-3 px-5 py-2.5 hover:bg-muted/50 transition-colors text-left"
                  >
                    <Checkbox checked={checked} onCheckedChange={() => toggle(t.id)} />
                    <Avatar className="h-9 w-9">
                      {t.photoUrl && <AvatarImage src={t.photoUrl} alt={t.name} />}
                      <AvatarFallback className="text-xs bg-muted">
                        {t.isGroup ? <Users className="h-4 w-4" /> : (t.name?.[0] || "?").toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{t.name || t.phone}</p>
                      <p className="text-[11px] text-muted-foreground truncate">
                        {t.isGroup ? "Grupo" : t.phone}
                      </p>
                    </div>
                  </button>
                );
              })
            )}
          </div>
        </ScrollArea>

        <DialogFooter className="px-5 py-3 border-t flex sm:justify-between gap-2">
          <span className="text-xs text-muted-foreground self-center">
            {selected.size > 0 ? `${selected.size} selecionada${selected.size > 1 ? "s" : ""}` : "Selecione conversas"}
          </span>
          <Button onClick={handleForward} disabled={sending || selected.size === 0}>
            {sending ? <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" /> : <Forward className="h-3.5 w-3.5 mr-1.5" />}
            Encaminhar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
