## Visão geral

Hoje há dois sistemas de acesso paralelos: o **plano "Sócio do Clube"** (`user_plans` com `plan='vip'`, `activated_at`, `expires_at`, `source`) e o toggle antigo **"Acesso a Receitas (Conteúdo Exclusivo)"** (`user_exclusive_access`). Vamos unificar tudo sob o nome **"Clube dos Drinkeros"**, expor melhor as datas, e adicionar a régua de renovação para assinaturas que não renovam automaticamente (PIX, manual, importados).

---

## 1. Renomear "Sócio do Clube" → "Clube dos Drinkeros"

Substituir o rótulo em todos os pontos de UI:
- `src/pages/admin/AdminUserDetail.tsx` (card de plano, badge, dialog de validade)
- `src/components/user/PlanBadge.tsx` (atualmente mostra "Sócio")
- Toasts e mensagens ("Sócio do Clube ativado por 1 ano" → "Clube dos Drinkeros ativado")
- Manter a chave técnica `plan='vip'` no banco (sem migração).

## 2. Migrar e remover o toggle antigo "Acesso a Receitas"

- **Migração de dados**: para todo `user_id` que tem registro em `user_exclusive_access` com `feature='receitas'` e ainda **não tem** `user_plans.plan='vip'` ativo, criar/atualizar `user_plans` com `plan='vip'`, `source='legacy_exclusive'`, `activated_at = created_at` original e `expires_at = COALESCE(expires_at original, created_at + 1 ano)`. Usuários com `is_lifetime` continuam sem expiração.
- **Remover o card** "Acesso a Receitas (Conteúdo Exclusivo)" de `AdminUserDetail.tsx`.
- Deixar a tabela `user_exclusive_access` no banco (não dropar) como fallback histórico — `useRecipeAccessGuard` continua respeitando ela, então usuários antigos não perdem acesso mesmo se a migração falhar pra alguém.

## 3. Melhorar a UI de Plano no admin

No card "Plano & Acesso" do `AdminUserDetail.tsx`:
- Mostrar **Data de início da assinatura** (`activated_at`, formato `dd/MM/yyyy`).
- Mostrar **Data de expiração** (já existe).
- Tornar **ambas editáveis** num único dialog "Editar período do Clube" com dois campos de data (hoje só edita expiração).
- Mostrar a **origem** com rótulos amigáveis: Stripe (renova sozinho), PIX, Manual, Importado, Legado, WooCommerce.
- Indicador visual quando `source != 'stripe'` → "Renovação manual" + dias restantes (ex: "Expira em 18 dias").

## 4. Régua de renovação para assinaturas manuais (PIX/manual/importado)

### 4.1 Tabela de controle de envios

Nova migração: `vip_renewal_reminders`
- `id`, `user_id`, `user_plan_expires_at` (snapshot), `step` (enum: `m1`, `d10`, `d5`, `d3`, `d1`, `d0`, `dplus3`), `channel` (`email` | `whatsapp`), `sent_at`, `coupon_code` (nullable, só no `dplus3`).
- Unique `(user_id, user_plan_expires_at, step, channel)` → idempotência: se o admin alterar a data de expiração, a régua reinicia automaticamente para a nova data.

### 4.2 Cron + Edge Function `vip-renewal-reminders`

- pg_cron diário às **09:00 BRT**.
- Seleciona `user_plans` onde `plan='vip'` e `source IN ('manual','import','pix','legacy_exclusive','woocommerce')` (exclui `stripe`, que renova sozinho), com `expires_at` casando os offsets: -30, -10, -5, -3, -1, 0, +3 dias.
- Para cada match, dispara **e-mail + WhatsApp** (ambos canais), respeitando janela 8h-21h da fila WA.
- Registra na tabela de controle antes de enfileirar (pra não duplicar em re-runs).

### 4.3 Templates de e-mail (React Email, Lovable Cloud)

Criar 7 templates em `supabase/functions/_shared/transactional-email-templates/`:
- `clube-renewal-30d`, `-10d`, `-5d`, `-3d`, `-1d`, `-0d` (vence hoje), `-plus3d-cupom`.
- Estilo light mode, header rosa #ca1958, CTA "Renovar Clube dos Drinkeros".
- O template `-plus3d-cupom` recebe `couponCode` + `couponUrl` via `templateData` e mostra: "Use **VOLTA-XXXX** no checkout — R$10 OFF".
- Registrar todos no `registry.ts`.

### 4.4 Templates WhatsApp (Era Cloud / Meta)

Listar os 7 templates necessários para você cadastrar manualmente no painel Era Cloud (textos curtos, sem promo nos 6 primeiros para passar na aprovação Meta; o último é categoria MARKETING com o cupom). Após cadastro, a edge function lê pelos nomes `vip_renewal_30d`, `vip_renewal_10d`, etc. Mapeamento de variáveis via `whatsapp_template_bindings` já existente.

### 4.5 Geração do cupom de R$10 (Stripe, único por usuário)

No passo `dplus3`, antes de enviar:
1. Edge function chama `stripe.coupons.create({ amount_off: 1000, currency: 'brl', duration: 'once', name: 'Volta Clube — ${userId}', max_redemptions: 1 })`.
2. Cria um `promotionCode` legível: `stripe.promotionCodes.create({ coupon, code: 'VOLTA-' + 6_chars_random, max_redemptions: 1, expires_at: now + 14 dias, metadata: { user_id } })`.
3. Salva `coupon_code` na linha de `vip_renewal_reminders` e injeta no template de e-mail/WA.
4. O `create-vip-checkout` já tem `allow_promotion_codes: true`, então o usuário aplica o código no Stripe Checkout normalmente.

## 5. Botão "Renovar agora" para o próprio usuário

Quando o `useUserPlan` indicar `expires_at` próximo (≤ 30 dias) e source manual, mostrar banner discreto no `/app` (UserHome) com CTA → `/clube?renovar=1`, que pula direto ao `create-vip-checkout`.

---

## Arquivos a criar / modificar

**Criar:**
- Migração: tabela `vip_renewal_reminders` + pg_cron + migração legacy → `user_plans`.
- `supabase/functions/vip-renewal-reminders/index.ts`
- `supabase/functions/_shared/transactional-email-templates/clube-renewal-30d.tsx` (e os outros 6)
- Atualização do `registry.ts`

**Modificar:**
- `src/pages/admin/AdminUserDetail.tsx` — renomear, remover card antigo, adicionar campo "Data de início" editável.
- `src/components/user/PlanBadge.tsx` — texto "Clube" no lugar de "Sócio".
- `src/hooks/useUserDetail.ts` — expor `activated_at` no select (já busca).
- `src/pages/user/UserHome.tsx` — banner "Renove o Clube" para assinaturas próximas do vencimento.
- `supabase/config.toml` — registrar a nova edge function.

## Pontos a confirmar antes de executar

1. **Cadastro dos templates Meta**: depois que eu criar a função, você precisa cadastrar manualmente os 7 templates na Era Cloud com os textos que vou te passar (Meta exige aprovação ~24h).
2. **Hora do disparo**: cron diário às 09:00 BRT está bom?
3. **Cupom**: validade do `VOLTA-XXXX` será de 14 dias após emitido. OK?
