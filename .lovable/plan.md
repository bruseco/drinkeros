
## Problema

O usuário Luis (e provavelmente vários outros migrados) tem acesso manual à categoria **Receitas** via `user_exclusive_access` (feature=`receitas`, expira em 2027), mas está classificado como **Aluno** pela `get_user_plan_v2`. Como o desconto VIP só é liberado para `isVip = isSocio || isLifetime`, ele não vê os 80%/50%.

Confirmado no banco para o caso reportado:
- `user_plans.plan` = `free`, `discount_intro_started_at` = NULL
- `user_lifetime_access` = vazio
- `user_exclusive_access` = 1 linha ativa, feature `receitas`, válida até 15/05/2027

## Decisão

Quem tem acesso ativo à feature **receitas** em `user_exclusive_access` é um **Sócio legacy** (vinha do sistema antigo do Clube). Vamos reconhecê-lo como Sócio em um só ponto — a RPC `get_user_plan_v2` — para o efeito cascatar automaticamente em:

- `useUserPlan` (isSocio / isVip)
- `useVipDiscount` (80% por 7d → 50%)
- Banner `VipDiscountCountdownBanner`
- Edge functions que calculam preço (`create-product-checkout`, `create-mp-payment`, `create-mp-checkout`) — todas já usam o mesmo `getVipDiscountPercent` baseado em `isVip` + `discount_intro_started_at`
- Badge de plano na UI

## Implementação

### 1. Migration — atualizar `get_user_plan_v2`

Adicionar mais uma cláusula antes da de Aluno: se existir linha ativa em `user_exclusive_access` com feature `receitas`, retorna `socio`.

```sql
CREATE OR REPLACE FUNCTION public.get_user_plan_v2(_user_id uuid)
RETURNS text
LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $$
  SELECT CASE
    WHEN EXISTS (SELECT 1 FROM public.user_lifetime_access WHERE user_id = _user_id) THEN 'vitalicio'
    WHEN public.is_admin(_user_id) THEN 'socio'
    WHEN EXISTS (
      SELECT 1 FROM public.user_plans
      WHERE user_id = _user_id AND plan = 'vip'
        AND (expires_at IS NULL OR expires_at > now())
    ) THEN 'socio'
    -- NOVO: Sócio legacy — acesso manual à categoria Receitas (vinha do Clube antigo)
    WHEN EXISTS (
      SELECT 1 FROM public.user_exclusive_access
      WHERE user_id = _user_id AND feature = 'receitas'
        AND (expires_at IS NULL OR expires_at > now())
    ) THEN 'socio'
    WHEN EXISTS (SELECT 1 FROM public.user_courses WHERE user_id = _user_id AND (expires_at IS NULL OR expires_at > now()))
      OR EXISTS (SELECT 1 FROM public.user_ebooks WHERE user_id = _user_id AND (expires_at IS NULL OR expires_at > now()))
      OR EXISTS (SELECT 1 FROM public.user_combos WHERE user_id = _user_id AND (expires_at IS NULL OR expires_at > now()))
      OR EXISTS (SELECT 1 FROM public.user_packages WHERE user_id = _user_id AND (expires_at IS NULL OR expires_at > now()))
    THEN 'aluno'
    ELSE 'free'
  END;
$$;
```

### 2. Janela de 7 dias para o Sócio legacy

A janela do desconto 80% é gravada em `user_plans.discount_intro_started_at` pela RPC `start_vip_discount_window`, disparada no `AuthContext` quando o usuário é detectado como Sócio. Como o Luis não tem linha em `user_plans`, vou conferir se essa RPC já faz `UPSERT` na tabela. Se ela só faz `UPDATE`, precisa virar `INSERT … ON CONFLICT` para criar o registro do legacy no primeiro login pós-deploy.

Se necessário, ajusto a RPC `start_vip_discount_window` para fazer upsert garantindo:
- `user_id` único
- `plan = 'free'` (não sobrescreve nada do `user_plans`)
- `discount_intro_started_at = COALESCE(existing, now())`

### 3. Atualizar memória

Atualizar `mem://business/vip-tiered-discount` e o core do índice para refletir: "Sócio inclui também legacy via `user_exclusive_access(feature=receitas)`".

## Fora de escopo (não mexer)

- Mercado Pago, Stripe, checkout, Meta Pixel, páginas públicas
- Lógica de upsell / mensagens (continuam classificando esses usuários como sócios — comportamento desejado, já que efetivamente são)
- UI do banner / textos

## Como testar

1. Logar como `luisebrito@yahoo.com.br` no preview → o `AuthContext` chama `start_vip_discount_window`, grava `discount_intro_started_at = now()`, e o banner amarelo de **80% OFF expira em 7 dias** aparece no topo.
2. Conferir badge do plano no menu/perfil mostrando **Sócio**.
3. Abrir um curso pago → preço com 80% de desconto aplicado.
4. Conferir admin → o `useAdminUsers` continua mostrando o usuário (sem regressão).

## Riscos

- Usuários com `user_exclusive_access` ativo deixarão de aparecer como "Aluno" e passarão a contar como "Sócio" em métricas/filtros do admin. Considero isso a correção certa, mas vale confirmar antes de aplicar.
