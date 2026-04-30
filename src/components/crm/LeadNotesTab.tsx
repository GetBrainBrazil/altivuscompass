import { useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { MoreHorizontal, Pencil, Trash2, Send, FileText, Loader2 } from "lucide-react";
import { format, formatDistanceToNow, isToday, isYesterday, differenceInDays } from "date-fns";
import { ptBR } from "date-fns/locale";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

type LeadNote = {
  id: string;
  lead_id: string;
  user_id: string | null;
  user_name: string | null;
  body: string;
  is_imported: boolean;
  created_at: string;
  updated_at: string;
};

function initials(name?: string | null) {
  if (!name) return "?";
  const parts = name.trim().split(/\s+/);
  return ((parts[0]?.[0] ?? "") + (parts[1]?.[0] ?? "")).toUpperCase() || "?";
}

function relativeTime(iso: string) {
  const d = new Date(iso);
  const days = differenceInDays(new Date(), d);
  if (days < 1 && !isYesterday(d)) {
    return formatDistanceToNow(d, { addSuffix: true, locale: ptBR });
  }
  if (isYesterday(d)) {
    return `ontem às ${format(d, "HH:mm", { locale: ptBR })}`;
  }
  if (isToday(d)) {
    return `hoje às ${format(d, "HH:mm", { locale: ptBR })}`;
  }
  if (days < 7) {
    return format(d, "EEEE 'às' HH:mm", { locale: ptBR });
  }
  return format(d, "dd/MM/yyyy 'às' HH:mm", { locale: ptBR });
}

interface Props {
  leadId: string | null;
  /** Texto antigo do campo `preferences` exibido como "Observação importada". */
  legacyText?: string | null;
}

export function LeadNotesTab({ leadId, legacyText }: Props) {
  const { user } = useAuth();
  const [notes, setNotes] = useState<LeadNote[]>([]);
  const [loading, setLoading] = useState(false);
  const [body, setBody] = useState("");
  const [sending, setSending] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingBody, setEditingBody] = useState("");
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const inputRef = useRef<HTMLTextAreaElement | null>(null);

  const userName =
    (user as any)?.user_metadata?.full_name ||
    user?.email ||
    "Você";

  const load = async () => {
    if (!leadId) return;
    setLoading(true);
    const { data, error } = await supabase
      .from("lead_notes")
      .select("*")
      .eq("lead_id", leadId)
      .order("created_at", { ascending: false });
    setLoading(false);
    if (error) {
      console.error("[LeadNotesTab] load:", error);
      toast.error("Não foi possível carregar as observações.");
      return;
    }
    setNotes((data ?? []) as LeadNote[]);
  };

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [leadId]);

  const handleSend = async () => {
    if (!leadId) {
      toast.error("Salve o lead antes de adicionar observações.");
      return;
    }
    const text = body.trim();
    if (!text) return;
    if (!user?.id) {
      toast.error("Você precisa estar autenticado.");
      return;
    }
    setSending(true);
    const { data, error } = await supabase
      .from("lead_notes")
      .insert({
        lead_id: leadId,
        user_id: user.id,
        user_name: userName,
        body: text,
      })
      .select("*")
      .single();
    setSending(false);
    if (error) {
      console.error("[LeadNotesTab] insert:", error);
      toast.error("Não foi possível salvar a observação.");
      return;
    }
    setNotes((prev) => [data as LeadNote, ...prev]);
    setBody("");
    inputRef.current?.focus();
  };

  const handleStartEdit = (n: LeadNote) => {
    setEditingId(n.id);
    setEditingBody(n.body);
  };

  const handleSaveEdit = async () => {
    if (!editingId) return;
    const text = editingBody.trim();
    if (!text) {
      toast.error("A observação não pode ficar vazia.");
      return;
    }
    const { data, error } = await supabase
      .from("lead_notes")
      .update({ body: text })
      .eq("id", editingId)
      .select("*")
      .single();
    if (error) {
      console.error("[LeadNotesTab] update:", error);
      toast.error("Não foi possível atualizar a observação.");
      return;
    }
    setNotes((prev) => prev.map((n) => (n.id === editingId ? (data as LeadNote) : n)));
    setEditingId(null);
    setEditingBody("");
  };

  const handleConfirmDelete = async () => {
    if (!deletingId) return;
    const id = deletingId;
    setDeletingId(null);
    const { error } = await supabase.from("lead_notes").delete().eq("id", id);
    if (error) {
      console.error("[LeadNotesTab] delete:", error);
      toast.error("Não foi possível excluir a observação.");
      return;
    }
    setNotes((prev) => prev.filter((n) => n.id !== id));
  };

  const showLegacy = useMemo(() => Boolean(legacyText && legacyText.trim()), [legacyText]);

  return (
    <div className="flex flex-col gap-4">
      {/* Composer fixo no topo */}
      <div className="rounded-lg border border-slate-200 bg-white p-3 shadow-sm sticky top-0 z-10">
        <div className="flex items-start gap-2">
          <Avatar className="h-8 w-8 shrink-0">
            <AvatarFallback className="bg-primary/10 text-primary text-xs font-medium">
              {initials(userName)}
            </AvatarFallback>
          </Avatar>
          <Textarea
            ref={inputRef}
            rows={2}
            placeholder="Adicionar uma observação..."
            value={body}
            onChange={(e) => setBody(e.target.value)}
            onKeyDown={(e) => {
              if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
                e.preventDefault();
                void handleSend();
              }
            }}
            className="min-h-[44px] resize-none flex-1 text-sm"
            disabled={sending || !leadId}
          />
          <Button
            size="sm"
            onClick={handleSend}
            disabled={sending || !body.trim() || !leadId}
            className="shrink-0"
          >
            {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4 mr-1" />}
            Enviar
          </Button>
        </div>
        <p className="text-[11px] text-slate-400 mt-2 ml-10">
          Notas conversacionais entre a equipe. Diferente da Timeline (eventos automáticos).
        </p>
      </div>

      {/* Lista */}
      <div className="space-y-3">
        {loading && (
          <div className="text-center py-6 text-sm text-slate-500">
            <Loader2 className="h-4 w-4 animate-spin inline mr-2" />
            Carregando observações...
          </div>
        )}

        {!loading && notes.length === 0 && !showLegacy && (
          <div className="text-center py-10 border border-dashed border-slate-200 rounded-lg text-sm text-slate-500">
            Nenhuma observação ainda. Use o campo acima para adicionar a primeira.
          </div>
        )}

        {notes.map((n) => {
          const isAuthor = !!user?.id && n.user_id === user.id;
          const isEditing = editingId === n.id;
          return (
            <div
              key={n.id}
              className="group rounded-lg border border-slate-200 bg-white p-3 hover:border-slate-300 transition-colors"
            >
              <div className="flex items-start gap-3">
                <Avatar className="h-8 w-8 shrink-0">
                  <AvatarFallback
                    className={cn(
                      "text-xs font-medium",
                      n.is_imported
                        ? "bg-slate-200 text-slate-600"
                        : "bg-primary/10 text-primary",
                    )}
                  >
                    {n.is_imported ? <FileText className="h-4 w-4" /> : initials(n.user_name)}
                  </AvatarFallback>
                </Avatar>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-medium text-slate-900">
                        {n.is_imported ? "Sistema" : n.user_name || "Usuário"}
                      </span>
                      {n.is_imported && (
                        <span className="text-[10px] uppercase tracking-wide bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded">
                          Observação importada
                        </span>
                      )}
                      <span className="text-xs text-slate-500">{relativeTime(n.created_at)}</span>
                      {n.updated_at !== n.created_at && (
                        <span className="text-[11px] text-slate-400 italic">(editado)</span>
                      )}
                    </div>

                    {isAuthor && !isEditing && (
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7 opacity-0 group-hover:opacity-100 transition-opacity"
                          >
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-36">
                          <DropdownMenuItem onClick={() => handleStartEdit(n)}>
                            <Pencil className="h-4 w-4 mr-2" />
                            Editar
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={() => setDeletingId(n.id)}
                            className="text-red-600 focus:text-red-600"
                          >
                            <Trash2 className="h-4 w-4 mr-2" />
                            Excluir
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    )}
                  </div>

                  {isEditing ? (
                    <div className="mt-2 space-y-2">
                      <Textarea
                        rows={3}
                        value={editingBody}
                        onChange={(e) => setEditingBody(e.target.value)}
                        className="text-sm"
                      />
                      <div className="flex justify-end gap-2">
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => {
                            setEditingId(null);
                            setEditingBody("");
                          }}
                        >
                          Cancelar
                        </Button>
                        <Button size="sm" onClick={handleSaveEdit}>
                          Salvar
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <p className="mt-1 text-sm text-slate-700 whitespace-pre-wrap leading-relaxed">
                      {n.body}
                    </p>
                  )}
                </div>
              </div>
            </div>
          );
        })}

        {showLegacy && (
          <div className="rounded-lg border border-slate-200 bg-slate-50/50 p-3">
            <div className="flex items-start gap-3">
              <Avatar className="h-8 w-8 shrink-0">
                <AvatarFallback className="bg-slate-200 text-slate-600">
                  <FileText className="h-4 w-4" />
                </AvatarFallback>
              </Avatar>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-sm font-medium text-slate-900">Sistema</span>
                  <span className="text-[10px] uppercase tracking-wide bg-slate-200 text-slate-700 px-1.5 py-0.5 rounded">
                    Observação importada
                  </span>
                </div>
                <p className="mt-1 text-sm text-slate-700 whitespace-pre-wrap leading-relaxed">
                  {legacyText}
                </p>
              </div>
            </div>
          </div>
        )}
      </div>

      <AlertDialog open={!!deletingId} onOpenChange={(o) => !o && setDeletingId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir observação?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta ação não pode ser desfeita. A observação será removida permanentemente.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleConfirmDelete}
              className="bg-red-600 hover:bg-red-700 text-white"
            >
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
