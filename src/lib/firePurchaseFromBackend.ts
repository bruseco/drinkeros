import { supabase } from '@/integrations/supabase/client';
import { trackFbEvent } from '@/lib/metaPixel';

/**
 * Busca a última compra/assinatura aprovada do usuário (não enviada ainda)
 * e dispara o evento Meta Pixel "Purchase" com os dados REAIS da transação.
 *
 * O backend marca `meta_purchase_sent = true` na mesma chamada, evitando
 * duplicidade entre abas, refresh ou múltiplas success pages.
 */
export async function firePurchaseFromBackend(opts?: { source?: string }) {
  try {
    const { data, error } = await supabase.functions.invoke('confirm-purchase');
    if (error) {
      console.warn('[firePurchaseFromBackend] erro:', error);
      return;
    }
    const purchase = (data as any)?.purchase;
    if (!purchase) {
      console.log('[firePurchaseFromBackend] nenhuma compra pendente para enviar');
      return;
    }
    const eventId = `purchase:${purchase.gateway}:${purchase.transaction_id}`;
    trackFbEvent(
      'Purchase',
      {
        value: Number(purchase.amount_paid),
        currency: purchase.currency || 'BRL',
        content_name: purchase.product_name,
        content_type: purchase.product_type === 'club' ? 'subscription' : 'product',
        content_ids: purchase.product_id ? [purchase.product_id] : undefined,
        order_id: purchase.transaction_id,
        transaction_id: purchase.transaction_id,
      },
      { dedupeKey: eventId, eventId },
    );
    console.log('[firePurchaseFromBackend] Purchase disparado', { source: opts?.source, purchase });
  } catch (e) {
    console.warn('[firePurchaseFromBackend] exception:', e);
  }
}
