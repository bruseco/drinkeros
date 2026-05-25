// Edge function pública que recebe disparos de eventos Meta CAPI vindos do client
// (Lead, CompleteRegistration, InitiateCheckout, ViewContent, Subscribe).
// O client envia o MESMO event_id que usou no fbq('track', ..., { eventID }),
// garantindo deduplicação no Gerenciador de Eventos da Meta.
//
// Purchase NÃO é aceito aqui — esse evento é disparado apenas por webhooks
// server-to-server (Stripe / Mercado Pago) via fireCapiPurchaseFromWebhook.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { z } from "https://esm.sh/zod@3.23.8";
import { sendMetaCapiEvent } from "../_shared/metaCapi.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const BodySchema = z.object({
  event_name: z.enum([
    "Lead",
    "CompleteRegistration",
    "InitiateCheckout",
    "ViewContent",
    "Subscribe",
  ]),
  event_id: z.string().min(8).max(200),
  event_source_url: z.string().url().optional().nullable(),
  custom_data: z.record(z.any()).optional(),
  user_data: z
    .object({
      email: z.string().email().optional().nullable(),
      phone: z.string().optional().nullable(),
      fbp: z.string().optional().nullable(),
      fbc: z.string().optional().nullable(),
    })
    .optional(),
});

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "method_not_allowed" }), {
      status: 405,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    const raw = await req.json().catch(() => null);
    const parsed = BodySchema.safeParse(raw);
    if (!parsed.success) {
      return new Response(JSON.stringify({ error: parsed.error.flatten() }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const b = parsed.data;

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    // Identidade opcional (usuário logado enriquece user_data automaticamente)
    let userId: string | null = null;
    let profile: { email?: string | null; full_name?: string | null; phone?: string | null } | null = null;
    const authHeader = req.headers.get("Authorization");
    if (authHeader?.startsWith("Bearer ")) {
      const token = authHeader.replace("Bearer ", "");
      const { data: u } = await supabase.auth.getUser(token);
      if (u?.user) {
        userId = u.user.id;
        const { data: p } = await supabase
          .from("profiles")
          .select("email, full_name, phone")
          .eq("user_id", userId)
          .maybeSingle();
        profile = p ?? null;
      }
    }

    // Pixel + token vêm de tracking_settings (mesmo padrão do Purchase)
    const { data: ts } = await supabase
      .from("tracking_settings")
      .select("facebook_pixel_id, facebook_pixel_enabled, meta_capi_access_token, meta_test_event_code")
      .limit(1)
      .maybeSingle();

    if (!ts?.facebook_pixel_enabled || !ts?.facebook_pixel_id) {
      return new Response(JSON.stringify({ skipped: "pixel_disabled" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const accessToken = ts.meta_capi_access_token || Deno.env.get("META_CAPI_ACCESS_TOKEN");
    if (!accessToken) {
      return new Response(JSON.stringify({ skipped: "no_token" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const fwd = req.headers.get("x-forwarded-for") || "";
    const clientIp = fwd.split(",")[0]?.trim() || req.headers.get("cf-connecting-ip") || undefined;
    const clientUserAgent = req.headers.get("user-agent") || undefined;

    const result = await sendMetaCapiEvent({
      pixelId: ts.facebook_pixel_id,
      accessToken,
      testEventCode: ts.meta_test_event_code || null,
      eventName: b.event_name,
      eventId: b.event_id,
      eventSourceUrl: b.event_source_url ?? null,
      customData: b.custom_data,
      user: {
        email: b.user_data?.email || profile?.email || null,
        phone: b.user_data?.phone || profile?.phone || null,
        fullName: profile?.full_name || null,
        externalId: userId,
        fbp: b.user_data?.fbp || null,
        fbc: b.user_data?.fbc || null,
        clientIp,
        clientUserAgent,
      },
    });

    return new Response(JSON.stringify({ ok: result.ok, event_id: b.event_id }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("[meta-capi-track] exception", (e as Error).message);
    return new Response(JSON.stringify({ error: (e as Error).message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
