## Objetivo
Gerar um novo par de chaves VAPID, atualizar os secrets `VAPID_PUBLIC_KEY` / `VAPID_PRIVATE_KEY` e limpar as inscrições antigas (que ficarão inválidas com a troca).

## Contexto
- A função `generate-vapid-keys` já existe (usa `web-push` para gerar o par e exige admin).
- Os secrets `VAPID_PUBLIC_KEY` e `VAPID_PRIVATE_KEY` já estão configurados — vamos sobrescrevê-los.
- A função `get-vapid-key` entrega a public key ao frontend (`usePushNotifications`).
- A função `send-push-notification` usa as chaves para assinar o envio via `web-push`.
- ⚠️ **Trocar VAPID invalida todas as `push_subscriptions` existentes.** Os usuários precisarão clicar em "Ativar" novamente no prompt.

## Passos

### 1. Gerar novo par de chaves
- Chamar a edge function `generate-vapid-keys` (autenticado como admin) para obter `publicKey` + `privateKey` novos.

### 2. Atualizar os secrets
- Sobrescrever `VAPID_PUBLIC_KEY` com a nova public key.
- Sobrescrever `VAPID_PRIVATE_KEY` com a nova private key.

### 3. Limpar inscrições antigas
- Executar migration para `TRUNCATE public.push_subscriptions` (todas inscrições atuais ficaram inválidas pois foram assinadas com a chave antiga — qualquer envio retornaria 403/410).

### 4. Redeploy das funções que leem os secrets
- Redeploy de `get-vapid-key` e `send-push-notification` para garantir que peguem os novos valores de env.

### 5. Validação
- Testar `get-vapid-key` via curl e confirmar que retorna a nova public key.
- No app, abrir `/app`, dispensar o prompt anterior (limpar `localStorage` `push-prompt-dismissed` se necessário), reativar notificações.
- Enviar uma notificação teste pela admin (`AdminNotifications`) e confirmar entrega.

## Comunicação ao usuário final
Após a rotação, **todos os usuários que já tinham notificações ativas precisarão reativá-las**. Considere avisar via WhatsApp ou um banner.

## Arquivos / recursos afetados
- Secrets: `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY` (atualizados)
- Tabela: `public.push_subscriptions` (TRUNCATE via migration)
- Edge functions: redeploy de `get-vapid-key` e `send-push-notification`
- Nenhuma alteração de código-fonte necessária — toda a infra já existe.
