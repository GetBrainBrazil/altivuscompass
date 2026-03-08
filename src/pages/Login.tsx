import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import logoAltivusLogin from "@/assets/logo-altivus-login.jpg";

function ForgotPasswordDialog() {
  const { toast } = useToast();
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
      redirectTo: `${window.location.origin}/reset-password`,
    });
    setLoading(false);
    if (error) {
      toast({ title: "Erro", description: error.message, variant: "destructive" });
      return;
    }
    toast({ title: "E-mail enviado!", description: "Verifique sua caixa de entrada para redefinir a senha." });
    setOpen(false);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <button type="button" className="w-full text-center text-sm text-primary hover:underline font-body">
          Esqueci minha senha
        </button>
      </DialogTrigger>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle className="font-display">Recuperar Senha</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label className="font-body">E-mail cadastrado</Label>
            <Input type="email" placeholder="seu@email.com" value={email} onChange={(e) => setEmail(e.target.value)} required />
          </div>
          <Button type="submit" className="w-full font-body" disabled={loading}>
            {loading ? "Enviando..." : "Enviar link de recuperação"}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function generateCaptcha() {
  const a = Math.floor(Math.random() * 20) + 1;
  const b = Math.floor(Math.random() * 10) + 1;
  return { question: `${a} + ${b} = ?`, answer: String(a + b) };
}

export default function Login() {
  const navigate = useNavigate();
  const { session } = useAuth();
  const { toast } = useToast();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [captcha, setCaptcha] = useState(generateCaptcha);
  const [captchaInput, setCaptchaInput] = useState("");

  useEffect(() => {
    if (session) navigate("/", { replace: true });
  }, [session, navigate]);

  const refreshCaptcha = useCallback(() => {
    setCaptcha(generateCaptcha());
    setCaptchaInput("");
  }, []);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (captchaInput.trim() !== captcha.answer) {
      toast({ title: "Captcha incorreto", description: "Por favor, resolva a conta corretamente.", variant: "destructive" });
      refreshCaptcha();
      return;
    }
    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
    setLoading(false);
    if (error) {
      toast({ title: "Erro ao entrar", description: "E-mail ou senha inválidos.", variant: "destructive" });
      refreshCaptcha();
      return;
    }
    navigate("/", { replace: true });
  };

  return (
    <div className="min-h-screen flex items-center justify-center px-4" style={{ backgroundColor: '#e8e6e3' }}>
      <div className="w-full max-w-sm space-y-6 sm:space-y-8">
        <div className="flex flex-col items-center gap-3 sm:gap-4">
          <img src={logoAltivusLogin} alt="Altivus Turismo" className="h-16 sm:h-20 object-contain" />
          <p className="text-sm text-muted-foreground font-body">Entre com suas credenciais</p>
        </div>

        <form onSubmit={handleLogin} className="space-y-4 sm:space-y-5">
          <div className="space-y-2">
            <Label htmlFor="email" className="font-body">E-mail</Label>
            <Input id="email" type="email" placeholder="seu@email.com" value={email} onChange={(e) => setEmail(e.target.value)} required autoComplete="email" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="password" className="font-body">Senha</Label>
            <Input id="password" type="password" placeholder="••••••••" value={password} onChange={(e) => setPassword(e.target.value)} required autoComplete="current-password" />
          </div>
          <div className="space-y-2">
            <Label className="font-body">Verificação de segurança</Label>
            <div className="flex items-center gap-3">
              <div className="flex-1 flex items-center gap-2 px-3 py-2 rounded-md bg-muted text-sm font-mono font-semibold text-foreground select-none tracking-widest">
                {captcha.question}
              </div>
              <button type="button" onClick={refreshCaptcha} className="p-2 rounded-md hover:bg-muted transition-colors text-muted-foreground" title="Novo captcha">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 2v6h-6"/><path d="M3 12a9 9 0 0 1 15-6.7L21 8"/><path d="M3 22v-6h6"/><path d="M21 12a9 9 0 0 1-15 6.7L3 16"/></svg>
              </button>
            </div>
            <Input placeholder="Sua resposta" value={captchaInput} onChange={(e) => setCaptchaInput(e.target.value)} required autoComplete="off" />
          </div>
          <Button type="submit" className="w-full font-body" disabled={loading}>
            {loading ? "Entrando..." : "Entrar"}
          </Button>
        </form>

        <ForgotPasswordDialog />

        <p className="text-center text-xs text-muted-foreground font-body">
          Acesso restrito a usuários autorizados.
        </p>
      </div>
    </div>
  );
}
