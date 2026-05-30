# Promo R$97 por usuário + reveal cinematográfico do desconto

## 1. Elegibilidade por usuário (banco, não browser)

### Banco
Adicionar em `profiles`:
- `clube_intro_eligible_until timestamptz` — quando a janela de 30 min expira para esse usuário
- `clube_intro_revealed_at timestamptz` — quando a animação já rodou (pra não repetir)

Atualizar trigger `handle_new_user` para setar, em todo cadastro novo (email, Google, Apple):
```
clube_intro_eligible_until := now() + interval '30 minutes'
```
Usuários antigos ficam `NULL` → nunca veem R$97.

### Backend `create-club-checkout`
Antes de aplicar o cupom `CLUBE_INTRO_100`, validar:
```
if offer === 'intro' && (eligible_until is null || eligible_until < now())
  → forçar offer = 'full' (cobra R$197)
```
Impede manipulação do front.

### Hook `useClubeIntroOffer`
- Remover `localStorage` como fonte de verdade.
- Buscar `clube_intro_eligible_until` do `profiles` do usuário logado (via React Query).
- `isActive = eligible_until && now < eligible_until`
- `remainingMs = eligible_until - now`
- Countdown derivado disso.
- Para visitante deslogado: `isActive = false` (mostra R$197 como base; cadastro vai disparar).

## 2. Reveal cinematográfico

### Componente novo: `src/components/user/ClubeDiscountReveal.tsx`
Overlay fullscreen `fixed inset-0 z-[100] bg-black/95 backdrop-blur` com 3 fases:

```text
fase 1 (0.0s – 0.8s):  "Você ganhou" fade-in + slide-up
fase 2 (0.8s – 1.8s):  "R$100" scale 0 → 1 com spring + sparkles explodindo
                        (Framer Motion + sparkles via partículas CSS/SVG)
fase 3 (1.8s – 2.4s):  "de desconto." fade-in abaixo
fase 4 (2.4s – 4.4s):  segura tudo na tela
fase 5 (4.4s – 5.0s):  fade-out do overlay
fase 6 (após fechar):   preço 197 faz roll-down (CountUp de 197 → 97 em ~1s)
fase 7:                 barra fixa de countdown aparece no topo (slide-down)
```

Sparkles: 12–16 partículas douradas (`hsl(var(--accent))` ou tom gold já usado em viplanding-gold-text) saindo do centro do "R$100" com `transform: translate(rx, ry) scale(0)` → `(rx*8, ry*8) scale(1) opacity:0`.

### Gatilho na VipLandingB
- Quando o card de preço entrar no viewport (IntersectionObserver) **E** `promo.isActive` for true **E** `clube_intro_revealed_at` for null:
  - Esperar 2s
  - Disparar reveal
  - Ao final, marcar `clube_intro_revealed_at = now()` no banco (pra não repetir em refresh)
  - Trigger do roll-down do preço (CountUp animado de 197 → 97)
  - Mostrar barra sticky de countdown

### Roll-down do preço (197 → 97)
Componente `AnimatedNumber` já existe no projeto. Usar com easing por ~1s após o overlay fechar. Antes do reveal o card mostra 197 sem riscado; depois do reveal mostra "de R$ 197" riscado + "R$97" com countdown.

## 3. Barra sticky de countdown global

### Componente novo: `src/components/user/ClubeIntroStickyBar.tsx`
- `fixed top-0 inset-x-0 z-50` com safe-area-inset-top.
- Fundo gradient roxo→dourado, texto branco com countdown `mm:ss`.
- CTA "Aproveitar R$97" → leva pra `/clube-b#clube-pricing`.
- Some quando `remainingMs <= 0`.

### Montagem global
Adicionar no `UserLayout.tsx` (e talvez no `App.tsx` pra cobrir landing também) — só renderiza se `promo.isActive`. Como navega entre páginas, fica visível continuamente até o tempo zerar. Adicionar `padding-top` dinâmico no layout pra não cobrir conteúdo.

### Persistência ao navegar
Como a fonte é o banco (`eligible_until`), o React Query mantém o valor em cache; ao trocar de rota a barra continua com a contagem correta.

## 4. Reverter

- `src/hooks/useClubeIntroOffer.ts`: remover toda a lógica de `localStorage` e do reset por visita.
- Mantém apenas `CLUBE_PRICE_INTRO/FULL` como constantes.

## Fluxos impactados

- **Cadastro novo** (qualquer método): chega em `/clube-b` → vê R$197 → 2s depois animação → R$97 + countdown 30min sticky.
- **Mesmo usuário voltando**: vê R$97 direto + countdown (sem animação, pois `revealed_at` já está setado), até zerar a janela.
- **Usuário antigo / janela expirada**: vê R$197, sem animação, sem countdown.
- **Visitante deslogado**: vê R$197. CTA leva pra signup; após cadastrar, ganha os 30 min.
- **Backend**: cupom só aplicado quando elegível.

## Como testar

1. Criar conta nova → ir pra `/clube-b` → ver animação completa → preço cai pra 97 → barra sticky aparece.
2. Navegar pelo app → barra continua no topo com countdown decrementando.
3. F5 na página → vê 97 + countdown direto, sem animação.
4. Avançar `clube_intro_eligible_until` pro passado no DB → recarregar → vira 197, barra some.
5. Logar com `teste@teste.com.br` antigo → 197 direto.
6. Tentar forçar `offer:'intro'` no checkout sem elegibilidade → backend cobra 197.

## Perguntas

1. **Quem perde a janela** (fechou o app antes de 30 min sem comprar): perde de vez ou ganha mais alguma chance? Sugestão: perde — quem volta vê só a oferta de saída de R$69.
2. **Barra sticky deve aparecer também na landing pública `/clube-b` no topo, ou só nas páginas internas (`/app/*`)?** Atualmente o topo da `/clube-b` já tem um banner próprio; podem coexistir ou a sticky substitui o banner enquanto ativa.
