## Objetivo

Migrar o Clube dos Drinkeros para **100% Stripe**, com cartão renovando automaticamente todo ano (sem aviso, sem mostrar parcelamento) e Pix como pagamento único anual com lembretes.

Ambos via **Stripe Checkout hospedado** — mais limpo, mais confiável e sem o problema do "Parcelamento disponível" do Mercado Pago.

---

## O que muda para o cliente

- Botão "Quero ser Sócio do Clube" leva direto para o Stripe Checkout (em vez do checkout transparente atual com toggle Cartão/Pix).
- No Stripe Checkout o cliente escolhe **Cartão** (renova automático todo ano) ou **Pix** (paga uma vez, vale 12 meses, recebe lembrete antes de vencer).
- Para Cartão: nenhuma menção a parcelamento. Cobrança anual silenciosa renova sozinha.
- Para Pix: usa o sistema de lembretes que já existe (`send-renewal-reminders`).

---

## Mudanças técnicas

### 1. Stripe — produtos e preços
Criar **dois preços** no mesmo produto "Clube dos Drinkeros":
- `price_club_card_yearly` — R$ 69 / ano, **recurring** (cartão)
- `price_club_pix_yearly` — R$ 69, **one-time** (Pix)

Salvar os IDs como secrets:
- `STRIPE_CLUB_CARD_PRICE_ID`
- `STRIPE_CLUB_PIX_PRICE_ID`

### 2. Nova edge function `create-club-checkout`
Substitui as chamadas a `create-mp-subscription` / `create-mp-payment` para o fluxo do Clube.

Recebe `{ method: "card" | "pix" }` e cria uma `checkout.sessions.create` com:
- `mode: "subscription"` quando `card` → usa `STRIPE_CLUB_CARD_PRICE_ID`, `payment_method_types: ["card"]`
- `mode: "payment"` quando `pix` → usa `STRIPE_CLUB_PIX_PRICE_ID`, `payment_method_types: ["pix"]`
- `client_reference_id: user.id`
- `metadata: { plan_kind: "club_card_subscription" | "club_pix_annual", user_id }`
- `success_url`/`cancel_url`: `/clube?clube=success|cancel`

Retorna `{ url }`. O frontend faz `window.location.href = url`.

### 3. Atualizar `src/pages/Checkout.tsx` (rota `/checkout/club/...`)
Simplificar drasticamente: para `productType === "club"`, **não montar mais o Brick do MP**. Apenas mostrar:
- Toggle "Cartão (renova automático)" / "Pix (1 ano)"
- Botão "Continuar para pagamento" → invoca `create-club-checkout` → redireciona para o URL do Stripe.

Remover toda a lógica de Mercado Pago Brick desse caminho. Manter o Brick apenas para os outros produtos (curso/ebook/combo) que continuam no MP por enquanto.

### 4. Atualizar `supabase/functions/stripe-webhook/index.ts`
Adicionar tratamento dos novos eventos do Clube — reaproveitando o que já existe:

**Novo bloco em `checkout.session.completed`:**
- `meta.plan_kind === "club_pix_annual"` → grava `vip_payments` com `payment_method: "pix_annual"`, define `expires_at = now + 365d`, chama `upsertVipPlan`, limpa `vip_renewal_reminders_sent` (igual ao já feito hoje para `vip_annual_one_time`).
- `meta.plan_kind === "club_card_subscription"` → busca `subscription` retornado, define `expires_at = current_period_end`, grava em `vip_payments` com `payment_method: "card_subscription"`, chama `upsertVipPlan`.

**`invoice.paid`** já cuida das renovações anuais do cartão automaticamente (push do `expires_at` para o próximo ciclo). Não precisa mexer.

**`invoice.payment_failed`** já existe e dispara o trilho de lembretes/avisos quando a renovação anual do cartão falhar.

### 5. Lembretes
- **Pix**: `send-renewal-reminders` já roda diariamente sobre `user_plans.expires_at`. Funciona sem mudança.
- **Cartão**: como o `expires_at` é empurrado a cada `invoice.paid`, os lembretes só disparam se a renovação falhar — exatamente o comportamento desejado.

### 6. `src/pages/VipLanding.tsx`
Atualizar copy:
- "✓ Cartão com renovação automática anual · ou Pix com 12 meses de acesso"
- Botão continua levando para `/checkout/club/clube-anual`.

### 7. Limpeza (não destruir, só desativar do fluxo do Clube)
- `create-mp-subscription` deixa de ser chamada pelo Clube (mantida no repo para histórico, sem deploy obrigatório).
- Mercado Pago segue ativo apenas para curso/ebook/combo enquanto não migramos esses também.

---

## Pontos importantes / o que vou perguntar antes de começar

1. **Preço final**: confirmo R$ 69/ano nos dois métodos, certo?
2. **Cartão recorrente**: confirma que **não** quer enviar nenhum aviso antes da cobrança anual (renovação totalmente silenciosa)? Por lei brasileira, só é exigido aviso se o valor mudar — manter R$ 69 fixo está ok.
3. **Quem já é sócio via Mercado Pago** (recorrente): mantém lá até cancelar. Novos sócios = Stripe. Tudo bem?
4. Você precisa criar os 2 preços no Stripe, ou quer que eu te oriente a criar via dashboard e depois colamos os `price_id` nos secrets?

---

## Diagrama do fluxo final

```text
/clube  →  "Quero ser Sócio"  →  /checkout/club/clube-anual
                                          │
                            [Cartão]  ←──┴──→  [Pix]
                                │                │
                  create-club-checkout (Stripe)
                                │                │
                  Stripe Checkout (subscription) │  Stripe Checkout (payment + pix)
                                │                │
                                └──────┬─────────┘
                                       ▼
                            stripe-webhook
                                       │
                  vip_payments + user_plans.expires_at
                                       │
                  ┌────────────────────┴─────────────────────┐
                  ▼                                          ▼
         Cartão: invoice.paid              Pix: send-renewal-reminders
         empurra expires_at +1ano           dispara lembretes antes do vencimento
         (ou invoice.payment_failed →
          dispara aviso de renovação)
```
