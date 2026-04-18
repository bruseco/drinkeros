## Plano: Página de Perfil completo do Aluno (Admin) + Pagamentos VIP via Stripe BYOK

### Acesso
- Em `AdminUsers.tsx`, a linha inteira do usuário vira clicável → navega para `/admin/usuarios/:userId`.
- O menu "..." de ações rápidas continua funcionando (stopPropagation no clique).

### Nova página: `src/pages/admin/AdminUserDetail.tsx`
Layout em seções (cards), tudo editável inline pelo admin.

**1. Cabeçalho**
- Avatar, nome, email, telefone, CPF, data de cadastro, último login, provider (Google/Apple/email).
- Badge do plano atual (FREE / VIP / Vitalício / Admin).
- Botões: Redefinir senha · Enviar email de boas-vindas · Excluir usuário.

**2. Dados pessoais (edição inline)**
- Nome, telefone, CPF — salva direto em `profiles`.

**3. Plano & Acesso Vitalício**
- Toggle "Acesso Vitalício" (grava em `user_lifetime_access`).
- Toggle "Plano VIP" + campo de data de expiração editável (grava em `user_plans`).
- Mostra se VIP veio de pagamento (Stripe) ou foi concedido manualmente.

**4. Conteúdos liberados** (3 abas: Cursos · E-books · Pacotes · Combos)
Cada aba mostra:
- Lista do que o aluno tem acesso, com:
  - Nome do conteúdo
  - **Data da compra** (`purchased_at`)
  - **Data de expiração** (`expires_at`) — destaque vermelho se expirado, verde se vitalício
  - Origem (compra, importação, manual, combo, etc — vem de `metadata`/triggers)
  - Botões: editar expiração · revogar acesso · marcar como vitalício
- Botão "+ Adicionar acesso" abre seletor com busca para conceder novo conteúdo.

**5. Acesso a Conteúdo Exclusivo (Receitas/Xaropes)**
- Toggle por feature (`receitas`, `xaropes`) — grava em `user_exclusive_access`.
- Mostra se foi concedido manualmente ou herdado do VIP/admin.

**6. Histórico de pagamentos VIP** (nova tabela `vip_payments`)
- Tabela: data · valor · método (cartão/PIX) · status (pago/pendente/falhou/reembolsado) · ID Stripe · ações.
- Botão "Registrar pagamento manual" (admin pode lançar venda offline).
- Cada linha tem link para o Stripe Dashboard (charge ID).

**7. Atividade**
- Últimas 10 receitas/aulas vistas, total de visualizações, certificados emitidos.

---

### Banco de dados (1 migração)

**Nova tabela `vip_payments`:**
- `user_id`, `amount` (numeric), `currency` (default BRL), `status` (paid/pending/failed/refunded), `payment_method` (card/pix/boleto/manual), `stripe_payment_intent_id`, `stripe_charge_id`, `stripe_invoice_id`, `paid_at`, `metadata` (jsonb), `created_by` (admin uuid se manual), `notes`.
- RLS: admin gerencia tudo; usuário só lê os próprios.

**Nova coluna em `user_plans`:**
- `source` (text, default `manual`): `stripe` | `manual` | `webhook` — pra distinguir origem do VIP.

**Nova coluna em `profiles`:**
- `last_sign_in_provider` (text, nullable) — populada automaticamente via trigger em `auth.users`.

---

### Pagamento VIP via Stripe (BYOK — você conecta sua conta)

**Fluxo:**
1. Você ativa a integração Stripe BYOK e cola sua `STRIPE_SECRET_KEY`.
2. Eu crio:
   - Edge function `create-vip-checkout`: gera Checkout Session da Stripe (modo subscription anual R$69) e retorna URL.
   - Edge function `stripe-webhook`: recebe eventos `checkout.session.completed`, `invoice.paid`, `invoice.payment_failed`, `customer.subscription.deleted` → grava em `vip_payments` + atualiza `user_plans` (extende +1 ano, dispara trigger que estende cursos/ebooks/pacotes).
   - Botão "Assinar VIP R$69/ano" na página `/vip` chamando `create-vip-checkout`.
3. Você precisa configurar no painel da Stripe:
   - Criar um Product + Price recorrente anual de R$69.
   - Adicionar webhook apontando para a URL da edge function `stripe-webhook`.
   - Eu te passo a URL e o evento list.

**Secrets necessários:**
- `STRIPE_SECRET_KEY` (sk_live_... ou sk_test_...)
- `STRIPE_WEBHOOK_SECRET` (whsec_...)
- `STRIPE_VIP_PRICE_ID` (price_... do produto VIP anual)

---

### Componentes reutilizáveis a criar
- `src/components/admin/UserAccessCard.tsx` — exibe lista de acessos com expiração editável
- `src/components/admin/UserPaymentHistory.tsx` — tabela de pagamentos VIP
- `src/components/admin/AddAccessDialog.tsx` — seletor com busca para conceder acesso
- `src/components/admin/VipToggleCard.tsx` — gerencia VIP + vitalício

### Hooks novos
- `useUserDetail(userId)` — busca tudo do usuário em uma query
- `useVipPayments(userId)` — lista pagamentos
- `useUpdateUserAccess()` — mutação genérica para editar expires_at

### Rotas
- Adicionar em `App.tsx`: `<Route path="/admin/usuarios/:userId" element={<AdminUserDetail />} />`

---

### Ordem de execução sugerida
1. Migração (tabela + colunas).
2. Página de perfil com tudo **menos** Stripe (funciona com pagamento manual já).
3. Você conecta Stripe BYOK → eu crio edge functions e checkout VIP.

Posso começar pela migração? Confirme ou ajuste o plano.
