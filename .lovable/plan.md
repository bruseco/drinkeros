## Mudança

No card colorido da home `/app/batalha`, remover o sistema de níveis (Bronze/Prata/Ouro/Mestre Mixologista). Manter apenas os pontos do usuário e o botão de Ranking.

## Como ficará o card

- Esquerda: "Seus pontos" + número grande (ex: `0`)
- Direita: botão `Ranking`
- Fundo: cor sólida neutra do tema (ex: `bg-card` com borda) em vez do gradiente que dependia do tier

## Arquivo alterado

- `src/pages/user/UserBatalha.tsx` — bloco do card (linhas 58–74):
  - Remover `tierColor` do import (e do hook `useBatalha` se não for mais usado em nenhum outro lugar — confirmado, só esse arquivo usa).
  - Trocar o `Card` com `bg-gradient-to-r ${tierColor(...)}` por um card neutro mostrando só pontos.
  - Remover a coluna "Seu nível / {tier}".

## Não mexer

- O hook `tierFromPoints` continua existindo (pode ser usado internamente), mas deixa de ser exibido na UI.
- Nenhuma mudança em banco de dados, pagamentos, tracking ou PWA.
- Página `/app/batalha/ranking` permanece como está (só mês vigente + histórico).

## Como testar

1. Acessar `/app/batalha` logado.
2. Card deve mostrar "Seus pontos: 0" e o botão Ranking, sem texto "Bronze" nem gradiente marrom/laranja.
3. Postar uma receita e votar em outra → pontos aumentam, sem aparecer tier.
