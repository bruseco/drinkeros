
Objetivo: corrigir a vitrine de e-books no painel do usuário para que a capa não fique “zoomada” nem cortada, aparecendo inteira e limitada à largura típica de uma tela de celular.

Plano
1. Ajustar o card de e-book em `src/pages/user/UserEbooks.tsx`
- Remover a configuração que hoje força corte da imagem (`objectFit: 'cover'` + `aspectRatio: '1/1'` no próprio `<img>`).
- Fazer a capa usar a proporção original do arquivo, com `w-full h-auto object-contain`.
- Limitar a largura máxima do card para algo próximo de mobile real, centralizando na tela (`max-w` fixo e `mx-auto`).

2. Redimensionar a apresentação para “largura de celular”
- Em vez de deixar a imagem ocupar toda a largura disponível do layout no desktop/tablet, o bloco do e-book ficará com largura máxima parecida com um celular (ex.: ~360–420px).
- Em telas menores, continua ocupando 100% da largura disponível; em telas maiores, para de crescer.

3. Preservar o layout visual já aprovado
- Manter badge de “Bloqueado” / “Adquirido” no topo direito da capa.
- Manter o título menor, centralizado, em negrito, com sombra preta e sobreposição por cima da imagem usando margem negativa.
- Manter o botão menor abaixo da capa, com texto condicional:
  - `Saiba Mais` quando bloqueado
  - `Baixar E-book` quando adquirido

4. Ajustar o estado sem capa
- Garantir que o placeholder sem imagem siga a mesma largura máxima do card para não quebrar a consistência visual.

Resultado esperado
- A capa deixa de ser cortada.
- O e-book passa a aparecer inteiro.
- A largura visual fica compatível com uma tela de celular, mesmo quando o app estiver aberto em uma viewport maior.
- O restante do visual (badge, título sobreposto e botão) continua igual.

Detalhes técnicos
- Arquivo principal: `src/pages/user/UserEbooks.tsx`
- Troca principal:
  - de imagem “quadrada e cortada”
  - para imagem “proporcional e inteira”
- Estratégia de layout:
```text
container do item: w-full max-w-[390px] mx-auto
imagem: w-full h-auto object-contain
```
- Se necessário, o ajuste fino do `max-w` pode ser feito rapidamente depois de validar visualmente no preview mobile.
