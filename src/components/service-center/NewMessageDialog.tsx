import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { IntlPhoneInput } from "@/components/ui/intl-phone-input";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { SendHorizontal, MessageSquarePlus } from "lucide-react";

interface NewMessageDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSent?: (phone: string) => void;
}

export function NewMessageDialog({ open, onOpenChange, onSent }: NewMessageDialogProps) {
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [message, setMessage] = useState("");
  const [sending, setSending] = useState(false);

  const handleSend = async () => {
    const cleanPhone = phone.replace(/\D/g, "");
    if (cleanPhone.length < 10) {
      toast.error("Informe um telefone válido com DDI e DDD.");
      return;
    }
    if (!message.trim()) {
      toast.error("Digite uma mensagem.");
      return;
    }
    setSending(true);
    try {
      const { data, error } = await supabase.functions.invoke("send-whatsapp", {
        body: {
          action: "send-text",
          phone: cleanPhone,
          message: message.trim(),
          contact_name: name.trim() || undefined,
        },
      });
      if (error) throw error;
      if ((data as any)?.error) throw new Error((data as any).error);
      toast.success("Mensagem enviada com sucesso.");
      setMessage("");
      setPhone("");
      setName("");
      onOpenChange(false);
      onSent?.(cleanPhone);
    } catch (err: any) {
      toast.error(err?.message || "Falha ao enviar mensagem.");
    } finally {
      setSending(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !sending && onOpenChange(v)}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <MessageSquarePlus className="h-5 w-5 text-[hsl(var(--navy))]" />
            Nova mensagem
          </DialogTitle>
          <DialogDescription>
            Envie uma mensagem manual para qualquer número via WhatsApp. Uma nova conversa será criada na Central.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="space-y-2">
            <Label htmlFor="new-msg-phone">Telefone do destinatário</Label>
            <IntlPhoneInput
              id="new-msg-phone"
              value={phone}
              onChange={setPhone}
              placeholder="(11) 99999-9999"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="new-msg-text">Mensagem</Label>
            <Textarea
              id="new-msg-text"
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="Escreva a mensagem que será enviada..."
              rows={6}
              className="resize-none"
              disabled={sending}
            />
            <p className="text-[11px] text-muted-foreground">
              A IA ficará pausada para esta conversa após o envio manual.
            </p>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={sending}>
            Cancelar
          </Button>
          <Button
            onClick={handleSend}
            disabled={sending || !phone || !message.trim()}
            className="gap-2 bg-[hsl(var(--navy))] text-[hsl(var(--cream))] hover:bg-[hsl(var(--navy))]/90"
          >
            <SendHorizontal className="h-4 w-4" />
            {sending ? "Enviando..." : "Enviar mensagem"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
