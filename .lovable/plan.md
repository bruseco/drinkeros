# Free: 1 receita completa por semana (em vez de 1 por dia)

Objetivo: reduzir tráfego/consumo do backend passando o limite do plano Grátis de 1 receita por dia para 1 receita por semana, mantendo o bônus de primeiro acesso (3 receitas).

## Regras novas

- Usuário Grátis: 1 receita completa liberada a cada 7 dias corridos (contados a partir da última liberação, fuso America/Sao_Paulo).
- Bônus de primeiro acesso continua: as 3 primeiras receitas do histórico são liberadas sem contar limite.
- Re-abrir uma receita já liberada continua livre (não consome nova liberação).
- Sócio / Vitalício / acesso exclusivo "receitas": sem alteração.
- Xaropes Artesanais: continua exclusivo, sem alteração.

## Mudanças

**Banco (nova função)**
- Criar `public.count_weekly_views(_user_id uuid)` — conta registros de `daily_recipe_views` dos últimos 7 dias (BRT). A tabela e os dados existentes são preservados; `count_daily_views` permanece para não quebrar nada.

**Frontend**
- `src/hooks/useRecipeAccessGuard.ts`: trocar `DAILY_LIMIT` por `WEEKLY_LIMIT = 1`, usar a nova RPC semanal, expor `weeklyLimit` e a data em que libera a próxima. Também reduz chamadas: a checagem passa a usar uma única RPC em vez de 3 queries.
- `src/hooks/useUserPlan.ts`: adicionar `useWeeklyViewCount` (mantendo o hook diário enquanto for usado) com `staleTime` maior (5 min) para cortar requisições repetidas.
- `src/pages/user/UserRecipes.tsx`: `limitReached` passa a considerar a janela semanal (uma consulta por sessão em vez de por dia) e as receitas já liberadas na semana continuam abertas.

**Textos (copy)**
- `src/pages/VipLandingB.tsx` (2 trechos) e `src/pages/VipLanding.tsx` (1 trecho): "1 receita por dia" → "1 receita por semana".
- Ajustar quaisquer mensagens de bloqueio na listagem/detalhe de receita para "próxima receita liberada em X dias".

## Impacto e teste

- Fluxo afetado: acesso do plano Grátis às receitas e o paywall que leva para `/pv-clube-b`.
- Pagamentos, tracking, autenticação e PWA: não afetados.
- Teste: com uma conta Grátis que já tenha 3+ receitas no histórico, abrir uma receita nova → libera; abrir uma segunda receita nova no mesmo dia ou nos próximos 6 dias → redireciona para `/pv-clube-b`; reabrir a receita já liberada → continua funcionando.
