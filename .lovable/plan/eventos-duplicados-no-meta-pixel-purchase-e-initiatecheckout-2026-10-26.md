# Eventos duplicados no Meta Pixel (Purchase e InitiateCheckout)

## O que a investigação encontrou (só leitura)

**Inicialização do Pixel: não é a causa.**
- `index.html` chama `fbq('init', '1013268998816669')` uma vez e marca `__META_PIXEL_INITIALIZED_ID__`.
- `FacebookPixel.tsx` vê essa marca e não chama `init` de novo (o ID em tracking_settings é o mesmo).
- `main.tsx` não usa StrictMode.

**InitiateCheckout: causa confirmada no código.** Cada compra do Clube dispara 2 InitiateCheckout:
1. `VipLandingB.tsx` (`handleSubscribe`): no clique do botão da landing `/clube-receitas`, sem `product_id`. A chave anti-duplicação fica `ic:Clube dos Drinkeros · Anual`.
2. `Checkout.tsx` (linhas ~416 e ~464): de novo, depois que o pagamento é criado, com `product_id`. A chave fica `ic:<product_id>`.
- As chaves são diferentes, então a guarda de `trackFbEvent` não bloqueia o segundo disparo.
- Nenhum dos dois envia `eventID`, e InitiateCheckout não vai pela CAPI. Por isso a Meta não tem como juntar os dois.

**Purchase: causa provável, sem confirmação nos logs.**
- `mercadopago-webhook` (`recordPurchase`) chama `fireCapiPurchaseFromWebhook` a cada notificação aprovada, sem verificar se a CAPI já foi enviada. A guarda que existe só cobre os e-mails.
- A compra 186163939894 foi criada às 13:40:56 e regravada às 14:05:38 (`updated_at`). Isso mostra um segundo processamento, que gera um segundo envio da CAPI.
- Os dois envios usam o mesmo `event_id` (`purchase:mercado_pago:186163939894`), mas com `event_time` diferente (`Date.now()`), cerca de 25 min depois.
- Repetir pelo servidor o mesmo event_id não garante que a Meta mostre um evento só.
- O Purchase do navegador (`firePurchaseFromBackend`) usa o mesmo event_id. Para esta compra ele não disparou (`meta_purchase_sent=false`; comprador sem login).
- Os logs de 13:39–14:10 não estão mais disponíveis. Não dá para provar quantos envios saíram nem a resposta da Meta.

## Plano de correção

1. **Purchase: enviar pela CAPI uma vez só por pedido.**
   - Novas colunas em `purchases`: `meta_capi_sent_at` e `meta_capi_event_time`.
   - Antes de enviar, o webhook "trava" o pedido atomicamente: `update ... where meta_capi_sent_at is null returning`. Só quem pega a trava envia.
   - `event_time` passa a ser a hora da aprovação gravada (`created_at`), não a hora do envio.
   - Se a Meta responder com erro, a trava é liberada para uma nova tentativa.
   - O `event_id` continua `purchase:mercado_pago:<transaction_id>` (Stripe: `purchase:stripe:<id>`), igual ao do navegador.
2. **InitiateCheckout: um evento por tentativa de checkout.**
   - O evento fica só no clique da landing (`VipLandingB`), como pede a regra do projeto.
   - O disparo pós-pagamento do `Checkout.tsx` sai quando a origem é a landing do Clube. A página `/checkout` aberta direto continua disparando uma vez.
   - A chave anti-duplicação passa a ser estável (slug do produto), e o `eventID` vai junto.
   - Opcional: espelhar InitiateCheckout na CAPI (`meta-capi-track` já aceita esse evento), com o mesmo eventID.
3. **Sem regressão:** PageView, Lead, CompleteRegistration e ViewContent ficam como estão. A inicialização no `index.html` também.

## Detalhes técnicos

- Arquivos: `supabase/functions/mercadopago-webhook/index.ts`, `supabase/functions/stripe-webhook/index.ts`, `supabase/functions/_shared/metaCapi.ts` (aceitar `eventTime`, devolver ok/erro), `src/pages/Checkout.tsx`, `src/pages/VipLandingB.tsx`, `src/lib/metaPixel.ts` (chave e eventID no `trackInitiateCheckout`), migração nova com as 2 colunas (nullable, sem mexer nos dados existentes).
- Testes: um envio por pedido em notificações repetidas; event_id igual entre navegador e servidor; um InitiateCheckout por compra pela landing.
- Validação: Eventos de Teste da Meta com `test_event_code`, sem compra real. Publicar o frontend e reinstalar as funções só com sua autorização.
