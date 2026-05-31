# Reestruturar Páginas de Venda em 3 níveis

## Objetivo
Transformar a tela atual de `Páginas de Venda` (que mistura tudo numa lista única) num drill-down de 3 níveis, com funil completo por página.

## Nível 1 — Lista de Produtos (`/admin/paginas-venda`)
Vira uma grade/lista enxuta de **produtos** (não páginas):
- Clube dos Drinkeros, Mixologia Avançada, Bar p/ Eventos, etc.
- Cada card mostra: capa, nome, tipo (Assinatura/Compra), preço, status Stripe, e nº de páginas/variantes ativas.
- Clicar no card abre o Nível 2.
- Removo daqui a coluna Link público e o painel A/B (vai pro Nível 2).

## Nível 2 — Páginas do Produto (`/admin/paginas-venda/:productKey`)
Mostra todas as **páginas/variantes** desse produto:
- Para o Clube: linhas para `/clube` (Variante A) e `/clube-b` (Variante B) — com badge "Ativa" baseado no `ab_tests` (split + winner).
- Para cursos/ebooks sem A/B: só uma página (`/slug`); botão "Criar variante B" se quiser ativar teste.
- Cada linha: caminho, status (Ativa/Pausada/Vencedora), visitas, conversões resumidas, % tráfego.
- Controles de teste A/B (split, pausar, declarar vencedor, remover) ficam aqui no topo.
- Clicar numa página abre o Nível 3.

## Nível 3 — Funil da Página (`/admin/paginas-venda/:productKey/:pageSlug`)
Mostra o funil completo de conversão da página específica. Para `/clube-b`:

```text
PageViews                  ████████████████  N
↓
1ª Oferta revelada (R$97)  ████████████      N (% da etapa anterior)
↓
1º Checkout (R$97/ano)     ████████          N (%)
↓
2ª Oferta revelada (R$69)  ██████            N (%)
↓
2º Checkout (R$69/ano)     ████              N (%)
↓
Assinaturas confirmadas    ██                N (%)
```

Visual: barras horizontais decrescentes + número absoluto + % da etapa anterior + % do topo. Filtro de período (Hoje / 7d / 30d / Tudo).

## Tracking necessário (novo)

Hoje só existe `ab_track_visit` e `ab_track_conversion` (que conta clique de checkout). Pro funil acima preciso de eventos nomeados por página.

**Nova tabela** `page_funnel_events`:
- `page_key` (text) — ex: `clube-b`
- `event` (text) — `pageview` | `offer_1_revealed` | `checkout_1_started` | `offer_2_revealed` | `checkout_2_started` | `subscription_confirmed`
- `session_id` (text) — pra deduplicar por sessão
- `user_id` (uuid, nullable)
- `amount_cents` (int, nullable) — pra registrar 9700 / 6900
- `created_at` (timestamptz)

**RPC** `track_funnel_event(page_key, event, session_id, user_id, amount_cents)` com dedup (não conta o mesmo `event+session_id` duas vezes).

**RPC** `get_page_funnel(page_key, since)` que retorna contagens agregadas por etapa.

## Pontos de instrumentação no código

1. `VipLanding.tsx` e `VipLandingB.tsx`:
   - `useEffect` no mount → `pageview` (já existe `ab_track_visit`, adicionar funnel também).
   - Quando `ClubeDiscountReveal` abre pela 1ª vez → `offer_1_revealed` (amount 9700).
   - Quando usuário clica checkout R$97 → `checkout_1_started` (já dispara `ab_track_conversion`, adicionar funnel).
   - Quando `ClubeExitOffer` abre → `offer_2_revealed` (amount 6900).
   - Quando clica checkout R$69 → `checkout_2_started`.
2. Webhook Stripe (`stripe-webhook` edge function) → ao confirmar assinatura do Clube, insere `subscription_confirmed` com `page_key` lido do `metadata.page_key` da sessão (passar no `createCheckoutSession`).

Para cursos/ebooks o funil simplifica para: PageViews → Checkout iniciado → Compra confirmada.

## Arquivos

**Criar:**
- `supabase/migrations/<timestamp>_page_funnel.sql` — tabela + RPCs + grants.
- `src/hooks/usePageFunnel.ts` — query agregada.
- `src/hooks/useFunnelTracking.ts` — helper client-side com dedup por sessionStorage.
- `src/pages/admin/AdminSalesProduct.tsx` — Nível 2.
- `src/pages/admin/AdminSalesPage.tsx` — Nível 3 (funil).

**Editar:**
- `src/pages/admin/AdminSalesPages.tsx` — vira só Nível 1 (lista de produtos).
- `src/App.tsx` — adicionar rotas dos níveis 2 e 3.
- `src/pages/VipLanding.tsx` / `src/pages/VipLandingB.tsx` — disparar eventos do funil.
- `src/components/user/ClubeExitOffer.tsx` — disparar `offer_2_revealed` / `checkout_2_started`.
- `supabase/functions/stripe-webhook/index.ts` — registrar `subscription_confirmed`.
- `supabase/functions/create-checkout-session/index.ts` (ou equivalente) — propagar `page_key` no metadata.

## Não muda
- Banco de pagamentos, RLS de outras tabelas, autenticação, tracking de Meta Pixel, rotas públicas, PWA.
- `ab_tests` continua existindo (split de tráfego). Só ganha uma "irmã" pro funil detalhado.

## Como testar
1. `/admin/paginas-venda` → mostra só produtos.
2. Clicar em "Clube dos Drinkeros" → lista `/clube` e `/clube-b` com controles A/B.
3. Clicar em `/clube-b` → ver funil. Abrir `/clube-b` numa aba anônima, fechar overlay, clicar checkout — números sobem em tempo real (refetch a cada 30s).
