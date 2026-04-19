
Plano: conectar Stripe BYOK (sua conta) e ativar pagamento VIP de verdade

## 1. Conectar sua conta Stripe
- Habilito a integração Stripe BYOK (você cola sua `STRIPE_SECRET_KEY` da conta Drinkeros).
- Você também me fornece depois: `STRIPE_WEBHOOK_SECRET` e `STRIPE_VIP_PRICE_ID` (price recorrente anual de R$69 que você cria no painel Stripe).

## 2. Edge functions
- **`create-vip-checkout`** — cria Checkout Session do Stripe (mode subscription, price = `STRIPE_VIP_PRICE_ID`), passa `client_reference_id = user.id` e `customer_email`. Retorna URL de checkout.
- **`stripe-webhook`** (verify_jwt = false) — valida assinatura via `STRIPE_WEBHOOK_SECRET` e processa:
  - `checkout.session.completed` → upsert em `vip_payments` (status `paid`, source `stripe`), atualiza `user_plans` (plan=`vip`, `expires_at = now + 1 year`, `source = 'stripe'`). O trigger `extend_accesses_on_vip_activation` já estende cursos/ebooks/pacotes/combos automaticamente.
  - `invoice.paid` → renovação anual: nova linha em `vip_payments`, estende `expires_at` em +1 ano.
  - `invoice.payment_failed` → registra falha em `vip_payments`.
  - `customer.subscription.deleted` → marca cancelamento (mantém acesso até `expires_at`).
- Salvo `stripe_customer_id`, `stripe_subscription_id`, `stripe_invoice_id`, `stripe_payment_intent_id`, `stripe_charge_id` em cada linha.

## 3. Front-end (`src/pages/VipLanding.tsx`)
- Substituo o `alert(...)` por chamada real a `create-vip-checkout` → redireciona pro Stripe Checkout.
- Trato retorno: `?vip=success` (toast + invalidate `user-plan`) e `?vip=cancel` (toast neutro).

## 4. Migração mínima
- Adiciono coluna `source` em `user_plans` (default `manual`) caso ainda não exista, pra distinguir VIPs vindos do Stripe vs manual.

## 5. O que você precisa fazer no painel Stripe (te passo o passo-a-passo na execução)
1. Criar Product "VIP Drinkeros Anual" + Price recorrente R$ 69/ano → me passa o `price_id`.
2. Criar Webhook endpoint apontando pra URL da função `stripe-webhook` (eu te dou a URL exata) com os 4 eventos listados → me passa o `whsec_...`.
3. Me passar a `STRIPE_SECRET_KEY` (sk_live ou sk_test).

## Ordem de execução
1. Habilitar Stripe BYOK + você cola a `STRIPE_SECRET_KEY`.
2. Eu crio as edge functions (deploy automático) e te entrego a URL do webhook.
3. Você cria Product/Price e Webhook no Stripe → me passa `STRIPE_VIP_PRICE_ID` e `STRIPE_WEBHOOK_SECRET`.
4. Eu atualizo o botão da `VipLanding` e testamos com cartão de teste (`4242 4242 4242 4242`).

Confirma que pode prosseguir?
