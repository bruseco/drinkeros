// Resolve (ou cria) a conta do comprador a partir do e-mail.
// Usado pelos webhooks Stripe e Mercado Pago para garantir que TODA compra
// aprovada termine vinculada a um user_id real.
//
// Retorno:
//   { userId, wasCreated, profile }  em caso de sucesso
//   { userId: null, error }          em caso de falha (ex.: e-mail ausente)

export interface ResolveBuyerInput {
  email?: string | null;
  fullName?: string | null;
  /** user_id já conhecido (ex.: metadata do checkout) — se válido, usado direto. */
  knownUserId?: string | null;
}

export interface ResolveBuyerSuccess {
  userId: string;
  wasCreated: boolean;
  email: string | null;
  fullName: string | null;
}

export interface ResolveBuyerFailure {
  userId: null;
  wasCreated: false;
  email: string | null;
  fullName: string | null;
  error: string;
}

export type ResolveBuyerResult = ResolveBuyerSuccess | ResolveBuyerFailure;

/**
 * Procura um usuário existente em auth.users pelo e-mail usando o endpoint
 * admin do GoTrue (suporta filtro por e-mail, sem depender de paginação).
 */
async function findAuthUserByEmail(email: string): Promise<string | null> {
  try {
    const baseUrl = Deno.env.get("SUPABASE_URL");
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!baseUrl || !serviceKey) return null;
    const res = await fetch(
      `${baseUrl}/auth/v1/admin/users?per_page=50&filter=${encodeURIComponent(email)}`,
      { headers: { apikey: serviceKey, Authorization: `Bearer ${serviceKey}` } },
    );
    if (!res.ok) return null;
    const json = await res.json();
    const match = (json?.users ?? []).find(
      (u: any) => (u.email || "").toLowerCase() === email,
    );
    return match?.id ?? null;
  } catch (e) {
    console.warn("[findAuthUserByEmail] failed:", (e as Error).message);
    return null;
  }
}

export async function resolveBuyerUser(
  supabase: any,
  input: ResolveBuyerInput,
): Promise<ResolveBuyerResult> {
  const email = input.email ? input.email.toLowerCase().trim() : null;
  const fullName = input.fullName?.trim() || null;

  // 1) Se já temos um user_id confiável (metadata do checkout), retorna.
  if (input.knownUserId) {
    return {
      userId: input.knownUserId,
      wasCreated: false,
      email,
      fullName,
    };
  }

  if (!email) {
    return {
      userId: null,
      wasCreated: false,
      email: null,
      fullName,
      error: "buyer_email_missing",
    };
  }

  // 2) Tenta achar profile existente pelo e-mail.
  const { data: existingProfile, error: profErr } = await supabase
    .from("profiles")
    .select("user_id, full_name")
    .eq("email", email)
    .maybeSingle();

  if (profErr) {
    console.warn("[resolveBuyerUser] profile lookup error:", profErr.message);
  }

  if (existingProfile?.user_id) {
    return {
      userId: existingProfile.user_id,
      wasCreated: false,
      email,
      fullName: existingProfile.full_name || fullName,
    };
  }

  // 2.1) Pode existir em auth.users sem profile — procura antes de tentar criar.
  const preExistingId = await findAuthUserByEmail(email);
  if (preExistingId) {
    await supabase.from("profiles").upsert(
      { user_id: preExistingId, email, full_name: fullName },
      { onConflict: "user_id" },
    );
    return { userId: preExistingId, wasCreated: false, email, fullName };
  }

  // 3) Não existe: cria conta automaticamente (sem senha, e-mail já confirmado).
  // Trigger handle_new_user cria profile + user_plans('free').
  const { data: created, error: createErr } = await supabase.auth.admin.createUser({
    email,
    email_confirm: true,
    user_metadata: fullName ? { full_name: fullName } : {},
  });

  if (createErr) {
    // Qualquer erro de criação (422 "already registered", 500 unexpected_failure
    // por duplicidade 23505, corrida entre webhooks) pode significar que o usuário
    // já existe. Sempre tenta localizar pelo e-mail antes de desistir.
    const msg = createErr.message || "";
    const existingId = await findAuthUserByEmail(email);
    if (existingId) {
      await supabase.from("profiles").upsert(
        { user_id: existingId, email, full_name: fullName },
        { onConflict: "user_id" },
      );
      return { userId: existingId, wasCreated: false, email, fullName };
    }
    return {
      userId: null,
      wasCreated: false,
      email,
      fullName,
      error: `auth_create_failed: ${msg}`,
    };
  }

  const userId = created?.user?.id;
  if (!userId) {
    return {
      userId: null,
      wasCreated: false,
      email,
      fullName,
      error: "auth_create_returned_no_user",
    };
  }

  return { userId, wasCreated: true, email, fullName };
}

/**
 * Registra falha de resolução de comprador em webhook_purchase_logs
 * para correção manual pelo admin.
 */
export async function logPurchaseResolutionFailure(
  supabase: any,
  args: {
    gateway: "stripe" | "mercado_pago";
    transactionId?: string | null;
    payerEmail?: string | null;
    payerName?: string | null;
    productType?: string | null;
    productId?: string | null;
    errorMessage: string;
    rawPayload?: Record<string, unknown>;
  },
) {
  try {
    await supabase.from("webhook_purchase_logs").insert({
      gateway: args.gateway,
      transaction_id: args.transactionId || null,
      payer_email: args.payerEmail || null,
      payer_name: args.payerName || null,
      product_type: args.productType || null,
      product_id: args.productId || null,
      status: "unresolved",
      error_message: args.errorMessage,
      raw_payload: args.rawPayload || {},
      resolved: false,
    });
  } catch (e) {
    console.error("[logPurchaseResolutionFailure] insert failed:", (e as Error).message);
  }
}

/**
 * Dispara e-mail de boas-vindas APENAS quando a conta foi criada agora.
 * Usa o sistema nativo de recovery do Supabase (auth-email-hook) para que o
 * usuário possa definir sua senha. Não cria template novo nem duplica e-mail.
 */
export async function sendWelcomeRecoveryEmail(
  supabase: any,
  email: string,
  siteUrl: string,
) {
  try {
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${siteUrl}/reset-password`,
    });
    if (error) {
      console.warn("[sendWelcomeRecoveryEmail] resetPasswordForEmail error:", error.message);
    } else {
      console.log("[sendWelcomeRecoveryEmail] sent to", email);
    }
  } catch (e) {
    console.warn("[sendWelcomeRecoveryEmail] exception:", (e as Error).message);
  }
}
