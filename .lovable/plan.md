## Objetivo

Sempre que um pagamento for confirmado (Stripe, Mercado Pago ou Clube), o sistema:
1. Cria/atualiza o cliente (stakeholder) no NIBO
2. Cria um agendamento de recebimento já marcado como recebido
3. Dispara a emissão automática da NFS-e

Tudo isso roda no backend, de forma idempotente (não duplica se o webhook reprocessa).

---

## Pré-requisitos que vou pedir antes de começar

Para conseguir conversar com a API do NIBO, preciso destes dados (todos pegos dentro do painel NIBO em **Empresa → Configurações → API** e **Cadastros**):

1. **NIBO_API_TOKEN** — token de API (plano Premium do NIBO)
2. **NIBO_ACCOUNT_ID** — ID da conta financeira onde o recebimento entra (ex: "Conta Stripe", "Conta Mercado Pago")
3. **NIBO_SERVICE_PROFILE_ID** — perfil de serviço usado para a NFS-e (já configurado no NIBO com CNAE, alíquota ISS, etc.)
4. **Os 5 IDs de categoria de receita**, um por tipo de produto:
   - `NIBO_CATEGORY_CURSO`
   - `NIBO_CATEGORY_EBOOK`
   - `NIBO_CATEGORY_COMBO`
   - `NIBO_CATEGORY_PACOTE`
   - `NIBO_CATEGORY_CLUBE`

Vou pedir tudo isso de uma vez via formulário seguro de secrets quando começar a implementação.

---

## O que muda no produto

### Para você
- Nada visível no app do aluno.
- Painel admin ganha uma seção em **Pedidos** mostrando, por venda: status NIBO (pendente / enviado / NFS-e emitida / erro) e link direto para o agendamento no NIBO.
- Botão "Reenviar para NIBO" para corrigir vendas que falharem.

### Para o cliente final
- Nada muda no fluxo de checkout.
- A NF chega normalmente conforme o NIBO já emite hoje.

---

## Como vai funcionar (visão técnica)

### 1. Tabela de controle `nibo_invoices`
Nova tabela para rastrear o que já foi enviado:
- referência da venda (`order_ref`, `product_type`, `user_id`, `amount`)
- `nibo_stakeholder_id`, `nibo_schedule_id`, `nibo_invoice_id`
- `status` (pending / sent / invoiced / error)
- `error_message`, `attempts`, timestamps

A `order_ref` é única — garante idempotência (Stripe e Mercado Pago podem reenviar webhook).

### 2. Edge function `nibo-sync`
Função única que recebe `{ order_ref }` e faz:
1. Lê os dados da venda + perfil do comprador (nome, email, CPF, telefone)
2. Busca/cria stakeholder no NIBO via `POST /customers` (deduplica por CPF)
3. Cria agendamento de recebimento via `POST /schedules/receivable` já com `scheduleDate`, `dueDate`, categoria correta e status pago
4. Dispara `POST /invoices/serviceinvoice` com o `scheduleId` e o `serviceProfileId` para emitir a NFS-e
5. Atualiza `nibo_invoices` com os IDs e status finais
6. Em qualquer erro, salva mensagem e mantém status para reprocesso

Toda chamada vai pra `https://api.nibo.com.br/v1/...` com header `apitoken: $NIBO_API_TOKEN`.

### 3. Disparo automático
Adiciono uma chamada `supabase.functions.invoke('nibo-sync', { body: { order_ref } })` em três pontos:
- `supabase/functions/stripe-webhook/index.ts` — após gravar `vip_payments` / `user_courses` / `user_ebooks` / `user_combos` / `user_packages`
- `supabase/functions/mercadopago-webhook/index.ts` — mesmo ponto
- Cron a cada 15 min reprocessa registros com `status='error'` e `attempts<5` (resiliente a indisponibilidade do NIBO)

### 4. Coleta de CPF
Hoje o checkout do Mercado Pago já coleta CPF (Brick) e o perfil também tem campo CPF. Para Stripe, vou ler o CPF do `profiles.cpf`. Se faltar:
- Marca a venda como `pending_cpf`
- Stakeholder é criado no NIBO sem CPF (apenas nome/email)
- NFS-e fica como rascunho até o usuário preencher CPF no perfil; cron dispara emissão quando completar

### 5. Painel admin
Em `src/pages/admin/AdminOrders.tsx`:
- Coluna "NIBO" com badge de status
- Click abre drawer com detalhes (IDs do NIBO, link externo, erro se houver, botão "Reenviar")

---

## O que vou construir (ordem)

1. Pedir os secrets (NIBO_API_TOKEN + 6 IDs) via formulário seguro
2. Migração: tabela `nibo_invoices` + RLS (admin only)
3. Edge function `nibo-sync` com cliente HTTP, retry, idempotência
4. Edge function `nibo-retry-failed` agendada via cron a cada 15 min
5. Hooks nos webhooks Stripe e Mercado Pago para enfileirar sync
6. UI no AdminOrders: coluna status + botão reenviar
7. Teste end-to-end com 1 venda em cada provedor (modo sandbox/produção do NIBO conforme você indicar)

---

## Riscos e suposições

- **Suposição:** seu plano NIBO é Premium (necessário para a API). Se não for, a integração não funciona — confirmar antes.
- **Suposição:** o `ServiceProfileId` já está cadastrado no NIBO com tributação correta. A NFS-e é emitida com base nele.
- **Risco:** prefeituras às vezes rejeitam NFS-e por dados incompletos do tomador (endereço, IM). Nesses casos a NF fica como erro no NIBO e você corrige por lá — nosso painel mostra o status mas não tenta consertar dados fiscais.
- **Compras antigas (anteriores à integração):** não são enviadas retroativamente por padrão. Se quiser, monto um botão "enviar para NIBO" também na lista existente, mas isso é trabalho extra.

Confirme se posso seguir, e já te peço os secrets do NIBO no próximo passo.