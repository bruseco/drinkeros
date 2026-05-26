## Problema

No `src/App.tsx`, as rotas da Batalha estão como redirect para `/app/receitas`:

```tsx
<Route path="batalha" element={<Navigate to="/app/receitas" replace />} />
<Route path="batalha/*" element={<Navigate to="/app/receitas" replace />} />
```

Por isso ao acessar `/app/batalha` o app manda pra Receitas.

## Correção

Em `src/App.tsx`, substituir os dois redirects pelas rotas reais já existentes (componentes já importados no topo do arquivo):

```tsx
<Route path="batalha" element={<UserBatalha />} />
<Route path="batalha/nova" element={<UserBatalhaNew />} />
<Route path="batalha/ranking" element={<UserBatalhaRanking />} />
<Route path="batalha/receita/:id" element={<UserBatalhaRecipeDetail />} />
```

## Arquivos alterados
- `src/App.tsx` (apenas as 2 linhas dos redirects)

## Como testar
1. Acessar `/app/batalha` → feed da Batalha carrega.
2. `/app/batalha/ranking` → ranking.
3. `/app/batalha/nova` → formulário (bloqueia se não for Sócio).
4. `/app/batalha/receita/:id` → detalhe.

Nenhum impacto em auth, pagamentos, tracking, PWA ou banco.