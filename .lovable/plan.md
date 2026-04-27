# Corrigir checkout do curso "Produção de Ingredientes Artesanais"

## Problema
Ao clicar em "MATRICULE-SE! ACESSO INSTANTÂNEO" na página `/ingredientes-artesanais`, aparece:
> Erro ao iniciar compra — Edge Function returned a non-2xx status code

A edge function `create-product-checkout` está retornando `"Produto não encontrado"` (confirmado nos logs).

## Causa raiz
**Mismatch de slug** entre a landing page e o banco de dados:

| Local | Slug |
|---|---|
| Landing (`IngredientesArtesanais.tsx`) | `ingredientes-artesanais` |
| Rota (`App.tsx`) | `/ingredientes-artesanais` |
| Banco (tabela `courses`) | **`producao-de-ingredientes-artesanais`** |

Como a landing também consulta o curso pelo slug (`useCourseBySlug`), ela nunca encontra o registro real e cai no `fallbackPrice={197}` — por isso a página mostra **R$ 197** quando o preço real cadastrado é **R$ 497**. Os dois sintomas vêm da mesma causa.

## Solução
Alinhar a landing com o slug real do banco — sem mexer no banco (assim os links já compartilhados continuam quebrando? não — o link compartilhado é `/ingredientes-artesanais`, então precisamos manter essa rota viva).

Mudanças:

1. **`src/pages/landing/IngredientesArtesanais.tsx`**
   - Trocar `slug="ingredientes-artesanais"` por `slug="producao-de-ingredientes-artesanais"`.

2. **`src/App.tsx`**
   - Manter a rota `/ingredientes-artesanais` (link curto que já circula).
   - Adicionar também a rota `/producao-de-ingredientes-artesanais` apontando para o mesmo componente, para consistência com o slug do banco e com os `success_url` / `cancel_url` da edge function (que usam `product.slug` do banco).

## Resultado esperado
- Botão de matrícula abre o Stripe Checkout normalmente.
- Preço exibido passa a ser **R$ 497,00** (vindo do banco) com desconto VIP correto para Sócios do Clube.
- Redirect pós-checkout (`/{slug}?checkout=success`) cai numa rota válida.
