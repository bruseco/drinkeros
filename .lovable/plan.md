## Objetivo
Adicionar um novo KPI "Cadastros" no painel `/admin/metricas` mostrando o número de novos usuários cadastrados no período do filtro (mesmo range de datas já usado pelos outros cards).

## Mudanças

### 1. Hook novo: `src/hooks/useSignupsCount.ts`
- Recebe `from` e `to` (Date).
- Faz `supabase.from('profiles').select('id', { count: 'exact', head: true }).gte('created_at', from).lte('created_at', to)`.
- Retorna `{ data: number, isLoading }` via `useQuery` com `staleTime: 30_000`.
- Usa a tabela `profiles` (criada automaticamente via trigger em todo signup, inclusive OAuth Google/Apple), garantindo paridade com o evento `CompleteRegistration`.

### 2. `src/pages/admin/AdminAccessMetrics.tsx`
- Importar `useSignupsCount` e o ícone `UserPlus` do lucide.
- Chamar o hook com o mesmo `from`/`to` que alimenta `useAccessMetrics`.
- Mudar a grid de KPIs de `md:grid-cols-4` para `md:grid-cols-5` (mantém 2 cols no mobile).
- Adicionar novo `<Card>` "Cadastros" exibindo o número formatado em pt-BR, posicionado entre "Usuários únicos" e "Tempo assistido" (ou ao final — pode ficar ao final para não desalinhar leitura existente).

## Fluxo impactado
- Apenas leitura. Painel admin de métricas de acesso.
- Nenhum impacto em tracking, pagamentos, auth ou PWA.

## Como testar
1. Acessar `/admin/metricas` como admin.
2. Conferir que aparece o card "Cadastros" com o total do período.
3. Mudar o filtro de datas e verificar se o número atualiza.
4. Comparar com `SELECT count(*) FROM profiles WHERE created_at BETWEEN ...`.
