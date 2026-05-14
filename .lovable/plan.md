# Desconto escalonado do Sócio do Clube

## Regra de negócio

- Ao se tornar **Sócio do Clube** (plano `vip` ativado em `user_plans.activated_at`):
  - **Dias 0–7:** 80% OFF em todos os cursos/ebooks/combos/pacotes (atual).
  - **A partir do dia 8:** 50% OFF permanente enquanto for Sócio.
- **Vitalício** (concessão manual, lifetime): mantém **80% OFF permanente** (não entra na regra de janela).
- Admins (super_admin/editor): também 80% permanente (são tratados como sócios "elevados").

## Arquitetura

### 1. Constantes e helpers (`src/lib/vipDiscount.ts`)
```ts
export const VIP_DISCOUNT_INTRO_PERCENT = 80;     // dias 0–7
export const VIP_DISCOUNT_BASE_PERCENT  = 50;     // após 7 dias
export const VIP_INTRO_WINDOW_DAYS      = 7;

// helpers
getVipDiscountPercent({ activatedAt, isLifetime }) → 80 | 50
applyVipDiscountFor(price, percent)
formatBRL (já existe)
```
Mantém `VIP_DISCOUNT_PERCENT` exportado como **80** apenas para retrocompat (será marcado deprecated). Todos os call sites passarão a usar o helper dinâmico.

### 2. Hook (`src/hooks/useVipDiscount.ts` — novo)
Baseado em `useUserPlan` + `user_plans.activated_at`:
```ts
useVipDiscount() → {
  percent: 80 | 50 | 0,
  isIntroActive: boolean,        // sócio comum dentro dos 7 dias
  daysRemaining: number,         // arredondado pra cima, 0..7
  hoursRemaining: number,
  introExpiresAt: Date | null,
  isLifetime: boolean,           // 80% permanente
  isVip: boolean,
}
```
Busca `activated_at` via `useUserPlan` (estender o hook para retornar este campo — ele já lê `user_plans`).

### 3. Banner amarelo (`src/components/user/VipDiscountCountdownBanner.tsx` — novo)
- Renderizado dentro de `UserLayout`, acima do `UserNavbar` (mobile) e na largura cheia do `<main>` no desktop.
- **Estado intro (80%)** — fundo amarelo (`bg-yellow-400 text-black`):
  > "🎁 Você tem **80% OFF** como novo Sócio! Restam **{X dias / Y horas}**. Depois disso, seu desconto vitalício passa a ser 50%."
  - Mostra contagem regressiva (dias se >24h, senão horas).
  - Botão **X** fecha em memória (sessionStorage só dentro da mesma aba; reabre em nova navegação/refresh — conforme padrão já usado no `VipFloatingBanner`).
  - **Sempre reabre** após fechar quando o usuário volta para o site.
- **Estado base (50%)** — fundo amarelo mais suave:
  > "💎 Como Sócio do Clube, você tem **50% OFF** em todos os cursos e ebooks."
  - Botão **X** fecha **permanentemente** (`localStorage` flag `vip:base50:dismissed`).
  - Quando dispensado, **não aparece mais no layout global**, mas reaparece nas **páginas de produto** (CourseLanding, EbookLanding, PackageLanding, DrinkerosXperience) — placement local controlado pelo mesmo componente com prop `forceShowOnProduct`.
- Vitalício / não-sócio: banner não renderiza.

### 4. Atualizar exibições de preço
Substituir `applyVipDiscount(price)` por `applyVipDiscountFor(price, percent)` usando `useVipDiscount()` em:
- `src/pages/PackageLanding.tsx`
- `src/pages/landing/CourseLanding.tsx`
- `src/pages/landing/EbookLanding.tsx`
- `src/pages/landing/DrinkerosXperience.tsx`
- `src/components/landing/VipFloatingBanner.tsx` (texto: "Sócios pagam X% OFF" dinâmico)
- Qualquer outro componente que mostre "preço VIP" (varredura final via grep).

### 5. Backend — checkout (crítico)
O desconto real aplicado no checkout precisa bater com o exibido. Atualizar 3 edge functions:
- `supabase/functions/create-product-checkout/index.ts`
- `supabase/functions/create-mp-payment/index.ts`
- `supabase/functions/create-mp-checkout/index.ts`

Em cada uma:
1. Buscar `user_plans.activated_at` + `user_lifetime_access` do usuário autenticado.
2. Calcular percent server-side com a mesma lógica do helper (80 dentro de 7 dias OU lifetime/admin; senão 50; senão 0).
3. Aplicar percent no preço final. **Nunca confiar no client.**

### 6. Memória
Atualizar `mem://business/plans-hierarchy` com a nova regra do desconto escalonado para o Sócio.

## Layout do banner

```text
┌────────────────────────────────────────────────────────┐
│ 🎁 80% OFF para novos sócios — restam 4 dias!     [X] │  ← amarelo
├────────────────────────────────────────────────────────┤
│ [logo]              Drinkeros               [avatar]   │  ← UserNavbar
├────────────────────────────────────────────────────────┤
│                                                        │
│                    conteúdo da página                  │
```

Mobile: banner fica entre `PwaInstallGate` e `UserNavbar` no `UserLayout`.
Desktop: banner aparece no topo do `<main>` (sidebar à esquerda permanece intocada).

## Fora de escopo
- Notificações push/email avisando que faltam X dias (pode ser fase 2).
- Animações elaboradas no contador (apenas atualização suave a cada minuto).
