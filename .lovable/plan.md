## Plano: Título "Batalha dos Drinkeros" + ícone "?" para abrir explicação

### 1. `src/pages/user/UserBatalha.tsx`
- Renomear o título de **"Batalha Drinkeros"** para **"Batalha dos Drinkeros"**.
- Adicionar um botão ícone `HelpCircle` (lucide-react) ao lado do título, em formato circular discreto.
- Ao clicar, abre o componente de explicação (`BatalhaIntro` no modo "explainer", pulando o vídeo).
- Estado local `showExplainer` controla a exibição.

### 2. `src/components/user/BatalhaIntro.tsx`
- Adicionar duas novas props opcionais:
  - `initialStage?: 'loading' | 'explainer'` — permite abrir direto no explainer (sem vídeo) quando acionado pelo "?".
  - `showCloseButton?: boolean` — mostra um **X** no canto superior direito da tela de explicação.
- Quando `initialStage='explainer'`, pula totalmente a lógica de vídeo.
- O botão **X** chama `onFinish` (sem gravar no localStorage, já que é apenas re-visualização).
- O botão **"Entrar na Batalha"** continua existindo abaixo (já está implementado), também chamando `onFinish`.
- Manter o comportamento atual da primeira visita (vídeo + flag no localStorage) intacto.

### Resultado
- Header da página: **"Batalha dos Drinkeros"** com ícone "?" ao lado.
- Clique no "?" → abre tela de explicação com **X** no topo direito **e** botão **"Entrar na Batalha"** embaixo, ambos fechando o overlay.
- Primeira visita continua exibindo o vídeo de intro normalmente.