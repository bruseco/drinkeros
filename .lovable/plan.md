
# Prompt PWA completo para o Boo Task

Cole o bloco abaixo no chat do novo projeto Lovable (Boo Task). Ele instrui o agente a configurar PWA no mesmo nível do Drinkeros: instalável, offline com auto-update, splash screen, banner de instalação, tracking de instalação no perfil e push notifications — respeitando tema claro/escuro do usuário.

Antes de colar, você só precisa:
1. Fazer upload de dois ícones em `public/`: `pwa-192x192.png` e `pwa-512x512.png` (fundo transparente ou sólido, quadrados).
2. Confirmar que Lovable Cloud está ativo (para a tabela `profiles` e a edge function de VAPID).

---

## PROMPT — copie tudo abaixo desta linha

Configure PWA completo no projeto, seguindo exatamente estas regras:

**Identidade do app**
- name: "Boo Task"
- short_name: "Boo Task"
- description: "Scarily easy. Just chat, and your tasks organize themselves."
- lang: "en"
- start_url: "/"
- scope: "/"
- display: "standalone", display_override: ["standalone", "fullscreen"]
- orientation: "portrait"
- theme_color: use a cor primária atual do tema **claro** do app (ler do design system em `src/index.css`)
- background_color: use o background do tema **claro** do app (o splash nativo do SO não segue dark mode dinâmico; use light como padrão neutro)
- Ícones: `/pwa-192x192.png` e `/pwa-512x512.png` (este último também com `purpose: "any maskable"`). Assuma que já existem em `public/`.

**1. vite-plugin-pwa com service worker customizado (injectManifest)**
- Instale `vite-plugin-pwa` e `workbox-precaching workbox-routing workbox-strategies workbox-expiration workbox-cacheable-response` como devDependencies.
- Em `vite.config.ts`, adicione o plugin `VitePWA` com `strategies: "injectManifest"`, `srcDir: "src"`, `filename: "sw.ts"`, `registerType: "autoUpdate"`, `includeAssets: ["favicon.ico", "robots.txt"]`, `workbox.navigateFallbackDenylist: [/^\/~oauth/]`, `injectManifest.maximumFileSizeToCacheInBytes: 4*1024*1024` e `globPatterns: ["**/*.{js,css,html,ico,png,svg,woff2}"]`.
- Adicione `/// <reference types="vite-plugin-pwa/client" />` em `src/vite-env.d.ts`.

**2. Service worker em `src/sw.ts`** com:
- `self.skipWaiting()` no install e `clients.claim()` + limpeza de caches antigos no activate (para forçar update imediato).
- `cleanupOutdatedCaches()` + `precacheAndRoute(self.__WB_MANIFEST)`.
- `NavigationRoute` com `NetworkFirst` (timeout 5s), com `denylist: [/^\/~oauth/]` — rotas OAuth NUNCA podem passar pelo SW.
- `NetworkFirst` para chamadas Supabase (`*.supabase.co`) exceto `/auth/v1/*`.
- `CacheFirst` para imagens (`request.destination === 'image'`), com expiração de 30 dias.
- Handlers `push` e `notificationclick` para exibir notificações com ícone `/pwa-192x192.png` e abrir a URL vinda do payload (default `/`).
- `setCatchHandler` que faz fallback para `fetch(request)` em caso de erro.

**3. Registro do SW em `src/main.tsx`**
- Só em `import.meta.env.PROD`: chamar `registerSW({ immediate: true, onNeedRefresh() { updateSW(true) }, onOfflineReady() {}, onRegisterError() {} })` (auto-update silencioso, sem prompt).
- Em dev: desregistrar todos os `serviceWorker.getRegistrations()` e limpar `caches.keys()` no load, para evitar SW stale durante desenvolvimento.

**4. Meta tags PWA em `index.html`**
- `<meta name="theme-color">` com a cor primária light.
- `<meta name="apple-mobile-web-app-capable" content="yes">`
- `<meta name="apple-mobile-web-app-status-bar-style" content="black-translucent">`
- `<meta name="apple-mobile-web-app-title" content="Boo Task">`
- `<meta name="mobile-web-app-capable" content="yes">`
- `<meta name="format-detection" content="telephone=no">`
- `<link rel="apple-touch-icon">` em 192 e 512
- `<link rel="icon" href="/favicon.png">` (ou o que já existir)
- Título e description do app: "Boo Task — Scarily easy. Just chat, and your tasks organize themselves."

**5. Hook `src/hooks/usePwaStatus.ts`**
- Detecta standalone via `matchMedia('(display-mode: standalone|fullscreen|minimal-ui)')` e `navigator.standalone` (iOS).
- Retorna `{ isStandalone, hasInstalledBefore, lastPwaOpenAt, loading }`.
- Lê `pwa_installed_at` e `last_pwa_open_at` do `profiles` do usuário logado.
- Quando `isStandalone && user`, atualiza `last_pwa_open_at` (e `pwa_installed_at` se ainda vazio) uma vez por sessão (`sessionStorage` guard).
- Exporte também `detectStandalone()` como função pura.
- Adicione as colunas `pwa_installed_at timestamptz` e `last_pwa_open_at timestamptz` em `public.profiles` via migration, com os GRANTs e políticas RLS já existentes preservadas.

**6. Componente `src/components/InstallBanner.tsx`**
- Escuta `beforeinstallprompt`, previne default e guarda o evento.
- Mostra card com CTA "Install" quando não está em standalone, ainda não instalou antes e não foi dispensado (`localStorage.installBannerDismissed`).
- Botão X fecha permanentemente (dispara `install-banner-dismissed` para outros componentes reagirem).
- Se `deferredPrompt` existir, botão chama `prompt()`. Caso contrário, link para `/install` com instruções manuais (iOS Safari).
- Exporta helper `shouldShowInstallBanner({ isStandalone, hasInstalledBefore, loading })`.

**7. Página `src/pages/Install.tsx`**
- Instruções passo a passo para iOS (Share → Add to Home Screen) e Android (menu do Chrome → Instalar app).
- Respeita tema claro/escuro.

**8. Splash screen `src/components/PwaSplashScreen.tsx`**
- Só renderiza se `detectStandalone()` for true e `sessionStorage['pwa-splash-shown'] !== '1'`.
- Mostra logo do Boo Task centralizada com animação suave.
- Faz um prefetch leve (ex: primeiras linhas da tabela principal do app) e fica visível por no mínimo 900ms, máximo 3500ms, depois faz fade-out de 300ms.
- Marca sessionStorage após exibir.
- Renderize dentro de `App.tsx`, fora do router, no topo do tree.

**9. Push Notifications (opt-in)**
- Edge function `get-vapid-key`: retorna `{ publicKey }` a partir de `Deno.env.get("VAPID_PUBLIC_KEY")` com CORS liberado. Instrua o usuário a rodar `npx web-push generate-vapid-keys` localmente e adicionar `VAPID_PUBLIC_KEY` e `VAPID_PRIVATE_KEY` como secrets (via add_secret tool).
- Tabela `push_subscriptions (id uuid pk, user_id uuid fk auth.users, endpoint text unique, p256dh text, auth text, created_at timestamptz default now())` com RLS (usuário só vê/insere/deleta as próprias) e GRANTs para `authenticated` e `service_role`.
- Hook `src/hooks/usePushNotifications.ts`: pede permissão, obtém a VAPID key da edge function, faz `registration.pushManager.subscribe`, salva no Supabase.
- Componente `PushNotificationPrompt.tsx`: card discreto pedindo permissão, aparece só se `Notification.permission === 'default'`, `isStandalone === true` e usuário logado — nunca em preview/dev.
- Edge function `send-push-notification`: recebe `{ user_id, title, body, url }`, busca subscriptions do usuário, envia via web-push com as chaves VAPID.

**10. Tema claro/escuro**
- Não hardcode nenhuma cor. `theme_color` do manifest fica fixo (limitação do SO), mas todos os componentes acima devem usar tokens semânticos do design system (`bg-background`, `text-foreground`, `bg-primary`, etc.) e funcionar nos dois temas.

**11. Preview seguro (não quebrar Lovable preview)**
- O SW NUNCA registra em dev nem em iframe/preview. O guard em `main.tsx` (`import.meta.env.PROD`) já garante isso. Não adicione lógica de registro fora dessa condição. Não prometa comportamento offline dentro do editor do Lovable — offline só funciona no app publicado.

**Ao final, me diga:**
1. Arquivos criados/alterados.
2. Se preciso adicionar algum secret (VAPID keys).
3. Como testar instalação no iPhone e no Android.
4. Como confirmar que o SW não está ativo em preview.

---

## Notas para você (Vinicius)

- O prompt assume que o Boo Task usa React + Vite + Supabase (Lovable Cloud) como o Drinkeros. Se for outro stack, me avisa.
- `theme_color` do manifest é fixo por limitação do sistema operacional (iOS/Android leem só uma cor). Escolhi light como padrão neutro; você pode trocar para dark depois se preferir a barra de status escura sempre.
- Os ícones em `public/pwa-192x192.png` e `public/pwa-512x512.png` precisam existir antes de publicar — se esquecer, o install prompt não aparece.
- Push notifications são opcionais: se não quiser agora, remova a seção 9 antes de colar.
