import { useEffect, useState } from "react";
import { useNavigate, useSearchParams, Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2, CheckCircle2, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import drinkerosLogo from "@/assets/logotipo-drinkeros.png";
import SeoHead from "@/components/SeoHead";

export default function CreateAccount() {
  const [params] = useSearchParams();
  const navigate = useNavigate();

  const paymentId = params.get("pid") || "";
  const [email, setEmail] = useState((params.get("email") || "").toLowerCase());
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);

  // Já logado? vai direto para o app.
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) navigate("/app", { replace: true });
    });
  }, [navigate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      toast.error("Informe um e-mail válido");
      return;
    }
    if (password.length < 6) {
      toast.error("A senha deve ter pelo menos 6 caracteres");
      return;
    }
    if (password !== confirm) {
      toast.error("As senhas não coincidem");
      return;
    }

    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("activate-purchase-account", {
        body: { payment_id: paymentId, email: email.trim().toLowerCase(), password },
      });

      let serverMsg = "";
      let code = "";
      if (error) {
        try {
          const ctx: any = (error as any).context;
          const body = ctx && typeof ctx.json === "function" ? await ctx.json() : null;
          serverMsg = body?.error || "";
          code = body?.code || "";
        } catch { /* ignore */ }
      }
      if (data?.error) {
        serverMsg = data.error;
        code = data.code || "";
      }

      if (serverMsg || error) {
        if (code === "already_active") {
          toast.info(serverMsg);
          navigate(`/login?email=${encodeURIComponent(email.trim().toLowerCase())}`);
          return;
        }
        throw new Error(serverMsg || "Não foi possível criar sua conta. Tente novamente.");
      }

      const { error: signInError } = await supabase.auth.signInWithPassword({
        email: email.trim().toLowerCase(),
        password,
      });
      if (signInError) {
        toast.success("Senha definida! Faça login para entrar.");
        navigate(`/login?email=${encodeURIComponent(email.trim().toLowerCase())}`);
        return;
      }

      setDone(true);
      toast.success("Conta criada! Bem-vindo(a) à Drinkeros 🎉");
      setTimeout(() => navigate("/app", { replace: true }), 800);
    } catch (err: any) {
      toast.error("Erro ao criar conta", { description: err?.message });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-black text-white flex flex-col items-center justify-center px-4 py-10">
      <SeoHead
        title="Crie sua conta | Drinkeros"
        description="Defina sua senha e acesse agora o app da Drinkeros com sua compra liberada."
      />
      <img src={drinkerosLogo} alt="Drinkeros" className="h-9 w-auto mb-6 opacity-90" />

      <div className="w-full max-w-md rounded-2xl border border-white/10 bg-white/5 p-6">
        {done ? (
          <div className="text-center py-6">
            <CheckCircle2 className="w-12 h-12 text-green-500 mx-auto mb-3" />
            <h1 className="text-lg font-semibold mb-1">Tudo pronto!</h1>
            <p className="text-sm text-white/70">Entrando no app...</p>
          </div>
        ) : (
          <>
            <h1 className="text-2xl font-semibold mb-1">Crie sua conta agora</h1>
            <p className="text-sm text-white/60 mb-6">
              Sua compra foi confirmada. Defina uma senha para acessar o app.
            </p>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="email">Seu e-mail</Label>
                <Input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  autoComplete="email"
                  className="bg-black/40 border-white/15"
                  required
                />
                <p className="text-[11px] text-white/45">
                  Use o mesmo e-mail da compra. Você pode corrigi-lo se tiver errado.
                </p>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="password">Senha</Label>
                <Input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  autoComplete="new-password"
                  placeholder="Mínimo 6 caracteres"
                  className="bg-black/40 border-white/15"
                  required
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="confirm">Confirmar senha</Label>
                <Input
                  id="confirm"
                  type="password"
                  value={confirm}
                  onChange={(e) => setConfirm(e.target.value)}
                  autoComplete="new-password"
                  className="bg-black/40 border-white/15"
                  required
                />
              </div>

              <Button type="submit" disabled={loading} className="w-full h-11 text-base">
                {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : "Criar conta e entrar"}
              </Button>
            </form>

            <div className="mt-5 flex items-start gap-2 text-xs text-white/45">
              <ShieldCheck className="w-4 h-4 text-green-500 shrink-0 mt-0.5" />
              <p>
                Já tem conta?{" "}
                <Link to="/login" className="underline hover:text-white">
                  Fazer login
                </Link>
              </p>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
