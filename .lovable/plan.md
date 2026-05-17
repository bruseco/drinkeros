## Problema confirmado

A landing/UI mostra **R$ 139,40 (80% OFF)**, mas o Pix gerado vem com **R$ 697,00** (preço cheio). O desconto está se perdendo entre o clique "Matricule-se" e a geração do pagamento.

## Causa raiz

A página `src/pages/Checkout.tsx` (a tela "Finalizar compra" das imagens) ainda usa a lógica **antiga** de VIP, que ficou incompatível com o novo modelo de planos:

```ts
// linha 171-172
const { data: planData } = await supabase.rpc("get_user_plan", { _user_id: user.id });
setIsVip(planData === "vip");

// linha 185 — sempre 80% hardcoded, ignora janela de 7 dias
return isVip ? Math.round(Number(product.price) * 0.2 * 100) / 100 : Number(product.price);
```

Problemas:

1. Chama `get_user_plan` (v1) em vez de `get_user_plan_v2`. O v1 não conhece "socio"/"vitalicio" nem o sócio legacy (`user_exclusive_access.feature='receitas'`). Resultado: **isVip volta `false` para todo Sócio novo, Vitalício e legacy** → preço cheio na tela.
2. Mesmo se `isVip` fosse true, o cálculo é hardcoded em `* 0.2` (80%). Não respeita a regra 80% → 50% após a janela de 7 dias.
3. Como a tela mostra preço cheio, o usuário gera o Pix nesse preço.

Para o legacy sócio que **não passou pela tela ainda**, há também um agravante: a edge function `create-mp-payment` aplica o desconto certo via `get_user_plan_v2` (já corrigida na migration anterior), mas o Pix precisa ser igual ao valor exibido — então a UI continua sendo a fonte da verdade para o usuário.

## Auditoria do caminho do desconto

| Camada | Onde | Status |
|---|---|---|
| Banner promo | `VipDiscountCountdownBanner` + `useVipDiscount` | OK — já usa `get_user_plan_v2` via `useUserPlan` |
| Landing do produto | (qualquer página que usa `useVipDiscount`) | OK |
| **Tela /checkout** | `src/pages/Checkout.tsx` | **QUEBRADA** — usa RPC antiga e `* 0.2` |
| Edge `create-mp-payment` | `supabase/functions/create-mp-payment` | OK — usa v2 + janela 7d |
| Edge `create-mp-checkout` | `supabase/functions/create-mp-checkout` | OK — usa v2 + janela 7d |
| Edge `create-product-checkout` | `supabase/functions/create-product-checkout` | OK — usa v2 + janela 7d |
| RPC `get_user_plan_v2` | banco | OK — já reconhece Sócio + Vitalício + legacy |

Conclusão: o único ponto a corrigir para o desconto chegar até o Pix/cartão é a **tela de checkout**.

## Implementação

### Único arquivo alterado: `src/pages/Checkout.tsx`

1. Remover o estado local `isVip` e a chamada a `supabase.rpc("get_user_plan", ...)`.
2. Trocar por `useVipDiscount()` (já existente em `src/hooks/useVipDiscount.ts`), que internamente usa `useUserPlan` → `get_user_plan_v2` e aplica a regra escalonada **80% nos primeiros 7 dias → 50% depois** (com fallback de 80% quando `discount_intro_started_at` ainda é NULL).
3. Trocar o `useMemo` do `finalPrice` para usar `applyVipDiscountFor(price, vip.percent)` de `src/lib/vipDiscount.ts`, em vez do `* 0.2` hardcoded. Continua não aplicando desconto quando `productType === 'club'` (mesma regra do back).
4. Exibir o preço correto (com desconto) em todos os pontos da tela: badge "Sócio do Clube", "Total: R$ ..." do Pix, resumo do pedido. Tudo passa a derivar do mesmo `finalPrice` recalculado.
5. Manter os eventos de tracking (ViewContent / InitiateCheckout) com o `finalPrice` já descontado — nenhum evento muda de nome ou momento de disparo.

Resultado: ao abrir `/checkout/course/bar-para-eventos`:
- Sócio novo dentro de 7 dias → R$ 697 × 0,2 = **R$ 139,40**
- Sócio após 7 dias (e Vitalício pós-7d) → R$ 697 × 0,5 = **R$ 348,50**
- Sócio legacy (Luis e demais com `user_exclusive_access.feature='receitas'`) → mesmo tratamento, porque `get_user_plan_v2` já devolve `socio` pra eles
- Free / Aluno → R$ 697,00 (sem mudança)

### Fora de escopo (não mexer)

- Edge functions de checkout (já corretas)
- `useCourses`/`useCombos` que checam `plan === 'vip'` para **acesso a conteúdo**: é outro fluxo (gating de cursos), e o usuário pediu pra focar no desconto. Anoto como follow-up, não toco agora.
- Mercado Pago, Stripe, Meta Pixel, páginas públicas, fluxo de webhook.

## Como testar

1. Logar como `luisebrito@yahoo.com.br` (sócio legacy) → abrir `/checkout/course/bar-para-eventos`.
2. Conferir que aparece **R$ 139,40** no resumo e no botão de pagar.
3. Gerar Pix → o "Total" do Pix deve ser **R$ 139,40** (não R$ 697,00).
4. Pagar com cartão → MP recebe `transaction_amount=139.40` (a edge já faz isso, agora o UI bate).
5. Repetir com um Sócio cuja janela de 7 dias já expirou → preço deve ser R$ 348,50.
6. Repetir como Free → R$ 697,00 (sem regressão).

## Impacto e risco

- Risco baixo: mudança isolada em uma página, sem mexer em banco, edge functions, Stripe/MP ou tracking.
- Tracking InitiateCheckout/Purchase continuam disparando como hoje, só com `value` correto.
- Nada muda para usuários sem direito a desconto.