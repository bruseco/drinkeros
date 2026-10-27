import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";
import {
  allowedQuizProducts,
  cleanQuizAnswers,
  computeProfile,
  PROFILES,
  quizPath,
} from "../_shared/quizRules.ts";
import {
  quizPaymentHash,
  quizTokenHash,
  recordQuizPayment,
  resolveQuizQuote,
} from "../_shared/quizOffer.ts";
const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization,x-client-info,apikey,content-type,x-supabase-client-platform,x-supabase-client-platform-version,x-supabase-client-runtime,x-supabase-client-runtime-version",
};
const json = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data), {
    status,
    headers: {
      ...cors,
      "Content-Type": "application/json",
      "Cache-Control": "no-store",
    },
  });
serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });
  if (req.method !== "POST") return json({ error: "Método inválido" }, 405);
  try {
    const b = await req.json(), hash = await quizTokenHash(b.token);
    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
      { auth: { persistSession: false } },
    );
    if (b.action === "complete") {
      const answers = cleanQuizAnswers(b.answers || {}),
        profile = computeProfile(answers),
        path = quizPath(answers);
      const attribution: Record<string, string> = {};
      for (
        const k of [
          "utm_source",
          "utm_medium",
          "utm_campaign",
          "utm_content",
          "utm_term",
          "fbclid",
        ]
      ) {
        if (typeof b.attribution?.[k] === "string") {
          attribution[k] = b.attribution[k].slice(0, 500);
        }
      }
      const { data, error } = await admin.rpc("quiz_complete", {
        _hash: hash,
        _path: path,
        _product: profile,
        _answers: answers,
        _attribution: attribution,
      });
      if (error) throw error;
      return json({ ok: true, session_id: data });
    }
    if (!Object.hasOwn(PROFILES, b.product)) {
      return json({ error: "Oferta inválida" }, 400);
    }
    const profile = PROFILES[b.product as keyof typeof PROFILES];
    const quote = await resolveQuizQuote(
      admin,
      b.token,
      profile.productType,
      profile.slug,
      undefined,
      b.action === "quote",
    );
    if (b.action === "quote") {
      const alternatives = await Promise.all(
        allowedQuizProducts(quote.recommended, quote.path).filter((p) =>
          p !== profile.id
        ).map(async (p) => {
          const item = PROFILES[p];
          return resolveQuizQuote(admin, b.token, item.productType, item.slug);
        }),
      );
      return json({ ...quote, alternatives });
    }
    if (b.action === "payment-status" || b.action === "retry-payment") {
      const attemptHash = await quizPaymentHash(b.token, profile.id);
      const attempt = await admin.from("quiz_payment_attempts").select("*").eq(
        "token_hash",
        attemptHash,
      ).maybeSingle();
      if (attempt.error) throw attempt.error;
      if (!attempt.data) return json({ status: "none" });
      if (
        b.action === "retry-payment" && attempt.data.status === "failed" &&
        !attempt.data.mp_id
      ) {
        await admin.from("quiz_payment_attempts").delete().eq(
          "token_hash",
          attemptHash,
        ).eq("attempt_id", attempt.data.attempt_id);
        return json({ ok: true });
      }
      const mpToken = Deno.env.get("MERCADOPAGO_ACCESS_TOKEN");
      if (!mpToken) throw Error("Pagamento indisponível");
      const external = attempt.data.external_reference; // Only our server-owned attempt can select a payment.
      const fetchMp = async (path: string) => {
        const r = await fetch(`https://api.mercadopago.com${path}`, {
          headers: { Authorization: `Bearer ${mpToken}` },
          signal: AbortSignal.timeout(10000),
        });
        if (!r.ok) throw Error("Consulta indisponível");
        return r.json();
      };
      let payment: any = attempt.data.mp_id
        ? await fetchMp(
          `/v1/payments/${encodeURIComponent(attempt.data.mp_id)}`,
        )
        : null;
      if (!payment && external) {
        const search = await fetchMp(
          `/v1/payments/search?external_reference=${
            encodeURIComponent(external)
          }`,
        );
        payment = (search.results || []).find((p: any) =>
          p.external_reference === external
        );
      }
      if (!payment) {
        return json({
          status: attempt.data.status === "failed" ? "rejected" : "processing",
        });
      }
      if (payment.external_reference !== external) {
        throw Error("Pagamento inválido");
      }
      if (b.action === "retry-payment") {
        if (!["rejected", "cancelled"].includes(payment.status)) {
          throw Error("Aguarde a confirmação desta tentativa");
        }
        await admin.from("quiz_payment_attempts").delete().eq(
          "token_hash",
          attemptHash,
        ).eq("attempt_id", attempt.data.attempt_id);
        return json({ ok: true });
      }
      await admin.from("quiz_payment_attempts").update({
        mp_id: String(payment.id),
        status: "accepted",
      }).eq("token_hash", attemptHash);
      await recordQuizPayment(
        admin,
        quote,
        "mercado_pago",
        String(payment.id),
        String(payment.metadata?.product_id || "club"),
        Number(payment.transaction_amount),
      );
      if (payment.status === "approved") {
        await fetch(
          `${
            Deno.env.get("SUPABASE_URL")
          }/functions/v1/get-mp-payment-status?id=${
            encodeURIComponent(payment.id)
          }`,
          { headers: { apikey: Deno.env.get("SUPABASE_ANON_KEY")! } },
        );
      }
      return json({
        id: payment.id,
        status: payment.status,
        status_detail: payment.status_detail,
        amount: payment.transaction_amount,
        pix: payment.payment_method_id === "pix"
          ? payment.point_of_interaction?.transaction_data
          : null,
      });
    }
    if (b.action === "capture") {
      const { data, error } = await admin.rpc("quiz_capture_lead", {
        _hash: hash,
        _product: profile.id,
        _name: String(b.name || "").trim(),
        _phone: (() => {
          const p = String(b.phone || "").replace(/\D/g, "");
          return p.length === 10 || p.length === 11 ? "55" + p : p;
        })(),
        _consent: b.consent === true,
      });
      if (error) throw Error("Confira nome, WhatsApp e consentimento.");
      const lead = data[0];
      // Stable ID deduplicates retries and browser/server delivery. Only after a consented CRM write.
      if (!lead.capi_sent_at) {
        const { data: settings } = await admin.from("tracking_settings").select(
          "facebook_pixel_id,facebook_pixel_enabled,meta_test_event_code",
        ).limit(1).maybeSingle();
        const token = Deno.env.get("META_CAPI_ACCESS_TOKEN");
        if (
          settings?.facebook_pixel_enabled && settings.facebook_pixel_id &&
          token
        ) {
          const rawPhone = String(b.phone || "").replace(/\D/g, ""),
            phone = rawPhone.length === 10 || rawPhone.length === 11
              ? "55" + rawPhone
              : rawPhone,
            digest = await crypto.subtle.digest(
              "SHA-256",
              new TextEncoder().encode(phone),
            );
          const ph = Array.from(
            new Uint8Array(digest),
            (n) => n.toString(16).padStart(2, "0"),
          ).join("");
          const response = await fetch(
            `https://graph.facebook.com/v21.0/${settings.facebook_pixel_id}/events`,
            {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                data: [{
                  event_name: "Lead",
                  event_id: lead.event_id,
                  event_time: Math.floor(Date.now() / 1000),
                  action_source: "website",
                  event_source_url: `https://drinkeros.com${profile.path}`,
                  user_data: {
                    ph: [ph],
                    client_user_agent: req.headers.get("user-agent") ||
                      undefined,
                  },
                  custom_data: {
                    content_name: profile.product,
                    content_category: "quiz",
                  },
                }],
                ...(settings.meta_test_event_code
                  ? { test_event_code: settings.meta_test_event_code }
                  : {}),
              }),
              signal: AbortSignal.timeout(8000),
            },
          ).catch(() => null);
          if (response?.ok) {
            await admin.from("quiz_captured_leads").update({
              capi_sent_at: new Date().toISOString(),
            }).eq("event_id", lead.event_id);
          }
        }
      }
      return json({ ok: true, event_id: lead.event_id });
    }
    return json({ error: "Ação inválida" }, 400);
  } catch {
    return json({
      error:
        "Não foi possível validar esta etapa do quiz. Conclua o quiz ou tente novamente.",
    }, 400);
  }
});
