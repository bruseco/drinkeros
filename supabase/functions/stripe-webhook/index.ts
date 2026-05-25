// Stripe webhook handler for VIP subscription lifecycle.
// Public endpoint (verify_jwt = false) — authenticity is enforced via Stripe signature.

import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@18.5.0?target=deno";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";
import { fireCapiPurchaseFromWebhook } from "../_shared/metaCapi.ts";
import {
  resolveBuyerUser,
  logPurchaseResolutionFailure,
  sendWelcomeRecoveryEmail,
} from "../_shared/resolveBuyerUser.ts";

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
    metadataUserId?: string | null;
  }): Promise<string | null> => {
    // 1) metadata.user_id (preferido — definido no create-checkout)
    if (opts.metadataUserId) {
      const { data: prof } = await supabase
        .from("profiles")
        .select("user_id")
        .eq("user_id", opts.metadataUserId)
        .maybeSingle();
      if (prof?.user_id) return prof.user_id;
      // mesmo sem profile, confia no metadata (foi setado pelo nosso checkout)
      return opts.metadataUserId;
    }
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

  const recordPurchase = async (p: {
    userId: string;
    productId?: string | null;
    productName: string;
    productType: string; // 'club' | 'course' | 'ebook' | 'combo' | 'package'
    amountPaid: number;  // BRL units
    currency: string;
    status: string;      // 'paid' | 'active'
    transactionId: string;
    metadata?: Record<string, unknown>;
  }) => {
    if (!p.transactionId || p.amountPaid <= 0) return;
    const { error } = await supabase.from("purchases").upsert(
      {
        user_id: p.userId,
        product_id: p.productId ?? null,
        product_name: p.productName,
        product_type: p.productType,
        gateway: "stripe",
        amount_paid: p.amountPaid,
        currency: (p.currency || "BRL").toUpperCase(),
        status: p.status,
        transaction_id: p.transactionId,
        metadata: p.metadata || {},
      },
      { onConflict: "gateway,transaction_id" },
    );
    if (error) log("purchases-upsert-error", { error: error.message, transactionId: p.transactionId });

    // Dispara Purchase via Meta Conversions API (server-side, à prova de adblock/ITP)
    await fireCapiPurchaseFromWebhook(supabase, {
      userId: p.userId,
      transactionId: p.transactionId,
      gateway: "stripe",
      amount: p.amountPaid,
      currency: p.currency || "BRL",
      productName: p.productName,
      productType: p.productType,
      productId: p.productId ?? null,
    });
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

          // Busca nome real do produto p/ Meta Pixel
          const { data: prodRow } = await supabase
            .from(productType === "course" ? "courses" : "ebooks")
            .select("name").eq("id", productId).maybeSingle();

          await recordPurchase({
            userId,
            productId,
            productName: (prodRow as any)?.name || (productType === "course" ? "Curso" : "E-book"),
            productType,
            amountPaid: (session.amount_total ?? 0) / 100,
            currency: (session.currency ?? "brl").toUpperCase(),
            status: "paid",
            transactionId: (session.payment_intent as string) || session.id,
            metadata: { session_id: session.id, event_id: event.id },
          });

          break;
        }

        // Caso: Plano Anual à vista (one-time payment, NÃO recorrente)
        // Cobre tanto o legacy "vip_annual_one_time" quanto o novo "club_pix_annual".
        if (
          session.mode === "payment" &&
          (meta.plan_kind === "vip_annual_one_time" || meta.plan_kind === "club_pix_annual")
        ) {
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

          const isClubPix = meta.plan_kind === "club_pix_annual";
          const { error: vipPaymentErr } = await supabase.from("vip_payments").upsert({
            user_id: userId,
            amount: (session.amount_total ?? 0) / 100,
            currency: (session.currency ?? "brl").toUpperCase(),
            status: "paid",
            payment_method: isClubPix ? "pix_annual" : "annual_one_time",
            stripe_customer_id: customerId,
            stripe_payment_intent_id: (session.payment_intent as string) || null,
            paid_at: new Date().toISOString(),
            period_start: new Date().toISOString(),
            period_end: new Date(oneYearFromNow * 1000).toISOString(),
            metadata: { event_id: event.id, session_id: session.id, plan_kind: meta.plan_kind },
          }, { onConflict: "stripe_payment_intent_id" });
          if (vipPaymentErr) log("vip-payments-upsert-error-annual", { error: vipPaymentErr.message, sessionId: session.id });

          await upsertVipPlan(userId, oneYearFromNow);

          await recordPurchase({
            userId,
            productId: null,
            productName: "Clube dos Drinkeros · Anual",
            productType: "club",
            amountPaid: (session.amount_total ?? 0) / 100,
            currency: (session.currency ?? "brl").toUpperCase(),
            status: "paid",
            transactionId: (session.payment_intent as string) || session.id,
            metadata: { plan_kind: meta.plan_kind, session_id: session.id, event_id: event.id },
          });

          break;
        }

        // Caso original: assinatura VIP recorrente (ex.: plan_kind=club_card_subscription)
        // Gate de validação: só processa pagamento válido.
        if (
          session.mode === "subscription" &&
          (session.status !== "complete" || session.payment_status !== "paid")
        ) {
          log("checkout-subscription-not-paid", {
            sessionId: session.id,
            status: session.status,
            payment_status: session.payment_status,
          });
          break;
        }

        const userId = await resolveUserId({
          metadataUserId: meta.user_id,
          customerId,
          email: session.customer_details?.email ?? session.customer_email,
          clientReferenceId: session.client_reference_id,
        });
        if (!userId) {
          log("user-not-found", {
            sessionId: session.id,
            metadataUserId: meta.user_id,
            clientReferenceId: session.client_reference_id,
            email: session.customer_details?.email ?? session.customer_email,
          });
          break;
        }
        log("user-resolved", { userId, sessionId: session.id, plan_kind: meta.plan_kind });

        let periodEnd: number | null = null;
        let periodStart: number | null = null;
        let invoiceId: string | null = null;
        let invoicePaymentIntent: string | null = null;
        let invoiceAmount: number | null = null;
        let invoiceCurrency: string | null = null;
        let invoicePaidAt: number | null = null;

        if (subscriptionId) {
          try {
            const sub = await stripe.subscriptions.retrieve(subscriptionId, {
              expand: ["latest_invoice"],
            });
            periodEnd = sub.current_period_end ?? null;
            periodStart = sub.current_period_start ?? null;

            const latestInvoice = sub.latest_invoice as Stripe.Invoice | null;
            if (latestInvoice && typeof latestInvoice === "object") {
              invoiceId = latestInvoice.id ?? null;
              invoicePaymentIntent = (latestInvoice.payment_intent as string) || null;
              invoiceAmount = latestInvoice.amount_paid ?? null;
              invoiceCurrency = latestInvoice.currency ?? null;
              invoicePaidAt = latestInvoice.status_transitions?.paid_at ?? null;
            }
          } catch (e) {
            log("stripe-subscription-retrieve-error", {
              error: (e as Error).message,
              subscriptionId,
              sessionId: session.id,
            });
          }
        }

        // Fallback: usa o invoice direto da session se não conseguimos pela subscription
        if (!invoiceId && (session as any).invoice) {
          invoiceId = (session as any).invoice as string;
        }

        // Idempotência: se já gravamos esse event_id, não duplica.
        const { data: existingEvt } = await supabase
          .from("vip_payments")
          .select("id")
          .eq("metadata->>event_id", event.id)
          .maybeSingle();

        // Reset de lembretes ao renovar/ativar
        await supabase.from("vip_renewal_reminders_sent").delete().eq("user_id", userId);

        if (!existingEvt) {
          const vipPayload = {
            user_id: userId,
            amount: (invoiceAmount ?? session.amount_total ?? 0) / 100,
            currency: (invoiceCurrency ?? session.currency ?? "brl").toUpperCase(),
            status: "paid",
            payment_method: "card",
            stripe_customer_id: customerId,
            stripe_subscription_id: subscriptionId,
            stripe_invoice_id: invoiceId,
            stripe_payment_intent_id:
              invoicePaymentIntent || ((session.payment_intent as string) || null),
            paid_at: new Date((invoicePaidAt ?? Math.floor(Date.now() / 1000)) * 1000).toISOString(),
            period_start: periodStart
              ? new Date(periodStart * 1000).toISOString()
              : new Date().toISOString(),
            period_end: periodEnd ? new Date(periodEnd * 1000).toISOString() : null,
            metadata: {
              event_id: event.id,
              session_id: session.id,
              plan_kind: meta.plan_kind || null,
              customer_email:
                session.customer_details?.email ?? session.customer_email ?? null,
              recorded_from: "checkout.session.completed",
            },
          };

          // Upsert idempotente: usa stripe_invoice_id quando existir, senão subscription_id, senão payment_intent_id.
          const onConflict = invoiceId
            ? "stripe_invoice_id"
            : (vipPayload.stripe_payment_intent_id ? "stripe_payment_intent_id" : undefined);

          let upsertErr: any = null;
          if (onConflict) {
            const { error } = await supabase
              .from("vip_payments")
              .upsert(vipPayload, { onConflict });
            upsertErr = error;
          } else {
            const { error } = await supabase.from("vip_payments").insert(vipPayload);
            upsertErr = error;
          }

          if (upsertErr) {
            log("vip-payments-upsert-error-checkout", {
              error: upsertErr.message,
              code: upsertErr.code,
              details: upsertErr.details,
              hint: upsertErr.hint,
              userId,
              sessionId: session.id,
              invoiceId,
              subscriptionId,
              payload: vipPayload,
            });
          } else {
            log("vip-payments-recorded", { userId, invoiceId, subscriptionId, sessionId: session.id });
          }
        } else {
          log("vip-payments-already-recorded", { eventId: event.id, sessionId: session.id });
        }

        await upsertVipPlan(userId, periodEnd);

        await recordPurchase({
          userId,
          productId: null,
          productName: "Clube dos Drinkeros",
          productType: "club",
          amountPaid: (invoiceAmount ?? session.amount_total ?? 0) / 100,
          currency: (invoiceCurrency ?? session.currency ?? "brl").toUpperCase(),
          status: "paid",
          transactionId: invoiceId || subscriptionId || session.id,
          metadata: {
            subscription_id: subscriptionId,
            session_id: session.id,
            event_id: event.id,
            plan_kind: meta.plan_kind || null,
          },
        });
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

        const { error: vipPaymentErr } = await supabase.from("vip_payments").upsert({
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
        if (vipPaymentErr) log("vip-payments-upsert-error-invoice", { error: vipPaymentErr.message, invoiceId: invoice.id });

        // Reset lembretes ao renovar
        await supabase.from("vip_renewal_reminders_sent").delete().eq("user_id", userId);

        await upsertVipPlan(userId, periodEnd);

        await recordPurchase({
          userId,
          productId: null,
          productName: "Clube dos Drinkeros",
          productType: "club",
          amountPaid: (invoice.amount_paid ?? 0) / 100,
          currency: (invoice.currency ?? "brl").toUpperCase(),
          status: "paid",
          transactionId: invoice.id,
          metadata: { subscription_id: subscriptionId, event_id: event.id },
        });
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

        // Bloqueia acesso imediatamente: expira o plano agora.
        const { error: expireErr } = await supabase
          .from("user_plans")
          .update({ expires_at: new Date().toISOString() })
          .eq("user_id", userId);
        if (expireErr) log("expire-on-failed-error", expireErr);

        // Avisa o cliente por e-mail (template clube-payment-failed).
        try {
          const recipient = invoice.customer_email
            || (await supabase.from("profiles").select("email,full_name").eq("user_id", userId).maybeSingle()).data?.email;
          const profile = (await supabase.from("profiles").select("full_name").eq("user_id", userId).maybeSingle()).data;
          if (recipient) {
            await supabase.functions.invoke("send-transactional-email", {
              body: {
                templateName: "clube-payment-failed",
                recipientEmail: recipient,
                templateData: { userName: profile?.full_name?.split(" ")[0] || "" },
              },
            });
          }
        } catch (e) {
          log("payment-failed-email-error", { error: (e as Error).message });
        }
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
