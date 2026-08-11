# Métricas de Funil — Funil RAND

Nova seção no painel admin para acompanhar, passo a passo, o caminho de venda de uma estratégia específica. A primeira será o **Funil RAND** (página `/rand`).

## Etapas do Funil RAND

1. **Acessou a página /rand** — visitante abriu a página
2. **Pegou o desconto** — abriu o presente e recebeu o preço promocional (R$497 → R$297)
3. **Clicou em comprar** — clicou no botão que leva ao checkout
4. **Comprou** — pagamento confirmado (retorno de sucesso do checkout)

Cada etapa conta **visitantes únicos** (por sessão), não cliques repetidos. A tela mostra:
- número absoluto de cada etapa
- % em relação ao topo do funil
- % de conversão de uma etapa para a próxima
- conversão total (acesso → compra)
- filtro de período: Hoje / 7 dias / 30 dias / Tudo, atualizando sozinho a cada 30s

## O que será criado

- **Novo item no menu do admin: "Métricas de Funil"** (desktop e mobile), em `/admin/funis`.
- **Lista de funis** em `/admin/funis`, começando com o card do Funil RAND (com atalho para a página pública).
- **Tela do Funil RAND** em `/admin/funis/rand`, com as 4 etapas em barras, percentuais e período selecionável.
- **Registro dos eventos na página /rand**, nos momentos exatos: ao abrir a página, ao aceitar/ver o presente do desconto, ao clicar no botão de compra e no retorno de compra confirmada.

## Detalhes técnicos

- Reaproveita a infraestrutura já existente (`page_funnel_events`, RPCs `track_funnel_event` e `get_page_funnel`, hook `usePageFunnel`) — **nenhuma alteração de banco de dados é necessária**.
- `page_key` = `rand`; mapeamento das etapas nos eventos já suportados:
  - `pageview` → acesso
  - `offer_1_revealed` → pegou o desconto
  - `checkout_1_started` → clicou em comprar
  - `subscription_confirmed` → compra confirmada
- Dedup já garantido por `UNIQUE (page_key, event, session_id)` + marcação em `sessionStorage`; contagem por `COUNT(DISTINCT session_id)`.
- Arquivos alterados/criados:
  - `src/pages/landing/CourseLanding.tsx`: novas props opcionais `funnelPageKey`; disparos em montagem, `handleGiftReveal`/`handleGiftClose` (revelação do desconto), `handleBuy` (com `amountCents` do preço vigente) e no efeito de `?checkout=success`.
  - `src/pages/landing/Rand.tsx`: passa `funnelPageKey="rand"`.
  - `src/pages/admin/AdminFunnels.tsx` (lista) e `src/pages/admin/AdminFunnelDetail.tsx` (detalhe do RAND), com definição das etapas em um único arquivo de configuração para permitir novos funis depois.
  - `src/App.tsx`: rotas `/admin/funis` e `/admin/funis/:funnelKey`.
  - `src/components/admin/AdminSidebar.tsx` e `AdminMobileNav.tsx`: item de menu.
- Sem impacto em pagamentos, autenticação, PWA ou nos eventos de Meta Pixel já existentes (os eventos de funil são independentes e fire-and-forget).

## Observação

O histórico começa a contar a partir da publicação — ainda não existem eventos gravados para `/rand`, então os números aparecerão conforme o tráfego chegar.
