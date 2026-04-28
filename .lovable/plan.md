## Resposta curta

**Sim e não.** Dá pra detectar com bastante precisão **se a sessão atual está rodando dentro do PWA instalado** (modo standalone), mas o navegador **não expõe diretamente** "esse usuário tem o app instalado em algum lugar". O truque é: toda vez que ele abre **pelo PWA**, registramos isso no perfil dele no backend → assim sabemos quem já instalou pelo menos uma vez.

Com isso a gente consegue:
1. Saber quem **nunca** abriu pelo PWA → forçar banner persistente.
2. Saber quem **já abriu** pelo PWA pelo menos 1x → nunca mais mostrar banner em lugar nenhum.
3. Painel admin com lista de quem instalou e quem não.

---

## O que vamos construir

### 1. Detecção e registro automático (cliente)
Hook `usePwaStatus()` que detecta:
- `display-mode: standalone` (Android/Desktop)
- `navigator.standalone` (iOS Safari)
- `display-mode: fullscreen` / `minimal-ui` (fallback)

Quando detectar standalone **e** usuário logado, dispara um `upsert` na tabela `profiles` setando `pwa_installed_at = now()` e `last_pwa_open_at = now()` (só atualiza se mudou de dia, pra não martelar o banco).

### 2. Banco
Migration adicionando 2 colunas em `profiles`:
- `pwa_installed_at timestamptz` — primeira vez que abriu via PWA
- `last_pwa_open_at timestamptz` — última vez que abriu via PWA

### 3. Banner persistente (não-dismissável pra quem não instalou)
Refatorar `InstallBanner.tsx`:
- Se `display-mode: standalone` → não renderiza nada (já está no app).
- Se `profile.pwa_installed_at` existe → não renderiza (já instalou antes, está só usando navegador agora).
- Se nenhum dos dois → mostra banner **sem botão de fechar** (X removido) e remove o `localStorage` de "dismissed".
- Mantém o fluxo: Chrome/Android usa `beforeinstallprompt`; iOS/outros mandam pra `/install` com tutorial.

### 4. Banner flutuante global (opcional, recomendado)
Hoje o `InstallBanner` só aparece em algumas páginas (Index, Login, UserHome, PackageLanding). Pra "forçar até instalar", criar um `PwaInstallGate` montado no `UserLayout` que mostra um **banner fixo no topo** (estilo o `VipFloatingBanner`) em **todas** as páginas internas pra quem ainda não instalou. Mantemos o `InstallBanner` inline nas landings públicas.

### 5. Painel admin
Nova aba em `/admin/users` (ou coluna nova): mostrar badge "PWA instalado" / "Só navegador" e filtro. Adicionar também card no `AdminDashboard` com:
- Total de usuários com PWA instalado
- % de adoção
- Usuários ativos nos últimos 7d que **não** têm PWA

---

## Limitações honestas

- Se o usuário **desinstalar** o PWA, não temos como saber — `pwa_installed_at` continua marcado e o banner some pra sempre. Mitigação: usar `last_pwa_open_at` — se passou >30 dias sem abrir via PWA, voltamos a mostrar o banner.
- iOS no modo "Adicionar à Tela Inicial" funciona, mas o `beforeinstallprompt` não existe no Safari → continua redirecionando pra `/install` com o tutorial visual (já existe).
- Em janela anônima ou outro device, a detecção é por sessão; o registro no `profiles` resolve o cross-device porque está atrelado ao `user_id`.

---

## Detalhes técnicos

**Arquivos a criar:**
- `src/hooks/usePwaStatus.ts` — detecta standalone + reporta pro backend
- `src/components/user/PwaInstallGate.tsx` — banner global persistente
- `supabase/migrations/...` — adiciona colunas em `profiles`

**Arquivos a editar:**
- `src/components/user/InstallBanner.tsx` — usar hook, remover X quando não instalado, sumir quando já instalou
- `src/components/user/UserLayout.tsx` — montar `<PwaInstallGate />`
- `src/pages/admin/AdminUsers.tsx` — coluna/filtro de PWA
- `src/pages/admin/AdminDashboard.tsx` — card de adoção PWA
- `src/hooks/useAdminUsers.ts` — incluir `pwa_installed_at` na query

**RLS:** as colunas novas em `profiles` herdam as policies existentes (usuário lê/atualiza o próprio; admin lê tudo).

**Performance:** o report do hook só roda 1x por sessão (guarda em `sessionStorage`) e só faz UPDATE se `last_pwa_open_at` for de outro dia.
