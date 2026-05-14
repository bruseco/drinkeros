## Corrigir comunicação do banner amarelo (intro 80% OFF)

**Arquivo:** `src/components/user/VipDiscountCountdownBanner.tsx`

Substituir o texto atual do banner intro (80%) por:

> **80% OFF** em todos Cursos e E-books — Você tem **7 dias** para aproveitar essa promoção.

### Detalhes
- Remover o uso de `formatRemaining` / `daysRemaining` / `hoursRemaining` no bloco `isIntroActive` (não vamos mais mostrar contagem dinâmica como "expira em instantes" / "restam 2 dias").
- Texto fixo "7 dias" conforme pedido.
- Manter ícone Sparkles, cor de fundo amarela, link para `/app/cursos` e botão de fechar.
- Não alterar o banner base (50%) nem nenhuma outra lógica.

### Resultado visual
```
✨  80% OFF em todos Cursos e E-books — Você tem 7 dias para aproveitar essa promoção.   ✕
```
