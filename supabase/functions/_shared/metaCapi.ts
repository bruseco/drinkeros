// Meta Conversions API (server-side) — envia eventos do Pixel direto pra Meta,
// independente de bloqueador, ITP, ou da aba ter sido fechada após o pagamento.
// Deduplicação com o Pixel client-side é feita via event_id (mesmo ID nos dois lados).

const META_API_VERSION = "v21.0";

async function sha256Hex(input: string): Promise<string> {
  const buf = new TextEncoder().encode(input.trim().toLowerCase());
  const hash = await crypto.subtle.digest("SHA-256", buf);
  return Array.from(new Uint8Array(hash))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

function onlyDigits(s?: string | null): string {
  return (s || "").replace(/\D+/g, "");
}

function splitName(full?: string | null): { fn?: string; ln?: string } {
  if (!full) return {};
  const parts = full.trim().split(/\s+/);
  if (parts.length === 1) return { fn: parts[0] };
  return { fn: parts[0], ln: parts.slice(1).join(" ") };
}

export interface MetaCapiPurchaseInput {
  pixelId: string;
  accessToken: string;
  eventId: string;                    // mesmo ID usado no client (dedupe)
  eventSourceUrl?: string | null;     // URL onde a compra aconteceu
  testEventCode?: string | null;      // opcional p/ Test Events da Meta
  value: number;
  currency: string;                   // 'BRL'
  contentName?: string | null;
  contentType?: string | null;        // 'product' | 'subscription'
  contentIds?: string[] | null;
  orderId?: string | null;
  user: {
    email?: string | null;
    phone?: string | null;            // E.164 sem '+'
    fullName?: string | null;
    externalId?: string | null;       // user_id do nosso DB
    fbp?: string | null;
    fbc?: string | null;
    clientIp?: string | null;
    clientUserAgent?: string | null;
  };
}

export async function sendMetaCapiPurchase(input: MetaCapiPurchaseInput): Promise<void> {
  try {
    if (!input.pixelId || !input.accessToken) {
      console.log("[meta-capi] missing pixelId/accessToken — skip");
      return;
    }

    const { fn, ln } = splitName(input.user.fullName);
    const phoneDigits = onlyDigits(input.user.phone);

    const user_data: Record<string, unknown> = {};
    if (input.user.email)      user_data.em = [await sha256Hex(input.user.email)];
    if (phoneDigits)           user_data.ph = [await sha256Hex(phoneDigits)];
    if (fn)                    user_data.fn = [await sha256Hex(fn)];
    if (ln)                    user_data.ln = [await sha256Hex(ln)];
    if (input.user.externalId) user_data.external_id = [await sha256Hex(input.user.externalId)];
    if (input.user.fbp)        user_data.fbp = input.user.fbp;
    if (input.user.fbc)        user_data.fbc = input.user.fbc;
    if (input.user.clientIp)   user_data.client_ip_address = input.user.clientIp;
    if (input.user.clientUserAgent) user_data.client_user_agent = input.user.clientUserAgent;

    const custom_data: Record<string, unknown> = {
      value: Number(input.value),
      currency: (input.currency || "BRL").toUpperCase(),
    };
    if (input.contentName) custom_data.content_name = input.contentName;
    if (input.contentType) custom_data.content_type = input.contentType;
    if (input.contentIds?.length) custom_data.content_ids = input.contentIds;
    if (input.orderId) custom_data.order_id = input.orderId;

    const body: Record<string, unknown> = {
      data: [
        {
          event_name: "Purchase",
          event_time: Math.floor(Date.now() / 1000),
          event_id: input.eventId,
          action_source: "website",
          event_source_url: input.eventSourceUrl || undefined,
          user_data,
          custom_data,
        },
      ],
    };
    if (input.testEventCode) body.test_event_code = input.testEventCode;

    const url = `https://graph.facebook.com/${META_API_VERSION}/${input.pixelId}/events?access_token=${encodeURIComponent(input.accessToken)}`;
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) {
      console.error("[meta-capi] FAILED", { status: res.status, json, eventId: input.eventId });
    } else {
      console.log("[meta-capi] sent Purchase", { eventId: input.eventId, json });
    }
  } catch (e) {
    console.error("[meta-capi] exception", (e as Error).message);
  }
}

/**
 * Resolve pixelId + accessToken + dados do usuário e dispara Purchase via CAPI.
 * Chame imediatamente após gravar a compra no webhook.
 */
export async function fireCapiPurchaseFromWebhook(supabase: any, args: {
  userId: string;
  transactionId: string;
  gateway: "stripe" | "mercado_pago";
  amount: number;
  currency: string;
  productName: string;
  productType: string;   // 'club' | 'course' | 'ebook' | 'combo' | 'package'
  productId?: string | null;
  eventSourceUrl?: string | null;
}) {
  // Pixel ID + CAPI token + test event code vêm do tracking_settings (editáveis pelo admin)
  const { data: ts } = await supabase
    .from("tracking_settings")
    .select("facebook_pixel_id, facebook_pixel_enabled, meta_capi_access_token, meta_test_event_code")
    .limit(1)
    .maybeSingle();
  if (!ts?.facebook_pixel_enabled || !ts?.facebook_pixel_id) {
    console.log("[meta-capi] pixel desativado/sem ID — skip");
    return;
  }

  const accessToken = ts.meta_capi_access_token || Deno.env.get("META_CAPI_ACCESS_TOKEN");
  if (!accessToken) {
    console.log("[meta-capi] token CAPI não configurado — skip");
    return;
  }
  const testEventCode = ts.meta_test_event_code || null;

  const { data: profile } = await supabase
    .from("profiles")
    .select("email, full_name, phone")
    .eq("user_id", args.userId)
    .maybeSingle();

  // event_id = `purchase:{gateway}:{transaction_id}` (mesma chave usada no Pixel client-side)
  const eventId = `purchase:${args.gateway}:${args.transactionId}`;

  await sendMetaCapiPurchase({
    pixelId: ts.facebook_pixel_id,
    accessToken,
    eventId,
    eventSourceUrl: args.eventSourceUrl,
    testEventCode,
    value: Number(args.amount) || 0,
    currency: args.currency || "BRL",
    contentName: args.productName,
    contentType: args.productType === "club" ? "subscription" : "product",
    contentIds: args.productId ? [args.productId] : undefined,
    orderId: args.transactionId,
    user: {
      email: profile?.email || null,
      phone: profile?.phone || null,
      fullName: profile?.full_name || null,
      externalId: args.userId,
    },
  });
}

// ============================================================
// Genérico: envio de qualquer evento Meta CAPI (Lead, CompleteRegistration,
// InitiateCheckout, ViewContent, Subscribe, Purchase). Usado pela edge
// function `meta-capi-track` que recebe disparos do client com event_id
// já gerado, garantindo deduplicação com o Pixel.
// ============================================================

export type MetaCapiEventName =
  | "Lead"
  | "CompleteRegistration"
  | "InitiateCheckout"
  | "ViewContent"
  | "Subscribe"
  | "Purchase";

export interface MetaCapiUserInput {
  email?: string | null;
  phone?: string | null;
  fullName?: string | null;
  externalId?: string | null;
  fbp?: string | null;
  fbc?: string | null;
  clientIp?: string | null;
  clientUserAgent?: string | null;
}

export interface MetaCapiEventInput {
  pixelId: string;
  accessToken: string;
  eventName: MetaCapiEventName;
  eventId: string;
  eventSourceUrl?: string | null;
  testEventCode?: string | null;
  customData?: Record<string, unknown>;
  user: MetaCapiUserInput;
}

export async function sendMetaCapiEvent(
  input: MetaCapiEventInput,
): Promise<{ ok: boolean; status?: number; json?: unknown }> {
  try {
    if (!input.pixelId || !input.accessToken) {
      console.log("[meta-capi] missing pixelId/accessToken — skip", input.eventName);
      return { ok: false };
    }

    const { fn, ln } = splitName(input.user.fullName);
    const phoneDigits = onlyDigits(input.user.phone);
    const emailNorm = (input.user.email || "").trim().toLowerCase();

    const user_data: Record<string, unknown> = {};
    if (emailNorm)             user_data.em = [await sha256Hex(emailNorm)];
    if (phoneDigits)           user_data.ph = [await sha256Hex(phoneDigits)];
    if (fn)                    user_data.fn = [await sha256Hex(fn)];
    if (ln)                    user_data.ln = [await sha256Hex(ln)];
    if (input.user.externalId) user_data.external_id = [await sha256Hex(input.user.externalId)];
    if (input.user.fbp)        user_data.fbp = input.user.fbp;
    if (input.user.fbc)        user_data.fbc = input.user.fbc;
    if (input.user.clientIp)   user_data.client_ip_address = input.user.clientIp;
    if (input.user.clientUserAgent) user_data.client_user_agent = input.user.clientUserAgent;

    const body: Record<string, unknown> = {
      data: [
        {
          event_name: input.eventName,
          event_time: Math.floor(Date.now() / 1000),
          event_id: input.eventId,
          action_source: "website",
          event_source_url: input.eventSourceUrl || undefined,
          user_data,
          custom_data: input.customData || {},
        },
      ],
    };
    if (input.testEventCode) body.test_event_code = input.testEventCode;

    const url = `https://graph.facebook.com/${META_API_VERSION}/${input.pixelId}/events?access_token=${encodeURIComponent(input.accessToken)}`;
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) {
      console.error("[meta-capi] FAILED", input.eventName, { status: res.status, json, eventId: input.eventId });
    } else {
      console.log("[meta-capi] sent", input.eventName, { eventId: input.eventId, json });
    }
    return { ok: res.ok, status: res.status, json };
  } catch (e) {
    console.error("[meta-capi] exception", input.eventName, (e as Error).message);
    return { ok: false };
  }
}
