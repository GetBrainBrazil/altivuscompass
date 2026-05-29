import { useState, useEffect, useCallback } from "react";
import { Eye, EyeOff } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable";
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

    // Verify email exists in profiles table
    const { data: profile } = await supabase
      .from("profiles")
      .select("id")
      .eq("email", email.trim())
      .maybeSingle();

    if (!profile) {
      setLoading(false);
      toast({ title: "E-mail não encontrado", description: "Nenhum usuário cadastrado com este e-mail.", variant: "destructive" });
      return;
    }

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
  const [showPassword, setShowPassword] = useState(false);
  const [captcha, setCaptcha] = useState(generateCaptcha);
  const [captchaInput, setCaptchaInput] = useState("");

  useEffect(() => {
    if (!session) return;
    // Validate user is already registered (has profile). Prevents new Google signups.
    (async () => {
      const userId = session.user.id;
      const email = session.user.email;
      const { data: profile } = await supabase
        .from("profiles")
        .select("id")
        .or(`user_id.eq.${userId}${email ? `,email.eq.${email}` : ""}`)
        .maybeSingle();
      if (!profile) {
        await supabase.auth.signOut();
        toast({
          title: "Acesso negado",
          description: "Este e-mail não está cadastrado. Solicite acesso ao administrador.",
          variant: "destructive",
        });
        return;
      }
      navigate("/", { replace: true });
    })();
  }, [session, navigate, toast]);

  const handleGoogleLogin = async () => {
    const result = await lovable.auth.signInWithOAuth("google", {
      redirect_uri: window.location.origin + "/login",
    });
    if (result.error) {
      toast({ title: "Erro ao entrar com Google", description: result.error.message ?? "Tente novamente.", variant: "destructive" });
    }
  };

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
  };

  return (
    <div className="min-h-screen flex items-center justify-center px-4" style={{ backgroundColor: '#e8e6e3' }}>
      <div className="w-full max-w-sm space-y-6 sm:space-y-8">
        <div className="flex flex-col items-center gap-3 sm:gap-4">
          <img src={logoAltivusLogin} alt="Altivus Turismo" className="h-16 sm:h-20 object-contain" />
          <p className="text-sm text-muted-foreground font-body">Entre com suas credenciais</p>
        </div>

        <Button type="button" variant="outline" className="w-full font-body bg-white" onClick={handleGoogleLogin}>
          <svg className="w-4 h-4 mr-2" viewBox="0 0 24 24"><path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/><path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/><path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/><path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/></svg>
          Entrar com Google
        </Button>

        <div className="relative">
          <div className="absolute inset-0 flex items-center">
            <span className="w-full border-t border-border" />
          </div>
          <div className="relative flex justify-center text-xs">
            <span className="px-2 bg-[#e8e6e3] text-muted-foreground font-body">ou</span>
          </div>
        </div>

        <form onSubmit={handleLogin} className="space-y-4 sm:space-y-5">
          <div className="space-y-2">
            <Label htmlFor="email" className="font-body">E-mail</Label>
            <Input id="email" type="email" placeholder="seu@email.com" value={email} onChange={(e) => setEmail(e.target.value)} required autoComplete="email" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="password" className="font-body">Senha</Label>
            <div className="relative">
              <Input id="password" type={showPassword ? "text" : "password"} placeholder="••••••••" value={password} onChange={(e) => setPassword(e.target.value)} required autoComplete="current-password" className="pr-10" />
              <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors">
                {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
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
