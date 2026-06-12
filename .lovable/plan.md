## Como está hoje

O sync NIBO já tinha sido pensado pra rodar automatizado, mas **na prática nada está sendo emitido**. Diagnóstico:

### 1. O cron está ativo, mas não pega nenhuma venda
- Existe um job `nibo-sync-every-5min` (cron `*/5 * * * *`) ativo, que chama a edge function `nibo-sync-payment` com `{"auto": true}` e o **anon key**.
- Dentro de `nibo-sync-payment`, o modo `auto` chama o RPC `admin_orders` pra buscar as últimas vendas.
- `admin_orders` é `SECURITY DEFINER` mas exige `is_admin(auth.uid())`. Como o cron chama com anon (sem usuário), `auth.uid()` é `null` → **RPC sempre lança "Acesso negado"** → lista de IDs vazia → cron termina silenciosamente sem sincronizar nada.
- Prova: temos 53 vendas em `purchases`, mas só **1 linha em `nibo_sync_log`** (uma VIP, criada manualmente, que falhou).

### 2. Webhooks de pagamento não disparam o NIBO
- Apesar do comentário no topo do arquivo dizer "Disparado por: stripe-webhook, mercadopago-webhook (auto)", **nenhum dos webhooks chama `nibo-sync-payment`** após registrar a venda. Não há nenhum `functions.invoke('nibo-sync-payment')` em `stripe-webhook` nem `mercadopago-webhook`.

### 3. Mapeamento de serviços NIBO está vazio
- A tabela `nibo_service_mappings` está **sem nenhum registro**. Mesmo que o sync rodasse, `emitInvoice` retornaria erro "Sem mapeamento NIBO para product_type=...". Esse mapeamento precisa ser preenchido em `/admin/nibo` (escolher um perfil NIBO pra cada tipo: ebook, curso, combo, pacote, clube).

### 4. O único registro existente também está quebrado por outro motivo
- A linha em `nibo_sync_log` (uma compra VIP) parou em "É necessário preencher os dados do cliente!" — o payload de `customers POST` está incompleto pra NIBO (provavelmente falta endereço/documento). Vamos resolver junto.

## O que vou fazer pra deixar 100% automático

### A. Corrigir o modo `auto` da `nibo-sync-payment`
Trocar a chamada ao RPC `admin_orders` por uma query direta usando o service-role client (que a função já tem), unindo `purchases` + `vip_payments` dos últimos 30 dias e filtrando o que ainda não está como `success` em `nibo_sync_log`. Mantém o limite de 50 por execução.

Resultado: o cron de 5 em 5 minutos passa a enxergar as vendas e sincronizar.

### B. Disparar o NIBO em tempo real nos webhooks
Em `stripe-webhook` (cursos/ebooks pagos via Stripe se aplicável) e em `mercadopago-webhook`, ao final do fluxo de sucesso (depois do `purchases.insert`), fazer um `supabase.functions.invoke('nibo-sync-payment', { body: { order_id: <id> } })` em modo "fire-and-forget" (sem bloquear a resposta ao gateway, com try/catch isolado). O cron continua como rede de segurança pra qualquer falha.

### C. Robustecer o payload de cliente NIBO
Ajustar `upsertCustomer` para enviar todos os campos que a NIBO exige (nome obrigatório, e-mail, telefone formatado, e tentar fallback quando não houver CPF). Hoje só envia `name`, `email` e às vezes `document`/`phone` — e a NIBO está reclamando justamente disso na única tentativa que rodou.

### D. Reprocessar o histórico
Depois que o mapeamento estiver configurado e o código corrigido, disparar `nibo-sync-payment` em modo `auto` uma vez pra emitir NF retroativa das 53 vendas. Vou avisar quando estiver pronto pra rodar.

### E. (Ação do usuário) Configurar `nibo_service_mappings`
Precisa entrar em `/admin/nibo`, clicar em "Buscar perfis no NIBO", e salvar o perfil correto pra cada tipo de produto. Sem isso, **nenhuma NF é emitida** independente do código. Vou deixar isso destacado no fim da implementação.

## Como testar depois
1. Rodar uma venda de teste (Mercado Pago) → conferir que aparece linha em `nibo_sync_log` com `status='success'` em segundos (não precisa esperar 5 min).
2. Conferir no painel NIBO que cliente, lançamento e NF-e foram criados.
3. Conferir o badge "NIBO" verde na linha do pedido em `/admin/pedidos`.
4. Forçar uma falha (ex.: remover temporariamente o mapeamento) → conferir que o cron retenta e o botão "Tentar de novo" funciona.

## Arquivos que serão alterados
- `supabase/functions/nibo-sync-payment/index.ts` — substituir `admin_orders` por query direta, melhorar payload de cliente.
- `supabase/functions/mercadopago-webhook/index.ts` — invocar `nibo-sync-payment` após sucesso.
- `supabase/functions/stripe-webhook/index.ts` — idem.

Nenhuma alteração de UI, tracking (Meta Pixel), PWA, auth, ou banco de dados (sem migration).