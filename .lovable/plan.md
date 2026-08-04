# Fazer o desconto do Clube valer de verdade na /pv-clube-b

## Situação atual (verificada no código)

- A `/pv-clube-b` decide entre oferta `intro` (R$47) e `full` (R$197) apenas para exibição, reveal e tracking, com base em `profiles.clube_intro_eligible_until` (janela de 30 min via RPC `ensure_clube_intro_offer`).
- Ao clicar em assinar, a página só navega para `/checkout/club/clube-anual`, sem passar a oferta escolhida.
- `src/pages/Checkout.tsx` tem `CLUB_PRODUCTS["clube-anual"].price = 47` fixo, e as funções `create-mp-payment` e `create-mp-subscription` também cobram 47 (ou 27 no Jovem Bartender), sem checar elegibilidade.
- Consequência: todo mundo paga R$47, dentro ou fora da janela. A urgência mostrada na página é apenas visual. A validação de elegibilidade existe só na função Stripe `create-club-checkout`, que não está no caminho do Mercado Pago.

## O que será feito

Tornar a regra real e validada no servidor:

1. Preço do Clube anual passa a ser R$197 (cheio) e R$47 apenas para quem está dentro da janela de oferta intro.
2. Desconto Jovem Bartender (14–24 anos) continua valendo, com preço final R$27, independente da janela.
3. A página e o checkout passam a exibir exatamente o valor que será cobrado.

## Detalhes técnicos

- Nova função de servidor de precificação reutilizável (dentro de `supabase/functions/_shared/`) que recebe `user_id` e devolve `{ amount, offer }` para `clube-anual`:
  - Jovem Bartender → 27
  - `clube_intro_eligible_until` no futuro → 47
  - caso contrário → 197
- `create-mp-payment` e `create-mp-subscription`: substituir o valor fixo por essa função. O valor enviado pelo cliente nunca é usado como preço.
- `Checkout.tsx`: buscar o preço do clube via nova rota leve (`club-price`) ou via RPC de leitura em vez do `CLUB_PRODUCTS` hardcoded, mantendo estados de carregamento e o Brick só sendo montado com o preço resolvido.
- `VipLandingB.tsx` / `VipLanding.tsx`: usar o mesmo preço resolvido no CTA e no tracking (`InitiateCheckout` com o valor real).
- Manter todos os eventos de Pixel/funnel existentes, só corrigindo o `amountCents`.

## Impacto

- Fluxo de pagamento do Clube (Mercado Pago, cartão recorrente e Pix) e as páginas de venda `/pv-clube` e `/pv-clube-b`.
- Sem alteração de schema, sem remoção de dados.

## Como testar

1. Criar conta nova → abrir `/pv-clube-b` → reveal mostra R$47 → checkout cobra R$47.
2. Conta antiga (fora da janela) → página e checkout mostram/cobram R$197.
3. Perfil com data de nascimento entre 14 e 24 anos → R$27 em ambos os casos.
4. Tentar forçar valor menor pelo cliente → servidor ignora e cobra o valor correto.
