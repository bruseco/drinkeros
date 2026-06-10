## Problema

A cobrança recorrente do Clube (R$47, Mastercard, 10/jun 14h01, ref. `club:89ee...:clube-anual:178...`) não aparece em `/admin/orders` porque não foi gravada em `purchases`.

Confirmado: a última linha de `purchases` (gateway `mercado_pago`) é de 15:30 UTC; a cobrança das 17:01 UTC não foi inserida.

## Causa

`supabase/functions/mercadopago-webhook/index.ts` trata pagamento recorrente quando o Mercado Pago envia `topic = subscription_authorized_payment` / `authorized_payment`. Mas o MP também envia (e neste caso enviou) `topic = payment` com o `payment_id` da cobrança recorrente. Nesse fluxo:

1. Faz `GET /v1/payments/{id}` — o pagamento de assinatura **não tem** `metadata.product_type` / `metadata.product_id` (esses metadados só existem no checkout transparente, não em cobranças geradas pelo preapproval).
2. O webhook cai no guard `if (!productType || !productId ...)` e aborta com `metadata_invalid`, sem gravar em `purchases` nem em `vip_payments`.

O `external_reference` da cobrança recorrente vem como `club:<userId>:<slug>:<ts>` (herdado do preapproval), então dá pra identificar como Clube mesmo sem metadata.

## Fix

Editar `supabase/functions/mercadopago-webhook/index.ts`, no handler de `topic === "payment"`, antes do guard atual:

1. Se `metadata.product_type` estiver ausente e `external_reference` começar com `club:`, tratar como cobrança recorrente do Clube:
   - Parsear `external_reference` → `[_, userId, slug]`.
   - Detectar período pelo slug (`clube-anual` → 365 dias; senão 30).
   - Reaproveitar `resolveOrCreateBuyer` (com `knownUserId = userId`, email/nome do payer).
   - Chamar `grantClubAccess` com o `paymentId` e período correto.
   - Chamar `recordPurchase` com `productType: "club"`, `transactionId: String(paymentId)`, `payment_method` derivado de `payment.payment_method_id` (já implementado o mapeamento Cartão/Pix na listagem admin via `useAdminOrders`).
   - Retornar `{ ok: true, granted: true, club: true, recurring: true }`.
2. Manter o fluxo existente (com metadata) intacto para checkout transparente avulso.
3. Não alterar mais nada (admin UI, hooks, RPC `admin_orders`) — `purchases` já é a fonte e o `payment_method` já é renderizado.

## Backfill da cobrança que falhou

Após o deploy, posso reenviar manualmente uma notificação para o webhook (`POST /functions/v1/mercadopago-webhook` com `{ "type": "payment", "data": { "id": "163470013850" } }`) para registrar retroativamente a venda da wandymacedo@hotmail.com em `purchases` e `vip_payments`. Confirme se quer que eu faça esse replay assim que o fix subir.

## Como testar

1. Ver no `/admin/orders` filtro Mercado Pago a venda de R$47 da wandymacedo aparecendo como `Mercado Pago (Cartão)`.
2. Próximas renovações automáticas do Clube passam a aparecer sozinhas.
