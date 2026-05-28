## Situação atual

Hoje a página `/clube-b` mostra "R$ 197 riscado → R$ 69" mas o Stripe só tem **Price de R$ 69** (cartão recorrente + Pix avulso). Ou seja, o preço cobrado bate por coincidência, não por cupom. Para a nova estrutura (R$ 97 e R$ 69 reais cobrados a partir de R$ 197) precisamos criar Prices de R$ 197 + cupons.

## Nova lógica de preços

| Estado | Exibido | Cobrado no Stripe |
|---|---|---|
| Oferta inicial (30min, reseta toda semana) | R$ 197 riscado → **R$ 97/ano** | Price R$ 197 + cupom `CLUBE_INTRO_100` |
| Oferta de saída (após exit-intent) | R$ 197 riscado → **R$ 69/ano** | Price R$ 197 + cupom `CLUBE_EXIT_128` |
| Sem oferta (após expirar e sem trigger) | R$ 197/ano | Price R$ 197 puro |

Mesma lógica aplicada em cartão (recorrente anual) e Pix (avulso 1 ano).

## Stripe — criar via tools

1. **2 Prices novos** no produto `prod_UMyp07z2Rx5wUF` (Clube dos Drinkeros):
   - `price_card_197` — R$ 197/ano recurring
   - `price_pix_197` — R$ 197 one-time
2. **2 Coupons** (duration `once`):
   - `CLUBE_INTRO_100` — R$ 100 off
   - `CLUBE_EXIT_128` — R$ 128 off

## Backend — `create-club-checkout/index.ts`

- Aceitar `body.offer: 'intro' | 'exit' | 'full'` (default `intro`).
- Sempre usar os Prices de R$ 197.
- Aplicar `discounts: [{ coupon }]` na sessão conforme `offer` (omitir se `full`).
- Retornar `amount` real (pós-cupom) para o `trackInitiateCheckout`.

## Frontend — `VipLandingB.tsx`

- Substituir `useLaunchPromo` por novo hook `useClubeIntroOffer`:
  - Marca `clube:intro-week-start` no `localStorage`.
  - Janela de 30 minutos contando dessa marca; reseta toda **segunda-feira 00h** (ou 7 dias depois da marca, regra: "reseta toda semana").
  - Retorna `{ isActive, mm, ss, price: 97 | 197 }`.
- Card de preço mostra: `R$ 197` riscado + `R$ 97 / ano` + countdown `mm:ss` quando `isActive`. Sem oferta ativa: `R$ 197 / ano` cheio.
- Botão "Quero desbloquear o App" envia `offer: 'intro'` (ou `full` se janela expirou).

## Exit-intent overlay

Componente novo `ClubeExitOffer.tsx` montado dentro do `VipLandingB`:

- **Trigger:** click no botão `X` de fechar, `popstate` do botão voltar do navegador, ou `beforeunload` no desktop. Marca `clube:exit-offer-shown` no `sessionStorage` pra disparar **só uma vez por sessão**.
- **Bloqueia o fechamento da tela** com `history.pushState` enquanto não decidir.
- **Animação:** SVG/CSS de faíscas explodindo (24 partículas com `@keyframes spark-burst` random) → cross-fade pro ícone `GlassWater` (lucide) com `animate-scale-in` e brilho dourado.
- **Copy:** "Você ganhou mais R$ 28 de desconto. Aproveite agora! É o melhor momento para você se tornar Sócio do Clube por apenas **R$ 69/ano**. Esse preço está irresistível."
- **2 CTAs:**
  - Dourado: "Quero aproveitar" → chama `handleSubscribe('card', 'exit')` (R$ 69 via cupom).
  - Texto sutil: "Prefiro perder a melhor oferta da Drinkeros." → fecha overlay + libera saída + marca dispensado.

## Garantia preço exibido = preço cobrado

- Único caminho que cobra **R$ 97** é via offer `intro` + cupom `CLUBE_INTRO_100`.
- Único caminho que cobra **R$ 69** é via offer `exit` + cupom `CLUBE_EXIT_128`.
- `handleSubscribe` lê o estado atual da UI (intro ativa? overlay aberto?) e envia o `offer` correspondente. Impossível cobrar R$ 69 quando a UI mostra R$ 97.

## Tracking

- Mantém `trackInitiateCheckout` com `amount` retornado pelo edge function (já reflete o cupom).
- `trackAbConversion('clube')` continua igual.

## Arquivos afetados

- `src/pages/VipLandingB.tsx` — preço, contador, botão envia `offer`, monta `ClubeExitOffer`.
- `src/components/user/ClubeExitOffer.tsx` — novo.
- `src/hooks/useClubeIntroOffer.ts` — novo (substitui uso de `useLaunchPromo` nesta página; o hook antigo continua para `VipLanding` original).
- `supabase/functions/create-club-checkout/index.ts` — adiciona offer/cupom.
- Stripe — 2 Prices + 2 Coupons criados via tool.

## Como testar

1. Abrir `/clube-b` deslogado → ver R$ 197 → R$ 97 + countdown 30min.
2. Clicar "Quero desbloquear" → Stripe Checkout mostra R$ 97.
3. Voltar para `/clube-b` → tentar voltar/fechar → overlay com faíscas + R$ 69.
4. Clicar "Quero aproveitar" → Stripe Checkout mostra R$ 69.
5. Deixar 30min passar → preço volta a R$ 197 (até a próxima segunda).
