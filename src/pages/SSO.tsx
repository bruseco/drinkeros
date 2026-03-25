import { useEffect, useState } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";

const SSO = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const rawEmail = searchParams.get("email");
    const ts = searchParams.get("ts");
    const token = searchParams.get("token");
    // Ensure email is fully decoded (in case of double-encoding from WordPress)
    const email = rawEmail ? decodeURIComponent(rawEmail) : null;

    if (!email || !ts || !token) {
      setError("Link inválido. Parâmetros ausentes.");
      return;
    }

    const verify = async () => {
      try {
        const { data, error: fnError } = await supabase.functions.invoke("sso-verify", {
          body: { email, ts, token },
        });

        if (fnError || !data?.action_link) {
          setError(data?.error || "Erro ao verificar autenticação. Tente fazer login manualmente.");
          return;
        }

        // Redirect to the magic link action_link which will authenticate and redirect to /app
        window.location.href = data.action_link;
      } catch (err) {
        console.error("SSO error:", err);
        setError("Erro de conexão. Tente novamente.");
      }
    };

    verify();
  }, [searchParams]);

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <div className="text-center max-w-md space-y-4">
          <h1 className="text-xl font-bold text-foreground">Erro de autenticação</h1>
          <p className="text-muted-foreground">{error}</p>
          <Button onClick={() => navigate("/login")} className="mt-4">
            Ir para o login
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <div className="text-center space-y-4">
        <Loader2 className="h-8 w-8 animate-spin mx-auto text-primary" />
        <p className="text-muted-foreground">Autenticando...</p>
      </div>
    </div>
  );
};

export default SSO;
