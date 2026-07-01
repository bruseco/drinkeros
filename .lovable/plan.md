## Objetivo
Nas receitas do feed do Clube, exibir os comentários automaticamente logo abaixo do card (com foto do autor), limitados a 3, com botão "Carregar mais comentários" quando houver mais. Chat continua sem alterações (só mensagens).

## Alterações

**`src/pages/user/UserClube.tsx` — `RecipeBubble`**
- Remover o toggle `showComments` que só renderiza o bloco após clique no ícone de balão.
- Renderizar `<CommentsBlock targetType="recipe" targetId={recipe.id} />` sempre, quando `recipe.comments_count > 0` OU para permitir comentar (input sempre disponível).
- O ícone de balão passa a ser apenas indicador visual da contagem (sem toggle), ou pode focar o input de comentário — manter como indicador simples.

**`src/pages/user/UserClube.tsx` — `CommentsBlock`**
- Ajustar comportamento default: mostrar os **3 comentários mais recentes** (`comments.slice(-3)`) automaticamente.
- Quando `comments.length > 3` e não expandido, mostrar botão **"Carregar mais X comentários"** (texto ajustado do atual "Ver todos os X comentários").
- Quando não houver comentários, não exibir o texto "Seja o primeiro a comentar" para não poluir — apenas o input de comentar fica visível.
- Manter avatar (foto) + nome + corpo + timestamp relativo já implementados.

**Mesma alteração aplicada em `RecipeCardSearch`** (aba Receitas) para consistência: comentários auto-exibidos abaixo do card.

## Fora do escopo
- Chat (posts sem receita) segue sem bloco de comentários.
- Nenhuma mudança no backend/RLS — `useClubComments` já retorna nome e avatar.
