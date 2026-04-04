import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

serve(async (req: Request) => {
  try {
    const url = new URL(req.url);
    const token = url.searchParams.get("token");

    if (!token) {
      return new Response(htmlPage("Token inválido", "Não foi possível processar sua solicitação. Link inválido."), {
        status: 400,
        headers: { "Content-Type": "text/html; charset=utf-8" },
      });
    }

    let userId: string;
    try {
      const decoded = JSON.parse(atob(token));
      userId = decoded.userId;
      if (!userId) throw new Error("Missing userId");
    } catch {
      return new Response(htmlPage("Token inválido", "Não foi possível processar sua solicitação. Link inválido."), {
        status: 400,
        headers: { "Content-Type": "text/html; charset=utf-8" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Insert unsubscribe record (ignore conflict if already unsubscribed)
    await supabase
      .from("upsell_unsubscribes")
      .upsert({ user_id: userId, unsubscribed_at: new Date().toISOString() }, { onConflict: "user_id" });

    // Cancel all active sequences for this user
    await supabase
      .from("upsell_sequences")
      .update({ status: "cancelled", updated_at: new Date().toISOString() })
      .eq("user_id", userId)
      .eq("status", "active");

    console.log(`User ${userId} unsubscribed from upsell emails`);

    return new Response(
      htmlPage(
        "Descadastramento confirmado",
        "Você foi descadastrado com sucesso das nossas ofertas promocionais. Você não receberá mais esses emails.<br/><br/>Se isso foi um engano, entre em contato conosco."
      ),
      { status: 200, headers: { "Content-Type": "text/html; charset=utf-8" } }
    );
  } catch (error: any) {
    console.error("Error in upsell-unsubscribe:", error);
    return new Response(
      htmlPage("Erro", "Ocorreu um erro ao processar sua solicitação. Tente novamente mais tarde."),
      { status: 500, headers: { "Content-Type": "text/html; charset=utf-8" } }
    );
  }
});

function htmlPage(title: string, message: string): string {
  return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title} - Drinkeros</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; display: flex; justify-content: center; align-items: center; min-height: 100vh; margin: 0; background: #f9fafb; color: #1f2937; }
    .container { text-align: center; padding: 2rem; max-width: 500px; }
    h1 { font-size: 1.5rem; margin-bottom: 1rem; color: #111827; }
    p { font-size: 1rem; color: #6b7280; line-height: 1.6; }
  </style>
</head>
<body>
  <div class="container">
    <h1>${title}</h1>
    <p>${message}</p>
  </div>
</body>
</html>`;
}
