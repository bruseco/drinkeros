
## Objetivo

A regra do desconto passa a valer também para usuários atuais:
- Sócios e Vitalícios começam a contagem regressiva de 7 dias com 80% **no próximo login** após o deploy.
- Após os 7 dias, todos (incluindo Vitalícios) passam a ter 50% permanente.
- Vitalício deixa de ter 80% para sempre — fica igual ao Sócio nessa regra.

## O que muda

### 1. Banco — nova coluna em `user_plans`
Coluna nova `discount_intro_started_at timestamptz` (nullable). É a referência única para o cálculo do desconto, sem mexer no `activated_at` (que controla expiração de acesso).

- `NULL` → janela ainda não iniciada → mostra 80% (estado de "boas-vindas" para quem nunca logou após o deploy).
- Preenchida → contagem corre por 7 dias a partir desse valor; depois cai para 50%.

### 2. Banco — RPC `start_vip_discount_window()` (SECURITY DEFINER)
Chamada pelo cliente após `SIGNED_IN`. Comportamento:
- Garante que existe linha em `user_plans` para o usuário.
- Se o usuário é Sócio (`plan = 'vip'` ativo) **ou** tem lifetime, e `discount_intro_started_at IS NULL` → seta para `now()`.
- Idempotente: se já estiver setada, não mexe.
- Retorna `discount_intro_started_at`.

### 3. Frontend
- `useUserPlan`: passa a buscar `discount_intro_started_at` de `user_plans`.
- `useVipDiscount` / `src/lib/vipDiscount.ts`: usar `discount_intro_started_at` em vez de `activated_at`. Vitalício deixa de ter 80% permanente — usa a mesma lógica do Sócio. Se `discount_intro_started_at` for null e o usuário for VIP/Vitalício, mostra 80% (estado "ainda não iniciado").
- `AuthContext`: no evento `SIGNED_IN`, dispara `supabase.rpc('start_vip_discount_window')` em `setTimeout(..., 0)` (mesmo padrão do `fetchProfile`).
- `VipDiscountCountdownBanner`: continua igual — já reage ao state do hook.

### 4. Edge functions de checkout
`create-product-checkout`, `create-mp-payment`, `create-mp-checkout`: trocar a leitura de `activated_at` por `discount_intro_started_at` e remover o caso especial de "lifetime = 80% sempre". Se `discount_intro_started_at IS NULL` e usuário é Sócio/Vitalício → 80% (mantém consistência com a UI até o primeiro login dele aplicar a janela).

### 5. Memória
Atualizar `mem://business/vip-tiered-discount` e a regra Core do índice: Vitalício agora também segue a regra escalonada; o gatilho da janela é o **primeiro login após deploy** via RPC `start_vip_discount_window`.

## Não muda
- `activated_at` continua intocado (usado por `extend_accesses_on_vip_activation` e `grant_vip_*`).
- Nenhum update em massa retroativo: a regra ativa por usuário só dispara quando ele logar.
- Comportamento para novos Sócios continua igual (a RPC seta a janela no primeiro login deles também).

## Risco
- Usuários que nunca mais logarem ficam permanentemente com 80% no preço exibido — aceitável, pois também nunca chegam a comprar.
- Edge functions e frontend precisam ler o mesmo campo para o preço bater (incluído no escopo).
