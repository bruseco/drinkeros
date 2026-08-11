# Corrigir o Funil RAND (etapa "Comprou" inflada)

## O que os dados mostram

Consultei os eventos do funil e as vendas reais:

- Os 9 registros de "Comprou" da página /rand foram gravados todos em **20 segundos**, entre 09:42:28 e 09:42:39 de hoje, em 9 sessões diferentes, sem nenhum clique de compra antes.
- No mesmo período **não houve nenhuma venda real** do RAND. A única venda do RAND nos últimos 7 dias foi em 09/08, antes do funil existir.
- A etapa "Comprou" é disparada hoje pelo **navegador**, quando a página /rand é aberta com `?checkout=success` na URL. Qualquer abertura dessa URL (testes, robô de pré-visualização de link do WhatsApp/Meta, reabrir a aba) conta como venda.
- A etapa "Clicou em comprar" ficou em 0 porque essas sessões nunca clicaram — chegaram direto na URL de sucesso.

Ou seja: o número não é "compras antigas", é **evento falso disparado pela URL de sucesso**. E o inverso também acontece: quem paga por Pix e não volta para a página nunca é contado, então a etapa erra para os dois lados.

## O que vamos fazer

1. **Etapa "Comprou" passa a vir das vendas reais do banco**, não do navegador. Cada funil ganha um produto vinculado (o RAND aponta para o combo RAND) e a contagem usa os pagamentos aprovados no mesmo período do filtro (Hoje / 7 dias / 30 dias / Tudo).
2. **Parar de gravar o evento falso**: a página deixa de registrar "Comprou" ao abrir com `?checkout=success`.
3. **Limpar os 9 registros falsos** já gravados para /rand, para o histórico não ficar distorcido.
4. **Blindar o clique de compra**: registrar "Clicou em comprar" no clique real do botão (antes de qualquer redirecionamento), garantindo que Pix e cartão contem igual.
5. **Nota de leitura no painel**: indicar que "Comprou" é medido por pagamento aprovado do produto (pode incluir quem comprou por outro caminho, ex.: link direto), enquanto as etapas 1–3 são por sessão da página.

## Detalhes técnicos

- `src/lib/funnels.ts`: adicionar ao funil RAND os campos de produto (`productType: 'combo'`, `productSlug: 'rand'`).
- `src/pages/landing/CourseLanding.tsx`: remover o `trackFunnel(..., 'subscription_confirmed')` do efeito de `?checkout=success`; manter o `firePurchaseFromBackend` (tracking do Meta Pixel intacto). Garantir que `checkout_1_started` seja disparado no `onClick` do CTA, antes do `create-mp-*`.
- Nova RPC `get_page_funnel_sales(_product_type text, _product_id uuid, _from timestamptz, _to timestamptz)` (SECURITY DEFINER, restrita a admin) retornando a contagem de `purchases` com `status = 'approved'` no intervalo.
- `src/hooks/usePageFunnel.ts` / `src/pages/admin/AdminFunnelDetail.tsx`: quando o funil tiver produto vinculado, usar essa contagem para a etapa "Comprou" e calcular as porcentagens em cima dela.
- Limpeza de dados: remover os eventos `subscription_confirmed` de `page_key = 'rand'` gravados em 11/08.

## O que não muda

Pagamentos, checkout, Meta Pixel/CAPI, autenticação e PWA seguem iguais — a mudança é de medição e de leitura no painel.
