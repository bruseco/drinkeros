## Organização Oficial dos Planos

A plataforma terá **4 planos oficiais**, com hierarquia clara. Compras avulsas (cursos, ebooks, combos, pacotes) deixam de ser tratadas como "sem plano" e passam a definir automaticamente o plano "Aluno".

### Os 4 planos

| Plano | Quem entra | Acesso | Badge | Cor |
|---|---|---|---|---|
| **Grátis** | Cadastro sem nenhuma compra | Conteúdo livre (cursos/módulos com `is_free=true`) | `Grátis` | Lima |
| **Aluno** | Tem ao menos 1 acesso ativo em `user_courses`, `user_ebooks`, `user_combos` ou `user_packages` (não vencido) e **não** é Sócio nem Vitalício | Apenas o que comprou + conteúdo grátis | `Aluno` | Azul |
| **Sócio** | Tem `user_plans.plan = 'vip'` ativo (não vencido) e **não** é Vitalício | Receitas exclusivas + Batalha + 2 cursos bônus (Bebida Decifrada, Workshop Além dos Clássicos) + tudo que comprou | `Sócio` | Roxo (gradiente atual) |
| **Vitalício** | Tem `user_lifetime_access` (concessão manual, sem checkout) | Tudo do Sócio, sem expiração, libera Receitas globais | `Vitalício` | Âmbar |

Hierarquia de prioridade na exibição: **Vitalício > Sócio > Aluno > Grátis** (sempre mostra o mais alto).

### O que renomear (UI / copy apenas)

- "Clube" → **"Sócio"** em badges, títulos e textos voltados ao usuário
- Página `/clube` (gerenciar assinatura) continua existindo, mas o título passa de "Sócio do Clube" para **"Sócio Drinkeros"**; "Sócio Vitalício dos Drinkeros" continua como está
- E-mails, WhatsApp templates e copy de upsell que mencionam "Clube" passam a usar "Sócio" (texto), mantendo o conceito interno de "Clube" só no banco/legado

> Nota: o termo legado **"Clube"** continua existindo internamente para Batalha mensal, pontos, ranking (`club_recipes`, `club_monthly_winners`, etc.) — isso é uma **feature do plano Sócio**, não um plano. Vamos esclarecer essa separação na UI.

### Mudanças técnicas

**`src/hooks/useUserPlan.ts`**
- Tipo `UserPlan` passa de `'free' | 'vip'` para `'free' | 'aluno' | 'socio' | 'vitalicio'`
- Adicionar query para detectar `isAluno` (existe ao menos uma linha em `user_courses`/`user_ebooks`/`user_combos`/`user_packages` com `expires_at IS NULL OR expires_at > now()`)
- Computar plano final por hierarquia: vitalício > sócio > aluno > grátis
- Manter `isVip` como alias derivado (`isSocio || isVitalicio`) para retrocompatibilidade
- Continuar zerando `expires_at` quando vitalício

**`src/components/user/PlanBadge.tsx`**
- 4 variantes: Grátis (lima), Aluno (azul, ícone `GraduationCap`), Sócio (roxo, `Crown`), Vitalício (âmbar, `Crown`)
- `linkOnFree` continua linkando para `/clube`; novo `linkOnAluno` (default true) também leva para `/clube` como upsell

**`src/pages/user/UserClubeManage.tsx`**
- Trocar "Sócio do Clube" → "Sócio Drinkeros"
- Mostrar para `Aluno` um card "Vire Sócio" antes do histórico
- "Sócio Vitalício dos Drinkeros" inalterado

**Banco — função `get_user_plan`**
- Atualizar para retornar `'vitalicio'`, `'socio'`, `'aluno'`, `'free'` (texto)
- Manter retrocompat: criar nova função `get_user_plan_v2` e ajustar `useUserPlan` para usá-la; `get_user_plan` continua devolvendo `'vip'/'free'` para não quebrar RLS/edge functions existentes

**Documentação**
- Criar `mem://business/plans-hierarchy` com a tabela acima como fonte da verdade

### Não-objetivos (fora deste plano)

- Não mexer em RLS, triggers de propagação de acesso, ou regras de expiração
- Não criar checkout para Vitalício (continua manual)
- Não mexer em Batalha, pontos, recipes_published — continuam sendo features do Sócio
- Não renomear tabelas/colunas do banco (`user_plans.plan = 'vip'` permanece)

### Ordem de implementação

1. Criar `get_user_plan_v2` no banco
2. Atualizar `useUserPlan` (novos campos + hierarquia)
3. Atualizar `PlanBadge` (4 variantes)
4. Atualizar copy em `UserClubeManage`, profile e demais pontos que dizem "Clube"
5. Atualizar testes existentes em `src/hooks/useUserPlan.test.tsx` e `src/test/lifetime-profile.e2e.test.tsx`
6. Salvar memória `mem://business/plans-hierarchy`