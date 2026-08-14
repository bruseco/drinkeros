# /rand — Captura de lead no presente + cupom de R$197 por e-mail

Sim, é totalmente possível. Resumo do fluxo:

```text
1. Usuário chega na área de preço (R$ 497)
2. Abre o presente → agora pede NOME + E-MAIL para liberar
3. Desconto revelado: 497 → 297 (animação atual, sem mudanças)
4. Tarja pink no topo com contador de 15 min ("oferta por tempo limitado")
5. Se não comprar em 20 min → e-mail "só pra você: R$ 197" (só se NÃO comprou)
5. Link do e-mail abre /rand (ou checkout) com cupom ativo
6. Página mostra R$ 297 e faz nova animação: 297 → 197
7. Checkout cobra R$ 197 (validado no servidor pelo cupom)
```

## 1. Captura de nome e e-mail no presente

- O overlay do presente ganha um passo extra: antes de abrir, um mini-formulário com **Nome** e **E-mail** (validação de formato já existente no projeto) e o botão "PEGAR DESCONTO".
- Ao enviar, o lead é gravado e o presente abre normalmente — a animação 497 → 297 continua igual.
- Se o usuário já está logado, os campos vêm preenchidos e ele só confirma.
- O lead também entra no funil de métricas (`/admin/funis`) como hoje.

## 2. E-mail de segunda oferta (15 minutos)

- Uma rotina automática roda a cada 5 minutos e busca leads do RAND com mais de 15 min, que ainda **não compraram** e que ainda não receberam o e-mail.
- Envia um e-mail (template novo, no padrão visual dos atuais) dizendo que, especialmente para ela, o Pacote RAND sai por **R$ 197** (R$ 300 de desconto), com parcelamento em até 12x, e um botão com link único.
- Um e-mail por lead (sem reenvio). Se a pessoa comprar antes, nada é enviado.

## 3. Cupom no link

- O link do e-mail carrega um **token único do lead** (ex.: `/rand?c=TOKEN`).
- Ao abrir, a página valida o token no servidor e, se válido:
  - mostra R$ 297,
  - dispara uma nova animação descendo para **R$ 197**,
  - mantém o token ao ir para o checkout.
- O checkout exibe R$ 197 e o **valor cobrado é recalculado no servidor** a partir do token (nunca vindo do navegador). Token inválido/expirado → volta ao preço normal.
- Validade sugerida: **48 horas** após o envio do e-mail, uso único.

## Detalhes técnicos

- **Banco**: nova tabela `landing_offer_leads` (page_key, nome, e-mail normalizado, `discount_token`, `token_expires_at`, `email_sent_at`, `redeemed_at`, `user_id` opcional) com RLS: leitura só admin; inserção pública apenas via edge function (`capture-offer-lead`), nunca escrita direta do cliente.
- **Frontend**:
  - `src/components/landing/PriceGiftReveal.tsx`: passo de lead opcional (props `requireLead`, `onLeadSubmit`).
  - `src/pages/landing/CourseLanding.tsx`: props `leadCapture` e `couponPrice`; segunda animação (297 → 197) quando o token é válido; propagação do token para `checkoutPath`.
  - `src/pages/landing/Rand.tsx`: ativa a captura de lead e o preço de cupom 197.
  - `src/pages/Checkout.tsx`: lê `?c=TOKEN`, valida e exibe o preço com cupom.
- **Edge functions**:
  - `capture-offer-lead` (pública, valida formato/rate-limit, cria lead + token).
  - `validate-offer-coupon` (pública, retorna preço final do token).
  - `send-offer-followup-emails` (cron a cada 5 min, guard interno como as demais crons; usa `send-transactional-email`).
  - `create-mp-payment`: aceita `coupon_token`, revalida no servidor e usa R$ 197 como `transaction_amount`; marca `redeemed_at` na aprovação.
- **Template**: `supabase/functions/_shared/transactional-email-templates/rand-offer-197.tsx` + registro no `registry.ts`.
- **Checagem de compra**: por e-mail normalizado em `purchases` (inclui compras de convidado) antes de enviar o e-mail.

## Impactos

- Pagamentos: o valor final passa a depender de cupom validado no servidor — o preço nunca vem do cliente.
- Tracking: eventos de funil e `InitiateCheckout`/`Purchase` continuam iguais, com o valor correto (197 quando houver cupom).
- Nada muda para quem não vem do e-mail: fluxo atual 497 → 297 permanece.

## Como testar

1. Abrir `/rand` anônimo, rolar até o preço, preencher nome/e-mail, conferir animação 497 → 297.
2. Esperar 15 min sem comprar e conferir o e-mail com o link.
3. Abrir o link: preço mostra 297 e anima até 197; checkout cobra 197.
4. Reutilizar o link após a compra ou depois de 48h: preço volta a 297.
