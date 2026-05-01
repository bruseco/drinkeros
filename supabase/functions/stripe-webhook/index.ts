// Stripe webhook handler for VIP subscription lifecycle.
// Public endpoint (verify_jwt = false) — authenticity is enforced via Stripe signature.

import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@18.5.0?target=deno";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";

const log = (step: string, details?: unknown) => {
  console.log(`[stripe-webhook] ${step}${details ? " — " + JSON.stringify(details) : ""}`);
};

serve(async (req) => {
  if (req.method !== "POST") {
    return new Response("Method not allowed", { status: 405 });
  }

  const stripeKey = Deno.env.get("STRIPE_SECRET_KEY");
  const webhookSecret = Deno.env.get("STRIPE_WEBHOOK_SECRET");
  if (!stripeKey || !webhookSecret) {
    log("missing-env", { hasKey: !!stripeKey, hasWh: !!webhookSecret });
    return new Response("Server not configured", { status: 500 });
  }

  const stripe = new Stripe(stripeKey, { apiVersion: "2025-08-27.basil" });

  const sig = req.headers.get("stripe-signature");
  if (!sig) return new Response("Missing signature", { status: 400 });

  const rawBody = await req.text();
  let event: Stripe.Event;
  try {
    event = await stripe.webhooks.constructEventAsync(rawBody, sig, webhookSecret);
  } catch (err) {
    log("invalid-signature", { error: (err as Error).message });
    return new Response(`Webhook Error: ${(err as Error).message}`, { status: 400 });
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    { auth: { persistSession: false } },
  );

  // Resolve user_id from a Stripe customer / session
  const resolveUserId = async (opts: {
    customerId?: string | null;
    email?: string | null;
    clientReferenceId?: string | null;
  }): Promise<string | null> => {
    if (opts.clientReferenceId) return opts.clientReferenceId;

    if (opts.customerId) {
      const { data } = await supabase
        .from("vip_payments")
        .select("user_id")
        .eq("stripe_customer_id", opts.customerId)
        .limit(1)
        .maybeSingle();
      if (data?.user_id) return data.user_id;
    }

    if (opts.email) {
      const { data } = await supabase
        .from("profiles")
        .select("user_id")
        .eq("email", opts.email.toLowerCase())
        .maybeSingle();
      if (data?.user_id) return data.user_id;
    }

    return null;
  };

  const upsertVipPlan = async (userId: string, periodEndUnix?: number | null) => {
    const expiresAt = periodEndUnix
      ? new Date(periodEndUnix * 1000).toISOString()
      : new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString();

    const { error } = await supabase
      .from("user_plans")
      .upsert(
        {
          user_id: userId,
          plan: "vip",
          source: "stripe",
          activated_at: new Date().toISOString(),
          expires_at: expiresAt,
        },
        { onConflict: "user_id" },
      );
    if (error) log("user_plans-upsert-error", error);
  };

  try {
    log("event", { type: event.type, id: event.id });

    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object as Stripe.Checkout.Session;
        const customerId = (session.customer as string) || null;
        const subscriptionId = (session.subscription as string) || null;
        const meta = (session.metadata || {}) as Record<string, string>;

        // Caso: compra de curso ou ebook (mode=payment, metadata.product_type)
        if (session.mode === "payment" && (meta.product_type === "course" || meta.product_type === "ebook")) {
          const productType = meta.product_type;
          const productId = meta.product_id;
          if (!productId) { log("missing-product-id", { sessionId: session.id }); break; }

          const email = session.customer_details?.email ?? session.customer_email ?? null;

          // Resolve user_id (logged-in via client_reference_id, ou via email, ou cria conta)
          let userId: string | null = await resolveUserId({
            customerId,
            email,
            clientReferenceId: session.client_reference_id,
          });

          if (!userId && email) {
            // Cria conta automaticamente
            const { data: created, error: createErr } = await supabase.auth.admin.createUser({
              email: email.toLowerCase(),
              email_confirm: true,
              user_metadata: { full_name: session.customer_details?.name || "" },
            });
            if (createErr) {
              log("auto-create-user-error", { error: createErr.message, email });
            } else if (created.user) {
              userId = created.user.id;
              log("auto-created-user", { userId, email });
            }
          }

          if (!userId) {
            log("user-not-found-product-purchase", { sessionId: session.id, email });
            break;
          }

          const targetTable = productType === "course" ? "user_courses" : "user_ebooks";
          const idCol = productType === "course" ? "course_id" : "ebook_id";

          const { error: grantErr } = await supabase
            .from(targetTable)
            .upsert(
              {
                user_id: userId,
                [idCol]: productId,
                source: "stripe",
                purchased_at: new Date().toISOString(),
                amount: (session.amount_total ?? 0) / 100,
                currency: (session.currency ?? "brl").toUpperCase(),
                stripe_session_id: session.id,
                stripe_payment_intent_id: (session.payment_intent as string) || null,
              },
              { onConflict: `user_id,${idCol}` },
            );
          if (grantErr) log("grant-access-error", { error: grantErr.message, productType, productId });

          break;
        }

        // Caso: Plano Anual à vista (one-time payment, NÃO recorrente)
        // Concede 1 ano de VIP e registra em vip_payments.
        if (session.mode === "payment" && meta.plan_kind === "vip_annual_one_time") {
          const email = session.customer_details?.email ?? session.customer_email ?? null;
          let userId: string | null = await resolveUserId({
            customerId,
            email,
            clientReferenceId: session.client_reference_id,
          });

          if (!userId && email) {
            const { data: created, error: createErr } = await supabase.auth.admin.createUser({
              email: email.toLowerCase(),
              email_confirm: true,
              user_metadata: { full_name: session.customer_details?.name || "" },
            });
            if (createErr) log("auto-create-user-error-annual", { error: createErr.message, email });
            else if (created.user) userId = created.user.id;
          }

          if (!userId) { log("user-not-found-annual", { sessionId: session.id }); break; }

          // 1 ano a partir de agora
          const oneYearFromNow = Math.floor(Date.now() / 1000) + 365 * 24 * 60 * 60;

          // Reset de lembretes do ciclo anterior (vai entrar em ciclo novo)
          await supabase.from("vip_renewal_reminders_sent").delete().eq("user_id", userId);

          await supabase.from("vip_payments").upsert({
            user_id: userId,
            amount: (session.amount_total ?? 0) / 100,
            currency: (session.currency ?? "brl").toUpperCase(),
            status: "paid",
            payment_method: "annual_one_time",
            stripe_customer_id: customerId,
            stripe_payment_intent_id: (session.payment_intent as string) || null,
            paid_at: new Date().toISOString(),
            period_start: new Date().toISOString(),
            period_end: new Date(oneYearFromNow * 1000).toISOString(),
            metadata: { event_id: event.id, session_id: session.id, plan_kind: "vip_annual_one_time" },
          }, { onConflict: "stripe_payment_intent_id" });

          await upsertVipPlan(userId, oneYearFromNow);
          break;
        }

        // Caso original: assinatura VIP recorrente
        const userId = await resolveUserId({
          customerId,
          email: session.customer_details?.email ?? session.customer_email,
          clientReferenceId: session.client_reference_id,
        });
        if (!userId) {
          log("user-not-found", { sessionId: session.id });
          break;
        }

        let periodEnd: number | null = null;
        if (subscriptionId) {
          const sub = await stripe.subscriptions.retrieve(subscriptionId);
          periodEnd = sub.current_period_end ?? null;
        }

        // Reset de lembretes ao renovar/ativar
        await supabase.from("vip_renewal_reminders_sent").delete().eq("user_id", userId);

        // A venda real da assinatura é registrada em invoice.paid.
        // checkout.session.completed só libera/atualiza o acesso para evitar duplicar Vendas.
        await upsertVipPlan(userId, periodEnd);
        break;
      }


      case "invoice.paid": {
        const invoice = event.data.object as Stripe.Invoice;
        const customerId = invoice.customer as string;
        const subscriptionId = (invoice.subscription as string) || null;

        const userId = await resolveUserId({
          customerId,
          email: invoice.customer_email,
        });
        if (!userId) {
          log("user-not-found-invoice", { invoiceId: invoice.id });
          break;
        }

        let periodEnd: number | null = invoice.lines.data[0]?.period?.end ?? null;
        if (!periodEnd && subscriptionId) {
          const sub = await stripe.subscriptions.retrieve(subscriptionId);
          periodEnd = sub.current_period_end ?? null;
        }

        await supabase.from("vip_payments").upsert({
          user_id: userId,
          amount: (invoice.amount_paid ?? 0) / 100,
          currency: (invoice.currency ?? "brl").toUpperCase(),
          status: "paid",
          payment_method: "card",
          stripe_customer_id: customerId,
          stripe_subscription_id: subscriptionId,
          stripe_invoice_id: invoice.id,
          stripe_payment_intent_id: ((invoice as any).payment_intent as string) || null,
          paid_at: new Date((invoice.status_transitions?.paid_at ?? Math.floor(Date.now() / 1000)) * 1000).toISOString(),
          period_start: invoice.lines.data[0]?.period?.start
            ? new Date(invoice.lines.data[0].period.start * 1000).toISOString()
            : null,
          period_end: periodEnd ? new Date(periodEnd * 1000).toISOString() : null,
          metadata: { event_id: event.id },
        }, { onConflict: "stripe_invoice_id" });

        // Reset lembretes ao renovar
        await supabase.from("vip_renewal_reminders_sent").delete().eq("user_id", userId);

        await upsertVipPlan(userId, periodEnd);
        break;
      }

      case "invoice.payment_failed": {
        const invoice = event.data.object as Stripe.Invoice;
        const customerId = invoice.customer as string;
        const userId = await resolveUserId({
          customerId,
          email: invoice.customer_email,
        });
        if (!userId) break;

        await supabase.from("vip_payments").insert({
          user_id: userId,
          amount: (invoice.amount_due ?? 0) / 100,
          currency: (invoice.currency ?? "brl").toUpperCase(),
          status: "failed",
          payment_method: "card",
          stripe_customer_id: customerId,
          stripe_subscription_id: (invoice.subscription as string) || null,
          stripe_invoice_id: invoice.id,
          metadata: { event_id: event.id, reason: "payment_failed" },
        });
        break;
      }

      case "customer.subscription.deleted": {
        const sub = event.data.object as Stripe.Subscription;
        const customerId = sub.customer as string;
        const userId = await resolveUserId({ customerId });
        if (!userId) break;

        // Keep access until current expires_at; just record the cancellation.
        await supabase.from("vip_payments").insert({
          user_id: userId,
          amount: 0,
          currency: "BRL",
          status: "cancelled",
          payment_method: "card",
          stripe_customer_id: customerId,
          stripe_subscription_id: sub.id,
          metadata: { event_id: event.id, reason: "subscription_deleted" },
        });
        break;
      }

      default:
        log("ignored-event", { type: event.type });
    }

    return new Response(JSON.stringify({ received: true }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (err) {
    log("handler-error", { error: (err as Error).message });
    return new Response(JSON.stringify({ error: (err as Error).message }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
});
