// Helper compartilhado: dispara e-mails pós-compra (account-created e purchase-confirmed)
// com lock atômico via purchases.emails_dispatched_at para evitar envio duplicado em
// reenvios de webhook.
//
// - account-created: SOMENTE quando wasCreated = true. Gera link de definição de
//   senha via auth.admin.generateLink (type=recovery) — substitui o e-mail nativo
//   de recovery do Supabase.
// - purchase-confirmed: para toda compra aprovada+liberada+registrada com sucesso.

const PRODUCT_TYPE_LABEL: Record<string, string> = {
  course: 'Curso',
  ebook: 'E-book',
  combo: 'Combo',
  package: 'Pacote',
  club: 'Clube dos Drinkeros',
};

function formatBRL(amount: number, currency = 'BRL') {
  try {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: (currency || 'BRL').toUpperCase(),
    }).format(amount);
  } catch {
    return `R$ ${amount.toFixed(2)}`;
  }
}

export interface SendPurchaseEmailsArgs {
  gateway: 'stripe' | 'mercado_pago';
  transactionId: string;
  userId: string;
  email: string | null;
  fullName?: string | null;
  wasCreated: boolean;
  productName: string;
  productType: string;
  amountPaid: number;
  currency: string;
  siteUrl: string;
}

/**
 * Tenta adquirir o "lock" de envio: marca purchases.emails_dispatched_at = now()
 * apenas se ainda for NULL. Retorna true se conseguimos o lock (envio único).
 */
async function acquireDispatchLock(
  supabase: any,
  gateway: string,
  transactionId: string,
): Promise<boolean> {
  const { data, error } = await supabase
    .from('purchases')
    .update({ emails_dispatched_at: new Date().toISOString() })
    .eq('gateway', gateway)
    .eq('transaction_id', transactionId)
    .is('emails_dispatched_at', null)
    .select('id');
  if (error) {
    console.warn('[sendPurchaseEmails] lock error:', error.message);
    return false;
  }
  return Array.isArray(data) && data.length > 0;
}

async function invokeTemplate(
  supabase: any,
  templateName: string,
  recipientEmail: string,
  idempotencyKey: string,
  templateData: Record<string, unknown>,
) {
  try {
    const { error } = await supabase.functions.invoke('send-transactional-email', {
      body: { templateName, recipientEmail, idempotencyKey, templateData },
    });
    if (error) {
      console.warn(`[sendPurchaseEmails] ${templateName} invoke error:`, error.message);
    } else {
      console.log(`[sendPurchaseEmails] ${templateName} queued for ${recipientEmail}`);
    }
  } catch (e) {
    console.warn(`[sendPurchaseEmails] ${templateName} exception:`, (e as Error).message);
  }
}

export async function sendPurchaseEmails(supabase: any, args: SendPurchaseEmailsArgs) {
  if (!args.email) {
    console.warn('[sendPurchaseEmails] skipped: no email');
    return;
  }

  const got = await acquireDispatchLock(supabase, args.gateway, args.transactionId);
  if (!got) {
    console.log('[sendPurchaseEmails] skipped: already dispatched for', args.gateway, args.transactionId);
    return;
  }

  const firstName = args.fullName ? args.fullName.split(' ')[0] : undefined;
  const productTypeLabel = PRODUCT_TYPE_LABEL[args.productType] || args.productType;
  const amountFormatted = formatBRL(args.amountPaid, args.currency);
  const appLoginUrl = `${args.siteUrl.replace(/\/$/, '')}/login`;

  // 1) account-created (somente se conta foi criada agora) — substitui recovery nativo
  if (args.wasCreated) {
    const site = args.siteUrl.replace(/\/$/, '');
    // Tela de criação de conta: e-mail já preenchido, usuário só define a senha
    // e entra logado no app (validada pelo payment_id da compra).
    const passwordSetupUrl = `${site}/criar-conta?pid=${encodeURIComponent(args.transactionId)}&email=${encodeURIComponent(args.email)}`;
    await invokeTemplate(
      supabase,
      'account-created',
      args.email,
      `account-created:${args.gateway}:${args.transactionId}`,
      {
        userName: firstName,
        email: args.email,
        productName: args.productName,
        passwordSetupUrl,
        appUrl: appLoginUrl,
      },
    );
  }

  // 2) purchase-confirmed (sempre)
  await invokeTemplate(
    supabase,
    'purchase-confirmed',
    args.email,
    `purchase-confirmed:${args.gateway}:${args.transactionId}`,
    {
      userName: firstName,
      productName: args.productName,
      productType: productTypeLabel,
      amountFormatted,
      appLoginUrl,
      isNewAccount: args.wasCreated,
    },
  );

  // 3) clube-welcome-discount: explica o benefício de sócio (80% por 7 dias a
  //    contar do primeiro acesso ao app, depois 50% para sempre).
  if (args.productType === 'club') {
    await invokeTemplate(
      supabase,
      'clube-welcome-discount',
      args.email,
      `clube-welcome-discount:${args.gateway}:${args.transactionId}`,
      {
        userName: firstName,
        appUrl: `${args.siteUrl.replace(/\/$/, '')}/app/cursos`,
      },
    );
  }
}
