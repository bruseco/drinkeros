## Revisão: InitiateCheckout via Mercado Pago (cursos / ebooks / clube no MP)

Conferi o fluxo ponta a ponta e ele **já segue o mesmo padrão validado da assinatura Stripe**, com dados 100% dinâmicos vindos do backend. Nenhuma alteração necessária.

### Onde dispara

Arquivo: `src/pages/Checkout.tsx`, dentro de `onSubmit` (clique no botão de pagar do Brick). Dois pontos:

1. **Assinatura MP do Clube** (linhas 244–252) — após `create-mp-subscription` retornar com sucesso.
2. **Pagamento avulso MP** (Pix ou cartão de curso/ebook, linhas 278–286) — após `create-mp-payment` retornar com sucesso.

Ambos rodam **antes** de qualquer redirect/`navigate` e **depois** da confirmação do backend, exatamente como no Stripe.

### Dados enviados (todos dinâmicos)

Vindos diretamente da resposta da edge function (sem hardcode no frontend):

- `value` ← `data.amount` (preço real, já com desconto VIP aplicado pelo backend)
- `currency` ← `data.currency` (`"BRL"`)
- `content_name` ← `data.product_name` (ex.: nome do curso/ebook ou "Clube dos Drinkeros · Anual")
- `content_type` ← `'product'` para curso/ebook, `'subscription'` para clube
- `content_ids` ← `[data.product_id]` (UUID do produto no banco; fallback para `id` do pagamento MP)
- `num_items` ← `1`

Edge functions confirmadas:
- `create-mp-payment/index.ts` retorna `amount`, `currency`, `product_name`, `product_id`, `id`.
- `create-mp-subscription/index.ts` retorna `amount`, `currency`, `product_name`, `product_id`, `id`.

### Anti-duplicação

`trackInitiateCheckout` em `src/lib/metaPixel.ts` usa `dedupeKey = ic:${product_id}`, persistido em memória + `sessionStorage`. Mesmo com clique duplo, retry de Pix ou refresh, dispara **uma vez por produto/sessão**. Botão também tem guard `submitting`.

### Eventos preservados

`PageView`, `ViewContent`, `Lead`, `CompleteRegistration` e `Purchase` (via `firePurchaseFromBackend`, só após webhook confirmar pagamento) seguem intactos.

### Conclusão

Fluxo MP está alinhado com o Stripe e validado por código. Sem mudanças a implementar.

Se quiser, posso validar em runtime chamando `create-mp-payment` com um slug real e inspecionando o payload retornado para confirmar os campos no ambiente atual — me diz se prossigo.
