## Diagnóstico

O usuário **drinkoucompany@gmail.com** comprou sim a assinatura do Clube — confirmado no Stripe:

- **Pagamento Stripe**: `pi_3TSMmQGlXZFgg9241kAEAntw` — **R$ 69,00** — status `succeeded` — customer `cus_URFGLXt2RuCdCx`
- **Plano VIP**: ativo até 01/05/2027 (`user_plans` foi atualizado corretamente)
- **DrinkDelivery**: comprado depois via Mercado Pago por R$ 79,40 (`156516947843`)

**O problema:** o pagamento de R$ 69 do Clube **não está em `vip_payments`**, então não aparece no histórico. Por isso só vemos a venda de R$ 79,40 do DrinkDelivery, dando a falsa impressão de que ele só comprou um produto.

## Causa raiz no código

No `stripe-webhook/index.ts`, o handler do `checkout.session.completed` para a assinatura recorrente (mode=subscription) **só ativa o plano** (`upsertVipPlan`) e deixa para o evento `invoice.paid` registrar a venda em `vip_payments`. Comentário no código diz:

> "A venda real da assinatura é registrada em invoice.paid. checkout.session.completed só libera/atualiza o acesso para evitar duplicar Vendas."

**Mas:** o evento `invoice.paid` no Stripe pode chegar **antes** do `checkout.session.completed`, ou por algum motivo (latência, falha de retry, primeira invoice de assinatura nova) não cair no nosso webhook a tempo. Para esse usuário específico, o `invoice.paid` simplesmente **não foi processado** — o `vip_payments` está vazio para ele.

Isso é um bug sistêmico: **toda assinatura recorrente nova corre risco** de não ter o `vip_payments` gravado se o `invoice.paid` falhar/não chegar.

## Plano de correção

### 1. Tornar `checkout.session.completed` (mode=subscription) idempotente E gravar a venda

No webhook, quando for assinatura recorrente, além de ativar o plano, **gravar também em `vip_payments`** usando `stripe_invoice_id` (recuperado da subscription) como chave de conflito. Como `invoice.paid` também faz upsert por `stripe_invoice_id`, fica idempotente — quem chegar primeiro grava, o segundo é no-op.

Fluxo:
- Buscar a `subscription` no Stripe
- Pegar `latest_invoice` da subscription
- Fazer upsert em `vip_payments` com:
  - `amount`: do `latest_invoice.amount_paid`
  - `stripe_invoice_id`: chave de conflito
  - `stripe_subscription_id`, `stripe_customer_id`, `stripe_payment_intent_id`
  - `paid_at`, `period_start`, `period_end`
  - `status: 'paid'`

### 2. Corrigir manualmente o pagamento do drinkoucompany@gmail.com

Inserir o registro faltante em `vip_payments` via migration:

```sql
INSERT INTO vip_payments (
  user_id, amount, currency, status, payment_method,
  stripe_customer_id, stripe_payment_intent_id,
  paid_at, period_start, period_end, metadata
) VALUES (
  '5266fe7e-f399-4289-8b2f-827898a25d28',
  69.00, 'BRL', 'paid', 'card',
  'cus_URFGLXt2RuCdCx',
  'pi_3TSMmQGlXZFgg9241kAEAntw',
  '2026-05-01 19:33:13+00',
  '2026-05-01 19:33:13+00',
  '2027-05-01 19:33:13+00',
  '{"source":"manual_recovery","note":"invoice.paid não chegou no webhook"}'::jsonb
)
ON CONFLICT (stripe_payment_intent_id) DO NOTHING;
```

### 3. Verificação após o fix

Após aplicar, no histórico do `drinkoucompany@gmail.com` devem aparecer **2 pagamentos**:
- Clube — R$ 69,00 — Stripe — 01/05/2026
- DrinkDelivery & Engarrafados — R$ 79,40 — Mercado Pago — 01/05/2026

## Detalhes técnicos

**Arquivos afetados:**
- `supabase/functions/stripe-webhook/index.ts` — adicionar gravação em `vip_payments` no branch de assinatura recorrente do `checkout.session.completed`
- Nova migration — INSERT de recuperação para o usuário específico

**Sobre a regra de negócio "comprar Clube antes do DrinkDelivery na promo":** está consistente — ele comprou o Clube primeiro (19:33) e o DrinkDelivery 4 minutos depois (19:37). A promo funcionou; só faltou registrar a venda do Clube.