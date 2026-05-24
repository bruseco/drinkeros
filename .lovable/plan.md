## Splash screen do PWA Drinkeros

Criar uma tela de splash animada que aparece ao abrir o app instalado (PWA standalone), enquanto as primeiras receitas carregam em background.

### Comportamento

- Aparece **apenas em modo PWA standalone** (não no browser comum) — usa `detectStandalone()` do `usePwaStatus.ts`.
- Mostrada uma vez por sessão (controlada via `sessionStorage`), para não reaparecer em cada navegação interna.
- Bloqueia a renderização do app por baixo até que:
  1. As 3 primeiras receitas sejam pré-carregadas com sucesso (via `supabase.from('recipes')... .limit(5)`), **ou**
  2. Um timeout de segurança de 3.5s seja atingido (para nunca travar o usuário se a rede falhar).
- Fade-out suave (≈300ms) ao revelar o app.

### Visual

- Tela cheia, `bg-background` (preto Drinkeros `0 0% 4%`).
- **Logotipo Drinkeros centralizado** (`src/assets/logotipo-drinkeros.png`), entra com animação de escala de `0` → largura final ≈ **20vw** (no mobile aumenta para ~50vw, no desktop fica ~20vw), duração ~700ms com easing `cubic-bezier(.22,1,.36,1)`.
- **Background:** 3 linhas cinzas horizontais (ondas SVG suaves) que correm da direita para a esquerda em loop infinito (~2.5s), em z-index abaixo do logo, com opacidade baixa (~15–25%) para não competir com o logo.
  - Implementadas como 3 elementos absolutos com SVG wave + `@keyframes` `translateX(0)` → `translateX(-50%)`.
  - Cada linha em altura diferente (topo, meio, base) e velocidades levemente distintas para sensação orgânica.

### Arquivos a criar/alterar

1. **`src/components/user/PwaSplashScreen.tsx`** (novo)
   - Componente que renderiza o overlay full-screen.
   - Recebe `onReady` callback; faz o prefetch das receitas dentro dele.
   - Usa `detectStandalone()` para decidir se monta.
   - Guarda flag em `sessionStorage` (`pwa-splash-shown`) após exibir uma vez.

2. **`src/index.css`** (adicionar keyframes)
   - `@keyframes splash-logo-pop` (scale 0 → 1)
   - `@keyframes splash-wave` (translateX 0 → -50%)
   - Classes utilitárias: `.animate-splash-logo`, `.animate-splash-wave-slow/med/fast`.

3. **`src/components/user/UserLayout.tsx`** (montar o splash)
   - Renderiza `<PwaSplashScreen />` por cima do layout do app autenticado.
   - O splash gerencia a própria visibilidade; não bloqueia o tree por baixo (assim o React Query já pode hidratar).

### Detalhes técnicos

- **Não afetar SEO/landing** — splash só monta no `UserLayout` (área logada do PWA), nunca em landing pages.
- **Não interferir com OAuth/PWA install flow** — só ativa quando `detectStandalone() === true` E há sessão (usuário logado).
- **Safe-area iOS**: o overlay é full-screen com `inset-0`, não precisa de padding extra; logo fica centralizado com flexbox.
- **Acessibilidade**: `role="status"` + `aria-label="Carregando Drinkeros"` no overlay.
- **Performance**: prefetch usa o mesmo client supabase; resultado é descartado (não cacheia em estado), apenas serve para "esquentar" a conexão antes de revelar.

### Fluxo de teste

1. Instalar o PWA (Add to Home Screen) em mobile ou Chrome desktop.
2. Abrir o app instalado → ver splash com logo crescendo + ondas atrás.
3. Após ~1–3s (carregamento das receitas), splash some com fade.
4. Reabrir na mesma sessão → splash não aparece de novo (flag em sessionStorage).
5. Browser normal (não instalado) → splash **não** aparece.

### Impactos

- **Auth/Pagamentos/Tracking/PWA install**: nenhum impacto.
- **Banco de dados**: nenhum (apenas SELECT em `recipes` que já existe).
- **CSS global**: apenas keyframes novos, sem alterar tokens existentes.