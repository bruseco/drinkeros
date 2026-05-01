
## Contexto atual (o que já existe e o que falta)

**O que JÁ existe ✅**
- Templates de e-mail de renovação prontos: 30d, 10d, 5d, 3d, 1d, 0d e +3d antes/depois do vencimento.
- `user_plans` com coluna `expires_at` (várias assinaturas já têm vencimento — várias inclusive já vencidas).
- Infra de e-mail transacional (`send-transactional-email`) e fila funcionando.
- Checkout do Clube com Stripe (`create-vip-checkout`) aceitando cartão + PIX.

**O que NÃO existe ❌**
- Nenhuma edge function que dispare os e-mails de renovação.
- Nenhum cron job que rode diariamente para verificar quem vai vencer.
- O PIX hoje está numa **assinatura recorrente** (`mode: subscription`) — isso quebra após o 1º mês porque PIX não suporta recorrência no Stripe.
- Não há plano anual à vista (one-shot) configurado.

---

## O que vamos construir

### 1. Plano Anual com PIX (cobrança única, 1 ano de acesso)

Criar um **segundo fluxo de checkout** ao lado do mensal recorrente:

- Novo preço Stripe **anual one-time** (cobrança única, sem recorrência)
- Nova edge function `create-vip-annual-checkout` usando `mode: "payment"` com `payment_method_types: ["card", "pix"]`
- Webhook (`stripe-webhook`) já trata pagamentos — vamos estender para reconhecer o pagamento anual e gravar `expires_at = hoje + 1 ano` em `user_plans`

Na **VipLanding**, mostrar duas opções claras:
- **Mensal Recorrente** (cartão / Apple Pay / Google Pay) — renova sozinho
- **Anual à vista** (cartão ou PIX) — pagamento único, vale 1 ano, sem renovação automática

### 2. Sistema de avisos de renovação por e-mail

Criar edge function `send-renewal-reminders` que roda diariamente via pg_cron e:

1. Busca em `user_plans` todos os `plan='vip'` com `expires_at` próximo
2. Para cada um, calcula em quantos dias falta (ou quantos dias passou)
3. Dispara o template adequado via `send-transactional-email`:

| Quando | Template | Mensagem |
|---|---|---|
| 30 dias antes | `clube-renewal-30d` | Aviso amigável de renovação aproximando |
| 10 dias antes | `clube-renewal-10d` | Lembrete |
| 5 dias antes | `clube-renewal-5d` | Lembrete urgente |
| 3 dias antes | `clube-renewal-3d` | Quase vencendo |
| 1 dia antes | `clube-renewal-1d` | Vence amanhã |
| No dia | `clube-renewal-0d` | Vence hoje |
| 3 dias depois | `clube-renewal-plus3d` | Já venceu, retorne |

Cada usuário recebe **só um e-mail por janela** (controle de idempotência via `idempotencyKey = user_id + template_name`).

### 3. Cron job diário

Agendar `send-renewal-reminders` para rodar **todo dia às 9h BRT** (12h UTC) usando pg_cron + pg_net.

### 4. Botão de renovação no e-mail

Cada e-mail leva o usuário à página `/clube` onde ele já pode renovar (mensal ou anual via PIX).

---

## Detalhes técnicos

**Arquivos a criar:**
- `supabase/functions/create-vip-annual-checkout/index.ts` — checkout one-time
- `supabase/functions/send-renewal-reminders/index.ts` — varre `user_plans` e enfileira e-mails
- Migração SQL para criar o cron job diário
- Migração SQL para tabela `vip_renewal_reminders_sent` (controle de idempotência: user_id + template + sent_at)

**Arquivos a editar:**
- `src/pages/VipLanding.tsx` — adicionar card do "Plano Anual à vista (PIX)" ao lado do mensal
- `supabase/functions/stripe-webhook/index.ts` — tratar `checkout.session.completed` em `mode=payment` e gravar `expires_at = now + 1 ano`

**Stripe:**
- Criar produto "Clube dos Drinkeros — Plano Anual" com preço one-time (você me dirá o valor)
- Guardar o novo `price_id` em `STRIPE_VIP_ANNUAL_PRICE_ID` (secret)

**Tabela de controle (nova):**
```text
vip_renewal_reminders_sent
  user_id      uuid
  template     text   (ex: 'clube-renewal-10d')
  sent_at      timestamptz
  PRIMARY KEY (user_id, template)
```
Garante que cada usuário só recebe cada lembrete **uma vez** por ciclo.

**Reset do controle:** Quando o usuário renovar (webhook do Stripe grava novo `expires_at`), apagamos os registros antigos dele para que receba os lembretes do novo ciclo.

---

## Pergunta antes de começar

Preciso de uma definição sua:

**Qual será o valor do Plano Anual à vista?**
Hoje você cobra mensal (R$ ?). Sugestão de valor anual com desconto: equivalente a ~10 meses (2 meses grátis). Me passe o valor exato em reais que devo cadastrar no Stripe.

Quando me responder com o valor, eu já implemento tudo de uma vez.
